import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

/* ─── Tipler ─── */

export type PublicSmsProvider = {
  id: string;
  name: string;
  code: string;
  variables: string[];
};

export type PublicSmsSettings = {
  providerId: string;
  username: string;
  password: string;
  passwordSet: boolean;
  title: string;
  active: boolean;
};

export type PublicSmsTemplate = {
  id: string;
  typeKey: string;
  name: string;
  body: string;
};

const TPL_LABELS: Record<string, string> = {
  '2fa': '2 Faktörlü Doğrulama',
  'collect-ok': 'Başarılı Tahsilat',
  'collect-fail': 'Hatalı Tahsilat',
  'user-edit': 'Kullanıcı Düzenleme',
  'user-add': 'Kullanıcı Ekleme',
  'payment-request': 'Ödeme İsteği Gönderme',
  'send-password': 'Şifre Gönder',
  'app-verify': 'Uygulama Kullanıcı Doğrulama',
  'forgot-password': 'Şifremi Unuttum',
};

const ALLOWED_TPL = new Set(Object.keys(TPL_LABELS));

const PROVIDER_SEED: { adi: string; kod: string; degiskenler: string }[] = [
  {
    adi: 'MutluCell',
    kod: `<?php
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
    degiskenler: 'kullanıcı adı,şifre,başlık',
  },
  {
    adi: 'NetGsm',
    kod: `<?php
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
    degiskenler: 'kullanıcı adı,şifre,başlık',
  },
];

const TPL_SEED: { tip: string; adi: string; icerik: string }[] = [
  {
    tip: '2fa',
    adi: '2 Faktörlü Doğrulama',
    icerik: '{{adsoyad}}, dogrulama kodunuz: {{kod}}',
  },
  {
    tip: 'collect-ok',
    adi: 'Başarılı Tahsilat',
    icerik: '{{adsoyad}}, {{tutar}} tutarindaki tahsilatiniz basarili. Ref: {{referans}}',
  },
  {
    tip: 'collect-fail',
    adi: 'Hatalı Tahsilat',
    icerik: '{{adsoyad}}, {{tutar}} tutarindaki islem basarisiz: {{hata}}',
  },
  {
    tip: 'user-edit',
    adi: 'Kullanıcı Düzenleme',
    icerik: '{{adsoyad}}, hesap bilgileriniz guncellendi.',
  },
  {
    tip: 'user-add',
    adi: 'Kullanıcı Ekleme',
    icerik: '{{adsoyad}}, hesabiniz olusturuldu. Sifre: {{sifre}}',
  },
  {
    tip: 'payment-request',
    adi: 'Ödeme İsteği Gönderme',
    icerik: '{{adsoyad}}, {{tutar}} tutarinda odeme istegi: {{link}}',
  },
  {
    tip: 'send-password',
    adi: 'Şifre Gönder',
    icerik: '{{adsoyad}}, yeni sifreniz: {{sifre}}',
  },
  {
    tip: 'app-verify',
    adi: 'Uygulama Kullanıcı Doğrulama',
    icerik: '{{firma}} dogrulama kodu: {{kod}}',
  },
  {
    tip: 'forgot-password',
    adi: 'Şifremi Unuttum',
    icerik: '{{adsoyad}}, sifre yenileme kodunuz: {{kod}}',
  },
];

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function parseVars(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function encodeVars(list: string[]): string {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].join(',');
}

function digitsPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}

/* ─── Tablo self-heal ─── */

export async function ensureSmsTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`sms_saglayicilar\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`adi\` VARCHAR(255) NOT NULL,
      \`kod\` LONGTEXT NOT NULL,
      \`degiskenler\` LONGTEXT NULL,
      \`remove\` TINYINT(1) NULL,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`sms_sablonlari\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`tip\` VARCHAR(64) NOT NULL,
      \`adi\` VARCHAR(255) NOT NULL,
      \`icerik\` LONGTEXT NOT NULL,
      \`remove\` TINYINT(1) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`sms_sablonlari_tip_key\` (\`tip\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  try {
    const cols = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'sms_ayarlar'
      LIMIT 1
    `;
    if (!cols[0]) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE `ayarlar` ADD COLUMN `sms_ayarlar` LONGTEXT NULL',
      );
      console.log('[schema] ayarlar.sms_ayarlar eklendi');
    }
  } catch (err) {
    console.warn('[schema] sms_ayarlar:', err);
  }
}

