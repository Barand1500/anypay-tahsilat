import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';
export type AccentColor = 'blue' | 'green' | 'purple';

type ThemeContextValue = {
  theme: ThemeMode;
  accent: AccentColor;
  applyTheme: (next: ThemeMode) => void;
  applyAccent: (next: AccentColor) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'anypay_tahsilat_theme';
const ACCENT_KEY = 'anypay_tahsilat_accent';

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  const applyTheme = useCallback((next: ThemeMode) => setTheme(next), []);
  const applyAccent = useCallback((next: AccentColor) => setAccent(next), []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({ theme, accent, applyTheme, applyAccent, toggleTheme }),
    [theme, accent, applyTheme, applyAccent, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme yalnızca ThemeProvider içinde kullanılabilir');
  return ctx;
}
