import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModulePerm } from '../middleware/permissions.js';
import {
  SystemResetError,
  buildBackupSql,
  clearResetTable,
  listResetTables,
  restoreBackupSql,
} from '../services/systemResetService.js';
import { writePanelLog } from '../services/logsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const systemResetRouter = Router();
const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

systemResetRouter.use(requireAuth);
systemResetRouter.use(requireModulePerm('/sistem-sifirlama'));

systemResetRouter.get('/tables', async (_req, res) => {
  try {
    const data = await listResetTables();
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Tablo listesi yüklenemedi');
  }
});

systemResetRouter.post('/backup', async (req: AuthedRequest, res) => {
  try {
    const { sql, fileName, unlockToken } = await buildBackupSql(req.auth!.sub);
    await writePanelLog(req.auth!.sub, 'Sistem Sıfırlama - Veritabanı yedeği alındı.');
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Reset-Unlock-Token', unlockToken);
    res.setHeader('Access-Control-Expose-Headers', 'X-Reset-Unlock-Token, Content-Disposition');
    return res.status(200).send(sql);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Yedek oluşturulamadı');
  }
});

systemResetRouter.post('/restore', backupUpload.single('backup'), async (req: AuthedRequest, res) => {
  const file = req.file;
  if (!file) return sendError(res, 400, 'Geri yüklenecek .sql yedek dosyasını seçin');
  if (!file.originalname.toLocaleLowerCase('tr').endsWith('.sql')) {
    return sendError(res, 400, 'Yalnızca .sql yedek dosyaları yüklenebilir');
  }

  try {
    const result = await restoreBackupSql(req.auth!.sub, file.buffer.toString('utf8'));
    return sendSuccess(res, result, 'Veritabanı yedeği geri yüklendi');
  } catch (err) {
    if (err instanceof SystemResetError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Veritabanı yedeği geri yüklenemedi');
  }
});

const clearSchema = z.object({
  moduleId: z.number().int().positive(),
  unlockToken: z.string().min(10),
});

systemResetRouter.post('/clear', async (req: AuthedRequest, res) => {
  const parsed = clearSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }

  try {
    const data = await clearResetTable(
      req.auth!.sub,
      parsed.data.moduleId,
      parsed.data.unlockToken,
    );
    return sendSuccess(res, data, 'Tablo boşaltıldı');
  } catch (err) {
    if (err instanceof SystemResetError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Tablo boşaltılamadı');
  }
});
