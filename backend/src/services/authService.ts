import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { sendLoginOtpMail } from '../lib/mail.js';
import { generateOtpCode, saveOtp, verifyOtp } from '../lib/otpStore.js';
import { signToken } from '../middleware/auth.js';

function parseRoles(roles: unknown): string[] {
  if (Array.isArray(roles)) return roles.map(String);
  if (typeof roles === 'string') {
    try {
      const parsed = JSON.parse(roles) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPublicUser(user: {
  id: number;
  email: string;
  adsoyad: string | null;
  roles: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    adsoyad: user.adsoyad,
    roles: parseRoles(user.roles),
  };
}

async function findActiveUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return prisma.user.findFirst({
    where: {
      email: normalized,
      OR: [{ remove: null }, { remove: false }],
    },
  });
}

/** PHP $2y$ hash'lerini bcryptjs ile karşılaştır */
async function passwordMatches(plain: string, hash: string) {
  const normalized = hash.startsWith('$2y$') ? `$2a$${hash.slice(4)}` : hash;
  return bcrypt.compare(plain, normalized);
}

// E-posta + şifre — yalnızca kayıtlı / doğrulanmış kullanıcı
export async function loginWithPassword(email: string, password: string) {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isVerified) {
    throw new AuthError('E-posta veya şifre hatalı');
  }

  const ok = await passwordMatches(password, user.password);
  if (!ok) throw new AuthError('E-posta veya şifre hatalı');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const publicUser = toPublicUser(user);
  const token = signToken({ sub: user.id, email: user.email });
  return { token, user: publicUser };
}

/** Hızlı giriş — kayıtlı kullanıcıya OTP maili */
export async function requestLoginOtp(email: string) {
  const user = await findActiveUserByEmail(email);
  // Enumeration azaltmak için kullanıcı yoksa da aynı mesaj
  if (!user || !user.isVerified) {
    return { sent: true as const };
  }

  const code = generateOtpCode();
  await saveOtp(user.email, code);

  try {
    await sendLoginOtpMail(user.email, user.adsoyad, code);
  } catch (err) {
    console.error('OTP mail gönderilemedi', err);
    throw new AuthError('Doğrulama kodu gönderilemedi. SMTP ayarlarını kontrol edin.');
  }

  return { sent: true as const };
}

export async function loginWithOtp(email: string, code: string) {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isVerified) {
    throw new AuthError('Geçersiz veya süresi dolmuş kod');
  }

  const ok = await verifyOtp(user.email, code);
  if (!ok) throw new AuthError('Geçersiz veya süresi dolmuş kod');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const publicUser = toPublicUser(user);
  const token = signToken({ sub: user.id, email: user.email });
  return { token, user: publicUser };
}

export async function getUserById(id: number) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (user && user.isVerified) return toPublicUser(user);
  return null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
