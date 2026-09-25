import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { createPayment, PaymentsError } from './paymentsService.js';

export class PaymentRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequestsError';
  }
}

export type CreatePaymentRequestInput = {
  musteriId: number;
  payType: 'ch' | 'fatura';
  amount: number;
  commissionIncluded: boolean;
  installments: number[];
  description: string;
  faturaNo?: string;
  dosya?: string | null;
  kullaniciId: number;
};

export type PublicPayView = {
  token: string;
  type: 'ch' | 'fatura' | 'diger';
  status: 'pending' | 'paid';
  customerTitle: string;
  amount: number;
  commissionIncluded: boolean;
  description: string;
  installments: number[];
  merchantTitle: string;
  paidAt: string | null;
};

export type PayByTokenInput = {
  holder: string;
  tc?: string;
  phone: string;
  cardDigits: string;
  installment: number;
  note?: string;
};

export type PublicPaymentRequest = {
  id: number;
  token: string;
  type: 'ch' | 'fatura' | 'diger';
  status: 'pending' | 'paid';
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
  installments: number[];
};

function tipFromPayType(payType: 'ch' | 'fatura'): number {
  return payType === 'fatura' ? 2 : 0;
}

function payTypeFromTip(tip: number): 'ch' | 'fatura' | 'diger' {
  if (tip === 2) return 'fatura';
  if (tip === 0) return 'ch';
  return 'diger';
}

function makeIstekNo(): string {
  return randomBytes(6).toString('hex');
}

function parseTaksitler(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
}

function notRemoved(): { OR: [{ remove: null }, { remove: false }] } {
  return { OR: [{ remove: null }, { remove: false }] };
}

type Row = {
  id: number;
  odemeTipi: number;
  tutar: number;
  komisyonDahil: boolean;
  taksitler: string | null;
  aciklama: string | null;
  musteriId: number | null;
  tarih: Date;
  odemeZamani: Date | null;
  durum: boolean;
  istekNo: string;
  kullaniciId: number | null;
  subeDepartmanId: number | null;
};

async function hydrate(rows: Row[]): Promise<PublicPaymentRequest[]> {
  const musteriIds = [...new Set(rows.map((r) => r.musteriId).filter((x): x is number => x != null))];
  const userIds = [...new Set(rows.map((r) => r.kullaniciId).filter((x): x is number => x != null))];
  const branchIds = [
    ...new Set(rows.map((r) => r.subeDepartmanId).filter((x): x is number => x != null)),
  ];

  const [musteriler, users, branches] = await Promise.all([
    musteriIds.length
      ? prisma.musteri.findMany({
          where: { id: { in: musteriIds } },
          select: { id: true, unvan: true, telefon: true, eposta: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, adsoyad: true, email: true },
        })
      : Promise.resolve([]),
    branchIds.length
      ? prisma.subeDepartman.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, adi: true },
        })
      : Promise.resolve([]),
  ]);

  const mMap = new Map(musteriler.map((m) => [m.id, m]));
  const uMap = new Map(users.map((u) => [u.id, u]));
  const bMap = new Map(branches.map((b) => [b.id, b]));

  return rows.map((r) => {
    const m = r.musteriId != null ? mMap.get(r.musteriId) : undefined;
    const u = r.kullaniciId != null ? uMap.get(r.kullaniciId) : undefined;
    const b = r.subeDepartmanId != null ? bMap.get(r.subeDepartmanId) : undefined;
    const phone = (m?.telefon || '').replace(/\D/g, '').slice(-10);
    return {
      id: r.id,
      token: r.istekNo,
      type: payTypeFromTip(r.odemeTipi),
      status: r.durum ? 'paid' : 'pending',
      customerId: r.musteriId != null ? String(r.musteriId) : null,
      customerTitle: (m?.unvan || '—').trim() || '—',
      amount: r.tutar,
      commissionIncluded: r.komisyonDahil,
      createdAt: r.tarih.toISOString(),
      paidAt: r.odemeZamani ? r.odemeZamani.toISOString() : null,
      branch: b?.adi || '—',
      userId: r.kullaniciId != null ? String(r.kullaniciId) : '',
      userName: (u?.adsoyad || u?.email || '—').trim(),
      phone,
      email: (m?.eposta || '').trim().toLowerCase(),
      whatsapp: phone,
      description: (r.aciklama || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      installments: parseTaksitler(r.taksitler),
    };
  });
}

export async function listPaymentRequests(): Promise<PublicPaymentRequest[]> {
  const rows = await prisma.odemeIstegi.findMany({
    where: notRemoved(),
    orderBy: { tarih: 'desc' },
    take: 2000,
  });
  return hydrate(rows);
}

async function merchantTitle(): Promise<string> {
  const [ayar, iletisim] = await Promise.all([
    prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } }),
    prisma.iletisimBilgileri.findFirst({ orderBy: { id: 'asc' } }),
  ]);
  return (iletisim?.unvan || ayar?.sistemAdi || 'GÜZEL Teknoloji').trim() || 'GÜZEL Teknoloji';
}

