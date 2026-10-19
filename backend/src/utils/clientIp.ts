import type { Request } from 'express';

/**
 * Gerçek istemci IPv4'ü: nginx arkasında X-Forwarded-For / X-Real-IP, yoksa socket.
 * ::ffff:1.2.3.4 → 1.2.3.4. Bankalar (Garanti) geçerli IP ister.
 */
export function clientIpOf(req: Request): string | undefined {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const candidates = [fwd, String(req.headers['x-real-ip'] || '').trim(), req.ip, req.socket.remoteAddress];
  for (const raw of candidates) {
    const ip = String(raw || '').trim().replace(/^::ffff:/i, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  }
  return undefined;
}
