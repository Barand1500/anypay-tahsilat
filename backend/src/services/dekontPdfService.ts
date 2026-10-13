import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import sharp from 'sharp';
import {
  getDekontSettings,
  getDefaultFisBlocks,
  getDefaultSheetBlocks,
  type DekontBlock,
  type DekontBlockType,
  type DekontContentField,
} from './dekontSettingsService.js';
import { maskCard, maskIdentity, maskPhone, type PublicPaymentRow } from './paymentsService.js';
import { getGeneralSettings, UPLOADS_ROOT } from './settingsService.js';

export type DekontPdfFormat = 'fis' | 'a5' | 'a4';

function money(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Helvetica WinAnsi — Türkçe / özel karakterleri ASCII'ye çevir */
function asciiSafe(raw: string): string {
  return String(raw ?? '')
    .replace(/[—–−]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/₺/g, 'TL ')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/İ/g, 'I')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 200);
}

/** Unicode font varken kontrol karakterlerini temizle */
function unicodeSafe(raw: string): string {
  return String(raw ?? '')
    .replace(/[—–−]/g, '-')
    .replace(/₺/g, 'TL ')
    .replace(/[\u0000-\u001F]/g, '')
    .slice(0, 500);
}

/** Metin kodlama — TR font yoksa ASCII */
let encodePdfText: (raw: string) => string = asciiSafe;

const ONES = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
const TENS = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];

function underThousand(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h === 1) parts.push('YÜZ');
  else if (h > 1) parts.push(`${ONES[h]} YÜZ`);
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(' ');
}

/** Tam lira tutarını yazıya (ekran amountInWordsTr ile aynı) */
function amountInWordsTr(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'SIFIR TÜRK LİRASI';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let s = '';
  if (millions === 1) s += 'BİR MİLYON';
  else if (millions > 1) s += `${underThousand(millions)} MİLYON`;
  if (thousands === 1) s += (s ? ' ' : '') + 'BİN';
  else if (thousands > 1) s += (s ? ' ' : '') + `${underThousand(thousands)} BİN`;
  if (rest) s += (s ? ' ' : '') + underThousand(rest);
  return `${s} TÜRK LİRASI`;
}