async function seedProvidersIfEmpty(): Promise<void> {
  const rows = await prisma.$queryRaw<{ c: bigint | number }[]>`
    SELECT COUNT(*) AS c FROM \`sms_saglayicilar\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
  `;
  if (Number(rows[0]?.c ?? 0) > 0) return;
  for (const s of PROVIDER_SEED) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`sms_saglayicilar\` (\`adi\`, \`kod\`, \`degiskenler\`, \`remove\`)
       VALUES (?, ?, ?, 0)`,
      s.adi,
      s.kod,
      s.degiskenler,
    );
  }
  console.log('[schema] sms_saglayicilar seed');
}

async function seedTemplatesIfEmpty(): Promise<void> {
  const rows = await prisma.$queryRaw<{ c: bigint | number }[]>`
    SELECT COUNT(*) AS c FROM \`sms_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
  `;
  if (Number(rows[0]?.c ?? 0) > 0) return;
  for (const s of TPL_SEED) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`sms_sablonlari\` (\`tip\`, \`adi\`, \`icerik\`, \`remove\`)
       VALUES (?, ?, ?, 0)`,
      s.tip,
      s.adi,
      s.icerik,
    );
  }
  console.log('[schema] sms_sablonlari seed');
}

export async function bootstrapSms(): Promise<void> {
  await ensureSmsTables();
  await seedProvidersIfEmpty();
  await seedTemplatesIfEmpty();
}

/* ─── Sağlayıcılar ─── */

function mapProvider(r: {
  id: number;
  adi: string;
  kod: string;
  degiskenler: string | null;
}): PublicSmsProvider {
  return {
    id: String(r.id),
    name: r.adi,
    code: r.kod,
    variables: parseVars(r.degiskenler),
  };
}

