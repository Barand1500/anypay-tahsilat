import { prisma } from '../lib/prisma.js';

/** Ödeme durum kodları (dump + eski panel KPI ile örtüşür) */
const DURUM_OK = 1;
const DURUM_CANCEL = 2;

export type ChartRange = '1G' | '1H' | '1A' | '6A' | '1Y';

export type OverviewQuery = {
  branchId?: number | null;
  userId?: number | null;
  from?: string | null;
  to?: string | null;
  chartRange?: ChartRange;
};

export type OverviewKpi = {
  id: 'customers' | 'moves' | 'cancel' | 'requests';
  title: string;
  value: string;
  meta: string;
  tone: 'blue' | 'green' | 'red' | 'orange';
};

export type OverviewPeriodBank = {
  id: string;
  name: string;
  amount: string;
  logo?: string;
};

export type OverviewPeriod = {
  id: 'day' | 'week' | 'month' | 'year';
  title: string;
  current: string;
  previous: string;
  changePct: number;
  banks: OverviewPeriodBank[];
};

export type OverviewPieSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type OverviewPieDataset = {
  id: string;
  label: string;
  slices: OverviewPieSlice[];
};

export type OverviewChartPoint = {
  label: string;
  full: string;
  values: Record<string, number>;
};

export type OverviewChartSeries = {
  id: string;
  name: string;
  color: string;
};

export type OverviewFilterOption = { value: string; label: string };

export type OverviewPayload = {
  kpis: OverviewKpi[];
  periods: OverviewPeriod[];
  pieDatasets: OverviewPieDataset[];
  chart: {
    title: string;
    subtitle: string;
    series: OverviewChartSeries[];
    points: OverviewChartPoint[];
  };
  filters: {
    branches: OverviewFilterOption[];
    users: OverviewFilterOption[];
  };
};

const PIE_STATUS_COLORS: Record<string, string> = {
  ok: '#16a34a',
  fail: '#e11d48',
  cancel: '#64748b',
  refund: '#0ea5e9',
  wait: '#f59e0b',
};

const PIE_PALETTE = [
  '#2f80ed',
  '#ea580c',
  '#8b5cf6',
  '#0d9488',
  '#c026d3',
  '#ca8a04',
  '#e11d48',
  '#64748b',
];

const CHART_PALETTE = ['#e85d6c', '#3dba7a', '#3b5bdb', '#5b9cff', '#b08968', '#c026d3', '#0d9488'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Europe/Istanbul takvim günü YYYY-MM-DD */
function dayKeyIstanbul(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseDayKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** TR gününün UTC Date aralığı (DB datetime naive TR varsayımı) */
function rangeForDayKey(key: string): { start: Date; end: Date } | null {
  const p = parseDayKey(key);
  if (!p) return null;
  const start = new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0);
  const end = new Date(p.y, p.m - 1, p.d, 23, 59, 59, 999);
  return { start, end };
}

function addDaysKey(key: string, delta: number): string {
  const p = parseDayKey(key)!;
  const d = new Date(p.y, p.m - 1, p.d + delta);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatMoneyTr(n: number): string {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function changePct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function bankLogoUrl(logo: string | null | undefined): string | undefined {
  if (!logo) return undefined;
  const file = logo.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return undefined;
  return `/banks/${file}`;
}

function bankSlug(kisaAdi: string, id: number): string {
  const raw = kisaAdi
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  return raw || `bank-${id}`;
}

type OdemeRow = {
  durum: number;
  tutar: number;
  gercekTutar: number;
  tarih: Date | null;
  bankaId: number | null;
  sanalposBankaId: number | null;
  subeDepartmanId: number | null;
  kullaniciId: number | null;
  iptalIadeHareket: string | null;
};

function amountOf(row: OdemeRow): number {
  const v = row.gercekTutar ?? row.tutar ?? 0;
  return Number.isFinite(v) ? v : 0;
}

function effectiveBankId(row: OdemeRow): number | null {
  return row.bankaId ?? row.sanalposBankaId ?? null;
}

/** iptal_iade tip: "1"=iptal, "2"=iade */
function cancelKind(raw: string | null | undefined): 'iptal' | 'iade' {
  if (!raw) return 'iptal';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const tip = String((parsed[0] as { tip?: string })?.tip ?? '1');
      if (tip === '2') return 'iade';
    }
  } catch {
    /* PHP serialize vs JSON — varsayılan iptal */
  }
  if (raw.includes('"tip":"2"') || raw.includes("'tip':'2'")) return 'iade';
  return 'iptal';
}

function isFailed(durum: number) {
  return durum === 0 || durum === -1;
}

function buildOdemeWhere(q: OverviewQuery, from?: Date | null, to?: Date | null) {
  const where: Record<string, unknown> = {};
  if (q.branchId != null) where.subeDepartmanId = q.branchId;
  if (q.userId != null) where.kullaniciId = q.userId;
  if (from || to) {
    where.tarih = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  return where;
}

async function loadBanksMap() {
  const rows = await prisma.banka.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { id: true, adi: true, kisaAdi: true, logo: true },
  });
  const map = new Map<number, { id: string; name: string; short: string; logo?: string }>();
  for (const b of rows) {
    map.set(b.id, {
      id: bankSlug(b.kisaAdi, b.id),
      name: b.kisaAdi || b.adi,
      short: b.kisaAdi,
      logo: bankLogoUrl(b.logo),
    });
  }
  return map;
}

