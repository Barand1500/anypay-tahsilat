/** Müşteri Kartı Tahsilat Raporu — banka bazlı mock */

export type CardCollectionRow = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  count: number;
  total: number;
  branch: string;
  userId: string;
};

const L = (file: string) => `/banks/${file}`;

export const INITIAL_CARD_COLLECTION: CardCollectionRow[] = [
  {
    id: 'kc1',
    bankId: 'halkbank',
    bankName: 'T. HALK BANKASI A.Ş.',
    bankLogo: L('thalkbankasias_logo_1750066038.webp'),
    count: 1,
    total: 8950,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'kc2',
    bankId: 'qnb',
    bankName: 'QNB BANK A.Ş.',
    bankLogo: L('qnbbankas_logo_1745577261.webp'),
    count: 12,
    total: 186400,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'kc3',
    bankId: 'kuveytturk',
    bankName: 'KUVEYT TÜRK KATILIM BANKASI A.Ş.',
    bankLogo: L('kuveytturkkatilimbankasias_logo_1765190779.webp'),
    count: 1,
    total: 35100,
    branch: 'İstanbul Anadolu',
    userId: 'u2',
  },
  {
    id: 'kc4',
    bankId: 'akbank',
    bankName: 'AKBANK T.A.Ş.',
    bankLogo: L('akbanktas_logo_1750065323.webp'),
    count: 5,
    total: 54200,
    branch: 'Merkez',
    userId: 'u1',
  },
  {
    id: 'kc5',
    bankId: 'garanti',
    bankName: 'T. GARANTİ BANKASI A.Ş.',
    bankLogo: L('tgarantibankasias_logo_1750065698.webp'),
    count: 4,
    total: 38900,
    branch: 'Ankara',
    userId: 'u3',
  },
  {
    id: 'kc6',
    bankId: 'isbank',
    bankName: 'TÜRKİYE İŞ BANKASI A.Ş.',
    bankLogo: L('tisbankasias_logo_1750066326.webp'),
    count: 3,
    total: 27100,
    branch: 'İzmir',
    userId: 'u2',
  },
  {
    id: 'kc7',
    bankId: 'yapikredi',
    bankName: 'YAPI VE KREDİ BANKASI A.Ş.',
    bankLogo: L('yapivekredibankasias_logo_1750065209.webp'),
    count: 2,
    total: 19850,
    branch: 'Merkez',
    userId: 'u4',
  },
];

export function avgOf(row: CardCollectionRow) {
  return row.count > 0 ? row.total / row.count : 0;
}

export function scaleCardRows(
  rows: CardCollectionRow[],
  opts: { year: string; months: string[]; fullYear: boolean; branch: string | null; userId: string | null },
): CardCollectionRow[] {
  const yFactor = opts.year === '2026' ? 1 : opts.year === '2025' ? 0.78 : 0.6;
  let mFactor = 1;
  if (!opts.fullYear && opts.months.length > 0) {
    mFactor = 0.65 + Math.min(opts.months.length, 12) * 0.04;
  }
  return rows
    .filter((r) => {
      if (opts.branch && r.branch !== opts.branch) return false;
      if (opts.userId && r.userId !== opts.userId) return false;
      return true;
    })
    .map((r) => {
      const total = Math.max(1, Math.round(r.total * yFactor * mFactor));
      const count = Math.max(1, Math.round(r.count * yFactor * (opts.fullYear ? 1 : 0.9)));
      return { ...r, total, count };
    })
    .sort((a, b) => b.total - a.total);
}
