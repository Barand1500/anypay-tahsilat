import { prisma } from '../lib/prisma.js';
import {
  phpSerializeAssoc,
  phpSerializeList,
  phpUnserializeAssoc,
  phpUnserializeList,
} from '../lib/phpSerialize.js';
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
  sablonId: string;
  typeKey: string;
  name: string;
  body: string;
};

export type SmsSablonOption = {
  id: string;
  name: string;
  used: boolean;
};

function digitsPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}

/* ─── Sağlayıcılar (sms_saglayicilari) ─── */

export async function listSmsProviders(): Promise<PublicSmsProvider[]> {
  const rows = await prisma.$queryRaw<
    { id: number; adi: string; code: string; degiskenler: string | null }[]
  >`
    SELECT \`id\`, \`adi\`, \`code\`, \`degiskenler\`
    FROM \`sms_saglayicilari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: r.adi,
    code: r.code,
    variables: phpUnserializeList(r.degiskenler),
  }));
}

export async function createSmsProvider(input: {
  name: string;
  code: string;
  variables?: string[];
}): Promise<PublicSmsProvider> {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new SettingsError('Sağlayıcı adı gerekli');
  if (!code) throw new SettingsError('Gönderim kodu gerekli');
  const vars = input.variables || [];

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`sms_saglayicilari\` (\`adi\`, \`code\`, \`degiskenler\`, \`remove\`)
     VALUES (?, ?, ?, 0)`,
    name.slice(0, 255),
    code,
    phpSerializeList(vars),
  );
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_saglayicilari\` ORDER BY \`id\` DESC LIMIT 1
  `;
  return {
    id: String(rows[0]!.id),
    name: name.slice(0, 255),
    code,
    variables: vars,
  };
}

export async function updateSmsProvider(
  id: number,
  input: { name: string; code: string; variables?: string[] },
): Promise<PublicSmsProvider> {
  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_saglayicilari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!existing[0]) throw new SettingsError('Sağlayıcı bulunamadı');

  const name = input.name.trim();
  const code = input.code.trim();
  if (!name) throw new SettingsError('Sağlayıcı adı gerekli');
  if (!code) throw new SettingsError('Gönderim kodu gerekli');
  const vars = input.variables || [];

  await prisma.$executeRawUnsafe(
    `UPDATE \`sms_saglayicilari\` SET \`adi\` = ?, \`code\` = ?, \`degiskenler\` = ? WHERE \`id\` = ?`,
    name.slice(0, 255),
    code,
    phpSerializeList(vars),
    id,
  );
  return { id: String(id), name: name.slice(0, 255), code, variables: vars };
}

export async function softDeleteSmsProvider(id: number): Promise<void> {
  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_saglayicilari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!existing[0]) throw new SettingsError('Sağlayıcı bulunamadı');
  await prisma.$executeRawUnsafe(
    `UPDATE \`sms_saglayicilari\` SET \`remove\` = 1 WHERE \`id\` = ?`,
    id,
  );
}

/* ─── Ayarlar (sms_ayarlari) ─── */

type StoredVars = {
  kullaniciadi?: string;
  sifre?: string;
  baslik?: string;
};

