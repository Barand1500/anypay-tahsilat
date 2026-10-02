import { prisma } from '../lib/prisma.js';
import { parseRolIzinler } from '../lib/phpSerialize.js';

const MODULE_ROUTE_PATTERN = /^(?:\/|\/[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)*)$/i;

export type PublicModule = {
  id: number;
  name: string;
  dbTable: string;
  urlPrefix: string;
  roles: string[];
  createdAt: string | null;
};

export class ModulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModulesError';
  }
}

function cleanModuleRoute(raw: string): string {
  const route = raw.trim();
  if (!MODULE_ROUTE_PATTERN.test(route)) {
    throw new ModulesError(
      'URL ön eki / ile başlamalı; boşluk, sorgu işareti, # veya art arda / içermemelidir',
    );
  }
  return route;
}

async function ensureRouteUnique(route: string, excludeId?: number) {
  const duplicate = await prisma.izinler.findFirst({
    where: {
      route,
      OR: [{ remove: null }, { remove: false }],
      ...(excludeId == null ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });
  if (duplicate) throw new ModulesError('Bu URL ön eki başka bir modülde kullanılıyor');
}

async function ensureTableExists(tableName: string) {
  const tables = await listTableOptions();
  if (!tables.some((name) => name.toLocaleLowerCase('tr') === tableName.toLocaleLowerCase('tr'))) {
    throw new ModulesError('Seçilen DB tablosu veritabanında bulunamadı');
  }
}

function toPublic(
  row: {
    id: number;
    adi: string;
    tablo: string | null;
    route: string | null;
    olusturmaTarihi: Date | null;
  },
  roles: string[],
): PublicModule {
  return {
    id: row.id,
    name: row.adi,
    dbTable: row.tablo || '',
    urlPrefix: row.route || '',
    roles,
    createdAt: row.olusturmaTarihi ? row.olusturmaTarihi.toISOString() : null,
  };
}

/** Modül id → görüntüleme yetkisi olan rol adları */
async function buildRoleIndex(): Promise<Map<number, string[]>> {
  const roles = await prisma.rol.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { adi: true, izinler: true },
  });

  const index = new Map<number, string[]>();
  for (const role of roles) {
    const perms = parseRolIzinler(role.izinler);
    for (const [moduleId, flags] of perms) {
      if (!flags.view) continue;
      const list = index.get(moduleId) ?? [];
      if (!list.includes(role.adi)) list.push(role.adi);
      index.set(moduleId, list);
    }
  }
  return index;
}

export async function listModules(): Promise<PublicModule[]> {
  const [rows, roleIndex] = await Promise.all([
    prisma.izinler.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      orderBy: [{ olusturmaTarihi: 'desc' }, { id: 'desc' }],
    }),
    buildRoleIndex(),
  ]);

  return rows.map((row) => toPublic(row, roleIndex.get(row.id) ?? []));
}

export async function createModule(input: {
  name: string;
  dbTable: string;
  urlPrefix: string;
}): Promise<PublicModule> {
  const name = input.name.trim();
  const dbTable = input.dbTable.trim();
  const urlPrefix = cleanModuleRoute(input.urlPrefix);
  if (!name) throw new ModulesError('Ad gerekli');
  if (!dbTable) throw new ModulesError('DB tablo gerekli');
  await Promise.all([ensureRouteUnique(urlPrefix), ensureTableExists(dbTable)]);

  const row = await prisma.izinler.create({
    data: {
      adi: name.slice(0, 255),
      tablo: dbTable.slice(0, 255),
      route: urlPrefix.slice(0, 255),
      olusturmaTarihi: new Date(),
      remove: null,
    },
  });

  return toPublic(row, []);
}

export async function updateModule(
  id: number,
  input: { name?: string; dbTable?: string; urlPrefix?: string },
): Promise<PublicModule> {
  const existing = await prisma.izinler.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new ModulesError('Modül bulunamadı');

  const data: { adi?: string; tablo?: string; route?: string } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ModulesError('Ad gerekli');
    data.adi = name.slice(0, 255);
  }
  if (input.dbTable !== undefined) {
    const dbTable = input.dbTable.trim();
    if (!dbTable) throw new ModulesError('DB tablo gerekli');
    await ensureTableExists(dbTable);
    data.tablo = dbTable.slice(0, 255);
  }
  if (input.urlPrefix !== undefined) {
    const urlPrefix = cleanModuleRoute(input.urlPrefix);
    await ensureRouteUnique(urlPrefix, id);
    data.route = urlPrefix.slice(0, 255);
  }

  const row = await prisma.izinler.update({ where: { id }, data });
  const roleIndex = await buildRoleIndex();
  return toPublic(row, roleIndex.get(row.id) ?? []);
}

export async function softDeleteModule(id: number): Promise<void> {
  const existing = await prisma.izinler.findFirst({
    where: { id, OR: [{ remove: null }, { remove: false }] },
  });
  if (!existing) throw new ModulesError('Modül bulunamadı');

  await prisma.izinler.update({
    where: { id },
    data: { remove: true },
  });
}

/** Bağlı MySQL veritabanındaki gerçek tablo adları. */
export async function listTableOptions(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME ASC
  `;
  return rows.map((row) => String(row.tableName)).filter(Boolean);
}
