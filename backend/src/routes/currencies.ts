import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  CurrenciesError,
  createCurrency,
  listCurrencies,
  refreshCurrencyRate,
  softDeleteCurrency,
  updateCurrency,
  type RateTypeLabel,
} from '../services/currenciesService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const currenciesRouter = Router();
currenciesRouter.use(requireAuth);

const rateTypeSchema = z.enum(['Döviz Alış', 'Döviz Satış', 'Efektif Alış', 'Efektif Satış']);

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().min(1).max(32),
  symbol: z.string().min(1).max(16),
  rateType: rateTypeSchema,
  rate: z.number().min(0),
  autoUpdate: z.boolean().optional().default(false),
  apiUrl: z.string().max(255).optional().default(''),
  status: z.enum(['Aktif', 'Pasif']).optional().default('Aktif'),
});

currenciesRouter.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const data = await listCurrencies({ activeOnly });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Para birimleri yüklenemedi');
  }
});

currenciesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCurrency({
      ...parsed.data,
      rateType: parsed.data.rateType as RateTypeLabel,
      status: parsed.data.status,
    });
    await writePanelLog(req.auth!.sub, `Para birimi eklendi — ${data.shortName}`);
    return sendSuccess(res, data, 'Para birimi eklendi', 201);
  } catch (err) {
    if (err instanceof CurrenciesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Para birimi eklenemedi');
  }
});

currenciesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCurrency(id, {
      ...parsed.data,
      rateType: parsed.data.rateType as RateTypeLabel,
      status: parsed.data.status,
    });
    await writePanelLog(req.auth!.sub, `Para birimi güncellendi — ${data.shortName}`);
    return sendSuccess(res, data, 'Para birimi güncellendi');
  } catch (err) {
    if (err instanceof CurrenciesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Para birimi güncellenemedi');
  }
});

currenciesRouter.post('/:id/refresh', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    const data = await refreshCurrencyRate(id);
    await writePanelLog(req.auth!.sub, `Para birimi kur yenilendi — ${data.shortName}`);
    return sendSuccess(res, data, 'Kur güncellendi');
  } catch (err) {
    if (err instanceof CurrenciesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kur yenilenemedi');
  }
});

currenciesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteCurrency(id);
    await writePanelLog(req.auth!.sub, `Para birimi silindi — #${id}`);
    return sendSuccess(res, { id }, 'Para birimi silindi');
  } catch (err) {
    if (err instanceof CurrenciesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Para birimi silinemedi');
  }
});
