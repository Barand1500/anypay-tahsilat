import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PublicModule } from './modulesService.js';

function asciiSafe(value: unknown): string {
  return String(value ?? '')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[^ -~]/g, '?');
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

export async function buildModulesPdf(modules: PublicModule[]): Promise<Buffer> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  const margin = 34;
  const rowHeight = 24;
  let page = document.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawHeader = () => {
    page.drawText('MODULLER', { x: margin, y, size: 16, font: bold, color: rgb(0.08, 0.12, 0.2) });
    page.drawText(`Toplam: ${modules.length}`, { x: 720, y: y + 2, size: 9, font: regular });
    y -= 28;
    page.drawRectangle({ x: margin, y: y - 5, width: 774, height: 22, color: rgb(0.9, 0.93, 0.97) });
    const headers = [['Adi', 42], ['DB Tablo', 230], ['URL', 390], ['Roller', 555], ['Olusturma', 725]] as const;
    for (const [label, x] of headers) page.drawText(label, { x, y: y + 2, size: 9, font: bold });
    y -= 18;
  };

  drawHeader();
  for (const item of modules) {
    if (y < margin + rowHeight) {
      page = document.addPage(pageSize);
      y = pageSize[1] - margin;
      drawHeader();
    }
    if (Math.floor((pageSize[1] - y) / rowHeight) % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 6, width: 774, height: rowHeight, color: rgb(0.97, 0.98, 0.99) });
    }
    const values: Array<[string, number, number]> = [
      [clip(asciiSafe(item.name), 30), 42, 8],
      [clip(asciiSafe(item.dbTable), 25), 230, 8],
      [clip(asciiSafe(item.urlPrefix), 27), 390, 8],
      [clip(asciiSafe(item.roles.join(', ') || '-'), 28), 555, 8],
      [item.createdAt ? new Date(item.createdAt).toLocaleDateString('tr-TR') : '-', 725, 8],
    ];
    for (const [value, x, size] of values) page.drawText(value, { x, y, size, font: regular });
    y -= rowHeight;
  }

  const bytes = await document.save();
  return Buffer.from(bytes);
}
