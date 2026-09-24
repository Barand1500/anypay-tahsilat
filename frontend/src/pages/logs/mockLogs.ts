/** Log kayıtları — tip + yardımcılar; liste API’den gelir */

export type LogActionKind =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'other';

export type AppLog = {
  id: number;
  userName: string;
  userEmail: string;
  at: string;
  kind: LogActionKind;
  actionLabel: string;
  detail: string;
};

export const LOG_KIND_LABEL: Record<LogActionKind, string> = {
  login: 'Giriş',
  logout: 'Çıkış',
  create: 'Ekleme',
  update: 'Güncelleme',
  delete: 'Silme',
  export: 'Dışa aktar',
  other: 'İşlem',
};

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatLogDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export function daysAgo(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hf. önce`;
  return `${Math.floor(days / 30)} ay önce`;
}
