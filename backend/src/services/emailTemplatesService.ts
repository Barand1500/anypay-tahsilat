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

/** Tablo yoksa oluştur — her API çağrısında güvenli */
export async function ensureEpostaSablonTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`eposta_sablonlari\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`tip\` VARCHAR(64) NOT NULL,
      \`adi\` VARCHAR(255) NOT NULL,
      \`konu\` VARCHAR(255) NOT NULL,
      \`icerik\` LONGTEXT NOT NULL,
      \`remove\` TINYINT(1) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`eposta_sablonlari_tip_key\` (\`tip\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

export async function seedEmailTemplatesIfEmpty(): Promise<void> {
  await ensureEpostaSablonTable();

  const countRows = await prisma.$queryRaw<{ c: bigint | number }[]>`
    SELECT COUNT(*) AS c FROM \`eposta_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
  `;
  const count = Number(countRows[0]?.c ?? 0);
  if (count > 0) return;

  for (const s of SEED) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`eposta_sablonlari\` (\`tip\`, \`adi\`, \`konu\`, \`icerik\`, \`remove\`)
       VALUES (?, ?, ?, ?, 0)`,
      s.tip,
      s.adi,
      s.konu,
      s.icerik,
    );
  }
  console.log('[schema] eposta_sablonlari seed eklendi');
}

export async function listEmailTemplates(): Promise<PublicEmailTemplate[]> {
  await ensureEpostaSablonTable();
  await seedEmailTemplatesIfEmpty();

  const rows = await prisma.$queryRaw<
    { id: number; tip: string; adi: string; konu: string; icerik: string }[]
  >`
    SELECT \`id\`, \`tip\`, \`adi\`, \`konu\`, \`icerik\`
    FROM \`eposta_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map(mapRow);
}

export async function getEmailTemplateByType(
  typeKey: string,
): Promise<PublicEmailTemplate | null> {
  await ensureEpostaSablonTable();
  await seedEmailTemplatesIfEmpty();
  const rows = await prisma.$queryRaw<
    { id: number; tip: string; adi: string; konu: string; icerik: string }[]
  >`
    SELECT \`id\`, \`tip\`, \`adi\`, \`konu\`, \`icerik\`
    FROM \`eposta_sablonlari\`
    WHERE \`tip\` = ${typeKey}
      AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function createEmailTemplate(input: {
  typeKey: string;
  subject: string;
  body: string;
}): Promise<PublicEmailTemplate> {
  await ensureEpostaSablonTable();

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
    throw new SettingsError('Bu şablon tipi kaydedilemedi');
  }
}

export async function updateEmailTemplate(
  id: number,
  input: { typeKey: string; subject: string; body: string },
): Promise<PublicEmailTemplate> {
  await ensureEpostaSablonTable();

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
  await ensureEpostaSablonTable();

  const existing = await prisma.epostaSablon.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Şablon bulunamadı');
  await prisma.epostaSablon.update({
    where: { id },
    data: {
      remove: true,
      tip: `${existing.tip}__del_${id}`.slice(0, 64),
    },
  });
}