const TR_FONT_CANDIDATES = [
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeui.ttf'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeuib.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];

async function readFirstFont(paths: string[]): Promise<Uint8Array | null> {
  for (const p of paths) {
    try {
      const buf = await fs.readFile(p);
      if (buf.length > 1000) return new Uint8Array(buf);
    } catch {
      /* sonraki */
    }
  }
  return null;
}

async function embedPdfFonts(doc: PDFDocument): Promise<{ font: PDFFont; bold: PDFFont; unicode: boolean }> {
  doc.registerFontkit(fontkit);
  const regularBytes = await readFirstFont([
    TR_FONT_CANDIDATES[0],
    TR_FONT_CANDIDATES[2],
    TR_FONT_CANDIDATES[4],
    TR_FONT_CANDIDATES[6],
  ]);
  const boldBytes =
    (await readFirstFont([
      TR_FONT_CANDIDATES[1],
      TR_FONT_CANDIDATES[3],
      TR_FONT_CANDIDATES[5],
      TR_FONT_CANDIDATES[7],
    ])) || regularBytes;

  if (regularBytes && boldBytes) {
    try {
      const font = await doc.embedFont(regularBytes, { subset: true });
      const bold = await doc.embedFont(boldBytes, { subset: true });
      encodePdfText = unicodeSafe;
      return { font, bold, unicode: true };
    } catch (err) {
      console.warn('[dekont-pdf] TR font yüklenemedi, Helvetica:', err);
    }
  }

  encodePdfText = asciiSafe;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { font, bold, unicode: false };
}

function pageSize(format: DekontPdfFormat): [number, number] {
  if (format === 'fis') return [227, 720]; // ~80mm x uzun fiş
  if (format === 'a5') return [420, 595];
  return [595, 842];
}

function slipTitle(tx: PublicPaymentRow): string {
  if (tx.status === 'cancelled') return 'SATIŞ İPTALİ';
  if (tx.status === 'refunded') return 'İADE';
  if (tx.installments > 1) return 'TAKSİTLİ SATIŞ';
  return 'SATIŞ';
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
  const date = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { date, time };
}

function localImageCandidates(urlOrPath: string): string[] {
  const raw = (urlOrPath || '').trim().split('?')[0] || '';
  if (!raw || /^https?:\/\//i.test(raw)) return [];
  if (path.isAbsolute(raw)) return [raw];

  const rel = raw.replace(/^\/+/, '');
  const out: string[] = [];
  if (rel.startsWith('uploads/')) {
    out.push(path.join(UPLOADS_ROOT, rel.slice('uploads/'.length)));
  } else if (raw.startsWith('/uploads/')) {
    out.push(path.join(UPLOADS_ROOT, raw.slice('/uploads/'.length)));
  } else {
    out.push(path.join(UPLOADS_ROOT, rel));
  }
  // public brand / banks
  const publicRel = rel.startsWith('brand/') || rel.startsWith('banks/') ? rel : null;
  if (publicRel || raw.startsWith('/brand/') || raw.startsWith('/banks/')) {
    const p = publicRel || raw.slice(1);
    out.push(
      path.resolve(process.cwd(), 'frontend', 'public', p),
      path.resolve(UPLOADS_ROOT, '..', 'frontend', 'public', p),
      path.resolve(UPLOADS_ROOT, '..', '..', 'htdocs', 'tahsilat.anypay.com.tr', p),
    );
    const file = path.basename(p);
    // Eski PHP: bankalar/ / banks/
    out.push(
      path.join(UPLOADS_ROOT, 'bankalar', file),
      path.join(UPLOADS_ROOT, 'banks', file),
      path.resolve(process.cwd(), 'frontend', 'public', 'banks', file),
    );
  }
  return out;
}

async function loadImageBytes(urlOrPath: string): Promise<Uint8Array | null> {
  for (const local of localImageCandidates(urlOrPath)) {
    try {
      const buf = await fs.readFile(local);
      if (buf.length > 32) return new Uint8Array(buf);
    } catch {
      /* sonraki aday */
    }
  }
  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      const res = await fetch(urlOrPath);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  // Göreli URL — canlı / local static
  if (urlOrPath.startsWith('/')) {
    const port = process.env.PORT || '3010';
    const bases = [
      process.env.PUBLIC_APP_URL,
      process.env.PUBLIC_API_URL,
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ]
      .map((b) => (b || '').replace(/\/$/, ''))
      .filter(Boolean);
    for (const base of bases) {
      try {
        const res = await fetch(`${base}${urlOrPath}`);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
      } catch {
        /* sonraki */
      }
    }
  }
  return null;
}

async function toPngBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await sharp(Buffer.from(bytes)).ensureAlpha().png().toBuffer();
  return new Uint8Array(buf);
}

async function embedLogo(
  doc: PDFDocument,
  urlOrPath: string,
): Promise<PDFImage | null> {
  const bytes = await loadImageBytes(urlOrPath);
  if (!bytes) return null;
  try {
    return await doc.embedPng(bytes);
  } catch {
    /* jpg / webp / diğer */
  }
  try {
    return await doc.embedJpg(bytes);
  } catch {
    /* sharp ile png'ye çevir (webp vb.) */
  }
  try {
    const png = await toPngBytes(bytes);
    return await doc.embedPng(png);
  } catch {
    return null;
  }
}

type PdfBox = { x: number; boxW: number; top: number; boxH: number; bottom: number };

function blockBox(pageW: number, pageH: number, b: DekontBlock): PdfBox {
  const x = (b.x / 100) * pageW;
  const boxH = (b.h / 100) * pageH;
  const boxW = (b.w / 100) * pageW;
  const top = pageH - (b.y / 100) * pageH;
  return { x, boxW, boxH, top, bottom: top - boxH };
}

function drawInBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: PdfBox,
  size: number,
  align: DekontBlock['align'],
  lineOffset = 0,
  padX = 0,
) {
  const t = encodePdfText(text);
  if (!t) return;
  const innerW = Math.max(8, box.boxW - padX * 2);
  let draw = t;
  let tw = font.widthOfTextAtSize(draw, size);
  if (tw > innerW) {
    while (draw.length > 1 && font.widthOfTextAtSize(`${draw}…`, size) > innerW) {
      draw = draw.slice(0, -1);
    }
    draw = `${draw}…`;
    tw = font.widthOfTextAtSize(draw, size);
  }
  let x = box.x + padX;
  if (align === 'center') x = box.x + Math.max(0, (box.boxW - tw) / 2);
  else if (align === 'right') x = box.x + Math.max(0, box.boxW - tw - padX);
  const y = box.top - size - 2 - lineOffset;
  if (y < box.bottom) return;
  page.drawText(draw, {
    x: Math.max(2, x),
    y,
    size,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
}

function wrapWords(
  font: PDFFont,
  text: string,
  size: number,
  maxW: number,
): string[] {
  const words = encodePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  const pushCharBreak = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      const trial = chunk + ch;
      if (font.widthOfTextAtSize(trial, size) > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = trial;
      }
    }
    line = chunk;
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxW) {
      if (line) {
        lines.push(line);
        line = '';
      }
      pushCharBreak(word);
      continue;
    }
    const trial = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Kutuya sığacak şekilde satır satır yazar */
function drawWrappedInBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: PdfBox,
  size: number,
  align: DekontBlock['align'],
  startOffset = 0,
  padX = 2,
): number {
  const maxW = Math.max(8, box.boxW - padX * 2);
  const wrapped = wrapWords(font, text, size, maxW);
  let offset = startOffset;
  for (const ln of wrapped) {
    if (offset + size > box.boxH - 1) break;
    drawInBlock(page, font, ln, box, size, align, offset, padX);
    offset += size + 2;
  }
  return offset;
}

