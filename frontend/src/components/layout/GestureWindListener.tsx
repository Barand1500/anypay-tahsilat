import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { MATCH_THRESHOLD, pathDistance, pathLength, preparePath, type Pt } from './gesturePath';
import { useGestureWind } from './GestureWindContext';

const START_IGNORE =
  'button, a, input, textarea, select, label, [contenteditable="true"], [data-gw-settings], [data-gw-ignore], [role="dialog"], [role="menu"]';

type Props = {
  onOpenSearch: () => void;
};

/**
 * Jest dinleyici — mod açıkken serbest çizim; eşleşince aksiyon.
 * Çizim başladıktan sonra bırakılana kadar her yerde geçerli.
 */
export function GestureWindListener({ onOpenSearch }: Props) {
  const { enabled, gestures, settingsOpen, liveStroke, setLiveStroke } = useGestureWind();
  const navigate = useNavigate();
  const { theme, applyTheme } = useTheme();
  const drawing = useRef(false);
  const points = useRef<Pt[]>([]);
  const startElOk = useRef(false);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (!enabled || settingsOpen) {
      drawing.current = false;
      setLiveStroke(null);
      return;
    }

    function onDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Başlangıç: etkileşimli öğede değilse
      if (t.closest(START_IGNORE)) {
        startElOk.current = false;
        return;
      }
      startElOk.current = true;
      drawing.current = true;
      points.current = [{ x: e.clientX, y: e.clientY }];
      setLiveStroke([{ x: e.clientX, y: e.clientY }]);
      document.body.style.userSelect = 'none';
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    function onMove(e: PointerEvent) {
      if (!drawing.current) return;
      // Basılı tutarak devam — her yerde geçerli
      const last = points.current[points.current.length - 1];
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 2) return;
      points.current.push({ x: e.clientX, y: e.clientY });
      setLiveStroke([...points.current]);
      e.preventDefault();
    }

    function onUp() {
      if (!drawing.current) return;
      drawing.current = false;
      document.body.style.userSelect = '';
      const raw = points.current;
      points.current = [];
      setLiveStroke(null);

      if (!startElOk.current) return;
      if (pathLength(raw) < 48) return; // tıklama / kısa titreşim

      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);

      const prepared = preparePath(raw);
      let best = { id: '', dist: Infinity };
      for (const g of gestures) {
        const d = pathDistance(prepared, g.path);
        if (d < best.dist) best = { id: g.id, dist: d };
      }
      if (best.dist > MATCH_THRESHOLD || !best.id) return;
      const hit = gestures.find((g) => g.id === best.id);
      if (!hit) return;

      const a = hit.action;
      switch (a.type) {
        case 'navigate':
          if (a.target) navigate(a.target);
          break;
        case 'search':
          onOpenSearch();
          break;
        case 'theme':
          applyTheme(theme === 'light' ? 'dark' : 'light');
          break;
        case 'customer':
          if (a.target) navigate(`/musteriler/${a.target}`);
          break;
        case 'collect':
          if (a.target) navigate(`/musteriler/${a.target}/odeme-al`);
          break;
        case 'quick-pay':
          navigate('/hizli-odeme');
          break;
        default:
          break;
      }
    }

    function onClickCapture(e: MouseEvent) {
      if (!suppressClick.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      document.body.style.userSelect = '';
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [
    enabled,
    settingsOpen,
    gestures,
    navigate,
    onOpenSearch,
    applyTheme,
    theme,
    setLiveStroke,
  ]);

  if (!liveStroke || liveStroke.length < 2) return null;

  const d = liveStroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  return createPortal(
    <svg
      className="pointer-events-none fixed inset-0 z-[12500]"
      width="100%"
      height="100%"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="var(--color-brand-500)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d={d}
        fill="none"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>,
    document.body,
  );
}
