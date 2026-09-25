import { prisma } from '../lib/prisma.js';

const DURUM_OK = 1;

export type CollectionReportQuery = {
  from?: string | null;
  to?: string | null;
  branchId?: number | null;
  userId?: number | null;
  bankId?: number | null;
  /** ozet | detay | gunluk — şimdilik satır detayı; gunluk gün+banka toplar */
  reportType?: 'ozet' | 'detay' | 'gunluk' | null;
};

export type CollectionReportRow = {
  id: string;
  paymentDate: string;
  collectionDate: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  amount: number;
  commission: number;
  branch: string;
  userId: string;
  userName: string;
};

export type CollectionReportPayload = {
  rows: CollectionReportRow[];
  totals: { amount: number; commission: number; net: number };
  filters: {
    branches: { value: string; label: string }[];
    users: { value: string; label: string }[];
    banks: { value: string; label: string }[];
  };
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDay(key: string | null | undefined): Date | null {
  if (!key?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function bankLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '';
  const file = logo.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return '';
  return `/banks/${file}`;
}

/** tahsil_gunu YYYY-MM-DD veya DD.MM.YYYY olabilir */
function collectionDay(raw: string | null | undefined, fallback: Date | null): string {
  const t = (raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const tr = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (tr) return `${tr[3]}-${pad2(Number(tr[2]))}-${pad2(Number(tr[1]))}`;
  if (fallback) return dayKey(fallback);
  return '';
}

export async function getCollectionReport(
  q: CollectionReportQuery,
): Promise<CollectionReportPayload> {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const from = parseDay(q.from) ?? defaultFrom;
  const to = endOfDay(parseDay(q.to) ?? defaultTo);

  const where: Record<string, unknown> = {
    durum: DURUM_OK,
    tarih: { gte: from, lte: to },
  };
  if (q.branchId != null) where.subeDepartmanId = q.branchId;
  if (q.userId != null) where.kullaniciId = q.userId;
  if (q.bankId != null) {
    where.OR = [{ bankaId: q.bankId }, { sanalposBankaId: q.bankId }];
  }

  const [payments, banks, branches, users] = await Promise.all([
    prisma.odeme.findMany({
      where,
      select: {
        id: true,
        odemeNo: true,
        tutar: true,
        gercekTutar: true,
        bankaKomisyonu: true,
        vadeFarki: true,
        tarih: true,
        tahsilGunu: true,
        bankaId: true,
        sanalposBankaId: true,
        subeDepartmanId: true,
        kullaniciId: true,
      },
      orderBy: { tarih: 'desc' },
      take: 5000,
    }),
    prisma.banka.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      select: { id: true, adi: true, kisaAdi: true, logo: true },
      orderBy: { adi: 'asc' },
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
  const branchMap = new Map(branches.map((b) => [b.id, b.adi]));
  const userMap = new Map(
    users.map((u) => [u.id, (u.adsoyad || u.email || `#${u.id}`).trim()]),
  );

  const detail: CollectionReportRow[] = [];
  for (const r of payments) {
    if (!r.tarih) continue;
    const bankKey = r.bankaId ?? r.sanalposBankaId;
    const bank = bankKey != null ? bankMap.get(bankKey) : undefined;
    const amount = Number(r.gercekTutar ?? r.tutar ?? 0) || 0;
    const commission = Number(r.bankaKomisyonu ?? r.vadeFarki ?? 0) || 0;
    const payDay = dayKey(r.tarih);
    detail.push({
      id: r.odemeNo || String(r.id),
      paymentDate: payDay,
      collectionDate: collectionDay(r.tahsilGunu, r.tarih) || payDay,
      bankId: bankKey != null ? String(bankKey) : '',
      bankName: bank?.name ?? '—',
      bankLogo: bank?.logo ?? '',
      amount: Math.round(amount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      branch: (r.subeDepartmanId != null ? branchMap.get(r.subeDepartmanId) : null) || '—',
      userId: r.kullaniciId != null ? String(r.kullaniciId) : '',
      userName: (r.kullaniciId != null ? userMap.get(r.kullaniciId) : null) || '—',
    });
  }

  let rows = detail;
  const type = q.reportType || 'detay';

  if (type === 'gunluk') {
    const map = new Map<string, CollectionReportRow>();
    for (const r of detail) {
      const key = `${r.paymentDate}|${r.bankId}`;
      const prev = map.get(key);
      if (prev) {
        prev.amount += r.amount;
        prev.commission += r.commission;
      } else {
        map.set(key, {
          ...r,
          id: `g-${key}`,
          collectionDate: r.paymentDate,
        });
      }
    }
    rows = [...map.values()]
      .map((r) => ({
        ...r,
        amount: Math.round(r.amount * 100) / 100,
        commission: Math.round(r.commission * 100) / 100,
      }))
      .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
  } else if (type === 'ozet') {
    const map = new Map<string, CollectionReportRow>();
    for (const r of detail) {
      const key = r.bankId || r.bankName;
      const prev = map.get(key);
      if (prev) {
        prev.amount += r.amount;
        prev.commission += r.commission;
        if (r.paymentDate < prev.paymentDate) prev.paymentDate = r.paymentDate;
        if (r.collectionDate > prev.collectionDate) prev.collectionDate = r.collectionDate;
      } else {
        map.set(key, { ...r, id: `o-${key}`, userId: '', userName: '—', branch: '—' });
      }
    }
    rows = [...map.values()]
      .map((r) => ({
        ...r,
        amount: Math.round(r.amount * 100) / 100,
        commission: Math.round(r.commission * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const amount = rows.reduce((s, r) => s + r.amount, 0);
  const commission = rows.reduce((s, r) => s + r.commission, 0);

  return {
    rows,
    totals: {
      amount: Math.round(amount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      net: Math.round((amount - commission) * 100) / 100,
    },
    filters: {
      branches: branches.map((b) => ({ value: String(b.id), label: b.adi })),
      users: users.map((u) => ({
        value: String(u.id),
        label: (u.adsoyad || u.email || `#${u.id}`).trim(),
      })),
      banks: banks.map((b) => ({
        value: String(b.id),
        label: (b.kisaAdi || b.adi || `#${b.id}`).trim(),
      })),
    },
  };
}
