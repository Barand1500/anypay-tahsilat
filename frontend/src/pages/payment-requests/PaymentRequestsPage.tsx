import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DateField } from '../../components/ui/DateField';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { PasswordCourierOverlay } from '../../components/ui/PasswordCourierOverlay';
import { api } from '../../lib/api';
import { usePermission } from '../../permissions/PermissionContext';
import { mapCustomer, type ApiCustomer } from '../customers/customersApi';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import {
  formatDt,
  formatElapsed,
  formatMoneyTr,
  PAY_REQ_STATUS_FILTER,
  PAY_REQ_STATUS_LABEL,
  PAY_REQ_TYPE_LABEL,
  payLinkOf,
  payShareMessage,
  type PaymentRequest,
  type PayRequestType,
} from './paymentRequestTypes';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

type ApiPayRequest = {
  id: number;
  token: string;
  type: PayRequestType;
  status: 'pending' | 'paid';
  customerId: string | null;
  customerTitle: string;
  amount: number;
  commissionIncluded: boolean;
  createdAt: string;
  paidAt: string | null;
  branch: string;
  userId: string;
  userName: string;
  phone: string;
  email: string;
  whatsapp: string;
  description: string;
  files?: { name: string; path: string; url: string }[];
};

function mapRow(r: ApiPayRequest): PaymentRequest {
  return {
    id: String(r.id),
    token: r.token,
    type: r.type,
    status: r.status,
    customerId: r.customerId,
    customerTitle: r.customerTitle,
    amount: r.amount,
    commissionIncluded: r.commissionIncluded,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    branch: r.branch,
    userId: r.userId,
    userName: r.userName,
    phone: r.phone,
    email: r.email,
    whatsapp: r.whatsapp,
    description: r.description,
    files: r.files,
  };
}

const STATUS_OPTIONS = PAY_REQ_STATUS_FILTER;

/**
 * Ödeme İstekleri — filtre + liste; iletişim butonları aktif/pasif.
 */
