/** Kullanıcılar — mock; roller ile id paylaşır */

export type UserStatus = 'Aktif' | 'Pasif';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone: string; // digits only, 10 chars starting with 5
  roleId: string;
  roleName: string;
  branch: string;
  status: UserStatus;
  installments: number[]; // 1–12
};

export const BRANCH_OPTIONS = [
  'Merkez',
  'TEKNOPARK',
  'Ankara',
  'İzmir',
  'İstanbul Anadolu',
] as const;

/** Tanımlamalar › Şubeler listesi; yoksa sabit fallback */
export function getBranchOptions(): string[] {
  try {
    // lazy import döngüsünü önlemek için doğrudan storage
    const raw = localStorage.getItem('anypay_tahsilat_branch_defs');
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string }[];
      if (Array.isArray(parsed) && parsed.length) {
        const names = parsed
          .map((x) => (typeof x?.name === 'string' ? x.name.trim() : ''))
          .filter(Boolean);
        if (names.length) return names;
      }
    }
  } catch {
    /* ignore */
  }
  return [...BRANCH_OPTIONS];
}

export {
  EMAIL_DOMAIN_SUGGESTIONS,
  emailSuggestions,
} from '../../lib/emailSuggestions';

export const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'u-apptest',
    name: 'App Test (silmeyin)',
    email: 'apptest@guzelteknoloji.com',
    phone: '5555555555',
    roleId: 'role-tahsilat',
    roleName: 'Tahsilat',
    branch: 'TEKNOPARK',
    status: 'Aktif',
    installments: [1, 2, 3],
  },
  {
    id: 'u4',
    name: 'Ercan Güzel',
    email: 'ercan@guzelteknoloji.com',
    phone: '5438851160',
    roleId: 'role-admin',
    roleName: 'Yönetici',
    branch: 'Merkez',
    status: 'Aktif',
    installments: INSTALLMENT_OPTIONS,
  },
  {
    id: 'u3',
    name: 'Semihcan Güzel',
    email: 'semihcan@guzelteknoloji.com',
    phone: '5421056060',
    roleId: 'role-admin',
    roleName: 'Yönetici',
    branch: 'Merkez',
    status: 'Aktif',
    installments: [1, 2, 3, 6, 9, 12],
  },
  {
    id: 'u1',
    name: 'Sercan Güzel',
    email: 'sercan@guzelteknoloji.com',
    phone: '5421046060',
    roleId: 'role-admin',
    roleName: 'Yönetici',
    branch: 'Merkez',
    status: 'Aktif',
    installments: INSTALLMENT_OPTIONS,
  },
  {
    id: 'u2',
    name: 'Baran Ünal',
    email: 'baran@guzelteknoloji.com',
    phone: '5321234567',
    roleId: 'role-admin',
    roleName: 'Yönetici',
    branch: 'Ankara',
    status: 'Aktif',
    installments: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'u5',
    name: 'Ayşe Tahsilat',
    email: 'ayse@guzelteknoloji.com',
    phone: '5551112233',
    roleId: 'role-tahsilat',
    roleName: 'Tahsilat',
    branch: 'İzmir',
    status: 'Aktif',
    installments: [1, 2, 3],
  },
  {
    id: 'u6',
    name: 'Mehmet Kaya',
    email: 'mehmet@guzelteknoloji.com',
    phone: '5329876543',
    roleId: 'role-muhasebe',
    roleName: 'Muhasebe',
    branch: 'Merkez',
    status: 'Aktif',
    installments: [1, 2, 3, 6],
  },
  {
    id: 'u7',
    name: 'Zeynep Yılmaz',
    email: 'zeynep@guzelteknoloji.com',
    phone: '5443332211',
    roleId: 'role-muhasebe',
    roleName: 'Muhasebe',
    branch: 'Ankara',
    status: 'Aktif',
    installments: [1, 2, 3],
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

/** Canlı yazım: 5XX XXX XX XX (3-3-2-2) */
export function formatPhoneLive(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (!d) return '';
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 8);
  const e = d.slice(8, 10);
  let out = a;
  if (b) out += ` ${b}`;
  if (c) out += ` ${c}`;
  if (e) out += ` ${e}`;
  return out;
}

export function normalizePhoneInput(raw: string, prev: string): string {
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d[0] !== '5') d = '5' + d.replace(/^5*/, '');
  d = d.replace(/[^\d]/g, '');
  if (!d.startsWith('5')) d = '5' + d;
  return d.slice(0, 10) || (prev.startsWith('5') ? '5' : '');
}

/** Oturum boyu liste (detay sayfası ile paylaşım) */
let liveUsers: AppUser[] = [...INITIAL_USERS];

export function getLiveUsers() {
  return liveUsers;
}

export function setLiveUsers(next: AppUser[]) {
  liveUsers = next;
}

export function findLiveUser(id: string | undefined) {
  if (!id) return undefined;
  return liveUsers.find((u) => u.id === id);
}
