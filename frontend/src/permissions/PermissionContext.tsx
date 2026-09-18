import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { PermissionDeniedModal } from '../components/ui/PermissionDeniedModal';
import {
  ACTION_LABELS,
  getPermForModule,
  INITIAL_ROLES,
  PERM_PAGES,
  resolveSessionRoleId,
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
  sessionRole: AppRole | undefined;
  /** Yetki varsa true; yoksa modal açar ve false döner */
  guard: (moduleId: string, action: PermAction, pageName?: string) => boolean;
  can: (moduleId: string, action: PermAction) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>(() =>
    INITIAL_ROLES.map((r) => ({
      ...r,
      permissions: { ...r.permissions },
      users: [...r.users],
    })),
  );
  const [denied, setDenied] = useState<DeniedState>(null);

  const sessionRole = useMemo(() => {
    const id = resolveSessionRoleId(user?.roles);
    return roles.find((r) => r.id === id);
  }, [roles, user?.roles]);

  const can = useCallback(
    (moduleId: string, action: PermAction) => {
      const p = getPermForModule(sessionRole, moduleId);
      if (action === 'view') return p.view;
      if (action === 'save') return p.view && p.save;
      return p.view && p.remove;
    },
    [sessionRole],
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
    () => ({ roles, setRoles, sessionRole, guard, can }),
    [roles, sessionRole, guard, can],
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
