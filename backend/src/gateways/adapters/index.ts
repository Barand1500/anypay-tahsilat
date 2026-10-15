import type { PaymentGateway } from '../types.js';
import { akbankV2Gateway } from './akbankV2.js';
import { garantiGateway } from './garanti.js';
import { nestpayGateway } from './nestpay.js';
import { vakifbankGateway } from './vakifbank.js';

/** Sağlayıcı adapter sicili. Yeni banka/altyapı adapter'ları bu dosyada kaydedilir. */
export const paymentAdapters: Record<string, PaymentGateway> = {
  'akbank-v2': akbankV2Gateway,
  garanti: garantiGateway,
  nestpay: nestpayGateway,
  vakifbank: vakifbankGateway,
};

export function getPaymentAdapter(id: string): PaymentGateway | undefined {
  return paymentAdapters[id];
}