function sumPaidInRange(rows: OdemeRow[], start: Date, end: Date): number {
  let sum = 0;
  for (const r of rows) {
    if (r.durum !== DURUM_OK || !r.tarih) continue;
    if (r.tarih < start || r.tarih > end) continue;
    sum += amountOf(r);
  }
  return sum;
}

function banksInRange(
  rows: OdemeRow[],
  start: Date,
  end: Date,
  banks: Map<number, { id: string; name: string; logo?: string }>,
): OverviewPeriodBank[] {
  const totals = new Map<number, number>();
  for (const r of rows) {
    if (r.durum !== DURUM_OK || !r.tarih) continue;
    if (r.tarih < start || r.tarih > end) continue;
    const bid = effectiveBankId(r);
    if (bid == null) continue;
    totals.set(bid, (totals.get(bid) || 0) + amountOf(r));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([bid, amount]) => {
      const meta = banks.get(bid);
      return {
        id: meta?.id ?? `bank-${bid}`,
        name: meta?.name ?? `Banka #${bid}`,
        amount: formatMoneyTr(amount),
        logo: meta?.logo,
      };
    });
}

function periodWindow(
  kind: 'day' | 'week' | 'month' | 'year',
  now = new Date(),
): { curStart: Date; curEnd: Date; prevStart: Date; prevEnd: Date; title: string } {
  const today = dayKeyIstanbul(now);
  const p = parseDayKey(today)!;

  if (kind === 'day') {
    const yest = addDaysKey(today, -1);
    const cur = rangeForDayKey(today)!;
    const prev = rangeForDayKey(yest)!;
    return {
      title: 'Bugün vs Dün',
      curStart: cur.start,
      curEnd: cur.end,
      prevStart: prev.start,
      prevEnd: prev.end,
    };
  }

  if (kind === 'week') {
    const day = (new Date(p.y, p.m - 1, p.d).getDay() + 6) % 7;
    const mon = addDaysKey(today, -day);
    const prevMon = addDaysKey(mon, -7);
    const prevSun = addDaysKey(mon, -1);
    const curS = rangeForDayKey(mon)!;
    const curE = rangeForDayKey(today)!;
    const prevS = rangeForDayKey(prevMon)!;
    const prevE = rangeForDayKey(prevSun)!;
    return {
      title: 'Bu Hafta vs Geçen Hafta',
      curStart: curS.start,
      curEnd: curE.end,
      prevStart: prevS.start,
      prevEnd: prevE.end,
    };
  }

  if (kind === 'month') {
    const curStart = new Date(p.y, p.m - 1, 1, 0, 0, 0, 0);
    const curEnd = new Date(p.y, p.m - 1, p.d, 23, 59, 59, 999);
    const prevLast = new Date(p.y, p.m - 1, 0);
    const prevStart = new Date(prevLast.getFullYear(), prevLast.getMonth(), 1, 0, 0, 0, 0);
    const prevEnd = new Date(
      prevLast.getFullYear(),
      prevLast.getMonth(),
      prevLast.getDate(),
      23,
      59,
      59,
      999,
    );
    return {
      title: 'Bu Ay vs Geçen Ay',
      curStart,
      curEnd,
      prevStart,
      prevEnd,
    };
  }

  const curStart = new Date(p.y, 0, 1, 0, 0, 0, 0);
  const curEnd = new Date(p.y, p.m - 1, p.d, 23, 59, 59, 999);
  const prevStart = new Date(p.y - 1, 0, 1, 0, 0, 0, 0);
  const prevEnd = new Date(p.y - 1, 11, 31, 23, 59, 59, 999);
  return {
    title: 'Bu Yıl vs Geçen Yıl',
    curStart,
    curEnd,
    prevStart,
    prevEnd,
  };
}

