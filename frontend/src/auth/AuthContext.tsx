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
  /** Hızlı giriş — önce mail ile kod iste */
  requestOtp: (email: string) => Promise<void>;
  loginWithOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'anypay_tahsilat_token';

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

      // Eski demo token temizle
      if (token === 'dev-local-admin') {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken(null);
          setUser(null);
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
    const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', {
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    await api.post('/api/auth/otp/request', { email });
  }, []);

  const loginWithOtp = useCallback(async (email: string, code: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login-otp', {
      email,
      code,
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) await api.post('/api/auth/logout', {}, token);
    } catch {
      // lokal temizle
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, booting, login, requestOtp, loginWithOtp, logout }),
    [user, token, booting, login, requestOtp, loginWithOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir');
  return ctx;
}
