/** Tanımlamalar › Şubeler / Departmanlar — tipler (API canlı) */

export type BranchDef = {
  id: string;
  name: string;
  /** Boş = özel kısıt yok */
  installments: number[];
};

export const BRANCH_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

export function formatBranchInstallments(list: number[]) {
  if (!list.length) return '—';
  return [...list].sort((a, b) => a - b).join(', ');
}
