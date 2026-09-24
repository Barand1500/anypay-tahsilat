import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

type OtpEntry = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

/** Tek process OTP deposu — sonra DB tablosuna taşınabilir */
const store = new Map<string, OtpEntry>();

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

export async function saveOtp(email: string, code: string) {
  const key = normalizeEmail(email);
  const codeHash = await bcrypt.hash(code, 10);
  store.set(key, {
    codeHash,
    expiresAt: Date.now() + expiresMs(),
    attempts: 0,
  });
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return false;
  }
  entry.attempts += 1;
  const ok = await bcrypt.compare(code.trim(), entry.codeHash);
  if (ok) store.delete(key);
  return ok;
}

export function clearOtp(email: string) {
  store.delete(normalizeEmail(email));
}
