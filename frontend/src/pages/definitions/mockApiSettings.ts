/** Tanımlamalar › Api Ayarları — mock API kaynakları */

const API_URL_KEY = 'anypay_api_base_url';

export type ApiCategoryId = 'locations' | 'tax-offices' | 'banks' | 'bin';

export type ApiCategoryMeta = {
  id: ApiCategoryId;
  label: string;
  /** Genel API altına eklenen yol */
  path: string;
  description: string;
};

export const API_CATEGORIES: ApiCategoryMeta[] = [
  {
    id: 'locations',
    label: 'Lokasyonlar',
    path: '/locations',
    description: 'Ülke, il ve ilçe kayıtları',
  },
  {
    id: 'tax-offices',
    label: 'Vergi Daireleri',
    path: '/tax-offices',
    description: 'Vergi dairesi tanımları',
  },
  {
    id: 'banks',
    label: 'Bankalar',
    path: '/banks',
    description: 'Banka listesi',
  },
  {
    id: 'bin',
    label: 'BIN Kayıtları',
    path: '/bin-records',
    description: 'Kart BIN tanımları',
  },
];

export function getApiBaseUrl() {
  return localStorage.getItem(API_URL_KEY) || 'https://api.guzelteknoloji.com/v1';
}

export function setApiBaseUrl(url: string) {
  localStorage.setItem(API_URL_KEY, url.trim());
}

export type LocationLevel = 'Ülke' | 'İl' | 'İlçe' | 'Mahalle';

export type LocationRow = {
  id: string;
  name: string;
  level: LocationLevel;
  /** İl → ülke; İlçe → il; Mahalle → ilçe; Ülke → null */
  parentId: string | null;
};

export type TaxOfficeRow = { id: string; city: string; district: string; name: string };
export type BankRow = { id: string; name: string; shortName: string };
export type BinRow = {
  id: string;
  bank: string;
  bin: string;
  type: string;
  brand: string;
  kind: string;
};

export type ApiRow = LocationRow | TaxOfficeRow | BankRow | BinRow;

export const INITIAL_LOCATIONS: LocationRow[] = [
  { id: 'loc-tr', name: 'Türkiye', level: 'Ülke', parentId: null },
  { id: 'loc-de', name: 'Almanya', level: 'Ülke', parentId: null },
  { id: 'loc-tr-07', name: 'Antalya', level: 'İl', parentId: 'loc-tr' },
  { id: 'loc-tr-34', name: 'İstanbul', level: 'İl', parentId: 'loc-tr' },
  { id: 'loc-tr-06', name: 'Ankara', level: 'İl', parentId: 'loc-tr' },
  { id: 'loc-tr-33', name: 'Mersin', level: 'İl', parentId: 'loc-tr' },
  { id: 'loc-de-be', name: 'Berlin', level: 'İl', parentId: 'loc-de' },
  { id: 'loc-tr-07-kepez', name: 'Kepez', level: 'İlçe', parentId: 'loc-tr-07' },
  { id: 'loc-tr-07-muratpasa', name: 'Muratpaşa', level: 'İlçe', parentId: 'loc-tr-07' },
  { id: 'loc-tr-34-kadikoy', name: 'Kadıköy', level: 'İlçe', parentId: 'loc-tr-34' },
  { id: 'loc-tr-06-cankaya', name: 'Çankaya', level: 'İlçe', parentId: 'loc-tr-06' },
  { id: 'loc-tr-33-toroslar', name: 'Toroslar', level: 'İlçe', parentId: 'loc-tr-33' },
  { id: 'loc-tr-07-kepez-gazi', name: 'Gazi', level: 'Mahalle', parentId: 'loc-tr-07-kepez' },
];

export function locationParentName(list: LocationRow[], parentId: string | null) {
  if (!parentId) return '—';
  return list.find((r) => r.id === parentId)?.name ?? '—';
}

export function locationAncestors(list: LocationRow[], row: LocationRow) {
  const city =
    row.level === 'İl'
      ? row
      : row.level === 'İlçe'
        ? list.find((r) => r.id === row.parentId)
        : row.level === 'Mahalle'
          ? (() => {
              const dist = list.find((r) => r.id === row.parentId);
              return dist ? list.find((r) => r.id === dist.parentId) : undefined;
            })()
          : undefined;
  const district =
    row.level === 'İlçe'
      ? row
      : row.level === 'Mahalle'
        ? list.find((r) => r.id === row.parentId)
        : undefined;
  const country =
    row.level === 'Ülke'
      ? row
      : city
        ? list.find((r) => r.id === city.parentId)
        : undefined;
  return {
    countryName: country?.name ?? '—',
    cityName: city?.name ?? '—',
    districtName: district?.name ?? '—',
  };
}

export function locationCountryName(list: LocationRow[], row: LocationRow) {
  return locationAncestors(list, row).countryName;
}

