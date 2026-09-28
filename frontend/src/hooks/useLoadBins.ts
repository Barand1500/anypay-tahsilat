import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from './api';
import { setRuntimeBins } from './binStore';

type ApiBin = {
  id: string;
  bankId: string;
  bank: string;
  bin: string;
};

/** Oturum açılınca BIN listesini yükler (kart → banka) */
export function useLoadBins() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      setRuntimeBins([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.get<ApiBin[]>('/api/bins', token);
        if (cancelled) return;
        setRuntimeBins(
          list.map((r) => ({
            bin: r.bin,
            bankId: r.bankId,
            bankName: r.bank,
          })),
        );
      } catch {
        if (!cancelled) setRuntimeBins([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
}
