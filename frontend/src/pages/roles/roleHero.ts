/** Rol Ekle hero görseli — küçük WebP + erken prefetch */
export const ROLE_HERO_SRC = '/illustrations/role-add-hero.webp';

let prefetched = false;

export function prefetchRoleHero() {
  if (prefetched || typeof window === 'undefined') return;
  prefetched = true;
  const img = new Image();
  img.src = ROLE_HERO_SRC;
}
