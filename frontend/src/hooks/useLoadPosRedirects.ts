import { useEffect } from 'react';
import { api } from '../lib/api';
import { setPosRedirects, type PosRedirect } from '../lib/posRedirectStore';

/** Ortak Sanal POS yönlendirme haritası — public (auth gerekmez) */
export function useLoadPosRedirects() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await api.get<PosRedirect[]>('/api/common-virtual-pos/redirects');
        if (!cancelled) setPosRedirects(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setPosRedirects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
