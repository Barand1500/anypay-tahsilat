import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';

export type CardBrandModalMode =
  | { type: 'create' }
  | { type: 'edit'; id: string; name: string; logoUrl?: string; initials?: string };

type Props = {
  mode: CardBrandModalMode;
  existingNames: string[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    logoDataUrl?: string | null;
    initials: string;
    id?: string;
  }) => Promise<void>;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

/** Kart markası ekle / düzenle — Esc / X */
export function CardBrandModal({ mode, existingNames, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.name : '');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    isEdit ? mode.logoUrl : undefined,
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState(
    isEdit && mode.logoUrl ? 'Logo seçildi' : 'Dosya seçilmedi.',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    window.setTimeout(() => nameRef.current?.focus(), 200);
  }, []);

  async function onFile(file: File | null) {
    if (!file) {
      setLogoDataUrl(null);
      setPreviewUrl(isEdit ? mode.logoUrl : undefined);
      setFileLabel(isEdit && mode.logoUrl ? 'Logo seçildi' : 'Dosya seçilmedi.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Sadece görsel dosya seçin');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoDataUrl(dataUrl);
      setPreviewUrl(dataUrl);
      setFileLabel(file.name);
      setError('');
    } catch {
      setError('Dosya okunamadı');
    }
  }

  async function submit(e: FormEvent) {
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
    const initials = trimmed
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toLocaleUpperCase('tr');
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: trimmed,
        logoDataUrl: logoDataUrl || undefined,
        initials: isEdit && mode.initials && !logoDataUrl ? mode.initials : initials,
        id: isEdit ? mode.id : undefined,
      });
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
        aria-labelledby="brand-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <h2 id="brand-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Kart Markası Düzenle' : 'Kart Markası Ekle'}
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
          <TextInput
            ref={nameRef}
            label="Adı"
            required
            value={name}
            error={error || undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            data-km-jump
          />

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[var(--panel-muted)]">Logo</p>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5">
              <button
                type="button"
                data-km-jump
                onClick={() => fileRef.current?.click()}
                className="shrink-0 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
              >
                Göz at…
              </button>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--panel-muted)]">
                {fileLabel}
              </span>
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-8 w-auto max-w-[56px] object-contain" />
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

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
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-500)] disabled:opacity-50"
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
