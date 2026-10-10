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
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length) setPosRedirects(rows);
      } catch {
        /* pay view / önceki haritayı silme */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
