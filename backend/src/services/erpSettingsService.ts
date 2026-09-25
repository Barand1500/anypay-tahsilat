import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type PublicErpSettings = {
  active: boolean;
  apiUrl: string;
  apiSecret: string;
  apiSecretSet: boolean;
  server: string;
  database: string;
  username: string;
  password: string;
  passwordSet: boolean;
  company: string;
  period: string;
  branch: string;
  warehouse: string;
  cashRegister: string;
  inventory: boolean;
};

type ErpRow = {
  id: number;
  server: string;
  veritabani: string;
  kullaniciadi: string;
  password: string;
  api_url: string | null;
  api_secret: string | null;
  firma: string | null;
  donem: string | null;
  sube: string | null;
  depo: string | null;
  kasa: string | null;
  durum: number | boolean | null;
  envanter: number | boolean | null;
};

function isOn(v: number | boolean | null | undefined): boolean {
  return v === true || v === 1;
}

function emptyPublic(): PublicErpSettings {
  return {
    active: false,
    apiUrl: '',
    apiSecret: '',
    apiSecretSet: false,
    server: '',
    database: '',
    username: '',
    password: '',
    passwordSet: false,
    company: '',
    period: '',
    branch: '',
    warehouse: '',
    cashRegister: '',
    inventory: false,
  };
}

function mapRow(r: ErpRow): PublicErpSettings {
  return {
    active: isOn(r.durum),
    apiUrl: r.api_url || '',
    apiSecret: '',
    apiSecretSet: Boolean(r.api_secret),
    server: r.server || '',
    database: r.veritabani || '',
    username: r.kullaniciadi || '',
    password: '',
    passwordSet: Boolean(r.password),
    company: r.firma || '',
    period: r.donem || '',
    branch: r.sube || '',
    warehouse: r.depo || '',
    cashRegister: r.kasa || '',
    inventory: isOn(r.envanter),
  };
}

async function readRow(): Promise<ErpRow | null> {
  const rows = await prisma.$queryRaw<ErpRow[]>`
    SELECT \`id\`, \`server\`, \`veritabani\`, \`kullaniciadi\`, \`password\`,
           \`api_url\`, \`api_secret\`, \`firma\`, \`donem\`, \`sube\`, \`depo\`, \`kasa\`,
           \`durum\`, \`envanter\`
    FROM \`erp_entegrasyon_bilgileri\`
    ORDER BY \`id\` ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getErpSettings(): Promise<PublicErpSettings> {
  const row = await readRow();
  return row ? mapRow(row) : emptyPublic();
}

export async function updateErpSettings(input: {
  active: boolean;
  apiUrl: string;
  apiSecret?: string;
  server: string;
  database: string;
  username: string;
  password?: string;
  company: string;
  period: string;
  branch: string;
  warehouse: string;
  cashRegister: string;
  inventory: boolean;
}): Promise<PublicErpSettings> {
  const prev = await readRow();

  const apiUrl = input.apiUrl.trim();
  const server = input.server.trim();
  const database = input.database.trim();
  const username = input.username.trim();
  const company = input.company.trim();
  const period = input.period.trim();
  const branch = input.branch.trim();
  const warehouse = input.warehouse.trim();
  const cashRegister = input.cashRegister.trim();

  const nextPass = (input.password ?? '').trim() || prev?.password || '';
  const nextSecret = (input.apiSecret ?? '').trim() || prev?.api_secret || '';

  if (input.active) {
    if (!apiUrl) throw new SettingsError('API URL gerekli');
    if (!server) throw new SettingsError('Sunucu gerekli');
    if (!database) throw new SettingsError('Veritabanı gerekli');
    if (!username) throw new SettingsError('Kullanıcı adı gerekli');
    if (!nextPass) throw new SettingsError('Şifre gerekli');
  }

  const durum = input.active ? 1 : 0;
  const envanter = input.inventory ? 1 : 0;

  if (prev) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`erp_entegrasyon_bilgileri\` SET
        \`server\` = ?, \`veritabani\` = ?, \`kullaniciadi\` = ?, \`password\` = ?,
        \`api_url\` = ?, \`api_secret\` = ?,
        \`firma\` = ?, \`donem\` = ?, \`sube\` = ?, \`depo\` = ?, \`kasa\` = ?,
        \`durum\` = ?, \`envanter\` = ?
       WHERE \`id\` = ?`,
      server.slice(0, 255),
      database.slice(0, 255),
      username.slice(0, 255),
      nextPass.slice(0, 255),
      apiUrl.slice(0, 255) || null,
      nextSecret ? nextSecret.slice(0, 255) : null,
      company.slice(0, 255) || null,
      period.slice(0, 255) || null,
      branch.slice(0, 255) || null,
      warehouse.slice(0, 255) || null,
      cashRegister.slice(0, 255) || null,
      durum,
      envanter,
      prev.id,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`erp_entegrasyon_bilgileri\`
        (\`server\`, \`veritabani\`, \`kullaniciadi\`, \`password\`,
         \`api_url\`, \`api_secret\`, \`firma\`, \`donem\`, \`sube\`, \`depo\`, \`kasa\`,
         \`durum\`, \`envanter\`, \`parametre_durum\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N;')`,
      server.slice(0, 255),
      database.slice(0, 255),
      username.slice(0, 255),
      nextPass.slice(0, 255),
      apiUrl.slice(0, 255) || null,
      nextSecret ? nextSecret.slice(0, 255) : null,
      company.slice(0, 255) || null,
      period.slice(0, 255) || null,
      branch.slice(0, 255) || null,
      warehouse.slice(0, 255) || null,
      cashRegister.slice(0, 255) || null,
      durum,
      envanter,
    );
  }

  return getErpSettings();
}

export async function clearErpSettings(): Promise<PublicErpSettings> {
  const prev = await readRow();
  if (prev) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`erp_entegrasyon_bilgileri\` SET
        \`server\` = '', \`veritabani\` = '', \`kullaniciadi\` = '', \`password\` = '',
        \`api_url\` = '', \`api_secret\` = NULL,
        \`firma\` = NULL, \`donem\` = NULL, \`sube\` = NULL, \`depo\` = NULL, \`kasa\` = NULL,
        \`durum\` = 0, \`envanter\` = 0, \`parametre_durum\` = 'N;'
       WHERE \`id\` = ?`,
      prev.id,
    );
  }
  return getErpSettings();
}
