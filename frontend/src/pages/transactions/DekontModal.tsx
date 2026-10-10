import gsap from 'gsap';
import html2canvas from 'html2canvas';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import {
  amountInWordsTr,
  dekontBankName,
  formatMoneyTr,
  formatMoneyDisplay,
  formatTxDate,
  type Transaction,
} from './transactionTypes';

type Props = {
  tx: Transaction;
  onClose: () => void;
};

type DekontFormat = 'fis' | 'a5' | 'a4';

const FORMAT_TABS: { id: DekontFormat; label: string }[] = [
  { id: 'fis', label: 'Fiş (80mm)' },
  { id: 'a5', label: 'A5' },
  { id: 'a4', label: 'A4' },
];

/** Kağıt genişlikleri (ekran önizleme) */
const PAPER_WIDTH: Record<DekontFormat, string> = {
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
  const [format, setFormat] = useState<DekontFormat>('a4');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = tx.dekont;
  const bankName = dekontBankName(tx);
  const total = tx.amount + tx.commission;
  const money = formatMoneyTr(total);
  const at = formatTxDate(tx.at);
  const isFis = format === 'fis';

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
        scale: 2,
        useCORS: true,
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
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) {
      flash('Yazdırma penceresi açılamadı');
      return;
    }
    const width = PAPER_WIDTH[format];
    win.document.write(`<!DOCTYPE html><html><head><title>Dekont ${tx.id}</title>
<style>
  @page { size: ${format === 'a4' ? 'A4' : format === 'a5' ? 'A5' : '80mm auto'}; margin: 8mm; }
  body { margin: 0; background: #fff; font-family: system-ui, sans-serif; }
  .sheet { width: ${width}; max-width: 100%; margin: 0 auto; }
</style></head><body><div class="sheet">${el.outerHTML}</div>
<script>window.onload=function(){window.focus();window.print();}</script>
</body></html>`);
    win.document.close();
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

  const legal1 = `Kredi kartımdan / banka kartımdan ${money} ₺ tutarın ${d.merchantTitle} adına çekilmesini ve ilgili tutarın üye işyerine aktarılmasını kabul ederim. İşbu belge, tarafıma ait kart ile yapılan işlemin geçerli bir ödeme talimatı olduğunu gösterir.`;

  const legal2 = `Banka veya kart kuruluşunun ödemeyi bloke etmesi, iade etmesi veya üye işyerine aktarmaması halinde ${money} ₺ tutarı ${d.merchantTitle}’ne bizzat ödemeyi taahhüt ederim. Bu dekont, mal/hizmet teslimine ilişkin yazılı delil niteliğindedir.`;

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
              className={[
                'rounded-sm border border-[#c5cdd6] bg-white text-black shadow-sm',
                isFis ? 'p-3 text-[11px]' : 'p-4 text-[13px] sm:p-5',
              ].join(' ')}
              style={{ colorScheme: 'light', width: '100%' }}
            >
              <div
                className={[
                  'mb-3 flex items-center gap-3',
                  isFis ? 'flex-col' : 'justify-between',
                ].join(' ')}
              >
                <img
                  src={logoUrl}
                  alt={systemName || 'Şirket'}
                  className={['w-auto object-contain', isFis ? 'h-9' : 'h-11'].join(' ')}
                />
                <img
                  src={tx.bankLogo}
                  alt={tx.bankName}
                  className={['w-auto max-w-[120px] object-contain', isFis ? 'h-7' : 'h-9'].join(' ')}
                />
              </div>

              <div
                className={[
                  'mb-3 border border-[#222] text-center font-bold tracking-wide text-black',
                  isFis ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-sm',
                ].join(' ')}
              >
                SANAL POS E-DEKONT
              </div>

              <div
                className={[
                  'mb-3 flex gap-2 text-black',
                  isFis ? 'flex-col text-[10px]' : 'flex-wrap items-center justify-between text-[12px]',
                ].join(' ')}
              >
                <span>
                  Dekont No: <strong>{tx.id}</strong>
                </span>
                <span className="tabular-nums">{at}</span>
              </div>

              <div className={['mb-3 grid gap-2', isFis ? 'grid-cols-1' : 'sm:grid-cols-2'].join(' ')}>
                <div className="border border-[#444] p-2.5">
                  <p className="font-bold leading-snug">{d.merchantTitle}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed sm:text-[12px]">{d.merchantAddress}</p>
                  <p className="mt-1.5 text-[11px] tabular-nums sm:text-[12px]">{d.merchantPhone}</p>
                </div>
                <div className="border border-[#444] p-2.5">
                  <p className="font-bold leading-snug">{d.cardHolderName}</p>
                  <p className="mt-1.5 text-[11px] sm:text-[12px]">-</p>
                  <p className="mt-1.5 text-[11px] tabular-nums sm:text-[12px]">{d.cardHolderPhoneMasked}</p>
                </div>
              </div>

              <div className="mb-0 border border-[#444]">
                <div className={['grid', isFis ? 'grid-cols-1' : 'sm:grid-cols-2'].join(' ')}>
                  <div className={isFis ? 'border-b border-[#444]' : 'border-b border-[#444] sm:border-b-0 sm:border-r'}>
                    <Kv label="ONAY ZAMANI" value={at} compact={isFis} />
                    <Kv label="REFERANS NO" value={d.referenceNo} compact={isFis} />
                    <Kv label="ADI SOYADI" value={d.cardHolderName} compact={isFis} />
                    <Kv label="T.C. KİMLİK NO" value={d.identityNo} compact={isFis} />
                    <Kv label="TELEFONU" value={d.cardHolderPhone} compact={isFis} />
                    <Kv label="AÇIKLAMA" value={d.description || '-'} last compact={isFis} />
                  </div>
                  <div>
                    <Kv label="İŞLEM NO" value={d.transactionNo} compact={isFis} />
                    <Kv label="ONAY KODU" value={d.authCode || ''} compact={isFis} />
                    <Kv label="BANKA" value={bankName} compact={isFis} />
                    <Kv label="KART" value={d.cardMasked} compact={isFis} />
                    <Kv label="TAKSİT" value={String(tx.installments)} compact={isFis} />
                    <Kv label="TUTAR" value={`${formatMoneyDisplay(tx.amount)}`} compact={isFis} />
                    <Kv label="KOMİSYON" value={`${formatMoneyDisplay(tx.commission)}`} compact={isFis} />
                    <Kv label="TOPLAM" value={`${money} ₺`} last strong compact={isFis} />
                  </div>
                </div>

                <div className="border-t border-[#444] px-3 py-3">
                  <p className={['font-bold uppercase tracking-wide', isFis ? 'text-[10px]' : 'text-[12px]'].join(' ')}>
                    Yalnız; {amountInWordsTr(total)}
                  </p>
                  <p className={['mt-2 text-center', isFis ? 'text-[10px]' : 'text-[12px]'].join(' ')}>
                    Yukarıdaki bedel karşılığında mal veya hizmet aldım.
                  </p>
                  {d.threeDSecure ? (
                    <p className="mt-1 text-center text-[10px] italic text-[#444] sm:text-[11px]">
                      Bu ödeme 3D Secure güvenli doğrulama ile yapılmıştır.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={['mt-3 space-y-3', isFis ? 'space-y-2' : ''].join(' ')}>
                <LegalBox text={legal1} name={d.cardHolderName} compact={isFis} />
                {!isFis ? <LegalBox text={legal2} name={d.cardHolderName} /> : null}
              </div>
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

function Kv({
  label,
  value,
  last,
  strong,
  compact,
}: {
  label: string;
  value: string;
  last?: boolean;
  strong?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        'flex gap-1 text-black',
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[12px]',
        last ? '' : 'border-b border-[#ddd]',
      ].join(' ')}
    >
      <span className={['shrink-0 font-semibold', compact ? 'w-[5.5rem]' : 'w-[7.25rem]'].join(' ')}>
        {label}
      </span>
      <span className="shrink-0">:</span>
      <span
        className={[
          'min-w-0 flex-1 break-all pl-1 tabular-nums',
          strong ? 'font-bold' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function LegalBox({
  text,
  name,
  compact,
}: {
  text: string;
  name: string;
  compact?: boolean;
}) {
  return (
    <div className={['border border-[#444] text-black', compact ? 'p-2' : 'p-2.5'].join(' ')}>
      <p className={['leading-relaxed text-[#222]', compact ? 'text-[9px]' : 'text-[11px]'].join(' ')}>
        {text}
      </p>
      <div className={['flex items-end justify-between gap-3', compact ? 'mt-3' : 'mt-5'].join(' ')}>
        <span className={['font-semibold', compact ? 'text-[10px]' : 'text-[12px]'].join(' ')}>{name}</span>
        <span className="min-w-[4.5rem] border-t border-[#666] pt-1 text-center text-[11px] font-bold tracking-wide">
          İMZA
        </span>
      </div>
    </div>
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
