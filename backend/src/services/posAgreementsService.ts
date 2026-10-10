import { prisma } from '../lib/prisma.js';
import { getVirtualPos } from './virtualPosService.js';

export class PosAgreementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosAgreementError';
  }
}

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function parseTrNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function bankAgreementCode(posId: number | string): string {
  return `pos-bank-${posId}`;
}

export function customerAgreementCode(posId: number | string): string {
  return `pos-musteri-${posId}`;
}

export type SegmentPayload = {
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

export type BankInstallmentPayload = {
  n: number;
  all: SegmentPayload;
  bireysel: SegmentPayload;
  ticari: SegmentPayload;
};

export type CustomerBlockPayload = {
  id: string;
  name: string;
  logoFileName?: string;
  rows: {
    n: number;
    minLimit: string;
    allRate: string;
    bireyselRate: string;
    ticariRate: string;
  }[];
};

function emptySegment(active = false): SegmentPayload {
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

function defaultBankItems(): BankInstallmentPayload[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    n,
    all: emptySegment(false),
    bireysel: emptySegment(true),
    ticari: emptySegment(true),
  }));
}

function normalizeBankSegments(items: BankInstallmentPayload[]): BankInstallmentPayload[] {
  if (!items.some((item) => item.all.active)) return items;
  return items.map((item) => ({
    ...item,
    bireysel: { ...item.bireysel, active: false },
    ticari: { ...item.ticari, active: false },
  }));
}

function defaultCustomerBlocks(): CustomerBlockPayload[] {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    minLimit: i === 0 ? '0,00' : `${(i * 5000).toLocaleString('tr-TR')},00`,
    allRate: '',
    bireyselRate: '0,00',
    ticariRate: '0,00',
  }));
  return [
    { id: 'blk-1', name: 'Axess Kart', rows: rows.map((r) => ({ ...r })) },
    { id: 'blk-2', name: 'Bonus Kart', rows: rows.map((r) => ({ ...r })) },
  ];
}

async function replaceAgreementRows(
  code: string,
  rows: {
    adi: string;
    bankaId: number | null;
    taksit: number;
    altLimit: number | null;
    komisyonTum: number | null;
    komisyonBireysel: number | null;
    komisyonTicari: number | null;
    grup: string;
    blokAdi: string;
    blokLogo: string | null;
    detay?: string | null;
    anlasmaKodu: string;
    remove: boolean;
    tarih?: Date;
  }[],
): Promise<void> {
  // Canlı DB’de detay / tarih kolonu yoksa ekle
  const { ensureKartAnlasmalariTable } = await import('../lib/ensureSchema.js');
  await ensureKartAnlasmalariTable();

  await prisma.kartAnlasma.updateMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    data: { remove: true },
  });

  if (!rows.length) return;

  const now = new Date();
  const withTarih = rows.map((r) => ({
    ...r,
    tarih: r.tarih ?? now,
    detay: r.detay ?? null,
  }));

  // Önce tam yaz; kolon uyumsuzluğunda kademeli düş
  try {
    await prisma.kartAnlasma.createMany({ data: withTarih });
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/detay|Unknown argument|does not exist|Unknown column/i.test(msg)) {
      // tarih eksikliği vb. — tarih’li base dene
      if (/tarih/i.test(msg)) {
        /* aşağıda tarih’li baseRows */
      } else {
        throw err;
      }
    }
  }

  const baseRows = withTarih.map(({ detay: _d, ...rest }) => rest);
  try {
    await prisma.kartAnlasma.createMany({ data: baseRows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Son çare: tarih + detay yok (sadece eski kolonlar) — raw insert
    if (/tarih|Null constraint/i.test(msg)) {
      // tarih zorunlu — her satıra Date ekle (zaten var); Prisma client eskiyse raw
      for (const r of baseRows) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`kart_anlasmalari\`
            (\`adi\`, \`banka_id\`, \`taksit\`, \`alt_limit\`, \`komisyon_tum\`, \`komisyon_bireysel\`, \`komisyon_ticari\`,
             \`tarih\`, \`grup\`, \`blok_adi\`, \`blok_logo\`, \`anlasma_kodu\`, \`remove\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          r.adi,
          r.bankaId,
          r.taksit,
          r.altLimit,
          r.komisyonTum,
          r.komisyonBireysel,
          r.komisyonTicari,
          r.tarih,
          r.grup,
          r.blokAdi,
          r.blokLogo,
          r.anlasmaKodu,
          r.remove ? 1 : 0,
        );
      }
    } else {
      throw err;
    }
  }

  const firstDetay = rows.find((r) => r.detay)?.detay;
  if (firstDetay) {
    try {
      const first = await prisma.kartAnlasma.findFirst({
        where: { anlasmaKodu: code, ...notRemoved() },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (first) {
        await prisma.$executeRawUnsafe(
          `UPDATE \`kart_anlasmalari\` SET \`detay\` = ? WHERE \`id\` = ?`,
          firstDetay,
          first.id,
        );
      }
    } catch {
      /* detay opsiyonel */
    }
  }
}

