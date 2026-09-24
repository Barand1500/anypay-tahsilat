/**
 * Modül tipleri + PermissionContext için sabit sayfa listesi.
 * Canlı liste API’den gelir (`/api/modules`); INITIAL_MODULES yalnızca yetki mock’u için.
 */

export type ModuleRole = 'Yönetici' | 'Tahsilat' | 'Muhasebe' | 'Satış';

export type AppModule = {
  id: number;
  name: string;
  dbTable: string;
  urlPrefix: string;
  /** Salt okunur — rol.izinler görüntüleme=1 */
  roles: string[];
  createdAt: string | null;
};

export const ROLE_OPTIONS: ModuleRole[] = ['Yönetici', 'Tahsilat', 'Muhasebe', 'Satış'];

export const DB_TABLE_OPTIONS = [
  'Adresler',
  'Ayarlar',
  'Bankalar',
  'BildirimGecmisi',
  'BinKayitlari',
  'CariTipleri',
  'EpostaSablonlari',
  'ErpEntegrasyonBilgileri',
  'Izinler',
  'Kullanicilar',
  'Log',
  'LogKayitlari',
  'Moduller',
  'Musteriler',
  'Odemeler',
  'OdemeIstekleri',
  'Ozet',
  'Raporlar',
  'Rol',
  'Roller',
  'TaksitSecenekleri',
  'Tanimlamalar',
  'User',
] as const;

