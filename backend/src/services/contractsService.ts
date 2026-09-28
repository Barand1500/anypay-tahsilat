import { prisma } from '../lib/prisma.js';

export class ContractsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractsError';
  }
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

const DEFAULT_SEED: { name: string; link: string }[] = [
  { name: 'KVKK ve Aydınlatma Metni', link: 'kvkk' },
  { name: 'Hizmet Sözleşmesi', link: 'hizmet' },
  { name: 'Güvenlik Bilgilendirmesi', link: 'guvenlik' },
  { name: 'Tahsilat Sözleşmesi', link: 'tahsilat' },
  { name: 'İptal ve İade Politikası', link: 'iptal-iade' },
  { name: 'İletişim Bilgileri', link: 'iletisim' },
  { name: 'Üyelik Sözleşmesi', link: 'uyelik' },
];

export type PublicContract = {
  id: string;
  name: string;
  body: string;
  link: string;
  order: number;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function mapRow(r: {
  id: number;
  adi: string;
  icerik: string;
  baglanti: string;
  sira: number;
}): PublicContract {
  return {
    id: String(r.id),
    name: r.adi,
    body: r.icerik || '',
    link: LINK_IDS.has(r.baglanti) ? r.baglanti : 'none',
    order: r.sira,
  };
}

function normalizeLink(raw: string | undefined): string {
  const v = (raw || 'none').trim();
  return LINK_IDS.has(v) ? v : 'none';
}

async function seedIfEmpty(): Promise<void> {
  const count = await prisma.sozlesme.count({ where: notRemoved() });
  if (count > 0) return;
  await prisma.sozlesme.createMany({
    data: DEFAULT_SEED.map((s, i) => ({
      adi: s.name,
      icerik: '',
      baglanti: s.link,
      sira: i,
      remove: false,
    })),
  });
}

export async function listContracts(): Promise<PublicContract[]> {
  await seedIfEmpty();
  const rows = await prisma.sozlesme.findMany({
    where: notRemoved(),
    orderBy: [{ sira: 'asc' }, { id: 'asc' }],
  });
  return rows.map(mapRow);
}

export async function getContractByLink(link: string): Promise<PublicContract | null> {
  await seedIfEmpty();
  const row = await prisma.sozlesme.findFirst({
    where: { baglanti: link, ...notRemoved() },
    orderBy: [{ sira: 'asc' }, { id: 'asc' }],
  });
  return row ? mapRow(row) : null;
}

export async function createContract(input: {
  name: string;
  body: string;
  link?: string;
}): Promise<PublicContract> {
  const name = input.name.trim();
  if (!name) throw new ContractsError('Ad gerekli');
  const max = await prisma.sozlesme.aggregate({
    where: notRemoved(),
    _max: { sira: true },
  });
  const row = await prisma.sozlesme.create({
    data: {
      adi: name.slice(0, 255),
      icerik: input.body ?? '',
      baglanti: normalizeLink(input.link),
      sira: (max._max.sira ?? -1) + 1,
      remove: false,
    },
  });
  return mapRow(row);
}

export async function updateContract(
  id: number,
  input: { name?: string; body?: string; link?: string },
): Promise<PublicContract> {
  const existing = await prisma.sozlesme.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new ContractsError('Sözleşme bulunamadı');

  const row = await prisma.sozlesme.update({
    where: { id },
    data: {
      adi: input.name != null ? input.name.trim().slice(0, 255) || existing.adi : undefined,
      icerik: input.body != null ? input.body : undefined,
      baglanti: input.link != null ? normalizeLink(input.link) : undefined,
    },
  });
  return mapRow(row);
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
    ordered.map((id, sira) =>
      prisma.sozlesme.update({ where: { id }, data: { sira } }),
    ),
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
    select: { id: true, icerik: true },
  });
  const hasContent = existing.some((r) => (r.icerik || '').trim().length > 0);
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
    data: items.map((it, i) => ({
      adi: (it.name || 'Sözleşme').trim().slice(0, 255) || 'Sözleşme',
      icerik: it.body ?? '',
      baglanti: normalizeLink(it.link),
      sira: typeof it.order === 'number' ? it.order : i,
      remove: false,
    })),
  });
  return listContracts();
}
