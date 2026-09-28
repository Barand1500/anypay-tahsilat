/** Tanımlamalar › Kart — tipler + anlaşma yardımcıları */

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
  logo?: string;
  logoFileName?: string;
  installments: CardAgreementInstallment[];
};

export type CardAgreementDetail = {
  id: string;
  name: string;
  date: string;
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
