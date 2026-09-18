import { useEffect, useState } from 'react';

/** Ayının sırayla söylediği kısa, mizahi cümleler */
const LINES = [
  'Selam! Hoş geldin 👋',
  'Naber, iyi misin?',
  'İspanyolca merhaba: ¡Hola!',
  '¿Qué tal? (İspanyolca idare et)',
  'Şifreyi yaz, ben bakmıyorum… galiba',
  'Kahven hazır mı? Ben hazırım.',
  'Bugün işler yolunda gitsin.',
  'Merhabaa! Yoksa yine mi pazartesi?',
  'Giriş yap, sonrası kolay.',
  'Hola hola — dil pratiği bedava.',
  'Hello World! — İngilizce yeni başladım.',
];

/**
 * Ayının üstünde konuşma balonu — birkaç saniyede bir cümle değişir.
 */
export function MascotSpeechBubble() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const id = window.setInterval(() => {
      if (reduced) {
        setIndex((i) => (i + 1) % LINES.length);
        return;
      }
      // Kısa fade out → metin değiş → fade in
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % LINES.length);
        setVisible(true);
      }, 220);
    }, 4200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative z-20 mb-1 flex w-full max-w-[300px] justify-center px-2">
      <div
        className={[
          'relative rounded-2xl bg-white px-4 py-2.5 text-center text-sm font-medium text-ink',
          'shadow-[0_10px_28px_rgba(20,50,80,0.18)]',
          'transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        role="status"
        aria-live="polite"
      >
        {LINES[index]}
        {/* Balon kuyruğu — aşağıya (ayının tepesine) */}
        <span
          className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[10px] border-x-transparent border-t-white"
          aria-hidden
        />
      </div>
    </div>
  );
}
