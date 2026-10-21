import gsap from 'gsap';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type DockItemId = 'search' | 'quick' | 'theme' | 'profile' | 'badges' | 'legal';

/** Varsayılan: sol araçlar → rozetler → tema + profil sağda */
export const DEFAULT_DOCK_ORDER: DockItemId[] = [
  'search',
  'quick',
  'badges',
  'legal',
  'theme',
  'profile',
];

const LS_ENABLED = 'anypay.dockMode.enabled.v1';
const LS_ORDER = 'anypay.dockMode.order.v1';

/** Header’dan düşecek öğeler (animasyon kaynakları) */
export const DOCK_FALL_IDS: DockItemId[] = ['search', 'quick', 'theme', 'profile'];

type DockModeValue = {
  enabled: boolean;
  /** Footer öğeleri sürüklenirken true — “Taşımayı kaydet” ile biter */
  reordering: boolean;
  order: DockItemId[];
  animating: boolean;
  toggle: () => void;
  finishReorder: () => void;
  setOrder: (next: DockItemId[]) => void;
  moveItem: (fromId: DockItemId, toId: DockItemId) => void;
};

const DockModeContext = createContext<DockModeValue | null>(null);

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED) === '1';
  } catch {
    return false;
  }
}

function loadOrder(): DockItemId[] {
  try {
    const raw = localStorage.getItem(LS_ORDER);
    if (!raw) return [...DEFAULT_DOCK_ORDER];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [...DEFAULT_DOCK_ORDER];
    const valid = parsed.filter((id): id is DockItemId =>
      DEFAULT_DOCK_ORDER.includes(id as DockItemId),
    );
    const missing = DEFAULT_DOCK_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return [...DEFAULT_DOCK_ORDER];
  }
}

function saveEnabled(on: boolean) {
  localStorage.setItem(LS_ENABLED, on ? '1' : '0');
}

function saveOrder(order: DockItemId[]) {
  localStorage.setItem(LS_ORDER, JSON.stringify(order));
}

function clearFlyingLayer() {
  document.getElementById('dock-fly-layer')?.remove();
}

/**
 * Header widget’larını footer hedeflerine yumuşak düşürme / geri uçurma.
 */
function flyBetween(
  pairs: { from: DOMRect; to: DOMRect; label: string }[],
  direction: 'down' | 'up',
  onDone: () => void,
) {
  clearFlyingLayer();
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    clearFlyingLayer();
    onDone();
  };

  if (!pairs.length) {
    done();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    done();
    return;
  }

  const layer = document.createElement('div');
  layer.id = 'dock-fly-layer';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '12000',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(layer);

  const ghosts: HTMLElement[] = [];
  for (const p of pairs) {
    const g = document.createElement('div');
    Object.assign(g.style, {
      position: 'fixed',
      left: `${p.from.left}px`,
      top: `${p.from.top}px`,
      width: `${Math.max(p.from.width, 36)}px`,
      height: `${Math.max(p.from.height, 36)}px`,
      borderRadius: '12px',
      background:
        'color-mix(in srgb, var(--color-brand-500) 18%, var(--panel-elevated))',
      border: '1px solid color-mix(in srgb, var(--color-brand-500) 40%, transparent)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: '700',
      color: 'var(--color-brand-700)',
      letterSpacing: '0.02em',
    });
    g.textContent = p.label;
    layer.appendChild(g);
    ghosts.push(g);
  }

  const tl = gsap.timeline({
    onComplete: done,
  });

  ghosts.forEach((g, i) => {
    const p = pairs[i];
    const dx = p.to.left - p.from.left;
    const dy = p.to.top - p.from.top;

    tl.fromTo(
      g,
      { x: 0, y: 0, scale: 0.96, autoAlpha: 0.9 },
      {
        x: dx,
        y: dy,
        scale: 0.92,
        autoAlpha: 0.88,
        duration: 0.52,
        ease: direction === 'down' ? 'power2.in' : 'power2.out',
      },
      i * 0.045,
    );
  });

  window.setTimeout(done, 1400);
}

const FALL_LABELS: Record<string, string> = {
  search: 'Ara',
  quick: 'Hızlı',
  theme: 'Tema',
  profile: 'Profil',
};

