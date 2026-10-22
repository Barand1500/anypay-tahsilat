import { prisma } from '../lib/prisma.js';
import { getOrCreateAyarlarRow, SettingsError } from './settingsService.js';

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
  | 'legalBoxHolder'
  | 'legalBoxFirm'
  | 'docTitle'
  | 'dekontNoDate'
  | 'partiesCards'
  | 'detailTable'
  | 'legalBox'
  | 'amountWords'
  | 'emptyBox'
  | 'contentBox'
  | 'customText';

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

const CONTENT_FIELDS = new Set<DekontContentField>([
  'merchantTitle',
  'merchantAddress',
  'merchantPhone',
  'cardHolderName',
  'holderPhone',
  'identityNo',
  'bankName',
  'cardMasked',
  'cardBrand',
  'cardSegment',
  'date',
  'time',
  'atLabel',
  'dekontNo',
  'transactionNo',
  'authCode',
  'referenceNo',
  'amountTotal',
  'amountOnly',
  'commissionOnly',
  'installments',
  'description',
  'slipTitle',
  'legalLine',
  'amountInWords',
  'customerTitle',
  'customerAddress',
  'customerPhone',
  'sheetLegalLine',
  'secureNote',
  'staticDocTitle',
  'staticKeepSlip',
  'staticApproved',
  'staticMali',
  'staticMusteri',
]);

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
  border?: boolean;
  fields?: DekontContentField[];
  text?: string;
  /** contentBox — alanlar arası boşluk (pt); >0 ise yeni stil iç boşluk */
  gap?: number;
};

export type DekontFormatLayout = {
  blocks: DekontBlock[];
  /** Fiş boyu mm — yalnızca 80mm fiş */
  heightMm?: number;
};

export type DekontSettings = {
  fis: DekontFormatLayout;
  a5: DekontFormatLayout | null;
  a4: DekontFormatLayout | null;
};

export const DEFAULT_FIS_HEIGHT_MM = 190;
export const FIS_HEIGHT_MM_MIN = 120;
export const FIS_HEIGHT_MM_MAX = 400;

export function clampFisHeightMm(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_FIS_HEIGHT_MM;
  return Math.min(FIS_HEIGHT_MM_MAX, Math.max(FIS_HEIGHT_MM_MIN, Math.round(v)));
}

const BLOCK_TYPES = new Set<DekontBlockType>([
  'brandLogo',
  'bankLogo',
  'keepSlip',
  'merchantTitle',
  'merchantAddress',
  'merchantPhone',
  'bankName',
  'dateTimeRow',
  'txnMeta',
  'installmentLine',
  'slipTitle',
  'cardMasked',
  'cardBrand',
  'cardSegment',
  'amountBlock',
  'approvedLine',
  'authRef',
  'legalLine',
  'maliDeger',
  'musteriNushasi',
  'docTitle',
  'dekontNoDate',
  'partiesCards',
  'detailTable',
  'legalBox',
  'legalBoxHolder',
  'legalBoxFirm',
  'amountWords',
  'emptyBox',
  'contentBox',
  'customText',
]);

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeFields(raw: unknown): DekontContentField[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x as DekontContentField)
    .filter((x) => CONTENT_FIELDS.has(x))
    .slice(0, 24);
  return out;
}

function block(
  type: DekontBlockType,
  partial: Partial<Omit<DekontBlock, 'type' | 'id'>> & Pick<DekontBlock, 'x' | 'y' | 'w' | 'h'>,
): DekontBlock {
  const b: DekontBlock = {
    id: makeId(type),
    type,
    x: clamp(partial.x, 0, 100),
    y: clamp(partial.y, 0, 100),
    w: clamp(partial.w, 4, 100),
    h: clamp(partial.h, 2, 55),
    fontScale: clamp(partial.fontScale ?? 1, 0.7, 1.6),
    align: partial.align === 'left' || partial.align === 'right' ? partial.align : 'center',
    z: Math.round(clamp(partial.z ?? 1, 0, 99)),
  };
  if (type === 'emptyBox' || type === 'contentBox') {
    b.border = partial.border !== false;
    b.fields =
      type === 'contentBox'
        ? (normalizeFields(partial.fields) ?? [
            'merchantTitle',
            'merchantAddress',
            'merchantPhone',
          ])
        : normalizeFields(partial.fields) ?? [];
  } else if (type === 'customText') {
    b.border = Boolean(partial.border);
    b.text =
      typeof partial.text === 'string' && partial.text.trim()
        ? partial.text.trim().slice(0, 500)
        : 'Istek metninizi buraya yazin';
  } else if (partial.border !== undefined) {
    b.border = Boolean(partial.border);
  }
  if (partial.fields && type !== 'emptyBox' && type !== 'contentBox') {
    b.fields = normalizeFields(partial.fields);
  }
  if (typeof partial.text === 'string' && type !== 'customText') {
    b.text = partial.text.slice(0, 500);
  }
  if (typeof partial.gap === 'number' && Number.isFinite(partial.gap)) {
    b.gap = clamp(partial.gap, 0, 40);
  }
  return b;
}

