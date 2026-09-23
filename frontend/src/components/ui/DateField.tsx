import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  kmJump?: boolean;
};

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseKey(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m: m - 1, d };
}

function formatDisplay(k: string) {
  if (!k) return '';
  const { y, m, d } = parseKey(k);
  return `${String(d).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}.${y}`;
}

function todayKey() {
  const n = new Date();
  return toKey(n.getFullYear(), n.getMonth(), n.getDate());
}

function monthCells(y: number, m: number) {
  const total = new Date(y, m + 1, 0).getDate();
  const startRaw = new Date(y, m, 1).getDay();
  const start = startRaw === 0 ? 6 : startRaw - 1;
  const out: { key: string; day: number; inMonth: boolean; weekend: boolean }[] = [];
  for (let i = 0; i < start; i++) {
    out.push({ key: `pad-${y}-${m}-${i}`, day: 0, inMonth: false, weekend: false });
  }
  for (let d = 1; d <= total; d++) {
    const wd = (start + d - 1) % 7;
    out.push({ key: toKey(y, m, d), day: d, inMonth: true, weekend: wd >= 5 });
  }
  return out;
}

/**
 * Tek tarih alanı — panel temalı takvim (native date picker yerine).
 */
export function DateField({ label, value, onChange, error, kmJump }: Props) {
  const autoId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [view, setView] = useState(() => {
    if (value) {
      const p = parseKey(value);
      return { y: p.y, m: p.m };
    }
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  const cells = useMemo(() => monthCells(view.y, view.m), [view.y, view.m]);
  const today = todayKey();
  const display = formatDisplay(value);
  const hasValue = !!value;
  const floating = open || hasValue;

  useEffect(() => {
    if (!open) return;
    if (value) {
      const p = parseKey(value);
      setView({ y: p.y, m: p.m });
    }
  }, [open, value]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const r = btnRef.current!.getBoundingClientRect();
      const w = 296;
      const h = 340;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const below = r.bottom + 8;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : below;
      setPos({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function pick(key: string) {
    onChange(key);
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          id={autoId}
          data-km-jump={kmJump ? true : undefined}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className={[
            'peer relative flex w-full items-center rounded-xl border bg-[var(--input-bg)] px-3.5 text-left text-sm outline-none transition-colors',
            floating ? 'pb-2.5 pt-5' : 'py-3.5',
            open
              ? 'border-[var(--input-border-focus)]'
              : 'border-[var(--input-border)] hover:border-[color-mix(in_srgb,var(--input-border-focus)_55%,var(--input-border))]',
            error ? '!border-red-400' : '',
          ].join(' ')}
        >
          <span
            className={[
              'min-w-0 flex-1 truncate tabular-nums',
              hasValue
                ? 'text-[var(--panel-ink)]'
                : floating
                  ? 'text-[var(--panel-muted)]/70'
                  : 'invisible',
            ].join(' ')}
            aria-hidden={!hasValue && !floating}
          >
            {hasValue ? display : 'gg.aa.yyyy'}
          </span>
          <span className="ml-2 shrink-0 text-[var(--panel-muted)]">
            <CalendarIcon />
          </span>
        </button>

        <label
          htmlFor={autoId}
          className={[
            'input-label-gap pointer-events-none absolute left-3 z-10 origin-left px-1.5 transition-all duration-200',
            floating
              ? 'is-gapped top-0 -translate-y-1/2 text-xs font-medium'
              : 'top-1/2 -translate-y-1/2 text-sm text-[var(--panel-muted)]',
            floating
              ? open
                ? 'text-[var(--input-label)]'
                : 'text-[var(--panel-muted)]'
              : '',
            error && open ? '!text-red-500' : '',
          ].join(' ')}
        >
          {label}
        </label>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              className="fixed z-[12000] w-[296px] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="border-b border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Önceki ay"
                    onClick={() => shiftMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                  >
                    <Chevron dir="left" />
                  </button>
                  <p className="text-sm font-bold tracking-tight text-[var(--panel-ink)]">
                    {MONTHS[view.m]}{' '}
                    <span className="font-semibold text-[var(--panel-muted)]">{view.y}</span>
                  </p>
                  <button
                    type="button"
                    aria-label="Sonraki ay"
                    onClick={() => shiftMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                  >
                    <Chevron dir="right" />
                  </button>
                </div>
              </div>

              <div className="px-3 pb-2 pt-3">
                <div className="mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  {WEEKDAYS.map((w, i) => (
                    <span key={w} className={i >= 5 ? 'text-[color-mix(in_srgb,var(--color-brand-600)_70%,var(--panel-muted))]' : ''}>
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((c) => {
                    if (!c.inMonth) return <span key={c.key} className="h-9" />;
                    const selected = c.key === value;
                    const isToday = c.key === today;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => pick(c.key)}
                        className={[
                          'relative flex h-9 items-center justify-center rounded-xl text-[13px] font-medium transition',
                          selected
                            ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                            : isToday
                              ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] text-[var(--color-brand-700)] ring-1 ring-[color-mix(in_srgb,var(--color-brand-500)_35%,transparent)]'
                              : c.weekend
                                ? 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]'
                                : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                        ].join(' ')}
                      >
                        {c.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-3 py-2">
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-rose-600"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={() => pick(today)}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-700)] transition hover:bg-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)]"
                >
                  Bugün
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M14.5 6L8.5 12l6 6' : 'M9.5 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
