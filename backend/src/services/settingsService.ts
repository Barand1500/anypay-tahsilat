import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Kalıcı yüklemeler — deploy rebuild public’i silse de burada kalır */
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export type PublicGeneralSettings = {
  systemName: string;
  systemUrl: string;
  logoUrl: string;
  faviconUrl: string;
  virtualPosTarget: boolean;
  appSignup: boolean;
  notifyEmails: string[];
  notifyPhones: string[];
  binListUrl: string;
  quickAccess: QuickAccessSettings;
};

export type QuickAccessSettings = { enabled: boolean; slotCount: number };

function parseQuickAccessSettings(raw: string | null): QuickAccessSettings {
  const fallback = { enabled: true, slotCount: 4 };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<QuickAccessSettings>;
    return {
      enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
      slotCount: Number.isInteger(parsed?.slotCount) && Number(parsed.slotCount) >= 3 && Number(parsed.slotCount) <= 7
        ? Number(parsed.slotCount)
        : fallback.slotCount,
    };
  } catch {
    return fallback;
  }
}

export type UpdateGeneralInput = {
  systemName: string;
  systemUrl: string;
  virtualPosTarget: boolean;
  appSignup: boolean;
  notifyEmails: string[];
  notifyPhones: string[];
  binListUrl: string;
  quickAccess: QuickAccessSettings;
  /** data:image/...;base64,... — yoksa logo değişmez */
  logoDataUrl?: string | null;
  faviconDataUrl?: string | null;
};

export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsError';
  }
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(list: string[]): string {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].join(',');
}

function assetUrl(stored: string, fallback: string): string {
  const file = stored.replace(/^\/+/, '');
  if (!file) return fallback;
  // Eski PHP yolları: sistem/logo.webp → /uploads/sistem/logo.webp
  if (file.startsWith('sistem/')) return `/uploads/${file}`;
  if (file.startsWith('uploads/')) return `/${file}`;
  if (file.startsWith('brand/')) return `/${file}`;
  if (file.startsWith('/')) return file;
  return `/uploads/${file}`;
}

function withCacheBust(url: string, bust: number): string {
  if (!bust) return url;
  return url.includes('?') ? `${url}&v=${bust}` : `${url}?v=${bust}`;
}

function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml));base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) throw new SettingsError('Geçersiz görsel formatı (PNG, JPEG, WebP, GIF, SVG)');
  const mime = m[2].toLowerCase();
  const ext =
    mime === 'jpeg' || mime === 'jpg'
      ? 'jpg'
      : mime === 'svg+xml'
        ? 'svg'
        : mime;
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 4 * 1024 * 1024) {
    throw new SettingsError('Görsel en fazla 4 MB olabilir');
  }
  if (buffer.length < 32) throw new SettingsError('Görsel dosyası boş veya bozuk');
  return { ext, buffer };
}

