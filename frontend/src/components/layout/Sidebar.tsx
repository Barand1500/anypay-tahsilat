import gsap from 'gsap';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useBrand } from '../../brand/BrandContext';
import { useKeyboardMode } from '../../keyboard/KeyboardModeContext';
import { useTheme } from '../../theme/ThemeProvider';
import { useDockMode } from './DockModeContext';
import { useGestureWind } from './GestureWindContext';
import { NAV_ITEMS, type NavItem } from './navItems';
import { NavIcon } from './NavIcon';
import { useQuickAccess } from './QuickAccessContext';
import { useRates } from './RatesContext';

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

const HOLD_MS = 380;
const WIDTH_MS = 300;

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

function DockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5h16M4 12h16M4 17.5h10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M17 15.5v4M15 17.5h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RatesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="m7 14 3.5-4 3 2.5L18 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h10a3 3 0 1 0-3-3M4 12h14a3 3 0 1 1-3 3M4 16h8a2.5 2.5 0 1 1-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Yer tutucu — henüz atanmamış araç */
function SoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="5.5" r="1.2" fill="currentColor" />
      <circle cx="5.5" cy="17.5" r="1" fill="currentColor" />
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
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function Sidebar({ collapsed, onToggle }: Props) {
  const { theme } = useTheme();
  const { logoUrl, faviconUrl, systemName } = useBrand();
  const { startDrag, drag } = useQuickAccess();
  const { enabled: kmOn, toggle: toggleKm } = useKeyboardMode();
  const { enabled: dockOn, toggle: toggleDock, animating: dockAnimating } = useDockMode();
  const { phase: ratesPhase, toggleFromSidebar } = useRates();
  const { enabled: gwOn, toggle: toggleGw } = useGestureWind();
  const ratesOn = ratesPhase !== 'idle';
  const location = useLocation();
  const collapsedLogo = faviconUrl || '/brand/logo-icon.png';
  const expandedLogo = logoUrl || '/brand/logo-full.png';
  const holdTimer = useRef<number | null>(null);
  const holdItem = useRef<NavItem | null>(null);
  const suppressClick = useRef(false);
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const firstPill = useRef(true);
  const resizing = useRef(false);
  const open = !collapsed;
  const settingsActive = location.pathname.startsWith('/ayarlar');
  /** 0 klavye · 1 kurlar · 2 jest · 3 dock · 4 yakında · 5 ayarlar */
  const [footerSlot, setFooterSlot] = useState(0);
  const footerSlotRef = useRef<HTMLDivElement>(null);
  const [soonToast, setSoonToast] = useState(false);

  useEffect(() => {
    if (settingsActive) setFooterSlot(5);
  }, [settingsActive]);

  useEffect(() => {
    if (!soonToast) return;
    const t = window.setTimeout(() => setSoonToast(false), 2200);
    return () => window.clearTimeout(t);
  }, [soonToast]);

  useEffect(() => {
    const el = footerSlotRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 8, scale: 0.92 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    );
  }, [footerSlot]);

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

  function onAsideWheel(e: ReactWheelEvent<HTMLElement>) {
    const nav = navRef.current;
    if (!nav) return;
    // Nav kendi scroll’unu kullanır; logo / footer üzerinde tekerlek de menüyü kaydırsın
    if (nav.contains(e.target as Node)) return;
    if (nav.scrollHeight <= nav.clientHeight) return;
    e.preventDefault();
    nav.scrollTop += e.deltaY;
  }

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
      'relative z-[1] flex items-center gap-3 py-2.5 pl-7 pr-4 text-sm font-medium transition-colors select-none',
      isActive
        ? 'is-nav-active text-[var(--sidebar-active-text)]'
        : 'text-[var(--sidebar-open-ink)]/90 hover:bg-[var(--sidebar-open-hover)]',
      drag ? 'cursor-grabbing' : 'cursor-grab',
    ].join(' ');
  }

  const navBlock = (
    <nav
      ref={navRef}
      className={[
        'sidebar-nav relative min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:thin]',
        open ? 'pb-4 pl-0 pr-0' : 'px-2 pb-4',
      ].join(' ')}
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
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  /** Alt bar — açık: ikisi birden · dar: tek buton + scroll */
  const footerBtnBase = [
    'relative flex size-10 shrink-0 items-center justify-center rounded-xl transition',
  ].join(' ');

  const kmBtnClass = [
    footerBtnBase,
    open
      ? kmOn
        ? 'bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22)] backdrop-blur-md'
        : 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
      : kmOn
        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--brand-on-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_35%,transparent),0_8px_20px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] backdrop-blur-md'
        : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const ratesBtnClass = [
    footerBtnBase,
    open
      ? ratesOn
        ? 'bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22)] backdrop-blur-md'
        : 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
      : ratesOn
        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--brand-on-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_35%,transparent),0_8px_20px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] backdrop-blur-md'
        : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const gwBtnClass = [
    footerBtnBase,
    open
      ? gwOn
        ? 'bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22)] backdrop-blur-md'
        : 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
      : gwOn
        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--brand-on-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_35%,transparent),0_8px_20px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] backdrop-blur-md'
        : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const dockBtnClass = [
    footerBtnBase,
    open
      ? dockOn
        ? 'bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22)] backdrop-blur-md'
        : 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
      : dockOn
        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--brand-on-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_35%,transparent),0_8px_20px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] backdrop-blur-md'
        : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const settingsBtnClass = [
    footerBtnBase,
    settingsActive
      ? open
        ? 'bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_8px_22px_rgba(0,0,0,0.18)] backdrop-blur-md'
        : 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--brand-on-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand-500)_35%,transparent),0_8px_20px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] backdrop-blur-md'
      : open
        ? 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
        : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const soonBtnClass = [
    footerBtnBase,
    open
      ? 'text-[var(--sidebar-open-ink)]/85 hover:bg-[var(--sidebar-open-hover)]'
      : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
  ].join(' ');

  const kmButton = (
    <button
      type="button"
      data-km-toggle
      aria-pressed={kmOn}
      aria-label="Klavye modu"
      title={kmOn ? 'Klavye modu açık — kapatmak için tıkla' : 'Klavye modu'}
      onClick={(e) => {
        e.stopPropagation();
        toggleKm();
      }}
      className={kmBtnClass}
    >
      <KeyboardIcon />
    </button>
  );

  const ratesButton = (
    <button
      type="button"
      data-rates-toggle
      aria-pressed={ratesOn}
      aria-label="Canlı kur şeridi"
      title={ratesOn ? 'Kur şeridi açık — kapatmak için tıkla' : 'Canlı kurlar'}
      onClick={(e) => {
        e.stopPropagation();
        toggleFromSidebar();
      }}
      className={ratesBtnClass}
    >
      <RatesIcon />
      {ratesOn ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" />
      ) : null}
    </button>
  );

  const gwButton = (
    <button
      type="button"
      data-gw-toggle
      aria-pressed={gwOn}
      aria-label="Jest Rüzgarı"
      title={gwOn ? 'Jest Rüzgarı açık — kapatmak için tıkla' : 'Jest Rüzgarı — serbest fare jestleri'}
      onClick={(e) => {
        e.stopPropagation();
        toggleGw();
      }}
      className={gwBtnClass}
    >
      <WindIcon />
      {gwOn ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" />
      ) : null}
    </button>
  );

  const dockButton = (
    <button
      type="button"
      data-dock-toggle
      aria-pressed={dockOn}
      aria-label="Alt çubuk (dock) modu"
      disabled={dockAnimating}
      title={
        dockOn
          ? 'Dock açık — header araçları altta; kapatınca varsayılana döner'
          : 'Header’ı alta taşı (dock)'
      }
      onClick={(e) => {
        e.stopPropagation();
        toggleDock();
      }}
      className={[dockBtnClass, dockAnimating ? 'pointer-events-none opacity-60' : ''].join(' ')}
    >
      <DockIcon />
      {dockOn ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" />
      ) : null}
    </button>
  );

  const soonButton = (
    <button
      type="button"
      data-soon-slot
      aria-label="Yakında"
      title="Yakında"
      onClick={(e) => {
        e.stopPropagation();
        setSoonToast(true);
      }}
      className={soonBtnClass}
    >
      <SoonIcon />
    </button>
  );

  const settingsLink = (
    <Link
      to="/ayarlar"
      aria-label="Ayarlar"
      title="Ayarlar"
      aria-current={settingsActive ? 'page' : undefined}
      onClick={(e) => e.stopPropagation()}
      className={settingsBtnClass}
    >
      <NavIcon name="gear" size={18} />
    </Link>
  );

  const soonToastEl = soonToast
    ? createPortal(
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[10050] -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2.5 text-sm font-medium text-[var(--panel-elevated)] shadow-lg"
        >
          Yakında
        </div>,
        document.body,
      )
    : null;

  const footerBar = open ? (
    <div className="mt-auto flex h-16 w-full shrink-0 items-center justify-evenly border-t border-[var(--sidebar-open-ink)]/15 px-1.5">
      {kmButton}
      {ratesButton}
      {gwButton}
      {dockButton}
      {soonButton}
      {settingsLink}
    </div>
  ) : (
    <div
      className="mt-auto flex h-16 shrink-0 items-center justify-center border-t border-[var(--panel-line)] px-2"
      title="Kaydırarak diğer araca geç"
      onWheel={(e) => {
        e.stopPropagation();
        if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return;
        e.preventDefault();
        const dir = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
        setFooterSlot((s) => (s + dir + 6) % 6);
      }}
    >
      <div ref={footerSlotRef} className="flex justify-center">
        {footerSlot === 0
          ? kmButton
          : footerSlot === 1
            ? ratesButton
            : footerSlot === 2
              ? gwButton
              : footerSlot === 3
                ? dockButton
                : footerSlot === 4
                  ? soonButton
                  : settingsLink}
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <>
      <aside
        ref={asideRef}
        onDoubleClick={onAsideDoubleClick}
        onWheel={onAsideWheel}
        title="Boş alana çift tıkla: menüyü aç/kapa"
        className="flex h-full min-h-0 w-[76px] shrink-0 flex-col overflow-hidden border-r border-[var(--panel-line)] bg-[var(--panel-sidebar)] transition-[width] duration-300 ease-out"
      >
        <div className="flex shrink-0 flex-col items-center gap-2 px-2 py-4">
          <img src={collapsedLogo} alt={systemName} className="h-10 w-10 object-contain" />
          <button
            type="button"
            aria-label="Menüyü aç"
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <CollapseIcon collapsed />
          </button>
        </div>
        <div className="shrink-0 px-2 pb-3">
          <Link
            to="/hizli-odeme"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white hover:brightness-110"
            title="Hızlı Ödeme"
          >
            <BoltIcon />
          </Link>
        </div>
        {navBlock}
        {footerBar}
      </aside>
      {soonToastEl}
    </>
    );
  }

  return (
    <>
    <aside
      ref={asideRef}
      onDoubleClick={onAsideDoubleClick}
      onWheel={onAsideWheel}
      title="Boş alana çift tıkla: menüyü aç/kapa"
      className="sidebar-open flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden bg-[var(--sidebar-open-bg)] text-[var(--sidebar-open-ink)] transition-[width] duration-300 ease-out"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-5">
        <div className="flex min-w-0 flex-1 items-center">
          <img
            src={expandedLogo}
            alt={systemName}
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

      <div className="shrink-0 px-3 pb-4">
        <Link
          to="/hizli-odeme"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--sidebar-cta-bg)] font-semibold text-[var(--sidebar-cta-text)] shadow-sm transition hover:brightness-110"
          title="Hızlı Ödeme"
        >
          <BoltIcon />
          <span>Hızlı Ödeme</span>
        </Link>
      </div>

      {navBlock}
      {footerBar}
    </aside>
    {soonToastEl}
    </>
  );
}
