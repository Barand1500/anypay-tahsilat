/** Banka kataloğu ve BIN eşlemesi. Taksit oranları API anlaşmalarından gelir. */

import { formatMoneyAmount, formatMoneyDisplay } from '../settings/personalPrefs';

export type BankInfo = {
  id: string;
  /** BIN kaydındaki sayısal banka_id — rates API ile public /installments aynı id */
  numericId?: string | null;
  name: string;
  /** Resmi / uzun unvan — taksit karşılaştırma başlığı */
  fullName: string;
  logo: string;
  /** Kart numarası başlangıçları (4–8 hane) */
  bins: string[];
};

export type CardSegment = 'bireysel' | 'ticari' | 'tumu' | 'serbest';

export type InstallmentRow = {
  n: number;
  /** Bankanın eklediği +taksit (örn. 1+2 → plusN=2) */
  plusN: number;
  commissionPct: number;
  installmentAmount: number;
  totalAmount: number;
  minLimit: number;
};

const L = (file: string) => `/banks/${file}`;

export const BANKS: BankInfo[] = [
  { id: 'akbank', name: 'Akbank', fullName: 'Akbank T.A.Ş.', logo: L('akbanktas_logo_1750065323.webp'), bins: [] },
  { id: 'garanti', name: 'Garanti BBVA', fullName: 'Türkiye Garanti Bankası A.Ş.', logo: L('tgarantibankasias_logo_1750065698.webp'), bins: [] },
  { id: 'isbank', name: 'İş Bankası', fullName: 'Türkiye İş Bankası A.Ş.', logo: L('tisbankasias_logo_1750066326.webp'), bins: [] },
  { id: 'yapikredi', name: 'Yapı Kredi', fullName: 'Yapı ve Kredi Bankası A.Ş.', logo: L('yapivekredibankasias_logo_1750065209.webp'), bins: [] },
  { id: 'qnb', name: 'QNB', fullName: 'QNB Bank A.Ş.', logo: L('qnbbankas_logo_1745577261.webp'), bins: [] },
  { id: 'ziraat', name: 'Ziraat Bankası', fullName: 'T.C. Ziraat Bankası A.Ş.', logo: L('tcziraatbankasias_logo_1760452109.webp'), bins: [] },
  { id: 'halkbank', name: 'Halkbank', fullName: 'Türkiye Halk Bankası A.Ş.', logo: L('thalkbankasias_logo_1750066038.webp'), bins: [] },
  { id: 'vakifbank', name: 'VakıfBank', fullName: 'Türkiye Vakıflar Bankası T.A.O.', logo: L('tvakiflarbankasitao_logo_1760452244.webp'), bins: [] },
  { id: 'denizbank', name: 'DenizBank', fullName: 'Denizbank A.Ş.', logo: L('denizbankas_logo_1760449984.webp'), bins: [] },
  { id: 'teb', name: 'TEB', fullName: 'Türk Ekonomi Ban kası A.Ş.', logo: L('turkekonomibankasias_logo_1760450968.webp'), bins: [] },
  { id: 'ing', name: 'ING', fullName: 'ING Bank A.Ş.', logo: L('ingbankas_logo_1765277010.webp'), bins: [] },
  { id: 'hsbc', name: 'HSBC', fullName: 'HSBC Bank A.Ş.', logo: L('hsbcbankas_logo_1760454176.webp'), bins: [] },
  { id: 'kuveytturk', name: 'Kuveyt Türk', fullName: 'Kuveyt Türk Katılım Bankası A.Ş.', logo: L('kuveytturkkatilimbankasias_logo_1765190779.webp'), bins: [] },
  { id: 'enpara', name: 'Enpara', fullName: 'Enpara.com QNB Finansbank A.Ş.', logo: L('enparabankas_logo_1758964639.webp'), bins: [] },
  { id: 'fibabanka', name: 'Fibabanka', fullName: 'Fibabanka A.Ş.', logo: L('fibabankaas_logo_1760450246.webp'), bins: [] },
  { id: 'odeabank', name: 'Odea Bank', fullName: 'Odea Bank A.Ş.', logo: L('odeabankas_logo_1765190878.webp'), bins: [] },
  { id: 'sekerbank', name: 'Şekerbank', fullName: 'Şekerbank T.A.Ş.', logo: L('sekerbanktas_logo_1765191415.webp'), bins: [] },
  { id: 'anadolubank', name: 'Anadolubank', fullName: 'Anadolubank A.Ş.', logo: L('anadolubankas_logo_1751546075.webp'), bins: [] },
  { id: 'alternatif', name: 'Alternatif Bank', fullName: 'Alternatifbank A.Ş.', logo: L('alternatifbankas_logo_1751546028.webp'), bins: [] },
  { id: 'albaraka', name: 'Albaraka Türk', fullName: 'Albaraka Türk Katılım Bankası A.Ş.', logo: L('albarakaturkkatilimbankasias_logo_1751545988.webp'), bins: [] },
  { id: 'turkiyefinans', name: 'Türkiye Finans', fullName: 'Türkiye Finans Katılım Bankası A.Ş.', logo: L('turkiyefinanskatilimbankasias_logo_1760450613.webp'), bins: [] },
  { id: 'vakifkatilim', name: 'Vakıf Katılım', fullName: 'Vakıf Katılım Bankası A.Ş.', logo: L('vakifkatilimbankasias_logo_1760450406.webp'), bins: [] },
  { id: 'ziraatkatilim', name: 'Ziraat Katılım', fullName: 'Ziraat Katılım Bankası A.Ş.', logo: L('ziraatkatilimbankasias_logo_1760450320.webp'), bins: [] },
  { id: 'papara', name: 'Papara', fullName: 'Papara Elektronik Para ve Ödeme Hizmetleri A.Ş.', logo: L('paparaelektronikparaveodemehizmetlerias_logo_1765191069.webp'), bins: [] },
  { id: 'tosla', name: 'Tosla', fullName: 'Tosla (Aktif Yatırım Bankası A.Ş.)', logo: L('tosla_logo_1765811180.webp'), bins: [] },
  { id: 'paytr', name: 'PayTR', fullName: 'PayTR Ödeme ve Elektronik Para Kuruluşu A.Ş.', logo: L('paytr_logo_1765811159.webp'), bins: [] },
  { id: 'iyzico', name: 'iyzico', fullName: 'iyzico Ödeme ve Elektronik Para Hizmetleri A.Ş.', logo: L('iyzico_logo_1765811144.webp'), bins: [] },
];

