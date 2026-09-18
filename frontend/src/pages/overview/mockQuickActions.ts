/** Özet — hızlı işlem katalogu (mock) */

export type QuickActionId =
  | 'new-collection'
  | 'add-customer'
  | 'link-collection'
  | 'view-report'
  | 'payment-requests'
  | 'logs'
  | 'users';

export type QuickActionDef = {
  id: QuickActionId;
  title: string;
  hint: string;
  to: string;
  tone: 'orange' | 'slate' | 'blue' | 'green' | 'rose' | 'violet';
  icon: 'plus' | 'user' | 'link' | 'chart' | 'pay' | 'logs' | 'users';
};

export const QUICK_ACTION_CATALOG: QuickActionDef[] = [
  {
    id: 'new-collection',
    title: 'Yeni Tahsilat',
    hint: 'Hızlı tahsilat başlat',
    to: '/hareketler',
    tone: 'orange',
    icon: 'plus',
  },
  {
    id: 'add-customer',
    title: 'Müşteri Ekle',
    hint: 'Yeni müşteri kaydı',
    to: '/musteriler',
    tone: 'slate',
    icon: 'user',
  },
  {
    id: 'link-collection',
    title: 'Link ile Tahsilat',
    hint: 'Ödeme linki oluştur',
    to: '/odeme-istekleri',
    tone: 'blue',
    icon: 'link',
  },
  {
    id: 'view-report',
    title: 'Rapor Görüntüle',
    hint: 'Detaylı raporlar',
    to: '/raporlar',
    tone: 'green',
    icon: 'chart',
  },
  {
    id: 'payment-requests',
    title: 'Ödeme İstekleri',
    hint: 'Bekleyen istekler',
    to: '/odeme-istekleri',
    tone: 'violet',
    icon: 'pay',
  },
  {
    id: 'logs',
    title: 'Log Kayıtları',
    hint: 'İşlem izleri',
    to: '/log-kayitlari',
    tone: 'rose',
    icon: 'logs',
  },
  {
    id: 'users',
    title: 'Kullanıcılar',
    hint: 'Kullanıcı listesi',
    to: '/kullanicilar',
    tone: 'blue',
    icon: 'users',
  },
];

export const DEFAULT_QUICK_ACTION_IDS: QuickActionId[] = [
  'new-collection',
  'add-customer',
  'link-collection',
  'view-report',
];

export const QUICK_SLOTS = 4;
export const LS_QUICK_ACTIONS = 'anypay_tahsilat_overview_quick_actions';

export function loadQuickActionIds(): (QuickActionId | null)[] {
  try {
    const raw = localStorage.getItem(LS_QUICK_ACTIONS);
    if (!raw) return [...DEFAULT_QUICK_ACTION_IDS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== QUICK_SLOTS) {
      return [...DEFAULT_QUICK_ACTION_IDS];
    }
    const valid = new Set(QUICK_ACTION_CATALOG.map((c) => c.id));
    return parsed.map((id) =>
      id && typeof id === 'string' && valid.has(id as QuickActionId) ? (id as QuickActionId) : null,
    );
  } catch {
    return [...DEFAULT_QUICK_ACTION_IDS];
  }
}

export function saveQuickActionIds(ids: (QuickActionId | null)[]) {
  localStorage.setItem(LS_QUICK_ACTIONS, JSON.stringify(ids));
}

export function defById(id: QuickActionId) {
  return QUICK_ACTION_CATALOG.find((c) => c.id === id)!;
}
