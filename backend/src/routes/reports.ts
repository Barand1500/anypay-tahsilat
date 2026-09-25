import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getCollectionReport } from '../services/collectionReportService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const collectionSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === 'all') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  userId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === 'all') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  bankId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === 'all') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  reportType: z.enum(['ozet', 'detay', 'gunluk']).optional(),
});

reportsRouter.get('/collection', async (req, res) => {
  const parsed = collectionSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }
  try {
    const data = await getCollectionReport({
      from: parsed.data.from || null,
      to: parsed.data.to || null,
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
      bankId: parsed.data.bankId,
      reportType: parsed.data.reportType || 'detay',
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Tahsilat raporu yüklenemedi');
  }
});
