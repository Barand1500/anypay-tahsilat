/** Tanımlamalar › POS — tipler + altyapı kataloğu + anlaşma yardımcıları */

export type VirtualPosRow = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogoUrl?: string;
  posName: string;
  /** Altyapı katalog id */
  infrastructureId: string;
  merchantId: string;
  terminalSafeId: string;
  securityKey: string;
  /** NestPay / Garanti terminal şifresi */
  terminalPassword: string;
  securityType: string;
  isDefault: boolean;
  active: boolean;
};

export type CommonVirtualPosRow = {
  id: string;
  bankId: string;
  bankName: string;
  targetBankId: string;
  targetBankName: string;
  active: boolean;
};

/** Sanal POS altyapı katalogu (Ekle modalı) */
export const VIRTUAL_POS_INFRASTRUCTURES = [
  { id: 'infra-akbank', label: 'AKBANK SANAL POS' },
  { id: 'infra-yapikredi', label: 'YAPIKREDİ SANAL POS' },
  { id: 'infra-isbank', label: 'İŞ BANKASI SANAL POS' },
  { id: 'infra-ziraat', label: 'ZİRAAT BANKASI SANAL POS' },
  { id: 'infra-halkbank', label: 'HALK BANKASI SANAL POS' },
  { id: 'infra-garanti', label: 'GARANTİ SANAL POS' },
  { id: 'infra-qnb', label: 'QNB SANAL POS' },
  { id: 'infra-tosla', label: 'TOSLA POS' },
] as const;

export type CardSegmentRates = {
  minLimit: string;
  bankCommission: string;
  customerCommission: string;
  points: string;
  extraInstallment: string;
  collectionDay: string;
  blockDay: string;
  note: string;
  active: boolean;
};

export type BankAgreementInstallment = {
  n: number;
  all: CardSegmentRates;
  bireysel: CardSegmentRates;
  ticari: CardSegmentRates;
};

export type CustomerAgreementRow = {
  n: number;
  minLimit: string;
  allRate: string;
  bireyselRate: string;
  ticariRate: string;
};

function emptySegment(active = false): CardSegmentRates {
  return {
    minLimit: '',
    bankCommission: '',
    customerCommission: '',
    points: '0',
    extraInstallment: '0',
    collectionDay: '0',
    blockDay: '0',
    note: '',
    active,
  };
}

export function defaultBankInstallment(n: number): BankAgreementInstallment {
  return {
    n,
    all: emptySegment(false),
    bireysel: emptySegment(true),
    ticari: emptySegment(true),
  };
}

export function defaultCustomerRows(): CustomerAgreementRow[] {
  return Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    minLimit: i === 0 ? '0,00' : `${(i * 5000).toLocaleString('tr-TR')},00`,
    allRate: '',
    bireyselRate: '0,00',
    ticariRate: '0,00',
  }));
}

/** Liste / anlaşma sayfaları arası önbellek (API’den doldurulur) */
let virtualPosStore: VirtualPosRow[] = [];

export function getVirtualPosList() {
  return virtualPosStore.map((r) => ({ ...r }));
}

export function setVirtualPosList(rows: VirtualPosRow[]) {
  virtualPosStore = rows.map((r) => ({ ...r }));
}

export function findVirtualPos(id: string) {
  return virtualPosStore.find((r) => r.id === id) ?? null;
}

export const INITIAL_COMMON_VIRTUAL_POS: CommonVirtualPosRow[] = [
  {
    id: 'cvpos-1',
    bankId: 'denizbank',
    bankName: 'Denizbank A.Ş.',
    targetBankId: 'garanti',
    targetBankName: 'Türkiye Garanti Bankası A.Ş.',
    active: true,
  },
  {
    id: 'cvpos-2',
    bankId: 'teb',
    bankName: 'Türk Ekonomi Bankası A.Ş.',
    targetBankId: 'isbank',
    targetBankName: 'Türkiye İş Bankası A.Ş.',
    active: true,
  },
];
