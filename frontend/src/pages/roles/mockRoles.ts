import { INITIAL_MODULES } from '../modules/mockModules';

/** Sayfa izinleri — görüntüle kapalıysa kaydet/sil anlamsız */
export type PagePerm = {
  view: boolean;
  save: boolean;
  remove: boolean;
};

export type RoleUser = {
  id: number;
  initials: string;
  name: string;
};

export type AppRole = {
  id: number;
  name: string;
  code: string;
  /** Yönetici erişimi — tüm sayfalarda full yetki */
  isAdmin: boolean;
  /** moduleId (izinler.id string) → izinler */
  permissions: Record<string, PagePerm>;
  users: RoleUser[];
};

export type PermPage = {
  id: string;
  name: string;
  urlPrefix: string;
};

export type PermAction = 'view' | 'save' | 'remove';

/** Guard için eski sabit sayfa id’leri (m-ozet …) — sidebar bağlanana kadar */
export const PERM_PAGES: PermPage[] = INITIAL_MODULES.map((m) => ({
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

export function allFullPermissions(pages: PermPage[]): Record<string, PagePerm> {
  const out: Record<string, PagePerm> = {};
  for (const p of pages) out[p.id] = fullPerm();
  return out;
}

export function normalizePerm(p: PagePerm): PagePerm {
  if (!p.view) return { view: false, save: false, remove: false };
  return { ...p };
}

export function countGranted(role: AppRole, pages?: PermPage[]): { pages: number; total: number } {
  const ids = pages?.map((p) => p.id) ?? Object.keys(role.permissions);
  const total = ids.length;
  if (role.isAdmin) return { pages: total, total };
  let n = 0;
  for (const id of ids) {
    if (role.permissions[id]?.view) n += 1;
  }
  return { pages: n, total };
}

export function getPermForModule(role: AppRole | undefined, moduleId: string): PagePerm {
  if (!role) return emptyPerm();
  if (role.isAdmin) return fullPerm();
  return role.permissions[moduleId] ?? emptyPerm();
}

/** JWT role code → AppRole */
export function findSessionRole(
  roles: AppRole[],
  authRoles: string[] | undefined,
): AppRole | undefined {
  if (!roles.length) return undefined;
  if (authRoles?.length) {
    for (const code of authRoles) {
      const hit = roles.find((r) => r.code === code);
      if (hit) return hit;
    }
    const elevated = authRoles.some(
      (c) =>
        c === 'ROLE_YONETICI' ||
        c === 'ROLE_ADMIN' ||
        c === 'ROLE_SUPERAPP' ||
        c.includes('SUPERAPP'),
    );
    if (elevated) {
      return roles.find((r) => r.isAdmin) || roles.find((r) => r.code === 'ROLE_YONETICI');
    }
  }
  return roles.find((r) => r.isAdmin) || roles[0];
}

export const ACTION_LABELS: Record<PermAction, string> = {
  view: 'görüntüleme',
  save: 'kaydetme / ekleme',
  remove: 'silme',
};

/** @deprecated mock — PermissionContext API yükleyene kadar boş başlangıç */
export const INITIAL_ROLES: AppRole[] = [];
