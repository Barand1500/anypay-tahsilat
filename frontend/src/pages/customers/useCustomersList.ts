import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import type { Customer } from './mockCustomers';
import { mapCustomer, type ApiCustomer } from './customersApi';

type Options = {
  enabled?: boolean;
  /** `root` = yalnızca üst müşteriler; undefined = hepsi */
  parentId?: 'root' | number | 'all';
  q?: string;
};

/** Müşteri listesi — /api/customers */
export function useCustomersList(opts: Options = {}) {
  const { token } = useAuth();
  const enabled = opts.enabled !== false;
  const parentId = opts.parentId ?? 'all';
  const q = opts.q ?? '';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !enabled) {
      setCustomers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (parentId === 'root') params.set('ust', 'root');
      else if (typeof parentId === 'number') params.set('ust', String(parentId));
      else params.set('ust', 'all');
      if (q.trim()) params.set('q', q.trim());
      const qs = params.toString();
      const raw = await api.get<ApiCustomer[]>(
        `/api/customers${qs ? `?${qs}` : ''}`,
        token,
      );
      setCustomers(raw.map(mapCustomer));
    } catch (err) {
      setCustomers([]);
      setError(err instanceof Error ? err.message : 'Müşteriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, enabled, parentId, q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { customers, loading, error, reload };
}
