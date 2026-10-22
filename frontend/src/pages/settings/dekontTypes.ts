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
  | 'cardBrand'
  | 'cardSegment'
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
  /** Yeni A4/A5: kart sahibi / firma imza kutuları (#...# kalın) */
  | 'legalBoxHolder'
  | 'legalBoxFirm'
  | 'amountWords'
  /** Yönetilebilir kutular */
  | 'emptyBox'
  | 'contentBox'
  /** Serbest / istek metin */
  | 'customText';

/** contentBox içinde gösterilebilecek alanlar */
export type DekontContentField =
  | 'merchantTitle'
  | 'merchantAddress'
  | 'merchantPhone'
  | 'cardHolderName'
  | 'holderPhone'
  | 'identityNo'
  | 'bankName'
  | 'cardMasked'
  | 'cardBrand'
  | 'cardSegment'
  | 'date'
  | 'time'
  | 'atLabel'
  | 'dekontNo'
  | 'transactionNo'
  | 'authCode'
  | 'referenceNo'
  | 'amountTotal'
  | 'amountOnly'
  | 'commissionOnly'
  | 'installments'
  | 'description'
  | 'slipTitle'
  | 'legalLine'
  | 'amountInWords'
  | 'customerTitle'
  | 'customerAddress'
  | 'customerPhone'
  | 'sheetLegalLine'
  | 'secureNote'
  | 'staticDocTitle'
  | 'staticKeepSlip'
  | 'staticApproved'
  | 'staticMali'
  | 'staticMusteri';

export const DEKONT_CONTENT_FIELD_META: Array<{
  id: DekontContentField;
  label: string;
  bold?: boolean;
}> = [
  { id: 'merchantTitle', label: 'Üye işyeri', bold: true },
  { id: 'merchantAddress', label: 'Adres' },
  { id: 'merchantPhone', label: 'Vergi / telefon' },
  { id: 'cardHolderName', label: 'Kart sahibi', bold: true },
  { id: 'holderPhone', label: 'Kart sahibi telefon' },
  { id: 'identityNo', label: 'T.C. / kimlik' },
  { id: 'bankName', label: 'Banka adı', bold: true },
  { id: 'cardMasked', label: 'Kart no' },
  { id: 'cardBrand', label: 'Kart markası' },
  { id: 'cardSegment', label: 'Kart türü (Bireysel/Ticari)' },
  { id: 'date', label: 'Tarih' },
  { id: 'time', label: 'Saat' },
  { id: 'atLabel', label: 'Tarih+saat' },
  { id: 'dekontNo', label: 'Dekont no' },
  { id: 'transactionNo', label: 'İşlem no' },
  { id: 'authCode', label: 'Onay kodu' },
  { id: 'referenceNo', label: 'Referans' },
  { id: 'amountTotal', label: 'Toplam tutar', bold: true },
  { id: 'amountOnly', label: 'Tutar' },
  { id: 'commissionOnly', label: 'Komisyon' },
  { id: 'installments', label: 'Taksit' },
  { id: 'description', label: 'Açıklama' },
  { id: 'slipTitle', label: 'İşlem tipi', bold: true },
  { id: 'legalLine', label: 'Yasal satır' },
  { id: 'amountInWords', label: 'Yazıyla tutar' },
  { id: 'customerTitle', label: 'Müşteri ünvanı', bold: true },
  { id: 'customerAddress', label: 'Müşteri adresi' },
  { id: 'customerPhone', label: 'Müşteri telefon' },
  { id: 'sheetLegalLine', label: 'Beyan cümlesi (A4/A5)' },
  { id: 'secureNote', label: '3D Secure notu' },
  { id: 'staticDocTitle', label: 'SANAL POS E-DEKONT', bold: true },
  { id: 'staticKeepSlip', label: 'BU BELGEYİ SAKLAYINIZ' },
  { id: 'staticApproved', label: 'İŞLEM ONAYLANDI', bold: true },
  { id: 'staticMali', label: 'MALİ DEĞERİ YOKTUR', bold: true },
  { id: 'staticMusteri', label: 'MÜŞTERİ NÜSHASI' },
];

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
  /** emptyBox / contentBox — kenarlık */
  border?: boolean;
  /** contentBox — kutuda gösterilecek alanlar (sıra önemli) */
  fields?: DekontContentField[];
  /** customText — kullanıcının yazdığı serbest metin */
  text?: string;
  /** contentBox — alanlar arası boşluk (pt); >0 ise yeni stil iç boşluk */
  gap?: number;
};

