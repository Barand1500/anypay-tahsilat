import { Router } from 'express';
import { z } from 'zod';
import {
  getPaymentRequestByToken,
  payPaymentRequestByToken,
  PaymentRequestsError,
} from '../services/paymentRequestsService.js';
import { PaymentsError } from '../services/paymentsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

/** Public ödeme linki — auth yok */
export const payPublicRouter = Router();

const paySchema = z.object({
  holder: z.string().min(1).max(255),
  tc: z.string().max(11).optional().default(''),
  phone: z.string().min(10).max(20),
  cardDigits: z.string().min(15).max(19),
  installment: z.number().int().min(1).max(12),
  note: z.string().max(2000).optional().default(''),
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
      installment: parsed.data.installment,
      note: parsed.data.note,
    });
    return sendSuccess(res, data, 'Ödeme alındı');
  } catch (err) {
    if (err instanceof PaymentRequestsError || err instanceof PaymentsError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Ödeme alınamadı');
  }
});
