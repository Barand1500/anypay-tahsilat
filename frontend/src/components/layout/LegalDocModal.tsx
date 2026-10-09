import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  getCompanyContractVars,
  resolveContractVars,
  type ContractDef,
  type ContractVarMap,
} from '../../pages/definitions/mockContracts';
import type { LegalDoc } from './legalDocs';

type Props = {
  doc: LegalDoc;
  onClose: () => void;
  publicView?: boolean;
};

type PublicLegalPayload = ContractDef & { companyVars?: ContractVarMap };

type ContactPayload = {
  title: string;
  taxNo: string;
  taxOffice: string;
  identityNo: string;
  address: string;
  email: string;
  phone: string;
  gsm: string;
  website?: string;
  fax: string;
};

/**
 * Footer / ödeme sözleşme modalı — Esc / X; overlay tıklanınca kapanmaz.
 * Panel ve public aynı: metin + firma değişkenleri → resolveContractVars.
 */
export function LegalDocModal({ doc, onClose, publicView = false }: Props) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setTitle(doc.title);
    setBody('');

    void (async () => {
      try {
        let name = doc.title;
        let raw = '';
        let vars: ContractVarMap = {};

        if (publicView) {
          const [result, companyVars] = await Promise.all([
            api.get<PublicLegalPayload>(`/api/pay/legal/${encodeURIComponent(doc.id)}`),
            api.get<ContractVarMap>('/api/pay/company-vars').catch(() => ({}) as ContractVarMap),
          ]);
          name = result.name || doc.title;
          raw = result.body?.trim() ?? '';
          vars = { ...(result.companyVars || {}), ...companyVars };
        } else if (!token) {
          if (!cancelled) {
            setTitle(doc.title);
            setBody('');
          }
          return;
        } else {
          const [contract, contact] = await Promise.all([
            api.get<ContractDef>(`/api/contracts/by-link/${encodeURIComponent(doc.id)}`, token),
            api.get<ContactPayload>('/api/settings/contact', token),
          ]);
          name = contract.name || doc.title;
          raw = contract.body?.trim() ?? '';
          vars = getCompanyContractVars(contact);
        }

        if (cancelled) return;
        setTitle(name);
        setBody(raw ? resolveContractVars(raw, vars) : '');
      } catch {
        if (!cancelled) {
          setTitle(doc.title);
          setBody('');
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.title, publicView, token]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 18, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
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

  return createPortal(
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="legal-doc-title"
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-[var(--panel-line)] px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand-500)_16%,transparent)_0%,transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] blur-2xl"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-[1] inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">×</span>
            Esc
          </button>

          <div className="relative z-[1] flex items-start gap-3.5 pr-14">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)]">
              <DocIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
                Sözleşmeler
              </p>
              <h2
                id="legal-doc-title"
                className="mt-1 min-w-0 break-words text-xl font-bold tracking-tight text-[var(--panel-ink)] [overflow-wrap:anywhere] sm:text-[1.35rem]"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-[var(--panel-muted)]">{doc.subtitle}</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <span
                className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--panel-line)] border-t-[var(--color-brand-600)]"
                aria-hidden
              />
              <p className="text-sm font-medium text-[var(--panel-muted)]">Yükleniyor…</p>
            </div>
          ) : body ? (
            <article className="relative">
              <div
                className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-full bg-[linear-gradient(180deg,var(--color-brand-500),transparent)]"
                aria-hidden
              />
              <div className="w-full whitespace-pre-wrap break-words pl-4 text-[13.5px] leading-[1.75] text-[var(--panel-ink)]/90 [overflow-wrap:anywhere] sm:pl-5 sm:text-sm">
                {body}
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-5 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]">
                <DocIcon />
              </div>
              <p className="text-sm font-bold text-[var(--panel-ink)]">
                {loadError ? 'Metin yüklenemedi' : 'Metin henüz eklenmedi'}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--panel-muted)]">
                {publicView
                  ? loadError
                    ? 'Sözleşme şu anda görüntülenemiyor. Lütfen daha sonra tekrar deneyin.'
                    : 'Bu sözleşme metni henüz yayınlanmamış.'
                  : 'Tanımlamalar › Sözleşmeler ekranından bu bağlantıya metin ekleyebilirsiniz.'}
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--panel-surface)_55%,var(--panel-elevated))] px-5 py-3.5 sm:px-7">
          <p className="hidden text-[11px] text-[var(--panel-muted)] sm:block">
            Esc ile kapatabilirsiniz
          </p>
          <button
            type="button"
            data-km-jump
            onClick={onClose}
            className="ml-auto rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
          >
            Kapat
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
