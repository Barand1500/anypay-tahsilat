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

/** Ayarlar UI için anahtarı açığa çıkarmayan görünüm. */
export async function getPublicBinSourceSettings(): Promise<Omit<BinSourceSettings, 'remoteApiKey'> & { remoteApiKeyConfigured: boolean }> {
  const settings = await getBinSourceSettings();
  const { remoteApiKey, ...publicSettings } = settings;
  return { ...publicSettings, remoteApiKeyConfigured: Boolean(remoteApiKey) };
}

export async function updateBinSourceSettings(
  input: Partial<BinSourceSettings>,
): Promise<Omit<BinSourceSettings, 'remoteApiKey'> & { remoteApiKeyConfigured: boolean }> {
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
  const { remoteApiKey, ...publicSettings } = next;
  return { ...publicSettings, remoteApiKeyConfigured: Boolean(remoteApiKey) };
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
/** Kısa TTL — API’de yeni kayıt için toggle gerekmez; arada yenilenir */
const CACHE_TTL_MS = 60 * 1000;
const rawResourceCache = new Map<string, { at: number; rows: Record<string, unknown>[] }>();
let changelogHeadId: string | null = null;
let lastChangelogCheckAt = 0;

export type RemoteBankRow = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  gateway3dUrl: string;
  apiUrl: string;
  xmlUrl: string;
};

export type CentralPaymentStartResult = {
  sessionId: string;
  adapter: string;
  bankId: number;
  posId: number;
  bankName: string;
  form: { actionUrl: string; method: 'POST'; fields: Record<string, string> };
};

/** Send card data only over TLS to the company's authenticated central payment executor. */
export async function startCentralPayment(input: {
  orderId: string;
  bankName: string;
  amount: number;
  currencyCode: string;
  installment: number;
  card: { number: string; holder: string; expiry: string; cvc: string };
  clientIp?: string;
  email?: string;
  istekNo?: string;
}): Promise<CentralPaymentStartResult> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote' || !settings.remoteApiKey) {
    throw new SettingsError('Merkezi ödeme için API ayarı gerekli');
  }
  const url = `${settings.remoteBaseUrl.replace(/\/+$/, '')}/payments/start`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'X-API-Key': settings.remoteApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SettingsError('Merkezi ödeme hizmetine ulaşılamadı');
  }
  const json = await response.json().catch(() => null) as {
    success?: boolean;
    message?: string;
    data?: CentralPaymentStartResult;
  } | null;
  if (!response.ok || !json?.success || !json.data?.form?.actionUrl || !json.data.form.fields) {
    throw new SettingsError(json?.message || `Merkezi ödeme başlatılamadı (${response.status})`);
  }
  return json.data;
}

type RemoteBankCache = { at: number; rows: RemoteBankRow[] };
let remoteBankCache: RemoteBankCache | null = null;

export function clearRemoteBinCache() {
  remoteCache = null;
  remoteBankCache = null;
  remoteLocationsCache = null;
  remoteTaxCache = null;
  changelogHeadId = null;
  rawResourceCache.clear();
}

