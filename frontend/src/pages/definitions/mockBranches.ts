/** Tanımlamalar › Şubeler / Departmanlar — mock */

export type BranchDef = {
  id: string;
  name: string;
  /** Boş = özel kısıt yok */
  installments: number[];
};

export const BRANCH_INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

export const INITIAL_BRANCHES: BranchDef[] = [
  { id: 'br-merkez', name: 'MERKEZ', installments: [] },
  { id: 'br-teknopark', name: 'TEKNOPARK', installments: [] },
];

const DEFS_KEY = 'anypay_tahsilat_branch_defs';

function normalize(row: Partial<BranchDef> & { id: string; name: string }): BranchDef {
  return {
    id: row.id,
    name: row.name,
    installments: Array.isArray(row.installments) ? row.installments.filter((n) => typeof n === 'number') : [],
  };
}

export function loadBranches(): BranchDef[] {
  try {
    const raw = localStorage.getItem(DEFS_KEY);
    if (!raw) return [...INITIAL_BRANCHES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...INITIAL_BRANCHES];
    return parsed
      .filter(
        (x): x is Partial<BranchDef> & { id: string; name: string } =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as BranchDef).id === 'string' &&
          typeof (x as BranchDef).name === 'string',
      )
      .map(normalize);
  } catch {
    return [...INITIAL_BRANCHES];
  }
}

export function saveBranches(list: BranchDef[]) {
  localStorage.setItem(DEFS_KEY, JSON.stringify(list));
}

/** Kullanıcı / rapor filtreleri için isim listesi */
export function getBranchNames(): string[] {
  return loadBranches().map((b) => b.name);
}

export function formatBranchInstallments(list: number[]) {
  if (!list.length) return '—';
  return [...list].sort((a, b) => a - b).join(', ');
}
