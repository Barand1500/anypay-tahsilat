import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import type { BankDef, BankFocusField } from './bankTypes';

type Mode = { type: 'create' } | { type: 'edit'; bank: BankDef; focusField?: BankFocusField | null };

type Props = {
  mode: Mode;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    shortName: string;
    securityTypes: string;
    gateway3dUrl: string;
    apiUrl: string;
    xmlUrl: string;
    logoDataUrl?: string | null;
    logo?: string | null;
  }) => Promise<void>;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

/**
 * Banka ekle / düzenle — eski panel alanlarıyla aynı.
 */
export function BankModal({ mode, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const bank = isEdit ? mode.bank : null;
  const focusField = isEdit ? mode.focusField : null;

  const [name, setName] = useState(bank?.name ?? '');
  const [shortName, setShortName] = useState(bank?.shortName ?? '');
  const [securityTypes, setSecurityTypes] = useState(bank?.securityTypes ?? '');
  const [gateway3dUrl, setGateway3dUrl] = useState(bank?.gateway3dUrl ?? '');
  const [apiUrl, setApiUrl] = useState(bank?.apiUrl ?? '');
  const [xmlUrl, setXmlUrl] = useState(bank?.xmlUrl ?? '');
  const [logoPreview, setLogoPreview] = useState(bank?.logoUrl ?? '');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState('Dosya seçilmedi.');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(focusField ?? null);
  const panelRef = useRef<HTMLDivElement>(null);
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
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!focusField) return;
    setPulse(focusField);
    const t = window.setTimeout(() => setPulse(null), 1600);
    return () => window.clearTimeout(t);
  }, [focusField]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, logo: 'Görsel dosyası seçin' }));
      return;
    }
    try {
      const data = await readFileAsDataUrl(file);
      setLogoDataUrl(data);
      setLogoPreview(data);
      setFileLabel(file.name);
      setErrors((e) => {
        const next = { ...e };
        delete next.logo;
        return next;
      });
    } catch {
      setErrors((e) => ({ ...e, logo: 'Dosya okunamadı' }));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Adı gerekli';
    if (!shortName.trim()) next.shortName = 'Kısa adı gerekli';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        id: bank?.id,
        name: name.trim(),
        shortName: shortName.trim(),
        securityTypes: securityTypes.trim(),
        gateway3dUrl: gateway3dUrl.trim(),
        apiUrl: apiUrl.trim(),
        xmlUrl: xmlUrl.trim(),
        logoDataUrl: logoDataUrl || undefined,
        logo: bank?.logo ?? undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function fieldWrap(key: BankFocusField, node: ReactNode) {
    return (
      <div className={pulse === key ? 'field-focus-pulse rounded-xl' : undefined}>{node}</div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Banka Düzenle' : 'Banka Ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fieldWrap(
                'name',
                <TextInput
                  data-km-jump
                  label="Adı *"
                  value={name}
                  error={errors.name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />,
              )}
              {fieldWrap(
                'shortName',
                <TextInput
                  data-km-jump
                  label="Kısa Adı *"
                  value={shortName}
                  error={errors.shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  required
                />,
              )}
            </div>

            {fieldWrap(
              'logo',
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--panel-muted)]">Logo</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    data-km-jump
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
                  >
                    Göz at…
                  </button>
                  <span className="max-w-[14rem] truncate text-xs text-[var(--panel-muted)]">
                    {fileLabel}
                  </span>
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt=""
                      className="h-9 max-w-[120px] object-contain"
                    />
                  ) : null}
                </div>
                {errors.logo ? <p className="mt-1 text-xs text-rose-500">{errors.logo}</p> : null}
              </div>,
            )}

            {fieldWrap(
              'securityTypes',
              <div>
                <TextInput
                  data-km-jump
                  label="Güvenlik Tipleri"
                  value={securityTypes}
                  onChange={(e) => setSecurityTypes(e.target.value)}
                  placeholder="3D,3D_PAY,3D_HOST"
                />
                <p className="mt-1 text-[11px] text-[var(--panel-muted)]">
                  Tipleri virgül (,) ile ayırınız.
                </p>
              </div>,
            )}

            {fieldWrap(
              'gateway3dUrl',
              <TextInput
                data-km-jump
                label="Sanal Pos 3D Geçit Url"
                value={gateway3dUrl}
                onChange={(e) => setGateway3dUrl(e.target.value)}
                placeholder="https://…"
              />,
            )}
            {fieldWrap(
              'apiUrl',
              <TextInput
                data-km-jump
                label="Sanal Pos Api Url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://…"
              />,
            )}
            {fieldWrap(
              'xmlUrl',
              <TextInput
                data-km-jump
                label="Sanal Pos Xml Servis URL"
                value={xmlUrl}
                onChange={(e) => setXmlUrl(e.target.value)}
                placeholder="https://…"
              />,
            )}

            {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2 text-sm font-semibold text-[var(--panel-ink)]"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              disabled={saving}
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
