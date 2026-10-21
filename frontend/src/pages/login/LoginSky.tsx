import { useMemo, type CSSProperties } from 'react';

type Star = {
  id: number;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  drift: number;
};

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      id: i,
      top: `${(i * 37) % 100}%`,
      left: `${(i * 53) % 100}%`,
      size: 1.2 + (i % 4) * 0.7,
      duration: 14 + (i % 9) * 2.2,
      delay: -((i * 1.7) % 18),
      drift: 40 + (i % 6) * 18,
    });
  }
  return stars;
}

/** Daha açık kuzey ışıkları + kayan yıldızlar — kartla kontrastı yumuşak tutar */
export function LoginSky() {
  const stars = useMemo(() => makeStars(28), []);

  return (
    <div className="login-sky pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Açık gece / alacakaranlık — saf siyah değil */}
      <div className="absolute inset-0 bg-[linear-gradient(165deg,#1e4a6e_0%,#2a5f82_35%,#3d7a9a_70%,#4a8fad_100%)]" />
      <div className="login-aurora login-aurora--a" />
      <div className="login-aurora login-aurora--b" />
      <div className="login-aurora login-aurora--c" />

      {stars.map((s) => {
        const style = {
          top: s.top,
          left: s.left,
          width: s.size,
          height: s.size,
          animationDuration: `${s.duration}s`,
          animationDelay: `${s.delay}s`,
          ['--drift' as string]: `${s.drift}px`,
        } as CSSProperties;

        return <span key={s.id} className="login-star" style={style} />;
      })}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,rgba(20,50,80,0.18)_100%)]" />
    </div>
  );
}
