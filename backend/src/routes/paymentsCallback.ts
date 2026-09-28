import { Router, type Request, type Response } from 'express';
import {
  GatewayCallbackError,
  handleThreeDCallback,
} from '../gateways/callbackService.js';

/** Banka 3DS dönüşü — auth yok (okUrl / failUrl) */
export const paymentsCallbackRouter = Router();

function publicAppBase(): string {
  return (
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://tahsilat.anypay.com.tr'
  );
}

function redirectHtml(path: string, flash: string, ok: boolean): string {
  const url = `${publicAppBase()}${path}?pay=${ok ? 'ok' : 'fail'}&msg=${encodeURIComponent(flash)}`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>Yönlendiriliyor…</title>
<meta http-equiv="refresh" content="0;url=${url}"/>
</head><body style="font-family:system-ui;padding:2rem;text-align:center">
<p>${ok ? 'Ödeme sonucu alındı' : 'Ödeme tamamlanamadı'} — yönlendiriliyorsunuz…</p>
<p><a href="${url}">Devam et</a></p>
<script>location.replace(${JSON.stringify(url)})</script>
</body></html>`;
}

async function handle(req: Request, res: Response, outcome: 'ok' | 'fail') {
  const body = {
    ...(typeof req.query === 'object' ? req.query : {}),
    ...(typeof req.body === 'object' && req.body ? req.body : {}),
  } as Record<string, unknown>;
  try {
    const result = await handleThreeDCallback(body, outcome);
    const flash = `${result.message} — #${result.odemeNo}`;
    res.type('html').send(redirectHtml(result.redirectPath, flash, result.success));
  } catch (err) {
    const msg =
      err instanceof GatewayCallbackError ? err.message : '3D dönüşü işlenemedi';
    console.error('[3d-callback]', err);
    res.status(400).type('html').send(redirectHtml('/hareketler', msg, false));
  }
}

paymentsCallbackRouter.post('/ok', (req, res) => void handle(req, res, 'ok'));
paymentsCallbackRouter.get('/ok', (req, res) => void handle(req, res, 'ok'));
paymentsCallbackRouter.post('/fail', (req, res) => void handle(req, res, 'fail'));
paymentsCallbackRouter.get('/fail', (req, res) => void handle(req, res, 'fail'));
