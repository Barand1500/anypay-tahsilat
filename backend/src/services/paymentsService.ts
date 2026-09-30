import { randomBytes } from 'node:crypto';
import {
  initiateThreeD,
  PosResolveError,
  resolvePosForPayment,
  type ThreeDForm,
} from '../gateways/index.js';
import { prisma } from '../lib/prisma.js';
import { CurrenciesError, resolveCurrencyId } from './currenciesService.js';
import { resolveAllowedInstallments } from './installmentPriorityService.js';
import {
  getCustomerAgreementCode,
  resolveAgreementRates,
} from './cardAgreementsService.js';
import { assertInstallmentsAllowed, UsersError } from './usersService.js';

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsError';
  }
}

export type CreatePaymentInput = {
  musteriId: number | null;
  payType: 'ch' | 'fatura';
  amount: number;
  commissionIncluded: boolean;
  holder: string;
  tc?: string;
  phone: string;
  cardDigits: string;
  /** MMYY — 3DS için zorunlu */
  expiry: string;
  cvc: string;
  installment: number;
  note?: string;
  kullaniciId: number;
  /** Yoksa aktif varsayılan (TL) */
  parabirimiId?: number | null;
  /** DB banka id (opsiyonel; yoksa BIN ile bulunur) */
  bankId?: number | null;
  clientIp?: string;
  email?: string;
};

export type TxStatus = 'paid' | 'cancelled' | 'refunded' | 'pending' | 'failed';

export type PublicPaymentRow = {
  dbId: number;
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
  branchId: string;
  userId: string;
  userName: string;
  dekont: {
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
    operationHistory: Array<{ at: string; operation: string; status: string; amount: number; referenceNo: string; authCode: string }>;
  };
};

export type ListPaymentsQuery = {
  branchId?: number | null;
  userId?: number | null;
  customerId?: number | null;
  bankId?: number | null;
  status?: TxStatus | null;
  archive?: 'yes' | 'no' | 'all';
  from?: string | null;
  to?: string | null;
  q?: string | null;
  take?: number;
};

/** Dump: 0=C/H, 2=fatura */
function tipFromPayType(payType: 'ch' | 'fatura'): number {
  return payType === 'fatura' ? 2 : 0;
}

function maskCard(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length < 10) return d;
  const groups = [d.slice(0, 4), d.slice(4, 6) + '**', '****', d.slice(-4)];
  return groups.join(' ');
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10);
  if (d.length < 7) return raw || '—';
  return `${d.slice(0, 3)} *** ** ${d.slice(-2)}`;
}

function bankResponseDetails(raw: string | null | undefined) {
  if (!raw) return { referenceNo: '', authCode: '' };
  const find = (keys: string[]) => {
    for (const key of keys) {
      const match = raw.match(new RegExp(`(?:"|\\b)${key}(?:"|\\b)\\s*[:=]\\s*"?([^",\\s}]+)`, 'i'));
      if (match?.[1]) return match[1];
    }
    return '';
  };
  return {
    referenceNo: find(['refno', 'referenceNo', 'hostRefNum', 'rrn']),
    authCode: find(['authcode', 'authCode', 'approvalCode', 'procreturncode']),
  };
}

function makeOdemeNo(): string {
  const y = new Date().getFullYear();
  const rnd = randomBytes(3).toString('hex').toUpperCase();
  return `${y}T${rnd}`;
}

function bankLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '';
  const raw = logo.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/banks/') || raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  if (raw.startsWith('bankalar/')) return `/uploads/${raw}`;
  const file = raw.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return '';
  return `/banks/${file}`;
}

/** iptal_iade tip: "1"=iptal, "2"=iade */
function cancelKind(raw: string | null | undefined): 'iptal' | 'iade' {
  if (!raw) return 'iptal';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const tip = String((parsed[0] as { tip?: string })?.tip ?? '1');
      if (tip === '2') return 'iade';
    }
  } catch {
    /* ignore */
  }
  if (raw.includes('"tip":"2"') || raw.includes("'tip':'2'")) return 'iade';
  return 'iptal';
}

function statusOf(durum: number, iptalIade: string | null): TxStatus {
  if (durum === 1) return 'paid';
  if (durum === 2) return cancelKind(iptalIade) === 'iade' ? 'refunded' : 'cancelled';
  if (durum === 0 || durum === -1) return 'failed';
  return 'pending';
}

