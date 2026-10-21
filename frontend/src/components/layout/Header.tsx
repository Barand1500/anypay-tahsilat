import { ProfileMenu } from './ProfileMenu';
import { QuickAccessSlots } from './QuickAccessSlots';
import { useQuickAccess } from './QuickAccessContext';
import { SearchTrigger } from './SearchTrigger';
import { SupportBugButton } from './SupportBugButton';
import { ThemeBurstToggle } from './ThemeBurstToggle';

type Props = {
  onOpenSearch?: () => void;
};

export function Header({ onOpenSearch }: Props) {
  const { config: quickAccess } = useQuickAccess();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-header)] px-4 sm:gap-4 sm:px-6">
      <SearchTrigger onOpen={onOpenSearch} />

      {quickAccess.enabled ? (
        <div className="min-w-0 overflow-hidden">
          <QuickAccessSlots />
        </div>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SupportBugButton />
        <ThemeBurstToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
