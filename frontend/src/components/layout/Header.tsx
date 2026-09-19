import type { MouseEvent } from 'react';
import { ProfileMenu } from './ProfileMenu';
import { QuickAccessSlots } from './QuickAccessSlots';
import { ThemeBurstToggle } from './ThemeBurstToggle';

type Props = {
  autoHide?: boolean;
  onHeaderDoubleClick?: (e: MouseEvent) => void;
  onOpenSearch?: () => void;
};

export function Header({ autoHide = false, onHeaderDoubleClick, onOpenSearch }: Props) {
  return (
    <header
      onDoubleClick={onHeaderDoubleClick}
      title={
        autoHide
          ? 'Çift tıkla: header’ı sabitle'
          : 'Çift tıkla: header’ı gizle (görev çubuğu gibi)'
      }
      className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-header)] px-4 sm:gap-4 sm:px-6"
    >
      <button
        type="button"
        onClick={onOpenSearch}
        className="group relative w-full max-w-[220px] shrink-0 text-left sm:max-w-[280px]"
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

      <QuickAccessSlots />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {autoHide ? (
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[var(--panel-muted)] sm:inline">
            Otomatik gizle
          </span>
        ) : null}
        <ThemeBurstToggle />
        <ProfileMenu />
      </div>
    </header>
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
