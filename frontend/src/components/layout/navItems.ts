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
  { to: '/raporlar', label: 'Raporlar', icon: 'chart' },
  { to: '/tanimlamalar', label: 'Tanımlamalar', icon: 'sliders' },
];

/** Sidebar dışı — hızlı erişime sürüklenebilir sayfalar */
export const EXTRA_QUICK_ITEMS: NavItem[] = [
  { to: '/ayarlar', label: 'Ayarlar', icon: 'gear' },
  { to: '/ayarlar/genel', label: 'Genel Ayarlar', icon: 'gear' },
  { to: '/ayarlar/iletisim', label: 'İletişim Bilgileri', icon: 'gear' },
  { to: '/ayarlar/varsayilanlar', label: 'Varsayılanlar', icon: 'gear' },
  { to: '/ayarlar/e-posta', label: 'E-Posta Ayarları', icon: 'gear' },
  { to: '/ayarlar/sms', label: 'SMS Ayarları', icon: 'gear' },
  { to: '/ayarlar/sablon-degiskenleri', label: 'Şablon Değişkenleri', icon: 'gear' },
  { to: '/ayarlar/erp', label: 'ERP Entegrasyon', icon: 'gear' },
  { to: '/raporlar/istatistikler', label: 'İstatistikler', icon: 'chart' },
  { to: '/raporlar/tahsilat-raporu', label: 'Tahsilat Raporu', icon: 'chart' },
  { to: '/raporlar/musteri-tahsilat-raporu', label: 'Müşteri Tahsilat Raporu', icon: 'chart' },
  { to: '/raporlar/musteri-kart-tahsilat', label: 'Müşteri Kartı Tahsilat', icon: 'chart' },
  { to: '/raporlar/banka-tahsilat-raporu', label: 'Banka Tahsilat Raporu', icon: 'chart' },
  { to: '/raporlar/gonderim-gecmisi', label: 'Gönderim Geçmişi', icon: 'chart' },
  { to: '/tanimlamalar/para-birimleri', label: 'Para Birimleri', icon: 'sliders' },
  { to: '/tanimlamalar/cari-tipleri', label: 'Cari Tipleri', icon: 'sliders' },
  { to: '/tanimlamalar/subeler', label: 'Şubeler / Departmanlar', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart', label: 'POS ve Kart', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/sanal-pos', label: 'Sanal POS Tanımları', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/ortak-sanal-pos', label: 'Ortak Sanal POS', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/anlasmalar', label: 'Kart Anlaşmaları', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/tipler', label: 'Kart Tipleri', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/turler', label: 'Kart Türleri', icon: 'sliders' },
  { to: '/tanimlamalar/pos-kart/markalar', label: 'Kart Markaları', icon: 'sliders' },
  { to: '/tanimlamalar/sozlesmeler', label: 'Sözleşmeler', icon: 'sliders' },
  { to: '/tanimlamalar/api-ayarlari', label: 'Api Ayarları', icon: 'sliders' },
];

export function findNavItem(to: string) {
  return NAV_ITEMS.find((n) => n.to === to) ?? EXTRA_QUICK_ITEMS.find((n) => n.to === to);
}
