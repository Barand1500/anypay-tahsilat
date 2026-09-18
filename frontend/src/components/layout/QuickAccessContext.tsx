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

const STORAGE_KEY = 'anypay_tahsilat_quick_access';
export const QUICK_SLOTS = 4;

export type QuickSlot = string | null; // nav `to`

type DragPayload = {
  item: NavItem;
  x: number;
  y: number;
};

type QuickAccessValue = {
  slots: QuickSlot[];
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
    if (!raw) return Array(QUICK_SLOTS).fill(null);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Array(QUICK_SLOTS).fill(null);
    return Array.from({ length: QUICK_SLOTS }, (_, i) =>
      typeof parsed[i] === 'string' ? (parsed[i] as string) : null,
    );
  } catch {
    return Array(QUICK_SLOTS).fill(null);
  }
}

export function QuickAccessProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<QuickSlot[]>(() =>
    typeof window === 'undefined' ? Array(QUICK_SLOTS).fill(null) : readSlots(),
  );
  const [drag, setDrag] = useState<DragPayload | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

  const setSlot = useCallback((index: number, to: string | null) => {
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
  }, []);

  const startDrag = useCallback((item: NavItem, x: number, y: number) => {
    setDrag({ item, x, y });
  }, []);

  const moveDrag = useCallback((x: number, y: number) => {
    setDrag((d) => (d ? { ...d, x, y } : null));
  }, []);

  const cancelDrag = useCallback(() => setDrag(null), []);

  const endDrag = useCallback(
    (slotIndex?: number) => {
      setDrag((d) => {
        if (d && slotIndex != null && slotIndex >= 0 && slotIndex < QUICK_SLOTS) {
          setSlot(slotIndex, d.item.to);
        }
        return null;
      });
    },
    [setSlot],
  );

  const value = useMemo(
    () => ({ slots, drag, setSlot, startDrag, moveDrag, endDrag, cancelDrag }),
    [slots, drag, setSlot, startDrag, moveDrag, endDrag, cancelDrag],
  );

  return <QuickAccessContext.Provider value={value}>{children}</QuickAccessContext.Provider>;
}

export function useQuickAccess() {
  const ctx = useContext(QuickAccessContext);
  if (!ctx) throw new Error('useQuickAccess yalnızca QuickAccessProvider içinde');
  return ctx;
}
