import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  AuthError,
  getUserById,
  loginWithOtp,
  loginWithPassword,
  requestLoginOtp,
  requestPasswordReset,
  resetPasswordWithToken,
  updateOwnProfile,
  verifyPasswordResetCode,
  verifyPasswordMfa,
} from '../services/authService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Şifre gerekli'),
});

const mfaVerifySchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, '6 haneli kodu girin'),
});

const emailSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
});

const otpLoginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  code: z.string().min(4, 'Kod gerekli').max(12),
});

const forgotVerifySchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  code: z.string().min(4, 'Kod gerekli').max(12),
});

const forgotResetSchema = z.object({
  resetToken: z.string().min(10, 'Doğrulama gerekli'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı').max(128),
});

const profileSchema = z.object({
  adsoyad: z.string().min(1, 'Ad soyad gerekli').max(255).optional(),
  email: z.string().email('Geçerli bir e-posta girin').optional(),
  telefon: z.string().max(20).optional(),
  password: z.string().max(128).optional(),
  twoFactor: z.boolean().optional(),
  resimDataUrl: z.string().max(5_000_000).nullable().optional(),
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

authRouter.post('/login/mfa/verify', async (req, res) => {
  const parsed = mfaVerifySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  try {
    const result = await verifyPasswordMfa(parsed.data.challengeToken, parsed.data.code);
    return sendSuccess(res, result, 'Giriş başarılı');
  } catch (err) {
    if (err instanceof AuthError) return sendError(res, 401, err.message);
    console.error(err);
    return sendError(res, 500, 'Kod doğrulanamadı');
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

authRouter.post('/forgot/request', async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    await requestPasswordReset(parsed.data.email);
    return sendSuccess(res, { sent: true }, 'Doğrulama kodu gönderildi');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Kod gönderilemedi');
  }
});

authRouter.post('/forgot/verify', async (req, res) => {
  const parsed = forgotVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await verifyPasswordResetCode(parsed.data.email, parsed.data.code);
    return sendSuccess(res, data, 'Kod doğrulandı');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Kod doğrulanamadı');
  }
});

authRouter.post('/forgot/reset', async (req, res) => {
  const parsed = forgotResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await resetPasswordWithToken(parsed.data.resetToken, parsed.data.password);
    return sendSuccess(res, data, 'Şifre güncellendi');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Şifre güncellenemedi');
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await getUserById(req.auth!.sub);
  if (!user) return sendError(res, 401, 'Kullanıcı bulunamadı');
  return sendSuccess(res, user);
});

authRouter.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const user = await updateOwnProfile(req.auth!.sub, parsed.data);
    await writePanelLog(req.auth!.sub, 'Profil - Profil bilgileri güncellendi.');
    return sendSuccess(res, user, 'Profil güncellendi');
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, 400, err.message);
    }
    console.error(err);
    return sendError(res, 500, 'Profil güncellenemedi');
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  await writePanelLog(req.auth!.sub, 'Çıkış - Oturum sonlandırıldı.');
  return sendSuccess(res, { ok: true }, 'Çıkış yapıldı');
});
