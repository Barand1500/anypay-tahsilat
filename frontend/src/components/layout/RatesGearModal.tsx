import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { RATE_CATALOG, type RateKind } from './ratesCatalog';
import { useRates } from './RatesContext';

const KIND_LABEL: Record<RateKind, string> = {
  fx: 'Döviz',
  metal: 'Kıymetli maden',
  crypto: 'Kripto',
};

/**
 * Hangi kurlar şeritte görünsün — Esc / X; overlay kapatmaz.
 */
export function RatesGearModal() {
  const { gearOpen, setGearOpen, selectedIds, setSelectedIds } = useRates();
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gearOpen) return;
    setDraft(selectedIds);
  }, [gearOpen, selectedIds]);

  useEffect(() => {
    if (!gearOpen) return;
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 14, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' },
    );
  }, [gearOpen]);

  useEffect(() => {
    if (!gearOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setGearOpen(false);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [gearOpen, setGearOpen]);

  if (!gearOpen) return null;

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSelectedIds(draft);
    setGearOpen(false);
  }

  const groups = (['fx', 'metal', 'crypto'] as RateKind[]).map((kind) => ({
    kind,
    items: RATE_CATALOG.filter((x) => x.kind === kind),
  }));

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="rates-gear-title"
        className="relative z-10 flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-3.5">
          <div>
            <h2 id="rates-gear-title" className="text-lg font-bold text-[var(--panel-ink)]">
              Kur şeridi
            </h2>
            <p className="text-xs text-[var(--panel-muted)]">Gösterilecek enstrümanları seç</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setGearOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
          >
            ×
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {groups.map((g) => (
              <div key={g.kind}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-600)]">
                  {KIND_LABEL[g.kind]}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {g.items.map((inst) => {
                    const on = draft.includes(inst.id);
                    return (
                      <label
                        key={inst.id}
                        className={[
                          'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition',
                          on
                            ? 'border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)]'
                            : 'border-[var(--panel-line)] hover:border-[var(--color-brand-500)]/30',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(inst.id)}
                          className="accent-[var(--color-brand-600)]"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-[var(--panel-ink)]">
                            {inst.short}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--panel-muted)]">
                            {inst.label}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
            <button
              type="button"
              onClick={() => setGearOpen(false)}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2 text-sm font-semibold"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              data-km-jump
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-700)]"
            >
              Kaydet
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
