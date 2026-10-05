import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

export function useErpActive() {
  const { token } = useAuth();
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setActive(null);
      return;
    }
    let cancelled = false;
    api.get<{ active: boolean }>('/api/settings/erp-status', token)
      .then((value) => { if (!cancelled) setActive(value.active === true); })
      .catch(() => { if (!cancelled) setActive(false); });
    return () => { cancelled = true; };
  }, [token]);

  return active;
}
