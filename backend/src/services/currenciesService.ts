import { prisma } from '../lib/prisma.js';

export class CurrenciesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurrenciesError';
  }
}

export type RateTypeLabel = 'Döviz Alış' | 'Döviz Satış' | 'Efektif Alış' | 'Efektif Satış';

export const RATE_TYPE_BY_CODE: Record<number, RateTypeLabel> = {
  1: 'Döviz Alış',
  2: 'Döviz Satış',
  3: 'Efektif Alış',
  4: 'Efektif Satış',
};

export const RATE_CODE_BY_LABEL: Record<RateTypeLabel, number> = {
  'Döviz Alış': 1,
  'Döviz Satış': 2,
  'Efektif Alış': 3,
  'Efektif Satış': 4,
};

export type PublicCurrency = {
  id: string;
  name: string;
  shortName: string;
  symbol: string;
  rateType: RateTypeLabel;
  rate: number;
  autoUpdate: boolean;
  apiUrl: string;
  status: 'Aktif' | 'Pasif';
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapRow(r: {
  id: number;
  adi: string;
  kisaAdi: string;
  sembol: string;
  kur: number;
  guncelleme: boolean;
  apiUrl: string | null;
  kurTipi: number;
  aktif: boolean | null;
}): PublicCurrency {
  const rateType = RATE_TYPE_BY_CODE[r.kurTipi] ?? 'Efektif Satış';
  return {
    id: String(r.id),
    name: r.adi,
    shortName: r.kisaAdi,
    symbol: r.sembol,
    rateType,
    rate: Number(r.kur) || 0,
    autoUpdate: Boolean(r.guncelleme),
    apiUrl: (r.apiUrl || '').trim(),
    status: r.aktif ? 'Aktif' : 'Pasif',
  };
}

export async function listCurrencies(opts?: {
  activeOnly?: boolean;
}): Promise<PublicCurrency[]> {
  const where: Record<string, unknown> = { ...notRemoved() };
  if (opts?.activeOnly) where.aktif = true;
  const rows = await prisma.parabirimi.findMany({
    where,
    orderBy: { id: 'asc' },
  });
  return rows.map(mapRow);
}

export async function getCurrencyById(id: number): Promise<PublicCurrency | null> {
  const row = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
  });
  return row ? mapRow(row) : null;
}

/** Aktif para birimi — yoksa id=1 veya ilk kayıt */
export async function resolveCurrencyId(raw?: number | null): Promise<{
  id: number;
  kur: number;
  symbol: string;
  shortName: string;
}> {
  if (raw != null && Number.isFinite(raw)) {
    const row = await prisma.parabirimi.findFirst({
      where: { id: raw, aktif: true, ...notRemoved() },
      select: { id: true, kur: true, sembol: true, kisaAdi: true },
    });
    if (row) {
      return {
        id: row.id,
        kur: Number(row.kur) || 1,
        symbol: row.sembol,
        shortName: row.kisaAdi,
      };
    }
  }
  const fallback =
    (await prisma.parabirimi.findFirst({
      where: { aktif: true, ...notRemoved() },
      orderBy: { id: 'asc' },
      select: { id: true, kur: true, sembol: true, kisaAdi: true },
    })) ||
    (await prisma.parabirimi.findFirst({
      where: { id: 1 },
      select: { id: true, kur: true, sembol: true, kisaAdi: true },
    }));
  if (!fallback) throw new CurrenciesError('Tanımlı para birimi yok');
  return {
    id: fallback.id,
    kur: Number(fallback.kur) || 1,
    symbol: fallback.sembol,
    shortName: fallback.kisaAdi,
  };
}

export type UpsertCurrencyInput = {
  name: string;
  shortName: string;
  symbol: string;
  rateType: RateTypeLabel;
  rate: number;
  autoUpdate: boolean;
  apiUrl?: string;
  status: 'Aktif' | 'Pasif';
};

