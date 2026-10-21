import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { sendVaultOtpMail } from '../lib/mail.js';
import { generateOtpCode, saveOtp, verifyOtp } from '../lib/otpStore.js';
import { decryptVaultValue, encryptVaultValue, isVaultEncrypted } from '../lib/vaultCrypto.js';

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

export type PublicVaultEntry = {
  id: string;
  tip: string;
  etiket: string;
  baslik: string;
  deger: string;
  sira: number;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return secret;
}

export function signVaultUnlock(userId: number, mustChange = false): string {
  return jwt.sign(
    { sub: userId, vault: true, mustChange: mustChange || undefined },
    jwtSecret(),
    { expiresIn: '2h' },
  );
}

export function verifyVaultUnlock(
  token: string | undefined,
  userId: number,
): { ok: boolean; mustChange: boolean } {
  if (!token) return { ok: false, mustChange: false };
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === 'string' || decoded.sub == null) {
      return { ok: false, mustChange: false };
    }
    if (Number(decoded.sub) !== userId) return { ok: false, mustChange: false };
    if ((decoded as { vault?: boolean }).vault !== true) {
      return { ok: false, mustChange: false };
    }
    return {
      ok: true,
      mustChange: Boolean((decoded as { mustChange?: boolean }).mustChange),
    };
  } catch {
    return { ok: false, mustChange: false };
  }
}

async function getAyar(userId: number) {
  return prisma.kasaAyar.findFirst({
    where: { kullaniciId: userId, ...notRemoved() },
  });
}

export async function getVaultStatus(userId: number): Promise<{
  hasPassword: boolean;
}> {
  const ayar = await getAyar(userId);
  return { hasPassword: Boolean(ayar?.sifreHash) };
}

export async function unlockVault(
  userId: number,
  password: string,
): Promise<{ unlockToken: string }> {
  const ayar = await getAyar(userId);
  if (!ayar?.sifreHash) {
    return { unlockToken: signVaultUnlock(userId) };
  }
  const ok = await bcrypt.compare(password, ayar.sifreHash);
  if (!ok) throw new VaultError('Kasa şifresi hatalı');
  return { unlockToken: signVaultUnlock(userId) };
}

export async function setVaultPassword(
  userId: number,
  password: string,
  opts?: { unlockToken?: string; requireUnlock?: boolean },
): Promise<{ unlockToken: string }> {
  const trimmed = password.trim();
  if (trimmed.length < 4) throw new VaultError('Şifre en az 4 karakter olmalı');
  if (trimmed.length > 64) throw new VaultError('Şifre çok uzun');

  const ayar = await getAyar(userId);
  if (ayar?.sifreHash && opts?.requireUnlock !== false) {
    const check = verifyVaultUnlock(opts?.unlockToken, userId);
    if (!check.ok) throw new VaultError('Önce kasayı açın');
  }

  const hash = await bcrypt.hash(trimmed, 10);
  if (ayar) {
    await prisma.kasaAyar.update({
      where: { id: ayar.id },
      data: { sifreHash: hash, remove: false },
    });
  } else {
    await prisma.kasaAyar.create({
      data: { kullaniciId: userId, sifreHash: hash, remove: false },
    });
  }
  return { unlockToken: signVaultUnlock(userId) };
}

export async function clearVaultPassword(
  userId: number,
  unlockToken: string | undefined,
): Promise<void> {
  const check = verifyVaultUnlock(unlockToken, userId);
  if (!check.ok) throw new VaultError('Önce kasayı açın');
  const ayar = await getAyar(userId);
  if (!ayar) return;
  await prisma.kasaAyar.update({
    where: { id: ayar.id },
    data: { sifreHash: null },
  });
}

export async function requestVaultForgot(
  userId: number,
  email: string,
  adsoyad: string | null,
): Promise<{ ok: true; expiresInSec: number }> {
  const ayar = await getAyar(userId);
  if (!ayar?.sifreHash) throw new VaultError('Kasa şifresi tanımlı değil');
  const code = generateOtpCode();
  await saveOtp(email, code, 'vault', 120_000);
  await sendVaultOtpMail(email, adsoyad, code);
  return { ok: true, expiresInSec: 120 };
}

