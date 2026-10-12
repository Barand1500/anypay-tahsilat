export type PaymentPageLayout = 'compact' | 'fullscreen';

/** Telefon (< lg) görünümü — masaüstü düzenini etkilemez */
export type PaymentPageMobileLayout = 'wizard' | 'stack';

export type PaymentPageBadge = {
  id: string;
  name: string;
  src: string;
  heightPx: number;
  active: boolean;
  sortOrder: number;
};

export type PaymentPageSettings = {
  layout: PaymentPageLayout;
  /** Mobil: wizard | tutar hero + bottom sheet */
  mobileLayout: PaymentPageMobileLayout;
  brandLogoHeightPx: number;
  badges: PaymentPageBadge[];
};

export const DEFAULT_PAYMENT_PAGE: PaymentPageSettings = {
  layout: 'compact',
  mobileLayout: 'wizard',
  brandLogoHeightPx: 40,
  badges: [
    { id: 'iyzico', name: 'iyzico', src: '/payments/iyzico.jpg', heightPx: 28, active: true, sortOrder: 0 },
    {
      id: 'mastercard',
      name: 'Mastercard',
      src: '/payments/mastercard.jpg',
      heightPx: 32,
      active: true,
      sortOrder: 1,
    },
    { id: 'visa', name: 'Visa', src: '/payments/visa.png', heightPx: 24, active: true, sortOrder: 2 },
    {
      id: 'amex',
      name: 'American Express',
      src: '/payments/amex.png',
      heightPx: 32,
      active: true,
      sortOrder: 3,
    },
    { id: 'troy', name: 'Troy', src: '/payments/troy.png', heightPx: 24, active: true, sortOrder: 4 },
  ],
};
