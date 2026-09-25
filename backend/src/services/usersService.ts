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
  branchIds: number[];
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

function parseIdList(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[,;]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(nums)];
}

function encodeIdList(list: number[]): string | null {
  const nums = [...new Set(list.filter((n) => Number.isFinite(n) && n > 0))];
  return nums.length ? nums.join(',') : null;
}

/** null = kısıt yok (eski kayıt); dizi = yalnızca bunlar */
export function userAllowedInstallments(raw: string | null | undefined): number[] | null {
  if (raw == null || String(raw).trim() === '') return null;
  return parseInstallments(raw);
}

export async function getUserAllowedInstallments(userId: number): Promise<number[] | null> {
  const row = await prisma.user.findFirst({
    where: { id: userId, OR: [{ remove: null }, { remove: false }] },
    select: { izinliTaksitler: true },
  });
  if (!row) return null;
  return userAllowedInstallments(row.izinliTaksitler);
}

export function assertInstallmentsAllowed(
  allowed: number[] | null,
  requested: number[],
): void {
  if (allowed == null) return;
  if (!allowed.length) {
    throw new UsersError('Bu kullanıcıya taksit atanmamış');
  }
  const bad = requested.filter((n) => !allowed.includes(n));
  if (bad.length) {
    throw new UsersError(`İzin verilmeyen taksit: ${bad.join(', ')}`);
  }
}

function branchIdsOf(row: {
  subeDepartmanId: number | null;
  subeDepartmanIds: string | null;
}): number[] {
  const fromList = parseIdList(row.subeDepartmanIds);
  if (fromList.length) return fromList;
  return row.subeDepartmanId != null ? [row.subeDepartmanId] : [];
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
    subeDepartmanIds: string | null;
    izinliTaksitler: string | null;
  },
  roleName: string,
  branchNames: string[],
): PublicPanelUser {
  const ids = branchIdsOf(row);
  return {
    id: row.id,
    name: (row.adsoyad || row.email).trim(),
    email: row.email,
    phone: digitsPhone(row.telefon),
    roleId: row.rolId != null ? String(row.rolId) : '',
    roleName,
    branchId: ids[0] ?? null,
    branchIds: ids,
    branch: branchNames.join(', '),
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

async function branchNamesFor(ids: number[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.subeDepartman.findMany({
    where: { id: { in: ids }, OR: [{ remove: null }, { remove: false }] },
    select: { id: true, adi: true },
  });
  const map = new Map(rows.map((b) => [b.id, b.adi]));
  return ids.map((id) => map.get(id) || '').filter(Boolean);
}

async function resolveBranchIds(input: {
  branchIds?: number[] | null;
  branchId?: number | null;
  branch?: string;
  branches?: string[];
}): Promise<number[]> {
  if (input.branchIds != null) {
    const ids = [...new Set(input.branchIds.filter((n) => Number.isFinite(n) && n > 0))];
    if (!ids.length) return [];
    const found = await prisma.subeDepartman.findMany({
      where: { id: { in: ids }, OR: [{ remove: null }, { remove: false }] },
      select: { id: true },
    });
    if (found.length !== ids.length) throw new UsersError('Şube bulunamadı');
    return ids;
  }

  const names = [
    ...(input.branches || []),
    ...(input.branch ? [input.branch] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  if (input.branchId != null && Number.isFinite(input.branchId)) {
    const hit = await prisma.subeDepartman.findFirst({
      where: { id: input.branchId, OR: [{ remove: null }, { remove: false }] },
      select: { id: true },
    });
    if (!hit) throw new UsersError('Şube bulunamadı');
    if (!names.length) return [hit.id];
  }

  if (!names.length) {
    if (input.branchId != null && Number.isFinite(input.branchId)) return [input.branchId];
    return [];
  }

  const all = await prisma.subeDepartman.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { id: true, adi: true },
  });
  const ids: number[] = [];
  for (const name of names) {
    const hit = all.find(
      (b) => b.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
    );
    if (!hit) throw new UsersError(`Şube listeden seçilmeli: ${name}`);
    if (!ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
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
  const allBranchIds = [
    ...new Set(rows.flatMap((r) => branchIdsOf(r))),
  ];

  const [roles, branches] = await Promise.all([
    roleIds.length
      ? prisma.rol.findMany({ where: { id: { in: roleIds } }, select: { id: true, adi: true } })
      : Promise.resolve([] as { id: number; adi: string }[]),
    allBranchIds.length
      ? prisma.subeDepartman.findMany({
          where: { id: { in: allBranchIds } },
          select: { id: true, adi: true },
        })
      : Promise.resolve([] as { id: number; adi: string }[]),
  ]);

  const roleMap = new Map(roles.map((r) => [r.id, r.adi]));
  const branchMap = new Map(branches.map((b) => [b.id, b.adi]));

  return rows.map((row) => {
    const ids = branchIdsOf(row);
    const names = ids.map((id) => branchMap.get(id) || '').filter(Boolean);
    return toPublic(row, row.rolId != null ? roleMap.get(row.rolId) || '' : '', names);
  });
}

export async function listBranches(): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.subeDepartman.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.adi }));
}

type UpsertBranches = {
  branch?: string;
  branches?: string[];
  branchId?: number | null;
  branchIds?: number[] | null;
};

export async function createPanelUser(input: {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  status?: UserStatus;
  installments?: number[];
  password?: string;
} & UpsertBranches): Promise<PublicPanelUser> {
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

  const subeIds = await resolveBranchIds(input);
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
      subeDepartmanId: subeIds[0] ?? null,
      subeDepartmanIds: encodeIdList(subeIds),
      izinliTaksitler: encodeInstallments(input.installments || []),
      remove: null,
    },
  });

  return toPublic(row, role.name, await branchNamesFor(subeIds));
}

export async function updatePanelUser(
  id: number,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    status?: UserStatus;
    installments?: number[];
    password?: string;
  } & UpsertBranches,
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
    subeDepartmanIds?: string | null;
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

  const branchTouched =
    input.branchIds !== undefined ||
    input.branchId !== undefined ||
    input.branch !== undefined ||
    input.branches !== undefined;
  if (branchTouched) {
    const subeIds = await resolveBranchIds(input);
    data.subeDepartmanId = subeIds[0] ?? null;
    data.subeDepartmanIds = encodeIdList(subeIds);
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
  const ids = branchIdsOf(row);
  return toPublic(row, role.name, await branchNamesFor(ids));
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
