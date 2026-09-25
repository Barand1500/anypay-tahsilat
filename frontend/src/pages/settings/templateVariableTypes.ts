/** Ayarlar › Şablon Değişkenleri */

export type TemplateVarType = 'email' | 'sms';

export type TemplateVarPair = {
  dbColumn: string;
  key: string;
};

export type TemplateVariableSet = {
  id: string;
  displayId: number;
  name: string;
  moduleId: string;
  module: string;
  type: TemplateVarType;
  variables: TemplateVarPair[];
};

export type ModuleOption = { id: string; label: string };

export const TEMPLATE_VAR_TYPE_OPTIONS = [
  { value: 'email', label: 'E-Posta' },
  { value: 'sms', label: 'SMS' },
] as const;

export function formatTemplateVarKey(key: string) {
  const k = key.replace(/^#+|#+$/g, '').trim();
  return k ? `#${k}#` : '';
}

export function normalizeTemplateVarKey(raw: string) {
  return raw.replace(/^#+|#+$/g, '').trim().toLocaleLowerCase('tr');
}

export function templateVarTypeLabel(type: TemplateVarType) {
  return type === 'email' ? 'E-Posta' : 'Sms';
}
