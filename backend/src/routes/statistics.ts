import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getStatistics, parseMonthsParam } from '../services/statisticsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const statisticsRouter = Router();
statisticsRouter.use(requireAuth);

const querySchema = z.object({
  year: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : new Date().getFullYear();
    }),
  months: z.string().optional(),
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
});

statisticsRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }

  try {
    const data = await getStatistics({
      year: parsed.data.year,
      months: parseMonthsParam(parsed.data.months),
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'İstatistikler yüklenemedi');
  }
});
