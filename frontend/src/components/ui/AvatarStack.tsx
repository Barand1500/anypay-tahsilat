import gsap from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { flyToUsersPage } from '../../pages/users/flyToUsersPage';

export type AvatarPerson = {
  id: string;
  initials: string;
  name: string;
};

type Props = {
  people: AvatarPerson[];
  max?: number;
  size?: 'sm' | 'md';
};

/**
 * Overlap avatar — portal tooltip (kayma yok), scale izolasyonu, çift tık → kullanıcı.
 */
export function AvatarStack({ people, max = 5, size = 'sm' }: Props) {
  const navigate = useNavigate();
  const [tip, setTip] = useState<{ name: string; top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const activeEl = useRef<HTMLElement | null>(null);

  const dim = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-9 w-9 text-[11px]';
  const list = people.slice(0, max);
  const overlap = size === 'sm' ? 10 : 12;

  const placeTip = useCallback((el: HTMLElement, name: string) => {
    activeEl.current = el;
    const r = el.getBoundingClientRect();
    setTip({
      name,
      top: r.top - 10,
      left: r.left + r.width / 2,
    });
  }, []);

  const hideTip = useCallback(() => {
    activeEl.current = null;
    setTip(null);
  }, []);

  useEffect(() => {
    if (!tip) return;
    function sync() {
      const el = activeEl.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTip((t) =>
        t
          ? {
              ...t,
              top: r.top - 10,
              left: r.left + r.width / 2,
            }
          : null,
      );
    }
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [tip]);

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    gsap.fromTo(
      tipRef.current,
      { autoAlpha: 0, y: 6, scale: 0.9 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' },
    );
  }, [tip?.name, tip?.left, tip?.top]);

  return (
    <>
      <div
        className="relative isolate flex shrink-0 items-center overflow-visible"
        style={{
          width: list.length ? 32 + (list.length - 1) * (32 - overlap) : 0,
          height: 32,
        }}
        onMouseLeave={hideTip}
      >
        {list.map((u, i) => (
          <button
            key={u.id}
            type="button"
            title={`${u.name} — çift tıkla: Kullanıcılar`}
            aria-label={u.name}
            onMouseEnter={(e) => placeTip(e.currentTarget, u.name)}
            onFocus={(e) => placeTip(e.currentTarget, u.name)}
            onBlur={hideTip}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              hideTip();
              flyToUsersPage(e.currentTarget, u.id, navigate);
            }}
            className={[
              'absolute top-0 flex items-center justify-center rounded-full',
              'border-2 border-[var(--panel-elevated)] bg-[var(--brand-soft-bg)] font-bold text-[var(--brand-on-soft)]',
              'origin-center transition-[transform,box-shadow] duration-200 ease-out',
              'hover:z-30 hover:scale-110 hover:shadow-md focus:z-30 focus:scale-110 focus:outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
              dim,
            ].join(' ')}
            style={{
              left: i * (32 - overlap),
              zIndex: tip?.name === u.name ? 40 : list.length - i,
              width: 32,
              height: 32,
            }}
          >
            {u.initials}
          </button>
        ))}
      </div>

      {tip
        ? createPortal(
            <div
              ref={tipRef}
              className="pointer-events-none fixed z-[11000] -translate-x-1/2 -translate-y-full"
              style={{ top: tip.top, left: tip.left }}
              role="tooltip"
            >
              <div className="whitespace-nowrap rounded-lg bg-[#0f172a] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
                {tip.name}
              </div>
              <span
                className="mx-auto block h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#0f172a]"
                aria-hidden
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
