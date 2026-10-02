import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModulePerm } from '../middleware/permissions.js';
import {
  UsersError,
  createPanelUser,
  deletePanelUser,
  listBranches,
  listPanelUsers,
  updatePanelUser,
} from '../services/usersService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendCustomerCredentialsMail } from '../lib/mail.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.use(requireModulePerm('/kullanicilar'));

const statusSchema = z.enum(['Aktif', 'Pasif']);

const upsertSchema = z.object({
  name: z.string().min(1, 'Ad soyad gerekli').max(255),
  email: z.string().email('Geçerli e-posta girin').max(180),
  phone: z.string().min(10).max(20),
  roleId: z.string().min(1, 'Rol seçin'),
  branch: z.string().max(255).optional(),
  branches: z.array(z.string().max(255)).optional(),
  branchId: z.number().int().nullable().optional(),
  branchIds: z.array(z.number().int().positive()).optional(),
  status: statusSchema.optional(),
  installments: z.array(z.number().int().min(1).max(12)).optional(),
  password: z.string().max(128).optional(),
  sendPasswordEmail: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().min(10).max(20).optional(),
  roleId: z.string().min(1).optional(),
  branch: z.string().max(255).optional(),
  branches: z.array(z.string().max(255)).optional(),
  branchId: z.number().int().nullable().optional(),
  branchIds: z.array(z.number().int().positive()).optional(),
  status: statusSchema.optional(),
  installments: z.array(z.number().int().min(1).max(12)).optional(),
  password: z.string().max(128).optional(),
});

usersRouter.get('/', async (_req, res) => {
  try {
    const data = await listPanelUsers();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Kullanıcılar yüklenemedi');
  }
});

usersRouter.get('/branches', async (_req, res) => {
  try {
    const data = await listBranches();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Şubeler yüklenemedi');
  }
});

usersRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const { sendPasswordEmail, ...userInput } = parsed.data;
    const created = await createPanelUser(userInput);
    const data = created.user;
    let passwordEmailSent: boolean | undefined;
    const passwordToEmail = created.temporaryPassword ?? (sendPasswordEmail ? userInput.password : undefined);
    if (passwordToEmail) {
      try {
        await sendCustomerCredentialsMail(
          data.email,
          data.name,
          data.email,
          passwordToEmail,
          Boolean(created.temporaryPassword),
        );
        passwordEmailSent = true;
      } catch (mailError) {
        console.error('Kullanıcı giriş bilgileri e-postası gönderilemedi', mailError);
        passwordEmailSent = false;
      }
    }
    await writePanelLog(
      req.auth!.sub,
      `Kullanıcı - ${data.name} kullanıcısı eklendi.`,
    );
    return sendSuccess(
      res,
      { ...data, ...(passwordEmailSent === undefined ? {} : { passwordEmailSent }) },
      passwordEmailSent === false
        ? 'Kullanıcı eklendi ancak e-posta gönderilemedi'
        : passwordEmailSent
          ? 'Kullanıcı eklendi ve giriş bilgileri e-posta ile gönderildi'
          : 'Kullanıcı eklendi',
      201,
    );
  } catch (err) {
    if (err instanceof UsersError) return sendError(res, 400, err.message);
    console.error(err);
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return sendError(res, 409, 'Bu e-posta zaten kayıtlı');
    return sendError(res, 500, 'Kullanıcı eklenemedi');
  }
});

usersRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await updatePanelUser(id, parsed.data);
    await writePanelLog(
      req.auth!.sub,
      `Kullanıcı - ${data.name} kullanıcısı güncellendi.`,
    );
    return sendSuccess(res, data, 'Kullanıcı güncellendi');
  } catch (err) {
    if (err instanceof UsersError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kullanıcı güncellenemedi');
  }
});

usersRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  try {
    await deletePanelUser(id);
    await writePanelLog(req.auth!.sub, `Kullanıcı - #${id} kullanıcısı silindi.`);
    return sendSuccess(res, { ok: true }, 'Kullanıcı silindi');
  } catch (err) {
    if (err instanceof UsersError) return sendError(res, 400, err.message);
    console.error(err);
    const code = (err as { code?: string })?.code;
    if (code === 'P2003') {
      return sendError(res, 409, 'Kullanıcıya bağlı veriler kaldırılamadı. Lütfen tekrar deneyin.');
    }
    if (code === 'P2025') return sendError(res, 404, 'Kullanıcı bulunamadı');
    return sendError(res, 500, 'Kullanıcı silinemedi');
  }
});
