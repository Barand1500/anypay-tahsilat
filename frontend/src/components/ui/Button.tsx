import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
};

// Birincil aksiyon butonu — login ve formlarda ortak
export function Button({ children, loading, disabled, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        'inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3',
        'text-sm font-semibold text-white transition hover:bg-brand-700',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? 'Lütfen bekleyin…' : children}
    </button>
  );
}
