import gsap from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CardSegmentRates } from './mockPos';

export type SegmentKey = 'all' | 'bireysel' | 'ticari';

export const SEGMENTS: { key: SegmentKey; label: string; short: string }[] = [
  { key: 'all', label: 'Tüm Kartlar', short: 'Tümü' },
  { key: 'bireysel', label: 'Bireysel Kartlar', short: 'Bireysel' },
  { key: 'ticari', label: 'Ticari Kartlar', short: 'Ticari' },
];

export function installmentTitle(n: number) {
  return n === 1 ? 'Tek Çekim' : `${n}. Taksit`;
}

export function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-[var(--panel-muted)]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        data-km-jump
        className="h-10 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function CellInput({
  value,
  onChange,
  disabled,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      data-km-jump
      className={[
        'h-9 w-full min-w-0 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2 text-sm tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
    />
  );
}

export function StatusSwitch({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      data-km-jump
      onClick={onToggle}
      className={[
        'relative h-6 w-11 rounded-full transition',
        active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
          active ? 'left-[1.35rem]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  );
}

export function DeleteModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--panel-ink)]">Taksiti sil</h2>
            <p className="mt-2 text-sm text-[var(--panel-muted)]">
              <strong className="text-[var(--panel-ink)]">{name}</strong> silinsin mi? Bu işlem geri
              alınamaz.
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DetailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export type PatchSegFn = (
  n: number,
  key: SegmentKey,
  patch: Partial<CardSegmentRates>,
) => void;
