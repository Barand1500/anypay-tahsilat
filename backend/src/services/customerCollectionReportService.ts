import { prisma } from '../lib/prisma.js';

const DURUM_OK = 1;

export type CustomerCollectionQuery = {
  year: number;
  /** Boş = tüm yıl */
  months: number[];
  branchId?: number | null;
  userId?: number | null;
};

export type CustomerCollectionRow = {
  id: string;
  title: string;
  count: number;
  total: number;
};

export type CustomerCollectionPayload = {
  rows: CustomerCollectionRow[];
  /** Filtre öncesi toplam satır (aynı dönem) — arama öncesi */
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

export async function getCustomerCollectionReport(
  q: CustomerCollectionQuery,
): Promise<CustomerCollectionPayload> {
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

  const [payments, customers, branches, users, yearBounds] = await Promise.all([
    prisma.odeme.findMany({
      where,
      select: {
        musteriId: true,
        adsoyad: true,
        tutar: true,
        gercekTutar: true,
        tarih: true,
      },
    }),
    prisma.musteri.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      select: { id: true, unvan: true },
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

  const customerMap = new Map(
    customers.map((c) => [c.id, (c.unvan || '').trim() || `Müşteri #${c.id}`]),
  );

  type Acc = { title: string; count: number; total: number };
  const byCustomer = new Map<string, Acc>();

  for (const r of payments) {
    if (!r.tarih) continue;
    if (!fullYear && !months.includes(monthOf(r.tarih))) continue;
    const amt = amountOf(r.gercekTutar, r.tutar);
    if (amt <= 0) continue;

    const key =
      r.musteriId != null
        ? `m-${r.musteriId}`
        : `n-${(r.adsoyad || '').trim().toLocaleUpperCase('tr') || 'bilinmeyen'}`;
    const title =
      (r.musteriId != null ? customerMap.get(r.musteriId) : null) ||
      (r.adsoyad || '').trim() ||
      '—';

    const prev = byCustomer.get(key);
    if (prev) {
      prev.count += 1;
      prev.total += amt;
    } else {
      byCustomer.set(key, { title, count: 1, total: amt });
    }
  }

  const rows: CustomerCollectionRow[] = [...byCustomer.entries()]
    .map(([id, v]) => ({
      id,
      title: v.title,
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
