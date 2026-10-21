import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from '@rive-app/react-canvas';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from 'react';
import { MascotSpeechBubble } from './MascotSpeechBubble';

export type MascotFocus = 'none' | 'email' | 'password';

type Props = {
  focus: MascotFocus;
  passwordVisible?: boolean;
  outcome?: 'idle' | 'success' | 'fail';
  trackRef: MutableRefObject<HTMLElement | null>;
};

const STATE_MACHINE = 'Login Machine';
const LERP = 0.12;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Login Teddy — bakış / göz kapatma + konuşma balonu.
 * Kural: şifre odaktayken VEYA şifre görünürken → gözler kapalı.
 */
export function LoginMascot({
  focus,
  passwordVisible = false,
  outcome = 'idle',
  trackRef,
}: Props) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/login-teddy.riv',
    stateMachine: STATE_MACHINE,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });

  const isChecking = useStateMachineInput(rive, STATE_MACHINE, 'isChecking');
  const isHandsUp = useStateMachineInput(rive, STATE_MACHINE, 'isHandsUp');
  const numLook = useStateMachineInput(rive, STATE_MACHINE, 'numLook');
  const trigSuccess = useStateMachineInput(rive, STATE_MACHINE, 'trigSuccess');
  const trigFail = useStateMachineInput(rive, STATE_MACHINE, 'trigFail');

  const targetLook = useRef(50);
  const currentLook = useRef(50);
  const rafId = useRef(0);
  const lastOutcome = useRef<'idle' | 'success' | 'fail'>('idle');
  const prevCover = useRef<boolean | null>(null);

  const coverEyes = focus === 'password' || passwordVisible;
  const canTrack = !coverEyes;

  useLayoutEffect(() => {
    if (!isChecking || !isHandsUp) return;

    const justCovered = coverEyes && prevCover.current === false;
    prevCover.current = coverEyes;

    if (coverEyes) {
      isChecking.value = false;
      isHandsUp.value = true;
      targetLook.current = 50;
      if (justCovered && rive && passwordVisible) {
        for (let i = 0; i < 8; i += 1) {
          rive.drawFrame();
        }
      }
      return;
    }

    isHandsUp.value = false;
    isChecking.value = true;
  }, [coverEyes, isChecking, isHandsUp, passwordVisible, rive]);

  useEffect(() => {
    if (outcome === lastOutcome.current) return;
    lastOutcome.current = outcome;
    if (outcome === 'success') trigSuccess?.fire();
    if (outcome === 'fail') trigFail?.fire();
  }, [outcome, trigSuccess, trigFail]);

  useEffect(() => {
    if (!numLook) return;
    const reduced = prefersReducedMotion();

    const tick = () => {
      const cur = currentLook.current;
      const tgt = targetLook.current;
      const next = reduced ? tgt : cur + (tgt - cur) * LERP;
      currentLook.current = next;
      numLook.value = next;
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [numLook]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      if (!canTrack) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      targetLook.current = Math.min(100, Math.max(0, ratio * 100));
    };

    const onLeave = () => {
      if (canTrack) targetLook.current = 50;
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [canTrack, trackRef]);

  return (
    <div className="relative flex h-full min-h-[320px] w-full flex-col items-center justify-center px-4 pb-10 pt-6 sm:min-h-[400px] lg:min-h-0 lg:px-10 lg:pb-14 lg:pt-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_40%)]" />

      <div className="relative z-10 flex w-full flex-col items-center">
        <MascotSpeechBubble />

        <div className="h-[240px] w-full max-w-[380px] sm:h-[300px] lg:h-[360px]">
          <RiveComponent className="h-full w-full" aria-hidden />
        </div>

        <p className="mt-1 max-w-[280px] text-center text-sm font-medium text-white/95 drop-shadow-sm">
          Daha Güzel Teknoloji için Buradayız.
        </p>
      </div>
    </div>
  );
}
