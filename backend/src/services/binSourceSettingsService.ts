import { prisma } from '../lib/prisma.js';
import { ensureBinKaynakAyarlariColumn } from '../lib/ensureSchema.js';
import { getOrCreateAyarlarRow, SettingsError } from './settingsService.js';

export type BinSourceMode = 'local' | 'remote';

export type BinSourceSettings = {
  /** local = bin_kayitlari; remote = Güzel Teknoloji API */
  source: BinSourceMode;
  remoteBaseUrl: string;
  remoteApiKey: string;
};

const DEFAULT: BinSourceSettings = {
  source: 'local',
  /** Tercih: .../v1/tahsilat — eski .../v1 de (bins) çalışır */
  remoteBaseUrl: 'https://api.guzelteknoloji.com/v1/tahsilat',
  remoteApiKey: '',
};

function clampUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return DEFAULT.remoteBaseUrl;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      throw new SettingsError('Uzak BIN API yolu https:// olmalı');
    }
    return t;
  } catch (err) {
    if (err instanceof SettingsError) throw err;
    throw new SettingsError('Uzak BIN API yolu geçersiz');
  }
}

function parseStored(raw: string | null | undefined): BinSourceSettings {
  if (!raw?.trim()) return { ...DEFAULT };
  try {
    const p = JSON.parse(raw) as Partial<BinSourceSettings>;
    return {
      source: p.source === 'remote' ? 'remote' : 'local',
      remoteBaseUrl: typeof p.remoteBaseUrl === 'string' && p.remoteBaseUrl.trim()
        ? p.remoteBaseUrl.trim().replace(/\/+$/, '')
        : DEFAULT.remoteBaseUrl,
      remoteApiKey: typeof p.remoteApiKey === 'string' ? p.remoteApiKey.trim() : '',
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function getBinSourceSettings(): Promise<BinSourceSettings> {
  await ensureBinKaynakAyarlariColumn();
  const row = await getOrCreateAyarlarRow();
  const rows = await prisma.$queryRaw<{ bin_kaynak_ayarlari: string | null }[]>`
    SELECT bin_kaynak_ayarlari FROM ayarlar WHERE id = ${row.id} LIMIT 1
  `;
  return parseStored(rows[0]?.bin_kaynak_ayarlari);
}

export async function updateBinSourceSettings(
  input: Partial<BinSourceSettings>,
): Promise<BinSourceSettings> {
  await ensureBinKaynakAyarlariColumn();
  const current = await getBinSourceSettings();
  const next: BinSourceSettings = {
    source: input.source === 'remote' ? 'remote' : input.source === 'local' ? 'local' : current.source,
    remoteBaseUrl:
      input.remoteBaseUrl !== undefined ? clampUrl(input.remoteBaseUrl) : current.remoteBaseUrl,
    remoteApiKey:
      input.remoteApiKey !== undefined
        ? String(input.remoteApiKey).trim().slice(0, 512)
        : current.remoteApiKey,
  };
  if (next.source === 'remote' && !next.remoteApiKey) {
    throw new SettingsError('Uzak BIN kaynağı için API anahtarı gerekli');
  }
  const row = await getOrCreateAyarlarRow();
  await prisma.$executeRaw`
    UPDATE ayarlar
    SET bin_kaynak_ayarlari = ${JSON.stringify(next)}, db_tarih = ${new Date()}
    WHERE id = ${row.id}
  `;
  // cache invalidate
  clearRemoteBinCache();
  return next;
}

/** Public katalog satırı (FE / BE ortak) */
export type RemoteBinRow = {
  bin: string;
  bankId: string;
  bank: string;
  kind: string;
  brand: string;
  type: string;
};

type CacheEntry = { at: number; rows: RemoteBinRow[] };
let remoteCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearRemoteBinCache() {
  remoteCache = null;
}

function pickField(row: Record<string, unknown>, aliases: string[]): string {
  const keyFor = (value: string) =>
    value
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const found = Object.entries(row).find(([name]) =>
    aliases.some((a) => keyFor(a) === keyFor(name)),
  );
  return found?.[1] == null ? '' : String(found[1]).trim();
}

function mapRemoteRows(raw: unknown[]): RemoteBinRow[] {
  const out: RemoteBinRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const flat =
      record.data && typeof record.data === 'object' && !Array.isArray(record.data)
        ? { ...record, ...(record.data as Record<string, unknown>) }
        : record;
    const bin = pickField(flat, ['bin', 'iin']).replace(/\D/g, '').slice(0, 8);
    const bank = pickField(flat, ['bank', 'banka']);
    if (bin.length < 4 || !bank) continue;
    out.push({
      bin,
      bank,
      bankId: '',
      kind: pickField(flat, ['kind', 'tur', 'tür']) || '',
      brand: pickField(flat, ['brand', 'marka']) || '',
      type: pickField(flat, ['type', 'tip']) || '',
    });
  }
  return out;
}

/** Güzel API’den tam BIN kataloğu (bellek cache) */
export async function fetchRemoteBinCatalog(force = false): Promise<RemoteBinRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!force && remoteCache && Date.now() - remoteCache.at < CACHE_TTL_MS) {
    return remoteCache.rows;
  }
  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = `${base}/bins`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': settings.remoteApiKey,
      Accept: 'application/json',
    },
  });
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: unknown }
    | unknown[]
    | null;
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && !Array.isArray(json) && 'message' in json
        ? String((json as { message?: string }).message || '')
        : '';
    throw new SettingsError(msg || `Uzak BIN API hatası (${res.status})`);
  }
  const rawRows: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data)
      : [];
  const rows = mapRemoteRows(rawRows);
  remoteCache = { at: Date.now(), rows };
  return rows;
}

/** Uzak lookup — önce cache katalog; yoksa /bins/lookup */
export async function lookupRemoteBin(cardDigits: string): Promise<RemoteBinRow | null> {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return null;

  try {
    const catalog = await fetchRemoteBinCatalog();
    let best: RemoteBinRow | null = null;
    for (const r of catalog) {
      if (d.startsWith(r.bin) && (!best || r.bin.length > best.bin.length)) best = r;
    }
    if (best) return best;
  } catch {
    /* lookup endpoint dene */
  }

  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/bins/lookup`);
  url.searchParams.set('bin', d.slice(0, 8));
  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': settings.remoteApiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: Record<string, unknown> | null;
  } | null;
  const hit = json?.data;
  if (!hit || typeof hit !== 'object') return null;
  const bin = pickField(hit, ['bin', 'iin']).replace(/\D/g, '').slice(0, 8);
  const bank = pickField(hit, ['bank', 'banka']);
  if (bin.length < 4 || !bank) return null;
  return {
    bin,
    bank,
    bankId: '',
    kind: pickField(hit, ['kind', 'tur', 'tür']) || '',
    brand: pickField(hit, ['brand', 'marka']) || '',
    type: pickField(hit, ['type', 'tip']) || '',
  };
}
