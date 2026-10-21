import { LegalDocsMenu } from './LegalDocsMenu';
import { RatesFooterStage } from './RatesFooterStage';

export const PAYMENT_BADGES = [
  { src: '/payments/iyzico.jpg', alt: 'iyzico ile Öde', className: 'h-7 w-auto max-w-[6.5rem]' },
  { src: '/payments/mastercard.jpg', alt: 'Mastercard', className: 'h-8 w-auto max-w-[4.5rem]' },
  { src: '/payments/visa.png', alt: 'Visa', className: 'h-6 w-auto max-w-[4.25rem]' },
  { src: '/payments/amex.png', alt: 'American Express', className: 'h-8 w-auto max-w-[2.75rem]' },
  { src: '/payments/troy.png', alt: 'Troy', className: 'h-6 w-auto max-w-[5rem]' },
] as const;

/** Alt çubuk — ödeme rozetleri, sözleşmeler; RatesFooterStage ile kur şeridi */
export function Footer() {
  return (
    <RatesFooterStage>
      <div className="flex h-full w-full items-center gap-3 px-3 sm:px-4">
        <div className="min-w-0 flex-1" />
        <div
          className="flex shrink-0 items-center gap-1.5 sm:gap-2"
          aria-label="Kabul edilen ödeme yöntemleri"
        >
          <PaymentBadges />
        </div>
        <div className="shrink-0">
          <LegalDocsMenu />
        </div>
      </div>
    </RatesFooterStage>
  );
}

function PaymentBadges() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Kabul edilen ödeme yöntemleri">
      {PAYMENT_BADGES.map((b) => (
        <span
          key={b.src}
          className="flex h-10 items-center justify-center rounded-lg border border-[var(--panel-line)] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[var(--panel-elevated)]"
          title={b.alt}
        >
          <img src={b.src} alt={b.alt} className={`object-contain ${b.className}`} draggable={false} />
        </span>
      ))}
    </div>
  );
}
