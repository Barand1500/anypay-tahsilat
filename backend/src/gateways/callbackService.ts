import { prisma } from '../lib/prisma.js';
import { akbankV2Gateway } from './adapters/akbankV2.js';
import { getGatewayById } from './index.js';
import { resolvePosForPayment, PosResolveError } from './resolvePos.js';
import type { CallbackResult } from './types.js';

export class GatewayCallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayCallbackError';
  }
}

function asStringMap(body: Record<string, unknown>): Record<string, unknown> {
  return body;
}

function pickOrderId(body: Record<string, unknown>): string {
  const keys = [
    'orderid',
    'orderId',
    'OrderId',
    'oid',
    'OID',
    'VerifyEnrollmentRequestId',
    'verifyEnrollmentRequestId',
    'MerchantOrderId',
  ];
  for (const k of keys) {
    const v = body[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function redirectForPayment(istekNo: string | null | undefined): string {
  const token = (istekNo || '').trim();
  if (token) return `/pay/${encodeURIComponent(token)}`;
  return '/hareketler';
}

/** Başarılı 3DS sonrası bağlı ödeme isteğini kapat */
async function markPaymentRequestPaid(
  istekNo: string | null | undefined,
  amount: number,
): Promise<void> {
  const token = (istekNo || '').trim();
  if (!token) return;
  const now = new Date();
  await prisma.odemeIstegi.updateMany({
    where: {
      istekNo: token,
      durum: false,
      OR: [{ remove: null }, { remove: false }],
    },
    data: {
      durum: true,
      odemeZamani: now,
      tutar: amount,
    },
  });
}

/** Banka 3DS dönüşü — odemeNo = orderId */
export async function handleThreeDCallback(
  body: Record<string, unknown>,
  outcome: 'ok' | 'fail',
): Promise<{ odemeNo: string; success: boolean; message: string; redirectPath: string }> {
  const orderId = pickOrderId(body);
  if (!orderId) throw new GatewayCallbackError('Sipariş numarası yok');

  const row = await prisma.odeme.findFirst({
    where: { odemeNo: orderId },
  });
  if (!row) throw new GatewayCallbackError('Ödeme kaydı bulunamadı');

  const redirectPath = redirectForPayment(row.istekNo);

  // Zaten sonuçlanmışsa tekrar işleme
  if (row.durum === 1 || row.durum === 2 || row.durum === 0 || row.durum === -1) {
    return {
      odemeNo: orderId,
      success: row.durum === 1,
      message: row.durum === 1 ? 'Ödeme zaten onaylı' : 'Ödeme zaten sonuçlanmış',
      redirectPath,
    };
  }

  const bankId = row.bankaId ?? row.sanalposBankaId;
  let secretKey = '';
  let posCreds = null as Awaited<ReturnType<typeof resolvePosForPayment>> | null;
  if (bankId != null) {
    try {
      posCreds = await resolvePosForPayment({ bankId, cardDigits: '0000000000000000' });
      secretKey = (posCreds.securityKey || posCreds.terminalPassword || '').trim();
    } catch (err) {
      if (!(err instanceof PosResolveError)) throw err;
      const pos = await prisma.sanalPosTanim.findFirst({
        where: {
          bankaId: bankId,
          OR: [{ remove: null }, { remove: false }],
          aktif: true,
        },
        orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
        select: { guvenlikAnahtari: true, terminalSifresi: true },
      });
      secretKey = (pos?.guvenlikAnahtari || pos?.terminalSifresi || '').trim();
    }
  }

  let adapterId = 'akbank-v2';
  if (row.bankaCevabi) {
    try {
      const meta = JSON.parse(row.bankaCevabi) as { adapter?: string };
      if (meta.adapter) adapterId = meta.adapter;
    } catch {
      /* düz metin olabilir */
    }
  }

  const gw = getGatewayById(adapterId) ?? akbankV2Gateway;
  let parsed: CallbackResult = gw.parseCallback(asStringMap(body), secretKey);

  if (outcome === 'ok' && parsed.success && parsed.needsProvision && gw.finalizeCallback && posCreds) {
    try {
      parsed = await gw.finalizeCallback({
        body,
        pos: posCreds,
        orderId,
        clientIp: row.ip || undefined,
      });
    } catch (err) {
      parsed = {
        ...parsed,
        success: false,
        needsProvision: false,
        message: err instanceof Error ? err.message : 'Provizyon başarısız',
      };
    }
  }

  // Provizyon gerekli ama adapter desteklemiyor → başarısız (durum=3'te asılı kalmasın)
  if (parsed.needsProvision && !(gw.finalizeCallback && posCreds && outcome === 'ok')) {
    parsed = {
      ...parsed,
      success: false,
      needsProvision: false,
      message:
        parsed.message ||
        '3D doğrulandı ancak provizyon tamamlanamadı (3D_PAY kullanın)',
    };
  }

  const success = outcome === 'ok' && parsed.success && !parsed.needsProvision;

  // BIN kart meta (taksitDetay / önceki bankaCevabi) — 3DS sonrası kaybolmasın
  let cardSegment: string | null = null;
  let cardBrand = '';
  const readCardMeta = (raw: string | null | undefined) => {
    if (!raw?.trim()) return;
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (j.cardSegment != null && String(j.cardSegment).trim()) {
        cardSegment = String(j.cardSegment).trim();
      }
      if (j.cardBrand != null && String(j.cardBrand).trim()) {
        cardBrand = String(j.cardBrand).trim();
      }
    } catch {
      /* düz metin */
    }
  };
  readCardMeta(row.taksitDetay);
  if (!cardSegment && !cardBrand) readCardMeta(row.bankaCevabi);

  const snippet = JSON.stringify({
    adapter: adapterId,
    at: new Date().toISOString(),
    responseCode: parsed.responseCode,
    message: parsed.message,
    hashOk: parsed.success,
    needsProvision: parsed.needsProvision,
    istekNo: row.istekNo || undefined,
    ...(cardSegment ? { cardSegment } : {}),
    ...(cardBrand ? { cardBrand } : {}),
    keys: Object.keys(parsed.raw).filter((k) => !/card|cvv|pan|credit/i.test(k)),
  });

  if (parsed.needsProvision) {
    await prisma.odeme.update({
      where: { id: row.id },
      data: {
        durum: 3,
        bankaCevabi: snippet,
        bankError: '3D tamam — provizyon API bekleniyor',
      },
    });
    return {
      odemeNo: orderId,
      success: false,
      message: '3D doğrulandı; provizyon tamamlanacak',
      redirectPath,
    };
  }

  await prisma.odeme.update({
    where: { id: row.id },
    data: {
      durum: success ? 1 : 0,
      bankaCevabi: snippet,
      bankError: success ? null : parsed.message.slice(0, 2000),
    },
  });

  if (success) {
    await markPaymentRequestPaid(row.istekNo, row.tutar);
  }

  return {
    odemeNo: orderId,
    success,
    message: success ? 'Ödeme onaylandı' : parsed.message || 'Ödeme reddedildi',
    redirectPath,
  };
}
