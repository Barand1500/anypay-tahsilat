/** Ödeme istekleri — mock; API sonrası canlı bağlanacak */

import type { Customer } from '../customers/mockCustomers';

export type PayRequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export type PayRequestType = 'ch' | 'fatura' | 'taksit' | 'diger';

export type PaymentRequest = {
  id: string;
  token: string;
  type: PayRequestType;
  status: PayRequestStatus;
  customerId: string;
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

/** Panele giriş yapan üye işyeri (mock — auth/API sonra) */
export const PANEL_COMPANY = {
  id: 'panel-merchant',
  code: 'GZT',
  title: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
  phone: '8508851160',
  email: 'info@guzelteknoloji.com',
  taxNo: '6091428902',
  taxOffice: 'Kepez V.D.',
  kind: 'tuzel' as const,
  accountType: '',
  parentId: null as string | null,
  address: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. No:130A Kepez / Antalya / Türkiye',
  identityNo: '',
};

export function panelCompanyAsCustomer(): Customer {
  return { ...PANEL_COMPANY };
}

export const PAY_REQ_STATUS_LABEL: Record<PayRequestStatus, string> = {
  pending: 'Beklemede',
  paid: 'Ödendi',
  cancelled: 'İptal',
  expired: 'Süresi doldu',
};

export const PAY_REQ_TYPE_LABEL: Record<PayRequestType, string> = {
  ch: 'C/H İSTİNADEN',
  fatura: 'FATURA',
  taksit: 'TAKSİTLİ',
  diger: 'DİĞER',
};

export function payLinkOf(token: string) {
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

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const INITIAL_PAYMENT_REQUESTS: PaymentRequest[] = [
  {
    id: 'pr-1',
    token: '6aabb59388402',
    type: 'ch',
    status: 'paid',
    customerId: 'c1',
    customerTitle: 'SİNAN OLCA',
    amount: 10000,
    commissionIncluded: false,
    createdAt: minsAgo(12),
    paidAt: minsAgo(2),
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: '5523562384',
    email: 'sinanolcs@gmail.com',
    whatsapp: '5523562384',
    description: 'TEST',
  },
  {
    id: 'pr-2',
    token: '7bccb60499513',
    type: 'ch',
    status: 'pending',
    customerId: 'c3',
    customerTitle: 'MUSTAFA KEMAL ATATÜRK',
    amount: 0,
    commissionIncluded: false,
    createdAt: hoursAgo(3),
    paidAt: null,
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: '',
    email: 'info@guzelteknoloji.com',
    whatsapp: '',
    description: 'Açık bakiye',
  },
  {
    id: 'pr-3',
    token: '8cddc71500624',
    type: 'fatura',
    status: 'pending',
    customerId: 'c4',
    customerTitle: 'ANADOLU MARKET A.Ş.',
    amount: 35100,
    commissionIncluded: false,
    createdAt: hoursAgo(8),
    paidAt: null,
    branch: 'TEKNOPARK',
    userId: 'u-apptest',
    userName: 'App Test',
    phone: '5321112233',
    email: '',
    whatsapp: '5321112233',
    description: 'Fatura ödemesi',
  },
  {
    id: 'pr-4',
    token: '9deed82611735',
    type: 'ch',
    status: 'pending',
    customerId: 'c8',
    customerTitle: 'ATLAS PERAKENDE',
    amount: 8750.5,
    commissionIncluded: true,
    createdAt: daysAgo(1),
    paidAt: null,
    branch: 'Ankara',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: '5425556677',
    email: 'satis@atlasperakende.com',
    whatsapp: '5425556677',
    description: '',
  },
  {
    id: 'pr-5',
    token: 'aeffe93722846',
    type: 'taksit',
    status: 'paid',
    customerId: PANEL_COMPANY.id,
    customerTitle: PANEL_COMPANY.title,
    amount: 8950,
    commissionIncluded: false,
    createdAt: daysAgo(2),
    paidAt: daysAgo(2),
    branch: 'Merkez',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: PANEL_COMPANY.phone,
    email: PANEL_COMPANY.email,
    whatsapp: PANEL_COMPANY.phone,
    description: 'TEST',
  },
  {
    id: 'pr-6',
    token: 'bfffa04833957',
    type: 'ch',
    status: 'cancelled',
    customerId: 'c5',
    customerTitle: 'MAVİ DENİZ LTD.',
    amount: 4200,
    commissionIncluded: false,
    createdAt: daysAgo(4),
    paidAt: null,
    branch: 'İzmir',
    userId: 'u-apptest',
    userName: 'App Test',
    phone: '',
    email: '',
    whatsapp: '',
    description: 'İptal örnek',
  },
  {
    id: 'pr-7',
    token: 'c000b15944068',
    type: 'fatura',
    status: 'expired',
    customerId: 'c6',
    customerTitle: 'EGE YAZILIM',
    amount: 1500,
    commissionIncluded: false,
    createdAt: daysAgo(10),
    paidAt: null,
    branch: 'İzmir',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: '5053334455',
    email: 'info@egeyazilim.com',
    whatsapp: '',
    description: 'Süresi dolmuş link',
  },
  {
    id: 'pr-8',
    token: 'd111c26055179',
    type: 'ch',
    status: 'pending',
    customerId: 'c9',
    customerTitle: 'NİLÜFER GIDA',
    amount: 22100,
    commissionIncluded: false,
    createdAt: minsAgo(45),
    paidAt: null,
    branch: 'Ankara',
    userId: 'u4',
    userName: 'Ercan Güzel',
    phone: '5336667788',
    email: 'siparis@nilufergida.com',
    whatsapp: '5336667788',
    description: '',
  },
];

const STORAGE_KEY = 'anypay_tahsilat_payment_requests_v1';

export function getLivePaymentRequests(): PaymentRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...INITIAL_PAYMENT_REQUESTS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...INITIAL_PAYMENT_REQUESTS];
    return parsed as PaymentRequest[];
  } catch {
    return [...INITIAL_PAYMENT_REQUESTS];
  }
}

export function setLivePaymentRequests(list: PaymentRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addLivePaymentRequest(row: PaymentRequest) {
  const next = [row, ...getLivePaymentRequests()];
  setLivePaymentRequests(next);
  return next;
}
