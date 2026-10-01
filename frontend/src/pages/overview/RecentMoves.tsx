import { Link } from 'react-router-dom';
import type { OverviewData } from './overviewTypes';

type Move = OverviewData['recentMoves']['successful'][number];

function MoveColumn({ title, moves, tone }: { title: string; moves: Move[]; tone: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={`mb-2 text-[11px] font-bold ${tone}`}>{title}</p>
      <div className="space-y-1">
        {moves.length ? moves.map((move) => (
          <Link key={move.id} to={`/hareketler/${move.id}`} title={`${move.number} · ${move.at} · ${move.amount}`} className="block min-w-0 rounded-md px-1 py-1 transition hover:bg-[var(--panel-hover)]">
            <span className="block truncate text-[11px] font-semibold text-[var(--panel-ink)]">{move.number}</span>
            <span className="block truncate text-[10px] text-[var(--panel-muted)]">{move.amount}</span>
          </Link>
        )) : <p className="text-[11px] text-[var(--panel-muted)]">Hareket yok</p>}
      </div>
    </div>
  );
}

export function RecentMoves({ moves }: { moves: OverviewData['recentMoves'] }) {
  return (
    <div className="relative flex min-w-0 gap-4 border-t border-[var(--panel-line)] pt-3">
      <div className="pointer-events-none absolute bottom-[3px] left-1/2 top-5 w-px bg-[var(--panel-line)]" aria-hidden />
      <MoveColumn title="Son 5 başarılı" moves={moves.successful} tone="text-emerald-600" />
      <MoveColumn title="Son 5 başarısız" moves={moves.failed} tone="text-rose-600" />
    </div>
  );
}
