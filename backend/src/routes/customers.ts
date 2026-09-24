import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  CustomersError,
  createCustomer,
  getCustomer,
  getCustomerMeta,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
} from '../services/customersService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const customersRouter = Router();

customersRouter.use(requireAuth);

const kindSchema = z.enum(['gercek', 'tuzel', 'yabanci']);

const upsertSchema = z.object({
  code: z.string().max(255).optional(),
  title: z.string().min(1, 'Ünvan / ad soyad gerekli').max(255),
  kind: kindSchema,
  phone: z.string().min(10, 'Telefon gerekli').max(20),
  email: z.string().max(255).optional().default(''),
  taxNo: z.string().max(20).optional().default(''),
  taxOfficeId: z.number().int().nullable().optional(),
  identityNo: z.string().max(20).optional().default(''),
  address: z.string().max(5000).optional().default(''),
  accountTypeId: z.number().int().nullable().optional(),
  accountTypeName: z.string().max(255).optional(),
  parentId: z.number().int().nullable().optional(),
});

customersRouter.get('/meta', async (_req, res) => {
  try {
    const data = await getCustomerMeta();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Müşteri meta yüklenemedi');
  }
});

customersRouter.get('/', async (req, res) => {
  try {
    const ustRaw = typeof req.query.ust === 'string' ? req.query.ust : undefined;
    let parentId: number | null | 'root' | undefined;
    if (ustRaw === 'root' || ustRaw === '') parentId = 'root';
    else if (ustRaw != null && ustRaw !== 'all') {
      const n = Number(ustRaw);
      parentId = Number.isFinite(n) ? n : 'root';
    }

    const data = await listCustomers({
      parentId,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Müşteriler yüklenemedi');
  }
});

customersRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  try {
    const data = await getCustomer(id);
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof CustomersError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Müşteri yüklenemedi');
  }
});

customersRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCustomer({
      ...parsed.data,
      taxOfficeId: parsed.data.taxOfficeId ?? null,
      accountTypeId: parsed.data.accountTypeId ?? null,
      parentId: parsed.data.parentId ?? null,
    });
    await writePanelLog(req.auth!.sub, `Müşteri - ${data.title} eklendi.`);
    return sendSuccess(res, data, 'Müşteri eklendi', 201);
  } catch (err) {
    if (err instanceof CustomersError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Müşteri eklenemedi');
  }
});

customersRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCustomer(id, {
      ...parsed.data,
      taxOfficeId: parsed.data.taxOfficeId ?? null,
      accountTypeId: parsed.data.accountTypeId ?? null,
      parentId: parsed.data.parentId ?? null,
    });
    await writePanelLog(req.auth!.sub, `Müşteri - ${data.title} güncellendi.`);
    return sendSuccess(res, data, 'Müşteri güncellendi');
  } catch (err) {
    if (err instanceof CustomersError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Müşteri güncellenemedi');
  }
});

customersRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  try {
    await softDeleteCustomer(id);
    await writePanelLog(req.auth!.sub, `Müşteri - #${id} silindi.`);
    return sendSuccess(res, { ok: true }, 'Müşteri silindi');
  } catch (err) {
    if (err instanceof CustomersError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Müşteri silinemedi');
  }
});
