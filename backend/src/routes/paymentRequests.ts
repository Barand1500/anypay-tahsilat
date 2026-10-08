import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModulePerm } from '../middleware/permissions.js';
import {
  createPaymentRequest,
  emailPaymentRequest,
  getPaymentRequest,
  listPaymentRequests,
  PaymentRequestsError,
  smsPaymentRequest,
  softDeletePaymentRequest,
  updatePaymentRequest,
  whatsappPaymentRequest,
} from '../services/paymentRequestsService.js';
import {
  mergePayRequestPdfs,
  PayRequestFilesError,
  savePayRequestUploads,
} from '../services/payRequestFilesService.js';
import {
  getReminderSettings,
  processPaymentReminders,
  updateReminderSettings,
} from '../services/paymentReminderService.js';
import { SettingsError } from '../services/settingsService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const paymentRequestsRouter = Router();
paymentRequestsRouter.use(requireAuth);
paymentRequestsRouter.use(requireModulePerm('/odeme-istekleri'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
});

const createSchema = z.object({
  musteriId: z.number().int().positive(),
  payType: z.enum(['ch', 'fatura', 'sabit', 'serbest']),
  amount: z.number().nonnegative().finite(),
  commissionIncluded: z.boolean().optional().default(false),
  installments: z.array(z.number().int().min(1).max(12)).min(1),
  description: z.string().min(1).max(20000),
  faturaNo: z.string().max(255).optional().default(''),
  dosya: z.string().max(50000).nullable().optional(),
  parabirimiId: z.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  payType: z.enum(['ch', 'fatura', 'sabit', 'serbest']),
  amount: z.number().nonnegative().finite(),
  commissionIncluded: z.boolean().optional().default(false),
  installments: z.array(z.number().int().min(1).max(12)).min(1),
  description: z.string().min(1).max(20000),
  faturaNo: z.string().max(255).optional().default(''),
  dosya: z.string().max(50000).nullable().optional(),
  parabirimiId: z.number().int().positive().nullable().optional(),
});

const mergeSchema = z.object({
  paths: z.array(z.string().min(1).max(500)).min(2).max(12),
});

paymentRequestsRouter.get('/', async (_req, res) => {
  try {
    const data = await listPaymentRequests();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Ödeme istekleri yüklenemedi');
  }
});

const reminderSchema = z.object({
  active: z.boolean(),
  days: z.array(z.number().int().min(1).max(90)).min(1).max(8),
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
});

paymentRequestsRouter.get('/reminders/settings', async (_req, res) => {
  try {
    return sendSuccess(res, await getReminderSettings());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Hatırlatma ayarları yüklenemedi');
  }
});

paymentRequestsRouter.patch('/reminders/settings', async (req: AuthedRequest, res) => {
  const parsed = reminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateReminderSettings(parsed.data);
    await writePanelLog(req.auth!.sub, 'Ödeme isteği hatırlatma ayarları güncellendi.');
    return sendSuccess(res, data, 'Hatırlatma ayarları kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Hatırlatma ayarları kaydedilemedi');
  }
});

paymentRequestsRouter.post('/reminders/run', async (req: AuthedRequest, res) => {
  try {
    const data = await processPaymentReminders();
    await writePanelLog(
      req.auth!.sub,
      `Ödeme hatırlatma tarandı — gönderilen ${data.sent}, kontrol ${data.checked}`,
    );
    return sendSuccess(res, data, 'Hatırlatma tarandı');
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Hatırlatma çalıştırılamadı');
  }
});

paymentRequestsRouter.post('/files', upload.array('files', 12), async (req: AuthedRequest, res) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const data = await savePayRequestUploads(
      files.map((f) => ({
        originalname: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
    );
    await writePanelLog(req.auth!.sub, `Ödeme isteği dosya yüklendi — ${data.length} adet`);
    return sendSuccess(res, data, 'Dosyalar yüklendi', 201);
  } catch (err) {
    if (err instanceof PayRequestFilesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Dosya yüklenemedi');
  }
});

paymentRequestsRouter.post('/files/merge', async (req: AuthedRequest, res) => {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await mergePayRequestPdfs(parsed.data.paths);
    await writePanelLog(req.auth!.sub, `Ödeme isteği PDF birleştirildi — ${data.name}`);
    return sendSuccess(res, data, 'PDF birleştirildi', 201);
  } catch (err) {
    if (err instanceof PayRequestFilesError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'PDF birleştirilemedi');
  }
});

paymentRequestsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await getPaymentRequest(id);
    return sendSuccess(res, data);
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme isteği yüklenemedi');
  }
});

paymentRequestsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createPaymentRequest({
      musteriId: parsed.data.musteriId,
      payType: parsed.data.payType,
      amount: parsed.data.amount,
      commissionIncluded: parsed.data.commissionIncluded,
      installments: parsed.data.installments,
      description: parsed.data.description,
      faturaNo: parsed.data.faturaNo,
      dosya: parsed.data.dosya ?? null,
      parabirimiId: parsed.data.parabirimiId ?? null,
      kullaniciId: req.auth!.sub,
    });
    await writePanelLog(
      req.auth!.sub,
      `Ödeme isteği oluşturuldu — ${data.customerTitle} / ${data.amount.toFixed(2)} ${data.currencySymbol}`,
    );
    return sendSuccess(res, data, 'Ödeme isteği oluşturuldu', 201);
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    if (/Data too long|ER_DATA_TOO_LONG/i.test(msg)) {
      return sendError(
        res,
        500,
        'Dosya alanı veritabanında kısa (VARCHAR). Deploy sonrası şema güncellenmeli — dosya sütunu LONGTEXT olmalı.',
      );
    }
    return sendError(res, 500, 'Ödeme isteği oluşturulamadı');
  }
});

paymentRequestsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updatePaymentRequest(id, {
      payType: parsed.data.payType,
      amount: parsed.data.amount,
      commissionIncluded: parsed.data.commissionIncluded,
      installments: parsed.data.installments,
      description: parsed.data.description,
      faturaNo: parsed.data.faturaNo,
      dosya: parsed.data.dosya ?? null,
      parabirimiId: parsed.data.parabirimiId ?? null,
    });
    await writePanelLog(
      req.auth!.sub,
      `Ödeme isteği güncellendi — #${id} / ${data.amount.toFixed(2)} ${data.currencySymbol}`,
    );
    return sendSuccess(res, data, 'Ödeme isteği güncellendi');
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    if (/Data too long|ER_DATA_TOO_LONG/i.test(msg)) {
      return sendError(
        res,
        500,
        'Dosya alanı veritabanında kısa (VARCHAR). Deploy sonrası şema güncellenmeli — dosya sütunu LONGTEXT olmalı.',
      );
    }
    return sendError(res, 500, 'Ödeme isteği güncellenemedi');
  }
});

paymentRequestsRouter.post('/:id/email', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await emailPaymentRequest(id);
    await writePanelLog(
      req.auth!.sub,
      data.emailSent
        ? `Ödeme isteği e-posta gönderildi — #${id} → ${data.to}`
        : `Ödeme isteği e-posta başarısız — #${id} → ${data.to}`,
    );
    return sendSuccess(
      res,
      data,
      data.emailSent ? 'E-posta gönderildi' : 'E-posta gönderilemedi',
    );
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'E-posta gönderilemedi');
  }
});

paymentRequestsRouter.post('/:id/sms', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await smsPaymentRequest(id);
    await writePanelLog(
      req.auth!.sub,
      data.smsSent
        ? `Ödeme isteği SMS gönderildi — #${id} → ${data.to}`
        : `Ödeme isteği SMS başarısız — #${id} → ${data.to}${data.error ? ` (${data.error})` : ''}`,
    );
    return sendSuccess(
      res,
      data,
      data.smsSent ? 'SMS gönderildi' : data.error || 'SMS gönderilemedi',
    );
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'SMS gönderilemedi');
  }
});

paymentRequestsRouter.post('/:id/whatsapp', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await whatsappPaymentRequest(id);
    if (data.method === 'wa.me') {
      return sendSuccess(res, data, 'WhatsApp istemci açılacak');
    }
    await writePanelLog(
      req.auth!.sub,
      data.whatsappSent
        ? `Ödeme isteği WhatsApp gönderildi — #${id} → ${data.to}`
        : `Ödeme isteği WhatsApp başarısız — #${id} → ${data.to}${data.error ? ` (${data.error})` : ''}`,
    );
    return sendSuccess(
      res,
      data,
      data.whatsappSent ? 'WhatsApp gönderildi' : data.error || 'WhatsApp gönderilemedi',
    );
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'WhatsApp gönderilemedi');
  }
});

paymentRequestsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz istek');
  try {
    await softDeletePaymentRequest(id);
    await writePanelLog(req.auth!.sub, `Ödeme isteği silindi — #${id}`);
    return sendSuccess(res, { ok: true }, 'Ödeme isteği silindi');
  } catch (err) {
    if (err instanceof PaymentRequestsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme isteği silinemedi');
  }
});
