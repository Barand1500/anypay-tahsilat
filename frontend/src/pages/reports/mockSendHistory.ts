/** Gönderim Geçmişi — mock */

export type SendType = 'email' | 'sms';

export type SendHistoryRow = {
  id: number;
  customerId: string | null;
  customerTitle: string;
  type: SendType;
  recipient: string;
  content: string;
  sentAt: string; // ISO-ish
};

export const SEND_TYPE_OPTIONS = [
  { value: 'email', label: 'E-Posta' },
  { value: 'sms', label: 'Sms' },
];

export const SEND_TYPE_LABEL: Record<SendType, string> = {
  email: 'E-Posta',
  sms: 'Sms',
};

export const INITIAL_SEND_HISTORY: SendHistoryRow[] = [
  {
    id: 1,
    customerId: null,
    customerTitle: 'Sistem Başarılı Tahsilat',
    type: 'email',
    recipient: 'muhasebe@guzelteknoloji.com',
    content:
      'Sayın Yetkili,\nTahsilat işleminiz başarıyla tamamlandı.\nTutar: 8.950,00 ₺\nReferans: 626209029707',
    sentAt: '2026-09-21T09:40:12',
  },
  {
    id: 2,
    customerId: 'c11',
    customerTitle: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
    type: 'email',
    recipient: 'info@guzelicdis.com',
    content:
      'Sayın GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ,\nÖdeme linkiniz oluşturuldu. Link 48 saat geçerlidir.',
    sentAt: '2026-09-20T14:22:05',
  },
  {
    id: 3,
    customerId: 'c4',
    customerTitle: 'ANADOLU MARKET A.Ş.',
    type: 'sms',
    recipient: '0532 356 12 18',
    content: 'Anadolu Market: 12.500,00 TL tahsilat onaylandi. Detay icin panelinizi kontrol edin.',
    sentAt: '2026-09-19T11:05:44',
  },
  {
    id: 4,
    customerId: 'c2',
    customerTitle: 'İSMAİL YILMAZ',
    type: 'sms',
    recipient: '0555 441 23 41',
    content: 'Sayin Ismail Yilmaz, odeme talebiniz olusturuldu. Link: anypay.co/p/a3f9',
    sentAt: '2026-09-18T16:48:01',
  },
  {
    id: 5,
    customerId: 'c5',
    customerTitle: 'MAVİ DENİZ LTD.',
    type: 'email',
    recipient: 'finans@mavideniz.com',
    content:
      'Sayın MAVİ DENİZ LTD.,\nDekontunuz ektedir.\nİşlem No: 1000002340786516\nTutar: 4.200,00 ₺',
    sentAt: '2026-09-17T10:12:33',
  },
  {
    id: 6,
    customerId: null,
    customerTitle: 'Sistem Başarılı Tahsilat',
    type: 'sms',
    recipient: '0542 778 91 77',
    content: 'Tahsilat basarili. Tutar: 1.350,00 TL. Tesekkurler.',
    sentAt: '2026-09-16T08:55:20',
  },
  {
    id: 7,
    customerId: 'c6',
    customerTitle: 'EGE YAZILIM',
    type: 'email',
    recipient: 'destek@egeyazilim.com',
    content:
      'Sayın EGE YAZILIM,\nYeni kullanıcı şifreniz oluşturuldu.\nKullanıcı: ege.admin\nGeçici şifre: ******',
    sentAt: '2026-09-15T13:30:09',
  },
  {
    id: 8,
    customerId: 'c8',
    customerTitle: 'OLCA MARKET ANTALYA',
    type: 'sms',
    recipient: '0533 210 45 90',
    content: 'Olca Market: 3D Secure odemeniz onaylandi. 6.490,00 TL.',
    sentAt: '2026-09-14T19:02:47',
  },
  {
    id: 9,
    customerId: 'c7',
    customerTitle: 'ATLAS PERAKENDE',
    type: 'email',
    recipient: 'odeme@atlasperakende.com',
    content:
      'Sayın ATLAS PERAKENDE,\nÖdeme isteği hatırlatması.\nSon ödeme tarihi: 30.09.2026\nTutar: 15.600,00 ₺',
    sentAt: '2026-09-12T09:18:55',
  },
  {
    id: 10,
    customerId: 'c10',
    customerTitle: 'SİNAN OLCA',
    type: 'sms',
    recipient: '0552 356 23 84',
    content: 'Sinan Olca: Panel giris sifreniz sifirlandi. Yeni sifre SMS ile iletildi.',
    sentAt: '2026-09-10T07:41:16',
  },
  {
    id: 11,
    customerId: 'c9',
    customerTitle: 'KARADENİZ LOJİSTİK',
    type: 'email',
    recipient: 'muhasebe@karadenizloj.com',
    content:
      'Sayın KARADENİZ LOJİSTİK,\nAylık tahsilat özeti ektedir.\nToplam hareket: 2\nToplam tutar: 8.900,00 ₺',
    sentAt: '2026-09-08T15:27:02',
  },
  {
    id: 12,
    customerId: null,
    customerTitle: 'Sistem Başarılı Tahsilat',
    type: 'email',
    recipient: 'baran@guzelteknoloji.com',
    content:
      'Test bildirimi.\nÖdeme başarıyla alındı.\nBanka: QNB\nTutar: 44.000,00 ₺',
    sentAt: '2026-09-05T12:00:00',
  },
];

export function formatSendDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