export function DockModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(loadEnabled);
  const [reordering, setReordering] = useState(false);
  const [order, setOrderState] = useState<DockItemId[]>(loadOrder);
  const [animating, setAnimating] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const endAnim = useCallback(() => {
    setAnimating(false);
  }, []);

  const setOrder = useCallback((next: DockItemId[]) => {
    setOrderState(next);
    saveOrder(next);
  }, []);

  const moveItem = useCallback((fromId: DockItemId, toId: DockItemId) => {
    if (fromId === toId) return;
    setOrderState((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      saveOrder(next);
      return next;
    });
  }, []);

  const finishReorder = useCallback(() => {
    setReordering(false);
    saveOrder(order);
  }, [order]);

  const toggle = useCallback(() => {
    if (animating) return;
    const goingOn = !enabledRef.current;
    setAnimating(true);

    const safety = window.setTimeout(() => endAnim(), 2000);

    const finish = () => {
      window.clearTimeout(safety);
      endAnim();
    };

    if (goingOn) {
      const sources = DOCK_FALL_IDS.map((id) => {
        const el = document.querySelector(`[data-dock-source="${id}"]`);
        if (!el) return null;
        return { id, from: el.getBoundingClientRect() };
      }).filter(Boolean) as { id: DockItemId; from: DOMRect }[];

      setEnabled(true);
      saveEnabled(true);
      setReordering(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const pairs = sources
            .map((s) => {
              const target = document.querySelector(`[data-dock-target="${s.id}"]`);
              if (!target) return null;
              return {
                from: s.from,
                to: target.getBoundingClientRect(),
                label: FALL_LABELS[s.id] ?? s.id,
              };
            })
            .filter(Boolean) as { from: DOMRect; to: DOMRect; label: string }[];

          const targets = document.querySelectorAll('[data-dock-target]');
          gsap.set(targets, { autoAlpha: 0 });

          flyBetween(pairs, 'down', () => {
            gsap.to(targets, {
              autoAlpha: 1,
              duration: 0.28,
              stagger: 0.03,
              ease: 'power2.out',
              onComplete: finish,
            });
          });
        });
      });
      return;
    }

    setReordering(false);

    const sources = DOCK_FALL_IDS.map((id) => {
      const el = document.querySelector(`[data-dock-target="${id}"]`);
      if (!el) return null;
      return { id, from: el.getBoundingClientRect() };
    }).filter(Boolean) as { id: DockItemId; from: DOMRect }[];

    const targetsEl = document.querySelectorAll('[data-dock-target]');
    gsap.to(targetsEl, { autoAlpha: 0.35, duration: 0.15 });

    setEnabled(false);
    saveEnabled(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pairs = sources
          .map((s) => {
            const target = document.querySelector(`[data-dock-source="${s.id}"]`);
            if (!target) return null;
            return {
              from: s.from,
              to: target.getBoundingClientRect(),
              label: FALL_LABELS[s.id] ?? s.id,
            };
          })
          .filter(Boolean) as { from: DOMRect; to: DOMRect; label: string }[];

        const headerEls = document.querySelectorAll('[data-dock-source]');
        gsap.set(headerEls, { autoAlpha: 0 });

        flyBetween(pairs, 'up', () => {
          gsap.to(headerEls, {
            autoAlpha: 1,
            duration: 0.3,
            stagger: 0.03,
            ease: 'power2.out',
            onComplete: finish,
          });
        });
      });
    });
  }, [animating, endAnim]);

  const value = useMemo(
    () => ({
      enabled,
      reordering,
      order,
      animating,
      toggle,
      finishReorder,
      setOrder,
      moveItem,
    }),
    [
      enabled,
      reordering,
      order,
      animating,
      toggle,
      finishReorder,
      setOrder,
      moveItem,
    ],
  );

  return <DockModeContext.Provider value={value}>{children}</DockModeContext.Provider>;
}

export function useDockMode() {
  const ctx = useContext(DockModeContext);
  if (!ctx) throw new Error('useDockMode yalnızca DockModeProvider içinde');
  return ctx;
}
