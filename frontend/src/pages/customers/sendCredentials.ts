/** Geçici giriş bilgilerini istemci kanalıyla aç (SMS / WhatsApp) */

export type CredentialChannel = 'mail' | 'sms' | 'wp';

export function openCredentialChannel(
  channel: Exclude<CredentialChannel, 'mail'>,
  input: { name: string; email: string; phone: string; password: string },
) {
  const phone = input.phone.replace(/\D/g, '');
  const waPhone = phone.startsWith('90') ? phone : `90${phone}`;
  const text = encodeURIComponent(
    `AnyPay Tahsilat giriş\nE-posta: ${input.email}\nŞifre: ${input.password}\nhttps://tahsilat.anypay.com.tr/`,
  );

  if (channel === 'sms') {
    window.open(`sms:+${waPhone}?body=${text}`, '_blank');
    return;
  }
  window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
}
