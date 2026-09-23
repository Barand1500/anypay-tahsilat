import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextArea } from '../../components/ui/TextArea';
import { TextInput } from '../../components/ui/TextInput';
import {
  EMAIL_TEMPLATE_TYPE_OPTIONS,
  templateTypeMeta,
  type EmailTemplate,
} from './mockEmailSettings';

type Mode = { type: 'create' } | { type: 'edit'; template: EmailTemplate };

type Props = {
  mode: Mode;
  /** Create’de zaten kullanılan tip anahtarları — listeden çıkar */
  usedTypeKeys: string[];
  onClose: () => void;
  onSave: (t: Omit<EmailTemplate, 'id'> & { id?: string }) => void;
};

export function EmailTemplateModal({ mode, usedTypeKeys, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.template : null;

  const [typeKey, setTypeKey] = useState<string | null>(src?.typeKey ?? null);
  const [subject, setSubject] = useState(src?.subject ?? '');
  const [body, setBody] = useState(src?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const typeOptions = EMAIL_TEMPLATE_TYPE_OPTIONS.filter(
    (o) => o.value === src?.typeKey || !usedTypeKeys.includes(o.value),
  ).map((o) => ({ value: o.value, label: o.label }));

  const meta = typeKey ? templateTypeMeta(typeKey) : null;

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

  function onPickType(v: string | null) {
    setTypeKey(v);
    if (!v) return;
    const m = templateTypeMeta(v);
    if (m && !isEdit) {
      setSubject(m.subject);
      if (!body.trim()) {
        setBody(`Merhaba,\n\n${m.label} şablonu içeriği.\n\n${m.vars.join(' ')}`);
      }
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!typeKey) next.typeKey = 'Şablon seçin';
    if (!subject.trim()) next.subject = 'Konu gerekli';
    if (!body.trim()) next.body = 'İçerik gerekli';
    setErrors(next);
    if (Object.keys(next).length) return;

    const m = templateTypeMeta(typeKey!);
    onSave({
      id: src?.id,
      typeKey: typeKey!,
      name: m?.label ?? typeKey!,
      subject: subject.trim(),
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
        aria-labelledby="email-tpl-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 id="email-tpl-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Şablon Düzenle' : 'Şablon Ekle'}
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

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <FloatingSearchSelect
              label="Şablon *"
              options={typeOptions}
              value={typeKey}
              onChange={onPickType}
              placeholder="Şablon seçiniz."
              required
              kmJump
            />
            {errors.typeKey ? <p className="-mt-2 text-xs text-red-500">{errors.typeKey}</p> : null}

            <TextInput
              data-km-jump
              label="Konu *"
              value={subject}
              error={errors.subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />

            {meta ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--panel-muted)]">
                  Kullanılabilir Değişkenler
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.vars.map((v) => (
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
                Kullanılabilir Değişkenler — şablon seçince listelenir.
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
              className="min-h-[10rem] font-mono text-[13px] leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
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
