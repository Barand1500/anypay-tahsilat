import type { PaymentGateway } from '../types.js';
import { akbankV2Gateway } from './akbankV2.js';
import { denizbankGateway } from './denizbank.js';
import { garantiGateway } from './garanti.js';
import { halkodeGateway } from './halkode.js';
import { iyzicoGateway } from './iyzico.js';
import { kuveytturkGateway } from './kuveytturk.js';
import { nestpayGateway } from './nestpay.js';
import { paytrGateway } from './paytr.js';
import { qnbGateway } from './qnb.js';
import { toslaGateway } from './tosla.js';
import { vakifbankGateway } from './vakifbank.js';
import { yapikrediGateway } from './yapikredi.js';

/** Sağlayıcı adapter sicili. Yeni banka/altyapı adapter'ları bu dosyada kaydedilir. */
export const paymentAdapters: Record<string, PaymentGateway> = {
  'akbank-v2': akbankV2Gateway,
  denizbank: denizbankGateway,
  garanti: garantiGateway,
  halkode: halkodeGateway,
  iyzico: iyzicoGateway,
  kuveytturk: kuveytturkGateway,
  nestpay: nestpayGateway,
  paytr: paytrGateway,
  qnb: qnbGateway,
  tosla: toslaGateway,
  vakifbank: vakifbankGateway,
  yapikredi: yapikrediGateway,
};

export function getPaymentAdapter(id: string): PaymentGateway | undefined {
  return paymentAdapters[id];
}