function isVoidWindowOpen(at: Date, now = new Date()): boolean {
  const tz = 'Europe/Istanbul';
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  return dayKey(at) === dayKey(now);
}

function parseDayStart(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDayEnd(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

type OdemeRow = {
  id: number;
  musteriId: number | null;
  tutar: number;
  gercekTutar: number;
  komisyonDahil: boolean;
  aciklama: string | null;
  adsoyad: string;
  tc: string | null;
  telefon: string;
  kartNo: string;
  taksit: number | null;
  odemeNo: string;
  durum: number;
  bankaCevabi: string | null;
  tarih: Date | null;
  bankaId: number | null;
  sanalposBankaId: number | null;
  bankaKomisyonu: number | null;
  vadeFarki: number | null;
  arsiv: boolean | null;
  subeDepartmanId: number | null;
  kullaniciId: number | null;
  iptalIadeHareket: string | null;
  ip: string | null;
  tahsilGunu: string | null;
  blokeGunu: string | null;
  taksitOran: number | null;
  odemeTipi: number;
};

async function merchantDefaults() {
  const [ayar, iletisim] = await Promise.all([
    prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } }),
    prisma.iletisimBilgileri.findFirst({ orderBy: { id: 'asc' } }),
  ]);
  return {
    merchantTitle:
      (iletisim?.unvan || ayar?.sistemAdi || 'GÜZEL Teknoloji').trim() || 'GÜZEL Teknoloji',
    merchantAddress: (iletisim?.adres || '').trim() || '—',
    merchantPhone: (iletisim?.telefon || iletisim?.gsm || '').trim() || '—',
  };
}

