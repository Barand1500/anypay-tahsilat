import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type PublicEmailTemplate = {
  id: string;
  typeKey: string;
  name: string;
  subject: string;
  body: string;
};

const TYPE_LABELS: Record<string, string> = {
  'user-add': 'Kullanıcı Ekleme',
  'user-edit': 'Kullanıcı Düzenleme',
  'forgot-password': 'Şifremi Unuttum',
  'send-password': 'Şifre Gönder',
  dekont: 'Dekont Gönderme',
  'payment-request': 'Ödeme İsteği Gönderme',
  'collect-ok': 'Başarılı Tahsilat',
  'collect-fail': 'Hatalı Tahsilat',
  '2fa': '2 Faktörlü Doğrulama',
  'app-verify': 'Uygulama Kullanıcı Doğrulama',
};

const ALLOWED_TYPES = new Set(Object.keys(TYPE_LABELS));

const SEED: { tip: string; adi: string; konu: string; icerik: string }[] = [
  {
    tip: '2fa',
    adi: '2 Faktörlü Doğrulama',
    konu: 'Giriş Doğrulama Kodunuz',
    icerik: 'Merhaba {{adsoyad}},\n\nDoğrulama kodunuz: {{kod}}',
  },
  {
    tip: 'collect-ok',
    adi: 'Başarılı Tahsilat',
    konu: 'Başarılı Tahsilat',
    icerik:
      'Merhaba {{adsoyad}},\n\n{{tutar}} tutarındaki tahsilatınız başarılı. Ref: {{referans}}',
  },
  {
    tip: 'dekont',
    adi: 'Dekont Gönderme',
    konu: 'E-Dekont',
    icerik:
      'Merhaba {{adsoyad}},\n\n{{tarih}} tarihli {{tutar}} tutarındaki dekontunuz ektedir.',
  },
  {
    tip: 'collect-fail',
    adi: 'Hatalı Tahsilat',
    konu: 'Hatalı Tahsilat',
    icerik: 'Merhaba {{adsoyad}},\n\n{{tutar}} tutarındaki işlem başarısız: {{hata}}',
  },
  {
    tip: 'user-edit',
    adi: 'Kullanıcı Düzenleme',
    konu: 'Giriş Bilgileriniz Güncellendi',
    icerik: 'Merhaba {{adsoyad}},\n\nHesap bilgileriniz güncellendi. E-posta: {{email}}',
  },
  {
    tip: 'user-add',
    adi: 'Kullanıcı Ekleme',
    konu: 'Giriş Bilgileriniz',
    icerik:
      'Merhaba {{adsoyad}},\n\nHesabınız oluşturuldu.\nE-posta: {{email}}\nŞifre: {{sifre}}\n{{link}}',
  },
  {
    tip: 'payment-request',
    adi: 'Ödeme İsteği Gönderme',
    konu: 'Ödeme İsteği',
    icerik: 'Merhaba {{adsoyad}},\n\n{{tutar}} tutarında ödeme isteği: {{link}}',
  },
  {
    tip: 'send-password',
    adi: 'Şifre Gönder',
    konu: 'Yeni Şifreniz',
    icerik: 'Merhaba {{adsoyad}},\n\nYeni şifreniz: {{sifre}}',
  },
  {
    tip: 'forgot-password',
    adi: 'Şifremi Unuttum',
    konu: 'Şifre Yenileme Kodunuz',
    icerik: 'Merhaba {{adsoyad}},\n\nKodunuz: {{kod}}',
  },
  {
    tip: 'app-verify',
    adi: 'Uygulama Kullanıcı Doğrulama',
    konu: 'Firma bilgilerinizi doğrulayın',
    icerik: '{{firma}} için doğrulama: {{link}}',
  },
];

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapRow(r: {
  id: number;
  tip: string;
  adi: string;
  konu: string;
  icerik: string;
}): PublicEmailTemplate {
  return {
    id: String(r.id),
    typeKey: r.tip,
    name: r.adi,
    subject: r.konu,
    body: r.icerik,
  };
}

