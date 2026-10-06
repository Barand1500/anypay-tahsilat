import { useLayoutEffect, type RefObject } from 'react';

type Options = {
  inputRef: RefObject<HTMLInputElement | null>;
  enabled: boolean;
  onFirstDigit: (digit: string) => void;
};

/** Focuses the amount field before paint and catches a first digit during route focus handoff. */
export function useInitialAmountFocus({ inputRef, enabled, onFirstDigit }: Options) {
  useLayoutEffect(() => {
    if (!enabled) return;

    const focusAmount = () => {
      const input = inputRef.current;
      if (!input?.isConnected) return null;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
      return input;
    };

    focusAmount();

    const onKeyDown = (event: KeyboardEvent) => {
      if (document.body.classList.contains('km-active') || !/^[0-9]$/.test(event.key)) return;
      const active = document.activeElement;
      if (active !== document.body && !(active instanceof HTMLAnchorElement) && !(active instanceof HTMLButtonElement)) return;

      const input = focusAmount();
      if (!input) return;
      event.preventDefault();
      onFirstDigit(event.key);
      requestAnimationFrame(() => {
        if (!input.isConnected) return;
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      });
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, inputRef, onFirstDigit]);
}
