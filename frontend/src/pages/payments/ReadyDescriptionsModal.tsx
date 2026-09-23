import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import {
  addReadyDescription,
  deleteReadyDescription,
  loadReadyDescriptions,
  updateReadyDescription,
  type ReadyDescription,
} from './mockReadyDescriptions';

type Props = {
  onClose: () => void;
  onChange: (list: ReadyDescription[]) => void;
};

type FormMode = { type: 'idle' } | { type: 'create' } | { type: 'edit'; item: ReadyDescription };

/**
 * Hazır açıklama yönetimi — Esc / X; overlay tıklanınca kapanmaz.
 */
export function ReadyDescriptionsModal({ onClose, onChange }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState(() => loadReadyDescriptions());
  const [mode, setMode] = useState<FormMode>({ type: 'idle' });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (deleteId) {
        setDeleteId(null);
        return;
      }
      if (mode.type !== 'idle') {
        setMode({ type: 'idle' });
        setError('');
        return;
      }
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, mode.type, deleteId]);

  function openCreate() {
    setTitle('');
    setText('');
    setError('');
    setMode({ type: 'create' });
  }

  function openEdit(item: ReadyDescription) {
    setTitle(item.title);
    setText(item.text);
    setError('');
    setMode({ type: 'edit', item });
  }

  function applyList(next: ReadyDescription[]) {
    setList(next);
    onChange(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const body = text.trim();
    if (!t) {
      setError('Başlık zorunlu');
      return;
    }
    if (!body) {
      setError('Açıklama metni zorunlu');
      return;
    }
    const next =
      mode.type === 'edit'
        ? updateReadyDescription(mode.item.id, t, body)
        : addReadyDescription(t, body);
    applyList(next);
    setMode({ type: 'idle' });
    setError('');
  }

  function confirmDelete() {
    if (!deleteId) return;
    applyList(deleteReadyDescription(deleteId));
    setDeleteId(null);
    if (mode.type === 'edit' && mode.item.id === deleteId) {
      setMode({ type: 'idle' });
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="ready-desc-title"
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="ready-desc-title" className="text-base font-bold text-[var(--panel-ink)]">
              Hazır açıklamalar
            </h2>
            <p className="text-xs text-[var(--panel-muted)]">Ekle, düzenle veya sil</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {mode.type === 'idle' ? (
            <div className="space-y-2">
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--panel-line)] px-3 py-8 text-center text-sm text-[var(--panel-muted)]">
                  Henüz hazır açıklama yok
                </p>
              ) : (
                list.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--panel-ink)]">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--panel-muted)]">
                        {item.text}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        title="Düzenle"
                        aria-label="Düzenle"
                        onClick={() => openEdit(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--color-brand-600)]"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        title="Sil"
                        aria-label="Sil"
                        onClick={() => setDeleteId(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form id="ready-desc-form" onSubmit={submit} className="space-y-3">
              <TextInput
                label="Başlık"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--panel-muted)]">
                  Açıklama metni
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--panel-ink)] outline-none transition focus:border-[var(--input-border-focus)]"
                  placeholder="Ödeme isteğine yapıştırılacak metin…"
                />
              </div>
              {error ? <p className="text-xs text-rose-500">{error}</p> : null}
            </form>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-line)] px-4 py-3 sm:px-5">
          {mode.type === 'idle' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--panel-line)] px-3.5 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
              >
                Kapat
              </button>
              <button
                type="button"
                data-km-jump
                onClick={openCreate}
                className="rounded-xl bg-[var(--color-brand-600)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
              >
                + Ekle
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode({ type: 'idle' });
                  setError('');
                }}
                className="rounded-xl border border-[var(--panel-line)] px-3.5 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                form="ready-desc-form"
                data-km-jump
                className="rounded-xl bg-[var(--color-brand-600)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
              >
                Kaydet
              </button>
            </>
          )}
        </footer>

        {deleteId ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-xl">
              <p className="text-sm font-bold text-[var(--panel-ink)]">Açıklama silinsin mi?</p>
              <p className="mt-1 text-xs text-[var(--panel-muted)]">Bu işlem geri alınamaz.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold transition hover:bg-[var(--panel-hover)]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13 6l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 7V5h4v2M8 7v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
