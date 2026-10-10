import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type PayAttachmentFile = {
  name: string;
  path?: string;
  url: string;
};

type Props = {
  file: PayAttachmentFile;
  onClose: () => void;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export function isImageAttachment(name: string): boolean {
  return IMAGE_EXT.test(name.trim());
}

/**
 * Ödeme linki ek dosya önizleme — Esc / X; overlay tıklanınca kapanmaz.
 */
export function PayAttachmentPreviewModal({ file, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);
  const isImage = isImageAttachment(file.name) && !imgError;

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    setImgError(false);
  }, [file.url, file.name]);

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="pay-attach-title"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.3)]"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-[var(--panel-line)] px-5 pb-4 pt-5 sm:px-6">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand-500)_14%,transparent)_0%,transparent_55%)]"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-[1] inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">X</span>
            ESC
          </button>

          <div className="relative z-[1] min-w-0 pr-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
              Ek belge
            </p>
            <h2
              id="pay-attach-title"
              className="mt-1 break-words text-lg font-bold tracking-tight text-[var(--panel-ink)] [overflow-wrap:anywhere] sm:text-xl"
            >
              {file.name}
            </h2>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--panel-surface)]/80 p-4 sm:p-6">
          {isImage ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[linear-gradient(180deg,var(--panel-elevated),var(--panel-surface))] p-3 sm:p-5">
              <img
                src={file.url}
                alt={file.name}
                onError={() => setImgError(true)}
                className="max-h-[min(62vh,560px)] max-w-full object-contain drop-shadow-md"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-elevated)] px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft-bg)] text-[var(--color-brand-700)] ring-1 ring-[color-mix(in_srgb,var(--color-brand-500)_20%,transparent)]">
                <FileIconLarge />
              </span>
              <p className="max-w-sm text-sm font-semibold text-[var(--panel-ink)]">{file.name}</p>
              <p className="text-xs text-[var(--panel-muted)]">
                Bu dosya türü önizlenemiyor. İndirerek açabilirsiniz.
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
          >
            Kapat
          </button>
          <a
            href={file.url}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
          >
            <DownloadIcon />
            İndir
          </a>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIconLarge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
