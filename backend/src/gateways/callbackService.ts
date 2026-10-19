import { prisma } from '../lib/prisma.js';
import { writePanelLog } from '../services/logsService.js';
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

/**
 * Banka body → sipariş anahtarı.
 * Adamlar çoğu bankada URL’deki odemeNo ile bulur; biz body’den okuruz.
 * Halkode invoice_id / iyzico conversationId / PayTR merchant_oid / YK Xid ekli.
 */
function pickOrderId(body: Record<string, unknown>): string {
  const keys = [
    'oid',
    'OID',
    'orderid',
    'orderId',
    'OrderId',
    'MerchantOrderId',
    'invoice_id',
    'invoiceId',
    'conversationId',
    'merchant_oid',
    'Echo',
    'echo',
    'Xid',
    'XID',
    'xid',
    'VerifyEnrollmentRequestId',
    'verifyEnrollmentRequestId',
  ];
  for (const k of keys) {
    const v = body[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * Tam eşleşme veya Yapı Kredi tarzı xid = odemeNo + pad (adamlar URL’de odemeNo kullanır).
 */
async function findOdemeByCallbackOrderId(orderId: string) {
  const exact = await prisma.odeme.findFirst({ where: { odemeNo: orderId } });
  if (exact) return exact;

  // Güvenli prefix: odemeNo en az 8 karakter; xid bizim no ile başlamalı
  if (orderId.length < 8) return null;
  const recent = await prisma.odeme.findMany({
    orderBy: { id: 'desc' },
    take: 80,
    select: { id: true, odemeNo: true },
  });
  const hit = recent.find(
    (r) => r.odemeNo.length >= 8 && orderId.startsWith(r.odemeNo),
  );
  if (!hit) return null;
  return prisma.odeme.findFirst({ where: { id: hit.id } });
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
): Promise<{
  odemeNo: string;
  success: boolean;
  message: string;
  redirectPath: string;
  amount: number;
}> {
  const orderId = pickOrderId(body);
  if (!orderId) throw new GatewayCallbackError('Sipariş numarası yok');

  const row = await findOdemeByCallbackOrderId(orderId);
  if (!row) throw new GatewayCallbackError('Ödeme kaydı bulunamadı');

  const odemeNo = row.odemeNo;
  const redirectPath = redirectForPayment(row.istekNo);
  const amount = Number(row.gercekTutar ?? row.tutar) || 0;

  // Zaten sonuçlanmışsa tekrar işleme
  if (row.durum === 1 || row.durum === 2 || row.durum === 0 || row.durum === -1) {
    console.info('[payment-callback] source=local result=already-final');
    return {
      odemeNo,
      success: row.durum === 1,
      message: row.durum === 1 ? 'Ödeme zaten onaylı' : 'Ödeme zaten sonuçlanmış',
      redirectPath,
      amount,
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
  console.info(`[payment-callback] source=local adapter=${gw.id} result=received`);
  let parsed: CallbackResult = gw.parseCallback(asStringMap(body), secretKey);

  // failUrl’e basssa bile 3D alanları varsa GVPS ile çek (Garanti 3D modeli)
  if (parsed.success && parsed.needsProvision && gw.finalizeCallback && posCreds) {
    try {
      parsed = await gw.finalizeCallback({
        body,
        pos: posCreds,
        orderId: odemeNo,
        clientIp: row.ip || undefined,
        amount: Number(row.gercekTutar ?? row.tutar) || undefined,
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

  // Provizyon gerekli ama adapter/POS yok → başarısız (durum=3'te asılı kalmasın)
  if (parsed.needsProvision) {
    parsed = {
      ...parsed,
      success: false,
      needsProvision: false,
      message:
        parsed.message ||
        '3D doğrulandı ancak provizyon tamamlanamadı (API URL / 3D_PAY)',
    };
  }

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

  const authCode =
    parsed.raw.AuthCode ||
    parsed.raw.authCode ||
    parsed.raw.OnayKodu ||
    '';
  const referenceCode =
    parsed.raw.hostlogkey ||
    parsed.raw.HostRefNum ||
    parsed.raw.hostrefnum ||
    parsed.raw.RetrefNum ||
    parsed.raw.retrefnum ||
    parsed.raw.Rrn ||
    parsed.raw.rrn ||
    parsed.raw.HostReferenceNumber ||
    parsed.raw.paymentId ||
    parsed.raw.TransId ||
    '';
  let diag: Record<string, unknown> | undefined;
  try {
    if (parsed.raw._diag) diag = JSON.parse(parsed.raw._diag) as Record<string, unknown>;
  } catch {
    diag = undefined;
  }
  const snippet = JSON.stringify({
    adapter: adapterId,
    at: new Date().toISOString(),
    responseCode: parsed.responseCode,
    message: parsed.message,
    hashOk: parsed.success,
    needsProvision: parsed.needsProvision,
    awaitingExternalConfirm: parsed.awaitingExternalConfirm || false,
    bankOrderId: parsed.orderId || undefined,
    authCode: authCode || undefined,
    referenceCode: referenceCode || undefined,
    istekNo: row.istekNo || undefined,
    diag,
    ...(cardSegment ? { cardSegment } : {}),
    ...(cardBrand ? { cardBrand } : {}),
    keys: Object.keys(parsed.raw).filter((k) => !/card|cvv|pan|credit|_diag/i.test(k)),
  });

  // PayTR kullanıcı dönüşü — banka bildirimi gelene kadar durum=3 (başarısız yazma)
  if (parsed.awaitingExternalConfirm) {
    await prisma.odeme.update({
      where: { id: row.id },
      data: {
        durum: 3,
        bankaCevabi: snippet,
        bankError: 'Banka bildirimi bekleniyor',
      },
    });
    console.info(
      `[payment-callback] source=local adapter=${gw.id} outcome=${outcome} result=awaiting-notify`,
    );
    return {
      odemeNo,
      success: false,
      message: parsed.message || 'Ödeme sonucu banka bildirimi ile kesinleşecek',
      redirectPath,
      amount,
    };
  }

  // failUrl’e basssa bile sadece gerçek banka kodu 00/000 ile kabul (message=Approved yetmez — kod 92 tuzağı)
  const strongOk =
    parsed.success &&
    (parsed.responseCode === '00' || parsed.responseCode === '000');
  const success =
    parsed.success &&
    !parsed.needsProvision &&
    (outcome === 'ok' || strongOk);
  const diagReason =
    typeof diag?.reason === 'string'
      ? diag.reason
      : success
        ? 'ok'
        : !parsed.success
          ? 'adapter_reject'
          : outcome !== 'ok' && !strongOk
            ? 'fail_url_without_strongOk'
            : 'parse_fail';
  console.info(
    `[payment-callback] source=local adapter=${gw.id} outcome=${outcome}` +
      ` result=${success ? 'success' : 'failure'} strongOk=${strongOk}` +
      ` code=${parsed.responseCode || '-'} auth=${authCode ? 'yes' : 'no'}` +
      ` ref=${referenceCode ? 'yes' : 'no'} reason=${diagReason}`,
  );

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
      odemeNo,
      success: false,
      message: '3D doğrulandı; provizyon tamamlanacak',
      redirectPath,
      amount,
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

  // Yerel 3DS sonucu — Log Kayıtları (Api kapalı yolu) — teşhis alanları
  const resultMsg = success ? 'Ödeme onaylandı' : parsed.message || 'Ödeme reddedildi';
  // Bankanın kendi hata metni (msg/message alanları) — teşhis için kısa
  const bankMsg = Object.entries(parsed.raw)
    .filter(([k, v]) => /msg|message/i.test(k) && !/card|cvv/i.test(k) && String(v || '').trim())
    .map(([k, v]) => `${k}:${String(v).trim()}`)
    .join(' | ')
    .slice(0, 220);
  const detail = [
    `adapter=${gw.id}`,
    `outcome=${outcome}`,
    `strongOk=${strongOk}`,
    `code=${parsed.responseCode || '-'}`,
    `auth=${authCode ? 'var' : 'yok'}`,
    `ref=${referenceCode ? 'var' : 'yok'}`,
    `reason=${diagReason}`,
    ...(!success && bankMsg ? [`bank=${bankMsg}`] : []),
  ].join(' · ');
  await writePanelLog(
    row.kullaniciId,
    success
      ? `Ödeme - Yerel POS · BAŞARILI · #${odemeNo} · ${detail}`
      : `Ödeme - Yerel POS HATA · #${odemeNo} · ${resultMsg.slice(0, 220)} · ${detail}`,
  );

  return {
    odemeNo,
    success,
    message: resultMsg,
    redirectPath,
    amount,
  };
}
