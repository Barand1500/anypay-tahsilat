import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  LocationsError,
  createLocation,
  ensureLocationPathNames,
  listLocationsFlat,
  softDeleteLocation,
  updateLocation,
  type LocationLevel,
} from '../services/locationsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const locationsRouter = Router();
locationsRouter.use(requireAuth);
locationsRouter.use(requireModuleWrite('/tanimlamalar'));

const levelEnum = z.enum(['Ülke', 'İl', 'İlçe', 'Mahalle']);

locationsRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listLocationsFlat());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Lokasyonlar yüklenemedi');
  }
});

locationsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      name: z.string().min(1).max(255),
      level: levelEnum,
      parentId: z.string().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createLocation({
      name: parsed.data.name,
      level: parsed.data.level as LocationLevel,
      parentId: parsed.data.parentId ?? null,
    });
    await writePanelLog(req.auth!.sub, `Lokasyon eklendi — ${data.level}/${data.name}`);
    return sendSuccess(res, data, 'Lokasyon eklendi', 201);
  } catch (err) {
    if (err instanceof LocationsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Lokasyon eklenemedi');
  }
});

locationsRouter.post('/ensure-path', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      country: z.string().optional(),
      city: z.string().optional(),
      district: z.string().optional(),
      neighborhood: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await ensureLocationPathNames(parsed.data);
    return sendSuccess(res, data, 'Lokasyon yolu hazır');
  } catch (err) {
    if (err instanceof LocationsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Lokasyon yolu oluşturulamadı');
  }
});

locationsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id || '');
  const parsed = z
    .object({
      name: z.string().min(1).max(255),
      parentId: z.string().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateLocation(id, {
      name: parsed.data.name,
      parentId: parsed.data.parentId,
    });
    await writePanelLog(req.auth!.sub, `Lokasyon güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Lokasyon güncellendi');
  } catch (err) {
    if (err instanceof LocationsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Lokasyon güncellenemedi');
  }
});

locationsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id || '');
  try {
    await softDeleteLocation(id);
    await writePanelLog(req.auth!.sub, `Lokasyon silindi — ${id}`);
    return sendSuccess(res, { id }, 'Lokasyon silindi');
  } catch (err) {
    if (err instanceof LocationsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Lokasyon silinemedi');
  }
});
