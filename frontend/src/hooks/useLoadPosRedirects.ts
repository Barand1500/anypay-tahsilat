import { useEffect } from 'react';
import { api } from '../lib/api';
import {
  setPosDisplayMeta,
  type DefaultPosBrand,
  type PosRedirect,
} from '../lib/posRedirectStore';

type PosDisplayMetaApi = {
  redirects?: PosRedirect[];
  defaultPos?: DefaultPosBrand | null;
};

/** Ortak Sanal POS + varsayılan Sanal POS — public (auth gerekmez) */
export function useLoadPosRedirects() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<PosDisplayMetaApi | PosRedirect[]>(
          '/api/common-virtual-pos/redirects',
        );
        if (cancelled) return;
        // Yeni şekil: { redirects, defaultPos }
        if (data && !Array.isArray(data) && Array.isArray(data.redirects)) {
          setPosDisplayMeta({
            redirects: data.redirects,
            defaultPos: data.defaultPos ?? null,
          });
          return;
        }
        // Eski şekil: dizi (geriye uyum)
        if (Array.isArray(data) && data.length) {
          setPosDisplayMeta({ redirects: data });
        }
      } catch {
        /* pay view / önceki haritayı silme */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
