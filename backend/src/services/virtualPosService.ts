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

/** Banka adı eşlemesi — merkez katalog ↔ yerel POS */
function normBankLabel(value: unknown): string {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
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

async function assertLocalVirtualPosWritable() {
  const { isCentralRemoteActive } = await import('./binSourceSettingsService.js');
  if (await isCentralRemoteActive()) {
    throw new VirtualPosError(
      'Merkezi API açık — sanal POS salt okunur. Düzenlemek için Api Ayarları’nda merkezi kaynağı kapatın.',
    );
  }
}

export async function listVirtualPos(): Promise<PublicVirtualPos[]> {
  try {
    const { getBinSourceSettings, fetchRemoteVirtualPos } = await import(
      './binSourceSettingsService.js'
    );
    const src = await getBinSourceSettings();
    if (src.source === 'remote') {
      const remote = await fetchRemoteVirtualPos();
      // Merkez katalog + yerel varsayılan/aktif bayrakları (ödeme tenant POS kullanır)
      const localRows = await prisma.sanalPosTanim.findMany({
        where: notRemoved(),
        orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
      });
      const localByBank = new Map<string, (typeof localRows)[number]>();
      for (const row of localRows) {
        const bank = await prisma.banka.findFirst({
          where: { id: row.bankaId, ...notRemoved() },
          select: { adi: true, kisaAdi: true },
        });
        const keys = [bank?.adi, bank?.kisaAdi]
          .map((v) => normBankLabel(v))
          .filter(Boolean);
        for (const key of keys) {
          if (!localByBank.has(key)) localByBank.set(key, row);
        }
      }
      const out: PublicVirtualPos[] = [];
      const matchedLocalIds = new Set<number>();
      for (const r of remote) {
        const bankKey = normBankLabel(r.bank);
        const local =
          (bankKey && localByBank.get(bankKey)) ||
          [...localByBank.entries()].find(
            ([k]) => bankKey && (k.includes(bankKey) || bankKey.includes(k)),
          )?.[1];
        if (local) {
          matchedLocalIds.add(local.id);
          const mapped = await mapRow(local);
          out.push({
            ...mapped,
            // Merkez adını göster; bayraklar yerel (toggle kalıcı olsun)
            bankName: r.bank || mapped.bankName,
            posName: r.name || mapped.posName,
            infrastructureId: r.variables || mapped.infrastructureId,
          });
        } else {
          out.push({
            id: r.id,
            bankId: '',
            bankName: r.bank || '—',
            bankLogoUrl: '',
            posName: r.name,
            infrastructureId: r.variables || '',
            merchantId: '',
            terminalSafeId: '',
            securityKey: '',
            terminalPassword: '',
            securityType: '',
            isDefault: false,
            active: true,
          });
        }
      }
      // Merkez listesinde olmayan yerel POS kayıtları da görünsün: ödeme tenant DB'deki
      // aktif POS'u kullanır, gizli kalırsa (örn. eski Akbank) kullanıcı kapatamaz.
      for (const local of localRows) {
        if (matchedLocalIds.has(local.id)) continue;
        const mapped = await mapRow(local);
        out.push({ ...mapped, posName: `${mapped.posName} (yerel kayıt)` });
      }
      return out;
    }
  } catch (err) {
    if (err instanceof VirtualPosError) throw err;
    const { getBinSourceSettings } = await import('./binSourceSettingsService.js');
    const src = await getBinSourceSettings().catch(() => null);
    if (src?.source === 'remote') {
      throw new VirtualPosError(
        err instanceof Error ? err.message : 'Merkezi sanal POS yüklenemedi',
      );
    }
  }
  const rows = await prisma.sanalPosTanim.findMany({
    where: notRemoved(),
    orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
  });
  const out: PublicVirtualPos[] = [];
  for (const r of rows) out.push(await mapRow(r));
  return out;
}

/** Aktif varsayılan Sanal POS banka logosu (ödeme ekranı sağ panel) */
export async function getDefaultVirtualPosBrand(): Promise<{
  bankId: string;
  bankName: string;
  bankLogoUrl: string;
  posName: string;
} | null> {
  const { getBinSourceSettings, fetchRemoteVirtualPos } = await import('./binSourceSettingsService.js');
  const source = await getBinSourceSettings();
  if (source.source === 'remote') {
    // Önce yerel varsayılan POS (logo / ödeme ekranı)
    const localDefault = await prisma.sanalPosTanim.findFirst({
      where: { varsayilan: true, aktif: { not: false }, ...notRemoved() },
      orderBy: { id: 'asc' },
    });
    if (localDefault) {
      const mapped = await mapRow(localDefault);
      return {
        bankId: mapped.bankId,
        bankName: mapped.bankName,
        bankLogoUrl: mapped.bankLogoUrl,
        posName: mapped.posName,
      };
    }
    const remote = await fetchRemoteVirtualPos();
    const preferred = remote[0];
    if (!preferred) return null;
    const banks = await import('./banksService.js');
    const bank = (await banks.listBanks()).find((item) => item.name === preferred.bank);
    return {
      bankId: bank?.id || '',
      bankName: preferred.bank || bank?.name || '—',
      bankLogoUrl: bank?.logoUrl || '',
      posName: preferred.name,
    };
  }
  let row = await prisma.sanalPosTanim.findFirst({
    where: { varsayilan: true, aktif: { not: false }, ...notRemoved() },
    orderBy: { id: 'asc' },
  });
  if (!row) {
    row = await prisma.sanalPosTanim.findFirst({
      where: { aktif: { not: false }, ...notRemoved() },
      orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
    });
  }
  if (!row) return null;
  const mapped = await mapRow(row);
  return {
    bankId: mapped.bankId,
    bankName: mapped.bankName,
    bankLogoUrl: mapped.bankLogoUrl,
    posName: mapped.posName,
  };
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

/** Altyapıya göre zorunlu alanlar (frontend profili ile uyumlu) */
function assertCredentials(input: {
  infrastructureId: string;
  merchantId: string;
  terminalSafeId: string;
  securityKey: string;
  terminalPassword: string;
}): string {
  const infra = input.infrastructureId.toLowerCase();
  const merchantId = input.merchantId.trim();
  const terminalSafeId = input.terminalSafeId.trim();
  const securityKey = input.securityKey.trim();
  const terminalPassword = input.terminalPassword.trim();

  if (!merchantId) throw new VirtualPosError('İşyeri / Client ID gerekli');

  if (infra.includes('tosla')) {
    if (!terminalSafeId) throw new VirtualPosError('Api User gerekli');
    if (!securityKey) throw new VirtualPosError('Api Pass gerekli');
    return '3D_PAY';
  }

  if (infra.includes('yapikredi')) {
    if (!terminalSafeId) throw new VirtualPosError('Terminal No gerekli');
    if (!securityKey) throw new VirtualPosError('Posnet ID gerekli');
    if (!terminalPassword) throw new VirtualPosError('ENC Anahtarı gerekli');
    return '3D_PAY';
  }

  if (infra.includes('qnb')) {
    if (!securityKey) throw new VirtualPosError('Üye İşyeri 3D Şifresi gerekli');
    if (!terminalSafeId) throw new VirtualPosError('API Kullanıcı Adı gerekli');
    if (!terminalPassword) throw new VirtualPosError('API Kullanıcı Şifresi gerekli');
    return '';
  }

  if (
    infra.includes('isbank') ||
    infra.includes('ziraat') ||
    infra.includes('halkbank') ||
    infra.includes('nestpay')
  ) {
    if (!securityKey) throw new VirtualPosError('Mağaza Anahtarı gerekli');
    return '';
  }

  if (infra.includes('vakif')) {
    if (!terminalSafeId) throw new VirtualPosError('Terminal No gerekli');
    if (!securityKey) throw new VirtualPosError('Merchant Password gerekli');
    return '3D';
  }

  if (infra.includes('iyzico')) {
    if (!terminalSafeId) throw new VirtualPosError('Api Anahtarı gerekli');
    if (!securityKey) throw new VirtualPosError('Güvenlik Anahtarı gerekli');
    return '3D';
  }

  if (infra.includes('paytr')) {
    if (!securityKey) throw new VirtualPosError('Merchant Key gerekli');
    if (!terminalSafeId) throw new VirtualPosError('Merchant Salt gerekli');
    return 'iframe';
  }

  if (infra.includes('garanti')) {
    if (!terminalSafeId) throw new VirtualPosError('Terminal No gerekli');
    if (!securityKey) throw new VirtualPosError('Mağaza Anahtarı gerekli');
    if (!terminalPassword) throw new VirtualPosError('Terminal Şifresi gerekli');
    return '3D_PAY';
  }

  if (!terminalSafeId) throw new VirtualPosError('Terminal No gerekli');
  if (!securityKey) throw new VirtualPosError('Mağaza / güvenlik anahtarı gerekli');
  return '';
}

export async function createVirtualPos(input: VirtualPosUpsert): Promise<PublicVirtualPos> {
  await assertLocalVirtualPosWritable();
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
  const fallbackType = assertCredentials({
    infrastructureId: infra,
    merchantId,
    terminalSafeId,
    securityKey,
    terminalPassword,
  });
  const securityType = (input.securityType || '').trim() || fallbackType || '3D_PAY';

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
      terminalSafeId: terminalSafeId.slice(0, 255) || null,
      guvenlikAnahtari: securityKey.slice(0, 512) || null,
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
  await assertLocalVirtualPosWritable();
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
  const fallbackType = assertCredentials({
    infrastructureId: infra,
    merchantId,
    terminalSafeId,
    securityKey,
    terminalPassword,
  });
  const securityType = (input.securityType || '').trim() || fallbackType || '3D_PAY';

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
      terminalSafeId: terminalSafeId.slice(0, 255) || null,
      guvenlikAnahtari: securityKey.slice(0, 512) || null,
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
  // Merkez açıkken kimlik/credential düzenlenmez; varsayılan/aktif bayrağı
  // yerel tenant POS’ta kalır (ödeme resolveTenantPos / resolvePos buradan bakar).
  const existing = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) {
    throw new VirtualPosError(
      'Sanal POS bulunamadı. Merkez kaydının AnyPay’de eşleşen yerel POS’u olmalı (aynı banka).',
    );
  }

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
  await assertLocalVirtualPosWritable();
  const existing = await prisma.sanalPosTanim.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new VirtualPosError('Sanal POS bulunamadı');
  await prisma.sanalPosTanim.update({
    where: { id },
    data: { remove: true, varsayilan: false },
  });
}
