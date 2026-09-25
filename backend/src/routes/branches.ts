import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  BranchesError,
  createBranch,
  listBranchesFull,
  softDeleteBranch,
  updateBranch,
} from '../services/branchesService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const branchesRouter = Router();
branchesRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  installments: z.array(z.number().int().min(1).max(12)).optional().default([]),
});

branchesRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listBranchesFull());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Şubeler yüklenemedi');
  }
});

branchesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createBranch(parsed.data);
    await writePanelLog(req.auth!.sub, `Şube / departman eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Şube / departman eklendi', 201);
  } catch (err) {
    if (err instanceof BranchesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şube / departman eklenemedi');
  }
});

branchesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateBranch(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Şube / departman güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Şube / departman güncellendi');
  } catch (err) {
    if (err instanceof BranchesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şube / departman güncellenemedi');
  }
});

branchesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteBranch(id);
    await writePanelLog(req.auth!.sub, `Şube / departman silindi — #${id}`);
    return sendSuccess(res, { id }, 'Şube / departman silindi');
  } catch (err) {
    if (err instanceof BranchesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şube / departman silinemedi');
  }
});
