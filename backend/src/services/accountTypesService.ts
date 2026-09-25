import { prisma } from '../lib/prisma.js';

export class AccountTypesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountTypesError';
  }
}

export type PublicAccountType = {
  id: string;
  name: string;
  installments: number[];
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function parseInstallments(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[,;]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
  return [...new Set(nums)].sort((a, b) => a - b);
}

function encodeInstallments(list: number[]): string | null {
  const nums = [...new Set(list.filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
  return nums.length ? nums.join(',') : null;
}

function mapRow(r: { id: number; adi: string; izinliTaksitler: string | null }): PublicAccountType {
  return {
    id: String(r.id),
    name: r.adi,
    installments: parseInstallments(r.izinliTaksitler),
  };
}

export async function listAccountTypes(): Promise<PublicAccountType[]> {
  const rows = await prisma.cariTipi.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map(mapRow);
}

/** Boş dizi = kısıt yok (null); dolu = yalnızca bunlar */
export async function getAccountTypeInstallments(
  cariTipiId: number | null | undefined,
): Promise<number[] | null> {
  if (cariTipiId == null || !Number.isFinite(cariTipiId)) return null;
  const row = await prisma.cariTipi.findFirst({
    where: { id: cariTipiId, ...notRemoved() },
    select: { izinliTaksitler: true },
  });
  if (!row) return null;
  const list = parseInstallments(row.izinliTaksitler);
  return list.length ? list : null;
}

export async function createAccountType(input: {
  name: string;
  installments?: number[];
}): Promise<PublicAccountType> {
  const name = input.name.trim();
  if (!name) throw new AccountTypesError('Adı gerekli');

  const all = await prisma.cariTipi.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  const dup = all.find(
    (r) => r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (dup) throw new AccountTypesError('Bu cari tipi zaten var');

  const row = await prisma.cariTipi.create({
    data: {
      adi: name.slice(0, 255),
      izinliTaksitler: encodeInstallments(input.installments || []),
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateAccountType(
  id: number,
  input: { name: string; installments?: number[] },
): Promise<PublicAccountType> {
  const existing = await prisma.cariTipi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new AccountTypesError('Cari tipi bulunamadı');

  const name = input.name.trim();
  if (!name) throw new AccountTypesError('Adı gerekli');

  const all = await prisma.cariTipi.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  const dup = all.find(
    (r) =>
      r.id !== id && r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (dup) throw new AccountTypesError('Bu cari tipi zaten var');

  const row = await prisma.cariTipi.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      izinliTaksitler: encodeInstallments(input.installments || []),
    },
  });
  return mapRow(row);
}

export async function softDeleteAccountType(id: number): Promise<void> {
  const existing = await prisma.cariTipi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new AccountTypesError('Cari tipi bulunamadı');

  const inUse = await prisma.musteri.count({
    where: { cariTipiId: id, ...notRemoved() },
  });
  if (inUse > 0) {
    throw new AccountTypesError('Bu cari tipine bağlı müşteri var — silinemez');
  }

  await prisma.cariTipi.update({
    where: { id },
    data: { remove: true },
  });
}
