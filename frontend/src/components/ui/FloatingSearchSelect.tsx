import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  required?: boolean;
  kmJump?: boolean;
  /** Dışarıdan odak / yanıp sönme */
  pulse?: boolean;
  className?: string;
};

/**
 * Yüzen etiket + arama listesi (portal — modal içinde kesilmez).
 */
export function FloatingSearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder: _placeholder = 'Seçiniz.',
  required,
  kmJump,
  pulse,
  className = '',
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((o) => o.label.toLocaleLowerCase('tr').includes(q));
  }, [options, query]);

  function placePanel() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  function pick(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  const floating = open || !!selected;

  return (
    <div ref={rootRef} className={['relative', className].join(' ')}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        {...(kmJump ? { 'data-km-jump': true } : {})}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required}
        onClick={() => setOpen((v) => !v)}
        className={[
          'relative flex h-[3.25rem] w-full items-center rounded-xl border bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 text-left transition',
          open
            ? 'border-[var(--input-border-focus)]'
            : 'border-[var(--input-border)] hover:border-[color-mix(in_srgb,var(--input-border-focus)_45%,var(--input-border))]',
          pulse ? 'field-focus-pulse' : '',
        ].join(' ')}
      >
        <span
          className={[
            'input-label-gap pointer-events-none absolute left-3 z-10 px-1.5 transition-all duration-200',
            floating
              ? 'is-gapped top-0 -translate-y-1/2 text-xs font-medium text-[var(--input-label)]'
              : 'top-1/2 -translate-y-1/2 text-sm text-[var(--panel-muted)]',
          ].join(' ')}
        >
          {label}
        </span>

        {/* Kapalı + boşken sadece etiket; placeholder etiketle çakışmasın — yükseklik TextInput ile aynı */}
        <span
          className={[
            'min-w-0 flex-1 truncate text-sm leading-5',
            selected ? 'text-[var(--panel-ink)]' : 'text-transparent',
          ].join(' ')}
          aria-hidden={!selected}
        >
          {selected ? selected.label : '\u00a0'}
        </span>

        {selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Temizle"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="mr-1 rounded p-1 text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <XIcon />
          </span>
        ) : null}
        <Chevron open={open} />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[12000] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              <div className="border-b border-[var(--panel-line)] p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ara…"
                  className="w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)]"
                />
              </div>
              <ul role="listbox" className="max-h-52 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-[var(--panel-muted)]">Sonuç yok</li>
                ) : (
                  filtered.map((opt) => (
                    <li key={opt.value} role="option" aria-selected={value === opt.value}>
                      <button
                        type="button"
                        onClick={() => pick(opt)}
                        className={[
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                          value === opt.value
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] font-medium text-[var(--color-brand-700)]'
                            : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-[var(--panel-muted)] transition ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
