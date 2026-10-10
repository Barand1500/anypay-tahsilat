import { prisma } from '../lib/prisma.js';
import { resolveBankLogoUrl } from './banksService.js';

export class CommonVirtualPosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommonVirtualPosError';
  }
}

export type PublicCommonVirtualPos = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogoUrl: string;
  targetBankId: string;
  targetBankName: string;
  targetBankLogoUrl: string;
  active: boolean;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

async function bankBrief(id: number) {
  const b = await prisma.banka.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true, adi: true, kisaAdi: true, logo: true },
  });
  if (!b) return null;
  return {
    id: b.id,
    name: (b.adi || b.kisaAdi || `Banka #${b.id}`).trim(),
    logoUrl: resolveBankLogoUrl(b.logo),
  };
}

async function mapRow(r: {
  id: number;
  bankaId: number;
  yonlenenBankaId: number;
  aktif: boolean | null;
}): Promise<PublicCommonVirtualPos> {
  const [bank, target] = await Promise.all([
    bankBrief(r.bankaId),
    bankBrief(r.yonlenenBankaId),
  ]);
  return {
    id: String(r.id),
    bankId: String(r.bankaId),
    bankName: bank?.name || `Banka #${r.bankaId}`,
    bankLogoUrl: bank?.logoUrl || '',
    targetBankId: String(r.yonlenenBankaId),
    targetBankName: target?.name || `Banka #${r.yonlenenBankaId}`,
    targetBankLogoUrl: target?.logoUrl || '',
    active: r.aktif !== false,
  };
}

export async function listCommonVirtualPos(): Promise<PublicCommonVirtualPos[]> {
  const rows = await prisma.ortakSanalPos.findMany({
    where: notRemoved(),
    orderBy: { id: 'asc' },
  });
  const out: PublicCommonVirtualPos[] = [];
  for (const r of rows) out.push(await mapRow(r));
  return out;
}

export type CommonVirtualPosUpsert = {
  bankId: string;
  targetBankId: string;
  active?: boolean;
};

