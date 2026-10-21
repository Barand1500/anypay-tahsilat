import { useEffect, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLoadBins } from '../../hooks/useLoadBins';
import { api } from '../../lib/api';
import { KeyboardModeProvider } from '../../keyboard/KeyboardModeContext';
import {
  applyDisplayMode,
  getAppDefaults,
  hydrateAppDefaults,
} from '../../pages/settings/defaultsStore';
import { RouteViewGate } from '../../permissions/RouteViewGate';
import { useTheme } from '../../theme/ThemeProvider';
import { Footer } from './Footer';
import { GlobalSearch } from './GlobalSearch';
import { Header } from './Header';
import { QuickAccessProvider } from './QuickAccessContext';
import { RatesProvider } from './RatesContext';
import { Sidebar } from './Sidebar';

const HEADER_H = 64;
const FOOTER_H = 64;

/** Panel kabuğu — sidebar + header + footer + canlı kur şeridi */
export function AppShell() {
  return (
    <QuickAccessProvider>
      <KeyboardModeProvider>
        <RatesProvider>
          <AppShellInner />
        </RatesProvider>
      </KeyboardModeProvider>
    </QuickAccessProvider>
  );
}

function AppShellInner() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useLoadBins();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let polling = false;
    let remoteEnabled = false;
    let changelogHead: string | null = null;

    const poll = async () => {
      if (cancelled || polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        if (!remoteEnabled) {
          const source = await api.get<{ source: 'local' | 'remote' }>('/api/settings/bin-source', token);
          remoteEnabled = source.source === 'remote';
          if (!remoteEnabled) {
            changelogHead = null;
            return;
          }
        }

        const rows = await api.get<{ id: string; resource: string; action: string }[]>(
          '/api/settings/central-changelog?limit=1',
          token,
        );
        const latest = rows[0];
        if (!latest?.id) return;
        if (changelogHead === null) {
          changelogHead = latest.id;
          return;
        }
        if (latest.id === changelogHead) return;

        await api.post('/api/settings/central-catalog/refresh', {}, token);
        changelogHead = latest.id;
        window.dispatchEvent(
          new CustomEvent('central-catalog-changed', {
            detail: { resource: latest.resource, action: latest.action, id: latest.id },
          }),
        );
      } catch {
        /* retry next tick */
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      remoteEnabled = false;
      void poll();
    }, 20_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [token]);

  const { applyTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const changingTemporaryPassword =
    location.pathname === '/profil' && new URLSearchParams(location.search).get('changePassword') === '1';

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

  return (
    <>
      <div
        data-app-shell
        className="flex h-screen overflow-hidden bg-[var(--panel-bg)] text-[var(--panel-ink)]"
        style={
          {
            ['--app-footer-offset']: `${FOOTER_H}px`,
          } as CSSProperties
        }
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 overflow-hidden" style={{ height: HEADER_H }}>
            <Header onOpenSearch={() => setSearchOpen(true)} />
          </div>

          <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:p-6">
            <RouteViewGate>
              <Outlet />
            </RouteViewGate>
          </main>

          <div className="shrink-0 overflow-hidden" style={{ height: FOOTER_H }}>
            <Footer />
          </div>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
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
