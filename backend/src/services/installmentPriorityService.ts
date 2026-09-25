import { prisma } from '../lib/prisma.js';
import { getAccountTypeInstallments } from './accountTypesService.js';
import { getBranchInstallments } from './branchesService.js';
import { getUserAllowedInstallments } from './usersService.js';

export type InstallmentSource = 'user' | 'cari' | 'sube';

export type InstallmentPriority = {
  order: InstallmentSource[];
};

const DEFAULT_ORDER: InstallmentSource[] = ['user', 'cari', 'sube'];
const ALL_SOURCES: InstallmentSource[] = ['user', 'cari', 'sube'];

function parseOrder(raw: string | null | undefined): InstallmentSource[] {
  if (!raw?.trim()) return [...DEFAULT_ORDER];
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is InstallmentSource =>
      s === 'user' || s === 'cari' || s === 'sube',
    );
  const uniq = [...new Set(parts)];
  for (const key of ALL_SOURCES) {
    if (!uniq.includes(key)) uniq.push(key);
  }
  return uniq.slice(0, ALL_SOURCES.length);
}

export async function getInstallmentPriority(): Promise<InstallmentPriority> {
  const row = await prisma.ayarlar.findFirst({
    orderBy: { id: 'asc' },
    select: { taksitSiralama: true },
  });
  return { order: parseOrder(row?.taksitSiralama) };
}

export async function updateInstallmentPriority(
  order: InstallmentSource[],
): Promise<InstallmentPriority> {
  const cleaned = parseOrder(order.join(','));
  const row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!row) throw new Error('Ayarlar kaydı bulunamadı');
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { taksitSiralama: cleaned.join(',') },
  });
  return { order: cleaned };
}

/**
 * Sıralamadaki ilk dolu kaynak kazanır.
 * Dolu = en az bir taksit atanmış. Boş/null = yok → sonraki kaynağa bak.
 * Hepsi boşsa null = kısıt yok.
 */
export function pickEffectiveInstallments(
  order: InstallmentSource[],
  sources: { user: number[] | null; cari: number[] | null; sube: number[] | null },
): number[] | null {
  for (const key of order) {
    const list = sources[key];
    if (list != null && list.length > 0) return list;
  }
  return null;
}

function parseIdList(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
}

export async function resolveAllowedInstallments(opts: {
  kullaniciId: number;
  musteriId?: number | null;
  cariTipiId?: number | null;
  subeDepartmanId?: number | null;
}): Promise<number[] | null> {
  const { order } = await getInstallmentPriority();
  const user = await getUserAllowedInstallments(opts.kullaniciId);

  let cariTipiId = opts.cariTipiId ?? null;
  if (cariTipiId == null && opts.musteriId != null) {
    const m = await prisma.musteri.findFirst({
      where: {
        id: opts.musteriId,
        OR: [{ remove: null }, { remove: false }],
      },
      select: { cariTipiId: true },
    });
    cariTipiId = m?.cariTipiId ?? null;
  }
  const cari = await getAccountTypeInstallments(cariTipiId);

  let branchId = opts.subeDepartmanId ?? null;
  if (branchId == null) {
    const u = await prisma.user.findFirst({
      where: {
        id: opts.kullaniciId,
        OR: [{ remove: null }, { remove: false }],
      },
      select: { subeDepartmanId: true, subeDepartmanIds: true },
    });
    const fromList = parseIdList(u?.subeDepartmanIds);
    branchId = fromList[0] ?? u?.subeDepartmanId ?? null;
  }
  const sube = await getBranchInstallments(branchId);

  return pickEffectiveInstallments(order, { user, cari, sube });
}
