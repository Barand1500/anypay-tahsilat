/** Gönderim Geçmişi — tipler */

export type SendType = 'email' | 'sms';

export type SendHistoryRow = {
  id: number;
  customerId: string | null;
  customerTitle: string;
  type: SendType;
  recipient: string;
  content: string;
  sentAt: string;
};

export const SEND_TYPE_OPTIONS = [
  { value: 'email', label: 'E-Posta' },
  { value: 'sms', label: 'Sms' },
] as const;

export const SEND_TYPE_LABEL: Record<SendType, string> = {
  email: 'E-Posta',
  sms: 'Sms',
};

export function formatSendDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