export async function createCommonVirtualPos(
  input: CommonVirtualPosUpsert,
): Promise<PublicCommonVirtualPos> {
  const bankId = Number(input.bankId);
  const targetId = Number(input.targetBankId);
  if (!Number.isFinite(bankId) || !Number.isFinite(targetId)) {
    throw new CommonVirtualPosError('Banka seçiniz');
  }
  if (bankId === targetId) {
    throw new CommonVirtualPosError('Banka ile yönlenen banka aynı olamaz');
  }

  const [bank, target] = await Promise.all([bankBrief(bankId), bankBrief(targetId)]);
  if (!bank) throw new CommonVirtualPosError('Banka bulunamadı');
  if (!target) throw new CommonVirtualPosError('Yönlenen banka bulunamadı');

  const clash = await prisma.ortakSanalPos.findFirst({
    where: { bankaId: bankId, ...notRemoved() },
  });
  if (clash) {
    throw new CommonVirtualPosError('Bu banka için zaten bir yönlendirme tanımlı');
  }

  const row = await prisma.ortakSanalPos.create({
    data: {
      bankaId: bankId,
      yonlenenBankaId: targetId,
      aktif: input.active !== false,
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateCommonVirtualPos(
  id: number,
  input: CommonVirtualPosUpsert,
): Promise<PublicCommonVirtualPos> {
  const existing = await prisma.ortakSanalPos.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new CommonVirtualPosError('Ortak Sanal POS bulunamadı');

  const bankId = Number(input.bankId);
  const targetId = Number(input.targetBankId);
  if (!Number.isFinite(bankId) || !Number.isFinite(targetId)) {
    throw new CommonVirtualPosError('Banka seçiniz');
  }
  if (bankId === targetId) {
    throw new CommonVirtualPosError('Banka ile yönlenen banka aynı olamaz');
  }

  const [bank, target] = await Promise.all([bankBrief(bankId), bankBrief(targetId)]);
  if (!bank) throw new CommonVirtualPosError('Banka bulunamadı');
  if (!target) throw new CommonVirtualPosError('Yönlenen banka bulunamadı');

  const clash = await prisma.ortakSanalPos.findFirst({
    where: { bankaId: bankId, ...notRemoved(), NOT: { id } },
  });
  if (clash) {
    throw new CommonVirtualPosError('Bu banka için zaten bir yönlendirme tanımlı');
  }

  const row = await prisma.ortakSanalPos.update({
    where: { id },
    data: {
      bankaId: bankId,
      yonlenenBankaId: targetId,
      aktif: input.active !== false,
    },
  });
  return mapRow(row);
}

export async function softDeleteCommonVirtualPos(id: number): Promise<void> {
  const existing = await prisma.ortakSanalPos.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new CommonVirtualPosError('Ortak Sanal POS bulunamadı');
  await prisma.ortakSanalPos.update({
    where: { id },
    data: { remove: true },
  });
}

/** Kaynak banka → yönlenen banka id (aktif eşleme) */
export async function resolveRedirectBankId(sourceBankId: number): Promise<number | null> {
  try {
    const row = await prisma.ortakSanalPos.findFirst({
      where: {
        bankaId: sourceBankId,
        aktif: true,
        ...notRemoved(),
      },
      select: { yonlenenBankaId: true },
    });
    return row?.yonlenenBankaId ?? null;
  } catch {
    return null;
  }
}

/** Ortak Sanal POS’ta yönlendirilen kaynak banka id’leri (Taksit Seçenekleri’nde gizlenir) */
export async function listRedirectedSourceBankIds(): Promise<Set<number>> {
  try {
    const rows = await prisma.ortakSanalPos.findMany({
      where: { aktif: true, ...notRemoved() },
      select: { bankaId: true },
    });
    return new Set(rows.map((r) => r.bankaId).filter((id) => Number.isFinite(id)));
  } catch {
    return new Set();
  }
}

/** Ödeme ekranı — aktif yönlendirmeler (logo: kaynak kart → hedef POS bankası) */
export type PosRedirectPublic = {
  sourceBankId: string;
  sourceBankName: string;
  targetBankId: string;
  targetBankName: string;
  targetBankLogoUrl: string;
};

export async function listActivePosRedirects(): Promise<PosRedirectPublic[]> {
  try {
    const rows = await prisma.ortakSanalPos.findMany({
      where: { aktif: true, ...notRemoved() },
      orderBy: { id: 'asc' },
    });
    const out: PosRedirectPublic[] = [];
    for (const r of rows) {
      const [source, target] = await Promise.all([
        bankBrief(r.bankaId),
        bankBrief(r.yonlenenBankaId),
      ]);
      out.push({
        sourceBankId: String(r.bankaId),
        sourceBankName: source?.name || `Banka #${r.bankaId}`,
        targetBankId: String(r.yonlenenBankaId),
        targetBankName: target?.name || `Banka #${r.yonlenenBankaId}`,
        targetBankLogoUrl: target?.logoUrl || '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeBankHint(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Taksit oranı / anlaşma için hedef banka.
 * Ortak Sanal POS: Halkbank → QNB gibi yönlendirme (oran + Banka&Taksit logosu).
 */
export async function resolveRatesTargetBank(opts: {
  bankId?: number | null;
  bankName?: string | null;
}): Promise<{ bankId: number | null; bankName: string | null; redirected: boolean }> {
  let bankId =
    opts.bankId != null && Number.isFinite(opts.bankId) ? Number(opts.bankId) : null;
  let bankName = (opts.bankName || '').trim() || null;

  if (bankId == null && bankName) {
    try {
      const banks = await prisma.banka.findMany({
        where: notRemoved(),
        select: { id: true, adi: true, kisaAdi: true },
      });
      const needle = normalizeBankHint(bankName);
      const hit = banks.find((b) => {
        const blob = normalizeBankHint(`${b.adi} ${b.kisaAdi}`);
        return Boolean(needle && blob && (blob.includes(needle) || needle.includes(blob)));
      });
      if (hit) bankId = hit.id;
    } catch {
      /* isimden id çözülemezse devam */
    }
  }

  if (bankId == null) {
    return { bankId: null, bankName, redirected: false };
  }

  const targetId = await resolveRedirectBankId(bankId);
  if (targetId == null || targetId === bankId) {
    return { bankId, bankName, redirected: false };
  }

  const target = await bankBrief(targetId);
  return {
    bankId: targetId,
    bankName: target?.name || bankName,
    redirected: true,
  };
}

/** Varsayılan aktif Sanal POS bankası (anlaşmasız kart bankası fallback) */
export async function resolveDefaultPosRatesBank(): Promise<{
  bankId: number;
  bankName: string;
} | null> {
  const { getDefaultVirtualPosBrand } = await import('./virtualPosService.js');
  const def = await getDefaultVirtualPosBrand();
  const id = def?.bankId ? Number(def.bankId) : NaN;
  if (!Number.isFinite(id)) return null;
  return { bankId: id, bankName: def?.bankName || `Banka #${id}` };
}
