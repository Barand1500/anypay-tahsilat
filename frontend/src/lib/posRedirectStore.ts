/** Ortak Sanal POS yönlendirme + varsayılan Sanal POS — Banka & Taksit logosu */

export type PosRedirect = {
  sourceBankId: string;
  sourceBankName: string;
  targetBankId: string;
  targetBankName: string;
  targetBankLogoUrl: string;
};

export type DefaultPosBrand = {
  bankId: string;
  bankName: string;
  bankLogoUrl: string;
};

let redirects: PosRedirect[] = [];
let defaultPos: DefaultPosBrand | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const cb of listeners) cb();
}

export function setPosDisplayMeta(opts: {
  redirects?: PosRedirect[] | null;
  defaultPos?: DefaultPosBrand | null;
}) {
  if (opts.redirects != null) {
    redirects = opts.redirects
      .filter((r) => r.sourceBankId && r.targetBankId && r.sourceBankId !== r.targetBankId)
      .map((r) => ({
        sourceBankId: String(r.sourceBankId),
        sourceBankName: (r.sourceBankName || '').trim(),
        targetBankId: String(r.targetBankId),
        targetBankName: (r.targetBankName || '').trim(),
        targetBankLogoUrl: (r.targetBankLogoUrl || '').trim(),
      }));
  }
  if (opts.defaultPos !== undefined) {
    defaultPos = opts.defaultPos
      ? {
          bankId: String(opts.defaultPos.bankId || ''),
          bankName: (opts.defaultPos.bankName || '').trim(),
          bankLogoUrl: (opts.defaultPos.bankLogoUrl || '').trim(),
        }
      : null;
  }
  notify();
}

/** @deprecated setPosDisplayMeta kullan */
export function setPosRedirects(rows: PosRedirect[]) {
  setPosDisplayMeta({ redirects: rows });
}

export function getPosRedirects() {
  return redirects.slice();
}

export function getDefaultPosBrand() {
  return defaultPos;
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
