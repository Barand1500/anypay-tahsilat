import { getPosRedirects, type PosRedirect } from '../../lib/posRedirectStore';
import type { BankInfo, InstallmentRow } from './mockBanks';
import { digitsOnly, normalizeBankText, resolveBankFromName } from './mockBanks';

/**
 * Public / Ödeme Al / Hızlı Ödeme — tek taksit listesi mantığı.
 * Alt limit + izin dışı taksitler listeden çıkarılır (soluk gösterilmez).
 */
export function buildPricedInstallments(opts: {
  amount: number;
  rates: InstallmentRow[];
  /** null/[] = kısıt yok; dizi = yalnızca bunlar görünür/seçilir */
  allowedNs?: number[] | null;
}): InstallmentRow[] {
  const amount = opts.amount;
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const allowed =
    opts.allowedNs != null && opts.allowedNs.length > 0
      ? new Set(opts.allowedNs)
      : null;

  const fromBank = opts.rates
    .filter((rate) => {
      if ((rate.minLimit ?? 0) > amount) return false;
      if (allowed && !allowed.has(rate.n)) return false;
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

function bankMatchesRedirectSource(bank: BankInfo, redirect: PosRedirect): boolean {
  const id = bank.numericId || (/^\d+$/.test(bank.id) ? bank.id : '');
  if (id && id === redirect.sourceBankId) return true;
  const needle = normalizeBankText(redirect.sourceBankName);
  if (!needle) return false;
  const blob = normalizeBankText(`${bank.name} ${bank.fullName}`);
  if (!blob) return false;
  if (blob.includes(needle) || needle.includes(blob)) return true;
  const tokens = needle.split(/\s+/).filter((t) => t.length >= 4);
  return tokens.some((t) => blob.includes(t));
}

/**
 * Banka & Taksit logosu: Ortak Sanal POS yönlendirmesi varsa hedef banka
 * (Halkbank kartı → QNB logosu). Kart alanındaki BIN logosu değişmez.
 */
export function applyPosDisplayBank(
  cardBank: BankInfo | null,
  redirects: PosRedirect[] = getPosRedirects(),
): BankInfo | null {
  if (!cardBank || !redirects.length) return cardBank;
  const hit = redirects.find((r) => bankMatchesRedirectSource(cardBank, r));
  if (!hit) return cardBank;

  const catalog = resolveBankFromName(hit.targetBankName, hit.targetBankId);
  if (catalog) {
    return {
      ...catalog,
      numericId: hit.targetBankId,
      name: catalog.name,
      fullName: hit.targetBankName || catalog.fullName,
      logo: hit.targetBankLogoUrl || catalog.logo,
    };
  }
  return {
    id: hit.targetBankId,
    numericId: hit.targetBankId,
    name: hit.targetBankName,
    fullName: hit.targetBankName,
    logo: hit.targetBankLogoUrl,
    bins: [],
  };
}
