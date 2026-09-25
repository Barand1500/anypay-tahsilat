import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { CurrencyDef } from '../pages/definitions/currencyTypes';

/** Aktif para birimleri — ödeme / istek formları */
export function useActiveCurrencies() {
  const { token } = useAuth();
  const [currencies, setCurrencies] = useState<CurrencyDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.get<CurrencyDef[]>('/api/currencies?active=1', token);
      setCurrencies(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Para birimleri yüklenemedi');
      setCurrencies([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultId =
    currencies.find((c) => c.shortName === 'TL' || c.shortName === 'TRY')?.id ??
    currencies[0]?.id ??
    '';

  return { currencies, loading, error, defaultId, reload: load };
}
