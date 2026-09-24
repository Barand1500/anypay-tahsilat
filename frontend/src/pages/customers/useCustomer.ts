import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import type { Customer } from './mockCustomers';
import { mapCustomer, type ApiCustomer } from './customersApi';

/** Tek müşteri — /api/customers/:id */
export function useCustomer(id: string | undefined) {
  const { token } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !id) {
      setCustomer(null);
      setLoading(false);
      setError(id ? 'Oturum gerekli' : null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get<ApiCustomer>(`/api/customers/${encodeURIComponent(id)}`, token);
      setCustomer(mapCustomer(raw));
    } catch (err) {
      setCustomer(null);
      setError(err instanceof Error ? err.message : 'Müşteri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { customer, setCustomer, loading, error, reload };
}
