import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { PermissionDeniedModal } from '../components/ui/PermissionDeniedModal';
import { api } from '../lib/api';
import type { AppModule } from '../pages/modules/mockModules';
import {
  ACTION_LABELS,
  findSessionRole,
  fullPerm,
  getPermForModule,
  type AppRole,
  type PermAction,
  type PermPage,
} from '../pages/roles/mockRoles';
import {
  findModuleForPath,
  isAlwaysAllowedPath,
  normalizePath,
  resolveModuleId,
} from './permResolve';

type DeniedState = {
  action: PermAction;
  pageName: string;
} | null;

type PathViewResult =
  | { allowed: true }
  | { allowed: false; pageName: string; moduleId: string };

type PermissionContextValue = {
  roles: AppRole[];
  setRoles: Dispatch<SetStateAction<AppRole[]>>;
  rolesLoading: boolean;
  refreshRoles: () => Promise<void>;
  /** Modül kataloğu (izinler) — path çözümleme */
  permPages: PermPage[];
  permPagesReady: boolean;
  sessionRole: AppRole | undefined;
  /** Yetki varsa true; yoksa modal açar ve false döner */
  guard: (moduleId: string, action: PermAction, pageName?: string) => boolean;
  can: (moduleId: string, action: PermAction) => boolean;
  /** Rota görüntüleme — eşleşen modül yoksa açık */
  canViewPath: (pathname: string) => PathViewResult;
  /** Sidebar / profil menü — yetkisiz öğeyi hiç gösterme */
  canViewNavItem: (pathname: string) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** Admin / yönetici kodu → tüm guard’lar açık */
function elevatedSession(role: AppRole | undefined, authRoles: string[] | undefined): boolean {
  if (role?.isAdmin) return true;
  return Boolean(
    authRoles?.some(
      (c) =>
        c === 'ROLE_YONETICI' ||
        c === 'ROLE_ADMIN' ||
        c === 'ROLE_SUPERAPP' ||
        c.includes('SUPERAPP'),
    ),
  );
}

/** Menü yolu ile ilgili modüller (üst + alt path) */
function relatedModules(pathname: string, pages: PermPage[]): PermPage[] {
  const base = normalizePath(pathname);
  return pages.filter((p) => {
    const pref = normalizePath(p.urlPrefix || '');
    if (!pref) return false;
    // Özet: yalnızca tam `/` veya `/ozet` — her path’i çocuk sayma
    if (base === '/') {
      return pref === '/' || pref === '/ozet';
    }
    return pref === base || pref.startsWith(`${base}/`);
  });
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permPages, setPermPages] = useState<PermPage[]>([]);
  const [permPagesReady, setPermPagesReady] = useState(false);
  const [denied, setDenied] = useState<DeniedState>(null);

  const refreshRoles = useCallback(async () => {
    if (!token) {
      setRoles([]);
      return;
    }
    setRolesLoading(true);
    try {
      const list = await api.get<AppRole[]>('/api/roles', token);
      setRoles(list);
    } catch {
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  useEffect(() => {
    if (!token) {
      setPermPages([]);
      setPermPagesReady(true);
      return;
    }
    let cancelled = false;
    setPermPagesReady(false);
    void (async () => {
      try {
        const list = await api.get<AppModule[]>('/api/modules', token);
        if (cancelled) return;
        setPermPages(
          list.map((m) => ({
            id: String(m.id),
            name: m.name,
            urlPrefix: m.urlPrefix,
          })),
        );
      } catch {
        if (!cancelled) setPermPages([]);
      } finally {
        if (!cancelled) setPermPagesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const sessionRole = useMemo(
    () => findSessionRole(roles, user?.roles),
    [roles, user?.roles],
  );

  const can = useCallback(
    (moduleId: string, action: PermAction) => {
      if (elevatedSession(sessionRole, user?.roles)) {
        const p = fullPerm();
        if (action === 'view') return p.view;
        if (action === 'save') return p.save;
        return p.remove;
      }
      const resolved = resolveModuleId(moduleId, permPages);
      const p = getPermForModule(sessionRole, resolved);
      if (action === 'view') return p.view;
      if (action === 'save') return p.view && p.save;
      return p.view && p.remove;
    },
    [sessionRole, user?.roles, permPages],
  );

  const canViewPath = useCallback(
    (pathname: string): PathViewResult => {
      if (isAlwaysAllowedPath(pathname)) return { allowed: true };
      if (elevatedSession(sessionRole, user?.roles)) return { allowed: true };

      const mod = findModuleForPath(pathname, permPages);
      if (mod) {
        const p = getPermForModule(sessionRole, mod.id);
        if (p.view) return { allowed: true };
        return { allowed: false, pageName: mod.name, moduleId: mod.id };
      }

      // Üst menü yolu (örn. /raporlar) — alt modüllerden en az biri açık mı?
      const related = relatedModules(pathname, permPages);
      if (related.length > 0) {
        const open = related.find((m) => getPermForModule(sessionRole, m.id).view);
        if (open) return { allowed: true };
        const first = related[0]!;
        return { allowed: false, pageName: first.name, moduleId: first.id };
      }

      // Katalogda yok → bilinmeyen rota; kilitleme (eski davranış)
      return { allowed: true };
    },
    [sessionRole, user?.roles, permPages],
  );

  /** Menü: bu path veya altındaki hiç bir modülde view yoksa gizle */
  const canViewNavItem = useCallback(
    (pathname: string): boolean => {
      if (isAlwaysAllowedPath(pathname)) return true;
      if (elevatedSession(sessionRole, user?.roles)) return true;

      const related = relatedModules(pathname, permPages);
      if (related.length === 0) {
        // Katalogda karşılık yok → menüde gösterme (önceden yanlışlıkla açık kalıyordu)
        return false;
      }
      return related.some((m) => getPermForModule(sessionRole, m.id).view);
    },
    [sessionRole, user?.roles, permPages],
  );

  const guard = useCallback(
    (moduleId: string, action: PermAction, pageName?: string) => {
      if (can(moduleId, action)) return true;
      const resolved = resolveModuleId(moduleId, permPages);
      const fromList = permPages.find((p) => p.id === resolved)?.name;
      setDenied({
        action,
        pageName: pageName || fromList || 'bu sayfa',
      });
      return false;
    },
    [can, permPages],
  );

  const value = useMemo(
    () => ({
      roles,
      setRoles,
      rolesLoading,
      refreshRoles,
      permPages,
      permPagesReady,
      sessionRole,
      guard,
      can,
      canViewPath,
      canViewNavItem,
    }),
    [
      roles,
      rolesLoading,
      refreshRoles,
      permPages,
      permPagesReady,
      sessionRole,
      guard,
      can,
      canViewPath,
      canViewNavItem,
    ],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
      {denied ? (
        <PermissionDeniedModal
          message={`Bu işlemi yapmaya yetkiniz yoktur. (${denied.pageName} — ${ACTION_LABELS[denied.action]})`}
          onClose={() => setDenied(null)}
        />
      ) : null}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermission yalnızca PermissionProvider içinde');
  return ctx;
}
