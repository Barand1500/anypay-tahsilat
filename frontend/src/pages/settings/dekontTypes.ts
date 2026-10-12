export type DekontBlockType =
  | 'brandLogo'
  | 'bankLogo'
  | 'keepSlip'
  | 'merchantTitle'
  | 'merchantAddress'
  | 'merchantPhone'
  | 'bankName'
  | 'dateTimeRow'
  | 'txnMeta'
  | 'installmentLine'
  | 'slipTitle'
  | 'cardMasked'
  | 'amountBlock'
  | 'approvedLine'
  | 'authRef'
  | 'legalLine'
  | 'maliDeger'
  | 'musteriNushasi';

export type DekontBlock = {
  id: string;
  type: DekontBlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  fontScale: number;
  align: 'left' | 'center' | 'right';
  z: number;
};

export type DekontFormatLayout = { blocks: DekontBlock[] };

export type DekontSettings = {
  fis: DekontFormatLayout;
  a5: DekontFormatLayout | null;
  a4: DekontFormatLayout | null;
};

export type DekontSampleContext = {
  brandLogoUrl: string;
  bankLogoUrl: string;
  bankName: string;
  merchantTitle: string;
  merchantAddress: string;
  merchantPhone: string;
  date: string;
  time: string;
  transactionNo: string;
  authCode: string;
  referenceNo: string;
  cardHolderName: string;
  cardMasked: string;
  installments: number;
  slipTitle: string;
  amountLabel: string;
  amountTotal: string;
  amountDetail: string;
  legalLine: string;
};

