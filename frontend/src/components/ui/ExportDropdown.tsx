import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  onCsv: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  compactLabel?: boolean;
  className?: string;
};

/**
 * Ortak “Dışa Aktar” — menü portal ile açılır (overflow kesmez).
 */
export function ExportDropdown({
  onCsv,
  onCopy,
  onPrint = () => window.print(),
  onPdf,
  onExcel,
  compactLabel,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const excelFn = onExcel ?? onCsv;
  const pdfFn = onPdf ?? onPrint;

  function placeMenu() {
    const btn = rootRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuW = 168;
    const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
    setPos({ top: r.bottom + 6, left });
  }

  useEffect(() => {
    if (!open) return;
    placeMenu();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll() {
      placeMenu();
    }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const items = [
    { label: 'Yazdır', fn: onPrint },
    { label: 'Csv', fn: onCsv },
    { label: 'Excel', fn: excelFn },
    { label: 'Pdf', fn: pdfFn },
    ...(onCopy ? [{ label: 'Kopyala', fn: onCopy }] : []),
  ];

  return (
    <div ref={rootRef} className={['relative', className].join(' ')}>
      <button
        type="button"
        data-km-jump
        onClick={() => {
          placeMenu();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
      >
        <ExportIcon />
        {compactLabel ? <span className="hidden sm:inline">Dışa Aktar</span> : 'Dışa Aktar'}
        <Chevron open={open} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[12000] min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.fn();
                    setOpen(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={open ? 'rotate-180 transition' : 'transition'}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