/** Merkez katalog cache’ini zorla temizle (yenile butonu / changelog) */
export function invalidateCentralCatalogCache() {
  clearRemoteBinCache();
  lastChangelogCheckAt = 0;
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

async function maybeInvalidateFromChangelog() {
  if (Date.now() - lastChangelogCheckAt < 20_000) return;
  lastChangelogCheckAt = Date.now();
  try {
    const rows = await fetchCentralChangeLog(5);
    const head = rows[0]?.id || '';
    if (changelogHeadId && head && head !== changelogHeadId) {
      clearRemoteBinCache();
    }
    if (head) changelogHeadId = head;
  } catch {
    /* log yoksa cache TTL ile devam */
  }
}

/** Merkez /v1/tahsilat/{resource} — ham satırlar (cache + changelog bust) */
export async function fetchRemoteTahsilatResource(
  resource: string,
  force = false,
): Promise<Record<string, unknown>[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  if (!settings.remoteApiKey) throw new SettingsError('Merkezi API anahtarı yok');
  const key = resource.replace(/^\/+|\/+$/g, '');
  if (!force) {
    await maybeInvalidateFromChangelog();
    const hit = rawResourceCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
  }
  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = `${base}/${key}`;
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        'X-API-Key': settings.remoteApiKey,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new SettingsError(`Merkezi API'ye ulaşılamadı (${resource}): ${detail.slice(0, 160)}`);
  }
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: unknown }
    | unknown[]
    | null;
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && !Array.isArray(json) && 'message' in json
        ? String((json as { message?: string }).message || '')
        : '';
    throw new SettingsError(
      msg
        ? `Merkezi API hatası (${resource}, ${res.status}): ${msg.slice(0, 180)}`
        : `Merkezi API hatası (${resource}, ${res.status})`,
    );
  }
  let rows: Record<string, unknown>[] = [];
  if (Array.isArray(json)) rows = json as Record<string, unknown>[];
  else if (json && typeof json === 'object') {
    const envelope = json as { data?: unknown; rows?: unknown };
    const candidates = [envelope.data, envelope.rows];
    const rowArray = candidates.find(Array.isArray);
    if (Array.isArray(rowArray)) rows = rowArray as Record<string, unknown>[];
    else if (envelope.data && typeof envelope.data === 'object') {
      const nested = envelope.data as { rows?: unknown; items?: unknown };
      const nestedArray = [nested.rows, nested.items].find(Array.isArray);
      if (Array.isArray(nestedArray)) rows = nestedArray as Record<string, unknown>[];
    }
  }
  console.info(`[central-catalog] resource=${resource} status=${res.status} rows=${rows.length}`);
  rawResourceCache.set(key, { at: Date.now(), rows });
  return rows;
}

export type RemoteNamedRow = { id: string; name: string };

