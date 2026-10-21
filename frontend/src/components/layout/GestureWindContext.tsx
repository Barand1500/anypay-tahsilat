import gsap from 'gsap';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { type GestureAction } from './gestureActions';
import { preparePath, type Pt } from './gesturePath';

const LS_ENABLED = 'anypay.gestureWind.enabled.v1';
const LS_GESTURES = 'anypay.gestureWind.list.v1';

export type SavedGesture = {
  id: string;
  name: string;
  /** Normalize edilmiş yol */
  path: Pt[];
  action: GestureAction;
  createdAt: number;
};

type GestureWindValue = {
  enabled: boolean;
  gestures: SavedGesture[];
  settingsOpen: boolean;
  settingsBtnRef: RefObject<HTMLButtonElement | null>;
  toggle: () => void;
  setSettingsOpen: (on: boolean) => void;
  openSettings: () => void;
  addGesture: (g: Omit<SavedGesture, 'id' | 'createdAt'>) => void;
  removeGesture: (id: string) => void;
  /** Canlı çizim noktaları (ekran) */
  liveStroke: Pt[] | null;
  setLiveStroke: (pts: Pt[] | null) => void;
};

const GestureWindContext = createContext<GestureWindValue | null>(null);

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED) === '1';
  } catch {
    return false;
  }
}

function loadGestures(): SavedGesture[] {
  try {
    const raw = localStorage.getItem(LS_GESTURES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedGesture[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g) => g && Array.isArray(g.path) && g.path.length >= 2 && g.action);
  } catch {
    return [];
  }
}

function saveGestures(list: SavedGesture[]) {
  localStorage.setItem(LS_GESTURES, JSON.stringify(list));
}

function playMouseTo(target: HTMLElement, onClick: () => void) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    onClick();
    return;
  }
  const r = target.getBoundingClientRect();
  const endX = r.left + r.width / 2;
  const endY = r.top + r.height / 2;
  const startX = Math.min(window.innerWidth - 40, endX - 140);
  const startY = Math.max(48, endY - 80);

  const layer = document.createElement('div');
  layer.id = 'gw-mouse-ghost';
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '13000',
    pointerEvents: 'none',
  });
  const cursor = document.createElement('div');
  cursor.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5.5 3.5 5.5 16.5 9.2 13.2 11.5 19.2 13.6 18.3 11.3 12.4 15.5 12.4 5.5 3.5Z" fill="var(--panel-ink)" stroke="var(--panel-elevated)" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  Object.assign(cursor.style, {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))',
  });
  layer.appendChild(cursor);
  document.body.appendChild(layer);

  gsap.timeline({
    onComplete: () => {
      layer.remove();
      onClick();
    },
  })
    .to(cursor, { left: endX - 4, top: endY - 2, duration: 0.72, ease: 'power2.inOut' })
    .to(cursor, { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 });
}

export function GestureWindProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(loadEnabled);
  const [gestures, setGestures] = useState<SavedGesture[]>(loadGestures);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveStroke, setLiveStroke] = useState<Pt[] | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const animLock = useRef(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const toggle = useCallback(() => {
    if (animLock.current) return;
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(LS_ENABLED, next ? '1' : '0');
      if (next) {
        animLock.current = true;
        // Ayarlar butonu DOM’da görünsün
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const btn = settingsBtnRef.current;
            if (!btn) {
              setSettingsOpen(true);
              animLock.current = false;
              return;
            }
            playMouseTo(btn, () => {
              setSettingsOpen(true);
              animLock.current = false;
            });
          });
        });
      } else {
        setSettingsOpen(false);
        setLiveStroke(null);
      }
      return next;
    });
  }, []);

  const addGesture = useCallback((g: Omit<SavedGesture, 'id' | 'createdAt'>) => {
    setGestures((prev) => {
      const next = [
        ...prev,
        {
          ...g,
          id: `gw-${Date.now()}`,
          createdAt: Date.now(),
          path: preparePath(g.path),
        },
      ];
      saveGestures(next);
      return next;
    });
  }, []);

  const removeGesture = useCallback((id: string) => {
    setGestures((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveGestures(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      gestures,
      settingsOpen,
      settingsBtnRef,
      toggle,
      setSettingsOpen,
      openSettings,
      addGesture,
      removeGesture,
      liveStroke,
      setLiveStroke,
    }),
    [
      enabled,
      gestures,
      settingsOpen,
      toggle,
      openSettings,
      addGesture,
      removeGesture,
      liveStroke,
    ],
  );

  return (
    <GestureWindContext.Provider value={value}>{children}</GestureWindContext.Provider>
  );
}

export function useGestureWind() {
  const ctx = useContext(GestureWindContext);
  if (!ctx) throw new Error('useGestureWind yalnızca GestureWindProvider içinde');
  return ctx;
}

/** Ayarlar butonu — header veya footer */
export function GestureWindSettingsButton() {
  const { enabled, settingsBtnRef, openSettings } = useGestureWind();
  if (!enabled) return null;
  return (
    <button
      ref={settingsBtnRef}
      type="button"
      data-gw-settings
      data-km-jump
      onClick={openSettings}
      title="Jest Rüzgarı ayarları"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-brand-500)]/55 bg-[var(--brand-soft-bg)] px-2.5 text-xs font-bold text-[var(--brand-on-soft)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] transition hover:brightness-110"
    >
      <WindIcon />
      Ayarlar
    </button>
  );
}

function WindIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h10a3 3 0 1 0-3-3M4 12h14a3 3 0 1 1-3 3M4 16h8a2.5 2.5 0 1 1-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
