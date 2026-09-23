/** Tahsilat Raporu — mock */

export type CollectionRow = {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  collectionDate: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  amount: number;
  commission: number;
  branch: string;
  userId: string;
  userName: string;
};

const L = (file: string) => `/banks/${file}`;

export const REPORT_TYPE_OPTIONS = [
  { value: 'ozet', label: 'Özet' },
  { value: 'detay', label: 'Detay' },
  { value: 'gunluk', label: 'Günlük' },
];

export const INITIAL_COLLECTION_ROWS: CollectionRow[] = [
  {
    id: 'cr1',
    paymentDate: '2026-09-01',
    collectionDate: '2026-09-01',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    amount: 44000,
    commission: 0,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr2',
    paymentDate: '2026-09-01',
    collectionDate: '2026-09-01',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    amount: 25000,
    commission: 1335,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr3',
    paymentDate: '2026-09-01',
    collectionDate: '2026-09-01',
    bankId: 'akbank',
    bankName: 'AKBANK T.A.Ş.',
    bankLogo: L('akbanktas_logo_1750065323.webp'),
    amount: 12500,
    commission: 0,
    branch: 'İstanbul Anadolu',
    userId: 'u2',
    userName: 'Sercan Güzel',
  },
  {
    id: 'cr4',
    paymentDate: '2026-09-02',
    collectionDate: '2026-09-02',
    bankId: 'garanti',
    bankName: 'T. GARANTİ BANKASI A.Ş.',
    bankLogo: L('tgarantibankasias_logo_1750065698.webp'),
    amount: 37800,
    commission: 2010.6,
    branch: 'Merkez',
    userId: 'u1',
    userName: 'Semihcan Güzel',
  },
  {
    id: 'cr5',
    paymentDate: '2026-09-03',
    collectionDate: '2026-09-03',
    bankId: 'isbank',
    bankName: 'TÜRKİYE İŞ BANKASI A.Ş.',
    bankLogo: L('tisbankasias_logo_1750066326.webp'),
    amount: 18950.5,
    commission: 0,
    branch: 'Ankara',
    userId: 'u3',
    userName: 'Baran Ürüncan',
  },
  {
    id: 'cr6',
    paymentDate: '2026-09-04',
    collectionDate: '2026-09-05',
    bankId: 'yapikredi',
    bankName: 'YAPI VE KREDİ BANKASI A.Ş.',
    bankLogo: L('yapivekredibankasias_logo_1750065209.webp'),
    amount: 56200,
    commission: 3001.2,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr7',
    paymentDate: '2026-09-05',
    collectionDate: '2026-09-05',
    bankId: 'ziraat',
    bankName: 'T.C. ZİRAAT BANKASI A.Ş.',
    bankLogo: L('tcziraatbankasias_logo_1760452109.webp'),
    amount: 9800,
    commission: 523.32,
    branch: 'İzmir',
    userId: 'u2',
    userName: 'Sercan Güzel',
  },
  {
    id: 'cr8',
    paymentDate: '2026-09-08',
    collectionDate: '2026-09-08',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    amount: 71500,
    commission: 3818.1,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr9',
    paymentDate: '2026-09-10',
    collectionDate: '2026-09-10',
    bankId: 'halkbank',
    bankName: 'TÜRKİYE HALK BANKASI A.Ş.',
    bankLogo: L('thalkbankasias_logo_1750066038.webp'),
    amount: 15400,
    commission: 0,
    branch: 'Muhasebe Departmanı',
    userId: 'u1',
    userName: 'Semihcan Güzel',
  },
  {
    id: 'cr10',
    paymentDate: '2026-09-12',
    collectionDate: '2026-09-12',
    bankId: 'akbank',
    bankName: 'AKBANK T.A.Ş.',
    bankLogo: L('akbanktas_logo_1750065323.webp'),
    amount: 22300,
    commission: 1190.82,
    branch: 'Merkez',
    userId: 'u3',
    userName: 'Baran Ürüncan',
  },
  {
    id: 'cr11',
    paymentDate: '2026-09-15',
    collectionDate: '2026-09-15',
    bankId: 'vakifbank',
    bankName: 'TÜRKİYE VAKIFLAR BANKASI T.A.O.',
    bankLogo: L('tvakiflarbankasitao_logo_1760452244.webp'),
    amount: 8750,
    commission: 0,
    branch: 'Satış Departmanı',
    userId: 'u2',
    userName: 'Sercan Güzel',
  },
  {
    id: 'cr12',
    paymentDate: '2026-09-18',
    collectionDate: '2026-09-18',
    bankId: 'garanti',
    bankName: 'T. GARANTİ BANKASI A.Ş.',
    bankLogo: L('tgarantibankasias_logo_1750065698.webp'),
    amount: 33600,
    commission: 1794.24,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr13',
    paymentDate: '2026-09-20',
    collectionDate: '2026-09-21',
    bankId: 'denizbank',
    bankName: 'DENİZBANK A.Ş.',
    bankLogo: L('denizbankas_logo_1760449984.webp'),
    amount: 11200,
    commission: 598.08,
    branch: 'İstanbul Anadolu',
    userId: 'u1',
    userName: 'Semihcan Güzel',
  },
  {
    id: 'cr14',
    paymentDate: '2026-09-22',
    collectionDate: '2026-09-22',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    amount: 48900,
    commission: 2611.26,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
  },
  {
    id: 'cr15',
    paymentDate: '2026-09-25',
    collectionDate: '2026-09-25',
    bankId: 'teb',
    bankName: 'TÜRK EKONOMİ BANKASI A.Ş.',
    bankLogo: L('turkekonomibankasias_logo_1760450968.webp'),
    amount: 6400,
    commission: 0,
    branch: 'Ankara',
    userId: 'u3',
    userName: 'Baran Ürüncan',
  },
];

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function netOf(row: CollectionRow) {
  return row.amount - row.commission;
}
