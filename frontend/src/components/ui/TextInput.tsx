import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hintRight?: ReactNode;
  error?: string;
  /** Sağ iç ikon (şifre göster/gizle vb.) */
  endAdornment?: ReactNode;
  /**
   * float (varsayılan): yüzen etiket.
   * placeholder: etiket kutunun içinde kalır, yazınca kaybolur.
   */
  labelMode?: 'float' | 'placeholder';
};

/**
 * Outlined input — beyaz dolgu, yüzen etiket border’ı keser (login + panel ortak).
 */
export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  {
    label,
    hintRight,
    error,
    endAdornment,
    labelMode = 'float',
    id,
    className = '',
    disabled,
    placeholder,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id || rest.name || autoId;
  const isPlaceholder = labelMode === 'placeholder';

  return (
    <div className="flex flex-col gap-1.5">
      {hintRight ? <div className="flex justify-end">{hintRight}</div> : null}

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={[
            'w-full rounded-xl border bg-[var(--input-bg)] px-3.5 text-sm outline-none transition-colors',
            'border-[var(--input-border)] text-[var(--panel-ink)]',
            'focus:border-[var(--input-border-focus)] focus:ring-0',
            'placeholder:text-[var(--panel-muted)]',
            isPlaceholder ? 'peer h-[3.25rem] py-2.5' : 'peer h-[3.25rem] pb-2.5 pt-5',
            error ? '!border-red-400 focus:!border-red-400' : '',
            endAdornment ? 'pr-11' : '',
            disabled ? 'cursor-not-allowed opacity-60' : '',
            className,
          ].join(' ')}
          {...rest}
          placeholder={isPlaceholder ? (placeholder ?? label) : ' '}
          aria-label={isPlaceholder ? label : undefined}
        />

        {!isPlaceholder ? (
          <label
            htmlFor={inputId}
            className={[
              'input-label-gap pointer-events-none absolute left-3 top-1/2 z-10 origin-left -translate-y-1/2',
              'px-1.5 text-sm text-[var(--panel-muted)] transition-all duration-200',
              'peer-focus:top-0 peer-focus:translate-y-[-50%] peer-focus:text-xs peer-focus:font-medium peer-focus:text-[var(--input-label)]',
              'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:translate-y-[-50%] peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-[var(--panel-muted)]',
              'peer-[:not(:placeholder-shown)]:peer-focus:text-[var(--input-label)]',
              error ? 'peer-focus:!text-red-500' : '',
            ].join(' ')}
          >
            {label}
          </label>
        ) : null}

        {endAdornment ? (
          <div className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2">{endAdornment}</div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
});
