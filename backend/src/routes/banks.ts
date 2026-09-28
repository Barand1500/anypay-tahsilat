import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  BanksError,
  createBank,
  listBanks,
  refreshBanksFromDisk,
  softDeleteBank,
  updateBank,
} from '../services/banksService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const banksRouter = Router();
banksRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().min(1).max(255),
  securityTypes: z.string().max(255).optional().default(''),
  gateway3dUrl: z.string().max(512).optional().default(''),
  apiUrl: z.string().max(512).optional().default(''),
  xmlUrl: z.string().max(512).optional().default(''),
  logoDataUrl: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});

banksRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listBanks());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Bankalar yüklenemedi');
  }
});

banksRouter.post('/refresh', async (req: AuthedRequest, res) => {
  try {
    const data = await refreshBanksFromDisk();
    await writePanelLog(req.auth!.sub, `Bankalar listesi yenilendi — ${data.matched} kayıt`);
    return sendSuccess(res, await listBanks(), 'Bankalar güncellendi');
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Bankalar güncellenemedi');
  }
});

banksRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createBank(parsed.data);
    await writePanelLog(req.auth!.sub, `Banka eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Banka eklendi', 201);
  } catch (err) {
    if (err instanceof BanksError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Banka eklenemedi');
  }
});

banksRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateBank(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Banka güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Banka güncellendi');
  } catch (err) {
    if (err instanceof BanksError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Banka güncellenemedi');
  }
});

banksRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteBank(id);
    await writePanelLog(req.auth!.sub, `Banka silindi — #${id}`);
    return sendSuccess(res, { id }, 'Banka silindi');
  } catch (err) {
    if (err instanceof BanksError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Banka silinemedi');
  }
});
