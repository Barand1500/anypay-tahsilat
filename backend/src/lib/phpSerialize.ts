/**
 * PHP `serialize()` yardımcısı.
 * - Rol izinleri (Doctrine array)
 * - Şablon değişkenleri / SMS ayarları (assoc / list)
 */

export type ModulePermFlags = {
  view: boolean;
  edit: boolean;
  create: boolean;
};

export function parseRolIzinler(raw: string | null | undefined): Map<number, ModulePermFlags> {
  const out = new Map<number, ModulePermFlags>();
  if (!raw || typeof raw !== 'string') return out;

  const entryRe = /i:(\d+);a:\d+:\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(raw)) !== null) {
    const moduleId = Number(match[1]);
    if (!Number.isFinite(moduleId)) continue;
    const body = match[2] || '';
    out.set(moduleId, {
      view: flagOf(body, 'goruntuleme'),
      edit: flagOf(body, 'duzenleme'),
      create: flagOf(body, 'olusturma'),
    });
  }
  return out;
}

/** UI PagePerm ↔ PHP bayrakları */
export function flagsToPagePerm(f: ModulePermFlags): {
  view: boolean;
  save: boolean;
  remove: boolean;
} {
  return {
    view: f.view,
    save: f.edit,
    remove: f.create, // UI “Sil” ↔ eski “olusturma” (3. bayrak)
  };
}

export function pagePermToFlags(p: {
  view: boolean;
  save: boolean;
  remove: boolean;
}): ModulePermFlags {
  return {
    view: Boolean(p.view),
    edit: Boolean(p.save),
    create: Boolean(p.remove),
  };
}

export function serializeRolIzinler(
  perms: Map<number, ModulePermFlags> | Iterable<[number, ModulePermFlags]>,
): string {
  const entries = [...(perms instanceof Map ? perms.entries() : perms)].sort(
    (a, b) => a[0] - b[0],
  );
  let body = '';
  for (const [id, f] of entries) {
    body += `i:${id};a:3:{`;
    body += phpString(asciiStr('goruntuleme')) + phpString(asciiStr(f.view ? '1' : '0'));
    body += phpString(asciiStr('duzenleme')) + phpString(asciiStr(f.edit ? '1' : '0'));
    body += phpString(asciiStr('olusturma')) + phpString(asciiStr(f.create ? '1' : '0'));
    body += '}';
  }
  return `a:${entries.length}:{${body}}`;
}

function flagOf(body: string, key: string): boolean {
  const re = new RegExp(`s:\\d+:"${key}";s:\\d+:"([01])"`);
  const m = body.match(re);
  return m?.[1] === '1';
}

function asciiStr(value: string): string {
  return value;
}

function phpString(value: string): string {
  return `s:${byteLen(value)}:"${value}";`;
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

/* ─── Genel assoc / list ─── */

type Cursor = { i: number; s: string };

function parseValue(c: Cursor): unknown {
  const { s } = c;
  const t = s[c.i];
  if (t === 'N') {
    c.i += 1;
    if (s[c.i] === ';') c.i += 1;
    return null;
  }
  if (t === 'i' || t === 'd' || t === 'b') {
    c.i += 2;
    const end = s.indexOf(';', c.i);
    const raw = s.slice(c.i, end);
    c.i = end + 1;
    if (t === 'b') return raw === '1';
    return Number(raw);
  }
  if (t === 's') {
    c.i += 2;
    const colon = s.indexOf(':', c.i);
    const len = Number(s.slice(c.i, colon));
    c.i = colon + 1;
    if (s[c.i] !== '"') throw new Error('php s: beklenen "');
    c.i += 1;
    let byteCount = 0;
    let charCount = 0;
    while (byteCount < len && c.i + charCount < s.length) {
      const cp = s.codePointAt(c.i + charCount)!;
      const ch = String.fromCodePoint(cp);
      byteCount += byteLen(ch);
      charCount += ch.length;
    }
    const value = s.slice(c.i, c.i + charCount);
    c.i += charCount;
    if (s[c.i] === '"') c.i += 1;
    if (s[c.i] === ';') c.i += 1;
    return value;
  }
  if (t === 'a') {
    c.i += 2;
    const colon = s.indexOf(':', c.i);
    const n = Number(s.slice(c.i, colon));
    c.i = colon + 1;
    if (s[c.i] !== '{') throw new Error('php a: beklenen {');
    c.i += 1;
    const obj: Record<string, unknown> = {};
    for (let k = 0; k < n; k++) {
      const key = parseValue(c);
      const val = parseValue(c);
      obj[String(key)] = val;
    }
    if (s[c.i] === '}') c.i += 1;
    return obj;
  }
  throw new Error(`php tip desteklenmiyor: ${t}`);
}

export function phpUnserialize(raw: string | null | undefined): unknown {
  if (!raw?.trim()) return null;
  try {
    return parseValue({ i: 0, s: raw.trim() });
  } catch {
    return null;
  }
}

export function phpUnserializeAssoc(raw: string | null | undefined): Record<string, string> {
  const v = phpUnserialize(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = val == null ? '' : String(val);
  }
  return out;
}

export function phpUnserializeList(raw: string | null | undefined): string[] {
  const assoc = phpUnserializeAssoc(raw);
  const keys = Object.keys(assoc);
  if (!keys.length) return [];
  if (keys.every((k) => /^\d+$/.test(k))) {
    return keys.sort((a, b) => Number(a) - Number(b)).map((k) => assoc[k]!);
  }
  return Object.values(assoc);
}

export function phpSerializeAssoc(map: Record<string, string>): string {
  const entries = Object.entries(map);
  let body = '';
  for (const [k, v] of entries) {
    body += `s:${byteLen(k)}:"${k}";s:${byteLen(v)}:"${v}";`;
  }
  return `a:${entries.length}:{${body}}`;
}

export function phpSerializeList(list: string[]): string {
  let body = '';
  list.forEach((v, i) => {
    body += `i:${i};s:${byteLen(v)}:"${v}";`;
  });
  return `a:${list.length}:{${body}}`;
}

export function stripHashKey(raw: string): string {
  return raw.replace(/^#+|#+$/g, '').trim();
}

export function withHashKey(raw: string): string {
  const k = stripHashKey(raw);
  return k ? `#${k}#` : '';
}
