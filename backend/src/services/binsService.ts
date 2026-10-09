import { prisma } from '../lib/prisma.js';
import { ensureBinKayitlariTable } from '../lib/ensureSchema.js';
import { hintsForKey, matchBinKey, normalizeBankText } from '../gateways/binCatalog.js';

export class BinsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinsError';
  }
}

export type PublicBin = {
  id: string;
  bankId: string;
  bank: string;
  bin: string;
  type: string;
  brand: string;
  kind: string;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function tableColumns(table: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
  );
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

async function bankNameMap(): Promise<Map<number, string>> {
  const banks = await prisma.banka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true, kisaAdi: true },
  });
  const map = new Map<number, string>();
  for (const b of banks) {
    map.set(b.id, (b.adi || b.kisaAdi || '').trim());
  }
  return map;
}

async function namedMap(table: string): Promise<Map<number, string>> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: number; adi: string }[]>(
      `SELECT id, adi FROM \`${table}\` WHERE \`remove\` IS NULL OR \`remove\` = 0`,
    );
    return new Map(rows.map((r) => [r.id, str(r.adi)]));
  } catch {
    return new Map();
  }
}

/** Satırı API şekline çevir — eski kolon / FK destekli */
function mapFlexibleRow(
  r: Record<string, unknown>,
  banks: Map<number, string>,
  tipMap: Map<number, string>,
  markaMap: Map<number, string>,
  turMap: Map<number, string>,
): PublicBin {
  const bankId =
    num(r.banka_id) ?? num(r.bankaId) ?? num(r.bank_id) ?? null;

  const bankFromText =
    str(r.banka_adi) ||
    str(r.bankaAdi) ||
    str(r.banka) ||
    str(r.banka_adi_tr) ||
    str(r.bank);

  const tipId = num(r.tip_id) ?? num(r.kart_tipi_id) ?? num(r.tipId);
  const markaId = num(r.marka_id) ?? num(r.kart_marka_id) ?? num(r.markaId);
  const turId = num(r.tur_id) ?? num(r.kart_turu_id) ?? num(r.turId);

  const tip =
    str(r.tip) ||
    str(r.kart_tipi) ||
    str(r.type) ||
    (tipId != null ? tipMap.get(tipId) || '' : '');

  const marka =
    str(r.marka) ||
    str(r.kart_marka) ||
    str(r.brand) ||
    (markaId != null ? markaMap.get(markaId) || '' : '');

  const tur =
    str(r.tur) ||
    str(r.kart_turu) ||
    str(r.kind) ||
    (turId != null ? turMap.get(turId) || '' : '');

  const bin =
    str(r.bin) ||
    str(r.bin_kodu) ||
    str(r.bin_no) ||
    str(r.kod);

  return {
    id: String(r.id ?? ''),
    bankId: bankId != null ? String(bankId) : '',
    bank: bankFromText || (bankId != null ? banks.get(bankId) || '' : ''),
    bin,
    type: tip,
    brand: marka,
    kind: tur,
  };
}

function mapRow(r: {
  id: number;
  bankaId: number | null;
  bankaAdi: string;
  bin: string;
  tip: string | null;
  marka: string | null;
  tur: string | null;
}): PublicBin {
  return {
    id: String(r.id),
    bankId: r.bankaId != null ? String(r.bankaId) : '',
    bank: r.bankaAdi,
    bin: r.bin,
    type: r.tip || '',
    brand: r.marka || '',
    kind: r.tur || '',
  };
}

async function resolveBank(opts: {
  bankId?: string | null;
  bankName?: string | null;
}): Promise<{ id: number | null; name: string }> {
  const idNum = opts.bankId != null && opts.bankId !== '' ? Number(opts.bankId) : NaN;
  if (Number.isFinite(idNum)) {
    const bank = await prisma.banka.findFirst({
      where: { id: idNum, ...notRemoved() },
      select: { id: true, adi: true, kisaAdi: true },
    });
    if (bank) {
      return { id: bank.id, name: (bank.adi || bank.kisaAdi).trim() };
    }
  }

  const name = (opts.bankName || '').trim();
  if (!name) throw new BinsError('Banka seçiniz');

  const banks = await prisma.banka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true, kisaAdi: true },
  });
  const needle = normalizeBankText(name);
  const hit = banks.find((b) => {
    const blob = normalizeBankText(`${b.adi} ${b.kisaAdi}`);
    return blob === needle || blob.includes(needle) || needle.includes(blob);
  });
  if (hit) return { id: hit.id, name: (hit.adi || hit.kisaAdi).trim() };
  return { id: null, name };
}

/** Boş banka_adi satırlarını bankalar tablosundan doldur (bir kez / istek) */
async function backfillBankNames(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE \`bin_kayitlari\` b
      INNER JOIN \`bankalar\` ba ON ba.id = b.banka_id
      SET b.banka_adi = COALESCE(NULLIF(TRIM(ba.adi), ''), ba.kisa_adi)
      WHERE (b.banka_adi IS NULL OR TRIM(b.banka_adi) = '')
        AND b.banka_id IS NOT NULL
    `);
  } catch {
    /* kolon yoksa atla */
  }
}

