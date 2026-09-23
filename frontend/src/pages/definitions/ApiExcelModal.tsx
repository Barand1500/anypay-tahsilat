import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { ApiCategoryId } from './mockApiSettings';

type ImportStatus = 'new' | 'exists' | 'invalid';

type DraftRow = {
  row: number;
  cells: string[];
  status: ImportStatus;
  note: string;
};

type Props = {
  category: ApiCategoryId;
  title: string;
  columns: string[];
  sampleCsv: string;
  /** Satırın durumunu hesapla */
  classify: (cells: string[]) => { status: ImportStatus; note: string };
  onClose: () => void;
  onConfirm: (newRows: string[][]) => void;
};

/**
 * Excel/CSV — müşteri yükleme modalıyla aynı iskelet (adımlar + önizleme).
 */
export function ApiExcelModal({
  category,
  title,
  columns,
  sampleCsv,
  classify,
  onClose,
  onConfirm,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'guide' | 'preview'>('guide');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | ImportStatus>('all');

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const summary = {
    total: drafts.length,
    neu: drafts.filter((d) => d.status === 'new').length,
    exists: drafts.filter((d) => d.status === 'exists').length,
    invalid: drafts.filter((d) => d.status === 'invalid').length,
  };
  const visible = filter === 'all' ? drafts : drafts.filter((d) => d.status === filter);

  const resetToGuide = useCallback(() => {
    setStep('guide');
    setDrafts([]);
    setFileName('');
    setParseError(null);
    setFilter('all');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  function downloadSample() {
    const blob = new Blob(['\uFEFF' + sampleCsv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${category}-ornek.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setParseError(null);
    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setParseError('Dosyada başlık + en az bir satır olmalı.');
        setStep('guide');
        return;
      }
      const data = lines.slice(1).map((line, i) => {
        const cells = line.split(/[;,\t]/).map((c) => c.replace(/^"|"$/g, '').trim());
        const { status, note } = classify(cells);
        return { row: i + 2, cells, status, note };
      });
      setDrafts(data);
      setFileName(file.name);
      setStep('preview');
      setFilter('all');
    } catch {
      setParseError('Dosya okunamadı. CSV UTF-8 deneyin.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function confirmImport() {
    const neu = drafts.filter((d) => d.status === 'new').map((d) => d.cells);
    if (!neu.length) return;
    onConfirm(neu);
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className={[
          'relative z-10 flex max-h-[min(92vh,820px)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl transition-[max-width] duration-300',
          step === 'preview' ? 'max-w-5xl' : 'max-w-lg',
        ].join(' ')}
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/15 via-[var(--color-brand-500)]/5 to-transparent px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            ✕<span>ESC</span>
          </button>
          <div className="flex items-start gap-3 pr-16">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]">
              <UploadSheetIcon />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--color-brand-600)]">
                Excel&apos;den {title} Yükle
              </h2>
              <p className="mt-0.5 text-sm text-[var(--panel-ink)]/70">
                {step === 'guide'
                  ? 'Toplu ekleme — dosya seç, önizle, onayla'
                  : `Önizleme — ${fileName}`}
              </p>
            </div>
          </div>
          <ol className="mt-4 flex flex-wrap gap-2">
            <Phase n={1} label="Hazırla" done={step === 'preview'} active={step === 'guide'} />
            <Phase n={2} label="Dosya seç" done={step === 'preview'} active={step === 'guide'} />
            <Phase n={3} label="Önizle & onayla" done={false} active={step === 'preview'} />
          </ol>
        </header>

        {step === 'guide' ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <StepBlock n={1} title="Excel dosyanızı hazırlayın">
                <p>
                  İlk satır <strong className="text-[var(--panel-ink)]">başlık</strong> olmalı.
                  Sütunlar:{' '}
                  <strong className="text-[var(--panel-ink)]">{columns.join(', ')}</strong>
                </p>
                <button
                  type="button"
                  data-km-jump
                  onClick={downloadSample}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--color-brand-500)]/45 bg-[var(--panel-elevated)] px-3.5 py-2 text-sm font-semibold text-[var(--color-brand-600)] transition hover:bg-[var(--brand-soft-bg)]"
                >
                  <MiniSheetIcon />
                  Örnek Dosya İndir
                </button>
              </StepBlock>
              <StepBlock n={2} title="Dosyayı seçin">
                <p>
                  <strong className="text-[var(--panel-ink)]">.csv</strong> önerilir (Excel → Farklı
                  Kaydet → CSV UTF-8). Seçimden sonra önizleme açılır.
                </p>
              </StepBlock>
              <StepBlock n={3} title="Önizleme ve onay">
                <p>
                  Her satır için <StatusChip status="new" /> / <StatusChip status="exists" /> /{' '}
                  <StatusChip status="invalid" /> durumu görünür. Yalnızca{' '}
                  <strong className="text-[var(--panel-ink)]">Yeni</strong> kayıtlar eklenir.
                </p>
              </StepBlock>
              {parseError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-100 px-4 py-3 text-sm text-rose-800">
                  {parseError}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-[var(--panel-line)] px-5 py-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="hidden"
                onChange={(e) => void onFileChange(e)}
              />
              <button
                type="button"
                data-km-jump
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-600)] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
              >
                <FolderIcon />
                {busy ? 'Okunuyor…' : 'Excel / CSV Dosyası Seç'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 space-y-3 border-b border-[var(--panel-line)] px-5 py-3.5">
              <div className="flex flex-wrap gap-2">
                <StatCard
                  label="Toplam"
                  value={summary.total}
                  active={filter === 'all'}
                  onClick={() => setFilter('all')}
                />
                <StatCard
                  label="Yeni"
                  value={summary.neu}
                  tone="new"
                  active={filter === 'new'}
                  onClick={() => setFilter('new')}
                />
                <StatCard
                  label="Mevcut"
                  value={summary.exists}
                  tone="exists"
                  active={filter === 'exists'}
                  onClick={() => setFilter('exists')}
                />
                <StatCard
                  label="Hatalı"
                  value={summary.invalid}
                  tone="invalid"
                  active={filter === 'invalid'}
                  onClick={() => setFilter('invalid')}
                />
              </div>
              <p className="text-[12px] text-[var(--panel-muted)]">
                Onayda yalnızca <strong className="text-[var(--panel-ink)]">Yeni</strong> satırlar
                eklenir.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-[1] bg-[var(--panel-surface)] text-[11px] uppercase tracking-wide text-[var(--panel-muted)]">
                  <tr className="border-b border-[var(--panel-line)]">
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Durum</th>
                    {columns.map((c) => (
                      <th key={c} className="px-3 py-2.5 font-semibold">
                        {c}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-semibold">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 3}
                        className="px-4 py-10 text-center text-[var(--panel-muted)]"
                      >
                        Bu filtrede satır yok.
                      </td>
                    </tr>
                  ) : (
                    visible.map((d) => (
                      <tr
                        key={d.row}
                        className={[
                          'border-b border-[var(--panel-line)]/80',
                          d.status === 'invalid'
                            ? 'bg-rose-500/[0.04]'
                            : d.status === 'exists'
                              ? 'bg-amber-500/[0.04]'
                              : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2.5 tabular-nums text-[var(--panel-muted)]">
                          {d.row}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusChip status={d.status} />
                        </td>
                        {columns.map((_, i) => (
                          <td key={i} className="px-3 py-2.5 text-[var(--panel-ink)]">
                            {d.cells[i] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-[12px] text-[var(--panel-muted)]">
                          {d.note}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--panel-line)] px-5 py-4">
              <button
                type="button"
                onClick={resetToGuide}
                className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-2.5 text-sm font-semibold"
              >
                Farklı dosya
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)]"
              >
                İptal
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[var(--panel-muted)]">
                  {summary.neu} yeni · {summary.exists} mevcut · {summary.invalid} hatalı
                </span>
                <button
                  type="button"
                  data-km-jump
                  disabled={summary.neu === 0}
                  onClick={confirmImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Sisteme Ekle ({summary.neu})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Phase({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        active
          ? 'bg-[var(--color-brand-600)] text-white'
          : done
            ? 'bg-[var(--brand-soft-bg)] text-[var(--color-brand-600)]'
            : 'bg-[var(--panel-surface)] text-[var(--panel-muted)]',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
          active
            ? 'bg-white/20'
            : done
              ? 'bg-[var(--color-brand-600)] text-white'
              : 'bg-[var(--panel-line)]',
        ].join(' ')}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </li>
  );
}

function StepBlock({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-xs font-bold text-white">
          {n}
        </span>
        <h3 className="text-sm font-bold text-[var(--panel-ink)]">{title}</h3>
      </div>
      <div className="pl-9 text-sm leading-relaxed text-[var(--panel-muted)]">{children}</div>
    </section>
  );
}

function StatusChip({ status }: { status: ImportStatus }) {
  const map = {
    new: 'bg-emerald-500/15 text-emerald-800',
    exists: 'bg-amber-500/15 text-amber-900',
    invalid: 'bg-rose-500/15 text-rose-800',
  } as const;
  const label = status === 'new' ? 'Yeni' : status === 'exists' ? 'Mevcut' : 'Hatalı';
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${map[status]}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: ImportStatus;
  active: boolean;
  onClick: () => void;
}) {
  const toneCls =
    tone === 'new'
      ? 'text-emerald-700'
      : tone === 'exists'
        ? 'text-amber-800'
        : tone === 'invalid'
          ? 'text-rose-700'
          : 'text-[var(--color-brand-600)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-w-[4.5rem] rounded-xl border px-3 py-2 text-left transition',
        active
          ? 'border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)]'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)] hover:bg-[var(--panel-hover)]',
      ].join(' ')}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${toneCls}`}>{value}</div>
    </button>
  );
}

function UploadSheetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14 3v6h6M12 18v-6m0 0 2.5 2.5M12 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MiniSheetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4h8v16H8zM8 9h8M8 14h8M12 4v16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
