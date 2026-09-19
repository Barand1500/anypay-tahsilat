import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getLiveCustomers } from '../../pages/customers/mockCustomers';
import { getLiveUsers } from '../../pages/users/mockUsers';
import { useTheme } from '../../theme/ThemeProvider';
import { NAV_ITEMS } from './navItems';

type CategoryId = 'pages' | 'admin' | 'customers' | 'users' | 'actions';

type SearchItem = {
  id: string;
  category: CategoryId;
  title: string;
  subtitle?: string;
  keywords?: string;
  run: () => void;
};

const ADMIN_PAGES = [
  { to: '/moduller', label: 'Modüller', hint: 'Panel modülleri' },
  { to: '/roller', label: 'Roller', hint: 'Yetki ve roller' },
  { to: '/kullanicilar', label: 'Kullanıcılar', hint: 'Hesap yönetimi' },
  { to: '/surum-gecmisi', label: 'Sürüm Geçmişi', hint: 'Versiyon notları' },
  { to: '/log-kayitlari', label: 'Log Kayıtları', hint: 'Sistem logları' },
  { to: '/sistem-sifirlama', label: 'Sistem Sıfırlama', hint: 'Tehlikeli işlemler' },
] as const;

const CATEGORY_META: Record<
  CategoryId,
  { label: string; order: number; tint: string }