async function saveBrandAsset(kind: 'logo' | 'favicon', dataUrl: string): Promise<string> {
  const { ext, buffer } = parseDataUrl(dataUrl);
  const dir = path.join(UPLOADS_ROOT, 'sistem');
  await fs.mkdir(dir, { recursive: true });
  const filename = `${kind}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `sistem/${filename}`;
}

export async function getOrCreateAyarlarRow() {
  let row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
  if (!row) {
    try {
      row = await prisma.ayarlar.create({
        data: {
          sistemAdi: '',
          sistemYolu: '',
          logo: '',
          favicon: '',
          sistemPosta: '',
        },
      });
    } catch {
      // Aynı anda açılan ayar isteklerinden biri kaydı oluşturmuş olabilir.
      row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
      if (!row) throw new SettingsError('Ayarlar kaydı oluşturulamadı');
    }
  }
  return row;
}

async function getRow() {
  return getOrCreateAyarlarRow();
}

export async function getQuickAccessSettings(): Promise<QuickAccessSettings> {
  const row = await getRow();
  return parseQuickAccessSettings(row.hizliErisimAyarlari);
}

export async function getGeneralSettings(): Promise<PublicGeneralSettings> {
  const row = await getRow();
  const bust = row.dbTarih?.getTime() ?? Date.now();
  return {
    systemName: row.sistemAdi,
    systemUrl: row.sistemYolu,
    logoUrl: withCacheBust(assetUrl(row.logo, '/brand/logo-full.png'), bust),
    faviconUrl: withCacheBust(assetUrl(row.favicon, '/brand/logo-icon.png'), bust),
    virtualPosTarget: Boolean(row.sanalposHedefKullanimi),
    appSignup: Boolean(row.uygulamaKayit),
    notifyEmails: splitList(row.bildirimEpostalar),
    notifyPhones: splitList(row.bildirimSmsler),
    binListUrl: row.binListLink || '',
    quickAccess: parseQuickAccessSettings(row.hizliErisimAyarlari),
  };
}

/** Giriş / favicon — auth gerektirmez */
export async function getBrandAssets(): Promise<{
  systemName: string;
  logoUrl: string;
  faviconUrl: string;
}> {
  const g = await getGeneralSettings();
  return {
    systemName: g.systemName,
    logoUrl: g.logoUrl,
    faviconUrl: g.faviconUrl,
  };
}

export async function updateGeneralSettings(
  input: UpdateGeneralInput,
): Promise<PublicGeneralSettings> {
  const row = await getRow();

  const systemName = input.systemName.trim();
  const systemUrl = input.systemUrl.trim();
  if (!systemName) throw new SettingsError('Sistem adı gerekli');
  if (!systemUrl) throw new SettingsError('Sistem adresi gerekli');
  if (!Number.isInteger(input.quickAccess.slotCount) || input.quickAccess.slotCount < 3 || input.quickAccess.slotCount > 7) {
    throw new SettingsError('Hızlı erişim yuva sayısı 3 ile 7 arasında olmalı');
  }

  let logo = row.logo;
  let favicon = row.favicon;
  if (input.logoDataUrl) logo = await saveBrandAsset('logo', input.logoDataUrl);
  if (input.faviconDataUrl) favicon = await saveBrandAsset('favicon', input.faviconDataUrl);

  await prisma.ayarlar.update({
    where: { id: row.id },
    data: {
      sistemAdi: systemName.slice(0, 255),
      sistemYolu: systemUrl.slice(0, 255),
      logo,
      favicon,
      sanalposHedefKullanimi: input.virtualPosTarget,
      uygulamaKayit: input.appSignup,
      bildirimEpostalar: joinList(input.notifyEmails),
      bildirimSmsler: joinList(input.notifyPhones),
      binListLink: input.binListUrl.trim().slice(0, 255) || null,
      hizliErisimAyarlari: JSON.stringify(input.quickAccess),
      dbTarih: new Date(),
    },
  });

  return getGeneralSettings();
}

export type ContactEntityKind = 'gercek' | 'tuzel' | 'yabanci';

export type PublicContactSettings = {
  title: string;
  kind: ContactEntityKind;
  taxNo: string;
  taxOfficeId: number | null;
  taxOffice: string;
  identityNo: string;
  address: string;
  email: string;
  phone: string;
  gsm: string;
  fax: string;
  taxOffices: { value: string; label: string }[];
};

export type UpdateContactInput = {
  title: string;
  kind: ContactEntityKind;
  taxNo: string;
  taxOfficeId: number | null;
  identityNo: string;
  address: string;
  email: string;
  phone: string;
  gsm: string;
  fax: string;
};

function tipFromKind(kind: ContactEntityKind): number {
  if (kind === 'tuzel') return 1;
  if (kind === 'yabanci') return 2;
  return 0;
}

function kindFromTip(tip: number | null | undefined): ContactEntityKind {
  if (tip === 1) return 'tuzel';
  if (tip === 2) return 'yabanci';
  return 'gercek';
}

function digitsOnly(raw: string | null | undefined, max = 20): string {
  return (raw || '').replace(/\D/g, '').slice(0, max);
}

async function listTaxOffices() {
  const rows = await prisma.vergiDairesi.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function getContactSettings(): Promise<PublicContactSettings> {
  const [row, taxOffices] = await Promise.all([
    prisma.iletisimBilgileri.findFirst({ orderBy: { id: 'asc' } }),
    listTaxOffices(),
  ]);
  if (!row) {
    return {
      title: '',
      kind: 'gercek',
      taxNo: '',
      taxOfficeId: null,
      taxOffice: '',
      identityNo: '',
      address: '',
      email: '',
      phone: '',
      gsm: '',
      fax: '',
      taxOffices,
    };
  }
  const kind = kindFromTip(row.tip);
  const vn = (row.vn || '').trim();
  let taxOffice = '';
  if (row.vdId != null) {
    const hit = taxOffices.find((t) => t.value === String(row.vdId));
    taxOffice = hit?.label || '';
    if (!taxOffice) {
      const vd = await prisma.vergiDairesi.findFirst({
        where: { id: row.vdId },
        select: { adi: true },
      });
      taxOffice = vd?.adi || '';
    }
  }

  return {
    title: (row.unvan || '').trim(),
    kind,
    taxNo: kind === 'tuzel' ? digitsOnly(vn, 10) : '',
    taxOfficeId: row.vdId,
    taxOffice,
    identityNo: kind === 'tuzel' ? '' : vn,
    address: row.adres || '',
    email: (row.eposta || '').trim().toLowerCase(),
    phone: digitsOnly(row.telefon, 10),
    gsm: digitsOnly(row.gsm, 10),
    fax: digitsOnly(row.fax, 10),
    taxOffices,
  };
}

export async function updateContactSettings(
  input: UpdateContactInput,
): Promise<PublicContactSettings> {
  const row = await prisma.iletisimBilgileri.findFirst({ orderBy: { id: 'asc' } });
  const title = input.title.trim();
  const address = input.address.trim();
  const email = input.email.trim().toLowerCase();
  const phone = digitsOnly(input.phone, 10);

  if (!title) throw new SettingsError(input.kind === 'tuzel' ? 'Ünvan gerekli' : 'Ad soyad gerekli');
  if (!address) throw new SettingsError('Adres gerekli');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SettingsError('Geçerli e-posta girin');
  }
  if (phone.length < 10) throw new SettingsError('Telefon gerekli');

  let vn: string | null = null;
  let vdId: number | null = null;

  if (input.kind === 'tuzel') {
    const taxNo = digitsOnly(input.taxNo, 10);
    if (taxNo && taxNo.length !== 10) throw new SettingsError('Vergi numarası 10 hane olmalı');
    vn = taxNo || null;
    if (input.taxOfficeId != null) {
      const vd = await prisma.vergiDairesi.findFirst({
        where: {
          id: input.taxOfficeId,
          OR: [{ remove: null }, { remove: false }],
        },
        select: { id: true },
      });
      if (!vd) throw new SettingsError('Vergi dairesi bulunamadı');
      vdId = vd.id;
    }
  } else {
    const identity = input.identityNo.trim();
    if (input.kind === 'gercek' && identity && !/^\d{11}$/.test(identity)) {
      throw new SettingsError('TC kimlik no 11 hane olmalı');
    }
    vn = identity.slice(0, 20) || null;
  }

  const data = {
    unvan: title.slice(0, 255),
    tip: tipFromKind(input.kind),
    vn,
    vdId,
    adres: address,
    eposta: email.slice(0, 255),
    telefon: phone,
    gsm: digitsOnly(input.gsm, 10) || null,
    fax: digitsOnly(input.fax, 10) || null,
  };
  if (row) {
    await prisma.iletisimBilgileri.update({ where: { id: row.id }, data });
  } else {
    await prisma.iletisimBilgileri.create({ data });
  }

  return getContactSettings();
}

