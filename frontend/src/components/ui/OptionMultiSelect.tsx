import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MultiOption = { value: string; label: string };

type Props = {
  label: string;
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  kmJump?: boolean;
  pulse?: boolean;
};

/**
 * Çoklu seçim — chip özeti + checklist (şube vb.).
 * Boşken yalnızca label; seçim/açıkken label üste çıkar.
 */
export function OptionMultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seçiniz.',
  kmJump,
  pulse,
}: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const floating = open || value.length > 0;

  useEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 260) });
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

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;

  return (
    <div className={['relative', pulse ? 'field-focus-pulse rounded-xl' : ''].join(' ')}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        {...(kmJump ? { 'data-km-jump': true } : {})}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={[
          'relative flex w-full items-center rounded-xl border bg-[var(--input-bg)] px-3.5 text-left text-sm outline-none transition-colors',
          floating ? 'pb-2.5 pt-5' : 'py-3.5',
          open
            ? 'border-[var(--input-border-focus)]'
            : 'border-[var(--input-border)] hover:border-[var(--input-border-focus)]/60',
        ].join(' ')}
      >
        <span
          className={[
            'min-w-0 flex-1 truncate pr-2 font-semibold',
            value.length ? 'text-[var(--panel-ink)]' : 'text-[var(--panel-muted)]',
            !floating ? 'invisible' : '',
          ].join(' ')}
        >
          {summary}
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
              role="listbox"
              aria-multiselectable
              className="fixed z-[13000] max-h-64 overflow-y-auto rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {options.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--panel-muted)]">Seçenek yok</p>
              ) : (
                options.map((o) => {
                  const on = value.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(o.value)}
                      className={[
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        on ? 'bg-[var(--panel-hover)] font-semibold' : 'hover:bg-[var(--panel-hover)]',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                          on
                            ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white'
                            : 'border-[var(--panel-line)] text-transparent',
                        ].join(' ')}
                      >
                        ✓
                      </span>
                      <span className="text-[var(--panel-ink)]">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
