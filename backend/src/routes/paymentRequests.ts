import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  createPaymentRequest,
  listPaymentRequests,
  PaymentRequestsError,
  softDeletePaymentRequest,
} from '../services/paymentRequestsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const paymentRequestsRouter = Router();
paymentRequestsRouter.use(requireAuth);

const createSchema = z.object({
  musteriId: z.number().int().positive().nullable().optional(),
  payType: z.enum(['ch', 'fatura']),
  amount: z.number().positive(),
  commissionIncluded: z.boolean().optional().default(false),
  installments: z.array(z.number().int().min(1).max(12)).min(1),
  description: z.string().min(1).max(20000),
  faturaNo: z.string().max(255).optional().default(''),
  dosya: z.string().max(255).nullable().optional(),
});

paymentRequestsRouter.get('/', async (_req, res) => {
  try {
    const data = await listPaymentRequests();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Ödeme istekleri yüklenemedi');
  }
});

paymentRequestsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createPaymentRequest({
      musteriId: parsed.data.musteriId ?? null,
      payType: parsed.data.payType,
      amount: parsed.data.amount,
      commissionIncluded: parsed.data.commissionIncluded,
      installments: parsed.data.installments,
      description: parsed.data.description,
      faturaNo: parsed.data.faturaNo,
      dosya: parsed.data.dosya ?? null,
      kullaniciId: req.auth!.sub,
    });
    await writePanelLog(
      req.auth!.sub,
      `Ödeme isteği oluşturuldu — ${data.customerTitle} / ${data.amount.toFixed(2)} ₺`,
    );
    return sendSuccess(res, data, 'Ödeme isteği oluşturuldu', 201);
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme isteği oluşturulamadı');
  }
});

paymentRequestsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    await softDeletePaymentRequest(id);
    await writePanelLog(req.auth!.sub, `Ödeme isteği silindi — #${id}`);
    return sendSuccess(res, { ok: true }, 'Ödeme isteği silindi');
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme isteği silinemedi');
  }
});
