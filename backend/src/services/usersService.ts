import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export type UserStatus = 'Aktif' | 'Pasif';

export type PublicPanelUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  roleName: string;
  branchId: number | null;
  branch: string;
  status: UserStatus;
  installments: number[];
};

export class UsersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsersError';
  }
}

function digitsPhone(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('5')) return d;
  if (d.startsWith('0') && d.length === 11) {
    const x = d.slice(1);
    if (x.startsWith('5')) return x;
  }
  return d.slice(0, 10);
}

function parseInstallments(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[,;]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
  return [...new Set(nums)].sort((a, b) => a - b);
}

function encodeInstallments(list: number[]): string {
  const nums = [...new Set(list.filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
  return nums.join(',');
}

function toPublic(
  row: {
    id: number;
    email: string;
    adsoyad: string | null;
    telefon: string;
    isVerified: boolean;
    rolId: number | null;
    subeDepartmanId: number | null;
    izinliTaksitler: string | null;
  },
  roleName: string,
  branchName: string,
): PublicPanelUser {
  return {
    id: row.id,
    name: (row.adsoyad || row.email).trim(),
    email: row.email,
    phone: digitsPhone(row.telefon),
    roleId: row.rolId != null ? String(row.rolId) : '',
    roleName,
    branchId: row.subeDepartmanId,
    branch: branchName,
    status: row.isVerified ? 'Aktif' : 'Pasif',
    installments: parseInstallments(row.izinliTaksitler),
  };
}

async function roleMeta(rolId: number | null) {
  if (rolId == null) return { name: '', code: null as string | null };
  const rol = await prisma.rol.findFirst({
    where: { id: rolId, OR: [{ remove: null }, { remove: false }] },
    select: { adi: true, code: true },
  });
  return { name: rol?.adi || '', code: rol?.code ?? null };
}

async function branchName(subeId: number | null): Promise<string> {
  if (subeId == null) return '';
  const b = await prisma.subeDepartman.findFirst({
    where: { id: subeId, OR: [{ remove: null }, { remove: false }] },
    select: { adi: true },
  });
  return b?.adi || '';
}

async function resolveBranchId(branch: string | undefined, branchId?: number | null) {
  if (branchId != null && Number.isFinite(branchId)) {
    const hit = await prisma.subeDepartman.findFirst({
      where: { id: branchId, OR: [{ remove: null }, { remove: false }] },
    });
    if (!hit) throw new UsersError('Şube bulunamadı');
    return hit.id;
  }
  const name = (branch || '').trim();
  if (!name) return null;

  const all = await prisma.subeDepartman.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { id: true, adi: true },
  });
  const hit = all.find(
    (b) => b.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (hit) return hit.id;
  throw new UsersError('Şube listeden seçilmeli');
}

export async function listPanelUsers(): Promise<PublicPanelUser[]> {
  const rows = await prisma.user.findMany({
    where: {
      musteriId: null,
      OR: [{ remove: null }, { remove: false }],
    },
    orderBy: { id: 'desc' },
  });

  const roleIds = [...new Set(rows.map((r) => r.rolId).filter((x): x is number => x != null))];
  const branchIds = [
    ...new Set(rows.map((r) => r.subeDepartmanId).filter((x): x is number => x != null)),
  ];

  const [roles, branches] = await Promise.all([
    roleIds.length
      ? prisma.rol.findMany({ where: { id: { in: roleIds } }, select: { id: true, adi: true } })
      : Promise.resolve([] as { id: number; adi: string }[]),
    branchIds.length
      ? prisma.subeDepartman.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, adi: true },
        })
      : Promise.resolve([] as { id: number; adi: string }[]),
  ]);

  const roleMap = new Map(roles.map((r) => [r.id, r.adi]));
  const branchMap = new Map(branches.map((b) => [b.id, b.adi]));

  return rows.map((row) =>
    toPublic(
      row,
      row.rolId != null ? roleMap.get(row.rolId) || '' : '',
      row.subeDepartmanId != null ? branchMap.get(row.subeDepartmanId) || '' : '',
    ),
  );
}

export async function listBranches(): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.subeDepartman.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.adi }));
}

