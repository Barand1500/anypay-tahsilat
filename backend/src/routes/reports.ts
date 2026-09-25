import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getCollectionReport } from '../services/collectionReportService.js';
import { getCustomerCollectionReport } from '../services/customerCollectionReportService.js';
import { getCardCollectionReport } from '../services/cardCollectionReportService.js';
import { getSendHistory } from '../services/sendHistoryService.js';
import { parseMonthsParam } from '../services/statisticsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const idOpt = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || v === 'all') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const collectionSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: idOpt,
  userId: idOpt,
  bankId: idOpt,
  reportType: z.enum(['ozet', 'detay', 'gunluk']).optional(),
});

const customerSchema = z.object({
  year: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : new Date().getFullYear();
    }),
  months: z.string().optional(),
  branchId: idOpt,
  userId: idOpt,
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

reportsRouter.get('/customer-collection', async (req, res) => {
  const parsed = customerSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }
  try {
    const data = await getCustomerCollectionReport({
      year: parsed.data.year,
      months: parseMonthsParam(parsed.data.months),
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Müşteri tahsilat raporu yüklenemedi');
  }
});

reportsRouter.get('/card-collection', async (req, res) => {
  const parsed = customerSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }
  try {
    const data = await getCardCollectionReport({
      year: parsed.data.year,
      months: parseMonthsParam(parsed.data.months),
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Kart tahsilat raporu yüklenemedi');
  }
});

/** Banka tahsilat — aynı banka agregasyonu */
reportsRouter.get('/bank-collection', async (req, res) => {
  const parsed = customerSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }
  try {
    const data = await getCardCollectionReport({
      year: parsed.data.year,
      months: parseMonthsParam(parsed.data.months),
      branchId: parsed.data.branchId,
      userId: parsed.data.userId,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Banka tahsilat raporu yüklenemedi');
  }
});

const sendHistorySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(['email', 'sms']).optional(),
  customerId: idOpt,
  q: z.string().optional(),
});

reportsRouter.get('/send-history', async (req, res) => {
  const parsed = sendHistorySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'Geçersiz filtre');
  }
  try {
    const data = await getSendHistory({
      from: parsed.data.from || null,
      to: parsed.data.to || null,
      type: parsed.data.type || null,
      customerId: parsed.data.customerId,
      q: parsed.data.q || null,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Gönderim geçmişi yüklenemedi');
  }
});