function drawBorderBox(page: PDFPage, box: PdfBox) {
  page.drawRectangle({
    x: box.x,
    y: box.bottom,
    width: box.boxW,
    height: box.boxH,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 0.8,
  });
}

function drawImageInBlock(
  page: PDFPage,
  img: PDFImage,
  box: { x: number; boxW: number; top: number; boxH: number },
) {
  const scale = Math.min(box.boxW / img.width, box.boxH / img.height, 1);
  const iw = img.width * scale;
  const ih = img.height * scale;
  page.drawImage(img, {
    x: box.x + (box.boxW - iw) / 2,
    y: box.top - ih - Math.max(0, (box.boxH - ih) / 2),
    width: iw,
    height: ih,
  });
}

type FisPdfCtx = {
  brandLogoUrl: string;
  bankLogoUrl: string;
  bankName: string;
  merchantTitle: string;
  merchantAddress: string;
  merchantPhone: string;
  date: string;
  time: string;
  atLabel: string;
  dekontNo: string;
  transactionNo: string;
  authCode: string;
  referenceNo: string;
  cardHolderName: string;
  cardMasked: string;
  identityNo: string;
  holderPhone: string;
  description: string;
  amountOnly: string;
  commissionOnly: string;
  installments: number;
  status: string;
  slipTitle: string;
  amountTotal: string;
  amountDetail: string | null;
  legalLine: string;
  legalBox1: string;
  amountInWords: string;
  threeDSecure: boolean;
};

