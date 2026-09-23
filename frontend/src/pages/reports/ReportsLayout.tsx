import { Outlet } from 'react-router-dom';
import { ReportSubnav } from './ReportSubnav';

/** Rapor sekmeleri layout’ta kalır — kayan pill remount olmaz */
export default function ReportsLayout() {
  return (
    <div className="w-full space-y-4 pb-8">
      <ReportSubnav />
      <Outlet />
    </div>
  );
}
