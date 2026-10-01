import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePermission } from './PermissionContext';

/** Silme yetkisi yoksa silme eylemini arayüzden tamamen kaldırır. */
export function CanRemove({ children, path }: { children: ReactNode; path?: string }) {
  const location = useLocation();
  const { canRemovePath, permPagesReady, rolesLoading } = usePermission();
  if (!permPagesReady || rolesLoading || !canRemovePath(path || location.pathname)) return null;
  return <>{children}</>;
}
