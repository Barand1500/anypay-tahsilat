import { prisma } from '../lib/prisma.js';
import { looksLikeAkbankV2 } from './adapters/akbankV2.js';
import { looksLikeGaranti } from './adapters/garanti.js';
import { looksLikeNestPay } from './adapters/nestpay.js';
import { hintsForKey, matchBinKey, normalizeBankText } from './binCatalog.js';
import { lookupBinByCard } from '../services/binsService.js';
import { resolveRedirectBankId } from '../services/commonVirtualPosService.js';
import type { PosCredentials } from './types.js';

export class PosResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosResolveError';
  }
}

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapPos(
  bank: {
    id: number;
    adi: string;
    kisaAdi: string;
    guvenlikTipleri: string | null;
    sanalPos3dUrl: string | null;
    sanalPosApiUrl: string | null;
    sanalPosXmlUrl: string | null;
  },
  pos: {
    id: number;
    posAdi: string;
    altyapiKodu: string;
    isyeriNo: string | null;
    terminalSafeId: string | null;
    guvenlikAnahtari: string | null;
    terminalSifresi: string | null;
    guvenlikTipi: string | null;
  },
): PosCredentials {
  const fromPos = (pos.guvenlikTipi || '').trim();
  const fromBank = (bank.guvenlikTipleri || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)[0] || '';
  return {
    bankId: bank.id,
    bankName: (bank.adi || bank.kisaAdi || `Banka #${bank.id}`).trim(),
    posId: pos.id,
    posName: pos.posAdi,
    infrastructureId: pos.altyapiKodu,
    merchantId: (pos.isyeriNo || '').trim(),
    terminalSafeId: (pos.terminalSafeId || '').trim(),
    securityKey: (pos.guvenlikAnahtari || '').trim(),
    terminalPassword: (pos.terminalSifresi || '').trim(),
    securityType: fromPos || fromBank || '',
    gateway3dUrl: (bank.sanalPos3dUrl || '').trim(),
    apiUrl: (bank.sanalPosApiUrl || '').trim(),
    xmlUrl: (bank.sanalPosXmlUrl || '').trim(),
  };
}

function assertReady(c: PosCredentials): void {
  if (!c.merchantId) throw new PosResolveError('Sanal POS: işyeri numarası eksik');
  if (!c.securityKey) throw new PosResolveError('Sanal POS: mağaza / güvenlik anahtarı eksik');
  if (!c.gateway3dUrl) {
    throw new PosResolveError(
      `${c.bankName}: Sanal Pos 3D Geçit Url eksik (Banka Düzenle)`,
    );
  }

  if (looksLikeGaranti(c)) {
    if (!c.terminalSafeId) {
      throw new PosResolveError('Garanti: Terminal No eksik');
    }
    if (!c.terminalPassword) {
      throw new PosResolveError('Garanti: Terminal Şifresi eksik (Sanal POS Tanımı)');
    }
    // güvenlik tipi boşsa 3D_OOS_PAY varsayılanı adapter’da uygulanır
    return;
  }

  if (looksLikeNestPay(c)) {
    // NestPay: terminal no çoğu kurulumda opsiyonel
    return;
  }

  if (looksLikeAkbankV2(c)) {
    if (!c.terminalSafeId) throw new PosResolveError('Sanal POS: Terminal Safe ID eksik');
    if (!c.securityType) throw new PosResolveError('Sanal POS: güvenlik tipi eksik');
    return;
  }

  if (!c.terminalSafeId) throw new PosResolveError('Sanal POS: Terminal No eksik');
}

/**
 * Bankanın aktif POS’unu yükler.
 * Yoksa Ortak Sanal POS yönlendirmesiyle hedef bankanın POS’una düşer.
 */
async function loadPosForBank(
  bankId: number,
  opts?: { skipRedirect?: boolean },
): Promise<PosCredentials> {
  const bank = await prisma.banka.findFirst({
    where: { id: bankId, ...notRemoved() },
  });
  if (!bank) throw new PosResolveError('Banka bulunamadı');

  const pos =
    (await prisma.sanalPosTanim.findFirst({
      where: {
        bankaId: bankId,
        aktif: true,
        varsayilan: true,
        ...notRemoved(),
      },
      orderBy: { id: 'asc' },
    })) ||
    (await prisma.sanalPosTanim.findFirst({
      where: { bankaId: bankId, aktif: true, ...notRemoved() },
      orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
    }));

  if (!pos) {
    if (!opts?.skipRedirect) {
      const redirectId = await resolveRedirectBankId(bankId);
      if (redirectId != null && redirectId !== bankId) {
        return loadPosForBank(redirectId, { skipRedirect: true });
      }
    }
    throw new PosResolveError(
      `${(bank.adi || bank.kisaAdi).trim()}: aktif sanal POS tanımı yok`,
    );
  }

  const creds = mapPos(bank, pos);
  assertReady(creds);
  return creds;
}

async function findBankIdByHints(hints: string[]): Promise<number | null> {
  const banks = await prisma.banka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true, kisaAdi: true },
  });
  const norms = hints.map(normalizeBankText);
  for (const b of banks) {
    const blob = normalizeBankText(`${b.adi} ${b.kisaAdi}`);
    if (norms.some((h) => h && blob.includes(h))) return b.id;
  }
  return null;
}

/**
 * Kart BIN / banka id → dolu sanal POS + banka URL’leri.
 * Öncelik: bankId → DB BIN kaydı → sabit katalog → varsayılan POS.
 */
export async function resolvePosForPayment(opts: {
  cardDigits: string;
  bankId?: number | null;
}): Promise<PosCredentials> {
  if (opts.bankId != null && Number.isFinite(opts.bankId)) {
    return loadPosForBank(opts.bankId);
  }

  // Api Ayarları › BIN Kayıtları (DB)
  const dbHit = await lookupBinByCard(opts.cardDigits);
  if (dbHit?.bankId != null) {
    return loadPosForBank(dbHit.bankId);
  }
  if (dbHit?.bankName) {
    const byName = await findBankIdByHints([dbHit.bankName]);
    if (byName != null) return loadPosForBank(byName);
  }

  const binKey = matchBinKey(opts.cardDigits);
  if (binKey) {
    const bankId = await findBankIdByHints(hintsForKey(binKey));
    if (bankId != null) return loadPosForBank(bankId);
  }

  // Varsayılan aktif POS (ortak / tek POS senaryosu)
  const defaultPos = await prisma.sanalPosTanim.findFirst({
    where: { aktif: true, varsayilan: true, ...notRemoved() },
    orderBy: { id: 'asc' },
  });
  if (defaultPos) return loadPosForBank(defaultPos.bankaId);

  const anyPos = await prisma.sanalPosTanim.findFirst({
    where: { aktif: true, ...notRemoved() },
    orderBy: { id: 'asc' },
  });
  if (anyPos) return loadPosForBank(anyPos.bankaId);

  throw new PosResolveError(
    'Ödeme için aktif sanal POS yok — Banka URL + Sanal POS bilgilerini doldurun',
  );
}
