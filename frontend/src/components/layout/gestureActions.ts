/** Jest Rüzgarı — aksiyon tanımları */

export type GestureActionType =
  | 'navigate'
  | 'search'
  | 'theme'
  | 'customer'
  | 'collect'
  | 'quick-pay';

export type GestureAction = {
  type: GestureActionType;
  /** navigate: rota · customer/collect: müşteri id */
  target?: string;
  label?: string;
};

export const GESTURE_ACTION_OPTIONS: {
  type: GestureActionType;
  label: string;
  hint: string;
  needsTarget: 'route' | 'customer' | 'none';
}[] = [
  {
    type: 'navigate',
    label: 'Sekme / sayfa aç',
    hint: 'Hangi sayfaya gidileceğini seç',
    needsTarget: 'route',
  },
  {
    type: 'search',
    label: 'Global ara',
    hint: 'Ctrl+K arama panelini açar',
    needsTarget: 'none',
  },
  {
    type: 'theme',
    label: 'Tema değiştir',
    hint: 'Gece ↔ gündüz',
    needsTarget: 'none',
  },
  {
    type: 'customer',
    label: 'Müşteriye git',
    hint: 'Müşteri detay sayfasını açar',
    needsTarget: 'customer',
  },
  {
    type: 'collect',
    label: 'Ödeme al',
    hint: 'Seçilen müşteride ödeme al',
    needsTarget: 'customer',
  },
  {
    type: 'quick-pay',
    label: 'Hızlı ödeme',
    hint: 'Hızlı ödeme ekranını açar',
    needsTarget: 'none',
  },
];

export function actionSummary(a: GestureAction): string {
  const base = GESTURE_ACTION_OPTIONS.find((x) => x.type === a.type)?.label ?? a.type;
  if (a.label) return `${base} · ${a.label}`;
  if (a.target) return `${base} · ${a.target}`;
  return base;
}
