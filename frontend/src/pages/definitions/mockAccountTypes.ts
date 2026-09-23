/** Tanımlamalar › Cari Tipleri — mock */

export type AccountTypeDef = {
  id: string;
  name: string;
  /** Boş = özel kısıt yok */
  installments: number[];
};

export const ACCOUNT_TYPE_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

export const INITIAL_ACCOUNT_TYPES: AccountTypeDef[] = [
  { id: 'at-bayi', name: 'Bayi', installments: [] },
  { id: 'at-belirtilmemis', name: 'Belirtilmemiş', installments: [] },
  { id: 'at-musteri', name: 'Müşteri', installments: [] },
];

const DEFS_KEY = 'anypay_tahsilat_account_type_defs';
/** Müşteri formundaki string listesi ile senkron */
const NAMES_KEY = 'anypay_tahsilat_account_types';

export function loadAccountTypes(): AccountTypeDef[] {
  try {
    const raw = localStorage.getItem(DEFS_KEY);
    if (!raw) return [...INITIAL_ACCOUNT_TYPES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...INITIAL_ACCOUNT_TYPES];
    return parsed.filter(
      (x): x is AccountTypeDef =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as AccountTypeDef).id === 'string' &&
        typeof (x as AccountTypeDef).name === 'string' &&
        Array.isArray((x as AccountTypeDef).installments),
    );
  } catch {
    return [...INITIAL_ACCOUNT_TYPES];
  }
}

export function saveAccountTypes(list: AccountTypeDef[]) {
  localStorage.setItem(DEFS_KEY, JSON.stringify(list));
  localStorage.setItem(NAMES_KEY, JSON.stringify(list.map((x) => x.name)));
}

export function formatInstallmentsLabel(list: number[]) {
  if (!list.length) return '—';
  return [...list].sort((a, b) => a - b).join(', ');
}
