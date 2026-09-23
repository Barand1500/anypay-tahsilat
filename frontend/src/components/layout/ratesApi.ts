import {
  RATE_CATALOG,
  type RateInstrument,
} from './ratesCatalog';

export type LiveQuote = {
  id: string;
  value: number;
  /** Önceki değere göre yüzde (varsa) */
  changePct: number | null;
  updatedAt: number;
};

const USD_JSON =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json';
const USD_JSON_FALLBACK =
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json';
const BINANCE = 'https://api.binance.com/api/v3/ticker/price';

/** Aynı anda tek istek; min aralık siteyi yormasın */
const MIN_FETCH_GAP_MS = 35_000;

type UsdMap = Record<string, number>;

let lastFetchAt = 0;
let inFlight: Promise<Record<string, LiveQuote>> | null = null;
let lastOk: Record<string, LiveQuote> = {};

async function fetchUsdMap(signal?: AbortSignal): Promise<{ date: string; usd: UsdMap }> {
  try {
    const res = await fetch(USD_JSON, { cache: 'no-store', signal });
    if (!res.ok) throw new Error('primary');
    return (await res.json()) as { date: string; usd: UsdMap };
  } catch (e) {
    if (signal?.aborted) throw e;
    const res = await fetch(USD_JSON_FALLBACK, { cache: 'no-store', signal });
    if (!res.ok) throw new Error('Kur API yanıt vermedi');
    return (await res.json()) as { date: string; usd: UsdMap };
  }
}

async function fetchCrypto(
  ids: string[],
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const wanted = RATE_CATALOG.filter((x) => ids.includes(x.id) && x.binance);
  if (!wanted.length) return {};
  const symbols = JSON.stringify(wanted.map((x) => x.binance));
  try {
    const res = await fetch(`${BINANCE}?symbols=${encodeURIComponent(symbols)}`, {
      cache: 'no-store',
      signal,
    });
    if (!res.ok) throw new Error('binance');
    const rows = (await res.json()) as { symbol: string; price: string }[];
    const out: Record<string, number> = {};
    for (const inst of wanted) {
      const row = rows.find((r) => r.symbol === inst.binance);
      if (row) out[inst.id] = Number(row.price);
    }
    return out;
  } catch {
    return {};
  }
}

const OZ_TO_GRAM = 31.1034768;

function metalGramTry(usd: UsdMap, metal: 'xau' | 'xag', grams: number): number | null {
  const perUsd = usd[metal];
  const tryPerUsd = usd.try;
  if (!perUsd || !tryPerUsd || perUsd <= 0) return null;
  const usdPerOz = 1 / perUsd;
  const tryPerOz = usdPerOz * tryPerUsd;
  return (tryPerOz / OZ_TO_GRAM) * grams;
}

function fxTry(usd: UsdMap, code: string): number | null {
  const tryPerUsd = usd.try;
  if (!tryPerUsd) return null;
  if (code === 'usd') return tryPerUsd;
  const perUsd = usd[code];
  if (!perUsd || perUsd <= 0) return null;
  return tryPerUsd / perUsd;
}

function computeValue(
  inst: RateInstrument,
  usd: UsdMap,
  crypto: Record<string, number>,
): number | null {
  if (inst.kind === 'fx' && inst.code) return fxTry(usd, inst.code);
  if (inst.kind === 'metal' && inst.metal && inst.grams != null) {
    return metalGramTry(usd, inst.metal, inst.grams);
  }
  if (inst.kind === 'crypto') return crypto[inst.id] ?? null;
  return null;
}

/**
 * Seçili enstrümanlar için kur çek.
 * force=false iken kısa sürede tekrar çağrı eski sonucu döner (spam yok).
 */
export async function fetchLiveQuotes(
  selectedIds: string[],
  prev: Record<string, LiveQuote>,
  opts?: { force?: boolean; signal?: AbortSignal },
): Promise<Record<string, LiveQuote>> {
  const now = Date.now();
  const force = opts?.force === true;

  if (!force && now - lastFetchAt < MIN_FETCH_GAP_MS && Object.keys(lastOk).length) {
    return { ...lastOk };
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const [bundle, crypto] = await Promise.all([
        fetchUsdMap(opts?.signal),
        fetchCrypto(selectedIds, opts?.signal),
      ]);
      const stamp = Date.now();
      const next: Record<string, LiveQuote> = {};
      const baseline = Object.keys(prev).length ? prev : lastOk;

      for (const id of selectedIds) {
        const inst = RATE_CATALOG.find((x) => x.id === id);
        if (!inst) continue;
        const value = computeValue(inst, bundle.usd, crypto);
        if (value == null || !Number.isFinite(value)) continue;
        const old = baseline[id]?.value;
        const changePct =
          old != null && old > 0 ? ((value - old) / old) * 100 : null;
        next[id] = { id, value, changePct, updatedAt: stamp };
      }

      lastFetchAt = stamp;
      lastOk = next;
      return next;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function formatQuoteValue(value: number, unit: string): string {
  if (unit === '$') {
    if (value >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1000) {
    return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }
  if (value >= 10) {
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}
