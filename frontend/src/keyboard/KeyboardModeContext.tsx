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
import { createPortal } from 'react-dom';

type KeyboardModeValue = {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
};

type Zone = 'aside' | 'header' | 'main' | 'panel' | 'dialog' | 'other';

const KeyboardModeContext = createContext<KeyboardModeValue | null>(null);

const DIALOG_SEL = '[role="dialog"], [role="alertdialog"]';
const DIALOG_NAV =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-km-jump], [data-km-row]';
const MAIN_NAV =
  '[data-km-jump], [data-km-row], [data-km-page], [data-km-row] button:not([disabled])';

type CollectOpts = { soft?: boolean };

function isVisible(el: HTMLElement, soft?: boolean) {
  if (el.closest('[data-km-ignore]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.pointerEvents === 'none') return false;
  if (!soft) {
    if (style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
  }
  return true;
}

/** Rozet: header altında gerçekten görünen öğeler */
function isOnScreen(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const header = document.querySelector('header');
  const topClip = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const pad = 6;
  return (
    r.bottom > topClip + pad &&
    r.top < window.innerHeight - pad &&
    r.right > pad &&
    r.left < window.innerWidth - pad
  );
}

function collectIn(root: ParentNode, sel: string, opts?: CollectOpts): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll(sel)) as HTMLElement[];
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];
  for (const el of nodes) {
    if (seen.has(el)) continue;
    if (el.closest('[data-km-toggle]')) continue;
    if (!isVisible(el, opts?.soft)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

function zoneOf(el: HTMLElement): Zone {
  if (el.closest(DIALOG_SEL)) return 'dialog';
  if (el.closest('[data-profile-panel]')) return 'panel';
  if (el.closest('aside')) return 'aside';
  if (el.closest('header')) return 'header';
  if (el.closest('main')) return 'main';
  return 'other';
}

function firstInZone(nav: HTMLElement[], zone: Zone) {
  return nav.findIndex((el) => zoneOf(el) === zone);
}

function lastInZone(nav: HTMLElement[], zone: Zone) {
  for (let i = nav.length - 1; i >= 0; i--) {
    if (zoneOf(nav[i]) === zone) return i;
  }
  return -1;
}

/** Aynı bölgede bir sonraki / önceki; yoksa -1 */
function stepInZone(nav: HTMLElement[], idx: number, dir: 1 | -1) {
  const z = zoneOf(nav[idx]);
  for (let i = idx + dir; i >= 0 && i < nav.length; i += dir) {
    if (zoneOf(nav[i]) === z) return i;
  }
  return -1;
}

function collectNav(): HTMLElement[] {
  const dialog = document.querySelector(DIALOG_SEL) as HTMLElement | null;
  if (dialog && isVisible(dialog)) {
    return collectIn(dialog, DIALOG_NAV, { soft: true });
  }

  const panel = document.querySelector('[data-profile-panel]') as HTMLElement | null;
  if (panel) {
    return collectIn(panel, 'button:not([disabled])', { soft: true });
  }

  const aside = document.querySelector('aside');
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const out: HTMLElement[] = [];

  if (aside) out.push(...collectIn(aside, 'a[href], button:not([disabled])'));
  if (header) out.push(...collectIn(header, 'a[href], button:not([disabled]), input:not([disabled])'));
  if (main) out.push(...collectIn(main, MAIN_NAV));

  return out;
}

function collectJumps(): HTMLElement[] {
  const dialog = document.querySelector(DIALOG_SEL) as HTMLElement | null;
  if (dialog && isVisible(dialog)) {
    return collectIn(dialog, '[data-km-jump]', { soft: true }).slice(0, 9);
  }
  if (document.querySelector('[data-profile-panel]')) return [];

  return collectIn(document, '[data-km-jump]')
    .filter((el) => !el.closest('aside') && !el.closest('header'))
    .slice(0, 9);
}

function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.readOnly) return false;
    const type = input.type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden'].includes(type);
  }
  return false;
}

function activate(el: HTMLElement) {
  if (el.hasAttribute('data-km-row')) {
    el.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }),
    );
    return;
  }

  if (isEditable(el)) {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* */
      }
    }
    return;
  }

  el.focus({ preventScroll: true });
  el.click();
}

