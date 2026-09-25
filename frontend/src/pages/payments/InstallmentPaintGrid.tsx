import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

type Props = {
  options: number[];
  value: number[];
  onChange: (next: number[]) => void;
  /** null/undefined = hepsi serbest; dizi = yalnızca bunlar */
  allowed?: number[] | null;
  /** klavye modu için */
  kmJump?: boolean;
};

/**
 * Taksit ızgarası — tek tık veya basılı sürükleyerek boyama (çoklu seçim).
 * İzin dışı hücreler pasif; hover: «Size atanmadı».
 */
export function InstallmentPaintGrid({ options, value, onChange, allowed, kmJump }: Props) {
  const selectedRef = useRef(value);
  selectedRef.current = value;

  const dragRef = useRef<{ mode: 'add' | 'remove' } | null>(null);
  const paintedRef = useRef<Set<number>>(new Set());

  const restricted = Array.isArray(allowed) && allowed.length > 0;
  function isAllowed(n: number) {
    return !restricted || allowed!.includes(n);
  }

  useEffect(() => {
    function endDrag() {
      dragRef.current = null;
      paintedRef.current.clear();
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  function apply(n: number, mode: 'add' | 'remove') {
    if (!isAllowed(n)) return;
    if (paintedRef.current.has(n)) return;
    paintedRef.current.add(n);
    const prev = selectedRef.current;
    const next =
      mode === 'add'
        ? prev.includes(n)
          ? prev
          : [...prev, n].sort((a, b) => a - b)
        : prev.filter((x) => x !== n);
    selectedRef.current = next;
    onChange(next);
  }

  function hitN(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el?.closest('[data-inst]') as HTMLElement | null;
    if (!cell) return null;
    if (cell.dataset.locked === '1') return null;
    const n = Number(cell.dataset.inst);
    return Number.isFinite(n) ? n : null;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const n = hitN(e.clientX, e.clientY);
    if (n == null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    paintedRef.current.clear();
    const mode = selectedRef.current.includes(n) ? 'remove' : 'add';
    dragRef.current = { mode };
    apply(n, mode);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const n = hitN(e.clientX, e.clientY);
    if (n == null) return;
    apply(n, dragRef.current.mode);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    paintedRef.current.clear();
  }

  return (
    <div
      role="group"
      aria-label="Taksit seçimi"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="grid grid-cols-4 gap-1.5 select-none touch-none sm:grid-cols-6"
    >
      {options.map((n) => {
        const on = value.includes(n);
        const ok = isAllowed(n);
        return (
          <button
            key={n}
            type="button"
            data-inst={n}
            data-locked={ok ? '0' : '1'}
            title={ok ? undefined : 'Size atanmadı'}
            disabled={!ok}
            {...(kmJump && ok ? { 'data-km-jump': true } : {})}
            tabIndex={ok ? 0 : -1}
            onKeyDown={(e) => {
              if (!ok) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const mode = selectedRef.current.includes(n) ? 'remove' : 'add';
                paintedRef.current.clear();
                apply(n, mode);
                paintedRef.current.clear();
              }
            }}
            className={[
              'rounded-lg py-2 text-sm font-bold tabular-nums transition',
              !ok
                ? 'cursor-not-allowed bg-[var(--panel-surface)] text-[var(--panel-muted)]/45 ring-1 ring-[var(--panel-line)] opacity-55'
                : on
                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                  : 'bg-[var(--panel-elevated)] text-[var(--panel-ink)] ring-1 ring-[var(--panel-line)] hover:ring-[var(--color-brand-500)]/40',
            ].join(' ')}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
