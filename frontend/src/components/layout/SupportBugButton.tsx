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
        className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-brand-500)_40%,var(--panel-line))] bg-[var(--brand-soft-bg)] text-[var(--color-brand-600)] transition hover:bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] hover:text-[var(--color-brand-700)]"
      >
        <SupportHeadsetIcon className="h-[1.15rem] w-[1.15rem]" />
      </button>
      {open ? <SupportModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
