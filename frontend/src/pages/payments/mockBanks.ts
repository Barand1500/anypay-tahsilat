/** BIN → banka eşlemesi + mock taksit oranları (UI; POS API sonra) */

export type BankInfo = {
  id: string;
  name: string;
  logo: string;
  /** Kart numarası başlangıçları (4–8 hane) */
  bins: string[];
};

export type CardSegment = 'bireysel' | 'ticari';

export type InstallmentRow = {
  n: number;
  commissionPct: number;
  installmentAmount: number;
  totalAmount: number;
  minLimit: number;
};

const L = (file: string) => `/banks/${file}`;

export const BANKS: BankInfo[] = [
  { id: 'akbank', name: 'Akbank', logo: L('akbanktas_logo_1750065323.webp'), bins: ['5168', '5571', '5526', '4320'] },
  { id: 'garanti', name: 'Garanti BBVA', logo: L('tgarantibankasias_logo_1750065698.webp'), bins: ['5406', '5549', '4824', '5209'] },
  { id: 'isbank', name: 'İş Bankası', logo: L('tisbankasias_logo_1750066326.webp'), bins: ['4508', '4543', '5430', '5101'] },
  { id: 'yapikredi', name: 'Yapı Kredi', logo: L('yapivekredibankasias_logo_1750065209.webp'), bins: ['4506', '5400', '4796', '6761'] },
  { id: 'qnb', name: 'QNB', logo: L('qnbbankas_logo_1745577261.webp'), bins: ['4159', '4022', '5311', '5218'] },
  { id: 'ziraat', name: 'Ziraat Bankası', logo: L('tcziraatbankasias_logo_1760452109.webp'), bins: ['4543', '5310', '9792'] },
  { id: 'halkbank', name: 'Halkbank', logo: L('thalkbankasias_logo_1750066038.webp'), bins: ['5528', '5430', '9792'] },
  { id: 'vakifbank', name: 'VakıfBank', logo: L('tvakiflarbankasitao_logo_1760452244.webp'), bins: ['4938', '5421', '4111'] },
  { id: 'denizbank', name: 'DenizBank', logo: L('denizbankas_logo_1760449984.webp'), bins: ['5218', '5430', '4766'] },
  { id: 'teb', name: 'TEB', logo: L('turkekonomibankasias_logo_1760450968.webp'), bins: ['4402', '5127'] },
  { id: 'ing', name: 'ING', logo: L('ingbankas_logo_1765277010.webp'), bins: ['4555', '5406'] },
  { id: 'hsbc', name: 'HSBC', logo: L('hsbcbankas_logo_1760454176.webp'), bins: ['4059', '5504'] },
  { id: 'kuveytturk', name: 'Kuveyt Türk', logo: L('kuveytturkkatilimbankasias_logo_1765190779.webp'), bins: ['4025', '5188'] },
  { id: 'enpara', name: 'Enpara', logo: L('enparabankas_logo_1758964639.webp'), bins: ['5353'] },
  { id: 'fibabanka', name: 'Fibabanka', logo: L('fibabankaas_logo_1760450246.webp'), bins: ['5222'] },
  { id: 'odeabank', name: 'Odea Bank', logo: L('odeabankas_logo_1765190878.webp'), bins: ['5892'] },
  { id: 'sekerbank', name: 'Şekerbank', logo: L('sekerbanktas_logo_1765191415.webp'), bins: ['4894'] },
  { id: 'anadolubank', name: 'Anadolubank', logo: L('anadolubankas_logo_1751546075.webp'), bins: ['5586'] },
  { id: 'alternatif', name: 'Alternatif Bank', logo: L('alternatifbankas_logo_1751546028.webp'), bins: ['4662'] },
  { id: 'albaraka', name: 'Albaraka Türk', logo: L('albarakaturkkatilimbankasias_logo_1751545988.webp'), bins: ['4320'] },
  { id: 'turkiyefinans', name: 'Türkiye Finans', logo: L('turkiyefinanskatilimbankasias_logo_1760450613.webp'), bins: ['5218'] },
  { id: 'vakifkatilim', name: 'Vakıf Katılım', logo: L('vakifkatilimbankasias_logo_1760450406.webp'), bins: ['6706'] },
  { id: 'ziraatkatilim', name: 'Ziraat Katılım', logo: L('ziraatkatilimbankasias_logo_1760450320.webp'), bins: ['6705'] },
  { id: 'papara', name: 'Papara', logo: L('paparaelektronikparaveodemehizmetlerias_logo_1765191069.webp'), bins: ['5351'] },
  { id: 'tosla', name: 'Tosla', logo: L('tosla_logo_1765811180.webp'), bins: ['9792'] },
  { id: 'paytr', name: 'PayTR', logo: L('paytr_logo_1765811159.webp'), bins: [] },
  { id: 'iyzico', name: 'iyzico', logo: L('iyzico_logo_1765811144.webp'), bins: [] },
];

