import { prisma } from '../lib/prisma.js';
import { normalizeBankText } from '../gateways/binCatalog.js';

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

export async function listBins(): Promise<PublicBin[]> {
  try {
    const rows = await prisma.binKayit.findMany({
      where: notRemoved(),
      orderBy: [{ bankaAdi: 'asc' }, { bin: 'asc' }],
    });
    return rows.map(mapRow);
  } catch (err) {
    console.error('[bins] prisma listBins:', err);
    // Ham SQL yedek — kolon uyumsuzluğunda paneli ayakta tut
    const rows = await prisma.$queryRawUnsafe<
      {
        id: number;
        banka_id: number | null;
        banka_adi: string | null;
        bin: string;
        tip: string | null;
        marka: string | null;
        tur: string | null;
      }[]
    >(`
      SELECT id, banka_id, banka_adi, bin, tip, marka, tur
      FROM \`bin_kayitlari\`
      WHERE \`remove\` IS NULL OR \`remove\` = 0
      ORDER BY banka_adi ASC, bin ASC
    `);
    return rows.map((r) =>
      mapRow({
        id: r.id,
        bankaId: r.banka_id,
        bankaAdi: r.banka_adi || '',
        bin: String(r.bin || ''),
        tip: r.tip,
        marka: r.marka,
        tur: r.tur,
      }),
    );
  }
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
  const code = input.bin.replace(/\D/g, '').slice(0, 8);
  if (code.length < 4 || code.length > 8) throw new BinsError('BIN 4–8 rakam olmalı');

  const clash = await prisma.binKayit.findFirst({
    where: { bin: code, ...notRemoved() },
  });
  if (clash) throw new BinsError(`Bu BIN zaten kayıtlı: ${code}`);

  const bank = await resolveBank({ bankId: input.bankId, bankName: input.bank });
  const row = await prisma.binKayit.create({
    data: {
      bankaId: bank.id,
      bankaAdi: bank.name.slice(0, 255),
      bin: code,
      tip: (input.type || '').trim().slice(0, 64) || null,
      marka: (input.brand || '').trim().slice(0, 64) || null,
      tur: (input.kind || '').trim().slice(0, 64) || null,
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateBin(id: number, input: BinUpsert): Promise<PublicBin> {
  const existing = await prisma.binKayit.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new BinsError('BIN bulunamadı');

  const code = input.bin.replace(/\D/g, '').slice(0, 8);
  if (code.length < 4 || code.length > 8) throw new BinsError('BIN 4–8 rakam olmalı');

  const clash = await prisma.binKayit.findFirst({
    where: { bin: code, ...notRemoved(), NOT: { id } },
  });
  if (clash) throw new BinsError(`Bu BIN zaten kayıtlı: ${code}`);

  const bank = await resolveBank({ bankId: input.bankId, bankName: input.bank });
  const row = await prisma.binKayit.update({
    where: { id },
    data: {
      bankaId: bank.id,
      bankaAdi: bank.name.slice(0, 255),
      bin: code,
      tip: (input.type || '').trim().slice(0, 64) || null,
      marka: (input.brand || '').trim().slice(0, 64) || null,
      tur: (input.kind || '').trim().slice(0, 64) || null,
    },
  });
  return mapRow(row);
}

export async function softDeleteBin(id: number): Promise<void> {
  const existing = await prisma.binKayit.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new BinsError('BIN bulunamadı');
  await prisma.binKayit.update({ where: { id }, data: { remove: true } });
}

/** Kart numarası → en uzun eşleşen BIN + banka */
export async function lookupBinByCard(cardDigits: string): Promise<{
  bin: string;
  bankId: number | null;
  bankName: string;
} | null> {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;

  const rows = await prisma.binKayit.findMany({
    where: notRemoved(),
    select: { bin: true, bankaId: true, bankaAdi: true },
  });

  let best: { bin: string; bankaId: number | null; bankaAdi: string } | null = null;
  for (const r of rows) {
    if (d.startsWith(r.bin) && (!best || r.bin.length > best.bin.length)) {
      best = r;
    }
  }
  if (!best) return null;
  return {
    bin: best.bin,
    bankId: best.bankaId,
    bankName: best.bankaAdi,
  };
}

/** İlk kurulumda örnek BIN’ler (tablo boşsa) */
export async function seedBinsIfEmpty(): Promise<number> {
  const count = await prisma.binKayit.count({ where: notRemoved() });
  if (count > 0) return 0;

  const samples: BinUpsert[] = [
    { bank: 'Ziraat', bin: '979241', type: 'Debit', brand: 'Troy', kind: 'Bireysel' },
    { bank: 'İş Bankası', bin: '450803', type: 'Credit', brand: 'Visa', kind: 'Bireysel' },
    { bank: 'Garanti', bin: '526955', type: 'Credit', brand: 'MasterCard', kind: 'Bireysel' },
    { bank: 'Garanti', bin: '540063', type: 'Credit', brand: 'MasterCard', kind: 'Ticari' },
    { bank: 'Yapı Kredi', bin: '454360', type: 'Credit', brand: 'Visa', kind: 'Bireysel' },
    { bank: 'Akbank', bin: '557113', type: 'Credit', brand: 'MasterCard', kind: 'Bireysel' },
    { bank: 'Akbank', bin: '5168', type: 'Credit', brand: 'MasterCard', kind: 'Bireysel' },
    { bank: 'Garanti', bin: '5406', type: 'Credit', brand: 'MasterCard', kind: 'Bireysel' },
    { bank: 'QNB', bin: '4159', type: 'Credit', brand: 'Visa', kind: 'Bireysel' },
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
