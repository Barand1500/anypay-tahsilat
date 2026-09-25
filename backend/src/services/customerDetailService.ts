import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { sendCustomerCredentialsMail } from '../lib/mail.js';
import { recordSendHistory } from './sendHistoryService.js';
import { prisma } from '../lib/prisma.js';

export class CustomerDetailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDetailError';
  }
}

function notRemoved(): { OR: [{ remove: null }, { remove: false }] } {
  return { OR: [{ remove: null }, { remove: false }] };
}

/** Unique e-posta serbest bırak — soft-silinen / yetim kullanıcı */
async function releaseUserEmail(userId: number, email: string) {
  const stamp = Date.now().toString(36);
  await prisma.user.update({
    where: { id: userId },
    data: {
      remove: true,
      isVerified: false,
      email: `del.${userId}.${stamp}.${email}`.slice(0, 180),
    },
  });
}

async function sendAndLogCredentials(
  musteriId: number,
  email: string,
  name: string,
  plain: string,
): Promise<boolean> {
  try {
    await sendCustomerCredentialsMail(email, name, email, plain);
    await recordSendHistory({
      musteriId,
      type: 'email',
      recipient: email,
      content: [
        'AnyPay Tahsilat — Giriş bilgileriniz',
        `Kullanıcı: ${name}`,
        `E-posta: ${email}`,
        'Geçici şifre e-posta ile iletildi.',
        'https://tahsilat.anypay.com.tr/',
      ].join('\n'),
      kaynak: 'musteri_giris',
      basarili: true,
    });
    return true;
  } catch (err) {
    console.error('Giriş bilgisi e-postası gönderilemedi', err);
    return false;
  }
}

function digitsPhone(raw: string | null | undefined): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

/** PHP serialize / JSON yetkili listesi */
export function parseYetkiliIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t) as unknown;
    if (Array.isArray(j)) {
      return [...new Set(j.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    }
  } catch {
    /* PHP serialize */
  }
  const ids: number[] = [];
  const reStr = /s:\d+:"(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = reStr.exec(t))) ids.push(Number(m[1]));
  const reInt = /i:\d+;i:(\d+)/g;
  while ((m = reInt.exec(t))) ids.push(Number(m[1]));
  return [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
}

function encodeYetkiliIds(ids: number[]): string {
  return JSON.stringify([...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))]);
}

async function assertMusteri(musteriId: number) {
  const m = await prisma.musteri.findFirst({
    where: { id: musteriId, ...notRemoved() },
    select: {
      id: true,
      unvan: true,
      eposta: true,
      telefon: true,
      adres: true,
    },
  });
  if (!m) throw new CustomerDetailError('Müşteri bulunamadı');
  return m;
}

export type PublicCustomerUser = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  lastLogin: string | null;
  tempPassword?: string;
  /** musteriler kaydından türetilen cari satırı */
  isPrimary?: boolean;
  emailSent?: boolean;
};

export type PasswordResetResult = {
  password?: string;
  name: string;
  email: string;
  phone: string;
  channel: 'mail' | 'sms' | 'wp';
  emailSent?: boolean;
};

export type PublicCustomerAddress = {
  id: string;
  customerId: string;
  label: string;
  address: string;
  contactName: string;
  contactNames: string[];
  /** Adres yetkilisi user id listesi */
  yetkiliIds: number[];
  isDefault: boolean;
  ulkeId: number;
  ilId: number;
  ilceId: number;
  semtId: number;
  mahalleId: number;
  sokakId: number;
  directions: string;
  /** musteriler.adres alanından türetilen kayıt adresi */
  isPrimary?: boolean;
};

export type LocationOption = { value: string; label: string };

