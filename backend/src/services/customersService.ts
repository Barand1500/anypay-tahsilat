import { prisma } from '../lib/prisma.js';

export type CustomerKind = 'gercek' | 'tuzel' | 'yabanci';

export type PublicCustomer = {
  id: number;
  code: string;
  title: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  taxOfficeId: number | null;
  kind: CustomerKind;
  accountType: string;
  accountTypeId: number | null;
  parentId: number | null;
  address: string;
  identityNo: string;
  childCount: number;
};

export type UpsertCustomerInput = {
  code?: string;
  title: string;
  kind: CustomerKind;
  phone: string;
  email: string;
  taxNo?: string;
  taxOfficeId?: number | null;
  identityNo?: string;
  address?: string;
  accountTypeId?: number | null;
  accountTypeName?: string;
  parentId?: number | null;
};

export class CustomersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomersError';
  }
}

function digitsPhone(raw: string | null | undefined): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

function kindFromTip(tip: number | null | undefined): CustomerKind {
  if (tip === 1) return 'tuzel';
  if (tip === 2) return 'yabanci';
  return 'gercek';
}

function tipFromKind(kind: CustomerKind): number {
  if (kind === 'tuzel') return 1;
  if (kind === 'yabanci') return 2;
  return 0;
}

function notRemoved(): { OR: [{ remove: null }, { remove: false }] } {
  return { OR: [{ remove: null }, { remove: false }] };
}

async function taxOfficeName(vdId: number | null | undefined): Promise<string> {
  if (vdId == null) return '';
  const vd = await prisma.vergiDairesi.findFirst({
    where: { id: vdId },
    select: { adi: true },
  });
  return vd?.adi || '';
}

async function accountTypeName(cariTipiId: number | null | undefined): Promise<string> {
  if (cariTipiId == null) return '';
  const t = await prisma.cariTipi.findFirst({
    where: { id: cariTipiId },
    select: { adi: true },
  });
  return t?.adi || '';
}

