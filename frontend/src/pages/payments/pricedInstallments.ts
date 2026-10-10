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

/**
 * Kaynak banka eşlemesi — yalnızca id veya marka ipucu.
 * "bankasi" gibi genel kelime YASAK (TEB→Garanti, Halkbank kartına yanlış yapışıyordu).
 */
function bankMatchesRedirectSource(bank: BankInfo, redirect: PosRedirect): boolean {
  const id = bank.numericId || (/^\d+$/.test(bank.id) ? bank.id : '');
  if (id && String(id) === String(redirect.sourceBankId)) return true;

  const sourceNorm = normalizeBankText(redirect.sourceBankName);
  const bankNorm = normalizeBankText(`${bank.id} ${bank.name} ${bank.fullName}`);
  if (!sourceNorm || !bankNorm) return false;

  // Uzun / spesifik markalar önce
  const brands = [
    'halkbank',
    'yapikredi',
    'finansbank',
    'kuveytturk',
    'vakifbank',
    'denizbank',
    'garanti',
    'akbank',
    'isbank',
    'ziraat',
    'qnb',
    'teb',
    'ing',
    'hsbc',
    'halk',
    'vakif',
    'deniz',
    'yapi',
    'kuveyt',
  ];
  for (const h of brands) {
    if (sourceNorm.includes(h) && bankNorm.includes(h)) return true;
  }
  // Katalog slug (halkbank) kaynak adda geçiyorsa
  const slug = normalizeBankText(bank.id);
  if (slug.length >= 3 && sourceNorm.includes(slug)) return true;
  return false;
}

/**
 * Banka & Taksit: yönlendirme varsa hedef logo (Halkbank→QNB → QNB).
 * redirects argümanı verilirse store’a bağımlı kalmaz (public pay view).
 */
export function applyPosDisplayBank(
  cardBank: BankInfo | null,
  redirects: PosRedirect[] = getPosRedirects(),
): BankInfo | null {
  if (!cardBank) return null;
  if (!redirects.length) return cardBank;
  const hit = redirects.find((r) => bankMatchesRedirectSource(cardBank, r));
  if (!hit) return cardBank;

  const catalog = resolveBankFromName(hit.targetBankName, hit.targetBankId);
  const logo = (hit.targetBankLogoUrl || catalog?.logo || '').trim();
  if (catalog) {
    return {
      ...catalog,
      numericId: hit.targetBankId,
      name: catalog.name,
      fullName: hit.targetBankName || catalog.fullName,
      logo: logo || catalog.logo,
    };
  }
  return {
    id: hit.targetBankId,
    numericId: hit.targetBankId,
    name: hit.targetBankName || 'Banka',
    fullName: hit.targetBankName || 'Banka',
    logo,
    bins: [],
  };
}
