/** Ortak Sanal POS yönlendirmeleri — Banka & Taksit logosu (Halkbank → QNB) */

export type PosRedirect = {
  sourceBankId: string;
  sourceBankName: string;
  targetBankId: string;
  targetBankName: string;
  targetBankLogoUrl: string;
};

let store: PosRedirect[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const cb of listeners) cb();
}

export function setPosRedirects(rows: PosRedirect[]) {
  store = rows
    .filter((r) => r.sourceBankId && r.targetBankId && r.sourceBankId !== r.targetBankId)
    .map((r) => ({
      sourceBankId: String(r.sourceBankId),
      sourceBankName: (r.sourceBankName || '').trim(),
      targetBankId: String(r.targetBankId),
      targetBankName: (r.targetBankName || '').trim(),
      targetBankLogoUrl: (r.targetBankLogoUrl || '').trim(),
    }));
  notify();
}

export function getPosRedirects() {
  return store.slice();
}

export function getPosRedirectsVersion() {
  return version;
}

export function subscribePosRedirects(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
