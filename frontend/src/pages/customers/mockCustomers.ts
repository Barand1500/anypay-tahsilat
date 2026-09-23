/** Müşteriler — mock; API sonrası canlı bağlanacak */

export type CustomerKind = 'gercek' | 'tuzel' | 'yabanci';

export type Customer = {
  id: string;
  code: string;
  title: string;
  phone: string; // digits only
  email: string;
  taxNo: string;
  taxOffice: string;
  kind: CustomerKind;
  accountType: string;
  parentId: string | null;
  address: string;
  identityNo: string; // TC veya pasaport
};

export const CUSTOMER_KIND_OPTIONS: { value: CustomerKind; label: string; hint: string }[] = [
  { value: 'gercek', label: 'Gerçek', hint: 'Şahıs' },
  { value: 'tuzel', label: 'Tüzel', hint: 'Şirket' },
  { value: 'yabanci', label: 'Yabancı', hint: 'Pasaport' },
];

/** Varsayılan cari tipleri (Excel örneği + yaygın) */
export const DEFAULT_ACCOUNT_TYPES = ['Müşteri', 'Bayi', 'Alıcı', 'Satıcı', 'Alıcı / Satıcı'];

const ACCOUNT_TYPES_KEY = 'anypay_tahsilat_account_types';

export function getAccountTypes(): string[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_TYPES_KEY);
    if (!raw) return [...DEFAULT_ACCOUNT_TYPES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_ACCOUNT_TYPES];
    const list = parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    return list.length ? list : [...DEFAULT_ACCOUNT_TYPES];
  } catch {
    return [...DEFAULT_ACCOUNT_TYPES];
  }
}

