/** Ayarlar › SMS — tipler / şablon meta */

export type SmsProvider = {
  id: string;
  name: string;
  /** PHP gönderim kodu */
  code: string;
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

export function smsTemplateTypeMeta(typeKey: string) {
  return SMS_TEMPLATE_TYPE_OPTIONS.find((o) => o.value === typeKey) ?? null;
}

export function parseProviderVariables(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
