import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type OverviewPeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'lastWeek'
  | 'month'
  | 'lastMonth'
  | 'custom';

export type OverviewFilterState = {
  branch: string;
  user: string;
  period: OverviewPeriod;
  from: string;
  to: string;
};

const BRANCHES = [
  { value: 'all', label: 'Tüm Şubeler' },
  { value: 'merkez', label: 'Merkez' },
  { value: 'istanbul', label: 'İstanbul Anadolu' },
  { value: 'ankara', label: 'Ankara' },
  { value: 'izmir', label: 'İzmir' },
  { value: 'muhasebe', label: 'Muhasebe Departmanı' },
  { value: 'satis', label: 'Satış Departmanı' },
];

const USERS = [
  { value: 'all', label: 'Tüm Kullanıcılar' },
  { value: '1', label: 'Ercan Güzel' },
  { value: '2', label: 'Sercan Güzel' },
  { value: '3', label: 'Semihcan Güzel' },
  { value: '7', label: 'Baran Ürüncan' },
  { value: '6', label: 'App Test' },
];

/** İkili satırlar: [sol, sağ] */
const PERIOD_ROWS: { id: OverviewPeriod; label: string }[][] = [
  [
    { id: 'today', label: 'Bugün' },
    { id: 'yesterday', label: 'Dün' },
  ],
  [
    { id: 'week', label: 'Bu hafta' },
    { id: 'lastWeek', label: 'Geçen hafta' },
  ],
  [
    { id: 'month', label: 'Bu ay' },
    { id: 'lastMonth', label: 'Geçen ay' },
  ],
];

const ALL_PERIODS = PERIOD_ROWS.flat();
const PANEL_W = 352;

function rangeForPeriod(period: OverviewPeriod): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const key = (yy: number, mm: number, dd: number) => `${yy}-${pad(mm + 1)}-${pad(dd)}`;

  if (period === 'today') return { from: key(y, m, d), to: key(y, m, d) };
  if (period === 'yesterday') {
    const yest = new Date(y, m, d - 1);
    return {
      from: key(yest.getFullYear(), yest.getMonth(), yest.getDate()),
      to: key(yest.getFullYear(), yest.getMonth(), yest.getDate()),
    };
  }
  if (period === 'week') {
    const day = (now.getDay() + 6) % 7;
    const start = new Date(y, m, d - day);
    return {
      from: key(start.getFullYear(), start.getMonth(), start.getDate()),
      to: key(y, m, d),
    };
  }
  if (period === 'lastWeek') {
    const day = (now.getDay() + 6) % 7;
    const thisMon = new Date(y, m, d - day);
    const start = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 7);
    const end = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 1);
    return {
      from: key(start.getFullYear(), start.getMonth(), start.getDate()),
      to: key(end.getFullYear(), end.getMonth(), end.getDate()),
    };
  }
  if (period === 'lastMonth') {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      from: key(start.getFullYear(), start.getMonth(), start.getDate()),
      to: key(end.getFullYear(), end.getMonth(), end.getDate()),
    };
  }
  return { from: key(y, m, 1), to: key(y, m, d) };
}

export const DEFAULT_OVERVIEW_FILTER: OverviewFilterState = (() => {
  const r = rangeForPeriod('month');
  return { branch: 'all', user: 'all', period: 'month', from: r.from, to: r.to };
})();

/** FAB alt satırı — sadece seçilenler, “Tüm …” yazılmaz */
function fabSubtitle(value: OverviewFilterState) {
  const parts: string[] = [];
  if (value.branch !== 'all') {
    const b = BRANCHES.find((x) => x.value === value.branch)?.label;
    if (b) parts.push(b);
  }
  if (value.user !== 'all') {
    const u = USERS.find((x) => x.value === value.user)?.label;
    if (u) parts.push(u);
  }
  if (value.period === 'custom' && value.from && value.to) {
    const fmt = (k: string) => {
      const [y, m, d] = k.split('-');
      return `${d}.${m}.${y}`;
    };
    parts.push(`${fmt(value.from)} – ${fmt(value.to)}`);
  } else {
    const p = ALL_PERIODS.find((x) => x.id === value.period)?.label;
    if (p) parts.push(p);
  }
  return parts.join(' · ') || 'Bu ay';
}

type Props = {
  value: OverviewFilterState;
  onChange: (next: OverviewFilterState) => void;
};