/** Bireysel kart — taksit başına komisyon % (1…12) */
const BIREYSEL_PCT = [0, 5.34, 7.61, 9.2, 10.8, 12.4, 14.1, 15.9, 17.8, 19.9, 22.1, 24.6];
/** Ticari kart */
const TICARI_PCT = [0, 4.2, 6.1, 7.8, 9.4, 11.0, 12.7, 14.5, 16.4, 18.4, 20.5, 22.8];

export function digitsOnly(s: string) {
  return s.replace(/\D/g, '');
}

export function formatCardNumber(raw: string) {
  const d = digitsOnly(raw).slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Luhn (mod 10) — kart numarası checksum */
export function isValidLuhn(cardDigits: string): boolean {
  const d = digitsOnly(cardDigits);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

/** SKT girişi — ay 01–12’ye sıkıştırır, AA/YY formatlar */
export function formatExpiryInput(raw: string): string {
  let d = digitsOnly(raw).slice(0, 4);
  if (d.length >= 1) {
    const first = Number(d[0]);
    // 2–9 ile başlarsa ay tek hane → 0X
    if (d.length === 1 && first > 1) d = `0${d}`;
  }
  if (d.length >= 2) {
    let mm = Number(d.slice(0, 2));
    if (Number.isNaN(mm) || mm < 1) mm = 1;
    if (mm > 12) mm = 12;
    d = `${String(mm).padStart(2, '0')}${d.slice(2)}`;
  }
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** SKT hata metni; geçerliyse null */
export function getCardExpiryError(expiry: string): string | null {
  const d = digitsOnly(expiry);
  if (d.length !== 4) return 'SKT AA/YY girin';
  const mm = Number(d.slice(0, 2));
  const yy = Number(d.slice(2, 4));
  if (mm < 1 || mm > 12) return 'Ay 01–12 olmalı';
  const now = new Date();
  const curY = now.getFullYear() % 100;
  const curM = now.getMonth() + 1;
  if (yy < curY || (yy === curY && mm < curM)) return 'Geçmiş tarih olamaz';
  return null;
}

export function formatMoneyTr(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** İsim veya id ile logo bul — özet kartları / API sonrası */
export function findBankLogo(query: { id?: string; name?: string; logo?: string }): string | null {
  if (query.logo) return query.logo;
  const q = (query.id || query.name || '').trim().toLowerCase();
  if (!q) return null;
  const hit = BANKS.find(
    (b) =>
      b.id === q ||
      b.name.toLowerCase() === q ||
      b.name.toLowerCase().includes(q) ||
      q.includes(b.id),
  );
  return hit?.logo ?? null;
}

export function detectBank(cardDigits: string): BankInfo | null {
  const d = digitsOnly(cardDigits);
  if (d.length < 4) return null;
  let best: BankInfo | null = null;
  let bestLen = 0;
  for (const bank of BANKS) {
    for (const bin of bank.bins) {
      if (d.startsWith(bin) && bin.length > bestLen) {
        best = bank;
        bestLen = bin.length;
      }
    }
  }
  return best;
}

export function buildInstallments(
  amount: number,
  segment: CardSegment,
  bankId?: string,
): InstallmentRow[] {
  if (!amount || amount <= 0) return [];
  const base = segment === 'ticari' ? TICARI_PCT : BIREYSEL_PCT;
  // Bankaya göre hafif sapma (mock)
  const drift =
    bankId === 'akbank'
      ? 0
      : bankId === 'garanti'
        ? 0.15
        : bankId === 'qnb'
          ? -0.2
          : bankId === 'yapikredi'
            ? 0.1
            : 0.05;

  return base.map((pct, i) => {
    const n = i + 1;
    const commissionPct = Math.max(0, +(pct + drift).toFixed(2));
    const totalAmount = amount * (1 + commissionPct / 100);
    const installmentAmount = totalAmount / n;
    return {
      n,
      commissionPct,
      installmentAmount,
      totalAmount,
      minLimit: 0,
    };
  });
}

/** Karşılaştırma modalı için birkaç banka */
export function banksForCompare(preferredId?: string | null): BankInfo[] {
  const ids = ['qnb', 'akbank', 'garanti', 'yapikredi', 'isbank', 'ziraat'];
  const list = ids.map((id) => BANKS.find((b) => b.id === id)!).filter(Boolean);
  if (preferredId && !list.some((b) => b.id === preferredId)) {
    const p = BANKS.find((b) => b.id === preferredId);
    if (p) list.unshift(p);
  }
  return list.slice(0, 4);
}
