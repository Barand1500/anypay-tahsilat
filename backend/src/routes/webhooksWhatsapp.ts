import { Router } from 'express';
import { getWhatsappVerifyToken } from '../services/whatsappSettingsService.js';

/**
 * Meta WhatsApp Cloud API webhook — auth yok (Meta sunucuları çağırır).
 * GET: abonelik doğrulama · POST: gelen olaylar (şimdilik yalnızca 200).
 */
export const webhooksWhatsappRouter = Router();

webhooksWhatsappRouter.get('/', async (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');

  if (mode !== 'subscribe' || !token || !challenge) {
    return res.status(403).send('Forbidden');
  }

  try {
    const expected = await getWhatsappVerifyToken();
    if (!expected || token !== expected) {
      return res.status(403).send('Forbidden');
    }
    return res.status(200).type('text/plain').send(challenge);
  } catch (err) {
    console.error('[whatsapp-webhook] verify', err);
    return res.status(500).send('Error');
  }
});

webhooksWhatsappRouter.post('/', (_req, res) => {
  // Gelen mesajlar ileride işlenecek — Meta’ya hemen OK
  return res.sendStatus(200);
});