/** Varsayılan 80mm fiş — termal slip (işyeri üstte, banka logosu altta) */
export function getDefaultFisBlocks(): DekontBlock[] {
  return [
    block('merchantTitle', { x: 4, y: 1.2, w: 92, h: 4.5, fontScale: 1.15, align: 'center', z: 1 }),
    block('merchantAddress', { x: 4, y: 6.2, w: 92, h: 6, fontScale: 0.85, align: 'center', z: 1 }),
    block('merchantPhone', { x: 4, y: 12.6, w: 92, h: 3.2, fontScale: 0.85, align: 'center', z: 1 }),
    block('dateTimeRow', { x: 6, y: 16.4, w: 88, h: 9, fontScale: 0.95, align: 'left', z: 1 }),
    block('txnMeta', { x: 4, y: 26, w: 92, h: 8.5, fontScale: 0.8, align: 'left', z: 1 }),
    block('slipTitle', { x: 4, y: 35.2, w: 92, h: 4, fontScale: 1.3, align: 'center', z: 1 }),
    block('cardMasked', { x: 4, y: 39.6, w: 92, h: 4.2, fontScale: 1.05, align: 'center', z: 1 }),
    block('cardBrand', { x: 30, y: 44.2, w: 40, h: 5.5, fontScale: 1, align: 'center', z: 2 }),
    block('cardSegment', { x: 4, y: 50.2, w: 92, h: 3, fontScale: 0.95, align: 'center', z: 1 }),
    block('amountBlock', { x: 4, y: 53.8, w: 92, h: 9, fontScale: 1.25, align: 'center', z: 1 }),
    block('approvedLine', { x: 4, y: 63.4, w: 92, h: 3.5, fontScale: 1.1, align: 'center', z: 1 }),
    block('authRef', { x: 4, y: 67.4, w: 92, h: 7, fontScale: 0.85, align: 'center', z: 1 }),
    block('legalLine', { x: 4, y: 75, w: 92, h: 4.2, fontScale: 0.8, align: 'center', z: 1 }),
    block('maliDeger', { x: 4, y: 79.6, w: 92, h: 2.8, fontScale: 0.95, align: 'center', z: 1 }),
    block('musteriNushasi', { x: 4, y: 82.8, w: 92, h: 2.8, fontScale: 0.9, align: 'center', z: 1 }),
    block('keepSlip', { x: 4, y: 86, w: 92, h: 2.8, fontScale: 0.85, align: 'center', z: 1 }),
    block('bankLogo', { x: 22, y: 89.4, w: 56, h: 8, align: 'center', z: 2 }),
  ];
}

/**
 * A5/A4 varsayılan — referans dekont tasarımı (A4 sayfaya göre yüzde konumlar):
 * logolar → başlık kutusu → dekont no/tarih → iki taraf kutusu →
 * (detay tablosu + yalnız + beyan) tek çerçeve → iki imza kutusu.
 * Kayıtlı (özelleştirilmiş) şablonlar bundan etkilenmez.
 */
export function getDefaultSheetBlocks(): DekontBlock[] {
  return [
    block('brandLogo', { x: 2.2, y: 1.4, w: 19, h: 5, align: 'left', z: 2 }),
    block('bankLogo', { x: 76.2, y: 1.4, w: 19.8, h: 5, align: 'right', z: 2 }),
    block('docTitle', { x: 2.2, y: 7.8, w: 95.6, h: 3.6, fontScale: 1.2, align: 'center', z: 1 }),
    block('dekontNoDate', { x: 2.2, y: 12.2, w: 95.6, h: 2.4, fontScale: 1.05, align: 'left', z: 1 }),
    block('contentBox', {
      x: 2.2, y: 14.2, w: 47.5, h: 13.4, fontScale: 1.1, align: 'left', z: 1, border: true, gap: 9.6,
      fields: ['merchantTitle', 'merchantAddress', 'merchantPhone'],
    }),
    block('contentBox', {
      x: 50.7, y: 14.2, w: 47.1, h: 13.4, fontScale: 1.1, align: 'left', z: 1, border: true, gap: 9.6,
      fields: ['customerTitle', 'customerAddress', 'customerPhone'],
    }),
    block('emptyBox', { x: 2.2, y: 29.2, w: 95.6, h: 27.3, align: 'left', z: 0, border: true }),
    block('detailTable', { x: 3.5, y: 29.6, w: 93, h: 17, fontScale: 1.1, align: 'left', z: 1, border: false }),
    block('amountWords', { x: 3.5, y: 46.4, w: 93, h: 2.2, fontScale: 1.1, align: 'left', z: 1 }),
    block('contentBox', {
      x: 3.5, y: 50.4, w: 93, h: 5.2, fontScale: 1.1, align: 'center', z: 1, border: false, gap: 8,
      fields: ['sheetLegalLine', 'secureNote'],
    }),
    block('legalBoxHolder', { x: 2.2, y: 58.1, w: 95.6, h: 11.9, fontScale: 1.1, align: 'left', z: 1 }),
    block('legalBoxFirm', { x: 2.2, y: 71.7, w: 95.6, h: 12, fontScale: 1.1, align: 'left', z: 1 }),
  ];
}

