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
import {
  ACTION_LABELS,
  findSessionRole,
  fullPerm,
  getPermForModule,
  PERM_PAGES,
  type AppRole,
  type PermAction,
} from '../pages/roles/mockRoles';

type DeniedState = {
  action: PermAction;
  pageName: string;
} | null;

type PermissionContextValue = {
  roles: AppRole[];
  setRoles: Dispatch<SetStateAction<AppRole[]>>;
  rolesLoading: boolean;
  refreshRoles: () => Promise<void>;
  sessionRole: AppRole | undefined;
  /** Yetki varsa true; yoksa modal açar ve false döner */
  guard: (moduleId: string, action: PermAction, pageName?: string) => boolean;
  can: (moduleId: string, action: PermAction) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** Sidebar bağlanana kadar: admin / yönetici kodu → tüm m-* guard’lar açık */
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
      // Canlı izinler sayısal id; eski guard m-* — eşleşme yoksa kapalı
      const p = getPermForModule(sessionRole, moduleId);
      if (action === 'view') return p.view;
      if (action === 'save') return p.view && p.save;
      return p.view && p.remove;
    },
    [sessionRole, user?.roles],
  );

  const guard = useCallback(
    (moduleId: string, action: PermAction, pageName?: string) => {
      if (can(moduleId, action)) return true;
      const fromList = PERM_PAGES.find((p) => p.id === moduleId)?.name;
      setDenied({
        action,
        pageName: pageName || fromList || 'bu sayfa',
      });
      return false;
    },
    [can],
  );

  const value = useMemo(
    () => ({
      roles,
      setRoles,
      rolesLoading,
      refreshRoles,
      sessionRole,
      guard,
      can,
    }),
    [roles, rolesLoading, refreshRoles, sessionRole, guard, can],
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
