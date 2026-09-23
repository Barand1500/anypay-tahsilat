/** Ayarlar › E-Posta — mock SMTP + şablonlar */

export type SmtpSettings = {
  host: string;
  port: string;
  email: string;
  password: string;
  ssl: boolean;
  tls: boolean;
};

export type EmailTemplate = {
  id: string;
  /** Şablon tipi anahtarı */
  typeKey: string;
  name: string;
  subject: string;
  body: string;
};

export const INITIAL_SMTP: SmtpSettings = {
  host: 'smtp.guzelteknoloji.com',
  port: '25',
  email: 'bilgi@guzelteknoloji.com',
  password: '••••••••••',
  ssl: false,
  tls: true,
};

/** Seçilebilir şablon tipleri (henüz eklenmemiş olanlar modalda görünür) */
export const EMAIL_TEMPLATE_TYPE_OPTIONS = [
  { value: 'user-add', label: 'Kullanıcı Ekleme', subject: 'Giriş Bilgileriniz', vars: ['{{adsoyad}}', '{{email}}', '{{sifre}}', '{{link}}'] },
  { value: 'user-edit', label: 'Kullanıcı Düzenleme', subject: 'Giriş Bilgileriniz Güncellendi', vars: ['{{adsoyad}}', '{{email}}'] },
  { value: 'forgot-password', label: 'Şifremi Unuttum', subject: 'Şifre Yenileme Kodunuz', vars: ['{{adsoyad}}', '{{kod}}'] },
  { value: 'send-password', label: 'Şifre Gönder', subject: 'Yeni Şifreniz', vars: ['{{adsoyad}}', '{{sifre}}'] },
  { value: 'dekont', label: 'Dekont Gönderme', subject: 'E-Dekont', vars: ['{{adsoyad}}', '{{tutar}}', '{{tarih}}'] },
  { value: 'payment-request', label: 'Ödeme İsteği Gönderme', subject: 'Ödeme İsteği', vars: ['{{adsoyad}}', '{{tutar}}', '{{link}}'] },
  { value: 'collect-ok', label: 'Başarılı Tahsilat', subject: 'Başarılı Tahsilat', vars: ['{{adsoyad}}', '{{tutar}}', '{{referans}}'] },
  { value: 'collect-fail', label: 'Hatalı Tahsilat', subject: 'Hatalı Tahsilat', vars: ['{{adsoyad}}', '{{tutar}}', '{{hata}}'] },
  { value: '2fa', label: '2 Faktörlü Doğrulama', subject: 'Giriş Doğrulama Kodunuz', vars: ['{{adsoyad}}', '{{kod}}'] },
  { value: 'app-verify', label: 'Uygulama Kullanıcı Doğrulama', subject: 'Firma bilgilerinizi doğrulayın', vars: ['{{firma}}', '{{link}}'] },
] as const;

export type EmailTemplateTypeKey = (typeof EMAIL_TEMPLATE_TYPE_OPTIONS)[number]['value'];

export const INITIAL_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'et-1',
    typeKey: '2fa',
    name: '2 Faktörlü Doğrulama',
    subject: 'Giriş Doğrulama Kodunuz',
    body: 'Merhaba {{adsoyad}},\n\nDoğrulama kodunuz: {{kod}}',
  },
  {
    id: 'et-2',
    typeKey: 'collect-ok',
    name: 'Başarılı Tahsilat',
    subject: 'Başarılı Tahsilat',
    body: 'Merhaba {{adsoyad}},\n\n{{tutar}} tutarındaki tahsilatınız başarılı. Ref: {{referans}}',
  },
  {
    id: 'et-3',
    typeKey: 'dekont',
    name: 'Dekont Gönderme',
    subject: 'E-Dekont',
    body: 'Merhaba {{adsoyad}},\n\n{{tarih}} tarihli {{tutar}} tutarındaki dekontunuz ektedir.',
  },
  {
    id: 'et-4',
    typeKey: 'collect-fail',
    name: 'Hatalı Tahsilat',
    subject: 'Hatalı Tahsilat',
    body: 'Merhaba {{adsoyad}},\n\n{{tutar}} tutarındaki işlem başarısız: {{hata}}',
  },
  {
    id: 'et-5',
    typeKey: 'user-edit',
    name: 'Kullanıcı Düzenleme',
    subject: 'Giriş Bilgileriniz Güncellendi',
    body: 'Merhaba {{adsoyad}},\n\nHesap bilgileriniz güncellendi. E-posta: {{email}}',
  },
  {
    id: 'et-6',
    typeKey: 'user-add',
    name: 'Kullanıcı Ekleme',
    subject: 'Giriş Bilgileriniz',
    body: 'Merhaba {{adsoyad}},\n\nHesabınız oluşturuldu.\nE-posta: {{email}}\nŞifre: {{sifre}}\n{{link}}',
  },
  {
    id: 'et-7',
    typeKey: 'payment-request',
    name: 'Ödeme İsteği Gönderme',
    subject: 'Ödeme İsteği',
    body: 'Merhaba {{adsoyad}},\n\n{{tutar}} tutarında ödeme isteği: {{link}}',
  },
  {
    id: 'et-8',
    typeKey: 'send-password',
    name: 'Şifre Gönder',
    subject: 'Yeni Şifreniz',
    body: 'Merhaba {{adsoyad}},\n\nYeni şifreniz: {{sifre}}',
  },
  {
    id: 'et-9',
    typeKey: 'forgot-password',
    name: 'Şifremi Unuttum',
    subject: 'Şifre Yenileme Kodunuz',
    body: 'Merhaba {{adsoyad}},\n\nKodunuz: {{kod}}',
  },
  {
    id: 'et-10',
    typeKey: 'app-verify',
    name: 'Uygulama Kullanıcı Doğrulama',
    subject: 'Firma bilgilerinizi doğrulayın',
    body: '{{firma}} için doğrulama: {{link}}',
  },
];

export function templateTypeMeta(typeKey: string) {
  return EMAIL_TEMPLATE_TYPE_OPTIONS.find((o) => o.value === typeKey) ?? null;
}
