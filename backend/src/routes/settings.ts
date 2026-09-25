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
  getAppDefaultsSettings,
  updateAppDefaultsSettings,
} from '../services/defaultsService.js';
import {
  clearSmtpSettings,
  getSmtpSettings,
  updateSmtpSettings,
} from '../services/emailSmtpService.js';
import {
  createEmailTemplate,
  listEmailSablonOptions,
  listEmailTemplates,
  softDeleteEmailTemplate,
  updateEmailTemplate,
} from '../services/emailTemplatesService.js';
import {
  clearSmsSettings,
  createSmsProvider,
  createSmsTemplate,
  getSmsSettings,
  listSmsProviders,
  listSmsSablonOptions,
  listSmsTemplates,
  sendSmsTest,
  softDeleteSmsProvider,
  softDeleteSmsTemplate,
  updateSmsProvider,
  updateSmsSettings,
  updateSmsTemplate,
} from '../services/smsSettingsService.js';
import {
  createTemplateVariable,
  listModules,
  listTemplateVariables,
  softDeleteTemplateVariable,
  updateTemplateVariable,
} from '../services/templateVariablesService.js';
import {
  clearErpSettings,
  getErpSettings,
  updateErpSettings,
} from '../services/erpSettingsService.js';
import { sendSmtpTestMail } from '../lib/mail.js';
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

const defaultsSchema = z.object({
  loginTheme: z.enum(['classic', 'globe']),
  panelTheme: z.enum(['light', 'dark']),
  landingPath: z.string().max(128),
  payType: z.enum(['ch', 'fatura']),
  currency: z.string().max(64),
  accountType: z.string().max(255),
  customerKind: z.enum(['gercek', 'tuzel', 'yabanci']),
  virtualPos: z.enum(['bank', 'external']),
  taxOffice: z.string().max(255),
  country: z.string().max(8),
  displayMode: z.enum(['window', 'fullscreen']),
  filterOpen: z.record(z.string(), z.boolean()),
});

settingsRouter.get('/defaults', async (_req, res) => {
  try {
    return sendSuccess(res, await getAppDefaultsSettings());
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Varsayılanlar yüklenemedi');
  }
});

settingsRouter.patch('/defaults', async (req: AuthedRequest, res) => {
  const parsed = defaultsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateAppDefaultsSettings(parsed.data);
    await writePanelLog(req.auth!.sub, 'Ayarlar - Varsayılanlar güncellendi.');
    return sendSuccess(res, data, 'Varsayılanlar kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Varsayılanlar kaydedilemedi');
  }
});

const smtpSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.string().min(1).max(5),
  email: z.string().email().max(255),
  password: z.string().max(255).optional().default(''),
  ssl: z.boolean(),
  tls: z.boolean(),
});

settingsRouter.get('/email/smtp', async (_req, res) => {
  try {
    return sendSuccess(res, await getSmtpSettings());
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'SMTP ayarları yüklenemedi');
  }
});

settingsRouter.patch('/email/smtp', async (req: AuthedRequest, res) => {
  const parsed = smtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateSmtpSettings(parsed.data);
    await writePanelLog(req.auth!.sub, 'Ayarlar - SMTP ayarları güncellendi.');
    return sendSuccess(res, data, 'SMTP ayarları kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'SMTP ayarları kaydedilemedi');
  }
});

settingsRouter.delete('/email/smtp', async (req: AuthedRequest, res) => {
  try {
    const data = await clearSmtpSettings();
    await writePanelLog(req.auth!.sub, 'Ayarlar - SMTP ayarları sıfırlandı.');
    return sendSuccess(res, data, 'SMTP ayarları sıfırlandı');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'SMTP sıfırlanamadı');
  }
});

settingsRouter.post('/email/test', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ email: z.string().email('Geçerli bir e-posta girin').max(255) })
    .safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz e-posta');
  }
  try {
    await sendSmtpTestMail(parsed.data.email.trim().toLowerCase());
    await writePanelLog(req.auth!.sub, `SMTP sınama gönderildi → ${parsed.data.email}`);
    return sendSuccess(res, { sent: true }, 'Sınama e-postası gönderildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    const msg = err instanceof Error ? err.message : 'Sınama gönderilemedi';
    return sendError(res, 500, msg);
  }
});

const emailTplSchema = z.object({
  typeKey: z.string().min(1).max(64),
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(50_000),
});

