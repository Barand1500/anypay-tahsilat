/** Tanımlamalar › Para Birimleri — mock; API sonrası canlı bağlanacak */

export const DEFAULT_CURRENCY_API_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

export type RateType = 'Döviz Alış' | 'Döviz Satış' | 'Efektif Alış' | 'Efektif Satış';

export const RATE_TYPE_OPTIONS: { value: RateType; label: string }[] = [
  { value: 'Döviz Alış', label: 'Döviz Alış' },
  { value: 'Döviz Satış', label: 'Döviz Satış' },
  { value: 'Efektif Alış', label: 'Efektif Alış' },
  { value: 'Efektif Satış', label: 'Efektif Satış' },
];

export type CurrencyStatus = 'Aktif' | 'Pasif';

export type CurrencyDef = {
  id: string;
  name: string;
  shortName: string;
  symbol: string;
  rateType: RateType;
  rate: number;
  autoUpdate: boolean;
  apiUrl: string;
  status: CurrencyStatus;
};

/** TCMB örnek kurlar (mock yenileme) */
export const MOCK_TCMB_RATES: Record<string, Partial<Record<RateType, number>>> = {
  USD: {
    'Döviz Alış': 48.6116,
    'Döviz Satış': 48.6992,
    'Efektif Alış': 48.5776,
    'Efektif Satış': 48.7723,
  },
  EUR: {
    'Döviz Alış': 55.7981,
    'Döviz Satış': 55.8986,
    'Efektif Alış': 55.759,
    'Efektif Satış': 55.9824,
  },
  TL: {
    'Döviz Alış': 1,
    'Döviz Satış': 1,
    'Efektif Alış': 1,
    'Efektif Satış': 1,
  },
};

export const INITIAL_CURRENCIES: CurrencyDef[] = [
  {
    id: 'cur-usd',
    name: 'ABD Doları',
    shortName: 'USD',
    symbol: '$',
    rateType: 'Efektif Satış',
    rate: 48.59,
    autoUpdate: false,
    apiUrl: DEFAULT_CURRENCY_API_URL,
    status: 'Pasif',
  },
  {
    id: 'cur-eur',
    name: 'Euro',
    shortName: 'EUR',
    symbol: '€',
    rateType: 'Efektif Satış',
    rate: 56.36,
    autoUpdate: false,
    apiUrl: DEFAULT_CURRENCY_API_URL,
    status: 'Pasif',
  },
  {
    id: 'cur-tl',
    name: 'Türk Lirası',
    shortName: 'TL',
    symbol: '₺',
    rateType: 'Efektif Satış',
    rate: 1,
    autoUpdate: false,
    apiUrl: DEFAULT_CURRENCY_API_URL,
    status: 'Aktif',
  },
];

export const DEFINITIONS_SUBNAV = [
  { to: '/tanimlamalar/para-birimleri', label: 'Para Birimleri', ready: true, end: true },
  { to: '/tanimlamalar/cari-tipleri', label: 'Cari Tipleri', ready: true, end: true },
  { to: '/tanimlamalar/subeler', label: 'Şubeler / Departmanlar', ready: true, end: true },
  { to: '/tanimlamalar/pos-kart', label: 'POS ve Kart', ready: true, end: false },
  { to: '/tanimlamalar/sozlesmeler', label: 'Sözleşmeler', ready: true, end: true },
  { to: '/tanimlamalar/api-ayarlari', label: 'Api Ayarları', ready: true, end: true },
] as const;

export function formatRate(n: number) {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function resolveMockRate(shortName: string, rateType: RateType): number | null {
  const key = shortName.trim().toUpperCase();
  const entry = MOCK_TCMB_RATES[key];
  if (!entry) return null;
  return entry[rateType] ?? null;
}
