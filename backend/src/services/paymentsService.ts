import { randomBytes } from 'node:crypto';
import {
  getGatewayById,
  initiateThreeD,
  pickGateway,
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
import { listBins, lookupBinByCard, segmentFromBinKind, segmentLabelTr } from './binsService.js';
import { assertInstallmentsAllowed, UsersError } from './usersService.js';
import { fetchRemoteBanks, getBinSourceSettings, startCentralPayment } from './binSourceSettingsService.js';
import { writePanelLog } from './logsService.js';
import { SettingsError } from './settingsService.js';

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsError';
  }
}

export type CreatePaymentInput = {
  musteriId: number | null;
  payType: 'ch' | 'fatura' | 'serbest';
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
  /** Public ödeme isteği token — 3DS sonrası isteği kapatmak için */
  istekNo?: string | null;
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
    /** Müşteri (cari) — yoksa kart sahibi */
    customerTitle: string;
    customerAddress: string;
    customerPhone: string;
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

/** Veritabanı ödeme tipi: 0=C/H, 1=serbest, 2=fatura. */
function tipFromPayType(payType: 'ch' | 'fatura' | 'serbest'): number {
  return payType === 'fatura' ? 2 : payType === 'serbest' ? 1 : 0;
}

/** POS fiş: 5218 **** **** 9313 (ilk 4 + son 4) */
function maskCard(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 8) return '*'.repeat(Math.min(d.length, 16));
  return `${d.slice(0, 4)} **** **** ${d.slice(-4)}`;
}

/** T.C.: 123******90 */
function maskIdentity(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 5) return '*'.repeat(d.length);
  return `${d.slice(0, 3)}${'*'.repeat(Math.max(0, d.length - 5))}${d.slice(-2)}`;
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

export { maskCard, maskIdentity, maskPhone };

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

/** Ödeme meta — taksitDetay / bankaCevabi JSON’dan kart segmenti + marka (+ tahsil/bloke) */
export function parseCardBinMeta(
  taksitDetay: string | null | undefined,
  bankaCevabi?: string | null,
): { cardSegment: string; cardBrand: string; collectionDay: string; blockDay: string } {
  const empty = { cardSegment: '', cardBrand: '', collectionDay: '', blockDay: '' };
  const read = (raw: string | null | undefined) => {
    if (!raw?.trim()) return { ...empty };
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const segRaw = String(j.cardSegment ?? j.segment ?? '').trim();
      const brand = String(j.cardBrand ?? j.brand ?? '').trim();
      let cardSegment = '';
      if (segRaw === 'ticari' || /^ticari$/i.test(segRaw)) cardSegment = 'Ticari';
      else if (segRaw === 'bireysel' || /^bireysel$/i.test(segRaw)) cardSegment = 'Bireysel';
      else if (/ticari/i.test(segRaw)) cardSegment = 'Ticari';
      else if (/bireysel/i.test(segRaw)) cardSegment = 'Bireysel';
      else if (segRaw === 'Ticari' || segRaw === 'Bireysel') cardSegment = segRaw;
      return {
        cardSegment,
        cardBrand: brand,
        collectionDay: String(j.collectionDay ?? j.tahsilGunu ?? '').trim(),
        blockDay: String(j.blockDay ?? j.blokeGunu ?? '').trim(),
      };
    } catch {
      return { ...empty };
    }
  };
  const fromDetay = read(taksitDetay);
  if (fromDetay.cardSegment || fromDetay.cardBrand || fromDetay.collectionDay || fromDetay.blockDay) {
    return fromDetay;
  }
  return read(bankaCevabi);
}

function readSettlementMeta(taksitDetay: string | null | undefined): {
  snapshotted: boolean;
  repaired: boolean;
} {
  if (!taksitDetay?.trim()) return { snapshotted: false, repaired: false };
  try {
    const j = JSON.parse(taksitDetay) as Record<string, unknown>;
    return {
      snapshotted: j.settlementSnapshotted === true,
      repaired: j.settlementRepaired === true,
    };
  } catch {
    return { snapshotted: false, repaired: false };
  }
}

/**
 * Snapshot yok / boş / (yanlış kaynakla kilitlenmiş 0/0) → bir kez anlaşmadan doldur.
 * settlementRepaired sonrası bir daha dokunulmaz (meşru 0/0 dahil).
 */
function needsSettlementBackfill(
  tahsilGunu: string | null | undefined,
  blokeGunu: string | null | undefined,
  taksitDetay: string | null | undefined,
): boolean {
  const meta = readSettlementMeta(taksitDetay);
  if (meta.repaired) return false;
  const a = (tahsilGunu || '').trim();
  const b = (blokeGunu || '').trim();
  if (!a && !b) return true;
  if (a === '0' && b === '0') return true;
  if (meta.snapshotted) return false;
  return false;
}

