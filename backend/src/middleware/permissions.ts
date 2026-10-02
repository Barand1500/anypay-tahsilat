import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { flagsToPagePerm, parseRolIzinler } from '../lib/phpSerialize.js';
import { sendError } from '../utils/response.js';
import type { AuthedRequest } from './auth.js';

export type PermAction = 'view' | 'save' | 'remove';

function normalizePath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] || '/';
  const trimmed = bare.replace(/\/+$/, '');
  return trimmed || '/';
}

/** FE pathCandidates ile uyumlu kısa alias listesi */
function expandPrefixes(prefix: string): string[] {
  const p = normalizePath(prefix);
  const out = new Set<string>([p]);
  const add = (s: string) => out.add(normalizePath(s));

  if (p.includes('/tanimlamalar/pos-kart')) {
    add(p.replace('/tanimlamalar/pos-kart', '/tanimlamalar/bankalar'));
  }
  if (p.includes('/tanimlamalar/bankalar')) {
    add(p.replace('/tanimlamalar/bankalar', '/tanimlamalar/pos-kart'));
  }
  if (p.includes('/anlasmalar')) {
    add(p.replace('/anlasmalar', '/kart-anlasmalari'));
  }
  if (p.includes('/kart-anlasmalari')) {
    add(p.replace('/kart-anlasmalari', '/anlasmalar'));
  }
  if (p.startsWith('/tanimlamalar/subeler')) {
    add(p.replace('/tanimlamalar/subeler', '/tanimlamalar/sube-departman'));
  }
  if (p.startsWith('/tanimlamalar/sube-departman')) {
    add(p.replace('/tanimlamalar/sube-departman', '/tanimlamalar/subeler'));
  }
  const posAliases: Array<[string, string]> = [
    ['/tanimlamalar/pos-kart/sanal-pos', '/tanimlamalar/bankalar/sanal-pos-tanimlari'],
    ['/tanimlamalar/pos-kart/ortak-sanal-pos', '/tanimlamalar/bankalar/ortak-sanalpos'],
    ['/tanimlamalar/pos-kart/anlasmalar', '/tanimlamalar/bankalar/kart-anlasmalari'],
    ['/tanimlamalar/pos-kart/tipler', '/tanimlamalar/bankalar/kart-tipleri'],
    ['/tanimlamalar/pos-kart/turler', '/tanimlamalar/bankalar/kart-turleri'],
    ['/tanimlamalar/pos-kart/markalar', '/tanimlamalar/bankalar/kart-markalari'],
  ];
  for (const [modern, legacy] of posAliases) {
    for (const cur of [...out]) {
      if (cur === modern || cur.startsWith(`${modern}/`)) add(cur.replace(modern, legacy));
      if (cur === legacy || cur.startsWith(`${legacy}/`)) add(cur.replace(legacy, modern));
    }
  }
  return [...out];
}

function actionFromMethod(method: string): PermAction {
  const m = method.toUpperCase();
  if (m === 'DELETE') return 'remove';
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'view';
  return 'save';
}

function isElevatedRole(yetki: number | null, code: string): boolean {
  if (yetki === 1) return true;
  const c = code.toUpperCase();
  return (
    c === 'ROLE_YONETICI' ||
    c === 'ROLE_ADMIN' ||
    c === 'ROLE_SUPERAPP' ||
    c.includes('SUPERAPP')
  );
}

async function resolveModuleId(prefix: string): Promise<number | null> {
  const candidates = expandPrefixes(prefix);
  const rows = await prisma.izinler.findMany({
    where: { OR: [{ remove: null }, { remove: false }] },
    select: { id: true, route: true },
  });

  let best: { id: number; len: number } | null = null;
  for (const row of rows) {
    const route = normalizePath(row.route || '');
    if (!route) continue;
    for (const c of candidates) {
      const match =
        route === '/'
          ? c === '/'
          : c === route || c.startsWith(`${route}/`) || route === c;
      if (!match) continue;
      // En uzun (en spesifik) route kazanır; tam eşleşme öncelikli
      const score = c === route ? route.length + 1000 : route.length;
      if (!best || score > best.len) best = { id: row.id, len: score };
    }
  }
  return best?.id ?? null;
}

async function userHasPerm(
  userId: number,
  modulePrefix: string,
  action: PermAction,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, OR: [{ remove: null }, { remove: false }] },
    select: { rolId: true },
  });
  if (!user?.rolId) return false;

  const role = await prisma.rol.findFirst({
    where: { id: user.rolId, OR: [{ remove: null }, { remove: false }] },
    select: { yetki: true, code: true, izinler: true },
  });
  if (!role) return false;
  if (isElevatedRole(role.yetki, role.code)) return true;

  const moduleId = await resolveModuleId(modulePrefix);
  if (moduleId == null) return false;

  const flags = parseRolIzinler(role.izinler).get(moduleId);
  if (!flags) return false;
  const page = flagsToPagePerm(flags);
  return Boolean(page[action]);
}

/**
 * Modül yetkisi — HTTP metodundan aksiyon türetir
 * (GET→view, POST/PATCH→save, DELETE→remove).
 */
export function requireModulePerm(modulePrefix: string, fixedAction?: PermAction) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.sub) return sendError(res, 401, 'Oturum gerekli');
    const action = fixedAction ?? actionFromMethod(req.method);
    try {
      const ok = await userHasPerm(req.auth.sub, modulePrefix, action);
      if (!ok) return sendError(res, 403, 'Bu işlem için yetkiniz yok');
      return next();
    } catch (err) {
      console.error('[perm]', err);
      return sendError(res, 500, 'Yetki kontrolü başarısız');
    }
  };
}

/** GET serbest (yalnızca requireAuth); yazma silme için modül yetkisi */
export function requireModuleWrite(modulePrefix: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.sub) return sendError(res, 401, 'Oturum gerekli');
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }
    const action = actionFromMethod(method);
    try {
      const ok = await userHasPerm(req.auth.sub, modulePrefix, action);
      if (!ok) return sendError(res, 403, 'Bu işlem için yetkiniz yok');
      return next();
    } catch (err) {
      console.error('[perm]', err);
      return sendError(res, 500, 'Yetki kontrolü başarısız');
    }
  };
}
