/** Raporlar › İstatistikler — tipler + sabitler */

export type StatRankItem = {
  id: string;
  label: string;
  amount: number;
  color: string;
  /** Banka logosu */
  logo?: string;
  /** Kart satırı alt metin (maskeli kart vb.) */
  meta?: string;
};

export type StatisticsBundle = {
  customers: StatRankItem[];
  banks: StatRankItem[];
  cards: StatRankItem[];
};

export const STAT_PALETTE = [
  '#0d9488',
  '#2563eb',
  '#059669',
  '#d97706',
  '#0ea5e9',
  '#475569',
  '#14b8a6',
  '#1d4ed8',
  '#65a30d',
  '#b45309',
];

export const STAT_MONTHS = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

/** Varsayılan yıl seçenekleri — API filters.years gelince override */
export function defaultStatYears(now = new Date()): { value: string; label: string }[] {
  const y = now.getFullYear();
  return [y, y - 1, y - 2].map((n) => ({ value: String(n), label: String(n) }));
}

export { formatMoneyAmount as formatMoneyTr, formatMoneyDisplay } from '../settings/personalPrefs';

export const REPORT_SUBNAV = [
  { to: '/raporlar/istatistikler', label: 'İstatistikler', ready: true },
  { to: '/raporlar/tahsilat-raporu', label: 'Tahsilat Raporu', ready: true },
  { to: '/raporlar/musteri-tahsilat-raporu', label: 'Müşteri Tahsilat Raporu', ready: true },
  { to: '/raporlar/musteri-kart-tahsilat', label: 'Müşteri Kartı Tahsilat', ready: true },
  { to: '/raporlar/banka-tahsilat-raporu', label: 'Banka Tahsilat Raporu', ready: true },
  { to: '/raporlar/gonderim-gecmisi', label: 'Gönderim Geçmişi', ready: true },
] as const;