/** Ad listesi — card-types / card-kinds / contracts vb. */
export async function fetchRemoteNamedResource(
  resource: string,
  force = false,
): Promise<RemoteNamedRow[]> {
  const settings = await getBinSourceSettings();
  if (settings.source !== 'remote') return [];
  const raw = await fetchRemoteTahsilatResource(resource, force);
  const out: RemoteNamedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi', 'title', 'baslik']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `remote-${name}`,
      name,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
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
  if (!force) await maybeInvalidateFromChangelog();
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
  if (!force) await maybeInvalidateFromChangelog();
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
  if (!force) await maybeInvalidateFromChangelog();
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
      // code vergi dairesi kodu — şehir alanına düşmesin
      city: pickField(flat, ['city', 'province', 'il']) || '',
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
    signal: AbortSignal.timeout(8_000),
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
  if (!force) await maybeInvalidateFromChangelog();
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

  const catalog = await fetchRemoteBinCatalog();
  let best: RemoteBinRow | null = null;
  for (const r of catalog) {
    if (d.startsWith(r.bin) && (!best || r.bin.length > best.bin.length)) best = r;
  }
  if (best) return best;

  const base = settings.remoteBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/bins/lookup`);
  url.searchParams.set('bin', d.slice(0, 8));
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8_000),
    headers: {
      'X-API-Key': settings.remoteApiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new SettingsError(`Merkezi BIN arama hatası (${res.status})`);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: Record<string, unknown> | null;
  } | null;
  const hit = json?.data;
  if (!hit || typeof hit !== 'object') throw new SettingsError('Merkezi BIN kaydı bulunamadı');
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

export type RemoteCurrencyRow = {
  id: string;
  name: string;
  shortName: string;
  symbol: string;
};

export async function fetchRemoteCurrencies(force = false): Promise<RemoteCurrencyRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('currencies', force);
  const out: RemoteCurrencyRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `cur-${name}`,
      name,
      shortName: pickField(flat, ['shortName', 'kisaAd', 'kisaAdi']) || name.slice(0, 3).toUpperCase(),
      symbol: pickField(flat, ['symbol', 'sembol']) || '',
    });
  }
  return out;
}

export type RemoteVirtualPosRow = {
  id: string;
  name: string;
  bank: string;
  variables: string;
};

export async function fetchRemoteVirtualPos(force = false): Promise<RemoteVirtualPosRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('virtual-pos', force);
  const out: RemoteVirtualPosRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi', 'posName', 'posAdi']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `vpos-${name}`,
      name,
      bank: pickField(flat, ['bank', 'banka', 'bankName']),
      variables: pickField(flat, ['variables', 'degiskenler']),
    });
  }
  return out;
}

export type RemoteCardBrandRow = {
  id: string;
  name: string;
  logo: string;
};

export async function fetchRemoteCardBrands(force = false): Promise<RemoteCardBrandRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('card-brands', force);
  const out: RemoteCardBrandRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `brand-${name}`,
      name,
      logo: pickField(flat, ['logo', 'logoUrl', 'image']),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export type RemoteModuleRow = {
  id: string;
  name: string;
  code: string;
  icon: string;
  sortOrder: number;
  parentId: string;
  parentName: string;
};

export async function fetchRemoteModules(force = false): Promise<RemoteModuleRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('modules', force);
  const out: RemoteModuleRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi']);
    if (!name) continue;
    const sortRaw = pickField(flat, ['sortOrder', 'sira']);
    out.push({
      id: flat.id != null ? String(flat.id) : `mod-${name}`,
      name,
      code: pickField(flat, ['code', 'kod']),
      icon: pickField(flat, ['icon', 'ikon']),
      sortOrder: Number(sortRaw) || 0,
      parentId: pickField(flat, ['parentId']),
      parentName: pickField(flat, ['parentName']),
    });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
}

export type RemoteTemplateVarRow = {
  id: string;
  name: string;
  type: string;
  variables: string;
};

export async function fetchRemoteTemplateVars(force = false): Promise<RemoteTemplateVarRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('template-vars', force);
  const out: RemoteTemplateVarRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const name = pickField(flat, ['name', 'adi']);
    if (!name) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `tv-${name}`,
      name,
      type: pickField(flat, ['type', 'tip']) || 'email',
      variables: pickField(flat, ['variables', 'degiskenler']),
    });
  }
  return out;
}

export type RemoteEmailSettingsRow = {
  id: string;
  host: string;
  port: string;
  address: string;
  password: string;
  ssl: string;
  tls: string;
};

export async function fetchRemoteEmailSettings(force = false): Promise<RemoteEmailSettingsRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('email-settings', force);
  const out: RemoteEmailSettingsRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    out.push({
      id: flat.id != null ? String(flat.id) : 'email-1',
      host: pickField(flat, ['host']),
      port: pickField(flat, ['port']) || '587',
      address: pickField(flat, ['address', 'email', 'from']),
      password: pickField(flat, ['password']),
      ssl: pickField(flat, ['ssl']),
      tls: pickField(flat, ['tls']),
    });
  }
  return out;
}

export type RemoteVersionRow = {
  id: string;
  version: string;
  releasedAt: string;
  added: string;
  fixed: string;
  removed: string;
};

export async function fetchRemoteVersions(force = false): Promise<RemoteVersionRow[]> {
  if (!(await isCentralRemoteActive())) return [];
  const raw = await fetchRemoteTahsilatResource('versions', force);
  const out: RemoteVersionRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const flat = flattenRemoteItem(item);
    const version = pickField(flat, ['version', 'versionNumber', 'surum']);
    if (!version) continue;
    out.push({
      id: flat.id != null ? String(flat.id) : `ver-${version}`,
      version,
      releasedAt: pickField(flat, ['releasedAt', 'date', 'tarih', 'at']),
      added: pickField(flat, ['added', 'eklenen']),
      fixed: pickField(flat, ['fixed', 'duzeltilen']),
      removed: pickField(flat, ['removed', 'cikartilan']),
    });
  }
  return out;
}
