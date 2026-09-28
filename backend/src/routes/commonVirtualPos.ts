import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  CommonVirtualPosError,
  createCommonVirtualPos,
  listCommonVirtualPos,
  softDeleteCommonVirtualPos,
  updateCommonVirtualPos,
} from '../services/commonVirtualPosService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const commonVirtualPosRouter = Router();
commonVirtualPosRouter.use(requireAuth);
commonVirtualPosRouter.use(requireModuleWrite('/tanimlamalar'));

const upsertSchema = z.object({
  bankId: z.string().min(1),
  targetBankId: z.string().min(1),
  active: z.boolean().optional().default(true),
});

commonVirtualPosRouter.get('/', async (_req, res) => {
  try {
    const { ensureOrtakSanalPosTable } = await import('../lib/ensureSchema.js');
    await ensureOrtakSanalPosTable();
    return sendSuccess(res, await listCommonVirtualPos());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Ortak Sanal POS listesi yüklenemedi');
  }
});

commonVirtualPosRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCommonVirtualPos(parsed.data);
    await writePanelLog(
      req.auth!.sub,
      `Ortak Sanal POS eklendi — ${data.bankName} → ${data.targetBankName}`,
    );
    return sendSuccess(res, data, 'Ortak Sanal POS eklendi', 201);
  } catch (err) {
    if (err instanceof CommonVirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ortak Sanal POS eklenemedi');
  }
});

commonVirtualPosRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCommonVirtualPos(id, parsed.data);
    await writePanelLog(
      req.auth!.sub,
      `Ortak Sanal POS güncellendi — ${data.bankName} → ${data.targetBankName}`,
    );
    return sendSuccess(res, data, 'Ortak Sanal POS güncellendi');
  } catch (err) {
    if (err instanceof CommonVirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ortak Sanal POS güncellenemedi');
  }
});

commonVirtualPosRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteCommonVirtualPos(id);
    await writePanelLog(req.auth!.sub, `Ortak Sanal POS silindi — #${id}`);
    return sendSuccess(res, { id }, 'Ortak Sanal POS silindi');
  } catch (err) {
    if (err instanceof CommonVirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ortak Sanal POS silinemedi');
  }
});
