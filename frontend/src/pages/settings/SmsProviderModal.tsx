import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextArea } from '../../components/ui/TextArea';
import { TextInput } from '../../components/ui/TextInput';
import { parseProviderVariables, type SmsProvider } from './smsTypes';

type Mode = { type: 'create' } | { type: 'edit'; provider: SmsProvider };

type Props = {
  mode: Mode;
  onClose: () => void;
  onSave: (p: Omit<SmsProvider, 'id'> & { id?: string }) => void | Promise<void>;
  saving?: boolean;
  error?: string | null;
};

export function SmsProviderModal({ mode, onClose, onSave, saving, error }: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.provider : null;

  const [name, setName] = useState(src?.name ?? '');
  const [code, setCode] = useState(src?.code ?? '');
  const [variablesText, setVariablesText] = useState(src?.variables.join(', ') ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Sağlayıcı adı gerekli';
    if (!code.trim()) next.code = 'Gönderim kodu gerekli';
    setErrors(next);
    if (Object.keys(next).length) return;

    await onSave({
      id: src?.id,
      name: name.trim(),
      code: code.trim(),
      variables: parseProviderVariables(variablesText),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="sms-prov-title"
        className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 id="sms-prov-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Sağlayıcı Düzenle' : 'Sağlayıcı Ekle'}
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-50"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                {error}
              </p>
            ) : null}

            <TextInput
              data-km-jump
              label="Sağlayıcı Adı *"
              value={name}
              error={errors.name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <TextArea
                data-km-jump
                label="Gönderim Kodu (PHP)"
                rows={10}
                value={code}
                error={errors.code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[12rem] font-mono text-[12px] leading-relaxed"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--panel-muted)]">
                Php yazılım dilinde olduğundan emin olun. Aşağıdaki değişkenlerinizi diez (#değişken#)
                içine alarak kodunuzun içinde yerlerine yerleştirin. Kodun içinde numara istenilen
                alana #numara# yazın. Sms metni istenilen yere ise #sms_icerigi# yazın!
              </p>
            </div>

            <div>
              <TextArea
                data-km-jump
                label="Değişkenler"
                rows={3}
                value={variablesText}
                onChange={(e) => setVariablesText(e.target.value)}
                className="min-h-[4rem]"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--panel-muted)]">
                Değişkenler kod içinde kullanılan ve değişmesi mümkün verilerdir. Virgül ile ayırarak
                giriniz.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              disabled={saving}
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
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
