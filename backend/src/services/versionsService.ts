import { prisma } from '../lib/prisma.js';

export type VersionChangeKind = 'added' | 'fixed' | 'removed';

export type VersionSection = {
  kind: VersionChangeKind;
  items: string[];
};

export type PublicVersion = {
  id: number;
  version: string;
  at: string;
  sections: VersionSection[];
  /** Ham durum / soft-delete — UI şimdilik göstermeyebilir */
  durum: boolean | null;
  remove: boolean | null;
};

function splitLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** double → "1" / "1.1" / "2" */
export function formatVersionNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function toPublic(row: {
  id: number;
  tarih: Date;
  versionNumarasi: number;
  eklenen: string | null;
  cikartilan: string | null;
  duzeltilen: string | null;
  durum: boolean | null;
  remove: boolean | null;
}): PublicVersion {
  const sections: VersionSection[] = [];
  const added = splitLines(row.eklenen);
  const fixed = splitLines(row.duzeltilen);
  const removed = splitLines(row.cikartilan);
  if (added.length) sections.push({ kind: 'added', items: added });
  if (fixed.length) sections.push({ kind: 'fixed', items: fixed });
  if (removed.length) sections.push({ kind: 'removed', items: removed });

  return {
    id: row.id,
    version: formatVersionNumber(row.versionNumarasi),
    at: row.tarih.toISOString(),
    sections,
    durum: row.durum,
    remove: row.remove,
  };
}

/** Filtre yok — tablodaki tüm satırlar (pattern sonra) */
export async function listVersions(): Promise<PublicVersion[]> {
  try {
    const { getBinSourceSettings, fetchRemoteVersions } = await import(
      './binSourceSettingsService.js'
    );
    const src = await getBinSourceSettings();
    if (src.source === 'remote') {
      const remote = await fetchRemoteVersions();
      return remote.map((r, i) => {
        const sections: VersionSection[] = [];
        const added = splitLines(r.added);
        const fixed = splitLines(r.fixed);
        const removed = splitLines(r.removed);
        if (added.length) sections.push({ kind: 'added', items: added });
        if (fixed.length) sections.push({ kind: 'fixed', items: fixed });
        if (removed.length) sections.push({ kind: 'removed', items: removed });
        const at = r.releasedAt
          ? new Date(r.releasedAt).toISOString()
          : new Date(0).toISOString();
        return {
          id: Number(r.id) || i + 1,
          version: r.version,
          at: Number.isNaN(Date.parse(at)) ? new Date().toISOString() : at,
          sections,
          durum: true,
          remove: false,
        };
      });
    }
  } catch {
    const { getBinSourceSettings } = await import('./binSourceSettingsService.js');
    const src = await getBinSourceSettings().catch(() => null);
    if (src?.source === 'remote') return [];
  }

  const rows = await prisma.surumler.findMany({
    orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toPublic);
}