> = {
  pages: {
    label: 'Sayfalar',
    order: 0,
    tint: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
  admin: {
    label: 'Yönetim',
    order: 1,
    tint: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  customers: {
    label: 'Müşteriler',
    order: 2,
    tint: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  users: {
    label: 'Kullanıcılar',
    order: 3,
    tint: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  actions: {
    label: 'Hızlı işlemler',
    order: 4,
    tint: 'bg-[var(--brand-soft-bg)] text-[var(--color-brand-600)]',
  },
};

const MAX_PER_CAT = 6;

function norm(s: string) {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matches(item: SearchItem, q: string) {
  if (!q) return true;
  const hay = norm([item.title, item.subtitle ?? '', item.keywords ?? ''].join(' '));
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Ortada açılan global arama — Ctrl+K / header tık; Esc veya X ile kapanır */
export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const go = useCallback(
    (to: string) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const allItems = useMemo((): SearchItem[] => {
    const pages: SearchItem[] = NAV_ITEMS.map((n) => ({
      id: `page-${n.to}`,
      category: 'pages',
      title: n.label,
      subtitle: n.soon ? 'Yakında' : n.to === '/' ? 'Ana özet' : n.to,
      keywords: `sayfa menu ${n.label}`,
      run: () => go(n.to),
    }));

    const admin: SearchItem[] = ADMIN_PAGES.map((n) => ({
      id: `admin-${n.to}`,
      category: 'admin',
      title: n.label,
      subtitle: n.hint,
      keywords: `yonetim admin ${n.label}`,
      run: () => go(n.to),
    }));

    const customers: SearchItem[] = getLiveCustomers().map((c) => ({
      id: `cust-${c.id}`,
      category: 'customers',
      title: c.title,
      subtitle: `${c.code} · ${c.email || c.phone || c.taxNo}`,
      keywords: [c.code, c.email, c.phone, c.taxNo, c.taxOffice, c.accountType].join(' '),
      run: () => go(c.parentId ? `/musteriler?ust=${encodeURIComponent(c.parentId)}` : '/musteriler'),
    }));

    const users: SearchItem[] = getLiveUsers().map((u) => ({
      id: `user-${u.id}`,
      category: 'users',
      title: u.name,
      subtitle: `${u.email} · ${u.roleName}`,
      keywords: [u.email, u.phone, u.branch, u.roleName, u.status].join(' '),
      run: () => go(`/kullanicilar?highlight=${encodeURIComponent(u.id)}`),
    }));

    const actions: SearchItem[] = [
      {
        id: 'act-new-customer',
        category: 'actions',
        title: 'Yeni müşteri ekle',
        subtitle: 'Müşteri formu',
        keywords: 'ekle yeni cari',
        run: () => go('/musteriler/yeni'),
      },
      {
        id: 'act-theme',
        category: 'actions',
        title: theme === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç',
        subtitle: theme === 'dark' ? 'Açık tema' : 'Koyu tema',
        keywords: 'tema dark light gece gunduz',
        run: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'act-profile',
        category: 'actions',
        title: 'Profilim',
        subtitle: 'Hesap ayarları',
        keywords: 'profil hesap',
        run: () => go('/profil'),
      },
    ];

    return [...pages, ...admin, ...actions, ...customers, ...users];
  }, [go, onClose, theme, toggleTheme]);

  const qNorm = norm(query.trim());

  const flat = useMemo(() => {
    const filtered = allItems.filter((item) => matches(item, qNorm));
    const byCat = new Map<CategoryId, SearchItem[]>();
    for (const item of filtered) {
      const list = byCat.get(item.category) ?? [];
      if (list.length < MAX_PER_CAT) list.push(item);
      byCat.set(item.category, list);
    }
    // Boş sorguda müşteri/kullanıcı şişmesin — yalnızca sayfa, yönetim, işlem
    const cats: CategoryId[] = qNorm
      ? (['pages', 'admin', 'customers', 'users', 'actions'] as const)
      : (['pages', 'admin', 'actions'] as const);

    const out: SearchItem[] = [];
    for (const cat of [...cats].sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)) {
      out.push(...(byCat.get(cat) ?? []));
    }
    return out;
  }, [allItems, qNorm]);

  const groups = useMemo(() => {
    const map = new Map<CategoryId, SearchItem[]>();
    for (const item of flat) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()].sort(
      (a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order,
    );
  }, [flat]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    closingRef.current = false;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open, flat]);

  useLayoutEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set(overlay, { autoAlpha: 1 });
      gsap.set(panel, { autoAlpha: 1, y: 0, scale: 1 });
      return;
    }

    gsap.set(overlay, { autoAlpha: 0 });
    gsap.set(panel, { autoAlpha: 0, y: 28, scale: 0.94 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(overlay, { autoAlpha: 1, duration: 0.28 }, 0).to(
      panel,
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.4 },
      0.04,
    );
    return () => {
      tl.kill();
    };
  }, [open]);

  const animateClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !overlay || !panel) {
      onClose();
      return;
    }
    const tl = gsap.timeline({
      defaults: { ease: 'power2.in' },
      onComplete: onClose,
    });
    tl.to(panel, { autoAlpha: 0, y: 16, scale: 0.96, duration: 0.2 }, 0).to(
      overlay,
      { autoAlpha: 0, duration: 0.22 },
      0.02,
    );
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        animateClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(flat.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = flat[active];
        if (item) item.run();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, animateClose, flat, active]);

  if (!open) return null;

  let idx = -1;

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-start justify-center px-4 pb-8 pt-[min(12vh,7rem)] sm:pt-[min(14vh,8.5rem)]">
      <div ref={overlayRef} className="absolute inset-0 bg-black/50 backdrop-blur-[6px]" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label="Global arama"
        className="relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]"
      >
        {/* Üst ışık — gece/gündüz */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--color-brand-500)]/18 via-[var(--color-brand-500)]/5 to-transparent"
          aria-hidden
        />

        <div className="relative flex items-center gap-3 border-b border-[var(--panel-line)] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft-bg)] text-[var(--color-brand-600)]">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sayfa, müşteri, kullanıcı veya işlem ara…"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)]"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={animateClose}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            Esc
          </button>
        </div>

        <div ref={listRef} className="max-h-[min(58vh,420px)] overflow-y-auto px-2 py-2">
          {flat.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[15px] font-semibold text-[var(--panel-ink)]">Sonuç yok</p>
              <p className="mt-1 text-sm text-[var(--panel-muted)]">
                Farklı bir kelime deneyin — sayfa, müşteri veya işlem
              </p>
            </div>
          ) : (
            groups.map(([cat, items]) => (
              <section key={cat} className="mb-1.5">
                <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[var(--panel-elevated)]/95 px-2.5 py-1.5 backdrop-blur-sm">
                  <span
                    className={[
                      'inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-bold uppercase tracking-wide',
                      CATEGORY_META[cat].tint,
                    ].join(' ')}
                  >
                    {CATEGORY_META[cat].label}
                  </span>
                  <span className="text-[10px] text-[var(--panel-muted)]">{items.length}</span>
                </div>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    idx += 1;
                    const i = idx;
                    const isActive = i === active;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-idx={i}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => item.run()}
                          className={[
                            'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition',
                            isActive
                              ? 'bg-[var(--brand-soft-bg)] ring-1 ring-[var(--color-brand-500)]/25'
                              : 'hover:bg-[var(--panel-hover)]',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                              CATEGORY_META[item.category].tint,
                            ].join(' ')}
                          >
                            <CatIcon cat={item.category} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-[var(--panel-ink)]">
                              {item.title}
                            </span>
                            {item.subtitle ? (
                              <span className="block truncate text-[12px] text-[var(--panel-muted)]">
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                          {isActive ? (
                            <kbd className="hidden rounded-md border border-[var(--panel-line)] bg-[var(--panel-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--panel-muted)] sm:inline">
                              Enter
                            </kbd>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/80 px-4 py-2.5 text-[11px] text-[var(--panel-muted)]">
          <Hint keys={['↑', '↓']} label="gezin" />
          <Hint keys={['Enter']} label="aç" />
          <Hint keys={['Esc']} label="kapat" />
          <span className="ml-auto font-medium text-[var(--panel-ink)]/50">
            {theme === 'dark' ? 'Gece' : 'Gündüz'} · Ctrl+K
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-1 py-0.5 font-semibold text-[var(--panel-ink)]/70"
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}

function CatIcon({ cat }: { cat: CategoryId }) {
  if (cat === 'pages') return <IconPages />;
  if (cat === 'admin') return <IconShield />;
  if (cat === 'customers') return <IconBriefcase />;
  if (cat === 'users') return <IconUser />;
  return <IconBolt />;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconPages() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h10M4 18h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v5c0 5 3.2 8.4 7 9.5 3.8-1.1 7-4.5 7-9.5V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 19.5c1.6-3.2 4-4.5 7-4.5s5.4 1.3 7 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
