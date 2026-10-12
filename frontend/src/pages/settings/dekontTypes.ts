export type DekontPaperFormat = 'fis' | 'a5' | 'a4';

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
  | 'musteriNushasi'
  /** A5/A4 kutu düzeni */
  | 'docTitle'
  | 'dekontNoDate'
  | 'partiesCards'
  | 'detailTable'
  | 'legalBox'
  | 'amountWords';

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

/** Önizleme işlem tipi — tuvalde örnek içerik değiştirir */
export type DekontPreviewSlipKind = 'sale' | 'installment' | 'cancel' | 'refund';

export const DEKONT_PREVIEW_SLIP_OPTIONS: Array<{
  id: DekontPreviewSlipKind;
  label: string;
}> = [
  { id: 'sale', label: 'Satış' },
  { id: 'installment', label: 'Taksitli satış' },
  { id: 'cancel', label: 'Satış iptali' },
  { id: 'refund', label: 'İade' },
];

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
  dekontNo: string;
  identityNo: string;
  holderPhone: string;
  description: string;
  amountOnly: string;
  commissionOnly: string;
  legalBox1: string;
  legalBox2: string;
  status: 'paid' | 'cancelled' | 'refunded';
};

export const DEKONT_VARIABLE_META: Array<{
  type: DekontBlockType;
  label: string;
  hint: string;
  /** true → yalnızca A5/A4 paletinde */
  sheetOnly?: boolean;
  /** true → yalnızca fiş paletinde */
  fisOnly?: boolean;
}> = [
  { type: 'brandLogo', label: 'Firma logosu', hint: 'Üst marka' },
  { type: 'bankLogo', label: 'Banka logosu', hint: 'Kartın bankası' },
  { type: 'docTitle', label: 'Başlık', hint: 'SANAL POS E-DEKONT', sheetOnly: true },
  { type: 'dekontNoDate', label: 'Dekont no / tarih', hint: 'Üst meta', sheetOnly: true },
  { type: 'partiesCards', label: 'Taraflar', hint: 'İşyeri + kart sahibi', sheetOnly: true },
  { type: 'detailTable', label: 'Detay tablosu', hint: 'İki kolon KV', sheetOnly: true },
  { type: 'legalBox', label: 'Yasal kutu', hint: 'İmza alanı', sheetOnly: true },
  { type: 'amountWords', label: 'Yazıyla tutar', hint: 'Yalnız; …', sheetOnly: true },
  { type: 'keepSlip', label: 'Saklayınız', hint: 'BU BELGEYİ SAKLAYINIZ', fisOnly: true },
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
  { type: 'approvedLine', label: 'Onaylandı', hint: 'İŞLEM ONAYLANDI', fisOnly: true },
  { type: 'authRef', label: 'Onay / Ref', hint: 'Kod satırları' },
  { type: 'legalLine', label: 'Yasal satır', hint: 'Mal/hizmet…', fisOnly: true },
  { type: 'maliDeger', label: 'Mali değeri yoktur', hint: 'Alt uyarı', fisOnly: true },
  { type: 'musteriNushasi', label: 'Müşteri nüshası', hint: 'Nüsha', fisOnly: true },
];

export const PAPER_CSS: Record<
  DekontPaperFormat,
  { width: string; aspectRatio: string; label: string }
> = {
  fis: { width: '80mm', aspectRatio: '227 / 720', label: 'Fiş 80mm' },
  a5: { width: '148mm', aspectRatio: '148 / 210', label: 'A5' },
  a4: { width: '210mm', aspectRatio: '210 / 297', label: 'A4' },
};

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
    docTitle: { w: 90, h: 4, fontScale: 1.1, align: 'center' },
    dekontNoDate: { w: 90, h: 3, fontScale: 0.9, align: 'left' },
    partiesCards: { w: 90, h: 12, fontScale: 0.95, align: 'left' },
    detailTable: { w: 90, h: 28, fontScale: 0.85, align: 'left' },
    legalBox: { w: 90, h: 12, fontScale: 0.8, align: 'left' },
    amountWords: { w: 90, h: 3, fontScale: 0.9, align: 'left' },
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

