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
export type AgreementSegment = 'tumu' | 'bireysel' | 'ticari';

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
  detay?: string | null;
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
        // Boş oran null olmasın — yoksa ödeme ekranında taksit kutusu düşer
        komisyonBireysel: parseTrNumber(inst.bireyselRate) ?? 0,
        komisyonTicari: parseTrNumber(inst.ticariRate) ?? 0,
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
    return row.komisyonTum ?? 0;
  }
  return row.komisyonBireysel ?? row.komisyonTum ?? 0;
}

function bankNameMatch(row: FlatRow, needle: string): boolean {
  const n = normalizeText(needle);
  if (!n) return false;
  const blob = normalizeText(`${row.blokAdi || ''} ${row.adi || ''}`);
  if (!blob) return false;
  if (blob.includes(n) || n.includes(blob)) return true;
  // "Türkiye Garanti Bankası A.Ş." ↔ "Garanti BBVA"
  const hints = [
    'garanti', 'akbank', 'yapikredi', 'yapi kredi', 'isbank', 'is bank',
    'ziraat', 'halkbank', 'halk bank', 'vakif', 'deniz', 'qnb', 'finansbank',
    'teb', 'ing', 'hsbc', 'kuveyt', 'fiba', 'seker', 'anadolu', 'albaraka',
  ];
  for (const h of hints) {
    if (n.includes(h) && blob.includes(h)) return true;
  }
  const nTokens = n.split(/\s+/).filter((t) => t.length >= 4);
  return nTokens.some((t) => blob.includes(t));
}

