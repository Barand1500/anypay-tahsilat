import { prisma } from '../lib/prisma.js';
import { getAccountTypeInstallments } from './accountTypesService.js';
import { getUserAllowedInstallments } from './usersService.js';

export type InstallmentSource = 'user' | 'cari';

export type InstallmentPriority = {
  order: InstallmentSource[];
};

const DEFAULT_ORDER: InstallmentSource[] = ['user', 'cari'];

function parseOrder(raw: string | null | undefined): InstallmentSource[] {
  if (!raw?.trim()) return [...DEFAULT_ORDER];
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is InstallmentSource => s === 'user' || s === 'cari');
  const uniq = [...new Set(parts)];
  if (!uniq.includes('user')) uniq.push('user');
  if (!uniq.includes('cari')) uniq.push('cari');
  return uniq.slice(0, 2);
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
  sources: { user: number[] | null; cari: number[] | null },
): number[] | null {
  for (const key of order) {
    const list = sources[key];
    if (list != null && list.length > 0) return list;
  }
  return null;
}

export async function resolveAllowedInstallments(opts: {
  kullaniciId: number;
  musteriId?: number | null;
  cariTipiId?: number | null;
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
  return pickEffectiveInstallments(order, { user, cari });
}
