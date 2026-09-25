import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextArea } from '../../components/ui/TextArea';
import { type SmsTemplate } from './smsTypes';

type Mode = { type: 'create' } | { type: 'edit'; template: SmsTemplate };

type Props = {
  mode: Mode;
  options: { value: string; label: string }[];
  varHints?: Record<string, string[]>;
  onClose: () => void;
  onSave: (t: Omit<SmsTemplate, 'id'> & { id?: string }) => void | Promise<void>;
  saving?: boolean;
  error?: string | null;
};

export function SmsTemplateModal({
  mode,
  options,
  varHints,
  onClose,
  onSave,
  saving,
  error,
}: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.template : null;

  const [typeKey, setTypeKey] = useState<string | null>(src?.typeKey ?? null);
  const [body, setBody] = useState(src?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const typeOptions = useMemo(() => {
    if (isEdit && src && !options.some((o) => o.value === src.typeKey)) {
      return [{ value: src.typeKey, label: src.name }, ...options];
    }
    return options;
  }, [options, isEdit, src]);

  const hints = typeKey ? varHints?.[typeKey] || [] : [];

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
    if (!typeKey) next.typeKey = 'Şablon seçin';
    if (!body.trim()) next.body = 'İçerik gerekli';
    setErrors(next);
    if (Object.keys(next).length) return;

    const label = typeOptions.find((o) => o.value === typeKey)?.label ?? typeKey!;
    await onSave({
      id: src?.id,
      typeKey: typeKey!,
      name: label,
      body: body.trim(),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="sms-tpl-title"
        className="relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 id="sms-tpl-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Şablon Düzenle' : 'Şablon Ekle'}
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

            <FloatingSearchSelect
              label="Şablon *"
              options={typeOptions}
              value={typeKey}
              onChange={setTypeKey}
              placeholder="Şablon seçiniz."
              required
              kmJump
            />
            {errors.typeKey ? <p className="-mt-2 text-xs text-red-500">{errors.typeKey}</p> : null}

            {hints.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--panel-muted)]">
                  Kullanılabilir Değişkenler
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hints.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-bg)] px-2 py-1 font-mono text-[11px] text-[var(--brand-on-soft)] transition hover:border-[var(--color-brand-500)]/40"
                      onClick={() => setBody((b) => `${b}${b.endsWith(' ') || !b ? '' : ' '}${v}`)}
                      title="İçeriğe ekle"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--panel-muted)]">
                Kullanılabilir değişkenler — Şablon Değişkenleri kaydından gelir.
              </p>
            )}

            <TextArea
              data-km-jump
              label="İçerik *"
              rows={8}
              value={body}
              error={errors.body}
              onChange={(e) => setBody(e.target.value)}
              required
              className="min-h-[10rem] text-[13px] leading-relaxed"
            />
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