async function hydrate(
  rows: OdemeRow[],
  merchant: Awaited<ReturnType<typeof merchantDefaults>>,
): Promise<PublicPaymentRow[]> {
  const musteriIds = [...new Set(rows.map((r) => r.musteriId).filter((x): x is number => x != null))];
  const userIds = [...new Set(rows.map((r) => r.kullaniciId).filter((x): x is number => x != null))];
  const branchIds = [
    ...new Set(rows.map((r) => r.subeDepartmanId).filter((x): x is number => x != null)),
  ];
  const bankIds = [
    ...new Set(
      rows
        .map((r) => r.bankaId ?? r.sanalposBankaId)
        .filter((x): x is number => x != null),
    ),
  ];

  const [musteriler, users, branches, banks] = await Promise.all([
    musteriIds.length
      ? prisma.musteri.findMany({
          where: { id: { in: musteriIds } },
          select: { id: true, unvan: true },
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
    bankIds.length
      ? prisma.banka.findMany({
          where: { id: { in: bankIds } },
          select: { id: true, adi: true, kisaAdi: true, logo: true },
        })
      : Promise.resolve([]),
  ]);

  const mMap = new Map(musteriler.map((m) => [m.id, m]));
  const uMap = new Map(users.map((u) => [u.id, u]));
  const bMap = new Map(branches.map((b) => [b.id, b]));
  const bankMap = new Map(banks.map((b) => [b.id, b]));

  return rows.map((r) => {
    const m = r.musteriId != null ? mMap.get(r.musteriId) : undefined;
    const u = r.kullaniciId != null ? uMap.get(r.kullaniciId) : undefined;
    const br = r.subeDepartmanId != null ? bMap.get(r.subeDepartmanId) : undefined;
    const bankKey = r.bankaId ?? r.sanalposBankaId;
    const bank = bankKey != null ? bankMap.get(bankKey) : undefined;
    const commission = Number(r.bankaKomisyonu ?? r.vadeFarki ?? 0) || 0;
    const amount = Number(r.gercekTutar ?? r.tutar ?? 0) || 0;
    const phone = (r.telefon || '').trim();
    const at = r.tarih ? r.tarih.toISOString() : new Date(0).toISOString();
    const responseDetails = bankResponseDetails(r.bankaCevabi);
    const referenceNo = responseDetails.referenceNo;
    const authCode = responseDetails.authCode;
    const customerCommission = Math.max(0, amount - Number(r.gercekTutar ?? r.tutar ?? 0));
    const historyStatus = statusOf(r.durum, r.iptalIadeHareket);

    return {
      dbId: r.id,
      id: r.odemeNo || String(r.id),
      at,
      status: statusOf(r.durum, r.iptalIadeHareket),
      bankId: bank ? String(bank.id) : '',
      bankName: bank ? (bank.adi || bank.kisaAdi || '—').trim() : '—',
      bankLogo: bank ? bankLogoUrl(bank.logo) : '',
      installments: r.taksit && r.taksit > 0 ? r.taksit : 1,
      customerTitle: (m?.unvan || r.adsoyad || '').trim() || '—',
      customerId: r.musteriId != null ? String(r.musteriId) : '',
      amount,
      commission,
      archived: Boolean(r.arsiv),
      branch: (br?.adi || '').trim() || '—',
      branchId: r.subeDepartmanId != null ? String(r.subeDepartmanId) : '',
      userId: r.kullaniciId != null ? String(r.kullaniciId) : '',
      userName: (u?.adsoyad || u?.email || '').trim() || '—',
      dekont: {
        merchantTitle: merchant.merchantTitle,
        merchantAddress: merchant.merchantAddress,
        merchantPhone: merchant.merchantPhone,
        cardHolderName: (r.adsoyad || '').trim() || '—',
        cardHolderPhoneMasked: maskPhone(phone),
        cardHolderPhone: phone || '—',
        identityNo: (r.tc || '').trim(),
        description: (r.aciklama || '').trim() || '—',
        referenceNo,
        transactionNo: r.odemeNo || String(r.id),
        authCode,
        cardMasked: (r.kartNo || '').trim() || '—',
        threeDSecure: true,
      },
      detail: {
        amount: Number(r.tutar) || 0,
        commissionIncluded: Boolean(r.komisyonDahil),
        customerCommission,
        bankCommission: commission,
        ip: (r.ip || '').trim(),
        collectionDay: (r.tahsilGunu || '').trim(),
        blockDay: (r.blokeGunu || '').trim(),
        referenceNo,
        authCode,
        operationHistory: [{
          at,
          operation: historyStatus === 'cancelled' ? 'İPTAL' : historyStatus === 'refunded' ? 'İADE' : 'ÖDEME',
          status: historyStatus === 'paid' ? 'BAŞARILI' : historyStatus === 'pending' ? 'BEKLEMEDE' : historyStatus === 'failed' ? 'BAŞARISIZ' : 'TAMAMLANDI',
          amount: Number(r.tutar) || 0,
          referenceNo,
          authCode,
        }],
      },
    };
  });
}

export type PublicPayment = {
  id: number;
  odemeNo: string;
  musteriId: number | null;
  amount: number;
  durum: number;
  tarih: string | null;
  status: 'pending_3d' | 'paid' | 'failed';
  bankName?: string;
  /** Bankaya POST edilecek 3DS formu — kart alanları yalnızca burada (DB’de yok) */
  threeD?: ThreeDForm;
};

function publicApiBase(): string {
  return (
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'https://tahsilat.anypay.com.tr'
  );
}

function expiryMmyy(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 4) return d;
  if (d.length === 6) return d.slice(0, 2) + d.slice(-2);
  return d;
}

export async function createPayment(input: CreatePaymentInput): Promise<PublicPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PaymentsError('Geçerli tutar gerekli');
  }
  let customerEmail = '';
  if (input.musteriId != null) {
    const musteri = await prisma.musteri.findFirst({
      where: {
        id: input.musteriId,
        OR: [{ remove: null }, { remove: false }],
      },
      select: { id: true, eposta: true },
    });
    if (!musteri) throw new PaymentsError('Müşteri bulunamadı');
    customerEmail = (musteri.eposta || '').trim();
  }

  const digits = input.cardDigits.replace(/\D/g, '');
  if (digits.length < 15 || digits.length > 16) {
    throw new PaymentsError('Kart numarası geçersiz');
  }

  const expiry = expiryMmyy(input.expiry || '');
  const cvc = (input.cvc || '').replace(/\D/g, '');
  if (expiry.length !== 4) throw new PaymentsError('Son kullanma tarihi MMYY olmalı');
  if (cvc.length < 3) throw new PaymentsError('CVC gerekli');

  let currency;
  try {
    currency = await resolveCurrencyId(input.parabirimiId ?? null);
  } catch (err) {
    if (err instanceof CurrenciesError) throw new PaymentsError(err.message);
    throw err;
  }

  try {
    const allowed = await resolveAllowedInstallments({
      kullaniciId: input.kullaniciId,
      musteriId: input.musteriId,
    });
    assertInstallmentsAllowed(allowed, [input.installment > 0 ? input.installment : 1]);
  } catch (err) {
    if (err instanceof UsersError) throw new PaymentsError(err.message);
    throw err;
  }

  let pos;
  try {
    pos = await resolvePosForPayment({
      cardDigits: digits,
      bankId: input.bankId ?? null,
    });
  } catch (err) {
    if (err instanceof PosResolveError) throw new PaymentsError(err.message);
    throw err;
  }

  const now = new Date();
  const odemeNo = makeOdemeNo();
  const installment = input.installment > 0 ? input.installment : 1;
  const apiBase = publicApiBase();

  let commissionPct = 0;
  try {
    const code = await getCustomerAgreementCode(input.musteriId);
    const rates = await resolveAgreementRates({
      agreementCode: code,
      bankId: pos.bankId,
      bankName: pos.bankName,
      segment: 'bireysel',
      amount: input.amount,
    });
    const hit = rates.rows.find((r) => r.n === installment);
    if (hit) commissionPct = hit.commissionPct;
  } catch {
    /* oran yoksa 0 */
  }

  const chargedAmount = input.commissionIncluded
    ? input.amount * (1 + commissionPct / 100)
    : input.amount;

  const threeDResult = await initiateThreeD({
    pos,
    orderId: odemeNo,
    amount: chargedAmount,
    currencyCode: currency.shortName || 'TRY',
    installment,
    card: {
      number: digits,
      holder: input.holder.trim(),
      expiry,
      cvc,
    },
    okUrl: `${apiBase}/api/payments/3d/ok`,
    failUrl: `${apiBase}/api/payments/3d/fail`,
    clientIp: input.clientIp,
    email: (input.email || customerEmail || '').trim() || undefined,
  });

  if (threeDResult.kind === 'error') {
    throw new PaymentsError(threeDResult.message);
  }

  const meta = JSON.stringify({
    adapter: threeDResult.adapter,
    posId: pos.posId,
    securityType: pos.securityType,
    startedAt: now.toISOString(),
    commissionPct,
  });

  const row = await prisma.odeme.create({
    data: {
      parabirimiId: currency.id,
      musteriId: input.musteriId,
      tutar: input.amount,
      kur: currency.kur,
      gercekTutar: chargedAmount,
      komisyonDahil: input.commissionIncluded,
      aciklama: (input.note || '').trim() || null,
      adsoyad: input.holder.trim().slice(0, 255),
      tc: (input.tc || '').trim() || null,
      telefon: formatPhone(input.phone).slice(0, 255),
      kartNo: maskCard(digits).slice(0, 255),
      taksit: installment,
      taksitOran: commissionPct || null,
      bankaKomisyonu: commissionPct || null,
      odemeNo,
      durum: 3,
      bankaCevabi: meta,
      odemeTipi: tipFromPayType(input.payType),
      tarih: now,
      kullaniciId: input.kullaniciId,
      bankaId: pos.bankId,
      sanalposBankaId: pos.bankId,
      ip: (input.clientIp || '').slice(0, 255) || null,
      arsiv: false,
    },
  });

  return {
    id: row.id,
    odemeNo: row.odemeNo,
    musteriId: row.musteriId,
    amount: row.tutar,
    durum: row.durum,
    tarih: row.tarih ? row.tarih.toISOString() : null,
    status: 'pending_3d',
    bankName: pos.bankName,
    threeD: threeDResult.form,
  };
}

