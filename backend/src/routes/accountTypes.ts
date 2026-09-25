import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  AccountTypesError,
  createAccountType,
  listAccountTypes,
  softDeleteAccountType,
  updateAccountType,
} from '../services/accountTypesService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const accountTypesRouter = Router();
accountTypesRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  installments: z.array(z.number().int().min(1).max(12)).optional().default([]),
});

accountTypesRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listAccountTypes());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Cari tipleri yüklenemedi');
  }
});

accountTypesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createAccountType(parsed.data);
    await writePanelLog(req.auth!.sub, `Cari tipi eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Cari tipi eklendi', 201);
  } catch (err) {
    if (err instanceof AccountTypesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Cari tipi eklenemedi');
  }
});

accountTypesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateAccountType(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Cari tipi güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Cari tipi güncellendi');
  } catch (err) {
    if (err instanceof AccountTypesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Cari tipi güncellenemedi');
  }
});

accountTypesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteAccountType(id);
    await writePanelLog(req.auth!.sub, `Cari tipi silindi — #${id}`);
    return sendSuccess(res, { id }, 'Cari tipi silindi');
  } catch (err) {
    if (err instanceof AccountTypesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Cari tipi silinemedi');
  }
});