/** Banka kart anlaşması — GET */
export async function getPosBankAgreement(posId: number): Promise<{
  posId: string;
  bankId: string;
  bankName: string;
  agreementCode: string;
  items: BankInstallmentPayload[];
}> {
  const pos = await getVirtualPos(posId);
  if (!pos) throw new PosAgreementError('Sanal POS bulunamadı');

  const code = bankAgreementCode(posId);
  const dbRows = await prisma.kartAnlasma.findMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    orderBy: [{ taksit: 'asc' }],
  });

  if (!dbRows.length) {
    return {
      posId: pos.id,
      bankId: pos.bankId,
      bankName: pos.bankName,
      agreementCode: code,
      items: defaultBankItems(),
    };
  }

  // detay JSON varsa tam form (ilk dolu satır)
  const withDetay = dbRows.find((r) => r.detay);
  if (withDetay?.detay) {
    try {
      const parsed = JSON.parse(withDetay.detay) as { items?: BankInstallmentPayload[] };
      if (Array.isArray(parsed.items) && parsed.items.length) {
        return {
          posId: pos.id,
          bankId: pos.bankId,
          bankName: pos.bankName,
          agreementCode: code,
          items: normalizeBankSegments(parsed.items),
        };
      }
    } catch {
      /* kolonlardan kur */
    }
  }

  const items: BankInstallmentPayload[] = dbRows.map((r) => {
    const base = emptySegment(true);
    return {
      n: r.taksit,
      all: {
        ...base,
        minLimit: fmtMoney(r.altLimit),
        customerCommission: fmtPct(r.komisyonTum),
        active: r.komisyonTum != null,
      },
      bireysel: {
        ...base,
        minLimit: fmtMoney(r.altLimit),
        customerCommission: fmtPct(r.komisyonBireysel),
        active: r.komisyonBireysel != null,
      },
      ticari: {
        ...base,
        minLimit: fmtMoney(r.altLimit),
        customerCommission: fmtPct(r.komisyonTicari),
        active: r.komisyonTicari != null,
      },
    };
  });

  return {
    posId: pos.id,
    bankId: pos.bankId,
    bankName: pos.bankName,
    agreementCode: code,
    items: items.length ? normalizeBankSegments(items) : defaultBankItems(),
  };
}

