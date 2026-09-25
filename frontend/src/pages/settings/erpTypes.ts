/** Ayarlar › ERP Entegrasyon (Vega) */

export type ErpSettings = {
  active: boolean;
  apiUrl: string;
  apiSecret: string;
  server: string;
  database: string;
  username: string;
  password: string;
  company: string;
  period: string;
  branch: string;
  warehouse: string;
  cashRegister: string;
  inventory: boolean;
};

export const EMPTY_ERP: ErpSettings = {
  active: false,
  apiUrl: '',
  apiSecret: '',
  server: '',
  database: '',
  username: '',
  password: '',
  company: '',
  period: '',
  branch: '',
  warehouse: '',
  cashRegister: '',
  inventory: false,
};
