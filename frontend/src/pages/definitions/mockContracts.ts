/** Tanımlamalar › Sözleşmeler — şablon + footer bağlantısı */

export type ContractLinkId =
  | 'none'
  | 'kvkk'
  | 'hizmet'
  | 'guvenlik'
  | 'tahsilat'
  | 'iptal-iade'
  | 'iletisim'
  | 'uyelik';

export type ContractDef = {
  id: string;
  name: string;
  /** HTML veya düz metin; #degisken# yer tutucuları */
  body: string;
  link: ContractLinkId;
  order: number;
};

export const CONTRACT_LINK_OPTIONS: { id: ContractLinkId; label: string }[] = [
  { id: 'none', label: 'Bağlantı yok' },
  { id: 'kvkk', label: 'KVKK ve Aydınlatma Metni' },
  { id: 'hizmet', label: 'Hizmet Sözleşmesi' },
  { id: 'guvenlik', label: 'Güvenlik Bilgilendirmesi' },
  { id: 'tahsilat', label: 'Tahsilat Sözleşmesi' },
  { id: 'iptal-iade', label: 'İptal ve İade Politikası' },
  { id: 'iletisim', label: 'İletişim Bilgileri' },
  { id: 'uyelik', label: 'Üyelik Sözleşmesi' },
];

export const COMPANY_VARS = [
  'webSitesi',
  'unvan',
  'vergiTCNo',
  'vergiDairesi',
  'adres',
  'eposta',
  'telefon',
  'gsm',
  'fax',
] as const;

export const CUSTOMER_VARS = [
  'musteriKodu',
  'musteriVergiTCPassPortNo',
  'musteriVergiDairesi',
  'musteriUnvanAdSoyad',
  'musteriTelefon',
  'musteriEposta',
  'musteriAdres',
] as const;

export type ContractVarMap = Record<string, string>;

const LS_KEY = 'anypay.contracts.v1';

/** KVKK şablon (yönetim ekranı) — #unvan# vb. */
/** Eski localStorage — bir kerelik sunucu göçü için */
export function readLocalContractsForMigrate(): ContractDef[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContractDef[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const normalized = parsed
      .filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string')
      .map((x, i) => ({
        id: x.id,
        name: x.name,
        body: typeof x.body === 'string' ? x.body : '',
        link: (CONTRACT_LINK_OPTIONS.some((o) => o.id === x.link) ? x.link : 'none') as ContractLinkId,
        order: typeof x.order === 'number' ? x.order : i,
      }))
      .sort((a, b) => a.order - b.order);
    if (!normalized.some((c) => c.body.trim())) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function clearLocalContractsCache() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* */
  }
}

export function resolveContractVars(text: string, vars: ContractVarMap): string {
  const byLower: ContractVarMap = {};
  for (const [k, v] of Object.entries(vars)) {
    byLower[k.toLocaleLowerCase('tr')] = v;
  }
  return text.replace(/#([a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+)#/g, (_, key: string) => {
    const v = vars[key] ?? byLower[key.toLocaleLowerCase('tr')];
    return v != null && String(v).trim() !== '' ? String(v) : `#${key}#`;
  });
}

/** Footer için şirket değişkenleri (iletişim ayarlarından) */
export function getCompanyContractVars(contact: Partial<{ title: string; taxNo: string; taxOffice: string; identityNo: string; address: string; email: string; phone: string; gsm: string; website: string; fax: string }>): ContractVarMap {
  return {
    webSitesi: contact.website || contact.fax || '',
    unvan: contact.title || '',
    vergiTCNo: contact.taxNo || contact.identityNo || '',
    vergiDairesi: contact.taxOffice || '',
    adres: contact.address || '',
    eposta: contact.email || '',
    telefon: contact.phone || '',
    gsm: contact.gsm || '',
    fax: contact.fax || '',
  };
}

/** Tahsilat / ödeme — müşteri değişkenleri (#musteriUnvanAdSoyad# vb.) */
export function getCustomerContractVars(
  customer: Partial<{
    code: string;
    title: string;
    taxNo: string;
    identityNo: string;
    taxOffice: string;
    address: string;
    phone: string;
    email: string;
  }>,
): ContractVarMap {
  const taxOrId = (customer.taxNo || customer.identityNo || '').trim();
  return {
    musteriKodu: (customer.code || '').trim(),
    musteriVergiTCPassPortNo: taxOrId,
    musteriVergiDairesi: (customer.taxOffice || '').trim(),
    musteriUnvanAdSoyad: (customer.title || '').trim(),
    musteriTelefon: (customer.phone || '').replace(/\D/g, '').slice(-10),
    musteriEposta: (customer.email || '').trim(),
    musteriAdres: (customer.address || '').trim(),
  };
}