export async function createCurrency(input: UpsertCurrencyInput): Promise<PublicCurrency> {
  const name = input.name.trim();
  const shortName = input.shortName.trim().toUpperCase();
  const symbol = input.symbol.trim();
  if (!name) throw new CurrenciesError('Ad gerekli');
  if (!shortName) throw new CurrenciesError('Kısa ad gerekli');
  if (!symbol) throw new CurrenciesError('Sembol gerekli');
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    throw new CurrenciesError('Geçerli kur girin');
  }
  const kurTipi = RATE_CODE_BY_LABEL[input.rateType];
  if (!kurTipi) throw new CurrenciesError('Kur tipi geçersiz');

  const dup = await prisma.parabirimi.findFirst({
    where: { kisaAdi: shortName, ...notRemoved() },
    select: { id: true },
  });
  if (dup) throw new CurrenciesError('Bu kısa ad zaten kayıtlı');

  const row = await prisma.parabirimi.create({
    data: {
      adi: name.slice(0, 255),
      kisaAdi: shortName.slice(0, 255),
      sembol: symbol.slice(0, 255),
      kur: input.rate,
      guncelleme: input.autoUpdate,
      apiUrl: (input.apiUrl || '').trim().slice(0, 255) || null,
      kurTipi,
      aktif: input.status === 'Aktif',
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateCurrency(
  id: number,
  input: UpsertCurrencyInput,
): Promise<PublicCurrency> {
  const existing = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new CurrenciesError('Para birimi bulunamadı');

  const name = input.name.trim();
  const shortName = input.shortName.trim().toUpperCase();
  const symbol = input.symbol.trim();
  if (!name) throw new CurrenciesError('Ad gerekli');
  if (!shortName) throw new CurrenciesError('Kısa ad gerekli');
  if (!symbol) throw new CurrenciesError('Sembol gerekli');
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    throw new CurrenciesError('Geçerli kur girin');
  }
  const kurTipi = RATE_CODE_BY_LABEL[input.rateType];
  if (!kurTipi) throw new CurrenciesError('Kur tipi geçersiz');

  const dup = await prisma.parabirimi.findFirst({
    where: { kisaAdi: shortName, NOT: { id }, ...notRemoved() },
    select: { id: true },
  });
  if (dup) throw new CurrenciesError('Bu kısa ad zaten kayıtlı');

  const row = await prisma.parabirimi.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      kisaAdi: shortName.slice(0, 255),
      sembol: symbol.slice(0, 255),
      kur: input.rate,
      guncelleme: input.autoUpdate,
      apiUrl: (input.apiUrl || '').trim().slice(0, 255) || null,
      kurTipi,
      aktif: input.status === 'Aktif',
    },
  });
  return mapRow(row);
}

export async function softDeleteCurrency(id: number): Promise<void> {
  const existing = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new CurrenciesError('Para birimi bulunamadı');
  if (id === 1) throw new CurrenciesError('Varsayılan TL silinemez');
  await prisma.parabirimi.update({
    where: { id },
    data: { remove: true, aktif: false },
  });
}

/** TCMB today.xml — ForexBuying/Selling / BanknoteBuying/Selling */
export async function refreshCurrencyRate(id: number): Promise<PublicCurrency> {
  const row = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!row) throw new CurrenciesError('Para birimi bulunamadı');

  const code = row.kisaAdi.trim().toUpperCase();
  if (code === 'TL' || code === 'TRY') {
    const updated = await prisma.parabirimi.update({
      where: { id },
      data: { kur: 1 },
    });
    return mapRow(updated);
  }

  const url =
    (row.apiUrl || '').trim() || 'https://www.tcmb.gov.tr/kurlar/today.xml';
  let xml: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.error('[currency-refresh]', err);
    throw new CurrenciesError('Kur API’sine ulaşılamadı');
  }

  const block =
    xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>[\\s\\S]*?</Currency>`, 'i')) ||
    xml.match(new RegExp(`<Currency[^>]*Kod="${code}"[^>]*>[\\s\\S]*?</Currency>`, 'i'));
  if (!block) throw new CurrenciesError(`${code} için TCMB kuru bulunamadı`);

  const pick = (tag: string) => {
    const m = block[0]!.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    if (!m?.[1]?.trim()) return null;
    const n = Number(m[1].trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const byTip: Record<number, number | null> = {
    1: pick('ForexBuying'),
    2: pick('ForexSelling'),
    3: pick('BanknoteBuying'),
    4: pick('BanknoteSelling'),
  };
  const rate =
    byTip[row.kurTipi] ??
    byTip[4] ??
    byTip[2] ??
    byTip[3] ??
    byTip[1];
  if (rate == null || rate <= 0) throw new CurrenciesError('Kur değeri okunamadı');

  const updated = await prisma.parabirimi.update({
    where: { id },
    data: { kur: rate },
  });
  return mapRow(updated);
}
