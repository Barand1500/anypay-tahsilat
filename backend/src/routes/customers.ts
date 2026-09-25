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
import {
  CustomerDetailError,
  createCustomerAddress,
  createCustomerUser,
  listCountries,
  listCustomerAddresses,
  listCustomerUsers,
  listDistricts,
  listNeighborhoods,
  listProvinces,
  listStreets,
  listTowns,
  resetCustomerUserPassword,
  softDeleteCustomerAddress,
  softDeleteCustomerUser,
  updateCustomerAddress,
  updateCustomerUser,
} from '../services/customerDetailService.js';
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

customersRouter.get('/locations/countries', async (_req, res) => {
  try {
    return sendSuccess(res, await listCountries());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Ülkeler yüklenemedi');
  }
});

customersRouter.get('/locations/provinces', async (req, res) => {
  const ulkeId = Number(req.query.ulkeId);
  if (!Number.isFinite(ulkeId)) return sendError(res, 400, 'ulkeId gerekli');
  try {
    return sendSuccess(res, await listProvinces(ulkeId));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'İller yüklenemedi');
  }
});

customersRouter.get('/locations/districts', async (req, res) => {
  const ilId = Number(req.query.ilId);
  if (!Number.isFinite(ilId)) return sendError(res, 400, 'ilId gerekli');
  try {
    return sendSuccess(res, await listDistricts(ilId));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'İlçeler yüklenemedi');
  }
});

customersRouter.get('/locations/towns', async (req, res) => {
  const ilceId = Number(req.query.ilceId);
  if (!Number.isFinite(ilceId)) return sendError(res, 400, 'ilceId gerekli');
  try {
    return sendSuccess(res, await listTowns(ilceId));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Semtler yüklenemedi');
  }
});

customersRouter.get('/locations/neighborhoods', async (req, res) => {
  const semtId = Number(req.query.semtId);
  if (!Number.isFinite(semtId)) return sendError(res, 400, 'semtId gerekli');
  try {
    return sendSuccess(res, await listNeighborhoods(semtId));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Mahalleler yüklenemedi');
  }
});

customersRouter.get('/locations/streets', async (req, res) => {
  const mahalleId = Number(req.query.mahalleId);
  if (!Number.isFinite(mahalleId)) return sendError(res, 400, 'mahalleId gerekli');
  try {
    return sendSuccess(res, await listStreets(mahalleId));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sokaklar yüklenemedi');
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

const userCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(180),
  phone: z.string().min(10).max(20),
  password: z.string().max(128).optional(),
  sendEmail: z.boolean().optional().default(false),
});

const passwordResetSchema = z.object({
  channel: z.enum(['mail', 'sms', 'wp']).optional().default('mail'),
});

const userPatchSchema = z
  .object({
    active: z.boolean().optional(),
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().max(180).optional(),
    phone: z.string().min(10).max(20).optional(),
  })
  .refine(
    (d) => d.active !== undefined || d.name != null || d.email != null || d.phone != null,
    { message: 'Güncellenecek alan yok' },
  );

const addressCreateSchema = z.object({
  label: z.string().min(1).max(255),
  ulkeId: z.number().int().positive(),
  ilId: z.number().int().positive(),
  ilceId: z.number().int().positive(),
  semtId: z.number().int().positive(),
  mahalleId: z.number().int().positive(),
  sokakId: z.number().int().positive(),
  directions: z.string().max(5000).optional().default(''),
  yetkiliIds: z.array(z.number().int().positive()).optional().default([]),
  isDefault: z.boolean().optional(),
});

customersRouter.get('/:id/users', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  try {
    return sendSuccess(res, await listCustomerUsers(id));
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Kullanıcılar yüklenemedi');
  }
});

customersRouter.post('/:id/users', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCustomerUser(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Müşteri kullanıcısı eklendi — ${data.name}`);
    const msg =
      parsed.data.sendEmail && data.emailSent
        ? 'Kullanıcı eklendi · giriş bilgileri e-posta ile gönderildi'
        : parsed.data.sendEmail && !data.emailSent
          ? 'Kullanıcı eklendi · e-posta gönderilemedi (SMTP)'
          : 'Kullanıcı eklendi';
    return sendSuccess(res, data, msg, 201);
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kullanıcı eklenemedi');
  }
});

customersRouter.patch('/:id/users/:userId', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isFinite(id) || !Number.isFinite(userId)) {
    return sendError(res, 400, 'Geçersiz istek');
  }
  const parsed = userPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCustomerUser(id, userId, parsed.data);
    return sendSuccess(res, data, 'Kullanıcı güncellendi');
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kullanıcı güncellenemedi');
  }
});

customersRouter.post('/:id/users/:userId/password-reset', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isFinite(id) || !Number.isFinite(userId)) {
    return sendError(res, 400, 'Geçersiz istek');
  }
  const parsed = passwordResetSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await resetCustomerUserPassword(id, userId, parsed.data.channel);
    await writePanelLog(req.auth!.sub, `Müşteri kullanıcı şifresi sıfırlandı — #${userId}`);
    const msg =
      data.channel === 'mail' && data.emailSent
        ? 'Yeni şifre e-posta ile gönderildi'
        : data.channel === 'mail' && !data.emailSent
          ? 'Şifre oluşturuldu · e-posta iletilemedi'
          : 'Yeni şifre oluşturuldu';
    return sendSuccess(res, data, msg);
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şifre sıfırlanamadı');
  }
});

customersRouter.delete('/:id/users/:userId', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isFinite(id) || !Number.isFinite(userId)) {
    return sendError(res, 400, 'Geçersiz istek');
  }
  try {
    await softDeleteCustomerUser(id, userId);
    await writePanelLog(req.auth!.sub, `Müşteri kullanıcısı silindi — #${userId}`);
    return sendSuccess(res, { ok: true }, 'Kullanıcı silindi');
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kullanıcı silinemedi');
  }
});

customersRouter.get('/:id/addresses', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  try {
    return sendSuccess(res, await listCustomerAddresses(id));
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Adresler yüklenemedi');
  }
});

customersRouter.post('/:id/addresses', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz müşteri');
  const parsed = addressCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCustomerAddress(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Müşteri adresi eklendi — ${data.label}`);
    return sendSuccess(res, data, 'Adres eklendi', 201);
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Adres eklenemedi');
  }
});

customersRouter.patch('/:id/addresses/:addrId', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const addrId = Number(req.params.addrId);
  if (!Number.isFinite(id) || !Number.isFinite(addrId)) {
    return sendError(res, 400, 'Geçersiz istek');
  }
  const parsed = addressCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCustomerAddress(id, addrId, parsed.data);
    await writePanelLog(req.auth!.sub, `Müşteri adresi güncellendi — ${data.label}`);
    return sendSuccess(res, data, 'Adres güncellendi');
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Adres güncellenemedi');
  }
});

customersRouter.delete('/:id/addresses/:addrId', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const addrId = Number(req.params.addrId);
  if (!Number.isFinite(id) || !Number.isFinite(addrId)) {
    return sendError(res, 400, 'Geçersiz istek');
  }
  try {
    await softDeleteCustomerAddress(id, addrId);
    await writePanelLog(req.auth!.sub, `Müşteri adresi silindi — #${addrId}`);
    return sendSuccess(res, { ok: true }, 'Adres silindi');
  } catch (err) {
    if (err instanceof CustomerDetailError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Adres silinemedi');
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