export function digitsOnly(s: string) {
  return s.replace(/\D/g, '');
}

export function formatCardNumber(raw: string) {
  const d = digitsOnly(raw).slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Kart üstü ad soyad — harf/boşluk, büyük harf */
export function formatCardHolderName(raw: string) {
  return raw
    .replace(/[^\p{L}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 48)
    .toLocaleUpperCase('tr-TR');
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

/** T.C. kimlik numarasının 10. ve 11. hane kontrol basamaklarını doğrular. */
export function isValidTurkishIdentityNo(value: string): boolean {
  if (!/^\d{11}$/.test(value) || value[0] === '0') return false;
  const digits = [...value].map(Number);
  const oddSum = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
  const evenSum = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
  const tenth = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return digits[9] === tenth && digits[10] === eleventh;
}

/** SKT girişi — ay 01–12’ye sıkıştırır, AA/YY formatlar */
export function formatExpiryInput(raw: string): string {
  const curY = new Date().getFullYear() % 100;
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
  // YY: mevcut yıldan küçük girilemesin (ay>12 gibi anlık düzelt)
  if (d.length >= 3) {
    const minFirst = Math.floor(curY / 10);
    let yyPart = d.slice(2);
    if (yyPart.length === 1) {
      const y1 = Number(yyPart[0]);
      if (!Number.isNaN(y1) && y1 < minFirst) yyPart = String(minFirst);
    }
    if (yyPart.length >= 2) {
      let yy = Number(yyPart.slice(0, 2));
      if (Number.isNaN(yy) || yy < curY) yy = curY;
      yyPart = String(yy).padStart(2, '0');
    }
    d = `${d.slice(0, 2)}${yyPart.slice(0, 2)}`;
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

export { formatMoneyAmount as formatMoneyTr, formatMoneyDisplay };

/** TR para metnini sayıya çevir (1.234,56 → 1234.56) */
export function parseTrMoney(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Yazarken otomatik TR para formatı — rakamlar kuruş olarak işlenir.
 * Örn. 1 → 0,01 · 100 → 1,00 · 100000 → 1.000,00
 */
export function maskMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '') || '';
  if (!digits) return '';
  const capped = digits.slice(0, 14);
  return formatMoneyAmount(Number(capped) / 100);
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

import { matchRuntimeBin, segmentFromBinKind } from '../../lib/binStore';
export { segmentFromBinKind };

function normalizeBankText(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** DB adı / slug → logo kataloğu (T. VAKIFLAR BANKASI → VakıfBank) */
function resolveBankFromName(bankName: string, bankId?: string): BankInfo | null {
  if (bankId) {
    const byId = BANKS.find((b) => b.id === bankId);
    if (byId) return byId;
  }
  const q = normalizeBankText(bankName);
  if (!q) return null;

  const hints: [string, string][] = [
    ['vakifbank', 'vakif'],
    ['garanti', 'garanti'],
    ['akbank', 'akbank'],
    ['isbank', 'is bank'],
    ['yapikredi', 'yapi'],
    ['qnb', 'qnb'],
    ['qnb', 'finansbank'],
    ['ziraat', 'ziraat'],
    ['halkbank', 'halk'],
    ['denizbank', 'deniz'],
    ['teb', 'teb'],
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
  let bestId = '';
  let bestLen = 0;
  for (const [id, hint] of hints) {
    if (q.includes(hint) && hint.length > bestLen) {
      bestId = id;
      bestLen = hint.length;
    }
  }
  if (bestId) {
    const hit = BANKS.find((b) => b.id === bestId);
    if (hit) return hit;
  }

  for (const b of BANKS) {
    const n = normalizeBankText(b.name);
    const f = normalizeBankText(b.fullName);
    if ((n && q.includes(n)) || (f && (q.includes(f) || f.includes(q)))) return b;
  }
  return null;
}

export function detectBank(cardDigits: string): BankInfo | null {
  const d = digitsOnly(cardDigits);
  if (d.length < 4) return null;

  // Api Ayarları › BIN (DB) — varsa öncelikli
  const runtime = matchRuntimeBin(d);
  if (runtime) {
    const numericId =
      runtime.bankId && /^\d+$/.test(String(runtime.bankId))
        ? String(runtime.bankId)
        : null;
    const resolved = resolveBankFromName(runtime.bankName, runtime.bankId);
    if (resolved) return { ...resolved, numericId };
    return {
      id: numericId || `bin-${runtime.bin}`,
      numericId,
      name: runtime.bankName,
      fullName: runtime.bankName,
      logo: '',
      bins: [],
    };
  }

  return null;
}

/** Kart BIN Tür → bireysel | ticari (yoksa null) */
export function detectCardSegment(cardDigits: string): CardSegment | null {
  const runtime = matchRuntimeBin(digitsOnly(cardDigits));
  return segmentFromBinKind(runtime?.kind ?? '') ?? null;
}

/** Karşılaştırma modalı için birkaç banka */
