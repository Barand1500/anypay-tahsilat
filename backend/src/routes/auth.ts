import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AuthError, getUserById, loginWithPassword } from '../services/authService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Şifre gerekli'),
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

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await getUserById(req.auth!.sub);
  if (!user) return sendError(res, 401, 'Kullanıcı bulunamadı');
  return sendSuccess(res, user);
});

// Stateless JWT — istemci token'ı siler; endpoint ileride blacklist için hazır
authRouter.post('/logout', requireAuth, (_req, res) => {
  return sendSuccess(res, { ok: true }, 'Çıkış yapıldı');
});
