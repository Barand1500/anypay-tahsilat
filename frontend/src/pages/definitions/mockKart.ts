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

export function defaultAgreementInstallments(): CardAgreementInstallment[] {
  return Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    minLimit: '',
    allRate: '',
    bireyselRate: '',
    ticariRate: '',
  }));
}
