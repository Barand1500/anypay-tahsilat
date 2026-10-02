import { prisma } from '../lib/prisma.js';
import {
  flagsToPagePerm,
  pagePermToFlags,
  parseRolIzinler,
  serializeRolIzinler,
  type ModulePermFlags,
} from '../lib/phpSerialize.js';

export type PagePermDto = {
  view: boolean;
  save: boolean;
  remove: boolean;
};

export type RoleUserDto = {
  id: number;
  initials: string;
  name: string;
};

export type PublicRole = {
  id: number;
  name: string;
  code: string;
  isAdmin: boolean;
  /** moduleId (izinler.id string) → izin */
  permissions: Record<string, PagePermDto>;
  users: RoleUserDto[];
};

export class RolesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RolesError';
  }
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function slugCode(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/gi, 'g')
    .replace(/ü/gi, 'u')
    .replace(/ş/gi, 's')
    .replace(/ı/gi, 'i')
    .replace(/ö/gi, 'o')
    .replace(/ç/gi, 'c')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return `ROLE_${base || 'YENI'}`;
}

type ActiveModule = { id: number; route: string | null };

async function activeModules(): Promise<ActiveModule[]> {
  return prisma.izinler.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { id: true, route: true },
    orderBy: { id: 'asc' },
  });
}

function canonicalRoute(raw: string | null): string {
  const route = (raw || '').replace(/\/+$/, '') || '/';
  const aliases: Array<[string, string]> = [
    ['/tanimlamalar/bankalar/sanal-pos-tanimlari', '/tanimlamalar/pos-kart/sanal-pos'],
    ['/tanimlamalar/bankalar/ortak-sanalpos', '/tanimlamalar/pos-kart/ortak-sanal-pos'],
    ['/tanimlamalar/bankalar/kart-anlasmalari', '/tanimlamalar/pos-kart/anlasmalar'],
    ['/tanimlamalar/bankalar/kart-tipleri', '/tanimlamalar/pos-kart/tipler'],
    ['/tanimlamalar/bankalar/kart-turleri', '/tanimlamalar/pos-kart/turler'],
    ['/tanimlamalar/bankalar/kart-markalari', '/tanimlamalar/pos-kart/markalar'],
  ];
  for (const [legacy, modern] of aliases) {
    if (route === legacy || route.startsWith(`${legacy}/`)) return route.replace(legacy, modern);
  }
  return route;
}

/** Bir alt sayfa açıldığında mevcut üst modül kayıtlarının görüntüleme iznini de açar. */
function withParentViews(
  permissions: Record<string, PagePermDto> | undefined,
  modules: ActiveModule[],
): Record<string, PagePermDto> | undefined {
  if (!permissions) return permissions;
  const next = Object.fromEntries(
    Object.entries(permissions).map(([id, value]) => [id, { ...value }]),
  );
  const selected = modules.filter((module) => next[String(module.id)]?.view);
  for (const child of selected) {
    const childRoute = canonicalRoute(child.route);
    for (const parent of modules) {
      const parentRoute = canonicalRoute(parent.route);
      if (parentRoute === '/' || parentRoute === childRoute) continue;
      if (childRoute.startsWith(`${parentRoute}/`)) {
        const id = String(parent.id);
        next[id] = { ...(next[id] ?? { view: false, save: false, remove: false }), view: true };
      }
    }
  }
  return next;
}

function permsFromSerialized(
  raw: string | null,
  moduleIds: number[],
): Record<string, PagePermDto> {
  const parsed = parseRolIzinler(raw);
  const out: Record<string, PagePermDto> = {};
  for (const id of moduleIds) {
    const f = parsed.get(id) ?? { view: false, edit: false, create: false };
    out[String(id)] = flagsToPagePerm(f);
  }
  return out;
}

function buildSerializePayload(
  permissions: Record<string, PagePermDto> | undefined,
  moduleIds: number[],
  isAdmin: boolean,
): string {
  const map = new Map<number, ModulePermFlags>();
  for (const id of moduleIds) {
    if (isAdmin) {
      map.set(id, { view: true, edit: true, create: true });
      continue;
    }
    const p = permissions?.[String(id)] ?? { view: false, save: false, remove: false };
    const normalized = !p.view
      ? { view: false, save: false, remove: false }
      : p;
    map.set(id, pagePermToFlags(normalized));
  }
  return serializeRolIzinler(map);
}

