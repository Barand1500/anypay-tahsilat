import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  TaxOfficesError,
  createTaxOffice,
  listTaxOffices,
  softDeleteTaxOffice,
  updateTaxOffice,
} from '../services/taxOfficesService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const taxOfficesRouter = Router();
taxOfficesRouter.use(requireAuth);
taxOfficesRouter.use(requireModuleWrite('/tanimlamalar/vergi-daireleri'));

const upsertSchema = z.object({
  city: z.string().min(1).max(255),
  district: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
});

taxOfficesRouter.get('/', async (_req, res) => {
  try {
    const { ensureVergiDairesiLocationColumns } = await import('../lib/ensureSchema.js');
    await ensureVergiDairesiLocationColumns();
    return sendSuccess(res, await listTaxOffices());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Vergi daireleri yüklenemedi');
  }
});

taxOfficesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createTaxOffice(parsed.data);
    await writePanelLog(req.auth!.sub, `Vergi dairesi eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Vergi dairesi eklendi', 201);
  } catch (err) {
    if (err instanceof TaxOfficesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Vergi dairesi eklenemedi');
  }
});

taxOfficesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateTaxOffice(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Vergi dairesi güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Vergi dairesi güncellendi');
  } catch (err) {
    if (err instanceof TaxOfficesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Vergi dairesi güncellenemedi');
  }
});

taxOfficesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteTaxOffice(id);
    await writePanelLog(req.auth!.sub, `Vergi dairesi silindi — #${id}`);
    return sendSuccess(res, { id }, 'Vergi dairesi silindi');
  } catch (err) {
    if (err instanceof TaxOfficesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Vergi dairesi silinemedi');
  }
});
