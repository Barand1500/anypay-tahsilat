import { useState } from 'react';
import { SupportHeadsetIcon } from './SupportHeadsetIcon';
import { SupportModal } from './SupportModal';

/** Header / dock — destek talebi */
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
        className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-rose-300/45 bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/20 hover:text-rose-600 dark:border-rose-400/35 dark:bg-rose-500/15 dark:text-rose-400"
      >
        <SupportHeadsetIcon className="h-[1.15rem] w-[1.15rem]" />
      </button>
      {open ? <SupportModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
