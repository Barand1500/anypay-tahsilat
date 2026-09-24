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
};

export type UpdateGeneralInput = {
  systemName: string;
  systemUrl: string;
  virtualPosTarget: boolean;
  appSignup: boolean;
  notifyEmails: string[];
  notifyPhones: string[];
  binListUrl: string;
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

async function getRow() {
  const row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
  if (!row) throw new SettingsError('Ayarlar kaydı bulunamadı');
  return row;
}

export async function getGeneralSettings(): Promise<PublicGeneralSettings> {
  const row = await getRow();
  return {
    systemName: row.sistemAdi,
    systemUrl: row.sistemYolu,
    logoUrl: assetUrl(row.logo, '/brand/logo.png'),
    faviconUrl: assetUrl(row.favicon, '/brand/logo-icon.png'),
    virtualPosTarget: Boolean(row.sanalposHedefKullanimi),
    appSignup: Boolean(row.uygulamaKayit),
    notifyEmails: splitList(row.bildirimEpostalar),
    notifyPhones: splitList(row.bildirimSmsler),
    binListUrl: row.binListLink || '',
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
      dbTarih: new Date(),
    },
  });

  return getGeneralSettings();
}
