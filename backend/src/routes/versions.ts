import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireModulePerm } from '../middleware/permissions.js';
import { listVersions } from '../services/versionsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const versionsRouter = Router();

versionsRouter.use(requireAuth);
versionsRouter.use(requireModulePerm('/surum-gecmisi'));

versionsRouter.get('/', async (_req, res) => {
  try {
    const data = await listVersions();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sürümler yüklenemedi');
  }
});
