/** Ortak menü tanımı — sidebar + hızlı erişim */

export type NavIconName = 'home' | 'briefcase' | 'pulse' | 'pay' | 'chart' | 'sliders' | 'gear';

export type NavItem = {
  to: string;
  label: string;
  icon: NavIconName;
  end?: boolean;
  soon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Özet', end: true, icon: 'home' },
  { to: '/musteriler', label: 'Müşteriler', icon: 'briefcase' },
  { to: '/hareketler', label: 'Hareketler', icon: 'pulse' },
  { to: '/odeme-istekleri', label: 'Ödeme İstekleri', icon: 'pay' },
  { to: '/raporlar', label: 'Raporlar', icon: 'chart', soon: true },
  { to: '/tanimlamalar', label: 'Tanımlamalar', icon: 'sliders', soon: true },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'gear', soon: true },
];

export function findNavItem(to: string) {
  return NAV_ITEMS.find((n) => n.to === to);
}
