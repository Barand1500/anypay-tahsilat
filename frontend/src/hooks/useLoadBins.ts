import { useEffect } from 'react';
import { api } from '../lib/api';
import { setRuntimeBins, type RuntimeBin } from '../lib/binStore';

type CatalogRow = {
  bin: string;
  bankId: string;
  bank: string;
};

/** DB banka adı → logo kataloğu slug (T. VAKIFLAR… → vakifbank) */
function slugFromBankName(name: string): string {
  const q = name
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const hints: [string, string][] = [
    ['vakifbank', 'vakif'],
    ['garanti', 'garanti'],
    ['akbank', 'akbank'],
    ['isbank', 'is bank'],
    ['isbank', 'isbank'],
    ['yapikredi', 'yapi'],
    ['qnb', 'qnb'],
    ['qnb', 'finansbank'],
    ['ziraat', 'ziraat'],
    ['halkbank', 'halk'],
    ['denizbank', 'deniz'],
    ['teb', 'teb'],
    ['teb', 'ekonomi'],
    ['ing', 'ing'],
    ['hsbc', 'hsbc'],
    ['kuveytturk', 'kuveyt'],
    ['fibabanka', 'fiba'],
    ['odeabank', 'odea'],
    ['sekerbank', 'seker'],
    ['anadolubank', 'anadolu'],
    ['alternatif', 'alternatif'],
    ['albaraka', 'albaraka'],
    ['turkiyefinans', 'turkiye finans'],
    ['vakifkatilim', 'vakif katilim'],
    ['ziraatkatilim', 'ziraat katilim'],
    ['papara', 'papara'],
    ['tosla', 'tosla'],
    ['enpara', 'enpara'],
  ];
  let best = '';
  let bestLen = 0;
  for (const [slug, hint] of hints) {
    if (q.includes(hint) && hint.length > bestLen) {
      best = slug;
      bestLen = hint.length;
    }
  }
  return best;
}

function mapCatalog(rows: CatalogRow[]): RuntimeBin[] {
  return rows.map((r) => {
    const fromName = slugFromBankName(r.bank);
    return {
      bin: r.bin,
      bankId: fromName || r.bankId,
      bankName: r.bank,
    };
  });
}

/** Panel + public ödeme — Api Ayarları BIN kataloğunu yükler (auth gerekmez) */
export function useLoadBins() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.get<CatalogRow[]>('/api/bins/catalog');
        if (cancelled) return;
        setRuntimeBins(mapCatalog(list));
      } catch {
        if (!cancelled) setRuntimeBins([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
