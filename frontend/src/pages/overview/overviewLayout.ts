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

export type OverviewGroupId = 'kpis' | 'periods' | 'tools' | 'plan' | 'moves';

export const GROUP_LABEL: Record<OverviewGroupId, string> = {
  kpis: 'Genel Bakış',
  periods: 'Dönem Karşılaştırmaları',
  tools: 'Hızlı İşlemler ve Dağılım',
  plan: 'Canlı Plan',
  moves: 'Hareketler',
};

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
  'plan-board': 'plan',
  chart: 'moves',
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
  plan: {
    grid: 'grid gap-4',
    tiles: ['plan-board'],
  },
  moves: {
    grid: 'grid gap-4',
    tiles: ['chart'],
  },
};

export const DEFAULT_GROUP_ORDER: OverviewGroupId[] = ['kpis', 'periods', 'tools', 'plan', 'moves'];
const ORDER_KEY = 'anypay.overview.groupDisplayOrder.v1';

export function loadGroupOrder(): OverviewGroupId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') as unknown[];
    const saved = raw.filter((id): id is OverviewGroupId => typeof id === 'string' && DEFAULT_GROUP_ORDER.includes(id as OverviewGroupId));
    return [...saved, ...DEFAULT_GROUP_ORDER.filter((id) => !saved.includes(id))];
  } catch {
    return [...DEFAULT_GROUP_ORDER];
  }
}

export function saveGroupOrder(order: OverviewGroupId[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

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
    plan: [...GROUP_META.plan.tiles],
    moves: [...GROUP_META.moves.tiles],
  };
}

const LS_KEY = 'anypay.overview.groupOrder.v1';
const VISIBILITY_KEY = 'anypay.overview.groupVisibility.v1';
export type OverviewVisibility = Record<OverviewGroupId, boolean>;

export function defaultVisibility(): OverviewVisibility {
  return { kpis: true, periods: true, tools: true, plan: true, moves: true };
}

export function loadVisibility(): OverviewVisibility {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISIBILITY_KEY) || '{}') as Partial<OverviewVisibility> & { stack?: boolean };
    const defaults = defaultVisibility();
    return {
      kpis: parsed.kpis ?? defaults.kpis,
      periods: parsed.periods ?? defaults.periods,
      tools: parsed.tools ?? defaults.tools,
      plan: parsed.plan ?? parsed.stack ?? defaults.plan,
      moves: parsed.moves ?? parsed.stack ?? defaults.moves,
    };
  } catch {
    return defaultVisibility();
  }
}

export function saveVisibility(visibility: OverviewVisibility) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visibility));
}

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
      plan: sanitizeGroup('plan', parsed.plan),
      moves: sanitizeGroup('moves', parsed.moves),
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
