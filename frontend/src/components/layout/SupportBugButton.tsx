import { useState } from 'react';
import { SupportModal } from './SupportModal';

/** Header / dock — destek talebi (kulaklık; beyaz zemin multiply ile kaybolur) */
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
        className="relative z-[1] flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-rose-300/40 bg-rose-500/10 p-1.5 transition hover:bg-rose-500/18 dark:border-rose-400/30 dark:bg-rose-500/15"
      >
        <img
          src="/brand/support-headset.jpg"
          alt=""
          className="h-full w-full object-contain mix-blend-multiply dark:brightness-110 dark:contrast-125 dark:mix-blend-lighten"
          draggable={false}
        />
      </button>
      {open ? <SupportModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
