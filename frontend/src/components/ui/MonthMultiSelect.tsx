import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STAT_MONTHS } from '../../pages/reports/mockStatistics';

type Props = {
  label: string;
  value: string[];
  onChange: (months: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  kmJump?: boolean;
};

/**
 * Çoklu ay seçimi — chip + checklist.
 */
export function MonthMultiSelect({
  label,
  value,
  onChange,
  disabled,
  placeholder = 'Ay seçiniz.',
  kmJump,
}: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedLabels = STAT_MONTHS.filter((m) => value.includes(m.value)).map((m) => m.label);
  const floating = open || value.length > 0 || disabled;

  useEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) });
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
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  function toggle(m: string) {
    if (value.includes(m)) onChange(value.filter((x) => x !== m));
    else onChange([...value, m].sort((a, b) => Number(a) - Number(b)));
  }

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        id={id}
        data-km-jump={kmJump ? true : undefined}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          'relative flex w-full items-center rounded-xl border bg-[var(--input-bg)] px-3.5 text-left text-sm outline-none transition-colors',
          floating ? 'pb-2.5 pt-5' : 'py-3.5',
          open
            ? 'border-[var(--input-border-focus)]'
            : 'border-[var(--input-border)]',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <span
          className={[
            'min-w-0 flex-1 truncate',
            value.length && !disabled ? 'text-[var(--panel-ink)]' : 'text-[var(--panel-muted)]',
            !floating ? 'invisible' : '',
          ].join(' ')}
        >
          {disabled ? 'Tüm yıl' : summary}
        </span>
        <span className="ml-2 shrink-0 text-[var(--panel-muted)]">▾</span>
      </button>
      <label
        htmlFor={id}
        className={[
          'input-label-gap pointer-events-none absolute left-3 z-10 origin-left px-1.5 transition-all duration-200',
          floating
            ? 'is-gapped top-0 -translate-y-1/2 text-xs font-medium text-[var(--panel-muted)]'
            : 'top-1/2 -translate-y-1/2 text-sm text-[var(--panel-muted)]',
          open ? '!text-[var(--input-label)]' : '',
        ].join(' ')}
      >
        {label}
      </label>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[12000] max-h-72 overflow-auto rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-2 shadow-[var(--panel-shadow)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              <div className="mb-1.5 flex items-center justify-between px-1">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[var(--color-brand-700)]"
                  onClick={() => onChange(STAT_MONTHS.map((m) => m.value))}
                >
                  Tümünü seç
                </button>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[var(--panel-muted)] hover:text-rose-600"
                  onClick={() => onChange([])}
                >
                  Temizle
                </button>
              </div>
              <ul className="space-y-0.5">
                {STAT_MONTHS.map((m) => {
                  const on = value.includes(m.value);
                  return (
                    <li key={m.value}>
                      <button
                        type="button"
                        onClick={() => toggle(m.value)}
                        className={[
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                          on
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] font-semibold text-[var(--panel-ink)]'
                            : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                            on
                              ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white'
                              : 'border-[var(--panel-line)]',
                          ].join(' ')}
                        >
                          {on ? '✓' : ''}
                        </span>
                        {m.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
