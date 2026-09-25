/** Ayarlar › SMS — tipler / şablon meta */

export type SmsProvider = {
  id: string;
  name: string;
  /** PHP gönderim kodu */
  code: string;
  variables: string[];
};

export type SmsSettings = {
  providerId: string;
  username: string;
  password: string;
  title: string;
  active: boolean;
};

export type SmsTemplate = {
  id: string;
  typeKey: string;
  name: string;
  body: string;
};

export function parseProviderVariables(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