export async function listBins(): Promise<PublicBin[]> {
  await ensureBinKayitlariTable();
  await backfillBankNames();

  const cols = await tableColumns('bin_kayitlari');
  const banks = await bankNameMap();
  const tipMap = await namedMap('kart_tipleri');
  const markaMap = await namedMap('kart_markalari');
  const turMap = await namedMap('kart_turleri');

  const removeClause = cols.has('remove')
    ? 'WHERE (`remove` IS NULL OR `remove` = 0)'
    : '';

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`bin_kayitlari\` ${removeClause} ORDER BY id ASC`,
  );

  return rows
    .map((r) => mapFlexibleRow(r, banks, tipMap, markaMap, turMap))
    .map((r) => enrichBankFromCatalog(r, banks))
    .filter((r) => r.bin.length >= 4)
    .sort((a, b) => {
      const byBank = a.bank.localeCompare(b.bank, 'tr');
      if (byBank) return byBank;
      return a.bin.localeCompare(b.bin, 'tr');
    });
}

/** banka_adi boşsa sabit BIN katalogundan / banka listesinden tahmin et */
function enrichBankFromCatalog(row: PublicBin, banks: Map<number, string>): PublicBin {
  if (row.bank) return row;
  if (row.bankId) {
    const n = banks.get(Number(row.bankId));
    if (n) return { ...row, bank: n };
  }
  const key = matchBinKey(row.bin);
  if (!key) return row;
  const hints = hintsForKey(key);
  for (const [id, name] of banks) {
    const blob = normalizeBankText(name);
    if (hints.some((h) => blob.includes(normalizeBankText(h)))) {
      return { ...row, bank: name, bankId: row.bankId || String(id) };
    }
  }
  // Banka listesinde yoksa en azından katalog anahtarını göster
  const label =
    key === 'garanti'
      ? 'Garanti BBVA'
      : key === 'yapikredi'
        ? 'Yapı Kredi'
        : key === 'isbank'
          ? 'İş Bankası'
          : key === 'kuveytturk'
            ? 'Kuveyt Türk'
            : key.charAt(0).toUpperCase() + key.slice(1);
  return { ...row, bank: label };
}

export type BinUpsert = {
  bankId?: string | null;
  bank: string;
  bin: string;
  type?: string;
  brand?: string;
  kind?: string;
};

export async function createBin(input: BinUpsert): Promise<PublicBin> {
  await ensureBinKayitlariTable();
  const code = input.bin.replace(/\D/g, '').slice(0, 8);
  if (code.length < 4 || code.length > 8) throw new BinsError('BIN 4–8 rakam olmalı');

  const existing = await listBins();
  if (existing.some((b) => b.bin === code)) {
    throw new BinsError(`Bu BIN zaten kayıtlı: ${code}`);
  }

  const bank = await resolveBank({ bankId: input.bankId, bankName: input.bank });
  const tip = (input.type || '').trim().slice(0, 64) || null;
  const marka = (input.brand || '').trim().slice(0, 64) || null;
  const tur = (input.kind || '').trim().slice(0, 64) || null;

  try {
    const row = await prisma.binKayit.create({
      data: {
        bankaId: bank.id,
        bankaAdi: bank.name.slice(0, 255),
        bin: code,
        tip,
        marka,
        tur,
        remove: false,
      },
    });
    // banka adı boş kaldıysa map ile doldur
    const mapped = mapRow(row);
    if (!mapped.bank && bank.name) mapped.bank = bank.name;
    return mapped;
  } catch (err) {
    console.error('[bins] prisma create failed, raw insert:', err);
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`bin_kayitlari\` (\`banka_id\`, \`banka_adi\`, \`bin\`, \`tip\`, \`marka\`, \`tur\`, \`remove\`)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      bank.id,
      bank.name.slice(0, 255),
      code,
      tip,
      marka,
      tur,
    );
    const list = await listBins();
    const hit = list.find((b) => b.bin === code);
    if (!hit) throw new BinsError('BIN kaydedildi ama okunamadı');
    return hit;
  }
}

export async function updateBin(id: number, input: BinUpsert): Promise<PublicBin> {
  await ensureBinKayitlariTable();
  const code = input.bin.replace(/\D/g, '').slice(0, 8);
  if (code.length < 4 || code.length > 8) throw new BinsError('BIN 4–8 rakam olmalı');

  const all = await listBins();
  const existing = all.find((b) => b.id === String(id));
  if (!existing) throw new BinsError('BIN bulunamadı');
  if (all.some((b) => b.bin === code && b.id !== String(id))) {
    throw new BinsError(`Bu BIN zaten kayıtlı: ${code}`);
  }

  const bank = await resolveBank({ bankId: input.bankId, bankName: input.bank });
  const tip = (input.type || '').trim().slice(0, 64) || null;
  const marka = (input.brand || '').trim().slice(0, 64) || null;
  const tur = (input.kind || '').trim().slice(0, 64) || null;

  try {
    const row = await prisma.binKayit.update({
      where: { id },
      data: {
        bankaId: bank.id,
        bankaAdi: bank.name.slice(0, 255),
        bin: code,
        tip,
        marka,
        tur,
      },
    });
    return mapRow(row);
  } catch (err) {
    console.error('[bins] prisma update failed, raw:', err);
    await prisma.$executeRawUnsafe(
      `UPDATE \`bin_kayitlari\`
       SET \`banka_id\` = ?, \`banka_adi\` = ?, \`bin\` = ?, \`tip\` = ?, \`marka\` = ?, \`tur\` = ?
       WHERE \`id\` = ?`,
      bank.id,
      bank.name.slice(0, 255),
      code,
      tip,
      marka,
      tur,
      id,
    );
    const list = await listBins();
    const hit = list.find((b) => b.id === String(id));
    if (!hit) throw new BinsError('BIN güncellenemedi');
    return hit;
  }
}