/** Müşteri kodu / varsayılan paket → taksit oran satırları */
export async function resolveAgreementRates(opts: {
  agreementCode?: string | null;
  bankId?: number | null;
  bankName?: string | null;
  segment?: 'bireysel' | 'ticari' | 'tumu' | 'serbest';
  amount: number;
  allowAllFallback?: boolean;
}): Promise<{
  agreementCode: string | null;
  bankId: number | null;
  bankName: string | null;
  rows: AgreementRateRow[];
  availableSegments: AgreementSegment[];
  rowsBySegment?: Record<AgreementSegment, AgreementRateRow[]>;
}> {
  const amount = opts.amount;
  const segment = opts.segment || 'bireysel';
  if (!amount || amount <= 0) {
    return { agreementCode: null, bankId: null, bankName: null, rows: [], availableSegments: [] };
  }

  // Ortak Sanal POS: kaynak banka → yönlenen bankanın anlaşma oranları
  const { resolveRatesTargetBank, resolveDefaultPosRatesBank } = await import(
    './commonVirtualPosService.js'
  );
  const target = await resolveRatesTargetBank({
    bankId: opts.bankId ?? null,
    bankName: opts.bankName ?? null,
  });
  let rateBankId = target.bankId;
  let rateBankName = target.bankName;

  let code = (opts.agreementCode || '').trim() || null;
  if (!code) {
    const { resolvePosFallbackAgreementCode } = await import('./posAgreementsService.js');
    code = await resolvePosFallbackAgreementCode(rateBankId ?? null);
  }
  if (!code) {
    return { agreementCode: null, bankId: null, bankName: null, rows: [], availableSegments: [] };
  }

  let all = await prisma.kartAnlasma.findMany({
    where: { anlasmaKodu: code, ...notRemoved() },
    orderBy: [{ taksit: 'asc' }],
  });
  if (!all.length) {
    return { agreementCode: code, bankId: null, bankName: null, rows: [], availableSegments: [] };
  }

  function matchBankRows(
    bankId: number | null,
    bankName: string | null,
  ): typeof all | null {
    if (bankId != null && Number.isFinite(bankId)) {
      const byId = all.filter((r) => r.bankaId === bankId);
      if (byId.length) return byId;
      if (bankName) {
        const byName = all.filter((r) => bankNameMatch(r, bankName));
        return byName.length ? byName : null;
      }
      return null;
    }
    if (bankName) {
      const byName = all.filter((r) => bankNameMatch(r, bankName));
      return byName.length ? byName : null;
    }
    return null;
  }

  let matched: typeof all | null = null;

  if (rateBankId != null || rateBankName) {
    matched = matchBankRows(rateBankId, rateBankName);
    // Anlaşmada bu banka yok → varsayılan Sanal POS bankasının oranları (aynı kod içinde)
    if (!matched) {
      const def = await resolveDefaultPosRatesBank();
      if (def && def.bankId !== rateBankId) {
        const defRows = matchBankRows(def.bankId, def.bankName);
        if (defRows?.length) {
          rateBankId = def.bankId;
          rateBankName = def.bankName;
          matched = defRows;
        }
      }
    }
    // Müşteri paketinde banka yok veya yalnızca tek çekim → POS müşteri/banka anlaşması
    // (Ödeme Al / Hızlı Ödeme, public /pay ile aynı taksit planını görsün)
    const sparseMatch =
      matched != null &&
      new Set(matched.map((r) => r.taksit)).size <= 1;
    if (!matched || sparseMatch) {
      const { resolvePosFallbackAgreementCode } = await import('./posAgreementsService.js');
      const posCode = await resolvePosFallbackAgreementCode(rateBankId ?? null);
      if (posCode && posCode !== code) {
        const posRows = await prisma.kartAnlasma.findMany({
          where: { anlasmaKodu: posCode, ...notRemoved() },
          orderBy: [{ taksit: 'asc' }],
        });
        if (posRows.length) {
          const prevAll = all;
          const prevMatched = matched;
          all = posRows;
          const posMatched = matchBankRows(rateBankId, rateBankName);
          const posRicher =
            posMatched != null &&
            new Set(posMatched.map((r) => r.taksit)).size >
              (prevMatched ? new Set(prevMatched.map((r) => r.taksit)).size : 0);
          if (posMatched && (!matched || posRicher)) {
            code = posCode;
            matched = posMatched;
          } else {
            all = prevAll;
          }
        }
      }
    }
    if (!matched) {
      return {
        agreementCode: code,
        bankId: rateBankId,
        bankName: rateBankName,
        rows: [],
        availableSegments: [],
      };
    }
  } else {
    // Banka belirtilmemiş → ilk blok / banka
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

  // POS anlaşmasının detay JSON'u boyut nedeniyle yalnızca ilk DB satırına yazılır.
  // Ek taksit bilgisi bu nedenle bütün taksit numaraları için aynı JSON'dan okunmalı.
  const agreementDetailRow = matched.find((r) => r.detay);
  type AgreementSegmentDetail = {
    active?: boolean;
    minLimit?: string;
    bankCommission?: string;
    customerCommission?: string;
    extraInstallment?: string;
  };
  let agreementItems: Array<{
    n?: number;
    all?: AgreementSegmentDetail;
    bireysel?: AgreementSegmentDetail;
    ticari?: AgreementSegmentDetail;
  }> = [];
  if (agreementDetailRow?.detay) {
    try {
      const detail = JSON.parse(agreementDetailRow.detay) as { items?: typeof agreementItems };
      agreementItems = detail.items ?? [];
    } catch {
      agreementItems = [];
    }
  }

  // Ek taksit yalnızca Sanal POS banka kart anlaşması (pos-bank-*) detayında tutulur;
  // müşteri kart anlaşması düz satırlardan geldiğinde plusN buradan tamamlanır.
  const { resolvePosBankAgreementCode } = await import('./posAgreementsService.js');
  let posBankItems: typeof agreementItems = [];
  const posBankCode = await resolvePosBankAgreementCode(rateBankId);
  if (posBankCode) {
    if (posBankCode === code && agreementItems.length) {
      posBankItems = agreementItems;
    } else {
      const posRow = await prisma.kartAnlasma.findFirst({
        where: { anlasmaKodu: posBankCode, ...notRemoved(), NOT: { detay: null } },
        select: { detay: true },
      });
      if (posRow?.detay) {
        try {
          const parsed = JSON.parse(posRow.detay) as { items?: typeof agreementItems };
          posBankItems = parsed.items ?? [];
        } catch {
          posBankItems = [];
        }
      }
    }
  }

  const segmentKeys: AgreementSegment[] = ['tumu', 'bireysel', 'ticari'];
  const detailFor = (row: FlatRow) => agreementItems.find((entry) => entry.n === row.taksit);
  const posDetailFor = (taksit: number) => posBankItems.find((entry) => entry.n === taksit);
  const configuredFor = (row: FlatRow, key: AgreementSegment) => {
    const detail = detailFor(row);
    const columnRate = key === 'tumu' ? row.komisyonTum
      : key === 'bireysel' ? row.komisyonBireysel : row.komisyonTicari;
    // Tümü sekmesi yalnızca gerçek tumu/all tanımlıysa; bireysel dolu diye şişirme
    if (!detail) return columnRate != null;
    const item = detail[key === 'tumu' ? 'all' : key];
    if (!item?.active || (key !== 'tumu' && detail.all?.active)) return false;
    return columnRate != null || parseTrNumber(item.bankCommission) != null;
  };

  /** Ek taksit: tercih edilen aktif segment; '0' default diğer aktif >0 değeri ezmesin */
  const pickExtraInstallment = (
    selected: AgreementSegmentDetail | undefined,
    posItem: (typeof agreementItems)[number] | undefined,
    preferKey: 'all' | 'bireysel' | 'ticari',
  ): number => {
    const fromSelected = parseTrNumber(selected?.extraInstallment);
    if (fromSelected != null && fromSelected > 0) return fromSelected;

    const readSeg = (key: 'all' | 'bireysel' | 'ticari', requireActive: boolean) => {
      const seg = posItem?.[key];
      if (!seg) return null;
      if (requireActive && seg.active === false) return null;
      if (requireActive && key !== preferKey && seg.active !== true) return null;
      return parseTrNumber(seg.extraInstallment);
    };

    const preferred = readSeg(preferKey, false);
    if (preferred != null && preferred > 0) return preferred;

    for (const key of ['bireysel', 'all', 'ticari'] as const) {
      if (key === preferKey) continue;
      const v = readSeg(key, true);
      if (v != null && v > 0) return v;
    }

    return fromSelected ?? preferred ?? 0;
  };
  /** Alt limit: detay JSON → kolon; boş/0/negatif = sınır yok */
  const rowMinLimit = (
    row: FlatRow,
    seg: AgreementSegmentDetail | undefined,
  ): number => {
    const raw = parseTrNumber(seg?.minLimit) ?? row.altLimit ?? 0;
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  };

  const availableSegments = segmentKeys.filter((key) => matched.some((row) => {
    if (!configuredFor(row, key)) return false;
    const seg = detailFor(row)?.[key === 'tumu' ? 'all' : key];
    const minLimit = rowMinLimit(row, seg);
    return minLimit <= amount;
  }));

  const calculateRows = (requestedSegment: 'bireysel' | 'ticari' | 'tumu' | 'serbest'): AgreementRateRow[] => [...byN.values()]
    .sort((a, b) => a.taksit - b.taksit)
    .filter((r) => {
      const key = requestedSegment === 'serbest' ? 'tumu' : requestedSegment;
      const detail = detailFor(r);
      const effectiveKey = opts.allowAllFallback !== false && key !== 'tumu' && detail?.all?.active && !configuredFor(r, key) ? 'tumu' : key;
      if (!configuredFor(r, effectiveKey)) return false;
      const selected = detail?.[effectiveKey === 'tumu' ? 'all' : effectiveKey];
      return rowMinLimit(r, selected) <= amount;
    })
    .map((r) => {
      const key = requestedSegment === 'serbest' ? 'tumu' : requestedSegment;
      const item = detailFor(r);
      const effectiveKey = opts.allowAllFallback !== false && key !== 'tumu' && item?.all?.active && !configuredFor(r, key) ? 'tumu' : key;
      const selected = item?.[effectiveKey === 'tumu' ? 'all' : effectiveKey];
      const commissionPct = Math.max(0, +((parseTrNumber(selected?.customerCommission) ?? pickRate(r, effectiveKey)) || 0).toFixed(4));
      const totalAmount = amount * (1 + commissionPct / 100);
      const n = r.taksit;
      const segKey = effectiveKey === 'tumu' ? 'all' : effectiveKey;
      const extraRaw = pickExtraInstallment(selected, posDetailFor(n), segKey);
      const plusN = configuredFor(r, effectiveKey)
        ? Math.max(0, Math.min(36 - n, Math.round(extraRaw)))
        : 0;
      const totalInstallments = n + plusN;
      const minLimit = rowMinLimit(r, selected);
      return {
        n,
        plusN,
        commissionPct,
        installmentAmount: totalAmount / totalInstallments,
        totalAmount,
        minLimit,
      };
    });
  const rowsBySegment = opts.allowAllFallback === false ? {
    tumu: calculateRows('tumu'),
    bireysel: calculateRows('bireysel'),
    ticari: calculateRows('ticari'),
  } : undefined;
  const rows = rowsBySegment && segment !== 'serbest'
    ? rowsBySegment[segment]
    : calculateRows(segment);

  const head = matched[0]!;
  return {
    agreementCode: code,
    bankId: head.bankaId,
    bankName: head.blokAdi,
    rows,
    availableSegments,
    rowsBySegment,
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

