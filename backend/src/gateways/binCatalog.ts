/** Kart BIN → banka anahtarı (UI ile aynı mantık; DB adıyla eşlenir) */

type BinEntry = { key: string; bins: string[]; nameHints: string[] };

const CATALOG: BinEntry[] = [
  { key: 'akbank', bins: ['5168', '5571', '5526', '4320'], nameHints: ['akbank'] },
  { key: 'garanti', bins: ['5406', '5549', '4824', '5209'], nameHints: ['garanti'] },
  { key: 'isbank', bins: ['4508', '4543', '5430', '5101'], nameHints: ['iş bank', 'is bank', 'isbank'] },
  { key: 'yapikredi', bins: ['4506', '5400', '4796', '6761'], nameHints: ['yapı', 'yapi', 'yapikredi'] },
  { key: 'qnb', bins: ['4159', '4022', '5311', '5218'], nameHints: ['qnb', 'finansbank'] },
  { key: 'ziraat', bins: ['5310', '9792'], nameHints: ['ziraat'] },
  { key: 'halkbank', bins: ['5528'], nameHints: ['halk'] },
  { key: 'vakifbank', bins: ['4938', '5421', '4111'], nameHints: ['vakıf', 'vakif'] },
  { key: 'denizbank', bins: ['4766'], nameHints: ['deniz'] },
  { key: 'teb', bins: ['4402', '5127'], nameHints: ['teb', 'ekonomi'] },
  { key: 'ing', bins: ['4555'], nameHints: ['ing'] },
  { key: 'hsbc', bins: ['4059', '5504'], nameHints: ['hsbc'] },
  { key: 'kuveytturk', bins: ['4025', '5188'], nameHints: ['kuveyt'] },
  { key: 'fibabanka', bins: ['5222'], nameHints: ['fiba'] },
  { key: 'odeabank', bins: ['5892'], nameHints: ['odea'] },
  { key: 'sekerbank', bins: ['4894'], nameHints: ['şeker', 'seker'] },
  { key: 'anadolubank', bins: ['5586'], nameHints: ['anadolu'] },
  { key: 'alternatif', bins: ['4662'], nameHints: ['alternatif'] },
  { key: 'albaraka', bins: ['4320'], nameHints: ['albaraka'] },
  { key: 'turkiyefinans', bins: [], nameHints: ['türkiye finans', 'turkiye finans'] },
  { key: 'tosla', bins: [], nameHints: ['tosla'] },
];

export function matchBinKey(cardDigits: string): string | null {
  const d = cardDigits.replace(/\D/g, '');
  if (d.length < 4) return null;
  let best: string | null = null;
  let bestLen = 0;
  for (const entry of CATALOG) {
    for (const bin of entry.bins) {
      if (d.startsWith(bin) && bin.length > bestLen) {
        best = entry.key;
        bestLen = bin.length;
      }
    }
  }
  return best;
}

export function hintsForKey(key: string): string[] {
  return CATALOG.find((c) => c.key === key)?.nameHints ?? [key];
}

export function normalizeBankText(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
