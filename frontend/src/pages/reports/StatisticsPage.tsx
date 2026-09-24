import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { MonthMultiSelect } from '../../components/ui/MonthMultiSelect';
import { getBranchOptions, INITIAL_USERS } from '../users/mockUsers';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import { StatRankingCard } from './StatRankingCard';
import {
  getStatistics,
  STAT_YEARS,
  type StatisticsBundle,
} from './mockStatistics';

gsap.registerPlugin(useGSAP);

type SectionId = keyof StatisticsBundle;

const SECTION_META: Record<
  SectionId,
  { title: string; subtitle: string; showLogo?: boolean }
> = {
  customers: {
    title: 'En çok tahsilat yapılan 10 müşteri',
    subtitle: 'Seçilen dönemde müşteri bazlı tahsilat sıralaması',
  },
  banks: {
    title: 'En çok tahsilat yapılan 10 banka',
    subtitle: 'Banka / POS kanalına göre dağılım',
    showLogo: true,
  },
  cards: {
    title: 'En çok tahsilat yapılan 10 müşteri kartı',
    subtitle: 'Kart bazlı tahsilat yoğunluğu',
  },
};

const DEFAULT_ORDER: SectionId[] = ['customers', 'banks', 'cards'];

export default function StatisticsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('istatistikler'));
  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>('2026');
  const [months, setMonths] = useState<string[]>(['9']);
  const [fullYear, setFullYear] = useState(false);
  const [order, setOrder] = useState<SectionId[]>(DEFAULT_ORDER);
  const [rearrange, setRearrange] = useState(false);
  const [dragId, setDragId] = useState<SectionId | null>(null);
  const [overId, setOverId] = useState<SectionId | null>(null);

  const dragIdRef = useRef<SectionId | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  const branchOptions = useMemo(
    () => getBranchOptions().map((b) => ({ value: b, label: b })),
    [],
  );
  const userOptions = useMemo(
    () => INITIAL_USERS.map((u) => ({ value: String(u.id), label: u.name })),
    [],
  );

  const data = useMemo(
    () =>
      getStatistics({
        year: year || '2026',
        months: fullYear ? [] : months,
        fullYear,
        branch,
        userId,
      }),
    [year, months, fullYear, branch, userId],
  );

  const filtersActive =
    !!branch ||
    !!userId ||
    year !== '2026' ||
    months.join(',') !== '9' ||
    fullYear;

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setYear('2026');
    setMonths(['9']);
    setFullYear(false);
  }

  function showFullYear() {
    setFullYear(true);
    setMonths([]);
  }

  useGSAP(
    () => {
      gsap.from('[data-stat-chrome]', {
        autoAlpha: 0,
        y: 10,
        stagger: 0.06,
        duration: 0.4,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  useEffect(() => {
    if (!rearrange) return;
    function onMove(e: PointerEvent) {
      const id = dragIdRef.current;
      if (!id || !listRef.current) return;
      const cards = [...listRef.current.querySelectorAll<HTMLElement>('[data-section-id]')];
      let hit: SectionId | null = null;
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) {
          hit = el.dataset.sectionId as SectionId;
          break;
        }
      }
      if (hit && hit !== id) {
        setOverId(hit);
        setOrder((prev) => {
          const next = [...prev];
          const from = next.indexOf(id);
          const to = next.indexOf(hit!);
          if (from < 0 || to < 0 || from === to) return prev;
          next.splice(from, 1);
          next.splice(to, 0, id);
          return next;
        });
      }
    }
    function onUp() {
      dragIdRef.current = null;
      setDragId(null);
      setOverId(null);
      setRearrange(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [rearrange]);

  function onDragHandleDown(id: SectionId, e: ReactPointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Metin seçimini engelle
    window.getSelection()?.removeAllRanges();
    dragIdRef.current = id;
    setDragId(id);
    setRearrange(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }

  return (
    <div ref={rootRef} className="space-y-4">
      <section
        data-stat-chrome
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 text-[var(--panel-ink)] transition hover:text-[var(--color-brand-600)]"
            aria-expanded={filtersOpen}
          >
            <FilterIcon />
            <h2 className="text-base font-bold">Filtreler</h2>
            <span
              className={['ml-0.5 text-[var(--panel-muted)] transition', filtersOpen ? 'rotate-180' : ''].join(
                ' ',
              )}
            >
              <ChevronSm />
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-km-jump
              onClick={showFullYear}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
                fullYear
                  ? 'bg-[var(--color-brand-600)] text-white'
                  : 'border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]/50',
              ].join(' ')}
            >
              <CalendarIcon />
              Tüm Yılı Göster
            </button>
            <button
              type="button"
              data-km-jump
              onClick={resetFilters}
              disabled={!filtersActive}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ResetIcon />
              Sıfırla
            </button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="border-t border-[var(--panel-line)] px-4 pb-4 pt-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <FloatingSearchSelect
                label="Şube/Departman Seçin"
                options={branchOptions}
                value={branch}
                onChange={setBranch}
                placeholder="Şube seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Kullanıcı Seçin"
                options={userOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Kullanıcı seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Yıl Seçin"
                options={[...STAT_YEARS]}
                value={year}
                onChange={(v) => setYear(v)}
                placeholder="Yıl seçiniz."
                kmJump
              />
              <MonthMultiSelect
                label="Ay Seçin"
                value={months}
                onChange={(v) => {
                  setMonths(v);
                  if (v.length) setFullYear(false);
                }}
                disabled={fullYear}
                placeholder="Bir veya daha fazla ay…"
                kmJump
              />
            </div>
          </div>
        ) : null}
      </section>

      {rearrange ? (
        <div className="select-none rounded-xl border border-[var(--color-brand-500)]/35 bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))] px-3 py-2 text-center text-xs font-semibold text-[var(--color-brand-700)]">
          Taşıma modu — kartlar daraltıldı, bırakınca açılır
        </div>
      ) : null}

      <div ref={listRef} className={['space-y-3', rearrange ? 'select-none' : ''].join(' ')}>
        {order.map((id) => {
          const meta = SECTION_META[id];
          return (
            <div
              key={id}
              data-section-id={id}
              className={overId === id && dragId !== id ? 'ring-2 ring-[var(--color-brand-500)]/40 rounded-2xl' : ''}
            >
              <StatRankingCard
                title={meta.title}
                subtitle={meta.subtitle}
                items={data[id]}
                showLogo={meta.showLogo}
                collapsed={rearrange}
                dragging={dragId === id}
                onDragHandleDown={(e) => onDragHandleDown(id, e)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0113.66-5.66M20 12a8 8 0 01-13.66 5.66"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 5v5h5M20 19v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
