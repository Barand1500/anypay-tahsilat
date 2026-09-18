import { INITIAL_MODULES } from '../modules/mockModules';

/** Sayfa izinleri — görüntüle kapalıysa kaydet/sil anlamsız */
export type PagePerm = {
  view: boolean;
  save: boolean;
  remove: boolean;
};

export type RoleUser = {
  id: string;
  initials: string;
  name: string;
};

export type AppRole = {
  id: string;
  name: string;
  /** Yönetici erişimi — tüm sayfalarda full yetki */
  isAdmin: boolean;
  /** moduleId → izinler */
  permissions: Record<string, PagePerm>;
  users: RoleUser[];
};

export type PermAction = 'view' | 'save' | 'remove';

export const PERM_PAGES = INITIAL_MODULES.map((m) => ({
  id: m.id,
  name: m.name,
  urlPrefix: m.urlPrefix,
}));

export function emptyPerm(): PagePerm {
  return { view: false, save: false, remove: false };
}

export function fullPerm(): PagePerm {
  return { view: true, save: true, remove: true };
}

export function allFullPermissions(): Record<string, PagePerm> {
  const out: Record<string, PagePerm> = {};
  for (const p of PERM_PAGES) out[p.id] = fullPerm();
  return out;
}

export function normalizePerm(p: PagePerm): PagePerm {
  if (!p.view) return { view: false, save: false, remove: false };
  return { ...p };
}

export function countGranted(role: AppRole): { pages: number; total: number } {
  if (role.isAdmin) return { pages: PERM_PAGES.length, total: PERM_PAGES.length };
  let pages = 0;
  for (const p of PERM_PAGES) {
    const perm = role.permissions[p.id];
    if (perm?.view) pages += 1;
  }
  return { pages, total: PERM_PAGES.length };
}

function permSet(
  ids: string[],
  flags: Partial<PagePerm>,
): Record<string, PagePerm> {
  const base = allFullPermissions();
  for (const id of Object.keys(base)) {
    base[id] = emptyPerm();
  }
  for (const id of ids) {
    base[id] = normalizePerm({ view: false, save: false, remove: false, ...flags });
  }
  return base;
}

export const INITIAL_ROLES: AppRole[] = [
  {
    id: 'role-admin',
    name: 'Yönetici',
    isAdmin: true,
    permissions: allFullPermissions(),
    users: [
      { id: 'u1', initials: 'SG', name: 'Sercan Güzel' },
      { id: 'u2', initials: 'BÜ', name: 'Baran Ünal' },
      { id: 'u3', initials: 'SM', name: 'Semihcan Güzel' },
      { id: 'u4', initials: 'EG', name: 'Ercan Güzel' },
    ],
  },
  {
    id: 'role-tahsilat',
    name: 'Tahsilat',
    isAdmin: false,
    permissions: permSet(
      ['m-ozet', 'm-musteriler', 'm-hareketler', 'm-odeme-istekleri', 'm-profil'],
      { view: true, save: true, remove: false },
    ),
    users: [{ id: 'u5', initials: 'AT', name: 'Ayşe Tahsilat' }],
  },
  {
    id: 'role-muhasebe',
    name: 'Muhasebe',
    isAdmin: false,
    permissions: permSet(
      ['m-ozet', 'm-raporlar', 'm-hareketler', 'm-profil'],
      { view: true, save: true, remove: false },
    ),
    users: [
      { id: 'u6', initials: 'MK', name: 'Mehmet Kaya' },
      { id: 'u7', initials: 'ZY', name: 'Zeynep Yılmaz' },
    ],
  },
];

/**
 * Mock oturum rolü — yetki kontrolü için.
 * DEV admin → Yönetici; ileride API’den gelecek.
 */
export function resolveSessionRoleId(authRoles: string[] | undefined): string {
  if (
    authRoles?.includes('ROLE_SUPERAPP') ||
    authRoles?.includes('ROLE_ADMIN')
  ) {
    return 'role-admin';
  }
  return 'role-tahsilat';
}

export function getPermForModule(
  role: AppRole | undefined,
  moduleId: string,
): PagePerm {
  if (!role) return emptyPerm();
  if (role.isAdmin) return fullPerm();
  return role.permissions[moduleId] ?? emptyPerm();
}

export const ACTION_LABELS: Record<PermAction, string> = {
  view: 'görüntüleme',
  save: 'kaydetme / ekleme',
  remove: 'silme',
};
