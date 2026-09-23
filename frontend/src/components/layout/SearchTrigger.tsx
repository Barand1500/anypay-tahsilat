type Props = {
  onOpen?: () => void;
  /** Header / footer ölçüm etiketleri */
  dockAttr?: 'source' | 'target';
  className?: string;
};

/**
 * Global ara tetikleyici — header ve dock footer’da aynı görünüm.
 */
export function SearchTrigger({ onOpen, dockAttr, className }: Props) {
  return (
    <button
      type="button"
      {...(dockAttr === 'source'
        ? { 'data-dock-source': 'search' }
        : dockAttr === 'target'
          ? { 'data-dock-target': 'search' }
          : {})}
      onClick={onOpen}
      className={[
        'group relative w-full max-w-[220px] shrink-0 text-left sm:max-w-[280px]',
        className ?? '',
      ].join(' ')}
      aria-label="Ara (Ctrl+K)"
    >
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)] transition group-hover:text-[var(--color-brand-600)]">
        <SearchIcon />
      </span>
      <span className="flex w-full items-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-2 text-sm text-[var(--panel-muted)] outline-none transition group-hover:border-[var(--color-brand-500)]/45 group-hover:bg-[var(--panel-elevated)] group-hover:text-[var(--panel-ink)]/70">
        <span className="min-w-0 flex-1 truncate">Ara…</span>
        <kbd className="ml-2 hidden shrink-0 rounded-md border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--panel-muted)] sm:inline">
          Ctrl+K
        </kbd>
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
