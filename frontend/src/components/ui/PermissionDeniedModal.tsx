import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  message: string;
  onClose: () => void;
};

/** Yetkisiz işlem uyarısı — Esc / Tamam ile kapanır */
export function PermissionDeniedModal({ message, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
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

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.4)]"
      >
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <LockIcon />
          </div>
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">Yetki yok</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">{message}</p>
        </div>
        <div className="border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
