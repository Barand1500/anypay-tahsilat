import { Link } from 'react-router-dom';
import type { OverviewData } from './overviewTypes';

type Cancel = OverviewData['recentCancels'][number];
type Request = OverviewData['recentRequests'][number];

type Props =
  | { kind: 'cancel'; rows: Cancel[] }
  | { kind: 'request'; rows: Request[] };

export function RecentKpiList(props: Props) {
  const title = props.kind === 'cancel' ? 'Son 5 iptal / iade' : 'Son 5 ödeme isteği';

  return (
    <div className="min-w-0 border-t border-[var(--panel-line)] pt-3">
      <p className="mb-2 text-[11px] font-bold text-[var(--panel-muted)]">{title}</p>
      <div className="space-y-1">
        {props.rows.length ? props.rows.map((row) => {
          const detail = props.kind === 'cancel' ? (row as Cancel).kind : (row as Request).status;
          const content = (
            <>
              <span className="flex min-w-0 items-center justify-between gap-1">
                <span className="min-w-0 truncate font-semibold">{row.number}</span>
                <span className="shrink-0 text-[var(--panel-muted)]">{detail}</span>
              </span>
              <span className="block truncate text-[var(--panel-muted)]">{row.amount} · {row.at}</span>
            </>
          );
          return props.kind === 'cancel' ? (
            <Link key={row.id} to={`/hareketler/${row.id}`} title={`${row.number} · ${detail} · ${row.amount} · ${row.at}`} className="block min-w-0 rounded-md px-1 py-1 text-[10px] text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]">{content}</Link>
          ) : (
            <Link key={row.id} to={`/odeme-istekleri/${row.id}/duzenle`} title={`${row.number} · ${detail} · ${row.amount} · ${row.at}`} className="block min-w-0 rounded-md px-1 py-1 text-[10px] text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]">{content}</Link>
          );
        }) : <p className="text-[11px] text-[var(--panel-muted)]">Kayıt yok</p>}
      </div>
    </div>
  );
}