settingsRouter.get('/email/templates', async (_req, res) => {
  try {
    return sendSuccess(res, await listEmailTemplates());
  } catch (err) {
    console.error('[email/templates]', err);
    const detail = err instanceof Error ? err.message : 'Şablonlar yüklenemedi';
    return sendError(res, 500, detail || 'Şablonlar yüklenemedi');
  }
});

settingsRouter.get('/email/template-options', async (_req, res) => {
  try {
    return sendSuccess(res, await listEmailSablonOptions());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Şablon seçenekleri yüklenemedi');
  }
});

settingsRouter.post('/email/templates', async (req: AuthedRequest, res) => {
  const parsed = emailTplSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createEmailTemplate(parsed.data);
    await writePanelLog(req.auth!.sub, `E-posta şablonu eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Şablon eklendi', 201);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon eklenemedi');
  }
});

settingsRouter.patch('/email/templates/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = emailTplSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateEmailTemplate(id, parsed.data);
    await writePanelLog(req.auth!.sub, `E-posta şablonu güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Şablon güncellendi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon güncellenemedi');
  }
});

settingsRouter.delete('/email/templates/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteEmailTemplate(id);
    await writePanelLog(req.auth!.sub, `E-posta şablonu silindi — #${id}`);
    return sendSuccess(res, { id }, 'Şablon silindi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon silinemedi');
  }
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

/* ─── SMS ─── */

const smsSettingsSchema = z.object({
  providerId: z.string().min(1).max(32),
  username: z.string().min(1).max(255),
  password: z.string().max(255).optional().default(''),
  title: z.string().min(1).max(255),
  active: z.boolean(),
});

const smsProviderSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(100_000),
  variables: z.array(z.string().max(120)).max(40).optional().default([]),
});

const smsTplSchema = z.object({
  typeKey: z.string().min(1).max(64),
  body: z.string().min(1).max(2000),
});

settingsRouter.get('/sms', async (_req, res) => {
  try {
    return sendSuccess(res, await getSmsSettings());
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'SMS ayarları yüklenemedi');
  }
});

settingsRouter.patch('/sms', async (req: AuthedRequest, res) => {
  const parsed = smsSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateSmsSettings(parsed.data);
    await writePanelLog(req.auth!.sub, 'Ayarlar - SMS ayarları güncellendi.');
    return sendSuccess(res, data, 'SMS ayarları kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'SMS ayarları kaydedilemedi');
  }
});

settingsRouter.delete('/sms', async (req: AuthedRequest, res) => {
  try {
    const data = await clearSmsSettings();
    await writePanelLog(req.auth!.sub, 'Ayarlar - SMS ayarları sıfırlandı.');
    return sendSuccess(res, data, 'SMS ayarları sıfırlandı');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'SMS sıfırlanamadı');
  }
});

settingsRouter.post('/sms/test', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ phone: z.string().min(10).max(20) })
    .safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz telefon');
  }
  try {
    const data = await sendSmsTest(parsed.data.phone);
    await writePanelLog(req.auth!.sub, `SMS sınama gönderildi → ${data.to}`);
    return sendSuccess(res, data, 'Sınama SMS gönderildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    const msg = err instanceof Error ? err.message : 'Sınama gönderilemedi';
    return sendError(res, 500, msg);
  }
});

settingsRouter.get('/sms/providers', async (_req, res) => {
  try {
    return sendSuccess(res, await listSmsProviders());
  } catch (err) {
    console.error('[sms/providers]', err);
    const detail = err instanceof Error ? err.message : 'Sağlayıcılar yüklenemedi';
    return sendError(res, 500, detail || 'Sağlayıcılar yüklenemedi');
  }
});

settingsRouter.post('/sms/providers', async (req: AuthedRequest, res) => {
  const parsed = smsProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createSmsProvider(parsed.data);
    await writePanelLog(req.auth!.sub, `SMS sağlayıcı eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Sağlayıcı eklendi', 201);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sağlayıcı eklenemedi');
  }
});

settingsRouter.patch('/sms/providers/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = smsProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateSmsProvider(id, parsed.data);
    await writePanelLog(req.auth!.sub, `SMS sağlayıcı güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Sağlayıcı güncellendi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sağlayıcı güncellenemedi');
  }
});

settingsRouter.delete('/sms/providers/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteSmsProvider(id);
    await writePanelLog(req.auth!.sub, `SMS sağlayıcı silindi — #${id}`);
    return sendSuccess(res, { id }, 'Sağlayıcı silindi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sağlayıcı silinemedi');
  }
});

