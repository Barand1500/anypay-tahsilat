import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findNavItem } from './navItems';
import { NavIcon } from './NavIcon';
import { QUICK_SLOTS, useQuickAccess } from './QuickAccessContext';

/** Header’da 4 boş yuva — sürükle-bırak hızlı erişim */
export function QuickAccessSlots() {
  const { slots, drag, setSlot, endDrag, moveDrag } = useQuickAccess();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!drag) {
      setHoverIndex(null);
      return;
    }

    function onMove(e: PointerEvent) {
      moveDrag(e.clientX, e.clientY);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slot = el?.closest('[data-quick-slot]') as HTMLElement | null;
      setHoverIndex(slot ? Number(slot.dataset.quickSlot) : null);
    }

    function onUp(e: PointerEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slot = el?.closest('[data-quick-slot]') as HTMLElement | null;
      if (slot) {
        endDrag(Number(slot.dataset.quickSlot));
      } else {
        endDrag();
      }
      setHoverIndex(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, endDrag, moveDrag]);

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        title="Hızlı erişim — menüden basılı tutup buraya sürükle"
        onDoubleClick={(e: ReactMouseEvent) => e.stopPropagation()}
      >
        {Array.from({ length: QUICK_SLOTS }, (_, i) => {
          const to = slots[i];
          const item = to ? findNavItem(to) : null;
          const active = item
            ? item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            : false;
          const isTarget = drag != null && hoverIndex === i;

          if (item) {
            return (
              <div key={i} data-quick-slot={i}>
                <Link
                  to={item.to}
                  title={`${item.label} — sağ tık: kaldır`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSlot(i, null);
                  }}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                    active
                      ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--color-brand-600)]'
                      : 'border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)]',
                    isTarget ? 'scale-105 ring-2 ring-[var(--color-brand-500)]' : '',
                  ].join(' ')}
                >
                  <NavIcon name={item.icon} size={16} />
                </Link>
              </div>
            );
          }

          return (
            <div
              key={i}
              data-quick-slot={i}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-xl border border-dashed transition',
                isTarget
                  ? 'scale-105 border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_16%,var(--panel-surface))] text-[var(--brand-on-soft)]'
                  : 'border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-muted)]',
              ].join(' ')}
              title="Boş yuva — menü öğesini buraya bırak"
            >
              <span className="text-xs opacity-40">+</span>
            </div>
          );
        })}
      </div>

      {drag ? <DragGhost x={drag.x} y={drag.y} icon={drag.item.icon} label={drag.item.label} /> : null}
    </>
  );
}

function DragGhost({ x, y, icon, label }: { x: number; y: number; icon: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[10002] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-[var(--color-brand-500)] bg-[var(--panel-elevated)] text-[var(--color-brand-600)] shadow-[var(--panel-shadow)]"
      style={{ left: x, top: y }}
      aria-hidden
      title={label}
    >
      <NavIcon name={icon} size={18} />
    </div>
  );
}
