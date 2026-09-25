import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { resolveNightAutoTheme } from '../pages/settings/personalPrefs';

export type ThemeMode = 'light' | 'dark';
export type AccentColor = 'blue' | 'green' | 'purple';

type ThemeContextValue = {
  theme: ThemeMode;
  accent: AccentColor;
  applyTheme: (next: ThemeMode) => void;
  applyAccent: (next: AccentColor) => void;
  toggleTheme: () => void;
  /** Gece otomatik tercih değişince yeniden değerlendir */
  refreshNightAuto: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'anypay_tahsilat_theme';
const ACCENT_KEY = 'anypay_tahsilat_accent';
/** Elle tema değişince gece otomatik bir sonraki kontrolde yeniden alınır — session pause yok; schedule kazanır ama manuel toggle sonrası kısa süre tut */

function readTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function readAccent(): AccentColor {
  const v = localStorage.getItem(ACCENT_KEY);
  if (v === 'green' || v === 'purple' || v === 'blue') return v;
  return 'blue';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'light' : readTheme(),
  );
  const [accent, setAccent] = useState<AccentColor>(() =>
    typeof window === 'undefined' ? 'blue' : readAccent(),
  );
  const manualUntilRef = useRef(0);

  const syncNight = useCallback(() => {
    if (Date.now() < manualUntilRef.current) return;
    const auto = resolveNightAutoTheme();
    if (!auto) return;
    setTheme((cur) => (cur === auto ? cur : auto));
  }, []);

  useEffect(() => {
    syncNight();
    const id = window.setInterval(syncNight, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') syncNight();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [syncNight]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  const applyTheme = useCallback((next: ThemeMode) => {
    // Elle değişim: ~90 sn gece otomatik üzerine yazmasın
    manualUntilRef.current = Date.now() + 90_000;
    setTheme(next);
  }, []);
  const applyAccent = useCallback((next: AccentColor) => setAccent(next), []);
  const toggleTheme = useCallback(() => {
    manualUntilRef.current = Date.now() + 90_000;
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);
  const refreshNightAuto = useCallback(() => {
    manualUntilRef.current = 0;
    syncNight();
  }, [syncNight]);

  const value = useMemo(
    () => ({
      theme,
      accent,
      applyTheme,
      applyAccent,
      toggleTheme,
      refreshNightAuto,
    }),
    [theme, accent, applyTheme, applyAccent, toggleTheme, refreshNightAuto],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme yalnızca ThemeProvider içinde kullanılabilir');
  return ctx;
}
