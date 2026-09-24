/** Özet API tipleri */

export type OverviewKpi = {
  id: 'customers' | 'moves' | 'cancel' | 'requests';
  title: string;
  value: string;
  meta: string;
  tone: 'blue' | 'green' | 'red' | 'orange';
};

export type OverviewPeriodBank = {
  id: string;
  name: string;
  amount: string;
  logo?: string;
};

export type OverviewPeriod = {
  id: 'day' | 'week' | 'month' | 'year';
  title: string;
  current: string;
  previous: string;
  changePct: number;
  banks: OverviewPeriodBank[];
};

export type OverviewPieSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type OverviewPieDataset = {
  id: string;
  label: string;
  slices: OverviewPieSlice[];
};

export type OverviewChartPoint = {
  label: string;
  full: string;
  values: Record<string, number>;
};

export type OverviewChartSeries = {
  id: string;
  name: string;
  color: string;
};

export type OverviewFilterOption = { value: string; label: string };

export type OverviewData = {
  kpis: OverviewKpi[];
  periods: OverviewPeriod[];
  pieDatasets: OverviewPieDataset[];
  chart: {
    title: string;
    subtitle: string;
    series: OverviewChartSeries[];
    points: OverviewChartPoint[];
  };
  filters: {
    branches: OverviewFilterOption[];
    users: OverviewFilterOption[];
  };
};