function linesForBlock(type: DekontBlockType, ctx: FisPdfCtx): { text: string; bold: boolean; size: number }[] {
  const showInstallment = ctx.installments > 1 && ctx.status === 'paid';
  switch (type) {
    case 'keepSlip':
      return [{ text: 'BU BELGEYİ SAKLAYINIZ', bold: true, size: 7 }];
    case 'merchantTitle':
      return [{ text: ctx.merchantTitle || '-', bold: true, size: 9 }];
    case 'merchantAddress':
      return ctx.merchantAddress ? [{ text: ctx.merchantAddress, bold: false, size: 7 }] : [];
    case 'merchantPhone':
      return ctx.merchantPhone ? [{ text: ctx.merchantPhone, bold: false, size: 7 }] : [];
    case 'bankName':
      return [{ text: ctx.bankName || '-', bold: true, size: 8 }];
    case 'dateTimeRow': {
      const fisNo = ctx.dekontNo || ctx.transactionNo;
      return [
        { text: `TARİH    : ${ctx.date}`, bold: false, size: 7 },
        { text: `SAAT     : ${ctx.time}`, bold: false, size: 7 },
        { text: `FİŞ NO   : ${fisNo}`, bold: false, size: 7 },
      ];
    }
    case 'txnMeta': {
      const lines: { text: string; bold: boolean; size: number }[] = [
        {
          text: `TARİH:${ctx.date.replace(/\//g, '.')}          SAAT:${ctx.time}`,
          bold: false,
          size: 6.5,
        },
        {
          text: `İŞLEM NO:${ctx.transactionNo}${ctx.authCode ? `     STAN:${ctx.authCode}` : ''}`,
          bold: false,
          size: 6.5,
        },
      ];
      if (ctx.referenceNo) {
        lines.push({
          text: `RRN:${ctx.referenceNo}     SN:${ctx.dekontNo || ctx.transactionNo}`,
          bold: false,
          size: 6.5,
        });
      } else {
        lines.push({ text: `SN:${ctx.dekontNo || ctx.transactionNo}`, bold: false, size: 6.5 });
      }
      return lines;
    }
    case 'installmentLine':
      return showInstallment
        ? [{ text: `TAKSİT SAYISI: ${ctx.installments}`, bold: false, size: 8 }]
        : [];
    case 'slipTitle':
      return [{ text: ctx.slipTitle, bold: true, size: 11 }];
    case 'cardMasked': {
      const lines = [{ text: ctx.cardMasked, bold: false, size: 9 }];
      if (ctx.bankName && ctx.bankName !== '—') {
        lines.push({ text: ctx.bankName, bold: false, size: 7 });
      }
      return lines;
    }
    case 'amountBlock':
      return [
        { text: 'İŞLEM TUTAR', bold: false, size: 7 },
        { text: ctx.amountTotal, bold: true, size: 15 },
        { text: `HARCAMA TUTARI: ${ctx.amountTotal}`, bold: false, size: 6.5 },
      ];
    case 'approvedLine':
      return [{ text: 'İŞLEM ONAYLANDI', bold: true, size: 9 }];
    case 'authRef': {
      const lines: { text: string; bold: boolean; size: number }[] = [];
      if (ctx.authCode || ctx.referenceNo) {
        lines.push({
          text: [ctx.authCode ? `ONAY KODU:${ctx.authCode}` : '', ctx.referenceNo ? `RRN:${ctx.referenceNo}` : '']
            .filter(Boolean)
            .join('     '),
          bold: false,
          size: 6.5,
        });
      }
      if (ctx.referenceNo) {
        lines.push({ text: `BANKA REFERANS:${ctx.referenceNo}`, bold: false, size: 6.5 });
      }
      if (ctx.threeDSecure) {
        lines.push({ text: 'İŞLEM 3D SECURE İLE TAMAMLANMIŞTIR', bold: false, size: 6.5 });
      }
      return lines;
    }
    case 'legalLine':
      return [{ text: ctx.legalLine, bold: false, size: 6.5 }];
    case 'maliDeger':
      return [{ text: 'MALİ DEĞERİ YOKTUR', bold: true, size: 7 }];
    case 'musteriNushasi':
      return [{ text: 'MÜŞTERİ NÜSHASI', bold: true, size: 7 }];
    case 'docTitle':
    case 'partiesCards':
    case 'detailTable':
    case 'legalBox':
      // Özel çizim (drawRichBlock)
      return [];
    case 'dekontNoDate':
      return [
        { text: `Dekont No: ${ctx.dekontNo}     ${ctx.atLabel}`, bold: false, size: 8 },
      ];
    case 'amountWords':
      return [{ text: `Yalnız; ${ctx.amountInWords}`, bold: true, size: 8 }];
    case 'emptyBox':
      return [];
    default:
      return [];
  }
}

