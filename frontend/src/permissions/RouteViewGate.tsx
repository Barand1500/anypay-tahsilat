import { Link, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { EXTRA_QUICK_ITEMS, NAV_ITEMS } from '../components/layout/navItems';
import { DEFINITIONS_SUBNAV } from '../pages/definitions/currencyTypes';
import { POS_KART_SUBNAV } from '../pages/definitions/PosKartLayout';
import { REPORT_SUBNAV } from '../pages/reports/statisticsTypes';
import { SETTINGS_SUBNAV } from '../pages/settings/mockSettings';
import { usePermission } from './PermissionContext';

const SECTION_PAGES: Record<string, readonly string[]> = {
  '/raporlar': REPORT_SUBNAV.map((item) => item.to),
  '/tanimlamalar': DEFINITIONS_SUBNAV.flatMap((item) =>
    item.to === '/tanimlamalar/pos-kart'
      ? POS_KART_SUBNAV.map((child) => child.to)
      : [item.to],
  ),
  '/tanimlamalar/pos-kart': POS_KART_SUBNAV.map((item) => item.to),
  '/ayarlar': SETTINGS_SUBNAV.map((item) => item.to),
};

/**
 * Rota görüntüleme kapısı — Görüntüle izni yoksa içeriği basmaz.
 */
export function RouteViewGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { canViewPath, canViewNavItem, rolesLoading, permPagesReady } = usePermission();

  if (rolesLoading || !permPagesReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--panel-muted)]">
        Yetkiler yükleniyor…
      </div>
    );
  }

  const sectionPages = SECTION_PAGES[location.pathname.replace(/\/+$/, '')];
  if (sectionPages) {
    const first = sectionPages.find((path) => canViewNavItem(path));
    if (first) return <Navigate to={first} replace />;
  }

  const result = canViewPath(location.pathname);
  if (location.pathname === '/' && !canViewNavItem('/')) {
    const first = [...NAV_ITEMS.slice(1), ...EXTRA_QUICK_ITEMS]
      .find((item) => canViewNavItem(item.to));
    return <Navigate to={first?.to || '/profil'} replace />;
  }
  if (result.allowed) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 11V8a4 4 0 0 1 8 0v3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h1 className="text-lg font-bold text-[var(--panel-ink)]">Yetki yok</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
        Bu sayfayı görüntülemeye yetkiniz yoktur.
        {result.pageName ? (
          <>
            {' '}
            (<span className="font-medium text-[var(--panel-ink)]">{result.pageName}</span>
            {' — '}
            görüntüleme)
          </>
        ) : null}
      </p>
      <Link
        to="/profil"
        className="mt-6 rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Profile dön
      </Link>
    </div>
  );
}
