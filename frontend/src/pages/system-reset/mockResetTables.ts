/** Sistem sıfırlama — tip + yardımcılar; liste API’den gelir */

export type ResetTable = {
  id: number;
  module: string;
  table: string;
  mysqlTable?: string;
  rows: number;
  cleared?: boolean;
};

export function formatRowCount(n: number) {
  return n.toLocaleString('tr-TR');
}