function drawRichBlock(
  page: PDFPage,
  block: DekontBlock,
  box: PdfBox,
  ctx: FisPdfCtx,
  font: PDFFont,
  bold: PDFFont,
  scale: number,
) {
  if (block.type === 'docTitle') {
    drawBorderBox(page, box);
    const size = 11 * scale;
    drawInBlock(page, bold, 'SANAL POS E-DEKONT', box, size, 'center', Math.max(0, (box.boxH - size) / 2 - 2));
    return;
  }

  if (block.type === 'partiesCards') {
    const gap = 4;
    const half = (box.boxW - gap) / 2;
    const left = { x: box.x, boxW: half, top: box.top, boxH: box.boxH, bottom: box.bottom };
    const right = {
      x: box.x + half + gap,
      boxW: half,
      top: box.top,
      boxH: box.boxH,
      bottom: box.bottom,
    };
    drawBorderBox(page, left);
    drawBorderBox(page, right);
    const s = 7.5 * scale;
    let o = 4;
    for (const [f, t] of [
      [bold, ctx.merchantTitle || '-'],
      [font, ctx.merchantAddress || ''],
      [font, ctx.merchantPhone || ''],
    ] as const) {
      if (!t) continue;
      o = drawWrappedInBlock(page, f, t, left, s, 'left', o, 4);
    }
    o = 4;
    for (const [f, t] of [
      [bold, ctx.cardHolderName || '-'],
      [font, '-'],
      [font, ctx.holderPhone || ''],
    ] as const) {
      o = drawWrappedInBlock(page, f, t, right, s, 'left', o, 4);
    }
    return;
  }

  if (block.type === 'detailTable') {
    drawBorderBox(page, box);
    const gap = 0;
    const half = box.boxW / 2;
    const leftRows: [string, string][] = [
      ['ONAY ZAMANI', ctx.atLabel],
      ['REFERANS NO', ctx.referenceNo],
      ['ADI SOYADI', ctx.cardHolderName],
      ['T.C. KİMLİK', ctx.identityNo],
      ['TELEFONU', ctx.holderPhone],
      ['AÇIKLAMA', ctx.description],
    ];
    const rightRows: [string, string][] = [
      ['İŞLEM NO', ctx.transactionNo],
      ['ONAY KODU', ctx.authCode],
      ['BANKA', ctx.bankName],
      ['KART', ctx.cardMasked],
      ['TAKSİT', String(ctx.installments)],
      ['TUTAR', ctx.amountOnly],
      ['KOMİSYON', ctx.commissionOnly],
      ['TOPLAM', ctx.amountTotal],
    ];
    page.drawRectangle({
      x: box.x + half,
      y: box.bottom,
      width: 0.6,
      height: box.boxH,
      color: rgb(0.35, 0.35, 0.35),
    });
    const rowH = Math.min(12, box.boxH / Math.max(leftRows.length, rightRows.length));
    const size = Math.min(8 * scale, rowH - 2);
    leftRows.forEach(([k, v], i) => {
      const yOff = 3 + i * rowH;
      const cell = {
        x: box.x,
        boxW: half - gap,
        top: box.top,
        boxH: box.boxH,
        bottom: box.bottom,
      };
      drawInBlock(page, bold, `${k}:`, cell, size, 'left', yOff, 3);
      drawInBlock(page, font, v || '—', cell, size, 'left', yOff, 72);
    });
    rightRows.forEach(([k, v], i) => {
      const yOff = 3 + i * rowH;
      const cell = {
        x: box.x + half,
        boxW: half,
        top: box.top,
        boxH: box.boxH,
        bottom: box.bottom,
      };
      const useBold = k === 'TOPLAM' ? bold : font;
      drawInBlock(page, bold, `${k}:`, cell, size, 'left', yOff, 3);
      drawInBlock(page, useBold, v || '—', cell, size, 'left', yOff, 62);
    });
    return;
  }

  if (block.type === 'legalBox') {
    drawBorderBox(page, box);
    const size = 7 * scale;
    const maxW = Math.max(20, box.boxW - 10);
    const lines = wrapWords(font, ctx.legalBox1, size, maxW);
    let o = 4;
    for (const ln of lines.slice(0, 8)) {
      drawInBlock(page, font, ln, box, size, 'left', o, 4);
      o += size + 2;
    }
    const signY = Math.max(o + 6, box.boxH - 14);
    drawInBlock(page, bold, ctx.cardHolderName || '', box, size, 'left', signY, 4);
    drawInBlock(page, bold, 'İMZA', box, size, 'right', signY, 8);
  }
}

