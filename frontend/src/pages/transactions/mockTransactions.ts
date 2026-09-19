/** Hareketler — mock; API sonrası canlı bağlanacak */

export type TxStatus = 'paid' | 'cancelled' | 'pending' | 'failed';

export type TxDekont = {
  merchantTitle: string;
  merchantAddress: string;
  merchantPhone: string;
  cardHolderName: string;
  cardHolderPhoneMasked: string;
  cardHolderPhone: string;
  identityNo: string;
  description: string;
  referenceNo: string;
  transactionNo: string;
  authCode: string;
  cardMasked: string;
  threeDSecure: boolean;
};

export type Transaction = {
  id: string;
  at: string;
  status: TxStatus;
  bankId: string;
  bankName: string;
  bankLogo: string;
  installments: number;
  customerTitle: string;
  customerId: string;
  amount: number;
  commission: number;
  archived: boolean;
  branch: string;
  userId: string;
  userName: string;
  dekont: TxDekont;
};

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  paid: 'Ödendi',
  cancelled: 'İptal',
  pending: 'Beklemede',
  failed: 'Başarısız',
};

export const MERCHANT_DEFAULT = {
  merchantTitle: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
  merchantAddress: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. No:130A Kepez / Antalya / Türkiye',
  merchantPhone: '850 885 11 60',
};

const L = (file: string) => `/banks/${file}`;

