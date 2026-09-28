/** Api Ayarları BIN listesi — ödeme ekranında kart → banka (runtime) */

export type RuntimeBin = {
  bin: string;
  bankId: string;
  bankName: string;
};

let store: RuntimeBin[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const cb of listeners) cb();
}

export function setRuntimeBins(rows: RuntimeBin[]) {
  store = rows
    .map((r) => ({
      bin: r.bin.replace(/\D/g, ''),
      bankId: r.bankId,
      bankName: r.bankName,
    }))
    .filter((r) => r.bin.length >= 4)
    .sort((a, b) => b.bin.length - a.bin.length);
  notify();
}

export function getRuntimeBins() {
  return store.slice();
}

export function getBinsVersion() {
  return version;
}

export function subscribeBins(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function matchRuntimeBin(cardDigits: string): RuntimeBin | null {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;
  for (const row of store) {
    if (d.startsWith(row.bin)) return row;
  }
  return null;
}
