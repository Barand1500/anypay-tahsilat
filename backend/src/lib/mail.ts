import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { resolveSmtpConfig } from '../services/emailSmtpService.js';

let transporter: Transporter | null = null;
let transporterKey = '';

export function resetMailTransporter() {
  transporter = null;
  transporterKey = '';
}

async function getTransporter(): Promise<Transporter> {
  const cfg = await resolveSmtpConfig();
  const key = `${cfg.host}|${cfg.port}|${cfg.email}|${cfg.ssl}|${cfg.tls}|${cfg.password.length}`;
  if (transporter && transporterKey === key) return transporter;

  const secure = cfg.ssl || cfg.port === 465;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    ...(secure
      ? {}
      : {
          requireTLS: cfg.tls,
          tls: { rejectUnauthorized: false },
        }),
    auth: {
      user: cfg.email,
      pass: cfg.password,
    },
  });
  transporterKey = key;
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; path: string }[];
}) {
  const cfg = await resolveSmtpConfig();
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: cfg.from || cfg.email,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
  return info;
}

/** Ayarlar sayfası — sınama maili */
export async function sendSmtpTestMail(to: string) {
  const cfg = await resolveSmtpConfig();
  const subject = 'AnyPay Tahsilat — SMTP sınama';
  const html = `<p>Bu bir sınama e-postasıdır.</p>
<p>Sunucu: <strong>${escapeHtml(cfg.host)}</strong> · Port: <strong>${cfg.port}</strong></p>
<p>Gönderen: <strong>${escapeHtml(cfg.email)}</strong></p>
<p style="color:#64748b;font-size:12px;">E-Posta Ayarları doğru çalışıyor.</p>`;
  return sendMail({
    to,
    subject,
    html,
    text: `SMTP sınama — ${cfg.host}:${cfg.port} — ${cfg.email}`,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendLoginOtpMail(to: string, adsoyad: string | null, code: string) {
  const name = adsoyad?.trim() || 'Kullanıcı';
  const mins = process.env.OTP_EXPIRES_MINUTES || 10;
  const subject = `${code} — Giriş doğrulama kodunuz`;
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Giriş doğrulama</title>
</head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:20px;overflow:hidden;background:#111827;border:1px solid #1f2937;">
          <tr>
            <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#0ea5e9 0%,#0369a1 55%,#0f172a 100%);">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;">
                GÜZEL Teknoloji
              </p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:800;">
                Giriş doğrulama kodu
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;font-size:16px;color:#e5e7eb;">
                Merhaba <strong style="color:#fff;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#9ca3af;">
                Tahsilat paneline giriş için tek kullanımlık kodunuz aşağıda.
                Kodunuzu kimseyle paylaşmayın.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  <td align="center" style="padding:22px 16px;border-radius:16px;background:#020617;border:1px dashed #38bdf8;">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;font-weight:700;">
                      Doğrulama kodu
                    </p>
                    <p style="margin:0;font-size:40px;line-height:1.1;letter-spacing:0.28em;font-weight:800;color:#f8fafc;font-family:Consolas,Monaco,monospace;">
                      ${safeCode}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">
                ⏱ Bu kod <strong style="color:#e2e8f0;">${escapeHtml(String(mins))} dakika</strong> geçerlidir.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                Bu isteği siz yapmadıysanız bu e-postayı yok sayın. Hesabınız güvende kalır.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #1f2937;background:#0b1220;">
              <p style="margin:0;font-size:11px;color:#64748b;text-align:center;">
                Powered by <span style="color:#94a3b8;font-weight:700;">GÜZEL Teknoloji®</span>
                · tahsilat.anypay.com.tr
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `GÜZEL Teknoloji — Giriş doğrulama\n\nMerhaba ${name},\n\nKodunuz: ${code}\nGeçerlilik: ${mins} dakika\n\nBu isteği siz yapmadıysanız yok sayın.\nhttps://tahsilat.anypay.com.tr`;
  return sendMail({ to, subject, html, text });
}

/** Müşteri panel girişi — e-posta + geçici şifre */
export async function sendCustomerCredentialsMail(
  to: string,
  adsoyad: string | null,
  loginEmail: string,
  password: string,
) {
  const name = adsoyad?.trim() || 'Kullanıcı';
  const subject = 'AnyPay Tahsilat — Giriş bilgileriniz';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(loginEmail);
  const safePass = escapeHtml(password);
  const loginUrl = 'https://tahsilat.anypay.com.tr/';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Giriş bilgileri</title>
</head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:20px;overflow:hidden;background:#111827;border:1px solid #1f2937;">
          <tr>
            <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#0ea5e9 0%,#0369a1 55%,#0f172a 100%);">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;">
                GÜZEL Teknoloji
              </p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:800;">
                Giriş bilgileriniz
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;font-size:16px;color:#e5e7eb;">
                Merhaba <strong style="color:#fff;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#9ca3af;">
                AnyPay Tahsilat paneline giriş bilgileriniz aşağıdadır.
                İlk girişten sonra şifrenizi değiştirmenizi öneririz.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  <td style="padding:18px 16px;border-radius:16px;background:#020617;border:1px solid #1f2937;">
                    <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;">E-posta</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#f8fafc;">${safeEmail}</p>
                    <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;">Şifre</p>
                    <p style="margin:0;font-size:20px;letter-spacing:0.12em;font-weight:800;color:#7dd3fc;font-family:Consolas,Monaco,monospace;">
                      ${safePass}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;text-align:center;">
                <a href="${loginUrl}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0284c7;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">
                  Panele gir
                </a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                Bu isteği siz yapmadıysanız bu e-postayı yok sayın.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #1f2937;background:#0b1220;">
              <p style="margin:0;font-size:11px;color:#64748b;text-align:center;">
                Powered by <span style="color:#94a3b8;font-weight:700;">GÜZEL Teknoloji®</span>
                · tahsilat.anypay.com.tr
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'GÜZEL Teknoloji — Giriş bilgileriniz',
    '',
    `Merhaba ${name},`,
    '',
    `E-posta: ${loginEmail}`,
    `Şifre: ${password}`,
    '',
    `Giriş: ${loginUrl}`,
    '',
    'İlk girişten sonra şifrenizi değiştirmenizi öneririz.',
  ].join('\n');

  return sendMail({ to, subject, html, text });
}

/** Ödeme isteği linki — müşteriye SMTP */
export async function sendPaymentRequestMail(opts: {
  to: string;
  customerTitle: string;
  amount: number;
  description: string;
  payUrl: string;
  commissionIncluded: boolean;
  currencySymbol?: string;
  files?: { name: string; url: string }[];
  attachments?: { filename: string; path: string }[];
}) {
  const name = opts.customerTitle.trim() || 'Müşteri';
  const sym = opts.currencySymbol?.trim() || '₺';
  const amountStr = opts.amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const subject = `Ödeme isteği — ${amountStr} ${sym}`;
  const safeName = escapeHtml(name);
  const safeAmount = escapeHtml(amountStr);
  const safeSym = escapeHtml(sym);
  const safeUrl = escapeHtml(opts.payUrl);
  const safeDesc = escapeHtml((opts.description || '').slice(0, 400));
  const komisyon = opts.commissionIncluded ? 'Komisyon dahil' : 'Komisyon hariç';
  const files = opts.files || [];
  const filesHtml = files.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
        <tr>
          <td style="padding:16px;border-radius:14px;background:#020617;border:1px solid #1f2937;">
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#7dd3fc;font-weight:700;">Ekler</p>
            ${files
              .map(
                (f) =>
                  `<p style="margin:0 0 8px;font-size:13px;"><a href="${escapeHtml(f.url)}" style="color:#38bdf8;text-decoration:none;font-weight:600;">📎 ${escapeHtml(f.name)}</a></p>`,
              )
              .join('')}
            <p style="margin:8px 0 0;font-size:11px;color:#64748b;">Dosyalar e-postaya da eklenmiştir.</p>
          </td>
        </tr>
      </table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Ödeme isteği</title>
</head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:20px;overflow:hidden;background:#111827;border:1px solid #1f2937;">
          <tr>
            <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#0ea5e9 0%,#0369a1 55%,#0f172a 100%);">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;">
                GÜZEL Teknoloji
              </p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:800;">
                Ödeme isteğiniz hazır
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 10px;font-size:16px;color:#e5e7eb;">
                Sayın <strong style="color:#fff;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#9ca3af;">
                Size bir ödeme isteği gönderildi. Aşağıdaki bağlantıdan güvenli ödeme yapabilirsiniz.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  <td style="padding:18px 16px;border-radius:16px;background:#020617;border:1px solid #1f2937;">
                    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Tutar</p>
                    <p style="margin:0 0 14px;font-size:28px;font-weight:800;color:#7dd3fc;">${safeAmount} ${safeSym}</p>
                    <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${escapeHtml(komisyon)}</p>
                    ${
                      safeDesc
                        ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">${safeDesc}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </table>

              ${filesHtml}

              <p style="margin:0 0 18px;text-align:center;">
                <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0284c7;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">
                  Ödemeyi tamamla
                </a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;word-break:break-all;">
                Link: ${safeUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #1f2937;background:#0b1220;">
              <p style="margin:0;font-size:11px;color:#64748b;text-align:center;">
                Powered by <span style="color:#94a3b8;font-weight:700;">GÜZEL Teknoloji®</span>
                · tahsilat.anypay.com.tr
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'GÜZEL Teknoloji — Ödeme isteği',
    '',
    `Sayın ${name},`,
    '',
    `Tutar: ${amountStr} ${sym} (${komisyon})`,
    opts.description ? `Açıklama: ${opts.description.slice(0, 200)}` : '',
    '',
    `Ödeme linki: ${opts.payUrl}`,
    ...(files.length
      ? ['', 'Ekler:', ...files.map((f) => `- ${f.name}: ${f.url}`)]
      : []),
  ]
    .filter(Boolean)
    .join('\n');

  return sendMail({
    to: opts.to,
    subject,
    html,
    text,
    attachments: opts.attachments,
  });
}
