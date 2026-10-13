/** BIN marka adı → ödeme sayfası logoları (`/payments/…`) */

const DEFAULT_CARD_BRAND_LOGO = '/payments/mastercard.jpg';

const BRAND_LOGOS: Array<{ test: RegExp; src: string }> = [
  { test: /master\s*card|mastercard|^mc$/i, src: '/payments/mastercard.jpg' },
  { test: /^visa$/i, src: '/payments/visa.png' },
  { test: /troy/i, src: '/payments/troy.png' },
  { test: /amex|american\s*express/i, src: '/payments/amex.png' },
];

function norm(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

/** Kart markası logosu; bilinmeyen / boş → varsayılan MasterCard */
export function resolveCardBrandLogoUrl(brand: string | null | undefined): string {
  const n = norm(brand || '');
  if (!n || n === '-' || n === '—') return DEFAULT_CARD_BRAND_LOGO;
  for (const row of BRAND_LOGOS) {
    if (row.test.test(n)) return row.src;
  }
  return DEFAULT_CARD_BRAND_LOGO;
}

export { DEFAULT_CARD_BRAND_LOGO };