async function resolveAccountTypeId(
  accountTypeId?: number | null,
  accountTypeName?: string,
): Promise<number | null> {
  if (accountTypeId != null && Number.isFinite(accountTypeId)) {
    const hit = await prisma.cariTipi.findFirst({
      where: { id: accountTypeId, ...notRemoved() },
      select: { id: true },
    });
    if (hit) return hit.id;
  }
  const name = (accountTypeName || '').trim();
  if (!name) return null;
  const existing = await prisma.cariTipi.findFirst({
    where: {
      adi: name,
      ...notRemoved(),
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  // Ada göre büyük/küçük harf duyarsız ara
  const all = await prisma.cariTipi.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  const hit = all.find((t) => t.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'));
  return hit?.id ?? null;
}

type MusteriRow = {
  id: number;
  firmaKodu: string | null;
  unvan: string | null;
  vn: string | null;
  telefon: string | null;
  eposta: string | null;
  vd: number | null;
  tc: string | null;
  pasaportNo: string | null;
  musteriTipi: number | null;
  cariTipiId: number | null;
  ustid: number | null;
  adres: string | null;
};

async function toPublic(
  row: MusteriRow,
  childCount: number,
  taxOffice: string,
  accountType: string,
): Promise<PublicCustomer> {
  const kind = kindFromTip(row.musteriTipi);
  const identityNo =
    kind === 'yabanci' ? (row.pasaportNo || '').trim() : (row.tc || '').trim();
  const taxNo =
    kind === 'tuzel' ? (row.vn || '').replace(/\D/g, '') : identityNo.replace(/\D/g, '') || (row.vn || '');

  return {
    id: row.id,
    code: (row.firmaKodu || String(row.id)).trim(),
    title: (row.unvan || '').trim(),
    phone: digitsPhone(row.telefon),
    email: (row.eposta || '').trim().toLowerCase(),
    taxNo,
    taxOffice,
    taxOfficeId: row.vd,
    kind,
    accountType,
    accountTypeId: row.cariTipiId,
    parentId: row.ustid,
    address: row.adres || '',
    identityNo,
    childCount,
  };
}

export async function listCustomers(query?: {
  parentId?: number | null | 'root';
  q?: string;
}): Promise<PublicCustomer[]> {
  const where: Record<string, unknown> = { ...notRemoved() };

  if (query?.parentId === 'root' || query?.parentId === null) {
    where.ustid = null;
  } else if (typeof query?.parentId === 'number') {
    where.ustid = query.parentId;
  }

  const rows = await prisma.musteri.findMany({
    where,
    orderBy: [{ unvan: 'asc' }, { id: 'asc' }],
  });

  const ids = rows.map((r) => r.id);
  const childCounts = new Map<number, number>();
  if (ids.length > 0) {
    const children = await prisma.musteri.findMany({
      where: {
        ustid: { in: ids },
        ...notRemoved(),
      },
      select: { ustid: true },
    });
    for (const c of children) {
      if (c.ustid == null) continue;
      childCounts.set(c.ustid, (childCounts.get(c.ustid) || 0) + 1);
    }
  }

  const vdIds = [...new Set(rows.map((r) => r.vd).filter((x): x is number => x != null))];
  const cariIds = [
    ...new Set(rows.map((r) => r.cariTipiId).filter((x): x is number => x != null)),
  ];
  const [vds, caris] = await Promise.all([
    vdIds.length
      ? prisma.vergiDairesi.findMany({ where: { id: { in: vdIds } }, select: { id: true, adi: true } })
      : Promise.resolve([] as { id: number; adi: string }[]),
    cariIds.length
      ? prisma.cariTipi.findMany({ where: { id: { in: cariIds } }, select: { id: true, adi: true } })
      : Promise.resolve([] as { id: number; adi: string }[]),
  ]);
  const vdMap = new Map(vds.map((v) => [v.id, v.adi]));
  const cariMap = new Map(caris.map((c) => [c.id, c.adi]));

  let list = await Promise.all(
    rows.map((r) =>
      toPublic(
        r,
        childCounts.get(r.id) || 0,
        r.vd != null ? vdMap.get(r.vd) || '' : '',
        r.cariTipiId != null ? cariMap.get(r.cariTipiId) || '' : '',
      ),
    ),
  );

  const q = (query?.q || '').trim().toLocaleLowerCase('tr');
  if (q) {
    const digits = q.replace(/\D/g, '');
    list = list.filter(
      (c) =>
        c.code.toLocaleLowerCase('tr').includes(q) ||
        c.title.toLocaleLowerCase('tr').includes(q) ||
        c.email.toLocaleLowerCase('tr').includes(q) ||
        (digits && c.phone.includes(digits)) ||
        (digits && c.taxNo.includes(digits)) ||
        c.taxOffice.toLocaleLowerCase('tr').includes(q),
    );
  }

  return list;
}

export async function getCustomer(id: number): Promise<PublicCustomer> {
  const row = await prisma.musteri.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!row) throw new CustomersError('Müşteri bulunamadı');
  const childCount = await prisma.musteri.count({
    where: { ustid: id, ...notRemoved() },
  });
  const [taxOffice, accountType] = await Promise.all([
    taxOfficeName(row.vd),
    accountTypeName(row.cariTipiId),
  ]);
  return toPublic(row, childCount, taxOffice, accountType);
}

export async function createCustomer(input: UpsertCustomerInput): Promise<PublicCustomer> {
  const title = input.title.trim();
  if (!title) throw new CustomersError(input.kind === 'tuzel' ? 'Ünvan gerekli' : 'Ad soyad gerekli');

  const phone = digitsPhone(input.phone);
  if (phone.length < 10) throw new CustomersError('Telefon gerekli');

  const email = (input.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CustomersError('Geçerli e-posta girin');
  }

  let parentId: number | null = input.parentId ?? null;
  if (parentId != null) {
    const parent = await prisma.musteri.findFirst({
      where: { id: parentId, ...notRemoved() },
      select: { id: true },
    });
    if (!parent) throw new CustomersError('Üst müşteri bulunamadı');
  }

  const cariTipiId = await resolveAccountTypeId(input.accountTypeId, input.accountTypeName);
  const kind = input.kind;
  let vn: string | null = null;
  let tc: string | null = null;
  let pasaportNo: string | null = null;
  let vd: number | null = null;

  if (kind === 'tuzel') {
    const taxNo = (input.taxNo || '').replace(/\D/g, '').slice(0, 10);
    if (taxNo && taxNo.length !== 10) throw new CustomersError('Vergi numarası 10 hane olmalı');
    vn = taxNo || null;
    if (input.taxOfficeId != null) {
      const office = await prisma.vergiDairesi.findFirst({
        where: { id: input.taxOfficeId, ...notRemoved() },
        select: { id: true },
      });
      if (!office) throw new CustomersError('Vergi dairesi bulunamadı');
      vd = office.id;
    }
  } else if (kind === 'yabanci') {
    pasaportNo = (input.identityNo || '').trim().slice(0, 20) || null;
  } else {
    const identity = (input.identityNo || '').replace(/\D/g, '').slice(0, 11);
    if (identity && identity.length !== 11) throw new CustomersError('TC kimlik no 11 hane olmalı');
    tc = identity || null;
  }

  const code = (input.code || '').trim().slice(0, 255) || null;

  const created = await prisma.musteri.create({
    data: {
      unvan: title.slice(0, 255),
      firmaKodu: code,
      telefon: phone,
      eposta: email || null,
      musteriTipi: tipFromKind(kind),
      cariTipiId,
      ustid: parentId,
      adres: (input.address || '').trim() || null,
      vn,
      tc,
      pasaportNo,
      vd,
      durum: 2,
      remove: null,
    },
  });

  return getCustomer(created.id);
}

export async function updateCustomer(
  id: number,
  input: UpsertCustomerInput,
): Promise<PublicCustomer> {
  const existing = await prisma.musteri.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new CustomersError('Müşteri bulunamadı');

  const title = input.title.trim();
  if (!title) throw new CustomersError(input.kind === 'tuzel' ? 'Ünvan gerekli' : 'Ad soyad gerekli');

  const phone = digitsPhone(input.phone);
  if (phone.length < 10) throw new CustomersError('Telefon gerekli');

  const email = (input.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CustomersError('Geçerli e-posta girin');
  }

  let parentId: number | null = input.parentId ?? null;
  if (parentId === id) throw new CustomersError('Müşteri kendisinin üstü olamaz');
  if (parentId != null) {
    const parent = await prisma.musteri.findFirst({
      where: { id: parentId, ...notRemoved() },
      select: { id: true },
    });
    if (!parent) throw new CustomersError('Üst müşteri bulunamadı');
  }

  const cariTipiId = await resolveAccountTypeId(input.accountTypeId, input.accountTypeName);
  const kind = input.kind;
  let vn: string | null = null;
  let tc: string | null = null;
  let pasaportNo: string | null = null;
  let vd: number | null = null;

  if (kind === 'tuzel') {
    const taxNo = (input.taxNo || '').replace(/\D/g, '').slice(0, 10);
    if (taxNo && taxNo.length !== 10) throw new CustomersError('Vergi numarası 10 hane olmalı');
    vn = taxNo || null;
    if (input.taxOfficeId != null) {
      const office = await prisma.vergiDairesi.findFirst({
        where: { id: input.taxOfficeId, ...notRemoved() },
        select: { id: true },
      });
      if (!office) throw new CustomersError('Vergi dairesi bulunamadı');
      vd = office.id;
    }
  } else if (kind === 'yabanci') {
    pasaportNo = (input.identityNo || '').trim().slice(0, 20) || null;
  } else {
    const identity = (input.identityNo || '').replace(/\D/g, '').slice(0, 11);
    if (identity && identity.length !== 11) throw new CustomersError('TC kimlik no 11 hane olmalı');
    tc = identity || null;
  }

  await prisma.musteri.update({
    where: { id },
    data: {
      unvan: title.slice(0, 255),
      firmaKodu: (input.code || '').trim().slice(0, 255) || null,
      telefon: phone,
      eposta: email || null,
      musteriTipi: tipFromKind(kind),
      cariTipiId,
      ustid: parentId,
      adres: (input.address || '').trim() || null,
      vn,
      tc,
      pasaportNo,
      vd,
    },
  });

  return getCustomer(id);
}

export async function softDeleteCustomer(id: number): Promise<void> {
  const row = await prisma.musteri.findFirst({
    where: { id, ...notRemoved() },
    select: { id: true },
  });
  if (!row) throw new CustomersError('Müşteri bulunamadı');

  const childCount = await prisma.musteri.count({
    where: { ustid: id, ...notRemoved() },
  });
  if (childCount > 0) {
    throw new CustomersError('Alt müşterisi olan kayıt silinemez');
  }

  await prisma.musteri.update({
    where: { id },
    data: { remove: true },
  });
}

export async function getCustomerMeta() {
  const [accountTypes, taxOffices] = await Promise.all([
    prisma.cariTipi.findMany({
      where: notRemoved(),
      orderBy: { adi: 'asc' },
      select: { id: true, adi: true },
    }),
    prisma.vergiDairesi.findMany({
      where: notRemoved(),
      orderBy: { adi: 'asc' },
      select: { id: true, adi: true },
    }),
  ]);

  return {
    accountTypes: accountTypes.map((t) => ({
      id: t.id,
      value: String(t.id),
      label: t.adi,
      name: t.adi,
    })),
    taxOffices: taxOffices.map((t) => ({
      id: t.id,
      value: String(t.id),
      label: t.adi,
    })),
  };
}
