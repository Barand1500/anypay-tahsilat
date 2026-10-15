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

export type RemoteBankRow = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  gateway3dUrl: string;
  apiUrl: string;
  xmlUrl: string;
};

type RemoteBankCache = { at: number; rows: RemoteBankRow[] };
let remoteBankCache: RemoteBankCache | null = null;

export function clearRemoteBinCache() {
  remoteCache = null;
  remoteBankCache = null;
  remoteLocationsCache = null;
  remoteTaxCache = null;
}

export async function isCentralRemoteActive(): Promise<boolean> {
  const src = await getBinSourceSettings();
  return src.source === 'remote';
}

export async function assertLocalCatalogWritable(label = 'Bu tanımlar') {
  if (await isCentralRemoteActive()) {
    throw new SettingsError(
      `${label} merkezi API üzerinden geliyor (salt okunur). Düzenlemek için Api Ayarları’nda merkezi kaynağı kapatın.`,
    );
  }
}

type RemoteLocationsCache = { at: number; rows: RemoteLocationRow[] };
let remoteLocationsCache: RemoteLocationsCache | null = null;
type RemoteTaxCache = { at: number; rows: RemoteTaxOfficeRow[] };
let remoteTaxCache: RemoteTaxCache | null = null;

export type RemoteLocationRow = {
  id: string;
  name: string;
  level: 'Ülke' | 'İl' | 'İlçe' | 'Mahalle';
  parentId: string | null;
};

export type RemoteTaxOfficeRow = {
  id: string;
  city: string;
  district: string;
  name: string;
};

export type CentralChangeLogRow = {
  id: string;
  resource: string;
  action: string;
  rowId: string;
  summary: string;
  createdAt: string;
};

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