export function getDefaultDekontSettings(): DekontSettings {
  return {
    fis: { blocks: getDefaultFisBlocks(), heightMm: DEFAULT_FIS_HEIGHT_MM },
    a5: { blocks: getDefaultSheetBlocks() },
    a4: { blocks: getDefaultSheetBlocks() },
  };
}

function normalizeBlock(raw: unknown, i: number): DekontBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<DekontBlock>;
  const type = b.type as DekontBlockType;
  if (!BLOCK_TYPES.has(type)) return null;
  const out: DekontBlock = {
    id: typeof b.id === 'string' && b.id.trim() ? b.id.trim().slice(0, 64) : makeId(type),
    type,
    x: clamp(Number(b.x), 0, 100),
    y: clamp(Number(b.y), 0, 100),
    w: clamp(Number(b.w), 4, 100),
    h: clamp(Number(b.h), 2, 55),
    fontScale: clamp(Number(b.fontScale ?? 1), 0.7, 1.6),
    align: b.align === 'left' || b.align === 'right' ? b.align : 'center',
    z: Math.round(clamp(Number(b.z ?? i), 0, 99)),
  };
  if (type === 'emptyBox' || type === 'contentBox') {
    out.border = b.border !== false;
    out.fields =
      type === 'contentBox'
        ? (normalizeFields(b.fields) ?? ['merchantTitle', 'merchantAddress', 'merchantPhone'])
        : (normalizeFields(b.fields) ?? []);
  } else if (type === 'customText') {
    out.border = Boolean(b.border);
    out.text =
      typeof b.text === 'string' && b.text.trim()
        ? b.text.trim().slice(0, 500)
        : 'Istek metninizi buraya yazin';
  } else if (b.border !== undefined) {
    out.border = Boolean(b.border);
  }
  if (b.fields && type !== 'emptyBox' && type !== 'contentBox') {
    out.fields = normalizeFields(b.fields);
  }
  if (typeof b.text === 'string' && type !== 'customText') {
    out.text = b.text.slice(0, 500);
  }
  if (typeof b.gap === 'number' && Number.isFinite(b.gap)) {
    out.gap = clamp(b.gap, 0, 40);
  }
  return out;
}

function normalizeLayout(raw: unknown, withHeight = false): DekontFormatLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const blocksIn = Array.isArray((raw as { blocks?: unknown }).blocks)
    ? (raw as { blocks: unknown[] }).blocks
    : [];
  const blocks = blocksIn
    .map((b, i) => normalizeBlock(b, i))
    .filter((x): x is DekontBlock => x != null)
    .slice(0, 48);
  if (!blocks.length) return null;
  if (withHeight) {
    return {
      blocks,
      heightMm: clampFisHeightMm((raw as { heightMm?: unknown }).heightMm),
    };
  }
  return { blocks };
}

function parseStored(raw: string | null | undefined): DekontSettings | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<DekontSettings>;
    const fis =
      normalizeLayout(p.fis, true) ?? {
        blocks: getDefaultFisBlocks(),
        heightMm: DEFAULT_FIS_HEIGHT_MM,
      };
    return {
      fis: {
        blocks: fis.blocks,
        heightMm: clampFisHeightMm(fis.heightMm ?? DEFAULT_FIS_HEIGHT_MM),
      },
      a5: normalizeLayout(p.a5) ?? { blocks: getDefaultSheetBlocks() },
      a4: normalizeLayout(p.a4) ?? { blocks: getDefaultSheetBlocks() },
    };
  } catch {
    return null;
  }
}

async function readRawColumn(): Promise<string | null> {
  const row = await getOrCreateAyarlarRow();
  const rows = await prisma.$queryRaw<{ dekont_ayarlari: string | null }[]>`
    SELECT dekont_ayarlari FROM ayarlar WHERE id = ${row.id} LIMIT 1
  `;
  return rows[0]?.dekont_ayarlari ?? null;
}

export async function getDekontSettings(): Promise<DekontSettings> {
  try {
    return parseStored(await readRawColumn()) ?? getDefaultDekontSettings();
  } catch {
    return getDefaultDekontSettings();
  }
}

export async function updateDekontSettings(input: DekontSettings): Promise<DekontSettings> {
  const fis = normalizeLayout(input.fis, true);
  if (!fis?.blocks.length) throw new SettingsError('Fiş düzeninde en az bir blok gerekli');
  if (fis.blocks.length > 48) throw new SettingsError('En fazla 48 blok eklenebilir');

  const stored: DekontSettings = {
    fis: {
      blocks: fis.blocks,
      heightMm: clampFisHeightMm(fis.heightMm ?? input.fis?.heightMm ?? DEFAULT_FIS_HEIGHT_MM),
    },
    a5: normalizeLayout(input.a5),
    a4: normalizeLayout(input.a4),
  };

  const row = await getOrCreateAyarlarRow();
  await prisma.$executeRaw`
    UPDATE ayarlar
    SET dekont_ayarlari = ${JSON.stringify(stored)}, db_tarih = ${new Date()}
    WHERE id = ${row.id}
  `;
  return stored;
}