function fieldText(field: DekontContentField, ctx: FisPdfCtx): { text: string; bold: boolean } {
  switch (field) {
    case 'merchantTitle':
      return { text: ctx.merchantTitle, bold: true };
    case 'merchantAddress':
      return { text: ctx.merchantAddress, bold: false };
    case 'merchantPhone':
      return { text: ctx.merchantPhone, bold: false };
    case 'cardHolderName':
      return { text: ctx.cardHolderName, bold: true };
    case 'holderPhone':
      return { text: ctx.holderPhone, bold: false };
    case 'identityNo':
      return { text: ctx.identityNo, bold: false };
    case 'bankName':
      return { text: ctx.bankName, bold: true };
    case 'cardMasked':
      return { text: ctx.cardMasked, bold: false };
    case 'date':
      return { text: ctx.date, bold: false };
    case 'time':
      return { text: ctx.time, bold: false };
    case 'atLabel':
      return { text: ctx.atLabel, bold: false };
    case 'dekontNo':
      return { text: ctx.dekontNo, bold: false };
    case 'transactionNo':
      return { text: ctx.transactionNo, bold: false };
    case 'authCode':
      return { text: ctx.authCode, bold: false };
    case 'referenceNo':
      return { text: ctx.referenceNo, bold: false };
    case 'amountTotal':
      return { text: ctx.amountTotal, bold: true };
    case 'amountOnly':
      return { text: ctx.amountOnly, bold: false };
    case 'commissionOnly':
      return { text: ctx.commissionOnly, bold: false };
    case 'installments':
      return { text: String(ctx.installments), bold: false };
    case 'description':
      return { text: ctx.description, bold: false };
    case 'slipTitle':
      return { text: ctx.slipTitle, bold: true };
    case 'legalLine':
      return { text: ctx.legalLine, bold: false };
    case 'amountInWords':
      return { text: ctx.amountInWords || '-', bold: false };
    case 'staticDocTitle':
      return { text: 'SANAL POS E-DEKONT', bold: true };
    case 'staticKeepSlip':
      return { text: 'BU BELGEYİ SAKLAYINIZ', bold: false };
    case 'staticApproved':
      return { text: 'İŞLEM ONAYLANDI', bold: true };
    case 'staticMali':
      return { text: 'MALİ DEĞERİ YOKTUR', bold: true };
    case 'staticMusteri':
      return { text: 'MÜŞTERİ NÜSHASI', bold: false };
    default:
      return { text: '', bold: false };
  }
}

