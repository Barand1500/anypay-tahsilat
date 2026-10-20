import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { sendError } from '../utils/response.js';

type Bucket = { count: number; resetAt: number };

/**
 * Hız sınırı için istemci IP'si.
 * nginx X-Real-IP'yi $remote_addr ile kendisi yazar (istemci değiştiremez); yoksa X-Forwarded-For'un
 * SON değeri (nginx'in eklediği), o da yoksa socket adresi.
 */
export function rateLimitIp(req: Request): string {
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real.replace(/^::ffff:/i, '');
  const fwd = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const last = fwd[fwd.length - 1];
  if (last) return last.replace(/^::ffff:/i, '');
  return String(req.socket.remoteAddress || 'unknown').replace(/^::ffff:/i, '');
}

export type RateLimitOptions = {
  /** Sayaç adı (farklı limiter'lar birbirine karışmasın) */
  name: string;
  windowMs: number;
  max: number;
  /** null dönerse bu istek sayılmaz */
  key: (req: Request) => string | null;
  message?: string;
  /** Başarılı (<400) yanıtları sayma — yalnızca hatalı denemeler dolsun */
  skipSuccessful?: boolean;
};

const MAX_BUCKETS = 50_000;

export function createRateLimiter(opts: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  const prune = () => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };
  setInterval(prune, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const id = opts.key(req);
    if (!id) return next();
    const k = `${opts.name}:${id}`;
    const now = Date.now();
    let bucket = buckets.get(k);
    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= MAX_BUCKETS) prune();
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(k, bucket);
    }
    if (bucket.count >= opts.max) {
      const retry = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retry));
      return sendError(
        res,
        429,
        opts.message || `Çok fazla deneme. Lütfen ${Math.ceil(retry / 60)} dakika sonra tekrar deneyin.`,
      );
    }
    bucket.count += 1;
    if (opts.skipSuccessful) {
      const held = bucket;
      res.on('finish', () => {
        if (res.statusCode < 400 && held.count > 0) held.count -= 1;
      });
    }
    return next();
  };
}

/** İstek gövdesindeki e-posta (küçük harf) — yoksa null */
export function bodyEmailKey(req: Request): string | null {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email && email.length <= 255 ? email : null;
}
