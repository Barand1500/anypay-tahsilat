import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { writePanelLog } from './logsService.js';

export type PublicResetTable = {
  id: number;
  module: string;
  /** Doctrine / panel adı (izinler.tablo) */
  table: string;
  /** Gerçek MySQL tablo adı */
  mysqlTable: string;
  rows: number;
  cleared: boolean;
};

export class SystemResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemResetError';
  }
}

/** Bu tablolar asla boşaltılamaz */
const DENY_ENTITIES = new Set([
  'user',
  'rol',
  'izinler',
  'log', // log silme ayrı sayfada
]);

const ENTITY_TO_MYSQL: Record<string, string> = {
  User: 'user',
  Log: 'log',
  LogKayitlari: 'log',
  Rol: 'rol',
  Izinler: 'izinler',
  Surumler: 'surumler',
  SubeDepartman: 'sube_departman',
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return secret;
}

function pascalToSnake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function isSafeIdent(name: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

async function tableExists(name: string): Promise<boolean> {
  if (!isSafeIdent(name)) return false;
  const rows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ${name}
  `;
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function resolveMysqlTable(entity: string): Promise<string | null> {
  const raw = entity.trim();
  if (!raw) return null;
  const candidates = [
    ENTITY_TO_MYSQL[raw],
    raw.toLowerCase(),
    pascalToSnake(raw),
  ].filter((x): x is string => Boolean(x));

  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    if (await tableExists(c)) return c;
  }
  return null;
}

async function countRows(mysqlTable: string): Promise<number> {
  if (!isSafeIdent(mysqlTable)) return 0;
  // Tablo adı whitelist’ten geldiği için güvenli
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint | number }>>(
    `SELECT COUNT(*) AS c FROM \`${mysqlTable}\``,
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listResetTables(): Promise<PublicResetTable[]> {
  const modules = await prisma.izinler.findMany({
    where: {
      AND: [
        { OR: [{ remove: null }, { remove: false }] },
        { tablo: { not: null } },
      ],
    },
    orderBy: [{ adi: 'asc' }, { id: 'asc' }],
    select: { id: true, adi: true, tablo: true },
  });

  const out: PublicResetTable[] = [];
  const seenMysql = new Set<string>();

  for (const m of modules) {
    const entity = (m.tablo || '').trim();
    if (!entity) continue;
    const mysqlTable = await resolveMysqlTable(entity);
    if (!mysqlTable) continue;
    if (DENY_ENTITIES.has(mysqlTable.toLowerCase())) continue;
    if (seenMysql.has(mysqlTable)) continue;
    seenMysql.add(mysqlTable);

    const rows = await countRows(mysqlTable);
    out.push({
      id: m.id,
      module: m.adi,
      table: entity,
      mysqlTable,
      rows,
      cleared: rows === 0,
    });
  }

  return out;
}

function sqlEscape(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 19).replace('T', ' ');
    return `'${iso}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }
  const s = String(value);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function dumpTable(mysqlTable: string): Promise<string> {
  if (!isSafeIdent(mysqlTable)) throw new SystemResetError('Geçersiz tablo');
  const cols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${mysqlTable}
    ORDER BY ORDINAL_POSITION
  `;
  if (!cols.length) return `-- ${mysqlTable}: kolon yok\n`;

  const colNames = cols.map((c) => c.COLUMN_NAME);
  const colList = colNames.map((c) => `\`${c}\``).join(', ');
  const data = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${mysqlTable}\``,
  );

  const lines: string[] = [
    ``,
    `-- ------------------------------------------------------------`,
    `-- ${mysqlTable} (${data.length} satır)`,
    `-- ------------------------------------------------------------`,
    `DELETE FROM \`${mysqlTable}\`;`,
  ];

  for (const row of data) {
    const vals = colNames.map((c) => sqlEscape(row[c])).join(', ');
    lines.push(`INSERT INTO \`${mysqlTable}\` (${colList}) VALUES (${vals});`);
  }
  return lines.join('\n') + '\n';
}

export function issueUnlockToken(userId: number): string {
  return jwt.sign(
    { purpose: 'system-reset-unlock', sub: userId },
    jwtSecret(),
    { expiresIn: '2h' },
  );
}

export function verifyUnlockToken(token: string, userId: number) {
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === 'string') throw new SystemResetError('Yedek anahtarı geçersiz');
    if (decoded.purpose !== 'system-reset-unlock') {
      throw new SystemResetError('Yedek anahtarı geçersiz');
    }
    if (Number(decoded.sub) !== userId) {
      throw new SystemResetError('Yedek anahtarı bu oturuma ait değil');
    }
  } catch (err) {
    if (err instanceof SystemResetError) throw err;
    throw new SystemResetError('Yedek alınmamış veya anahtar süresi dolmuş');
  }
}

export async function buildBackupSql(userId: number): Promise<{
  sql: string;
  fileName: string;
  unlockToken: string;
}> {
  const tables = await listResetTables();
  const header = [
    `-- AnyPay Tahsilat yedek`,
    `-- ${new Date().toISOString()}`,
    `-- Kullanıcı #${userId}`,
    `SET NAMES utf8mb4;`,
    `SET FOREIGN_KEY_CHECKS=0;`,
    ``,
  ].join('\n');

  const parts: string[] = [header];
  for (const t of tables) {
    parts.push(await dumpTable(t.mysqlTable));
  }
  parts.push(`SET FOREIGN_KEY_CHECKS=1;\n`);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return {
    sql: parts.join('\n'),
    fileName: `anypay-yedek-${stamp}.sql`,
    unlockToken: issueUnlockToken(userId),
  };
}

export async function clearResetTable(
  userId: number,
  moduleId: number,
  unlockToken: string,
): Promise<PublicResetTable> {
  verifyUnlockToken(unlockToken, userId);

  const mod = await prisma.izinler.findFirst({
    where: {
      id: moduleId,
      OR: [{ remove: null }, { remove: false }],
    },
    select: { id: true, adi: true, tablo: true },
  });
  if (!mod?.tablo) throw new SystemResetError('Modül bulunamadı');

  const mysqlTable = await resolveMysqlTable(mod.tablo);
  if (!mysqlTable) throw new SystemResetError('Tablo çözülemedi');
  if (DENY_ENTITIES.has(mysqlTable.toLowerCase())) {
    throw new SystemResetError('Bu tablo güvenlik nedeniyle sıfırlanamaz');
  }
  if (!isSafeIdent(mysqlTable)) throw new SystemResetError('Geçersiz tablo');

  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0`);
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${mysqlTable}\``);
  } finally {
    await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1`);
  }

  await writePanelLog(
    userId,
    `Sistem Sıfırlama - ${mod.adi} (${mysqlTable}) tablosu boşaltıldı.`,
  );

  const rows = await countRows(mysqlTable);
  return {
    id: mod.id,
    module: mod.adi,
    table: mod.tablo,
    mysqlTable,
    rows,
    cleared: rows === 0,
  };
}
