import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { AccentColorPicker } from '../../components/ui/AccentColorPicker';
import { ChartPanel, type ChartRange } from '../../components/widgets/ChartPanel';
import { FavoriteCustomerSlots } from '../../components/widgets/FavoriteCustomerSlots';
import { PeriodCompareCard } from '../../components/widgets/PeriodCompareCard';
import { PieChartPanel } from '../../components/widgets/PieChartPanel';
import { QuickActionsPanel } from '../../components/widgets/QuickActionsPanel';
import { StatCard } from '../../components/widgets/StatCard';
import { api } from '../../lib/api';
import {
  DEFAULT_OVERVIEW_FILTER,
  OverviewFilterFab,
  type OverviewFilterState,
} from './OverviewFilterFab';
import {
  GROUP_META,
  GROUP_ORDER,
  loadGroups,
  moveInGroup,
  saveGroups,
  TILE_GROUP,
  TILE_LABEL,
  type OverviewGroupId,
  type OverviewGroups,
  type OverviewTileId,
} from './overviewLayout';
import type { OverviewData } from './overviewTypes';
import { PlanBoard } from './PlanBoard';

const LONG_MS = 420;
const CANCEL_PX = 10;
const SWAP_MS = 160;

type Ghost = {
  id: OverviewTileId;
  group: OverviewGroupId;
  w: number;
  h: number;
  ox: number;
  oy: number;
};

