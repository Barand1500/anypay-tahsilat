import { useState } from 'react';

type Props = {
  value: string;
  raw?: string;
  className?: string;
  onCopied: (msg: string) => void;
};

/** Satır hücresi — hover’da kopyala (müşteriler ile aynı) */
export function CopyLine({ value, raw, className = '', onCopied }: Props) {
  const [ok, setOk] = useState(false);

  async function copy() {
    const text = raw ?? value;
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      onCopied('Kopyalandı');
      window.setTimeout(() => setOk(false), 1200);
    } catch {
      onCopied('Kopyalanamadı');
    }
  }

  return (
    <button
      type="button"
      title="Kopyala"
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      className={[
        'group/copy relative block w-full max-w-full truncate rounded-md py-0.5 text-left transition hover:bg-[var(--panel-hover)]/80',
        className,
      ].join(' ')}
    >
      <span className="pr-6">{value}</span>
      <span
        className={[
          'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rounded p-0.5 transition',
          ok
            ? 'bg-emerald-500/15 text-emerald-600 opacity-100'
            : 'text-[var(--panel-muted)] opacity-0 group-hover/copy:opacity-100',
        ].join(' ')}
      >
        {ok ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 14V6a2 2 0 012-2h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
