import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { CurrenciesError, resolveCurrencyId } from './currenciesService.js';
import { createPayment, PaymentsError } from './paymentsService.js';
import { resolveAllowedInstallments } from './installmentPriorityService.js';
import { assertInstallmentsAllowed, UsersError } from './usersService.js';
import {
  parsePayRequestFiles,
  type PayRequestFile,
} from './payRequestFilesService.js';

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
  parabirimiId?: number | null;
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
  files: PayRequestFile[];
  currencyId: string;
  currencySymbol: string;
  currencyShortName: string;
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
  files: PayRequestFile[];
  currencyId: string;
  currencySymbol: string;
  currencyShortName: string;
  accountTypeId: number | null;
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
  parabirimiId: number;
  odemeTipi: number;
  tutar: number;
  komisyonDahil: boolean;
  taksitler: string | null;
  aciklama: string | null;
  dosya: string | null;
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
  const currencyIds = [...new Set(rows.map((r) => r.parabirimiId).filter((x) => Number.isFinite(x)))];

  const [musteriler, users, branches, currencies] = await Promise.all([
    musteriIds.length
      ? prisma.musteri.findMany({
          where: { id: { in: musteriIds } },
          select: { id: true, unvan: true, telefon: true, eposta: true, cariTipiId: true },
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
    currencyIds.length
      ? prisma.parabirimi.findMany({
          where: { id: { in: currencyIds } },
          select: { id: true, sembol: true, kisaAdi: true },
        })
      : Promise.resolve([]),
  ]);

  const mMap = new Map(musteriler.map((m) => [m.id, m]));
  const uMap = new Map(users.map((u) => [u.id, u]));
  const bMap = new Map(branches.map((b) => [b.id, b]));
  const cMap = new Map(currencies.map((c) => [c.id, c]));

  return rows.map((r) => {
    const m = r.musteriId != null ? mMap.get(r.musteriId) : undefined;
    const u = r.kullaniciId != null ? uMap.get(r.kullaniciId) : undefined;
    const b = r.subeDepartmanId != null ? bMap.get(r.subeDepartmanId) : undefined;
    const c = cMap.get(r.parabirimiId);
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
      files: parsePayRequestFiles(r.dosya),
      currencyId: String(r.parabirimiId),
      currencySymbol: c?.sembol || '₺',
      currencyShortName: c?.kisaAdi || 'TL',
      accountTypeId: m?.cariTipiId ?? null,
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

  let currency;
  try {
    currency = await resolveCurrencyId(input.parabirimiId ?? null);
  } catch (err) {
    if (err instanceof CurrenciesError) throw new PaymentRequestsError(err.message);
    throw err;
  }

  try {
    const allowed = await resolveAllowedInstallments({
      kullaniciId: input.kullaniciId,
      musteriId: input.musteriId,
    });
    assertInstallmentsAllowed(allowed, input.installments);
  } catch (err) {
    if (err instanceof UsersError) throw new PaymentRequestsError(err.message);
    throw err;
  }

  const istekNo = makeIstekNo();
  const now = new Date();
  const row = await prisma.odemeIstegi.create({
    data: {
      parabirimiId: currency.id,
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

  const currency = await prisma.parabirimi.findFirst({
    where: { id: row.parabirimiId },
    select: { id: true, sembol: true, kisaAdi: true },
  });

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
    files: parsePayRequestFiles(row.dosya),
    currencyId: String(row.parabirimiId),
    currencySymbol: currency?.sembol || '₺',
    currencyShortName: currency?.kisaAdi || 'TL',
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
  const taksitOpts = allowed.length ? allowed : [1];
  if (!taksitOpts.includes(input.installment)) {
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
      parabirimiId: row.parabirimiId,
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

export async function getPaymentRequest(id: number): Promise<PublicPaymentRequest> {
  const row = await prisma.odemeIstegi.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!row) throw new PaymentRequestsError('Ödeme isteği bulunamadı');
  const [pub] = await hydrate([row]);
  return pub!;
}

export type UpdatePaymentRequestInput = {
  payType: 'ch' | 'fatura';
  amount: number;
  commissionIncluded: boolean;
  installments: number[];
  description: string;
  faturaNo?: string;
  dosya?: string | null;
  parabirimiId?: number | null;
};

export async function updatePaymentRequest(
  id: number,
  input: UpdatePaymentRequestInput,
): Promise<PublicPaymentRequest> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PaymentRequestsError('Geçerli tutar gerekli');
  }
  if (!input.installments.length) {
    throw new PaymentRequestsError('En az bir taksit seçin');
  }
  const existing = await prisma.odemeIstegi.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true, durum: true, kullaniciId: true, musteriId: true },
  });
  if (!existing) throw new PaymentRequestsError('Ödeme isteği bulunamadı');
  if (existing.durum) throw new PaymentRequestsError('Ödenmiş istek düzenlenemez');

  if (existing.kullaniciId != null) {
    try {
      const allowed = await resolveAllowedInstallments({
        kullaniciId: existing.kullaniciId,
        musteriId: existing.musteriId,
      });
      assertInstallmentsAllowed(allowed, input.installments);
    } catch (err) {
      if (err instanceof UsersError) throw new PaymentRequestsError(err.message);
      throw err;
    }
  }

  let currencyId: number | undefined;
  if (input.parabirimiId != null) {
    try {
      const currency = await resolveCurrencyId(input.parabirimiId);
      currencyId = currency.id;
    } catch (err) {
      if (err instanceof CurrenciesError) throw new PaymentRequestsError(err.message);
      throw err;
    }
  }

  await prisma.odemeIstegi.update({
    where: { id },
    data: {
      ...(currencyId != null ? { parabirimiId: currencyId } : {}),
      odemeTipi: tipFromPayType(input.payType),
      tutar: input.amount,
      faturaNo: (input.faturaNo || '').trim() || null,
      komisyonDahil: input.commissionIncluded,
      taksitler: [...new Set(input.installments)].sort((a, b) => a - b).join(','),
      aciklama: input.description.trim() || null,
      dosya: input.dosya ?? null,
    },
  });

  return getPaymentRequest(id);
}

export async function emailPaymentRequest(
  id: number,
): Promise<{ to: string; emailSent: boolean }> {
  const pub = await getPaymentRequest(id);
  const to = pub.email.trim();
  if (!to) throw new PaymentRequestsError('Müşteri e-postası yok');
  if (pub.status === 'paid') throw new PaymentRequestsError('Bu istek zaten ödenmiş');

  const { sendPaymentRequestMail } = await import('../lib/mail.js');
  const { absolutePayRequestFile } = await import('./payRequestFilesService.js');
  const base =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://tahsilat.anypay.com.tr';
  const payUrl = `${base}/pay/${encodeURIComponent(pub.token)}`;

  const fileLinks = pub.files.map((f) => ({
    name: f.name,
    url: f.url.startsWith('http') ? f.url : `${base}${f.url.startsWith('/') ? '' : '/'}${f.url}`,
  }));
  const attachments = pub.files
    .map((f) => {
      try {
        return { filename: f.name, path: absolutePayRequestFile(f.path) };
      } catch {
        return null;
      }
    })
    .filter((x): x is { filename: string; path: string } => x != null);

  try {
    await sendPaymentRequestMail({
      to,
      customerTitle: pub.customerTitle,
      amount: pub.amount,
      description: pub.description,
      payUrl,
      commissionIncluded: pub.commissionIncluded,
      currencySymbol: pub.currencySymbol,
      files: fileLinks,
      attachments,
    });
    const { recordSendHistory } = await import('./sendHistoryService.js');
    const amountStr = pub.amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const contentLines = [
      `Ödeme isteği — ${amountStr} ${pub.currencySymbol}`,
      pub.commissionIncluded ? 'Komisyon dahil' : 'Komisyon hariç',
      pub.description ? `Açıklama: ${pub.description.slice(0, 200)}` : '',
      `Link: ${payUrl}`,
      ...(fileLinks.length
        ? ['Ekler:', ...fileLinks.map((f) => `- ${f.name}: ${f.url}`)]
        : []),
    ].filter(Boolean);
    await recordSendHistory({
      musteriId: pub.customerId ? Number(pub.customerId) : null,
      type: 'email',
      recipient: to,
      content: contentLines.join('\n'),
      kaynak: 'odeme_istegi',
      refId: id,
      basarili: true,
    });
    return { to, emailSent: true };
  } catch (err) {
    console.error('[payment-request-mail]', err);
    return { to, emailSent: false };
  }
}

/** Ödeme isteği SMS (NetGSM / MutluCell) */
export async function smsPaymentRequest(
  id: number,
): Promise<{ to: string; smsSent: boolean; error?: string }> {
  const pub = await getPaymentRequest(id);
  const to = pub.phone.trim();
  if (!to) throw new PaymentRequestsError('Müşteri telefonu yok');
  if (pub.status === 'paid') throw new PaymentRequestsError('Bu istek zaten ödenmiş');

  const base =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://tahsilat.anypay.com.tr';
  const payUrl = `${base}/pay/${encodeURIComponent(pub.token)}`;
  const amountStr = pub.amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // SMS kapıları ₺ / € / $ gibi sembolleri ? yapar — kısa kod kullan
  const currencyCode = smsCurrencyLabel(pub.currencySymbol, pub.currencyShortName);
  const desc = smsPlainText(pub.description).slice(0, 80);
  const lines = [
    'Guzel Teknoloji',
    'Odeme isteginiz hazir.',
    `Tutar: ${amountStr} ${currencyCode}`,
    pub.commissionIncluded ? 'Komisyon dahil' : null,
    desc || null,
    `Odeme: ${payUrl}`,
  ].filter(Boolean) as string[];
  const message = lines.join('\n');

  try {
    const { dispatchSms } = await import('./smsSettingsService.js');
    const { SettingsError } = await import('./settingsService.js');
    const result = await dispatchSms(to, message);
    const { recordSendHistory } = await import('./sendHistoryService.js');
    await recordSendHistory({
      musteriId: pub.customerId ? Number(pub.customerId) : null,
      type: 'sms',
      recipient: result.to,
      content: message,
      kaynak: 'odeme_istegi',
      refId: id,
      basarili: true,
    });
    return { to: result.to, smsSent: true };
  } catch (err) {
    const { SettingsError } = await import('./settingsService.js');
    const msg =
      err instanceof SettingsError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'SMS gönderilemedi';
    console.error('[payment-request-sms]', err);
    return { to, smsSent: false, error: msg };
  }
}

/** SMS için para birimi — sembol yerine TL/USD… */
function smsCurrencyLabel(symbol?: string, shortName?: string): string {
  const s = (shortName || '').trim().toUpperCase();
  if (s === 'TRY' || s === 'TL' || !s) {
    const sym = (symbol || '').trim();
    if (!sym || sym === '₺' || sym === 'TL' || sym === 'TRY') return 'TL';
  }
  if (s) return s;
  const sym = (symbol || '').trim();
  if (sym === '₺') return 'TL';
  if (sym === '$') return 'USD';
  if (sym === '€') return 'EUR';
  if (sym === '£') return 'GBP';
  // Bilinmeyen sembolü at — ? olmasın
  if (/^[A-Za-z]{2,4}$/.test(sym)) return sym.toUpperCase();
  return 'TL';
}

/** HTML entity / etiket temizle — &nbsp; vb. SMS’e sızmasın */
function smsPlainText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
