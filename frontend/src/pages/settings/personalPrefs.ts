/** Kişisel ayarlar — tarayıcıya özel (localStorage) */

/* ── Font ─────────────────────────────────────────────── */

export type PanelFontId =
  | 'dm-sans'
  | 'plus-jakarta'
  | 'manrope'
  | 'outfit'
  | 'figtree'
  | 'space-grotesk';

export type PanelFontOption = {
  id: PanelFontId;
  label: string;
  family: string;
  sample: string;
};

export const PANEL_FONTS: PanelFontOption[] = [
  {
    id: 'dm-sans',
    label: 'DM Sans',
    family: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
  {
    id: 'manrope',
    label: 'Manrope',
    family: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
  {
    id: 'outfit',
    label: 'Outfit',
    family: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
  {
    id: 'figtree',
    label: 'Figtree',
    family: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    family: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    sample: 'Güzel Teknoloji · tahsilat paneli',
  },
];

const FONT_KEY = 'anypay_tahsilat_panel_font';
const DEFAULT_FONT: PanelFontId = 'dm-sans';

export function isPanelFontId(v: string): v is PanelFontId {
  return PANEL_FONTS.some((f) => f.id === v);
}

export function getStoredPanelFont(): PanelFontId {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v && isPanelFontId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT;
}

export function getPanelFontMeta(id: PanelFontId): PanelFontOption {
  return PANEL_FONTS.find((f) => f.id === id) ?? PANEL_FONTS[0]!;
}

export function applyPanelFont(id: PanelFontId) {
  const meta = getPanelFontMeta(id);
  document.documentElement.style.setProperty('--font-sans', meta.family);
  document.documentElement.dataset.panelFont = id;
}

export function savePanelFont(id: PanelFontId) {
  localStorage.setItem(FONT_KEY, id);
  applyPanelFont(id);
}

/* ── Para birimi gösterimi ────────────────────────────── */

export type MoneyStyleId = 'suffix' | 'prefix' | 'prefix-space' | 'code';

export type MoneyStyleOption = {
  id: MoneyStyleId;
  label: string;
  /** Örnek tutar (1.234,56 + sembol) */
  sample: string;
};

export const MONEY_STYLES: MoneyStyleOption[] = [
  { id: 'suffix', label: 'Sembol sonda', sample: '1.234,56 ₺' },
  { id: 'prefix', label: 'Sembol başta', sample: '₺1.234,56' },
  { id: 'prefix-space', label: 'Sembol başta (boşluklu)', sample: '₺ 1.234,56' },
  { id: 'code', label: 'Para kodu', sample: '1.234,56 TRY' },
];

const MONEY_KEY = 'anypay_tahsilat_money_style';
const DEFAULT_MONEY: MoneyStyleId = 'suffix';

/** Runtime önizleme — kaydetmeden önce */
let moneyStyleOverride: MoneyStyleId | null = null;

export function isMoneyStyleId(v: string): v is MoneyStyleId {
  return MONEY_STYLES.some((s) => s.id === v);
}

export function getStoredMoneyStyle(): MoneyStyleId {
  try {
    const v = localStorage.getItem(MONEY_KEY);
    if (v && isMoneyStyleId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_MONEY;
}

export function getActiveMoneyStyle(): MoneyStyleId {
  return moneyStyleOverride ?? getStoredMoneyStyle();
}

export function applyMoneyStyle(id: MoneyStyleId) {
  moneyStyleOverride = id;
  document.documentElement.dataset.moneyStyle = id;
}

export function saveMoneyStyle(id: MoneyStyleId) {
  localStorage.setItem(MONEY_KEY, id);
  moneyStyleOverride = null;
  document.documentElement.dataset.moneyStyle = id;
}

export function clearMoneyStylePreview() {
  moneyStyleOverride = null;
  document.documentElement.dataset.moneyStyle = getStoredMoneyStyle();
}

/** Sadece sayı kısmı (input maskeleri için) */
export function formatMoneyAmount(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Tercihe göre sembollü tutar.
 * `code` stilinde sembol yok sayılır, TRY yazılır.
 */
export function formatMoneyDisplay(n: number, symbol = '₺'): string {
  const amount = formatMoneyAmount(n);
  switch (getActiveMoneyStyle()) {
    case 'prefix':
      return `${symbol}${amount}`;
    case 'prefix-space':
      return `${symbol} ${amount}`;
    case 'code':
      return `${amount} TRY`;
    case 'suffix':
    default:
      return `${amount} ${symbol}`;
  }
}

/* ── Tarih formatı ────────────────────────────────────── */

export type DateStyleId = 'dmy-dot' | 'dmy-slash' | 'ymd-dash' | 'dmy-long';

export type DateStyleOption = {
  id: DateStyleId;
  label: string;
  sample: string;
};

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export const DATE_STYLES: DateStyleOption[] = [
  { id: 'dmy-dot', label: 'Gün.Ay.Yıl', sample: '25.09.2026' },
  { id: 'dmy-slash', label: 'Gün/Ay/Yıl', sample: '25/09/2026' },
  { id: 'ymd-dash', label: 'Yıl-Ay-Gün', sample: '2026-09-25' },
  { id: 'dmy-long', label: 'Uzun Türkçe', sample: '25 Eylül 2026' },
];

const DATE_KEY = 'anypay_tahsilat_date_style';
const DEFAULT_DATE: DateStyleId = 'dmy-dot';

let dateStyleOverride: DateStyleId | null = null;

export function isDateStyleId(v: string): v is DateStyleId {
  return DATE_STYLES.some((s) => s.id === v);
}

export function getStoredDateStyle(): DateStyleId {
  try {
    const v = localStorage.getItem(DATE_KEY);
    if (v && isDateStyleId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_DATE;
}

export function getActiveDateStyle(): DateStyleId {
  return dateStyleOverride ?? getStoredDateStyle();
}

export function applyDateStyle(id: DateStyleId) {
  dateStyleOverride = id;
  document.documentElement.dataset.dateStyle = id;
}

export function saveDateStyle(id: DateStyleId) {
  localStorage.setItem(DATE_KEY, id);
  dateStyleOverride = null;
  document.documentElement.dataset.dateStyle = id;
}

export function clearDateStylePreview() {
  dateStyleOverride = null;
  document.documentElement.dataset.dateStyle = getStoredDateStyle();
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function partsFromIsoOrDate(input: string | Date): { y: number; m: number; d: number } | null {
  if (input instanceof Date) {
    if (Number.isNaN(+input)) return null;
    return { y: input.getFullYear(), m: input.getMonth() + 1, d: input.getDate() };
  }
  const iso = input.trim().slice(0, 10);
  const [ys, ms, ds] = iso.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** ISO (YYYY-MM-DD) veya Date → tercih edilen tarih metni */
export function formatPanelDate(input: string | Date): string {
  const p = partsFromIsoOrDate(input);
  if (!p) return typeof input === 'string' ? input : '';
  const { y, m, d } = p;
  switch (getActiveDateStyle()) {
    case 'dmy-slash':
      return `${pad2(d)}/${pad2(m)}/${y}`;
    case 'ymd-dash':
      return `${y}-${pad2(m)}-${pad2(d)}`;
    case 'dmy-long':
      return `${d} ${MONTHS_TR[m - 1] ?? ''} ${y}`;
    case 'dmy-dot':
    default:
      return `${pad2(d)}.${pad2(m)}.${y}`;
  }
}

/** Tarih + saat (işlem listeleri) — tarih kısmı tercihe uyar */
export function formatPanelDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  const date = formatPanelDate(dt);
  return `${date} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
}

/* ── Açılış ───────────────────────────────────────────── */

export function hydratePanelFont() {
  applyPanelFont(getStoredPanelFont());
}

/** Font + para + tarih + gece tema + kart tasarımı — uygulama açılışında */
export function hydratePersonalPrefs() {
  applyPanelFont(getStoredPanelFont());
  moneyStyleOverride = null;
  dateStyleOverride = null;
  document.documentElement.dataset.moneyStyle = getStoredMoneyStyle();
  document.documentElement.dataset.dateStyle = getStoredDateStyle();
  document.documentElement.dataset.cardDesign = getStoredCardDesign();
}

/* ── Gece otomatik tema ───────────────────────────────── */

export type NightAutoPrefs = {
  enabled: boolean;
  /** HH:MM — örn. 20:00 */
  from: string;
  /** HH:MM — örn. 07:00 */
  to: string;
};

const NIGHT_KEY = 'anypay_tahsilat_night_auto';
const DEFAULT_NIGHT: NightAutoPrefs = {
  enabled: false,
  from: '20:00',
  to: '07:00',
};

export function parseHm(v: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

export function getStoredNightAuto(): NightAutoPrefs {
  try {
    const raw = localStorage.getItem(NIGHT_KEY);
    if (!raw) return { ...DEFAULT_NIGHT };
    const p = JSON.parse(raw) as Partial<NightAutoPrefs>;
    const from = typeof p.from === 'string' && parseHm(p.from) ? p.from : DEFAULT_NIGHT.from;
    const to = typeof p.to === 'string' && parseHm(p.to) ? p.to : DEFAULT_NIGHT.to;
    return { enabled: Boolean(p.enabled), from, to };
  } catch {
    return { ...DEFAULT_NIGHT };
  }
}

export function saveNightAuto(prefs: NightAutoPrefs) {
  const from = parseHm(prefs.from) ? prefs.from : DEFAULT_NIGHT.from;
  const to = parseHm(prefs.to) ? prefs.to : DEFAULT_NIGHT.to;
  localStorage.setItem(
    NIGHT_KEY,
    JSON.stringify({ enabled: prefs.enabled, from, to } satisfies NightAutoPrefs),
  );
}

/** Gece penceresinde mi? (from > to → gece yarısını aşar) */
export function isInNightWindow(now = new Date(), prefs = getStoredNightAuto()): boolean {
  const a = parseHm(prefs.from);
  const b = parseHm(prefs.to);
  if (!a || !b) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = a.h * 60 + a.m;
  const end = b.h * 60 + b.m;
  if (start === end) return prefs.enabled;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

/** Otomatik açıksa istenen tema; değilse null */
export function resolveNightAutoTheme(
  prefs = getStoredNightAuto(),
): 'light' | 'dark' | null {
  if (!prefs.enabled) return null;
  return isInNightWindow(new Date(), prefs) ? 'dark' : 'light';
}

/* ── Kart tasarımı ────────────────────────────────────── */

export type CardDesignId = 'plain' | 'animated';

export type CardDesignOption = {
  id: CardDesignId;
  label: string;
  hint: string;
};

export const CARD_DESIGNS: CardDesignOption[] = [
  {
    id: 'plain',
    label: 'Sade form',
    hint: 'Klasik alanlar — mevcut düzen',
  },
  {
    id: 'animated',
    label: 'Animasyonlu kart',
    hint: '3D kredi kartı — döndür, yaz, CVC için çevir',
  },
];

const CARD_DESIGN_KEY = 'anypay_tahsilat_card_design';
const DEFAULT_CARD_DESIGN: CardDesignId = 'plain';

export function isCardDesignId(v: string): v is CardDesignId {
  return CARD_DESIGNS.some((d) => d.id === v);
}

export function getStoredCardDesign(): CardDesignId {
  try {
    const v = localStorage.getItem(CARD_DESIGN_KEY);
    if (v && isCardDesignId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_CARD_DESIGN;
}

export function saveCardDesign(id: CardDesignId) {
  localStorage.setItem(CARD_DESIGN_KEY, id);
  document.documentElement.dataset.cardDesign = id;
}

export function applyCardDesign(id: CardDesignId) {
  document.documentElement.dataset.cardDesign = id;
}

