import type { BankInfo, InstallmentRow } from './mockBanks';
import { digitsOnly } from './mockBanks';

/**
 * Public / Ödeme Al / Hızlı Ödeme — tek taksit listesi mantığı.
 * Sunucu zaten alt limite göre filtreler; burada güvenlik için tekrar uygulanır.
 */
export function buildPricedInstallments(opts: {
  amount: number;
  rates: InstallmentRow[];
  /** null/[] = kısıt yok (panel); dizi = yalnızca bunlar (public ödeme isteği) */
  allowedNs?: number[] | null;
  /**
   * true: public — izin dışını listeden çıkar
   * false: panel — hepsini göster, InstallmentPlanSection kilitler
   */
  hideDisallowed?: boolean;
}): InstallmentRow[] {
  const amount = opts.amount;
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const allowed =
    opts.allowedNs != null && opts.allowedNs.length > 0
      ? new Set(opts.allowedNs)
      : null;
  const hideDisallowed = opts.hideDisallowed === true;

  const fromBank = opts.rates
    .filter((rate) => {
      if ((rate.minLimit ?? 0) > amount) return false;
      if (hideDisallowed && allowed && !allowed.has(rate.n)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.n - b.n);

  if (fromBank.length) return fromBank;

  const allowTekCekim = !allowed || allowed.has(1);
  if (allowTekCekim) {
    return [
      {
        n: 1,
        plusN: 0,
        commissionPct: 0,
        installmentAmount: amount,
        totalAmount: amount,
        minLimit: 0,
      },
    ];
  }
  return [];
}

/** Rates / installments API sorgu alanları — üç ekranda aynı */
export function ratesBankQuery(
  bank: BankInfo | null | undefined,
  cardDigits: string,
): { bankName: string | null; bankId: string | null; bin: string | null } {
  const digits = digitsOnly(cardDigits);
  const numericId =
    bank?.numericId && /^\d+$/.test(bank.numericId)
      ? bank.numericId
      : bank?.id && /^\d+$/.test(bank.id)
        ? bank.id
        : null;
  return {
    bankName: bank?.name || bank?.fullName || null,
    bankId: numericId,
    bin: digits.length >= 6 ? digits : null,
  };
}
