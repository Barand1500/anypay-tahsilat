import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { PublicPaymentRow } from './paymentsService.js';
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

function drawLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size = 10,
) {
  page.drawText(asciiSafe(text), { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
}

function drawCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size: number,
  pageW: number,
) {
  const t = asciiSafe(text);
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, {
    x: Math.max(8, (pageW - tw) / 2),
    y,
    size,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
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

function drawEmbeddedImage(
  page: PDFPage,
  img: PDFImage,
  pageW: number,
  yTop: number,
  maxH: number,
  maxW: number,
): number {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: (pageW - w) / 2,
    y: yTop - h,
    width: w,
    height: h,
  });
  return yTop - h;
}

/** 80mm POS slip PDF */
async function buildFisSlipPdf(tx: PublicPaymentRow): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [w, h] = pageSize('fis');
  const page = doc.addPage([w, h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  const margin = 14;
  const { date, time } = splitDateTime(tx.at);
  let y = h - 20;

  let brandLogoUrl = '';
  try {
    const g = await getGeneralSettings();
    brandLogoUrl = g.logoUrl || '';
  } catch {
    /* yok */
  }

  const brandImg = brandLogoUrl ? await embedLogo(doc, brandLogoUrl) : null;
  if (brandImg) {
    y = drawEmbeddedImage(page, brandImg, w, y, 36, w - margin * 2);
    y -= 10;
  }

  drawCentered(page, bold, 'BU BELGEYI SAKLAYINIZ', y, 7, w);
  y -= 14;
  drawCentered(page, bold, d.merchantTitle || '-', y, 9, w);
  y -= 12;
  if (d.merchantAddress) {
    drawCentered(page, font, d.merchantAddress, y, 7, w);
    y -= 10;
  }
  if (d.merchantPhone) {
    drawCentered(page, font, d.merchantPhone, y, 7, w);
    y -= 10;
  }

  y -= 4;
  drawCentered(page, bold, tx.bankName || '-', y, 8, w);
  y -= 14;

  drawLine(page, font, `TARIH: ${date}`, margin, y, 7);
  const saat = asciiSafe(`SAAT: ${time}`);
  page.drawText(saat, {
    x: w - margin - bold.widthOfTextAtSize(saat, 7),
    y,
    size: 7,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 11;

  drawLine(page, font, `ISLEM NO: ${d.transactionNo || tx.id}`, margin, y, 7);
  if (d.authCode) {
    const onay = asciiSafe(`ONAY: ${d.authCode}`);
    page.drawText(onay, {
      x: Math.max(margin, w - margin - font.widthOfTextAtSize(onay, 7)),
      y,
      size: 7,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  y -= 11;

  if (d.referenceNo) {
    drawLine(page, font, `REF: ${d.referenceNo}`, margin, y, 7);
    y -= 11;
  }
  if (d.cardHolderName && d.cardHolderName !== '—') {
    drawLine(page, font, `KART SAHIBI: ${d.cardHolderName}`, margin, y, 7);
    y -= 11;
  }

  if (tx.installments > 1 && tx.status === 'paid') {
    y -= 2;
    drawCentered(page, bold, `TAKSIT SAYISI: ${tx.installments}`, y, 8, w);
    y -= 12;
  }

  drawCentered(page, bold, slipTitle(tx), y, 11, w);
  y -= 14;
  drawCentered(page, font, d.cardMasked || '-', y, 9, w);
  y -= 14;

  drawCentered(page, bold, 'ISLEM TUTARI', y, 7, w);
  y -= 14;
  drawCentered(page, bold, `${money(total)} TL`, y, 14, w);
  y -= 14;
  if (tx.commission > 0) {
    drawCentered(
      page,
      font,
      `Tutar ${money(tx.amount)} · Komisyon ${money(tx.commission)}`,
      y,
      6.5,
      w,
    );
    y -= 10;
  }

  drawCentered(page, bold, 'ISLEM ONAYLANDI', y, 9, w);
  y -= 12;
  if (d.authCode) {
    drawCentered(page, font, `ONAY KODU: ${d.authCode}`, y, 7, w);
    y -= 10;
  }
  if (d.referenceNo) {
    drawCentered(page, font, `BANKA REFERANS: ${d.referenceNo}`, y, 7, w);
    y -= 10;
  }
  if (d.threeDSecure) {
    drawCentered(page, font, '3D Secure ile tamamlanmistir.', y, 6.5, w);
    y -= 10;
  }

  const legal =
    tx.status === 'refunded'
      ? 'TUTAR KARSILIGI ISLEM IADE EDILMISTIR'
      : tx.status === 'cancelled'
        ? 'TUTAR KARSILIGI ISLEM IPTAL EDILMISTIR'
        : 'TUTAR KARSILIGI MAL VEYA HIZMET ALDIM';
  drawCentered(page, font, legal, y, 6.5, w);
  y -= 11;
  drawCentered(page, bold, 'MALI DEGERI YOKTUR', y, 7, w);
  y -= 10;
  drawCentered(page, bold, 'MUSTERI NUSHASI', y, 7, w);
  y -= 14;

  page.drawRectangle({
    x: margin,
    y: y + 4,
    width: w - margin * 2,
    height: 0.6,
    color: rgb(0.55, 0.55, 0.55),
  });
  y -= 6;

  const bankImg = tx.bankLogo ? await embedLogo(doc, tx.bankLogo) : null;
  if (bankImg) {
    y = drawEmbeddedImage(page, bankImg, w, y, 28, w - margin * 2);
    y -= 8;
  } else if (tx.bankName) {
    drawCentered(page, bold, tx.bankName, y, 9, w);
    y -= 12;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Sanal POS e-dekont PDF (pdf-lib) — format: fis | a5 | a4 */
export async function buildDekontPdf(
  tx: PublicPaymentRow,
  format: DekontPdfFormat = 'a4',
): Promise<Buffer> {
  if (format === 'fis') return buildFisSlipPdf(tx);

  const doc = await PDFDocument.create();
  const [w, h] = pageSize(format);
  const page = doc.addPage([w, h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  const margin = 40;
  const titleSize = 14;
  const bodySize = 9;
  let y = h - 42;

  const title = 'SANAL POS E-DEKONT';
  page.drawText(title, {
    x: Math.max(margin, (w - bold.widthOfTextAtSize(title, titleSize)) / 2),
    y,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= 26;

  drawLine(page, font, `Dekont No: ${tx.id}`, margin, y, bodySize);
  y -= 14;
  drawLine(page, font, `Tarih: ${new Date(tx.at).toLocaleString('tr-TR')}`, margin, y, bodySize);
  y -= 14;
  drawLine(page, bold, `Banka: ${tx.bankName}`, margin, y, bodySize);
  y -= 12;
  drawLine(page, font, `Musteri: ${tx.customerTitle || '-'}`, margin, y, bodySize);
  y -= 16;

  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: w - margin * 2,
    height: 1.5,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 18;

  const labelW = 110;
  const rows: [string, string][] = [
    ['Uye Isyeri', d.merchantTitle],
    ['Adres', d.merchantAddress || '-'],
    ['Telefon', d.merchantPhone || '-'],
    ['Kart Sahibi', d.cardHolderName],
    ['TC / Vergi No', d.identityNo || '-'],
    ['Kart', d.cardMasked],
    ['Taksit', String(tx.installments)],
    ['Tutar', `${money(tx.amount)} TL`],
    ['Komisyon', `${money(tx.commission)} TL`],
    ['Toplam', `${money(total)} TL`],
    ['Referans', d.referenceNo || '-'],
    ['Islem No', d.transactionNo || '-'],
    ['Onay Kodu', d.authCode || '-'],
    ['3D Secure', d.threeDSecure ? 'Evet' : 'Hayir'],
    ['Aciklama', d.description || '-'],
  ];

  for (const [label, value] of rows) {
    if (y < 36) break;
    drawLine(page, bold, `${label}:`, margin, y, bodySize);
    drawLine(page, font, value || '-', margin + labelW, y, bodySize);
    y -= 15;
  }

  y -= 8;
  drawLine(
    page,
    font,
    'Bu belge sanal POS isleminin kaydidir.',
    margin,
    y,
    Math.max(7, bodySize - 1),
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export function parseDekontFormat(raw: unknown): DekontPdfFormat {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'fis' || s === 'a5' || s === 'a4') return s;
  return 'a4';
}