function dekontBase(
  partial: Partial<TxDekont> & Pick<TxDekont, 'cardHolderName' | 'referenceNo' | 'transactionNo' | 'authCode' | 'cardMasked'>,
): TxDekont {
  return {
    ...MERCHANT_DEFAULT,
    cardHolderPhoneMasked: '555 *** ** 55',
    cardHolderPhone: '555 555 55 55',
    identityNo: '',
    description: '-',
    threeDSecure: true,
    ...partial,
  };
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '2025T0000087',
    at: '2026-09-19T09:36:27',
    status: 'paid',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    installments: 1,
    customerTitle: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
    customerId: 'c11',
    amount: 8950,
    commission: 0,
    archived: false,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
    dekont: dekontBase({
      cardHolderName: 'MEHMET ÇETİN ARKÖSE',
      referenceNo: '626209029707',
      transactionNo: '1000002340786516',
      authCode: '426065',
      cardMasked: '9792 1######### 4740',
    }),
  },
  {
    id: '2025T0000086',
    at: '2026-09-18T14:22:11',
    status: 'paid',
    bankId: 'garanti',
    bankName: 'Garanti BBVA',
    bankLogo: L('tgarantibankasias_logo_1750065698.webp'),
    installments: 3,
    customerTitle: 'ANADOLU MARKET A.Ş.',
    customerId: 'c4',
    amount: 12450.5,
    commission: 186.75,
    archived: false,
    branch: 'TEKNOPARK',
    userId: 'u-apptest',
    userName: 'App Test',
    dekont: dekontBase({
      cardHolderName: 'AYŞE YILMAZ',
      cardHolderPhoneMasked: '532 *** ** 18',
      cardHolderPhone: '532 444 18 18',
      referenceNo: '551902881144',
      transactionNo: '1000002340786401',
      authCode: '881203',
      cardMasked: '5406 2######### 1192',
    }),
  },
  {
    id: '2025T0000085',
    at: '2026-09-17T11:05:44',
    status: 'cancelled',
    bankId: 'akbank',
    bankName: 'Akbank',
    bankLogo: L('akbanktas_logo_1750065323.webp'),
    installments: 1,
    customerTitle: 'EGE YAZILIM',
    customerId: 'c6',
    amount: 3200,
    commission: 0,
    archived: false,
    branch: 'İzmir',
    userId: 'u4',
    userName: 'Ercan Güzel',
    dekont: dekontBase({
      cardHolderName: 'CANER DEMİR',
      referenceNo: '441100229988',
      transactionNo: '1000002340786300',
      authCode: '112209',
      cardMasked: '5571 3######### 8821',
      threeDSecure: true,
    }),
  },
  {
    id: '2025T0000084',
    at: '2026-09-16T16:48:02',
    status: 'paid',
    bankId: 'halkbank',
    bankName: 'T. HALK BANKASI A.Ş.',
    bankLogo: L('thalkbankasias_logo_1750066038.webp'),
    installments: 6,
    customerTitle: 'NİLÜFER GIDA',
    customerId: 'c9',
    amount: 27500,
    commission: 412.5,
    archived: false,
    branch: 'Ankara',
    userId: 'u4',
    userName: 'Ercan Güzel',
    dekont: dekontBase({
      cardHolderName: 'FATMA KAYA',
      cardHolderPhoneMasked: '505 *** ** 90',
      cardHolderPhone: '505 333 90 90',
      referenceNo: '778811223344',
      transactionNo: '1000002340786211',
      authCode: '554401',
      cardMasked: '5528 4######### 3301',
    }),
  },
  {
    id: '2025T0000083',
    at: '2026-09-15T09:12:33',
    status: 'pending',
    bankId: 'isbank',
    bankName: 'İş Bankası',
    bankLogo: L('tisbankasias_logo_1750066326.webp'),
    installments: 1,
    customerTitle: 'MAVİ DENİZ LTD.',
    customerId: 'c5',
    amount: 980,
    commission: 14.7,
    archived: false,
    branch: 'Merkez',
    userId: 'u-apptest',
    userName: 'App Test',
    dekont: dekontBase({
      cardHolderName: 'SERKAN ÖZTÜRK',
      referenceNo: '990011223355',
      transactionNo: '1000002340786100',
      authCode: '',
      cardMasked: '4508 5######### 7710',
      threeDSecure: false,
    }),
  },
  {
    id: '2025T0000082',
    at: '2026-09-12T18:30:09',
    status: 'failed',
    bankId: 'yapikredi',
    bankName: 'Yapı Kredi',
    bankLogo: L('yapivekredibankasias_logo_1750065209.webp'),
    installments: 2,
    customerTitle: 'ATLAS PERAKENDE',
    customerId: 'c8',
    amount: 5400,
    commission: 0,
    archived: false,
    branch: 'İstanbul Anadolu',
    userId: 'u4',
    userName: 'Ercan Güzel',
    dekont: dekontBase({
      cardHolderName: 'BURAK ŞAHİN',
      referenceNo: '330044556677',
      transactionNo: '1000002340786001',
      authCode: '—',
      cardMasked: '4506 6######### 4412',
    }),
  },
  {
    id: '2025T0000079',
    at: '2026-09-08T10:01:55',
    status: 'paid',
    bankId: 'ziraat',
    bankName: 'Ziraat Bankası',
    bankLogo: L('tcziraatbankasias_logo_1760452109.webp'),
    installments: 1,
    customerTitle: 'KARADENİZ LOJİSTİK',
    customerId: 'c7',
    amount: 15600,
    commission: 0,
    archived: true,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
    dekont: dekontBase({
      cardHolderName: 'HÜSEYİN ÇELİK',
      referenceNo: '112233445566',
      transactionNo: '1000002340785900',
      authCode: '778899',
      cardMasked: '4543 7######### 2208',
    }),
  },
  {
    id: '2025T0000075',
    at: '2026-09-03T13:44:18',
    status: 'paid',
    bankId: 'denizbank',
    bankName: 'DenizBank',
    bankLogo: L('denizbankas_logo_1760449984.webp'),
    installments: 9,
    customerTitle: 'TEST MÜŞTERİ',
    customerId: 'c2',
    amount: 42000,
    commission: 840,
    archived: true,
    branch: 'TEKNOPARK',
    userId: 'u-apptest',
    userName: 'App Test',
    dekont: dekontBase({
      cardHolderName: 'ZEYNEP AKSOY',
      referenceNo: '667788990011',
      transactionNo: '1000002340785800',
      authCode: '334455',
      cardMasked: '5218 8######### 9901',
    }),
  },
];

/** Liste bankası ile dekont banka satırı — ödeme bankası */
export function dekontBankName(tx: Transaction): string {
  if (tx.id === '2025T0000087') return 'T.HALK BANKASI A.Ş.';
  return tx.bankName;
}

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const ONES = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
const TENS = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];

function underThousand(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h === 1) parts.push('YÜZ');
  else if (h > 1) parts.push(`${ONES[h]} YÜZ`);
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(' ');
}

/** Tam lira tutarını yazıya çevirir (kuruş yok sayılır) */
export function amountInWordsTr(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'SIFIR TÜRK LİRASI';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let s = '';
  if (millions === 1) s += 'BİR MİLYON';
  else if (millions > 1) s += `${underThousand(millions)} MİLYON`;
  if (thousands === 1) s += (s ? ' ' : '') + 'BİN';
  else if (thousands > 1) s += (s ? ' ' : '') + `${underThousand(thousands)} BİN`;
  if (rest) s += (s ? ' ' : '') + underThousand(rest);
  return `${s} TÜRK LİRASI`;
}
