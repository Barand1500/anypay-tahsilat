import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import {
  getOrCreateAyarlarRow,
  SettingsError,
  UPLOADS_ROOT,
} from './settingsService.js';

export type PaymentPageLayout = 'compact' | 'fullscreen';

export type PaymentPageBadge = {
  id: string;
  name: string;
  src: string;
  heightPx: number;
  active: boolean;
  sortOrder: number;
};

export type PaymentPageSettings = {
  layout: PaymentPageLayout;
  brandLogoHeightPx: number;
  badges: PaymentPageBadge[];
};

export type UpdatePaymentPageInput = {
  layout: PaymentPageLayout;
  brandLogoHeightPx: number;
  badges: Array<{
    id?: string;
    name: string;
    /** Mevcut URL veya data:image/... */
    src: string;
    heightPx: number;
    active: boolean;
    sortOrder?: number;
  }>;
};

const DEFAULT_BADGES: PaymentPageBadge[] = [
  { id: 'iyzico', name: 'iyzico', src: '/payments/iyzico.jpg', heightPx: 28, active: true, sortOrder: 0 },
  {
    id: 'mastercard',
    name: 'Mastercard',
    src: '/payments/mastercard.jpg',
    heightPx: 32,
    active: true,
    sortOrder: 1,
  },
  { id: 'visa', name: 'Visa', src: '/payments/visa.png', heightPx: 24, active: true, sortOrder: 2 },
  {
    id: 'amex',
    name: 'American Express',
    src: '/payments/amex.png',
    heightPx: 32,
    active: true,
    sortOrder: 3,
  },
  { id: 'troy', name: 'Troy', src: '/payments/troy.png', heightPx: 24, active: true, sortOrder: 4 },
];

const DEFAULT_SETTINGS: PaymentPageSettings = {
  layout: 'compact',
  brandLogoHeightPx: 40,
  badges: DEFAULT_BADGES,
};

function clampLogoHeight(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.brandLogoHeightPx;
  return Math.min(80, Math.max(24, Math.round(n)));
}

function clampBadgeHeight(n: number): number {
  if (!Number.isFinite(n)) return 28;
  return Math.min(56, Math.max(16, Math.round(n)));
}

function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml));base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) throw new SettingsError('Geçersiz görsel formatı (PNG, JPEG, WebP, GIF, SVG)');
  const mime = m[2].toLowerCase();
  const ext =
    mime === 'jpeg' || mime === 'jpg' ? 'jpg' : mime === 'svg+xml' ? 'svg' : mime;
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    throw new SettingsError('Rozet görseli en fazla 2 MB olabilir');
  }
  if (buffer.length < 32) throw new SettingsError('Görsel dosyası boş veya bozuk');
  return { ext, buffer };
}

async function saveBadgeAsset(id: string, dataUrl: string): Promise<string> {
  const { ext, buffer } = parseDataUrl(dataUrl);
  const dir = path.join(UPLOADS_ROOT, 'odeme-sayfa');
  await fs.mkdir(dir, { recursive: true });
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'badge';
  const filename = `${safeId}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/uploads/odeme-sayfa/${filename}`;
}

function normalizeSrc(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  if (s.startsWith('odeme-sayfa/')) return `/uploads/${s}`;
  return s;
}

function makeId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseStored(raw: string | null | undefined): PaymentPageSettings | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<PaymentPageSettings>;
    const layout: PaymentPageLayout = p.layout === 'fullscreen' ? 'fullscreen' : 'compact';
    const brandLogoHeightPx = clampLogoHeight(Number(p.brandLogoHeightPx));
    const badgesIn = Array.isArray(p.badges) ? p.badges : [];
    const badges: PaymentPageBadge[] = badgesIn
      .map((b, i) => {
        if (!b || typeof b !== 'object') return null;
        const name = typeof b.name === 'string' ? b.name.trim().slice(0, 64) : '';
        const src = typeof b.src === 'string' ? normalizeSrc(b.src) : '';
        if (!name || !src || src.startsWith('data:')) return null;
        return {
          id: typeof b.id === 'string' && b.id.trim() ? b.id.trim().slice(0, 64) : makeId(),
          name,
          src,
          heightPx: clampBadgeHeight(Number(b.heightPx)),
          active: b.active !== false,
          sortOrder: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : i,
        } satisfies PaymentPageBadge;
      })
      .filter((x): x is PaymentPageBadge => x != null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b, i) => ({ ...b, sortOrder: i }));

    return {
      layout,
      brandLogoHeightPx,
      badges: badges.length ? badges : DEFAULT_BADGES,
    };
  } catch {
    return null;
  }
}

export function getDefaultPaymentPageSettings(): PaymentPageSettings {
  return {
    layout: DEFAULT_SETTINGS.layout,
    brandLogoHeightPx: DEFAULT_SETTINGS.brandLogoHeightPx,
    badges: DEFAULT_BADGES.map((b) => ({ ...b })),
  };
}

export async function getPaymentPageSettings(): Promise<PaymentPageSettings> {
  const row = await getOrCreateAyarlarRow();
  return parseStored(row.odemeSayfaAyarlari) ?? getDefaultPaymentPageSettings();
}

/** Public ödeme sayfası — yalnızca aktif rozetler */
export async function getPublicPaymentPageSettings(): Promise<PaymentPageSettings> {
  const full = await getPaymentPageSettings();
  return {
    layout: full.layout,
    brandLogoHeightPx: full.brandLogoHeightPx,
    badges: full.badges.filter((b) => b.active),
  };
}

export async function updatePaymentPageSettings(
  input: UpdatePaymentPageInput,
): Promise<PaymentPageSettings> {
  const layout: PaymentPageLayout = input.layout === 'fullscreen' ? 'fullscreen' : 'compact';
  const brandLogoHeightPx = clampLogoHeight(input.brandLogoHeightPx);

  if (!Array.isArray(input.badges) || input.badges.length > 24) {
    throw new SettingsError('En fazla 24 ödeme logosu eklenebilir');
  }

  const badges: PaymentPageBadge[] = [];
  for (let i = 0; i < input.badges.length; i++) {
    const raw = input.badges[i]!;
    const name = (raw.name || '').trim().slice(0, 64);
    if (!name) throw new SettingsError(`Logo #${i + 1}: ad gerekli`);

    const id =
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim().slice(0, 64)
        : makeId();

    let src = normalizeSrc(raw.src || '');
    if (!src) throw new SettingsError(`"${name}" için görsel gerekli`);

    if (src.startsWith('data:')) {
      src = await saveBadgeAsset(id, src);
    }

    badges.push({
      id,
      name,
      src,
      heightPx: clampBadgeHeight(Number(raw.heightPx)),
      active: raw.active !== false,
      sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : i,
    });
  }

  badges.sort((a, b) => a.sortOrder - b.sortOrder);
  const normalized = badges.map((b, i) => ({ ...b, sortOrder: i }));

  const stored: PaymentPageSettings = {
    layout,
    brandLogoHeightPx,
    badges: normalized.length ? normalized : getDefaultPaymentPageSettings().badges,
  };

  const row = await getOrCreateAyarlarRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: {
      odemeSayfaAyarlari: JSON.stringify(stored),
      dbTarih: new Date(),
    },
  });

  return stored;
}
