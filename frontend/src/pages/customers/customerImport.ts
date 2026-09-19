import type { Customer, CustomerKind } from './mockCustomers';
import { normalizePhoneInput } from './mockCustomers';

export type ImportStatus = 'new' | 'exists' | 'invalid';

export type ImportDraft = {
  row: number;
  accountType: string;
  code: string;
  title: string;
  email: string;
  phone: string;
  taxNo: string;
  taxOffice: string;
  identityNo: string;
  address: string;
  kind: CustomerKind;
  userName: string;
  userEmail: string;
  userPhone: string;
  status: ImportStatus;
  matchLabel?: string;
  existingId?: string;
  errors: string[];
};

const HEADERS = [
  'Cari Tipi',
  'Müşteri Kodu',
  'TC',
  'Vergi No',
  'Pasaport No',
  'Vergi Dairesi',
  'Ünvan',
  'E-Posta',
  'Telefon',
  'Adres',
  'Kullanıcı Ad Soyad',
  'Kullanıcı E-Posta',
  'Kullanıcı Telefon',
] as const;

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Excel `="123"` hücrelerini düz metne çevir */
function cellText(raw: string) {
  let s = raw.trim();
  if (s.startsWith('="') && s.endsWith('"')) s = s.slice(2, -1);
  else if (s.startsWith('=') && s.length > 1) s = s.slice(1);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.replace(/""/g, '"').trim();
}

function digits(s: string) {
  return s.replace(/\D/g, '');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(cellText);
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
}

function headerIndex(headers: string[]) {
  const norm = headers.map((h) => h.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim());
  const find = (...aliases: string[]) => {
    const al = aliases.map((a) => a.toLocaleLowerCase('tr'));
    return norm.findIndex((h) => al.some((a) => h === a));
  };
  return {
    accountType: find('cari tipi'),
    code: find('müşteri kodu', 'musteri kodu', 'kod'),
    tc: find('tc'),
    taxNo: find('vergi no'),
    passport: find('pasaport no', 'pasaport'),
    taxOffice: find('vergi dairesi'),
    title: find('ünvan', 'unvan'),
    email: find('e-posta', 'eposta', 'email'),
    phone: find('telefon'),
    address: find('adres'),
    userName: find('kullanıcı ad soyad', 'kullanici ad soyad'),
    userEmail: find('kullanıcı e-posta', 'kullanici e-posta'),
    userPhone: find('kullanıcı telefon', 'kullanici telefon'),
  };
}

function pick(cols: string[], idx: number) {
  if (idx < 0 || idx >= cols.length) return '';
  return cols[idx] ?? '';
}

function inferKind(tc: string, taxNo: string, passport: string): CustomerKind {
  if (passport) return 'yabanci';
  if (taxNo && !tc) return 'tuzel';
  return 'gercek';
}

function findExisting(list: Customer[], code: string, taxNo: string, identityNo: string, email: string) {
  const codeQ = code.toLocaleLowerCase('tr');
  const emailQ = email.toLocaleLowerCase('tr');
  const byCode = codeQ ? list.find((c) => c.code.toLocaleLowerCase('tr') === codeQ) : undefined;
  if (byCode) return { customer: byCode, label: 'Kod eşleşti' };

  const byTax =
    taxNo.length >= 8 ? list.find((c) => c.taxNo && digits(c.taxNo) === taxNo) : undefined;
  if (byTax) return { customer: byTax, label: 'Vergi no eşleşti' };

  const byId =
    identityNo.length >= 8
      ? list.find((c) => c.identityNo && digits(c.identityNo) === identityNo)
      : undefined;
  if (byId) return { customer: byId, label: 'TC / pasaport eşleşti' };

  const byEmail = emailQ ? list.find((c) => c.email.toLocaleLowerCase('tr') === emailQ) : undefined;
  if (byEmail) return { customer: byEmail, label: 'E-posta eşleşti' };

  return null;
}

export type ParseResult =
  | { ok: true; drafts: ImportDraft[]; fileName: string }
  | { ok: false; error: string };

