import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getCompanyContractVars,
  getContractByLink,
  resolveContractVars,
} from '../../pages/definitions/mockContracts';
import type { LegalDoc } from './legalDocs';

type Props = {
  doc: LegalDoc;
  onClose: () => void;
};

/**
 * Footer sözleşme modalı — Esc / X; overlay tıklanınca kapanmaz.
 * Metin Tanımlamalar › Sözleşmeler şablonundan + #degisken# çözümü.
 */
export function LegalDocModal({ doc, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => {
    const contract = getContractByLink(doc.id);
    const raw = contract?.body?.trim() ?? '';
    if (!raw) return { title: contract?.name || doc.title, body: '' };
    return {
      title: contract?.name || doc.title,
      body: resolveContractVars(raw, getCompanyContractVars()),
    };
  }, [doc.id, doc.title]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 18, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
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

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="legal-doc-title"
        className="relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/12 via-transparent to-transparent px-5 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">×</span>
            Esc
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
            Sözleşmeler
          </p>
          <h2
            id="legal-doc-title"
            className="mt-1 pr-16 text-xl font-bold tracking-tight text-[var(--panel-ink)]"
          >
            {resolved.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">{doc.subtitle}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {resolved.body ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--panel-ink)]/90">
              {resolved.body}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]">
                <DocIcon />
              </div>
              <p className="text-sm font-bold text-[var(--panel-ink)]">Metin henüz eklenmedi</p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--panel-muted)]">
                Tanımlamalar › Sözleşmeler ekranından bu bağlantıya metin ekleyebilirsiniz.
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[var(--panel-line)] px-5 py-3 sm:px-6">
          <button
            type="button"
            data-km-jump
            onClick={onClose}
            className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
          >
            Kapat
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
