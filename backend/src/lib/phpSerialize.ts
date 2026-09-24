/**
 * PHP `serialize()` — rol.izinler alanı.
 * Okuma + yazma (Doctrine array formatı).
 *
 * a:N:{i:46;a:3:{s:11:"goruntuleme";s:1:"1";s:9:"duzenleme";s:1:"1";s:9:"olusturma";s:1:"1";}...}
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
    body += phpString('goruntuleme') + phpString(f.view ? '1' : '0');
    body += phpString('duzenleme') + phpString(f.edit ? '1' : '0');
    body += phpString('olusturma') + phpString(f.create ? '1' : '0');
    body += '}';
  }
  return `a:${entries.length}:{${body}}`;
}

function flagOf(body: string, key: string): boolean {
  const re = new RegExp(`s:\\d+:"${key}";s:\\d+:"([01])"`);
  const m = body.match(re);
  return m?.[1] === '1';
}

function phpString(value: string): string {
  // ASCII anahtar/değer — byte = char length
  return `s:${value.length}:"${value}";`;
}
