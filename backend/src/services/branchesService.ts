import { prisma } from '../lib/prisma.js';

export class BranchesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BranchesError';
  }
}

export type PublicBranch = {
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

function mapRow(r: { id: number; adi: string; izinliTaksitler: string | null }): PublicBranch {
  return {
    id: String(r.id),
    name: r.adi,
    installments: parseInstallments(r.izinliTaksitler),
  };
}

export async function listBranchesFull(): Promise<PublicBranch[]> {
  const rows = await prisma.subeDepartman.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map(mapRow);
}

/** Boş dizi = kısıt yok (null); dolu = yalnızca bunlar */
export async function getBranchInstallments(
  branchId: number | null | undefined,
): Promise<number[] | null> {
  if (branchId == null || !Number.isFinite(branchId)) return null;
  const row = await prisma.subeDepartman.findFirst({
    where: { id: branchId, ...notRemoved() },
    select: { izinliTaksitler: true },
  });
  if (!row) return null;
  const list = parseInstallments(row.izinliTaksitler);
  return list.length ? list : null;
}

export async function createBranch(input: {
  name: string;
  installments?: number[];
}): Promise<PublicBranch> {
  const name = input.name.trim();
  if (!name) throw new BranchesError('Adı gerekli');

  const all = await prisma.subeDepartman.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  const dup = all.find(
    (r) => r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (dup) throw new BranchesError('Bu şube / departman zaten var');

  const row = await prisma.subeDepartman.create({
    data: {
      adi: name.slice(0, 255),
      izinliTaksitler: encodeInstallments(input.installments || []),
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateBranch(
  id: number,
  input: { name: string; installments?: number[] },
): Promise<PublicBranch> {
  const existing = await prisma.subeDepartman.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new BranchesError('Şube / departman bulunamadı');

  const name = input.name.trim();
  if (!name) throw new BranchesError('Adı gerekli');

  const all = await prisma.subeDepartman.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  const dup = all.find(
    (r) =>
      r.id !== id && r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (dup) throw new BranchesError('Bu şube / departman zaten var');

  const row = await prisma.subeDepartman.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      izinliTaksitler: encodeInstallments(input.installments || []),
    },
  });
  return mapRow(row);
}

export async function softDeleteBranch(id: number): Promise<void> {
  const existing = await prisma.subeDepartman.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new BranchesError('Şube / departman bulunamadı');

  const users = await prisma.user.findMany({
    where: notRemoved(),
    select: { subeDepartmanId: true, subeDepartmanIds: true },
  });
  const inUse = users.some((u) => {
    if (u.subeDepartmanId === id) return true;
    const ids = (u.subeDepartmanIds || '')
      .split(/[,;]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    return ids.includes(id);
  });
  if (inUse) {
    throw new BranchesError('Bu şubeye bağlı kullanıcı var — silinemez');
  }

  await prisma.subeDepartman.update({
    where: { id },
    data: { remove: true },
  });
}
