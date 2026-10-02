import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { sendLoginOtpMail, sendPasswordResetOtpMail, sendTwoFactorCodeMail } from '../lib/mail.js';
import { clearOtp, generateOtpCode, saveOtp, verifyOtp } from '../lib/otpStore.js';
import { signToken } from '../middleware/auth.js';
import { UPLOADS_ROOT } from './settingsService.js';
import { writePanelLog } from './logsService.js';

const RESET_OTP_SCOPE = 'password-reset';
const RESET_TOKEN_TTL = '15m';
const MFA_OTP_SCOPE = 'password-mfa';
const MFA_TTL_MS = 90_000;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return secret;
}

function signPasswordResetToken(userId: number, email: string): string {
  return jwt.sign(
    { sub: userId, email, purpose: 'password-reset' },
    jwtSecret(),
    { expiresIn: RESET_TOKEN_TTL },
  );
}

function verifyPasswordResetToken(
  token: string | undefined,
): { userId: number; email: string } | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === 'string' || decoded.sub == null) return null;
    if ((decoded as { purpose?: string }).purpose !== 'password-reset') return null;
    if (typeof (decoded as { email?: string }).email !== 'string') return null;
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId)) return null;
    return { userId, email: (decoded as { email: string }).email };
  } catch {
    return null;
  }
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

/** DB’deki sahte / boş telefonları UI için temizle */
function normalizeStoredPhone(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('5')) return d;
  return '';
}

function parseInstallments(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[,;]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
  return [...new Set(nums)].sort((a, b) => a - b);
}

