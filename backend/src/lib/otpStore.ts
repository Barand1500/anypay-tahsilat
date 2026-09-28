import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from './prisma.js';

const MAX_ATTEMPTS = 5;

function expiresMs() {
  const min = Number(process.env.OTP_EXPIRES_MINUTES || 10);
  return Math.max(1, min) * 60_000;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** OTP — DB (otp_challenge); restart / çok process dayanıklı */
export async function saveOtp(
  email: string,
  code: string,
  scope = 'login',
  ttlMs?: number,
) {
  const normalized = normalizeEmail(email);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + (ttlMs && ttlMs > 0 ? ttlMs : expiresMs()));

  await prisma.otpChallenge.upsert({
    where: { scope_email: { scope, email: normalized } },
    create: {
      scope,
      email: normalized,
      codeHash,
      expiresAt,
      attempts: 0,
    },
    update: {
      codeHash,
      expiresAt,
      attempts: 0,
    },
  });
}

export async function verifyOtp(
  email: string,
  code: string,
  scope = 'login',
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const entry = await prisma.otpChallenge.findUnique({
    where: { scope_email: { scope, email: normalized } },
  });
  if (!entry) return false;

  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.otpChallenge.delete({ where: { id: entry.id } }).catch(() => undefined);
    return false;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await prisma.otpChallenge.delete({ where: { id: entry.id } }).catch(() => undefined);
    return false;
  }

  const attempts = entry.attempts + 1;
  const ok = await bcrypt.compare(code.trim(), entry.codeHash);

  if (ok) {
    await prisma.otpChallenge.delete({ where: { id: entry.id } }).catch(() => undefined);
    return true;
  }

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.otpChallenge.delete({ where: { id: entry.id } }).catch(() => undefined);
  } else {
    await prisma.otpChallenge.update({
      where: { id: entry.id },
      data: { attempts },
    });
  }
  return false;
}

export async function clearOtp(email: string, scope = 'login') {
  const normalized = normalizeEmail(email);
  await prisma.otpChallenge
    .deleteMany({ where: { scope, email: normalized } })
    .catch(() => undefined);
}
