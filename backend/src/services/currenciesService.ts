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

const DEFAULT_RATE_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

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
  /** Merkezi API listesinden gelen kayıt (ad / kısa ad / sembol merkezden; kur ve oto güncelleme yerel) */
  central: boolean;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapRow(
  r: {
    id: number;
    adi: string;
    kisaAdi: string;
    sembol: string;
    kur: number;
    guncelleme: boolean;
    apiUrl: string | null;
    kurTipi: number;
    aktif: boolean | null;
  },
  central = false,
): PublicCurrency {
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
    central,
  };
}

/** TL / TRY aynı para birimi */
function codeKey(code: string): string {
  const c = code.trim().toUpperCase();
  return c === 'TRY' ? 'TL' : c;
}

let centralCodes = new Set<string>();
let lastCentralSync = 0;
let syncInFlight: Promise<void> | null = null;

/**
 * Merkezi API açıksa: merkezdeki para birimlerini yerel tabloya işler (yoksa ekler).
 * Var olan satırlara dokunmaz — kur, oto güncelleme ve durum yerelde kalır.
 * Merkeze ulaşılamazsa sessizce yerel kayıtlarla devam eder.
 */
async function syncCentralCurrencies(force = false): Promise<void> {
  const { isCentralRemoteActive, fetchRemoteCurrencies } = await import(
    './binSourceSettingsService.js'
  );
  if (!(await isCentralRemoteActive().catch(() => false))) {
    centralCodes = new Set();
    return;
  }
  if (!force && Date.now() - lastCentralSync < 5 * 60_000) return;
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    let remote;
    try {
      remote = await fetchRemoteCurrencies(force);
    } catch (err) {
      console.warn(
        '[currencies] merkezi liste okunamadı:',
        err instanceof Error ? err.message : err,
      );
      return;
    }
    const existing = await prisma.parabirimi.findMany({
      where: notRemoved(),
      select: { kisaAdi: true },
    });
    const have = new Set(existing.map((r) => codeKey(r.kisaAdi)));
    const codes = new Set<string>();
    let xml: string | null | undefined;
    for (const r of remote) {
      const key = codeKey(r.shortName);
      if (!key) continue;
      codes.add(key);
      if (have.has(key)) continue;
      const kurTipi = RATE_CODE_BY_LABEL['Efektif Satış'];
      // Yeni gelen para biriminin kurunu bir kez TCMB'den almayı dene (olmazsa 0 kalır, elle/oto yenilenir)
      let kur = key === 'TL' ? 1 : 0;
      if (key !== 'TL') {
        if (xml === undefined) xml = await fetchRateXml(DEFAULT_RATE_URL).catch(() => null);
        if (xml) {
          try {
            kur = rateFromXml(xml, key, kurTipi);
          } catch {
            /* TCMB listesinde yok */
          }
        }
      }
      await prisma.parabirimi.create({
        data: {
          adi: r.name.slice(0, 255),
          kisaAdi: key.slice(0, 255),
          sembol: (r.symbol || key).slice(0, 255),
          kur,
          guncelleme: false,
          apiUrl: null,
          kurTipi,
          aktif: true,
          remove: false,
        },
      });
      have.add(key);
    }
    centralCodes = codes;
    lastCentralSync = Date.now();
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/** Kayıt merkezi listeden mi geliyor (merkezi API açıkken) */
function isCentralCode(shortName: string): boolean {
  return centralCodes.has(codeKey(shortName));
}

export async function listCurrencies(opts?: {
  activeOnly?: boolean;
}): Promise<PublicCurrency[]> {
  await syncCentralCurrencies();
  const where: Record<string, unknown> = { ...notRemoved() };
  if (opts?.activeOnly) where.aktif = true;
  const rows = await prisma.parabirimi.findMany({
    where,
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => mapRow(r, isCentralCode(r.kisaAdi)));
}

export async function getCurrencyById(id: number): Promise<PublicCurrency | null> {
  const row = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
  });
  return row ? mapRow(row, isCentralCode(row.kisaAdi)) : null;
}

/** Aktif para birimi — yoksa id=1 veya ilk kayıt */
export async function resolveCurrencyId(raw?: number | null): Promise<{
  id: number;
  kur: number;
  /** Veritabanındaki ham kur (0 = henüz çekilmemiş) */
  rawKur: number;
  symbol: string;
  shortName: string;
}> {
  await syncCentralCurrencies();

  if (raw != null && Number.isFinite(raw)) {
    const row = await prisma.parabirimi.findFirst({
      where: { id: raw, aktif: true, ...notRemoved() },
      select: { id: true, kur: true, sembol: true, kisaAdi: true },
    });
    if (row) {
      return {
        id: row.id,
        kur: Number(row.kur) || 1,
        rawKur: Number(row.kur) || 0,
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
    rawKur: Number(fallback.kur) || 0,
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

function cleanApiUrl(raw: string | undefined): string | null {
  const value = (raw || '').trim().slice(0, 255);
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CurrenciesError('Api Url geçerli bir adres olmalı');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CurrenciesError('Api Url http veya https olmalı');
  }
  return value;
}

/** Merkezi API açıkken de eklenebilir — kayıt yalnızca bu firmanın veritabanında durur */
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
  const apiUrl = cleanApiUrl(input.apiUrl);

  await syncCentralCurrencies();
  const dup = await prisma.parabirimi.findFirst({
    where: {
      kisaAdi: { in: codeKey(shortName) === 'TL' ? ['TL', 'TRY'] : [shortName] },
      ...notRemoved(),
    },
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
      apiUrl,
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
  await syncCentralCurrencies();
  const existing = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true, adi: true, kisaAdi: true, sembol: true },
  });
  if (!existing) throw new CurrenciesError('Para birimi bulunamadı');

  // Merkezden gelen kayıtta ad / kısa ad / sembol değişmez; kur ve oto güncelleme yerelde yönetilir
  const central = isCentralCode(existing.kisaAdi);
  const name = central ? existing.adi : input.name.trim();
  const shortName = central ? existing.kisaAdi : input.shortName.trim().toUpperCase();
  const symbol = central ? existing.sembol : input.symbol.trim();
  if (!name) throw new CurrenciesError('Ad gerekli');
  if (!shortName) throw new CurrenciesError('Kısa ad gerekli');
  if (!symbol) throw new CurrenciesError('Sembol gerekli');
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    throw new CurrenciesError('Geçerli kur girin');
  }
  const kurTipi = RATE_CODE_BY_LABEL[input.rateType];
  if (!kurTipi) throw new CurrenciesError('Kur tipi geçersiz');
  const apiUrl = cleanApiUrl(input.apiUrl);

  if (!central) {
    const dup = await prisma.parabirimi.findFirst({
      where: {
        kisaAdi: { in: codeKey(shortName) === 'TL' ? ['TL', 'TRY'] : [shortName] },
        NOT: { id },
        ...notRemoved(),
      },
      select: { id: true },
    });
    if (dup) throw new CurrenciesError('Bu kısa ad zaten kayıtlı');
  }

  const row = await prisma.parabirimi.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      kisaAdi: shortName.slice(0, 255),
      sembol: symbol.slice(0, 255),
      kur: input.rate,
      guncelleme: input.autoUpdate,
      apiUrl,
      kurTipi,
      aktif: input.status === 'Aktif',
    },
  });
  return mapRow(row, central);
}