settingsRouter.get('/sms/templates', async (_req, res) => {
  try {
    return sendSuccess(res, await listSmsTemplates());
  } catch (err) {
    console.error('[sms/templates]', err);
    const detail = err instanceof Error ? err.message : 'Şablonlar yüklenemedi';
    return sendError(res, 500, detail || 'Şablonlar yüklenemedi');
  }
});

settingsRouter.get('/sms/template-options', async (_req, res) => {
  try {
    return sendSuccess(res, await listSmsSablonOptions());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Şablon seçenekleri yüklenemedi');
  }
});

settingsRouter.post('/sms/templates', async (req: AuthedRequest, res) => {
  const parsed = smsTplSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createSmsTemplate(parsed.data);
    await writePanelLog(req.auth!.sub, `SMS şablonu eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Şablon eklendi', 201);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon eklenemedi');
  }
});

settingsRouter.patch('/sms/templates/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = smsTplSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateSmsTemplate(id, parsed.data);
    await writePanelLog(req.auth!.sub, `SMS şablonu güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Şablon güncellendi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon güncellenemedi');
  }
});

settingsRouter.delete('/sms/templates/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteSmsTemplate(id);
    await writePanelLog(req.auth!.sub, `SMS şablonu silindi — #${id}`);
    return sendSuccess(res, { id }, 'Şablon silindi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Şablon silinemedi');
  }
});

/* ─── Şablon değişkenleri (essablonlar) ─── */

const tvarSchema = z.object({
  name: z.string().min(1).max(255),
  moduleId: z.string().min(1).max(32),
  type: z.enum(['email', 'sms']),
  code: z.string().max(255).nullable().optional(),
  variables: z
    .array(
      z.object({
        dbColumn: z.string().min(1).max(120),
        key: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(80),
});

settingsRouter.get('/template-variables', async (_req, res) => {
  try {
    return sendSuccess(res, await listTemplateVariables());
  } catch (err) {
    console.error('[template-variables]', err);
    const detail = err instanceof Error ? err.message : 'Değişkenler yüklenemedi';
    return sendError(res, 500, detail || 'Değişkenler yüklenemedi');
  }
});

settingsRouter.get('/template-variables/modules', async (_req, res) => {
  try {
    return sendSuccess(res, await listModules());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Modüller yüklenemedi');
  }
});

settingsRouter.post('/template-variables', async (req: AuthedRequest, res) => {
  const parsed = tvarSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createTemplateVariable(parsed.data);
    await writePanelLog(req.auth!.sub, `Şablon değişkeni eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Kayıt eklendi', 201);
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt eklenemedi');
  }
});

settingsRouter.patch('/template-variables/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = tvarSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateTemplateVariable(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Şablon değişkeni güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Kayıt güncellendi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt güncellenemedi');
  }
});

settingsRouter.delete('/template-variables/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteTemplateVariable(id);
    await writePanelLog(req.auth!.sub, `Şablon değişkeni silindi — #${id}`);
    return sendSuccess(res, { id }, 'Kayıt silindi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kayıt silinemedi');
  }
});

/* ─── ERP (Vega) ─── */

const erpSchema = z.object({
  active: z.boolean(),
  apiUrl: z.string().max(255),
  apiSecret: z.string().max(255).optional().default(''),
  server: z.string().max(255),
  database: z.string().max(255),
  username: z.string().max(255),
  password: z.string().max(255).optional().default(''),
  company: z.string().max(255),
  period: z.string().max(255),
  branch: z.string().max(255),
  warehouse: z.string().max(255),
  cashRegister: z.string().max(255),
  inventory: z.boolean(),
});

settingsRouter.get('/erp', async (_req, res) => {
  try {
    return sendSuccess(res, await getErpSettings());
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'ERP ayarları yüklenemedi');
  }
});

settingsRouter.patch('/erp', async (req: AuthedRequest, res) => {
  const parsed = erpSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateErpSettings(parsed.data);
    await writePanelLog(req.auth!.sub, 'Ayarlar - ERP entegrasyon güncellendi.');
    return sendSuccess(res, data, 'ERP ayarları kaydedildi');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'ERP ayarları kaydedilemedi');
  }
});

settingsRouter.delete('/erp', async (req: AuthedRequest, res) => {
  try {
    const data = await clearErpSettings();
    await writePanelLog(req.auth!.sub, 'Ayarlar - ERP entegrasyon sıfırlandı.');
    return sendSuccess(res, data, 'ERP ayarları sıfırlandı');
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'ERP sıfırlanamadı');
  }
});
