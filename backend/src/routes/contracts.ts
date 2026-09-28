import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  ContractsError,
  createContract,
  getContractByLink,
  importContracts,
  listContracts,
  reorderContracts,
  softDeleteContract,
  updateContract,
} from '../services/contractsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const contractsRouter = Router();
contractsRouter.use(requireAuth);
contractsRouter.use(requireModuleWrite('/tanimlamalar'));

const linkSchema = z.enum([
  'none',
  'kvkk',
  'hizmet',
  'guvenlik',
  'tahsilat',
  'iptal-iade',
  'iletisim',
  'uyelik',
]);

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  body: z.string().max(500_000).optional().default(''),
  link: linkSchema.optional().default('none'),
});

const importSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        body: z.string().max(500_000).optional().default(''),
        link: linkSchema.optional(),
        order: z.number().int().optional(),
      }),
    )
    .min(1)
    .max(50),
});

contractsRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listContracts());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sözleşmeler yüklenemedi');
  }
});

contractsRouter.get('/by-link/:link', async (req, res) => {
  const link = String(req.params.link || '');
  if (!link || link === 'none') return sendError(res, 400, 'Geçersiz bağlantı');
  try {
    const data = await getContractByLink(link);
    if (!data) return sendError(res, 404, 'Sözleşme bulunamadı');
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sözleşme yüklenemedi');
  }
});

contractsRouter.post('/import', async (req: AuthedRequest, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await importContracts(parsed.data.items);
    await writePanelLog(req.auth!.sub, 'Sözleşmeler — yerel kayıtlar sunucuya aktarıldı');
    return sendSuccess(res, data, 'Sözleşmeler içe aktarıldı');
  } catch (err) {
    if (err instanceof ContractsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'İçe aktarma başarısız');
  }
});

contractsRouter.post('/reorder', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ ids: z.array(z.string().min(1)).min(1).max(100) })
    .safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Sıra listesi gerekli');
  const ids = parsed.data.ids
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
  if (!ids.length) return sendError(res, 400, 'Geçersiz id listesi');
  try {
    const data = await reorderContracts(ids);
    return sendSuccess(res, data, 'Sıra güncellendi');
  } catch (err) {
    if (err instanceof ContractsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sıra güncellenemedi');
  }
});

contractsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createContract(parsed.data);
    await writePanelLog(req.auth!.sub, `Sözleşme eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Sözleşme eklendi', 201);
  } catch (err) {
    if (err instanceof ContractsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sözleşme eklenemedi');
  }
});

contractsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateContract(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Sözleşme güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Sözleşme güncellendi');
  } catch (err) {
    if (err instanceof ContractsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sözleşme güncellenemedi');
  }
});

contractsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteContract(id);
    await writePanelLog(req.auth!.sub, `Sözleşme silindi — #${id}`);
    return sendSuccess(res, { id }, 'Sözleşme silindi');
  } catch (err) {
    if (err instanceof ContractsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sözleşme silinemedi');
  }
});