function warmClass(on: boolean, el: HTMLElement | null) {
  if (!el) return;
  el.classList.toggle('km-warm', on);
  if (on) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function goTo(
  nav: HTMLElement[],
  from: number,
  to: number,
  focusIndexRef: { current: number },
  setFocusIndex: (n: number) => void,
) {
  if (to < 0 || to >= nav.length) return;
  warmClass(false, nav[from] ?? null);
  focusIndexRef.current = to;
  setFocusIndex(to);
  warmClass(true, nav[to]);
}

/** Klavye modu */
export function KeyboardModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [badges, setBadges] = useState<{ n: number; top: number; left: number }[]>([]);
  const navRef = useRef<HTMLElement[]>([]);
  const jumpRef = useRef<HTMLElement[]>([]);
  const focusIndexRef = useRef(0);
  const enabledRef = useRef(false);
  const wasPanelOpen = useRef(false);
  const wasDialogOpen = useRef(false);
  /** Sol panelde son durulan indeks — ← ile geri dönüş */
  const asideBookmark = useRef(0);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    enabledRef.current = v;
    if (!v) {
      warmClass(false, navRef.current[focusIndexRef.current] ?? null);
      navRef.current = [];
      jumpRef.current = [];
      setBadges([]);
      wasPanelOpen.current = false;
      wasDialogOpen.current = false;
      document.body.classList.remove('km-active');
    } else {
      document.body.classList.add('km-active');
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabledRef.current);
  }, [setEnabled]);

  const refresh = useCallback(() => {
    if (!enabledRef.current) return;
    const prev = navRef.current[focusIndexRef.current];
    warmClass(false, prev);

    const panel = document.querySelector('[data-profile-panel]');
    const dialog = document.querySelector(DIALOG_SEL);
    const panelJustOpened = !!panel && !wasPanelOpen.current;
    const dialogJustOpened = !!dialog && !wasDialogOpen.current;
    wasPanelOpen.current = !!panel;
    wasDialogOpen.current = !!dialog;

    const nav = collectNav();
    const jumps = collectJumps();
    navRef.current = nav;
    jumpRef.current = jumps;

    let idx = focusIndexRef.current;
    if (idx >= nav.length) idx = Math.max(0, nav.length - 1);
    if (prev && nav.includes(prev)) idx = nav.indexOf(prev);

    if (dialogJustOpened && nav.length) idx = 0;
    if (panelJustOpened && nav.length) idx = 0;

    focusIndexRef.current = idx;
    setFocusIndex(idx);
    warmClass(true, nav[idx] ?? null);

    // Yalnızca ekranda görünen ısınma noktalarına rozet
    setBadges(
      jumps.flatMap((el, i) => {
        if (!isOnScreen(el)) return [];
        const r = el.getBoundingClientRect();
        return [
          {
            n: i + 1,
            top: Math.max(4, r.top - 4),
            left: Math.max(4, r.left - 4),
          },
        ];
      }),
    );
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;

    refresh();
    const onResize = () => refresh();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    let moTimer = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(moTimer);
      moTimer = window.setTimeout(refresh, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    let poll = 0;
    const pollId = window.setInterval(() => {
      if (!enabledRef.current) return;
      if (document.querySelector('[data-profile-panel]') || document.querySelector(DIALOG_SEL)) {
        refresh();
        poll += 1;
        if (poll > 10) window.clearInterval(pollId);
      }
    }, 80);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.clearTimeout(moTimer);
      window.clearInterval(pollId);
      mo.disconnect();
      warmClass(false, navRef.current[focusIndexRef.current] ?? null);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (!enabledRef.current) return;
      const active = document.activeElement;

      if (e.key === 'Escape') {
        if (isEditable(active)) {
          e.preventDefault();
          (active as HTMLElement).blur();
          refresh();
          return;
        }
        if (document.querySelector(DIALOG_SEL)) return;
        if (document.querySelector('[data-profile-panel]')) return;
        e.preventDefault();
        setEnabled(false);
        return;
      }

      if (isEditable(active)) return;

      const nav = navRef.current;
      if (!nav.length) {
        refresh();
        return;
      }

      const idx = focusIndexRef.current;
      const cur = nav[idx];
      const z = cur ? zoneOf(cur) : 'other';

      // Modal / profil: düz liste
      if (z === 'dialog' || z === 'panel') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          goTo(nav, idx, (idx + 1) % nav.length, focusIndexRef, setFocusIndex);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          goTo(nav, idx, (idx - 1 + nav.length) % nav.length, focusIndexRef, setFocusIndex);
          return;
        }
      } else {
        // → sol panelden doğrudan sayfa içeriğine
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          if (z === 'aside') {
            asideBookmark.current = idx;
            const mainFirst = firstInZone(nav, 'main');
            if (mainFirst >= 0) {
              goTo(nav, idx, mainFirst, focusIndexRef, setFocusIndex);
              return;
            }
          }
          const n = stepInZone(nav, idx, 1);
          if (n >= 0) goTo(nav, idx, n, focusIndexRef, setFocusIndex);
          else if (z === 'header') {
            const mainFirst = firstInZone(nav, 'main');
            if (mainFirst >= 0) goTo(nav, idx, mainFirst, focusIndexRef, setFocusIndex);
          }
          return;
        }

        // ← önce aynı bölgede önceki eleman; yoksa sol panele
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          const n = stepInZone(nav, idx, -1);
          if (n >= 0) {
            goTo(nav, idx, n, focusIndexRef, setFocusIndex);
            if (zoneOf(nav[n]) === 'aside') asideBookmark.current = n;
            return;
          }
          if (z === 'main' || z === 'header') {
            const asideIdx =
              asideBookmark.current < nav.length && zoneOf(nav[asideBookmark.current]) === 'aside'
                ? asideBookmark.current
                : firstInZone(nav, 'aside');
            if (asideIdx >= 0) {
              goTo(nav, idx, asideIdx, focusIndexRef, setFocusIndex);
            }
          }
          return;
        }

        // ↓ bölge içi; bitince header → main
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          const n = stepInZone(nav, idx, 1);
          if (n >= 0) {
            goTo(nav, idx, n, focusIndexRef, setFocusIndex);
            if (zoneOf(nav[n]) === 'aside') asideBookmark.current = n;
            return;
          }
          if (z === 'aside') {
            const h = firstInZone(nav, 'header');
            const m = firstInZone(nav, 'main');
            const t = h >= 0 ? h : m;
            if (t >= 0) goTo(nav, idx, t, focusIndexRef, setFocusIndex);
            return;
          }
          if (z === 'header') {
            const m = firstInZone(nav, 'main');
            if (m >= 0) goTo(nav, idx, m, focusIndexRef, setFocusIndex);
          }
          return;
        }

        // ↑ bölge içi; bitince main → header → aside
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          const n = stepInZone(nav, idx, -1);
          if (n >= 0) {
            goTo(nav, idx, n, focusIndexRef, setFocusIndex);
            if (zoneOf(nav[n]) === 'aside') asideBookmark.current = n;
            return;
          }
          if (z === 'main') {
            const h = lastInZone(nav, 'header');
            if (h >= 0) {
              goTo(nav, idx, h, focusIndexRef, setFocusIndex);
              return;
            }
            const a = lastInZone(nav, 'aside');
            if (a >= 0) {
              goTo(nav, idx, a, focusIndexRef, setFocusIndex);
              asideBookmark.current = a;
            }
            return;
          }
          if (z === 'header') {
            const a = lastInZone(nav, 'aside');
            if (a >= 0) {
              goTo(nav, idx, a, focusIndexRef, setFocusIndex);
              asideBookmark.current = a;
            }
          }
          return;
        }
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const el = nav[focusIndexRef.current];
        if (el) {
          if (zoneOf(el) === 'aside') asideBookmark.current = focusIndexRef.current;
          activate(el);
        }
        window.setTimeout(refresh, 100);
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const jump = jumpRef.current[Number(e.key) - 1];
        if (!jump) return;
        warmClass(false, nav[focusIndexRef.current]);
        const ni = nav.indexOf(jump);
        if (ni >= 0) {
          focusIndexRef.current = ni;
          setFocusIndex(ni);
        }
        warmClass(true, jump);
        activate(jump);
        window.setTimeout(refresh, 100);
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (!enabledRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-km-toggle]')) return;
      if (t?.closest(DIALOG_SEL)) return;
      if (t?.closest('[data-profile-panel]')) return;
      if (t?.closest('[data-km-profile]')) return;
      setEnabled(false);
    }

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [enabled, refresh, setEnabled]);

  const value = useMemo(
    () => ({ enabled, toggle, setEnabled }),
    [enabled, toggle, setEnabled],
  );

  return (
    <KeyboardModeContext.Provider value={value}>
      {children}
      {enabled && badges.length
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[10030]" aria-hidden>
              {badges.map((b) => (
                <span
                  key={b.n}
                  className="km-badge absolute flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-semibold text-white"
                  style={{ top: b.top, left: b.left }}
                >
                  {b.n}
                </span>
              ))}
            </div>,
            document.body,
          )
        : null}
      <span className="sr-only" aria-live="polite">
        {enabled ? `Klavye modu · ${focusIndex + 1}` : ''}
      </span>
    </KeyboardModeContext.Provider>
  );
}

export function useKeyboardMode() {
  const ctx = useContext(KeyboardModeContext);
  if (!ctx) throw new Error('useKeyboardMode yalnızca KeyboardModeProvider içinde');
  return ctx;
}