export type DekontFormatLayout = {
  blocks: DekontBlock[];
  /** Fiş boyu (mm) — yalnızca 80mm fiş; varsayılan 254 */
  heightMm?: number;
};

export type DekontSettings = {
  fis: DekontFormatLayout;
  a5: DekontFormatLayout | null;
  a4: DekontFormatLayout | null;
};

/** 80mm termal fiş — Enpara tipi varsayılan boy */
export const DEFAULT_FIS_HEIGHT_MM = 190;
export const FIS_HEIGHT_MM_MIN = 120;
export const FIS_HEIGHT_MM_MAX = 400;

export function clampFisHeightMm(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_FIS_HEIGHT_MM;
  return Math.min(FIS_HEIGHT_MM_MAX, Math.max(FIS_HEIGHT_MM_MIN, Math.round(v)));
}

/** Önizleme kağıt stili — fişte boy ayarlanabilir */
export function paperStyleFor(
  format: DekontPaperFormat,
  heightMm?: number,
): { width: string; aspectRatio: string; label: string } {
  if (format === 'fis') {
    const h = clampFisHeightMm(heightMm ?? DEFAULT_FIS_HEIGHT_MM);
    return { width: '80mm', aspectRatio: `80 / ${h}`, label: `Fiş 80×${h} mm` };
  }
  return PAPER_CSS[format];
}

/** Önizleme işlem tipi — tuvalde örnek içerik değiştirir */
export type DekontPreviewSlipKind = 'sale' | 'installment' | 'cancel' | 'refund';