/** Kayıtlı blok şablonuna göre PDF (fis / a5 / a4) */
async function buildBlocksPdf(tx: PublicPaymentRow, format: DekontPdfFormat): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [w, h] = pageSize(format);
  const page = doc.addPage([w, h]);
  const { font, bold } = await embedPdfFonts(doc);
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  const { date, time } = splitDateTime(tx.at);

  let brandLogoUrl = '';
  try {
    const g = await getGeneralSettings();
    brandLogoUrl = g.logoUrl || '';
  } catch {
    /* yok */
  }

  const settings = await getDekontSettings();
  const layout =
    format === 'fis'
      ? settings.fis
      : format === 'a5'
        ? settings.a5
        : settings.a4;
  const rawBlocks = layout?.blocks?.length
    ? layout.blocks
    : format === 'fis'
      ? getDefaultFisBlocks()
      : getDefaultSheetBlocks();
  const drawList = [...rawBlocks].sort((a, b) => a.z - b.z || a.y - b.y);

  const legal =
    tx.status === 'refunded'
      ? 'TUTAR KARŞILIĞI İŞLEM İADE EDİLMİŞTİR'
      : tx.status === 'cancelled'
        ? 'TUTAR KARŞILIĞI İŞLEM İPTAL EDİLMİŞTİR'
        : 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM';

  const moneyStr = money(total);
  const words = amountInWordsTr(total);
  const ctx: FisPdfCtx = {
    brandLogoUrl,
    bankLogoUrl: tx.bankLogo || '',
    bankName: tx.bankName || '',
    merchantTitle: d.merchantTitle || '',
    merchantAddress: d.merchantAddress || '',
    merchantPhone: d.merchantPhone || '',
    date,
    time,
    atLabel: `${date} ${time}`,
    dekontNo: tx.id,
    transactionNo: d.transactionNo || tx.id,
    authCode: d.authCode || '',
    referenceNo: d.referenceNo || '',
    cardHolderName: d.cardHolderName || '',
    cardMasked: maskCard(d.cardMasked || ''),
    identityNo: maskIdentity(d.identityNo || ''),
    holderPhone: maskPhone(d.cardHolderPhone || d.cardHolderPhoneMasked || ''),
    description: d.description || '-',
    amountOnly: money(tx.amount),
    commissionOnly: money(tx.commission),
    installments: tx.installments,
    status: tx.status,
    slipTitle: slipTitle(tx),
    amountTotal: `${moneyStr} TL`,
    amountDetail:
      tx.commission > 0
        ? `Tutar ${money(tx.amount)} · Komisyon ${money(tx.commission)}`
        : null,
    legalLine: legal,
    legalBox1: `Kredi kartımdan / banka kartımdan ${moneyStr} TL tutarın ${d.merchantTitle || ''} adına çekilmesini ve ilgili tutarın üye işyerine aktarılmasını kabul ederim.`,
    amountInWords: words,
    threeDSecure: Boolean(d.threeDSecure),
  };

  const brandImg = brandLogoUrl ? await embedLogo(doc, brandLogoUrl) : null;
  const bankImg = tx.bankLogo ? await embedLogo(doc, tx.bankLogo) : null;

  for (const block of drawList) {
    const box = blockBox(w, h, block);
    const scale = block.fontScale || 1;

    if (block.type === 'brandLogo') {
      if (brandImg) drawImageInBlock(page, brandImg, box);
      else drawInBlock(page, bold, 'Logo', box, 9 * scale, block.align);
      continue;
    }
    if (block.type === 'bankLogo') {
      if (bankImg) drawImageInBlock(page, bankImg, box);
      else drawInBlock(page, bold, ctx.bankName || '-', box, 9 * scale, block.align);
      continue;
    }

    if (
      block.type === 'docTitle' ||
      block.type === 'partiesCards' ||
      block.type === 'detailTable' ||
      block.type === 'legalBox'
    ) {
      drawRichBlock(page, block, box, ctx, font, bold, scale);
      continue;
    }

    if (block.type === 'emptyBox' || block.type === 'contentBox' || block.type === 'customText') {
      const showBorder =
        block.type === 'customText' ? block.border === true : block.border !== false;
      if (showBorder) drawBorderBox(page, box);
      if (block.type === 'contentBox') {
        const fields = block.fields?.length
          ? block.fields
          : (['merchantTitle', 'merchantAddress', 'merchantPhone'] as DekontContentField[]);
        let offset = 4;
        for (const f of fields) {
          const line = fieldText(f, ctx);
          if (!line.text) continue;
          const size = 8 * scale;
          offset = drawWrappedInBlock(
            page,
            line.bold ? bold : font,
            line.text,
            box,
            size,
            block.align,
            offset,
            4,
          );
        }
      }
      if (block.type === 'customText') {
        const raw = (block.text || '').trim() || 'İstek metin';
        const size = 8 * scale;
        drawWrappedInBlock(page, font, raw, box, size, block.align, 4, 4);
      }
      continue;
    }

    const lines = linesForBlock(block.type, ctx);
    let offset = 0;
    for (const line of lines) {
      const size = line.size * scale;
      offset = drawWrappedInBlock(
        page,
        line.bold ? bold : font,
        line.text,
        box,
        size,
        block.align,
        offset,
        2,
      );
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Sanal POS e-dekont PDF (pdf-lib) — format: fis | a5 | a4 */
export async function buildDekontPdf(
  tx: PublicPaymentRow,
  format: DekontPdfFormat = 'a4',
): Promise<Buffer> {
  return buildBlocksPdf(tx, format);
}

export function parseDekontFormat(raw: unknown): DekontPdfFormat {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'fis' || s === 'a5' || s === 'a4') return s;
  return 'a4';
}