function mergeSettlementIntoDetay(
  taksitDetay: string | null | undefined,
  collectionDay: string,
  blockDay: string,
): string | null {
  const base: Record<string, unknown> = {};
  if (taksitDetay?.trim()) {
    try {
      Object.assign(base, JSON.parse(taksitDetay) as Record<string, unknown>);
    } catch {
      /* bozuk JSON — yeni meta yaz */
    }
  }
  base.collectionDay = collectionDay;
  base.blockDay = blockDay;
  base.settlementSnapshotted = true;
  base.settlementRepaired = true;
  return JSON.stringify(base);
}

/** iptal_iade_hareket JSON → detay satırları (kronolojik: ÖDEME + İPTAL/İADE) */
function buildOperationHistory(
  r: {
    durum: number;
    iptalIadeHareket: string | null;
    tarih: Date | null;
    tutar: number;
  },
  referenceNo: string,
  authCode: string,
): PublicPaymentRow['detail']['operationHistory'] {
  const at = r.tarih ? r.tarih.toISOString() : new Date(0).toISOString();
  const amount = Number(r.tutar) || 0;
  const st = statusOf(r.durum, r.iptalIadeHareket);
  const out: PublicPaymentRow['detail']['operationHistory'] = [];

  if (st === 'paid' || st === 'cancelled' || st === 'refunded') {
    out.push({
      at,
      operation: 'ÖDEME',
      status: 'BAŞARILI',
      amount,
      referenceNo,
      authCode,
    });
  } else if (st === 'pending') {
    out.push({
      at,
      operation: 'ÖDEME',
      status: 'BEKLEMEDE',
      amount,
      referenceNo,
      authCode,
    });
  } else {
    out.push({
      at,
      operation: 'ÖDEME',
      status: 'BAŞARISIZ',
      amount,
      referenceNo,
      authCode,
    });
  }

  let prev: Array<{
    tip?: string;
    tarih?: string;
    bankRef?: string;
    bankCode?: string;
    bankSuccess?: boolean;
  }> = [];
  if (r.iptalIadeHareket) {
    try {
      const parsed = JSON.parse(r.iptalIadeHareket) as unknown;
      if (Array.isArray(parsed)) prev = parsed as typeof prev;
    } catch {
      prev = [];
    }
  }
  // Kayıt newest-first → ekranda eski→yeni
  for (const e of [...prev].reverse()) {
    const tip = String(e.tip ?? '1');
    out.push({
      at: typeof e.tarih === 'string' && e.tarih.trim() ? e.tarih : at,
      operation: tip === '2' ? 'İADE' : 'İPTAL',
      status: e.bankSuccess === false ? 'BAŞARISIZ' : 'TAMAMLANDI',
      amount,
      referenceNo: (e.bankRef || referenceNo || '').trim(),
      authCode: (e.bankCode || authCode || '').trim(),
    });
  }
  // Eski iptaller: durum=2 ama iptal_iade_hareket boş → yine ikinci satır
  if (prev.length === 0 && (st === 'cancelled' || st === 'refunded')) {
    out.push({
      at,
      operation: st === 'refunded' ? 'İADE' : 'İPTAL',
      status: 'TAMAMLANDI',
      amount,
      referenceNo,
      authCode,
    });
  }
  return out;
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
  taksitDetay: string | null;
  odemeTipi: number;
};

