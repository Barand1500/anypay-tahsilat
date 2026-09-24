import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type LogActionKind =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'other';

export type PublicLog = {
  id: number;
  userName: string;
  userEmail: string;
  at: string;
  kind: LogActionKind;
  actionLabel: string;
  detail: string;
};

export class LogsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogsError';
  }
}

export type ListLogsQuery = {
  q?: string;
  kind?: LogActionKind | 'all';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

/** Panel log yaz — hata login/CRUD’u bozmasın */
export async function writePanelLog(userId: number | null | undefined, islem: string) {
  const text = islem.trim();
  if (!text) return;
  try {
    await prisma.log.create({
      data: {
        kullaniciId: userId != null && Number.isFinite(userId) ? userId : null,
        tarih: new Date(),
        islem: text.slice(0, 65000),
      },
    });
  } catch (err) {
    console.error('Log yazılamadı', err);
  }
}

export function classifyIslem(islem: string | null | undefined): {
  kind: LogActionKind;
  actionLabel: string;
  detail: string;
} {
  const raw = (islem || '').trim();
  if (!raw) {
    return { kind: 'other', actionLabel: 'İşlem', detail: '—' };
  }

  const dash = raw.indexOf(' - ');
  const head = dash >= 0 ? raw.slice(0, dash).trim() : '';
  const tail = dash >= 0 ? raw.slice(dash + 3).trim() : raw;
  const lower = raw.toLocaleLowerCase('tr');

  let kind: LogActionKind = 'other';
  if (
    lower.includes('giriş') ||
    lower.includes('giris') ||
    lower.includes('login')
  ) {
    kind = 'login';
  } else if (lower.includes('çıkış') || lower.includes('cikis') || lower.includes('logout')) {
    kind = 'logout';
  } else if (
    lower.includes('sil') ||
    lower.includes('kaldır') ||
    lower.includes('kaldir')
  ) {
    kind = 'delete';
  } else if (
    lower.includes('ekle') ||
    lower.includes('oluştur') ||
    lower.includes('olustur')
  ) {
    kind = 'create';
  } else if (
    lower.includes('güncelle') ||
    lower.includes('guncelle') ||
    lower.includes('düzenle') ||
    lower.includes('duzenle')
  ) {
    kind = 'update';
  } else if (
    lower.includes('dışa aktar') ||
    lower.includes('disa aktar') ||
    lower.includes('export') ||
    lower.includes('csv') ||
    lower.includes('excel')
  ) {
    kind = 'export';
  }

  const actionLabel =
    head ||
    (kind === 'login'
      ? 'Giriş'
      : kind === 'logout'
        ? 'Çıkış'
        : kind === 'create'
          ? 'Ekleme'
          : kind === 'update'
            ? 'Güncelleme'
            : kind === 'delete'
              ? 'Silme'
              : kind === 'export'
                ? 'Dışa aktar'
                : 'İşlem');

  return { kind, actionLabel, detail: tail || raw };
}

function kindSqlFilter(kind: LogActionKind): Prisma.LogWhereInput {
  switch (kind) {
    case 'login':
      return {
        OR: [
          { islem: { contains: 'Giriş' } },
          { islem: { contains: 'giriş' } },
          { islem: { contains: 'Giris' } },
        ],
      };
    case 'logout':
      return {
        OR: [
          { islem: { contains: 'Çıkış' } },
          { islem: { contains: 'çıkış' } },
          { islem: { contains: 'Cikis' } },
        ],
      };
    case 'create':
      return {
        OR: [
          { islem: { contains: 'ekle' } },
          { islem: { contains: 'Ekle' } },
          { islem: { contains: 'oluştur' } },
          { islem: { contains: 'Oluştur' } },
        ],
      };
    case 'update':
      return {
        OR: [
          { islem: { contains: 'güncelle' } },
          { islem: { contains: 'Güncelle' } },
          { islem: { contains: 'düzenle' } },
          { islem: { contains: 'Düzenle' } },
        ],
      };
    case 'delete':
      return {
        OR: [
          { islem: { contains: 'Sil' } },
          { islem: { contains: 'sil' } },
          { islem: { contains: 'Kaldır' } },
        ],
      };
    case 'export':
      return {
        OR: [
          { islem: { contains: 'aktar' } },
          { islem: { contains: 'CSV' } },
          { islem: { contains: 'Excel' } },
          { islem: { contains: 'export' } },
        ],
      };
    case 'other':
      return {
        AND: [
          { NOT: { OR: [{ islem: { contains: 'Giriş' } }, { islem: { contains: 'giriş' } }] } },
          { NOT: { OR: [{ islem: { contains: 'Çıkış' } }, { islem: { contains: 'çıkış' } }] } },
          { NOT: { OR: [{ islem: { contains: 'Sil' } }, { islem: { contains: 'sil' } }] } },
          {
            NOT: {
              OR: [
                { islem: { contains: 'ekle' } },
                { islem: { contains: 'Ekle' } },
                { islem: { contains: 'güncelle' } },
                { islem: { contains: 'Güncelle' } },
              ],
            },
          },
        ],
      };
    default:
      return {};
  }
}

function parseDayStart(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEnd(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listLogs(query: ListLogsQuery): Promise<{ items: PublicLog[]; total: number }> {
  const pageSize = Math.min(50, Math.max(5, query.pageSize ?? 10));
  const page = Math.max(1, query.page ?? 1);
  const where: Prisma.LogWhereInput = {};

  const and: Prisma.LogWhereInput[] = [];

  if (query.from) {
    const from = parseDayStart(query.from);
    if (from) and.push({ tarih: { gte: from } });
  }
  if (query.to) {
    const to = parseDayEnd(query.to);
    if (to) and.push({ tarih: { lte: to } });
  }

  if (query.kind && query.kind !== 'all') {
    and.push(kindSqlFilter(query.kind));
  }

  const q = (query.q || '').trim();
  if (q) {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ email: { contains: q } }, { adsoyad: { contains: q } }],
      },
      select: { id: true },
      take: 200,
    });
    const searchOr: Prisma.LogWhereInput[] = [{ islem: { contains: q } }];
    if (users.length) {
      searchOr.push({ kullaniciId: { in: users.map((u) => u.id) } });
    }
    and.push({ OR: searchOr });
  }

  if (and.length) where.AND = and;

  const [total, rows] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.findMany({
      where,
      orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const userIds = [
    ...new Set(rows.map((r) => r.kullaniciId).filter((x): x is number => x != null)),
  ];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, adsoyad: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((row) => {
    const u = row.kullaniciId != null ? userMap.get(row.kullaniciId) : undefined;
    const parsed = classifyIslem(row.islem);
    return {
      id: row.id,
      userName: (u?.adsoyad || u?.email || 'Bilinmeyen').trim(),
      userEmail: u?.email || '',
      at: row.tarih.toISOString(),
      kind: parsed.kind,
      actionLabel: parsed.actionLabel,
      detail: parsed.detail,
    } satisfies PublicLog;
  });

  return { items, total };
}

export type DeleteLogsScope = 'day' | 'week' | 'month' | 'all' | 'range';

export async function deleteLogs(
  actorUserId: number,
  input: { scope: DeleteLogsScope; from?: string; to?: string },
): Promise<{ deleted: number; ids: number[] }> {
  const now = Date.now();
  let where: Prisma.LogWhereInput = {};

  if (input.scope === 'day') {
    where = { tarih: { gte: new Date(now - 86400000) } };
  } else if (input.scope === 'week') {
    where = { tarih: { gte: new Date(now - 7 * 86400000) } };
  } else if (input.scope === 'month') {
    where = { tarih: { gte: new Date(now - 30 * 86400000) } };
  } else if (input.scope === 'range') {
    const from = input.from ? parseDayStart(input.from) : null;
    const to = input.to ? parseDayEnd(input.to) : null;
    if (!from || !to) throw new LogsError('Geçerli tarih aralığı seçin');
    if (from.getTime() > to.getTime()) throw new LogsError('Başlangıç bitişten sonra olamaz');
    where = { tarih: { gte: from, lte: to } };
  } else if (input.scope === 'all') {
    where = {};
  } else {
    throw new LogsError('Geçersiz silme kapsamı');
  }

  const targets = await prisma.log.findMany({
    where,
    select: { id: true },
  });
  const ids = targets.map((t) => t.id);
  if (ids.length === 0) return { deleted: 0, ids: [] };

  await prisma.log.deleteMany({ where: { id: { in: ids } } });

  const label =
    input.scope === 'day'
      ? 'Log Kayıtları - Son 1 Gün Silindi'
      : input.scope === 'week'
        ? 'Log Kayıtları - Son 1 Hafta Silindi'
        : input.scope === 'month'
          ? 'Log Kayıtları - Son 1 Ay Silindi'
          : input.scope === 'range'
            ? `Log Kayıtları - ${input.from} / ${input.to} Aralığı Silindi`
            : 'Log Kayıtları - Tüm Kayıtları Sil';

  await writePanelLog(actorUserId, label);

  return { deleted: ids.length, ids };
}
