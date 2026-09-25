import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  SettingsError,
  getBrandAssets,
  getContactSettings,
  getGeneralSettings,
  updateContactSettings,
  updateGeneralSettings,
} from '../services/settingsService.js';
import {
  getInstallmentPriority,
  updateInstallmentPriority,
  type InstallmentSource,
} from '../services/installmentPriorityService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const settingsRouter = Router();

const generalPatchSchema = z.object({
  systemName: z.string().min(1, 'Sistem adı gerekli').max(255),
  systemUrl: z.string().min(1, 'Sistem adresi gerekli').max(255),
  virtualPosTarget: z.boolean(),
  appSignup: z.boolean(),
  notifyEmails: z.array(z.string().email('Geçersiz e-posta').max(180)).max(50),
  notifyPhones: z
    .array(z.string().max(20))
    .max(50)
    .transform((list) =>
      list
        .map((raw) => {
          let d = raw.replace(/\D/g, '');
          if (d.startsWith('90') && d.length > 10) d = d.slice(2);
          if (d.startsWith('0')) d = d.slice(1);
          return d.slice(0, 11);
        })
        .filter((d) => d.length >= 10),
    ),
  binListUrl: z.string().max(255),
  logoDataUrl: z.string().max(6_000_000).nullable().optional(),
  faviconDataUrl: z.string().max(6_000_000).nullable().optional(),
});

/** Marka varlıkları — sidebar / favicon (oturum gerekmez) */
settingsRouter.get('/brand', async (_req, res) => {
  try {
    const data = await getBrandAssets();
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Marka yüklenemedi');
  }
});

settingsRouter.use(requireAuth);

settingsRouter.get('/general', async (_req, res) => {
  try {
    const data = await getGeneralSettings();
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Ayarlar yüklenemedi');
  }
});

settingsRouter.patch('/general', async (req: AuthedRequest, res) => {
  const parsed = generalPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await updateGeneralSettings({
      ...parsed.data,
      logoDataUrl: parsed.data.logoDataUrl || null,
      faviconDataUrl: parsed.data.faviconDataUrl || null,
    });
    await writePanelLog(req.auth!.sub, 'Ayarlar - Genel ayarlar güncellendi.');
    return sendSuccess(res, data, 'Ayarlar kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ayarlar kaydedilemedi');
  }
});

const contactPatchSchema = z.object({
  title: z.string().min(1, 'Ünvan / ad soyad gerekli').max(255),
  kind: z.enum(['gercek', 'tuzel', 'yabanci']),
  taxNo: z.string().max(10).optional().default(''),
  taxOfficeId: z.number().int().nullable().optional(),
  identityNo: z.string().max(20).optional().default(''),
  address: z.string().min(1, 'Adres gerekli').max(5000),
  email: z.string().email('Geçerli e-posta girin').max(255),
  phone: z.string().min(10, 'Telefon gerekli').max(20),
  gsm: z.string().max(20).optional().default(''),
  fax: z.string().max(20).optional().default(''),
});

settingsRouter.get('/contact', async (_req, res) => {
  try {
    const data = await getContactSettings();
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'İletişim bilgileri yüklenemedi');
  }
});

settingsRouter.patch('/contact', async (req: AuthedRequest, res) => {
  const parsed = contactPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await updateContactSettings({
      title: parsed.data.title,
      kind: parsed.data.kind,
      taxNo: parsed.data.taxNo,
      taxOfficeId: parsed.data.taxOfficeId ?? null,
      identityNo: parsed.data.identityNo,
      address: parsed.data.address,
      email: parsed.data.email,
      phone: parsed.data.phone,
      gsm: parsed.data.gsm,
      fax: parsed.data.fax,
    });
    await writePanelLog(req.auth!.sub, 'Ayarlar - İletişim bilgileri güncellendi.');
    return sendSuccess(res, data, 'İletişim bilgileri kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'İletişim bilgileri kaydedilemedi');
  }
});

const prioritySchema = z.object({
  order: z.array(z.enum(['user', 'cari', 'sube'])).min(2).max(3),
});

settingsRouter.get('/installment-priority', async (_req, res) => {
  try {
    return sendSuccess(res, await getInstallmentPriority());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sıralama yüklenemedi');
  }
});

settingsRouter.patch('/installment-priority', async (req: AuthedRequest, res) => {
  const parsed = prioritySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz sıralama');
  }
  try {
    const data = await updateInstallmentPriority(parsed.data.order as InstallmentSource[]);
    await writePanelLog(req.auth!.sub, `Taksit sıralaması güncellendi — ${data.order.join(' › ')}`);
    return sendSuccess(res, data, 'Sıralama kaydedildi');
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sıralama kaydedilemedi');
  }
});
