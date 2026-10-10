import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PublicPaymentRow } from './paymentsService.js';

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
    .slice(0, 90);
}

function drawLine(
  page: ReturnType<PDFDocument['addPage']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  x: number,
  y: number,
  size = 10,
) {
  page.drawText(asciiSafe(text), { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
}

function pageSize(format: DekontPdfFormat): [number, number] {
  if (format === 'fis') return [227, 620]; // ~80mm x uzun fiş
  if (format === 'a5') return [420, 595];
  return [595, 842];
}

/** Sanal POS e-dekont PDF (pdf-lib) — format: fis | a5 | a4 */
export async function buildDekontPdf(
  tx: PublicPaymentRow,
  format: DekontPdfFormat = 'a4',
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const [w, h] = pageSize(format);
  const page = doc.addPage([w, h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  const margin = format === 'fis' ? 14 : 40;
  const titleSize = format === 'fis' ? 11 : 14;
  const bodySize = format === 'fis' ? 8 : 9;
  let y = h - (format === 'fis' ? 28 : 42);

  const title = 'SANAL POS E-DEKONT';
  page.drawText(title, {
    x: Math.max(margin, (w - bold.widthOfTextAtSize(title, titleSize)) / 2),
    y,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= format === 'fis' ? 18 : 26;

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

  const labelW = format === 'fis' ? 72 : 110;
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
    y -= format === 'fis' ? 12 : 15;
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
