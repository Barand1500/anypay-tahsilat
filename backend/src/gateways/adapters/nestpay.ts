import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  CallbackResult,
  Initiate3dInput,
  Initiate3dResult,
  PaymentGateway,
} from '../types.js';

/**
 * NestPay / Payten klasik 3D_PAY form (Garanti, QNB, İş, Ziraat vb. birçok banka).
 * storekey = securityKey, clientid = merchantId
 */

function sha1Base64(plain: string): string {
  return createHash('sha1').update(plain, 'latin1').digest('base64');
}

function mapStoreType(securityType: string): string {
  const t = securityType.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (t === '3D_PAY' || t === '3DPAY') return '3d_pay';
  if (t === '3D_HOST' || t === '3DHOST' || t === '3D_PAY_HOSTING') return '3d_pay_hosting';
  if (t === '3D' || t === '3DMODEL' || t === '3D_MODEL') return '3d';
  return '3d_pay';
}

function currencyCode(code: string): string {
  const u = code.toUpperCase();
  if (u === 'TRY' || u === 'TL' || u === '949') return '949';
  if (u === 'USD' || u === '840') return '840';
  if (u === 'EUR' || u === '978') return '978';
  return '949';
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

export const nestpayGateway: PaymentGateway = {
  id: 'nestpay',

  initiate3d(input: Initiate3dInput): Initiate3dResult {
    const clientId = input.pos.merchantId;
    const storeKey = input.pos.securityKey;
    if (!clientId || !storeKey) {
      return { kind: 'error', message: 'NestPay: işyeri no / mağaza anahtarı eksik' };
    }
    if (!input.pos.gateway3dUrl) {
      return { kind: 'error', message: 'NestPay: 3D geçit URL eksik (Banka Düzenle)' };
    }
    if (!/^\d{15,16}$/.test(input.card.number)) {
      return { kind: 'error', message: 'Kart numarası geçersiz' };
    }
    if (!/^\d{4}$/.test(input.card.expiry)) {
      return { kind: 'error', message: 'Son kullanma MMYY olmalı' };
    }
    if (!/^\d{3,4}$/.test(input.card.cvc)) {
      return { kind: 'error', message: 'CVC geçersiz' };
    }

    const amount = formatAmount(input.amount);
    const oid = input.orderId;
    const okUrl = input.okUrl;
    const failUrl = input.failUrl;
    const islemtipi = 'Auth';
    const taksit =
      input.installment > 1 ? String(input.installment) : '';
    const rnd = randomBytes(10).toString('hex');
    const storetype = mapStoreType(input.pos.securityType);

    // Hash: clientid + oid + amount + okUrl + failUrl + islemtipi + taksit + rnd + storekey
    const hash = sha1Base64(
      clientId + oid + amount + okUrl + failUrl + islemtipi + taksit + rnd + storeKey,
    );

    const mm = input.card.expiry.slice(0, 2);
    const yy = input.card.expiry.slice(2, 4);

    const fields: Record<string, string> = {
      clientid: clientId,
      amount,
      oid,
      okUrl,
      failUrl,
      islemtipi,
      taksit,
      rnd,
      hash,
      storetype,
      lang: 'tr',
      currency: currencyCode(input.currencyCode),
      pan: input.card.number,
      Ecom_Payment_Card_ExpDate_Month: mm,
      Ecom_Payment_Card_ExpDate_Year: yy,
      cv2: input.card.cvc,
      cardHolderName: input.card.holder,
    };

    // Terminal no bazı entegrasyonlarda ekstra
    if (input.pos.terminalSafeId) {
      fields.TerminalId = input.pos.terminalSafeId;
    }

    return {
      kind: 'form',
      adapter: this.id,
      form: {
        actionUrl: input.pos.gateway3dUrl,
        method: 'POST',
        fields,
      },
    };
  },

  parseCallback(body: Record<string, unknown>, secretKey: string): CallbackResult {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v == null) continue;
      raw[k] = String(v);
    }

    const orderId = raw.oid || raw.OrderId || raw.orderId || '';
    const procReturnCode = raw.ProcReturnCode || raw.procreturncode || '';
    const mdStatus = raw.mdStatus || raw.mdStatus || '';
    const response = (raw.Response || raw.response || '').toLowerCase();

    // HASH doğrulama (HASHPARAMS / HASH)
    let hashOk = true;
    if (raw.HASHPARAMS && raw.HASH && secretKey) {
      const plain =
        raw.HASHPARAMS.split(':')
          .filter(Boolean)
          .map((p) => raw[p] ?? '')
          .join('') + secretKey;
      const expected = sha1Base64(plain);
      try {
        const a = Buffer.from(expected);
        const b = Buffer.from(raw.HASH);
        hashOk = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        hashOk = false;
      }
    }

    const success =
      hashOk &&
      (procReturnCode === '00' || response === 'approved') &&
      (mdStatus === '' || mdStatus === '1' || mdStatus === '2' || mdStatus === '3' || mdStatus === '4');

    const storetype = (raw.storetype || '').toLowerCase();
    const needsProvision = storetype === '3d' && success;

    return {
      orderId,
      success,
      responseCode: procReturnCode || response || '',
      message:
        raw.ErrMsg ||
        raw.errmsg ||
        raw.mdErrorMsg ||
        (success ? 'NestPay 3D başarılı' : 'NestPay 3D başarısız'),
      raw,
      needsProvision,
      secure: needsProvision
        ? {
            secureId: raw.xid || '',
            secureEcomInd: raw.eci || '',
            secureData: raw.cavv || '',
            secureMd: raw.md || '',
            mdStatus,
          }
        : undefined,
    };
  },
};

export function looksLikeNestPay(pos: {
  gateway3dUrl: string;
  infrastructureId: string;
  bankName: string;
}): boolean {
  const blob = `${pos.gateway3dUrl} ${pos.infrastructureId} ${pos.bankName}`.toLowerCase();
  if (blob.includes('akbank') || blob.includes('virtualpospaymentgateway')) return false;
  return (
    blob.includes('garanti') ||
    blob.includes('nestpay') ||
    blob.includes('asseco') ||
    blob.includes('est3d') ||
    blob.includes('sanalpos') ||
    blob.includes('yapikredi') ||
    blob.includes('qnb') ||
    blob.includes('isbank') ||
    blob.includes('ziraat') ||
    blob.includes('halk') ||
    /\/fim\/est3dgate/i.test(pos.gateway3dUrl) ||
    /3dgate|3dpay/i.test(pos.gateway3dUrl)
  );
}
