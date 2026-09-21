import type { ButtonHTMLAttributes, ReactNode } from 'react';
import LiquidCarveButton from './LiquidCarveButton';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  success?: boolean;
  successLabel?: string;
};

/**
 * Site birincil butonu — Liquid Carve (beyaz + kırmızı oyuk).
 * success → yeşil + successLabel (Kaydedildi vb.).
 */
export function Button({
  children,
  loading = false,
  loadingLabel = 'Lütfen bekleyin…',
  success = false,
  successLabel = 'Kaydedildi',
  disabled,
  className = '',
  type = 'button',
  onClick,
}: Props) {
  const busy = loading || success;

  const label = success ? (
    <>
      <CheckIcon />
      {successLabel}
    </>
  ) : loading ? (
    loadingLabel
  ) : (
    children
  );

  return (
    <div className={['relative w-full overflow-visible', className].filter(Boolean).join(' ')}>
      <LiquidCarveButton
        type={type}
        disabled={Boolean(disabled || busy)}
        keepOpaque={success}
        label={label}
        ariaLabel={
          success
            ? successLabel
            : loading
              ? loadingLabel
              : typeof children === 'string'
                ? children
                : undefined
        }
        colors={
          success
            ? { fill: '#10B981', textColor: '#FFFFFF', border: '#059669' }
            : { fill: '#FFFFFF', textColor: '#111827', border: '#C5CAD3' }
        }
        blob={
          success
            ? { size: 72, color: '#059669', smoothness: 45 }
            : { size: 76, color: '#FF3737', smoothness: 45 }
        }
        rounded={40}
        padding="14px 28px"
        style={{
          boxShadow: success
            ? '0 8px 24px rgba(16,185,129,0.28)'
            : '0 4px 16px rgba(15, 23, 42, 0.08)',
        }}
        font={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 700,
          fontSize: 14,
          lineHeight: '1.2em',
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
        onClick={(e) => {
          if (disabled || busy) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
