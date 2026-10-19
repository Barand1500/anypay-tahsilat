import { prisma } from '../lib/prisma.js';
import { getContactSettings } from './settingsService.js';

export class ContractsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractsError';
  }
}

/** Footer / public sözleşme — #unvan# vb. (frontend getCompanyContractVars ile aynı) */
function resolveContractVars(text: string, vars: Record<string, string>): string {
  const byLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    byLower[k.toLocaleLowerCase('tr')] = v;
  }
  return text.replace(/#([a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+)#/g, (_, key: string) => {
    const v = vars[key] ?? byLower[key.toLocaleLowerCase('tr')];
    return v != null && String(v).trim() !== '' ? String(v) : `#${key}#`;
  });
}

export function companyVarsFromContact(
  contact: Awaited<ReturnType<typeof getContactSettings>>,
): Record<string, string> {
  return {
    webSitesi: contact.website || contact.fax || '',
    unvan: contact.title || '',
    vergiTCNo: contact.taxNo || contact.identityNo || '',
    vergiDairesi: contact.taxOffice || '',
    adres: contact.address || '',
    eposta: contact.email || '',
    telefon: contact.phone || '',
    gsm: contact.gsm || '',
    fax: contact.fax || '',
  };
}

/** Public sözleşme — ham metin + firma değişkenleri (panel ile aynı çözüm) */
export async function getPublicContractPayload(link: string): Promise<{
  id: string;
  name: string;
  body: string;
  link: string;
  order: number;
  companyVars: Record<string, string>;
} | null> {
  const contract = await getContractByLink(link);
  if (!contract) return null;
  const contact = await getContactSettings();
  const companyVars = companyVarsFromContact(contact);
  const raw = (contract.body || '').trim();
  return {
    ...contract,
    body: raw ? resolveContractVars(raw, companyVars) : '',
    companyVars,
  };
}

const LINK_IDS = new Set([
  'none',
  'kvkk',
  'hizmet',
  'guvenlik',
  'tahsilat',
  'iptal-iade',
  'iletisim',
  'uyelik',
]);

export type PublicContract = {
  id: string;
  name: string;
  body: string;
  link: string;
  order: number;
};

type DbRow = {
  id: number;
  baslik: string;
  metin: string | null;
  kvkk: boolean;
  tahsilat: boolean;
  iade: boolean;
  hizmet: boolean;
  guvenlik: boolean;
  iletisim: boolean | null;
  uyelik: boolean | null;
  sira: number | null;
  remove: boolean | null;
  seourl: string | null;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function normalizeLink(raw: string | undefined): string {
  const v = (raw || 'none').trim();
  return LINK_IDS.has(v) ? v : 'none';
}

/** Flag kolonlarından bağlantı tipi */
function linkFromFlags(r: DbRow): string {
  if (r.kvkk) return 'kvkk';
  if (r.hizmet) return 'hizmet';
  if (r.guvenlik) return 'guvenlik';
  if (r.tahsilat) return 'tahsilat';
  if (r.iade) return 'iptal-iade';
  if (r.iletisim) return 'iletisim';
  if (r.uyelik) return 'uyelik';
  return 'none';
}

/** Bağlantı tipi → dump flag’leri (hepsi NOT NULL / default 0) */
function flagsFromLink(link: string): {
  kvkk: boolean;
  hizmet: boolean;
  guvenlik: boolean;
  tahsilat: boolean;
  iade: boolean;
  iletisim: boolean;
  uyelik: boolean;
} {
  return {
    kvkk: link === 'kvkk',
    hizmet: link === 'hizmet',
    guvenlik: link === 'guvenlik',
    tahsilat: link === 'tahsilat',
    iade: link === 'iptal-iade',
    iletisim: link === 'iletisim',
    uyelik: link === 'uyelik',
  };
}

function slugify(name: string): string {
  return name
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200) || 'sozlesme';
}

function mapRow(r: DbRow): PublicContract {
  return {
    id: String(r.id),
    name: r.baslik,
    body: r.metin || '',
    link: linkFromFlags(r),
    order: r.sira ?? 0,
  };
}

export async function listContracts(): Promise<PublicContract[]> {
  const rows = await prisma.sozlesme.findMany({
    where: notRemoved(),
    orderBy: [{ sira: 'asc' }, { id: 'asc' }],
  });
  return rows.map((r) => mapRow(r as DbRow));
}

