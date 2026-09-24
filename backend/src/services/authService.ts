import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { sendLoginOtpMail } from '../lib/mail.js';
import { generateOtpCode, saveOtp, verifyOtp } from '../lib/otpStore.js';
import { signToken } from '../middleware/auth.js';
import { writePanelLog } from './logsService.js';

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

/** DB’deki sahte / boş telefonları UI için temizle */
function normalizeStoredPhone(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('5')) return d;
  return '';
}

function toPublicUser(user: {
  id: number;
  email: string;
  adsoyad: string | null;
  telefon: string;
  roles: unknown;
  twoFactor: boolean | null;
}) {
  return {
    id: user.id,
    email: user.email,
    adsoyad: user.adsoyad,
    telefon: normalizeStoredPhone(user.telefon),
    roles: parseRoles(user.roles),
    twoFactor: Boolean(user.twoFactor),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

export type ProfileUpdateInput = {
  adsoyad?: string;
  email?: string;
  telefon?: string;
  password?: string;
  twoFactor?: boolean;
};

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

  await writePanelLog(
    user.id,
    `Giriş - ${user.email} e-posta adresine sahip kullanıcı giriş yaptı.`,
  );

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

  await writePanelLog(
    user.id,
    `Giriş - ${user.email} e-posta adresine sahip kullanıcı giriş yaptı.`,
  );

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

/** Profil sayfası — kendi kaydını güncelle */
export async function updateOwnProfile(userId: number, input: ProfileUpdateInput) {
  const existing = await prisma.user.findFirst({
    where: {
      id: userId,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (!existing || !existing.isVerified) {
    throw new AuthError('Kullanıcı bulunamadı');
  }

  const data: {
    adsoyad?: string;
    email?: string;
    telefon?: string;
    password?: string;
    isPassword?: boolean;
    twoFactor?: boolean;
  } = {};

  if (input.adsoyad !== undefined) {
    const name = input.adsoyad.trim();
    if (!name) throw new AuthError('Ad soyad gerekli');
    data.adsoyad = name.slice(0, 255);
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) throw new AuthError('Geçerli bir e-posta girin');
    const clash = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    });
    if (clash) throw new AuthError('Bu e-posta başka bir hesapta kullanılıyor');
    data.email = email;
  }

  if (input.telefon !== undefined) {
    const digits = input.telefon.replace(/\D/g, '');
    if (digits === '') {
      data.telefon = '';
    } else if (digits.length === 10 && digits.startsWith('5')) {
      data.telefon = digits;
    } else {
      throw new AuthError('Telefon 5 ile başlayan 10 haneli olmalıdır');
    }
  }

  if (input.password !== undefined && input.password !== '') {
    if (input.password.length < 6) {
      throw new AuthError('Şifre en az 6 karakter olmalı');
    }
    data.password = await bcrypt.hash(input.password, 13);
    data.isPassword = true;
  }

  if (input.twoFactor !== undefined) {
    data.twoFactor = input.twoFactor;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return toPublicUser(updated);
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