export async function createPaymentRequest(
  input: CreatePaymentRequestInput,
): Promise<PublicPaymentRequest> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PaymentRequestsError('Geçerli tutar gerekli');
  }
  if (!input.installments.length) {
    throw new PaymentRequestsError('En az bir taksit seçin');
  }
  if (!Number.isFinite(input.musteriId) || input.musteriId <= 0) {
    throw new PaymentRequestsError('Müşteri seçin');
  }
  const m = await prisma.musteri.findFirst({
    where: { id: input.musteriId, ...notRemoved() },
    select: { id: true },
  });
  if (!m) throw new PaymentRequestsError('Müşteri bulunamadı');

  const user = await prisma.user.findFirst({
    where: { id: input.kullaniciId },
    select: { subeDepartmanId: true },
  });

  const istekNo = makeIstekNo();
  const now = new Date();
  const row = await prisma.odemeIstegi.create({
    data: {
      parabirimiId: 1,
      odemeTipi: tipFromPayType(input.payType),
      tutar: input.amount,
      faturaNo: (input.faturaNo || '').trim() || null,
      komisyonDahil: input.commissionIncluded,
      taksitler: [...new Set(input.installments)].sort((a, b) => a - b).join(','),
      aciklama: input.description.trim() || null,
      dosya: input.dosya ?? null,
      musteriId: input.musteriId,
      tarih: now,
      durum: false,
      istekNo,
      kullaniciId: input.kullaniciId,
      subeDepartmanId: user?.subeDepartmanId ?? null,
      remove: false,
    },
  });

  const [pub] = await hydrate([row]);
  return pub!;
}

export async function getPaymentRequestByToken(token: string): Promise<PublicPayView> {
  const row = await prisma.odemeIstegi.findFirst({
    where: { istekNo: token, ...notRemoved() },
  });
  if (!row) throw new PaymentRequestsError('Ödeme isteği bulunamadı');

  let customerTitle = '—';
  if (row.musteriId != null) {
    const m = await prisma.musteri.findFirst({
      where: { id: row.musteriId },
      select: { unvan: true },
    });
    customerTitle = (m?.unvan || '').trim() || '—';
  }

  return {
    token: row.istekNo,
    type: payTypeFromTip(row.odemeTipi),
    status: row.durum ? 'paid' : 'pending',
    customerTitle,
    amount: row.tutar,
    commissionIncluded: row.komisyonDahil,
    description: (row.aciklama || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    installments: parseTaksitler(row.taksitler),
    merchantTitle: await merchantTitle(),
    paidAt: row.odemeZamani ? row.odemeZamani.toISOString() : null,
  };
}

export async function payPaymentRequestByToken(
  token: string,
  input: PayByTokenInput,
): Promise<{ odemeNo: string; amount: number }> {
  const row = await prisma.odemeIstegi.findFirst({
    where: { istekNo: token, ...notRemoved() },
  });
  if (!row) throw new PaymentRequestsError('Ödeme isteği bulunamadı');
  if (row.durum) throw new PaymentRequestsError('Bu ödeme isteği zaten ödendi');
  if (row.musteriId == null) {
    throw new PaymentRequestsError('Ödeme isteğine müşteri bağlı değil');
  }

  const allowed = parseTaksitler(row.taksitler);
  if (!allowed.length) throw new PaymentRequestsError('Taksit seçenekleri tanımsız');
  if (!allowed.includes(input.installment)) {
    throw new PaymentRequestsError('Geçersiz taksit seçimi');
  }

  const tip = payTypeFromTip(row.odemeTipi);
  const payType = tip === 'fatura' ? 'fatura' : 'ch';
  const kullaniciId = row.kullaniciId ?? 0;
  if (!kullaniciId) throw new PaymentRequestsError('Ödeme isteği kullanıcı bilgisi eksik');

  let payment;
  try {
    payment = await createPayment({
      musteriId: row.musteriId,
      payType,
      amount: row.tutar,
      commissionIncluded: row.komisyonDahil,
      holder: input.holder,
      tc: input.tc,
      phone: input.phone,
      cardDigits: input.cardDigits,
      installment: input.installment,
      note: input.note || (row.aciklama || '').replace(/<[^>]+>/g, ' ').trim() || undefined,
      kullaniciId,
    });
  } catch (err) {
    if (err instanceof PaymentsError) throw err;
    throw err;
  }

  const now = new Date();
  await prisma.odemeIstegi.update({
    where: { id: row.id },
    data: { durum: true, odemeZamani: now },
  });

  return { odemeNo: payment.odemeNo, amount: payment.amount };
}

export async function softDeletePaymentRequest(id: number): Promise<void> {
  const row = await prisma.odemeIstegi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!row) throw new PaymentRequestsError('Ödeme isteği bulunamadı');
  await prisma.odemeIstegi.update({
    where: { id },
    data: { remove: true },
  });
}
