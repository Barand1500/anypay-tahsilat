import { prisma } from '../lib/prisma.js';
import { resolveBankLogoUrl } from './banksService.js';

export class CardAgreementsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardAgreementsError';
  }
}

export type PublicAgreementListItem = {
  id: string;
  name: string;
  date: string;
};

export type PublicAgreementInstallment = {
  n: number;
  minLimit: string;
  allRate: string;
  bireyselRate: string;
  ticariRate: string;
};

export type PublicAgreementBank = {
  bankId: string;
  name: string;
  logo?: string;
  installments: PublicAgreementInstallment[];
};

export type PublicAgreementDetail = {
  id: string;
  name: string;
  date: string;
  banks: PublicAgreementBank[];
};

export type AgreementRateRow = {
  n: number;
  plusN: number;
  commissionPct: number;
  installmentAmount: number;
  totalAmount: number;
  minLimit: number;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseTrNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeText(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9ğüşıöç]/gi, '');
}

function makeCode(): string {
  return `ca-${Date.now().toString(36)}`;
}

type FlatRow = {
  id: number;
  adi: string;
  bankaId: number | null;
  taksit: number;
  altLimit: number | null;
  komisyonTum: number | null;
  komisyonBireysel: number | null;
  komisyonTicari: number | null;
  grup: string | null;
  blokAdi: string | null;
  blokLogo: string | null;
  anlasmaKodu: string;
};

function groupDetail(rows: FlatRow[]): PublicAgreementDetail | null {
  if (!rows.length) return null;
  const first = rows[0]!;
  const byBank = new Map<string, FlatRow[]>();
  for (const r of rows) {
    const key = r.bankaId != null ? String(r.bankaId) : `name:${r.blokAdi || r.id}`;
    const list = byBank.get(key) || [];
    list.push(r);
    byBank.set(key, list);
  }

  const banks: PublicAgreementBank[] = [];
  for (const [key, list] of byBank) {
    list.sort((a, b) => a.taksit - b.taksit);
    const head = list[0]!;
    const bankId = head.bankaId != null ? String(head.bankaId) : key.replace(/^name:/, '');
    banks.push({
      bankId,
      name: (head.blokAdi || `Banka #${bankId}`).trim(),
      logo: resolveBankLogoUrl(head.blokLogo) || undefined,
      installments: list.map((r) => ({
        n: r.taksit,
        minLimit: fmtMoney(r.altLimit),
        allRate: fmtPct(r.komisyonTum),
        bireyselRate: fmtPct(r.komisyonBireysel),
        ticariRate: fmtPct(r.komisyonTicari),
      })),
    });
  }

  banks.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return {
    id: first.anlasmaKodu,
    name: first.adi,
    date: (first.grup || new Date().toISOString().slice(0, 10)).slice(0, 10),
    banks,
  };
}

export async function listCardAgreements(): Promise<PublicAgreementListItem[]> {
  const rows = await prisma.kartAnlasma.findMany({
    where: notRemoved(),
    orderBy: [{ anlasmaKodu: 'asc' }, { id: 'asc' }],
  });

  const map = new Map<string, PublicAgreementListItem>();
  for (const r of rows) {
    if (map.has(r.anlasmaKodu)) continue;
    map.set(r.anlasmaKodu, {
      id: r.anlasmaKodu,
      name: r.adi,
      date: (r.grup || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'tr'));
}

export async function getCardAgreement(code: string): Promise<PublicAgreementDetail> {
  const rows = await prisma.kartAnlasma.findMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    orderBy: [{ bankaId: 'asc' }, { taksit: 'asc' }],
  });
  const detail = groupDetail(rows);
  if (!detail) throw new CardAgreementsError('Kart anlaşması bulunamadı');
  return detail;
}

export type AgreementUpsertInput = {
  name: string;
  date?: string;
  banks: {
    bankId: string;
    name: string;
    logo?: string | null;
    installments: {
      n: number;
      minLimit?: string;
      allRate?: string;
      bireyselRate?: string;
      ticariRate?: string;
    }[];
  }[];
};