async function merchantDefaults() {
  const [ayar, iletisim] = await Promise.all([
    prisma.ayarlar.findFirst({ orderBy: { id: 'asc' } }),
    prisma.iletisimBilgileri.findFirst({ orderBy: { id: 'asc' } }),
  ]);
  const title = (iletisim?.unvan || ayar?.sistemAdi || '').trim() || '—';
  const address = (iletisim?.adres || '').trim() || '—';

  // POS alt satır: vergi dairesi + VN/TC; yoksa telefon/GSM (iletisim_bilgileri)
  let taxOffice = '';
  if (iletisim?.vdId != null) {
    const vd = await prisma.vergiDairesi.findFirst({
      where: { id: iletisim.vdId },
      select: { adi: true },
    });
    taxOffice = (vd?.adi || '').trim();
  }
  const taxNo = (iletisim?.vn || '').trim();
  const taxLine = [taxOffice, taxNo].filter(Boolean).join(' ');
  const phone = (iletisim?.telefon || iletisim?.gsm || '').trim();
  const merchantPhone = taxLine || phone || '—';

  return { merchantTitle: title, merchantAddress: address, merchantPhone };
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

  const [musteriler, users, branches, banks, binRows] = await Promise.all([
    musteriIds.length
      ? prisma.musteri.findMany({
          where: { id: { in: musteriIds } },
          select: { id: true, unvan: true, adres: true, telefon: true },
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
    listBins().catch(() => []),
  ]);

  const mMap = new Map(musteriler.map((m) => [m.id, m]));
  const uMap = new Map(users.map((u) => [u.id, u]));
  const bMap = new Map(branches.map((b) => [b.id, b]));
  const bankMap = new Map(banks.map((b) => [b.id, b]));

  const matchBinPrefix = (digits: string) => {
    const d = digits.replace(/\D/g, '');
    if (d.length < 4) return null;
    let best: (typeof binRows)[number] | null = null;
    for (const row of binRows) {
      if (d.startsWith(row.bin) && (!best || row.bin.length > best.bin.length)) best = row;
    }
    return best;
  };

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
    let cardBin = parseCardBinMeta(r.taksitDetay, r.bankaCevabi);
    if (!cardBin.cardSegment && !cardBin.cardBrand) {
      const hit = matchBinPrefix((r.kartNo || '').trim());
      if (hit) {
        cardBin = {
          ...cardBin,
          cardSegment: segmentLabelTr(segmentFromBinKind(hit.kind)) || '',
          cardBrand: (hit.brand || '').trim(),
        };
      }
    }
    const customerCommission = Math.max(0, amount - Number(r.gercekTutar ?? r.tutar ?? 0));
    const collectionDay =
      (r.tahsilGunu || '').trim() || cardBin.collectionDay || '';
    const blockDay = (r.blokeGunu || '').trim() || cardBin.blockDay || '';

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
        customerTitle: (m?.unvan || r.adsoyad || '').trim() || '—',
        customerAddress: (m?.adres || '').replace(/\s+/g, ' ').trim(),
        customerPhone: maskPhone(((m?.telefon || '').trim() || phone)),
        cardHolderName: (r.adsoyad || '').trim() || '—',
        cardHolderPhoneMasked: maskPhone(phone),
        cardHolderPhone: maskPhone(phone),
        identityNo: maskIdentity((r.tc || '').trim()),
        description: (r.aciklama || '').trim() || '—',
        referenceNo,
        transactionNo: r.odemeNo || String(r.id),
        authCode,
        cardMasked: maskCard((r.kartNo || '').trim()),
        cardSegment: cardBin.cardSegment || '—',
        cardBrand: cardBin.cardBrand || '—',
        threeDSecure: true,
      },
      detail: {
        amount: Number(r.tutar) || 0,
        commissionIncluded: Boolean(r.komisyonDahil),
        customerCommission,
        bankCommission: commission,
        ip: (r.ip || '').trim(),
        collectionDay,
        blockDay,
        referenceNo,
        authCode,
        operationHistory: buildOperationHistory(r, referenceNo, authCode),
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
  /** Log / teşhis: merkezi API mi yerel POS mu */
  paymentSource: 'central' | 'local';
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

  // --- Ödeme yolu seçimi (A modeli) ---
  // local  = Api kapalı → aşağıdaki else dalı (resolvePos + initiateThreeD). DOKUNMA.
  // central = Api açık → startCentralPayment; ağır POS/3DS merkezde, kayıt bu fonksiyonda.
  const sourceSettings = await getBinSourceSettings();
  const paymentSource = sourceSettings.source === 'remote' ? 'central' : 'local';
  console.info(`[payment-route] source=${paymentSource} result=selected`);

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

  const now = new Date();
  const odemeNo = makeOdemeNo();
  const installment = input.installment > 0 ? input.installment : 1;
  const apiBase = publicApiBase();

  // Vade farkı: kart BIN bankası (UI / Taksit Seçenekleri ile aynı). POS yalnızca geçit.
  // Tahsil/bloke: ödeme anında anlaşmadan snapshot; sonraki anlaşma değişimi eski hareketi etkilemez.
  let commissionPct = 0;
  let cardSegment: 'bireysel' | 'ticari' | null = null;
  let cardBrand = '';
  let collectionDay: string | null = null;
  let blockDay: string | null = null;
  let settlementLocked = false;
  try {
    const cardBank = await lookupBinByCard(digits);
    cardSegment = cardBank?.segment ?? null;
    cardBrand = (cardBank?.brand || '').trim();
    const code = await getCustomerAgreementCode(input.musteriId);
    const rates = await resolveAgreementRates({
      agreementCode: code,
      bankId: cardBank?.bankId ?? null,
      bankName: cardBank?.bankName ?? null,
      // BIN Tür (ticari/bireysel); yoksa bireysel
      segment: cardBank?.segment ?? 'bireysel',
      amount: input.amount,
    });
    const hit = rates.rows.find((r) => r.n === installment);
    if (hit) {
      commissionPct = hit.commissionPct;
      collectionDay = String(hit.collectionDay ?? '0').trim() || '0';
      blockDay = String(hit.blockDay ?? '0').trim() || '0';
      settlementLocked = true;
    }
  } catch {
    /* oran yoksa tahsil/bloke boş kalsın; detayda bir kez backfill denenebilir */
  }

  const cardBinMeta = JSON.stringify({
    cardSegment,
    cardBrand,
    cardSegmentLabel: segmentLabelTr(cardSegment),
    ...(collectionDay != null ? { collectionDay } : {}),
    ...(blockDay != null ? { blockDay } : {}),
    settlementSnapshotted: settlementLocked,
    settlementRepaired: settlementLocked,
  });

  const chargedAmount = input.commissionIncluded
    ? input.amount * (1 + commissionPct / 100)
    : input.amount;

  const istekNo = (input.istekNo || '').trim() || null;

  // ========== Api AÇIK (central) — yerel else'e dokunma ==========
  // Callback merkezde odemeler.durum=3 arar; 3DS'ten ÖNCE kayıt yazılmalı (yarış riski).
  if (paymentSource === 'central') {
    const cardBank = await lookupBinByCard(digits).catch(() => null);
    let centralBankName = '';
    if (input.bankId != null) {
      let remoteBanks;
      try {
        remoteBanks = await fetchRemoteBanks();
      } catch (err) {
        if (err instanceof SettingsError) throw new PaymentsError(err.message);
        throw err;
      }
      const selected = remoteBanks.find((bank) => bank.id === String(input.bankId));
      if (!selected) {
        await writePanelLog(
          input.kullaniciId,
          `Ödeme - Merkezi API HATA · #${odemeNo} · seçilen banka merkez kataloğunda yok`,
        );
        throw new PaymentsError('Seçilen banka merkez kataloğunda bulunamadı');
      }
      centralBankName = selected.name;
    } else centralBankName = cardBank?.bankName || '';
    if (!centralBankName) {
      await writePanelLog(
        input.kullaniciId,
        `Ödeme - Merkezi API HATA · #${odemeNo} · kart bankası merkez kataloğunda yok`,
      );
      throw new PaymentsError('Kart bankası merkez kataloğunda bulunamadı');
    }

    // Geçici banka id — merkez start sonrası gerçek POS bankId ile güncellenir
    const provisionalBankId =
      (typeof input.bankId === 'number' && Number.isFinite(input.bankId) ? input.bankId : null) ??
      cardBank?.bankId ??
      null;

    const pendingMeta = JSON.stringify({
      source: 'central',
      stage: 'awaiting-3ds-start',
      startedAt: now.toISOString(),
      commissionPct,
      cardSegment,
      cardBrand,
      ...(istekNo ? { istekNo } : {}),
    });

    const pendingRow = await prisma.odeme.create({
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
        taksitDetay: cardBinMeta,
        bankaKomisyonu: commissionPct || null,
        tahsilGunu: collectionDay?.slice(0, 255) ?? null,
        blokeGunu: blockDay?.slice(0, 255) ?? null,
        odemeNo,
        durum: 3,
        bankaCevabi: pendingMeta,
        odemeTipi: tipFromPayType(input.payType),
        tarih: now,
        kullaniciId: input.kullaniciId,
        bankaId: provisionalBankId,
        sanalposBankaId: provisionalBankId,
        ip: (input.clientIp || '').slice(0, 255) || null,
        arsiv: false,
        istekNo,
      },
    });

    let central;
    try {
      central = await startCentralPayment({
        orderId: odemeNo,
        bankName: centralBankName,
        amount: chargedAmount,
        // Merkez ISO kod ister; eski UI'da TL → TRY
        currencyCode: currency.shortName?.trim().toUpperCase() === 'TL'
          ? 'TRY'
          : currency.shortName || 'TRY',
        installment,
        card: { number: digits, holder: input.holder.trim(), expiry, cvc },
        clientIp: input.clientIp,
        email: (input.email || customerEmail || '').trim() || undefined,
        istekNo: istekNo || undefined,
      });
    } catch (err) {
      // Merkez start başarısız → bekleyen kayıt asılı kalmasın
      const msg = err instanceof SettingsError ? err.message : err instanceof Error ? err.message : 'Merkezi ödeme başlatılamadı';
      await prisma.odeme.update({
        where: { id: pendingRow.id },
        data: {
          durum: 0,
          bankError: msg.slice(0, 2000),
          bankaCevabi: JSON.stringify({
            source: 'central',
            stage: '3ds-initiation',
            result: 'rejected',
            at: new Date().toISOString(),
            message: msg.slice(0, 500),
          }),
        },
      }).catch(() => undefined);
      await writePanelLog(
        input.kullaniciId,
        `Ödeme - Merkezi API HATA · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${msg.slice(0, 400)}`,
      );
      console.info('[payment-flow] source=central stage=3ds-initiation result=rejected');
      if (err instanceof SettingsError) throw new PaymentsError(err.message);
      throw err;
    }

    const readyMeta = JSON.stringify({
      source: 'central',
      adapter: central.adapter,
      posId: central.posId,
      centralSessionId: central.sessionId,
      startedAt: now.toISOString(),
      commissionPct,
      cardSegment,
      cardBrand,
      ...(istekNo ? { istekNo } : {}),
    });

    const row = await prisma.odeme.update({
      where: { id: pendingRow.id },
      data: {
        bankaId: central.bankId,
        sanalposBankaId: central.bankId,
        bankaCevabi: readyMeta,
      },
    });

    await writePanelLog(
      input.kullaniciId,
      `Ödeme - Merkezi API · 3DS başlatıldı · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${central.bankName} · session=${central.sessionId}`,
    );
    console.info(
      `[payment-flow] source=central stage=payment-record result=pending-3ds adapter=${central.adapter}`,
    );

    return {
      id: row.id,
      odemeNo: row.odemeNo,
      musteriId: row.musteriId,
      amount: row.tutar,
      durum: row.durum,
      tarih: row.tarih ? row.tarih.toISOString() : null,
      status: 'pending_3d',
      bankName: central.bankName,
      paymentSource: 'central',
      threeD: central.form,
    };
  }

  // ========== Api KAPALI (local) — yerel POS motoru; create-before-3DS (merkez ile aynı yarış koruması) ==========
  // Çift tıklama / aynı istek için ikinci 3DS oturumu engeli
  if (istekNo) {
    const live = await prisma.odeme.findFirst({
      where: { istekNo, durum: 3 },
      select: { odemeNo: true },
      orderBy: { id: 'desc' },
    });
    if (live) {
      throw new PaymentsError(
        `Bu ödeme isteği için zaten devam eden bir 3D oturumu var (#${live.odemeNo})`,
      );
    }
  }

  let pos: Awaited<ReturnType<typeof resolvePosForPayment>>;
  try {
    pos = await resolvePosForPayment({ cardDigits: digits, bankId: input.bankId ?? null });
  } catch (err) {
    const msg = err instanceof PosResolveError ? err.message : err instanceof Error ? err.message : 'POS çözülemedi';
    await writePanelLog(
      input.kullaniciId,
      `Ödeme - Yerel POS HATA · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${msg.slice(0, 400)}`,
    );
    if (err instanceof PosResolveError) throw new PaymentsError(err.message);
    throw err;
  }

  const pendingMeta = JSON.stringify({
    source: 'local',
    stage: 'awaiting-3ds-start',
    posId: pos.posId,
    securityType: pos.securityType || '',
    startedAt: now.toISOString(),
    commissionPct,
    cardSegment,
    cardBrand,
    ...(istekNo ? { istekNo } : {}),
  });

  const pendingRow = await prisma.odeme.create({
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
      taksitDetay: cardBinMeta,
      bankaKomisyonu: commissionPct || null,
      tahsilGunu: collectionDay?.slice(0, 255) ?? null,
      blokeGunu: blockDay?.slice(0, 255) ?? null,
      odemeNo,
      durum: 3,
      bankaCevabi: pendingMeta,
      odemeTipi: tipFromPayType(input.payType),
      tarih: now,
      kullaniciId: input.kullaniciId,
      bankaId: pos.bankId,
      sanalposBankaId: pos.bankId,
      ip: (input.clientIp || '').slice(0, 255) || null,
      arsiv: false,
      istekNo,
    },
  });

  let threeDResult: { kind: 'form'; form: ThreeDForm; adapter: string } | { kind: 'error'; message: string };
  try {
    threeDResult = await initiateThreeD({
      pos,
      orderId: odemeNo,
      amount: chargedAmount,
      currencyCode: currency.shortName || 'TRY',
      installment,
      card: { number: digits, holder: input.holder.trim(), expiry, cvc },
      okUrl: `${apiBase}/api/payments/3d/ok`,
      failUrl: `${apiBase}/api/payments/3d/fail`,
      clientIp: input.clientIp,
      email: (input.email || customerEmail || '').trim() || undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '3D Secure başlatılamadı';
    await prisma.odeme
      .update({
        where: { id: pendingRow.id },
        data: {
          durum: 0,
          bankError: msg.slice(0, 2000),
          bankaCevabi: JSON.stringify({
            source: 'local',
            stage: '3ds-initiation',
            result: 'error',
            at: new Date().toISOString(),
            message: msg.slice(0, 500),
          }),
        },
      })
      .catch(() => undefined);
    await writePanelLog(
      input.kullaniciId,
      `Ödeme - Yerel POS HATA · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${msg.slice(0, 400)}`,
    );
    throw new PaymentsError(msg);
  }

  if (threeDResult.kind === 'error') {
    await prisma.odeme
      .update({
        where: { id: pendingRow.id },
        data: {
          durum: 0,
          bankError: threeDResult.message.slice(0, 2000),
          bankaCevabi: JSON.stringify({
            source: 'local',
            stage: '3ds-initiation',
            result: 'rejected',
            at: new Date().toISOString(),
            message: threeDResult.message.slice(0, 500),
          }),
        },
      })
      .catch(() => undefined);
    await writePanelLog(
      input.kullaniciId,
      `Ödeme - Yerel POS HATA · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${threeDResult.message.slice(0, 400)}`,
    );
    console.info(`[payment-flow] source=local stage=3ds-initiation result=rejected`);
    throw new PaymentsError(threeDResult.message);
  }

  const readyMeta = JSON.stringify({
    source: 'local',
    adapter: threeDResult.adapter,
    posId: pos.posId,
    securityType: pos.securityType || '',
    startedAt: now.toISOString(),
    commissionPct,
    cardSegment,
    cardBrand,
    ...(istekNo ? { istekNo } : {}),
  });

  const row = await prisma.odeme.update({
    where: { id: pendingRow.id },
    data: { bankaCevabi: readyMeta },
  });

  await writePanelLog(
    input.kullaniciId,
    `Ödeme - Yerel POS · 3DS başlatıldı · #${odemeNo} · ${chargedAmount.toFixed(2)} · ${pos.bankName} · adapter=${threeDResult.adapter}`,
  );
  console.info(
    `[payment-flow] source=local stage=payment-record result=pending-3ds adapter=${threeDResult.adapter}`,
  );

  return {
    id: row.id,
    odemeNo: row.odemeNo,
    musteriId: row.musteriId,
    amount: row.tutar,
    durum: row.durum,
    tarih: row.tarih ? row.tarih.toISOString() : null,
    status: 'pending_3d',
    bankName: pos.bankName,
    paymentSource: 'local',
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

  // Snapshot kilitliyse kayıtlı değeri göster. Yalnızca boş / eski 0/0 → bir kez anlaşmadan doldur + kilitle.
  if (needsSettlementBackfill(row.tahsilGunu, row.blokeGunu, row.taksitDetay)) {
    try {
      const digits = (row.kartNo || '').replace(/\D/g, '');
      const cardBank = digits.length >= 6 ? await lookupBinByCard(digits).catch(() => null) : null;
      const meta = parseCardBinMeta(row.taksitDetay, row.bankaCevabi);
      const segFromMeta =
        meta.cardSegment === 'Ticari'
          ? ('ticari' as const)
          : meta.cardSegment === 'Bireysel'
            ? ('bireysel' as const)
            : null;
      const code = await getCustomerAgreementCode(row.musteriId);
      const rates = await resolveAgreementRates({
        agreementCode: code,
        bankId: cardBank?.bankId ?? row.bankaId ?? row.sanalposBankaId ?? null,
        bankName: cardBank?.bankName ?? null,
        segment: cardBank?.segment ?? segFromMeta ?? 'bireysel',
        amount: Number(row.tutar) || hit.amount || 1,
      });
      const n = row.taksit && row.taksit > 0 ? row.taksit : 1;
      const rate = rates.rows.find((r) => r.n === n) ?? rates.rows[0];
      if (rate) {
        const collectionDay = String(rate.collectionDay ?? '0').trim() || '0';
        const blockDay = String(rate.blockDay ?? '0').trim() || '0';
        hit.detail.collectionDay = collectionDay;
        hit.detail.blockDay = blockDay;
        const nextDetay = mergeSettlementIntoDetay(row.taksitDetay, collectionDay, blockDay);
        await prisma.odeme
          .update({
            where: { id: row.id },
            data: {
              tahsilGunu: collectionDay.slice(0, 255),
              blokeGunu: blockDay.slice(0, 255),
              ...(nextDetay ? { taksitDetay: nextDetay } : {}),
            },
          })
          .catch(() => undefined);
      }
    } catch {
      /* anlaşma yoksa kayıtlı / boş kalsın */
    }
  }

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
  const kind = asVoid ? ('void' as const) : ('refund' as const);

  // Banka iptal/iade (adapter reverse varsa) — yoksa yalnızca ledger
  let bankReverse: {
    success: boolean;
    message: string;
    responseCode?: string;
    referenceCode?: string;
  } | null = null;
  const bankId = row.bankaId ?? row.sanalposBankaId;
  let adapterId = '';
  let paymentMeta: {
    source?: string;
    adapter?: string;
    referenceCode?: string;
    bankOrderId?: string;
    authCode?: string;
    centralSessionId?: string;
  } = {};
  if (row.bankaCevabi) {
    try {
      paymentMeta = JSON.parse(row.bankaCevabi) as typeof paymentMeta;
      if (paymentMeta.adapter) adapterId = paymentMeta.adapter;
    } catch {
      /* */
    }
  }

  // Merkez oturumu — banka reverse merkez API üzerinden
  const reverseViaCentral = async () => {
    try {
      const { reverseCentralPayment } = await import('./binSourceSettingsService.js');
      const central = await reverseCentralPayment({
        orderId: row.odemeNo,
        kind,
        amount: Number(row.gercekTutar ?? row.tutar) || undefined,
        referenceCode: paymentMeta.referenceCode,
        bankOrderId: paymentMeta.bankOrderId,
        clientIp: row.ip || undefined,
      });
      bankReverse = {
        success: central.success,
        message: central.message,
        responseCode: central.responseCode,
        referenceCode: central.referenceCode,
      };
      if (!central.success) {
        await writePanelLog(
          actorUserId,
          `Ödeme - Merkezi API HATA · iptal/iade · #${row.odemeNo} · ${central.message.slice(0, 400)}`,
        );
        throw new PaymentsError(central.message || 'Merkezi iptal/iade reddetti');
      }
      await writePanelLog(
        actorUserId,
        `Ödeme - Merkezi API · ${kind === 'void' ? 'iptal' : 'iade'} · #${row.odemeNo}`,
      );
    } catch (err) {
      if (err instanceof PaymentsError) throw err;
      if (err instanceof SettingsError) throw new PaymentsError(err.message);
      throw err;
    }
  };

  // Para iadesi bankaya gitmeden hareketi "iptal/iade" yapma: banka onayı şart
  const noBankMsg =
    'Banka iptal/iade işlemi yapılamadı: bu ödemenin sanal POS bilgisi bulunamadı. Hareket iptal edilmedi.';

  if (paymentMeta.source === 'central' || paymentMeta.centralSessionId) {
    await reverseViaCentral();
  } else if (bankId != null) {
    try {
      const pos = await resolvePosForPayment({
        bankId,
        cardDigits: '0000000000000000',
      });
      const gw = (adapterId ? getGatewayById(adapterId) : null) ?? pickGateway(pos);
      if (!gw?.reverse) {
        throw new PaymentsError(
          'Bu sanal POS altyapısı için otomatik iptal/iade desteklenmiyor. Hareket iptal edilmedi; işlemi bankanın panelinden yapın.',
        );
      }
      const result = await gw.reverse({
        pos,
        orderId: row.odemeNo,
        kind,
        amount: Number(row.gercekTutar ?? row.tutar) || undefined,
        clientIp: row.ip || undefined,
        referenceCode: paymentMeta.referenceCode,
        bankOrderId: paymentMeta.bankOrderId || row.odemeNo,
      });
      bankReverse = {
        success: result.success,
        message: result.message,
        responseCode: result.responseCode,
        referenceCode: result.referenceCode,
      };
      if (!result.success) {
        await writePanelLog(
          actorUserId,
          `Ödeme - Yerel POS HATA · iptal/iade · #${row.odemeNo} · ${result.message.slice(0, 400)}`,
        );
        throw new PaymentsError(result.message || 'Banka iptal/iade reddetti');
      }
      await writePanelLog(
        actorUserId,
        `Ödeme - Yerel POS · ${kind === 'void' ? 'iptal' : 'iade'} · #${row.odemeNo} · adapter=${gw.id}`,
      );
    } catch (err) {
      if (err instanceof PaymentsError) throw err;
      if (err instanceof PosResolveError) {
        console.info(`[payment-reverse] pos-resolve-fail: ${err.message}`);
        // Merkez yazdığı kayıtta kaynak bilgisi olmayabilir: merkez açıksa orada dene
        const { isCentralRemoteActive } = await import('./binSourceSettingsService.js');
        if (await isCentralRemoteActive()) await reverseViaCentral();
        else throw new PaymentsError(noBankMsg);
      } else {
        throw err;
      }
    }
  } else {
    throw new PaymentsError(noBankMsg);
  }

  const entry = {
    tip,
    tarih: new Date().toISOString(),
    kullaniciId: actorUserId,
    ...(bankReverse
      ? {
          bankSuccess: bankReverse.success,
          bankMessage: bankReverse.message,
          bankCode: bankReverse.responseCode,
          bankRef: bankReverse.referenceCode,
        }
      : { bankSkipped: true }),
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
export async function listPaymentBanks(opts?: {
  /** Ortak Sanal POS kaynak bankalarını gizle (Taksit Seçenekleri) */
  excludeRedirectedSources?: boolean;
}): Promise<{ id: string; name: string; logo: string }[]> {
  const rows = await prisma.banka.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true, kisaAdi: true, logo: true },
  });
  let list = rows.map((b) => ({
    id: String(b.id),
    name: (b.adi || b.kisaAdi || `Banka #${b.id}`).trim(),
    logo: bankLogoUrl(b.logo),
  }));
  if (opts?.excludeRedirectedSources) {
    const { listRedirectedSourceBankIds } = await import('./commonVirtualPosService.js');
    const redirected = await listRedirectedSourceBankIds();
    if (redirected.size) {
      list = list.filter((b) => !redirected.has(Number(b.id)));
    }
  }
  return list;
}

// ---------- Hareketleri toplu silme (Log Kayıtları'ndaki gibi kapsam seçerek) ----------

export type DeletePaymentsScope = 'day' | 'day2' | 'week' | 'month' | 'range' | 'all';

const DELETE_SCOPE_DAYS: Record<string, number> = { day: 1, day2: 2, week: 7, month: 30 };

const DELETE_SCOPE_LABEL: Record<DeletePaymentsScope, string> = {
  day: 'Son 1 Gün',
  day2: 'Son 2 Gün',
  week: 'Son 1 Hafta',
  month: 'Son 1 Ay',
  range: 'Tarih Aralığı',
  all: 'Tüm Kayıtlar',
};

async function paymentsInDeleteScope(input: {
  scope: DeletePaymentsScope;
  from?: string;
  to?: string;
}) {
  const and: Record<string, unknown>[] = [];
  const days = DELETE_SCOPE_DAYS[input.scope];
  if (days) {
    and.push({ tarih: { gte: new Date(Date.now() - days * 86_400_000) } });
  } else if (input.scope === 'range') {
    const isoDay = /^\d{4}-\d{2}-\d{2}$/;
    if (!input.from || !input.to || !isoDay.test(input.from) || !isoDay.test(input.to)) {
      throw new PaymentsError('Geçerli tarih aralığı seçin');
    }
    const from = parseDayStart(input.from);
    const to = parseDayEnd(input.to);
    if (from.getTime() > to.getTime()) throw new PaymentsError('Başlangıç bitişten sonra olamaz');
    and.push({ tarih: { gte: from, lte: to } });
  } else if (input.scope !== 'all') {
    throw new PaymentsError('Geçersiz silme kapsamı');
  }
  // Bankada devam eden 3D oturumu (son 1 saat) silinmez — dönüşte kayıt bulunamaz
  and.push({
    NOT: { AND: [{ durum: 3 }, { tarih: { gte: new Date(Date.now() - 3_600_000) } }] },
  });
  return prisma.odeme.findMany({
    where: { AND: and },
    select: { id: true, durum: true, gercekTutar: true, tutar: true },
  });
}

/** Silmeden önce kaç hareket etkilenecek (ödenmiş olanlar ayrıca) */
export async function previewDeletePayments(input: {
  scope: DeletePaymentsScope;
  from?: string;
  to?: string;
}): Promise<{ count: number; paid: number; paidAmount: number }> {
  const rows = await paymentsInDeleteScope(input);
  const paid = rows.filter((r) => r.durum === 1);
  return {
    count: rows.length,
    paid: paid.length,
    paidAmount: paid.reduce((sum, r) => sum + (Number(r.gercekTutar ?? r.tutar) || 0), 0),
  };
}

export async function deletePayments(
  actorUserId: number,
  input: { scope: DeletePaymentsScope; from?: string; to?: string },
): Promise<{ deleted: number; paid: number }> {
  const rows = await paymentsInDeleteScope(input);
  if (!rows.length) return { deleted: 0, paid: 0 };
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 1000) {
    await prisma.odeme.deleteMany({ where: { id: { in: ids.slice(i, i + 1000) } } });
  }
  const paid = rows.filter((r) => r.durum === 1).length;
  const label =
    input.scope === 'range'
      ? `${input.from} / ${input.to} Aralığı`
      : DELETE_SCOPE_LABEL[input.scope];
  await writePanelLog(
    actorUserId,
    `Hareketler - ${label} Silindi · ${ids.length} kayıt (${paid} ödenmiş)`,
  );
  return { deleted: ids.length, paid };
}