/** CSV metnini önizleme satırlarına çevir */
export function parseCustomerImportCsv(
  text: string,
  existing: Customer[],
  fileName: string,
): ParseResult {
  const cleaned = stripBom(text).trim();
  if (!cleaned) return { ok: false, error: 'Dosya boş görünüyor.' };

  // Binary / xlsx sniff
  if (cleaned.includes('\u0000') || cleaned.startsWith('PK')) {
    return {
      ok: false,
      error: 'Bu dosya Excel ikili formatında. Lütfen CSV olarak kaydedin veya örnek CSV’yi kullanın.',
    };
  }

  const lines = splitLines(cleaned);
  if (lines.length < 2) {
    return { ok: false, error: 'Başlık + en az bir veri satırı gerekli.' };
  }

  const headerCols = parseCsvLine(lines[0]);
  const idx = headerIndex(headerCols);
  if (idx.code < 0 && idx.title < 0) {
    return {
      ok: false,
      error: 'Başlık satırı tanınmadı. Örnek dosyadaki sütun adlarını kullanın.',
    };
  }

  const drafts: ImportDraft[] = [];
  const seenCodes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const accountType = pick(cols, idx.accountType);
    const code = pick(cols, idx.code);
    const tc = digits(pick(cols, idx.tc));
    const taxNo = digits(pick(cols, idx.taxNo));
    const passport = pick(cols, idx.passport).replace(/\s/g, '');
    const taxOffice = pick(cols, idx.taxOffice);
    const title = pick(cols, idx.title);
    const email = pick(cols, idx.email);
    const phone = normalizePhoneInput(pick(cols, idx.phone));
    const address = pick(cols, idx.address);
    const userName = pick(cols, idx.userName);
    const userEmail = pick(cols, idx.userEmail);
    const userPhone = normalizePhoneInput(pick(cols, idx.userPhone));
    const identityNo = tc || passport;
    const kind = inferKind(tc, taxNo, passport);

    const errors: string[] = [];
    if (!code) errors.push('Müşteri kodu boş');
    if (!title) errors.push('Ünvan boş');
    if (code) {
      const key = code.toLocaleLowerCase('tr');
      if (seenCodes.has(key)) errors.push('Dosyada tekrarlayan kod');
      seenCodes.add(key);
    }

    let status: ImportStatus = errors.length ? 'invalid' : 'new';
    let matchLabel: string | undefined;
    let existingId: string | undefined;

    if (status === 'new') {
      const hit = findExisting(existing, code, taxNo, identityNo, email);
      if (hit) {
        status = 'exists';
        matchLabel = hit.label;
        existingId = hit.customer.id;
      }
    }

    drafts.push({
      row: i + 1,
      accountType,
      code,
      title,
      email,
      phone,
      taxNo: taxNo || (kind === 'gercek' ? tc : ''),
      taxOffice,
      identityNo,
      address,
      kind,
      userName,
      userEmail,
      userPhone,
      status,
      matchLabel,
      existingId,
      errors,
    });
  }

  if (drafts.length === 0) {
    return { ok: false, error: 'Aktarılacak satır bulunamadı.' };
  }

  return { ok: true, drafts, fileName };
}

export function draftsToCustomers(drafts: ImportDraft[], parentId: string | null): Customer[] {
  const stamp = Date.now();
  return drafts
    .filter((d) => d.status === 'new')
    .map((d, i) => ({
      id: `imp-${stamp}-${i}`,
      code: d.code,
      title: d.title,
      phone: d.phone,
      email: d.email,
      taxNo: d.taxNo,
      taxOffice: d.taxOffice,
      kind: d.kind,
      accountType: d.accountType,
      parentId,
      address: d.address,
      identityNo: d.identityNo,
    }));
}

export function summarizeDrafts(drafts: ImportDraft[]) {
  return {
    total: drafts.length,
    neu: drafts.filter((d) => d.status === 'new').length,
    exists: drafts.filter((d) => d.status === 'exists').length,
    invalid: drafts.filter((d) => d.status === 'invalid').length,
  };
}

export { HEADERS as IMPORT_HEADERS };
