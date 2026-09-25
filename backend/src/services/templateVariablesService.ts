import { prisma } from '../lib/prisma.js';
import {
  phpSerializeAssoc,
  phpUnserializeAssoc,
  stripHashKey,
  withHashKey,
} from '../lib/phpSerialize.js';
import { SettingsError } from './settingsService.js';

export type PublicTemplateVarPair = {
  dbColumn: string;
  key: string;
};

export type PublicTemplateVariable = {
  id: string;
  displayId: number;
  name: string;
  moduleId: string;
  module: string;
  type: 'email' | 'sms';
  code: string | null;
  variables: PublicTemplateVarPair[];
};

export type ModuleOption = { id: string; label: string };

function parseVars(raw: string | null): PublicTemplateVarPair[] {
  const assoc = phpUnserializeAssoc(raw);
  return Object.entries(assoc).map(([hashKey, dbColumn]) => ({
    key: stripHashKey(hashKey),
    dbColumn: dbColumn === '-' ? '-' : dbColumn,
  }));
}

function encodeVars(list: PublicTemplateVarPair[]): string {
  const map: Record<string, string> = {};
  for (const p of list) {
    const k = withHashKey(p.key);
    if (!k) continue;
    map[k] = (p.dbColumn || '-').trim() || '-';
  }
  return phpSerializeAssoc(map);
}

export async function listModules(): Promise<ModuleOption[]> {
  const rows = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`izinler\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map((r) => ({ id: String(r.id), label: r.adi }));
}

export async function listTemplateVariables(): Promise<PublicTemplateVariable[]> {
  const rows = await prisma.$queryRaw<
    {
      id: number;
      modul_id: number;
      adi: string;
      degiskenler: string;
      tip: number;
      kodu: string | null;
      modul_adi: string | null;
    }[]
  >`
    SELECT e.\`id\`, e.\`modul_id\`, e.\`adi\`, e.\`degiskenler\`, e.\`tip\`, e.\`kodu\`,
           i.\`adi\` AS modul_adi
    FROM \`essablonlar\` e
    LEFT JOIN \`izinler\` i ON i.\`id\` = e.\`modul_id\`
    WHERE e.\`remove\` IS NULL OR e.\`remove\` = 0
    ORDER BY e.\`id\` ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    displayId: r.id,
    name: r.adi,
    moduleId: String(r.modul_id),
    module: r.modul_adi || `Modül #${r.modul_id}`,
    type: r.tip === 1 ? 'sms' : 'email',
    code: r.kodu,
    variables: parseVars(r.degiskenler),
  }));
}

export async function createTemplateVariable(input: {
  name: string;
  moduleId: string;
  type: 'email' | 'sms';
  variables: PublicTemplateVarPair[];
  code?: string | null;
}): Promise<PublicTemplateVariable> {
  const name = input.name.trim();
  const moduleId = Number(input.moduleId);
  if (!name) throw new SettingsError('Ad gerekli');
  if (!Number.isFinite(moduleId)) throw new SettingsError('Modül seçin');
  if (!input.variables?.length) throw new SettingsError('En az bir değişken girin');

  const tip = input.type === 'sms' ? 1 : 0;
  const degiskenler = encodeVars(input.variables);
  const kodu = input.code?.trim() || null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`essablonlar\` (\`modul_id\`, \`adi\`, \`degiskenler\`, \`remove\`, \`tip\`, \`kodu\`)
     VALUES (?, ?, ?, 0, ?, ?)`,
    moduleId,
    name.slice(0, 255),
    degiskenler,
    tip,
    kodu,
  );
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`essablonlar\` ORDER BY \`id\` DESC LIMIT 1
  `;
  const id = rows[0]!.id;
  const modules = await listModules();
  const mod = modules.find((m) => m.id === String(moduleId));
  return {
    id: String(id),
    displayId: id,
    name: name.slice(0, 255),
    moduleId: String(moduleId),
    module: mod?.label || `Modül #${moduleId}`,
    type: input.type,
    code: kodu,
    variables: input.variables,
  };
}

export async function updateTemplateVariable(
  id: number,
  input: {
    name: string;
    moduleId: string;
    type: 'email' | 'sms';
    variables: PublicTemplateVarPair[];
    code?: string | null;
  },
): Promise<PublicTemplateVariable> {
  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`essablonlar\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!existing[0]) throw new SettingsError('Kayıt bulunamadı');

  const name = input.name.trim();
  const moduleId = Number(input.moduleId);
  if (!name) throw new SettingsError('Ad gerekli');
  if (!Number.isFinite(moduleId)) throw new SettingsError('Modül seçin');
  if (!input.variables?.length) throw new SettingsError('En az bir değişken girin');

  const tip = input.type === 'sms' ? 1 : 0;
  const degiskenler = encodeVars(input.variables);
  const kodu = input.code?.trim() || null;

  await prisma.$executeRawUnsafe(
    `UPDATE \`essablonlar\` SET \`modul_id\` = ?, \`adi\` = ?, \`degiskenler\` = ?, \`tip\` = ?, \`kodu\` = ?
     WHERE \`id\` = ?`,
    moduleId,
    name.slice(0, 255),
    degiskenler,
    tip,
    kodu,
    id,
  );

  const modules = await listModules();
  const mod = modules.find((m) => m.id === String(moduleId));
  return {
    id: String(id),
    displayId: id,
    name: name.slice(0, 255),
    moduleId: String(moduleId),
    module: mod?.label || `Modül #${moduleId}`,
    type: input.type,
    code: kodu,
    variables: input.variables,
  };
}

export async function softDeleteTemplateVariable(id: number): Promise<void> {
  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`essablonlar\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!existing[0]) throw new SettingsError('Kayıt bulunamadı');
  await prisma.$executeRawUnsafe(
    `UPDATE \`essablonlar\` SET \`remove\` = 1 WHERE \`id\` = ?`,
    id,
  );
}
