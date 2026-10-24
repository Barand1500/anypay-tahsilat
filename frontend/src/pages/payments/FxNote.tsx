import { formatMoneyDisplay } from './mockBanks';

export function isTryCurrency(shortName?: string | null) {
  const c = (shortName || '').trim().toUpperCase();
  return !c || c === 'TL' || c === 'TRY';
}

/** Karttan çekilecek TL tutarı — sunucudaki hesapla aynı (tutar × kur, kuruşa yuvarlı) */
export function fxChargeAmount(amount: number, rate: number | undefined, shortName?: string | null) {
  if (isTryCurrency(shortName) || !rate || rate <= 0 || !(amount > 0)) return amount;
  return Math.round(amount * rate * 100) / 100;
}

/** Yabancı para biriminde anlık kur bilgisi — küçük uyarı satırı */
export function FxNote({
  amount,
  rate,
  symbol,
  shortName,
}: {
  amount: number;
  rate?: number;
  symbol: string;
  shortName?: string | null;
}) {
  if (isTryCurrency(shortName) || !rate || rate <= 0 || !(amount > 0)) return null;
  const rateText = rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return (
    <p className="text-xs leading-relaxed text-[var(--panel-muted)]">
      {symbol} 1 = ₺{rateText} · {formatMoneyDisplay(amount, symbol)} × {rateText} ={' '}
      <span className="font-semibold text-[var(--panel-ink)]">{formatMoneyDisplay(fxChargeAmount(amount, rate, shortName), '₺')}</span>{' '}
      karttan TL olarak çekilecek.
    </p>
  );
}
