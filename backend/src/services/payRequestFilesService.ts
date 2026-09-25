import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { UPLOADS_ROOT } from './settingsService.js';

export class PayRequestFilesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayRequestFilesError';
  }
}

export type PayRequestFile = {
  name: string;
  path: string;
  url: string;
};

const REL_DIR = 'odeme-istekleri';
const MAX_FILES = 12;
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB / dosya

const ALLOWED_EXT = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

function absFromRel(rel: string): string {
  const clean = rel.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!clean.startsWith(`${REL_DIR}/`) || clean.includes('..')) {
    throw new PayRequestFilesError('Geçersiz dosya yolu');
  }
  return path.join(UPLOADS_ROOT, clean);
}

function toPublic(rel: string, name: string): PayRequestFile {
  const clean = rel.replace(/^\/+/, '');
  return {
    name,
    path: clean,
    url: `/uploads/${clean}`,
  };
}

export function parsePayRequestFiles(raw: string | null | undefined): PayRequestFile[] {
  if (!raw?.trim()) return [];
  const t = raw.trim();
  try {
    if (t.startsWith('[')) {
      const parsed = JSON.parse(t) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((x) => {
          if (!x || typeof x !== 'object') return null;
          const o = x as Record<string, unknown>;
          const name = String(o.name || '').trim();
          const p = String(o.path || '').trim().replace(/^\/+/, '');
          if (!name || !p) return null;
          return toPublic(p, name);
        })
        .filter((x): x is PayRequestFile => x != null);
    }
  } catch {
    /* legacy */
  }
  // Eski tek dosya adı
  const name = path.basename(t);
  if (!name) return [];
  return [{ name, path: t, url: t.startsWith('/') ? t : `/uploads/${t}` }];
}

export function serializePayRequestFiles(files: PayRequestFile[]): string | null {
  if (!files.length) return null;
  return JSON.stringify(
    files.map((f) => ({
      name: f.name,
      path: f.path.replace(/^\/+/, ''),
    })),
  );
}

function safeExt(name: string): string {
  const ext = path.extname(name || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new PayRequestFilesError(`Desteklenmeyen dosya türü: ${ext || '(yok)'}`);
  }
  return ext;
}

export async function savePayRequestUploads(
  files: { originalname: string; buffer: Buffer; mimetype: string }[],
): Promise<PayRequestFile[]> {
  if (!files.length) throw new PayRequestFilesError('Dosya seçin');
  if (files.length > MAX_FILES) {
    throw new PayRequestFilesError(`En fazla ${MAX_FILES} dosya yükleyebilirsiniz`);
  }

  const batch = randomBytes(8).toString('hex');
  const dirRel = `${REL_DIR}/${batch}`;
  const dirAbs = path.join(UPLOADS_ROOT, dirRel);
  await fs.mkdir(dirAbs, { recursive: true });

  const out: PayRequestFile[] = [];
  for (const f of files) {
    if (!f.buffer?.length) continue;
    if (f.buffer.length > MAX_BYTES) {
      throw new PayRequestFilesError(`${f.originalname}: dosya 12 MB sınırını aşıyor`);
    }
    const ext = safeExt(f.originalname);
    const base = path
      .basename(f.originalname, ext)
      .replace(/[^\w\-ğüşıöçĞÜŞİÖÇ. ]+/gi, '_')
      .slice(0, 80);
    const stored = `${Date.now()}-${randomBytes(3).toString('hex')}-${base || 'dosya'}${ext}`;
    const rel = `${dirRel}/${stored}`;
    await fs.writeFile(path.join(UPLOADS_ROOT, rel), f.buffer);
    out.push(toPublic(rel, f.originalname || stored));
  }
  if (!out.length) throw new PayRequestFilesError('Geçerli dosya yok');
  return out;
}

export async function mergePayRequestPdfs(relPaths: string[]): Promise<PayRequestFile> {
  if (relPaths.length < 2) {
    throw new PayRequestFilesError('Birleştirmek için en az 2 PDF seçin');
  }
  if (relPaths.length > MAX_FILES) {
    throw new PayRequestFilesError(`En fazla ${MAX_FILES} PDF birleştirilebilir`);
  }

  const merged = await PDFDocument.create();
  for (const rel of relPaths) {
    const abs = absFromRel(rel);
    const ext = path.extname(rel).toLowerCase();
    if (ext !== '.pdf') throw new PayRequestFilesError('Yalnızca PDF birleştirilebilir');
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(abs);
    } catch {
      throw new PayRequestFilesError(`Dosya bulunamadı: ${path.basename(rel)}`);
    }
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }

  const pdfBytes = await merged.save();
  const batch = randomBytes(8).toString('hex');
  const dirRel = `${REL_DIR}/${batch}`;
  await fs.mkdir(path.join(UPLOADS_ROOT, dirRel), { recursive: true });
  const name = `birlesik-${new Date().toISOString().slice(0, 10)}.pdf`;
  const stored = `${Date.now()}-merged.pdf`;
  const rel = `${dirRel}/${stored}`;
  await fs.writeFile(path.join(UPLOADS_ROOT, rel), pdfBytes);
  return toPublic(rel, name);
}

export function absolutePayRequestFile(rel: string): string {
  return absFromRel(rel);
}
