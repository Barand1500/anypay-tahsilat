import { createHash } from 'node:crypto';
import type {
  CallbackResult,
  Initiate3dInput,
  Initiate3dResult,
  PaymentGateway,
} from '../types.js';

/**
 * Garanti BBVA Sanal POS — 3D_OOS_PAY / gt3dengine
 * NestPay (est3DGate) DEĞİL. successurl / errorurl zorunlu.
 */

function sha1HexUpper(plain: string): string {
  return createHash('sha1').update(plain, 'utf8').digest('hex').toUpperCase();
}

function sha512HexUpper(plain: string): string {
  return createHash('sha512').update(plain, 'utf8').digest('hex').toUpperCase();
}

/** Tutar kuruş (1.00 TL → "100") */
function amountCents(amount: number): string {
  return String(Math.round(amount * 100));
}

function currencyCode(code: string): string {
  const u = code.toUpperCase();
  if (u === 'TRY' || u === 'TL' || u === '949') return '949';
  if (u === 'USD' || u === '840') return '840';
  if (u === 'EUR' || u === '978') return '978';
  return /^\d+$/.test(u) ? u : '949';
}

/** Terminal id 9 haneye tamamlanır (soldan 0) */
function padTerminalId(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.padStart(9, '0').slice(-9);
}

function resolveMode(gateway3dUrl: string): 'PROD' | 'TEST' {
  const u = gateway3dUrl.toLowerCase();
  if (u.includes('test') || u.includes('sanalposprovtest')) return 'TEST';
  return 'PROD';
}

function resolveSecurityLevel(raw: string): string {
  const t = (raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!t) return '3D_OOS_PAY';
  if (t.includes('OOS')) return t.includes('PAY') ? '3D_OOS_PAY' : '3D_OOS';
  if (t === '3D_PAY' || t === '3DPAY') return '3D_PAY';
  if (t === '3D' || t === '3DMODEL') return '3D';
  return t;
}

export function looksLikeGaranti(pos: {
  gateway3dUrl: string;
  infrastructureId: string;
  bankName: string;
  securityType?: string;
}): boolean {
  const blob = `${pos.gateway3dUrl} ${pos.infrastructureId} ${pos.bankName} ${pos.securityType || ''}`.toLowerCase();
  if (blob.includes('akbank') || blob.includes('virtualpospaymentgateway')) return false;
  if (blob.includes('est3dgate') || blob.includes('asseco') || blob.includes('nestpay')) {
    // Klasik NestPay URL’si — Garanti değil
    if (!blob.includes('garanti.com')) return false;
  }
  return (
    blob.includes('garanti') ||
    blob.includes('gt3dengine') ||
    blob.includes('vpservlet') ||
    blob.includes('3d_oos') ||
    pos.infrastructureId === 'infra-garanti'
  );
}

export const garantiGateway: PaymentGateway = {
  id: 'garanti',

  initiate3d(input: Initiate3dInput): Initiate3dResult {
    const merchantId = input.pos.merchantId.trim();
    const terminalId = input.pos.terminalSafeId.trim();
    const storeKey = input.pos.securityKey.trim();
    const password = input.pos.terminalPassword.trim();

    if (!merchantId || !terminalId || !storeKey) {
      return {
        kind: 'error',
        message: 'Garanti: işyeri no / terminal no / mağaza anahtarı eksik',
      };
    }
    if (!password) {
      return {
        kind: 'error',
        message: 'Garanti: terminal şifresi eksik (Sanal POS Tanımı)',
      };
    }
    if (!input.pos.gateway3dUrl) {
      return { kind: 'error', message: 'Garanti: 3D geçit URL eksik (Banka Düzenle)' };
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

    const terminalId9 = padTerminalId(terminalId);
    const orderId = input.orderId;
    const amount = amountCents(input.amount);
    const currency = currencyCode(input.currencyCode);
    const successUrl = input.okUrl;
    const errorUrl = input.failUrl;
    const txntype = 'sales';
    const installment =
      input.installment > 1 ? String(input.installment) : '';
    const level = resolveSecurityLevel(input.pos.securityType);

    // SecurityData = SHA1(password + terminalId9).HEX.UPPER
    // HashData = SHA512(terminalId9 + orderId + amount + currency + successUrl + errorUrl + type + installment + storeKey + SecurityData)
    const securityData = sha1HexUpper(password + terminalId9);
    const hashData = sha512HexUpper(
      terminalId9 +
        orderId +
        amount +
        currency +
        successUrl +
        errorUrl +
        txntype +
        installment +
        storeKey +
        securityData,
    );

    const mm = input.card.expiry.slice(0, 2);
    const yy = input.card.expiry.slice(2, 4);

    const fields: Record<string, string> = {
      mode: resolveMode(input.pos.gateway3dUrl),
      apiversion: '512',
      terminalprovuserid: 'PROVAUT',
      terminaluserid: merchantId,
      terminalmerchantid: merchantId,
      terminalid: terminalId.replace(/\D/g, '') || terminalId,
      orderid: orderId,
      customeremailaddress: input.email || 'musteri@anypay.com.tr',
      customeripaddress: input.clientIp || '127.0.0.1',
      txntype,
      txnamount: amount,
      txncurrencycode: currency,
      txninstallmentcount: installment,
      successurl: successUrl,
      errorurl: errorUrl,
      secure3dsecuritylevel: level,
      secure3dhash: hashData,
      cardnumber: input.card.number,
      cardexpiredatemonth: mm,
      cardexpiredateyear: yy,
      cardcvv2: input.card.cvc,
      txntimestamp: String(Date.now()),
      lang: 'tr',
      refreshtime: '1',
      companyname: 'AnyPay Tahsilat',
    };

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

  parseCallback(body: Record<string, unknown>, _secretKey: string): CallbackResult {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v == null) continue;
      raw[k] = String(v);
    }

    const orderId =
      raw.orderid || raw.oid || raw.OrderId || raw.orderId || '';
    const mdStatus = raw.mdstatus || raw.mdStatus || '';
    const procReturnCode =
      raw.procreturncode || raw.ProcReturnCode || raw.procreturncode || '';
    const response = (raw.response || raw.Response || '').toLowerCase();

    // Garanti: mdstatus 1–4 genelde başarılı 3D
    const mdOk =
      mdStatus === '1' ||
      mdStatus === '2' ||
      mdStatus === '3' ||
      mdStatus === '4';
    const codeOk =
      procReturnCode === '00' ||
      procReturnCode === '' ||
      response === 'approved';

    const success = mdOk && (procReturnCode === '00' || procReturnCode === '');

    return {
      orderId,
      success,
      responseCode: procReturnCode || mdStatus || response,
      message:
        raw.errmsg ||
        raw.ErrorMsg ||
        raw.mderrormessage ||
        raw.hostmsg ||
        (success ? 'Garanti 3D başarılı' : 'Garanti 3D başarısız'),
      raw,
      needsProvision: false,
    };
  },
};