function buildAddressLine(parts: {
  tarif: string;
  sokak: string;
  mahalle: string;
  semt: string;
  ilce: string;
  il: string;
  ulke: string;
}): string {
  const head = [parts.mahalle, parts.sokak, parts.tarif].filter(Boolean).join(' ').trim();
  const tail = [parts.semt, parts.ilce, parts.il, parts.ulke]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
  return [head, tail].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export async function listCustomerUsers(musteriId: number): Promise<PublicCustomerUser[]> {
  const musteri = await assertMusteri(musteriId);
  const rows = await prisma.user.findMany({
    where: { musteriId, ...notRemoved() },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      musteriId: true,
      adsoyad: true,
      email: true,
      telefon: true,
      isVerified: true,
      lastLogin: true,
    },
  });

  const list: PublicCustomerUser[] = rows.map((r) => ({
    id: String(r.id),
    customerId: String(r.musteriId ?? musteriId),
    name: (r.adsoyad || r.email).trim(),
    email: r.email,
    phone: digitsPhone(r.telefon),
    active: r.isVerified,
    lastLogin: r.lastLogin ? r.lastLogin.toISOString() : null,
  }));

  const cariEmail = (musteri.eposta || '').trim().toLowerCase();
  const cariName = (musteri.unvan || '').trim() || cariEmail || 'Müşteri';
  const cariPhone = digitsPhone(musteri.telefon);

  const matchIdx = cariEmail
    ? list.findIndex((u) => u.email.toLowerCase() === cariEmail)
    : -1;

  if (matchIdx >= 0) {
    const [hit] = list.splice(matchIdx, 1);
    list.unshift({ ...hit, isPrimary: true, name: hit.name || cariName });
  } else if (cariName || cariEmail || cariPhone) {
    // Sentetik cari satırı — otomatik user create yok (e-posta çakışması / yan etki)
    list.unshift({
      id: `primary-${musteriId}`,
      customerId: String(musteriId),
      name: cariName,
      email: cariEmail,
      phone: cariPhone,
      active: true,
      lastLogin: null,
      isPrimary: true,
    });
  }

  return list;
}

export async function createCustomerUser(
  musteriId: number,
  input: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    sendEmail?: boolean;
  },
): Promise<PublicCustomerUser> {
  await assertMusteri(musteriId);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = digitsPhone(input.phone);
  if (!name) throw new CustomerDetailError('Ad soyad gerekli');
  if (!email.includes('@')) throw new CustomerDetailError('Geçerli e-posta girin');
  if (phone.length < 10) throw new CustomerDetailError('Telefon gerekli');

  const existing = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      musteriId: true,
      remove: true,
      adsoyad: true,
      telefon: true,
      isVerified: true,
      lastLogin: true,
      email: true,
    },
  });

  // Aynı müşteriye zaten bağlıysa — yeni kayıt açma, istenirse şifre maili at
  if (
    existing &&
    existing.musteriId === musteriId &&
    (existing.remove === null || existing.remove === false)
  ) {
    const plain = (input.password || '').trim() || randomBytes(4).toString('hex');
    const password = await bcrypt.hash(plain, 10);
    const row = await prisma.user.update({
      where: { id: existing.id },
      data: {
        adsoyad: name,
        telefon: phone,
        password,
        isVerified: true,
        isPassword: true,
        remove: false,
      },
    });
    let emailSent = false;
    if (input.sendEmail) {
      emailSent = await sendAndLogCredentials(musteriId, email, name, plain);
    }
    return {
      id: String(row.id),
      customerId: String(musteriId),
      name,
      email,
      phone,
      active: true,
      lastLogin: row.lastLogin ? row.lastLogin.toISOString() : null,
      emailSent,
    };
  }

  if (existing && (existing.remove === null || existing.remove === false)) {
    if (existing.musteriId == null) {
      throw new CustomerDetailError(
        'Bu e-posta panel kullanıcı hesabına ait. Müşteri girişi için farklı bir e-posta kullanın.',
      );
    }
    const m = await prisma.musteri.findFirst({
      where: { id: existing.musteriId },
      select: { remove: true },
    });
    if (m && m.remove !== true) {
      throw new CustomerDetailError('Bu e-posta başka bir müşteriye ait');
    }
    // Soft-silinmiş müşterinin kullanıcısı — e-postayı serbest bırak
    await releaseUserEmail(existing.id, email);
  } else if (existing && existing.remove === true) {
    await releaseUserEmail(existing.id, existing.email);
  }

  const plain = (input.password || '').trim() || randomBytes(4).toString('hex');
  const password = await bcrypt.hash(plain, 10);

  let row;
  try {
    row = await prisma.user.create({
      data: {
        musteriId,
        email,
        adsoyad: name,
        telefon: phone,
        password,
        isVerified: true,
        isPassword: true,
        roles: ['ROLE_SUPERMUSTERI'],
        remove: false,
      },
    });
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code === 'P2002') {
      throw new CustomerDetailError(
        'Bu e-posta zaten kayıtlı. Müşteri girişi için farklı bir e-posta deneyin.',
      );
    }
    throw err;
  }

  let emailSent = false;
  if (input.sendEmail) {
    emailSent = await sendAndLogCredentials(musteriId, email, name, plain);
  }

  return {
    id: String(row.id),
    customerId: String(musteriId),
    name,
    email,
    phone,
    active: true,
    lastLogin: null,
    emailSent,
  };
}

