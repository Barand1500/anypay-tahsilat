import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { parseHm } from '../../pages/settings/personalPrefs';

type Props = {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onConfirm: (hm: string) => void;
};

type Mode = 'hour' | 'minute';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseValue(v: string): { h: number; m: number } {
  const p = parseHm(v);
  if (p) return p;
  return { h: 20, m: 0 };
}

/**
 * Analog saat seçici — Başlangıç / Bitiş (Gece otomatik tema).
 * Modal: Esc / Tamam / X — overlay tıklayınca kapanmaz.
 */
export function AnalogTimePicker({ open, title, value, onClose, onConfirm }: Props) {
  const titleId = useId();
  const dialRef = useRef<HTMLDivElement>(null);
  const initial = parseValue(value);
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.m);
  const [mode, setMode] = useState<Mode>('hour');
  const dragging = useRef(false);

  useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    setHour(p.h);
    setMinute(p.m);
    setMode('hour');
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function angleFromPointer(clientX: number, clientY: number): number | null {
    const el = dialRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  }

  function applyAngle(deg: number) {
    if (mode === 'hour') {
      // 12'lik kadran → 0..11; öğleden sonra ise +12
      const slot = Math.round(deg / 30) % 12;
      setHour(hour >= 12 ? (slot === 0 ? 12 : slot + 12) % 24 || 12 : slot);
    } else {
      setMinute(Math.round(deg / 6) % 60);
    }
  }

  function onDialDown(e: ReactPointerEvent) {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const deg = angleFromPointer(e.clientX, e.clientY);
    if (deg != null) applyAngle(deg);
  }

  function onDialMove(e: ReactPointerEvent) {
    if (!dragging.current) return;
    const deg = angleFromPointer(e.clientX, e.clientY);
    if (deg != null) applyAngle(deg);
  }

  function onDialUp(e: ReactPointerEvent) {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (mode === 'hour') setMode('minute');
  }

  function toggleAmPm() {
    setHour((h) => (h >= 12 ? h - 12 : h + 12));
  }

  const display = `${pad(hour)}:${pad(minute)}`;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-[340px] rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              aria-hidden
              style={{
                background:
                  'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 35%, #f59e0b 70%, #ea580c 100%)',
              }}
            >
              <div className="h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(253,224,71,0.9)]" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-[var(--panel-ink)]">
                {title}
              </h2>
              <p className="text-xs text-[var(--panel-muted)]">Saat seçimi</p>
            </div>
          </div>
          <button
            type="button"
            data-km-jump
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="mt-5 text-center text-4xl font-bold tabular-nums tracking-tight text-[var(--panel-ink)]">
          {display}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-km-jump
            onClick={() => setMode('hour')}
            className={[
              'rounded-full px-3 py-2 text-xs font-semibold transition',
              mode === 'hour'
                ? 'bg-[var(--panel-line)] text-[var(--panel-ink)]'
                : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
            ].join(' ')}
          >
            Saat (akrep)
          </button>
          <button
            type="button"
            data-km-jump
            onClick={() => setMode('minute')}
            className={[
              'rounded-full px-3 py-2 text-xs font-semibold transition',
              mode === 'minute'
                ? 'bg-[var(--panel-line)] text-[var(--panel-ink)]'
                : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
            ].join(' ')}
          >
            Dakika (yelkovan)
          </button>
        </div>

        <div className="mt-2 flex justify-center">
          <button
            type="button"
            data-km-jump
            onClick={toggleAmPm}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-600)] hover:bg-[var(--panel-hover)]"
          >
            {hour >= 12 ? 'Öğleden sonra (12–23)' : 'Öğleden önce (00–11)'}
          </button>
        </div>

        <div className="mt-3 flex justify-center">
          <div
            ref={dialRef}
            onPointerDown={onDialDown}
            onPointerMove={onDialMove}
            onPointerUp={onDialUp}
            onPointerCancel={onDialUp}
            className="relative h-[220px] w-[220px] cursor-pointer touch-none select-none rounded-full border border-[var(--panel-line)] bg-[var(--panel-bg)] shadow-inner"
            role="presentation"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const n = i === 0 ? 12 : i;
              const ang = (i * 30 - 90) * (Math.PI / 180);
              const r = 88;
              const x = 110 + Math.cos(ang) * r;
              const y = 110 + Math.sin(ang) * r;
              return (
                <span
                  key={n}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--panel-muted)]"
                  style={{ left: x, top: y }}
                >
                  {n}
                </span>
              );
            })}

            <div
              className="absolute left-1/2 top-1/2 origin-bottom rounded-sm"
              style={{
                width: 2,
                height: 72,
                marginLeft: -1,
                marginTop: -72,
                background: 'var(--color-brand-500)',
                transform: `rotate(${minuteAngle}deg)`,
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 origin-bottom rounded-sm"
              style={{
                width: 4,
                height: 48,
                marginLeft: -2,
                marginTop: -48,
                background: 'var(--panel-ink)',
                transform: `rotate(${hourAngle}deg)`,
              }}
            />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--panel-ink)]" />
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--panel-muted)]">
          Kadrana tıklayın: önce saat, sonra dakika seçilir. İbreler otomatik güncellenir.
        </p>

        <button
          type="button"
          data-km-jump
          onClick={() => onConfirm(`${pad(hour)}:${pad(minute)}`)}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)]"
        >
          Tamam
        </button>
      </div>
    </div>,
    document.body,
  );
}
