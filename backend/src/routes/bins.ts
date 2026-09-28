import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  BinsError,
  createBin,
  listBins,
  lookupBinByCard,
  seedBinsIfEmpty,
  softDeleteBin,
  updateBin,
} from '../services/binsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const binsRouter = Router();

const upsertSchema = z.object({
  bankId: z.string().max(32).nullable().optional(),
  bank: z.string().min(1).max(255),
  bin: z.string().min(4).max(8),
  type: z.string().max(64).optional().default(''),
  brand: z.string().max(64).optional().default(''),
  kind: z.string().max(64).optional().default(''),
});

/** Ödeme ekranı — auth’lu lookup */
binsRouter.get('/lookup', requireAuth, async (req, res) => {
  const digits = String(req.query.card || req.query.digits || '').replace(/\D/g, '');
  if (digits.length < 4) return sendSuccess(res, null);
  try {
    const hit = await lookupBinByCard(digits);
    return sendSuccess(res, hit);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'BIN sorgulanamadı');
  }
});

binsRouter.use(requireAuth);
binsRouter.use(requireModuleWrite('/tanimlamalar'));

binsRouter.get('/', async (_req, res) => {
  try {
    await seedBinsIfEmpty();
    return sendSuccess(res, await listBins());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'BIN listesi yüklenemedi');
  }
});

binsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createBin(parsed.data);
    await writePanelLog(req.auth!.sub, `BIN eklendi — ${data.bin} / ${data.bank}`);
    return sendSuccess(res, data, 'BIN kaydedildi', 201);
  } catch (err) {
    if (err instanceof BinsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'BIN kaydedilemedi');
  }
});

binsRouter.post('/bulk', async (req: AuthedRequest, res) => {
  const parsed = z.array(upsertSchema).min(1).max(200).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const created = [];
    for (const row of parsed.data) {
      created.push(await createBin(row));
    }
    await writePanelLog(req.auth!.sub, `${created.length} BIN eklendi`);
    return sendSuccess(res, created, `${created.length} BIN kaydedildi`, 201);
  } catch (err) {
    if (err instanceof BinsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'BIN toplu kayıt başarısız');
  }
});

binsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz BIN');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateBin(id, parsed.data);
    await writePanelLog(req.auth!.sub, `BIN güncellendi — ${data.bin}`);
    return sendSuccess(res, data, 'BIN güncellendi');
  } catch (err) {
    if (err instanceof BinsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'BIN güncellenemedi');
  }
});

binsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz BIN');
  try {
    await softDeleteBin(id);
    await writePanelLog(req.auth!.sub, `BIN silindi — #${id}`);
    return sendSuccess(res, { id }, 'BIN silindi');
  } catch (err) {
    if (err instanceof BinsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'BIN silinemedi');
  }
});
