import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  VaultError,
  clearVaultPassword,
  createVaultEntry,
  getVaultStatus,
  listVaultEntries,
  requestVaultForgot,
  setVaultPassword,
  softDeleteVaultEntry,
  unlockVault,
  updateVaultEntry,
  verifyVaultForgot,
} from '../services/vaultService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const vaultRouter = Router();
vaultRouter.use(requireAuth);

function unlockHeader(req: AuthedRequest): string | undefined {
  const h = req.headers['x-vault-token'];
  return typeof h === 'string' ? h : undefined;
}

vaultRouter.get('/status', async (req: AuthedRequest, res) => {
  try {
    return sendSuccess(res, await getVaultStatus(req.auth!.sub));
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Kasa durumu alınamadı');
  }
});

vaultRouter.post('/unlock', async (req: AuthedRequest, res) => {
  const parsed = z.object({ password: z.string().min(1).max(64) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Şifre gerekli');
  try {
    return sendSuccess(res, await unlockVault(req.auth!.sub, parsed.data.password));
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kasa açılamadı');
  }
});

vaultRouter.post('/password', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      password: z.string().min(4).max(64),
      unlockToken: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Geçerli şifre girin (min. 4)');
  try {
    const data = await setVaultPassword(req.auth!.sub, parsed.data.password, {
      unlockToken: parsed.data.unlockToken || unlockHeader(req),
    });
    return sendSuccess(res, data, 'Kasa şifresi kaydedildi');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şifre kaydedilemedi');
  }
});

vaultRouter.delete('/password', async (req: AuthedRequest, res) => {
  try {
    await clearVaultPassword(req.auth!.sub, unlockHeader(req));
    return sendSuccess(res, { ok: true }, 'Kasa şifresi kaldırıldı');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şifre kaldırılamadı');
  }
});

vaultRouter.post('/forgot/request', async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.auth!.sub },
      select: { email: true, adsoyad: true },
    });
    if (!user?.email) return sendError(res, 400, 'E-posta bulunamadı');
    const data = await requestVaultForgot(req.auth!.sub, user.email, user.adsoyad);
    return sendSuccess(res, data, 'Kod e-postanıza gönderildi');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kod gönderilemedi');
  }
});

vaultRouter.post('/forgot/verify', async (req: AuthedRequest, res) => {
  const parsed = z.object({ code: z.string().min(4).max(12) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Kod gerekli');
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.auth!.sub },
      select: { email: true },
    });
    if (!user?.email) return sendError(res, 400, 'E-posta bulunamadı');
    const data = await verifyVaultForgot(req.auth!.sub, user.email, parsed.data.code);
    return sendSuccess(res, data, 'Kasa açıldı — şifrenizi değiştirin');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kod doğrulanamadı');
  }
});

vaultRouter.get('/entries', async (req: AuthedRequest, res) => {
  try {
    return sendSuccess(res, await listVaultEntries(req.auth!.sub, unlockHeader(req)));
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 401, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıtlar yüklenemedi');
  }
});

const entrySchema = z.object({
  tip: z.string().min(1).max(32),
  etiket: z.string().min(1).max(64),
  baslik: z.string().min(1).max(255),
  deger: z.string().min(1).max(8000),
});

vaultRouter.post('/entries', async (req: AuthedRequest, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz kayıt');
  }
  try {
    const data = await createVaultEntry(req.auth!.sub, unlockHeader(req), parsed.data);
    return sendSuccess(res, data, 'Kayıt eklendi', 201);
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt eklenemedi');
  }
});

vaultRouter.patch('/entries/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = entrySchema.partial().safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await updateVaultEntry(req.auth!.sub, unlockHeader(req), id, parsed.data);
    return sendSuccess(res, data, 'Kayıt güncellendi');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt güncellenemedi');
  }
});

vaultRouter.delete('/entries/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteVaultEntry(req.auth!.sub, unlockHeader(req), id);
    return sendSuccess(res, { id }, 'Kayıt silindi');
  } catch (err) {
    if (err instanceof VaultError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt silinemedi');
  }
});
