import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { UPLOADS_ROOT } from './settingsService.js';

export class CardDefsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardDefsError';
  }
}

export type PublicCardNamed = {
  id: string;
  name: string;
};

export type PublicCardBrand = {
  id: string;
  name: string;
  logo: string | null;
  logoUrl: string;
  initials: string;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr');
}

function resolveBrandLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '';
  const raw = logo.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/uploads/') || raw.startsWith('/banks/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  if (raw.startsWith('kart-markalari/')) return `/uploads/${raw}`;
  return `/uploads/kart-markalari/${raw.replace(/^\/+/, '')}`;
}

async function saveBrandLogo(dataUrl: string): Promise<string> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new CardDefsError('Geçersiz logo dosyası');
  const mime = m[1]!.toLowerCase();
  const ext =
    mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 2_500_000) throw new CardDefsError('Logo en fazla 2.5 MB olmalı');

  const dir = path.join(UPLOADS_ROOT, 'kart-markalari');
  await fs.mkdir(dir, { recursive: true });
  const name = `marka_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `kart-markalari/${name}`;
}

function isDupName(
  rows: { id: number; adi: string }[],
  name: string,
  excludeId?: number,
): boolean {
  const needle = name.toLocaleLowerCase('tr');
  return rows.some(
    (r) =>
      r.adi.toLocaleLowerCase('tr') === needle &&
      (excludeId == null || r.id !== excludeId),
  );
}

/* ─── Kart Tipleri ─── */

export async function listCardTypes(): Promise<PublicCardNamed[]> {
  const rows = await prisma.kartTipi.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map((r) => ({ id: String(r.id), name: r.adi }));
}

export async function createCardType(nameRaw: string): Promise<PublicCardNamed> {
  const name = nameRaw.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartTipi.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name)) throw new CardDefsError('Bu kart tipi zaten var');
  const row = await prisma.kartTipi.create({
    data: { adi: name.slice(0, 255), remove: false },
  });
  return { id: String(row.id), name: row.adi };
}

export async function updateCardType(id: number, nameRaw: string): Promise<PublicCardNamed> {
  const existing = await prisma.kartTipi.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart tipi bulunamadı');
  const name = nameRaw.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartTipi.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name, id)) throw new CardDefsError('Bu kart tipi zaten var');
  const row = await prisma.kartTipi.update({
    where: { id },
    data: { adi: name.slice(0, 255) },
  });
  return { id: String(row.id), name: row.adi };
}

export async function softDeleteCardType(id: number): Promise<void> {
  const existing = await prisma.kartTipi.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart tipi bulunamadı');
  await prisma.kartTipi.update({ where: { id }, data: { remove: true } });
}

/* ─── Kart Türleri ─── */

export async function listCardKinds(): Promise<PublicCardNamed[]> {
  const rows = await prisma.kartTuru.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map((r) => ({ id: String(r.id), name: r.adi }));
}

export async function createCardKind(nameRaw: string): Promise<PublicCardNamed> {
  const name = nameRaw.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartTuru.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name)) throw new CardDefsError('Bu kart türü zaten var');
  const row = await prisma.kartTuru.create({
    data: { adi: name.slice(0, 255), remove: false },
  });
  return { id: String(row.id), name: row.adi };
}

export async function updateCardKind(id: number, nameRaw: string): Promise<PublicCardNamed> {
  const existing = await prisma.kartTuru.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart türü bulunamadı');
  const name = nameRaw.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartTuru.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name, id)) throw new CardDefsError('Bu kart türü zaten var');
  const row = await prisma.kartTuru.update({
    where: { id },
    data: { adi: name.slice(0, 255) },
  });
  return { id: String(row.id), name: row.adi };
}

export async function softDeleteCardKind(id: number): Promise<void> {
  const existing = await prisma.kartTuru.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart türü bulunamadı');
  await prisma.kartTuru.update({ where: { id }, data: { remove: true } });
}

/* ─── Kart Markaları ─── */

function mapBrand(r: {
  id: number;
  adi: string;
  logo: string | null;
  kisaKod: string | null;
}): PublicCardBrand {
  return {
    id: String(r.id),
    name: r.adi,
    logo: r.logo,
    logoUrl: resolveBrandLogoUrl(r.logo),
    initials: (r.kisaKod || initialsFromName(r.adi)).slice(0, 8),
  };
}

export async function listCardBrands(): Promise<PublicCardBrand[]> {
  const rows = await prisma.kartMarka.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map(mapBrand);
}

export async function createCardBrand(input: {
  name: string;
  logoDataUrl?: string | null;
  initials?: string;
}): Promise<PublicCardBrand> {
  const name = input.name.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartMarka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name)) throw new CardDefsError('Bu kart markası zaten var');

  let logo: string | null = null;
  if (input.logoDataUrl) logo = await saveBrandLogo(input.logoDataUrl);

  const kisaKod = (input.initials || initialsFromName(name)).trim().slice(0, 8) || null;
  const row = await prisma.kartMarka.create({
    data: { adi: name.slice(0, 255), logo, kisaKod, remove: false },
  });
  return mapBrand(row);
}

export async function updateCardBrand(
  id: number,
  input: { name: string; logoDataUrl?: string | null; initials?: string },
): Promise<PublicCardBrand> {
  const existing = await prisma.kartMarka.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart markası bulunamadı');

  const name = input.name.trim();
  if (!name) throw new CardDefsError('Adı gerekli');
  const all = await prisma.kartMarka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true },
  });
  if (isDupName(all, name, id)) throw new CardDefsError('Bu kart markası zaten var');

  let logo = existing.logo;
  if (input.logoDataUrl) logo = await saveBrandLogo(input.logoDataUrl);

  const kisaKod =
    (input.initials || existing.kisaKod || initialsFromName(name)).trim().slice(0, 8) || null;

  const row = await prisma.kartMarka.update({
    where: { id },
    data: { adi: name.slice(0, 255), logo, kisaKod },
  });
  return mapBrand(row);
}

export async function softDeleteCardBrand(id: number): Promise<void> {
  const existing = await prisma.kartMarka.findFirst({ where: { id, ...notRemoved() } });
  if (!existing) throw new CardDefsError('Kart markası bulunamadı');
  await prisma.kartMarka.update({ where: { id }, data: { remove: true } });
}
