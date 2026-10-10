import {
  getDefaultPosBrand,
  getPosRedirects,
  type DefaultPosBrand,
  type PosRedirect,
} from '../../lib/posRedirectStore';
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

function toDisplayBank(
  bankId: string,
  bankName: string,
  logoUrl: string,
): BankInfo {
  const catalog = resolveBankFromName(bankName, bankId);
  const logo = (logoUrl || catalog?.logo || '').trim();
  if (catalog) {
    return {
      ...catalog,
      numericId: bankId || catalog.numericId || null,
      name: catalog.name,
      fullName: bankName || catalog.fullName,
      logo: logo || catalog.logo,
    };
  }
  return {
    id: bankId || 'pos',
    numericId: bankId || null,
    name: bankName || 'Banka',
    fullName: bankName || 'Banka',
    logo,
    bins: [],
  };
}

export type PosDisplayOpts = {
  redirects?: PosRedirect[] | null;
  /** Sanal POS Tanımları › varsayılan — yönlendirme yoksa bu logo */
  defaultPos?: DefaultPosBrand | null;
};

/**
 * Banka & Taksit logosu:
 * 1) Ortak Sanal POS yönlendirmesi varsa → hedef (Halkbank→QNB)
 * 2) Yoksa → varsayılan Sanal POS (Garanti vb.)
 * Kart input BIN logosu değişmez.
 */
export function applyPosDisplayBank(
  cardBank: BankInfo | null,
  opts?: PosDisplayOpts | PosRedirect[] | null,
): BankInfo | null {
  if (!cardBank) return null;

  // Geriye uyum: eski imza applyPosDisplayBank(bank, redirects[])
  const normalized: PosDisplayOpts = Array.isArray(opts)
    ? { redirects: opts }
    : opts ?? {};

  const redirects =
    normalized.redirects && normalized.redirects.length > 0
      ? normalized.redirects
      : getPosRedirects();
  const defaultPos = normalized.defaultPos !== undefined
    ? normalized.defaultPos
    : getDefaultPosBrand();

  const hit = redirects.find((r) => bankMatchesRedirectSource(cardBank, r));
  if (hit) {
    return toDisplayBank(hit.targetBankId, hit.targetBankName, hit.targetBankLogoUrl);
  }

  if (defaultPos?.bankName || defaultPos?.bankLogoUrl) {
    return toDisplayBank(
      defaultPos.bankId || '',
      defaultPos.bankName || '',
      defaultPos.bankLogoUrl || '',
    );
  }

  // Son çare: kart bankası (varsayılan POS yüklenene kadar)
  return cardBank;
}
