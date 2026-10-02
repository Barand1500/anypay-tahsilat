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

function splitBackupStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '`' | null = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]!;
    if (quote === "'") {
      current += char;
      if (char === '\\' && i + 1 < sql.length) {
        current += sql[++i]!;
      } else if (char === "'" && sql[i + 1] === "'") {
        current += sql[++i]!;
      } else if (char === "'") {
        quote = null;
      }
      continue;
    }
    if (quote === '`') {
      current += char;
      if (char === '`' && sql[i + 1] === '`') current += sql[++i]!;
      else if (char === '`') quote = null;
      continue;
    }
    if (!current.trim() && char === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (char === "'") quote = "'";
    else if (char === '`') quote = '`';
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (quote) throw new SystemResetError('Yedek dosyasındaki SQL metni tamamlanmamış');
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function splitSqlValues(raw: string): string[] {
  const values: string[] = [];
  let current = '';
  let quote = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    current += char;
    if (quote) {
      if (char === '\\' && i + 1 < raw.length) current += raw[++i]!;
      else if (char === "'" && raw[i + 1] === "'") current += raw[++i]!;
      else if (char === "'") quote = false;
    } else if (char === "'") {
      quote = true;
    } else if (char === ',') {
      values.push(current.slice(0, -1).trim());
      current = '';
    }
  }
  if (quote) throw new SystemResetError('Yedek dosyasında geçersiz metin değeri');
  if (current.trim()) values.push(current.trim());
  return values;
}

function parseSqlValue(rawValue: string): string | null | Buffer {
  const value = rawValue.trim();
  if (/^NULL$/i.test(value)) return null;
  const binary = /^X'([\da-f]*)'$/i.exec(value);
  if (binary) return Buffer.from(binary[1]!, 'hex');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return value;
  if (!value.startsWith("'") || !value.endsWith("'")) {
    throw new SystemResetError('Yedek dosyasında desteklenmeyen SQL değeri var');
  }

  let decoded = '';
  for (let i = 1; i < value.length - 1; i++) {
    const char = value[i]!;
    if (char === '\\') {
      const next = value[++i];
      if (next !== '\\' && next !== "'") {
        throw new SystemResetError('Yedek dosyasında geçersiz kaçış karakteri var');
      }
      decoded += next;
    } else if (char === "'" && value[i + 1] === "'") {
      decoded += "'";
      i++;
    } else if (char === "'") {
      throw new SystemResetError('Yedek dosyasında geçersiz metin değeri');
    } else {
      decoded += char;
    }
  }
  return decoded;
}

type RestoreInsert = { table: string; columns: string[]; values: (string | null | Buffer)[] };

/** Yalnızca panelin ürettiği yedek biçimindeki DELETE/INSERT verilerini geri yükler. */
export async function restoreBackupSql(userId: number, sql: string): Promise<{ tables: number; rows: number }> {
  if (Buffer.byteLength(sql, 'utf8') > 50 * 1024 * 1024) {
    throw new SystemResetError('Yedek dosyası 50 MB sınırını aşıyor');
  }
  sql = sql.replace(/^\uFEFF/, '');
  if (!sql.trimStart().startsWith('-- AnyPay Tahsilat yedek')) {
    throw new SystemResetError('Bu dosya AnyPay veritabanı yedeği olarak tanınmadı');
  }

  const allowedTables = new Set((await listResetTables()).map((table) => table.mysqlTable));
  const deletes = new Set<string>();
  const inserts: RestoreInsert[] = [];
  for (const statement of splitBackupStatements(sql)) {
    if (/^SET\s+NAMES\s+utf8mb4$/i.test(statement)) continue;
    if (/^SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01]$/i.test(statement)) continue;

    const deletion = /^DELETE\s+FROM\s+`([A-Za-z0-9_]+)`$/i.exec(statement);
    if (deletion) {
      const table = deletion[1]!;
      if (!allowedTables.has(table) || DENY_ENTITIES.has(table.toLowerCase())) {
        throw new SystemResetError(`Yedekte izin verilmeyen tablo var: ${table}`);
      }
      if (deletes.has(table)) throw new SystemResetError(`Yedekte yinelenen tablo var: ${table}`);
      deletes.add(table);
      continue;
    }

    const insertion = /^INSERT\s+INTO\s+`([A-Za-z0-9_]+)`\s*\(([^)]+)\)\s+VALUES\s*\((.*)\)$/is.exec(statement);
    if (!insertion) throw new SystemResetError('Yedek dosyasında desteklenmeyen SQL komutu var');
    const table = insertion[1]!;
    if (!allowedTables.has(table) || DENY_ENTITIES.has(table.toLowerCase())) {
      throw new SystemResetError(`Yedekte izin verilmeyen tablo var: ${table}`);
    }
    const columns = insertion[2]!
      .split(',')
      .map((column) => /^\s*`([A-Za-z0-9_]+)`\s*$/.exec(column)?.[1] || '');
    if (!columns.length || columns.some((column) => !column) || new Set(columns).size !== columns.length) {
      throw new SystemResetError(`Yedekte geçersiz sütun listesi var: ${table}`);
    }
    const rawValues = splitSqlValues(insertion[3]!);
    if (rawValues.length !== columns.length) {
      throw new SystemResetError(`Yedekte sütun ve değer sayısı uyuşmuyor: ${table}`);
    }
    inserts.push({ table, columns, values: rawValues.map(parseSqlValue) });
  }

  if (deletes.size === 0) throw new SystemResetError('Yedek dosyasında geri yüklenecek tablo bulunamadı');
  for (const row of inserts) {
    if (!deletes.has(row.table)) throw new SystemResetError(`Yedekte ${row.table} tablosunun boşaltma kaydı yok`);
  }

  const tableColumns = new Map<string, Set<string>>();
  for (const table of deletes) {
    const columns = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ${table}
    `;
    tableColumns.set(table, new Set(columns.map((column) => column.COLUMN_NAME)));
  }
  for (const row of inserts) {
    const actual = tableColumns.get(row.table)!;
    if (row.columns.some((column) => !actual.has(column))) {
      throw new SystemResetError(`Yedek ${row.table} tablosunda artık bulunmayan bir sütun içeriyor`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
    try {
      for (const table of deletes) {
        await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
      }
      for (const row of inserts) {
        const columns = row.columns.map((column) => `\`${column}\``).join(', ');
        const placeholders = row.values.map(() => '?').join(', ');
        await tx.$executeRawUnsafe(
          `INSERT INTO \`${row.table}\` (${columns}) VALUES (${placeholders})`,
          ...row.values,
        );
      }
    } finally {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
    }
  });

  await writePanelLog(userId, `Sistem Sıfırlama - Veritabanı yedeği geri yüklendi (${deletes.size} tablo, ${inserts.length} satır).`);
  return { tables: deletes.size, rows: inserts.length };
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
