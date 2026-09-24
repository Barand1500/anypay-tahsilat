/** Müşteri tipleri ve telefon yardımcıları */

export type CustomerKind = 'gercek' | 'tuzel' | 'yabanci';

export type Customer = {
  id: string;
  code: string;
  title: string;
  phone: string; // digits only
  email: string;
  taxNo: string;
  taxOffice: string;
  taxOfficeId?: number | null;
  kind: CustomerKind;
  accountType: string;
  accountTypeId?: number | null;
  parentId: string | null;
  address: string;
  identityNo: string; // TC veya pasaport
  childCount?: number;
};

export const CUSTOMER_KIND_OPTIONS: { value: CustomerKind; label: string; hint: string }[] = [
  { value: 'gercek', label: 'Gerçek', hint: 'Şahıs' },
  { value: 'tuzel', label: 'Tüzel', hint: 'Şirket' },
  { value: 'yabanci', label: 'Yabancı', hint: 'Pasaport' },
];

export function accountTypeExists(name: string, list: string[]): boolean {
  const q = name.trim().toLocaleLowerCase('tr');
  if (!q) return true;
  return list.some((t) => t.toLocaleLowerCase('tr') === q);
}

/** 5xx xxx xx xx */
export function formatPhoneLive(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

export function normalizePhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('5') && d.length > 0) d = `5${d}`.slice(0, 10);
  return d.slice(0, 10);
}
