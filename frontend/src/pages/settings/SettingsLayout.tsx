import { Outlet } from 'react-router-dom';
import { SettingsSubnav } from './SettingsSubnav';

/** Ayarlar sekmeleri layout’ta kalır — kayan pill remount olmaz */
export default function SettingsLayout() {
  return (
    <div className="w-full space-y-4 pb-8">
      <SettingsSubnav />
      <Outlet />
    </div>
  );
}