function buildChartBuckets(range: ChartRange, now = new Date()) {
  const today = dayKeyIstanbul(now);
  const p = parseDayKey(today)!;

  if (range === '1G') {
    const day = rangeForDayKey(today)!;
    return Array.from({ length: 24 }, (_, h) => {
      const start = new Date(p.y, p.m - 1, p.d, h, 0, 0, 0);
      const end = new Date(p.y, p.m - 1, p.d, h, 59, 59, 999);
      return {
        start,
        end,
        label: `${pad2(h)}:00`,
        full: `${p.d}.${pad2(p.m)}.${p.y} ${pad2(h)}:00`,
      };
    }).map((b) => ({ ...b, start: b.start < day.start ? day.start : b.start }));
  }

  if (range === '1H') {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysKey(today, -(6 - i));
      const r = rangeForDayKey(key)!;
      const dp = parseDayKey(key)!;
      const d = new Date(dp.y, dp.m - 1, dp.d);
      return {
        start: r.start,
        end: r.end,
        label: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
        full: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
      };
    });
  }

  if (range === '1A') {
    return Array.from({ length: 30 }, (_, i) => {
      const key = addDaysKey(today, -(29 - i));
      const r = rangeForDayKey(key)!;
      const dp = parseDayKey(key)!;
      return {
        start: r.start,
        end: r.end,
        label: String(dp.d),
        full: `${dp.d}.${pad2(dp.m)}.${dp.y}`,
      };
    });
  }

  if (range === '6A') {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(p.y, p.m - 1 - (5 - i), 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: d.toLocaleDateString('tr-TR', { month: 'short' }),
        full: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      };
    });
  }

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(p.y, i, 1);
    const start = new Date(p.y, i, 1, 0, 0, 0, 0);
    const end = new Date(p.y, i + 1, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      label: `${pad2(i + 1)}/${p.y}`,
      full: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
    };
  });
}