/** Merkez /v1/tahsilat/{resource} — ham satırlar */
export async function fetchRemoteTahsilatResource(resource: string): Promise<Record<string, unknown>[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!settings.remoteApiKey) throw new SettingsError('Merkezi API anahtarı yok');
  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = `${base}/${resource.replace(/^\/+|\/+$/g, '')}`;
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
    throw new SettingsError(msg || `Merkezi API hatası (${resource}, ${res.status})`);
  }
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) {
    return (json as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

function mapRemoteBanks(raw: Record<string, unknown>[]): RemoteBankRow[] {
  const out: RemoteBankRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat =
      item.data && typeof item.data === 'object' && !Array.isArray(item.data)
        ? { ...item, ...(item.data as Record<string, unknown>) }
        : item;
    const name = pickField(flat, ['name', 'adi', 'banka']);
    if (!name) continue;
    const idRaw = flat.id != null ? String(flat.id) : '';
    out.push({
      id: idRaw || `remote-${name}`,
      name,
      shortName: pickField(flat, ['shortName', 'shortname', 'kisaAd', 'kisaAdi', 'kisaadi']) || name.slice(0, 8),
      logo: pickField(flat, ['logo', 'logoUrl', 'image']),
      gateway3dUrl: pickField(flat, ['gateway3dsUrl', 'gateway3dUrl', 'sanalPos3dUrl']),
      apiUrl: pickField(flat, ['apiUrl', 'sanalPosApiUrl']),
      xmlUrl: pickField(flat, ['xmlUrl', 'sanalPosXmlUrl']),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/** Merkez bankalar listesi (cache) */
export async function fetchRemoteBanks(force = false): Promise<RemoteBankRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!force && remoteBankCache && Date.now() - remoteBankCache.at < CACHE_TTL_MS) {
    return remoteBankCache.rows;
  }
  const raw = await fetchRemoteTahsilatResource('banks');
  const rows = mapRemoteBanks(raw);
  remoteBankCache = { at: Date.now(), rows };
  return rows;
}

function flattenRemoteItem(item: Record<string, unknown>): Record<string, unknown> {
  if (item.data && typeof item.data === 'object' && !Array.isArray(item.data)) {
    return { ...item, ...(item.data as Record<string, unknown>) };
  }
  return item;
}

/** Merkez iller + ilçeler → AnyPay lokasyon ağacı (Mahalle boş olabilir) */
export async function fetchRemoteLocations(force = false): Promise<RemoteLocationRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!force && remoteLocationsCache && Date.now() - remoteLocationsCache.at < CACHE_TTL_MS) {
    return remoteLocationsCache.rows;
  }
  const [provinces, districts] = await Promise.all([
    fetchRemoteTahsilatResource('provinces'),
    fetchRemoteTahsilatResource('districts'),
  ]);
  const countryId = 'u-remote-tr';
  const out: RemoteLocationRow[] = [
    { id: countryId, name: 'Türkiye', level: 'Ülke', parentId: null },
  ];
  const provinceIdByName = new Map<string, string>();
  for (const item of provinces) {
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi', 'il']);
    if (!name) continue;
    const id = `i-${flat.id != null ? String(flat.id) : name}`;
    provinceIdByName.set(name.toLocaleLowerCase('tr-TR'), id);
    out.push({ id, name, level: 'İl', parentId: countryId });
  }
  for (const item of districts) {
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi', 'ilce']);
    if (!name) continue;
    const provinceName = pickField(flat, ['province', 'il', 'provinceName']);
    const provinceIdField = pickField(flat, ['provinceId', 'ilId']);
    let parentId =
      (provinceIdField ? `i-${provinceIdField}` : '') ||
      (provinceName ? provinceIdByName.get(provinceName.toLocaleLowerCase('tr-TR')) || '' : '');
    if (!parentId) parentId = countryId;
    const id = `c-${flat.id != null ? String(flat.id) : name}`;
    out.push({ id, name, level: 'İlçe', parentId });
  }
  remoteLocationsCache = { at: Date.now(), rows: out };
  return out;
}

/** Merkez vergi daireleri */
export async function fetchRemoteTaxOffices(force = false): Promise<RemoteTaxOfficeRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!force && remoteTaxCache && Date.now() - remoteTaxCache.at < CACHE_TTL_MS) {
    return remoteTaxCache.rows;
  }
  const raw = await fetchRemoteTahsilatResource('tax-offices');
  const out: RemoteTaxOfficeRow[] = [];
  for (const item of raw) {
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `tax-${name}`,
      name,
      city: pickField(flat, ['province', 'city', 'il', 'code']) || '',
      district: pickField(flat, ['district', 'ilce']) || '',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  remoteTaxCache = { at: Date.now(), rows: out };
  return out;
}

/** Merkez değişiklik günlüğü */
export async function fetchCentralChangeLog(limit = 100): Promise<CentralChangeLogRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!settings.remoteApiKey) throw new SettingsError('Merkezi API anahtarı yok');
  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = `${base}/changelog?limit=${Math.min(500, Math.max(1, limit))}`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': settings.remoteApiKey,
      Accept: 'application/json',
    },
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  } | null;
  if (!res.ok) {
    throw new SettingsError(
      (json && typeof json === 'object' && json.message) || `Merkezi log alınamadı (${res.status})`,
    );
  }
  const raw = Array.isArray(json?.data) ? json!.data! : [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
    .map((r) => ({
      id: String(r.id ?? ''),
      resource: String(r.resource ?? ''),
      action: String(r.action ?? ''),
      rowId: String(r.rowId ?? r.row_id ?? ''),
      summary: String(r.summary ?? ''),
      createdAt: String(r.createdAt ?? r.created_at ?? ''),
    }));
}

/** Güzel API’den tam BIN kataloğu (bellek cache) */
export async function fetchRemoteBinCatalog(force = false): Promise<RemoteBinRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!force && remoteCache && Date.now() - remoteCache.at < CACHE_TTL_MS) {
    return remoteCache.rows;
  }
  const rawRows = await fetchRemoteTahsilatResource('bins');
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
