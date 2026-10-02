/** Tanımlamalar › API kategori ve kayıt tipleri */

const API_URL_KEY = 'anypay_api_base_url';
const API_KEY_KEY = 'anypay_api_access_key';

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
    description: 'Ülke / il / ilçe / mahalle (canlı)',
  },
  {
    id: 'tax-offices',
    label: 'Vergi Daireleri',
    path: '/tax-offices',
    description: 'Vergi dairesi tanımları (canlı)',
  },
  {
    id: 'banks',
    label: 'Bankalar',
    path: '/banks',
    description: 'Tanımlamalar › Bankalar (canlı)',
  },
  {
    id: 'bin',
    label: 'BIN Kayıtları',
    path: '/bins',
    description: 'Kart BIN → banka (ödeme algılama)',
  },
];

export function getApiBaseUrl() {
  return localStorage.getItem(API_URL_KEY) || 'https://api.guzelteknoloji.com/v1';
}

export function setApiBaseUrl(url: string) {
  localStorage.setItem(API_URL_KEY, url.trim());
}

export function getApiAccessKey() {
  return localStorage.getItem(API_KEY_KEY) || '';
}

export function setApiAccessKey(key: string) {
  localStorage.setItem(API_KEY_KEY, key.trim());
}

export function getApiEndpoint(category: ApiCategoryId, fallback: string) {
  return localStorage.getItem(`anypay_api_endpoint_${category}`) || fallback;
}

export function setApiEndpoint(category: ApiCategoryId, endpoint: string) {
  localStorage.setItem(`anypay_api_endpoint_${category}`, endpoint.trim());
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
  /** DB banka id (API) */
  bankId?: string;
};

export type ApiRow = LocationRow | TaxOfficeRow | BankRow | BinRow;

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

export function categoryMeta(id: ApiCategoryId) {
  return API_CATEGORIES.find((c) => c.id === id)!;
}
