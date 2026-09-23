/** Panel varsayılanları — localStorage; sayfalar buradan okur */

import { getLoginTheme, setLoginTheme, type LoginTheme } from '../login/loginTheme';
import type { ThemeMode } from '../../theme/ThemeProvider';

const KEY = 'anypay_tahsilat_defaults';

export type PayTypeDefault = 'ch' | 'fatura';
export type DisplayModeDefault = 'window' | 'fullscreen';
export type CustomerKindDefault = 'gercek' | 'tuzel' | 'yabanci';
export type VirtualPosDefault = 'bank' | 'external';

/** Filtre akordeonu olan sayfalar */
export const FILTER_PAGE_KEYS = [
  { key: 'hareketler', label: 'Hareketler', path: '/hareketler' },
  { key: 'odeme-istekleri', label: 'Ödeme İstekleri', path: '/odeme-istekleri' },
  { key: 'istatistikler', label: 'İstatistikler', path: '/raporlar/istatistikler' },
  { key: 'tahsilat-raporu', label: 'Tahsilat Raporu', path: '/raporlar/tahsilat-raporu' },
  {
    key: 'musteri-tahsilat',
    label: 'Müşteri Tahsilat Raporu',
    path: '/raporlar/musteri-tahsilat-raporu',
  },
  {
    key: 'kart-tahsilat',
    label: 'Müşteri Kartı Tahsilat',
    path: '/raporlar/musteri-kart-tahsilat',
  },
  { key: 'banka-tahsilat', label: 'Banka Tahsilat Raporu', path: '/raporlar/banka-tahsilat-raporu' },
  { key: 'gonderim-gecmisi', label: 'Gönderim Geçmişi', path: '/raporlar/gonderim-gecmisi' },
] as const;

export type FilterPageKey = (typeof FILTER_PAGE_KEYS)[number]['key'];

export type AppDefaults = {
  loginTheme: LoginTheme;
  panelTheme: ThemeMode;
  landingPath: string;
  payType: PayTypeDefault;
  currency: string;
  accountType: string;
  customerKind: CustomerKindDefault;
  virtualPos: VirtualPosDefault;
  taxOffice: string;
  country: string;
  displayMode: DisplayModeDefault;
  /** true = filtre açık */
  filterOpen: Record<FilterPageKey, boolean>;
};

export const LANDING_OPTIONS = [
  { value: '/', label: 'Özet' },
  { value: '/musteriler', label: 'Müşteriler' },
  { value: '/hareketler', label: 'Hareketler' },
  { value: '/odeme-istekleri', label: 'Ödeme İstekleri' },
  { value: '/raporlar/istatistikler', label: 'İstatistikler' },
  { value: '/hizli-odeme', label: 'Hızlı Ödeme' },
];

export const PAY_TYPE_OPTIONS = [
  { value: 'ch', label: 'C/H Bakiyesi' },
  { value: 'fatura', label: 'Fatura' },
];

export const CURRENCY_OPTIONS = [
  { value: 'TRY', label: '₺ - Türk Lirası' },
  { value: 'USD', label: '$ - ABD Doları' },
  { value: 'EUR', label: '€ - Euro' },
];

export const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'Belirtilmemiş' },
  { value: 'Müşteri', label: 'Müşteri' },
  { value: 'Bayi', label: 'Bayi' },
  { value: 'Alıcı', label: 'Alıcı' },
  { value: 'Satıcı', label: 'Satıcı' },
  { value: 'Alıcı / Satıcı', label: 'Alıcı / Satıcı' },
];

export const CUSTOMER_KIND_DEFAULT_OPTIONS = [
  { value: 'gercek', label: 'Gerçek' },
  { value: 'tuzel', label: 'Tüzel' },
  { value: 'yabanci', label: 'Yabancı' },
];

export const VIRTUAL_POS_OPTIONS = [
  { value: 'bank', label: 'Banka Sanal Posları' },
  { value: 'external', label: 'Harici Sanal POS' },
];

export const COUNTRY_OPTIONS = [
  { value: 'TR', label: 'Türkiye' },
  { value: 'DE', label: 'Almanya' },
  { value: 'US', label: 'Amerika Birleşik Devletleri' },
  { value: 'GB', label: 'Birleşik Krallık' },
  { value: 'NL', label: 'Hollanda' },
];

export const DISPLAY_MODE_OPTIONS = [
  { value: 'window', label: 'Normal pencere' },
  { value: 'fullscreen', label: 'Tam ekran' },
];

export const PANEL_THEME_OPTIONS = [
  { value: 'light', label: 'Gündüz (Açık)' },
  { value: 'dark', label: 'Gece (Koyu)' },
];

export const LOGIN_THEME_OPTIONS = [
  { value: 'classic', label: 'Klasik' },
  { value: 'globe', label: 'Dünya' },
];

export const FILTER_STATE_OPTIONS = [
  { value: 'open', label: 'Açık' },
  { value: 'closed', label: 'Kapalı' },
];

function defaultFilterOpen(): Record<FilterPageKey, boolean> {
  return {
    hareketler: true,
    'odeme-istekleri': true,
    istatistikler: true,
    'tahsilat-raporu': true,
    'musteri-tahsilat': true,
    'kart-tahsilat': true,
    'banka-tahsilat': true,
    'gonderim-gecmisi': true,
  };
}

export function defaultAppDefaults(): AppDefaults {
  return {
    loginTheme: getLoginTheme(),
    panelTheme: (localStorage.getItem('anypay_tahsilat_theme') === 'dark' ? 'dark' : 'light') as ThemeMode,
    landingPath: '/',
    payType: 'ch',
    currency: 'TRY',
    accountType: '',
    customerKind: 'gercek',
    virtualPos: 'bank',
    taxOffice: '',
    country: 'TR',
    displayMode: 'window',
    filterOpen: defaultFilterOpen(),
  };
}

export function getAppDefaults(): AppDefaults {
  const base = defaultAppDefaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppDefaults>;
    return {
      ...base,
      ...parsed,
      filterOpen: { ...base.filterOpen, ...(parsed.filterOpen ?? {}) },
    };
  } catch {
    return base;
  }
}

export function setAppDefaults(next: AppDefaults) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  setLoginTheme(next.loginTheme);
  window.dispatchEvent(new CustomEvent('anypay:defaults', { detail: next }));
}

export function getDefaultFiltersOpen(page: FilterPageKey): boolean {
  return getAppDefaults().filterOpen[page] ?? true;
}

export function getDefaultPayType(): PayTypeDefault {
  return getAppDefaults().payType;
}

export function getDefaultCurrency(): string {
  return getAppDefaults().currency;
}

export function getDefaultCustomerKind(): CustomerKindDefault {
  return getAppDefaults().customerKind;
}

export function getDefaultAccountType(): string {
  return getAppDefaults().accountType;
}

export function getDefaultTaxOffice(): string {
  return getAppDefaults().taxOffice;
}

export function getDefaultLandingPath(): string {
  return getAppDefaults().landingPath || '/';
}

export async function applyDisplayMode(mode: DisplayModeDefault) {
  try {
    if (mode === 'fullscreen') {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    /* tarayıcı engelledi */
  }
}