export function addAccountType(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getAccountTypes();
  const current = getAccountTypes();
  const exists = current.some((t) => t.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'));
  if (exists) return current;
  const next = [trimmed, ...current];
  localStorage.setItem(ACCOUNT_TYPES_KEY, JSON.stringify(next));
  return next;
}

export function accountTypeExists(name: string, list?: string[]): boolean {
  const q = name.trim().toLocaleLowerCase('tr');
  if (!q) return true;
  const src = list ?? getAccountTypes();
  return src.some((t) => t.toLocaleLowerCase('tr') === q);
}

export const TAX_OFFICE_OPTIONS = [
  { value: '', label: 'Belirtilmemiş' },
  { value: '30 Ağustos V.D.', label: '30 Ağustos V.D.' },
  { value: 'Kadıköy V.D.', label: 'Kadıköy V.D.' },
  { value: 'Karşıyaka V.D.', label: 'Karşıyaka V.D.' },
  { value: 'Trabzon V.D.', label: 'Trabzon V.D.' },
  { value: 'Çankaya V.D.', label: 'Çankaya V.D.' },
  { value: 'Nilüfer V.D.', label: 'Nilüfer V.D.' },
  { value: 'Teknopark V.D.', label: 'Teknopark V.D.' },
];

function base(
  partial: Omit<Customer, 'kind' | 'accountType' | 'parentId' | 'address' | 'identityNo'> &
    Partial<Pick<Customer, 'kind' | 'accountType' | 'parentId' | 'address' | 'identityNo'>>,
): Customer {
  return {
    kind: 'gercek',
    accountType: '',
    parentId: null,
    address: '',
    identityNo: '',
    ...partial,
  };
}

export const INITIAL_CUSTOMERS: Customer[] = [
  base({
    id: 'c1',
    code: '20048519166',
    title: 'SİNAN OLCA',
    phone: '5523562384',
    email: 'sinanolcs@gmail.com',
    taxNo: '20048519166',
    taxOffice: '',
    identityNo: '20048519166',
  }),
  base({
    id: 'c1-a',
    code: '20048519166-01',
    title: 'SİNAN OLCA ŞUBE 1',
    phone: '5523562385',
    email: 'sube1@olca.com',
    taxNo: '20048519166',
    taxOffice: '',
    parentId: 'c1',
  }),
  base({
    id: 'c1-b',
    code: '20048519166-02',
    title: 'SİNAN OLCA PERAKENDE',
    phone: '5523562386',
    email: 'perakende@olca.com',
    taxNo: '20048519166',
    taxOffice: '',
    parentId: 'c1',
  }),
  base({
    id: 'c1-b-1',
    code: '20048519166-02A',
    title: 'OLCA MARKET ANTALYA',
    phone: '5523562390',
    email: 'antalya@olca.com',
    taxNo: '20048519166',
    taxOffice: '',
    parentId: 'c1-b',
  }),
  base({
    id: 'c2',
    code: '11111111111',
    title: 'TEST MÜŞTERİ',
    phone: '5555555555',
    email: 'test@test.com',
    taxNo: '1111111111',
    taxOffice: '',
  }),
  base({
    id: 'c3',
    code: '6091428902',
    title: 'MUSTAFA KEMAL ATATÜRK',
    phone: '5555555555',
    email: 'info@guzelteknoloji.com',
    taxNo: '6091428902',
    taxOffice: '30 Ağustos V.D.',
    kind: 'tuzel',
  }),
  base({
    id: 'c4',
    code: '1234567890',
    title: 'ANADOLU MARKET A.Ş.',
    phone: '5321112233',
    email: 'cari@anadolumarket.com',
    taxNo: '1234567890',
    taxOffice: 'Kadıköy V.D.',
    kind: 'tuzel',
    accountType: 'alicı-satici',
  }),
  base({
    id: 'c5',
    code: '9876543210',
    title: 'MAVİ DENİZ LTD.',
    phone: '5412223344',
    email: 'muhasebe@mavideniz.com',
    taxNo: '9876543210',
    taxOffice: 'Karşıyaka V.D.',
    kind: 'tuzel',
  }),
  base({
    id: 'c6',
    code: '5556667778',
    title: 'EGE YAZILIM',
    phone: '5053334455',
    email: 'info@egeyazilim.com',
    taxNo: '5556667778',
    taxOffice: '',
    kind: 'tuzel',
  }),
  base({
    id: 'c7',
    code: '1122334455',
    title: 'KARADENİZ LOJİSTİK',
    phone: '5364445566',
    email: 'ops@karadenizloj.com',
    taxNo: '1122334455',
    taxOffice: 'Trabzon V.D.',
    kind: 'tuzel',
  }),
  base({
    id: 'c8',
    code: '9988776655',
    title: 'ATLAS PERAKENDE',
    phone: '5425556677',
    email: 'satis@atlasperakende.com',
    taxNo: '9988776655',
    taxOffice: 'Çankaya V.D.',
    kind: 'tuzel',
  }),
  base({
    id: 'c9',
    code: '3344556677',
    title: 'NİLÜFER GIDA',
    phone: '5336667788',
    email: 'siparis@nilufergida.com',
    taxNo: '3344556677',
    taxOffice: 'Nilüfer V.D.',
    kind: 'tuzel',
  }),
  base({
    id: 'c10',
    code: '7766554433',
    title: 'APP TEST MÜŞTERİ',
    phone: '5555555555',
    email: 'apptest@guzelteknoloji.com',
    taxNo: '7766554433',
    taxOffice: '',
  }),
  base({
    id: 'c11',
    code: '4455667788',
    title: 'GÜZEL TEKNOLOJİ',
    phone: '5421046060',
    email: 'info@guzelteknoloji.com',
    taxNo: '4455667788',
    taxOffice: 'Teknopark V.D.',
    kind: 'tuzel',
  }),
];

const STORAGE_KEY = 'anypay_tahsilat_live_customers_v2';

function normalize(c: Partial<Customer> & Pick<Customer, 'id' | 'code' | 'title' | 'phone' | 'email'>): Customer {
  return {
    taxNo: c.taxNo ?? '',
    taxOffice: c.taxOffice ?? '',
    kind: c.kind ?? 'gercek',
    accountType: c.accountType ?? '',
    parentId: c.parentId ?? null,
    address: c.address ?? '',
    identityNo: c.identityNo ?? '',
    ...c,
  } as Customer;
}

export function getLiveCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...INITIAL_CUSTOMERS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...INITIAL_CUSTOMERS];
    return parsed.map((c) => normalize(c as Customer));
  } catch {
    return [...INITIAL_CUSTOMERS];
  }
}

export function setLiveCustomers(list: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addLiveCustomer(c: Customer) {
  const next = [c, ...getLiveCustomers()];
  setLiveCustomers(next);
  return next;
}

export function updateLiveCustomer(id: string, patch: Partial<Customer>) {
  const next = getLiveCustomers().map((c) => (c.id === id ? normalize({ ...c, ...patch }) : c));
  setLiveCustomers(next);
  return next.find((c) => c.id === id) ?? null;
}

/** 5xx xxx xx xx */
export function formatPhoneLive(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

export function normalizePhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('5') && d.length > 0) d = `5${d}`.slice(0, 10);
  return d.slice(0, 10);
}
