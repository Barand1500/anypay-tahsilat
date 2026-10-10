import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireModuleWrite } from '../middleware/permissions.js';
import {
  CardAgreementsError,
  createCardAgreement,
  getCardAgreement,
  getCustomerAgreementCode,
  listCardAgreements,
  resolveAgreementRates,
  softDeleteCardAgreement,
  updateCardAgreement,
} from '../services/cardAgreementsService.js';
import { writePanelLog } from '../services/logsService.js';
import { resolvePosBankAgreementCode } from '../services/posAgreementsService.js';
import { resolveRatesTargetBank } from '../services/commonVirtualPosService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const cardAgreementsRouter = Router();
cardAgreementsRouter.use(requireAuth);
cardAgreementsRouter.use(requireModuleWrite('/tanimlamalar/pos-kart/anlasmalar'));

const installmentSchema = z.object({
  n: z.number().int().min(1).max(36),
  minLimit: z.string().optional().default(''),
  allRate: z.string().optional().default(''),
  bireyselRate: z.string().optional().default(''),
  ticariRate: z.string().optional().default(''),
});

const bankSchema = z.object({
  bankId: z.string().min(1),
  name: z.string().min(1).max(255),
  logo: z.string().nullable().optional(),
  installments: z.array(installmentSchema).min(1),
});

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  date: z.string().optional(),
  banks: z.array(bankSchema).min(1),
});

cardAgreementsRouter.get('/', async (_req, res) => {
  try {
    return sendSuccess(res, await listCardAgreements());
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Kart anlaşmaları yüklenemedi');
  }
});

/** Ödeme UI — taksit oranları (izinli taksit listesinden ayrı) */
cardAgreementsRouter.get('/rates', async (req, res) => {
  const amount = Number(req.query.amount);
  const agreementCode =
    typeof req.query.code === 'string' ? req.query.code : undefined;
  const bankName =
    typeof req.query.bankName === 'string' ? req.query.bankName : undefined;
  const bankIdRaw = req.query.bankId;
  const bankId =
    bankIdRaw != null && String(bankIdRaw).trim() !== ''
      ? Number(bankIdRaw)
      : null;
  const segmentRaw = typeof req.query.segment === 'string' ? req.query.segment : 'bireysel';
  const segment =
    segmentRaw === 'ticari' || segmentRaw === 'tumu' || segmentRaw === 'serbest'
      ? segmentRaw
      : 'bireysel';
  const musteriId =
    req.query.musteriId != null && String(req.query.musteriId).trim() !== ''
      ? Number(req.query.musteriId)
      : null;
  const scope = req.query.scope === 'pos' ? 'pos' : 'customer';
  // Modal (segment tablosu) strict; panel/public ile aynı oran için fallback açık
  const strictSegments =
    req.query.strictSegments === '1' || req.query.strictSegments === 'true';

  try {
    // Ortak Sanal POS yönlendirmesi (DenizBank → Garanti anlaşması)
    const target = await resolveRatesTargetBank({
      bankId: bankId != null && Number.isFinite(bankId) ? bankId : null,
      bankName,
    });

    let code = scope === 'pos' ? null : agreementCode || null;
    if (scope === 'customer' && !code && musteriId != null && Number.isFinite(musteriId)) {
      code = await getCustomerAgreementCode(musteriId);
    }
    if (scope === 'pos' && target.bankId != null) {
      code = await resolvePosBankAgreementCode(target.bankId);
    }
    const data = await resolveAgreementRates({
      agreementCode: code,
      bankId: target.bankId,
      bankName: target.bankName,
      segment,
      amount: Number.isFinite(amount) ? amount : 0,
      allowAllFallback: !strictSegments,
    });
    return sendSuccess(res, data);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'Taksit oranları yüklenemedi');
  }
});

cardAgreementsRouter.get('/:code', async (req, res) => {
  const code = String(req.params.code || '');
  try {
    return sendSuccess(res, await getCardAgreement(code));
  } catch (err) {
    if (err instanceof CardAgreementsError) return sendError(res, 404, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart anlaşması yüklenemedi');
  }
});

cardAgreementsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await createCardAgreement(parsed.data);
    await writePanelLog(req.auth!.sub, `Kart anlaşması eklendi — ${data.name}`);
    return sendSuccess(res, data, 'Kart anlaşması eklendi', 201);
  } catch (err) {
    if (err instanceof CardAgreementsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart anlaşması eklenemedi');
  }
});

cardAgreementsRouter.put('/:code', async (req: AuthedRequest, res) => {
  const code = String(req.params.code || '');
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, parsed.error.issues[0]?.message || 'Geçersiz istek');
  }
  try {
    const data = await updateCardAgreement(code, parsed.data);
    await writePanelLog(req.auth!.sub, `Kart anlaşması güncellendi — ${data.name}`);
    return sendSuccess(res, data, 'Kart anlaşması güncellendi');
  } catch (err) {
    if (err instanceof CardAgreementsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart anlaşması güncellenemedi');
  }
});

cardAgreementsRouter.delete('/:code', async (req: AuthedRequest, res) => {
  const code = String(req.params.code || '');
  try {
    await softDeleteCardAgreement(code);
    await writePanelLog(req.auth!.sub, `Kart anlaşması silindi — ${code}`);
    return sendSuccess(res, { id: code }, 'Kart anlaşması silindi');
  } catch (err) {
    if (err instanceof CardAgreementsError) return sendError(res, 400, err.message);
    console.error(err);
    return sendError(res, 500, 'Kart anlaşması silinemedi');
  }
});
