import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { createPayment, PaymentsError } from '../services/paymentsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const createSchema = z.object({
  musteriId: z.number().int().positive(),
  payType: z.enum(['ch', 'fatura']),
  amount: z.number().positive(),
  commissionIncluded: z.boolean().optional().default(false),
  holder: z.string().min(1).max(255),
  tc: z.string().max(20).optional().default(''),
  phone: z.string().min(10).max(20),
  cardDigits: z.string().min(15).max(19),
  installment: z.number().int().min(1).max(12).optional().default(1),
  note: z.string().max(5000).optional().default(''),
});

paymentsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createPayment({
      ...parsed.data,
      kullaniciId: req.auth!.sub,
    });
    await writePanelLog(
      req.auth!.sub,
      `Ödeme alındı — #${data.odemeNo} / ${data.amount.toFixed(2)} ₺`,
    );
    return sendSuccess(res, data, 'Ödeme kaydedildi', 201);
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme kaydedilemedi');
  }
});
