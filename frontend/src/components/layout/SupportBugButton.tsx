import { useState } from 'react';
import { SupportModal } from './SupportModal';

/** Header / dock — destek talebi (açık kırmızı böcek) */
export function SupportBugButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-km-jump
        title="Destek talebi"
        aria-label="Destek talebi"
        onClick={() => setOpen(true)}
        className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-rose-300/50 bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/18 hover:text-rose-600 dark:border-rose-400/35 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25"
      >
        <BugIcon />
      </button>
      {open ? <SupportModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 9.5V8a4 4 0 0 1 8 0v1.5M6 13h12M9 16.5h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7 9.5h10v6.2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.5 7 10M19.5 8.5 17 10M4.5 16 7 14.5M19.5 16 17 14.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
