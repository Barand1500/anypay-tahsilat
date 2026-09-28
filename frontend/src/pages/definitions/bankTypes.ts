/** Tanımlamalar › Bankalar */

export type BankDef = {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  logo: string | null;
  securityTypes: string;
  gateway3dUrl: string;
  apiUrl: string;
  xmlUrl: string;
};

export type BankFocusField =
  | 'name'
  | 'shortName'
  | 'logo'
  | 'securityTypes'
  | 'gateway3dUrl'
  | 'apiUrl'
  | 'xmlUrl';
