import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';

/** Sadece geliştirme — sonra kaldırılacak (docs/KARARLAR.md) */
const DEV_LOGIN_EMAIL = 'admin@guzelteknoloji.com';
const DEV_LOGIN_PASSWORD = '123456';

function isDevLoginEnabled() {
  return process.env.AUTH_DEV_BYPASS === '1' || process.env.NODE_ENV !== 'production';
}

function isDevCredentials(email: string, password: string) {
  return (
    isDevLoginEnabled() &&
    email.toLowerCase() === DEV_LOGIN_EMAIL &&
    password === DEV_LOGIN_PASSWORD
  );
}

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

function mockDevUser() {
  return {
    id: 1,
    email: DEV_LOGIN_EMAIL,
    adsoyad: 'Ercan Güzel',
    roles: ['ROLE_SUPERAPP'],
  };
}

// E-posta + şifre ile giriş; PHP bcrypt ($2y$) hash'leri desteklenir
export async function loginWithPassword(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const allowDev = isDevCredentials(normalized, password);

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: normalized,
        OR: [{ remove: null }, { remove: false }],
      },
    });

    if (user && user.isVerified) {
      const ok = allowDev || (await bcrypt.compare(password, user.password));
      if (!ok) throw new AuthError('E-posta veya şifre hatalı');

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const publicUser = toPublicUser(user);
      const token = signToken({ sub: user.id, email: user.email });
      return { token, user: publicUser };
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (!allowDev) {
      console.error(err);
      throw new AuthError('E-posta veya şifre hatalı');
    }
  }

  if (allowDev) {
    const user = mockDevUser();
    const token = signToken({ sub: user.id, email: user.email });
    return { token, user };
  }

  throw new AuthError('E-posta veya şifre hatalı');
}

export async function getUserById(id: number) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id,
        OR: [{ remove: null }, { remove: false }],
      },
    });
    if (user && user.isVerified) return toPublicUser(user);
  } catch (err) {
    console.error(err);
  }

  if (isDevLoginEnabled() && id === 1) return mockDevUser();
  return null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