export async function resetCustomerUserPassword(
  musteriId: number,
  userId: number,
  channel: 'mail' | 'sms' | 'wp' = 'mail',
): Promise<PasswordResetResult> {
  await assertMusteri(musteriId);
  const row = await prisma.user.findFirst({
    where: { id: userId, musteriId, ...notRemoved() },
  });
  if (!row) throw new CustomerDetailError('Kullanıcı bulunamadı');

  const plain = randomBytes(4).toString('hex');
  const password = await bcrypt.hash(plain, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password, isPassword: true },
  });

  const name = (row.adsoyad || row.email).trim();
  const email = row.email;
  const phone = digitsPhone(row.telefon);

  if (channel === 'mail') {
    if (!email.includes('@')) throw new CustomerDetailError('E-posta adresi yok');
    const emailSent = await sendAndLogCredentials(musteriId, email, name, plain);
    return { name, email, phone, channel, emailSent };
  }

  return { password: plain, name, email, phone, channel };
}

export async function updateCustomerUser(
  musteriId: number,
  userId: number,
  input: { name?: string; email?: string; phone?: string; active?: boolean },
): Promise<PublicCustomerUser> {
  const musteri = await assertMusteri(musteriId);
  const row = await prisma.user.findFirst({
    where: { id: userId, musteriId, ...notRemoved() },
  });
  if (!row) throw new CustomerDetailError('Kullanıcı bulunamadı');

  const name = input.name != null ? input.name.trim() : undefined;
  const email = input.email != null ? input.email.trim().toLowerCase() : undefined;
  const phone = input.phone != null ? digitsPhone(input.phone) : undefined;

  if (name !== undefined && !name) throw new CustomerDetailError('Ad soyad gerekli');
  if (email !== undefined && !email.includes('@')) {
    throw new CustomerDetailError('Geçerli e-posta girin');
  }
  if (phone !== undefined && phone.length < 10) {
    throw new CustomerDetailError('Telefon gerekli');
  }
  if (email && email !== row.email) {
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: userId }, ...notRemoved() },
      select: { id: true, musteriId: true },
    });
    if (taken) {
      let orphan = false;
      if (taken.musteriId != null) {
        const m = await prisma.musteri.findFirst({
          where: { id: taken.musteriId },
          select: { remove: true },
        });
        orphan = !m || m.remove === true;
      }
      if (!orphan) throw new CustomerDetailError('Bu e-posta zaten kayıtlı');
      await releaseUserEmail(taken.id, email);
    } else {
      const ghost = await prisma.user.findFirst({
        where: { email, remove: true, NOT: { id: userId } },
        select: { id: true, email: true },
      });
      if (ghost) await releaseUserEmail(ghost.id, ghost.email);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { adsoyad: name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { telefon: phone } : {}),
      ...(input.active !== undefined ? { isVerified: input.active } : {}),
    },
  });

  const cariEmail = (musteri.eposta || '').trim().toLowerCase();
  const isCariContact =
    !cariEmail || cariEmail === row.email.toLowerCase() || cariEmail === updated.email.toLowerCase();
  if (isCariContact && (name !== undefined || email !== undefined || phone !== undefined)) {
    await prisma.musteri.update({
      where: { id: musteriId },
      data: {
        ...(name !== undefined ? { unvan: name } : {}),
        ...(email !== undefined ? { eposta: email } : {}),
        ...(phone !== undefined ? { telefon: phone } : {}),
      },
    });
  }

  return {
    id: String(updated.id),
    customerId: String(musteriId),
    name: (updated.adsoyad || updated.email).trim(),
    email: updated.email,
    phone: digitsPhone(updated.telefon),
    active: updated.isVerified,
    lastLogin: updated.lastLogin ? updated.lastLogin.toISOString() : null,
    isPrimary: isCariContact,
  };
}

export async function setCustomerUserActive(
  musteriId: number,
  userId: number,
  active: boolean,
): Promise<PublicCustomerUser> {
  return updateCustomerUser(musteriId, userId, { active });
}

export async function softDeleteCustomerUser(musteriId: number, userId: number): Promise<void> {
  await assertMusteri(musteriId);
  const row = await prisma.user.findFirst({
    where: { id: userId, musteriId, ...notRemoved() },
    select: { id: true, email: true },
  });
  if (!row) throw new CustomerDetailError('Kullanıcı bulunamadı');
  await releaseUserEmail(row.id, row.email);
}

