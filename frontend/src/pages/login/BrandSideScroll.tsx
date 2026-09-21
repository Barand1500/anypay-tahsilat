import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef, type RefObject } from 'react';

gsap.registerPlugin(useGSAP);

const REPEAT = 12;

type Props = {
  word1?: string;
  word2?: string;
  /** Şerit yazı rengi */
  color?: string;
  /** Üst/alt fade rengi (arka planla uyum) */
  fadeColor?: string;
};

/**
 * Sol şerit — iki kelime dikey kayar.
 * TEKNOLOJİ sütunu daha hızlı ve önde başlar.
 */
export function BrandSideScroll({
  word1 = 'GÜZEL',
  word2 = 'TEKNOLOJİ',
  color = '#9eb8c8',
  fadeColor = '#020810',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);
  const w1 = word1.trim() || 'GÜZEL';
  const w2 = word2.trim() || 'TEKNOLOJİ';

  useGSAP(
    () => {
      const a = col1Ref.current;
      const b = col2Ref.current;
      if (!a || !b) return;

      const halfA = a.scrollHeight / 2;
      const halfB = b.scrollHeight / 2;
      if (halfA < 1 || halfB < 1) return;

      gsap.fromTo(b, { y: 0 }, { y: -halfB, duration: 28, ease: 'none', repeat: -1 });

      const a0 = -halfA * 0.28;
      gsap.fromTo(
        a,
        { y: a0 },
        { y: a0 - halfA, duration: 48, ease: 'none', repeat: -1, delay: 0.6 },
      );
    },
    { scope: rootRef, dependencies: [w1, w2] },
  );

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 z-[2] hidden w-[8rem] overflow-hidden sm:w-40 md:block lg:w-48"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28"
        style={{
          background: `linear-gradient(to bottom, ${fadeColor} 0%, transparent 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28"
        style={{
          background: `linear-gradient(to top, ${fadeColor} 0%, transparent 100%)`,
        }}
      />

      <div className="flex h-full justify-center gap-4 px-3 lg:gap-5 lg:px-5">
        <MarqueeColumn trackRef={col1Ref} word={w1} color={color} />
        <MarqueeColumn trackRef={col2Ref} word={w2} color={color} />
      </div>
    </div>
  );
}

function MarqueeColumn({
  word,
  color,
  trackRef,
}: {
  word: string;
  color: string;
  trackRef: RefObject<HTMLDivElement | null>;
}) {
  const items = Array.from({ length: REPEAT }, (_, i) => (
    <div key={`${word}-${i}`} className="flex shrink-0 items-center justify-center py-10">
      <span
        className="select-none text-[1.7rem] leading-none tracking-[0.28em] uppercase sm:text-[1.9rem] lg:text-[2.15rem]"
        style={{
          fontFamily: '"Bebas Neue", "DM Sans", sans-serif',
          color,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
        }}
      >
        {word}
      </span>
    </div>
  ));

  return (
    <div className="relative h-full overflow-hidden">
      <div ref={trackRef} className="flex flex-col items-center will-change-transform">
        {items}
        {items}
      </div>
    </div>
  );
}
