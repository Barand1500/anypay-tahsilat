import gsap from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';
import { useDockMode } from './DockModeContext';
import { GestureWindSettingsButton, useGestureWind } from './GestureWindContext';
import { RatesGearModal } from './RatesGearModal';
import { RatesTickerBar } from './RatesTickerBar';
import { useRates } from './RatesContext';

type Props = {
  children: ReactNode;
};

/**
 * Footer sahnesi — sidebar Kurlar ikonu → ok+dişli + mouse → footer sola kayar, şerit gelir.
 */
export function RatesFooterStage({ children }: Props) {
  const { phase, onArrowClick, setGearOpen, arrowBtnRef, loading } = useRates();
  const { enabled: dockOn } = useDockMode();
  const { enabled: gwOn } = useGestureWind();
  const footerPaneRef = useRef<HTMLDivElement>(null);
  const tickerPaneRef = useRef<HTMLDivElement>(null);
  const open = phase === 'open';
  const showChrome = phase === 'armed' || phase === 'open';
  const showGwInFooter = gwOn && dockOn;
  const showLeft = showChrome || showGwInFooter;
  const leftPad = showGwInFooter && !showChrome
    ? 'pl-[7.5rem] sm:pl-[8.5rem]'
    : showLeft
      ? 'pl-[5.5rem] sm:pl-[7.5rem]'
      : 'pl-0';

  useEffect(() => {
    const footer = footerPaneRef.current;
    const ticker = tickerPaneRef.current;
    if (!footer || !ticker) return;

    if (open) {
      gsap.to(footer, { x: '-105%', autoAlpha: 0.2, duration: 0.48, ease: 'power3.inOut' });
      gsap.fromTo(
        ticker,
        { x: '100%', autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out', delay: 0.05 },
      );
    } else {
      gsap.to(ticker, { x: '100%', autoAlpha: 0, duration: 0.4, ease: 'power3.inOut' });
      gsap.to(footer, { x: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    }
  }, [open]);

  return (
    <div className="relative h-16 w-full shrink-0 overflow-hidden border-t border-[var(--panel-line)] bg-[var(--panel-header)]">
      {showLeft ? (
        <div className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 sm:left-3">
          {showChrome ? (
            <>
              <button
                ref={arrowBtnRef}
                type="button"
                data-rates-arrow
                data-km-jump
                onClick={onArrowClick}
                title={open ? 'Footer’a dön' : 'Kur şeridini aç'}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                  open
                    ? 'border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]'
                    : 'border-[var(--color-brand-500)]/40 bg-[var(--panel-elevated)] text-[var(--brand-on-soft)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]',
                ].join(' ')}
              >
                <ArrowIcon flipped={open} />
              </button>
              <button
                type="button"
                data-km-jump
                onClick={() => setGearOpen(true)}
                title="Hangi kurlar görünsün"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-muted)] transition hover:border-[var(--color-brand-500)]/40 hover:text-[var(--panel-ink)]"
              >
                <GearIcon />
              </button>
              {loading && open ? (
                <span className="hidden text-[10px] font-medium text-[var(--panel-muted)] sm:inline">
                  Güncelleniyor…
                </span>
              ) : null}
            </>
          ) : null}
          {/* Dock açıkken jest ayarı footer’da */}
          {showGwInFooter ? <GestureWindSettingsButton /> : null}
        </div>
      ) : null}

      <div
        ref={footerPaneRef}
        className={['absolute inset-0 flex items-center', leftPad].join(' ')}
      >
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <div
        ref={tickerPaneRef}
        className="absolute inset-0 flex items-center pl-[5.5rem] pr-3 sm:pl-[6.5rem]"
        style={{ visibility: open ? 'visible' : 'hidden', pointerEvents: open ? 'auto' : 'none' }}
        aria-hidden={!open}
      >
        <RatesTickerBar />
      </div>

      <RatesGearModal />
    </div>
  );
}

function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={flipped ? 'rotate-180' : ''}
    >
      <path
        d="M14 6 8 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Dişli — kur seçimi ayarı (güneş/ışın değil) */
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}
