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
      // Kataloğda yok → henüz bağlanmamış rota; kilitleme
      if (!mod) return { allowed: true };

      const p = getPermForModule(sessionRole, mod.id);
      if (p.view) return { allowed: true };
      return { allowed: false, pageName: mod.name, moduleId: mod.id };
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
