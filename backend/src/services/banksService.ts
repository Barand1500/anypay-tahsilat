import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { UPLOADS_ROOT } from './settingsService.js';

export class BanksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BanksError';
  }
}

export type PublicBank = {
  id: string;
  name: string;
  shortName: string;
  /** Tarayıcıda gösterilecek logo URL */
  logoUrl: string;
  /** DB’de saklanan ham logo değeri */
  logo: string | null;
  securityTypes: string;
  gateway3dUrl: string;
  apiUrl: string;
  xmlUrl: string;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

/** logo alanı → public URL */
export function resolveBankLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '';
  const raw = logo.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/banks/') || raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  if (raw.startsWith('bankalar/')) return `/uploads/${raw}`;
  const file = raw.replace(/^banka\//i, '').replace(/^\/+/, '');
  if (!file) return '';
  return `/banks/${file}`;
}

type BankRow = {
  id: number;
  adi: string;
  kisaAdi: string;
  logo: string | null;
  guvenlikTipleri: string | null;
  sanalPos3dUrl: string | null;
  sanalPosApiUrl: string | null;
  sanalPosXmlUrl: string | null;
};

function mapRow(r: BankRow): PublicBank {
  return {
    id: String(r.id),
    name: r.adi,
    shortName: r.kisaAdi,
    logo: r.logo,
    logoUrl: resolveBankLogoUrl(r.logo),
    securityTypes: r.guvenlikTipleri || '',
    gateway3dUrl: r.sanalPos3dUrl || '',
    apiUrl: r.sanalPosApiUrl || '',
    xmlUrl: r.sanalPosXmlUrl || '',
  };
}

async function saveBankLogo(dataUrl: string): Promise<string> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new BanksError('Geçersiz logo dosyası');
  const mime = m[1]!.toLowerCase();
  const ext =
    mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 2_500_000) throw new BanksError('Logo en fazla 2.5 MB olmalı');

  const dir = path.join(UPLOADS_ROOT, 'bankalar');
  await fs.mkdir(dir, { recursive: true });
  const name = `bank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `bankalar/${name}`;
}

export async function listBanks(): Promise<PublicBank[]> {
  const rows = await prisma.banka.findMany({
    where: notRemoved(),
    orderBy: { adi: 'asc' },
  });
  return rows.map((r) => mapRow(r as BankRow));
}

export type BankUpsertInput = {
  name: string;
  shortName: string;
  securityTypes?: string;
  gateway3dUrl?: string;
  apiUrl?: string;
  xmlUrl?: string;
  /** data:image/...;base64 — yoksa logo değişmez */
  logoDataUrl?: string | null;
  /** Mevcut logo yolunu koru / temizle */
  logo?: string | null;
};

function trimUrl(v: string | undefined): string | null {
  const t = (v || '').trim();
  return t ? t.slice(0, 512) : null;
}

export async function createBank(input: BankUpsertInput): Promise<PublicBank> {
  const name = input.name.trim();
  const shortName = input.shortName.trim();
  if (!name) throw new BanksError('Adı gerekli');
  if (!shortName) throw new BanksError('Kısa adı gerekli');

  const all = await prisma.banka.findMany({
    where: notRemoved(),
    select: { id: true, adi: true, kisaAdi: true },
  });
  const dup = all.find(
    (r) =>
      r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr') ||
      r.kisaAdi.toLocaleLowerCase('tr') === shortName.toLocaleLowerCase('tr'),
  );
  if (dup) throw new BanksError('Bu banka adı veya kısa adı zaten var');

  let logo: string | null = input.logo?.trim() || null;
  if (input.logoDataUrl) logo = await saveBankLogo(input.logoDataUrl);

  const row = await prisma.banka.create({
    data: {
      adi: name.slice(0, 255),
      kisaAdi: shortName.slice(0, 255),
      logo,
      guvenlikTipleri: (input.securityTypes || '').trim().slice(0, 255) || null,
      sanalPos3dUrl: trimUrl(input.gateway3dUrl),
      sanalPosApiUrl: trimUrl(input.apiUrl),
      sanalPosXmlUrl: trimUrl(input.xmlUrl),
      remove: false,
    },
  });
  return mapRow(row as BankRow);
}

export async function updateBank(id: number, input: BankUpsertInput): Promise<PublicBank> {
  const existing = await prisma.banka.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new BanksError('Banka bulunamadı');

  const name = input.name.trim();
  const shortName = input.shortName.trim();
  if (!name) throw new BanksError('Adı gerekli');
  if (!shortName) throw new BanksError('Kısa adı gerekli');

  const clash = await prisma.banka.findMany({
    where: { ...notRemoved(), NOT: { id } },
    select: { id: true, adi: true, kisaAdi: true },
  });
  const dup = clash.find(
    (r) =>
      r.adi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr') ||
      r.kisaAdi.toLocaleLowerCase('tr') === shortName.toLocaleLowerCase('tr'),
  );
  if (dup) throw new BanksError('Bu banka adı veya kısa adı zaten var');

  let logo = existing.logo;
  if (input.logoDataUrl) logo = await saveBankLogo(input.logoDataUrl);
  else if (input.logo === null) logo = null;
  else if (typeof input.logo === 'string' && input.logo.trim()) logo = input.logo.trim();

  const row = await prisma.banka.update({
    where: { id },
    data: {
      adi: name.slice(0, 255),
      kisaAdi: shortName.slice(0, 255),
      logo,
      guvenlikTipleri: (input.securityTypes || '').trim().slice(0, 255) || null,
      sanalPos3dUrl: trimUrl(input.gateway3dUrl),
      sanalPosApiUrl: trimUrl(input.apiUrl),
      sanalPosXmlUrl: trimUrl(input.xmlUrl),
    },
  });
  return mapRow(row as BankRow);
}

export async function softDeleteBank(id: number): Promise<void> {
  const existing = await prisma.banka.findFirst({
    where: { id, ...notRemoved() },
  });
  if (!existing) throw new BanksError('Banka bulunamadı');
  await prisma.banka.update({
    where: { id },
    data: { remove: true },
  });
}

/** Kullanılmayan — liste FE’de yeniden yüklenir */
export async function refreshBanksFromDisk(): Promise<{ matched: number }> {
  const n = await prisma.banka.count({ where: notRemoved() });
  return { matched: n };
}