export default function OverviewPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<OverviewFilterState>(DEFAULT_OVERVIEW_FILTER);
  const [chartRange, setChartRange] = useState<ChartRange>('1A');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groups, setGroups] = useState<OverviewGroups>(() => loadGroups());
  const [editing, setEditing] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [overId, setOverId] = useState<OverviewTileId | null>(null);

  const groupEls = useRef<Partial<Record<OverviewGroupId, HTMLDivElement | null>>>({});
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const editingRef = useRef(false);
  editingRef.current = editing;
  const ghostRef = useRef<Ghost | null>(null);
  const ghostDomRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const lastSwap = useRef(0);
  const suppressClick = useRef(false);

  const pending = useRef<{
    id: OverviewTileId;
    x: number;
    y: number;
    timer: number;
  } | null>(null);

  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (filter.branch !== 'all') qs.set('branchId', filter.branch);
        if (filter.user !== 'all') qs.set('userId', filter.user);
        if (filter.from) qs.set('from', filter.from);
        if (filter.to) qs.set('to', filter.to);
        qs.set('chartRange', chartRange);
        const next = await api.get<OverviewData>(`/api/overview?${qs.toString()}`, token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Özet yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, filter.branch, filter.user, filter.from, filter.to, chartRange]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!suppressClick.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    function onCtx(e: Event) {
      if (editingRef.current || pending.current) e.preventDefault();
    }
    document.addEventListener('contextmenu', onCtx, true);
    return () => document.removeEventListener('contextmenu', onCtx, true);
  }, []);

  const clearPending = useCallback(() => {
    if (pending.current) {
      window.clearTimeout(pending.current.timer);
      pending.current = null;
    }
  }, []);

  const stopDrag = useCallback(() => {
    ghostRef.current = null;
    setGhost(null);
    setOverId(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.body.style.touchAction = '';
  }, []);

  const exitEdit = useCallback(() => {
    clearPending();
    stopDrag();
    setEditing(false);
  }, [clearPending, stopDrag]);

  const placeGhost = useCallback((clientX: number, clientY: number, g: Ghost) => {
    const el = ghostDomRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${clientX - g.ox}px, ${clientY - g.oy}px, 0)`;
  }, []);

  const startDrag = useCallback(
    (id: OverviewTileId, clientX: number, clientY: number) => {
      const group = TILE_GROUP[id];
      const el = groupEls.current[group]?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      suppressClick.current = true;
      pointerRef.current = { x: clientX, y: clientY };
      const g: Ghost = {
        id,
        group,
        w: r.width,
        h: r.height,
        ox: clientX - r.left,
        oy: clientY - r.top,
      };
      ghostRef.current = g;
      setGhost(g);
      setOverId(null);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.body.style.touchAction = 'none';
      requestAnimationFrame(() => placeGhost(clientX, clientY, g));
    },
    [placeGhost],
  );

  const enterEdit = useCallback(
    (id: OverviewTileId, clientX: number, clientY: number) => {
      clearPending();
      editingRef.current = true;
      setEditing(true);
      startDrag(id, clientX, clientY);
    },
    [clearPending, startDrag],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && editingRef.current) {
        e.preventDefault();
        exitEdit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exitEdit]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = pending.current;
      if (p && !editingRef.current) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CANCEL_PX) clearPending();
      }

      const g = ghostRef.current;
      if (!g) return;
      e.preventDefault();
      pointerRef.current = { x: e.clientX, y: e.clientY };
      placeGhost(e.clientX, e.clientY, g);

      const root = groupEls.current[g.group];
      if (!root) return;

      const tiles = [...root.querySelectorAll<HTMLElement>('[data-tile-id]')];
      let hit: OverviewTileId | null = null;
      for (const el of tiles) {
        const id = el.dataset.tileId as OverviewTileId;
        if (id === g.id) continue;
        const r = el.getBoundingClientRect();
        if (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        ) {
          hit = id;
          break;
        }
      }
      if (!hit) {
        setOverId(null);
        return;
      }

      const now = performance.now();
      if (now - lastSwap.current < SWAP_MS) {
        setOverId(hit);
        return;
      }

      const moved = moveInGroup(groupsRef.current, g.id, hit);
      if (!moved) {
        setOverId(hit);
        return;
      }

      lastSwap.current = now;
      groupsRef.current = moved;
      setGroups(moved);
      setOverId(hit);
    }

    function onUp() {
      clearPending();
      if (ghostRef.current) stopDrag();
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clearPending, placeGhost, stopDrag]);

  function onTileDown(id: OverviewTileId, e: ReactPointerEvent) {
    if (e.button !== 0) return;

    if (editing) {
      e.preventDefault();
      e.stopPropagation();
      startDrag(id, e.clientX, e.clientY);
      return;
    }

    clearPending();
    const x = e.clientX;
    const y = e.clientY;
    const timer = window.setTimeout(() => {
      pending.current = null;
      enterEdit(id, x, y);
    }, LONG_MS);
    pending.current = { id, x, y, timer };
  }

  function renderTile(id: OverviewTileId): ReactNode {
    if (!data) return null;
    switch (id) {
      case 'kpi-customers':
      case 'kpi-moves':
      case 'kpi-cancel':
      case 'kpi-requests': {
        const k = data.kpis.find((x) => `kpi-${x.id}` === id);
        if (!k) return null;
        return <StatCard title={k.title} value={k.value} meta={k.meta} tone={k.tone} />;
      }
      case 'period-day':
      case 'period-week':
      case 'period-month':
      case 'period-year': {
        const p = data.periods.find((x) => `period-${x.id}` === id);
        if (!p) return null;
        return (
          <PeriodCompareCard
            title={p.title}
            current={p.current}
            previous={p.previous}
            changePct={p.changePct}
            banks={p.banks}
            footer={
              p.id === 'day' ? (
                <AccentColorPicker />
              ) : p.id === 'week' ? (
                <FavoriteCustomerSlots />
              ) : undefined
            }
          />
        );
      }
      case 'quick-actions':
        return <QuickActionsPanel />;
      case 'distribution':
        return (
          <PieChartPanel
            key={`${filter.branch}-${filter.user}-${filter.from}-${filter.to}`}
            datasets={data.pieDatasets}
          />
        );
      case 'plan-board':
        return <PlanBoard />;
      case 'chart':
        return (
          <ChartPanel
            title={data.chart.title}
            subtitle={data.chart.subtitle}
            range={chartRange}
            onRangeChange={setChartRange}
            series={data.chart.series}
            points={data.chart.points}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="relative w-full space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-10 text-center text-sm text-[var(--panel-muted)]">
          Özet yükleniyor…
        </div>
      ) : null}

      {editing ? (
        <div
          className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand-500)]/30 bg-[color-mix(in_srgb,var(--color-brand-500)_8%,var(--panel-elevated))] px-3 py-2.5 shadow-[var(--panel-shadow)] backdrop-blur-md sm:px-4"
          role="status"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-brand-700)]">Kutuları düzenle</p>
            <p className="truncate text-xs text-[var(--panel-muted)]">
              Aynı gruptakileri sürükle · Esc / Tamam
            </p>
          </div>
          <button
            type="button"
            data-km-jump
            onClick={exitEdit}
            className="shrink-0 rounded-full bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
          >
            Tamam
          </button>
        </div>
      ) : null}

      {data
        ? GROUP_ORDER.map((groupId) => {
            const meta = GROUP_META[groupId];
            const tiles = groups[groupId];
            return (
              <div
                key={groupId}
                ref={(el) => {
                  groupEls.current[groupId] = el;
                }}
                className={[meta.grid, editing ? 'select-none touch-none' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {tiles.map((id) => {
                  const lifting = ghost?.id === id;
                  const isOver = overId === id && ghost?.id !== id;

                  return (
                    <div
                      key={id}
                      data-tile-id={id}
                      onPointerDown={(e) => onTileDown(id, e)}
                      className={[
                        'relative h-full min-h-0 transition-[box-shadow] duration-200 ease-out',
                        editing && !lifting ? 'cursor-grab overview-ios-edit' : '',
                        lifting ? 'z-10' : '',
                        isOver ? 'rounded-2xl ring-2 ring-[var(--color-brand-500)]/30' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div
                        className={[
                          'h-full min-h-0',
                          editing ? 'pointer-events-none' : '',
                          lifting ? 'invisible' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={lifting ? { height: ghost.h } : undefined}
                        aria-hidden={lifting || undefined}
                      >
                        {renderTile(id)}
                      </div>
                      {lifting ? (
                        <div
                          className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-[var(--color-brand-500)]/28 bg-[color-mix(in_srgb,var(--color-brand-500)_4%,var(--panel-surface))]"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })
        : null}

      {ghost
        ? createPortal(
            <div
              ref={(el) => {
                ghostDomRef.current = el;
                if (el && ghostRef.current) {
                  const { x, y } = pointerRef.current;
                  placeGhost(x, y, ghostRef.current);
                }
              }}
              className="pointer-events-none fixed left-0 top-0 z-[200] will-change-transform"
              style={{
                width: ghost.w,
                height: ghost.h,
                transform: 'translate3d(-9999px,-9999px,0)',
              }}
            >
              <div className="flex h-full flex-col justify-center rounded-2xl border border-[var(--color-brand-500)]/25 bg-[var(--panel-elevated)] px-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--panel-muted)]">
                  Taşınıyor
                </p>
                <p className="mt-1 text-base font-bold text-[var(--panel-ink)]">
                  {TILE_LABEL[ghost.id]}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}

      <OverviewFilterFab
        value={filter}
        onChange={setFilter}
        branches={data?.filters.branches}
        users={data?.filters.users}
      />
    </div>
  );
}
