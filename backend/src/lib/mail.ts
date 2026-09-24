import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

function requireEnv(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} tanımlı değil`);
  return v;
}

/** Gmail app password boşluklu gelebilir — birleştir */
function smtpPass() {
  return requireEnv('SMTP_PASS').replace(/\s+/g, '');
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;

  transporter = nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port,
    secure,
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: smtpPass(),
    },
  });
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const from = process.env.SMTP_FROM?.trim() || requireEnv('SMTP_USER');
  const info = await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return info;
}

export async function sendLoginOtpMail(to: string, adsoyad: string | null, code: string) {
  const name = adsoyad?.trim() || 'Kullanıcı';
  const subject = 'Giriş Doğrulama Kodunuz';
  const html = `
    <p><strong>Sayın ${escapeHtml(name)};</strong></p>
    <p>Giriş yapmak için doğrulama kodunuz aşağıdadır.</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#c00;">${escapeHtml(code)}</p>
    <p style="color:#666;font-size:13px;">Kod ${process.env.OTP_EXPIRES_MINUTES || 10} dakika geçerlidir. Bu isteği siz yapmadıysanız bu maili yok sayın.</p>
  `;
  const text = `Sayın ${name}, giriş doğrulama kodunuz: ${code}`;
  return sendMail({ to, subject, html, text });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