/** Banka kart anlaşması — PUT */
export async function savePosBankAgreement(
  posId: number,
  items: BankInstallmentPayload[],
): Promise<{ agreementCode: string; items: BankInstallmentPayload[] }> {
  const pos = await getVirtualPos(posId);
  if (!pos) throw new PosAgreementError('Sanal POS bulunamadı');
  if (!Array.isArray(items) || !items.length) {
    throw new PosAgreementError('En az bir taksit satırı gerekli');
  }

  const normalizedItems = normalizeBankSegments(items);
  const code = bankAgreementCode(posId);
  const bankIdNum = Number(pos.bankId);
  const date = new Date().toISOString().slice(0, 10);
  const name = `${pos.bankName} Banka Kart Anlaşması`.slice(0, 255);
  const detay = JSON.stringify({ items: normalizedItems });

  const flat = normalizedItems.map((it, idx) => {
    const n = Math.min(36, Math.max(1, Math.round(Number(it.n) || 1)));
    const minLimit =
      (it.all.active ? parseTrNumber(it.all.minLimit) : null) ??
      (it.bireysel.active ? parseTrNumber(it.bireysel.minLimit) : null) ??
      (it.ticari.active ? parseTrNumber(it.ticari.minLimit) : null);

    const logo = (pos.bankLogoUrl || '').trim();
    return {
      adi: name,
      bankaId: Number.isFinite(bankIdNum) ? bankIdNum : null,
      taksit: n,
      altLimit: minLimit,
      komisyonTum: it.all?.active ? parseTrNumber(it.all.customerCommission) : null,
      komisyonBireysel: it.bireysel?.active
        ? parseTrNumber(it.bireysel.customerCommission)
        : null,
      komisyonTicari: it.ticari?.active ? parseTrNumber(it.ticari.customerCommission) : null,
      grup: date,
      blokAdi: pos.bankName.slice(0, 255),
      blokLogo: logo ? logo.slice(0, 255) : null,
      // JSON yalnızca ilk satırda (tekrar / paket boyutu)
      detay: idx === 0 ? detay : null,
      anlasmaKodu: code,
      remove: false,
    };
  });

  await replaceAgreementRows(code, flat);
  return { agreementCode: code, items: normalizedItems };
}

/** Müşteri kart anlaşması — GET */
export async function getPosCustomerAgreement(posId: number): Promise<{
  posId: string;
  bankId: string;
  bankName: string;
  agreementCode: string;
  blocks: CustomerBlockPayload[];
}> {
  const pos = await getVirtualPos(posId);
  if (!pos) throw new PosAgreementError('Sanal POS bulunamadı');

  const code = customerAgreementCode(posId);
  const dbRows = await prisma.kartAnlasma.findMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    orderBy: [{ id: 'asc' }, { taksit: 'asc' }],
  });

  if (!dbRows.length) {
    return {
      posId: pos.id,
      bankId: pos.bankId,
      bankName: pos.bankName,
      agreementCode: code,
      blocks: defaultCustomerBlocks(),
    };
  }

  const byBlock = new Map<string, typeof dbRows>();
  for (const r of dbRows) {
    const key = (r.blokAdi || 'Kart').trim() || 'Kart';
    const list = byBlock.get(key) || [];
    list.push(r);
    byBlock.set(key, list);
  }

  const blocks: CustomerBlockPayload[] = [];
  let i = 0;
  for (const [name, list] of byBlock) {
    list.sort((a, b) => a.taksit - b.taksit);
    blocks.push({
      id: `blk-${i + 1}`,
      name,
      logoFileName: list[0]?.blokLogo || undefined,
      rows: list.map((r) => ({
        n: r.taksit,
        minLimit: fmtMoney(r.altLimit),
        allRate: fmtPct(r.komisyonTum),
        bireyselRate: fmtPct(r.komisyonBireysel),
        ticariRate: fmtPct(r.komisyonTicari),
      })),
    });
    i += 1;
  }

  return {
    posId: pos.id,
    bankId: pos.bankId,
    bankName: pos.bankName,
    agreementCode: code,
    blocks: blocks.length ? blocks : defaultCustomerBlocks(),
  };
}

