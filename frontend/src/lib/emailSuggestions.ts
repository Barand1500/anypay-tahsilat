/** Ortak e-posta domain önerileri */

export const EMAIL_DOMAIN_SUGGESTIONS = [
  'guzelteknoloji.com',
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
];

export function emailSuggestions(value: string): string[] {
  const v = value.trim().toLowerCase();
  const at = v.indexOf('@');
  if (at === -1) {
    if (v.length < 2) return [];
    return EMAIL_DOMAIN_SUGGESTIONS.map((d) => `${v}@${d}`).slice(0, 5);
  }
  const local = v.slice(0, at);
  const partial = v.slice(at + 1);
  if (!local) return [];
  if (partial.includes('.')) return [];
  return EMAIL_DOMAIN_SUGGESTIONS.filter((d) => d.startsWith(partial) && d !== partial)
    .map((d) => `${local}@${d}`)
    .slice(0, 5);
}