export async function createPanelUser(input: {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  branch?: string;
  branchId?: number | null;
  status?: UserStatus;
  installments?: number[];
  password?: string;
}): Promise<PublicPanelUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = digitsPhone(input.phone);
  const rolId = Number(input.roleId);
  if (!name) throw new UsersError('Ad soyad gerekli');
  if (!email.includes('@')) throw new UsersError('Geçerli e-posta girin');
  if (phone.length !== 10 || !phone.startsWith('5')) {
    throw new UsersError('Telefon 5 ile başlayan 10 haneli olmalıdır');
  }
  if (!Number.isFinite(rolId)) throw new UsersError('Rol seçin');

  const role = await roleMeta(rolId);
  if (!role.code) throw new UsersError('Rol bulunamadı');

  const clash = await prisma.user.findFirst({ where: { email } });
  if (clash) throw new UsersError('Bu e-posta zaten kayıtlı');

  const subeId = await resolveBranchId(input.branch, input.branchId);
  const plain = (input.password || '').trim() || randomPassword();
  if (plain.length < 6) throw new UsersError('Şifre en az 6 karakter olmalı');
  const hash = await bcrypt.hash(plain, 13);
  const status: UserStatus = input.status === 'Pasif' ? 'Pasif' : 'Aktif';

  const row = await prisma.user.create({
    data: {
      email,
      adsoyad: name.slice(0, 255),
      telefon: phone,
      password: hash,
      isVerified: status === 'Aktif',
      isPassword: true,
      roles: [role.code],
      rolId,
      subeDepartmanId: subeId,
      izinliTaksitler: encodeInstallments(input.installments || []),
      remove: null,
    },
  });

  return toPublic(row, role.name, await branchName(subeId));
}

export async function updatePanelUser(
  id: number,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    branch?: string;
    branchId?: number | null;
    status?: UserStatus;
    installments?: number[];
    password?: string;
  },
): Promise<PublicPanelUser> {
  const existing = await prisma.user.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new UsersError('Kullanıcı bulunamadı');

  const data: {
    adsoyad?: string;
    email?: string;
    telefon?: string;
    rolId?: number;
    roles?: string[];
    subeDepartmanId?: number | null;
    isVerified?: boolean;
    izinliTaksitler?: string;
    password?: string;
    isPassword?: boolean;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new UsersError('Ad soyad gerekli');
    data.adsoyad = name.slice(0, 255);
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) throw new UsersError('Geçerli e-posta girin');
    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) throw new UsersError('Bu e-posta zaten kayıtlı');
    data.email = email;
  }

  if (input.phone !== undefined) {
    const phone = digitsPhone(input.phone);
    if (phone.length !== 10 || !phone.startsWith('5')) {
      throw new UsersError('Telefon 5 ile başlayan 10 haneli olmalıdır');
    }
    data.telefon = phone;
  }

  if (input.roleId !== undefined) {
    const rolId = Number(input.roleId);
    if (!Number.isFinite(rolId)) throw new UsersError('Rol seçin');
    const role = await roleMeta(rolId);
    if (!role.code) throw new UsersError('Rol bulunamadı');
    data.rolId = rolId;
    data.roles = [role.code];
  }

  if (input.branch !== undefined || input.branchId !== undefined) {
    data.subeDepartmanId = await resolveBranchId(input.branch, input.branchId);
  }

  if (input.status !== undefined) {
    data.isVerified = input.status === 'Aktif';
  }

  if (input.installments !== undefined) {
    data.izinliTaksitler = encodeInstallments(input.installments);
  }

  if (input.password !== undefined && input.password.trim() !== '') {
    if (input.password.trim().length < 6) {
      throw new UsersError('Şifre en az 6 karakter olmalı');
    }
    data.password = await bcrypt.hash(input.password.trim(), 13);
    data.isPassword = true;
  }

  const row = await prisma.user.update({ where: { id }, data });
  const role = await roleMeta(row.rolId);
  return toPublic(row, role.name, await branchName(row.subeDepartmanId));
}

export async function softDeletePanelUser(id: number): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new UsersError('Kullanıcı bulunamadı');

  await prisma.user.update({
    where: { id },
    data: { remove: true, isVerified: false },
  });
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