export async function softDeleteCurrency(id: number): Promise<void> {
  const { isCentralRemoteActive } = await import('./binSourceSettingsService.js');
  if (await isCentralRemoteActive()) {
    throw new CurrenciesError('Merkezi API açıkken para birimi silinemez.');
  }
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

async function fetchRateXml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error('[currency-refresh]', err);
    throw new CurrenciesError('Kur API’sine ulaşılamadı');
  }
}

/** TCMB today.xml — ForexBuying/Selling / BanknoteBuying/Selling */
function rateFromXml(xml: string, rawCode: string, kurTipi: number): number {
  const code = rawCode.trim().toUpperCase();
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
  const rate = byTip[kurTipi] ?? byTip[4] ?? byTip[2] ?? byTip[3] ?? byTip[1];
  if (rate == null || rate <= 0) throw new CurrenciesError('Kur değeri okunamadı');
  return rate;
}

export async function refreshCurrencyRate(id: number): Promise<PublicCurrency> {
  await syncCentralCurrencies();
  const row = await prisma.parabirimi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!row) throw new CurrenciesError('Para birimi bulunamadı');
  const central = isCentralCode(row.kisaAdi);

  if (codeKey(row.kisaAdi) === 'TL') {
    const updated = await prisma.parabirimi.update({
      where: { id },
      data: { kur: 1 },
    });
    return mapRow(updated, central);
  }

  const xml = await fetchRateXml((row.apiUrl || '').trim() || DEFAULT_RATE_URL);
  const rate = rateFromXml(xml, row.kisaAdi, row.kurTipi);
  const updated = await prisma.parabirimi.update({
    where: { id },
    data: { kur: rate },
  });
  return mapRow(updated, central);
}

export type CurrencyRefreshSummary = { checked: number; updated: number; errors: number };

/** Oto güncelleme açık olan aktif para birimlerinin kurlarını yeniler (aynı adresten tek indirme) */
export async function refreshAutoCurrencies(): Promise<CurrencyRefreshSummary> {
  const rows = await prisma.parabirimi.findMany({
    where: { guncelleme: true, aktif: true, ...notRemoved() },
  });
  const summary: CurrencyRefreshSummary = { checked: rows.length, updated: 0, errors: 0 };
  const xmlByUrl = new Map<string, string | null>();

  for (const row of rows) {
    try {
      if (codeKey(row.kisaAdi) === 'TL') {
        if (Number(row.kur) !== 1) {
          await prisma.parabirimi.update({ where: { id: row.id }, data: { kur: 1 } });
          summary.updated += 1;
        }
        continue;
      }
      const url = (row.apiUrl || '').trim() || DEFAULT_RATE_URL;
      if (!xmlByUrl.has(url)) {
        xmlByUrl.set(url, await fetchRateXml(url).catch(() => null));
      }
      const xml = xmlByUrl.get(url);
      if (!xml) throw new CurrenciesError('Kur API’sine ulaşılamadı');
      const rate = rateFromXml(xml, row.kisaAdi, row.kurTipi);
      if (rate !== Number(row.kur)) {
        await prisma.parabirimi.update({ where: { id: row.id }, data: { kur: rate } });
        summary.updated += 1;
      }
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[currency-auto] ${row.kisaAdi} güncellenemedi:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return summary;
}

let schedulerStarted = false;
let schedulerBusy = false;

/** Saatte bir oto güncelleme açık kurları yeniler (TCMB hafta içi gün içinde yayınlar) */
export function startCurrencyRateScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const run = async () => {
    if (schedulerBusy) return;
    schedulerBusy = true;
    try {
      const s = await refreshAutoCurrencies();
      if (s.checked) {
        console.info(
          `[currency-auto] kontrol=${s.checked} güncellenen=${s.updated} hata=${s.errors}`,
        );
      }
    } catch (err) {
      console.warn('[currency-auto] çalıştırılamadı:', err instanceof Error ? err.message : err);
    } finally {
      schedulerBusy = false;
    }
  };
  setTimeout(() => void run(), 60_000).unref();
  setInterval(() => void run(), 60 * 60_000).unref();
}
