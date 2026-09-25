import { prisma } from '../lib/prisma.js';

const DURUM_OK = 1;
const TOP_N = 10;

export type StatisticsQuery = {
  year: number;
  /** Boş = tüm yıl */
  months: number[];
  branchId?: number | null;
  userId?: number | null;
};

export type StatRankItem = {
  id: string;
  label: string;
  amount: number;
  color: string;
  logo?: string;
  meta?: string;
};

export type StatisticsPayload = {
  customers: StatRankItem[];
  banks: StatRankItem[];
  cards: StatRankItem[];
  filters: {
    branches: { value: string; label: string }[];
    users: { value: string; label: string }[];
    years: { value: string; label: string }[];
  };
};

const STAT_PALETTE = [
  '#0d9488',
  '#2563eb',
  '#059669',
  '#d97706',
  '#0ea5e9',
  '#475569',
  '#14b8a6',
  '#1d4ed8',
  '#65a30d',
  '#b45309',
];

function paint(items: Omit<StatRankItem, 'color'>[]): StatRankItem[] {
  return items.map((it, i) => ({ ...it, color: STAT_PALETTE[i % STAT_PALETTE.length]! }));
}

function amountOf(gercekTutar: number, tutar: number): number {
  const v = gercekTutar ?? tutar ?? 0;
  return Number.isFinite(v) ? v : 0;
}

function bankLogoUrl(logo: string | null | undefined): string | undefined {
  if (!logo) return undefined;
  const file = logo.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return undefined;
  return `/banks/${file}`;
}

function monthOf(d: Date): number {
  return d.getMonth() + 1;
}

function yearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function cardLast4(kartNo: string): string {
  const digits = (kartNo || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  const m = (kartNo || '').match(/(\d{4})\s*$/);
  return m?.[1] || '????';
}

function cardMeta(kartNo: string): string {
  return `•••• ${cardLast4(kartNo)}`;
}

export async function getStatistics(q: StatisticsQuery): Promise<StatisticsPayload> {
  const year = Number.isFinite(q.year) && q.year >= 2000 && q.year <= 2100 ? q.year : new Date().getFullYear();
  const months = [...new Set(q.months.filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  const fullYear = months.length === 0;
  const { start, end } = yearRange(year);

  const where: Record<string, unknown> = {
    durum: DURUM_OK,
    tarih: { gte: start, lte: end },
  };
  if (q.branchId != null) where.subeDepartmanId = q.branchId;
  if (q.userId != null) where.kullaniciId = q.userId;

  const [rows, banks, customers, branches, users, yearBounds] = await Promise.all([
    prisma.odeme.findMany({
      where,
      select: {
        musteriId: true,
        adsoyad: true,
        kartNo: true,
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

  const bankMap = new Map(
    banks.map((b) => [
      b.id,
      {
        name: (b.kisaAdi || b.adi || `Banka #${b.id}`).trim(),
        logo: bankLogoUrl(b.logo),
      },
    ]),
  );
  const customerMap = new Map(
    customers.map((c) => [c.id, (c.unvan || '').trim() || `Müşteri #${c.id}`]),
  );

  const filtered = rows.filter((r) => {
    if (!r.tarih) return false;
    if (fullYear) return true;
    return months.includes(monthOf(r.tarih));
  });

  type Acc = { amount: number; label: string; logo?: string; meta?: string };
  const byCustomer = new Map<string, Acc>();
  const byBank = new Map<string, Acc>();
  const byCard = new Map<string, Acc>();

  for (const r of filtered) {
    const amt = amountOf(r.gercekTutar, r.tutar);
    if (amt <= 0) continue;

    // Müşteri
    const custKey =
      r.musteriId != null ? `m-${r.musteriId}` : `n-${(r.adsoyad || '').trim().toLocaleUpperCase('tr') || 'bilinmeyen'}`;
    const custLabel =
      (r.musteriId != null ? customerMap.get(r.musteriId) : null) ||
      (r.adsoyad || '').trim() ||
      '—';
    const cPrev = byCustomer.get(custKey);
    if (cPrev) cPrev.amount += amt;
    else byCustomer.set(custKey, { amount: amt, label: custLabel });

    // Banka
    const bankId = r.bankaId ?? r.sanalposBankaId;
    if (bankId != null) {
      const meta = bankMap.get(bankId);
      const bKey = `b-${bankId}`;
      const bPrev = byBank.get(bKey);
      if (bPrev) bPrev.amount += amt;
      else
        byBank.set(bKey, {
          amount: amt,
          label: meta?.name ?? `Banka #${bankId}`,
          logo: meta?.logo,
        });
    }

    // Kart
    const kart = (r.kartNo || '').trim();
    if (kart) {
      const last4 = cardLast4(kart);
      const cardKey = `${custKey}|${last4}|${kart}`;
      const cardLabel = custLabel;
      const kPrev = byCard.get(cardKey);
      if (kPrev) kPrev.amount += amt;
      else
        byCard.set(cardKey, {
          amount: amt,
          label: cardLabel,
          meta: cardMeta(kart),
        });
    }
  }

  function topOf(map: Map<string, Acc>): StatRankItem[] {
    return paint(
      [...map.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, TOP_N)
        .map(([id, v]) => ({
          id,
          label: v.label,
          amount: Math.round(v.amount * 100) / 100,
          ...(v.logo ? { logo: v.logo } : {}),
          ...(v.meta ? { meta: v.meta } : {}),
        })),
    );
  }

  const nowY = new Date().getFullYear();
  const minY = yearBounds._min.tarih?.getFullYear() ?? nowY - 2;
  const maxY = Math.max(yearBounds._max.tarih?.getFullYear() ?? nowY, nowY);
  const fromY = Math.min(minY, nowY - 2);
  const years: { value: string; label: string }[] = [];
  for (let y = maxY; y >= fromY; y -= 1) {
    years.push({ value: String(y), label: String(y) });
  }

  return {
    customers: topOf(byCustomer),
    banks: topOf(byBank),
    cards: topOf(byCard),
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

export function parseMonthsParam(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
}
