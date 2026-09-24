import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getOverview, type ChartRange } from '../services/overviewService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const overviewRouter = Router();

overviewRouter.use(requireAuth);

const querySchema = z.object({
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
  from: z.string().optional(),
  to: z.string().optional(),
  chartRange: z.enum(['1G', '1H', '1A', '6A', '1Y']).optional(),
});

overviewRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }

  try {
    const data = await getOverview({
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
      from: parsed.data.from || null,
      to: parsed.data.to || null,
      chartRange: (parsed.data.chartRange || '1A') as ChartRange,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Özet yüklenemedi');
  }
});