/** PermissionContext / Roller mock — API modül listesinden bağımsız */
export const INITIAL_MODULES: Array<{
  id: string;
  name: string;
  dbTable: string;
  urlPrefix: string;
  roles: ModuleRole[];
  createdAt: string;
}> = [
  {
    id: 'm-ozet',
    name: 'Özet',
    dbTable: 'Ozet',
    urlPrefix: '/',
    roles: ['Yönetici', 'Tahsilat', 'Muhasebe'],
    createdAt: '2026-01-10T09:00:00',
  },
  {
    id: 'm-musteriler',
    name: 'Müşteriler',
    dbTable: 'Musteriler',
    urlPrefix: '/musteriler',
    roles: ['Yönetici', 'Tahsilat'],
    createdAt: '2026-01-12T11:20:00',
  },
  {
    id: 'm-hareketler',
    name: 'Hareketler',
    dbTable: 'Odemeler',
    urlPrefix: '/hareketler',
    roles: ['Yönetici', 'Tahsilat'],
    createdAt: '2026-01-12T11:22:00',
  },
  {
    id: 'm-odeme-istekleri',
    name: 'Ödeme İstekleri',
    dbTable: 'OdemeIstekleri',
    urlPrefix: '/odeme-istekleri',
    roles: ['Yönetici', 'Tahsilat'],
    createdAt: '2026-01-15T14:00:00',
  },
  {
    id: 'm-raporlar',
    name: 'Raporlar',
    dbTable: 'Raporlar',
    urlPrefix: '/raporlar',
    roles: ['Yönetici', 'Muhasebe'],
    createdAt: '2026-02-01T10:00:00',
  },
  {
    id: 'm-tanimlamalar',
    name: 'Tanımlamalar',
    dbTable: 'Tanimlamalar',
    urlPrefix: '/tanimlamalar',
    roles: ['Yönetici'],
    createdAt: '2026-02-01T10:05:00',
  },
  {
    id: 'm-ayarlar',
    name: 'Ayarlar',
    dbTable: 'Ayarlar',
    urlPrefix: '/ayarlar',
    roles: ['Yönetici'],
    createdAt: '2026-02-02T15:25:00',
  },
  {
    id: 'm-moduller',
    name: 'Modüller',
    dbTable: 'Moduller',
    urlPrefix: '/moduller',
    roles: ['Yönetici'],
    createdAt: '2026-02-02T15:30:00',
  },
  {
    id: 'm-roller',
    name: 'Roller',
    dbTable: 'Roller',
    urlPrefix: '/roller',
    roles: ['Yönetici'],
    createdAt: '2026-02-03T09:00:00',
  },
  {
    id: 'm-kullanicilar',
    name: 'Kullanıcılar',
    dbTable: 'Kullanicilar',
    urlPrefix: '/kullanicilar',
    roles: ['Yönetici'],
    createdAt: '2026-02-03T09:10:00',
  },
  {
    id: 'm-profil',
    name: 'Profil',
    dbTable: 'Kullanicilar',
    urlPrefix: '/profil',
    roles: ['Yönetici', 'Tahsilat', 'Muhasebe', 'Satış'],
    createdAt: '2026-02-04T08:00:00',
  },
  {
    id: 'm-surum',
    name: 'Sürüm Geçmişi',
    dbTable: 'LogKayitlari',
    urlPrefix: '/surum-gecmisi',
    roles: ['Yönetici'],
    createdAt: '2026-02-05T12:00:00',
  },
  {
    id: 'm-log',
    name: 'Log Kayıtları',
    dbTable: 'LogKayitlari',
    urlPrefix: '/log-kayitlari',
    roles: ['Yönetici'],
    createdAt: '2026-02-05T12:05:00',
  },
  {
    id: 'm-sistem',
    name: 'Sistem Sıfırlama',
    dbTable: 'Ayarlar',
    urlPrefix: '/sistem-sifirlama',
    roles: ['Yönetici'],
    createdAt: '2026-02-05T12:10:00',
  },
  {
    id: 'm-banka-kart',
    name: 'Banka Kart Anlaşması',
    dbTable: 'TaksitSecenekleri',
    urlPrefix: '/tanimlamalar/bankalar/banka-kart-anlasmasi',
    roles: ['Yönetici'],
    createdAt: '2026-02-02T15:25:00',
  },
  {
    id: 'm-banka-rapor',
    name: 'Banka Tahsilat Raporu',
    dbTable: 'Odemeler',
    urlPrefix: '/raporlar/banka-tahsilat-raporu',
    roles: ['Yönetici'],
    createdAt: '2025-06-16T14:16:00',
  },
  {
    id: 'm-bankalar',
    name: 'Bankalar',
    dbTable: 'Bankalar',
    urlPrefix: '/tanimlamalar/bankalar',
    roles: ['Yönetici'],
    createdAt: '2025-06-16T14:20:00',
  },
  {
    id: 'm-bin',
    name: 'Bin Kayıtları',
    dbTable: 'BinKayitlari',
    urlPrefix: '/tanimlamalar/bin-kayitlari',
    roles: ['Yönetici', 'Tahsilat'],
    createdAt: '2025-07-01T10:00:00',
  },
  {
    id: 'm-cari',
    name: 'Cari Tipleri',
    dbTable: 'CariTipleri',
    urlPrefix: '/tanimlamalar/cari-tipleri',
    roles: ['Yönetici'],
    createdAt: '2025-07-02T11:00:00',
  },
  {
    id: 'm-eposta',
    name: 'E-Posta Şablonları',
    dbTable: 'EpostaSablonlari',
    urlPrefix: '/tanimlamalar/eposta-sablonlari',
    roles: [],
    createdAt: '2025-08-10T09:30:00',
  },
  {
    id: 'm-erp',
    name: 'ERP Entegrasyon',
    dbTable: 'ErpEntegrasyonBilgileri',
    urlPrefix: '/ayarlar/erp-entegrasyon',
    roles: [],
    createdAt: '2025-08-12T16:00:00',
  },
  {
    id: 'm-genel',
    name: 'Genel Ayarlar',
    dbTable: 'Ayarlar',
    urlPrefix: '/ayarlar/genel',
    roles: ['Yönetici'],
    createdAt: '2025-09-01T08:00:00',
  },
  {
    id: 'm-gonderim',
    name: 'Gönderim Geçmişi',
    dbTable: 'BildirimGecmisi',
    urlPrefix: '/raporlar/gonderim-gecmisi',
    roles: ['Yönetici'],
    createdAt: '2025-09-05T13:45:00',
  },
];

export function formatModuleDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
