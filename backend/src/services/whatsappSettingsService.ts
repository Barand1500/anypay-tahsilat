import { prisma } from '../lib/prisma.js';
import { getGeneralSettings, getOrCreateAyarlarRow, SettingsError } from './settingsService.js';

export type PublicWhatsappSettings = {
  active: boolean;
  appId: string;
  appSecret: string;
  appSecretSet: boolean;
  phoneNumberId: string;
  accessToken: string;
  accessTokenSet: boolean;
  verifyToken: string;
  verifyTokenSet: boolean;
  /** Meta paneline yapıştırılacak callback URL */
  callbackUrl: string;
};

type StoredWhatsapp = {
  active: boolean;
  appId: string;
  appSecret: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
};

function emptyPublic(callbackUrl: string): PublicWhatsappSettings {
  return {
    active: false,
    appId: '',
    appSecret: '',
    appSecretSet: false,
    phoneNumberId: '',
    accessToken: '',
    accessTokenSet: false,
    verifyToken: '',
    verifyTokenSet: false,
    callbackUrl,
  };
}

function parseStored(raw: string | null | undefined): StoredWhatsapp | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredWhatsapp>;
    return {
      active: Boolean(p.active),
      appId: typeof p.appId === 'string' ? p.appId.trim() : '',
      appSecret: typeof p.appSecret === 'string' ? p.appSecret : '',
      phoneNumberId: typeof p.phoneNumberId === 'string' ? p.phoneNumberId.trim() : '',
      accessToken: typeof p.accessToken === 'string' ? p.accessToken : '',
      verifyToken: typeof p.verifyToken === 'string' ? p.verifyToken : '',
    };
  } catch {
    return null;
  }
}

async function buildCallbackUrl(): Promise<string> {
  const envBase = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (envBase) return `${envBase}/api/webhooks/whatsapp`;
  try {
    const g = await getGeneralSettings();
    const base = (g.systemUrl || '').replace(/\/$/, '');
    if (base) return `${base}/api/webhooks/whatsapp`;
  } catch {
    /* yoksa sabit */
  }
  return 'https://tahsilat.anypay.com.tr/api/webhooks/whatsapp';
}

function toPublic(stored: StoredWhatsapp | null, callbackUrl: string): PublicWhatsappSettings {
  if (!stored) return emptyPublic(callbackUrl);
  return {
    active: stored.active,
    appId: stored.appId,
    appSecret: '',
    appSecretSet: Boolean(stored.appSecret),
    phoneNumberId: stored.phoneNumberId,
    accessToken: '',
    accessTokenSet: Boolean(stored.accessToken),
    verifyToken: '',
    verifyTokenSet: Boolean(stored.verifyToken),
    callbackUrl,
  };
}

export async function getWhatsappSettings(): Promise<PublicWhatsappSettings> {
  const row = await getOrCreateAyarlarRow();
  const callbackUrl = await buildCallbackUrl();
  return toPublic(parseStored(row.whatsappAyarlar), callbackUrl);
}

/** Gönderim için tam config — aktif + zorunlu alanlar dolu olmalı */
export async function resolveWhatsappConfig(): Promise<StoredWhatsapp | null> {
  const row = await getOrCreateAyarlarRow();
  const stored = parseStored(row.whatsappAyarlar);
  if (!stored?.active) return null;
  if (!stored.phoneNumberId || !stored.accessToken) return null;
  return stored;
}

export async function isWhatsappIntegrationActive(): Promise<boolean> {
  return (await resolveWhatsappConfig()) != null;
}

/** Webhook verify — saklı token ile karşılaştır */
export async function getWhatsappVerifyToken(): Promise<string | null> {
  const row = await getOrCreateAyarlarRow();
  const stored = parseStored(row.whatsappAyarlar);
  const t = (stored?.verifyToken || '').trim();
  return t || null;
}

export async function updateWhatsappSettings(input: {
  active: boolean;
  appId: string;
  appSecret?: string;
  phoneNumberId: string;
  accessToken?: string;
  verifyToken?: string;
}): Promise<PublicWhatsappSettings> {
  const appId = input.appId.trim();
  const phoneNumberId = input.phoneNumberId.trim();
  if (input.active) {
    if (!appId) throw new SettingsError('Meta uygulama kimliği gerekli');
    if (!phoneNumberId) throw new SettingsError('Telefon numarası kimliği gerekli');
  }

  const row = await getOrCreateAyarlarRow();
  const prev = parseStored(row.whatsappAyarlar);

  const nextSecret = (input.appSecret ?? '').trim();
  const nextAccess = (input.accessToken ?? '').trim();
  const nextVerify = (input.verifyToken ?? '').trim();

  const appSecret = nextSecret || prev?.appSecret || '';
  const accessToken = nextAccess || prev?.accessToken || '';
  const verifyToken = nextVerify || prev?.verifyToken || '';

  if (input.active) {
    if (!appSecret) throw new SettingsError('Uygulama gizli anahtarı gerekli');
    if (!accessToken) throw new SettingsError('Erişim belirteci gerekli');
    if (!verifyToken) throw new SettingsError('Webhook doğrulama belirteci gerekli');
  }

  const stored: StoredWhatsapp = {
    active: Boolean(input.active),
    appId: appId.slice(0, 64),
    appSecret,
    phoneNumberId: phoneNumberId.slice(0, 64),
    accessToken,
    verifyToken,
  };

  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { whatsappAyarlar: JSON.stringify(stored) },
  });

  return toPublic(stored, await buildCallbackUrl());
}

export async function clearWhatsappSettings(): Promise<PublicWhatsappSettings> {
  const row = await getOrCreateAyarlarRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { whatsappAyarlar: null },
  });
  return emptyPublic(await buildCallbackUrl());
}

/** TR numarayı Meta’nın beklediği E.164 ( + olmadan ) hale getir */
export function normalizeWhatsappTo(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `90${d}`;
  return d;
}

/**
 * Meta Cloud API — metin mesajı.
 * Not: işletme başlatımlı sohbetlerde şablon gerekebilir; Meta hata dönerse yüzeye çıkarılır.
 */
export async function sendWhatsappText(
  toRaw: string,
  body: string,
): Promise<{ to: string }> {
  const cfg = await resolveWhatsappConfig();
  if (!cfg) {
    throw new SettingsError(
      'WhatsApp entegrasyonu kapalı veya eksik — Ayarlar › WhatsApp sayfasından etkinleştirin',
    );
  }
  const to = normalizeWhatsappTo(toRaw);
  if (!to || to.length < 10) throw new SettingsError('Geçerli telefon numarası yok');
  const text = (body || '').trim();
  if (!text) throw new SettingsError('Mesaj metni boş');

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text.slice(0, 4096) },
    }),
  });

  const raw = await res.text();
  let parsed: { error?: { message?: string }; messages?: unknown[] } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    /* düz metin */
  }

  if (!res.ok) {
    const msg =
      parsed.error?.message ||
      (raw.trim().slice(0, 240) || `Meta API hatası (${res.status})`);
    throw new SettingsError(msg);
  }

  return { to };
}