export async function verifyVaultForgot(
  userId: number,
  email: string,
  code: string,
): Promise<{ unlockToken: string; mustChangePassword: true }> {
  const ok = await verifyOtp(email, code, 'vault');
  if (!ok) throw new VaultError('Kod hatalı veya süresi dolmuş');
  return {
    unlockToken: signVaultUnlock(userId, true),
    mustChangePassword: true,
  };
}

function mapEntry(r: {
  id: number;
  tip: string;
  etiket: string;
  baslik: string;
  deger: string;
  sira: number;
}): PublicVaultEntry {
  return {
    id: String(r.id),
    tip: r.tip,
    etiket: r.etiket,
    baslik: r.baslik,
    deger: decryptVaultValue(r.deger),
    sira: r.sira,
  };
}

async function assertUnlocked(
  userId: number,
  unlockToken: string | undefined,
): Promise<void> {
  const ayar = await getAyar(userId);
  if (!ayar?.sifreHash) return;
  const check = verifyVaultUnlock(unlockToken, userId);
  if (!check.ok) throw new VaultError('Kasa kilitli');
}

export async function listVaultEntries(
  userId: number,
  unlockToken: string | undefined,
): Promise<PublicVaultEntry[]> {
  await assertUnlocked(userId, unlockToken);
  const rows = await prisma.kasaKayit.findMany({
    where: { kullaniciId: userId, ...notRemoved() },
    orderBy: [{ sira: 'asc' }, { id: 'asc' }],
  });

  // Eski düz metin kayıtları bir kez mühürle
  for (const row of rows) {
    if (!isVaultEncrypted(row.deger) && row.deger) {
      const sealed = encryptVaultValue(row.deger);
      await prisma.kasaKayit.update({
        where: { id: row.id },
        data: { deger: sealed },
      });
      row.deger = sealed;
    }
  }

  return rows.map(mapEntry);
}

export async function createVaultEntry(
  userId: number,
  unlockToken: string | undefined,
  input: { tip: string; etiket: string; baslik: string; deger: string },
): Promise<PublicVaultEntry> {
  await assertUnlocked(userId, unlockToken);
  const tip = (input.tip || 'ozel').trim().slice(0, 32) || 'ozel';
  const etiket = (input.etiket || tip).trim().slice(0, 64) || tip;
  const baslik = input.baslik.trim();
  const deger = input.deger.trim();
  if (!baslik) throw new VaultError('Başlık gerekli');
  if (!deger) throw new VaultError('Değer gerekli');

  const max = await prisma.kasaKayit.aggregate({
    where: { kullaniciId: userId, ...notRemoved() },
    _max: { sira: true },
  });
  const row = await prisma.kasaKayit.create({
    data: {
      kullaniciId: userId,
      tip,
      etiket,
      baslik: baslik.slice(0, 255),
      deger: encryptVaultValue(deger),
      sira: (max._max.sira ?? 0) + 1,
      remove: false,
    },
  });
  return mapEntry(row);
}

export async function updateVaultEntry(
  userId: number,
  unlockToken: string | undefined,
  id: number,
  input: { tip?: string; etiket?: string; baslik?: string; deger?: string },
): Promise<PublicVaultEntry> {
  await assertUnlocked(userId, unlockToken);
  const existing = await prisma.kasaKayit.findFirst({
    where: { id, kullaniciId: userId, ...notRemoved() },
  });
  if (!existing) throw new VaultError('Kayıt bulunamadı');

  const row = await prisma.kasaKayit.update({
    where: { id },
    data: {
      tip: input.tip != null ? input.tip.trim().slice(0, 32) || existing.tip : undefined,
      etiket:
        input.etiket != null
          ? input.etiket.trim().slice(0, 64) || existing.etiket
          : undefined,
      baslik:
        input.baslik != null
          ? input.baslik.trim().slice(0, 255) || existing.baslik
          : undefined,
      deger:
        input.deger != null
          ? encryptVaultValue(input.deger.trim() || decryptVaultValue(existing.deger))
          : undefined,
    },
  });
  return mapEntry(row);
}

export async function softDeleteVaultEntry(
  userId: number,
  unlockToken: string | undefined,
  id: number,
): Promise<void> {
  await assertUnlocked(userId, unlockToken);
  const existing = await prisma.kasaKayit.findFirst({
    where: { id, kullaniciId: userId, ...notRemoved() },
  });
  if (!existing) throw new VaultError('Kayıt bulunamadı');
  await prisma.kasaKayit.update({ where: { id }, data: { remove: true } });
}
