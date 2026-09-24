import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';

export type BrandAssets = {
  systemName: string;
  logoUrl: string;
  faviconUrl: string;
};

const DEFAULT_BRAND: BrandAssets = {
  systemName: 'GÜZEL Teknoloji®',
  logoUrl: '/brand/logo-full.png',
  faviconUrl: '/brand/logo-icon.png',
};

type BrandContextValue = BrandAssets & {
  refreshBrand: () => Promise<void>;
  applyBrand: (partial: Partial<BrandAssets>) => void;
};

const BrandContext = createContext<BrandContextValue | null>(null);

function setDocumentFavicon(href: string) {
  const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    document.head.appendChild(link);
    return;
  }
  for (const link of links) {
    link.href = href;
  }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandAssets>(DEFAULT_BRAND);

  const refreshBrand = useCallback(async () => {
    try {
      const data = await api.get<BrandAssets>('/api/settings/brand');
      setBrand({
        systemName: data.systemName || DEFAULT_BRAND.systemName,
        logoUrl: data.logoUrl || DEFAULT_BRAND.logoUrl,
        faviconUrl: data.faviconUrl || DEFAULT_BRAND.faviconUrl,
      });
    } catch {
      /* API yoksa varsayılan marka */
    }
  }, []);

  const applyBrand = useCallback((partial: Partial<BrandAssets>) => {
    setBrand((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    void refreshBrand();
  }, [refreshBrand]);

  useEffect(() => {
    setDocumentFavicon(brand.faviconUrl);
  }, [brand.faviconUrl]);

  const value = useMemo(
    () => ({ ...brand, refreshBrand, applyBrand }),
    [brand, refreshBrand, applyBrand],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand yalnızca BrandProvider içinde');
  return ctx;
}
