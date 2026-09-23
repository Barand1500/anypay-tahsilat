import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import {
  COMPANY_VARS,
  CONTRACT_LINK_OPTIONS,
  CUSTOMER_VARS,
  type ContractDef,
  type ContractLinkId,
} from './mockContracts';

type Mode =
  | { type: 'create' }
  | { type: 'edit'; contract: ContractDef };

type Props = {
  mode: Mode;
  onClose: () => void;
  onSave: (next: Omit<ContractDef, 'id' | 'order'> & { id?: string }) => void;
};

/**
 * Sözleşme ekle / düzenle — Esc / X; overlay kapatmaz.
 * Değişkenler sağda, ana modal ile aynı boyutta yan panel.
 */
export function ContractModal({ mode, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.contract.name : '');
  const [link, setLink] = useState<ContractLinkId>(isEdit ? mode.contract.link : 'none');
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const raw = isEdit ? mode.contract.body : '';
    ed.innerText = raw;
  }, [isEdit, mode]);

  function insertVar(key: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const token = `#${key}#`;
    try {
      document.execCommand('insertText', false, token);
    } catch {
      ed.innerText = `${ed.innerText}${token}`;
    }
  }

  function execFmt(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError('Sözleşme adı zorunlu');
      return;
    }
    const body = (editorRef.current?.innerText ?? '').trim();
    onSave({
      id: isEdit ? mode.contract.id : undefined,
      name: n,
      body,
      link,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={wrapRef}
        className="relative z-10 flex w-full max-w-3xl flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:items-stretch"
      >
        <div
          role="dialog"
          aria-modal
          aria-labelledby="contract-modal-title"
          className="flex max-h-[min(92vh,860px)] w-full max-w-3xl shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-3.5">
            <h2 id="contract-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
              {isEdit ? 'Sözleşme Düzenle' : 'Sözleşme Ekle'}
            </h2>
            <button
              type="button"
              aria-label="Kapat"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            >
              ×
            </button>
          </header>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <TextInput
                label="Sözleşme Adı"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />

              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--brand-on-soft)]">
                  Sözleşme Metni
                </p>
                <div className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--input-bg)]">
                  <div className="flex flex-wrap gap-0.5 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/70 px-2 py-1.5">
                    <ToolBtn title="Kalın" onClick={() => execFmt('bold')}>
                      B
                    </ToolBtn>
                    <ToolBtn title="İtalik" onClick={() => execFmt('italic')}>
                      I
                    </ToolBtn>
                    <ToolBtn title="Altı çizili" onClick={() => execFmt('underline')}>
                      U
                    </ToolBtn>
                    <span className="mx-1 w-px self-stretch bg-[var(--panel-line)]" />
                    <ToolBtn title="Liste" onClick={() => execFmt('insertUnorderedList')}>
                      ••
                    </ToolBtn>
                    <ToolBtn title="Numaralı" onClick={() => execFmt('insertOrderedList')}>
                      1.
                    </ToolBtn>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline
                    aria-label="Sözleşme metni"
                    className="min-h-[220px] max-h-[36vh] overflow-y-auto px-3.5 py-3 text-sm leading-relaxed text-[var(--panel-ink)] outline-none empty:before:text-[var(--panel-muted)] empty:before:content-['Sözleşme_metnini_yazın…']"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-[var(--panel-ink)]">Bağlantı</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONTRACT_LINK_OPTIONS.map((opt) => {
                    const on = link === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={[
                          'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition',
                          on
                            ? 'border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)]'
                            : 'border-[var(--panel-line)] bg-[var(--panel-surface)]/40 hover:border-[var(--color-brand-500)]/30',
                          opt.id === 'none' ? 'sm:col-span-2' : '',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="contract-link"
                          checked={on}
                          onChange={() => setLink(opt.id)}
                          className="accent-[var(--color-brand-600)]"
                        />
                        <span className="font-semibold text-[var(--panel-ink)]">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {error ? <p className="text-xs text-rose-500">{error}</p> : null}
            </div>

            <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--panel-line)] px-4 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
              >
                Kapat
              </button>
              <button
                type="submit"
                data-km-jump
                className="rounded-xl bg-[var(--color-brand-500)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Kaydet
              </button>
            </footer>
          </form>
        </div>

        <aside
          aria-label="Değişkenler"
          className="flex max-h-[min(92vh,860px)] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl sm:w-[260px]"
        >
          <div className="shrink-0 border-b border-[var(--panel-line)] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-on-soft)]">
              Şablon
            </p>
            <h3 className="text-base font-bold text-[var(--panel-ink)]">Değişkenler</h3>
            <p className="mt-1 text-[11px] leading-snug text-[var(--panel-muted)]">
              Tıklayınca metne eklenir
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                Firma
              </p>
              <div className="flex flex-col gap-1">
                {COMPANY_VARS.map((k) => (
                  <VarChip key={k} tone="company" onClick={() => insertVar(k)}>
                    #{k}#
                  </VarChip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                Müşteri
              </p>
              <div className="flex flex-col gap-1">
                {CUSTOMER_VARS.map((k) => (
                  <VarChip key={k} tone="customer" onClick={() => insertVar(k)}>
                    #{k}#
                  </VarChip>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function VarChip({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone: 'company' | 'customer';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold transition',
        tone === 'company'
          ? 'bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)] hover:brightness-105'
          : 'bg-rose-500/12 text-rose-600 hover:bg-rose-500/18 dark:text-rose-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ToolBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
    >
      {children}
    </button>
  );
}