/** Özet floating filtre — sağ alt FAB + panel */
export function OverviewFilterFab({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 88, right: 24 });
  const [branchQ, setBranchQ] = useState('');
  const [userQ, setUserQ] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const subtitle = fabSubtitle(value);
  const activeCount =
    (value.branch !== 'all' ? 1 : 0) +
    (value.user !== 'all' ? 1 : 0) +
    (value.period !== 'month' ? 1 : 0);

  const branches = useMemo(() => {
    const q = branchQ.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return BRANCHES.filter((b) => b.label.toLocaleLowerCase('tr').includes(q));
  }, [branchQ]);

  const users = useMemo(() => {
    const q = userQ.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return USERS.filter((u) => u.label.toLocaleLowerCase('tr').includes(q));
  }, [userQ]);

  function updatePos() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - r.top + 12,
      right: Math.max(16, window.innerWidth - r.right),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMove() {
      updatePos();
    }
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    gsap.set(panel, { transformOrigin: 'bottom right' });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      panel,
      { autoAlpha: 0, y: 14, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32 },
    );
    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' },
      );
    }
    return () => {
      tl.kill();
    };
  }, [open]);

  function setPeriod(period: OverviewPeriod) {
    if (period === 'custom') {
      onChange({
        ...value,
        period: 'custom',
        from: value.from || rangeForPeriod('month').from,
        to: value.to || rangeForPeriod('month').to,
      });
      return;
    }
    const r = rangeForPeriod(period);
    onChange({ ...value, period, from: r.from, to: r.to });
  }

  const branchSelected =
    value.branch !== 'all' ? BRANCHES.find((b) => b.value === value.branch)?.label : null;
  const userSelected =
    value.user !== 'all' ? USERS.find((u) => u.value === value.user)?.label : null;

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Özet filtresi"
            className="fixed z-[10040] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_20px_56px_rgba(0,0,0,0.2)]"
            style={{ bottom: pos.bottom, right: pos.right, width: PANEL_W }}
          >
            <div className="border-b border-[var(--panel-line)] px-4 py-3.5">
              <p className="text-[15px] font-bold tracking-tight text-[var(--panel-ink)]">Filtre</p>
            </div>

            <div className="max-h-[min(72vh,560px)] space-y-5 overflow-y-auto px-4 py-4">
              <section className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--panel-muted)]">
                  Tarih
                </p>
                <div className="overflow-hidden rounded-2xl bg-[var(--panel-surface)] ring-1 ring-[var(--panel-line)]">
                  {PERIOD_ROWS.map((row, ri) => (
                    <div key={row[0].id}>
                      {ri > 0 ? (
                        <div className="mx-2 h-px bg-[var(--panel-line)]/80" />
                      ) : null}
                      <div className="grid grid-cols-2 gap-0.5 p-0.5">
                        {row.map((p) => {
                          const on = value.period === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPeriod(p.id)}
                              className={[
                                'rounded-xl px-2 py-1.5 text-[11px] font-semibold transition',
                                on
                                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                                  : 'text-[var(--panel-ink)]/80 hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                              ].join(' ')}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <CompactDateLine
                    mark="S"
                    value={value.from}
                    onChange={(from) =>
                      onChange({ ...value, period: 'custom', from, to: value.to || from })
                    }
                  />
                  <CompactDateLine
                    mark="E"
                    value={value.to}
                    onChange={(to) =>
                      onChange({ ...value, period: 'custom', from: value.from || to, to })
                    }
                  />
                </div>
              </section>

              <div className="h-px bg-[var(--panel-line)]" />

              <FilterList
                title="Şube / Departman"
                query={branchQ}
                onQuery={setBranchQ}
                placeholder="Şube ara…"
                options={branches}
                selectedLabel={branchSelected ?? null}
                value={value.branch}
                onPick={(v) => {
                  onChange({ ...value, branch: v });
                  setBranchQ('');
                }}
                onClear={() => onChange({ ...value, branch: 'all' })}
              />

              <FilterList
                title="Kullanıcı"
                query={userQ}
                onQuery={setUserQ}
                placeholder="Kullanıcı ara…"
                options={users}
                selectedLabel={userSelected ?? null}
                value={value.user}
                onPick={(v) => {
                  onChange({ ...value, user: v });
                  setUserQ('');
                }}
                onClear={() => onChange({ ...value, user: 'all' })}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...DEFAULT_OVERVIEW_FILTER });
                  setBranchQ('');
                  setUserQ('');
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
              >
                Tamam
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-km-jump
        aria-expanded={open}
        aria-label="Özet filtresi"
        title={subtitle}
        onClick={() => setOpen((v) => !v)}
        className={[
          'fixed right-5 z-[10030] flex h-14 items-center gap-2.5 rounded-2xl px-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-[bottom,box-shadow,border-color] duration-300',
          'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)]',
          'hover:border-[var(--color-brand-500)]/50 hover:shadow-[0_16px_40px_rgba(0,0,0,0.22)]',
          open ? 'ring-2 ring-[var(--color-brand-500)]/35' : '',
        ].join(' ')}
        style={{ bottom: 'calc(var(--app-footer-offset, 0px) + 1.25rem)' }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]">
          <FilterIcon />
        </span>
        <span className="min-w-0 max-w-[168px] text-left">
          <span className="block truncate text-xs font-bold leading-tight text-[var(--panel-ink)]">
            Filtre
          </span>
          <span className="block truncate text-[10px] leading-tight text-[var(--panel-muted)]">
            {subtitle}
          </span>
        </span>
        {activeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-brand-600)] px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      {panel}
    </>
  );
}

function formatDateTr(k: string) {
  if (!k) return '';
  const [y, m, d] = k.split('-');
  if (!y || !m || !d) return '';
  return `${d}.${m}.${y}`;
}

/** GG.AA.YYYY → YYYY-MM-DD */
function parseDateTr(raw: string): string | null {
  const t = raw.trim().replace(/\s/g, '');
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Elle yazarken otomatik gg.aa.yyyy + sınırlar */
function maskDateInput(raw: string) {
  const digits = raw.replace(/\D/g, '');
  const out: string[] = [];
  let i = 0;

  // Gün
  if (digits.length > i) {
    const d0 = digits[i];
    if (Number(d0) > 3) {
      out.push(`0${d0}`);
      i += 1;
    } else if (digits.length > i + 1) {
      let dd = digits.slice(i, i + 2);
      const n = Number(dd);
      if (n > 31) dd = '31';
      else if (n === 0) dd = '01';
      out.push(dd);
      i += 2;
    } else {
      out.push(d0);
      i += 1;
    }
  }

  // Ay
  if (digits.length > i) {
    const m0 = digits[i];
    if (Number(m0) > 1) {
      out.push(`0${m0}`);
      i += 1;
    } else if (digits.length > i + 1) {
      let mm = digits.slice(i, i + 2);
      const n = Number(mm);
      if (n > 12) mm = '12';
      else if (n === 0) mm = '01';
      out.push(mm);
      i += 2;
    } else {
      out.push(m0);
      i += 1;
    }
  }

  // Yıl — her zaman 2 ile başlar (2xxx)
  if (digits.length > i) {
    let y = digits.slice(i, i + 4);
    if (y[0] !== '2') y = (`2${y}`).slice(0, 4);
    else y = y.slice(0, 4);
    out.push(y);
  }

  if (out.length === 0) return '';
  if (out.length === 1) return out[0];
  if (out.length === 2) return `${out[0]}.${out[1]}`;
  return `${out[0]}.${out[1]}.${out[2]}`;
}

/** Alt çizgili tarih — elle GG.AA.YYYY */
function CompactDateLine({
  mark,
  value,
  onChange,
}: {
  mark: 'S' | 'E';
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(() => formatDateTr(value));

  useEffect(() => {
    setText(formatDateTr(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseDateTr(raw);
    if (parsed) {
      onChange(parsed);
      setText(formatDateTr(parsed));
      return;
    }
    if (!raw.trim()) {
      onChange('');
      setText('');
      return;
    }
    setText(formatDateTr(value));
  }

  return (
    <label className="flex w-full items-center gap-2 border-0 border-b border-[var(--panel-line)] pb-1.5 transition focus-within:border-[var(--color-brand-500)]">
      <span className="w-3 shrink-0 text-[11px] font-bold text-[var(--panel-muted)]">{mark}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="gg.aa.yyyy"
        value={text}
        onChange={(e) => {
          const v = maskDateInput(e.target.value);
          setText(v);
          const parsed = parseDateTr(v);
          if (parsed) onChange(parsed);
        }}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={mark === 'S' ? 'Başlangıç' : 'Bitiş'}
        className="min-w-0 flex-1 border-0 bg-transparent py-0 text-sm tabular-nums text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)]"
      />
    </label>
  );
}

function FilterList({
  title,
  query,
  onQuery,
  placeholder,
  options,
  selectedLabel,
  value,
  onPick,
  onClear,
}: {
  title: string;
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  selectedLabel: string | null;
  value: string;
  onPick: (v: string) => void;
  onClear: () => void;
}) {
  const hasQuery = query.trim().length > 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--panel-muted)]">
          {title}
        </p>
        {selectedLabel ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex max-w-[58%] items-center gap-1 truncate rounded-full bg-[var(--brand-soft-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-on-soft)] transition hover:opacity-90"
            title="Temizle"
          >
            <span className="truncate">{selectedLabel}</span>
            <span aria-hidden className="opacity-70">
              ✕
            </span>
          </button>
        ) : null}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full border-0 border-b-2 border-[var(--panel-line)] bg-transparent py-2 pl-7 pr-1 text-sm text-[var(--panel-ink)] outline-none transition placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)]"
        />
      </div>
      {hasQuery ? (
        <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl bg-[var(--panel-surface)] p-1 ring-1 ring-[var(--panel-line)]">
          {options.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-[var(--panel-muted)]">Sonuç yok</li>
          ) : (
            options.map((o) => {
              const on = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => onPick(o.value)}
                    className={[
                      'flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition',
                      on
                        ? 'bg-[var(--color-brand-600)] font-semibold text-white'
                        : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </section>
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

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