/** Aynı üst altında aynı isim var mı */
export function locationDuplicate(
  list: LocationRow[],
  name: string,
  level: LocationLevel,
  parentId: string | null,
  exceptId?: string,
) {
  const n = name.trim().toLocaleLowerCase('tr');
  return list.some(
    (r) =>
      r.id !== exceptId &&
      r.level === level &&
      r.parentId === parentId &&
      r.name.toLocaleLowerCase('tr') === n,
  );
}

/** İsimle bul veya oluştur (zincir) — dönen güncel liste + hedef id */
export function ensureLocationPath(
  list: LocationRow[],
  parts: {
    country?: string;
    city?: string;
    district?: string;
    neighborhood?: string;
  },
): { list: LocationRow[]; id: string | null } {
  let next = [...list];
  let countryId: string | null = null;
  let cityId: string | null = null;
  let districtId: string | null = null;
  let lastId: string | null = null;

  function findOrCreate(name: string, level: LocationLevel, parentId: string | null) {
    const existing = next.find(
      (r) =>
        r.level === level &&
        r.parentId === parentId &&
        r.name.toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr'),
    );
    if (existing) return existing.id;
    const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    next.push({ id, name: name.trim(), level, parentId });
    return id;
  }

  if (parts.country?.trim()) {
    countryId = findOrCreate(parts.country, 'Ülke', null);
    lastId = countryId;
  }
  if (parts.city?.trim() && countryId) {
    cityId = findOrCreate(parts.city, 'İl', countryId);
    lastId = cityId;
  }
  if (parts.district?.trim() && cityId) {
    districtId = findOrCreate(parts.district, 'İlçe', cityId);
    lastId = districtId;
  }
  if (parts.neighborhood?.trim() && districtId) {
    lastId = findOrCreate(parts.neighborhood, 'Mahalle', districtId);
  }
  return { list: next, id: lastId };
}

export const INITIAL_TAX_OFFICES: TaxOfficeRow[] = [
  { id: 'to-1', city: 'Adana', district: 'Merkez', name: 'Adana İhtisas V.D.' },
  { id: 'to-2', city: 'Antalya', district: 'Kepez', name: 'Kepez V.D.' },
  { id: 'to-3', city: 'Ankara', district: 'Çankaya', name: 'Ankara Kurumlar V.D.' },
  { id: 'to-4', city: 'İstanbul', district: 'Kadıköy', name: 'Kadıköy V.D.' },
  { id: 'to-5', city: 'İzmir', district: 'Konak', name: 'Konak V.D.' },
];

export const INITIAL_BANKS: BankRow[] = [
  { id: 'bk-1', name: 'Ziraat Katılım BANKASI A.Ş.', shortName: 'ZİRAAT KATILIM' },
  { id: 'bk-2', name: 'Türkiye İş Bankası A.Ş.', shortName: 'İŞ BANKASI' },
  { id: 'bk-3', name: 'Garanti BBVA', shortName: 'GARANTİ' },
  { id: 'bk-4', name: 'Yapı ve Kredi Bankası A.Ş.', shortName: 'YAPI KREDİ' },
  { id: 'bk-5', name: 'Akbank T.A.Ş.', shortName: 'AKBANK' },
];

export const INITIAL_BINS: BinRow[] = [
  { id: 'bin-1', bank: 'Ziraat', bin: '979241', type: 'Debit', brand: 'Troy', kind: 'Bireysel' },
  { id: 'bin-2', bank: 'İş Bankası', bin: '450803', type: 'Credit', brand: 'Visa', kind: 'Bireysel' },
  { id: 'bin-3', bank: 'Garanti', bin: '540063', type: 'Credit', brand: 'MasterCard', kind: 'Ticari' },
  { id: 'bin-4', bank: 'Yapı Kredi', bin: '454360', type: 'Credit', brand: 'Visa', kind: 'Bireysel' },
  { id: 'bin-5', bank: 'Akbank', bin: '557113', type: 'Credit', brand: 'MasterCard', kind: 'Bireysel' },
];

/** Mock API çekimi — bazen başarısız simüle eder */
export async function mockFetchCategory(
  categoryId: ApiCategoryId,
  endpoint: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  await new Promise((r) => setTimeout(r, 700));
  if (!endpoint.trim()) {
    return { ok: false, message: 'API yolu boş olamaz' };
  }
  // Deterministik ama “tekrar dene” hissi: endpoint uzunluğuna göre
  if (endpoint.includes('fail') || endpoint.endsWith('/')) {
    return { ok: false, message: 'API yanıt vermedi (mock hata)' };
  }
  const counts: Record<ApiCategoryId, number> = {
    locations: INITIAL_LOCATIONS.length,
    'tax-offices': INITIAL_TAX_OFFICES.length,
    banks: INITIAL_BANKS.length,
    bin: INITIAL_BINS.length,
  };
  return { ok: true, count: counts[categoryId] };
}

export function categoryMeta(id: ApiCategoryId) {
  return API_CATEGORIES.find((c) => c.id === id)!;
}
