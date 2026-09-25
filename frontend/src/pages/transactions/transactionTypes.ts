/** Hareketler — tip + yardımcılar (liste API’den gelir) */

export type TxStatus = 'paid' | 'cancelled' | 'refunded' | 'pending' | 'failed';

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
  /** Ödeme no (görünen) */
  id: string;
  /** DB odemeler.id */
  dbId: number;
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
  branchId?: string;
  userId: string;
  userName: string;
  dekont: TxDekont;
};

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  paid: 'Ödendi',
  cancelled: 'İptal',
  refunded: 'İade',
  pending: 'Beklemede',
  failed: 'Başarısız',
};

/**
 * POS mantığı: aynı takvim günü (TR) → iptal (void).
 * Gün değiştiyse → iade (refund).
 */
export function isVoidWindowOpen(atIso: string, now = new Date()): boolean {
  const tz = 'Europe/Istanbul';
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  return dayKey(new Date(atIso)) === dayKey(now);
}

export function dekontBankName(tx: Transaction): string {
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
