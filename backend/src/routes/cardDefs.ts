import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  CardDefsError,
  createCardBrand,
  createCardKind,
  createCardType,
  listCardBrands,
  listCardKinds,
  listCardTypes,
  softDeleteCardBrand,
  softDeleteCardKind,
  softDeleteCardType,
  updateCardBrand,
  updateCardKind,
  updateCardType,
} from '../services/cardDefsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

const nameSchema = z.object({
  name: z.string().min(1).max(255),
});

const brandSchema = z.object({
  name: z.string().min(1).max(255),
  logoDataUrl: z.string().nullable().optional(),
  initials: z.string().max(8).optional(),
});

function makeNamedRouter(opts: {
  label: string;
  modulePrefix: string;
  list: () => Promise<{ id: string; name: string }[]>;
  create: (name: string) => Promise<{ id: string; name: string }>;
  update: (id: number, name: string) => Promise<{ id: string; name: string }>;
  remove: (id: number) => Promise<void>;
}) {
  const router = Router();
  router.use(requireAuth);
  router.use(requireModuleWrite(opts.modulePrefix));

  router.get('/', async (_req, res) => {
    try {
      const { ensureKartDefsTables } = await import('../lib/ensureSchema.js');
      await ensureKartDefsTables();
      return sendSuccess(res, await opts.list());
    } catch (err) {
      console.error(err);
      return sendError(res, 500, `${opts.label} listesi yüklenemedi`);
    }
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
    }
    try {
      const data = await opts.create(parsed.data.name);
      await writePanelLog(req.auth!.sub, `${opts.label} eklendi — ${data.name}`);
      return sendSuccess(res, data, `${opts.label} eklendi`, 201);
    } catch (err) {
      if (err instanceof CardDefsError) return sendError(res, 400, err.message);
      console.error(err);
      return sendError(res, 500, `${opts.label} eklenemedi`);
    }
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
    }
    try {
      const data = await opts.update(id, parsed.data.name);
      await writePanelLog(req.auth!.sub, `${opts.label} güncellendi — ${data.name}`);
      return sendSuccess(res, data, `${opts.label} güncellendi`);
    } catch (err) {
      if (err instanceof CardDefsError) return sendError(res, 400, err.message);
      console.error(err);
      return sendError(res, 500, `${opts.label} güncellenemedi`);
    }
  });

  router.delete('/:id', async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
    try {
      await opts.remove(id);
      await writePanelLog(req.auth!.sub, `${opts.label} silindi — #${id}`);
      return sendSuccess(res, { id }, `${opts.label} silindi`);
    } catch (err) {
      if (err instanceof CardDefsError) return sendError(res, 400, err.message);
      console.error(err);
      return sendError(res, 500, `${opts.label} silinemedi`);
    }
  });

  return router;
}

export const cardTypesRouter = makeNamedRouter({
  modulePrefix: '/tanimlamalar/pos-kart/tipler',
  label: 'Kart tipi',
  list: listCardTypes,
  create: createCardType,
  update: updateCardType,
  remove: softDeleteCardType,
});

export const cardKindsRouter = makeNamedRouter({
  modulePrefix: '/tanimlamalar/pos-kart/turler',
  label: 'Kart türü',
  list: listCardKinds,
  create: createCardKind,
  update: updateCardKind,
  remove: softDeleteCardKind,
});

export const cardBrandsRouter = Router();
cardBrandsRouter.use(requireAuth);
cardBrandsRouter.use(requireModuleWrite('/tanimlamalar/pos-kart/markalar'));

cardBrandsRouter.get('/', async (_req, res) => {
  try {
    const { ensureKartDefsTables } = await import('../lib/ensureSchema.js');
    await ensureKartDefsTables();
    return sendSuccess(res, await listCardBrands());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Kart markaları yüklenemedi');
  }
});

cardBrandsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCardBrand(parsed.data);
    await writePanelLog(req.auth!.sub, `Kart markası eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Kart markası eklendi', 201);
  } catch (err) {
    if (err instanceof CardDefsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart markası eklenemedi');
  }
});

cardBrandsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCardBrand(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Kart markası güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Kart markası güncellendi');
  } catch (err) {
    if (err instanceof CardDefsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart markası güncellenemedi');
  }
});

cardBrandsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteCardBrand(id);
    await writePanelLog(req.auth!.sub, `Kart markası silindi — #${id}`);
    return sendSuccess(res, { id }, 'Kart markası silindi');
  } catch (err) {
    if (err instanceof CardDefsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart markası silinemedi');
  }
});
