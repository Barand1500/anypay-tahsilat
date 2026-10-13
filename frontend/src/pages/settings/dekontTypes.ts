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
  { type: 'emptyBox', label: 'Boş kutu', hint: 'Kenarlıklı boş çerçeve', sheetOnly: true },
  { type: 'contentBox', label: 'İçerik kutusu', hint: 'Alanları seçilebilir', sheetOnly: true },
  { type: 'docTitle', label: 'Başlık', hint: 'SANAL POS E-DEKONT', sheetOnly: true },
  { type: 'dekontNoDate', label: 'Dekont no / tarih', hint: 'Üst meta', sheetOnly: true },
  { type: 'partiesCards', label: 'Taraflar (çift)', hint: 'Hazır iki kutu', sheetOnly: true },
  { type: 'detailTable', label: 'Detay tablosu', hint: 'İki kolon KV', sheetOnly: true },
  { type: 'legalBox', label: 'Yasal kutu', hint: 'İmza alanı', sheetOnly: true },
  { type: 'amountWords', label: 'Yazıyla tutar', hint: 'Yalnız; …', sheetOnly: true },
  { type: 'keepSlip', label: 'Saklayınız', hint: 'BU BELGEYİ SAKLAYINIZ', fisOnly: true },
  { type: 'merchantTitle', label: 'Üye işyeri', hint: 'İletişim › ünvan' },
  { type: 'merchantAddress', label: 'Adres', hint: 'İletişim › adres' },
  { type: 'merchantPhone', label: 'Vergi / telefon', hint: 'VD + VN veya telefon' },
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
  { type: 'customText', label: 'İstek metin', hint: 'Serbest yazı — tıkla, yaz' },
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
  if (partial?.fields) base.fields = [...partial.fields];
  if (partial?.text !== undefined && type !== 'customText') base.text = partial.text.slice(0, 500);
  return base;
}

/**
 * Varsayılan 80mm — POS termal fiş (Akbank tipi sıra):
 * saklayınız → banka → müşteri nüshası → tarih/saat/fiş → işyeri → meta →
 * taksit/satış/kart → tutar → onay → yasal → imza → alt banka
 */
export function getDefaultFisBlocks(): DekontBlock[] {
  return [
    newDekontBlock('keepSlip', { x: 4, y: 1, w: 92, h: 2.2, fontScale: 0.8 }),
    newDekontBlock('bankLogo', { x: 18, y: 3.5, w: 64, h: 7, z: 2 }),
    newDekontBlock('musteriNushasi', { x: 4, y: 11, w: 92, h: 2.2, fontScale: 0.9 }),
    newDekontBlock('dateTimeRow', { x: 8, y: 14, w: 84, h: 7.5, fontScale: 0.95, align: 'left' }),
    newDekontBlock('merchantTitle', { x: 4, y: 22.5, w: 92, h: 3.2, fontScale: 1.1 }),
    newDekontBlock('merchantAddress', { x: 4, y: 26, w: 92, h: 4.5, fontScale: 0.85 }),
    newDekontBlock('merchantPhone', { x: 4, y: 31, w: 92, h: 2.2, fontScale: 0.85 }),
    newDekontBlock('bankName', { x: 4, y: 33.5, w: 92, h: 2.5, fontScale: 0.95 }),
    newDekontBlock('txnMeta', { x: 4, y: 37, w: 92, h: 8, fontScale: 0.8, align: 'left' }),
    newDekontBlock('installmentLine', { x: 4, y: 46, w: 92, h: 2.4, fontScale: 0.95 }),
    newDekontBlock('slipTitle', { x: 4, y: 49, w: 92, h: 3.2, fontScale: 1.25 }),
    newDekontBlock('cardMasked', { x: 4, y: 53, w: 92, h: 4.2, fontScale: 1 }),
    newDekontBlock('amountBlock', { x: 4, y: 58, w: 92, h: 9, fontScale: 1.35 }),
    newDekontBlock('authRef', { x: 4, y: 68, w: 92, h: 6.5, fontScale: 0.8 }),
    newDekontBlock('legalLine', { x: 4, y: 75.5, w: 92, h: 3.5, fontScale: 0.75 }),
    newDekontBlock('maliDeger', { x: 4, y: 79.5, w: 92, h: 2.2, fontScale: 0.9 }),
    newDekontBlock('customText', {
      x: 4,
      y: 82.5,
      w: 92,
      h: 4,
      fontScale: 0.85,
      align: 'center',
      text: '--------------------\nİMZA',
      border: false,
    }),
    newDekontBlock('keepSlip', { x: 4, y: 87.5, w: 92, h: 2.2, fontScale: 0.8 }),
    newDekontBlock('bankLogo', { x: 22, y: 90.5, w: 56, h: 5.5, z: 2 }),
    newDekontBlock('customText', {
      x: 4,
      y: 96.5,
      w: 92,
      h: 2.2,
      fontScale: 0.9,
      align: 'center',
      text: 'İŞYERİ NÜSHASI',
      border: false,
    }),
  ];
}

