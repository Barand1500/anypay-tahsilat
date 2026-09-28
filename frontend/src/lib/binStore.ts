/** Api Ayarları BIN listesi — ödeme ekranında kart → banka (runtime) */

export type RuntimeBin = {
  bin: string;
  bankId: string;
  bankName: string;
};

let store: RuntimeBin[] = [];

export function setRuntimeBins(rows: RuntimeBin[]) {
  store = rows
    .map((r) => ({
      bin: r.bin.replace(/\D/g, ''),
      bankId: r.bankId,
      bankName: r.bankName,
    }))
    .filter((r) => r.bin.length >= 4)
    .sort((a, b) => b.bin.length - a.bin.length);
}

export function getRuntimeBins() {
  return store.slice();
}

export function matchRuntimeBin(cardDigits: string): RuntimeBin | null {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;
  for (const row of store) {
    if (d.startsWith(row.bin)) return row;
  }
  return null;
}
