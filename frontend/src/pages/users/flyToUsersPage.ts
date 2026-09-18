import gsap from 'gsap';

/**
 * Avatar → sağ üst profil → Kullanıcılar menü öğesi → sayfa.
 */
export function flyToUsersPage(
  fromEl: HTMLElement,
  userId: string,
  navigate: (to: string) => void,
): void {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const target = `/kullanicilar?highlight=${encodeURIComponent(userId)}`;

  if (reduced) {
    navigate(target);
    return;
  }

  const start = fromEl.getBoundingClientRect();
  const profileBtn = document.querySelector<HTMLElement>('[data-profile-trigger]');

  const cursor = document.createElement('div');
  cursor.setAttribute('aria-hidden', 'true');
  cursor.style.cssText =
    'position:fixed;z-index:20000;width:22px;height:22px;pointer-events:none;left:0;top:0;margin:0';
  cursor.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5.5 3.5 19 12l-7.2 1.6L9.5 21 5.5 3.5Z" fill="#0f172a" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cursor);

  const sx = start.left + start.width / 2 - 4;
  const sy = start.top + start.height / 2 - 4;
  gsap.set(cursor, { x: sx, y: sy, scale: 0.85, opacity: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      cursor.remove();
      navigate(target);
      window.dispatchEvent(new CustomEvent('close-profile-menu'));
    },
  });

  tl.to(cursor, { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out' });

  if (profileBtn) {
    const pr = profileBtn.getBoundingClientRect();
    tl.to(cursor, {
      x: pr.left + pr.width / 2 - 4,
      y: pr.top + pr.height / 2 - 4,
      duration: 0.4,
      ease: 'power2.inOut',
    });
    tl.to(cursor, { scale: 0.88, duration: 0.07, yoyo: true, repeat: 1 });
    tl.add(() => {
      window.dispatchEvent(new CustomEvent('open-profile-menu'));
    });
    tl.to({}, { duration: 0.28 });
  }

  tl.add(() => {
    const usersItem = document.querySelector<HTMLElement>('[data-nav-kullanicilar]');
    if (!usersItem) return;
    const ur = usersItem.getBoundingClientRect();
    gsap.to(cursor, {
      x: ur.left + 28,
      y: ur.top + ur.height / 2 - 4,
      duration: 0.3,
      ease: 'power2.inOut',
    });
  });
  tl.to({}, { duration: 0.32 });
  tl.to(cursor, { scale: 0.85, duration: 0.07, yoyo: true, repeat: 1 });
  tl.to(cursor, { opacity: 0, duration: 0.1 });
}
