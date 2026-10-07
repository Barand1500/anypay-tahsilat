import { Router } from 'express';
import { z } from 'zod';
import {
  getPaymentRequestByToken,
  payPaymentRequestByToken,
  PaymentRequestsError,
} from '../services/paymentRequestsService.js';
import { getContractByLink } from '../services/contractsService.js';
import { PaymentsError } from '../services/paymentsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

/** Public ödeme linki — auth yok */
export const payPublicRouter = Router();

const paySchema = z.object({
  holder: z.string().min(1).max(255),
  tc: z.string().max(11).optional().default(''),
  phone: z.string().min(10).max(20),
  cardDigits: z.string().min(15).max(19),
  expiry: z.string().min(4).max(7),
  cvc: z.string().min(3).max(4),
  installment: z.number().int().min(1).max(12),
  amount: z.number().positive().finite().optional(),
  note: z.string().max(2000).optional().default(''),
});

const legalLinkSchema = z.enum([
  'kvkk',
  'hizmet',
  'guvenlik',
  'tahsilat',
  'iptal-iade',
  'iletisim',
  'uyelik',
]);

payPublicRouter.get('/legal/:link', async (req, res) => {
  const parsed = legalLinkSchema.safeParse(req.params.link);
  if (!parsed.success) return sendError(res, 400, 'Geçersiz sözleşme bağlantısı');
  try {
    const contract = await getContractByLink(parsed.data);
    if (!contract) return sendError(res, 404, 'Sözleşme bulunamadı');
    return sendSuccess(res, contract);
  } catch (err) {
    console.error('[public-legal]', err);
    return sendError(res, 500, 'Sözleşme yüklenemedi');
  }
});

payPublicRouter.get('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token || token.length > 64) return sendError(res, 400, 'Geçersiz link');
  try {
    const data = await getPaymentRequestByToken(token);
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme isteği yüklenemedi');
  }
});

payPublicRouter.post('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token || token.length > 64) return sendError(res, 400, 'Geçersiz link');
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await payPaymentRequestByToken(token, {
      holder: parsed.data.holder,
      tc: parsed.data.tc,
      phone: parsed.data.phone,
      cardDigits: parsed.data.cardDigits,
      expiry: parsed.data.expiry,
      cvc: parsed.data.cvc,
      installment: parsed.data.installment,
      amount: parsed.data.amount,
      note: parsed.data.note,
    });
    return sendSuccess(
      res,
      data,
      data.status === 'pending_3d' ? 'Banka 3D Secure’a yönlendiriliyor' : 'Ödeme alındı',
    );
  } catch (err) {
    if (err instanceof PaymentRequestsError || err instanceof PaymentsError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    const msg = err instanceof Error ? err.message : '';
    if (msg && msg.length < 280 && !/prisma|sql|econn|stack/i.test(msg)) {
      return sendError(res, 400, msg);
    }
    return sendError(res, 500, 'Ödeme alınamadı');
  }
});