export async function listCustomerAddresses(musteriId: number): Promise<PublicCustomerAddress[]> {
  const musteri = await assertMusteri(musteriId);
  const rows = await prisma.adres.findMany({
    where: { musteriId, ...notRemoved() },
    orderBy: [{ varsayilan: 'desc' }, { id: 'asc' }],
  });

  const list: PublicCustomerAddress[] = [];

  if (rows.length > 0) {
    const ulkeIds = [...new Set(rows.map((r) => r.ulkeId))];
    const ilIds = [...new Set(rows.map((r) => r.ilId))];
    const ilceIds = [...new Set(rows.map((r) => r.ilceId))];
    const semtIds = [...new Set(rows.map((r) => r.semtId))];
    const mahalleIds = [...new Set(rows.map((r) => r.mahalleId))];
    const sokakIds = [...new Set(rows.map((r) => r.sokakId))];
    const yetkiliIds = [...new Set(rows.flatMap((r) => parseYetkiliIds(r.yetkili)))];

    const [ulkeler, iller, ilceler, semtler, mahalleler, sokaklar, users] = await Promise.all([
      prisma.ulke.findMany({ where: { id: { in: ulkeIds } }, select: { id: true, adi: true } }),
      prisma.il.findMany({ where: { id: { in: ilIds } }, select: { id: true, adi: true } }),
      prisma.ilce.findMany({ where: { id: { in: ilceIds } }, select: { id: true, adi: true } }),
      prisma.semt.findMany({ where: { id: { in: semtIds } }, select: { id: true, adi: true } }),
      prisma.mahalle.findMany({ where: { id: { in: mahalleIds } }, select: { id: true, adi: true } }),
      prisma.sokak.findMany({ where: { id: { in: sokakIds } }, select: { id: true, adi: true } }),
      yetkiliIds.length
        ? prisma.user.findMany({
            where: { id: { in: yetkiliIds } },
            select: { id: true, adsoyad: true, email: true },
          })
        : Promise.resolve([] as { id: number; adsoyad: string | null; email: string }[]),
    ]);

    const uMap = new Map(ulkeler.map((x) => [x.id, x.adi]));
    const ilMap = new Map(iller.map((x) => [x.id, x.adi]));
    const ilceMap = new Map(ilceler.map((x) => [x.id, x.adi]));
    const semtMap = new Map(semtler.map((x) => [x.id, x.adi]));
    const mahMap = new Map(mahalleler.map((x) => [x.id, x.adi]));
    const sokMap = new Map(sokaklar.map((x) => [x.id, x.adi]));
    const userMap = new Map(
      users.map((x) => [x.id, (x.adsoyad || x.email).trim()]),
    );

    for (const r of rows) {
      const contactIds = parseYetkiliIds(r.yetkili);
      const contactNames = contactIds.map((id) => userMap.get(id) || `#${id}`).filter(Boolean);
      const address = buildAddressLine({
        tarif: (r.adresTarifi || '').trim(),
        sokak: sokMap.get(r.sokakId) || '',
        mahalle: mahMap.get(r.mahalleId) || '',
        semt: semtMap.get(r.semtId) || '',
        ilce: ilceMap.get(r.ilceId) || '',
        il: ilMap.get(r.ilId) || '',
        ulke: uMap.get(r.ulkeId) || '',
      });
      list.push({
        id: String(r.id),
        customerId: String(r.musteriId ?? musteriId),
        label: r.adresAdi,
        address,
        contactName: contactNames[0] || '',
        contactNames,
        yetkiliIds: contactIds,
        isDefault: Boolean(r.varsayilan),
        ulkeId: r.ulkeId,
        ilId: r.ilId,
        ilceId: r.ilceId,
        semtId: r.semtId,
        mahalleId: r.mahalleId,
        sokakId: r.sokakId,
        directions: (r.adresTarifi || '').trim(),
      });
    }
  }

  const cariAdres = (musteri.adres || '').trim();
  if (cariAdres) {
    const already = list.some(
      (a) => a.address.toLocaleLowerCase('tr') === cariAdres.toLocaleLowerCase('tr'),
    );
    if (!already) {
      const contact = (musteri.unvan || '').trim();
      list.unshift({
        id: `primary-${musteriId}`,
        customerId: String(musteriId),
        label: 'Kayıt Adresi',
        address: cariAdres,
        contactName: contact,
        contactNames: contact ? [contact] : [],
        yetkiliIds: [],
        isDefault: list.every((a) => !a.isDefault),
        ulkeId: 0,
        ilId: 0,
        ilceId: 0,
        semtId: 0,
        mahalleId: 0,
        sokakId: 0,
        directions: cariAdres,
        isPrimary: true,
      });
    }
  }

  return list;
}

