/** Tanımlamalar › Kart — mock veri */

export type CardAgreementInstallment = {
  n: number;
  minLimit: string;
  allRate: string;
  bireyselRate: string;
  ticariRate: string;
};

export type CardAgreementBankPanel = {
  bankId: string;
  name: string;
  /** Yüklenen veya varsayılan logo URL */
  logo?: string;
  logoFileName?: string;
  installments: CardAgreementInstallment[];
};

export type CardAgreementDetail = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  banks: CardAgreementBankPanel[];
};

export type CardAgreementRow = {
  id: string;
  name: string;
  date: string;
};

export type CardNamedRow = {
  id: string;
  name: string;
};

export type CardBrandRow = {
  id: string;
  name: string;
  logo?: string;
  initials?: string;
};

const SAMPLE_RATES = [
  0, 5.34, 7.12, 8.9, 10.68, 12.46, 14.24, 16.02, 17.8, 19.58, 21.36, 23.14,
];

function fmtPct(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function defaultAgreementInstallments(): CardAgreementInstallment[] {
  return Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    minLimit: i === 0 || i === 11 ? '0,00' : '',
    allRate: '',
    bireyselRate: fmtPct(SAMPLE_RATES[i] ?? 0),
    ticariRate: fmtPct(SAMPLE_RATES[i] ?? 0),
  }));
}

export function defaultAgreementBanks(): CardAgreementBankPanel[] {
  return [
    {
      bankId: 'qnb',
      name: 'QNB Bank A.Ş.',
      logo: '/banks/qnbbankas_logo_1745577261.webp',
      logoFileName: undefined,
      installments: defaultAgreementInstallments(),
    },
    {
      bankId: 'akbank',
      name: 'Akbank T.A.Ş.',
      logo: '/banks/akbanktas_logo_1750065323.webp',
      logoFileName: undefined,
      installments: defaultAgreementInstallments(),
    },
  ];
}

export const INITIAL_CARD_AGREEMENTS: CardAgreementDetail[] = [];

let agreementStore: CardAgreementDetail[] = [];

export function getCardAgreements(): CardAgreementDetail[] {
  return agreementStore.map((a) => ({
    ...a,
    banks: a.banks.map((b) => ({
      ...b,
      installments: b.installments.map((r) => ({ ...r })),
    })),
  }));
}

export function setCardAgreements(list: CardAgreementDetail[]) {
  agreementStore = list.map((a) => ({
    ...a,
    banks: a.banks.map((b) => ({
      ...b,
      installments: b.installments.map((r) => ({ ...r })),
    })),
  }));
}

export function findCardAgreement(id: string) {
  return getCardAgreements().find((a) => a.id === id) ?? null;
}

export function upsertCardAgreement(detail: CardAgreementDetail) {
  const list = getCardAgreements();
  const i = list.findIndex((a) => a.id === detail.id);
  if (i >= 0) list[i] = detail;
  else list.push(detail);
  setCardAgreements(list);
}

export function removeCardAgreement(id: string) {
  setCardAgreements(getCardAgreements().filter((a) => a.id !== id));
}

export const INITIAL_CARD_TYPES: CardNamedRow[] = [
  { id: 'ct-1', name: 'Banka Kartı' },
  { id: 'ct-2', name: 'Kredi Kartı' },
  { id: 'ct-3', name: 'Ön Ödemeli Kart' },
];

export const INITIAL_CARD_KINDS: CardNamedRow[] = [
  { id: 'ck-1', name: 'Bireysel Kart' },
  { id: 'ck-2', name: 'Ticari Kart' },
];

export const INITIAL_CARD_BRANDS: CardBrandRow[] = [
  { id: 'cb-amex', name: 'Amex', initials: 'AX' },
  { id: 'cb-diners', name: 'Diners', initials: 'DC' },
  { id: 'cb-jcb', name: 'JCB', initials: 'JC' },
  { id: 'cb-mc', name: 'MasterCard', initials: 'MC' },
  { id: 'cb-ozel', name: 'Özel Logolu', initials: 'ÖL' },
  { id: 'cb-troy', name: 'TROY', initials: 'TR' },
  { id: 'cb-troy-disc', name: 'TROY/Discover co-badge', initials: 'TC' },
  { id: 'cb-up', name: 'UnionPay', initials: 'UP' },
];
