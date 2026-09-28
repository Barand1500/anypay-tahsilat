import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PublicPaymentRow } from './paymentsService.js';

function money(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawLine(
  page: ReturnType<PDFDocument['addPage']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  x: number,
  y: number,
  size = 10,
) {
  page.drawText(text, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
}

/** Sanal POS e-dekont PDF (pdf-lib) */
export async function buildDekontPdf(tx: PublicPaymentRow): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  let y = 800;

  const title = 'SANAL POS E-DEKONT';
  page.drawText(title, {
    x: (595 - bold.widthOfTextAtSize(title, 14)) / 2,
    y,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= 28;

  drawLine(page, font, `Dekont No: ${tx.id}`, 50, y);
  drawLine(page, font, `Tarih: ${new Date(tx.at).toLocaleString('tr-TR')}`, 320, y);
  y -= 18;
  drawLine(page, bold, `Banka: ${tx.bankName}`, 50, y);
  y -= 16;
  drawLine(page, font, `Musteri: ${tx.customerTitle || '—'}`, 50, y);
  y -= 22;

  page.drawRectangle({
    x: 45,
    y: y - 8,
    width: 505,
    height: 2,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 24;

  const rows: [string, string][] = [
    ['Uye Isyeri', d.merchantTitle],
    ['Adres', d.merchantAddress || '—'],
    ['Telefon', d.merchantPhone || '—'],
    ['Kart Sahibi', d.cardHolderName],
    ['TC / Vergi No', d.identityNo || '—'],
    ['Kart', d.cardMasked],
    ['Taksit', String(tx.installments)],
    ['Tutar', `${money(tx.amount)} TL`],
    ['Komisyon', `${money(tx.commission)} TL`],
    ['Toplam', `${money(total)} TL`],
    ['Referans', d.referenceNo || '—'],
    ['Islem No', d.transactionNo || '—'],
    ['Onay Kodu', d.authCode || '—'],
    ['3D Secure', d.threeDSecure ? 'Evet' : 'Hayir'],
    ['Aciklama', d.description || '—'],
  ];

  for (const [label, value] of rows) {
    if (y < 80) break;
    drawLine(page, bold, `${label}:`, 50, y, 9);
    const safe = (value || '—').replace(/[^\x20-\x7EğüşıöçĞÜŞİÖÇİı]/gi, '?').slice(0, 70);
    // Helvetica may not have Turkish glyphs — use ASCII-safe approx
    const ascii = safe
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
      .replace(/Ç/g, 'C');
    drawLine(page, font, ascii, 160, y, 9);
    y -= 16;
  }

  y -= 12;
  drawLine(
    page,
    font,
    'Bu belge sanal POS isleminin kaydidir. GUVEL Teknoloji — AnyPay Tahsilat',
    50,
    y,
    8,
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
