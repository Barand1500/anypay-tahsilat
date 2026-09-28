/** Bankaya / altyapıya göre Sanal POS form etiketleri */

export type PosFieldProfile = {
  id: 'akbank-v2' | 'garanti' | 'nestpay' | 'generic';
  merchantLabel: string;
  terminalLabel: string;
  keyLabel: string;
  /** NestPay / Garanti — 4. kutu */
  showTerminalPassword: boolean;
  terminalPasswordLabel: string;
  showSecurityType: boolean;
  securityTypeRequired: boolean;
};

const AKBANK: PosFieldProfile = {
  id: 'akbank-v2',
  merchantLabel: 'Güvenli İşyeri Numarası',
  terminalLabel: 'Terminal Safe ID',
  keyLabel: 'Güvenlik Anahtarı',
  showTerminalPassword: false,
  terminalPasswordLabel: 'Terminal Şifresi',
  showSecurityType: true,
  securityTypeRequired: true,
};

/** Garanti BBVA — referans panelde güvenlik tipi POS formunda yok; banka kaydından gelir */
const GARANTI: PosFieldProfile = {
  id: 'garanti',
  merchantLabel: 'İşyeri Numarası',
  terminalLabel: 'Terminal No',
  keyLabel: 'Mağaza Anahtarı',
  showTerminalPassword: true,
  terminalPasswordLabel: 'Terminal Şifresi',
  showSecurityType: false,
  securityTypeRequired: false,
};

const NESTPAY: PosFieldProfile = {
  id: 'nestpay',
  merchantLabel: 'İşyeri Numarası',
  terminalLabel: 'Terminal No',
  keyLabel: 'Mağaza Anahtarı',
  showTerminalPassword: true,
  terminalPasswordLabel: 'Terminal Şifresi',
  showSecurityType: true,
  securityTypeRequired: true,
};

const GENERIC: PosFieldProfile = {
  id: 'generic',
  merchantLabel: 'İşyeri Numarası',
  terminalLabel: 'Terminal No',
  keyLabel: 'Güvenlik Anahtarı',
  showTerminalPassword: true,
  terminalPasswordLabel: 'Terminal Şifresi',
  showSecurityType: true,
  securityTypeRequired: true,
};

function blobOf(infrastructureId: string, bankName: string): string {
  return `${infrastructureId} ${bankName}`.toLocaleLowerCase('tr');
}

/** Altyapı / banka adına göre alan profili */
export function resolvePosFieldProfile(
  infrastructureId: string | null | undefined,
  bankName: string | null | undefined,
): PosFieldProfile {
  const blob = blobOf(infrastructureId || '', bankName || '');
  if (blob.includes('akbank') || infrastructureId === 'infra-akbank') return AKBANK;
  if (blob.includes('garanti') || infrastructureId === 'infra-garanti') return GARANTI;
  if (
    blob.includes('yapikredi') ||
    blob.includes('yapı') ||
    blob.includes('qnb') ||
    blob.includes('iş bank') ||
    blob.includes('is bank') ||
    blob.includes('ziraat') ||
    blob.includes('halk') ||
    infrastructureId === 'infra-yapikredi' ||
    infrastructureId === 'infra-qnb' ||
    infrastructureId === 'infra-isbank' ||
    infrastructureId === 'infra-ziraat' ||
    infrastructureId === 'infra-halkbank'
  ) {
    return NESTPAY;
  }
  if (blob.includes('tosla')) return GENERIC;
  return GENERIC;
}
