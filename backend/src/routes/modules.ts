import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  ModulesError,
  createModule,
  listModules,
  listTableOptions,
  softDeleteModule,
  updateModule,
} from '../services/modulesService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const modulesRouter = Router();

modulesRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1, 'Ad gerekli').max(255),
  dbTable: z.string().min(1, 'DB tablo gerekli').max(255),
  urlPrefix: z.string().min(1, 'URL ön eki gerekli').max(255),
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  dbTable: z.string().min(1).max(255).optional(),
  urlPrefix: z.string().min(1).max(255).optional(),
});

modulesRouter.get('/', async (_req, res) => {
  try {
    const data = await listModules();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Modüller yüklenemedi');
  }
});

modulesRouter.get('/table-options', async (_req, res) => {
  try {
    const data = await listTableOptions();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Tablo listesi alınamadı');
  }
});

modulesRouter.post('/', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await createModule(parsed.data);
    return sendSuccess(res, data, 'Modül eklendi', 201);
  } catch (err) {
    if (err instanceof ModulesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Modül eklenemedi');
  }
});

modulesRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await updateModule(id, parsed.data);
    return sendSuccess(res, data, 'Modül güncellendi');
  } catch (err) {
    if (err instanceof ModulesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Modül güncellenemedi');
  }
});

modulesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  try {
    await softDeleteModule(id);
    return sendSuccess(res, { ok: true }, 'Modül silindi');
  } catch (err) {
    if (err instanceof ModulesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Modül silinemedi');
  }
});
