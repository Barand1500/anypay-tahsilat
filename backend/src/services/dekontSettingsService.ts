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
  | 'amountBlock'
  | 'approvedLine'
  | 'authRef'
  | 'legalLine'
  | 'maliDeger'
  | 'musteriNushasi'
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

const CONTENT_FIELDS = new Set<DekontContentField>([
  'merchantTitle',
  'merchantAddress',
  'merchantPhone',
  'cardHolderName',
  'holderPhone',
  'identityNo',
  'bankName',
  'cardMasked',
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
};

export type DekontFormatLayout = { blocks: DekontBlock[] };

export type DekontSettings = {
  fis: DekontFormatLayout;
  a5: DekontFormatLayout | null;
  a4: DekontFormatLayout | null;
};

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
  return b;
}

/** Varsayılan 80mm — POS termal fiş (Akbank tipi sıra) */
export function getDefaultFisBlocks(): DekontBlock[] {
  return [
    block('keepSlip', { x: 4, y: 1, w: 92, h: 2.2, fontScale: 0.8, align: 'center', z: 1 }),
    block('bankLogo', { x: 18, y: 3.5, w: 64, h: 7, align: 'center', z: 2 }),
    block('musteriNushasi', { x: 4, y: 11, w: 92, h: 2.2, fontScale: 0.9, align: 'center', z: 1 }),
    block('dateTimeRow', { x: 8, y: 14, w: 84, h: 7.5, fontScale: 0.95, align: 'left', z: 1 }),
    block('merchantTitle', { x: 4, y: 22.5, w: 92, h: 3.2, fontScale: 1.1, align: 'center', z: 1 }),
    block('merchantAddress', { x: 4, y: 26, w: 92, h: 4.5, fontScale: 0.85, align: 'center', z: 1 }),
    block('merchantPhone', { x: 4, y: 31, w: 92, h: 2.2, fontScale: 0.85, align: 'center', z: 1 }),
    block('bankName', { x: 4, y: 33.5, w: 92, h: 2.5, fontScale: 0.95, align: 'center', z: 1 }),
    block('txnMeta', { x: 4, y: 37, w: 92, h: 8, fontScale: 0.8, align: 'left', z: 1 }),
    block('installmentLine', { x: 4, y: 46, w: 92, h: 2.4, fontScale: 0.95, align: 'center', z: 1 }),
    block('slipTitle', { x: 4, y: 49, w: 92, h: 3.2, fontScale: 1.25, align: 'center', z: 1 }),
    block('cardMasked', { x: 4, y: 53, w: 92, h: 4.2, fontScale: 1, align: 'center', z: 1 }),
    block('amountBlock', { x: 4, y: 58, w: 92, h: 9, fontScale: 1.35, align: 'center', z: 1 }),
    block('authRef', { x: 4, y: 68, w: 92, h: 6.5, fontScale: 0.8, align: 'center', z: 1 }),
    block('legalLine', { x: 4, y: 75.5, w: 92, h: 3.5, fontScale: 0.75, align: 'center', z: 1 }),
    block('maliDeger', { x: 4, y: 79.5, w: 92, h: 2.2, fontScale: 0.9, align: 'center', z: 1 }),
    block('customText', {
      x: 4,
      y: 82.5,
      w: 92,
      h: 4,
      fontScale: 0.85,
      align: 'center',
      z: 1,
      text: '--------------------\nİMZA',
      border: false,
    }),
    block('keepSlip', { x: 4, y: 87.5, w: 92, h: 2.2, fontScale: 0.8, align: 'center', z: 1 }),
    block('bankLogo', { x: 22, y: 90.5, w: 56, h: 5.5, align: 'center', z: 2 }),
    block('customText', {
      x: 4,
      y: 96.5,
      w: 92,
      h: 2.2,
      fontScale: 0.9,
      align: 'center',
      z: 1,
      text: 'İŞYERİ NÜSHASI',
      border: false,
    }),
  ];
}

/** A5/A4 — ayrı yönetilebilir kutular */
export function getDefaultSheetBlocks(): DekontBlock[] {
  return [
    block('brandLogo', { x: 4, y: 2, w: 30, h: 6, align: 'left', z: 2 }),
    block('bankLogo', { x: 66, y: 2, w: 30, h: 6, align: 'right', z: 2 }),
    block('docTitle', { x: 5, y: 10, w: 90, h: 4, fontScale: 1.1, align: 'center', z: 1 }),
    block('dekontNoDate', { x: 5, y: 15, w: 90, h: 3, fontScale: 0.9, align: 'left', z: 1 }),
    block('contentBox', {
      x: 5,
      y: 19,
      w: 44,
      h: 11,
      fontScale: 0.95,
      align: 'left',
      z: 1,
      border: true,
      fields: ['merchantTitle', 'merchantAddress', 'merchantPhone'],
    }),
    block('contentBox', {
      x: 51,
      y: 19,
      w: 44,
      h: 11,
      fontScale: 0.95,
      align: 'left',
      z: 1,
      border: true,
      fields: ['cardHolderName', 'holderPhone'],
    }),
    block('detailTable', { x: 5, y: 31.5, w: 90, h: 30, fontScale: 0.85, align: 'left', z: 1 }),
    block('amountWords', { x: 5, y: 62.5, w: 90, h: 3, fontScale: 0.9, align: 'left', z: 1 }),
    block('legalBox', { x: 5, y: 67, w: 90, h: 14, fontScale: 0.8, align: 'left', z: 1 }),
    block('maliDeger', { x: 5, y: 83, w: 90, h: 3, fontScale: 0.95, align: 'center', z: 1 }),
    block('musteriNushasi', { x: 5, y: 87, w: 90, h: 3, fontScale: 0.9, align: 'center', z: 1 }),
  ];
}

export function getDefaultDekontSettings(): DekontSettings {
  return {
    fis: { blocks: getDefaultFisBlocks() },
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
  return out;
}

function normalizeLayout(raw: unknown): DekontFormatLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const blocksIn = Array.isArray((raw as { blocks?: unknown }).blocks)
    ? (raw as { blocks: unknown[] }).blocks
    : [];
  const blocks = blocksIn
    .map((b, i) => normalizeBlock(b, i))
    .filter((x): x is DekontBlock => x != null)
    .slice(0, 48);
  if (!blocks.length) return null;
  return { blocks };
}

function parseStored(raw: string | null | undefined): DekontSettings | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<DekontSettings>;
    const fis = normalizeLayout(p.fis) ?? { blocks: getDefaultFisBlocks() };
    return {
      fis,
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
  const fis = normalizeLayout(input.fis);
  if (!fis?.blocks.length) throw new SettingsError('Fiş düzeninde en az bir blok gerekli');
  if (fis.blocks.length > 48) throw new SettingsError('En fazla 48 blok eklenebilir');

  const stored: DekontSettings = {
    fis,
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
