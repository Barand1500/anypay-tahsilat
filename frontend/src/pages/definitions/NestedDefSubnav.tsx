import gsap from 'gsap';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuickAccess } from '../../components/layout/QuickAccessContext';
import { EXTRA_QUICK_ITEMS, findNavItem, type NavItem } from '../../components/layout/navItems';
import { usePermission } from '../../permissions/PermissionContext';

const HOLD_MS = 380;

type Item = { to: string; label: string; end?: boolean };

type Props = {
  items: readonly Item[];
  /** Aktif sınıf adı (pill ölçümü için) */
  activeClass?: string;
};

/**
 * Tanımlamalar iç içe sekmeler — kayan pill (POS / Kart altı).
 */
export function NestedDefSubnav({ items, activeClass = 'is-nested-def-tab-active' }: Props) {
  const location = useLocation();
  const { startDrag, drag, config: quickAccess } = useQuickAccess();
  const { canViewNavItem, permPagesReady, rolesLoading } = usePermission();
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const firstPill = useRef(true);
  const holdTimer = useRef<number | null>(null);
  const holdItem = useRef<NavItem | null>(null);
  const suppressNavClick = useRef(false);

  const visibleItems =
    permPagesReady && !rolesLoading
      ? items.filter((item) => canViewNavItem(item.to))
      : [];

  function placePill(instant: boolean) {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) return;

    const active = track.querySelector<HTMLElement>(`a.${activeClass}`);
    if (!active) {
      gsap.to(pill, { autoAlpha: 0, duration: 0.12 });
      return;
    }

    const trackBox = track.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    const left = a.left - trackBox.left + track.scrollLeft;
    const top = a.top - trackBox.top;

    if (instant) {
      gsap.set(pill, { autoAlpha: 1, left, top, width: a.width, height: a.height });
      return;
    }

    gsap.to(pill, {
      autoAlpha: 1,
      left,
      top,
      width: a.width,
      height: a.height,
      duration: 0.36,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  useLayoutEffect(() => {
    // Alt grup ilk açıldığında seçili sekmeyi bir anda çizmek yerine
    // soldan kısa bir geçişle göster; sonraki sekmelerde pill mevcut konumundan akar.
    const wasFirst = firstPill.current;
    firstPill.current = false;
    requestAnimationFrame(() => {
      if (wasFirst) {
        const track = trackRef.current;
        const pill = pillRef.current;
        const active = track?.querySelector<HTMLElement>(`a.${activeClass}`);
        if (track && pill && active) {
          const trackBox = track.getBoundingClientRect();
          const activeBox = active.getBoundingClientRect();
          const target = {
            left: activeBox.left - trackBox.left + track.scrollLeft,
            top: activeBox.top - trackBox.top,
            width: activeBox.width,
            height: activeBox.height,
          };
          gsap.set(pill, { ...target, left: Math.max(0, target.left - 10), autoAlpha: 0 });
          gsap.to(pill, {
            ...target,
            autoAlpha: 1,
            duration: 0.34,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        } else {
          placePill(true);
        }
      } else {
        placePill(false);
        const track = trackRef.current;
        const active = track?.querySelector<HTMLElement>(`a.${activeClass}`);
        active?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  }, [location.pathname, activeClass]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function onScrollOrResize() {
      placePill(true);
    }
    track.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      track.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  function clearTabHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdItem.current = null;
  }

  function onTabPointerDown(e: ReactPointerEvent, to: string, label: string) {
    if (e.button !== 0) return;
    suppressNavClick.current = false;
    clearTabHold();
    if (!quickAccess.enabled) return;
    const item =
      findNavItem(to) ??
      EXTRA_QUICK_ITEMS.find((x) => x.to === to) ?? {
        to,
        label,
        icon: 'sliders' as const,
      };
    holdItem.current = item;
    const x = e.clientX;
    const y = e.clientY;
    holdTimer.current = window.setTimeout(() => {
      if (holdItem.current) {
        suppressNavClick.current = true;
        startDrag(holdItem.current, x, y);
        holdItem.current = null;
      }
      holdTimer.current = null;
    }, HOLD_MS);
  }

  function onTabClick(e: MouseEvent) {
    if (drag || suppressNavClick.current) {
      e.preventDefault();
      suppressNavClick.current = false;
    }
  }

  useEffect(() => () => clearTabHold(), []);

  return (
    <div
      ref={trackRef}
      className="relative flex gap-1.5 overflow-x-auto rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute z-0 rounded-xl bg-[var(--color-brand-600)] shadow-sm will-change-[left,width]"
        style={{ opacity: 0, left: 0, top: 0, width: 0, height: 0 }}
      />
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end !== false}
          data-km-jump
          draggable={false}
          onPointerDown={(e) => onTabPointerDown(e, item.to, item.label)}
          onPointerUp={clearTabHold}
          onPointerLeave={clearTabHold}
          onClick={onTabClick}
          className={({ isActive }) =>
            [
              'relative z-[1] shrink-0 cursor-grab rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 active:cursor-grabbing select-none',
              isActive
                ? `${activeClass} text-white`
                : 'text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