/** A5/A4 — ayrı yönetilebilir kutular */
export function getDefaultSheetBlocks(): DekontBlock[] {
  return [
    newDekontBlock('brandLogo', { x: 4, y: 2, w: 30, h: 6, align: 'left', z: 2 }),
    newDekontBlock('bankLogo', { x: 66, y: 2, w: 30, h: 6, align: 'right', z: 2 }),
    newDekontBlock('docTitle', { x: 5, y: 10, w: 90, h: 4, fontScale: 1.1 }),
    newDekontBlock('dekontNoDate', { x: 5, y: 15, w: 90, h: 3, fontScale: 0.9, align: 'left' }),
    newDekontBlock('contentBox', {
      x: 5,
      y: 19,
      w: 44,
      h: 11,
      fontScale: 0.95,
      align: 'left',
      border: true,
      fields: ['merchantTitle', 'merchantAddress', 'merchantPhone'],
    }),
    newDekontBlock('contentBox', {
      x: 51,
      y: 19,
      w: 44,
      h: 11,
      fontScale: 0.95,
      align: 'left',
      border: true,
      fields: ['cardHolderName', 'holderPhone'],
    }),
    newDekontBlock('detailTable', { x: 5, y: 31.5, w: 90, h: 30, fontScale: 0.85, align: 'left' }),
    newDekontBlock('amountWords', { x: 5, y: 62.5, w: 90, h: 3, fontScale: 0.9, align: 'left' }),
    newDekontBlock('legalBox', { x: 5, y: 67, w: 90, h: 14, fontScale: 0.8, align: 'left' }),
    newDekontBlock('maliDeger', { x: 5, y: 83, w: 90, h: 3, fontScale: 0.95 }),
    newDekontBlock('musteriNushasi', { x: 5, y: 87, w: 90, h: 3, fontScale: 0.9 }),
  ];
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
    bankName: string;
    cardMasked: string;
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
  installments: 3,
  slipTitle: 'TAKSİTLİ SATIŞ',
  amountLabel: 'İŞLEM TUTARI',
  amountTotal: '1.053,40 TL',
  amountDetail: '',
  legalLine: 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
  dekontNo: '000014',
  identityNo: '123******90',
  holderPhone: '530 *** ** 50',
  description: 'Örnek tahsilat',
  amountOnly: '1.000,00',
  commissionOnly: '53,40',
  legalBox1:
    'Kredi kartımdan / banka kartımdan 1.053,40 ₺ tutarın üye işyeri adına çekilmesini kabul ederim.',
  legalBox2:
    'Banka veya kart kuruluşunun ödemeyi bloke etmesi halinde tutarı bizzat ödemeyi taahhüt ederim.',
  status: 'paid',
});