export async function createCardAgreement(
  input: AgreementUpsertInput,
): Promise<PublicAgreementDetail> {
  return saveAgreement(makeCode(), input, true);
}

export async function updateCardAgreement(
  code: string,
  input: AgreementUpsertInput,
): Promise<PublicAgreementDetail> {
  const existing = await prisma.kartAnlasma.findFirst({
    where: { anlasmaKodu: code, ...notRemoved() },
  });
  if (!existing) throw new CardAgreementsError('Kart anlaşması bulunamadı');
  return saveAgreement(code, input, false);
}

async function saveAgreement(
  code: string,
  input: AgreementUpsertInput,
  isNew: boolean,
): Promise<PublicAgreementDetail> {
  const name = input.name.trim();
  if (!name) throw new CardAgreementsError('Kart anlaşması adı zorunlu');
  if (!input.banks?.length) throw new CardAgreementsError('En az bir banka paneli gerekli');

  const date = (input.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const now = new Date();
  const flat: {
    adi: string;
    bankaId: number | null;
    taksit: number;
    altLimit: number | null;
    komisyonTum: number | null;
    komisyonBireysel: number | null;
    komisyonTicari: number | null;
    tarih: Date;
    grup: string;
    blokAdi: string;
    blokLogo: string | null;
    anlasmaKodu: string;
    remove: boolean;
  }[] = [];

  for (const bank of input.banks) {
    const bankIdNum = Number(bank.bankId);
    const bankaId = Number.isFinite(bankIdNum) ? bankIdNum : null;
    const bankName = (bank.name || '').trim() || `Banka #${bank.bankId}`;
    const logo = (bank.logo || '').trim() || null;
    const rows = bank.installments?.length
      ? bank.installments
      : [{ n: 1, minLimit: '0', allRate: '', bireyselRate: '0', ticariRate: '0' }];

    for (const inst of rows) {
      const n = Math.min(36, Math.max(1, Math.round(Number(inst.n) || 1)));
      flat.push({
        adi: name.slice(0, 255),
        bankaId,
        taksit: n,
        altLimit: parseTrNumber(inst.minLimit),
        komisyonTum: parseTrNumber(inst.allRate),
        komisyonBireysel: parseTrNumber(inst.bireyselRate),
        komisyonTicari: parseTrNumber(inst.ticariRate),
        tarih: now,
        grup: date,
        blokAdi: bankName.slice(0, 255),
        blokLogo: logo ? logo.slice(0, 255) : null,
        anlasmaKodu: code.slice(0, 64),
        remove: false,
      });
    }
  }

  if (!isNew) {
    await prisma.kartAnlasma.updateMany({
      where: { anlasmaKodu: code, ...notRemoved() },
      data: { remove: true },
    });
  }

  await prisma.kartAnlasma.createMany({ data: flat });
  return getCardAgreement(code);
}

export async function softDeleteCardAgreement(code: string): Promise<void> {
  const existing = await prisma.kartAnlasma.findFirst({
    where: { anlasmaKodu: code, ...notRemoved() },
  });
  if (!existing) throw new CardAgreementsError('Kart anlaşması bulunamadı');
  await prisma.kartAnlasma.updateMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    data: { remove: true },
  });
}

function pickRate(
  row: FlatRow,
  segment: 'bireysel' | 'ticari' | 'tumu' | 'serbest',
): number {
  if (segment === 'serbest') {
    return row.komisyonTum ?? row.komisyonBireysel ?? row.komisyonTicari ?? 0;
  }
  if (segment === 'ticari') {
    return row.komisyonTicari ?? row.komisyonTum ?? row.komisyonBireysel ?? 0;
  }
  if (segment === 'tumu') {
    const a = row.komisyonTum ?? row.komisyonBireysel ?? 0;
    const b = row.komisyonTicari ?? a;
    return Math.min(a, b);
  }
  return row.komisyonBireysel ?? row.komisyonTum ?? 0;
}

