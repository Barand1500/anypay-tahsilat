import { prisma } from '../lib/prisma.js';

export class TaxOfficesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxOfficesError';
  }
}

export type PublicTaxOffice = {
  id: string;
  city: string;
  district: string;
  name: string;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapRow(r: {
  id: number;
  adi: string;
  ilAdi: string | null;
  ilceAdi: string | null;
}): PublicTaxOffice {
  return {
    id: String(r.id),
    name: r.adi,
    city: (r.ilAdi || '').trim(),
    district: (r.ilceAdi || '').trim(),
  };
}

export async function listTaxOffices(): Promise<PublicTaxOffice[]> {
  const rows = await prisma.vergiDairesi.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map(mapRow);
}

export async function createTaxOffice(input: {
  city: string;
  district: string;
  name: string;
}): Promise<PublicTaxOffice> {
  const name = input.name.trim();
  if (!name) throw new TaxOfficesError('Vergi dairesi adı gerekli');
  const city = input.city.trim();
  const district = input.district.trim();
  if (!city) throw new TaxOfficesError('İl gerekli');
  if (!district) throw new TaxOfficesError('İlçe gerekli');

  const dup = await prisma.vergiDairesi.findFirst({
    where: { adi: name, ...notRemoved() },
  });
  if (dup) throw new TaxOfficesError('Bu vergi dairesi zaten var');

  const row = await prisma.vergiDairesi.create({
    data: {
      adi: name.slice(0, 255),
      ilAdi: city.slice(0, 255),
      ilceAdi: district.slice(0, 255),
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateTaxOffice(
  id: number,
  input: { city: string; district: string; name: string },
): Promise<PublicTaxOffice> {
  const existing = await prisma.vergiDairesi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new TaxOfficesError('Vergi dairesi bulunamadı');

  const name = input.name.trim();
  if (!name) throw new TaxOfficesError('Vergi dairesi adı gerekli');
  const city = input.city.trim();
  const district = input.district.trim();
  if (!city) throw new TaxOfficesError('İl gerekli');
  if (!district) throw new TaxOfficesError('İlçe gerekli');

  const dup = await prisma.vergiDairesi.findFirst({
    where: { adi: name, ...notRemoved(), NOT: { id } },
  });
  if (dup) throw new TaxOfficesError('Bu vergi dairesi zaten var');

  const row = await prisma.vergiDairesi.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      ilAdi: city.slice(0, 255),
      ilceAdi: district.slice(0, 255),
    },
  });
  return mapRow(row);
}

export async function softDeleteTaxOffice(id: number): Promise<void> {
  const existing = await prisma.vergiDairesi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new TaxOfficesError('Vergi dairesi bulunamadı');
  await prisma.vergiDairesi.update({ where: { id }, data: { remove: true } });
}