async function readSmsAyarRow(): Promise<{
  id: number;
  saglayici_id: number;
  degiskenler: string;
  status: number | boolean | null;
} | null> {
  const rows = await prisma.$queryRaw<
    {
      id: number;
      saglayici_id: number;
      degiskenler: string;
      status: number | boolean | null;
    }[]
  >`
    SELECT \`id\`, \`saglayici_id\`, \`degiskenler\`, \`status\`
    FROM \`sms_ayarlari\`
    ORDER BY \`id\` ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getSmsSettings(): Promise<PublicSmsSettings> {
  const providers = await listSmsProviders();
  const defaultProv = providers.find((p) => /netgsm/i.test(p.name))?.id || providers[0]?.id || '';
  const row = await readSmsAyarRow();
  if (!row) {
    return {
      providerId: defaultProv,
      username: '',
      password: '',
      passwordSet: false,
      title: '',
      active: true,
    };
  }
  const vars = phpUnserializeAssoc(row.degiskenler) as StoredVars;
  return {
    providerId: String(row.saglayici_id || defaultProv),
    username: vars.kullaniciadi || '',
    password: '',
    passwordSet: Boolean(vars.sifre),
    title: vars.baslik || '',
    active: row.status !== false && row.status !== 0 && row.status != null,
  };
}

export async function updateSmsSettings(input: {
  providerId: string;
  username: string;
  password?: string;
  title: string;
  active: boolean;
}): Promise<PublicSmsSettings> {
  const providerId = Number(input.providerId);
  if (!Number.isFinite(providerId)) throw new SettingsError('Sağlayıcı seçin');

  const prov = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_saglayicilari\`
    WHERE \`id\` = ${providerId} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!prov[0]) throw new SettingsError('Sağlayıcı bulunamadı');

  const username = input.username.trim();
  const title = input.title.trim();
  if (!username) throw new SettingsError('Kullanıcı adı gerekli');
  if (!title) throw new SettingsError('Başlık gerekli');

  const prev = await readSmsAyarRow();
  const prevVars = prev ? (phpUnserializeAssoc(prev.degiskenler) as StoredVars) : {};
  const nextPass = (input.password ?? '').trim() || prevVars.sifre || '';
  if (!nextPass) throw new SettingsError('Şifre gerekli');

  const vars: StoredVars = {
    kullaniciadi: username.slice(0, 255),
    sifre: nextPass,
    baslik: title.slice(0, 255),
  };
  const serialized = phpSerializeAssoc(vars as Record<string, string>);
  const status = input.active ? 1 : 0;

  if (prev) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`sms_ayarlari\` SET \`saglayici_id\` = ?, \`degiskenler\` = ?, \`status\` = ? WHERE \`id\` = ?`,
      providerId,
      serialized,
      status,
      prev.id,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`sms_ayarlari\` (\`saglayici_id\`, \`degiskenler\`, \`status\`) VALUES (?, ?, ?)`,
      providerId,
      serialized,
      status,
    );
  }

  return {
    providerId: String(providerId),
    username: vars.kullaniciadi!,
    password: '',
    passwordSet: true,
    title: vars.baslik!,
    active: Boolean(status),
  };
}

export async function clearSmsSettings(): Promise<PublicSmsSettings> {
  const prev = await readSmsAyarRow();
  if (prev) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`sms_ayarlari\` SET \`degiskenler\` = ?, \`status\` = 0 WHERE \`id\` = ?`,
      phpSerializeAssoc({ kullaniciadi: '', sifre: '', baslik: '' }),
      prev.id,
    );
  }
  return getSmsSettings();
}

/* ─── Şablonlar (sms_sablonlari + essablonlar tip=1) ─── */

export async function listSmsTemplates(): Promise<PublicSmsTemplate[]> {
  const rows = await prisma.$queryRaw<
    { id: number; sablon_id: number; icerik: string; adi: string | null }[]
  >`
    SELECT t.\`id\`, t.\`sablon_id\`, t.\`icerik\`, s.\`adi\`
    FROM \`sms_sablonlari\` t
    LEFT JOIN \`essablonlar\` s ON s.\`id\` = t.\`sablon_id\`
    WHERE t.\`remove\` IS NULL OR t.\`remove\` = 0
    ORDER BY COALESCE(s.\`adi\`, t.\`id\`) ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    sablonId: String(r.sablon_id),
    typeKey: String(r.sablon_id),
    name: r.adi || `Şablon #${r.sablon_id}`,
    body: r.icerik,
  }));
}

