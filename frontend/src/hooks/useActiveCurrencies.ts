import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { CurrencyDef } from '../pages/definitions/currencyTypes';
import { getDefaultCurrency } from '../pages/settings/defaultsStore';

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

  const preferred = getDefaultCurrency().trim();
  const byId = preferred ? currencies.find((c) => c.id === preferred) : undefined;
  const byCode = preferred
    ? currencies.find(
        (c) =>
          c.shortName.toUpperCase() === preferred.toUpperCase() ||
          (preferred === 'TRY' && (c.shortName === 'TL' || c.shortName === 'TRY')),
      )
    : undefined;
  const defaultId =
    byId?.id ??
    byCode?.id ??
    currencies.find((c) => c.shortName === 'TL' || c.shortName === 'TRY')?.id ??
    currencies[0]?.id ??
    '';

  return { currencies, loading, error, defaultId, reload: load };
}