export async function softDeleteBin(id: number): Promise<void> {
  await ensureBinKayitlariTable();
  const cols = await tableColumns('bin_kayitlari');
  if (cols.has('remove')) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`bin_kayitlari\` SET \`remove\` = 1 WHERE \`id\` = ?`,
      id,
    );
    return;
  }
  await prisma.$executeRawUnsafe(`DELETE FROM \`bin_kayitlari\` WHERE \`id\` = ?`, id);
}

/** BIN Tür → taksit segmenti (Bireysel Kart / Ticari Kart) */
export function segmentFromBinKind(kind: string | null | undefined): 'bireysel' | 'ticari' | null {
  const k = (kind || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
  if (!k) return null;
  if (k.includes('ticari') || k.includes('commercial') || k.includes('business')) return 'ticari';
  if (k.includes('bireysel') || k.includes('personal') || k.includes('consumer')) return 'bireysel';
  return null;
}

/** Ödeme ekranı — bin + banka + tür (auth gerekmez) */
export async function listBinCatalog(): Promise<
  { bin: string; bankId: string; bank: string; kind: string }[]
> {
  await ensureBinKayitlariTable();
  const rows = await listBins();
  return rows
    .filter((r) => r.bin.length >= 4 && r.bank)
    .map((r) => ({
      bin: r.bin,
      bankId: r.bankId,
      bank: r.bank,
      kind: r.kind || '',
    }));
}

/** Kart numarası → en uzun eşleşen BIN + banka + tür */
export async function lookupBinByCard(cardDigits: string): Promise<{
  bin: string;
  bankId: number | null;
  bankName: string;
  kind: string;
  segment: 'bireysel' | 'ticari' | null;
} | null> {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;

  const rows = await listBins();
  let best: PublicBin | null = null;
  for (const r of rows) {
    if (d.startsWith(r.bin) && (!best || r.bin.length > best.bin.length)) {
      best = r;
    }
  }
  if (!best) return null;
  return {
    bin: best.bin,
    bankId: best.bankId ? Number(best.bankId) : null,
    bankName: best.bank,
    kind: best.kind || '',
    segment: segmentFromBinKind(best.kind),
  };
}

/** İlk kurulumda örnek BIN’ler (tablo boşsa) */
export async function seedBinsIfEmpty(): Promise<number> {
  await ensureBinKayitlariTable();
  const existing = await listBins();
  if (existing.length > 0) return 0;

  const samples: BinUpsert[] = [
    { bank: 'Ziraat', bin: '979241', type: 'Banka Kartı', brand: 'TROY', kind: 'Bireysel Kart' },
    { bank: 'İş Bankası', bin: '450803', type: 'Kredi Kartı', brand: 'Visa', kind: 'Bireysel Kart' },
    { bank: 'Garanti', bin: '526955', type: 'Kredi Kartı', brand: 'MasterCard', kind: 'Bireysel Kart' },
    { bank: 'Garanti', bin: '540063', type: 'Kredi Kartı', brand: 'MasterCard', kind: 'Ticari Kart' },
    { bank: 'Yapı Kredi', bin: '454360', type: 'Kredi Kartı', brand: 'Visa', kind: 'Bireysel Kart' },
    { bank: 'Akbank', bin: '557113', type: 'Kredi Kartı', brand: 'MasterCard', kind: 'Bireysel Kart' },
    { bank: 'Akbank', bin: '5168', type: 'Kredi Kartı', brand: 'MasterCard', kind: 'Bireysel Kart' },
    { bank: 'Garanti', bin: '5406', type: 'Kredi Kartı', brand: 'MasterCard', kind: 'Bireysel Kart' },
    { bank: 'QNB', bin: '4159', type: 'Kredi Kartı', brand: 'Visa', kind: 'Bireysel Kart' },
  ];

  let n = 0;
  for (const s of samples) {
    try {
      await createBin(s);
      n += 1;
    } catch {
      /* çakışma / banka yok — atla */
    }
  }
  return n;
}
