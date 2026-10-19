/** Hareketler — tip + yardımcılar (liste API’den gelir) */

export type TxStatus = 'paid' | 'cancelled' | 'refunded' | 'pending' | 'failed';

export type TxDekont = {
  merchantTitle: string;
  merchantAddress: string;
  merchantPhone: string;
  /** Müşteri (cari) — yoksa kart sahibi */
  customerTitle?: string;
  customerAddress?: string;
  customerPhone?: string;
  cardHolderName: string;
  cardHolderPhoneMasked: string;
  cardHolderPhone: string;
  identityNo: string;
  description: string;
  referenceNo: string;
  transactionNo: string;
  authCode: string;
  cardMasked: string;
  /** BIN → Bireysel / Ticari */
  cardSegment: string;
  /** BIN → Visa / MasterCard / TROY … */
  cardBrand: string;
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
  detail: {
    amount: number;
    commissionIncluded: boolean;
    customerCommission: number;
    bankCommission: number;
    ip: string;
    collectionDay: string;
    blockDay: string;
    referenceNo: string;
    authCode: string;
    operationHistory: Array<{
      at: string;
      operation: string;
      status: string;
      amount: number;
      referenceNo: string;
      authCode: string;
    }>;
  };
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

/** POS fiş kart: 5218 **** **** 9313 */
export function maskCardForDekont(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 8) return '*'.repeat(Math.min(d.length, 16));
  return `${d.slice(0, 4)} **** **** ${d.slice(-4)}`;
}

/** T.C. dekont: 123******90 */
export function maskIdentityForDekont(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 5) return '*'.repeat(d.length);
  return `${d.slice(0, 3)}${'*'.repeat(Math.max(0, d.length - 5))}${d.slice(-2)}`;
}

/** Telefon dekont: 530 *** ** 50 */
export function maskPhoneForDekont(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').slice(-10);
  if (d.length < 7) return raw?.trim() || '—';
  return `${d.slice(0, 3)} *** ** ${d.slice(-2)}`;
}

/** 80mm fiş — işlem tipi başlığı */
export function dekontSlipTitle(tx: Pick<Transaction, 'status' | 'installments'>): string {
  if (tx.status === 'cancelled') return 'SATIŞ İPTALİ';
  if (tx.status === 'refunded') return 'SATIŞ İADESİ';
  if (tx.installments > 1) return 'TAKSİTLİ SATIŞ';
  return 'PEŞİN SATIŞ';
}

/** Fiş iki kolon: tarih / saat (TR) */
export function splitTxDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  const date = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { date, time };
}

import {
  formatMoneyAmount,
  formatMoneyDisplay,
  formatPanelDateTime,
} from '../settings/personalPrefs';

export { formatMoneyAmount as formatMoneyTr, formatMoneyDisplay };

export function formatTxDate(iso: string): string {
  return formatPanelDateTime(iso);
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
