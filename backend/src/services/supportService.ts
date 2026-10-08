import { SettingsError } from './settingsService.js';

/** Destek paneline düşecek sabit alıcılar */
export const SUPPORT_EMAIL = 'guzelteknoloji50@gmail.com';
export const SUPPORT_PHONE = '05408851260';

export type SupportChannel = 'email' | 'sms' | 'whatsapp';

export type SupportChannelsStatus = {
  email: { api: boolean; to: string };
  sms: { api: boolean; to: string };
  whatsapp: { api: boolean; to: string };
};

export type SupportTicketResult = {
  method: 'api' | 'client';
  channel: SupportChannel;
  sent: boolean;
  to: string;
  /** client fallback — tarayıcıda açılacak */
  clientUrl?: string;
  error?: string;
};

function digitsPhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `90${d}`;
  return d;
}

async function isSmtpReady(): Promise<boolean> {
  try {
    const { resolveSmtpConfig } = await import('./emailSmtpService.js');
    await resolveSmtpConfig();
    return true;
  } catch {
    return false;
  }
}

async function isSmsReady(): Promise<boolean> {
  try {
    const { getSmsSettings } = await import('./smsSettingsService.js');
    const s = await getSmsSettings();
    return Boolean(s.active && s.passwordSet && s.username.trim() && s.title.trim());
  } catch {
    return false;
  }
}

async function isWhatsappReady(): Promise<boolean> {
  try {
    const { isWhatsappIntegrationActive } = await import('./whatsappSettingsService.js');
    return await isWhatsappIntegrationActive();
  } catch {
    return false;
  }
}

export async function getSupportChannels(): Promise<SupportChannelsStatus> {
  const [emailApi, smsApi, whatsappApi] = await Promise.all([
    isSmtpReady(),
    isSmsReady(),
    isWhatsappReady(),
  ]);
  return {
    email: { api: emailApi, to: SUPPORT_EMAIL },
    sms: { api: smsApi, to: SUPPORT_PHONE },
    whatsapp: { api: whatsappApi, to: SUPPORT_PHONE },
  };
}

function buildMessage(opts: {
  subject: string;
  body: string;
  userName: string;
  userEmail: string;
}): { subject: string; text: string; html: string } {
  const subject = `[Tahsilat Destek] ${opts.subject}`.slice(0, 200);
  const text = [
    'Panel destek talebi',
    `Kim: ${opts.userName || '—'} (${opts.userEmail || '—'})`,
    `Konu: ${opts.subject}`,
    '',
    opts.body,
  ].join('\n');
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
      <p style="margin:0 0 8px"><strong>Panel destek talebi</strong></p>
      <p style="margin:0 0 4px">Kim: ${escapeHtml(opts.userName || '—')} (${escapeHtml(opts.userEmail || '—')})</p>
      <p style="margin:0 0 12px">Konu: <strong>${escapeHtml(opts.subject)}</strong></p>
      <div style="white-space:pre-wrap;border-top:1px solid #e2e8f0;padding-top:12px">${escapeHtml(opts.body)}</div>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clientUrlFor(
  channel: SupportChannel,
  subject: string,
  text: string,
): string {
  if (channel === 'email') {
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }
  const phone = digitsPhone(SUPPORT_PHONE);
  if (channel === 'whatsapp') {
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }
  // SMS — iOS/Android
  return `sms:${phone}?body=${encodeURIComponent(text)}`;
}

export async function submitSupportTicket(input: {
  channel: SupportChannel;
  subject: string;
  body: string;
  userName: string;
  userEmail: string;
}): Promise<SupportTicketResult> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new SettingsError('Konu gerekli');
  if (!body) throw new SettingsError('Açıklama gerekli');
  if (subject.length > 200) throw new SettingsError('Konu çok uzun');
  if (body.length > 5000) throw new SettingsError('Açıklama çok uzun');

  const msg = buildMessage({
    subject,
    body,
    userName: input.userName.trim(),
    userEmail: input.userEmail.trim(),
  });

  const channels = await getSupportChannels();
  const ch = channels[input.channel];
  const to = ch.to;

  if (ch.api) {
    try {
      if (input.channel === 'email') {
        const { sendMail } = await import('../lib/mail.js');
        await sendMail({
          to: SUPPORT_EMAIL,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });
      } else if (input.channel === 'sms') {
        const { dispatchSms } = await import('./smsSettingsService.js');
        await dispatchSms(SUPPORT_PHONE, `${msg.subject}\n\n${body}`.slice(0, 900));
      } else {
        const { sendWhatsappText } = await import('./whatsappSettingsService.js');
        await sendWhatsappText(SUPPORT_PHONE, msg.text.slice(0, 4096));
      }
      return { method: 'api', channel: input.channel, sent: true, to };
    } catch (err) {
      // API başarısız → istemci fallback (mailto / wa.me / sms:)
      const detail =
        err instanceof SettingsError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gönderilemedi';
      console.warn('[support]', input.channel, detail);
      return {
        method: 'client',
        channel: input.channel,
        sent: false,
        to,
        clientUrl: clientUrlFor(input.channel, msg.subject, msg.text),
        error: detail,
      };
    }
  }

  return {
    method: 'client',
    channel: input.channel,
    sent: false,
    to,
    clientUrl: clientUrlFor(input.channel, msg.subject, msg.text),
  };
}