export const DEKONT_VARIABLE_META: Array<{
  type: DekontBlockType;
  label: string;
  hint: string;
}> = [
  { type: 'brandLogo', label: 'Firma logosu', hint: 'Üst marka' },
  { type: 'bankLogo', label: 'Banka logosu', hint: 'Kartın bankası' },
  { type: 'keepSlip', label: 'Saklayınız', hint: 'BU BELGEYİ SAKLAYINIZ' },
  { type: 'merchantTitle', label: 'Üye işyeri', hint: 'Unvan' },
  { type: 'merchantAddress', label: 'Adres', hint: 'İşyeri adresi' },
  { type: 'merchantPhone', label: 'Telefon', hint: 'İşyeri telefon' },
  { type: 'bankName', label: 'Banka adı', hint: 'Metin' },
  { type: 'dateTimeRow', label: 'Tarih / Saat', hint: 'İki kolon' },
  { type: 'txnMeta', label: 'İşlem meta', hint: 'No / onay / ref' },
  { type: 'installmentLine', label: 'Taksit sayısı', hint: 'TAKSİT SAYISI' },
  { type: 'slipTitle', label: 'İşlem tipi', hint: 'SATIŞ / İADE…' },
  { type: 'cardMasked', label: 'Kart no', hint: 'Maskeli' },
  { type: 'amountBlock', label: 'Tutar', hint: 'Büyük tutar' },
  { type: 'approvedLine', label: 'Onaylandı', hint: 'İŞLEM ONAYLANDI' },
  { type: 'authRef', label: 'Onay / Ref', hint: 'Kod satırları' },
  { type: 'legalLine', label: 'Yasal satır', hint: 'Mal/hizmet…' },
  { type: 'maliDeger', label: 'Mali değeri yoktur', hint: 'Alt uyarı' },
  { type: 'musteriNushasi', label: 'Müşteri nüshası', hint: 'Nüsha' },
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newDekontBlock(
  type: DekontBlockType,
  partial?: Partial<Omit<DekontBlock, 'type' | 'id'>>,
): DekontBlock {
  const defaults: Record<DekontBlockType, Pick<DekontBlock, 'w' | 'h' | 'fontScale' | 'align'>> = {
    brandLogo: { w: 60, h: 7, fontScale: 1, align: 'center' },
    bankLogo: { w: 56, h: 7, fontScale: 1, align: 'center' },
    keepSlip: { w: 90, h: 2.5, fontScale: 0.85, align: 'center' },
    merchantTitle: { w: 90, h: 3.5, fontScale: 1.15, align: 'center' },
    merchantAddress: { w: 90, h: 3.5, fontScale: 0.85, align: 'center' },
    merchantPhone: { w: 90, h: 2.5, fontScale: 0.85, align: 'center' },
    bankName: { w: 90, h: 3, fontScale: 1.05, align: 'center' },
    dateTimeRow: { w: 92, h: 3, fontScale: 0.9, align: 'left' },
    txnMeta: { w: 92, h: 5, fontScale: 0.85, align: 'left' },
    installmentLine: { w: 90, h: 2.8, fontScale: 1, align: 'center' },
    slipTitle: { w: 90, h: 4, fontScale: 1.35, align: 'center' },
    cardMasked: { w: 90, h: 3, fontScale: 1.05, align: 'center' },
    amountBlock: { w: 90, h: 8, fontScale: 1.2, align: 'center' },
    approvedLine: { w: 90, h: 3, fontScale: 1.1, align: 'center' },
    authRef: { w: 90, h: 4.5, fontScale: 0.85, align: 'center' },
    legalLine: { w: 90, h: 4, fontScale: 0.8, align: 'center' },
    maliDeger: { w: 90, h: 2.5, fontScale: 0.95, align: 'center' },
    musteriNushasi: { w: 90, h: 2.5, fontScale: 0.9, align: 'center' },
  };
  const d = defaults[type];
  return {
    id: makeId(type),
    type,
    x: partial?.x ?? 5,
    y: partial?.y ?? 40,
    w: partial?.w ?? d.w,
    h: partial?.h ?? d.h,
    fontScale: partial?.fontScale ?? d.fontScale,
    align: partial?.align ?? d.align,
    z: partial?.z ?? 1,
  };
}

export function getDefaultFisBlocks(): DekontBlock[] {
  return [
    newDekontBlock('brandLogo', { x: 20, y: 1.5, w: 60, h: 7, z: 2 }),
    newDekontBlock('keepSlip', { x: 5, y: 9, w: 90, h: 2.5, fontScale: 0.85 }),
    newDekontBlock('merchantTitle', { x: 5, y: 12, w: 90, h: 3.5, fontScale: 1.15 }),
    newDekontBlock('merchantAddress', { x: 5, y: 16, w: 90, h: 3.5, fontScale: 0.85 }),
    newDekontBlock('merchantPhone', { x: 5, y: 20, w: 90, h: 2.5, fontScale: 0.85 }),
    newDekontBlock('bankName', { x: 5, y: 23.5, w: 90, h: 3, fontScale: 1.05 }),
    newDekontBlock('dateTimeRow', { x: 4, y: 28, w: 92, h: 3, fontScale: 0.9, align: 'left' }),
    newDekontBlock('txnMeta', { x: 4, y: 31.5, w: 92, h: 5, fontScale: 0.85, align: 'left' }),
    newDekontBlock('installmentLine', { x: 5, y: 37.5, w: 90, h: 2.8 }),
    newDekontBlock('slipTitle', { x: 5, y: 41, w: 90, h: 4, fontScale: 1.35 }),
    newDekontBlock('cardMasked', { x: 5, y: 46, w: 90, h: 3, fontScale: 1.05 }),
    newDekontBlock('amountBlock', { x: 5, y: 50, w: 90, h: 8, fontScale: 1.2 }),
    newDekontBlock('approvedLine', { x: 5, y: 59, w: 90, h: 3, fontScale: 1.1 }),
    newDekontBlock('authRef', { x: 5, y: 63, w: 90, h: 4.5, fontScale: 0.85 }),
    newDekontBlock('legalLine', { x: 5, y: 69, w: 90, h: 4, fontScale: 0.8 }),
    newDekontBlock('maliDeger', { x: 5, y: 74, w: 90, h: 2.5, fontScale: 0.95 }),
    newDekontBlock('musteriNushasi', { x: 5, y: 77, w: 90, h: 2.5, fontScale: 0.9 }),
    newDekontBlock('bankLogo', { x: 22, y: 82, w: 56, h: 7, z: 2 }),
  ];
}

export function getDefaultDekontSettings(): DekontSettings {
  return { fis: { blocks: getDefaultFisBlocks() }, a5: null, a4: null };
}

export const SAMPLE_DEKONT_CTX = (brandLogoUrl: string): DekontSampleContext => ({
  brandLogoUrl,
  bankLogoUrl: '/banks/tgarantibankasias_logo_1750065698.webp',
  bankName: 'Garanti BBVA',
  merchantTitle: 'GÜZEL TEKNOLOJİ',
  merchantAddress: 'YENİ EMEK MAH. YILDIRIM 130A ANTALYA',
  merchantPhone: '0242 000 00 00',
  date: '12/10/2026',
  time: '15:54',
  transactionNo: '2026TABC123',
  authCode: '046728',
  referenceNo: '628567824487',
  cardHolderName: 'ÖRNEK KART SAHİBİ',
  cardMasked: '5218 **** **** 9313',
  installments: 3,
  slipTitle: 'TAKSİTLİ SATIŞ',
  amountLabel: 'İŞLEM TUTARI',
  amountTotal: '1.053,40 TL',
  amountDetail: 'Tutar 1.000,00 · Komisyon 53,40',
  legalLine: 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
});
