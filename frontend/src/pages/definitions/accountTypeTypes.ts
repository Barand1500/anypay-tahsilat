/** Tanımlamalar › Cari Tipleri — tipler (API canlı) */

export type AccountTypeDef = {
  id: string;
  name: string;
  /** Boş = özel kısıt yok */
  installments: number[];
};

export const ACCOUNT_TYPE_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

export function formatInstallmentsLabel(list: number[]) {
  if (!list.length) return '—';
  return [...list].sort((a, b) => a - b).join(', ');
}
