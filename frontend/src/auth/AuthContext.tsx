import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiUnavailableError } from '../lib/api';

export type AuthUser = {
  id: number;
  email: string;
  adsoyad: string | null;
  roles: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Geçici kod ile giriş — SMTP sonra; şimdilik DEV mock */
  loginWithOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'anypay_tahsilat_token';

/** Frontend-only geliştirme oturumu — backend yokken panel denemek için (sonra silinecek) */
const DEV_TOKEN = 'dev-local-admin';
const DEV_USER: AuthUser = {
  id: 1,
  email: 'admin@guzelteknoloji.com',
  adsoyad: 'Ercan Güzel',
  roles: ['ROLE_SUPERAPP'],
};

function isDemoCreds(email: string, password: string) {
  return (
    email.trim().toLowerCase() === 'admin@guzelteknoloji.com' &&
    password === '123456'
  );
}

function isDemoOtp(email: string, code: string) {
  return (
    email.trim().toLowerCase() === 'admin@guzelteknoloji.com' &&
    code.trim() === '123456'
  );
}

/** Lokal DEV veya API henüz yokken (statik yayın) demo girişe izin */
function canUseDemoLogin(err: unknown) {
  return import.meta.env.DEV || err instanceof ApiUnavailableError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!token) {
        setUser(null);
        setBooting(false);
        return;
      }

      if (token === DEV_TOKEN) {
        if (!cancelled) {
          setUser(DEV_USER);
          setBooting(false);
        }
        return;
      }

      try {
        const me = await api.get<AuthUser>('/api/auth/me', token);
        if (!cancelled) setUser(me);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', {
        email,
        password,
      });
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (err) {
      if (canUseDemoLogin(err) && isDemoCreds(email, password)) {
        localStorage.setItem(TOKEN_KEY, DEV_TOKEN);
        setToken(DEV_TOKEN);
        setUser(DEV_USER);
        return;
      }
      if (err instanceof ApiUnavailableError) {
        throw new Error('Sunucu API henüz hazır değil. Demo: admin@guzelteknoloji.com / 123456');
      }
      throw err instanceof Error ? err : new Error('Giriş başarısız');
    }
  }, []);

  const loginWithOtp = useCallback(async (email: string, code: string) => {
    try {
      const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login-otp', {
        email,
        code,
      });
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (err) {
      if (canUseDemoLogin(err) && isDemoOtp(email, code)) {
        localStorage.setItem(TOKEN_KEY, DEV_TOKEN);
        setToken(DEV_TOKEN);
        setUser(DEV_USER);
        return;
      }
      if (err instanceof ApiUnavailableError || import.meta.env.DEV) {
        throw new Error('Geçersiz kod. Demo: admin@guzelteknoloji.com / 123456');
      }
      throw err instanceof Error ? err : new Error('Geçersiz kod');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token && token !== DEV_TOKEN) await api.post('/api/auth/logout', {}, token);
    } catch {
      // lokal temizle
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, booting, login, loginWithOtp, logout }),
    [user, token, booting, login, loginWithOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir');
  return ctx;
}