export const DEKONT_PREVIEW_SLIP_OPTIONS: Array<{
  id: DekontPreviewSlipKind;
  label: string;
}> = [
  { id: 'sale', label: 'Peşin Satış' },
  { id: 'installment', label: 'Taksitli Satış' },
  { id: 'cancel', label: 'Satış İptali' },
  { id: 'refund', label: 'Satış İadesi' },
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
  cardBrand: string;
  cardSegment: string;
  installments: number;
  slipTitle: string;
  amountLabel: string;
  amountTotal: string;
  amountDetail: string;
  legalLine: string;
  dekontNo: string;
  identityNo: string;
  holderPhone: string;
  customerTitle: string;
  customerAddress: string;
  customerPhone: string;
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
  { type: 'emptyBox', label: 'Boş kutu', hint: 'Kenarlıklı boş çerçeve', sheetOnly: true },
  { type: 'contentBox', label: 'İçerik kutusu', hint: 'Alanları seçilebilir', sheetOnly: true },
  { type: 'docTitle', label: 'Başlık', hint: 'SANAL POS E-DEKONT', sheetOnly: true },
  { type: 'dekontNoDate', label: 'Dekont no / tarih', hint: 'Üst meta', sheetOnly: true },
  { type: 'partiesCards', label: 'Taraflar (çift)', hint: 'Hazır iki kutu', sheetOnly: true },
  { type: 'detailTable', label: 'Detay tablosu', hint: 'İki kolon KV', sheetOnly: true },
  { type: 'legalBox', label: 'Yasal kutu', hint: 'İmza alanı', sheetOnly: true },
  { type: 'legalBoxHolder', label: 'Kart sahibi imza kutusu', hint: 'Beyan + kart sahibi imzası', sheetOnly: true },
  { type: 'legalBoxFirm', label: 'Firma imza kutusu', hint: 'Taahhüt + müşteri firma imzası', sheetOnly: true },
  { type: 'amountWords', label: 'Yazıyla tutar', hint: 'Yalnız; …', sheetOnly: true },
  { type: 'keepSlip', label: 'Saklayınız', hint: 'BU BELGEYİ SAKLAYINIZ', fisOnly: true },
  { type: 'merchantTitle', label: 'Üye işyeri', hint: 'İletişim › ünvan' },
  { type: 'merchantAddress', label: 'Adres', hint: 'İletişim › adres' },
  { type: 'merchantPhone', label: 'Vergi / telefon', hint: 'VD + VN veya telefon' },
  { type: 'bankName', label: 'Banka adı', hint: 'Metin' },
  { type: 'dateTimeRow', label: 'Tarih / Saat', hint: 'İki kolon' },
  { type: 'txnMeta', label: 'İşlem meta', hint: 'No / onay / ref' },
  { type: 'installmentLine', label: 'Taksit sayısı', hint: 'TAKSİT SAYISI' },
  { type: 'slipTitle', label: 'İşlem tipi', hint: 'PEŞİN / TAKSİTLİ / İPTAL / İADE' },
  { type: 'cardMasked', label: 'Kart no', hint: 'Maskeli' },
  { type: 'cardBrand', label: 'Kart markası', hint: 'Logo — Visa / MC / TROY (BIN)' },
  { type: 'cardSegment', label: 'Kart türü', hint: 'Bireysel / Ticari — BIN' },
  { type: 'amountBlock', label: 'Tutar', hint: 'Büyük tutar' },
  { type: 'approvedLine', label: 'Onaylandı', hint: 'İŞLEM ONAYLANDI', fisOnly: true },
  { type: 'authRef', label: 'Onay / Ref', hint: 'Kod satırları' },
  { type: 'legalLine', label: 'Yasal satır', hint: 'Mal/hizmet…', fisOnly: true },
  { type: 'maliDeger', label: 'Mali değeri yoktur', hint: 'Alt uyarı', fisOnly: true },
  { type: 'musteriNushasi', label: 'Müşteri nüshası', hint: 'Nüsha', fisOnly: true },
  { type: 'customText', label: 'İstek metin', hint: 'Serbest yazı — tıkla, yaz' },
];

export const PAPER_CSS: Record<
  DekontPaperFormat,
  { width: string; aspectRatio: string; label: string }
> = {
  fis: {
    width: '80mm',
    aspectRatio: `80 / ${DEFAULT_FIS_HEIGHT_MM}`,
    label: `Fiş 80×${DEFAULT_FIS_HEIGHT_MM} mm`,
  },
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
    cardBrand: { w: 36, h: 5, fontScale: 1, align: 'center' },
    cardSegment: { w: 90, h: 2.4, fontScale: 0.95, align: 'center' },
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
    legalBoxHolder: { w: 94, h: 12, fontScale: 1.1, align: 'left' },
    legalBoxFirm: { w: 94, h: 12, fontScale: 1.1, align: 'left' },
    amountWords: { w: 90, h: 3, fontScale: 0.9, align: 'left' },
    emptyBox: { w: 44, h: 12, fontScale: 1, align: 'left' },
    contentBox: { w: 44, h: 12, fontScale: 0.95, align: 'left' },
    customText: { w: 90, h: 4, fontScale: 1, align: 'left' },
  };
  const d = defaults[type];
  const base: DekontBlock = {
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
  if (type === 'emptyBox') {
    base.border = partial?.border ?? true;
    base.fields = [];
  }
  if (type === 'contentBox') {
    base.border = partial?.border ?? true;
    base.fields = partial?.fields?.length
      ? [...partial.fields]
      : ['merchantTitle', 'merchantAddress', 'merchantPhone'];
  }
  if (type === 'customText') {
    base.text = (partial?.text ?? 'İstek metninizi buraya yazın').slice(0, 500);
    base.border = partial?.border ?? false;
  }
  if (partial?.border !== undefined && type !== 'emptyBox' && type !== 'contentBox' && type !== 'customText') {
    base.border = partial.border;
  }
  if (partial?.gap !== undefined) base.gap = partial.gap;
  if (partial?.fields) base.fields = [...partial.fields];
  if (partial?.text !== undefined && type !== 'customText') base.text = partial.text.slice(0, 500);
  return base;
}

