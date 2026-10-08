import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type PublicReminder = {
  id: number;
  customerId: string;
  customerTitle: string;
  scheduledAt: string;
  description: string;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  status: 'pending' | 'sent' | 'cancelled';
  token: string;
  /** Panel derin link — ödeme isteği oluştur */
  deepLink: string;
  remainingMs: number;
  createdAt: string;
  sentAt: string | null;
};

export type ReminderRunSummary = {
  checked: number;
  sent: number;
  errors: number;
};

function appBase(): string {
  return (
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://tahsilat.anypay.com.tr'
  );
}

function deepLinkOf(customerId: number, token: string): string {
  return `${appBase()}/odeme-istekleri/yeni?musteri=${customerId}&hatirlatma=${encodeURIComponent(token)}`;
}

function makeToken(): string {
  return randomBytes(16).toString('hex');
}

function toPublic(
  row: {
    id: number;
    musteriId: number;
    planlananTarih: Date;
    aciklama: string | null;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    durum: string;
    token: string;
    olusturmaTarihi: Date;
    gonderimTarihi: Date | null;
  },
  customerTitle: string,
  now = Date.now(),
): PublicReminder {
  const status =
    row.durum === 'sent' || row.durum === 'cancelled' ? row.durum : 'pending';
  return {
    id: row.id,
    customerId: String(row.musteriId),
    customerTitle,
    scheduledAt: row.planlananTarih.toISOString(),
    description: (row.aciklama || '').trim(),
    email: Boolean(row.email),
    sms: Boolean(row.sms),
    whatsapp: Boolean(row.whatsapp),
    status,
    token: row.token,
    deepLink: deepLinkOf(row.musteriId, row.token),
    remainingMs: Math.max(0, row.planlananTarih.getTime() - now),
    createdAt: row.olusturmaTarihi.toISOString(),
    sentAt: row.gonderimTarihi ? row.gonderimTarihi.toISOString() : null,
  };
}

export async function listReminders(userId?: number): Promise<PublicReminder[]> {
  const rows = await prisma.odemeHatirlatma.findMany({
    where: {
      OR: [{ remove: null }, { remove: false }],
      ...(userId != null ? { kullaniciId: userId } : {}),
      durum: { in: ['pending', 'sent'] },
    },
    orderBy: [{ planlananTarih: 'asc' }, { id: 'desc' }],
    take: 200,
  });
  const ids = [...new Set(rows.map((r) => r.musteriId))];
  const customers = ids.length
    ? await prisma.musteri.findMany({
        where: { id: { in: ids } },
        select: { id: true, unvan: true },
      })
    : [];
  const titles = new Map(customers.map((c) => [c.id, (c.unvan || '').trim() || `Müşteri #${c.id}`]));
  const now = Date.now();
  return rows.map((r) => toPublic(r, titles.get(r.musteriId) || `Müşteri #${r.musteriId}`, now));
}

export async function createReminder(input: {
  userId: number;
  customerId: number;
  scheduledAt: string;
  description?: string;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}): Promise<PublicReminder> {
  if (!input.email && !input.sms && !input.whatsapp) {
    throw new SettingsError('En az bir bildirim kanalı seçin');
  }
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(+when)) throw new SettingsError('Geçerli bir zaman seçin');
  if (when.getTime() < Date.now() - 30_000) {
    throw new SettingsError('Zaman geçmiş olamaz');
  }
  const musteri = await prisma.musteri.findFirst({
    where: { id: input.customerId, OR: [{ remove: null }, { remove: false }] },
    select: { id: true, unvan: true },
  });
  if (!musteri) throw new SettingsError('Müşteri bulunamadı');

  const token = makeToken();
  const row = await prisma.odemeHatirlatma.create({
    data: {
      musteriId: musteri.id,
      kullaniciId: input.userId,
      planlananTarih: when,
      aciklama: (input.description || '').trim().slice(0, 2000) || null,
      email: Boolean(input.email),
      sms: Boolean(input.sms),
      whatsapp: Boolean(input.whatsapp),
      durum: 'pending',
      token,
      olusturmaTarihi: new Date(),
      remove: null,
    },
  });
  return toPublic(row, (musteri.unvan || '').trim() || `Müşteri #${musteri.id}`);
}