export async function listSmsSablonOptions(): Promise<SmsSablonOption[]> {
  const used = await prisma.$queryRaw<{ sablon_id: number }[]>`
    SELECT \`sablon_id\` FROM \`sms_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
  `;
  const usedSet = new Set(used.map((u) => u.sablon_id));
  const rows = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`essablonlar\`
    WHERE (\`remove\` IS NULL OR \`remove\` = 0) AND \`tip\` = 1
    ORDER BY \`adi\` ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: r.adi,
    used: usedSet.has(r.id),
  }));
}

export async function createSmsTemplate(input: {
  typeKey: string;
  body: string;
}): Promise<PublicSmsTemplate> {
  const sablonId = Number(input.typeKey);
  if (!Number.isFinite(sablonId)) throw new SettingsError('Geçersiz şablon');
  const body = input.body.trim();
  if (!body) throw new SettingsError('İçerik gerekli');

  const meta = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`essablonlar\`
    WHERE \`id\` = ${sablonId} AND \`tip\` = 1
      AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!meta[0]) throw new SettingsError('Şablon değişkeni bulunamadı (SMS)');

  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_sablonlari\`
    WHERE \`sablon_id\` = ${sablonId}
      AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (existing[0]) throw new SettingsError('Bu şablon zaten ekli');

  const soft = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_sablonlari\`
    WHERE \`sablon_id\` = ${sablonId} AND \`remove\` = 1
    LIMIT 1
  `;
  if (soft[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`sms_sablonlari\` SET \`icerik\` = ?, \`remove\` = 0 WHERE \`id\` = ?`,
      body,
      soft[0].id,
    );
    return {
      id: String(soft[0].id),
      sablonId: String(sablonId),
      typeKey: String(sablonId),
      name: meta[0].adi,
      body,
    };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`sms_sablonlari\` (\`sablon_id\`, \`icerik\`, \`info\`, \`remove\`)
     VALUES (?, ?, NULL, 0)`,
    sablonId,
    body,
  );
  const created = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_sablonlari\` WHERE \`sablon_id\` = ${sablonId}
    ORDER BY \`id\` DESC LIMIT 1
  `;
  return {
    id: String(created[0]!.id),
    sablonId: String(sablonId),
    typeKey: String(sablonId),
    name: meta[0].adi,
    body,
  };
}

export async function updateSmsTemplate(
  id: number,
  input: { typeKey: string; body: string },
): Promise<PublicSmsTemplate> {
  const rows = await prisma.$queryRaw<{ id: number; sablon_id: number }[]>`
    SELECT \`id\`, \`sablon_id\` FROM \`sms_sablonlari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!rows[0]) throw new SettingsError('Şablon bulunamadı');

  const nextSablon = Number(input.typeKey) || rows[0].sablon_id;
  const body = input.body.trim();
  if (!body) throw new SettingsError('İçerik gerekli');

  if (nextSablon !== rows[0].sablon_id) {
    const clash = await prisma.$queryRaw<{ id: number }[]>`
      SELECT \`id\` FROM \`sms_sablonlari\`
      WHERE \`sablon_id\` = ${nextSablon}
        AND (\`remove\` IS NULL OR \`remove\` = 0)
        AND \`id\` <> ${id}
      LIMIT 1
    `;
    if (clash[0]) throw new SettingsError('Bu şablon zaten ekli');
  }

  await prisma.$executeRawUnsafe(
    `UPDATE \`sms_sablonlari\` SET \`sablon_id\` = ?, \`icerik\` = ? WHERE \`id\` = ?`,
    nextSablon,
    body,
    id,
  );
  const meta = await prisma.$queryRaw<{ adi: string }[]>`
    SELECT \`adi\` FROM \`essablonlar\` WHERE \`id\` = ${nextSablon} LIMIT 1
  `;
  return {
    id: String(id),
    sablonId: String(nextSablon),
    typeKey: String(nextSablon),
    name: meta[0]?.adi || `Şablon #${nextSablon}`,
    body,
  };
}

