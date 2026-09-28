import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModulePerm } from '../middleware/permissions.js';
import {
  createPayment,
  getPayment,
  listPaymentBanks,
  listPayments,
  PaymentsError,
  reversePayment,
  setPaymentArchived,
  type TxStatus,
} from '../services/paymentsService.js';
import { buildDekontPdf } from '../services/dekontPdfService.js';
import { sendMail } from '../lib/mail.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);
paymentsRouter.use(requireModulePerm('/hareketler'));

const createSchema = z.object({
  musteriId: z.number().int().positive().nullable().optional(),
  payType: z.enum(['ch', 'fatura']),
  amount: z.number().positive(),
  commissionIncluded: z.boolean().optional().default(false),
  holder: z.string().min(1).max(255),
  tc: z.string().max(20).optional().default(''),
  phone: z.string().min(10).max(20),
  cardDigits: z.string().min(15).max(19),
  expiry: z.string().min(4).max(7),
  cvc: z.string().min(3).max(4),
  installment: z.number().int().min(1).max(12).optional().default(1),
  note: z.string().max(5000).optional().default(''),
  parabirimiId: z.number().int().positive().nullable().optional(),
  bankId: z.number().int().positive().nullable().optional(),
});

const listSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  bankId: z.coerce.number().int().positive().optional(),
  status: z.enum(['paid', 'cancelled', 'refunded', 'pending', 'failed']).optional(),
  archive: z.enum(['yes', 'no', 'all']).optional().default('no'),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().positive().optional(),
});

paymentsRouter.get('/banks', async (_req, res) => {
  try {
    return sendSuccess(res, await listPaymentBanks());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Bankalar yüklenemedi');
  }
});

paymentsRouter.get('/', async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await listPayments({
      branchId: parsed.data.branchId ?? null,
      userId: parsed.data.userId ?? null,
      customerId: parsed.data.customerId ?? null,
      bankId: parsed.data.bankId ?? null,
      status: (parsed.data.status as TxStatus | undefined) ?? null,
      archive: parsed.data.archive,
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
      q: parsed.data.q ?? null,
      take: parsed.data.take,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Hareketler yüklenemedi');
  }
});

paymentsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createPayment({
      ...parsed.data,
      musteriId: parsed.data.musteriId ?? null,
      parabirimiId: parsed.data.parabirimiId ?? null,
      bankId: parsed.data.bankId ?? null,
      kullaniciId: req.auth!.sub,
      clientIp: req.ip || req.socket.remoteAddress || undefined,
    });
    await writePanelLog(
      req.auth!.sub,
      data.status === 'pending_3d'
        ? `3D Secure başlatıldı — #${data.odemeNo} / ${data.amount.toFixed(2)}`
        : `Ödeme alındı — #${data.odemeNo} / ${data.amount.toFixed(2)}`,
    );
    return sendSuccess(
      res,
      data,
      data.status === 'pending_3d' ? 'Banka 3D Secure’a yönlendiriliyor' : 'Ödeme kaydedildi',
      201,
    );
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Ödeme kaydedilemedi');
  }
});

paymentsRouter.patch('/:id/archive', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz hareket');
  const body = z.object({ archived: z.boolean() }).safeParse(req.body);
  if (!body.success) return sendError(res, 400, 'Geçersiz istek');
  try {
    const data = await setPaymentArchived(id, body.data.archived);
    await writePanelLog(
      req.auth!.sub,
      body.data.archived
        ? `Hareket arşivlendi — #${data.id}`
        : `Hareket arşivden çıkarıldı — #${data.id}`,
    );
    return sendSuccess(res, data, body.data.archived ? 'Arşivlendi' : 'Arşivden çıkarıldı');
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Arşiv güncellenemedi');
  }
});

paymentsRouter.post('/:id/reverse', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz hareket');
  try {
    const data = await reversePayment(id, req.auth!.sub);
    const label = data.status === 'cancelled' ? 'iptal' : 'iade';
    await writePanelLog(req.auth!.sub, `Hareket ${label} — #${data.id}`);
    return sendSuccess(
      res,
      data,
      data.status === 'cancelled' ? 'İptal edildi' : 'İade edildi',
    );
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'İptal/iade yapılamadı');
  }
});

paymentsRouter.get('/:id/dekont.pdf', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz hareket');
  try {
    const tx = await getPayment(id);
    const pdf = await buildDekontPdf(tx);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dekont-${tx.id}.pdf"`,
    );
    return res.status(200).send(pdf);
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'PDF oluşturulamadı');
  }
});

paymentsRouter.post('/:id/dekont/email', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz hareket');
  const parsed = z
    .object({ email: z.string().email('Geçerli e-posta girin') })
    .safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'E-posta gerekli');
  }
  try {
    const tx = await getPayment(id);
    const pdf = await buildDekontPdf(tx);
    const total = (tx.amount + tx.commission).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    await sendMail({
      to: parsed.data.email,
      subject: `Dekont ${tx.id} — ${total} TL`,
      html: `<p>Sayın ilgili,</p><p><strong>${tx.id}</strong> numaralı sanal POS dekontunuz ekte PDF olarak gönderilmiştir.</p><p>Tutar: <strong>${total} TL</strong></p><p style="color:#64748b;font-size:12px;">GÜZEL Teknoloji — AnyPay Tahsilat</p>`,
      text: `Dekont ${tx.id} — ${total} TL — PDF ekte.`,
      attachments: [
        {
          filename: `dekont-${tx.id}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
    await writePanelLog(
      req.auth!.sub,
      `Dekont e-posta — #${tx.id} → ${parsed.data.email}`,
    );
    return sendSuccess(res, { ok: true }, 'Dekont e-posta ile gönderildi');
  } catch (err) {
    if (err instanceof PaymentsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'E-posta gönderilemedi — SMTP ayarlarını kontrol edin');
  }
});
