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
  telefon: string;
  roles: string[];
  twoFactor: boolean;
  /** Profil fotoğrafı URL (/uploads/...) */
  resimUrl: string | null;
  /** Boş = kısıt yok; dolu = yalnızca bu taksitler */
  installments: number[];
  /** Atanan şube / departman id’leri */
  branchIds: number[];
};

export type ProfileUpdatePayload = {
  adsoyad?: string;
  email?: string;
  telefon?: string;
  password?: string;
  twoFactor?: boolean;
  resimDataUrl?: string | null;
};

export type TwoFactorChallenge = {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresInSeconds: number;
};

type LoginResponse = TwoFactorChallenge | { requiresTwoFactor: false; token: string; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<TwoFactorChallenge | null>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  /** Hızlı giriş — önce mail ile kod iste */
  requestOtp: (email: string) => Promise<void>;
  loginWithOtp: (email: string, code: string) => Promise<void>;
  /** Şifremi unuttum — kod maili */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Kod doğrula → resetToken */
  verifyPasswordReset: (email: string, code: string) => Promise<string>;
  /** Yeni şifre kaydet */
  resetPassword: (resetToken: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<AuthUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'anypay_tahsilat_token';

function normalizeUser(raw: AuthUser): AuthUser {
  return {
    id: raw.id,
    email: raw.email,
    adsoyad: raw.adsoyad,
    telefon: raw.telefon || '',
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    twoFactor: Boolean(raw.twoFactor),
    resimUrl: raw.resimUrl || null,
    installments: Array.isArray(raw.installments)
      ? raw.installments.filter((n) => n >= 1 && n <= 12)
      : [],
    branchIds: Array.isArray(raw.branchIds)
      ? raw.branchIds.filter((n) => Number.isFinite(n) && n > 0)
      : [],
  };
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
        if (!cancelled) setUser(normalizeUser(me));
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
    const result = await api.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    if (result.requiresTwoFactor) return result;
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(normalizeUser(result.user));
    return null;
  }, []);

  const verifyTwoFactor = useCallback(async (challengeToken: string, code: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login/mfa/verify', {
      challengeToken,
      code,
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(normalizeUser(result.user));
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
    setUser(normalizeUser(result.user));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await api.post('/api/auth/forgot/request', { email });
  }, []);

  const verifyPasswordReset = useCallback(async (email: string, code: string) => {
    const data = await api.post<{ resetToken: string }>('/api/auth/forgot/verify', {
      email,
      code,
    });
    return data.resetToken;
  }, []);

  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    await api.post('/api/auth/forgot/reset', { resetToken, password });
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

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload) => {
      if (!token) throw new Error('Oturum bulunamadı');
      const updated = await api.patch<AuthUser>('/api/auth/me', payload, token);
      const next = normalizeUser(updated);
      setUser(next);
      return next;
    },
    [token],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      login,
      verifyTwoFactor,
      requestOtp,
      loginWithOtp,
      requestPasswordReset,
      verifyPasswordReset,
      resetPassword,
      logout,
      updateProfile,
    }),
    [
      user,
      token,
      booting,
      login,
      verifyTwoFactor,
      requestOtp,
      loginWithOtp,
      requestPasswordReset,
      verifyPasswordReset,
      resetPassword,
      logout,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir');
  return ctx;
}