export async function softDeleteSmsTemplate(id: number): Promise<void> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`sms_sablonlari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!rows[0]) throw new SettingsError('Şablon bulunamadı');
  await prisma.$executeRawUnsafe(
    `UPDATE \`sms_sablonlari\` SET \`remove\` = 1 WHERE \`id\` = ?`,
    id,
  );
}

/* ─── Gönderim ─── */

/** NetGSM / MutluCell — ortak SMS gönderimi */
export async function dispatchSms(
  phoneRaw: string,
  message: string,
): Promise<{ sent: true; to: string }> {
  const phone = digitsPhone(phoneRaw);
  if (phone.length < 10) throw new SettingsError('Geçerli bir telefon numarası girin');
  if (!message.trim()) throw new SettingsError('Mesaj boş olamaz');

  const row = await readSmsAyarRow();
  if (!row) throw new SettingsError('Önce SMS ayarlarını kaydedin');
  if (row.status === false || row.status === 0 || row.status == null) {
    throw new SettingsError('SMS gönderimi pasif');
  }

  const vars = phpUnserializeAssoc(row.degiskenler) as StoredVars;
  if (!vars.kullaniciadi || !vars.sifre || !vars.baslik) {
    throw new SettingsError('Önce SMS ayarlarını kaydedin');
  }

  const prov = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`sms_saglayicilari\`
    WHERE \`id\` = ${row.saglayici_id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!prov[0]) throw new SettingsError('Sağlayıcı bulunamadı');

  const name = prov[0].adi.toLocaleLowerCase('tr');
  const text = message.trim().slice(0, 900);

  if (name.includes('netgsm')) {
    const url = new URL('https://api.netgsm.com.tr/sms/send/get');
    url.searchParams.set('usercode', vars.kullaniciadi);
    url.searchParams.set('password', vars.sifre);
    url.searchParams.set('gsmno', phone.startsWith('90') ? phone : `90${phone}`);
    url.searchParams.set('message', text);
    url.searchParams.set('msgheader', vars.baslik);
    // Türkçe karakter desteği (₺ yine de kapıda sorun çıkarır — mesajda TL kullan)
    url.searchParams.set('dil', 'TR');
    const res = await fetch(url.toString());
    const body = (await res.text()).trim();
    const code = body.split(/\s+/)[0] || '';
    if (code !== '00') throw new SettingsError(`NetGSM yanıtı: ${body.slice(0, 120)}`);
  } else if (name.includes('mutlucell') || name.includes('mutlu')) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><smspack ka="${vars.kullaniciadi}" pwd="${vars.sifre}" org="${vars.baslik}" charset="turkish"><mesaj><metin>${escapeXml(text)}</metin><nums>0${phone.slice(-10)}</nums></mesaj></smspack>`;
    const res = await fetch('https://smsgw.mutlucell.com/smsgw-ws/sndblkex', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml,
    });
    const body = (await res.text()).trim();
    if (!res.ok) throw new SettingsError(`MutluCell hata: ${body.slice(0, 120)}`);
  } else {
    throw new SettingsError(`“${prov[0].adi}” için otomatik gönderim yok — NetGsm / MutluCell seçin`);
  }

  return { sent: true, to: phone };
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendSmsTest(phoneRaw: string): Promise<{ sent: true; to: string }> {
  const message = `AnyPay Tahsilat SMS sinama. ${new Date().toLocaleString('tr-TR')}`;
  const result = await dispatchSms(phoneRaw, message);
  try {
    await prisma.gonderimGecmisi.create({
      data: {
        musteriId: null,
        tip: 'sms',
        alici: result.to,
        icerik: message,
        tarih: new Date(),
        kaynak: 'sms-test',
        refId: null,
        basarili: true,
      },
    });
  } catch {
    /* opsiyonel */
  }
  return result;
}

export async function bootstrapSms(): Promise<void> {
  /* gerçek tablolar dump’ta — ekstra CREATE yok */
}

export async function ensureSmsTables(): Promise<void> {
  /* no-op */
}
