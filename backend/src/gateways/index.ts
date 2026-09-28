import type { Initiate3dInput, Initiate3dResult, PaymentGateway, PosCredentials } from './types.js';
import { akbankV2Gateway, looksLikeAkbankV2 } from './adapters/akbankV2.js';
import { nestpayGateway, looksLikeNestPay } from './adapters/nestpay.js';

const gateways: PaymentGateway[] = [akbankV2Gateway, nestpayGateway];

/** Bilinen ama henüz adapter’ı olmayan altyapılar — NestPay’e zorlanmaz */
function unsupportedPlatform(pos: PosCredentials): string | null {
  const blob = `${pos.gateway3dUrl} ${pos.infrastructureId} ${pos.bankName}`.toLowerCase();
  if (blob.includes('tosla')) return 'Tosla';
  if (blob.includes('iyzico') || blob.includes('iyzi')) return 'iyzico';
  if (/\bparam\b/.test(blob) || blob.includes('parampos')) return 'Param';
  if (blob.includes('paytr')) return 'PayTR';
  if (blob.includes('stripe')) return 'Stripe';
  return null;
}

/**
 * Akbank V2 SecurePay + NestPay/Payten (çoğu TR banka).
 * NestPay: Garanti, QNB, İş, Ziraat, Yapı Kredi, Halk vb. — 3D URL dolu olmalı.
 */
export function pickGateway(pos: PosCredentials): PaymentGateway | null {
  if (looksLikeAkbankV2(pos)) return akbankV2Gateway;
  if (looksLikeNestPay(pos)) return nestpayGateway;

  const blocked = unsupportedPlatform(pos);
  if (blocked) return null;

  // SecurePay formu → Akbank V2
  if (/securepay|payhosting/i.test(pos.gateway3dUrl)) return akbankV2Gateway;

  // Klasik NestPay / Payten geçit URL’leri
  if (
    pos.gateway3dUrl &&
    (/\/fim\/est3dgate/i.test(pos.gateway3dUrl) ||
      /3dgate|3dpay|nestpay|asseco|sanalpos/i.test(pos.gateway3dUrl))
  ) {
    return nestpayGateway;
  }

  // URL var ama bilinen NestPay imzası yok → yine NestPay dene (çoğu TR bankası)
  if (pos.gateway3dUrl?.trim()) return nestpayGateway;

  return null;
}

export function initiateThreeD(input: Initiate3dInput): Initiate3dResult {
  const url = (input.pos.gateway3dUrl || '').trim();
  if (!url) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: 3D geçit URL’si tanımlı değil. Banka / Sanal POS düzenlemeden URL girin.`,
    };
  }

  const blocked = unsupportedPlatform(input.pos);
  if (blocked && !looksLikeAkbankV2(input.pos) && !looksLikeNestPay(input.pos)) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: ${blocked} altyapısı henüz desteklenmiyor. NestPay/Payten veya Akbank SecurePay kullanın.`,
    };
  }

  const gw = pickGateway(input.pos);
  if (!gw) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: bu 3D geçit için uygun ödeme adaptörü bulunamadı (${url})`,
    };
  }
  return gw.initiate3d(input);
}

export function getGatewayById(id: string): PaymentGateway | undefined {
  return gateways.find((g) => g.id === id);
}

export type { PosCredentials, ThreeDForm, Initiate3dResult, CallbackResult } from './types.js';
export { resolvePosForPayment, PosResolveError } from './resolvePos.js';
