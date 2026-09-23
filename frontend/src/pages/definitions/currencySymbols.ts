/** Para birimi sembol havuzu — seçim paneli */

export type CurrencySymbolOption = {
  symbol: string;
  code: string;
  name: string;
  group: 'populer' | 'avrupa' | 'asya' | 'diger';
};

export const CURRENCY_SYMBOL_OPTIONS: CurrencySymbolOption[] = [
  { symbol: '₺', code: 'TRY', name: 'Türk Lirası', group: 'populer' },
  { symbol: '$', code: 'USD', name: 'ABD Doları', group: 'populer' },
  { symbol: '€', code: 'EUR', name: 'Euro', group: 'populer' },
  { symbol: '£', code: 'GBP', name: 'İngiliz Sterlini', group: 'populer' },
  { symbol: '¥', code: 'JPY', name: 'Japon Yeni', group: 'populer' },
  { symbol: '₣', code: 'CHF', name: 'İsviçre Frangı', group: 'avrupa' },
  { symbol: 'kr', code: 'SEK', name: 'İsveç Kronu', group: 'avrupa' },
  { symbol: 'kr', code: 'NOK', name: 'Norveç Kronu', group: 'avrupa' },
  { symbol: 'kr', code: 'DKK', name: 'Danimarka Kronu', group: 'avrupa' },
  { symbol: 'zł', code: 'PLN', name: 'Polonya Zlotisi', group: 'avrupa' },
  { symbol: 'Kč', code: 'CZK', name: 'Çek Korunası', group: 'avrupa' },
  { symbol: 'lei', code: 'RON', name: 'Rumen Leyi', group: 'avrupa' },
  { symbol: '₽', code: 'RUB', name: 'Rus Rublesi', group: 'avrupa' },
  { symbol: 'A$', code: 'AUD', name: 'Avustralya Doları', group: 'diger' },
  { symbol: 'C$', code: 'CAD', name: 'Kanada Doları', group: 'diger' },
  { symbol: 'R$', code: 'BRL', name: 'Brezilya Reali', group: 'diger' },
  { symbol: '₹', code: 'INR', name: 'Hint Rupisi', group: 'asya' },
  { symbol: '¥', code: 'CNY', name: 'Çin Yuanı', group: 'asya' },
  { symbol: '₩', code: 'KRW', name: 'Güney Kore Wonu', group: 'asya' },
  { symbol: '฿', code: 'THB', name: 'Tayland Bahtı', group: 'asya' },
  { symbol: '₫', code: 'VND', name: 'Vietnam Dongu', group: 'asya' },
  { symbol: '₱', code: 'PHP', name: 'Filipin Pesosu', group: 'asya' },
  { symbol: '₪', code: 'ILS', name: 'İsrail Şekeli', group: 'asya' },
  { symbol: 'ر.س', code: 'SAR', name: 'Suudi Riyali', group: 'asya' },
  { symbol: 'د.إ', code: 'AED', name: 'BAE Dirhemi', group: 'asya' },
  { symbol: 'ر.ق', code: 'QAR', name: 'Katar Riyali', group: 'asya' },
  { symbol: 'د.ك', code: 'KWD', name: 'Kuveyt Dinarı', group: 'asya' },
  { symbol: '₼', code: 'AZN', name: 'Azerbaycan Manatı', group: 'asya' },
  { symbol: '₸', code: 'KZT', name: 'Kazakistan Tengesi', group: 'asya' },
  { symbol: '₨', code: 'PKR', name: 'Pakistan Rupisi', group: 'asya' },
  { symbol: 'R', code: 'ZAR', name: 'Güney Afrika Randı', group: 'diger' },
  { symbol: '₦', code: 'NGN', name: 'Nijerya Nairası', group: 'diger' },
  { symbol: '₿', code: 'BTC', name: 'Bitcoin', group: 'diger' },
  { symbol: 'Ξ', code: 'ETH', name: 'Ethereum', group: 'diger' },
];

export const SYMBOL_GROUP_LABEL: Record<CurrencySymbolOption['group'], string> = {
  populer: 'Popüler',
  avrupa: 'Avrupa',
  asya: 'Asya / Ortadoğu',
  diger: 'Diğer',
};
