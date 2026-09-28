import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import { writePanelLog } from '../services/logsService.js';
import {
  VirtualPosError,
  createVirtualPos,
  getVirtualPos,
  listVirtualPos,
  patchVirtualPosFlags,
  softDeleteVirtualPos,
  updateVirtualPos,
} from '../services/virtualPosService.js';
import {
  PosAgreementError,
  getPosBankAgreement,
  getPosCustomerAgreement,
  savePosBankAgreement,
  savePosCustomerAgreement,
} from '../services/posAgreementsService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const virtualPosRouter = Router();
virtualPosRouter.use(requireAuth);
virtualPosRouter.use(requireModuleWrite('/tanimlamalar'));

const upsertSchema = z.object({
  bankId: z.string().min(1),
  infrastructureId: z.string().min(1).max(64),
  posName: z.string().min(1).max(255),
  merchantId: z.string().min(1).max(255),
  terminalSafeId: z.string().min(1).max(255),
  securityKey: z.string().min(1).max(512),
  terminalPassword: z.string().max(255).optional().default(''),
  securityType: z.string().min(1).max(64),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

const flagsSchema = z.object({
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

virtualPosRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listVirtualPos());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sanal POS listesi yüklenemedi');
  }
});

virtualPosRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    const row = await getVirtualPos(id);
    if (!row) return sendError(res, 404, 'Sanal POS bulunamadı');
    return sendSuccess(res, row);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Sanal POS yüklenemedi');
  }
});

const segmentSchema = z
  .object({
    minLimit: z.string().optional().default(''),
    bankCommission: z.string().optional().default(''),
    customerCommission: z.string().optional().default(''),
    points: z.string().optional().default('0'),
    extraInstallment: z.string().optional().default('0'),
    collectionDay: z.string().optional().default('0'),
    blockDay: z.string().optional().default('0'),
    note: z.string().optional().default(''),
    active: z.boolean().optional().default(true),
  })
  .passthrough();

const bankAgreementSchema = z.object({
  items: z
    .array(
      z
        .object({
          n: z.coerce.number().int().min(1).max(36),
          all: segmentSchema,
          bireysel: segmentSchema,
          ticari: segmentSchema,
        })
        .passthrough(),
    )
    .min(1),
});

const customerAgreementSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255),
        logoFileName: z.string().optional(),
        rows: z
          .array(
            z.object({
              n: z.number().int().min(1).max(36),
              minLimit: z.string().optional().default(''),
              allRate: z.string().optional().default(''),
              bireyselRate: z.string().optional().default(''),
              ticariRate: z.string().optional().default(''),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

virtualPosRouter.get('/:id/bank-agreement', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    return sendSuccess(res, await getPosBankAgreement(id));
  } catch (err) {
    if (err instanceof PosAgreementError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Banka kart anlaşması yüklenemedi');
  }
});

virtualPosRouter.put('/:id/bank-agreement', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = bankAgreementSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await savePosBankAgreement(id, parsed.data.items);
    await writePanelLog(req.auth!.sub, `Banka kart anlaşması kaydedildi — POS #${id}`);
    return sendSuccess(res, data, 'Banka kart anlaşması kaydedildi');
  } catch (err) {
    if (err instanceof PosAgreementError) return sendError(res, 400, err.message);
    console.error('[bank-agreement]', err);
    const msg = err instanceof Error ? err.message : 'Banka kart anlaşması kaydedilemedi';
    return sendError(res, 500, msg.slice(0, 500));
  }
});

virtualPosRouter.get('/:id/customer-agreement', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    return sendSuccess(res, await getPosCustomerAgreement(id));
  } catch (err) {
    if (err instanceof PosAgreementError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Müşteri kart anlaşması yüklenemedi');
  }
});

virtualPosRouter.put('/:id/customer-agreement', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  const parsed = customerAgreementSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await savePosCustomerAgreement(id, parsed.data.blocks);
    await writePanelLog(req.auth!.sub, `Müşteri kart anlaşması kaydedildi — POS #${id}`);
    return sendSuccess(res, data, 'Müşteri kart anlaşması kaydedildi');
  } catch (err) {
    if (err instanceof PosAgreementError) return sendError(res, 400, err.message);
    console.error('[customer-agreement]', err);
    const msg = err instanceof Error ? err.message : 'Müşteri kart anlaşması kaydedilemedi';
    return sendError(res, 500, msg.slice(0, 500));
  }
});

virtualPosRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createVirtualPos(parsed.data);
    await writePanelLog(req.auth!.sub, `Sanal POS eklendi — ${data.posName}`);
    return sendSuccess(res, data, 'Sanal POS eklendi', 201);
  } catch (err) {
    if (err instanceof VirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sanal POS eklenemedi');
  }
});

virtualPosRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');

  // Sadece bayrak mı?
  const flagsOnly =
    req.body &&
    typeof req.body === 'object' &&
    !('bankId' in req.body) &&
    ('isDefault' in req.body || 'active' in req.body);

  if (flagsOnly) {
    const parsed = flagsSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
    }
    try {
      const data = await patchVirtualPosFlags(id, parsed.data);
      return sendSuccess(res, data, 'Sanal POS güncellendi');
    } catch (err) {
      if (err instanceof VirtualPosError) return sendError(res, 400, err.message);
      console.error(err);
      return sendError(res, 500, 'Sanal POS güncellenemedi');
    }
  }

  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateVirtualPos(id, parsed.data);
    await writePanelLog(req.auth!.sub, `Sanal POS güncellendi — ${data.posName}`);
    return sendSuccess(res, data, 'Sanal POS güncellendi');
  } catch (err) {
    if (err instanceof VirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sanal POS güncellenemedi');
  }
});

virtualPosRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, 400, 'Geçersiz id');
  try {
    await softDeleteVirtualPos(id);
    await writePanelLog(req.auth!.sub, `Sanal POS silindi — #${id}`);
    return sendSuccess(res, { id }, 'Sanal POS silindi');
  } catch (err) {
    if (err instanceof VirtualPosError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Sanal POS silinemedi');
  }
});
