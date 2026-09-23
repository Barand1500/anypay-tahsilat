/** Footer kur şeridi — popüler enstrüman kataloğu */

export type RateKind = 'fx' | 'metal' | 'crypto';

export type RateInstrument = {
  id: string;
  label: string;
  short: string;
  kind: RateKind;
  /** FX: ISO kodu (USD→TRY için 'usd') */
  code?: string;
  /** Metal: xau | xag */
  metal?: 'xau' | 'xag';
  /** Gram çarpanı (çeyrek ≈ 1.754 g vb.) */
  grams?: number;
  /** Crypto binance sembolü */
  binance?: string;
  unit: string;
};

export const RATE_CATALOG: RateInstrument[] = [
  { id: 'usd', label: 'Amerikan Doları', short: 'USD', kind: 'fx', code: 'usd', unit: '₺' },
  { id: 'eur', label: 'Euro', short: 'EUR', kind: 'fx', code: 'eur', unit: '₺' },
  { id: 'gbp', label: 'İngiliz Sterlini', short: 'GBP', kind: 'fx', code: 'gbp', unit: '₺' },
  { id: 'chf', label: 'İsviçre Frangı', short: 'CHF', kind: 'fx', code: 'chf', unit: '₺' },
  { id: 'sar', label: 'Suudi Riyali', short: 'SAR', kind: 'fx', code: 'sar', unit: '₺' },
  { id: 'aed', label: 'BAE Dirhemi', short: 'AED', kind: 'fx', code: 'aed', unit: '₺' },
  { id: 'jpy', label: 'Japon Yeni', short: 'JPY', kind: 'fx', code: 'jpy', unit: '₺' },
  { id: 'cad', label: 'Kanada Doları', short: 'CAD', kind: 'fx', code: 'cad', unit: '₺' },
  { id: 'aud', label: 'Avustralya Doları', short: 'AUD', kind: 'fx', code: 'aud', unit: '₺' },
  { id: 'cny', label: 'Çin Yuanı', short: 'CNY', kind: 'fx', code: 'cny', unit: '₺' },
  { id: 'rub', label: 'Rus Rublesi', short: 'RUB', kind: 'fx', code: 'rub', unit: '₺' },
  { id: 'nok', label: 'Norveç Kronu', short: 'NOK', kind: 'fx', code: 'nok', unit: '₺' },
  {
    id: 'xau-gram',
    label: 'Gram Altın',
    short: 'GAU',
    kind: 'metal',
    metal: 'xau',
    grams: 1,
    unit: '₺',
  },
  {
    id: 'xau-ceyrek',
    label: 'Çeyrek Altın',
    short: 'ÇEY',
    kind: 'metal',
    metal: 'xau',
    grams: 1.754,
    unit: '₺',
  },
  {
    id: 'xau-yarim',
    label: 'Yarım Altın',
    short: 'YRM',
    kind: 'metal',
    metal: 'xau',
    grams: 3.5,
    unit: '₺',
  },
  {
    id: 'xau-tam',
    label: 'Tam Altın',
    short: 'TAM',
    kind: 'metal',
    metal: 'xau',
    grams: 7,
    unit: '₺',
  },
  {
    id: 'xau-ata',
    label: 'Ata Cumhuriyet',
    short: 'ATA',
    kind: 'metal',
    metal: 'xau',
    grams: 7.216,
    unit: '₺',
  },
  {
    id: 'xag-gram',
    label: 'Gram Gümüş',
    short: 'XAG',
    kind: 'metal',
    metal: 'xag',
    grams: 1,
    unit: '₺',
  },
  {
    id: 'btc',
    label: 'Bitcoin',
    short: 'BTC',
    kind: 'crypto',
    binance: 'BTCUSDT',
    unit: '$',
  },
  {
    id: 'eth',
    label: 'Ethereum',
    short: 'ETH',
    kind: 'crypto',
    binance: 'ETHUSDT',
    unit: '$',
  },
];

/** İlk seçim — en popülerler */
export const DEFAULT_SELECTED_RATE_IDS = [
  'usd',
  'eur',
  'gbp',
  'chf',
  'xau-gram',
  'xau-ceyrek',
  'xag-gram',
  'btc',
] as const;

export function getInstrument(id: string) {
  return RATE_CATALOG.find((x) => x.id === id);
}
