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

  // Zaten sonuçlanmışsa tekrar işleme
  if (row.durum === 1 || row.durum === 2 || row.durum === 0 || row.durum === -1) {
    return {
      odemeNo: orderId,
      success: row.durum === 1,
      message: row.durum === 1 ? 'Ödeme zaten onaylı' : 'Ödeme zaten sonuçlanmış',
      redirectPath: '/hareketler',
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

  const success = outcome === 'ok' && parsed.success && !parsed.needsProvision;
  const snippet = JSON.stringify({
    adapter: adapterId,
    at: new Date().toISOString(),
    responseCode: parsed.responseCode,
    message: parsed.message,
    hashOk: parsed.success,
    needsProvision: parsed.needsProvision,
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
      redirectPath: '/hareketler',
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

  return {
    odemeNo: orderId,
    success,
    message: success ? 'Ödeme onaylandı' : parsed.message || 'Ödeme reddedildi',
    redirectPath: '/hareketler',
  };
}
