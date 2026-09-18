/** Menü iskeleti — henüz yapılmayan sayfalar */
export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
      <h1 className="text-xl font-semibold text-[var(--panel-ink)]">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--panel-muted)]">
        Bu ekran sıradaki adımlarda gelecek. Şimdilik menü ve geçiş iskeleti hazır.
      </p>
    </div>
  );
}