function bankNameMatch(row: FlatRow, needle: string): boolean {
  const n = normalizeText(needle);
  if (!n) return false;
  const blob = normalizeText(`${row.blokAdi || ''} ${row.adi || ''}`);
  return blob.includes(n) || n.includes(blob);
}

/** Müşteri kodu / varsayılan paket → taksit oran satırları */
export async function resolveAgreementRates(opts: {
  agreementCode?: string | null;
  bankId?: number | null;
  bankName?: string | null;
  segment?: 'bireysel' | 'ticari' | 'tumu' | 'serbest';
  amount: number;
}): Promise<{
  agreementCode: string | null;
  bankId: number | null;
  bankName: string | null;
  rows: AgreementRateRow[];
}> {
  const amount = opts.amount;
  const segment = opts.segment || 'bireysel';
  if (!amount || amount <= 0) {
    return { agreementCode: null, bankId: null, bankName: null, rows: [] };
  }

  let code = (opts.agreementCode || '').trim() || null;
  if (!code) {
    const { resolvePosFallbackAgreementCode } = await import('./posAgreementsService.js');
    code = await resolvePosFallbackAgreementCode(opts.bankId ?? null);
  }
  if (!code) {
    const first = await prisma.kartAnlasma.findFirst({
      where: notRemoved(),
      orderBy: [{ id: 'desc' }],
      select: { anlasmaKodu: true },
    });
    code = first?.anlasmaKodu ?? null;
  }
  if (!code) {
    return { agreementCode: null, bankId: null, bankName: null, rows: [] };
  }

  const all = await prisma.kartAnlasma.findMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    orderBy: [{ taksit: 'asc' }],
  });
  if (!all.length) {
    return { agreementCode: code, bankId: null, bankName: null, rows: [] };
  }

  let matched = all;
  if (opts.bankId != null && Number.isFinite(opts.bankId)) {
    const byId = all.filter((r) => r.bankaId === opts.bankId);
    if (byId.length) matched = byId;
  } else if (opts.bankName) {
    const byName = all.filter((r) => bankNameMatch(r, opts.bankName!));
    if (byName.length) matched = byName;
  }

  // Aynı banka paneli yoksa ilk blok / bankanın oranları
  if (matched === all) {
    const firstBank = all[0]!.bankaId;
    const firstBlok = all[0]!.blokAdi;
    matched = all.filter(
      (r) =>
        (firstBank != null && r.bankaId === firstBank) ||
        (firstBank == null && r.blokAdi === firstBlok),
    );
  }

  // Aynı taksit + birden fazla blok (müşteri anlaşması) → ilk blok
  const firstBlokName = matched[0]?.blokAdi;
  if (firstBlokName) {
    const onlyFirst = matched.filter((r) => r.blokAdi === firstBlokName);
    if (onlyFirst.length) matched = onlyFirst;
  }

  const byN = new Map<number, FlatRow>();
  for (const r of matched) {
    if (!byN.has(r.taksit)) byN.set(r.taksit, r);
  }

  const rows: AgreementRateRow[] = [...byN.values()]
    .sort((a, b) => a.taksit - b.taksit)
    .map((r) => {
      const commissionPct = Math.max(0, +(pickRate(r, segment) || 0).toFixed(4));
      const totalAmount = amount * (1 + commissionPct / 100);
      const n = r.taksit;
      return {
        n,
        plusN: 0,
        commissionPct,
        installmentAmount: totalAmount / n,
        totalAmount,
        minLimit: r.altLimit ?? 0,
      };
    });

  const head = matched[0]!;
  return {
    agreementCode: code,
    bankId: head.bankaId,
    bankName: head.blokAdi,
    rows,
  };
}

export async function getCustomerAgreementCode(
  musteriId: number | null | undefined,
): Promise<string | null> {
  if (musteriId == null || !Number.isFinite(musteriId)) return null;
  const row = await prisma.musteri.findFirst({
    where: { id: musteriId, ...notRemoved() },
    select: { kartAnlasmaKodu: true },
  });
  return (row?.kartAnlasmaKodu || '').trim() || null;
}
