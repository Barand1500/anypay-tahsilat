/** Ayarlar › E-Posta — tipler / şablon meta */

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

/** Seçilebilir şablon tipleri (henüz eklenmemiş olanlar modalda görünür) */
export const EMAIL_TEMPLATE_TYPE_OPTIONS = [
  {
    value: 'user-add',
    label: 'Kullanıcı Ekleme',
    subject: 'Giriş Bilgileriniz',
    vars: ['{{adsoyad}}', '{{email}}', '{{sifre}}', '{{link}}'],
  },
  {
    value: 'user-edit',
    label: 'Kullanıcı Düzenleme',
    subject: 'Giriş Bilgileriniz Güncellendi',
    vars: ['{{adsoyad}}', '{{email}}'],
  },
  {
    value: 'forgot-password',
    label: 'Şifremi Unuttum',
    subject: 'Şifre Yenileme Kodunuz',
    vars: ['{{adsoyad}}', '{{kod}}'],
  },
  {
    value: 'send-password',
    label: 'Şifre Gönder',
    subject: 'Yeni Şifreniz',
    vars: ['{{adsoyad}}', '{{sifre}}'],
  },
  {
    value: 'dekont',
    label: 'Dekont Gönderme',
    subject: 'E-Dekont',
    vars: ['{{adsoyad}}', '{{tutar}}', '{{tarih}}'],
  },
  {
    value: 'payment-request',
    label: 'Ödeme İsteği Gönderme',
    subject: 'Ödeme İsteği',
    vars: ['{{adsoyad}}', '{{tutar}}', '{{link}}'],
  },
  {
    value: 'collect-ok',
    label: 'Başarılı Tahsilat',
    subject: 'Başarılı Tahsilat',
    vars: ['{{adsoyad}}', '{{tutar}}', '{{referans}}'],
  },
  {
    value: 'collect-fail',
    label: 'Hatalı Tahsilat',
    subject: 'Hatalı Tahsilat',
    vars: ['{{adsoyad}}', '{{tutar}}', '{{hata}}'],
  },
  {
    value: '2fa',
    label: '2 Faktörlü Doğrulama',
    subject: 'Giriş Doğrulama Kodunuz',
    vars: ['{{adsoyad}}', '{{kod}}'],
  },
  {
    value: 'app-verify',
    label: 'Uygulama Kullanıcı Doğrulama',
    subject: 'Firma bilgilerinizi doğrulayın',
    vars: ['{{firma}}', '{{link}}'],
  },
] as const;

export type EmailTemplateTypeKey = (typeof EMAIL_TEMPLATE_TYPE_OPTIONS)[number]['value'];

export function templateTypeMeta(typeKey: string) {
  return EMAIL_TEMPLATE_TYPE_OPTIONS.find((o) => o.value === typeKey) ?? null;
}
