import type { MouseEvent } from 'react';
import { useDockMode } from './DockModeContext';
import { GestureWindSettingsButton } from './GestureWindContext';
import { ProfileMenu } from './ProfileMenu';
import { QuickAccessSlots } from './QuickAccessSlots';
import { useQuickAccess } from './QuickAccessContext';
import { SearchTrigger } from './SearchTrigger';
import { SupportBugButton } from './SupportBugButton';
import { ThemeBurstToggle } from './ThemeBurstToggle';
import { VaultDockChip } from './VaultWidget';

type Props = {
  autoHide?: boolean;
  onHeaderDoubleClick?: (e: MouseEvent) => void;
  onOpenSearch?: () => void;
};

export function Header({ autoHide = false, onHeaderDoubleClick, onOpenSearch }: Props) {
  const { enabled: dockOn } = useDockMode();
  const { config: quickAccess } = useQuickAccess();

  return (
    <header
      onDoubleClick={dockOn ? undefined : onHeaderDoubleClick}
      title={
        dockOn
          ? undefined
          : autoHide
            ? 'Çift tıkla: header’ı sabitle'
            : 'Çift tıkla: header’ı gizle (görev çubuğu gibi)'
      }
      className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-header)] px-4 sm:gap-4 sm:px-6"
    >
      <SearchTrigger onOpen={onOpenSearch} dockAttr="source" />

      {quickAccess.enabled ? (
        <div data-dock-source="quick" className="min-w-0 overflow-hidden">
          <QuickAccessSlots />
        </div>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!dockOn ? <GestureWindSettingsButton /> : null}
        {autoHide && !dockOn ? (
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[var(--panel-muted)] sm:inline">
            Otomatik gizle
          </span>
        ) : null}
        <SupportBugButton />
        <div data-dock-source="theme">
          <ThemeBurstToggle />
        </div>
        <VaultDockChip place="header" />
        <div data-dock-source="profile">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
