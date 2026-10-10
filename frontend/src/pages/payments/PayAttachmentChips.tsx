import type { PayAttachmentFile } from './PayAttachmentPreviewModal';

type Props = {
  files: PayAttachmentFile[];
  onOpen: (file: PayAttachmentFile) => void;
  /** slightly tighter chips on compact column */
  dense?: boolean;
};

/** Ödeme ekleri — tıklanınca önizleme modalı */
export function PayAttachmentChips({ files, onOpen, dense }: Props) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.path || f.url} className="min-w-0">
          <button
            type="button"
            title={f.name}
            onClick={() => onOpen(f)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/45 hover:bg-[var(--brand-soft-bg)] hover:text-[var(--color-brand-700)]',
              dense
                ? 'max-w-[11rem] px-2.5 py-1.5 text-[11px]'
                : 'max-w-[12rem] px-2.5 py-1.5 text-[11px]',
            ].join(' ')}
          >
            <FileGlyph />
            <span className="min-w-0 truncate">{f.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FileGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--color-brand-600)]" aria-hidden>
      <path
        d="M8 3h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
