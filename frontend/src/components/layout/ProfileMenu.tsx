import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { prefetchRoleHero } from '../../pages/roles/roleHero';
import { dismissLogoutPortal, playLogoutPortal } from './logoutPortal';

const MENU = [
  { to: '/moduller', label: 'Modüller', icon: 'modules' },
  { to: '/roller', label: 'Roller', icon: 'roles' },
  { to: '/kullanicilar', label: 'Kullanıcılar', icon: 'users' },
  { to: '/surum-gecmisi', label: 'Sürüm Geçmişi', icon: 'version' },
  { to: '/log-kayitlari', label: 'Log Kayıtları', icon: 'logs' },
  { to: '/sistem-sifirlama', label: 'Sistem Sıfırlama', icon: 'reset' },
] as const;

const PANEL_W = 260;

function roleLabel(roles: string[]) {
  if (roles.includes('ROLE_SUPERAPP') || roles.includes('ROLE_ADMIN')) return 'Yönetici';
  if (roles.includes('ROLE_USER')) return 'Kullanıcı';
  return roles[0]?.replace(/^ROLE_/, '') || 'Kullanıcı';
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Profil menüsü — panel body’ye portal (header overflow-hidden kesmesin).
 */
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const name = user?.adsoyad || user?.email || 'Kullanıcı';
  const initials = initialsOf(name);
  const role = roleLabel(user?.roles ?? []);

  function updatePos() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8);
    setPos({ top: r.bottom + 10, left: Math.max(8, left) });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    prefetchRoleHero();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      updatePos();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onClose() {
      setOpen(false);
    }
    window.addEventListener('open-profile-menu', onOpen);
    window.addEventListener('close-profile-menu', onClose);
    return () => {
      window.removeEventListener('open-profile-menu', onOpen);
      window.removeEventListener('close-profile-menu', onClose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const items = Array.from(panel.querySelectorAll('[data-menu-item]'));
    gsap.set(panel, { transformOrigin: 'top right' });
    gsap.set(items, { autoAlpha: 0, x: 12 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      panel,
      { autoAlpha: 0, y: -10, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32 },
    ).to(items, { autoAlpha: 1, x: 0, duration: 0.28, stagger: 0.045 }, '-=0.12');

    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' },
      );
    }

    return () => {
      tl.kill();
    };
  }, [open]);

  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    try {
      await playLogoutPortal();
      await logout();
      navigate('/login', { replace: true });
      window.setTimeout(() => dismissLogoutPortal(), 80);
    } catch {
      dismissLogoutPortal();
      setLoggingOut(false);
    }
  }

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            data-profile-panel
            className="fixed z-[10050] w-[260px] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
            style={{ top: pos.top, left: pos.left }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => go('/profil')}
              className="flex w-full items-center gap-3 px-4 pb-3 pt-4 text-left transition hover:bg-[var(--panel-hover)]"
              data-menu-item
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft-bg)] text-base font-bold text-[var(--brand-on-soft)]">
                {initials}
                <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--panel-elevated)] bg-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--panel-ink)]">{name}</p>
                <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{role} · Profili aç</p>
              </div>
            </button>

            <div className="mx-3 h-px bg-[var(--panel-line)]" />

            <ul className="space-y-0.5 px-2 py-2">
              {MENU.map((item) => (
                <li key={item.to} data-menu-item>
                  <button
                    type="button"
                    role="menuitem"
                    {...(item.to === '/kullanicilar' ? { 'data-nav-kullanicilar': true } : {})}
                    onMouseEnter={() => {
                      if (item.to === '/roller') prefetchRoleHero();
                    }}
                    onClick={() => go(item.to)}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                  >
                    <span className="text-[var(--panel-muted)] transition group-hover:scale-110 group-hover:text-[var(--brand-on-soft)]">
                      <MenuIcon name={item.icon} />
                    </span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mx-3 h-px bg-[var(--panel-line)]" />

            <div className="p-2" data-menu-item>
              <button
                type="button"
                role="menuitem"
                disabled={loggingOut}
                onClick={() => void onLogout()}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-60"
              >
                <span className="transition group-hover:translate-x-0.5">
                  <LogoutIcon />
                </span>
                Çıkış Yap
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-km-profile
        data-profile-trigger
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={[
          'relative flex max-w-[200px] items-center gap-2.5 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-1 pl-1 pr-2.5 transition',
          'hover:bg-[var(--panel-hover)]',
          open ? 'ring-2 ring-[var(--color-brand-500)] ring-offset-2 ring-offset-[var(--panel-header)]' : '',
        ].join(' ')}
        title={name}
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft-bg)] text-xs font-bold text-[var(--brand-on-soft)]">
          {initials}
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-[var(--panel-surface)] bg-emerald-500" />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-left text-sm font-semibold leading-tight text-[var(--panel-ink)]">
            {name.split(' ')[0]}
          </span>
          <span className="block truncate text-left text-[10px] leading-tight text-[var(--panel-muted)]">
            {role}
          </span>
        </span>
      </button>
      {panel}
    </>
  );
}

function MenuIcon({ name }: { name: string }) {
  const c = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'modules':
      return (
        <svg {...c}>
          <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18" cy="18" r="2" fill="currentColor" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...c}>
          <path d="M12 3v18M8 7h8M9 11h6M10 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12 3 7 7h10L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'users':
      return (
        <svg {...c}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M21 19c0-2-1.5-3.6-3.5-4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'version':
      return (
        <svg {...c}>
          <rect x="5" y="5" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9 3h10a2 2 0 0 1 2 2v12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 10h6M8 14h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'logs':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="18" cy="18" r="3.2" stroke="currentColor" strokeWidth="1.5" fill="var(--panel-elevated)" />
          <path d="m19.2 19.2 1.3 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'reset':
      return (
        <svg {...c}>
          <path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15 12H3m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
