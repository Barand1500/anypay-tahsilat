/** Türkiye adres seçimleri — mock (API sonra) */

export type LocOption = { value: string; label: string };

export const COUNTRIES: LocOption[] = [{ value: 'TR', label: 'Türkiye' }];

export const PROVINCES: LocOption[] = [
  { value: '06', label: 'Ankara' },
  { value: '07', label: 'Antalya' },
  { value: '16', label: 'Bursa' },
  { value: '34', label: 'İstanbul' },
  { value: '35', label: 'İzmir' },
  { value: '60', label: 'Tokat' },
];

const DISTRICTS: Record<string, LocOption[]> = {
  '06': [
    { value: 'cankaya', label: 'Çankaya' },
    { value: 'yenimahalle', label: 'Yenimahalle' },
    { value: 'kecioren', label: 'Keçiören' },
  ],
  '07': [
    { value: 'muratpasa', label: 'Muratpaşa' },
    { value: 'kepez', label: 'Kepez' },
    { value: 'konyaalti', label: 'Konyaaltı' },
  ],
  '16': [
    { value: 'nilufer', label: 'Nilüfer' },
    { value: 'osmangazi', label: 'Osmangazi' },
    { value: 'yildirim', label: 'Yıldırım' },
  ],
  '34': [
    { value: 'kadikoy', label: 'Kadıköy' },
    { value: 'besiktas', label: 'Beşiktaş' },
    { value: 'uskudar', label: 'Üsküdar' },
  ],
  '35': [
    { value: 'karsiyaka', label: 'Karşıyaka' },
    { value: 'bornova', label: 'Bornova' },
    { value: 'konak', label: 'Konak' },
  ],
  '60': [
    { value: 'zile', label: 'Zile' },
    { value: 'merkez', label: 'Merkez' },
    { value: 'turhal', label: 'Turhal' },
  ],
};

const NEIGHBORHOODS: Record<string, LocOption[]> = {
  zile: [
    { value: 'yunusemre', label: 'Yunus Emre' },
    { value: 'barbaros', label: 'Barbaros' },
    { value: 'cumhuriyet', label: 'Cumhuriyet' },
  ],
  kepez: [
    { value: 'yeniemek', label: 'Yeni Emek' },
    { value: 'gulsaran', label: 'Gülseren' },
  ],
  kadikoy: [
    { value: 'caferaga', label: 'Caferağa' },
    { value: 'moda', label: 'Moda' },
  ],
  cankaya: [
    { value: 'kızılay', label: 'Kızılay' },
    { value: 'bahcelievler', label: 'Bahçelievler' },
  ],
};

export function districtsOf(provinceCode: string | null): LocOption[] {
  if (!provinceCode) return [];
  return DISTRICTS[provinceCode] ?? [];
}

export function neighborhoodsOf(districtCode: string | null): LocOption[] {
  if (!districtCode) return [];
  return (
    NEIGHBORHOODS[districtCode] ?? [
      { value: 'merkez-mh', label: 'Merkez Mahalle' },
      { value: 'yeni-mh', label: 'Yeni Mahalle' },
    ]
  );
}

/** Semt — ilçe ile aynı havuz (mock) */
export function quartersOf(districtCode: string | null): LocOption[] {
  return neighborhoodsOf(districtCode).map((n) => ({
    value: `semt-${n.value}`,
    label: n.label.includes('Mahalle') ? n.label.replace(' Mahalle', '') : `${n.label} Semt`,
  }));
}