export async function getOverview(q: OverviewQuery): Promise<OverviewPayload> {
  const chartRange: ChartRange = q.chartRange || '1A';

  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (q.from) {
    const r = rangeForDayKey(q.from);
    if (r) fromDate = r.start;
  }
  if (q.to) {
    const r = rangeForDayKey(q.to);
    if (r) toDate = r.end;
  }

  const filterWhere = buildOdemeWhere(q, fromDate, toDate);
  const scopeWhere = buildOdemeWhere(q); // şube/kullanıcı — dönem kartları için tarihsiz

  const [banks, customers, filteredPayments, scopedPayments, requests, branches, users] =
    await Promise.all([
      loadBanksMap(),
      prisma.musteri.findMany({
        where: { OR: [{ remove: null }, { remove: false }] },
        select: { id: true, durum: true },
      }),
      prisma.odeme.findMany({
        where: filterWhere,
        select: {
          durum: true,
          tutar: true,
          gercekTutar: true,
          tarih: true,
          bankaId: true,
          sanalposBankaId: true,
          subeDepartmanId: true,
          kullaniciId: true,
          iptalIadeHareket: true,
        },
      }),
      prisma.odeme.findMany({
        where: scopeWhere,
        select: {
          durum: true,
          tutar: true,
          gercekTutar: true,
          tarih: true,
          bankaId: true,
          sanalposBankaId: true,
          subeDepartmanId: true,
          kullaniciId: true,
          iptalIadeHareket: true,
        },
      }),
      prisma.odemeIstegi.findMany({
        where: {
          OR: [{ remove: null }, { remove: false }],
          ...(q.branchId != null ? { subeDepartmanId: q.branchId } : {}),
          ...(q.userId != null ? { kullaniciId: q.userId } : {}),
          ...(fromDate || toDate
            ? {
                tarih: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
        },
        select: { durum: true },
      }),
      prisma.subeDepartman.findMany({
        where: { OR: [{ remove: null }, { remove: false }] },
        orderBy: { adi: 'asc' },
        select: { id: true, adi: true },
      }),
      prisma.user.findMany({
        where: {
          musteriId: null,
          OR: [{ remove: null }, { remove: false }],
        },
        orderBy: { adsoyad: 'asc' },
        select: { id: true, adsoyad: true, email: true },
      }),
    ]);

  const payments = filteredPayments as OdemeRow[];
  const scoped = scopedPayments as OdemeRow[];

  let ok = 0;
  let fail = 0;
  let iptal = 0;
  let iade = 0;
  for (const r of payments) {
    if (r.durum === DURUM_OK) ok += 1;
    else if (r.durum === DURUM_CANCEL) {
      if (cancelKind(r.iptalIadeHareket) === 'iade') iade += 1;
      else iptal += 1;
    } else if (isFailed(r.durum)) fail += 1;
  }

  const activeCustomers = customers.length;
  const passiveCustomers = 0;

  let reqPaid = 0;
  let reqPending = 0;
  for (const r of requests) {
    if (r.durum) reqPaid += 1;
    else reqPending += 1;
  }

  const kpis: OverviewKpi[] = [
    {
      id: 'customers',
      title: 'Müşteriler',
      value: String(activeCustomers),
      meta: `${activeCustomers} Aktif, ${passiveCustomers} Pasif Müşteri`,
      tone: 'blue',
    },
    {
      id: 'moves',
      title: 'Hareketler',
      value: `${ok} Başarılı`,
      meta: `${fail} Hatalı`,
      tone: 'green',
    },
    {
      id: 'cancel',
      title: 'İptal / İade',
      value: `${iptal} İptal`,
      meta: `${iade} İade`,
      tone: 'red',
    },
    {
      id: 'requests',
      title: 'Ödeme İstekleri',
      value: `${reqPaid} Ödenen`,
      meta: `${reqPending} Bekleyen`,
      tone: 'orange',
    },
  ];

  const periods: OverviewPeriod[] = (['day', 'week', 'month', 'year'] as const).map((id) => {
    const w = periodWindow(id);
    const current = sumPaidInRange(scoped, w.curStart, w.curEnd);
    const previous = sumPaidInRange(scoped, w.prevStart, w.prevEnd);
    return {
      id,
      title: w.title,
      current: formatMoneyTr(current),
      previous: formatMoneyTr(previous),
      changePct: changePct(current, previous),
      banks: banksInRange(scoped, w.curStart, w.curEnd, banks),
    };
  });

  // Pasta: ödeme durumu
  const statusSlices: OverviewPieSlice[] = [
    { id: 'ok', label: 'Başarılı', value: ok, color: PIE_STATUS_COLORS.ok },
    { id: 'fail', label: 'Hatalı', value: fail, color: PIE_STATUS_COLORS.fail },
    { id: 'cancel', label: 'İptal', value: iptal, color: PIE_STATUS_COLORS.cancel },
    { id: 'refund', label: 'İade', value: iade, color: PIE_STATUS_COLORS.refund },
  ].filter((s) => s.value > 0);

  // Pasta: banka payı (başarılı tutar)
  const bankTotals = new Map<number, number>();
  for (const r of payments) {
    if (r.durum !== DURUM_OK) continue;
    const bid = effectiveBankId(r);
    if (bid == null) continue;
    bankTotals.set(bid, (bankTotals.get(bid) || 0) + amountOf(r));
  }
  const bankSlices = [...bankTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bid, value], i) => {
      const meta = banks.get(bid);
      return {
        id: meta?.id ?? `bank-${bid}`,
        label: meta?.name ?? `Banka #${bid}`,
        value: Math.round(value * 100) / 100,
        color: PIE_PALETTE[i % PIE_PALETTE.length],
      };
    });

  // Pasta: şube payı
  const branchName = new Map(branches.map((b) => [b.id, b.adi]));
  const branchTotals = new Map<number, number>();
  for (const r of payments) {
    if (r.durum !== DURUM_OK) continue;
    const sid = r.subeDepartmanId;
    if (sid == null) continue;
    branchTotals.set(sid, (branchTotals.get(sid) || 0) + amountOf(r));
  }
  const branchSlices = [...branchTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sid, value], i) => ({
      id: `branch-${sid}`,
      label: branchName.get(sid) || `Şube #${sid}`,
      value: Math.round(value * 100) / 100,
      color: PIE_PALETTE[i % PIE_PALETTE.length],
    }));

  const pieDatasets: OverviewPieDataset[] = [
    {
      id: 'payment_status',
      label: 'Ödeme durumu',
      slices:
        statusSlices.length > 0
          ? statusSlices
          : [{ id: 'empty', label: 'Veri yok', value: 1, color: '#94a3b8' }],
    },
    {
      id: 'banks',
      label: 'Banka payı',
      slices:
        bankSlices.length > 0
          ? bankSlices
          : [{ id: 'empty', label: 'Veri yok', value: 1, color: '#94a3b8' }],
    },
    {
      id: 'branches',
      label: 'Şube payı',
      slices:
        branchSlices.length > 0
          ? branchSlices
          : [{ id: 'empty', label: 'Veri yok', value: 1, color: '#94a3b8' }],
    },
  ];

  // Grafik — başarılı tutarlar, en çok işlem gören bankalar
  const buckets = buildChartBuckets(chartRange);
  const chartWindowStart = buckets[0]?.start;
  const chartWindowEnd = buckets[buckets.length - 1]?.end;
  const chartBankTotals = new Map<number, number>();
  for (const r of scoped) {
    if (r.durum !== DURUM_OK || !r.tarih) continue;
    if (chartWindowStart && r.tarih < chartWindowStart) continue;
    if (chartWindowEnd && r.tarih > chartWindowEnd) continue;
    const bid = effectiveBankId(r);
    if (bid == null) continue;
    chartBankTotals.set(bid, (chartBankTotals.get(bid) || 0) + amountOf(r));
  }
  const topBankIds = [...chartBankTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  // Top yoksa yine de bilinen bankalardan doldur
  const seriesIds =
    topBankIds.length > 0
      ? topBankIds
      : [...banks.keys()].slice(0, 5);

  const series: OverviewChartSeries[] = seriesIds.map((bid, i) => {
    const meta = banks.get(bid);
    return {
      id: String(bid),
      name: meta?.name ?? `Banka #${bid}`,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    };
  });

  const points: OverviewChartPoint[] = buckets.map((b) => {
    const values: Record<string, number> = {};
    for (const s of series) values[s.id] = 0;
    for (const r of scoped) {
      if (r.durum !== DURUM_OK || !r.tarih) continue;
      if (r.tarih < b.start || r.tarih > b.end) continue;
      const bid = effectiveBankId(r);
      if (bid == null) continue;
      const key = String(bid);
      if (!(key in values)) continue;
      values[key] = Math.round((values[key] + amountOf(r)) * 100) / 100;
    }
    return { label: b.label, full: b.full, values };
  });

  return {
    kpis,
    periods,
    pieDatasets,
    chart: {
      title: 'Hareketler',
      subtitle: 'Başarılı tahsilat akışı (banka bazlı)',
      series,
      points,
    },
    filters: {
      branches: [
        { value: 'all', label: 'Tüm Şubeler' },
        ...branches.map((b) => ({ value: String(b.id), label: b.adi })),
      ],
      users: [
        { value: 'all', label: 'Tüm Kullanıcılar' },
        ...users.map((u) => ({
          value: String(u.id),
          label: (u.adsoyad || u.email).trim(),
        })),
      ],
    },
  };
}