export async function createCustomerAddress(
  musteriId: number,
  input: {
    label: string;
    ulkeId: number;
    ilId: number;
    ilceId: number;
    semtId: number;
    mahalleId: number;
    sokakId: number;
    directions?: string;
    yetkiliIds?: number[];
    isDefault?: boolean;
  },
): Promise<PublicCustomerAddress> {
  await assertMusteri(musteriId);
  const label = input.label.trim().toLocaleUpperCase('tr');
  if (!label) throw new CustomerDetailError('Adres adı gerekli');

  const existing = await prisma.adres.count({
    where: { musteriId, ...notRemoved() },
  });
  const varsayilan = input.isDefault ?? existing === 0;

  if (varsayilan) {
    await prisma.adres.updateMany({
      where: { musteriId, ...notRemoved() },
      data: { varsayilan: false },
    });
  }

  const row = await prisma.adres.create({
    data: {
      musteriId,
      adresAdi: label,
      adresTarifi: (input.directions || '').trim() || null,
      ulkeId: input.ulkeId,
      ilId: input.ilId,
      ilceId: input.ilceId,
      semtId: input.semtId,
      mahalleId: input.mahalleId,
      sokakId: input.sokakId,
      yetkili: encodeYetkiliIds(input.yetkiliIds || []),
      varsayilan,
      remove: false,
    },
  });

  const list = await listCustomerAddresses(musteriId);
  const hit = list.find((a) => a.id === String(row.id));
  if (!hit) throw new CustomerDetailError('Adres oluşturulamadı');
  return hit;
}

export async function softDeleteCustomerAddress(musteriId: number, adresId: number): Promise<void> {
  await assertMusteri(musteriId);
  const row = await prisma.adres.findFirst({
    where: { id: adresId, musteriId, ...notRemoved() },
    select: { id: true },
  });
  if (!row) throw new CustomerDetailError('Adres bulunamadı');
  await prisma.adres.update({ where: { id: adresId }, data: { remove: true } });
}

export async function updateCustomerAddress(
  musteriId: number,
  adresId: number,
  input: {
    label: string;
    ulkeId: number;
    ilId: number;
    ilceId: number;
    semtId: number;
    mahalleId: number;
    sokakId: number;
    directions?: string;
    yetkiliIds?: number[];
    isDefault?: boolean;
  },
): Promise<PublicCustomerAddress> {
  await assertMusteri(musteriId);
  const existing = await prisma.adres.findFirst({
    where: { id: adresId, musteriId, ...notRemoved() },
    select: { id: true },
  });
  if (!existing) throw new CustomerDetailError('Adres bulunamadı');

  const label = input.label.trim().toLocaleUpperCase('tr');
  if (!label) throw new CustomerDetailError('Adres adı gerekli');

  if (input.isDefault) {
    await prisma.adres.updateMany({
      where: { musteriId, ...notRemoved() },
      data: { varsayilan: false },
    });
  }

  await prisma.adres.update({
    where: { id: adresId },
    data: {
      adresAdi: label,
      adresTarifi: (input.directions || '').trim() || null,
      ulkeId: input.ulkeId,
      ilId: input.ilId,
      ilceId: input.ilceId,
      semtId: input.semtId,
      mahalleId: input.mahalleId,
      sokakId: input.sokakId,
      yetkili:
        input.yetkiliIds != null ? encodeYetkiliIds(input.yetkiliIds) : undefined,
      varsayilan: input.isDefault ?? undefined,
    },
  });

  const list = await listCustomerAddresses(musteriId);
  const hit = list.find((a) => a.id === String(adresId));
  if (!hit) throw new CustomerDetailError('Adres güncellenemedi');
  return hit;
}

export async function listCountries(): Promise<LocationOption[]> {
  const rows = await prisma.ulke.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function listProvinces(ulkeId: number): Promise<LocationOption[]> {
  const rows = await prisma.il.findMany({
    where: { ulkeId, ...notRemoved() },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function listDistricts(ilId: number): Promise<LocationOption[]> {
  const rows = await prisma.ilce.findMany({
    where: { ilId, ...notRemoved() },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function listTowns(ilceId: number): Promise<LocationOption[]> {
  const rows = await prisma.semt.findMany({
    where: { ilceId, ...notRemoved() },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function listNeighborhoods(semtId: number): Promise<LocationOption[]> {
  const rows = await prisma.mahalle.findMany({
    where: { semtId, ...notRemoved() },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}

export async function listStreets(mahalleId: number): Promise<LocationOption[]> {
  const rows = await prisma.sokak.findMany({
    where: { mahalleId, ...notRemoved() },
    orderBy: { adi: 'asc' },
    select: { id: true, adi: true },
  });
  return rows.map((r) => ({ value: String(r.id), label: r.adi }));
}
