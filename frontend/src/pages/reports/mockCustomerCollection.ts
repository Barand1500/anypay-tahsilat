/** Müşteri Tahsilat Raporu — mock */

export type CustomerCollectionRow = {
  id: string;
  title: string;
  count: number;
  total: number;
  branch: string;
  userId: string;
};

export const INITIAL_CUSTOMER_COLLECTION: CustomerCollectionRow[] = [
  {
    id: 'cc1',
    title: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
    count: 14,
    total: 89500,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'cc2',
    title: 'İSMAİL YILMAZ',
    count: 8,
    total: 95100,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'cc3',
    title: 'ANADOLU MARKET A.Ş.',
    count: 11,
    total: 67200,
    branch: 'İstanbul Anadolu',
    userId: 'u2',
  },
  {
    id: 'cc4',
    title: 'MAVİ DENİZ LTD.',
    count: 5,
    total: 28450,
    branch: 'İzmir',
    userId: 'u1',
  },
  {
    id: 'cc5',
    title: 'EGE YAZILIM',
    count: 6,
    total: 19800,
    branch: 'Ankara',
    userId: 'u3',
  },
  {
    id: 'cc6',
    title: 'ATLAS PERAKENDE',
    count: 4,
    total: 15600,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'cc7',
    title: 'NİLÜFER GIDA',
    count: 3,
    total: 12200,
    branch: 'Muhasebe Departmanı',
    userId: 'u1',
  },
  {
    id: 'cc8',
    title: 'OLCA MARKET ANTALYA',
    count: 7,
    total: 34100,
    branch: 'Satış Departmanı',
    userId: 'u2',
  },
  {
    id: 'cc9',
    title: 'KARADENİZ LOJİSTİK',
    count: 2,
    total: 8900,
    branch: 'Merkez',
    userId: 'u3',
  },
  {
    id: 'cc10',
    title: 'SİNAN OLCA',
    count: 9,
    total: 41250,
    branch: 'Merkez',
    userId: 'u4',
  },
  {
    id: 'cc11',
    title: 'TEST MÜŞTERİ',
    count: 1,
    total: 2500,
    branch: 'Merkez',
    userId: 'u2',
  },
];

export function avgOf(row: CustomerCollectionRow) {
  return row.count > 0 ? row.total / row.count : 0;
}

/** Filtre sapması — mock */
export function scaleCustomerRows(
  rows: CustomerCollectionRow[],
  opts: { year: string; months: string[]; fullYear: boolean; branch: string | null; userId: string | null },
): CustomerCollectionRow[] {
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
      const total = Math.max(100, Math.round(r.total * yFactor * mFactor));
      const count = Math.max(1, Math.round(r.count * yFactor * (opts.fullYear ? 1 : 0.85)));
      return { ...r, total, count };
    })
    .sort((a, b) => b.total - a.total);
}
