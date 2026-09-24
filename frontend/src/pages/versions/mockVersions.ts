/** Sürüm geçmişi — tip + yardımcılar; liste API’den gelir */

export type VersionChangeKind = 'added' | 'fixed' | 'removed';

export type VersionSection = {
  kind: VersionChangeKind;
  items: string[];
};

export type VersionEntry = {
  id: number;
  version: string;
  at: string;
  sections: VersionSection[];
  durum?: boolean | null;
  remove?: boolean | null;
};

export const VERSION_KIND_LABEL: Record<VersionChangeKind, string> = {
  added: 'Eklenenler',
  fixed: 'Düzeltilenler',
  removed: 'Çıkarılanlar',
};

/** Kart düğümü rengi — ilk dolu bölüm */
export function primaryKind(entry: VersionEntry): VersionChangeKind {
  return entry.sections[0]?.kind ?? 'fixed';
}

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export function formatVersionDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = TR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

export function splitVersionDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { day: '—', month: '', year: '', time: '' };
  }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: TR_MONTHS[d.getMonth()].slice(0, 3),
    year: String(d.getFullYear()),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}
