import gsap from 'gsap';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { fetchLiveQuotes, type LiveQuote } from './ratesApi';
import { DEFAULT_SELECTED_RATE_IDS } from './ratesCatalog';

const LS_SELECTED = 'anypay.rates.selected.v1';
/** Şerit açıkken yenileme — sık değil, siteyi yormasın */
const POLL_MS = 90_000;

export type RatesPhase = 'idle' | 'armed' | 'open';

type RatesValue = {
  phase: RatesPhase;
  selectedIds: string[];
  quotes: Record<string, LiveQuote>;
  loading: boolean;
  gearOpen: boolean;
  arrowBtnRef: RefObject<HTMLButtonElement | null>;
  /** Kurlar’a bas → ok belirir + mouse animasyonu ok’a tıklar → şerit açılır */
  requestOpen: () => void;
  /** Ok: açıkken kapatır (footer geri); armed iken şeridi açar */
  onArrowClick: () => void;
  /** Sidebar ikonu — idle’da aç, açık/armed iken kapat */
  toggleFromSidebar: () => void;
  setSelectedIds: (ids: string[]) => void;
  setGearOpen: (on: boolean) => void;
  refresh: () => Promise<void>;
};

const RatesContext = createContext<RatesValue | null>(null);

function loadSelected(): string[] {
  try {
    const raw = localStorage.getItem(LS_SELECTED);
    if (!raw) return [...DEFAULT_SELECTED_RATE_IDS];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_SELECTED_RATE_IDS];
    return parsed;
  } catch {
    return [...DEFAULT_SELECTED_RATE_IDS];
  }
}

function playMouseClickTo(target: HTMLElement, onClick: () => void) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    onClick();
    return;
  }

  const rect = target.getBoundingClientRect();
  const endX = rect.left + rect.width / 2;
  const endY = rect.top + rect.height / 2;
  const startX = Math.min(window.innerWidth - 40, endX - 120);
  const startY = Math.max(40, endY - 90);

  const layer = document.createElement('div');
  layer.id = 'rates-mouse-ghost';
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '13000',
    pointerEvents: 'none',
  });
  const cursor = document.createElement('div');
  cursor.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.5 3.5 5.5 16.5 9.2 13.2 11.5 19.2 13.6 18.3 11.3 12.4 15.5 12.4 5.5 3.5Z" fill="var(--panel-ink)" stroke="var(--panel-elevated)" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
  Object.assign(cursor.style, {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))',
  });
  layer.appendChild(cursor);
  document.body.appendChild(layer);

  const tl = gsap.timeline({
    onComplete: () => {
      layer.remove();
      onClick();
    },
  });
  tl.to(cursor, {
    left: endX - 4,
    top: endY - 2,
    duration: 0.7,
    ease: 'power2.inOut',
  }).to(cursor, {
    scale: 0.85,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
    ease: 'power1.inOut',
  });
}

export function RatesProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<RatesPhase>('idle');
  const [selectedIds, setSelectedIdsState] = useState<string[]>(loadSelected);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const arrowBtnRef = useRef<HTMLButtonElement | null>(null);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const animLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const next = await fetchLiveQuotes(selectedIds, quotesRef.current, {
          force,
          signal: ac.signal,
        });
        if (!ac.signal.aborted) setQuotes(next);
      } catch {
        /* iptal / hata — eski değerler kalsın */
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [selectedIds],
  );

  // Sadece şerit açıkken poll; sekme gizliyse dur
  useEffect(() => {
    if (phase !== 'open') return;

    void refresh(true);

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh(false);
    };
    const id = window.setInterval(tick, POLL_MS);

    function onVis() {
      if (document.visibilityState === 'visible') void refresh(false);
    }
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      abortRef.current?.abort();
    };
  }, [phase, refresh]);

  // Seçim değişince (şerit açıksa) bir kez güncelle
  useEffect(() => {
    if (phase !== 'open') return;
    void refresh(true);
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelectedIds = useCallback((ids: string[]) => {
    const next = ids.length ? ids : [...DEFAULT_SELECTED_RATE_IDS];
    setSelectedIdsState(next);
    localStorage.setItem(LS_SELECTED, JSON.stringify(next));
  }, []);

  const openTicker = useCallback(() => {
    setPhase('open');
  }, []);

  const requestOpen = useCallback(() => {
    if (animLock.current || phase === 'open') return;
    animLock.current = true;
    setPhase('armed');
    // Ok DOM’a gelsin
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const btn = arrowBtnRef.current;
        if (!btn) {
          openTicker();
          animLock.current = false;
          return;
        }
        playMouseClickTo(btn, () => {
          openTicker();
          animLock.current = false;
        });
      });
    });
  }, [phase, openTicker]);

  const onArrowClick = useCallback(() => {
    if (animLock.current) return;
    if (phase === 'open') {
      setPhase('idle');
      return;
    }
    if (phase === 'armed') {
      openTicker();
    }
  }, [phase, openTicker]);

  const toggleFromSidebar = useCallback(() => {
    if (animLock.current) return;
    if (phase === 'idle') {
      requestOpen();
      return;
    }
    // armed / open → kapat
    setPhase('idle');
  }, [phase, requestOpen]);

  const value = useMemo(
    () => ({
      phase,
      selectedIds,
      quotes,
      loading,
      gearOpen,
      arrowBtnRef,
      requestOpen,
      onArrowClick,
      toggleFromSidebar,
      setSelectedIds,
      setGearOpen,
      refresh,
    }),
    [
      phase,
      selectedIds,
      quotes,
      loading,
      gearOpen,
      requestOpen,
      onArrowClick,
      toggleFromSidebar,
      setSelectedIds,
      refresh,
    ],
  );

  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>;
}

export function useRates() {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error('useRates yalnızca RatesProvider içinde');
  return ctx;
}
