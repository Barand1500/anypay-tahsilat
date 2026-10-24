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
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-relaxed text-[var(--panel-muted)]">
      <span className="rounded-md bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] px-1.5 py-0.5 font-semibold text-[var(--color-brand-600)]">
        {symbol} 1 = ₺{rateText}
      </span>
      <span>
        {formatMoneyDisplay(amount, symbol)} × {rateText} ={' '}
        <span className="font-semibold text-[var(--panel-ink)]">{formatMoneyDisplay(fxChargeAmount(amount, rate, shortName), '₺')}</span>{' '}
        karttan TL olarak çekilecek.
      </span>
    </p>
  );
}
