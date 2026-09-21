import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  INITIAL_VERSIONS,
  splitVersionDate,
  VERSION_KIND_LABEL,
  type VersionChangeKind,
  type VersionEntry,
} from './mockVersions';

/**
 * Sürüm Geçmişi — dikey timeline, sol/sağ kart, CSS giriş animasyonu.
 */
export default function VersionsPage() {
  const [visible, setVisible] = useState(3);
  const endRef = useRef<HTMLDivElement>(null);
  const list = INITIAL_VERSIONS.slice(0, visible);
  const hasMore = visible < INITIAL_VERSIONS.length;
  const latest = INITIAL_VERSIONS[0]?.version;

  function showMore() {
    setVisible((n) => Math.min(n + 2, INITIAL_VERSIONS.length));
    window.setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <nav className="mb-1 text-xs text-[var(--panel-muted)]">
          <Link to="/" className="hover:text-[var(--color-brand-600)]">
            Anasayfa
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[var(--panel-ink)]">Sürümler</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Sürümler</h1>
            <p className="mt-1 text-sm text-[var(--panel-muted)]">
              Panel güncellemeleri ve düzeltmeler.
            </p>
          </div>
          {latest ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))] bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] px-3 py-1.5 text-xs font-semibold text-[var(--panel-ink)]">
              Güncel
              <span className="tabular-nums text-[var(--brand-on-soft)]">v{latest}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative pb-8 pt-2">
        {/* Orta çizgi */}
        <div
          className="pointer-events-none absolute bottom-10 left-4 top-0 w-px bg-[var(--panel-line)] md:left-1/2 md:-translate-x-1/2"
          aria-hidden
        />

        <ul className="space-y-10 md:space-y-14">
          {list.map((entry, i) => (
            <TimelineItem key={entry.id} entry={entry} index={i} side={i % 2 === 0 ? 'left' : 'right'} />
          ))}
        </ul>

        <div ref={endRef} className="relative z-10 mt-10 flex justify-center md:justify-center">
          {hasMore ? (
            <button
              type="button"
              data-km-jump
              onClick={showMore}
              aria-label="Daha eski sürümler"
              title="Daha eski sürümler"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--color-brand-500)_18%,var(--panel-elevated))] text-[var(--brand-on-soft)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--color-brand-500)_28%,var(--panel-elevated))] hover:shadow-md"
            >
              <ChevronDownIcon />
            </button>
          ) : (
            <p className="text-xs text-[var(--panel-muted)]">Tüm sürümler listelendi</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  entry,
  index,
  side,
}: {
  entry: VersionEntry;
  index: number;
  side: 'left' | 'right';
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([hit]) => {
        if (hit?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const kindClass = kindTone(entry.kind);

  return (
    <li
      ref={ref}
      data-km-row
      tabIndex={-1}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className={[
        'relative grid grid-cols-1 gap-3 md:grid-cols-[1fr_48px_1fr] md:items-start md:gap-0',
        inView ? 'version-row-in' : 'opacity-0',
      ].join(' ')}
    >
      {/* Sol kolon */}
      <div className="order-2 md:order-1 md:pr-5 md:text-right">
        {side === 'left' ? (
          <VersionCard entry={entry} align="right" kindClass={kindClass} />
        ) : (
          <div className="hidden justify-end pt-2 md:flex">
            <DateBox iso={entry.at} />
          </div>
        )}
      </div>

      {/* Orta düğüm */}
      <div className="absolute left-4 top-1 z-10 flex -translate-x-1/2 justify-center md:static md:order-2 md:translate-x-0">
        <span
          className={[
            'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--panel-elevated)] shadow-sm',
            kindClass.node,
          ].join(' ')}
          aria-hidden
        >
          <CheckIcon />
        </span>
      </div>

      {/* Sağ kolon */}
      <div className="order-3 pl-10 md:order-3 md:pl-5">
        {side === 'right' ? (
          <VersionCard entry={entry} align="left" kindClass={kindClass} />
        ) : (
          <div className="hidden justify-start pt-2 md:flex">
            <DateBox iso={entry.at} />
          </div>
        )}
      </div>

      {/* Mobil tarih */}
      <div className="order-4 pl-10 md:hidden">
        <DateBox iso={entry.at} />
      </div>
    </li>
  );
}

function DateBox({ iso }: { iso: string }) {
  const parts = splitVersionDate(iso);
  return (
    <time
      dateTime={iso}
      className="inline-flex min-w-[5.5rem] flex-col items-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-2 text-center shadow-[var(--panel-shadow)] ring-1 ring-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)]"
    >
      <span className="text-[11px] font-bold tabular-nums leading-none text-[var(--panel-ink)]">
        {parts.day} {parts.month}
      </span>
      <span className="mt-1 text-[10px] font-semibold tabular-nums text-[var(--panel-muted)]">
        {parts.year}
      </span>
      <span className="mt-1 rounded-md bg-[var(--panel-surface)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--brand-on-soft)]">
        {parts.time}
      </span>
    </time>
  );
}

function VersionCard({
  entry,
  align,
  kindClass,
}: {
  entry: VersionEntry;
  align: 'left' | 'right';
  kindClass: ReturnType<typeof kindTone>;
}) {
  return (
    <article
      className={[
        'w-full rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] transition',
        'hover:border-[color-mix(in_srgb,var(--color-brand-500)_30%,var(--panel-line))]',
      ].join(' ')}
    >
      <div
        className={[
          'flex flex-wrap items-center gap-2',
          align === 'right' ? 'md:justify-end' : '',
        ].join(' ')}
      >
        <h2 className="text-3xl font-bold tracking-tight text-[var(--panel-ink)]">{entry.version}</h2>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            kindClass.badge,
          ].join(' ')}
        >
          {VERSION_KIND_LABEL[entry.kind]}
        </span>
      </div>
      <p
        className={[
          'mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]',
          align === 'right' ? 'md:text-right' : '',
        ].join(' ')}
      >
        {VERSION_KIND_LABEL[entry.kind]}:
      </p>
      <ul
        className={[
          'mt-1.5 space-y-1.5 text-sm leading-relaxed text-[var(--panel-ink)]',
          align === 'right' ? 'md:text-right' : '',
        ].join(' ')}
      >
        {entry.items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

function kindTone(kind: VersionChangeKind) {
  if (kind === 'added') {
    return {
      node: 'bg-emerald-500 text-white',
      badge: 'bg-emerald-500/20 text-[var(--panel-ink)]',
    };
  }
  if (kind === 'fixed') {
    return {
      node: 'bg-[var(--color-brand-600)] text-white',
      badge:
        'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--brand-on-soft)]',
    };
  }
  return {
    node: 'bg-amber-500 text-white',
    badge: 'bg-amber-500/20 text-[var(--panel-ink)]',
  };
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 5 5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
