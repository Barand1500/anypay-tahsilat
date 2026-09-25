import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import { InstallmentPaintGrid } from '../payments/InstallmentPaintGrid';
import { BRANCH_INSTALLMENTS, type BranchDef } from './branchTypes';

export type BranchFocusField = 'name' | 'installments';

type Mode = { type: 'create' } | { type: 'edit'; branch: BranchDef };

type Props = {
  mode: Mode;
  existingNames: string[];
  onClose: () => void;
  onSave: (row: Omit<BranchDef, 'id'> & { id?: string }) => void | Promise<void>;
  focusField?: BranchFocusField | null;
};

/** Şube / departman ekle / düzenle — Esc / X */
export function BranchModal({
  mode,
  existingNames,
  onClose,
  onSave,
  focusField = null,
}: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.branch : null;

  const [name, setName] = useState(src?.name ?? '');
  const [installments, setInstallments] = useState<number[]>(() => [...(src?.installments ?? [])]);
  const [error, setError] = useState('');
  const [pulse, setPulse] = useState<BranchFocusField | null>(focusField);

  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const taksitBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    const field = focusField ?? 'name';
    setPulse(field);
    const t = window.setTimeout(() => {
      if (field === 'name') nameRef.current?.focus();
      else if (field === 'installments') {
        taksitBoxRef.current?.querySelector<HTMLElement>('[data-inst]')?.focus();
      }
    }, 280);
    const clear = window.setTimeout(() => setPulse(null), 1600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [focusField]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Adı zorunlu');
      nameRef.current?.focus();
      return;
    }
    const dup = existingNames.some(
      (n) =>
        n.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr') &&
        (!isEdit || n.toLocaleLowerCase('tr') !== (src?.name ?? '').toLocaleLowerCase('tr')),
    );
    if (dup) {
      setError('Bu şube / departman zaten var');
      nameRef.current?.focus();
      return;
    }
    onSave({
      id: src?.id,
      name: trimmed,
      installments: [...installments].sort((a, b) => a - b),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="branch-title"
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 id="branch-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Şube / Departman Düzenle' : 'Şube / Departman Ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col">
          <div className="space-y-4 px-5 py-4">
            <div className="flex gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-brand-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))] px-3 py-2.5 text-xs leading-relaxed text-[var(--panel-ink)]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-[10px] font-bold text-white">
                i
              </span>
              İzinli Taksitler girilmesi durumunda direkt olarak belirtilen taksitler bu şube /
              departmanda görünür.
            </div>

            <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
              <TextInput
                ref={nameRef}
                data-km-jump
                label="Adı *"
                value={name}
                error={error || undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                required
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                İzin verilen taksitler
              </p>
              <div
                ref={taksitBoxRef}
                className={[
                  'rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-3',
                  pulse === 'installments' ? 'field-focus-pulse' : '',
                ].join(' ')}
              >
                {installments.length === 0 ? (
                  <p className="mb-2 text-sm text-[var(--panel-muted)]">Taksitleri seçiniz.</p>
                ) : (
                  <p className="mb-2 text-sm font-medium text-[var(--panel-ink)]">
                    Seçili: {installments.join(', ')}
                  </p>
                )}
                <InstallmentPaintGrid
                  options={[...BRANCH_INSTALLMENTS]}
                  value={installments}
                  onChange={setInstallments}
                  kmJump
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-km-jump
                    onClick={() => setInstallments([...BRANCH_INSTALLMENTS])}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                  >
                    Tümünü Seç
                  </button>
                  <button
                    type="button"
                    data-km-jump
                    onClick={() => setInstallments([])}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-400"
                  >
                    Temizle
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