export async function listPayments(query: ListPaymentsQuery = {}): Promise<PublicPaymentRow[]> {
  const take = Math.min(Math.max(query.take ?? 2000, 1), 5000);
  const fetchTake =
    query.status === 'cancelled' || query.status === 'refunded'
      ? Math.min(take * 5, 5000)
      : take;
  const andParts: Record<string, unknown>[] = [];

  if (query.branchId != null) andParts.push({ subeDepartmanId: query.branchId });
  if (query.userId != null) andParts.push({ kullaniciId: query.userId });
  if (query.customerId != null) andParts.push({ musteriId: query.customerId });
  if (query.bankId != null) {
    andParts.push({
      OR: [{ bankaId: query.bankId }, { sanalposBankaId: query.bankId }],
    });
  }
  if (query.archive === 'yes') andParts.push({ arsiv: true });
  if (query.archive === 'no') {
    andParts.push({ OR: [{ arsiv: null }, { arsiv: false }] });
  }
  if (query.from || query.to) {
    andParts.push({
      tarih: {
        ...(query.from ? { gte: parseDayStart(query.from) } : {}),
        ...(query.to ? { lte: parseDayEnd(query.to) } : {}),
      },
    });
  }
  if (query.status === 'paid') andParts.push({ durum: 1 });
  else if (query.status === 'failed') andParts.push({ durum: { in: [0, -1] } });
  else if (query.status === 'pending') andParts.push({ durum: { notIn: [0, 1, 2, -1] } });
  else if (query.status === 'cancelled' || query.status === 'refunded') {
    andParts.push({ durum: 2 });
  }

  const rows = await prisma.odeme.findMany({
    where: andParts.length ? { AND: andParts } : {},
    orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
    take: fetchTake,
  });

  const merchant = await merchantDefaults();
  let list = await hydrate(rows as OdemeRow[], merchant);

  if (query.status === 'cancelled') {
    list = list.filter((t) => t.status === 'cancelled').slice(0, take);
  } else if (query.status === 'refunded') {
    list = list.filter((t) => t.status === 'refunded').slice(0, take);
  }

  const q = (query.q || '').trim().toLocaleLowerCase('tr');
  if (q) {
    list = list.filter(
      (t) =>
        t.id.toLocaleLowerCase('tr').includes(q) ||
        t.customerTitle.toLocaleLowerCase('tr').includes(q) ||
        t.bankName.toLocaleLowerCase('tr').includes(q) ||
        t.dekont.cardHolderName.toLocaleLowerCase('tr').includes(q),
    );
  }

  return list;
}

