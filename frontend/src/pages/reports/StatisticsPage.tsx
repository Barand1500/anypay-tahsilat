import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { BRANCH_OPTIONS, INITIAL_USERS } from '../users/mockUsers';
import { StatRankingCard } from './StatRankingCard';
import {
  getStatistics,
  REPORT_SUBNAV,
  STAT_MONTHS,
  STAT_YEARS,
} from './mockStatistics';

gsap.registerPlugin(useGSAP);

export default function StatisticsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>('2026');
  const [month, setMonth] = useState<string | null>('9');
  const [fullYear, setFullYear] = useState(false);

  const branchOptions = useMemo(
    () => BRANCH_OPTIONS.map((b) => ({ value: b, label: b })),
    [],
  );
  const userOptions = useMemo(
    () => INITIAL_USERS.map((u) => ({ value: u.id, label: u.name })),
    [],
  );

  const data = useMemo(
    () =>
      getStatistics({
        year: year || '2026',
        month: fullYear ? null : month,
        fullYear,
        branch,
        userId,
      }),
    [year, month, fullYear, branch, userId],
  );

  const filtersActive =
    !!branch || !!userId || year !== '2026' || month !== '9' || fullYear;

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setYear('2026');
    setMonth('9');
    setFullYear(false);
  }

  function showFullYear() {
    setFullYear(true);
    setMonth(null);
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

  return (
    <div ref={rootRef} className="w-full space-y-4 pb-8">
      <div data-stat-chrome>
        <nav className="mb-1 text-sm text-[var(--panel-ink)]/65">
          <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
            Anasayfa
          </Link>
          <span className="mx-1.5 opacity-50">›</span>
          <Link to="/raporlar" className="font-medium hover:text-[var(--color-brand-600)]">
            Raporlar
          </Link>
          <span className="mx-1.5 opacity-50">›</span>
          <span className="font-semibold text-[var(--panel-ink)]">İstatistikler</span>
        </nav>
      </div>

      <div
        data-stat-chrome
        className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-1.5 shadow-[var(--panel-shadow)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {REPORT_SUBNAV.map((item) =>
          item.ready ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  isActive
                    ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                    : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ) : (
            <span
              key={item.to}
              title="Yakında"
              className="shrink-0 cursor-not-allowed rounded-xl px-3 py-2 text-sm font-medium text-[var(--panel-muted)]/55"
            >
              {item.label}
            </span>
          ),
        )}
      </div>

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
              <FloatingSearchSelect
                label="Ay Seçin"
                options={[...STAT_MONTHS]}
                value={fullYear ? null : month}
                onChange={(v) => {
                  setMonth(v);
                  if (v) setFullYear(false);
                }}
                placeholder={fullYear ? 'Tüm yıl' : 'Ay seçiniz.'}
                kmJump
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="space-y-4">
        <StatRankingCard
          title="En çok tahsilat yapılan 10 müşteri"
          subtitle="Seçilen dönemde müşteri bazlı tahsilat sıralaması"
          items={data.customers}
        />
        <StatRankingCard
          title="En çok tahsilat yapılan 10 banka"
          subtitle="Banka / POS kanalına göre dağılım"
          items={data.banks}
          showLogo
        />
        <StatRankingCard
          title="En çok tahsilat yapılan 10 müşteri kartı"
          subtitle="Kart bazlı tahsilat yoğunluğu"
          items={data.cards}
        />
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
