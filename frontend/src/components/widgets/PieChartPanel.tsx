import { useMemo, useState } from 'react';
import { SearchableCombobox } from '../ui/SearchableCombobox';

export type PieSlice = { id: string; label: string; value: number; color: string };

export type PieDataset = {
  id: string;
  label: string;
  slices: PieSlice[];
};

type Props = {
  datasets: PieDataset[];
};

/**
 * Özet pasta / donut — combobox ile veri seti.
 */
export function PieChartPanel({ datasets }: Props) {
  const [datasetId, setDatasetId] = useState<string | null>(datasets[0]?.id ?? null);
  const active = datasets.find((d) => d.id === datasetId) ?? datasets[0];
  const options = datasets.map((d) => ({ value: d.id, label: d.label }));

  const total = useMemo(
    () => (active?.slices.reduce((s, x) => s + x.value, 0) ?? 0) || 1,
    [active],
  );

  const arcs = useMemo(() => {
    if (!active) return [];
    let angle = -Math.PI / 2;
    const cx = 80;
    const cy = 80;
    const r = 58;
    const inner = 34;
    return active.slices.map((slice) => {
      const sweep = (slice.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const large = sweep > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const xi0 = cx + inner * Math.cos(a1);
      const yi0 = cy + inner * Math.sin(a1);
      const xi1 = cx + inner * Math.cos(a0);
      const yi1 = cy + inner * Math.sin(a0);
      const d = [
        `M ${x0} ${y0}`,
        `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
        `L ${xi0} ${yi0}`,
        `A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1}`,
        'Z',
      ].join(' ');
      return { ...slice, d, pct: Math.round((slice.value / total) * 100) };
    });
  }, [active, total]);

  return (
    <section className="flex h-full min-h-[220px] flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[var(--panel-ink)]">Dağılım</h2>
          <p className="text-xs text-[var(--panel-muted)]">Seçilen veri pasta olarak</p>
        </div>
        <div className="w-full min-w-[160px] sm:w-[200px]">
          <SearchableCombobox
            label="Veri"
            placeholder="Veri seç…"
            options={options}
            value={datasetId}
            onChange={setDatasetId}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative shrink-0">
          <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden>
            {arcs.map((a) => (
              <path
                key={a.id}
                d={a.d}
                fill={a.color}
                className="transition-[opacity] hover:opacity-90"
              >
                <title>
                  {a.label}: {a.value} ({a.pct}%)
                </title>
              </path>
            ))}
            <circle cx="80" cy="80" r="30" fill="var(--panel-elevated)" />
            <text
              x="80"
              y="76"
              textAnchor="middle"
              className="fill-[var(--panel-muted)] text-[10px]"
              style={{ fontSize: 10 }}
            >
              Toplam
            </text>
            <text
              x="80"
              y="92"
              textAnchor="middle"
              className="fill-[var(--panel-ink)] font-bold"
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              {active?.slices.reduce((s, x) => s + x.value, 0) ?? 0}
            </text>
          </svg>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-2">
          {arcs.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: a.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[var(--panel-ink)]">{a.label}</span>
              <span className="tabular-nums text-[var(--panel-muted)]">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
