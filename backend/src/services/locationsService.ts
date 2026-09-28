import { prisma } from '../lib/prisma.js';

export class LocationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationsError';
  }
}

export type LocationLevel = 'Ülke' | 'İl' | 'İlçe' | 'Mahalle';

export type PublicLocation = {
  id: string;
  name: string;
  level: LocationLevel;
  parentId: string | null;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function enc(kind: 'u' | 'i' | 'c' | 'm', id: number): string {
  return `${kind}-${id}`;
}

function dec(raw: string): { kind: 'u' | 'i' | 'c' | 'm'; id: number } | null {
  const m = /^(u|i|c|m)-(\d+)$/.exec(raw.trim());
  if (!m) return null;
  return { kind: m[1] as 'u' | 'i' | 'c' | 'm', id: Number(m[2]) };
}

/** Api Ayarları — düz ağaç listesi */
export async function listLocationsFlat(): Promise<PublicLocation[]> {
  const [ulkeler, iller, ilceler, mahalleler, semtler] = await Promise.all([
    prisma.ulke.findMany({ where: notRemoved(), orderBy: { adi: 'asc' } }),
    prisma.il.findMany({ where: notRemoved(), orderBy: { adi: 'asc' } }),
    prisma.ilce.findMany({ where: notRemoved(), orderBy: { adi: 'asc' } }),
    prisma.mahalle.findMany({ where: notRemoved(), orderBy: { adi: 'asc' } }),
    prisma.semt.findMany({ where: notRemoved(), select: { id: true, ilceId: true } }),
  ]);

  const semtToIlce = new Map(semtler.map((s) => [s.id, s.ilceId]));
  const out: PublicLocation[] = [];

  for (const r of ulkeler) {
    out.push({ id: enc('u', r.id), name: r.adi, level: 'Ülke', parentId: null });
  }
  for (const r of iller) {
    out.push({
      id: enc('i', r.id),
      name: r.adi,
      level: 'İl',
      parentId: r.ulkeId != null ? enc('u', r.ulkeId) : null,
    });
  }
  for (const r of ilceler) {
    out.push({
      id: enc('c', r.id),
      name: r.adi,
      level: 'İlçe',
      parentId: enc('i', r.ilId),
    });
  }
  for (const r of mahalleler) {
    const ilceId = semtToIlce.get(r.semtId);
    out.push({
      id: enc('m', r.id),
      name: r.adi,
      level: 'Mahalle',
      parentId: ilceId != null ? enc('c', ilceId) : null,
    });
  }
  return out;
}

async function ensureMerkezSemt(ilceId: number): Promise<number> {
  const existing = await prisma.semt.findFirst({
    where: { ilceId, adi: 'Merkez', ...notRemoved() },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.semt.create({
    data: { ilceId, adi: 'Merkez', remove: false },
  });
  return created.id;
}

export async function createLocation(input: {
  name: string;
  level: LocationLevel;
  parentId?: string | null;
}): Promise<PublicLocation> {
  const name = input.name.trim();
  if (!name) throw new LocationsError('Ad gerekli');

  if (input.level === 'Ülke') {
    const dup = await prisma.ulke.findFirst({
      where: { adi: name, ...notRemoved() },
    });
    if (dup) throw new LocationsError('Bu ülke zaten var');
    const row = await prisma.ulke.create({
      data: { adi: name.slice(0, 255), telefonKodu: '+90', remove: false },
    });
    return { id: enc('u', row.id), name: row.adi, level: 'Ülke', parentId: null };
  }

  if (input.level === 'İl') {
    const p = input.parentId ? dec(input.parentId) : null;
    if (!p || p.kind !== 'u') throw new LocationsError('Ülke seçiniz');
    const dup = await prisma.il.findFirst({
      where: { ulkeId: p.id, adi: name, ...notRemoved() },
    });
    if (dup) throw new LocationsError('Bu ülkede bu şehir zaten var');
    const row = await prisma.il.create({
      data: { ulkeId: p.id, adi: name.slice(0, 255), remove: false },
    });
    return {
      id: enc('i', row.id),
      name: row.adi,
      level: 'İl',
      parentId: enc('u', p.id),
    };
  }

  if (input.level === 'İlçe') {
    const p = input.parentId ? dec(input.parentId) : null;
    if (!p || p.kind !== 'i') throw new LocationsError('Şehir seçiniz');
    const dup = await prisma.ilce.findFirst({
      where: { ilId: p.id, adi: name, ...notRemoved() },
    });
    if (dup) throw new LocationsError('Bu şehirde bu ilçe zaten var');
    const row = await prisma.ilce.create({
      data: { ilId: p.id, adi: name.slice(0, 255), remove: false },
    });
    return {
      id: enc('c', row.id),
      name: row.adi,
      level: 'İlçe',
      parentId: enc('i', p.id),
    };
  }

  // Mahalle → semt(Merkez) altında
  const p = input.parentId ? dec(input.parentId) : null;
  if (!p || p.kind !== 'c') throw new LocationsError('İlçe seçiniz');
  const semtId = await ensureMerkezSemt(p.id);
  const dup = await prisma.mahalle.findFirst({
    where: { semtId, adi: name, ...notRemoved() },
  });
  if (dup) throw new LocationsError('Bu ilçede bu mahalle zaten var');
  const row = await prisma.mahalle.create({
    data: {
      semtId,
      adi: name.slice(0, 255),
      postaKodu: '00000',
      remove: false,
    },
  });
  return {
    id: enc('m', row.id),
    name: row.adi,
    level: 'Mahalle',
    parentId: enc('c', p.id),
  };
}

export async function updateLocation(
  id: string,
  input: { name: string; parentId?: string | null },
): Promise<PublicLocation> {
  const parsed = dec(id);
  if (!parsed) throw new LocationsError('Geçersiz lokasyon');
  const name = input.name.trim();
  if (!name) throw new LocationsError('Ad gerekli');

  if (parsed.kind === 'u') {
    const row = await prisma.ulke.update({
      where: { id: parsed.id },
      data: { adi: name.slice(0, 255) },
    });
    return { id: enc('u', row.id), name: row.adi, level: 'Ülke', parentId: null };
  }
  if (parsed.kind === 'i') {
    const parent = input.parentId ? dec(input.parentId) : null;
    const row = await prisma.il.update({
      where: { id: parsed.id },
      data: {
        adi: name.slice(0, 255),
        ...(parent?.kind === 'u' ? { ulkeId: parent.id } : {}),
      },
    });
    return {
      id: enc('i', row.id),
      name: row.adi,
      level: 'İl',
      parentId: row.ulkeId != null ? enc('u', row.ulkeId) : null,
    };
  }
  if (parsed.kind === 'c') {
    const parent = input.parentId ? dec(input.parentId) : null;
    const row = await prisma.ilce.update({
      where: { id: parsed.id },
      data: {
        adi: name.slice(0, 255),
        ...(parent?.kind === 'i' ? { ilId: parent.id } : {}),
      },
    });
    return {
      id: enc('c', row.id),
      name: row.adi,
      level: 'İlçe',
      parentId: enc('i', row.ilId),
    };
  }

  const parent = input.parentId ? dec(input.parentId) : null;
  let semtId: number | undefined;
  if (parent?.kind === 'c') {
    semtId = await ensureMerkezSemt(parent.id);
  }
  const row = await prisma.mahalle.update({
    where: { id: parsed.id },
    data: {
      adi: name.slice(0, 255),
      ...(semtId != null ? { semtId } : {}),
    },
  });
  const semt = await prisma.semt.findFirst({
    where: { id: row.semtId },
    select: { ilceId: true },
  });
  return {
    id: enc('m', row.id),
    name: row.adi,
    level: 'Mahalle',
    parentId: semt ? enc('c', semt.ilceId) : null,
  };
}

export async function softDeleteLocation(id: string): Promise<void> {
  const parsed = dec(id);
  if (!parsed) throw new LocationsError('Geçersiz lokasyon');
  if (parsed.kind === 'u') {
    await prisma.ulke.update({ where: { id: parsed.id }, data: { remove: true } });
  } else if (parsed.kind === 'i') {
    await prisma.il.update({ where: { id: parsed.id }, data: { remove: true } });
  } else if (parsed.kind === 'c') {
    await prisma.ilce.update({ where: { id: parsed.id }, data: { remove: true } });
  } else {
    await prisma.mahalle.update({ where: { id: parsed.id }, data: { remove: true } });
  }
}

/** Excel / modal zinciri — isimlerle bul veya oluştur */
export async function ensureLocationPathNames(parts: {
  country?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
}): Promise<PublicLocation[]> {
  let countryId: string | null = null;
  let cityId: string | null = null;
  let districtId: string | null = null;

  if (parts.country?.trim()) {
    const list = await listLocationsFlat();
    const hit = list.find(
      (r) =>
        r.level === 'Ülke' &&
        r.name.toLocaleLowerCase('tr') === parts.country!.trim().toLocaleLowerCase('tr'),
    );
    countryId = hit
      ? hit.id
      : (await createLocation({ name: parts.country.trim(), level: 'Ülke' })).id;
  }
  if (parts.city?.trim() && countryId) {
    const list = await listLocationsFlat();
    const hit = list.find(
      (r) =>
        r.level === 'İl' &&
        r.parentId === countryId &&
        r.name.toLocaleLowerCase('tr') === parts.city!.trim().toLocaleLowerCase('tr'),
    );
    cityId = hit
      ? hit.id
      : (
          await createLocation({
            name: parts.city.trim(),
            level: 'İl',
            parentId: countryId,
          })
        ).id;
  }
  if (parts.district?.trim() && cityId) {
    const list = await listLocationsFlat();
    const hit = list.find(
      (r) =>
        r.level === 'İlçe' &&
        r.parentId === cityId &&
        r.name.toLocaleLowerCase('tr') === parts.district!.trim().toLocaleLowerCase('tr'),
    );
    districtId = hit
      ? hit.id
      : (
          await createLocation({
            name: parts.district.trim(),
            level: 'İlçe',
            parentId: cityId,
          })
        ).id;
  }
  if (parts.neighborhood?.trim() && districtId) {
    const list = await listLocationsFlat();
    const hit = list.find(
      (r) =>
        r.level === 'Mahalle' &&
        r.parentId === districtId &&
        r.name.toLocaleLowerCase('tr') ===
          parts.neighborhood!.trim().toLocaleLowerCase('tr'),
    );
    if (!hit) {
      await createLocation({
        name: parts.neighborhood.trim(),
        level: 'Mahalle',
        parentId: districtId,
      });
    }
  }
  return listLocationsFlat();
}
