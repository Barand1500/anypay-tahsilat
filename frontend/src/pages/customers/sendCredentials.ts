/** Geçici giriş bilgilerini istemci kanalıyla aç (SMTP/SMS gateway yok) */

export type CredentialChannel = 'mail' | 'sms' | 'wp';

export function openCredentialChannel(
  channel: CredentialChannel,
  input: { name: string; email: string; phone: string; password: string },
) {
  const subject = encodeURIComponent('AnyPay Tahsilat — Giriş bilgileriniz');
  const body = encodeURIComponent(
    [
      `Merhaba ${input.name},`,
      '',
      'AnyPay Tahsilat giriş bilgileriniz:',
      `E-posta: ${input.email}`,
      `Şifre: ${input.password}`,
      '',
      'Giriş: https://tahsilat.anypay.com.tr/',
      '',
      'İlk girişten sonra şifrenizi değiştirmenizi öneririz.',
    ].join('\n'),
  );
  const phone = input.phone.replace(/\D/g, '');
  const waPhone = phone.startsWith('90') ? phone : `90${phone}`;
  const text = encodeURIComponent(
    `AnyPay Tahsilat giriş\nE-posta: ${input.email}\nŞifre: ${input.password}\nhttps://tahsilat.anypay.com.tr/`,
  );

  if (channel === 'mail') {
    window.open(`mailto:${encodeURIComponent(input.email)}?subject=${subject}&body=${body}`, '_blank');
    return;
  }
  if (channel === 'sms') {
    window.open(`sms:+${waPhone}?body=${text}`, '_blank');
    return;
  }
  window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
}
