import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200) {
  res.status(status).json({ success: true, message, data });
}

export function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, message });
}