async function usersForRole(rolId: number): Promise<RoleUserDto[]> {
  const users = await prisma.user.findMany({
    where: {
      rolId,
      OR: [{ remove: null }, { remove: false }],
    },
    select: { id: true, adsoyad: true, email: true },
    take: 24,
    orderBy: { id: 'asc' },
  });
  return users.map((u) => {
    const name = (u.adsoyad || u.email || 'Kullanıcı').trim();
    return { id: u.id, name, initials: initialsOf(name) };
  });
}

function deriveIsAdmin(row: { yetki: number | null; code: string }): boolean {
  if (row.yetki === 1) return true;
  const c = row.code.toUpperCase();
  return (
    c === 'ROLE_YONETICI' ||
    c === 'ROLE_ADMIN' ||
    c === 'ROLE_SUPERAPP' ||
    c.includes('SUPERAPP')
  );
}

async function toPublic(row: {
  id: number;
  adi: string;
  code: string;
  yetki: number | null;
  izinler: string | null;
}): Promise<PublicRole> {
  const modules = await activeModules();
  const moduleIds = modules.map((module) => module.id);
  const isAdmin = deriveIsAdmin(row);
  return {
    id: row.id,
    name: row.adi,
    code: row.code,
    isAdmin,
    permissions: isAdmin
      ? Object.fromEntries(
          moduleIds.map((id) => [String(id), { view: true, save: true, remove: true }]),
        )
      : permsFromSerialized(row.izinler, moduleIds),
    users: await usersForRole(row.id),
  };
}

export async function listRoles(): Promise<PublicRole[]> {
  const rows = await prisma.rol.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    orderBy: { id: 'asc' },
  });
  const out: PublicRole[] = [];
  for (const row of rows) {
    out.push(await toPublic(row));
  }
  return out;
}

export async function createRole(input: {
  name: string;
  isAdmin?: boolean;
  permissions?: Record<string, PagePermDto>;
  code?: string;
}): Promise<PublicRole> {
  const name = input.name.trim();
  if (!name) throw new RolesError('Rol adı gerekli');

  const isAdmin = Boolean(input.isAdmin);
  const modules = await activeModules();
  const moduleIds = modules.map((module) => module.id);
  let code = (input.code || slugCode(name)).trim().toUpperCase();
  if (!code.startsWith('ROLE_')) code = `ROLE_${code}`;

  const clash = await prisma.rol.findFirst({ where: { code } });
  if (clash) {
    code = `${code}_${Date.now().toString(36).toUpperCase()}`;
  }

  const row = await prisma.rol.create({
    data: {
      adi: name.slice(0, 255),
      code: code.slice(0, 255),
      remove: null,
      yetki: isAdmin ? 1 : null,
      izinler: buildSerializePayload(withParentViews(input.permissions, modules), moduleIds, isAdmin),
    },
  });

  return toPublic(row);
}

export async function updateRole(
  id: number,
  input: {
    name?: string;
    isAdmin?: boolean;
    permissions?: Record<string, PagePermDto>;
  },
): Promise<PublicRole> {
  const existing = await prisma.rol.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new RolesError('Rol bulunamadı');

  const modules = await activeModules();
  const moduleIds = modules.map((module) => module.id);
  const isAdmin =
    input.isAdmin !== undefined ? Boolean(input.isAdmin) : deriveIsAdmin(existing);
  const name = input.name !== undefined ? input.name.trim() : existing.adi;
  if (!name) throw new RolesError('Rol adı gerekli');

  const data: {
    adi: string;
    yetki: number | null;
    izinler?: string;
  } = {
    adi: name.slice(0, 255),
    yetki: isAdmin ? 1 : null,
  };

  if (isAdmin) {
    data.izinler = buildSerializePayload(undefined, moduleIds, true);
  } else if (input.permissions) {
    data.izinler = buildSerializePayload(withParentViews(input.permissions, modules), moduleIds, false);
  } else if (input.isAdmin === false) {
    // Yönetici bayrağı kapatıldı, matris yoksa sıfırla
    data.izinler = buildSerializePayload({}, moduleIds, false);
  }

  const row = await prisma.rol.update({
    where: { id },
    data,
  });

  return toPublic(row);
}

export async function softDeleteRole(id: number): Promise<void> {
  const existing = await prisma.rol.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new RolesError('Rol bulunamadı');

  const linked = await prisma.user.count({
    where: {
      rolId: id,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (linked > 0) {
    throw new RolesError(`Bu role bağlı ${linked} kullanıcı var — önce kullanıcıları taşıyın`);
  }

  await prisma.rol.update({
    where: { id },
    data: { remove: true },
  });
}