function parseBranchIds(user: {
  subeDepartmanId?: number | null;
  subeDepartmanIds?: string | null;
}): number[] {
  const fromList = (user.subeDepartmanIds || '')
    .split(/[,;]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (fromList.length) return [...new Set(fromList)];
  return user.subeDepartmanId != null ? [user.subeDepartmanId] : [];
}

function toPublicUser(
  user: {
    id: number;
    email: string;
    adsoyad: string | null;
    telefon: string;
    roles: unknown;
    twoFactor: boolean | null;
    resim?: string | null;
    mustChangePassword?: boolean | null;
    izinliTaksitler?: string | null;
    subeDepartmanId?: number | null;
    subeDepartmanIds?: string | null;
  },
  /** Atanan rol kodu (rol tablosu) — JSON roles alanından öncelikli */
  roleCode?: string | null,
) {
  const fromJson = parseRoles(user.roles);
  const roles =
    roleCode && roleCode.trim()
      ? [roleCode.trim()]
      : fromJson;
  const resim = (user.resim || '').replace(/^\/+/, '');
  const resimUrl = resim
    ? resim.startsWith('uploads/')
      ? `/${resim}`
      : `/uploads/${resim}`
    : null;
  return {
    id: user.id,
    email: user.email,
    adsoyad: user.adsoyad,
    telefon: normalizeStoredPhone(user.telefon),
    roles,
    twoFactor: Boolean(user.twoFactor),
    mustChangePassword: Boolean(user.mustChangePassword),
    resimUrl,
    /** Boş = kısıt yok (tümü); dolu = yalnızca bunlar */
    installments: parseInstallments(user.izinliTaksitler),
    branchIds: parseBranchIds(user),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

async function roleCodeForUser(rolId: number | null | undefined): Promise<string | null> {
  if (rolId == null) return null;
  const rol = await prisma.rol.findFirst({
    where: { id: rolId, OR: [{ remove: null }, { remove: false }] },
    select: { code: true },
  });
  return rol?.code ?? null;
}

export type ProfileUpdateInput = {
  adsoyad?: string;
  email?: string;
  telefon?: string;
  password?: string;
  twoFactor?: boolean;
  /** data:image/...;base64,... */
  resimDataUrl?: string | null;
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

  if (user.twoFactor) {
    const code = generateOtpCode();
    await saveOtp(user.email, code, MFA_OTP_SCOPE, MFA_TTL_MS);
    try {
      await sendTwoFactorCodeMail(user.email, user.adsoyad, code);
    } catch (err) {
      await clearOtp(user.email, MFA_OTP_SCOPE);
      console.error('İki aşamalı doğrulama e-postası gönderilemedi', err);
      throw new AuthError('Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    }
    const challengeToken = jwt.sign(
      { sub: user.id, email: user.email, purpose: MFA_OTP_SCOPE },
      jwtSecret(),
      { expiresIn: '90s' },
    );
    return { requiresTwoFactor: true as const, challengeToken, expiresInSeconds: 90 };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  await writePanelLog(
    user.id,
    `Giriş - ${user.email} e-posta adresine sahip kullanıcı giriş yaptı.`,
  );

  const publicUser = toPublicUser(user, await roleCodeForUser(user.rolId));
  const token = signToken({ sub: user.id, email: user.email });
  return { requiresTwoFactor: false as const, token, user: publicUser };
}

export async function verifyPasswordMfa(challengeToken: string, code: string) {
  let userId: number;
  let email: string;
  try {
    const decoded = jwt.verify(challengeToken, jwtSecret());
    if (typeof decoded === 'string' || decoded.purpose !== MFA_OTP_SCOPE || typeof decoded.email !== 'string') {
      throw new Error('Invalid challenge');
    }
    userId = Number(decoded.sub);
    email = decoded.email;
    if (!Number.isSafeInteger(userId)) throw new Error('Invalid user');
  } catch {
    throw new AuthError('Doğrulama süresi doldu. Şifrenizle yeniden giriş yapın.');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, email, isVerified: true, twoFactor: true, OR: [{ remove: null }, { remove: false }] },
  });
  if (!user || !(await verifyOtp(user.email, code, MFA_OTP_SCOPE))) {
    throw new AuthError('Kod hatalı veya süresi dolmuş');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  await writePanelLog(user.id, `Giriş - ${user.email} e-posta adresine sahip kullanıcı iki aşamalı doğrulamayla giriş yaptı.`);
  const publicUser = toPublicUser(user, await roleCodeForUser(user.rolId));
  return { token: signToken({ sub: user.id, email: user.email }), user: publicUser };
}

/** Hızlı giriş — kayıtlı kullanıcıya OTP maili */
export async function requestLoginOtp(email: string) {
  const user = await findActiveUserByEmail(email);
  // Enumeration azaltmak için kullanıcı yoksa da aynı mesaj
  if (!user || !user.isVerified) {
    return { sent: true as const };
  }
  if (user.twoFactor) throw new AuthError('İki aşamalı doğrulama açık. Şifrenizle giriş yapın.');

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
  if (user.twoFactor) throw new AuthError('İki aşamalı doğrulama açık. Şifrenizle giriş yapın.');

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

  const publicUser = toPublicUser(user, await roleCodeForUser(user.rolId));
  const token = signToken({ sub: user.id, email: user.email });
  return { token, user: publicUser };
}

/** Şifremi unuttum — e-postaya kod gönder (enumeration’a karşı her zaman ok) */
export async function requestPasswordReset(email: string) {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isVerified) {
    return { sent: true as const };
  }

  const code = generateOtpCode();
  await saveOtp(user.email, code, RESET_OTP_SCOPE);

  try {
    await sendPasswordResetOtpMail(user.email, user.adsoyad, code);
  } catch (err) {
    console.error('Şifre sıfırlama maili gönderilemedi', err);
    throw new AuthError('Doğrulama kodu gönderilemedi. SMTP ayarlarını kontrol edin.');
  }

  return { sent: true as const };
}

/** Kod doğrula → kısa ömürlü resetToken */
export async function verifyPasswordResetCode(email: string, code: string) {
  const user = await findActiveUserByEmail(email);
  if (!user || !user.isVerified) {
    throw new AuthError('Geçersiz veya süresi dolmuş kod');
  }

  const ok = await verifyOtp(user.email, code, RESET_OTP_SCOPE);
  if (!ok) throw new AuthError('Geçersiz veya süresi dolmuş kod');

  return {
    resetToken: signPasswordResetToken(user.id, user.email),
  };
}

/** resetToken ile yeni şifre kaydet */
export async function resetPasswordWithToken(resetToken: string, password: string) {
  const trimmed = password.trim();
  if (trimmed.length < 6) throw new AuthError('Şifre en az 6 karakter olmalı');
  if (trimmed.length > 128) throw new AuthError('Şifre çok uzun');

  const payload = verifyPasswordResetToken(resetToken);
  if (!payload) throw new AuthError('Oturum süresi doldu — kodu yeniden isteyin');

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      email: payload.email,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (!user || !user.isVerified) {
    throw new AuthError('Kullanıcı bulunamadı');
  }

  const hash = await bcrypt.hash(trimmed, 13);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, isPassword: true, mustChangePassword: false },
  });

  await writePanelLog(
    user.id,
    `Şifre - ${user.email} e-posta adresine sahip kullanıcı şifresini sıfırladı.`,
  );

  return { ok: true as const };
}

export async function getUserById(id: number) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (user && user.isVerified) {
    return toPublicUser(user, await roleCodeForUser(user.rolId));
  }
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
    mustChangePassword?: boolean;
    twoFactor?: boolean;
    resim?: string | null;
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
    data.mustChangePassword = false;
  }

  if (input.twoFactor !== undefined) {
    data.twoFactor = input.twoFactor;
  }

  if (input.resimDataUrl !== undefined) {
    if (input.resimDataUrl === null || input.resimDataUrl === '') {
      data.resim = null;
    } else {
      data.resim = await saveUserAvatar(userId, input.resimDataUrl);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return toPublicUser(updated, await roleCodeForUser(updated.rolId));
}

async function saveUserAvatar(userId: number, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) throw new AuthError('Geçersiz görsel formatı (PNG, JPEG, WebP, GIF)');
  const mime = m[2].toLowerCase();
  const ext = mime === 'jpeg' || mime === 'jpg' ? 'jpg' : mime;
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length > 3 * 1024 * 1024) throw new AuthError('Fotoğraf en fazla 3 MB olabilir');
  if (buffer.length < 32) throw new AuthError('Görsel dosyası boş veya bozuk');
  const dir = path.join(UPLOADS_ROOT, 'kullanicilar');
  await fs.mkdir(dir, { recursive: true });
  const filename = `${userId}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `kullanicilar/${filename}`;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
