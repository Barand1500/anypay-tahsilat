import { akbankV2Gateway, looksLikeAkbankV2 } from './adapters/akbankV2.js';
import { nestpayGateway, looksLikeNestPay } from './adapters/nestpay.js';
import type { Initiate3dInput, Initiate3dResult, PaymentGateway, PosCredentials } from './types.js';

const gateways: PaymentGateway[] = [akbankV2Gateway, nestpayGateway];

export function pickGateway(pos: PosCredentials): PaymentGateway | null {
  if (looksLikeAkbankV2(pos)) return akbankV2Gateway;
  if (looksLikeNestPay(pos)) return nestpayGateway;
  // SecurePay formu → Akbank V2 sözleşmesi
  if (/securepay|payhosting/i.test(pos.gateway3dUrl)) return akbankV2Gateway;
  // Genel 3D gate URL → NestPay dene
  if (pos.gateway3dUrl) return nestpayGateway;
  return null;
}

export function initiateThreeD(input: Initiate3dInput): Initiate3dResult {
  const gw = pickGateway(input.pos);
  if (!gw) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: bu 3D geçit URL’si için adapter henüz yok (${input.pos.gateway3dUrl})`,
    };
  }
  return gw.initiate3d(input);
}

export function getGatewayById(id: string): PaymentGateway | undefined {
  return gateways.find((g) => g.id === id);
}

export type { PosCredentials, ThreeDForm, Initiate3dResult, CallbackResult } from './types.js';
export { resolvePosForPayment, PosResolveError } from './resolvePos.js';
