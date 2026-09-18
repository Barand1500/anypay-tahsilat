/** Sistem sıfırlama — sıfırlanabilir tablolar (mock) */

export type ResetTable = {
  id: string;
  module: string;
  table: string;
  /** Yaklaşık kayıt (gösterim) */
  rows: number;
  cleared?: boolean;
};

export const INITIAL_RESET_TABLES: ResetTable[] = [
  { id: 'rt-1', module: 'Banka Kart Anlaşması', table: 'TaksitSecenekleri', rows: 48 },
  { id: 'rt-2', module: 'Bankalar', table: 'Bankalar', rows: 12 },
  { id: 'rt-3', module: 'Bin Kayıtları', table: 'BinKayitlari', rows: 320 },
  { id: 'rt-4', module: 'Cari Tipleri', table: 'CariTipleri', rows: 6 },
  { id: 'rt-5', module: 'E-Posta Şablonları', table: 'EpostaSablonlari', rows: 9 },
  { id: 'rt-6', module: 'ERP Entegrasyon', table: 'ErpEntegrasyonBilgileri', rows: 3 },
  { id: 'rt-7', module: 'Genel Ayarlar', table: 'Ayarlar', rows: 1 },
  { id: 'rt-8', module: 'Gönderim Geçmişi', table: 'BildirimGecmisi', rows: 184 },
  { id: 'rt-9', module: 'Hareketler', table: 'Odemeler', rows: 2450 },
  { id: 'rt-10', module: 'Log Kayıtları', table: 'LogKayitlari', rows: 8912 },
  { id: 'rt-11', module: 'Müşteriler', table: 'Musteriler', rows: 640 },
  { id: 'rt-12', module: 'Ödeme İstekleri', table: 'OdemeIstekleri', rows: 112 },
];

export function formatRowCount(n: number) {
  return n.toLocaleString('tr-TR');
}
