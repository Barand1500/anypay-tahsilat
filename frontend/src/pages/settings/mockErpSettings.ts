/** Ayarlar › ERP Entegrasyon — mock Vega */

export type ErpSettings = {
  active: boolean;
  apiUrl: string;
  server: string;
  database: string;
  username: string;
  password: string;
};

export const INITIAL_ERP_SETTINGS: ErpSettings = {
  active: false,
  apiUrl: '',
  server: '',
  database: '',
  username: 'baran@guzelteknoloji.com',
  password: '••••••••••',
};
