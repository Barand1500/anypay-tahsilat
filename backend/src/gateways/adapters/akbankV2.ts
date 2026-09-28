import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  CallbackResult,
  Initiate3dInput,
  Initiate3dResult,
  PaymentGateway,
} from '../types.js';

/** Akbank V2 SecurePay — HMAC-SHA512 form (omnipay-akbank / resmi doc §6) */

const TXN_3D = '3000';
const SUCCESS_CODE = 'VPS-0000';

function hmacB64(data: string, secret: string): string {
  return createHmac('sha512', secret).update(data, 'utf8').digest('base64');
}

function random128(): string {
  return randomBytes(64).toString('hex');
}

function requestDateTime(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function currencyNumeric(code: string): string {
  const map: Record<string, string> = {
    TRY: '949',
    TL: '949',
    USD: '840',
    EUR: '978',
    GBP: '826',
    JPY: '392',
  };
  const u = code.toUpperCase();
  if (/^\d+$/.test(u)) return u;
  return map[u] ?? '949';
}

function mapPaymentModel(securityType: string): string {
  const t = securityType.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (t === '3D_PAY_HOSTING' || t === '3D_HOST' || t === '3DHOST') return '3D_PAY_HOSTING';
  if (t === '3D_PAY' || t === '3DPAY') return '3D_PAY';
  if (t === '3D' || t === '3DMODEL' || t === '3D_MODEL') return '3D';
  return securityType.trim() || '3D_PAY';
}

function isHosting(model: string): boolean {
  return model === '3D_PAY_HOSTING';
}

function resolveActionUrl(gateway3dUrl: string, model: string): string {
  const base = gateway3dUrl.replace(/\/$/, '');
  if (isHosting(model)) {
    if (base.includes('/securepay')) return base.replace(/\/securepay$/i, '/payhosting');
    if (!base.includes('/payhosting')) return `${base}/payhosting`;
  }
  return base;
}

export const akbankV2Gateway: PaymentGateway = {
  id: 'akbank-v2',

  initiate3d(input: Initiate3dInput): Initiate3dResult {
    const model = mapPaymentModel(input.pos.securityType);
    const hosting = isHosting(model);
    const actionUrl = resolveActionUrl(input.pos.gateway3dUrl, model);

    if (!input.pos.merchantId || !input.pos.terminalSafeId || !input.pos.securityKey) {
      return { kind: 'error', message: 'Akbank POS kimlik bilgileri eksik' };
    }
    if (!hosting) {
      if (!/^\d{15,16}$/.test(input.card.number)) {
        return { kind: 'error', message: 'Kart numarası geçersiz' };
      }
      if (!/^\d{4}$/.test(input.card.expiry)) {
        return { kind: 'error', message: 'Son kullanma MMYY olmalı' };
      }
      if (!/^\d{3,4}$/.test(input.card.cvc)) {
        return { kind: 'error', message: 'CVC geçersiz' };
      }
    }

    const fields: Record<string, string> = {
      paymentModel: model,
      txnCode: TXN_3D,
      merchantSafeId: input.pos.merchantId,
      terminalSafeId: input.pos.terminalSafeId,
      orderId: input.orderId,
      lang: 'TR',
      amount: formatAmount(input.amount),
      ccbRewardAmount: '0.00',
      pcbRewardAmount: '0.00',
      xcbRewardAmount: '0.00',
      currencyCode: currencyNumeric(input.currencyCode),
      installCount: String(Math.max(1, input.installment)),
      okUrl: input.okUrl,
      failUrl: input.failUrl,
      emailAddress: input.email || '',
      mobilePhone: '',
      homePhone: '',
      workPhone: '',
      subMerchantId: '',
    };

    if (!hosting) {
      fields.creditCard = input.card.number;
      fields.expiredDate = input.card.expiry;
      fields.cvv = input.card.cvc;
      fields.cardHolderName = input.card.holder;
    }

    fields.randomNumber = random128();
    fields.requestDateTime = requestDateTime();
    fields.b2bIdentityNumber = '';
    fields.merchantData = '';
    fields.merchantBranchNo = '';
    fields.mobileEci = '';
    fields.walletProgramData = '';
    fields.mobileAssignedId = '';
    fields.mobileDeviceType = '';

    // Hash: alan değerleri ekleme sırasıyla (hash alanı hariç)
    const plain = Object.values(fields).join('');
    fields.hash = hmacB64(plain, input.pos.securityKey);

    return {
      kind: 'form',
      adapter: this.id,
      form: { actionUrl, method: 'POST', fields },
    };
  },

  parseCallback(body: Record<string, unknown>, secretKey: string): CallbackResult {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v == null) continue;
      raw[k] = String(v);
    }

    const orderId = raw.orderId || raw.OrderId || '';
    const responseCode = raw.responseCode || raw.ResponseCode || '';
    const hashParams = raw.hashParams || '';
    const hash = raw.hash || '';

    let hashOk = false;
    if (hashParams && hash && secretKey) {
      const plain = hashParams
        .split('+')
        .filter(Boolean)
        .map((p) => raw[p] ?? '')
        .join('');
      const expected = hmacB64(plain, secretKey);
      try {
        const a = Buffer.from(expected);
        const b = Buffer.from(hash);
        hashOk = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        hashOk = false;
      }
    }

    const mdStatus = raw.mdStatus || '';
    const success =
      hashOk && responseCode === SUCCESS_CODE && (mdStatus === '' || mdStatus === '1');

    const paymentModel = (raw.paymentModel || '').toUpperCase();
    const needsProvision = paymentModel === '3D' && success;

    return {
      orderId,
      success,
      responseCode,
      message:
        raw.responseMessage ||
        raw.hostMessage ||
        (success ? '3D Secure başarılı' : '3D Secure başarısız veya hash doğrulanamadı'),
      raw,
      needsProvision,
      secure: needsProvision
        ? {
            secureId: raw.secureId || '',
            secureEcomInd: raw.secureEcomInd || '',
            secureData: raw.secureData || '',
            secureMd: raw.secureMd || '',
            mdStatus,
          }
        : undefined,
    };
  },
};

/** URL / altyapı Akbank V2 mi? */
export function looksLikeAkbankV2(pos: {
  gateway3dUrl: string;
  apiUrl: string;
  infrastructureId: string;
  bankName: string;
}): boolean {
  const blob = `${pos.gateway3dUrl} ${pos.apiUrl} ${pos.infrastructureId} ${pos.bankName}`.toLowerCase();
  return (
    blob.includes('akbank') ||
    blob.includes('virtualpospaymentgateway') ||
    /\/securepay\/?$/i.test(pos.gateway3dUrl.trim())
  );
}
