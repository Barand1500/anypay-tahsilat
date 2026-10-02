import { INITIAL_MODULES } from '../pages/modules/mockModules';
import type { PermPage } from '../pages/roles/mockRoles';

/** Profil / kişisel — her zaman açık */
const ALWAYS_ALLOW = new Set(['/profil', '/ayarlar/kisisel']);

const LEGACY_PAGES: PermPage[] = INITIAL_MODULES.map((m) => ({
  id: m.id,
  name: m.name,
  urlPrefix: m.urlPrefix,
}));

export function normalizePath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] || '/';
  const trimmed = bare.replace(/\/+$/, '');
  return trimmed || '/';
}

/** Uygulama yolu ↔ eski PHP / modül route eşlemeleri */
export function pathCandidates(pathname: string): string[] {
  const p = normalizePath(pathname);
  const out = new Set<string>([p]);

  const add = (s: string) => out.add(normalizePath(s));

  if (p.includes('/tanimlamalar/pos-kart')) {
    add(p.replace('/tanimlamalar/pos-kart', '/tanimlamalar/bankalar'));
  }
  if (p.includes('/tanimlamalar/bankalar')) {
    add(p.replace('/tanimlamalar/bankalar', '/tanimlamalar/pos-kart'));
  }

  const posAliases: Array<[string, string]> = [
    ['/tanimlamalar/pos-kart/sanal-pos', '/tanimlamalar/bankalar/sanal-pos-tanimlari'],
    ['/tanimlamalar/pos-kart/ortak-sanal-pos', '/tanimlamalar/bankalar/ortak-sanalpos'],
    ['/tanimlamalar/pos-kart/anlasmalar', '/tanimlamalar/bankalar/kart-anlasmalari'],
    ['/tanimlamalar/pos-kart/tipler', '/tanimlamalar/bankalar/kart-tipleri'],
    ['/tanimlamalar/pos-kart/turler', '/tanimlamalar/bankalar/kart-turleri'],
    ['/tanimlamalar/pos-kart/markalar', '/tanimlamalar/bankalar/kart-markalari'],
  ];
  for (const [modern, legacy] of posAliases) {
    for (const cur of [...out]) {
      if (cur === modern || cur.startsWith(`${modern}/`)) add(cur.replace(modern, legacy));
      if (cur === legacy || cur.startsWith(`${legacy}/`)) add(cur.replace(legacy, modern));
    }
  }

  for (const cur of [...out]) {
    if (cur.includes('/anlasmalar')) {
      add(cur.replace('/anlasmalar', '/kart-anlasmalari'));
    }
    if (cur.includes('/kart-anlasmalari')) {
      add(cur.replace('/kart-anlasmalari', '/anlasmalar'));
    }
    if (cur.includes('/sanal-pos/') && cur.includes('/banka-anlasma')) {
      add('/tanimlamalar/bankalar/banka-kart-anlasmasi');
    }
    if (cur.includes('/sanal-pos/') && cur.includes('/musteri-anlasma')) {
      add('/tanimlamalar/bankalar/musteri-kart-anlasmasi');
    }
  }

  for (const cur of [...out]) {
    if (cur.startsWith('/tanimlamalar/subeler')) {
      add(cur.replace('/tanimlamalar/subeler', '/tanimlamalar/sube-departman'));
    }
    if (cur.startsWith('/tanimlamalar/sube-departman')) {
      add(cur.replace('/tanimlamalar/sube-departman', '/tanimlamalar/subeler'));
    }
  }

  for (const cur of [...out]) {
    add(cur.replace(/odeme[_-]iptal/gi, 'odeme iptal'));
    add(cur.replace(/odeme iptal/gi, 'odeme_iptal'));
    add(cur.replace(/odeme iptal/gi, 'odeme-iptal'));
  }

  return [...out];
}

export function isAlwaysAllowedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (ALWAYS_ALLOW.has(p)) return true;
  for (const allow of ALWAYS_ALLOW) {
    if (p === allow || p.startsWith(`${allow}/`)) return true;
  }
  return false;
}

/** En uzun urlPrefix eşleşen modül */
export function findModuleForPath(
  pathname: string,
  pages: PermPage[],
): PermPage | undefined {
  const candidates = pathCandidates(pathname);
  let best: PermPage | undefined;
  let bestLen = -1;

  for (const page of pages) {
    const prefix = normalizePath(page.urlPrefix || '');
    if (!prefix) continue;
    for (const path of candidates) {
      const match =
        prefix === '/'
          ? path === '/'
          : path === prefix || path.startsWith(`${prefix}/`);
      if (match && prefix.length > bestLen) {
        best = page;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

/**
 * Guard anahtarı: canlı sayısal id veya eski `m-*`.
 * `m-musteriler` → urlPrefix ile API modül id’sine çözülür.
 */
export function resolveModuleId(moduleId: string, pages: PermPage[]): string {
  if (!moduleId) return moduleId;
  if (pages.some((p) => p.id === moduleId)) return moduleId;

  const legacy = LEGACY_PAGES.find((p) => p.id === moduleId);
  if (!legacy) return moduleId;

  const hit = findModuleForPath(legacy.urlPrefix, pages);
  return hit?.id ?? moduleId;
}
