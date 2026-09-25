import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type PublicAppDefaults = {
  loginTheme: 'classic' | 'globe';
  panelTheme: 'light' | 'dark';
  landingPath: string;
  payType: 'ch' | 'fatura';
  /** Para birimi id (string) veya eski kısa kod */
  currency: string;
  /** Cari tipi adı (boş = belirtilmemiş) */
  accountType: string;
  customerKind: 'gercek' | 'tuzel' | 'yabanci';
  virtualPos: 'bank' | 'external';
  /** Vergi dairesi adı (boş = belirtilmemiş) */
  taxOffice: string;
  country: string;
  displayMode: 'window' | 'fullscreen';
  filterOpen: Record<string, boolean>;
};

const FILTER_KEYS = [
  'hareketler',
  'odeme-istekleri',
  'istatistikler',
  'tahsilat-raporu',
  'musteri-tahsilat',
  'kart-tahsilat',
  'banka-tahsilat',
  'gonderim-gecmisi',
] as const;

const LANDING_ALLOWED = new Set([
  '/',
  '/musteriler',
  '/hareketler',
  '/odeme-istekleri',
  '/raporlar/istatistikler',
  '/hizli-odeme',
]);

function defaultFilterOpen(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of FILTER_KEYS) out[k] = true;
  return out;
}

export function defaultAppDefaults(): PublicAppDefaults {
  return {
    loginTheme: 'classic',
    panelTheme: 'light',
    landingPath: '/',
    payType: 'ch',
    currency: '',
    accountType: '',
    customerKind: 'gercek',
    virtualPos: 'bank',
    taxOffice: '',
    country: 'TR',
    displayMode: 'window',
    filterOpen: defaultFilterOpen(),
  };
}

function normalizeFilterOpen(raw: unknown): Record<string, boolean> {
  const base = defaultFilterOpen();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const k of FILTER_KEYS) {
    if (typeof obj[k] === 'boolean') base[k] = obj[k];
  }
  return base;
}

export function normalizeDefaults(raw: unknown): PublicAppDefaults {
  const base = defaultAppDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<PublicAppDefaults> & { filterOpen?: unknown };

  const loginTheme = p.loginTheme === 'globe' ? 'globe' : 'classic';
  const panelTheme = p.panelTheme === 'dark' ? 'dark' : 'light';
  const payType = p.payType === 'fatura' ? 'fatura' : 'ch';
  const customerKind =
    p.customerKind === 'tuzel' || p.customerKind === 'yabanci' ? p.customerKind : 'gercek';
  const virtualPos = p.virtualPos === 'external' ? 'external' : 'bank';
  const displayMode = p.displayMode === 'fullscreen' ? 'fullscreen' : 'window';
  const landingPath =
    typeof p.landingPath === 'string' && LANDING_ALLOWED.has(p.landingPath)
      ? p.landingPath
      : '/';

  return {
    loginTheme,
    panelTheme,
    landingPath,
    payType,
    currency: typeof p.currency === 'string' ? p.currency.slice(0, 64) : '',
    accountType: typeof p.accountType === 'string' ? p.accountType.slice(0, 255) : '',
    customerKind,
    virtualPos,
    taxOffice: typeof p.taxOffice === 'string' ? p.taxOffice.slice(0, 255) : '',
    country: typeof p.country === 'string' && p.country.trim() ? p.country.slice(0, 8) : 'TR',
    displayMode,
    filterOpen: normalizeFilterOpen(p.filterOpen),
  };
}

async function getRow() {
  const row = await prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } });
  if (!row) throw new SettingsError('Ayarlar kaydı bulunamadı');
  return row;
}

export async function getAppDefaultsSettings(): Promise<PublicAppDefaults> {
  const row = await getRow();
  const raw = row.varsayilanlar;
  if (!raw?.trim()) return defaultAppDefaults();
  try {
    return normalizeDefaults(JSON.parse(raw) as unknown);
  } catch {
    return defaultAppDefaults();
  }
}

export async function updateAppDefaultsSettings(
  input: unknown,
): Promise<PublicAppDefaults> {
  const cleaned = normalizeDefaults(input);
  const row = await getRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { varsayilanlar: JSON.stringify(cleaned) },
  });
  return cleaned;
}