export default function PaymentRequestsPage() {
  const { token } = useAuth();
  const { guard } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('odeme-istekleri'));
  const [deleteTarget, setDeleteTarget] = useState<PaymentRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [courier, setCourier] = useState<{
    email: string;
    flash: string;
    failed: boolean;
  } | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<{ value: string; label: string }[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.get<ApiPayRequest[]>('/api/payment-requests', token);
      const mapped = list.map(mapRow);
      setRows(mapped);
      const branches = [...new Set(mapped.map((r) => r.branch).filter((b) => b && b !== '—'))].sort(
        (a, b) => a.localeCompare(b, 'tr'),
      );
      const users = new Map<string, string>();
      for (const r of mapped) {
        if (r.userId) users.set(r.userId, r.userName || r.userId);
      }
      setBranchOptions(branches.map((b) => ({ value: b, label: b })));
      setUserOptions(
        [...users.entries()].map(([value, label]) => ({ value, label })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Ödeme istekleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.get<ApiCustomer[]>('/api/customers', token);
        if (cancelled) return;
        setCustomerOptions(
          list.map(mapCustomer).map((c) => ({ value: c.id, label: c.title })),
        );
      } catch {
        /* filtre opsiyonel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    let list = rows;
    if (branch) list = list.filter((r) => r.branch === branch);
    if (userId) list = list.filter((r) => r.userId === userId);
    if (customerId) list = list.filter((r) => r.customerId === customerId);
    if (status) list = list.filter((r) => r.status === status);
    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0, 0, 0, 0);
      list = list.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).setHours(23, 59, 59, 999);
      list = list.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    const q = query.trim().toLocaleLowerCase('tr');
    if (q) {
      list = list.filter(
        (r) =>
          r.customerTitle.toLocaleLowerCase('tr').includes(q) ||
          PAY_REQ_TYPE_LABEL[r.type].toLocaleLowerCase('tr').includes(q) ||
          PAY_REQ_STATUS_LABEL[r.status].toLocaleLowerCase('tr').includes(q) ||
          r.token.toLocaleLowerCase('tr').includes(q),
      );
    }
    return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [rows, branch, userId, customerId, status, dateFrom, dateTo, query]);

  const unfilteredTotal = rows.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    const st = location.state as { flash?: string; highlightId?: string } | null;
    if (!st?.flash && !st?.highlightId) return;
    void reload();
    if (st.flash) setToast(st.flash);
    if (st.highlightId) setHighlightId(st.highlightId);
    navigate('.', { replace: true, state: null });
  }, [location.state, navigate, reload]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = filtered.findIndex((r) => r.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1);
  }, [highlightId, filtered, pageSize, loading]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const el = rowRefs.current.get(highlightId);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const t = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(t);
  }, [highlightId, slice, loading]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, branch, userId, customerId, status, dateFrom, dateTo]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 10 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        stagger: 0.04,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!copiedId) return;
    const t = window.setTimeout(() => setCopiedId(null), 1800);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  function flash(msg: string) {
    setToast(msg);
  }

  function applyPageSize(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setPageSizeText(String(pageSize));
      return;
    }
    const clamped = Math.min(PAGE_MAX, Math.max(PAGE_MIN, n));
    setPageSize(clamped);
    setPageSizeText(String(clamped));
  }

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setDateFrom('');
    setDateTo('');
    setCustomerId(null);
    setStatus(null);
    setQuery('');
  }

  function exportCsv() {
    const header = [
      'Tip',
      'Durum',
      'Ünvan',
      'Tutar',
      'Komisyon',
      'Oluşturma',
      'Ödeme',
      'Link',
      'Telefon',
      'E-posta',
    ];
    const body = filtered.map((r) => [
      PAY_REQ_TYPE_LABEL[r.type],
      PAY_REQ_STATUS_LABEL[r.status],
      r.customerTitle,
      formatMoneyTr(r.amount),
      r.commissionIncluded ? 'Dahil' : 'Hariç',
      formatDt(r.createdAt),
      r.paidAt ? formatDt(r.paidAt) : '',
      payLinkOf(r.token),
      r.phone,
      r.email,
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'odeme-istekleri.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyList() {
    const text = filtered
      .map(
        (r) =>
          `${PAY_REQ_TYPE_LABEL[r.type]}\t${r.customerTitle}\t${formatMoneyTr(r.amount)}\t${payLinkOf(r.token)}`,
      )
      .join('\n');
    void navigator.clipboard.writeText(text);
    flash('Liste panoya kopyalandı');
  }

  async function copyLink(r: PaymentRequest) {
    const text = payShareMessage({
      amount: r.amount,
      token: r.token,
      files: r.files,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(r.id);
      flash(r.files?.length ? 'Link ve ekler kopyalandı' : 'Kopyalandı');
    } catch {
      flash('Kopyalanamadı');
    }
  }

  function sendWhatsApp(r: PaymentRequest) {
    if (!r.whatsapp) return;
    const text = encodeURIComponent(
      payShareMessage({
        amount: r.amount,
        token: r.token,
        files: r.files,
      }),
    );
    const phone = r.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/90${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  async function sendEmail(r: PaymentRequest) {
    if (!r.email || !token) return;
    try {
      const data = await api.post<{ to: string; emailSent: boolean }>(
        `/api/payment-requests/${encodeURIComponent(r.id)}/email`,
        {},
        token,
      );
      setCourier({
        email: data.to || r.email,
        flash: data.emailSent
          ? `Ödeme isteği gönderildi → ${data.to}`
          : `E-posta gönderilemedi → ${data.to}`,
        failed: !data.emailSent,
      });
    } catch (err) {
      setCourier({
        email: r.email,
        flash: err instanceof Error ? err.message : 'E-posta gönderilemedi',
        failed: true,
      });
    }
  }

  function sendSms(r: PaymentRequest) {
    if (!r.phone) return;
    const body = encodeURIComponent(
      payShareMessage({
        amount: r.amount,
        token: r.token,
        files: r.files,
        greeting: 'Ödeme linkiniz:',
      }),
    );
    window.open(`sms:+90${r.phone.replace(/\D/g, '')}?body=${body}`, '_self');
  }

  function onEdit(r: PaymentRequest) {
    if (!guard('m-odeme-istekleri', 'save', 'Ödeme İstekleri')) return;
    if (r.status === 'paid') {
      flash('Ödenmiş istek düzenlenemez');
      return;
    }
    navigate(`/odeme-istekleri/${encodeURIComponent(r.id)}/duzenle`);
  }

  function onAdd() {
    if (!guard('m-odeme-istekleri', 'save', 'Ödeme İstekleri')) return;
    navigate('/odeme-istekleri/yeni');
  }

  function askDelete(r: PaymentRequest) {
    if (!guard('m-odeme-istekleri', 'remove', 'Ödeme İstekleri')) return;
    setDeleteTarget(r);
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) return;
    if (!guard('m-odeme-istekleri', 'remove', 'Ödeme İstekleri')) {
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/payment-requests/${encodeURIComponent(deleteTarget.id)}`, token);
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      flash(`Silindi — ${deleteTarget.customerTitle}`);
      setDeleteTarget(null);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtersActive =
    !!branch ||
    !!userId ||
    !!customerId ||
    !!status ||
    !!dateFrom ||
    !!dateTo ||
    !!query.trim();

  return (
    <div ref={rootRef} className="w-full space-y-4 pb-8">
      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}
      <div data-anim>
        <nav className="mb-1 text-sm text-[var(--panel-ink)]/65">
          <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
            Anasayfa
          </Link>
          <span className="mx-1.5 opacity-50">›</span>
          <span className="font-semibold text-[var(--panel-ink)]">Ödeme İstekleri</span>
        </nav>
      </div>

      {/* Filtreler */}
      <section
        data-anim
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 text-[var(--panel-ink)] transition hover:text-[var(--color-brand-600)]"
            aria-expanded={filtersOpen}
          >
            <FilterIcon />
            <h2 className="text-base font-bold">Filtreler</h2>
            <span className={['ml-0.5 text-[var(--panel-muted)] transition', filtersOpen ? 'rotate-180' : ''].join(' ')}>
              <ChevronSm />
            </span>
          </button>
          <button
            type="button"
            data-km-jump
            onClick={resetFilters}
            disabled={!filtersActive}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ResetIcon />
            Sıfırla
          </button>
        </div>

        {filtersOpen ? (
          <div className="border-t border-[var(--panel-line)] px-4 pb-4 pt-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <FloatingSearchSelect
                label="Şube/Departman Seçin"
                options={branchOptions}
                value={branch}
                onChange={setBranch}
                placeholder="Şube seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Kullanıcı Seçin"
                options={userOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Kullanıcı seçiniz."
                kmJump
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DateField
                label="Başlangıç Tarihi"
                value={dateFrom}
                onChange={setDateFrom}
                kmJump
              />
              <DateField
                label="Bitiş Tarihi"
                value={dateTo}
                onChange={setDateTo}
                kmJump
              />
              <FloatingSearchSelect
                label="Müşteri"
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Müşteri seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Durum"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                placeholder="Durum seçiniz."
                kmJump
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Liste */}
      <section
        data-anim
        className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-bold text-[var(--panel-ink)]">Ödeme İstekleri</h2>
            <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
              <input
                type="text"
                inputMode="numeric"
                data-km-jump
                value={pageSizeText}
                onChange={(e) => setPageSizeText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onBlur={() => applyPageSize(pageSizeText)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className="w-11 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
              veri göster
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
                <SearchIcon />
              </span>
              <input
                data-km-jump
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara…"
                className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-52"
              />
            </div>
            <ExportDropdown onCsv={exportCsv} onCopy={copyList} />
            <button
              type="button"
              data-km-jump
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              <span className="text-lg leading-none">+</span>
              Ekle
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[minmax(200px,1.2fr)_minmax(160px,1.1fr)_minmax(110px,0.7fr)_minmax(180px,1.1fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Ödeme Tipi / İşlem</span>
              <span>Ünvan</span>
              <span>Tutar</span>
              <span>Tarihler</span>
              <span />
            </div>

            {slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                {loading ? 'Yükleniyor…' : 'Kayıt bulunamadı.'}
              </p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(r.id, el);
                    else rowRefs.current.delete(r.id);
                  }}
                  className={[
                    'grid grid-cols-[minmax(200px,1.2fr)_minmax(160px,1.1fr)_minmax(110px,0.7fr)_minmax(180px,1.1fr)_44px] gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 transition hover:bg-[var(--panel-hover)]/50',
                    highlightId === r.id ? 'pay-req-row-highlight' : '',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--color-brand-600)]">
                      {PAY_REQ_TYPE_LABEL[r.type]}
                    </p>
                    {r.status !== 'pending' ? (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                        {PAY_REQ_STATUS_LABEL[r.status]}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ActionRound
                        title="Ödeme Linkini Kopyala"
                        active
                        bg={
                          copiedId === r.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-sky-100 dark:bg-sky-500/20'
                        }
                        fg={copiedId === r.id ? 'text-white' : 'text-sky-700 dark:text-sky-400'}
                        onClick={() => void copyLink(r)}
                      >
                        {copiedId === r.id ? <CheckIcon /> : <CopyIcon />}
                      </ActionRound>
                      <ActionRound
                        title="Ödeme Bilgilerini Whatsapp ile Gönder"
                        active={!!r.whatsapp}
                        bg="bg-emerald-100 dark:bg-emerald-500/20"
                        fg="text-emerald-700 dark:text-emerald-400"
                        onClick={() => sendWhatsApp(r)}
                      >
                        <WhatsAppIcon />
                      </ActionRound>
                      <ActionRound
                        title="Ödeme Bilgilerini E-Posta Olarak Gönder"
                        active={!!r.email}
                        bg="bg-teal-100 dark:bg-teal-500/20"
                        fg="text-teal-700 dark:text-teal-400"
                        onClick={() => {
                          void sendEmail(r);
                        }}
                      >
                        <MailIcon />
                      </ActionRound>
                      <ActionRound
                        title="Ödeme Bilgilerini SMS Olarak Gönder"
                        active={!!r.phone}
                        bg="bg-amber-100 dark:bg-amber-500/20"
                        fg="text-amber-700 dark:text-amber-400"
                        onClick={() => sendSms(r)}
                      >
                        <PhoneIcon />
                      </ActionRound>
                      <ActionRound
                        title="Düzenle"
                        active
                        bg="bg-orange-100 dark:bg-orange-500/20"
                        fg="text-orange-700 dark:text-orange-400"
                        onClick={() => onEdit(r)}
                      >
                        <EditIcon />
                      </ActionRound>
                    </div>
                  </div>

                  <div className="min-w-0 self-center">
                    {r.customerId ? (
                      <Link
                        to={`/musteriler/${encodeURIComponent(r.customerId)}`}
                        className="text-sm font-medium leading-snug text-[var(--color-brand-600)] hover:underline"
                      >
                        {r.customerTitle}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium leading-snug text-[var(--panel-ink)]">
                        {r.customerTitle}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <p className="text-sm font-bold tabular-nums text-[var(--panel-ink)]">
                      {formatMoneyTr(r.amount)} ₺
                    </p>
                    <p className="text-[11px] text-[var(--panel-muted)]">
                      {r.commissionIncluded ? 'Komisyon Dahil' : 'Komisyon Hariç'}
                    </p>
                  </div>

                  <div className="min-w-0 self-center text-[12px] text-[var(--panel-muted)]">
                    <p>
                      Oluşturulma:{' '}
                      <span className="tabular-nums text-[var(--panel-ink)]">{formatDt(r.createdAt)}</span>
                    </p>
                    {r.paidAt ? (
                      <p>
                        Ödeme:{' '}
                        <span className="tabular-nums text-[var(--panel-ink)]">{formatDt(r.paidAt)}</span>
                      </p>
                    ) : null}
                    <p className="mt-0.5 tabular-nums text-[11px] font-medium text-[var(--panel-ink)]/70">
                      {formatElapsed(r.createdAt, r.paidAt, nowMs)}
                    </p>
                  </div>

                  <div className="flex items-start justify-end pt-0.5">
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={() => askDelete(r)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-[var(--panel-muted)]">
          <p>
            {fromIdx} ile {toIdx} arasında veri gösteriliyor. Toplam:{' '}
            <strong className="text-[var(--panel-ink)]">{filtered.length}</strong> (Filtrelenmemiş
            toplam: {unfilteredTotal})
          </p>
          <div className="flex items-center gap-1">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
              İlk
            </PagerBtn>
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Geri
            </PagerBtn>
            <span className="rounded-lg bg-[var(--color-brand-600)] px-2.5 py-1 text-xs font-bold text-white">
              {safePage}
            </span>
            <PagerBtn
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              İleri
            </PagerBtn>
            <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
              Son
            </PagerBtn>
          </div>
        </div>
      </section>

      {deleteTarget ? (
        <DeleteModal
          title={deleteTarget.customerTitle}
          busy={deleting}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[10050] -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2.5 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
          {toast}
        </div>
      ) : null}

      <PasswordCourierOverlay
        open={Boolean(courier)}
        toEmail={courier?.email}
        failed={courier?.failed}
        title="Senin için ödeme linkini götürüyoruz"
        titleFailed="Ödeme linkini götürmeye çalışıyoruz…"
        onDone={() => {
          if (courier?.flash) setToast(courier.flash);
          setCourier(null);
        }}
      />
    </div>
  );
}

function DeleteModal({
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Animasyon yalnızca mount’ta — parent re-render (süre sayacı) tekrar oynatmasın
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.95 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancelRef.current();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [busy]);

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">İsteği sil?</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{title}</span> ödeme isteği
          kaldırılacak.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ActionRound({
  title,
  active,
  bg,
  fg,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  bg: string;
  fg: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={active ? title : `${title} (bilgi yok)`}
      aria-label={title}
      disabled={!active}
      onClick={onClick}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition dark:ring-white/10',
        active
          ? `${bg} ${fg} hover:scale-110 hover:shadow-md active:scale-95`
          : 'cursor-not-allowed bg-[var(--panel-surface)] text-[var(--panel-muted)] opacity-35',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[var(--panel-line)] px-2.5 py-1 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-brand-600)]" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 0113.7-5.6M20 12a8 8 0 01-13.7 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 4v4h-4M6 20v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 14V6a2 2 0 012-2h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.5 0-9.96 4.45-9.96 9.93 0 1.75.46 3.46 1.34 4.97L2 22l5.25-1.37A9.94 9.94 0 0012.04 22c5.5 0 9.96-4.46 9.96-9.94S17.54 2 12.04 2zm0 18.13c-1.57 0-3.1-.42-4.43-1.21l-.32-.19-3.12.82.83-3.04-.21-.33a8.17 8.17 0 01-1.26-4.38c0-4.52 3.69-8.2 8.23-8.2 4.52 0 8.2 3.68 8.2 8.2-.01 4.52-3.69 8.2-8.22 8.2zm4.51-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.12-.56.12-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.24.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.66.31-.23.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.2 3.7.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.14-1.17-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 7l9 7 9-7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.05 3.5c.4-.4 1.05-.5 1.55-.25l2.1 1.05c.45.22.7.7.6 1.2l-.45 2.15a1.1 1.1 0 01-.7.85l-1.55.55a11.2 11.2 0 005.35 5.35l.55-1.55c.15-.4.5-.65.85-.7l2.15-.45c.5-.1.98.15 1.2.6l1.05 2.1c.25.5.15 1.15-.25 1.55l-1.2 1.2c-.45.45-1.1.65-1.75.5-3.2-.7-6.15-2.55-8.45-4.85S4.4 9.15 3.7 5.95c-.15-.65.05-1.3.5-1.75l1.2-1.2z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13 7l4 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
