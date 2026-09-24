import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import {
  LogsError,
  deleteLogs,
  listLogs,
  type LogActionKind,
} from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const logsRouter = Router();

logsRouter.use(requireAuth);

const kindSchema = z.enum([
  'all',
  'login',
  'logout',
  'create',
  'update',
  'delete',
  'export',
  'other',
]);

logsRouter.get('/', async (req, res) => {
  const kindRaw = typeof req.query.kind === 'string' ? req.query.kind : 'all';
  const kindParsed = kindSchema.safeParse(kindRaw);
  const kind = (kindParsed.success ? kindParsed.data : 'all') as LogActionKind | 'all';

  try {
    const data = await listLogs({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      kind,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Loglar yüklenemedi');
  }
});

const deleteSchema = z.object({
  scope: z.enum(['day', 'week', 'month', 'all', 'range']),
  from: z.string().optional(),
  to: z.string().optional(),
});

logsRouter.delete('/', async (req: AuthedRequest, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await deleteLogs(req.auth!.sub, parsed.data);
    return sendSuccess(res, data, data.deleted ? 'Loglar silindi' : 'Silinecek kayıt yok');
  } catch (err) {
    if (err instanceof LogsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Loglar silinemedi');
  }
});
