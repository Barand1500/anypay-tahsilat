import { Outlet } from 'react-router-dom';
import { NestedDefSubnav } from './NestedDefSubnav';

/** POS + Kart alt sayfaları — tek üst sekme altında */
export const POS_KART_SUBNAV = [
  { to: '/tanimlamalar/pos-kart/sanal-pos', label: 'Sanal POS Tanımları', end: false },
  { to: '/tanimlamalar/pos-kart/ortak-sanal-pos', label: 'Ortak Sanal POS Tanımları', end: true },
  { to: '/tanimlamalar/pos-kart/anlasmalar', label: 'Kart Anlaşmaları', end: false },
  { to: '/tanimlamalar/pos-kart/tipler', label: 'Kart Tipleri', end: true },
  { to: '/tanimlamalar/pos-kart/turler', label: 'Kart Türleri', end: true },
  { to: '/tanimlamalar/pos-kart/markalar', label: 'Kart Markaları', end: true },
] as const;

export default function PosKartLayout() {
  return (
    <div className="w-full space-y-4">
      <NestedDefSubnav items={POS_KART_SUBNAV} />
      <Outlet />
    </div>
  );
}
