import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  kmJump?: boolean;
  className?: string;
};

/**
 * Yazılabilir filtreli alan — listeden seç veya serbest bırak.
 */
export function CreatableFilterInput({
  label,
  value,
  onChange,
  options,
  placeholder = 'Yazın veya seçin…',
  required,
  kmJump,
  className = '',
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const filtered = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((o) => o.toLocaleLowerCase('tr').includes(q));
  }, [options, value]);

  const exactMatch = useMemo(() => {
    const q = value.trim().toLocaleLowerCase('tr');
    if (!q) return true;
    return options.some((o) => o.toLocaleLowerCase('tr') === q);
  }, [options, value]);

  function placePanel() {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    placePanel();
    function onMove() {
      placePanel();
    }
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const floating = open || value.length > 0;

  return (
    <div ref={rootRef} className={['relative', className].join(' ')}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          {...(kmJump ? { 'data-km-jump': true } : {})}
          value={value}
          required={required}
          autoComplete="off"
          placeholder=" "
          onFocus={() => {
            setOpen(true);
            placePanel();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            placePanel();
          }}
          className={[
            'peer w-full rounded-xl border bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 text-sm outline-none transition-colors',
            'border-[var(--input-border)] text-[var(--panel-ink)]',
            'focus:border-[var(--input-border-focus)]',
            !exactMatch && value.trim() ? 'border-amber-500/60' : '',
          ].join(' ')}
        />
        <label
          htmlFor={id}
          className={[
            'input-label-gap pointer-events-none absolute left-3 z-10 origin-left px-1.5 transition-all duration-200',
            floating
              ? 'is-gapped top-0 -translate-y-1/2 text-xs font-medium text-[var(--input-label)]'
              : 'top-1/2 -translate-y-1/2 text-sm text-[var(--panel-muted)]',
          ].join(' ')}
        >
          {label}
        </label>
        {!exactMatch && value.trim() ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            Yeni
          </span>
        ) : null}
      </div>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[12000] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              <ul className="max-h-52 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-[var(--panel-muted)]">
                    Listede yok — kaydederken eklenebilir
                  </li>
                ) : (
                  filtered.map((opt) => (
                    <li key={opt}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onChange(opt);
                          setOpen(false);
                          inputRef.current?.blur();
                        }}
                        className={[
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                          value.trim().toLocaleLowerCase('tr') === opt.toLocaleLowerCase('tr')
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] font-medium text-[var(--color-brand-700)]'
                            : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    </li>
                  ))
                )}
              </ul>
              {!value.trim() ? (
                <p className="border-t border-[var(--panel-line)] px-3 py-2 text-[11px] text-[var(--panel-muted)]">
                  {placeholder}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
