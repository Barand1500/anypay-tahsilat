/** Ayarlar — alt sayfa nav + tipler (genel API’ye bağlı) */

export type SettingsSubnavItem = {
  to: string;
  label: string;
  ready: boolean;
};

export const SETTINGS_SUBNAV: SettingsSubnavItem[] = [
  { to: '/ayarlar/genel', label: 'Genel Ayarlar', ready: true },
  { to: '/ayarlar/kisisel', label: 'Kişisel Ayarlar', ready: true },
  { to: '/ayarlar/iletisim', label: 'İletişim Bilgileri', ready: true },
  { to: '/ayarlar/varsayilanlar', label: 'Varsayılanlar', ready: true },
  { to: '/ayarlar/e-posta', label: 'E-Posta Ayarları', ready: true },
  { to: '/ayarlar/sms', label: 'SMS Ayarları', ready: true },
  { to: '/ayarlar/whatsapp', label: 'WhatsApp Ayarları', ready: true },
  { to: '/ayarlar/odeme-sayfasi', label: 'Ödeme Sayfası', ready: true },
  { to: '/ayarlar/sablon-degiskenleri', label: 'Şablon Değişkenleri', ready: true },
  { to: '/ayarlar/erp', label: 'ERP Entegrasyon', ready: true },
];

export type GeneralSettings = {
  systemName: string;
  systemUrl: string;
  logoUrl: string;
  faviconUrl: string;
  virtualPosTarget: boolean;
  appSignup: boolean;
  notifyEmails: string[];
  notifyPhones: string[];
  binListUrl: string;
  quickAccess: { enabled: boolean; slotCount: number };
};

export type ContactEntityKind = 'gercek' | 'tuzel' | 'yabanci';

export type ContactSettings = {
  title: string;
  kind: ContactEntityKind;
  taxNo: string;
  taxOffice: string;
  /** Gerçek / Yabancı kimlik */
  identityNo: string;
  address: string;
  email: string;
  phone: string;
  gsm: string;
  website: string;
};

export const CONTACT_KIND_OPTIONS = [
  { value: 'gercek', label: 'Gerçek' },
  { value: 'tuzel', label: 'Tüzel' },
  { value: 'yabanci', label: 'Yabancı' },
];

/** Sabit hat / GSM — 850 885 11 60 */
export function formatContactPhone(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

export function normalizeContactPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}
