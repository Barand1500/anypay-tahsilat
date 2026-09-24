import { prisma } from '../lib/prisma.js';
import { parseRolIzinler } from '../lib/phpSerialize.js';

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
  const urlPrefix = input.urlPrefix.trim();
  if (!name) throw new ModulesError('Ad gerekli');
  if (!dbTable) throw new ModulesError('DB tablo gerekli');
  if (!urlPrefix) throw new ModulesError('URL ön eki gerekli');

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
    data.tablo = dbTable.slice(0, 255);
  }
  if (input.urlPrefix !== undefined) {
    const urlPrefix = input.urlPrefix.trim();
    if (!urlPrefix) throw new ModulesError('URL ön eki gerekli');
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

/** Distinct tablo adları — select için */
export async function listTableOptions(): Promise<string[]> {
  const rows = await prisma.izinler.findMany({
    where: {
      tablo: { not: null },
      OR: [{ remove: null }, { remove: false }],
    },
    select: { tablo: true },
    distinct: ['tablo'],
    orderBy: { tablo: 'asc' },
  });
  return rows.map((r) => r.tablo!).filter(Boolean);
}
