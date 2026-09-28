import { prisma } from '../lib/prisma.js';
import { resolveBankLogoUrl } from './banksService.js';

export class VirtualPosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VirtualPosError';
  }
}

export type PublicVirtualPos = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogoUrl: string;
  posName: string;
  infrastructureId: string;
  merchantId: string;
  terminalSafeId: string;
  securityKey: string;
  terminalPassword: string;
  securityType: string;
  isDefault: boolean;
  active: boolean;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

async function mapRow(r: {
  id: number;
  bankaId: number;
  altyapiKodu: string;
  posAdi: string;
  isyeriNo: string | null;
  terminalSafeId: string | null;
  guvenlikAnahtari: string | null;
  terminalSifresi: string | null;
  guvenlikTipi: string | null;
  varsayilan: boolean | null;
  aktif: boolean | null;
}): Promise<PublicVirtualPos> {
  const bank = await prisma.banka.findFirst({
    where: { id: r.bankaId, ...notRemoved() },
    select: { adi: true, kisaAdi: true, logo: true },
  });
  return {
    id: String(r.id),
    bankId: String(r.bankaId),
    bankName: (bank?.adi || bank?.kisaAdi || `Banka #${r.bankaId}`).trim(),
    bankLogoUrl: resolveBankLogoUrl(bank?.logo),
    posName: r.posAdi,
    infrastructureId: r.altyapiKodu,
    merchantId: r.isyeriNo || '',
    terminalSafeId: r.terminalSafeId || '',
    securityKey: r.guvenlikAnahtari || '',
    terminalPassword: r.terminalSifresi || '',
    securityType: r.guvenlikTipi || '',
    isDefault: Boolean(r.varsayilan),
    active: r.aktif !== false,
  };
}

export async function listVirtualPos(): Promise<PublicVirtualPos[]> {
  const rows = await prisma.sanalPosTanim.findMany({
    where: notRemoved(),
    orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
  });
  const out: PublicVirtualPos[] = [];
  for (const r of rows) out.push(await mapRow(r));
  return out;
}

export async function getVirtualPos(id: number): Promise<PublicVirtualPos | null> {
  const row = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!row) return null;
  return mapRow(row);
}

export type VirtualPosUpsert = {
  bankId: string;
  infrastructureId: string;
  posName: string;
  merchantId?: string;
  terminalSafeId?: string;
  securityKey?: string;
  terminalPassword?: string;
  securityType?: string;
  isDefault?: boolean;
  active?: boolean;
};

async function assertBank(bankId: number) {
  const bank = await prisma.banka.findFirst({
    where: { id: bankId, ...notRemoved() },
    select: { id: true },
  });
  if (!bank) throw new VirtualPosError('Banka bulunamadı');
}

