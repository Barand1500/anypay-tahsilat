import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';

export type CommonVirtualPosModalMode =
  | { type: 'create' }
  | {
      type: 'edit';
      id: string;
      bankId: string;
      targetBankId: string;
      active: boolean;
    };

type BankOption = { id: string; name: string };

type Props = {
  mode: CommonVirtualPosModalMode;
  banks: BankOption[];
  /** Kaynak banka id’leri — banka başına tek yönlendirme */
  existingSourceBankIds: string[];
  onClose: () => void;
  onSave: (data: {
    bankId: string;
    targetBankId: string;
    active: boolean;
  }) => Promise<void>;
};

/** Ortak Sanal POS ekle / düzenle — Esc / X */
export function CommonVirtualPosModal({
  mode,
  banks,
  existingSourceBankIds,
  onClose,
  onSave,
}: Props) {
  const isEdit = mode.type === 'edit';
  const [bankId, setBankId] = useState<string | null>(isEdit ? mode.bankId : null);
  const [targetBankId, setTargetBankId] = useState<string | null>(
    isEdit ? mode.targetBankId : null,
  );
  const [active, setActive] = useState(isEdit ? mode.active : true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const bankOptions = useMemo(
    () => banks.map((b) => ({ value: b.id, label: b.name })),
    [banks],
  );

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!bankId) {
      setError('Banka seçiniz');
      return;
    }
    if (!targetBankId) {
      setError('Yönlenen banka seçiniz');
      return;
    }
    if (bankId === targetBankId) {
      setError('Banka ile yönlenen banka aynı olamaz');
      return;
    }
    const selfSource = isEdit ? mode.bankId : '';
    if (bankId !== selfSource && existingSourceBankIds.includes(bankId)) {
      setError('Bu banka için zaten bir yönlendirme tanımlı');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ bankId, targetBankId, active });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="cvpos-modal-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <h2 id="cvpos-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Ortak Sanal POS Tanımı Düzenle' : 'Ortak Sanal POS Tanımı Ekle'}
          </h2>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            ✕
          </button>
        </header>

        <form onSubmit={(e) => void submit(e)} className="space-y-4 px-5 py-4">
          <FloatingSearchSelect
            label="Banka"
            required
            kmJump
            options={bankOptions}
            value={bankId}
            onChange={(v) => {
              setBankId(v);
              setError('');
            }}
            placeholder="Banka seçiniz."
          />
          <FloatingSearchSelect
            label="Yönlenen Banka"
            required
            kmJump
            options={bankOptions}
            value={targetBankId}
            onChange={(v) => {
              setTargetBankId(v);
              setError('');
            }}
            placeholder="Yönlenen Banka seçiniz."
          />

          <div className="flex items-center justify-between rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3.5 py-3">
            <span className="text-sm font-semibold text-[var(--panel-ink)]">
              Durum <span className="text-[var(--color-brand-600)]">*</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              data-km-jump
              onClick={() => setActive((v) => !v)}
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
          </div>

          {error ? <p className="text-sm text-rose-500">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-50"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              disabled={saving}
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