/** Müşteri kart anlaşması — PUT */
export async function savePosCustomerAgreement(
  posId: number,
  blocks: CustomerBlockPayload[],
): Promise<{ agreementCode: string; blocks: CustomerBlockPayload[] }> {
  const pos = await getVirtualPos(posId);
  if (!pos) throw new PosAgreementError('Sanal POS bulunamadı');
  if (!Array.isArray(blocks) || !blocks.length) {
    throw new PosAgreementError('En az bir kart bloğu gerekli');
  }

  const code = customerAgreementCode(posId);
  const bankIdNum = Number(pos.bankId);
  const date = new Date().toISOString().slice(0, 10);
  const name = `${pos.bankName} Müşteri Kart Anlaşması`.slice(0, 255);

  const flat: {
    adi: string;
    bankaId: number | null;
    taksit: number;
    altLimit: number | null;
    komisyonTum: number | null;
    komisyonBireysel: number | null;
    komisyonTicari: number | null;
    grup: string;
    blokAdi: string;
    blokLogo: string | null;
    detay: string | null;
    anlasmaKodu: string;
    remove: boolean;
  }[] = [];

  for (const block of blocks) {
    const blockName = (block.name || '').trim() || 'Kart';
    const rows = block.rows?.length
      ? block.rows
      : [{ n: 1, minLimit: '0', allRate: '', bireyselRate: '0', ticariRate: '0' }];

    for (const row of rows) {
      const n = Math.min(36, Math.max(1, Math.round(Number(row.n) || 1)));
      flat.push({
        adi: name,
        // Gerçek banka id — ödeme banka filtresi için
        bankaId: Number.isFinite(bankIdNum) ? bankIdNum : null,
        taksit: n,
        altLimit: parseTrNumber(row.minLimit),
        komisyonTum: parseTrNumber(row.allRate),
        // Boş bireysel/ticari → 0; null kalırsa ödeme ekranında satır hiç görünmez
        komisyonBireysel: parseTrNumber(row.bireyselRate) ?? 0,
        komisyonTicari: parseTrNumber(row.ticariRate) ?? 0,
        grup: date,
        blokAdi: blockName.slice(0, 255),
        blokLogo: (block.logoFileName || pos.bankLogoUrl || '').slice(0, 255) || null,
        detay: null,
        anlasmaKodu: code,
        remove: false,
      });
    }
  }

  await replaceAgreementRows(code, flat);
  return { agreementCode: code, blocks };
}

/** Ödeme için: müşteri kodu yoksa POS banka/müşteri anlaşmasına düş */
export async function resolvePosFallbackAgreementCode(
  bankId: number | null | undefined,
): Promise<string | null> {
  if (bankId == null || !Number.isFinite(bankId)) return null;

  const pos = await prisma.sanalPosTanim.findFirst({
    where: {
      bankaId: bankId,
      ...notRemoved(),
    },
    // Taksit karşılaştırması pasif POS anlaşmalarını da gösterebilir.
    // Çalışan/varsayılan POS varsa onu tercih et, yoksa bankanın kayıtlı POS anlaşmasını kullan.
    orderBy: [{ aktif: 'desc' }, { varsayilan: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!pos) return null;

  const musteriCode = customerAgreementCode(pos.id);
  const musteriHit = await prisma.kartAnlasma.findFirst({
    where: { anlasmaKodu: musteriCode, ...notRemoved() },
    select: { id: true },
  });
  if (musteriHit) return musteriCode;

  const bankCode = bankAgreementCode(pos.id);
  const bankHit = await prisma.kartAnlasma.findFirst({
    where: { anlasmaKodu: bankCode, ...notRemoved() },
    select: { id: true },
  });
  if (bankHit) return bankCode;

  return null;
}

/** Taksit karşılaştırmasında, banka ID'sine bağlı POS kayıtlarından kayıtlı oran anlaşmasını bul. */
export async function resolvePosBankAgreementCode(
  bankId: number | null | undefined,
): Promise<string | null> {
  if (bankId == null || !Number.isFinite(bankId)) return null;
  const positions = await prisma.sanalPosTanim.findMany({
    where: { bankaId: bankId, ...notRemoved() },
    orderBy: [{ aktif: 'desc' }, { varsayilan: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const pos of positions) {
    const code = bankAgreementCode(pos.id);
    const rows = await prisma.kartAnlasma.findMany({
      where: { anlasmaKodu: code, ...notRemoved() },
      select: { detay: true, komisyonTum: true, komisyonBireysel: true, komisyonTicari: true },
    });
    if (rows.some((row) => {
      if (row.komisyonTum != null || row.komisyonBireysel != null || row.komisyonTicari != null) return true;
      if (!row.detay) return false;
      try {
        const detail = JSON.parse(row.detay) as { items?: Array<{ all?: { active?: boolean }; bireysel?: { active?: boolean }; ticari?: { active?: boolean } }> };
        return detail.items?.some((item) => item.all?.active || item.bireysel?.active || item.ticari?.active) ?? false;
      } catch {
        return false;
      }
    })) return code;
  }
  return null;
}
