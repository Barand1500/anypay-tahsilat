/** Kullanıcılar — tip + yardımcılar; liste API’den gelir */

export type UserStatus = 'Aktif' | 'Pasif';

export type AppUser = {
  id: number;
  name: string;
  email: string;
  phone: string; // digits only, 10 chars starting with 5
  roleId: string;
  roleName: string;
  branchId?: number | null;
  branchIds?: number[];
  branch: string;
  status: UserStatus;
  installments: number[]; // 1–12
};

export const BRANCH_OPTIONS = ['MERKEZ', 'TEKNOPARK'] as const;

/** Tanımlamalar › Şubeler listesi; yoksa sabit fallback */
export function getBranchOptions(): string[] {
  try {
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

/** Rapor filtreleri için örnek isimler (API dışı sayfalar) */
export const INITIAL_USERS: AppUser[] = [
  {
    id: 6,
    name: 'App Test (silmeyin)',
    email: 'apptest@guzelteknoloji.com',
    phone: '5555555555',
    roleId: '4',
    roleName: 'Tahsilat',
    branch: 'TEKNOPARK',
    status: 'Aktif',
    installments: [1, 2, 3],
  },
  {
    id: 2,
    name: 'Sercan Güzel',
    email: 'sercan@guzelteknoloji.com',
    phone: '5421046060',
    roleId: '2',
    roleName: 'Yönetici',
    branch: 'MERKEZ',
    status: 'Aktif',
    installments: INSTALLMENT_OPTIONS,
  },
];

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
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

/** Global arama / detay — UsersPage yükleyince set edilir */
let liveUsers: AppUser[] = [...INITIAL_USERS];

export function getLiveUsers() {
  return liveUsers;
}

export function setLiveUsers(next: AppUser[]) {
  liveUsers = next;
}

export function findLiveUser(id: string | number | undefined) {
  if (id == null || id === '') return undefined;
  const n = Number(id);
  return liveUsers.find((u) => u.id === n || String(u.id) === String(id));
}