/**
 * Varsayılan 80mm fiş — termal slip sırası:
 * işyeri → adres → vergi → tarih/işlem → satış tipi → kart → tutar →
 * onaylandı → onay/ref → yasal → mali değeri yoktur → müşteri nüshası →
 * saklayınız → banka logosu
 */
export function getDefaultFisBlocks(): DekontBlock[] {
  return [
    newDekontBlock('merchantTitle', { x: 4, y: 1.2, w: 92, h: 4.5, fontScale: 1.15 }),
    newDekontBlock('merchantAddress', { x: 4, y: 6.2, w: 92, h: 6, fontScale: 0.85 }),
    newDekontBlock('merchantPhone', { x: 4, y: 12.6, w: 92, h: 3.2, fontScale: 0.85 }),
    newDekontBlock('dateTimeRow', { x: 6, y: 16.4, w: 88, h: 9, fontScale: 0.95, align: 'left' }),
    newDekontBlock('txnMeta', { x: 4, y: 26, w: 92, h: 8.5, fontScale: 0.8, align: 'left' }),
    newDekontBlock('slipTitle', { x: 4, y: 35.2, w: 92, h: 4, fontScale: 1.3 }),
    newDekontBlock('cardMasked', { x: 4, y: 39.6, w: 92, h: 4.2, fontScale: 1.05 }),
    newDekontBlock('cardBrand', { x: 30, y: 44.2, w: 40, h: 5.5, z: 2 }),
    newDekontBlock('cardSegment', { x: 4, y: 50.2, w: 92, h: 3, fontScale: 0.95 }),
    newDekontBlock('amountBlock', { x: 4, y: 53.8, w: 92, h: 9, fontScale: 1.25 }),
    newDekontBlock('approvedLine', { x: 4, y: 63.4, w: 92, h: 3.5, fontScale: 1.1 }),
    newDekontBlock('authRef', { x: 4, y: 67.4, w: 92, h: 7, fontScale: 0.85 }),
    newDekontBlock('legalLine', { x: 4, y: 75, w: 92, h: 4.2, fontScale: 0.8 }),
    newDekontBlock('maliDeger', { x: 4, y: 79.6, w: 92, h: 2.8, fontScale: 0.95 }),
    newDekontBlock('musteriNushasi', { x: 4, y: 82.8, w: 92, h: 2.8, fontScale: 0.9 }),
    newDekontBlock('keepSlip', { x: 4, y: 86, w: 92, h: 2.8, fontScale: 0.85 }),
    newDekontBlock('bankLogo', { x: 22, y: 89.4, w: 56, h: 8, z: 2 }),
  ];
}

/**
 * A5/A4 varsayılan — referans dekont tasarımı. Kayıtlı (özelleştirilmiş) şablonlar etkilenmez.
 * Yerleşim backend dekontSettingsService.getDefaultSheetBlocks ile aynıdır.
 */
