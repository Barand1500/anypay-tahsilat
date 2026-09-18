import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';

export type AuthPayload = {
  sub: number;
  email: string;
};

export type AuthedRequest = Request & { auth?: AuthPayload };

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return secret;
}

export function signToken(payload: AuthPayload) {
  const days = Number(process.env.JWT_EXPIRES_DAYS || 7);
  return jwt.sign(payload, jwtSecret(), { expiresIn: `${days}d` });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 401, 'Oturum gerekli');
  }

  try {
    const token = header.slice('Bearer '.length);
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === 'string' || decoded.sub == null || typeof decoded.email !== 'string') {
      return sendError(res, 401, 'Oturum geçersiz veya süresi dolmuş');
    }
    const sub = Number(decoded.sub);
    if (!Number.isFinite(sub)) {
      return sendError(res, 401, 'Oturum geçersiz veya süresi dolmuş');
    }
    req.auth = { sub, email: decoded.email };
    return next();
  } catch {
    return sendError(res, 401, 'Oturum geçersiz veya süresi dolmuş');
  }
}
