import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import {
  TEMPLATE_VAR_TYPE_OPTIONS,
  formatTemplateVarKey,
  normalizeTemplateVarKey,
  type ModuleOption,
  type TemplateVarPair,
  type TemplateVarType,
  type TemplateVariableSet,
} from './templateVariableTypes';

type Mode = { type: 'create' } | { type: 'edit'; row: TemplateVariableSet };

type Props = {
  mode: Mode;
  modules: ModuleOption[];
  onClose: () => void;
  onSave: (
    row: Omit<TemplateVariableSet, 'id' | 'displayId' | 'module'> & {
      id?: string;
      moduleId: string;
    },
  ) => void | Promise<void>;
  saving?: boolean;
  error?: string | null;
};

type DraftPair = TemplateVarPair & { uid: string };

function emptyPair(): DraftPair {
  return { uid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dbColumn: '', key: '' };
}

export function TemplateVariableModal({
  mode,
  modules,
  onClose,
  onSave,
  saving,
  error,
}: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.row : null;

  const [name, setName] = useState(src?.name ?? '');
  const [type, setType] = useState<string | null>(src?.type ?? null);
  const [moduleId, setModuleId] = useState<string | null>(src?.moduleId ?? null);
  const [pairs, setPairs] = useState<DraftPair[]>(() =>
    src?.variables.length
      ? src.variables.map((v, i) => ({ ...v, uid: `p-${i}-${v.key}` }))
      : [emptyPair()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const moduleOptions = modules.map((m) => ({ value: m.id, label: m.label }));

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

  function patchPair(uid: string, patch: Partial<TemplateVarPair>) {
    setPairs((list) => list.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }

  function removePair(uid: string) {
    setPairs((list) => (list.length <= 1 ? list : list.filter((p) => p.uid !== uid)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Ad gerekli';
    if (!type) next.type = 'Tip seçin';
    if (!moduleId) next.module = 'Modül seçin';

    const cleaned = pairs
      .map((p) => ({
        dbColumn: p.dbColumn.trim(),
        key: normalizeTemplateVarKey(p.key),
      }))
      .filter((p) => p.dbColumn || p.key);

    if (!cleaned.length) next.vars = 'En az bir değişken girin';
    else if (cleaned.some((p) => !p.dbColumn || !p.key)) {
      next.vars = 'DB sütun ve değişken birlikte dolu olmalı';
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    await onSave({
      id: src?.id,
      name: name.trim(),
      moduleId: moduleId!,
      type: type as TemplateVarType,
      variables: cleaned,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="tvar-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 id="tvar-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Değişken Düzenle' : 'Değişken Ekle'}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                data-km-jump
                label="Adı *"
                value={name}
                error={errors.name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div>
                <FloatingSearchSelect
                  label="Tip *"
                  options={[...TEMPLATE_VAR_TYPE_OPTIONS]}
                  value={type}
                  onChange={setType}
                  placeholder="Tip seçiniz."
                  required
                  kmJump
                />
                {errors.type ? <p className="mt-1 text-xs text-red-500">{errors.type}</p> : null}
              </div>
            </div>

            <div>
              <FloatingSearchSelect
                label="Modül *"
                options={moduleOptions}
                value={moduleId}
                onChange={setModuleId}
                placeholder="Modül seçiniz."
                required
                kmJump
              />
              {errors.module ? <p className="mt-1 text-xs text-red-500">{errors.module}</p> : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--panel-ink)]">Değişkenler</h3>
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setPairs((list) => [...list, emptyPair()])}
                  className="text-xs font-semibold text-[var(--color-brand-600)] transition hover:underline"
                >
                  + Satır ekle
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--panel-line)]">
                <div className="grid grid-cols-[1fr_1fr_40px] gap-2 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/45">
                  <span>DB Sütun</span>
                  <span>Değişken</span>
                  <span className="sr-only">Sil</span>
                </div>
                <div className="divide-y divide-[var(--panel-line)]/70">
                  {pairs.map((p) => (
                    <div
                      key={p.uid}
                      className="grid grid-cols-[1fr_1fr_40px] items-center gap-2 px-3 py-2"
                    >
                      <input
                        data-km-jump
                        value={p.dbColumn}
                        onChange={(e) => patchPair(p.uid, { dbColumn: e.target.value })}
                        placeholder="AdSoyad"
                        className="h-9 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-bg)] px-2.5 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
                      />
                      <input
                        data-km-jump
                        value={p.key}
                        onChange={(e) => patchPair(p.uid, { key: e.target.value })}
                        placeholder="adsoyad"
                        className="h-9 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-bg)] px-2.5 font-mono text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
                      />
                      <button
                        type="button"
                        aria-label="Satırı sil"
                        onClick={() => removePair(p.uid)}
                        disabled={pairs.length <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30"
                      >
                        <TrashMini />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {pairs.some((p) => p.key.trim()) ? (
                <p className="mt-2 text-[11px] text-[var(--panel-muted)]">
                  Önizleme:{' '}
                  {pairs
                    .filter((p) => p.key.trim())
                    .map((p) => formatTemplateVarKey(p.key))
                    .join(' ')}
                </p>
              ) : null}
              {errors.vars ? <p className="mt-1 text-xs text-red-500">{errors.vars}</p> : null}
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

function TrashMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
