import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';

type Mode = { type: 'create' } | { type: 'edit'; id: string; name: string };

type Props = {
  titleCreate: string;
  titleEdit: string;
  mode: Mode;
  existingNames: string[];
  onClose: () => void;
  onSave: (name: string, id?: string) => void;
};

/** Ad-only ekle/düzenle — tip / tür / marka / anlaşma iskeleti */
export function SimpleNameModal({
  titleCreate,
  titleEdit,
  mode,
  existingNames,
  onClose,
  onSave,
}: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.name : '');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    window.setTimeout(() => nameRef.current?.focus(), 200);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Adı zorunlu');
      return;
    }
    const self = isEdit ? mode.name : '';
    const dup = existingNames.some(
      (n) =>
        n.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr') &&
        n.toLocaleLowerCase('tr') !== self.toLocaleLowerCase('tr'),
    );
    if (dup) {
      setError('Bu ad zaten var');
      return;
    }
    onSave(trimmed, isEdit ? mode.id : undefined);
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? titleEdit : titleCreate}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <TextInput
            ref={nameRef}
            data-km-jump
            label="Adı"
            value={name}
            error={error || undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            required
          />
          <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] pt-4">
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
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-500)]"
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
