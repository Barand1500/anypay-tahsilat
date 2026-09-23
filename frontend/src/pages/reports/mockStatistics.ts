/** Raporlar › İstatistikler — mock; API sonrası canlı bağlanacak */

export type StatRankItem = {
  id: string;
  label: string;
  amount: number;
  color: string;
  /** Banka logosu */
  logo?: string;
  /** Kart satırı alt metin (maskeli kart vb.) */
  meta?: string;
};

export type StatisticsBundle = {
  customers: StatRankItem[];
  banks: StatRankItem[];
  cards: StatRankItem[];
};

const L = (file: string) => `/banks/${file}`;

/** Panel diline uyumlu, mor/krem AI klişesinden uzak palet */
export const STAT_PALETTE = [
  '#0d9488', // teal
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#0ea5e9', // sky
  '#475569', // slate
  '#14b8a6', // teal light
  '#1d4ed8', // indigo-blue
  '#65a30d', // lime
  '#b45309', // bronze
];

export const STAT_MONTHS = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

export const STAT_YEARS = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

function paint(items: Omit<StatRankItem, 'color'>[]): StatRankItem[] {
  return items.map((it, i) => ({ ...it, color: STAT_PALETTE[i % STAT_PALETTE.length]! }));
}

const BASE_CUSTOMERS: Omit<StatRankItem, 'color'>[] = [
  { id: 'c-isma', label: 'İSMAİL YILMAZ', amount: 95100 },
  { id: 'c-guzel', label: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ', amount: 42850 },
  { id: 'c-anadolu', label: 'ANADOLU MARKET A.Ş.', amount: 40200 },
  { id: 'c-mavi', label: 'MAVİ DENİZ LTD.', amount: 12750 },
  { id: 'c-ege', label: 'EGE YAZILIM', amount: 9800 },
  { id: 'c-atlas', label: 'ATLAS PERAKENDE', amount: 7200 },
  { id: 'c-nilufer', label: 'NİLÜFER GIDA', amount: 6100 },
  { id: 'c-olca', label: 'OLCA MARKET ANTALYA', amount: 4850 },
  { id: 'c-karadeniz', label: 'KARADENİZ LOJİSTİK', amount: 3900 },
  { id: 'c-sinan', label: 'SİNAN OLCA', amount: 2750 },
];

const BASE_BANKS: Omit<StatRankItem, 'color'>[] = [
  {
    id: 'qnb',
    label: 'QNB BANK A.Ş.',
    amount: 186400,
    logo: L('qnbbankas_logo_1745577261.webp'),
  },
  {
    id: 'akbank',
    label: 'AKBANK T.A.Ş.',
    amount: 54200,
    logo: L('akbanktas_logo_1750065323.webp'),
  },
  {
    id: 'garanti',
    label: 'T. GARANTİ BANKASI A.Ş.',
    amount: 38900,
    logo: L('tgarantibankasias_logo_1750065698.webp'),
  },
  {
    id: 'isbank',
    label: 'TÜRKİYE İŞ BANKASI A.Ş.',
    amount: 27100,
    logo: L('tisbankasias_logo_1750066326.webp'),
  },
  {
    id: 'yapikredi',
    label: 'YAPI VE KREDİ BANKASI A.Ş.',
    amount: 19850,
    logo: L('yapivekredibankasias_logo_1750065209.webp'),
  },
  {
    id: 'ziraat',
    label: 'T.C. ZİRAAT BANKASI A.Ş.',
    amount: 14200,
    logo: L('tcziraatbankasias_logo_1760452109.webp'),
  },
  {
    id: 'halkbank',
    label: 'TÜRKİYE HALK BANKASI A.Ş.',
    amount: 9650,
    logo: L('thalkbankasias_logo_1750066038.webp'),
  },
  {
    id: 'vakifbank',
    label: 'TÜRKİYE VAKIFLAR BANKASI T.A.O.',
    amount: 7800,
    logo: L('tvakiflarbankasitao_logo_1760452244.webp'),
  },
  {
    id: 'denizbank',
    label: 'DENİZBANK A.Ş.',
    amount: 5400,
    logo: L('denizbankas_logo_1760449984.webp'),
  },
  {
    id: 'teb',
    label: 'TÜRK EKONOMİ BANKASI A.Ş.',
    amount: 3100,
    logo: L('turkekonomibankasias_logo_1760450968.webp'),
  },
];

const BASE_CARDS: Omit<StatRankItem, 'color'>[] = [
  {
    id: 'card1',
    label: 'İSMAİL YILMAZ',
    meta: '•••• 8891',
    amount: 62400,
  },
  {
    id: 'card2',
    label: 'MEHMET ÇETİN ARKÖSE',
    meta: '•••• 4740',
    amount: 31200,
  },
  {
    id: 'card3',
    label: 'ANADOLU MARKET A.Ş.',
    meta: '•••• 1204',
    amount: 28750,
  },
  {
    id: 'card4',
    label: 'AYŞE DEMİR',
    meta: '•••• 6632',
    amount: 15400,
  },
  {
    id: 'card5',
    label: 'EGE YAZILIM',
    meta: '•••• 9011',
    amount: 11800,
  },
  {
    id: 'card6',
    label: 'ATLAS PERAKENDE',
    meta: '•••• 4450',
    amount: 9200,
  },
  {
    id: 'card7',
    label: 'NİLÜFER GIDA',
    meta: '•••• 7788',
    amount: 7650,
  },
  {
    id: 'card8',
    label: 'SİNAN OLCA',
    meta: '•••• 3340',
    amount: 5800,
  },
  {
    id: 'card9',
    label: 'KARADENİZ LOJİSTİK',
    meta: '•••• 2199',
    amount: 4100,
  },
  {
    id: 'card10',
    label: 'MAVİ DENİZ LTD.',
    meta: '•••• 5567',
    amount: 2950,
  },
];

/** Filtreye göre hafif sapma — mock “canlı” hissi */
function scaleAmount(n: number, year: string, months: string[], fullYear: boolean) {
  const yFactor = year === '2026' ? 1 : year === '2025' ? 0.82 : 0.64;
  let mFactor = 1;
  if (!fullYear && months.length > 0) {
    const avg = months.reduce((s, m) => s + (0.55 + (Number(m) / 12) * 0.5), 0) / months.length;
    mFactor = avg * (0.7 + Math.min(months.length, 12) * 0.05);
  }
  return Math.round(n * yFactor * mFactor);
}

export function getStatistics(opts: {
  year: string;
  months: string[];
  fullYear: boolean;
  branch: string | null;
  userId: string | null;
}): StatisticsBundle {
  const branchBias = opts.branch ? 0.88 + (opts.branch.length % 5) * 0.03 : 1;
  const userBias = opts.userId ? 0.9 + (opts.userId.charCodeAt(opts.userId.length - 1) % 7) * 0.02 : 1;
  const factor = branchBias * userBias;

  const map = (items: Omit<StatRankItem, 'color'>[]) =>
    paint(
      items
        .map((it) => ({
          ...it,
          amount: Math.max(
            100,
            Math.round(scaleAmount(it.amount, opts.year, opts.months, opts.fullYear) * factor),
          ),
        }))
        .sort((a, b) => b.amount - a.amount),
    );

  return {
    customers: map(BASE_CUSTOMERS),
    banks: map(BASE_BANKS),
    cards: map(BASE_CARDS),
  };
}

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const REPORT_SUBNAV = [
  { to: '/raporlar/istatistikler', label: 'İstatistikler', ready: true },
  { to: '/raporlar/tahsilat-raporu', label: 'Tahsilat Raporu', ready: true },
  { to: '/raporlar/musteri-tahsilat-raporu', label: 'Müşteri Tahsilat Raporu', ready: true },
  { to: '/raporlar/musteri-kart-tahsilat', label: 'Müşteri Kartı Tahsilat', ready: true },
  { to: '/raporlar/banka-tahsilat-raporu', label: 'Banka Tahsilat Raporu', ready: true },
  { to: '/raporlar/gonderim-gecmisi', label: 'Gönderim Geçmişi', ready: true },
] as const;
