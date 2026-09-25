import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type SmtpConfig = {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
  tls: boolean;
  from: string;
};

export type PublicSmtpSettings = {
  host: string;
  port: string;
  email: string;
  /** UI’da şifre alanı — boş bırakılırsa mevcut korunur */
  password: string;
  passwordSet: boolean;
  ssl: boolean;
  tls: boolean;
};

type StoredSmtp = {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
  tls: boolean;
  from?: string;
};

function emptyPublic(): PublicSmtpSettings {
  return {
    host: '',
    port: '587',
    email: '',
    password: '',
    passwordSet: false,
    ssl: false,
    tls: true,
  };
}

function fromEnvFallback(): StoredSmtp | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    email: user,
    password: pass,
    ssl: secure,
    tls: !secure,
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

function parseStored(raw: string | null | undefined): StoredSmtp | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredSmtp>;
    const host = typeof p.host === 'string' ? p.host.trim() : '';
    const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
    const password = typeof p.password === 'string' ? p.password : '';
    if (!host || !email) return null;
    const port = Number(p.port);
    return {
      host: host.slice(0, 255),
      port: Number.isFinite(port) && port > 0 ? port : 587,
      email: email.slice(0, 255),
      password,
      ssl: Boolean(p.ssl),
      tls: p.tls !== false,
      from: typeof p.from === 'string' && p.from.trim() ? p.from.trim().slice(0, 255) : email,
    };
  } catch {
    return null;
  }
}

async function getRow() {
  const row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
  if (!row) throw new SettingsError('Ayarlar kaydı bulunamadı');
  return row;
}

/** Gönderim için tam config — DB, yoksa .env */
export async function resolveSmtpConfig(): Promise<SmtpConfig> {
  const row = await getRow();
  const stored = parseStored(row.smtpAyarlar);
  const cfg = stored?.password ? stored : fromEnvFallback();
  if (!cfg?.host || !cfg.email || !cfg.password) {
    throw new SettingsError('SMTP ayarları eksik — E-Posta Ayarları sayfasından kaydedin');
  }
  return {
    host: cfg.host,
    port: cfg.port,
    email: cfg.email,
    password: cfg.password.replace(/\s+/g, ''),
    ssl: cfg.ssl || cfg.port === 465,
    tls: cfg.tls,
    from: (cfg.from || cfg.email).trim(),
  };
}

export async function getSmtpSettings(): Promise<PublicSmtpSettings> {
  const row = await getRow();
  let stored = parseStored(row.smtpAyarlar);

  // İlk açılış: DB boşsa .env’den doldurup kaydet (şifre panelde yönetilsin)
  if (!stored) {
    const env = fromEnvFallback();
    if (env) {
      await prisma.ayarlar.update({
        where: { id: row.id },
        data: { smtpAyarlar: JSON.stringify(env) },
      });
      stored = env;
    }
  }

  if (!stored) return emptyPublic();

  return {
    host: stored.host,
    port: String(stored.port),
    email: stored.email,
    password: '',
    passwordSet: Boolean(stored.password),
    ssl: stored.ssl,
    tls: stored.tls,
  };
}

export async function updateSmtpSettings(input: {
  host: string;
  port: string;
  email: string;
  password?: string;
  ssl: boolean;
  tls: boolean;
}): Promise<PublicSmtpSettings> {
  const host = input.host.trim();
  const email = input.email.trim().toLowerCase();
  const portNum = Number(String(input.port).replace(/\D/g, ''));
  if (!host) throw new SettingsError('E-posta sunucusu gerekli');
  if (!email || !email.includes('@')) throw new SettingsError('Geçerli e-posta adresi girin');
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
    throw new SettingsError('Geçerli bir port girin');
  }

  const row = await getRow();
  const prev = parseStored(row.smtpAyarlar);
  const nextPassRaw = (input.password ?? '').trim();
  const password = nextPassRaw
    ? nextPassRaw.replace(/\s+/g, '')
    : (prev?.password || '').replace(/\s+/g, '');

  if (!password) throw new SettingsError('E-posta şifresi gerekli');

  const stored: StoredSmtp = {
    host: host.slice(0, 255),
    port: portNum,
    email: email.slice(0, 255),
    password,
    ssl: Boolean(input.ssl),
    tls: Boolean(input.tls),
    from: email.slice(0, 255),
  };

  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { smtpAyarlar: JSON.stringify(stored) },
  });

  const { resetMailTransporter } = await import('../lib/mail.js');
  resetMailTransporter();

  return {
    host: stored.host,
    port: String(stored.port),
    email: stored.email,
    password: '',
    passwordSet: true,
    ssl: stored.ssl,
    tls: stored.tls,
  };
}

export async function clearSmtpSettings(): Promise<PublicSmtpSettings> {
  const row = await getRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { smtpAyarlar: null },
  });
  const { resetMailTransporter } = await import('../lib/mail.js');
  resetMailTransporter();
  return emptyPublic();
}