export async function getContractByLink(link: string): Promise<PublicContract | null> {
  const normalized = normalizeLink(link);
  if (normalized === 'none') return null;

  const flags = flagsFromLink(normalized);
  const whereFlag =
    normalized === 'kvkk'
      ? { kvkk: true }
      : normalized === 'hizmet'
        ? { hizmet: true }
        : normalized === 'guvenlik'
          ? { guvenlik: true }
          : normalized === 'tahsilat'
            ? { tahsilat: true }
            : normalized === 'iptal-iade'
              ? { iade: true }
              : normalized === 'iletisim'
                ? { iletisim: true }
                : { uyelik: true };

  const row = await prisma.sozlesme.findFirst({
    where: { ...whereFlag, ...notRemoved() },
    orderBy: [{ sira: 'asc' }, { id: 'asc' }],
  });
  // flags unused except structure check
  void flags;
  return row ? mapRow(row as DbRow) : null;
}

/** @deprecated — getPublicContractPayload kullan */
export async function getResolvedContractByLink(link: string): Promise<PublicContract | null> {
  const payload = await getPublicContractPayload(link);
  if (!payload) return null;
  const { companyVars: _v, ...contract } = payload;
  void _v;
  return contract;
}

export async function createContract(input: {
  name: string;
  body: string;
  link?: string;
}): Promise<PublicContract> {
  const name = input.name.trim();
  if (!name) throw new ContractsError('Ad gerekli');

  const link = normalizeLink(input.link);
  const flags = flagsFromLink(link);

  const max = await prisma.sozlesme.aggregate({
    where: notRemoved(),
    _max: { sira: true },
  });

  const row = await prisma.sozlesme.create({
    data: {
      baslik: name.slice(0, 255),
      metin: input.body ?? '',
      ...flags,
      sira: (max._max.sira ?? -1) + 1,
      seourl: slugify(name),
      remove: false,
    },
  });
  return mapRow(row as DbRow);
}

export async function updateContract(
  id: number,
  input: { name?: string; body?: string; link?: string },
): Promise<PublicContract> {
  const existing = await prisma.sozlesme.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new ContractsError('Sözleşme bulunamadı');

  const data: Record<string, unknown> = {};
  if (input.name != null) {
    const n = input.name.trim().slice(0, 255) || existing.baslik;
    data.baslik = n;
    data.seourl = slugify(n);
  }
  if (input.body != null) data.metin = input.body;
  if (input.link != null) {
    Object.assign(data, flagsFromLink(normalizeLink(input.link)));
  }

  const row = await prisma.sozlesme.update({
    where: { id },
    data,
  });
  return mapRow(row as DbRow);
}

export async function softDeleteContract(id: number): Promise<void> {
  const existing = await prisma.sozlesme.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new ContractsError('Sözleşme bulunamadı');
  await prisma.sozlesme.update({ where: { id }, data: { remove: true } });
}

export async function reorderContracts(ids: number[]): Promise<PublicContract[]> {
  const existing = await prisma.sozlesme.findMany({
    where: { id: { in: ids }, ...notRemoved() },
    select: { id: true },
  });
  const ok = new Set(existing.map((r) => r.id));
  const ordered = ids.filter((id) => ok.has(id));
  await prisma.$transaction(
    ordered.map((id, sira) => prisma.sozlesme.update({ where: { id }, data: { sira } })),
  );
  return listContracts();
}

/** localStorage göçü — boş veya yalnızca boş gövdeli kayıtları değiştirir */
export async function importContracts(
  items: { name: string; body: string; link?: string; order?: number }[],
): Promise<PublicContract[]> {
  if (!items.length) return listContracts();

  const existing = await prisma.sozlesme.findMany({
    where: notRemoved(),
    select: { id: true, metin: true },
  });
  const hasContent = existing.some((r) => (r.metin || '').trim().length > 0);
  if (hasContent) {
    return listContracts();
  }

  if (existing.length) {
    await prisma.sozlesme.updateMany({
      where: { id: { in: existing.map((r) => r.id) } },
      data: { remove: true },
    });
  }

  await prisma.sozlesme.createMany({
    data: items.map((it, i) => {
      const name = (it.name || 'Sözleşme').trim().slice(0, 255) || 'Sözleşme';
      const link = normalizeLink(it.link);
      return {
        baslik: name,
        metin: it.body ?? '',
        ...flagsFromLink(link),
        sira: typeof it.order === 'number' ? it.order : i,
        seourl: slugify(name),
        remove: false,
      };
    }),
  });
  return listContracts();
}