export async function updateReminder(
  id: number,
  userId: number,
  input: {
    scheduledAt?: string;
    description?: string;
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  },
): Promise<PublicReminder> {
  const existing = await prisma.odemeHatirlatma.findFirst({
    where: {
      id,
      kullaniciId: userId,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (!existing) throw new SettingsError('Hatırlatma bulunamadı');
  if (existing.durum !== 'pending') throw new SettingsError('Yalnızca bekleyen hatırlatma düzenlenir');

  const data: Record<string, unknown> = {};
  if (input.scheduledAt != null) {
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(+when)) throw new SettingsError('Geçerli bir zaman seçin');
    if (when.getTime() < Date.now() - 30_000) throw new SettingsError('Zaman geçmiş olamaz');
    data.planlananTarih = when;
  }
  if (input.description !== undefined) {
    data.aciklama = input.description.trim().slice(0, 2000) || null;
  }
  if (input.email !== undefined) data.email = Boolean(input.email);
  if (input.sms !== undefined) data.sms = Boolean(input.sms);
  if (input.whatsapp !== undefined) data.whatsapp = Boolean(input.whatsapp);

  const email = (data.email as boolean | undefined) ?? existing.email;
  const sms = (data.sms as boolean | undefined) ?? existing.sms;
  const whatsapp = (data.whatsapp as boolean | undefined) ?? existing.whatsapp;
  if (!email && !sms && !whatsapp) throw new SettingsError('En az bir bildirim kanalı seçin');

  const row = await prisma.odemeHatirlatma.update({ where: { id }, data });
  const m = await prisma.musteri.findUnique({
    where: { id: row.musteriId },
    select: { unvan: true },
  });
  return toPublic(row, (m?.unvan || '').trim() || `Müşteri #${row.musteriId}`);
}

export async function cancelReminder(id: number, userId: number): Promise<void> {
  const existing = await prisma.odemeHatirlatma.findFirst({
    where: {
      id,
      kullaniciId: userId,
      OR: [{ remove: null }, { remove: false }],
    },
  });
  if (!existing) throw new SettingsError('Hatırlatma bulunamadı');
  await prisma.odemeHatirlatma.update({
    where: { id },
    data: { durum: 'cancelled', remove: true },
  });
}

async function notifyUser(opts: {
  userId: number;
  customerTitle: string;
  description: string;
  link: string;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, telefon: true, adsoyad: true },
  });
  if (!user) return false;

  const text = [
    `Merhaba${user.adsoyad ? ` ${user.adsoyad}` : ''},`,
    '',
    `"${opts.customerTitle}" müşterisi için ödeme isteği oluşturma zamanı geldi.`,
    opts.description ? `Not: ${opts.description}` : '',
    '',
    `Ödeme isteği oluştur: ${opts.link}`,
  ]
    .filter(Boolean)
    .join('\n');

  let ok = false;

  if (opts.email && user.email) {
    try {
      const { sendPaymentReminderMail } = await import('../lib/mail.js');
      await sendPaymentReminderMail({
        to: user.email,
        staffName: user.adsoyad,
        customerTitle: opts.customerTitle,
        description: opts.description,
        link: opts.link,
      });
      ok = true;
    } catch (err) {
      console.warn('[reminder-notify-email]', err);
    }
  }

  const phone = (user.telefon || '').replace(/\D/g, '');
  if (opts.sms && phone.length >= 10) {
    try {
      const { dispatchSms } = await import('./smsSettingsService.js');
      await dispatchSms(phone, text.slice(0, 900));
      ok = true;
    } catch (err) {
      console.warn('[reminder-notify-sms]', err);
    }
  }

  if (opts.whatsapp && phone.length >= 10) {
    try {
      const { sendWhatsappText, isWhatsappIntegrationActive } =
        await import('./whatsappSettingsService.js');
      if (await isWhatsappIntegrationActive()) {
        await sendWhatsappText(phone, text.slice(0, 4096));
        ok = true;
      }
    } catch (err) {
      console.warn('[reminder-notify-whatsapp]', err);
    }
  }

  return ok;
}

/** Zamanı gelen bekleyen hatırlatmaları gönder */
export async function processPaymentReminders(): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = { checked: 0, sent: 0, errors: 0 };
  const now = new Date();
  const due = await prisma.odemeHatirlatma.findMany({
    where: {
      durum: 'pending',
      planlananTarih: { lte: now },
      OR: [{ remove: null }, { remove: false }],
    },
    take: 100,
    orderBy: { planlananTarih: 'asc' },
  });

  for (const row of due) {
    summary.checked += 1;
    const m = await prisma.musteri.findUnique({
      where: { id: row.musteriId },
      select: { unvan: true },
    });
    const title = (m?.unvan || '').trim() || `Müşteri #${row.musteriId}`;
    const link = deepLinkOf(row.musteriId, row.token);
    try {
      const ok = await notifyUser({
        userId: row.kullaniciId,
        customerTitle: title,
        description: (row.aciklama || '').trim(),
        link,
        email: row.email,
        sms: row.sms,
        whatsapp: row.whatsapp,
      });
      if (ok) {
        await prisma.odemeHatirlatma.update({
          where: { id: row.id },
          data: { durum: 'sent', gonderimTarihi: new Date() },
        });
        summary.sent += 1;
      } else {
        // Kanallar başarısız — pending kalsın, sonraki tick tekrar dener
        summary.errors += 1;
      }
    } catch (err) {
      console.warn('[reminder]', row.id, err);
      summary.errors += 1;
    }
  }
  return summary;
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startPaymentReminderScheduler(): void {
  if (reminderTimer) return;
  const tick = () => {
    void processPaymentReminders()
      .then((s) => {
        if (s.sent > 0 || s.errors > 0) console.log('[reminder]', s);
      })
      .catch((err) => console.warn('[reminder] tick failed', err));
  };
  setTimeout(tick, 20_000);
  reminderTimer = setInterval(tick, 60_000); // dakikada bir
}
