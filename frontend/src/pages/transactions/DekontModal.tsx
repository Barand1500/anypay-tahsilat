import gsap from 'gsap';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  amountInWordsTr,
  dekontBankName,
  formatMoneyTr, formatMoneyDisplay,
  formatTxDate,
  type Transaction,
} from './transactionTypes';

type Props = {
  tx: Transaction;
  onClose: () => void;
};

/**
 * Sanal POS E-Dekont — her zaman beyaz kağıt (tema etkilemez).
 * Esc / X; overlay tık kapatmaz.
 */
export function DekontModal({ tx, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const d = tx.dekont;
  const bankName = dekontBankName(tx);
  const total = tx.amount + tx.commission;
  const money = formatMoneyTr(total);
  const at = formatTxDate(tx.at);

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

  const legal1 = `Kredi kartımdan / banka kartımdan ${money} ₺ tutarın ${d.merchantTitle} adına çekilmesini ve ilgili tutarın üye işyerine aktarılmasını kabul ederim. İşbu belge, tarafıma ait kart ile yapılan işlemin geçerli bir ödeme talimatı olduğunu gösterir.`;

  const legal2 = `Banka veya kart kuruluşunun ödemeyi bloke etmesi, iade etmesi veya üye işyerine aktarmaması halinde ${money} ₺ tutarı ${d.merchantTitle}’ne bizzat ödemeyi taahhüt ederim. Bu dekont, mal/hizmet teslimine ilişkin yazılı delil niteliğindedir.`;

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="dekont-title"
        className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 sm:px-6">
          <h2 id="dekont-title" className="text-lg font-bold text-[var(--panel-ink)]">
            Dekont
          </h2>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <XIcon />
          </button>
        </header>

        <div className="max-h-[min(70vh,720px)] overflow-y-auto bg-[#e8eef4] px-4 py-4 sm:px-6">
          {/* Kağıt — daima beyaz */}
          <div
            id="dekont-print-root"
            className="rounded-sm border border-[#c5cdd6] bg-white p-4 text-[13px] text-black shadow-sm sm:p-5"
            style={{ colorScheme: 'light' }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <img src="/brand/logo.png" alt="Güzel Teknoloji" className="h-10 w-auto object-contain" />
              <img
                src={tx.bankLogo}
                alt={tx.bankName}
                className="h-9 w-auto max-w-[120px] object-contain"
              />
            </div>

            <div className="mb-3 border border-[#222] px-3 py-2 text-center text-sm font-bold tracking-wide text-black">
              SANAL POS E-DEKONT
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-black">
              <span>
                Dekont No: <strong>{tx.id}</strong>
              </span>
              <span className="tabular-nums">{at}</span>
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <div className="border border-[#444] p-2.5">
                <p className="font-bold leading-snug">{d.merchantTitle}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed">{d.merchantAddress}</p>
                <p className="mt-1.5 text-[12px] tabular-nums">{d.merchantPhone}</p>
              </div>
              <div className="border border-[#444] p-2.5">
                <p className="font-bold leading-snug">{d.cardHolderName}</p>
                <p className="mt-1.5 text-[12px]">-</p>
                <p className="mt-1.5 text-[12px] tabular-nums">{d.cardHolderPhoneMasked}</p>
              </div>
            </div>

            <div className="mb-0 border border-[#444]">
              <div className="grid sm:grid-cols-2">
                <div className="border-b border-[#444] sm:border-b-0 sm:border-r">
                  <Kv label="ONAY ZAMANI" value={at} />
                  <Kv label="REFERANS NO" value={d.referenceNo} />
                  <Kv label="ADI SOYADI" value={d.cardHolderName} />
                  <Kv label="T.C. KİMLİK NO" value={d.identityNo} />
                  <Kv label="TELEFONU" value={d.cardHolderPhone} />
                  <Kv label="AÇIKLAMA" value={d.description || '-'} last />
                </div>
                <div>
                  <Kv label="İŞLEM NO" value={d.transactionNo} />
                  <Kv label="ONAY KODU" value={d.authCode || ''} />
                  <Kv label="BANKA" value={bankName} />
                  <Kv label="KART" value={d.cardMasked} />
                  <Kv label="TAKSİT" value={String(tx.installments)} />
                  <Kv label="TUTAR" value={`${formatMoneyDisplay(tx.amount)}`} />
                  <Kv label="KOMİSYON" value={`${formatMoneyDisplay(tx.commission)}`} />
                  <Kv label="TOPLAM" value={`${money} ₺`} last strong />
                </div>
              </div>

              <div className="border-t border-[#444] px-3 py-3">
                <p className="text-[12px] font-bold uppercase tracking-wide">
                  Yalnız; {amountInWordsTr(total)}
                </p>
                <p className="mt-2 text-center text-[12px]">
                  Yukarıdaki bedel karşılığında mal veya hizmet aldım.
                </p>
                {d.threeDSecure ? (
                  <p className="mt-1 text-center text-[11px] italic text-[#444]">
                    Bu ödeme 3D Secure güvenli doğrulama ile yapılmıştır.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <LegalBox text={legal1} name={d.cardHolderName} />
              <LegalBox text={legal2} name={d.cardHolderName} />
            </div>
          </div>
        </div>

        <footer className="space-y-3 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2">
            <ActionBtn icon={<PdfIcon />} label="PDF" onClick={() => flash('PDF indirme — sonraki adımda')} />
            <ActionBtn icon={<PngIcon />} label="PNG" onClick={() => flash('PNG indirme — sonraki adımda')} />
            <ActionBtn icon={<PrintIcon />} label="Yazdır" onClick={() => window.print()} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Posta Adresi"
              className="min-w-0 flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--input-border-focus)]"
            />
            <button
              type="button"
              onClick={() => {
                const v = email.trim();
                if (!v || !v.includes('@')) {
                  flash('Geçerli bir e-posta girin');
                  return;
                }
                flash(`Dekont gönderildi (mock) → ${v}`);
                setEmail('');
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-[var(--color-brand-600)] transition hover:bg-[var(--color-brand-600)] hover:text-white"
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
}: {
  label: string;
  value: string;
  last?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={[
        'flex gap-1 px-2.5 py-1.5 text-[12px] text-black',
        last ? '' : 'border-b border-[#ddd]',
      ].join(' ')}
    >
      <span className="w-[7.25rem] shrink-0 font-semibold">{label}</span>
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

function LegalBox({ text, name }: { text: string; name: string }) {
  return (
    <div className="border border-[#444] p-2.5 text-black">
      <p className="text-[11px] leading-relaxed text-[#222]">{text}</p>
      <div className="mt-5 flex items-end justify-between gap-3">
        <span className="text-[12px] font-semibold">{name}</span>
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
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
    >
      {icon}
      {label}
    </button>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
