import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import {
  getDekontSettings,
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
    .slice(0, 120);
}

function pageSize(format: DekontPdfFormat): [number, number] {
  if (format === 'fis') return [227, 720]; // ~80mm x uzun fiş
  if (format === 'a5') return [420, 595];
  return [595, 842];
}

function slipTitle(tx: PublicPaymentRow): string {
  if (tx.status === 'cancelled') return 'SATIS IPTALI';
  if (tx.status === 'refunded') return 'IADE';
  if (tx.installments > 1) return 'TAKSITLI SATIS';
  return 'SATIS';
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
  // Göreli URL — PUBLIC_APP_URL ile dene
  if (urlOrPath.startsWith('/')) {
    const base = (process.env.PUBLIC_APP_URL || process.env.PUBLIC_API_URL || '')
      .replace(/\/$/, '');
    if (base) {
      try {
        const res = await fetch(`${base}${urlOrPath}`);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
      } catch {
        /* yok */
      }
    }
  }
  return null;
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
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

function blockBox(pageW: number, pageH: number, b: DekontBlock) {
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
  box: { x: number; boxW: number; top: number; boxH: number },
  size: number,
  align: DekontBlock['align'],
  lineOffset = 0,
) {
  const t = asciiSafe(text);
  if (!t) return;
  const tw = font.widthOfTextAtSize(t, size);
  let x = box.x;
  if (align === 'center') x = box.x + Math.max(0, (box.boxW - tw) / 2);
  else if (align === 'right') x = box.x + Math.max(0, box.boxW - tw);
  const y = box.top - size - 2 - lineOffset;
  if (y < box.top - box.boxH) return;
  page.drawText(t, {
    x: Math.max(4, x),
    y,
    size,
    font,
    color: rgb(0.08, 0.08, 0.08),
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
      return [{ text: 'BU BELGEYI SAKLAYINIZ', bold: true, size: 7 }];
    case 'merchantTitle':
      return [{ text: ctx.merchantTitle || '-', bold: true, size: 9 }];
    case 'merchantAddress':
      return ctx.merchantAddress ? [{ text: ctx.merchantAddress, bold: false, size: 7 }] : [];
    case 'merchantPhone':
      return ctx.merchantPhone ? [{ text: ctx.merchantPhone, bold: false, size: 7 }] : [];
    case 'bankName':
      return [{ text: ctx.bankName || '-', bold: true, size: 8 }];
    case 'dateTimeRow':
      return [{ text: `TARIH: ${ctx.date}          SAAT: ${ctx.time}`, bold: false, size: 7 }];
    case 'txnMeta': {
      const lines: { text: string; bold: boolean; size: number }[] = [
        {
          text: `ISLEM NO: ${ctx.transactionNo}${ctx.authCode ? `   ONAY: ${ctx.authCode}` : ''}`,
          bold: false,
          size: 7,
        },
      ];
      if (ctx.referenceNo) lines.push({ text: `REF: ${ctx.referenceNo}`, bold: false, size: 7 });
      if (ctx.cardHolderName && ctx.cardHolderName !== '—') {
        lines.push({ text: `KART SAHIBI: ${ctx.cardHolderName}`, bold: false, size: 7 });
      }
      return lines;
    }
    case 'installmentLine':
      return showInstallment
        ? [{ text: `TAKSIT SAYISI: ${ctx.installments}`, bold: true, size: 8 }]
        : [];
    case 'slipTitle':
      return [{ text: ctx.slipTitle, bold: true, size: 11 }];
    case 'cardMasked':
      return [{ text: ctx.cardMasked, bold: false, size: 9 }];
    case 'amountBlock': {
      const lines = [
        { text: 'ISLEM TUTARI', bold: true, size: 7 },
        { text: ctx.amountTotal, bold: true, size: 14 },
      ];
      if (ctx.amountDetail) lines.push({ text: ctx.amountDetail, bold: false, size: 6.5 });
      return lines;
    }
    case 'approvedLine':
      return [{ text: 'ISLEM ONAYLANDI', bold: true, size: 9 }];
    case 'authRef': {
      const lines: { text: string; bold: boolean; size: number }[] = [];
      if (ctx.authCode) lines.push({ text: `ONAY KODU: ${ctx.authCode}`, bold: false, size: 7 });
      if (ctx.referenceNo) lines.push({ text: `BANKA REFERANS: ${ctx.referenceNo}`, bold: false, size: 7 });
      if (ctx.threeDSecure) {
        lines.push({ text: '3D Secure ile tamamlanmistir.', bold: false, size: 6.5 });
      }
      return lines;
    }
    case 'legalLine':
      return [{ text: ctx.legalLine, bold: false, size: 6.5 }];
    case 'maliDeger':
      return [{ text: 'MALI DEGERI YOKTUR', bold: true, size: 7 }];
    case 'musteriNushasi':
      return [{ text: 'MUSTERI NUSHASI', bold: true, size: 7 }];
    case 'docTitle':
      return [{ text: 'SANAL POS E-DEKONT', bold: true, size: 12 }];
    case 'dekontNoDate':
      return [
        { text: `Dekont No: ${ctx.dekontNo}     ${ctx.atLabel}`, bold: false, size: 8 },
      ];
    case 'partiesCards':
      return [
        { text: ctx.merchantTitle || '-', bold: true, size: 8 },
        { text: ctx.merchantAddress || '', bold: false, size: 7 },
        { text: ctx.merchantPhone || '', bold: false, size: 7 },
        { text: ctx.cardHolderName || '-', bold: true, size: 8 },
        { text: ctx.holderPhone || '', bold: false, size: 7 },
      ];
    case 'detailTable':
      return [
        { text: `ONAY: ${ctx.atLabel}  REF: ${ctx.referenceNo}`, bold: false, size: 7 },
        { text: `ISLEM: ${ctx.transactionNo}  ONAY KODU: ${ctx.authCode}`, bold: false, size: 7 },
        { text: `KART: ${ctx.cardMasked}  TAKSIT: ${ctx.installments}`, bold: false, size: 7 },
        {
          text: `TUTAR: ${ctx.amountOnly}  KOMISYON: ${ctx.commissionOnly}  TOPLAM: ${ctx.amountTotal}`,
          bold: true,
          size: 8,
        },
      ];
    case 'legalBox':
      return [
        { text: ctx.legalBox1, bold: false, size: 6.5 },
        { text: `${ctx.cardHolderName}                    IMZA`, bold: true, size: 7 },
      ];
    case 'amountWords':
      return [{ text: `Yalniz; ${ctx.amountInWords}`, bold: true, size: 8 }];
    case 'emptyBox':
      return [];
    default:
      return [];
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
      return { text: 'BU BELGEYI SAKLAYINIZ', bold: false };
    case 'staticApproved':
      return { text: 'ISLEM ONAYLANDI', bold: true };
    case 'staticMali':
      return { text: 'MALI DEGERI YOKTUR', bold: true };
    case 'staticMusteri':
      return { text: 'MUSTERI NUSHASI', bold: false };
    default:
      return { text: '', bold: false };
  }
}

/** Kayıtlı blok şablonuna göre PDF (fis / a5 / a4) */
async function buildBlocksPdf(tx: PublicPaymentRow, format: DekontPdfFormat): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [w, h] = pageSize(format);
  const page = doc.addPage([w, h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
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
  const blocks = [...(layout?.blocks ?? [])].sort((a, b) => a.z - b.z || a.y - b.y);

  const legal =
    tx.status === 'refunded'
      ? 'TUTAR KARSILIGI ISLEM IADE EDILMISTIR'
      : tx.status === 'cancelled'
        ? 'TUTAR KARSILIGI ISLEM IPTAL EDILMISTIR'
        : 'TUTAR KARSILIGI MAL VEYA HIZMET ALDIM';

  const moneyStr = money(total);
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
    legalBox1: `Kredi kartimdan ${moneyStr} TL tutarin ${d.merchantTitle || ''} adina cekilmesini kabul ederim.`,
    amountInWords: '',
    threeDSecure: Boolean(d.threeDSecure),
  };

  const brandImg = brandLogoUrl ? await embedLogo(doc, brandLogoUrl) : null;
  const bankImg = tx.bankLogo ? await embedLogo(doc, tx.bankLogo) : null;

  for (const block of blocks) {
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

    if (block.type === 'emptyBox' || block.type === 'contentBox' || block.type === 'customText') {
      const showBorder =
        block.type === 'customText' ? block.border === true : block.border !== false;
      if (showBorder) {
        page.drawRectangle({
          x: box.x,
          y: box.bottom,
          width: box.boxW,
          height: box.boxH,
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 0.8,
        });
      }
      if (block.type === 'contentBox') {
        const fields = block.fields?.length
          ? block.fields
          : (['merchantTitle', 'merchantAddress', 'merchantPhone'] as DekontContentField[]);
        let offset = 4;
        for (const f of fields) {
          const line = fieldText(f, ctx);
          if (!line.text) continue;
          const size = 8 * scale;
          drawInBlock(page, line.bold ? bold : font, line.text, box, size, block.align, offset);
          offset += size + 2;
        }
      }
      if (block.type === 'customText') {
        const raw = (block.text || '').trim() || 'Istek metin';
        const size = 8 * scale;
        // Satır satır çiz (basit kelime bölme)
        const words = asciiSafe(raw).split(/\s+/).filter(Boolean);
        let line = '';
        let offset = 4;
        const maxW = Math.max(20, box.boxW - 6);
        for (const word of words) {
          const trial = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(trial, size) > maxW && line) {
            drawInBlock(page, font, line, box, size, block.align, offset);
            offset += size + 2;
            line = word;
          } else {
            line = trial;
          }
        }
        if (line) drawInBlock(page, font, line, box, size, block.align, offset);
      }
      continue;
    }

    const lines = linesForBlock(block.type, ctx);
    let offset = 0;
    for (const line of lines) {
      const size = line.size * scale;
      drawInBlock(page, line.bold ? bold : font, line.text, box, size, block.align, offset);
      offset += size + 2;
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
