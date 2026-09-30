import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { NavItem } from './navItems';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

const STORAGE_KEY = 'anypay_tahsilat_quick_access';
const MAX_QUICK_SLOTS = 7;
export type QuickAccessConfig = { enabled: boolean; slotCount: number };
const DEFAULT_CONFIG: QuickAccessConfig = { enabled: true, slotCount: 4 };

export type QuickSlot = string | null; // nav `to`

type DragPayload = {
  item: NavItem;
  x: number;
  y: number;
};

type QuickAccessValue = {
  slots: QuickSlot[];
  config: QuickAccessConfig;
  setConfig: (config: QuickAccessConfig) => void;
  drag: DragPayload | null;
  setSlot: (index: number, to: string | null) => void;
  startDrag: (item: NavItem, x: number, y: number) => void;
  moveDrag: (x: number, y: number) => void;
  endDrag: (slotIndex?: number) => void;
  cancelDrag: () => void;
};

const QuickAccessContext = createContext<QuickAccessValue | null>(null);

function readSlots(): QuickSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(MAX_QUICK_SLOTS).fill(null);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Array(MAX_QUICK_SLOTS).fill(null);
    return Array.from({ length: MAX_QUICK_SLOTS }, (_, i) =>
      typeof parsed[i] === 'string' ? (parsed[i] as string) : null,
    );
  } catch {
    return Array(MAX_QUICK_SLOTS).fill(null);
  }
}

export function QuickAccessProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [slots, setSlots] = useState<QuickSlot[]>(() =>
    typeof window === 'undefined' ? Array(MAX_QUICK_SLOTS).fill(null) : readSlots(),
  );
  const [config, setConfig] = useState<QuickAccessConfig>(DEFAULT_CONFIG);
  const [drag, setDrag] = useState<DragPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.get<QuickAccessConfig>('/api/settings/quick-access', token)
      .then((saved) => {
        if (!cancelled) setConfig(saved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

  const setSlot = useCallback((index: number, to: string | null) => {
    if (!config.enabled || index < 0 || index >= config.slotCount) return;
    setSlots((prev) => {
      const next = [...prev];
      // Aynı sayfa başka yuvadaysa temizle
      if (to) {
        for (let i = 0; i < next.length; i += 1) {
          if (next[i] === to) next[i] = null;
        }
      }
      next[index] = to;
      return next;
    });
  }, [config]);

  const startDrag = useCallback((item: NavItem, x: number, y: number) => {
    if (config.enabled) setDrag({ item, x, y });
  }, [config.enabled]);

  const moveDrag = useCallback((x: number, y: number) => {
    setDrag((d) => (d ? { ...d, x, y } : null));
  }, []);

  const cancelDrag = useCallback(() => setDrag(null), []);

  const endDrag = useCallback(
    (slotIndex?: number) => {
      setDrag((d) => {
        if (d && config.enabled && slotIndex != null && slotIndex >= 0 && slotIndex < config.slotCount) {
          setSlot(slotIndex, d.item.to);
        }
        return null;
      });
    },
    [setSlot, config],
  );

  const value = useMemo(
    () => ({ slots, config, setConfig, drag, setSlot, startDrag, moveDrag, endDrag, cancelDrag }),
    [slots, config, drag, setSlot, startDrag, moveDrag, endDrag, cancelDrag],
  );

  return <QuickAccessContext.Provider value={value}>{children}</QuickAccessContext.Provider>;
}

export function useQuickAccess() {
  const ctx = useContext(QuickAccessContext);
  if (!ctx) throw new Error('useQuickAccess yalnızca QuickAccessProvider içinde');
  return ctx;
}
