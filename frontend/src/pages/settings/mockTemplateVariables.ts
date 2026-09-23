/** Ayarlar › Şablon Değişkenleri — mock */

export type TemplateVarType = 'email' | 'sms';

export type TemplateVarPair = {
  /** DB sütun adı */
  dbColumn: string;
  /** Şablonda kullanılan anahtar (#adsoyad# → adsoyad) */
  key: string;
};

export type TemplateVariableSet = {
  id: string;
  /** Liste ID (gösterim) */
  displayId: number;
  name: string;
  module: string;
  type: TemplateVarType;
  variables: TemplateVarPair[];
};

export const TEMPLATE_VAR_TYPE_OPTIONS = [
  { value: 'email', label: 'E-Posta' },
  { value: 'sms', label: 'SMS' },
] as const;

export const TEMPLATE_VAR_MODULE_OPTIONS = [
  { value: 'Kullanıcılar', label: 'Kullanıcılar' },
  { value: 'Roller', label: 'Roller' },
  { value: 'Modüller', label: 'Modüller' },
  { value: 'Genel Ayarlar', label: 'Genel Ayarlar' },
  { value: 'SMTP Ayarları', label: 'SMTP Ayarları' },
  { value: 'Hızlı Ödeme', label: 'Hızlı Ödeme' },
  { value: 'Ödeme İstekleri', label: 'Ödeme İstekleri' },
  { value: 'Hareketler', label: 'Hareketler' },
  { value: 'Müşteriler', label: 'Müşteriler' },
  { value: 'Özet', label: 'Özet' },
] as const;

export function formatTemplateVarKey(key: string) {
  const k = key.replace(/^#+|#+$/g, '').trim();
  return k ? `#${k}#` : '';
}

export function normalizeTemplateVarKey(raw: string) {
  return raw.replace(/^#+|#+$/g, '').trim().toLocaleLowerCase('tr');
}

function vars(...pairs: [string, string][]): TemplateVarPair[] {
  return pairs.map(([dbColumn, key]) => ({ dbColumn, key }));
}

export const INITIAL_TEMPLATE_VARIABLES: TemplateVariableSet[] = [
  {
    id: 'tv-1',
    displayId: 1,
    name: 'Kullanıcı Ekleme',
    module: 'Kullanıcılar',
    type: 'email',
    variables: vars(
      ['AdSoyad', 'adsoyad'],
      ['Eposta', 'eposta'],
      ['Sifre', 'sifre'],
      ['Link', 'link'],
    ),
  },
  {
    id: 'tv-2',
    displayId: 2,
    name: 'Kullanıcı Düzenleme',
    module: 'Kullanıcılar',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Eposta', 'eposta']),
  },
  {
    id: 'tv-3',
    displayId: 3,
    name: 'Şifremi Unuttum',
    module: 'Kullanıcılar',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Kod', 'kod']),
  },
  {
    id: 'tv-4',
    displayId: 4,
    name: 'Şifre Gönder',
    module: 'Kullanıcılar',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Sifre', 'sifre']),
  },
  {
    id: 'tv-5',
    displayId: 5,
    name: '2 Faktörlü Doğrulama',
    module: 'Kullanıcılar',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Kod', 'kod']),
  },
  {
    id: 'tv-6',
    displayId: 68,
    name: 'Başarılı Tahsilat',
    module: 'Hızlı Ödeme',
    type: 'email',
    variables: vars(
      ['AdSoyad', 'adsoyad'],
      ['Tutar', 'tutar'],
      ['Referans', 'referans'],
      ['Tarih', 'tarih'],
      ['Kart', 'kart'],
      ['Banka', 'banka'],
    ),
  },
  {
    id: 'tv-7',
    displayId: 69,
    name: 'Hatalı Tahsilat',
    module: 'Hızlı Ödeme',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Tutar', 'tutar'], ['Hata', 'hata']),
  },
  {
    id: 'tv-8',
    displayId: 70,
    name: 'Ödeme İsteği Gönderme',
    module: 'Ödeme İstekleri',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Tutar', 'tutar'], ['Link', 'link']),
  },
  {
    id: 'tv-9',
    displayId: 71,
    name: 'Dekont Gönderme',
    module: 'Hareketler',
    type: 'email',
    variables: vars(['AdSoyad', 'adsoyad'], ['Tutar', 'tutar'], ['Tarih', 'tarih']),
  },
  {
    id: 'tv-10',
    displayId: 80,
    name: '2 Faktörlü Doğrulama',
    module: 'Kullanıcılar',
    type: 'sms',
    variables: vars(['AdSoyad', 'adsoyad'], ['Kod', 'kod']),
  },
  {
    id: 'tv-11',
    displayId: 81,
    name: 'Başarılı Tahsilat',
    module: 'Hızlı Ödeme',
    type: 'sms',
    variables: vars(['AdSoyad', 'adsoyad'], ['Tutar', 'tutar'], ['Referans', 'referans']),
  },
  {
    id: 'tv-12',
    displayId: 82,
    name: 'Ödeme İsteği Gönderme',
    module: 'Ödeme İstekleri',
    type: 'sms',
    variables: vars(['AdSoyad', 'adsoyad'], ['Tutar', 'tutar'], ['Link', 'link']),
  },
];

export function templateVarTypeLabel(type: TemplateVarType) {
  return type === 'email' ? 'E-Posta' : 'Sms';
}