export function getDefaultSheetBlocks(): DekontBlock[] {
  return [
    newDekontBlock('brandLogo', { x: 2.2, y: 1.4, w: 19, h: 5, align: 'left', z: 2 }),
    newDekontBlock('bankLogo', { x: 76.2, y: 1.4, w: 19.8, h: 5, align: 'right', z: 2 }),
    newDekontBlock('docTitle', { x: 2.2, y: 7.8, w: 95.6, h: 3.6, fontScale: 1.2 }),
    newDekontBlock('dekontNoDate', { x: 2.2, y: 12.2, w: 95.6, h: 2.4, fontScale: 1.05, align: 'left' }),
    newDekontBlock('contentBox', {
      x: 2.2, y: 14.2, w: 47.5, h: 13.4, fontScale: 1.1, align: 'left', border: true, gap: 9.6,
      fields: ['merchantTitle', 'merchantAddress', 'merchantPhone'],
    }),
    newDekontBlock('contentBox', {
      x: 50.7, y: 14.2, w: 47.1, h: 13.4, fontScale: 1.1, align: 'left', border: true, gap: 9.6,
      fields: ['customerTitle', 'customerAddress', 'customerPhone'],
    }),
    newDekontBlock('emptyBox', { x: 2.2, y: 29.2, w: 95.6, h: 27.3, z: 0, border: true }),
    newDekontBlock('detailTable', { x: 3.5, y: 29.6, w: 93, h: 17, fontScale: 1.1, align: 'left', border: false }),
    newDekontBlock('amountWords', { x: 3.5, y: 46.4, w: 93, h: 2.2, fontScale: 1.1, align: 'left' }),
    newDekontBlock('contentBox', {
      x: 3.5, y: 50.4, w: 93, h: 5.2, fontScale: 1.1, align: 'center', border: false, gap: 8,
      fields: ['sheetLegalLine', 'secureNote'],
    }),
    newDekontBlock('legalBoxHolder', { x: 2.2, y: 58.1, w: 95.6, h: 11.9, fontScale: 1.1, align: 'left' }),
    newDekontBlock('legalBoxFirm', { x: 2.2, y: 71.7, w: 95.6, h: 12, fontScale: 1.1, align: 'left' }),
  ];
}

/** Fiş yasal satırı → A4/A5 beyan cümlesi */
export function sheetLegalSentence(legalLine: string): string {
  if (/İADE/.test(legalLine)) return 'Yukarıdaki bedel karşılığında işlem iade edilmiştir.';
  if (/İPTAL/.test(legalLine)) return 'Yukarıdaki bedel karşılığında işlem iptal edilmiştir.';
  return 'Yukarıdaki bedel karşılığında mal veya hizmet aldım.';
}

export function resolveContentField(
  field: DekontContentField,
  ctx: {
    merchantTitle: string;
    merchantAddress: string;
    merchantPhone: string;
    cardHolderName: string;
    holderPhone: string;
    identityNo: string;
    customerTitle?: string;
    customerAddress?: string;
    customerPhone?: string;
    threeDSecure?: boolean;
    bankName: string;
    cardMasked: string;
    cardBrand: string;
    cardSegment: string;
    date: string;
    time: string;
    atLabel: string;
    dekontNo: string;
    transactionNo: string;
    authCode: string;
    referenceNo: string;
    amountTotal: string;
    amountOnly: string;
    commissionOnly: string;
    installments: number;
    description: string;
    slipTitle: string;
    legalLine: string;
    amountInWords?: string;
  },
): { text: string; bold: boolean } {
  const meta = DEKONT_CONTENT_FIELD_META.find((m) => m.id === field);
  const bold = Boolean(meta?.bold);
  switch (field) {
    case 'merchantTitle':
      return { text: ctx.merchantTitle, bold };
    case 'merchantAddress':
      return { text: ctx.merchantAddress, bold };
    case 'merchantPhone':
      return { text: ctx.merchantPhone, bold };
    case 'cardHolderName':
      return { text: ctx.cardHolderName, bold };
    case 'holderPhone':
      return { text: ctx.holderPhone, bold };
    case 'identityNo':
      return { text: ctx.identityNo, bold };
    case 'bankName':
      return { text: ctx.bankName, bold };
    case 'cardMasked':
      return { text: ctx.cardMasked, bold };
    case 'cardBrand':
      return { text: ctx.cardBrand, bold };
    case 'cardSegment':
      return { text: ctx.cardSegment, bold };
    case 'date':
      return { text: ctx.date, bold };
    case 'time':
      return { text: ctx.time, bold };
    case 'atLabel':
      return { text: ctx.atLabel, bold };
    case 'dekontNo':
      return { text: ctx.dekontNo, bold };
    case 'transactionNo':
      return { text: ctx.transactionNo, bold };
    case 'authCode':
      return { text: ctx.authCode, bold };
    case 'referenceNo':
      return { text: ctx.referenceNo, bold };
    case 'amountTotal':
      return { text: ctx.amountTotal, bold };
    case 'amountOnly':
      return { text: ctx.amountOnly, bold };
    case 'commissionOnly':
      return { text: ctx.commissionOnly, bold };
    case 'installments':
      return { text: String(ctx.installments), bold };
    case 'description':
      return { text: ctx.description, bold };
    case 'slipTitle':
      return { text: ctx.slipTitle, bold };
    case 'legalLine':
      return { text: ctx.legalLine, bold };
    case 'amountInWords':
      return { text: ctx.amountInWords || '—', bold };
    case 'customerTitle':
      return { text: ctx.customerTitle || '', bold };
    case 'customerAddress':
      return { text: ctx.customerAddress || '', bold };
    case 'customerPhone':
      return { text: ctx.customerPhone || '', bold };
    case 'sheetLegalLine':
      return { text: sheetLegalSentence(ctx.legalLine), bold };
    case 'secureNote':
      return {
        text: ctx.threeDSecure ? 'Bu ödeme 3D Secure güvenli doğrulama ile yapılmıştır.' : '',
        bold,
      };
    case 'staticDocTitle':
      return { text: 'SANAL POS E-DEKONT', bold: true };
    case 'staticKeepSlip':
      return { text: 'BU BELGEYİ SAKLAYINIZ', bold: false };
    case 'staticApproved':
      return { text: 'İŞLEM ONAYLANDI', bold: true };
    case 'staticMali':
      return { text: 'MALİ DEĞERİ YOKTUR', bold: true };
    case 'staticMusteri':
      return { text: 'MÜŞTERİ NÜSHASI', bold: false };
    default:
      return { text: '', bold: false };
  }
}

