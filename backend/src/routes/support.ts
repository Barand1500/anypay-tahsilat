import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { SettingsError } from '../services/settingsService.js';
import {
  getSupportChannels,
  submitSupportTicket,
  type SupportChannel,
} from '../services/supportService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const supportRouter = Router();
supportRouter.use(requireAuth);

supportRouter.get('/channels', async (_req, res) => {
  try {
    return sendSuccess(res, await getSupportChannels());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Destek kanalları yüklenemedi');
  }
});

const ticketSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp']),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

supportRouter.post('/ticket', async (req: AuthedRequest, res) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: { email: true, adsoyad: true },
    });
    const data = await submitSupportTicket({
      channel: parsed.data.channel as SupportChannel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      userName: (user?.adsoyad || '').trim(),
      userEmail: (user?.email || '').trim(),
    });
    await writePanelLog(
      req.auth!.sub,
      data.method === 'api' && data.sent
        ? `Destek talebi gönderildi (${data.channel}) → ${data.to}`
        : `Destek talebi istemciye düştü (${data.channel})`,
    );
    return sendSuccess(
      res,
      data,
      data.method === 'api' && data.sent
        ? 'Destek talebiniz alınmıştır'
        : 'İstemci kanalı açılıyor',
    );
  } catch (err) {
    if (err instanceof SettingsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Destek talebi gönderilemedi');
  }
});
