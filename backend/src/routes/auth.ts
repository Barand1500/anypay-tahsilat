import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  AuthError,
  getUserById,
  loginWithOtp,
  loginWithPassword,
  requestLoginOtp,
} from '../services/authService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Şifre gerekli'),
});

const emailSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
});

const otpLoginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  code: z.string().min(4, 'Kod gerekli').max(12),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const result = await loginWithPassword(parsed.data.email, parsed.data.password);
    return sendSuccess(res, result, 'Giriş başarılı');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 401, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Giriş sırasında hata oluştu');
  }
});

authRouter.post('/otp/request', async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    await requestLoginOtp(parsed.data.email);
    return sendSuccess(res, { sent: true }, 'Doğrulama kodu gönderildi');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Kod gönderilemedi');
  }
});

authRouter.post('/login-otp', async (req, res) => {
  const parsed = otpLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const result = await loginWithOtp(parsed.data.email, parsed.data.code);
    return sendSuccess(res, result, 'Giriş başarılı');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 401, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Giriş sırasında hata oluştu');
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await getUserById(req.auth!.sub);
  if (!user) return sendError(res, 401, 'Kullanıcı bulunamadı');
  return sendSuccess(res, user);
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  return sendSuccess(res, { ok: true }, 'Çıkış yapıldı');
});
