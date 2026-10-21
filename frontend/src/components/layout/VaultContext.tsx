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
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

export type VaultDock = 'float' | 'header' | 'footer';

export type VaultEntry = {
  id: string;
  tip: string;
  etiket: string;
  baslik: string;
  deger: string;
  sira: number;
};

export const VAULT_TAGS = [
  { tip: 'iban', etiket: 'IBAN', color: 'emerald' },
  { tip: 'kredi_karti', etiket: 'Kredi Kartı', color: 'sky' },
  { tip: 'banka_karti', etiket: 'Banka Kartı', color: 'violet' },
] as const;

export type VaultTagColor = 'emerald' | 'sky' | 'violet' | 'amber';

export function tagColorFor(tip: string): VaultTagColor {
  const hit = VAULT_TAGS.find((t) => t.tip === tip);
  return hit?.color ?? 'amber';
}

export function tagClass(color: VaultTagColor): string {
  const map: Record<VaultTagColor, string> = {
    emerald:
      'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
    sky: 'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300',
    violet:
      'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
    amber: 'bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-300',
  };
  return map[color];
}

type VaultContextValue = {
  open: boolean;
  closing: boolean;
  dock: VaultDock;
  pos: { x: number; y: number };
  hasPassword: boolean;
  unlocked: boolean;
  unlockToken: string | null;
  mustChangePassword: boolean;
  entries: VaultEntry[];
  loadingEntries: boolean;
  sidebarBtnRef: React.RefObject<HTMLButtonElement | null>;
  openVault: () => void;
  closeVault: () => void;
  setDock: (d: VaultDock) => void;
  setPos: (p: { x: number; y: number }) => void;
  setUnlocked: (token: string | null, mustChange?: boolean) => void;
  lockVault: () => void;
  refreshStatus: () => Promise<void>;
  reloadEntries: () => Promise<void>;
  vaultHeaders: () => Record<string, string>;
  finishClose: () => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dock, setDock] = useState<VaultDock>('float');
  const [pos, setPos] = useState({ x: 96, y: 96 });
  const [hasPassword, setHasPassword] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const sidebarBtnRef = useRef<HTMLButtonElement | null>(null);

  const unlocked = !hasPassword || Boolean(unlockToken);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const s = await api.get<{ hasPassword: boolean }>('/api/vault/status', token);
      setHasPassword(Boolean(s.hasPassword));
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const vaultHeaders = useCallback(() => {
    const h: Record<string, string> = {};
    if (unlockToken) h['X-Vault-Token'] = unlockToken;
    return h;
  }, [unlockToken]);

  const reloadEntries = useCallback(async () => {
    if (!token) return;
    if (hasPassword && !unlockToken) {
      setEntries([]);
      return;
    }
    setLoadingEntries(true);
    try {
      const list = await requestVaultGet<VaultEntry[]>('/api/vault/entries', token, unlockToken);
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [token, hasPassword, unlockToken]);

  useEffect(() => {
    if (open && unlocked) void reloadEntries();
  }, [open, unlocked, reloadEntries]);

  const openVault = useCallback(() => {
    setClosing(false);
    setOpen(true);
    if (dock === 'float') {
      const btn = sidebarBtnRef.current;
      if (btn) {
        const r = btn.getBoundingClientRect();
        setPos({
          x: Math.min(window.innerWidth - 380, Math.max(16, r.right + 12)),
          y: Math.min(window.innerHeight - 420, Math.max(16, r.top - 40)),
        });
      }
    }
  }, [dock]);

  const closeVault = useCallback(() => {
    setClosing(true);
  }, []);

  const finishClose = useCallback(() => {
    setOpen(false);
    setClosing(false);
    setUnlockToken(null);
    setMustChangePassword(false);
    setEntries([]);
    setDock('float');
  }, []);

  // closing flag consumed by widget animation → calls finish via context
  const setUnlocked = useCallback((t: string | null, mustChange = false) => {
    setUnlockToken(t);
    setMustChangePassword(mustChange);
  }, []);

  const lockVault = useCallback(() => {
    setUnlockToken(null);
    setMustChangePassword(false);
    setEntries([]);
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      open,
      closing,
      dock,
      pos,
      hasPassword,
      unlocked,
      unlockToken,
      mustChangePassword,
      entries,
      loadingEntries,
      sidebarBtnRef,
      openVault,
      closeVault,
      setDock,
      setPos,
      setUnlocked,
      lockVault,
      refreshStatus,
      reloadEntries,
      vaultHeaders,
      finishClose,
    }),
    [
      open,
      closing,
      dock,
      pos,
      hasPassword,
      unlocked,
      unlockToken,
      mustChangePassword,
      entries,
      loadingEntries,
      openVault,
      closeVault,
      setUnlocked,
      lockVault,
      refreshStatus,
      reloadEntries,
      vaultHeaders,
      finishClose,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault: provider yok');
  return ctx;
}

async function requestVaultGet<T>(
  path: string,
  token: string,
  unlockToken: string | null,
): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('Authorization', `Bearer ${token}`);
  if (unlockToken) headers.set('X-Vault-Token', unlockToken);
  const res = await fetch(path, { method: 'GET', headers });
  const json = (await res.json()) as { success: boolean; message?: string; data?: T };
  if (!res.ok || !json.success) throw new Error(json.message || 'İstek başarısız');
  return json.data as T;
}

export async function vaultFetch<T>(
  method: string,
  path: string,
  token: string,
  unlockToken: string | null,
  body?: unknown,
): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('Authorization', `Bearer ${token}`);
  if (unlockToken) headers.set('X-Vault-Token', unlockToken);
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; message?: string; data?: T };
  if (!res.ok || !json.success) throw new Error(json.message || 'İstek başarısız');
  return json.data as T;
}
