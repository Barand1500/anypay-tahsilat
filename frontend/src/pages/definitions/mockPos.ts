/** Tanımlamalar › POS — mock veri */

export type VirtualPosRow = {
  id: string;
  bankId: string;
  bankName: string;
  posName: string;
  /** Altyapı katalog id */
  infrastructureId: string;
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

export const INITIAL_VIRTUAL_POS: VirtualPosRow[] = [
  {
    id: 'vpos-1',
    bankId: 'akbank',
    bankName: 'Akbank T.A.Ş.',
    posName: 'AKBANK SANAL POS',
    infrastructureId: 'infra-akbank',
    isDefault: false,
    active: true,
  },
  {
    id: 'vpos-2',
    bankId: 'yapikredi',
    bankName: 'Yapı ve Kredi Bankası A.Ş.',
    posName: 'YAPIKREDİ SANAL POS',
    infrastructureId: 'infra-yapikredi',
    isDefault: false,
    active: true,
  },
  {
    id: 'vpos-3',
    bankId: 'garanti',
    bankName: 'Türkiye Garanti Bankası A.Ş.',
    posName: 'GARANTİ SANAL POS',
    infrastructureId: 'infra-garanti',
    isDefault: false,
    active: true,
  },
  {
    id: 'vpos-4',
    bankId: 'isbank',
    bankName: 'Türkiye İş Bankası A.Ş.',
    posName: 'İŞBANKASI SANAL POS',
    infrastructureId: 'infra-isbank',
    isDefault: false,
    active: false,
  },
  {
    id: 'vpos-5',
    bankId: 'qnb',
    bankName: 'QNB Bank A.Ş.',
    posName: 'QNB SANAL POS',
    infrastructureId: 'infra-qnb',
    isDefault: true,
    active: true,
  },
];

/** Liste sayfası ile anlaşma sayfaları arası mock senkron */
let virtualPosStore: VirtualPosRow[] = INITIAL_VIRTUAL_POS.map((r) => ({ ...r }));

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
