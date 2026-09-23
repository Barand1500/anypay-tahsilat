/** Özet — grup içi sıralama (KPI / dönem / araç / panel) */

export type OverviewTileId =
  | 'kpi-customers'
  | 'kpi-moves'
  | 'kpi-cancel'
  | 'kpi-requests'
  | 'period-day'
  | 'period-week'
  | 'period-month'
  | 'period-year'
  | 'quick-actions'
  | 'distribution'
  | 'plan-board'
  | 'chart';

export type OverviewGroupId = 'kpis' | 'periods' | 'tools' | 'stack';

export const TILE_GROUP: Record<OverviewTileId, OverviewGroupId> = {
  'kpi-customers': 'kpis',
  'kpi-moves': 'kpis',
  'kpi-cancel': 'kpis',
  'kpi-requests': 'kpis',
  'period-day': 'periods',
  'period-week': 'periods',
  'period-month': 'periods',
  'period-year': 'periods',
  'quick-actions': 'tools',
  distribution: 'tools',
  'plan-board': 'stack',
  chart: 'stack',
};

export const GROUP_META: Record<
  OverviewGroupId,
  { grid: string; tiles: OverviewTileId[] }
> = {
  kpis: {
    grid: 'grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4',
    tiles: ['kpi-customers', 'kpi-moves', 'kpi-cancel', 'kpi-requests'],
  },
  periods: {
    grid: 'grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4',
    tiles: ['period-day', 'period-week', 'period-month', 'period-year'],
  },
  tools: {
    grid: 'grid items-stretch gap-4 sm:grid-cols-2',
    tiles: ['quick-actions', 'distribution'],
  },
  stack: {
    grid: 'grid gap-4',
    tiles: ['plan-board', 'chart'],
  },
};

export const GROUP_ORDER: OverviewGroupId[] = ['kpis', 'periods', 'tools', 'stack'];

export const TILE_LABEL: Record<OverviewTileId, string> = {
  'kpi-customers': 'Müşteriler',
  'kpi-moves': 'Hareketler',
  'kpi-cancel': 'İptal / İade',
  'kpi-requests': 'Ödeme İstekleri',
  'period-day': 'Bugün vs Dün',
  'period-week': 'Bu Hafta vs Geçen Hafta',
  'period-month': 'Bu Ay vs Geçen Ay',
  'period-year': 'Bu Yıl vs Geçen Yıl',
  'quick-actions': 'Hızlı İşlemler',
  distribution: 'Dağılım',
  'plan-board': 'Canlı Plan',
  chart: 'Hareketler',
};

export type OverviewGroups = Record<OverviewGroupId, OverviewTileId[]>;

export function defaultGroups(): OverviewGroups {
  return {
    kpis: [...GROUP_META.kpis.tiles],
    periods: [...GROUP_META.periods.tiles],
    tools: [...GROUP_META.tools.tiles],
    stack: [...GROUP_META.stack.tiles],
  };
}

const LS_KEY = 'anypay.overview.groupOrder.v1';

function sanitizeGroup(group: OverviewGroupId, list: unknown): OverviewTileId[] {
  const allowed = new Set(GROUP_META[group].tiles);
  const arr = Array.isArray(list) ? list : [];
  const next = arr.filter(
    (id): id is OverviewTileId => typeof id === 'string' && allowed.has(id as OverviewTileId),
  );
  for (const id of GROUP_META[group].tiles) {
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function loadGroups(): OverviewGroups {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultGroups();
    const parsed = JSON.parse(raw) as Partial<OverviewGroups>;
    return {
      kpis: sanitizeGroup('kpis', parsed.kpis),
      periods: sanitizeGroup('periods', parsed.periods),
      tools: sanitizeGroup('tools', parsed.tools),
      stack: sanitizeGroup('stack', parsed.stack),
    };
  } catch {
    return defaultGroups();
  }
}

export function saveGroups(groups: OverviewGroups) {
  localStorage.setItem(LS_KEY, JSON.stringify(groups));
}

/** Aynı grupta değilse sıra değişmez */
export function moveInGroup(
  groups: OverviewGroups,
  fromId: OverviewTileId,
  toId: OverviewTileId,
): OverviewGroups | null {
  const g = TILE_GROUP[fromId];
  if (TILE_GROUP[toId] !== g) return null;
  const list = groups[g];
  const from = list.indexOf(fromId);
  const to = list.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return null;
  const nextList = [...list];
  nextList.splice(from, 1);
  nextList.splice(to, 0, fromId);
  return { ...groups, [g]: nextList };
}
