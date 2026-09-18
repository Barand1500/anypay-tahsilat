/** Sürüm geçmişi — mock */

export type VersionChangeKind = 'added' | 'fixed' | 'changed';

export type VersionEntry = {
  id: string;
  version: string;
  kind: VersionChangeKind;
  /** Ana açıklama satırları */
  items: string[];
  /** ISO tarih */
  at: string;
};

export const VERSION_KIND_LABEL: Record<VersionChangeKind, string> = {
  added: 'Eklenenler',
  fixed: 'Düzeltilenler',
  changed: 'Değişenler',
};

export const INITIAL_VERSIONS: VersionEntry[] = [
  {
    id: 'v-1-2',
    version: '1.2',
    kind: 'added',
    items: [
      'Başarılı Tahsilat İşlemlerinde, Otomatik Dekont Gönderim Özelliği Eklendi.',
    ],
    at: '2026-09-10T20:12:00',
  },
  {
    id: 'v-1-1',
    version: '1.1',
    kind: 'added',
    items: ['Vakıfbank Sanal POS Alt Yapısı Güncellendi.'],
    at: '2026-09-10T17:02:00',
  },
  {
    id: 'v-1-0-5',
    version: '1.0.5',
    kind: 'fixed',
    items: [
      'Ödeme istekleri listesinde sayfalama kayması giderildi.',
      'Profil tema geçişinde kısa donma hissi iyileştirildi.',
    ],
    at: '2026-08-22T11:40:00',
  },
  {
    id: 'v-1-0-2',
    version: '1.0.2',
    kind: 'changed',
    items: ['Rapor ekranı iskeleti hazırlandı (yakında).'],
    at: '2026-07-14T09:15:00',
  },
  {
    id: 'v-1-0',
    version: '1.0',
    kind: 'fixed',
    items: ['Başlangıç.'],
    at: '2026-06-01T14:20:00',
  },
];

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

/** "10 Eylül 2026 20:12" */
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
