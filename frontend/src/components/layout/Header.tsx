import type { MouseEvent } from 'react';
import { ProfileMenu } from './ProfileMenu';
import { QuickAccessSlots } from './QuickAccessSlots';
import { ThemeBurstToggle } from './ThemeBurstToggle';

type Props = {
  autoHide?: boolean;
  onHeaderDoubleClick?: (e: MouseEvent) => void;
};

export function Header({ autoHide = false, onHeaderDoubleClick }: Props) {
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
      <div className="relative w-full max-w-[220px] shrink-0 sm:max-w-[260px]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
          <SearchIcon />
        </span>
        <input
          type="search"
          placeholder="Ara [CTRL + K]"
          className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none transition placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)] focus:bg-[var(--panel-elevated)]"
          readOnly
          title="Arama sonraki adımda gelecek"
        />
      </div>

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