export async function listSmsProviders(): Promise<PublicSmsProvider[]> {
  await bootstrapSms();
  const rows = await prisma.$queryRaw<
    { id: number; adi: string; kod: string; degiskenler: string | null }[]
  >`
    SELECT \`id\`, \`adi\`, \`kod\`, \`degiskenler\`
    FROM \`sms_saglayicilar\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map(mapProvider);
}

export async function createSmsProvider(input: {
  name: string;
  code: string;
  variables?: string[];
}): Promise<PublicSmsProvider> {
  await bootstrapSms();
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new SettingsError('Sağlayıcı adı gerekli');
  if (!code) throw new SettingsError('Gönderim kodu gerekli');

  try {
    const row = await prisma.smsSaglayici.create({
      data: {
        adi: name.slice(0, 255),
        kod: code,
        degiskenler: encodeVars(input.variables || []) || null,
        remove: false,
      },
    });
    return mapProvider(row);
  } catch {
    throw new SettingsError('Sağlayıcı eklenemedi');
  }
}

export async function updateSmsProvider(
  id: number,
  input: { name: string; code: string; variables?: string[] },
): Promise<PublicSmsProvider> {
  await bootstrapSms();
  const existing = await prisma.smsSaglayici.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Sağlayıcı bulunamadı');

  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new SettingsError('Sağlayıcı adı gerekli');
  if (!code) throw new SettingsError('Gönderim kodu gerekli');

  const row = await prisma.smsSaglayici.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      kod: code,
      degiskenler: encodeVars(input.variables || []) || null,
    },
  });
  return mapProvider(row);
}

export async function softDeleteSmsProvider(id: number): Promise<void> {
  await bootstrapSms();
  const existing = await prisma.smsSaglayici.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new SettingsError('Sağlayıcı bulunamadı');
  await prisma.smsSaglayici.update({
    where: { id },
    data: { remove: true },
  });
}

/* ─── Ayarlar (JSON in ayarlar) ─── */

type StoredSms = {
  providerId: string;
  username: string;
  password: string;
  title: string;
  active: boolean;
};

async function getAyarlarRow() {
  const row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
  if (!row) throw new SettingsError('Ayarlar kaydı bulunamadı');
  return row;
}

function parseSmsJson(raw: string | null | undefined): StoredSms | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredSms>;
    return {
      providerId: typeof p.providerId === 'string' ? p.providerId : '',
      username: typeof p.username === 'string' ? p.username : '',
      password: typeof p.password === 'string' ? p.password : '',
      title: typeof p.title === 'string' ? p.title : '',
      active: p.active !== false,
    };
  } catch {
    return null;
  }
}

export async function getSmsSettings(): Promise<PublicSmsSettings> {
  await bootstrapSms();
  const row = await getAyarlarRow();
  const stored = parseSmsJson(row.smsAyarlar);
  const providers = await listSmsProviders();
  const defaultProv = providers.find((p) => /netgsm/i.test(p.name))?.id || providers[0]?.id || '';

  if (!stored) {
    return {
      providerId: defaultProv,
      username: '',
      password: '',
      passwordSet: false,
      title: '',
      active: true,
    };
  }

  return {
    providerId: stored.providerId || defaultProv,
    username: stored.username,
    password: '',
    passwordSet: Boolean(stored.password),
    title: stored.title,
    active: stored.active,
  };
}

export async function updateSmsSettings(input: {
  providerId: string;
  username: string;
  password?: string;
  title: string;
  active: boolean;
}): Promise<PublicSmsSettings> {
  await bootstrapSms();
  const row = await getAyarlarRow();
  const prev = parseSmsJson(row.smsAyarlar);

  const providerId = String(input.providerId || '').trim();
  const username = input.username.trim();
  const title = input.title.trim();
  const nextPass = (input.password ?? '').trim();
  const password = nextPass || prev?.password || '';

  if (!providerId) throw new SettingsError('Sağlayıcı seçin');
  const prov = await prisma.smsSaglayici.findFirst({
    where: { id: Number(providerId), ...notRemoved() },
  });
  if (!prov) throw new SettingsError('Sağlayıcı bulunamadı');
  if (!username) throw new SettingsError('Kullanıcı adı gerekli');
  if (!password) throw new SettingsError('Şifre gerekli');
  if (!title) throw new SettingsError('Başlık gerekli');

  const stored: StoredSms = {
    providerId,
    username: username.slice(0, 255),
    password,
    title: title.slice(0, 255),
    active: Boolean(input.active),
  };

  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { smsAyarlar: JSON.stringify(stored) },
  });

  return {
    providerId: stored.providerId,
    username: stored.username,
    password: '',
    passwordSet: true,
    title: stored.title,
    active: stored.active,
  };
}

export async function clearSmsSettings(): Promise<PublicSmsSettings> {
  await bootstrapSms();
  const row = await getAyarlarRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { smsAyarlar: null },
  });
  return getSmsSettings();
}

/* ─── Şablonlar ─── */

function mapTpl(r: { id: number; tip: string; adi: string; icerik: string }): PublicSmsTemplate {
  return {
    id: String(r.id),
    typeKey: r.tip,
    name: r.adi,
    body: r.icerik,
  };
}

export async function listSmsTemplates(): Promise<PublicSmsTemplate[]> {
  await bootstrapSms();
  const rows = await prisma.$queryRaw<
    { id: number; tip: string; adi: string; icerik: string }[]
  >`
    SELECT \`id\`, \`tip\`, \`adi\`, \`icerik\`
    FROM \`sms_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map(mapTpl);
}

export async function createSmsTemplate(input: {
  typeKey: string;
  body: string;
}): Promise<PublicSmsTemplate> {
  await bootstrapSms();
  const typeKey = input.typeKey.trim();
  if (!ALLOWED_TPL.has(typeKey)) throw new SettingsError('Geçersiz şablon tipi');
  const body = input.body.trim();
  if (!body) throw new SettingsError('İçerik gerekli');

  const active = await prisma.smsSablon.findFirst({
    where: { tip: typeKey, ...notRemoved() },
  });
  if (active) throw new SettingsError('Bu şablon tipi zaten ekli');

  const soft = await prisma.smsSablon.findFirst({
    where: { tip: typeKey, remove: true },
  });
  if (soft) {
    const row = await prisma.smsSablon.update({
      where: { id: soft.id },
      data: {
        adi: TPL_LABELS[typeKey] || typeKey,
        icerik: body,
        remove: false,
      },
    });
    return mapTpl(row);
  }

  try {
    const row = await prisma.smsSablon.create({
      data: {
        tip: typeKey,
        adi: TPL_LABELS[typeKey] || typeKey,
        icerik: body,
        remove: false,
      },
    });
    return mapTpl(row);
  } catch {
    throw new SettingsError('Şablon kaydedilemedi');
  }
}

export async function updateSmsTemplate(
  id: number,
  input: { typeKey: string; body: string },
): Promise<PublicSmsTemplate> {
  await bootstrapSms();
  const existing = await prisma.smsSablon.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Şablon bulunamadı');

  const typeKey = input.typeKey.trim();
  if (!ALLOWED_TPL.has(typeKey)) throw new SettingsError('Geçersiz şablon tipi');
  const body = input.body.trim();
  if (!body) throw new SettingsError('İçerik gerekli');

  const clash = await prisma.smsSablon.findFirst({
    where: { tip: typeKey, ...notRemoved(), NOT: { id } },
  });
  if (clash) throw new SettingsError('Bu şablon tipi zaten ekli');

  const row = await prisma.smsSablon.update({
    where: { id },
    data: {
      tip: typeKey,
      adi: TPL_LABELS[typeKey] || typeKey,
      icerik: body,
    },
  });
  return mapTpl(row);
}

export async function softDeleteSmsTemplate(id: number): Promise<void> {
  await bootstrapSms();
  const existing = await prisma.smsSablon.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new SettingsError('Şablon bulunamadı');
  await prisma.smsSablon.update({
    where: { id },
    data: {
      remove: true,
      tip: `${existing.tip}__del_${id}`.slice(0, 64),
    },
  });
}

/* ─── Sınama gönderimi ─── */

export async function sendSmsTest(phoneRaw: string): Promise<{ sent: true; to: string }> {
  await bootstrapSms();
  const phone = digitsPhone(phoneRaw);
  if (phone.length < 10) throw new SettingsError('Geçerli bir telefon numarası girin');

  const row = await getAyarlarRow();
  const stored = parseSmsJson(row.smsAyarlar);
  if (!stored?.username || !stored.password || !stored.title) {
    throw new SettingsError('Önce SMS ayarlarını kaydedin');
  }
  if (!stored.active) throw new SettingsError('SMS gönderimi pasif');

  const provId = Number(stored.providerId);
  const prov = await prisma.smsSaglayici.findFirst({
    where: { id: provId, ...notRemoved() },
  });
  if (!prov) throw new SettingsError('Sağlayıcı bulunamadı');

  const message = `AnyPay Tahsilat SMS sinama. ${new Date().toLocaleString('tr-TR')}`;
  const name = prov.adi.toLocaleLowerCase('tr');

  if (name.includes('netgsm')) {
    const url = new URL('https://api.netgsm.com.tr/sms/send/get');
    url.searchParams.set('usercode', stored.username);
    url.searchParams.set('password', stored.password);
    url.searchParams.set('gsmno', phone.startsWith('90') ? phone : `90${phone}`);
    url.searchParams.set('message', message);
    url.searchParams.set('msgheader', stored.title);

    const res = await fetch(url.toString());
    const text = (await res.text()).trim();
    const code = text.split(/\s+/)[0] || '';
    if (code !== '00') {
      throw new SettingsError(`NetGSM yanıtı: ${text.slice(0, 120)}`);
    }
  } else if (name.includes('mutlucell') || name.includes('mutlu')) {
    const body = new URLSearchParams({
      ka: stored.username,
      pwd: stored.password,
      org: stored.title,
      numara: phone,
      mesaj: message,
    });
    const res = await fetch('https://smsgw.mutlucell.com/smsgw-ws/sndblkex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = (await res.text()).trim();
    if (!res.ok) throw new SettingsError(`MutluCell hata: ${text.slice(0, 120)}`);
  } else {
    throw new SettingsError(
      `“${prov.adi}” için otomatik sınama yok — NetGsm / MutluCell seçin veya ayarları kaydedin`,
    );
  }

  try {
    await prisma.gonderimGecmisi.create({
      data: {
        musteriId: null,
        tip: 'sms',
        alici: phone,
        icerik: message,
        tarih: new Date(),
        kaynak: 'sms-test',
        refId: null,
        basarili: true,
      },
    });
  } catch {
    /* geçmiş opsiyonel */
  }

  return { sent: true, to: phone };
}