export function getDefaultDekontSettings(): DekontSettings {
  return {
    fis: { blocks: getDefaultFisBlocks(), heightMm: DEFAULT_FIS_HEIGHT_MM },
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
      slipTitle: 'PEŞİN SATIŞ',
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
    slipTitle: 'SATIŞ İADESİ',
    status: 'refunded',
    legalLine: 'TUTAR KARŞILIĞI İŞLEM İADE EDİLMİŞTİR',
    amountDetail: '',
  };
}

/** Önizleme örnek işlem alanları — üye işyeri satırları İletişim ayarlarından gelir */
export const SAMPLE_DEKONT_CTX = (brandLogoUrl: string): DekontSampleContext => ({
  brandLogoUrl,
  bankLogoUrl: '/banks/tgarantibankasias_logo_1750065698.webp',
  bankName: 'Garanti BBVA',
  merchantTitle: '—',
  merchantAddress: '—',
  merchantPhone: '—',
  date: '12/10/2026',
  time: '15:54',
  transactionNo: '000014',
  authCode: '046728',
  referenceNo: '628567824487',
  cardHolderName: 'ÖRNEK KART SAHİBİ',
  cardMasked: '5218 **** **** 9313',
  cardBrand: 'MasterCard',
  cardSegment: 'Bireysel',
  installments: 3,
  slipTitle: 'TAKSİTLİ SATIŞ',
  amountLabel: 'İŞLEM TUTARI',
  amountTotal: '1.053,40 TL',
  amountDetail: '',
  legalLine: 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
  dekontNo: '000014',
  identityNo: '123******90',
  holderPhone: '530 *** ** 50',
  customerTitle: 'ÖRNEK MÜŞTERİ FİRMASI LTD. ŞTİ.',
  customerAddress: 'Örnek Mah. Örnek Cad. No:1 Kepez / Antalya',
  customerPhone: '532 *** ** 42',
  description: 'Örnek tahsilat',
  amountOnly: '1.000,00',
  commissionOnly: '53,40',
  legalBox1:
    'Kredi kartımdan / banka kartımdan 1.053,40 ₺ tutarın üye işyeri adına çekilmesini kabul ederim.',
  legalBox2:
    'Banka veya kart kuruluşunun ödemeyi bloke etmesi halinde tutarı bizzat ödemeyi taahhüt ederim.',
  status: 'paid',
});
