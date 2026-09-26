/** Ödeme istekleri — tip + yardımcılar (liste API’den gelir) */

import {
  formatMoneyDisplay,
  formatPanelDateTime,
} from '../settings/personalPrefs';

export {
  formatMoneyAmount as formatMoneyTr,
  formatMoneyDisplay,
} from '../settings/personalPrefs';

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
  installments?: number[];
  files?: { name: string; path: string; url: string }[];
  currencyId?: string;
  currencySymbol?: string;
  currencyShortName?: string;
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

export function absoluteAssetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://tahsilat.anypay.com.tr';
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Kopyala / WhatsApp / SMS — ödeme linki + ekler */
export function payShareMessage(opts: {
  amount: number;
  token: string;
  files?: { name: string; url: string }[] | null;
  greeting?: string;
  currencySymbol?: string;
}): string {
  const link = payLinkOf(opts.token);
  const sym = opts.currencySymbol || '₺';
  const lines = [
    opts.greeting ?? 'Merhaba, ödeme isteğiniz hazır:',
    link,
    `Tutar: ${formatMoneyDisplay(opts.amount, sym)}`,
  ];
  const files = opts.files?.filter((f) => f?.name && f?.url) ?? [];
  if (files.length) {
    lines.push('', 'Ekler:');
    for (const f of files) {
      lines.push(`• ${f.name}`);
      lines.push(`  ${absoluteAssetUrl(f.url)}`);
    }
  }
  return lines.join('\n');
}

export function formatDt(iso: string): string {
  return formatPanelDateTime(iso);
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
