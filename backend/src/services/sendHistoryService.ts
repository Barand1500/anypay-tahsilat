import { prisma } from '../lib/prisma.js';

export type SendType = 'email' | 'sms';

export type RecordSendInput = {
  musteriId?: number | null;
  type: SendType;
  recipient: string;
  content: string;
  kaynak?: string;
  refId?: number | null;
  basarili?: boolean;
};

export type SendHistoryQuery = {
  from?: string | null;
  to?: string | null;
  type?: SendType | null;
  customerId?: number | null;
  q?: string | null;
};

export type SendHistoryRow = {
  id: number;
  customerId: string | null;
  customerTitle: string;
  type: SendType;
  recipient: string;
  content: string;
  sentAt: string;
};

export type SendHistoryPayload = {
  rows: SendHistoryRow[];
  totalCount: number;
  filters: {
    customers: { value: string; label: string }[];
  };
};

function parseDay(key: string | null | undefined): Date | null {
  if (!key?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function clipContent(raw: string): string {
  const t = (raw || '').trim();
  if (t.length <= 4000) return t;
  return `${t.slice(0, 4000)}…`;
}

/** Gönderim kaydı — mail/SMS sonrası (hata yutmaz, log’a yazar) */
export async function recordSendHistory(input: RecordSendInput): Promise<void> {
  const recipient = (input.recipient || '').trim().slice(0, 255);
  if (!recipient) return;
  try {
    await prisma.gonderimGecmisi.create({
      data: {
        musteriId: input.musteriId ?? null,
        tip: input.type,
        alici: recipient,
        icerik: clipContent(input.content || ''),
        tarih: new Date(),
        kaynak: (input.kaynak || '').slice(0, 64) || null,
        refId: input.refId ?? null,
        basarili: input.basarili !== false,
      },
    });
  } catch (err) {
    console.warn('[send-history] kayıt yazılamadı:', err);
  }
}

export async function getSendHistory(q: SendHistoryQuery): Promise<SendHistoryPayload> {
  const from = parseDay(q.from);
  const toDay = parseDay(q.to);
  const to = toDay ? endOfDay(toDay) : null;

  const where: Record<string, unknown> = { basarili: true };
  if (q.type === 'email' || q.type === 'sms') where.tip = q.type;
  if (q.customerId != null) where.musteriId = q.customerId;
  if (from || to) {
    where.tarih = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const qText = (q.q || '').trim().toLocaleLowerCase('tr');

  const [rows, customers] = await Promise.all([
    prisma.gonderimGecmisi.findMany({
      where,
      orderBy: { tarih: 'desc' },
      take: 2000,
    }),
    prisma.musteri.findMany({
      where: { OR: [{ remove: null }, { remove: false }] },
      select: { id: true, unvan: true },
      orderBy: { unvan: 'asc' },
      take: 5000,
    }),
  ]);

  const customerMap = new Map(
    customers.map((c) => [c.id, (c.unvan || '').trim() || `Müşteri #${c.id}`]),
  );

  let mapped: SendHistoryRow[] = rows.map((r) => {
    const type: SendType = r.tip === 'sms' ? 'sms' : 'email';
    const title =
      r.musteriId != null
        ? customerMap.get(r.musteriId) || `Müşteri #${r.musteriId}`
        : r.kaynak === 'sistem'
          ? 'Sistem bildirimi'
          : '—';
    return {
      id: r.id,
      customerId: r.musteriId != null ? String(r.musteriId) : null,
      customerTitle: title,
      type,
      recipient: r.alici,
      content: (r.icerik || '').trim(),
      sentAt: r.tarih.toISOString(),
    };
  });

  if (qText) {
    mapped = mapped.filter((r) => {
      const hay =
        `${r.id} ${r.customerTitle} ${r.type} ${r.recipient} ${r.content}`.toLocaleLowerCase('tr');
      return hay.includes(qText);
    });
  }

  return {
    rows: mapped,
    totalCount: mapped.length,
    filters: {
      customers: customers.map((c) => ({
        value: String(c.id),
        label: (c.unvan || '').trim() || `Müşteri #${c.id}`,
      })),
    },
  };
}
