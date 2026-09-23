import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { BANKS } from '../payments/mockBanks';
import { VIRTUAL_POS_INFRASTRUCTURES } from './mockPos';

export type VirtualPosModalMode =
  | { type: 'create' }
  | { type: 'edit'; id: string; bankId: string; infrastructureId: string };

type Props = {
  mode: VirtualPosModalMode;
  /** Aynı banka+altyapı çifti engeli */
  existingKeys: string[];
  onClose: () => void;
  onSave: (data: { bankId: string; bankName: string; infrastructureId: string; posName: string }) => void;
};

/** Sanal POS ekle / düzenle — Esc / X */
export function VirtualPosModal({ mode, existingKeys, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const [bankId, setBankId] = useState<string | null>(isEdit ? mode.bankId : null);
  const [infraId, setInfraId] = useState<string | null>(isEdit ? mode.infrastructureId : null);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const bankOptions = useMemo(
    () => BANKS.map((b) => ({ value: b.id, label: b.fullName })),
    [],
  );
  const infraOptions = useMemo(
    () => VIRTUAL_POS_INFRASTRUCTURES.map((x) => ({ value: x.id, label: x.label })),
    [],
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!bankId) {
      setError('Banka seçiniz');
      return;
    }
    if (!infraId) {
      setError('Sanal POS alt yapısı seçiniz');
      return;
    }
    const key = `${bankId}|${infraId}`;
    const selfKey = isEdit ? `${mode.bankId}|${mode.infrastructureId}` : '';
    if (key !== selfKey && existingKeys.includes(key)) {
      setError('Bu banka ve alt yapı zaten tanımlı');
      return;
    }
    const bank = BANKS.find((b) => b.id === bankId);
    const infra = VIRTUAL_POS_INFRASTRUCTURES.find((x) => x.id === infraId);
    if (!bank || !infra) {
      setError('Geçersiz seçim');
      return;
    }
    onSave({
      bankId: bank.id,
      bankName: bank.fullName,
      infrastructureId: infra.id,
      posName: infra.label,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="vpos-modal-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <h2 id="vpos-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Sanal POS Tanımı Düzenle' : 'Sanal POS Tanımı Ekle'}
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

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
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
            label="Sanal POS Alt Yapısı"
            required
            kmJump
            options={infraOptions}
            value={infraId}
            onChange={(v) => {
              setInfraId(v);
              setError('');
            }}
            placeholder="Alt yapı seçiniz."
          />
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              data-km-jump
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
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
