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

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