export async function seedEmailTemplatesIfEmpty(): Promise<void> {
  const count = await prisma.epostaSablon.count({ where: notRemoved() });
  if (count > 0) return;
  for (const s of SEED) {
    await prisma.epostaSablon.create({
      data: {
        tip: s.tip,
        adi: s.adi,
        konu: s.konu,
        icerik: s.icerik,
        remove: false,
      },
    });
  }
  console.log('[schema] eposta_sablonlari seed eklendi');
}

export async function listEmailTemplates(): Promise<PublicEmailTemplate[]> {
  await seedEmailTemplatesIfEmpty();
  const rows = await prisma.epostaSablon.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map(mapRow);
}

export async function getEmailTemplateByType(
  typeKey: string,
): Promise<PublicEmailTemplate | null> {
  await seedEmailTemplatesIfEmpty();
  const row = await prisma.epostaSablon.findFirst({
    where: { tip: typeKey, ...notRemoved() },
  });
  return row ? mapRow(row) : null;
}

export async function createEmailTemplate(input: {
  typeKey: string;
  subject: string;
  body: string;
}): Promise<PublicEmailTemplate> {
  const typeKey = input.typeKey.trim();
  if (!ALLOWED_TYPES.has(typeKey)) throw new SettingsError('Geçersiz şablon tipi');

  const active = await prisma.epostaSablon.findFirst({
    where: { tip: typeKey, ...notRemoved() },
  });
  if (active) throw new SettingsError('Bu şablon tipi zaten ekli');

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new SettingsError('Konu gerekli');
  if (!body) throw new SettingsError('İçerik gerekli');

  // Soft-silinmiş aynı tip varsa geri aç
  const soft = await prisma.epostaSablon.findFirst({
    where: { tip: typeKey, remove: true },
  });
  if (soft) {
    const row = await prisma.epostaSablon.update({
      where: { id: soft.id },
      data: {
        adi: TYPE_LABELS[typeKey] || typeKey,
        konu: subject.slice(0, 255),
        icerik: body,
        remove: false,
      },
    });
    return mapRow(row);
  }

  // Unique tip: silinmiş satır tip_eski#id olabilir; temiz create
  try {
    const row = await prisma.epostaSablon.create({
      data: {
        tip: typeKey,
        adi: TYPE_LABELS[typeKey] || typeKey,
        konu: subject.slice(0, 255),
        icerik: body,
        remove: false,
      },
    });
    return mapRow(row);
  } catch {
    // tip unique çakışması — soft silinmiş satırı bul (tip değişmiş olabilir)
    throw new SettingsError('Bu şablon tipi kaydedilemedi');
  }
}

export async function updateEmailTemplate(
  id: number,
  input: { typeKey: string; subject: string; body: string },
): Promise<PublicEmailTemplate> {
  const existing = await prisma.epostaSablon.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Şablon bulunamadı');

  const typeKey = input.typeKey.trim();
  if (!ALLOWED_TYPES.has(typeKey)) throw new SettingsError('Geçersiz şablon tipi');

  const clash = await prisma.epostaSablon.findFirst({
    where: { tip: typeKey, ...notRemoved(), NOT: { id } },
  });
  if (clash) throw new SettingsError('Bu şablon tipi zaten ekli');

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new SettingsError('Konu gerekli');
  if (!body) throw new SettingsError('İçerik gerekli');

  const row = await prisma.epostaSablon.update({
    where: { id },
    data: {
      tip: typeKey,
      adi: TYPE_LABELS[typeKey] || typeKey,
      konu: subject.slice(0, 255),
      icerik: body,
    },
  });
  return mapRow(row);
}

export async function softDeleteEmailTemplate(id: number): Promise<void> {
  const existing = await prisma.epostaSablon.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Şablon bulunamadı');
  // Unique tip serbest kalsın — tip’i serbestleştir
  await prisma.epostaSablon.update({
    where: { id },
    data: {
      remove: true,
      tip: `${existing.tip}__del_${id}`.slice(0, 64),
    },
  });
}
