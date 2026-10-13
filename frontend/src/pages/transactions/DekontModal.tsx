import gsap from 'gsap';
import html2canvas from 'html2canvas';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import { api } from '../../lib/api';
import {
  DekontTemplateView,
  ctxFromTransaction,
} from '../settings/DekontTemplateView';
import {
  getDefaultFisBlocks,
  getDefaultSheetBlocks,
  type DekontBlock,
  type DekontPaperFormat,
} from '../settings/dekontTypes';
import { type Transaction } from './transactionTypes';

type Props = {
  tx: Transaction;
  onClose: () => void;
};

const FORMAT_TABS: { id: DekontPaperFormat; label: string }[] = [
  { id: 'fis', label: 'Fiş (80mm)' },
  { id: 'a5', label: 'A5' },
  { id: 'a4', label: 'A4' },
];

/** Kağıt genişlikleri (ekran önizleme) */
const PAPER_WIDTH: Record<DekontPaperFormat, string> = {
  fis: '80mm',
  a5: '148mm',
  a4: '210mm',
};

/**
 * Sanal POS E-Dekont — şirket logosu + Fiş/A5/A4.
 * Esc / X; overlay tık kapatmaz.
 */
export function DekontModal({ tx, onClose }: Props) {
  const { token } = useAuth();
  const { logoUrl, systemName } = useBrand();
  const panelRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<DekontPaperFormat>('a4');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [layouts, setLayouts] = useState<Record<DekontPaperFormat, DekontBlock[]>>(() => ({
    fis: getDefaultFisBlocks(),
    a5: getDefaultSheetBlocks(),
    a4: getDefaultSheetBlocks(),
  }));
  const renderCtx = useMemo(
    () => ctxFromTransaction(tx, logoUrl, systemName),
    [tx, logoUrl, systemName],
  );
  const activeBlocks = layouts[format];

  // Açılış + format değişiminde şablonu yenile (ayar kaydı yansısın)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<{
          fis?: { blocks?: DekontBlock[] };
          a5?: { blocks?: DekontBlock[] } | null;
          a4?: { blocks?: DekontBlock[] } | null;
        }>('/api/settings/dekont', token);
        if (cancelled) return;
        setLayouts({
          fis: data.fis?.blocks?.length
            ? data.fis.blocks.map((b) => ({ ...b, fields: b.fields ? [...b.fields] : undefined }))
            : getDefaultFisBlocks(),
          a5: data.a5?.blocks?.length
            ? data.a5.blocks.map((b) => ({ ...b, fields: b.fields ? [...b.fields] : undefined }))
            : getDefaultSheetBlocks(),
          a4: data.a4?.blocks?.length
            ? data.a4.blocks.map((b) => ({ ...b, fields: b.fields ? [...b.fields] : undefined }))
            : getDefaultSheetBlocks(),
        });
      } catch {
        /* varsayılanlar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, format]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = panelRef.current;
    if (el) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 18, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
      );
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function flash(msg: string) {
    setToast(msg);
  }

  async function downloadPdf() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/payments/${tx.dbId}/dekont.pdf?format=${encodeURIComponent(format)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(j?.message || 'PDF indirilemedi');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dekont-${tx.id}-${format}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      flash(`PDF indirildi (${FORMAT_TABS.find((t) => t.id === format)?.label})`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'PDF indirilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPng() {
    if (busy) return;
    const el = document.getElementById('dekont-print-root');
    if (!el) {
      flash('Dekont alanı bulunamadı');
      return;
    }
    setBusy(true);
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        onclone: (_doc, cloned) => {
          cloned.style.boxShadow = 'none';
          cloned.style.filter = 'none';
          cloned.style.transform = 'none';
          cloned.querySelectorAll<HTMLElement>('*').forEach((node) => {
            node.style.textShadow = 'none';
            node.style.boxShadow = 'none';
            node.style.filter = 'none';
            node.style.setProperty('-webkit-text-stroke', '0');
            node.style.setProperty('-webkit-font-smoothing', 'antialiased');
            node.style.textRendering = 'geometricPrecision';
          });
        },
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `dekont-${tx.id}-${format}.png`;
      a.click();
      flash(`PNG indirildi (${FORMAT_TABS.find((t) => t.id === format)?.label})`);
    } catch {
      flash('PNG oluşturulamadı');
    } finally {
      setBusy(false);
    }
  }

  function printDekont() {
    const el = document.getElementById('dekont-print-root');
    if (!el) {
      flash('Dekont alanı bulunamadı');
      return;
    }

    // Zen / sıkı tarayıcılarda window.open(noopener) yazdırmayı engelleyebilir — iframe kullan
    const prev = document.getElementById('dekont-print-frame');
    prev?.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'dekont-print-frame';
    iframe.title = 'Dekont yazdır';
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      flash('Yazdırma penceresi açılamadı');
      return;
    }

    const width = PAPER_WIDTH[format];
    const pageSize =
      format === 'a4' ? 'A4' : format === 'a5' ? 'A5' : '80mm auto';
    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style'),
    )
      .map((n) => n.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Dekont ${tx.id}</title>
${styles}
<style>
  @page { size: ${pageSize}; margin: 8mm; }
  html, body { margin: 0; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: ${width}; max-width: 100%; margin: 0 auto; }
  #dekont-print-root { box-shadow: none !important; border: none !important; }
</style></head><body><div class="sheet">${el.outerHTML}</div></body></html>`);
    doc.close();

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 800);
    };

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        flash('Yazdırma açılamadı — tarayıcı izinlerini kontrol edin');
      } finally {
        cleanup();
      }
    };

    const imgs = Array.from(doc.images);
    if (imgs.length === 0) {
      setTimeout(runPrint, 120);
      return;
    }
    let left = imgs.length;
    const done = () => {
      left -= 1;
      if (left <= 0) setTimeout(runPrint, 80);
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }

  async function sendEmail() {
    if (!token || busy) return;
    const v = email.trim();
    if (!v || !v.includes('@')) {
      flash('Geçerli bir e-posta girin');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${tx.dbId}/dekont/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: v, format }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gönderilemedi');
      }
      flash(`Dekont gönderildi → ${v}`);
      setEmail('');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'E-posta gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="dekont-title"
        className="relative my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 id="dekont-title" className="text-lg font-bold text-[var(--panel-ink)]">
              Dekont
            </h2>
            <div className="flex rounded-xl border border-[var(--panel-line)] p-0.5">
              {FORMAT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormat(tab.id)}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    format === tab.id
                      ? 'bg-[var(--color-brand-600)] text-white'
                      : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">X</span>
            ESC
          </button>
        </header>

        <div className="max-h-[min(70vh,760px)] overflow-y-auto bg-[#e8eef4] px-4 py-5 sm:px-6">
          <div className="mx-auto" style={{ width: PAPER_WIDTH[format], maxWidth: '100%' }}>
            <div
              id="dekont-print-root"
              className="rounded-sm border border-[#c5cdd6] bg-white p-2 text-black shadow-sm sm:p-3"
              style={{ colorScheme: 'light', width: '100%' }}
            >
              <DekontTemplateView
                blocks={activeBlocks}
                ctx={renderCtx}
                mode="print"
                format={format}
                className="!w-full shadow-none"
                style={{ width: '100%', maxWidth: PAPER_WIDTH[format] }}
              />
            </div>
          </div>
        </div>

        <footer className="space-y-3 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-4 py-4 sm:px-6">
          <p className="text-center text-[11px] text-[var(--panel-muted)]">
            İndirme ve yazdırma seçili boyuta göre: <strong className="text-[var(--panel-ink)]">{FORMAT_TABS.find((t) => t.id === format)?.label}</strong>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ActionBtn icon={<PdfIcon />} label="PDF" onClick={() => void downloadPdf()} disabled={busy} />
            <ActionBtn icon={<PngIcon />} label="PNG" onClick={() => void downloadPng()} disabled={busy} />
            <ActionBtn icon={<PrintIcon />} label="Yazdır" onClick={printDekont} disabled={busy} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Adresi"
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--input-border-focus)] disabled:opacity-50"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendEmail()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-[var(--color-brand-600)] transition hover:bg-[var(--color-brand-600)] hover:text-white disabled:opacity-50"
            >
              <SendIcon />
              E-Posta Gönder
            </button>
          </div>
        </footer>

        {toast ? (
          <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
            {toast}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PngIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M3 16l5-4 4 3 3-2 6 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 8V4h10v4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="5" y="14" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 17H3v-6a2 2 0 012-2h14a2 2 0 012 2v6h-2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11l16-7-7 16-2.5-6.5L4 11z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
