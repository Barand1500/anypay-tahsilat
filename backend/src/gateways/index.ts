import type { Initiate3dInput, Initiate3dResult, PaymentGateway, PosCredentials } from './types.js';
import { getPaymentAdapter } from './adapters/index.js';
import { akbankV2Gateway, looksLikeAkbankV2 } from './adapters/akbankV2.js';
import { denizbankGateway, looksLikeDenizBank } from './adapters/denizbank.js';
import { garantiGateway, looksLikeGaranti } from './adapters/garanti.js';
import { halkodeGateway, looksLikeHalkode } from './adapters/halkode.js';
import { iyzicoGateway, looksLikeIyzico } from './adapters/iyzico.js';
import { kuveytturkGateway, looksLikeKuveytTurk } from './adapters/kuveytturk.js';
import { nestpayGateway, looksLikeNestPay } from './adapters/nestpay.js';
import { paytrGateway, looksLikePaytr } from './adapters/paytr.js';
import { qnbGateway, looksLikeQnb } from './adapters/qnb.js';
import { toslaGateway, looksLikeTosla } from './adapters/tosla.js';
import { vakifbankGateway, looksLikeVakifBank } from './adapters/vakifbank.js';
import { yapikrediGateway, looksLikeYapiKredi } from './adapters/yapikredi.js';

/** Bilinen ama henüz adapter’ı olmayan altyapılar */
function unsupportedPlatform(pos: PosCredentials): string | null {
  const blob = `${pos.gateway3dUrl} ${pos.infrastructureId} ${pos.bankName}`.toLowerCase();
  if (/\bparam\b/.test(blob) || blob.includes('parampos')) return 'Param';
  if (blob.includes('stripe')) return 'Stripe';
  return null;
}

/**
 * Adapter seçimi — özel bankalar NestPay’den önce.
 */
export function pickGateway(pos: PosCredentials): PaymentGateway | null {
  if (looksLikeAkbankV2(pos)) return akbankV2Gateway;
  if (looksLikeQnb(pos)) return qnbGateway;
  if (looksLikeDenizBank(pos)) return denizbankGateway;
  if (looksLikeHalkode(pos)) return halkodeGateway;
  if (looksLikeIyzico(pos)) return iyzicoGateway;
  if (looksLikeKuveytTurk(pos)) return kuveytturkGateway;
  if (looksLikePaytr(pos)) return paytrGateway;
  if (looksLikeTosla(pos)) return toslaGateway;
  if (looksLikeVakifBank(pos)) return vakifbankGateway;
  if (looksLikeYapiKredi(pos)) return yapikrediGateway;
  if (looksLikeGaranti(pos)) return garantiGateway;
  if (looksLikeNestPay(pos)) return nestpayGateway;

  const blocked = unsupportedPlatform(pos);
  if (blocked) return null;

  if (/securepay|payhosting/i.test(pos.gateway3dUrl)) return akbankV2Gateway;
  if (/mpi_enrollment|mpiapi|vakifbank/i.test(pos.gateway3dUrl)) return vakifbankGateway;
  if (/gt3dengine|garanti\.com\.tr/i.test(pos.gateway3dUrl)) return garantiGateway;
  if (/posnet|yapikredi/i.test(pos.gateway3dUrl)) return yapikrediGateway;
  if (/tosla/i.test(pos.gateway3dUrl)) return toslaGateway;

  if (
    pos.gateway3dUrl &&
    (/\/fim\/est3dgate/i.test(pos.gateway3dUrl) ||
      /3dgate|3dpay|nestpay|asseco/i.test(pos.gateway3dUrl))
  ) {
    return nestpayGateway;
  }

  if (pos.gateway3dUrl?.trim()) return nestpayGateway;

  return null;
}

export async function initiateThreeD(input: Initiate3dInput): Promise<Initiate3dResult> {
  const url = (input.pos.gateway3dUrl || '').trim();
  // Halk Öde / iyzico / PayTR / Tosla sabit API — banka 3D URL zorunlu değil
  if (
    !url &&
    !looksLikeHalkode(input.pos) &&
    !looksLikeIyzico(input.pos) &&
    !looksLikePaytr(input.pos) &&
    !looksLikeTosla(input.pos)
  ) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: 3D geçit URL’si tanımlı değil. Banka / Sanal POS düzenlemeden URL girin.`,
    };
  }

  const blocked = unsupportedPlatform(input.pos);
  if (
    blocked &&
    !looksLikeAkbankV2(input.pos) &&
    !looksLikeQnb(input.pos) &&
    !looksLikeDenizBank(input.pos) &&
    !looksLikeHalkode(input.pos) &&
    !looksLikeIyzico(input.pos) &&
    !looksLikeKuveytTurk(input.pos) &&
    !looksLikePaytr(input.pos) &&
    !looksLikeTosla(input.pos) &&
    !looksLikeGaranti(input.pos) &&
    !looksLikeYapiKredi(input.pos) &&
    !looksLikeNestPay(input.pos) &&
    !looksLikeVakifBank(input.pos)
  ) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: ${blocked} altyapısı henüz desteklenmiyor.`,
    };
  }

  const gw = pickGateway(input.pos);
  if (!gw) {
    return {
      kind: 'error',
      message: `${input.pos.bankName}: bu 3D geçit için uygun ödeme adaptörü bulunamadı (${url || 'URL yok'})`,
    };
  }
  console.info(`[payment-adapter] source=local adapter=${gw.id} stage=3ds-initiation result=started`);
  try {
    const result = await gw.initiate3d(input);
    console.info(
      `[payment-adapter] source=local adapter=${gw.id} stage=3ds-initiation result=${result.kind === 'form' ? 'form-ready' : 'rejected'}`,
    );
    return result;
  } catch (err) {
    console.info(`[payment-adapter] source=local adapter=${gw.id} stage=3ds-initiation result=error`);
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : '3D Secure başlatılamadı',
    };
  }
}

export function getGatewayById(id: string): PaymentGateway | undefined {
  return getPaymentAdapter(id);
}

export type { PosCredentials, ThreeDForm, Initiate3dResult, CallbackResult } from './types.js';
export { resolvePosForPayment, PosResolveError } from './resolvePos.js';
