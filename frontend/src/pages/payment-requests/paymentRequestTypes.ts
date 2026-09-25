/** Ödeme istekleri — tip + yardımcılar (liste API’den gelir) */

export type PayRequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export type PayRequestType = 'ch' | 'fatura' | 'taksit' | 'diger';

export type PaymentRequest = {
  id: string;
  token: string;
  type: PayRequestType;
  status: PayRequestStatus;
  customerId: string | null;
  customerTitle: string;
  amount: number;
  commissionIncluded: boolean;
  createdAt: string;
  paidAt: string | null;
  branch: string;
  userId: string;
  userName: string;
  phone: string;
  email: string;
  whatsapp: string;
  description: string;
};

export const PAY_REQ_STATUS_LABEL: Record<PayRequestStatus, string> = {
  pending: 'Beklemede',
  paid: 'Ödendi',
  cancelled: 'İptal',
  expired: 'Süresi doldu',
};

/** Filtre — DB yalnızca pending / paid tutar */
export const PAY_REQ_STATUS_FILTER: { value: 'pending' | 'paid'; label: string }[] = [
  { value: 'pending', label: PAY_REQ_STATUS_LABEL.pending },
  { value: 'paid', label: PAY_REQ_STATUS_LABEL.paid },
];

export const PAY_REQ_TYPE_LABEL: Record<PayRequestType, string> = {
  ch: 'C/H İSTİNADEN',
  fatura: 'FATURA',
  taksit: 'TAKSİTLİ',
  diger: 'DİĞER',
};

export function payLinkOf(token: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/pay/${token}`;
  }
  return `https://tahsilat.anypay.com.tr/pay/${token}`;
}

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatElapsed(fromIso: string, toIso: string | null, nowMs: number): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : nowMs;
  let sec = Math.max(0, Math.floor((to - from) / 1000));
  const days = Math.floor(sec / 86400);
  sec %= 86400;
  const hours = Math.floor(sec / 3600);
  sec %= 3600;
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${days} Gün, ${hours} Sa., ${mins} Dk., ${secs} Sn.`;
}
