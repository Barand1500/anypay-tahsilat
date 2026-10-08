import { prisma } from '../lib/prisma.js';
import { getOrCreateAyarlarRow, SettingsError } from './settingsService.js';

export type ReminderSettings = {
  active: boolean;
  /** Oluşturulduktan kaç gün sonra hatırlat (örn. 1, 3, 7) */
  days: number[];
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
};

export type ReminderRunSummary = {
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
};

type SentMap = Record<string, string>;

const DEFAULT: ReminderSettings = {
  active: false,
  days: [1, 3, 7],
  email: true,
  sms: true,
  whatsapp: false,
};

function parseSettings(raw: string | null | undefined): ReminderSettings {
  if (!raw?.trim()) return { ...DEFAULT, days: [...DEFAULT.days] };
  try {
    const p = JSON.parse(raw) as Partial<ReminderSettings>;
    const days = Array.isArray(p.days)
      ? [...new Set(p.days.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d >= 1 && d <= 90))]
          .sort((a, b) => a - b)
          .slice(0, 8)
      : [...DEFAULT.days];
    return {
      active: Boolean(p.active),
      days: days.length ? days : [...DEFAULT.days],
      email: p.email !== false,
      sms: Boolean(p.sms),
      whatsapp: Boolean(p.whatsapp),
    };
  } catch {
    return { ...DEFAULT, days: [...DEFAULT.days] };
  }
}

function parseSent(raw: string | null | undefined): SentMap {
  if (!raw?.trim()) return {};
  try {
    const p = JSON.parse(raw) as SentMap;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function ageDays(from: Date, now: Date): number {
  const ms = now.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const row = await getOrCreateAyarlarRow();
  return parseSettings(row.odemeHatirlatma);
}

export async function updateReminderSettings(input: ReminderSettings): Promise<ReminderSettings> {
  const days = [...new Set(input.days.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d >= 1 && d <= 90))]
    .sort((a, b) => a - b)
    .slice(0, 8);
  if (!days.length) throw new SettingsError('En az bir gün seçin (1–90)');
  if (!input.email && !input.sms && !input.whatsapp) {
    throw new SettingsError('En az bir kanal seçin');
  }
  const next: ReminderSettings = {
    active: Boolean(input.active),
    days,
    email: Boolean(input.email),
    sms: Boolean(input.sms),
    whatsapp: Boolean(input.whatsapp),
  };
  const row = await getOrCreateAyarlarRow();
  await prisma.ayarlar.update({
    where: { id: row.id },
    data: { odemeHatirlatma: JSON.stringify(next) },
  });
  return next;
}

/** Bekleyen isteklere gün bazlı otomatik hatırlatma */
export async function processPaymentReminders(): Promise<ReminderRunSummary> {
  const settings = await getReminderSettings();
  const summary: ReminderRunSummary = { checked: 0, sent: 0, skipped: 0, errors: 0 };
  if (!settings.active || !settings.days.length) return summary;

  const now = new Date();
  const rows = await prisma.odemeIstegi.findMany({
    where: {
      durum: false,
      OR: [{ remove: null }, { remove: false }],
    },
    select: {
      id: true,
      tarih: true,
      istekNo: true,
      tutar: true,
      hatirlatmaDurum: true,
      musteriId: true,
    },
    take: 400,
    orderBy: { tarih: 'asc' },
  });

  const { emailPaymentRequest, smsPaymentRequest, whatsappPaymentRequest } =
    await import('./paymentRequestsService.js');

  for (const row of rows) {
    summary.checked += 1;
    const age = ageDays(row.tarih, now);
    const sent = parseSent(row.hatirlatmaDurum);
    const due = settings.days.filter((d) => age >= d && !sent[String(d)]);
    if (!due.length) {
      summary.skipped += 1;
      continue;
    }

    // En küçük gecikmiş günü bir kez işle (spam olmasın)
    const day = Math.min(...due);
    let anyOk = false;

    if (settings.email) {
      try {
        const r = await emailPaymentRequest(row.id);
        if (r.emailSent) anyOk = true;
      } catch (err) {
        console.warn('[reminder-email]', row.id, err);
        summary.errors += 1;
      }
    }
    if (settings.sms) {
      try {
        const r = await smsPaymentRequest(row.id);
        if (r.smsSent) anyOk = true;
      } catch (err) {
        console.warn('[reminder-sms]', row.id, err);
        summary.errors += 1;
      }
    }
    if (settings.whatsapp) {
      try {
        const r = await whatsappPaymentRequest(row.id);
        if (r.method === 'api' && r.whatsappSent) anyOk = true;
        // wa.me istemci — otomatik job’da kullanılamaz
      } catch (err) {
        console.warn('[reminder-whatsapp]', row.id, err);
        summary.errors += 1;
      }
    }

    // Gün işaretlenir (tekrar denemek için hata olsa da — sonsuz döngüyü kes)
    sent[String(day)] = now.toISOString();
    try {
      await prisma.odemeIstegi.update({
        where: { id: row.id },
        data: { hatirlatmaDurum: JSON.stringify(sent) },
      });
    } catch (err) {
      console.warn('[reminder-mark]', row.id, err);
    }

    if (anyOk) summary.sent += 1;
    else summary.skipped += 1;
  }

  return summary;
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

/** Uygulama açılışında saatlik tarama */
export function startPaymentReminderScheduler(): void {
  if (reminderTimer) return;
  const tick = () => {
    void processPaymentReminders()
      .then((s) => {
        if (s.sent > 0 || s.errors > 0) {
          console.log('[reminder]', s);
        }
      })
      .catch((err) => console.warn('[reminder] tick failed', err));
  };
  // İlk tarama 45 sn sonra, sonra her saat
  setTimeout(tick, 45_000);
  reminderTimer = setInterval(tick, 60 * 60 * 1000);
}
