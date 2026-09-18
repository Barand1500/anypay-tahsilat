/** Log kayıtları — mock */

export type LogActionKind = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'export' | 'other';

export type AppLog = {
  id: string;
  userName: string;
  userEmail: string;
  at: string; // ISO
  kind: LogActionKind;
  /** Kısa etiket (badge) */
  actionLabel: string;
  /** Açıklama */
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

export const INITIAL_LOGS: AppLog[] = [
  {
    id: 'log-1',
    userName: 'Baran Ünal',
    userEmail: 'baran@guzelteknoloji.com',
    at: '2026-09-17T12:27:00',
    kind: 'login',
    actionLabel: 'Giriş',
    detail: 'baran@guzelteknoloji.com e-posta adresine sahip kullanıcı giriş yaptı.',
  },
  {
    id: 'log-2',
    userName: 'Baran Ünal',
    userEmail: 'baran@guzelteknoloji.com',
    at: '2026-09-17T11:05:00',
    kind: 'update',
    actionLabel: 'Kullanıcı',
    detail: 'Semihcan Güzel kullanıcısı güncellendi.',
  },
  {
    id: 'log-3',
    userName: 'Ercan Güzel',
    userEmail: 'ercan@guzelteknoloji.com',
    at: '2026-09-16T18:42:00',
    kind: 'export',
    actionLabel: 'Dışa aktar',
    detail: 'Kullanıcılar listesi CSV olarak dışa aktarıldı.',
  },
  {
    id: 'log-4',
    userName: 'Sercan Güzel',
    userEmail: 'sercan@guzelteknoloji.com',
    at: '2026-09-15T09:18:00',
    kind: 'create',
    actionLabel: 'Rol',
    detail: 'Muhasebe rolü izinleri kaydedildi.',
  },
  {
    id: 'log-5',
    userName: 'App Test',
    userEmail: 'apptest@guzelteknoloji.com',
    at: '2026-09-12T14:01:00',
    kind: 'login',
    actionLabel: 'Giriş',
    detail: 'apptest@guzelteknoloji.com e-posta adresine sahip kullanıcı giriş yaptı.',
  },
  {
    id: 'log-6',
    userName: 'Baran Ünal',
    userEmail: 'baran@guzelteknoloji.com',
    at: '2026-09-10T16:33:00',
    kind: 'delete',
    actionLabel: 'Modül',
    detail: 'Test modülü silindi.',
  },
  {
    id: 'log-7',
    userName: 'Semihcan Güzel',
    userEmail: 'semihcan@guzelteknoloji.com',
    at: '2026-09-05T10:12:00',
    kind: 'logout',
    actionLabel: 'Çıkış',
    detail: 'Oturum sonlandırıldı.',
  },
  {
    id: 'log-8',
    userName: 'Ercan Güzel',
    userEmail: 'ercan@guzelteknoloji.com',
    at: '2026-08-28T08:55:00',
    kind: 'other',
    actionLabel: 'Sistem',
    detail: 'Sürüm notları görüntülendi.',
  },
  {
    id: 'log-9',
    userName: 'Baran Ünal',
    userEmail: 'baran@guzelteknoloji.com',
    at: '2026-08-20T13:20:00',
    kind: 'login',
    actionLabel: 'Giriş',
    detail: 'baran@guzelteknoloji.com e-posta adresine sahip kullanıcı giriş yaptı.',
  },
  {
    id: 'log-10',
    userName: 'Ayşe Tahsilat',
    userEmail: 'ayse@guzelteknoloji.com',
    at: '2026-08-01T11:00:00',
    kind: 'update',
    actionLabel: 'Profil',
    detail: 'Profil bilgileri güncellendi.',
  },
];

export function initialsOf(name: string) {
  return name
    .split(' ')
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
