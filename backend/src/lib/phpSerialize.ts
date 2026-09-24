/**
 * PHP `serialize()` dizisini okur — rol.izinler alanı.
 * Yazma yok; sadece modül id → görüntüleme bayrağı.
 *
 * Örnek:
 * a:2:{i:46;a:3:{s:11:"goruntuleme";s:1:"1";s:9:"duzenleme";s:1:"1";s:9:"olusturma";s:1:"1";}...}
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

function flagOf(body: string, key: string): boolean {
  const re = new RegExp(`s:\\d+:"${key}";s:\\d+:"([01])"`);
  const m = body.match(re);
  return m?.[1] === '1';
}