export async function getPayment(id: number): Promise<PublicPaymentRow> {
  const row = await prisma.odeme.findFirst({ where: { id } });
  if (!row) throw new PaymentsError('Hareket bulunamadı');
  const merchant = await merchantDefaults();
  const [hit] = await hydrate([row as OdemeRow], merchant);
  return hit;
}

export async function setPaymentArchived(id: number, archived: boolean): Promise<PublicPaymentRow> {
  const existing = await prisma.odeme.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new PaymentsError('Hareket bulunamadı');
  await prisma.odeme.update({ where: { id }, data: { arsiv: archived } });
  return getPayment(id);
}

export async function reversePayment(
  id: number,
  actorUserId: number,
): Promise<PublicPaymentRow> {
  const row = await prisma.odeme.findFirst({ where: { id } });
  if (!row) throw new PaymentsError('Hareket bulunamadı');
  if (row.durum !== 1) throw new PaymentsError('Yalnızca ödenmiş hareketler iptal/iade edilebilir');

  const at = row.tarih || new Date();
  const asVoid = isVoidWindowOpen(at);
  const tip = asVoid ? '1' : '2';
  const entry = {
    tip,
    tarih: new Date().toISOString(),
    kullaniciId: actorUserId,
  };

  let prev: unknown[] = [];
  if (row.iptalIadeHareket) {
    try {
      const parsed = JSON.parse(row.iptalIadeHareket) as unknown;
      if (Array.isArray(parsed)) prev = parsed;
    } catch {
      prev = [];
    }
  }

  await prisma.odeme.update({
    where: { id },
    data: {
      durum: 2,
      iptalIadeHareket: JSON.stringify([entry, ...prev]),
    },
  });

  return getPayment(id);
}

/** Filtre dropdown — bankalar */
export async function listPaymentBanks(): Promise<
  { id: string; name: string; logo: string }[]
> {
  const rows = await prisma.banka.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true, kisaAdi: true, logo: true },
  });
  return rows.map((b) => ({
    id: String(b.id),
    name: (b.adi || b.kisaAdi || `Banka #${b.id}`).trim(),
    logo: bankLogoUrl(b.logo),
  }));
}
