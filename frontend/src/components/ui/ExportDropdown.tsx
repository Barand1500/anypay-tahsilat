import { useEffect, useRef, useState } from 'react';

type Props = {
  onCsv: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  /** sm altında sadece ikon */
  compactLabel?: boolean;
  className?: string;
};

/**
 * Ortak “Dışa Aktar” menüsü — müşteriler / kullanıcılar / hareketler aynı görünüm.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const excelFn = onExcel ?? onCsv;
  const pdfFn = onPdf ?? onPrint;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

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
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
      >
        <ExportIcon />
        {compactLabel ? (
          <span className="hidden sm:inline">Dışa Aktar</span>
        ) : (
          'Dışa Aktar'
        )}
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)]">
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
        </div>
      ) : null}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10M8 10l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={open ? 'rotate-180' : ''}
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
