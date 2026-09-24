import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  RolesError,
  createRole,
  listRoles,
  softDeleteRole,
  updateRole,
} from '../services/rolesService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

const pagePermSchema = z.object({
  view: z.boolean(),
  save: z.boolean(),
  remove: z.boolean(),
});

const createSchema = z.object({
  name: z.string().min(1, 'Rol adı gerekli').max(255),
  isAdmin: z.boolean().optional(),
  permissions: z.record(pagePermSchema).optional(),
  code: z.string().max(255).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isAdmin: z.boolean().optional(),
  permissions: z.record(pagePermSchema).optional(),
});

rolesRouter.get('/', async (_req, res) => {
  try {
    const data = await listRoles();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Roller yüklenemedi');
  }
});

rolesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await createRole(parsed.data);
    return sendSuccess(res, data, 'Rol eklendi', 201);
  } catch (err) {
    if (err instanceof RolesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Rol eklenemedi');
  }
});

rolesRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await updateRole(id, parsed.data);
    return sendSuccess(res, data, 'Rol güncellendi');
  } catch (err) {
    if (err instanceof RolesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Rol güncellenemedi');
  }
});

rolesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  try {
    await softDeleteRole(id);
    return sendSuccess(res, { ok: true }, 'Rol silindi');
  } catch (err) {
    if (err instanceof RolesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Rol silinemedi');
  }
});
