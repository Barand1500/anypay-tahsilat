import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
};

/**
 * Aramalı combobox — yazarak filtreler, klavye ile gezilebilir.
 */
export function SearchableCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seçin veya yazın…',
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((o) => o.label.toLocaleLowerCase('tr').includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
  }, [open, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange(null);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--panel-muted)]">
        {label}
      </label>

      <div
        className={[
          'flex items-center gap-2 rounded-xl border bg-[var(--panel-elevated)] px-3 py-2.5 transition',
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-[var(--panel-line)] hover:border-brand-500/40',
        ].join(' ')}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)]"
          placeholder={selected && !open ? selected.label : placeholder}
          value={open ? query : selected?.label ?? ''}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
        />
        {selected && !open ? (
          <button
            type="button"
            aria-label="Seçimi temizle"
            onClick={clear}
            className="rounded-md p-1 text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <XIcon />
          </button>
        ) : (
          <ChevronIcon open={open} />
        )}
      </div>

      {open ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--panel-muted)]">Sonuç yok</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={opt.value} role="option" aria-selected={value === opt.value}>
                <button
                  type="button"
                  className={[
                    'flex w-full items-center px-3 py-2.5 text-left text-sm transition',
                    i === highlight
                      ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]'
                      : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--panel-muted)]" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-[var(--panel-muted)] transition ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
