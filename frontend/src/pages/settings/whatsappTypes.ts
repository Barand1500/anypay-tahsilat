/** Ayarlar › WhatsApp — Meta Cloud API */

export type WhatsappSettings = {
  active: boolean;
  appId: string;
  appSecret: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
};

export type WhatsappSettingsApi = WhatsappSettings & {
  appSecretSet: boolean;
  accessTokenSet: boolean;
  verifyTokenSet: boolean;
  callbackUrl: string;
};

export const EMPTY_WHATSAPP: WhatsappSettings = {
  active: false,
  appId: '',
  appSecret: '',
  phoneNumberId: '',
  accessToken: '',
  verifyToken: '',
};