/** A5/A4 mevcut kutu düzenine yakın varsayılan */
export function getDefaultSheetBlocks(): DekontBlock[] {
  return [
    newDekontBlock('brandLogo', { x: 4, y: 2, w: 30, h: 6, align: 'left', z: 2 }),
    newDekontBlock('bankLogo', { x: 66, y: 2, w: 30, h: 6, align: 'right', z: 2 }),
    newDekontBlock('docTitle', { x: 5, y: 10, w: 90, h: 4, fontScale: 1.1 }),
    newDekontBlock('dekontNoDate', { x: 5, y: 15, w: 90, h: 3, fontScale: 0.9, align: 'left' }),
    newDekontBlock('partiesCards', { x: 5, y: 19, w: 90, h: 11, fontScale: 0.95, align: 'left' }),
    newDekontBlock('detailTable', { x: 5, y: 31.5, w: 90, h: 30, fontScale: 0.85, align: 'left' }),
    newDekontBlock('amountWords', { x: 5, y: 62.5, w: 90, h: 3, fontScale: 0.9, align: 'left' }),
    newDekontBlock('legalBox', { x: 5, y: 67, w: 90, h: 14, fontScale: 0.8, align: 'left' }),
    newDekontBlock('maliDeger', { x: 5, y: 83, w: 90, h: 3, fontScale: 0.95 }),
    newDekontBlock('musteriNushasi', { x: 5, y: 87, w: 90, h: 3, fontScale: 0.9 }),
  ];
}

export function getDefaultDekontSettings(): DekontSettings {
  return {
    fis: { blocks: getDefaultFisBlocks() },
    a5: { blocks: getDefaultSheetBlocks() },
    a4: { blocks: getDefaultSheetBlocks() },
  };
}

export function applyPreviewSlipKind(
  base: DekontSampleContext,
  kind: DekontPreviewSlipKind,
): DekontSampleContext {
  if (kind === 'sale') {
    return {
      ...base,
      installments: 1,
      slipTitle: 'SATIŞ',
      status: 'paid',
      legalLine: 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
      amountDetail: 'Tutar 1.000,00 · Komisyon 53,40',
    };
  }
  if (kind === 'installment') {
    return {
      ...base,
      installments: 3,
      slipTitle: 'TAKSİTLİ SATIŞ',
      status: 'paid',
      legalLine: 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
      amountDetail: 'Tutar 1.000,00 · Komisyon 53,40',
    };
  }
  if (kind === 'cancel') {
    return {
      ...base,
      installments: 1,
      slipTitle: 'SATIŞ İPTALİ',
      status: 'cancelled',
      legalLine: 'TUTAR KARŞILIĞI İŞLEM İPTAL EDİLMİŞTİR',
      amountDetail: '',
    };
  }
  return {
    ...base,
    installments: 1,
    slipTitle: 'İADE',
    status: 'refunded',
    legalLine: 'TUTAR KARŞILIĞI İŞLEM İADE EDİLMİŞTİR',
    amountDetail: '',
  };
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
  dekontNo: '2026TABC123',
  identityNo: '123******90',
  holderPhone: '530 *** ** 50',
  description: 'Örnek tahsilat',
  amountOnly: '1.000,00',
  commissionOnly: '53,40',
  legalBox1:
    'Kredi kartımdan / banka kartımdan 1.053,40 ₺ tutarın GÜZEL TEKNOLOJİ adına çekilmesini kabul ederim.',
  legalBox2:
    'Banka veya kart kuruluşunun ödemeyi bloke etmesi halinde tutarı bizzat ödemeyi taahhüt ederim.',
  status: 'paid',
});
