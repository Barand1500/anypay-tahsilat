import gsap from 'gsap';
import { NavLink, useLocation } from 'react-router-dom';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useKeyboardMode } from '../../keyboard/KeyboardModeContext';
import { useTheme } from '../../theme/ThemeProvider';
import { NAV_ITEMS, type NavItem } from './navItems';
import { NavIcon } from './NavIcon';
import { useQuickAccess } from './QuickAccessContext';

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

const HOLD_MS = 380;
const WIDTH_MS = 300;

export function Sidebar({ collapsed, onToggle }: Props) {
  const { theme } = useTheme();
  const { startDrag, drag } = useQuickAccess();
  const { enabled: kmOn, toggle: toggleKm } = useKeyboardMode();
  const location = useLocation();
  const collapsedLogo = theme === 'dark' ? '/brand/logo-white.png' : '/brand/logo.png';
  const holdTimer = useRef<number | null>(null);
  const holdItem = useRef<NavItem | null>(null);
  const suppressClick = useRef(false);
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const firstPill = useRef(true);
  const resizing = useRef(false);
  const open = !collapsed;

  useEffect(() => {
    return () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    };
  }, []);

  function placePill(instant: boolean) {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill || resizing.current) return;

    const active = nav.querySelector<HTMLElement>('a.is-nav-active');
    if (!active) {
      gsap.to(pill, { autoAlpha: 0, duration: 0.15 });
      return;
    }

    const navBox = nav.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    const top = a.top - navBox.top + nav.scrollTop;
    const height = a.height;

    if (open) {
      // Sağa yaslı kitap kenarı
      const left = 12;
      const width = Math.max(0, nav.clientWidth - left);
      gsap.to(pill, {
        autoAlpha: 1,
        top,
        left,
        width,
        height,
        duration: instant ? 0 : 0.38,
        ease: 'power3.out',
      });
    } else {
      const left = a.left - navBox.left + nav.scrollLeft;
      const width = a.width;
      gsap.to(pill, {
        autoAlpha: 1,
        top,
        left,
        width,
        height,
        duration: instant ? 0 : 0.38,
        ease: 'power3.out',
      });
    }
  }

  useLayoutEffect(() => {
    // Collapse / expand sırasında pill’i gizle — ölçü kayması olmasın
    resizing.current = true;
    firstPill.current = true;
    const pill = pillRef.current;
    if (pill) gsap.set(pill, { autoAlpha: 0 });

    const t = window.setTimeout(() => {
      resizing.current = false;
      placePill(true);
      firstPill.current = false;
    }, WIDTH_MS + 40);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  useLayoutEffect(() => {
    if (resizing.current) return;
    const instant = firstPill.current;
    firstPill.current = false;
    placePill(instant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, theme, open]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    function onScroll() {
      if (resizing.current) return;
      placePill(true);
    }
    nav.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      nav.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, open]);

  function onAsideDoubleClick(e: MouseEvent<HTMLElement>) {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, select, textarea, label')) return;
    onToggle();
  }

  function clearHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdItem.current = null;
  }

  function onNavPointerDown(e: ReactPointerEvent, item: NavItem) {
    if (e.button !== 0) return;
    suppressClick.current = false;
    clearHold();
    holdItem.current = item;
    const x = e.clientX;
    const y = e.clientY;
    holdTimer.current = window.setTimeout(() => {
      if (holdItem.current) {
        suppressClick.current = true;
        startDrag(holdItem.current, x, y);
        holdItem.current = null;
      }
      holdTimer.current = null;
    }, HOLD_MS);
  }

  function onNavPointerUp() {
    clearHold();
  }

  function onNavClick(e: MouseEvent) {
    if (drag || suppressClick.current) {
      e.preventDefault();
      suppressClick.current = false;
    }
  }

  function navClass(isActive: boolean) {
    if (!open) {
      return [
        'relative z-[1] flex items-center justify-center rounded-xl px-3 py-2.5 transition-colors select-none',
        isActive
          ? 'is-nav-active text-[var(--nav-active-text)]'
          : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
        drag ? 'cursor-grabbing' : 'cursor-grab',
      ].join(' ');
    }
    return [
      'relative z-[1] flex items-center gap-3 py-2.5 pl-4 pr-4 text-sm font-medium transition-colors select-none',
      isActive
        ? 'is-nav-active text-[var(--sidebar-active-text)]'
        : 'text-[var(--sidebar-open-ink)]/90 hover:bg-[var(--sidebar-open-hover)]',
      drag ? 'cursor-grabbing' : 'cursor-grab',
    ].join(' ');
  }

  const navBlock = (
    <nav
      ref={navRef}
      className={['sidebar-nav relative flex-1', open ? 'pb-4 pl-0 pr-0' : 'px-2 pb-4'].join(' ')}
    >
      <div
        ref={pillRef}
        aria-hidden
        className={['sidebar-active-pill', open ? '' : 'sidebar-active-pill--compact'].join(' ')}
        style={{ opacity: 0, top: 0, left: 0, width: 0, height: 0 }}
      />
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          title={`${item.label} — basılı tutup header’a sürükle`}
          draggable={false}
          onPointerDown={(e) => onNavPointerDown(e, item)}
          onPointerUp={onNavPointerUp}
          onPointerCancel={clearHold}
          onClick={onNavClick}
          className={({ isActive }) => navClass(isActive)}
        >
          <NavIcon name={item.icon} />
          {open ? (
            <span className="flex-1 truncate">
              {item.label}
              {item.soon ? (
                <span className="ml-2 text-[10px] font-normal opacity-70">yakında</span>
              ) : null}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  const kmBtn = (
    <button
      type="button"
      data-km-toggle
      aria-pressed={kmOn}
      aria-label="Klavye modu"
      title={kmOn ? 'Klavye modu açık — kapatmak için tıkla veya fareyle tıkla' : 'Klavye modu'}
      onClick={(e) => {
        e.stopPropagation();
        toggleKm();
      }}
      className={[
        'mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition',
        open
          ? kmOn
            ? 'bg-[var(--sidebar-cta-bg)] text-[var(--sidebar-cta-text)] shadow-md'
            : 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
          : kmOn
            ? 'bg-[var(--color-brand-600)] text-white shadow-md'
            : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
      ].join(' ')}
    >
      <KeyboardIcon />
    </button>
  );

  if (collapsed) {
    return (
      <aside
        ref={asideRef}
        onDoubleClick={onAsideDoubleClick}
        title="Boş alana çift tıkla: menüyü aç/kapa"
        className="flex w-[76px] shrink-0 flex-col overflow-hidden border-r border-[var(--panel-line)] bg-[var(--panel-sidebar)] transition-[width] duration-300 ease-out"
      >
        <div className="flex flex-col items-center gap-2 px-2 py-4">
          <img src={collapsedLogo} alt="Güzel Teknoloji" className="h-11 w-11 object-contain" />
          <button
            type="button"
            aria-label="Menüyü aç"
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <CollapseIcon collapsed />
          </button>
        </div>
        <div className="px-2 pb-3">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white hover:brightness-110"
            title="Hızlı Ödeme"
          >
            <BoltIcon />
          </button>
        </div>
        {navBlock}
        <div className="border-t border-[var(--panel-line)] px-1 py-3">{kmBtn}</div>
      </aside>
    );
  }

  return (
    <aside
      ref={asideRef}
      onDoubleClick={onAsideDoubleClick}
      title="Boş alana çift tıkla: menüyü aç/kapa"
      className="sidebar-open flex w-[280px] shrink-0 flex-col overflow-hidden bg-[var(--sidebar-open-bg)] text-[var(--sidebar-open-ink)] transition-[width] duration-300 ease-out"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <div className="flex min-w-0 flex-1 items-center">
          <img
            src="/brand/logo-white.png"
            alt="Güzel Teknoloji"
            className="h-14 w-auto max-w-[210px] object-contain object-left drop-shadow-sm"
          />
        </div>
        <button
          type="button"
          aria-label="Menüyü daralt"
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-open-ink)]/75 hover:bg-[var(--sidebar-open-hover)] hover:text-[var(--sidebar-open-ink)]"
        >
          <CollapseIcon collapsed={false} />
        </button>
      </div>

      <div className="px-3 pb-4">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--sidebar-cta-bg)] font-semibold text-[var(--sidebar-cta-text)] shadow-sm transition hover:brightness-110"
          title="Hızlı Ödeme"
        >
          <BoltIcon />
          <span>Hızlı Ödeme</span>
        </button>
      </div>

      {navBlock}

      <div className="border-t border-[var(--sidebar-open-ink)]/15 px-3 py-3">
        {kmBtn}
        <p className="mt-1.5 text-center text-[10px] text-[var(--sidebar-open-ink)]/70">Klavye modu</p>
      </div>
    </aside>
  );
}

function KeyboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h4M18 14h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={collapsed ? 'rotate-180' : ''}
    >
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l1-6Z" />
    </svg>
  );
}
