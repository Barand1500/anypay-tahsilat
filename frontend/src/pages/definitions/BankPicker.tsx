import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BANKS, type BankInfo } from '../payments/mockBanks';

type Props = {
  open: boolean;
  /** Seçili banka adı (fullName veya name) */
  value: string;
  onSelect: (bank: BankInfo) => void;
  onClose: () => void;
};

/**
 * Banka seçici — ana modalın sağında açılır (para birimi sembol seçiciyle aynı iskelet).
 */
export function BankPicker({ open, value, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, x: 28 },
      { autoAlpha: 1, x: 0, duration: 0.34, ease: 'power3.out' },
    );
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return BANKS;
    return BANKS.filter(
      (b) =>
        b.name.toLocaleLowerCase('tr').includes(q) ||
        b.fullName.toLocaleLowerCase('tr').includes(q) ||
        b.id.toLocaleLowerCase('tr').includes(q),
    );
  }, [query]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-label="Banka seç"
      className="flex h-[min(72vh,560px)] w-full max-w-2xl shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.22)] sm:w-[300px] sm:max-w-none"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--panel-line)] px-4 py-3.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-600)]">
            Banka
          </p>
          <h3 className="text-base font-bold text-[var(--panel-ink)]">Banka seç</h3>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="border-b border-[var(--panel-line)] px-3 py-2.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
            <SearchIcon />
          </span>
          <input
            data-km-jump
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
            className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-[var(--panel-muted)]">Sonuç yok.</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((bank) => {
              const active =
                value.trim().toLocaleLowerCase('tr') === bank.fullName.toLocaleLowerCase('tr') ||
                value.trim().toLocaleLowerCase('tr') === bank.name.toLocaleLowerCase('tr');
              return (
                <li key={bank.id}>
                  <button
                    type="button"
                    data-km-jump
                    onClick={() => onSelect(bank)}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                      active
                        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)]'
                        : 'hover:bg-[var(--panel-hover)]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl',
                        active
                          ? 'bg-white ring-1 ring-[var(--color-brand-500)]/35'
                          : 'bg-[var(--panel-surface)] ring-1 ring-[var(--panel-line)]',
                      ].join(' ')}
                    >
                      <img
                        src={bank.logo}
                        alt=""
                        className="h-6 w-auto max-w-[28px] object-contain"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--panel-ink)]">
                        {bank.fullName}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--panel-muted)]">
                        {bank.name}
                      </span>
                    </span>
                    {active ? (
                      <span className="text-xs font-bold text-[var(--color-brand-600)]">✓</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--panel-line)] p-3">
        <button
          type="button"
          data-km-jump
          onClick={onClose}
          className="w-full rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Tamam
        </button>
      </div>
    </aside>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
