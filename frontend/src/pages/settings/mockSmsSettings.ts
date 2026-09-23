/** Ayarlar › SMS — mock sağlayıcı + ayarlar + şablonlar */

export type SmsProvider = {
  id: string;
  name: string;
  /** PHP gönderim kodu */
  code: string;
  /** Virgülle ayrılmış değişken adları */
  variables: string[];
};

export type SmsSettings = {
  providerId: string;
  username: string;
  password: string;
  title: string;
  active: boolean;
};

export type SmsTemplate = {
  id: string;
  typeKey: string;
  name: string;
  body: string;
};

export const INITIAL_SMS_PROVIDERS: SmsProvider[] = [
  {
    id: 'sp-1',
    name: 'MutluCell',
    code: `<?php
// MutluCell örnek
$url = 'https://api.mutlucell.com/send';
$params = [
  'user' => '#kullanıcı adı#',
  'pass' => '#şifre#',
  'from' => '#başlık#',
  'to'   => '#numara#',
  'msg'  => '#sms_icerigi#',
];
`,
    variables: ['kullanıcı adı', 'şifre', 'başlık'],
  },
  {
    id: 'sp-2',
    name: 'NetGsm',
    code: `<?php
// NetGsm örnek
$url = 'https://api.netgsm.com.tr/sms/send/get';
$params = [
  'usercode'  => '#kullanıcı adı#',
  'password'  => '#şifre#',
  'msgheader' => '#başlık#',
  'gsmno'     => '#numara#',
  'message'   => '#sms_icerigi#',
];
`,
    variables: ['kullanıcı adı', 'şifre', 'başlık'],
  },
];

export const INITIAL_SMS_SETTINGS: SmsSettings = {
  providerId: 'sp-2',
  username: '8508851160',
  password: '••••••••••',
  title: 'ERCAN GUZEL',
  active: true,
};

export const SMS_TEMPLATE_TYPE_OPTIONS = [
  { value: '2fa', label: '2 Faktörlü Doğrulama', vars: ['{{adsoyad}}', '{{kod}}'] },
  { value: 'collect-ok', label: 'Başarılı Tahsilat', vars: ['{{adsoyad}}', '{{tutar}}', '{{referans}}'] },
  { value: 'collect-fail', label: 'Hatalı Tahsilat', vars: ['{{adsoyad}}', '{{tutar}}', '{{hata}}'] },
  { value: 'user-edit', label: 'Kullanıcı Düzenleme', vars: ['{{adsoyad}}', '{{sifre}}'] },
  { value: 'user-add', label: 'Kullanıcı Ekleme', vars: ['{{adsoyad}}', '{{sifre}}'] },
  { value: 'payment-request', label: 'Ödeme İsteği Gönderme', vars: ['{{adsoyad}}', '{{tutar}}', '{{link}}'] },
  { value: 'send-password', label: 'Şifre Gönder', vars: ['{{adsoyad}}', '{{sifre}}'] },
  { value: 'app-verify', label: 'Uygulama Kullanıcı Doğrulama', vars: ['{{firma}}', '{{kod}}'] },
  { value: 'forgot-password', label: 'Şifremi Unuttum', vars: ['{{adsoyad}}', '{{kod}}'] },
] as const;

export type SmsTemplateTypeKey = (typeof SMS_TEMPLATE_TYPE_OPTIONS)[number]['value'];

export const INITIAL_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'st-1',
    typeKey: '2fa',
    name: '2 Faktörlü Doğrulama',
    body: '{{adsoyad}}, dogrulama kodunuz: {{kod}}',
  },
  {
    id: 'st-2',
    typeKey: 'collect-ok',
    name: 'Başarılı Tahsilat',
    body: '{{adsoyad}}, {{tutar}} tutarindaki tahsilatiniz basarili. Ref: {{referans}}',
  },
  {
    id: 'st-3',
    typeKey: 'collect-fail',
    name: 'Hatalı Tahsilat',
    body: '{{adsoyad}}, {{tutar}} tutarindaki islem basarisiz: {{hata}}',
  },
  {
    id: 'st-4',
    typeKey: 'user-edit',
    name: 'Kullanıcı Düzenleme',
    body: '{{adsoyad}}, hesap bilgileriniz guncellendi.',
  },
  {
    id: 'st-5',
    typeKey: 'user-add',
    name: 'Kullanıcı Ekleme',
    body: '{{adsoyad}}, hesabiniz olusturuldu. Sifre: {{sifre}}',
  },
  {
    id: 'st-6',
    typeKey: 'payment-request',
    name: 'Ödeme İsteği Gönderme',
    body: '{{adsoyad}}, {{tutar}} tutarinda odeme istegi: {{link}}',
  },
  {
    id: 'st-7',
    typeKey: 'send-password',
    name: 'Şifre Gönder',
    body: '{{adsoyad}}, yeni sifreniz: {{sifre}}',
  },
  {
    id: 'st-8',
    typeKey: 'app-verify',
    name: 'Uygulama Kullanıcı Doğrulama',
    body: '{{firma}} dogrulama kodu: {{kod}}',
  },
];

export function smsTemplateTypeMeta(typeKey: string) {
  return SMS_TEMPLATE_TYPE_OPTIONS.find((o) => o.value === typeKey) ?? null;
}

export function parseProviderVariables(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
