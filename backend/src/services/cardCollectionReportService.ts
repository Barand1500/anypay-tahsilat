import { prisma } from '../lib/prisma.js';

const DURUM_OK = 1;

export type CardCollectionQuery = {
  year: number;
  /** Boş = tüm yıl */
  months: number[];
  branchId?: number | null;
  userId?: number | null;
};

export type CardCollectionRow = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  count: number;
  total: number;
};

export type CardCollectionPayload = {
  rows: CardCollectionRow[];
  totalCount: number;
  filters: {
    branches: { value: string; label: string }[];
    users: { value: string; label: string }[];
    years: { value: string; label: string }[];
  };
};

function yearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function monthOf(d: Date): number {
  return d.getMonth() + 1;
}

function amountOf(gercekTutar: number, tutar: number): number {
  const v = gercekTutar ?? tutar ?? 0;
  return Number.isFinite(v) ? v : 0;
}

function bankLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '';
  const file = logo.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return '';
  return `/banks/${file}`;
}

export async function getCardCollectionReport(
  q: CardCollectionQuery,
): Promise<CardCollectionPayload> {
  const year =
    Number.isFinite(q.year) && q.year >= 2000 && q.year <= 2100
      ? q.year
      : new Date().getFullYear();
  const months = [...new Set(q.months.filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  const fullYear = months.length === 0;
  const { start, end } = yearRange(year);

  const where: Record<string, unknown> = {
    durum: DURUM_OK,
    tarih: { gte: start, lte: end },
  };
  if (q.branchId != null) where.subeDepartmanId = q.branchId;
  if (q.userId != null) where.kullaniciId = q.userId;

  const [payments, banks, branches, users, yearBounds] = await Promise.all([
    prisma.odeme.findMany({
      where,
      select: {
        tutar: true,
        gercekTutar: true,
        tarih: true,
        bankaId: true,
        sanalposBankaId: true,
      },
    }),
    prisma.banka.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      select: { id: true, adi: true, kisaAdi: true, logo: true },
    }),
    prisma.subeDepartman.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      select: { id: true, adi: true },
      orderBy: { adi: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        musteriId: null,
        OR: [{ remove: null }, { remove: false }],
      },
      select: { id: true, adsoyad: true, email: true },
      orderBy: { adsoyad: 'asc' },
    }),
    prisma.odeme.aggregate({
      where: { durum: DURUM_OK, tarih: { not: null } },
      _min: { tarih: true },
      _max: { tarih: true },
    }),
  ]);

  const bankMap = new Map(
    banks.map((b) => [
      b.id,
      {
        name: (b.kisaAdi || b.adi || `Banka #${b.id}`).trim(),
        logo: bankLogoUrl(b.logo),
      },
    ]),
  );

  type Acc = { bankId: string; bankName: string; bankLogo: string; count: number; total: number };
  const byBank = new Map<string, Acc>();

  for (const r of payments) {
    if (!r.tarih) continue;
    if (!fullYear && !months.includes(monthOf(r.tarih))) continue;
    const amt = amountOf(r.gercekTutar, r.tutar);
    if (amt <= 0) continue;

    const bankKey = r.bankaId ?? r.sanalposBankaId;
    if (bankKey == null) continue;

    const meta = bankMap.get(bankKey);
    const id = `b-${bankKey}`;
    const prev = byBank.get(id);
    if (prev) {
      prev.count += 1;
      prev.total += amt;
    } else {
      byBank.set(id, {
        bankId: String(bankKey),
        bankName: meta?.name ?? `Banka #${bankKey}`,
        bankLogo: meta?.logo ?? '',
        count: 1,
        total: amt,
      });
    }
  }

  const rows: CardCollectionRow[] = [...byBank.entries()]
    .map(([id, v]) => ({
      id,
      bankId: v.bankId,
      bankName: v.bankName,
      bankLogo: v.bankLogo,
      count: v.count,
      total: Math.round(v.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const nowY = new Date().getFullYear();
  const minY = yearBounds._min.tarih?.getFullYear() ?? nowY - 2;
  const maxY = Math.max(yearBounds._max.tarih?.getFullYear() ?? nowY, nowY);
  const fromY = Math.min(minY, nowY - 2);
  const years: { value: string; label: string }[] = [];
  for (let y = maxY; y >= fromY; y -= 1) {
    years.push({ value: String(y), label: String(y) });
  }

  return {
    rows,
    totalCount: rows.length,
    filters: {
      branches: branches.map((b) => ({ value: String(b.id), label: b.adi })),
      users: users.map((u) => ({
        value: String(u.id),
        label: (u.adsoyad || u.email || `#${u.id}`).trim(),
      })),
      years,
    },
  };
}
