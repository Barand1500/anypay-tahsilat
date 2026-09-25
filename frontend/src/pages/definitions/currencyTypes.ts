/** Tanımlamalar › Para Birimleri — tipler + sabitler (API canlı) */

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
