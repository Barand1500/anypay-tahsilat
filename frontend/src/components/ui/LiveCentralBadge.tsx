/** Merkezi API açıkken sayfa başlığı yanına küçük canlı rozet */
export function LiveCentralBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/60',
        'bg-gradient-to-b from-emerald-400 to-emerald-600 px-2 py-1',
        'text-[10px] font-extrabold uppercase tracking-wide text-white',
        'shadow-[0_2px_0_0_#047857,0_6px_14px_rgba(16,185,129,0.45)]',
        className,
      ].join(' ')}
      title="Güzel Teknoloji merkezi API — canlı veri (salt okunur)"
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
      Canlı veri
    </span>
  );
}
