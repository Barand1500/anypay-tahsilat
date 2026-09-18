import { useState } from 'react';
import { AccentColorPicker } from '../../components/ui/AccentColorPicker';
import { SearchableCombobox } from '../../components/ui/SearchableCombobox';
import { ChartPanel } from '../../components/widgets/ChartPanel';
import { FavoriteCustomerSlots } from '../../components/widgets/FavoriteCustomerSlots';
import { PeriodCompareCard } from '../../components/widgets/PeriodCompareCard';
import { PieChartPanel } from '../../components/widgets/PieChartPanel';
import { QuickActionsPanel } from '../../components/widgets/QuickActionsPanel';
import { StatCard } from '../../components/widgets/StatCard';
import { mockOverview } from './mockOverview';

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

export default function OverviewPage() {
  const data = mockOverview;
  const [branch, setBranch] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);

  return (
    <div className="w-full space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchableCombobox
          label="Şube / Departman"
          placeholder="Şube veya departman ara…"
          options={BRANCHES}
          value={branch}
          onChange={setBranch}
        />
        <SearchableCombobox
          label="Kullanıcı"
          placeholder="Kullanıcı ara…"
          options={USERS}
          value={user}
          onChange={setUser}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k) => (
          <StatCard key={k.id} title={k.title} value={k.value} meta={k.meta} tone={k.tone} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.periods.map((p) => (
          <PeriodCompareCard
            key={p.id}
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
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickActionsPanel />
        <PieChartPanel datasets={data.pieDatasets} />
      </div>

      <ChartPanel title={data.chart.title} subtitle={data.chart.subtitle} />
    </div>
  );
}
