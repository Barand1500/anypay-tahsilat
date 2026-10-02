import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLoadBins } from '../../hooks/useLoadBins';
import { KeyboardModeProvider } from '../../keyboard/KeyboardModeContext';
import {
  applyDisplayMode,
  getAppDefaults,
  hydrateAppDefaults,
} from '../../pages/settings/defaultsStore';
import { RouteViewGate } from '../../permissions/RouteViewGate';
import { useTheme } from '../../theme/ThemeProvider';
import { DockModeProvider, useDockMode } from './DockModeContext';
import { Footer } from './Footer';
import {
  GestureWindProvider,
} from './GestureWindContext';
import { GestureWindListener } from './GestureWindListener';
import { GestureWindSettingsModal } from './GestureWindSettings';
import { GlobalSearch } from './GlobalSearch';
import { Header } from './Header';
import { QuickAccessProvider } from './QuickAccessContext';
import { RatesProvider, useRates } from './RatesContext';
import { Sidebar } from './Sidebar';
import { VaultProvider } from './VaultContext';
import { VaultHost } from './VaultWidget';

const HEADER_H = 64;
const FOOTER_H = 64;

/** Panel kabuğu — sidebar + dock + kur + jest rüzgarı */
export function AppShell() {
  return (
    <QuickAccessProvider>
      <KeyboardModeProvider>
        <DockModeProvider>
          <RatesProvider>
            <GestureWindProvider>
              <VaultProvider>
                <AppShellInner />
              </VaultProvider>
            </GestureWindProvider>
          </RatesProvider>
        </DockModeProvider>
      </KeyboardModeProvider>
    </QuickAccessProvider>
  );
}

function AppShellInner() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useLoadBins();
  const { applyTheme } = useTheme();
  const { enabled: dockOn, animating } = useDockMode();
  const { phase: ratesPhase } = useRates();
  const [collapsed, setCollapsed] = useState(false);
  const [headerAutoHide, setHeaderAutoHide] = useState(false);
  const [headerPeek, setHeaderPeek] = useState(false);
  const [footerAutoHide, setFooterAutoHide] = useState(false);
  const [footerPeek, setFooterPeek] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const changingTemporaryPassword =
    location.pathname === '/profil' && new URLSearchParams(location.search).get('changePassword') === '1';

  // Dock / kur şeridi açıkken footer görünür
  const headerOpen = dockOn ? false : !headerAutoHide || headerPeek;
  const footerOpen =
    dockOn || ratesPhase !== 'idle' ? true : !footerAutoHide || footerPeek;

  useEffect(() => {
    if (dockOn || ratesPhase !== 'idle') {
      setFooterAutoHide(false);
      setFooterPeek(false);
    }
  }, [dockOn, ratesPhase]);

  useEffect(() => {
    if (dockOn) {
      setHeaderAutoHide(false);
      setHeaderPeek(false);
    }
  }, [dockOn]);

  useEffect(() => {
    if (!headerAutoHide) setHeaderPeek(false);
  }, [headerAutoHide]);

  useEffect(() => {
    if (!footerAutoHide) setFooterPeek(false);
  }, [footerAutoHide]);

  useEffect(() => {
    void applyDisplayMode(getAppDefaults().displayMode);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void hydrateAppDefaults(token).then((next) => {
      if (cancelled || !next) return;
      applyTheme(next.panelTheme);
      void applyDisplayMode(next.displayMode);
    });
    return () => {
      cancelled = true;
    };
  }, [token, applyTheme]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void import('../../pages/roles/roleHero').then((m) => m.prefetchRoleHero());
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run);
    } else {
      timeoutId = setTimeout(run, 1200);
    }
    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  function onHeaderDoubleClick(e: MouseEvent) {
    if (dockOn || animating) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, input, a, select, textarea, label, [data-quick-slot]')) return;

    if (!headerAutoHide) {
      setHeaderAutoHide(true);
      setHeaderPeek(false);
      return;
    }
    setHeaderAutoHide(false);
    setHeaderPeek(false);
  }

  function onFooterDoubleClick(e: MouseEvent) {
    if (dockOn || animating) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, input, a, select, textarea, label')) return;

    if (!footerAutoHide) {
      setFooterAutoHide(true);
      setFooterPeek(false);
      return;
    }
    setFooterAutoHide(false);
    setFooterPeek(false);
  }

  return (
    <>
      <div
        data-app-shell
        className="flex h-screen overflow-hidden bg-[var(--panel-bg)] text-[var(--panel-ink)]"
        style={
          {
            ['--app-footer-offset']: footerOpen ? `${FOOTER_H}px` : '0px',
          } as CSSProperties
        }
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          {!dockOn && headerAutoHide && !headerPeek ? (
            <div
              className="absolute inset-x-0 top-0 z-50 h-3"
              onMouseEnter={() => setHeaderPeek(true)}
              title="Header’ı göstermek için fareyi yukarı getir"
            />
          ) : null}

          <div
            className="shrink-0 overflow-hidden transition-[height] duration-300 ease-out"
            style={{ height: headerOpen ? HEADER_H : 0 }}
            onMouseLeave={() => {
              if (headerAutoHide && !dockOn) setHeaderPeek(false);
            }}
          >
            {!dockOn ? (
              <Header
                autoHide={headerAutoHide}
                onHeaderDoubleClick={onHeaderDoubleClick}
                onOpenSearch={() => setSearchOpen(true)}
              />
            ) : null}
          </div>

          <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 transition-[padding] duration-300 sm:p-5 lg:p-6">
            <RouteViewGate>
              <Outlet />
            </RouteViewGate>
          </main>

          {!dockOn && footerAutoHide && !footerPeek ? (
            <div
              className="absolute inset-x-0 bottom-0 z-50 h-3"
              onMouseEnter={() => setFooterPeek(true)}
              title="Footer’ı göstermek için fareyi aşağı getir"
            />
          ) : null}

          <div
            className="shrink-0 overflow-hidden transition-[height] duration-300 ease-out"
            style={{ height: footerOpen ? FOOTER_H : 0 }}
            onMouseLeave={() => {
              if (footerAutoHide && !dockOn) setFooterPeek(false);
            }}
          >
            <Footer
              autoHide={footerAutoHide}
              onFooterDoubleClick={onFooterDoubleClick}
              onOpenSearch={() => setSearchOpen(true)}
            />
          </div>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <GestureWindListener onOpenSearch={() => setSearchOpen(true)} />
      <GestureWindSettingsModal />
      <VaultHost />
      {user?.mustChangePassword && !changingTemporaryPassword ? (
        <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="temporary-password-title"
            className="w-full max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
              <PasswordLockIcon />
            </div>
            <h2 id="temporary-password-title" className="text-lg font-bold text-[var(--panel-ink)]">
              Lütfen şifrenizi değiştirin
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
              Hesabınıza geçici şifreyle giriş yaptınız. Devam etmeden önce profilinizden yeni bir şifre belirleyin.
            </p>
            <button
              type="button"
              onClick={() => navigate('/profil?changePassword=1')}
              className="mt-6 w-full rounded-xl bg-[var(--color-brand-600)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Profile git
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

function PasswordLockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4.5" y="10" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
