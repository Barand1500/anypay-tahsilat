import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  GatewayCallbackError,
  handleThreeDCallback,
} from '../gateways/callbackService.js';

/**
 * Yerel 3DS dönüşü (Api KAPALI yolu).
 * okUrl/failUrl → /api/payments/3d/ok|fail — merkez callback ile karıştırma.
 * Merkez açıkken banka → api .../payments/callback/:sessionId döner.
 */
export const paymentsCallbackRouter = Router();

function publicAppBase(): string {
  return (
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://tahsilat.anypay.com.tr'
  );
}

function redirectHtml(path: string, flash: string, ok: boolean, amount = 0): string {
  const amountQs = amount > 0 ? `&amount=${encodeURIComponent(amount.toFixed(2))}` : '';
  const url = `${publicAppBase()}${path}?pay=${ok ? 'ok' : 'fail'}&msg=${encodeURIComponent(flash)}${amountQs}`;
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
    res.type('html').send(redirectHtml(result.redirectPath, flash, result.success, result.amount));
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

/**
 * PayTR sunucu bildirimi — yanıt gövdesi düz metin "OK" olmalı.
 * Mağaza paneli Bildirim URL: /api/payments/3d/notify/paytr
 */
paymentsCallbackRouter.post('/notify/paytr', (req, res) => {
  void (async () => {
    const body = {
      ...(typeof req.query === 'object' ? req.query : {}),
      ...(typeof req.body === 'object' && req.body ? req.body : {}),
    } as Record<string, unknown>;
    try {
      // outcome=ok → finalizeCallback (hash) çalışsın; başarı status alanından gelir
      await handleThreeDCallback(body, 'ok');
      res.status(200).type('text/plain').send('OK');
    } catch (err) {
      console.error('[paytr-notify]', err);
      // PayTR tekrar denemesin diye yine OK (kayıt yoksa da); log’da kalır
      res.status(200).type('text/plain').send('OK');
    }
  })();
});

/**
 * Sonuç ekranı için yalnızca tutar — Merkezi API dönüşünde adreste tutar yoksa kullanılır.
 * Kimlik gerektirmez (müşteri ödeme linki); başka hiçbir alan döndürülmez.
 */
paymentsCallbackRouter.get('/result/:odemeNo', (req, res) => {
  void (async () => {
    try {
      const odemeNo = String(req.params.odemeNo || '').trim();
      if (!/^[A-Za-z0-9_-]{4,64}$/.test(odemeNo)) {
        res.status(400).json({ success: false, message: 'Geçersiz işlem no' });
        return;
      }
      const row = await prisma.odeme.findFirst({
        where: { odemeNo },
        select: { tutar: true, gercekTutar: true },
      });
      if (!row) {
        res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        return;
      }
      res.json({
        success: true,
        data: { amount: Number(row.gercekTutar ?? row.tutar) || 0 },
      });
    } catch {
      res.status(500).json({ success: false, message: 'Tutar alınamadı' });
    }
  })();
});
