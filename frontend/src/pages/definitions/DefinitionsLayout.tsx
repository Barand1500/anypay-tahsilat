import { Outlet } from 'react-router-dom';
import { DefinitionsSubnav } from './DefinitionsSubnav';

/** Tanımlamalar sekmeleri layout’ta kalır — kayan pill remount olmaz */
export default function DefinitionsLayout() {
  return (
    <div className="w-full space-y-4 pb-8">
      <DefinitionsSubnav />
      <Outlet />
    </div>
  );
}
