/** Tahsilat Raporu — tipler + yardımcılar */

export type CollectionRow = {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  collectionDate: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  amount: number;
  commission: number;
  branch: string;
  userId: string;
  userName: string;
};

export const REPORT_TYPE_OPTIONS = [
  { value: 'ozet', label: 'Özet' },
  { value: 'detay', label: 'Detay' },
  { value: 'gunluk', label: 'Günlük' },
] as const;

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function netOf(row: CollectionRow) {
  return row.amount - row.commission;
}

export function defaultMonthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}
