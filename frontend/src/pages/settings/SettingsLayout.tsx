import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { DEFAULT_VISIBLE_SETTINGS_TABS, type GeneralSettings } from './mockSettings';
import { SettingsSubnav } from './SettingsSubnav';

export type SettingsTabsOutlet = { setVisibleTabs: (tabs: string[]) => void };

/** Ayarlar sekmeleri layout’ta kalır — kayan pill remount olmaz */
export default function SettingsLayout() {
  const { token } = useAuth();
  const [visibleTabs, setVisibleTabs] = useState<string[]>(DEFAULT_VISIBLE_SETTINGS_TABS);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.get<GeneralSettings>('/api/settings/general', token)
      .then((settings) => {
        if (!cancelled) setVisibleTabs(settings.visibleSettingsTabs ?? DEFAULT_VISIBLE_SETTINGS_TABS);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="w-full space-y-4 pb-8">
      <SettingsSubnav visibleTabs={visibleTabs} />
      <Outlet context={{ setVisibleTabs } satisfies SettingsTabsOutlet} />
    </div>
  );
}
