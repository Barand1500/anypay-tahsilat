/** Bankaya / altyapıya göre Sanal POS form alanları (referans panel ile aynı etiketler) */

export type PosFieldSlot =
  | 'merchantId'
  | 'terminalSafeId'
  | 'securityKey'
  | 'terminalPassword';

export type PosFieldDef = {
  slot: PosFieldSlot;
  label: string;
  required: boolean;
};

export type PosFieldProfile = {
  id: string;
  fields: PosFieldDef[];
  showSecurityType: boolean;
  securityTypeRequired: boolean;
  /** Güvenlik tipi zorunlu değilse kayıttaki varsayılan */
  defaultSecurityType: string;
};

function f(
  slot: PosFieldSlot,
  label: string,
  required = true,
): PosFieldDef {
  return { slot, label, required };
}

/** Akbank V2 SecurePay */
const AKBANK: PosFieldProfile = {
  id: 'akbank',
  fields: [
    f('merchantId', 'Güvenli İşyeri Numarası'),
    f('terminalSafeId', 'Terminal Safe ID'),
    f('securityKey', 'Güvenlik Anahtarı'),
  ],
  showSecurityType: true,
  securityTypeRequired: true,
  defaultSecurityType: '3D_PAY',
};

/** Garanti BBVA */
const GARANTI: PosFieldProfile = {
  id: 'garanti',
  fields: [
    f('merchantId', 'İşyeri Numarası'),
    f('terminalSafeId', 'Terminal No'),
    f('securityKey', 'Mağaza Anahtarı'),
    f('terminalPassword', 'Terminal Şifresi'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D_PAY',
};

/**
 * Yapı Kredi Posnet — referans:
 * İşyeri Numarası, Terminal No, Posnet ID, ENC Anahtarı
 */
const YAPIKREDI: PosFieldProfile = {
  id: 'yapikredi',
  fields: [
    f('merchantId', 'İşyeri Numarası'),
    f('terminalSafeId', 'Terminal No'),
    f('securityKey', 'Posnet ID'),
    f('terminalPassword', 'ENC Anahtarı'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D_PAY',
};

/**
 * QNB — referans:
 * Üye İş Yeri No, Üye İşyeri 3D Şifresi, API Kullanıcı Adı, API Kullanıcı Şifresi, Güvenlik Tipi
 */
const QNB: PosFieldProfile = {
  id: 'qnb',
  fields: [
    f('merchantId', 'Üye İş Yeri No'),
    f('securityKey', 'Üye İşyeri 3D Şifresi'),
    f('terminalSafeId', 'API Kullanıcı Adı'),
    f('terminalPassword', 'API Kullanıcı Şifresi'),
  ],
  showSecurityType: true,
  securityTypeRequired: true,
  defaultSecurityType: '3DPay',
};

/**
 * Tosla — referans: Client ID, Api User, Api Pass
 */
const TOSLA: PosFieldProfile = {
  id: 'tosla',
  fields: [
    f('merchantId', 'Client ID'),
    f('terminalSafeId', 'Api User'),
    f('securityKey', 'Api Pass'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D_PAY',
};

/**
 * NestPay / Payten (İş, Ziraat, Halk…) —
 * İşyeri Numarası, Mağaza Anahtarı, API Kullanıcı Adı, API Kullanıcı Şifresi
 */
const NESTPAY: PosFieldProfile = {
  id: 'nestpay',
  fields: [
    f('merchantId', 'İşyeri Numarası'),
    f('securityKey', 'Mağaza Anahtarı'),
    f('terminalSafeId', 'API Kullanıcı Adı', false),
    f('terminalPassword', 'API Kullanıcı Şifresi', false),
  ],
  showSecurityType: true,
  securityTypeRequired: true,
  defaultSecurityType: '3d_pay',
};

/** VakıfBank MPI */
const VAKIFBANK: PosFieldProfile = {
  id: 'vakifbank',
  fields: [
    f('merchantId', 'Merchant ID'),
    f('terminalSafeId', 'Terminal No'),
    f('securityKey', 'Merchant Password'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D',
};

/** DenizBank */
const DENIZBANK: PosFieldProfile = {
  id: 'denizbank',
  fields: [
    f('merchantId', 'Mağaza No'),
    f('terminalSafeId', 'Kullanıcı Kodu'),
    f('terminalPassword', 'Şifre'),
    f('securityKey', '3D Anahtar'),
  ],
  showSecurityType: true,
  securityTypeRequired: true,
  defaultSecurityType: '3DPay',
};

/** Kuveyt Türk */
const KUVEYTTURK: PosFieldProfile = {
  id: 'kuveytturk',
  fields: [
    f('merchantId', 'Müşteri Numarası'),
    f('terminalSafeId', 'İşyeri Numarası'),
    f('securityKey', 'API Kullanıcı Adı'),
    f('terminalPassword', 'API Şifresi'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D',
};

/** Halk Öde */
const HALKODE: PosFieldProfile = {
  id: 'halkode',
  fields: [
    f('merchantId', 'Üye İşyeri Anahtarı'),
    f('terminalSafeId', 'Uygulama Anahtarı'),
    f('securityKey', 'Uygulama Parolası'),
    f('terminalPassword', 'Uygulama İşyeri ID', false),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D',
};

/** iyzico */
const IYZICO: PosFieldProfile = {
  id: 'iyzico',
  fields: [
    f('merchantId', 'Üye İşyeri Numarası', false),
    f('terminalSafeId', 'Api Anahtarı'),
    f('securityKey', 'Güvenlik Anahtarı'),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: '3D',
};

/** PayTR */
const PAYTR: PosFieldProfile = {
  id: 'paytr',
  fields: [
    f('merchantId', 'Merchant ID'),
    f('securityKey', 'Merchant Key'),
    f('terminalSafeId', 'Merchant Salt'),
    f('terminalPassword', 'Taksit Token', false),
  ],
  showSecurityType: false,
  securityTypeRequired: false,
  defaultSecurityType: 'iframe',
};

const GENERIC: PosFieldProfile = {
  id: 'generic',
  fields: [
    f('merchantId', 'İşyeri Numarası'),
    f('terminalSafeId', 'Terminal No'),
    f('securityKey', 'Güvenlik Anahtarı'),
    f('terminalPassword', 'Terminal Şifresi', false),
  ],
  showSecurityType: true,
  securityTypeRequired: true,
  defaultSecurityType: '3D_PAY',
};

function blobOf(infrastructureId: string, bankName: string): string {
  return `${infrastructureId} ${bankName}`.toLocaleLowerCase('tr');
}

/** Altyapı / banka adına göre alan profili */
export function resolvePosFieldProfile(
  infrastructureId: string | null | undefined,
  bankName: string | null | undefined,
): PosFieldProfile {
  const id = infrastructureId || '';
  const blob = blobOf(id, bankName || '');

  if (id === 'infra-akbank' || blob.includes('akbank')) return AKBANK;
  if (id === 'infra-garanti' || blob.includes('garanti')) return GARANTI;
  if (id === 'infra-yapikredi' || blob.includes('yapikredi') || blob.includes('yapı kredi')) {
    return YAPIKREDI;
  }
  if (id === 'infra-qnb' || blob.includes('qnb') || blob.includes('finansbank')) return QNB;
  if (id === 'infra-tosla' || blob.includes('tosla')) return TOSLA;
  if (id === 'infra-vakifbank' || blob.includes('vakif') || blob.includes('vakıf')) {
    return VAKIFBANK;
  }
  if (id === 'infra-denizbank' || blob.includes('deniz')) return DENIZBANK;
  if (id === 'infra-kuveytturk' || blob.includes('kuveyt')) return KUVEYTTURK;
  if (id === 'infra-halkode' || blob.includes('halkode') || blob.includes('halk öde')) {
    return HALKODE;
  }
  if (id === 'infra-iyzico' || blob.includes('iyzico') || blob.includes('iyzi')) return IYZICO;
  if (id === 'infra-paytr' || blob.includes('paytr')) return PAYTR;

  if (
    id === 'infra-isbank' ||
    id === 'infra-ziraat' ||
    id === 'infra-halkbank' ||
    blob.includes('iş bank') ||
    blob.includes('is bank') ||
    blob.includes('ziraat') ||
    blob.includes('halk bank') ||
    blob.includes('nestpay') ||
    blob.includes('payten')
  ) {
    return NESTPAY;
  }

  return GENERIC;
}

export function emptyPosFieldValues(): Record<PosFieldSlot, string> {
  return {
    merchantId: '',
    terminalSafeId: '',
    securityKey: '',
    terminalPassword: '',
  };
}