export async function createVirtualPos(input: VirtualPosUpsert): Promise<PublicVirtualPos> {
  const bankId = Number(input.bankId);
  if (!Number.isFinite(bankId)) throw new VirtualPosError('Banka seçiniz');
  await assertBank(bankId);

  const infra = input.infrastructureId.trim();
  const posName = input.posName.trim();
  if (!infra) throw new VirtualPosError('Sanal POS alt yapısı seçiniz');
  if (!posName) throw new VirtualPosError('POS adı gerekli');

  const merchantId = (input.merchantId || '').trim();
  const terminalSafeId = (input.terminalSafeId || '').trim();
  const securityKey = (input.securityKey || '').trim();
  const terminalPassword = (input.terminalPassword || '').trim();
  const securityType = (input.securityType || '').trim();
  if (!merchantId) throw new VirtualPosError('İşyeri numarası gerekli');
  if (!terminalSafeId) throw new VirtualPosError('Terminal no gerekli');
  if (!securityKey) throw new VirtualPosError('Mağaza / güvenlik anahtarı gerekli');
  if (!securityType) throw new VirtualPosError('Güvenlik tipi seçiniz');

  const clash = await prisma.sanalPosTanim.findFirst({
    where: {
      bankaId: bankId,
      altyapiKodu: infra,
      ...notRemoved(),
    },
  });
  if (clash) throw new VirtualPosError('Bu banka ve alt yapı zaten tanımlı');

  const wantDefault = Boolean(input.isDefault);
  if (wantDefault) {
    await prisma.sanalPosTanim.updateMany({
      where: notRemoved(),
      data: { varsayilan: false },
    });
  }

  const row = await prisma.sanalPosTanim.create({
    data: {
      bankaId: bankId,
      altyapiKodu: infra.slice(0, 64),
      posAdi: posName.slice(0, 255),
      isyeriNo: merchantId.slice(0, 255),
      terminalSafeId: terminalSafeId.slice(0, 255),
      guvenlikAnahtari: securityKey.slice(0, 512),
      terminalSifresi: terminalPassword.slice(0, 255) || null,
      guvenlikTipi: securityType.slice(0, 64),
      varsayilan: wantDefault,
      aktif: input.active !== false,
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateVirtualPos(
  id: number,
  input: VirtualPosUpsert,
): Promise<PublicVirtualPos> {
  const existing = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new VirtualPosError('Sanal POS bulunamadı');

  const bankId = Number(input.bankId);
  if (!Number.isFinite(bankId)) throw new VirtualPosError('Banka seçiniz');
  await assertBank(bankId);

  const infra = input.infrastructureId.trim();
  const posName = input.posName.trim();
  if (!infra) throw new VirtualPosError('Sanal POS alt yapısı seçiniz');
  if (!posName) throw new VirtualPosError('POS adı gerekli');

  const merchantId = (input.merchantId || '').trim();
  const terminalSafeId = (input.terminalSafeId || '').trim();
  const securityKey = (input.securityKey || '').trim();
  const terminalPassword = (input.terminalPassword || '').trim();
  const securityType = (input.securityType || '').trim();
  if (!merchantId) throw new VirtualPosError('İşyeri numarası gerekli');
  if (!terminalSafeId) throw new VirtualPosError('Terminal no gerekli');
  if (!securityKey) throw new VirtualPosError('Mağaza / güvenlik anahtarı gerekli');
  if (!securityType) throw new VirtualPosError('Güvenlik tipi seçiniz');

  const clash = await prisma.sanalPosTanim.findFirst({
    where: {
      bankaId: bankId,
      altyapiKodu: infra,
      ...notRemoved(),
      NOT: { id },
    },
  });
  if (clash) throw new VirtualPosError('Bu banka ve alt yapı zaten tanımlı');

  const wantDefault = Boolean(input.isDefault);
  if (wantDefault) {
    await prisma.sanalPosTanim.updateMany({
      where: { ...notRemoved(), NOT: { id } },
      data: { varsayilan: false },
    });
  }

  const row = await prisma.sanalPosTanim.update({
    where: { id },
    data: {
      bankaId: bankId,
      altyapiKodu: infra.slice(0, 64),
      posAdi: posName.slice(0, 255),
      isyeriNo: merchantId.slice(0, 255),
      terminalSafeId: terminalSafeId.slice(0, 255),
      guvenlikAnahtari: securityKey.slice(0, 512),
      terminalSifresi: terminalPassword.slice(0, 255) || null,
      guvenlikTipi: securityType.slice(0, 64),
      varsayilan: wantDefault,
      aktif: wantDefault ? true : input.active !== false,
    },
  });
  return mapRow(row);
}

export async function patchVirtualPosFlags(
  id: number,
  patch: { isDefault?: boolean; active?: boolean },
): Promise<PublicVirtualPos> {
  const existing = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new VirtualPosError('Sanal POS bulunamadı');

  let varsayilan = existing.varsayilan;
  let aktif = existing.aktif;

  if (patch.isDefault !== undefined) {
    varsayilan = patch.isDefault;
    if (patch.isDefault) {
      await prisma.sanalPosTanim.updateMany({
        where: { ...notRemoved(), NOT: { id } },
        data: { varsayilan: false },
      });
      aktif = true;
    }
  }
  if (patch.active !== undefined) {
    aktif = patch.active;
  }

  const row = await prisma.sanalPosTanim.update({
    where: { id },
    data: { varsayilan, aktif },
  });
  return mapRow(row);
}

export async function softDeleteVirtualPos(id: number): Promise<void> {
  const existing = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new VirtualPosError('Sanal POS bulunamadı');
  await prisma.sanalPosTanim.update({
    where: { id },
    data: { remove: true, varsayilan: false },
  });
}
