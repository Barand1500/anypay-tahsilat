import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { api } from '../../lib/api';
import { usePermission } from '../../permissions/PermissionContext';
import { CustomerExcelModal } from './CustomerExcelModal';
import {
  addAccountType,
  formatPhoneLive,
  type Customer,
} from './mockCustomers';

type ApiCustomer = {
  id: number;
  code: string;
  title: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  taxOfficeId: number | null;
  kind: Customer['kind'];
  accountType: string;
  accountTypeId: number | null;
  parentId: number | null;
  address: string;
  identityNo: string;
  childCount: number;
};

function mapCustomer(c: ApiCustomer): Customer {
  return {
    id: String(c.id),
    code: c.code,
    title: c.title,
    phone: c.phone,
    email: c.email,
    taxNo: c.taxNo,
    taxOffice: c.taxOffice,
    taxOfficeId: c.taxOfficeId,
    kind: c.kind,
    accountType: c.accountType,
    accountTypeId: c.accountTypeId,
    parentId: c.parentId != null ? String(c.parentId) : null,
    address: c.address,
    identityNo: c.identityNo,
    childCount: c.childCount,
  };
}
const PAGE_MIN = 5;
const PAGE_MAX = 50;
const COL_STORAGE = 'anypay_tahsilat_customer_cols';

type ActionKind = 'pay' | 'debt' | 'deal' | 'person' | 'address';
type ColId = 'actions' | 'identity' | 'contact' | 'tax';

const DEFAULT_COLS: ColId[] = ['actions', 'identity', 'contact', 'tax'];

const COL_META: Record<ColId, { label: string; min: string }> = {
  actions: { label: 'İşlem tipi', min: '210px' },
  identity: { label: 'Ünvan / ad soyad', min: '220px' },
  contact: { label: 'Telefon / e-posta', min: '200px' },
  tax: { label: 'Vergi bilgileri', min: '180px' },
};

const ROW_ACTIONS: { kind: ActionKind; label: string; bg: string; fg: string }[] = [
  { kind: 'pay', label: 'Ödeme al', bg: 'bg-emerald-100 dark:bg-emerald-500/20', fg: 'text-emerald-600 dark:text-emerald-400' },
  { kind: 'debt', label: 'Ödeme isteği', bg: 'bg-amber-100 dark:bg-amber-500/20', fg: 'text-amber-600 dark:text-amber-400' },
  { kind: 'deal', label: 'Müşteri bilgileri', bg: 'bg-sky-100 dark:bg-sky-500/20', fg: 'text-sky-600 dark:text-sky-400' },
  { kind: 'person', label: 'Kullanıcılar', bg: 'bg-violet-100 dark:bg-violet-500/20', fg: 'text-violet-600 dark:text-violet-400' },
  { kind: 'address', label: 'Adresler', bg: 'bg-indigo-100 dark:bg-indigo-500/20', fg: 'text-indigo-600 dark:text-indigo-400' },
];

function readCols(): ColId[] {
  try {
    const raw = localStorage.getItem(COL_STORAGE);
    if (!raw) return [...DEFAULT_COLS];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [...DEFAULT_COLS];
    const valid = parsed.filter((id): id is ColId => id in COL_META);
    for (const id of DEFAULT_COLS) {
      if (!valid.includes(id)) valid.push(id);
    }
    return valid.slice(0, DEFAULT_COLS.length);
  } catch {
    return [...DEFAULT_COLS];
  }
}

/**
 * Müşteriler — liste iskeleti; Excel modal + sütun sürükle + kopyala.
 */
export default function CustomersPage() {
  const { token } = useAuth();
  const { guard } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ustId = searchParams.get('ust');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [excelOpen, setExcelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cols, setCols] = useState<ColId[]>(() => readCols());
  const [dragCol, setDragCol] = useState<ColId | null>(null);
  const [overCol, setOverCol] = useState<ColId | null>(null);
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);
  const [kmRowId, setKmRowId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.get<ApiCustomer[]>('/api/customers', token);
      setCustomers(list.map(mapCustomer));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Müşteriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Formdan dönüşte liste + toast
  useEffect(() => {
    const st = location.state as { flash?: string } | null;
    if (st?.flash) {
      void reload();
      setToast(st.flash);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate, reload]);
  const parentCustomer = useMemo(
    () => (ustId ? customers.find((c) => c.id === ustId) ?? null : null),
    [ustId, customers],
  );

  const parentChain = useMemo(() => {
    if (!parentCustomer) return [] as Customer[];
    const chain: Customer[] = [];
    let cur: Customer | null = parentCustomer;
    const byId = new Map(customers.map((c) => [c.id, c]));
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) ?? null : null;
    }
    return chain;
  }, [parentCustomer, customers]);

  const levelCustomers = useMemo(() => {
    if (ustId) return customers.filter((c) => c.parentId === ustId);
    return customers.filter((c) => !c.parentId);
  }, [customers, ustId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return levelCustomers;
    return levelCustomers.filter(
      (c) =>
        c.code.includes(q.replace(/\s/g, '')) ||
        c.title.toLocaleLowerCase('tr').includes(q) ||
        c.email.toLocaleLowerCase('tr').includes(q) ||
        c.phone.includes(q.replace(/\D/g, '')) ||
        c.taxNo.includes(q.replace(/\s/g, '')) ||
        c.taxOffice.toLocaleLowerCase('tr').includes(q),
    );
  }, [levelCustomers, query]);

  useEffect(() => {
    setPage(1);
    setQuery('');
  }, [ustId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const gridTemplate = useMemo(() => {
    const parts = cols.map((id) => `minmax(${COL_META[id].min}, 1fr)`);
    parts.push('48px');
    return parts.join(' ');
  }, [cols]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Klavye modu: odaklı satırda göz görünsün
  useEffect(() => {
    function syncKmRow() {
      const warm = document.querySelector('.km-warm') as HTMLElement | null;
      if (!warm) {
        setKmRowId(null);
        return;
      }
      const row = warm.closest('[data-km-row]') as HTMLElement | null;
      setKmRowId(row?.dataset.customerId ?? null);
    }
    syncKmRow();
    const mo = new MutationObserver(syncKmRow);
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
    });
    return () => mo.disconnect();
  }, []);

  const flash = useCallback((msg: string) => setToast(msg), []);

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

  function persistCols(next: ColId[]) {
    setCols(next);
    localStorage.setItem(COL_STORAGE, JSON.stringify(next));
  }

  function onHeaderDragStart(id: ColId, e: DragEvent) {
    setDragCol(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onHeaderDragOver(id: ColId, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overCol !== id) setOverCol(id);
  }

  function onHeaderDrop(target: ColId, e: DragEvent) {
    e.preventDefault();
    const from = (e.dataTransfer.getData('text/plain') as ColId) || dragCol;
    setDragCol(null);
    setOverCol(null);
    if (!from || from === target) return;
    const next = [...cols];
    const fi = next.indexOf(from);
    const ti = next.indexOf(target);
    if (fi < 0 || ti < 0) return;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    persistCols(next);
  }

  const openDrill = useCallback(
    (id: string) => {
      setSearchParams({ ust: id });
      setPage(1);
    },
    [setSearchParams],
  );

  function openCreate() {
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    navigate(ustId ? `/musteriler/yeni?ust=${encodeURIComponent(ustId)}` : '/musteriler/yeni');
  }

  function openExcel() {
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    setExcelOpen(true);
  }

  function onRowAction(kind: ActionKind, c: Customer) {
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    if (kind === 'pay') {
      navigate(`/musteriler/${encodeURIComponent(c.id)}/odeme-al`);
      return;
    }
    if (kind === 'debt') {
      navigate(`/musteriler/${encodeURIComponent(c.id)}/odeme-istegi`);
      return;
    }
    if (kind === 'deal') {
      navigate(`/musteriler/${encodeURIComponent(c.id)}`);
      return;
    }
    if (kind === 'person') {
      navigate(`/musteriler/${encodeURIComponent(c.id)}?tab=kullanicilar`);
      return;
    }
    if (kind === 'address') {
      navigate(`/musteriler/${encodeURIComponent(c.id)}?tab=adresler`);
      return;
    }
  }

  function askDelete(c: Customer) {
    if (!guard('m-musteriler', 'remove', 'Müşteriler')) return;
    setDeleteTarget(c);
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) return;
    if (!guard('m-musteriler', 'remove', 'Müşteriler')) {
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/customers/${deleteTarget.id}`, token);
      setCustomers((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      flash('Müşteri silindi');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const header = ['Kod', 'Ünvan', 'Telefon', 'E-posta', 'Vergi No', 'Vergi Dairesi'];
    const rows = filtered.map((c) => [
      csvForceText(c.code),
      c.title,
      csvForceText(c.phone),
      c.email,
      csvForceText(c.taxNo),
      c.taxOffice,
    ]);
    downloadCsv([header, ...rows], 'musteriler.csv');
  }

  function copyList() {
    const text = filtered
      .map((c) => `${c.code}\t${c.title}\t${formatPhoneLive(c.phone)}\t${c.email}`)
      .join('\n');
    void navigator.clipboard.writeText(text);
    flash('Liste panoya kopyalandı');
  }

  function downloadSample() {
    downloadCsv(
      [
        [
          'Cari Tipi',
          'Müşteri Kodu',
          'TC',
          'Vergi No',
          'Pasaport No',
          'Vergi Dairesi',
          'Ünvan',
          'E-Posta',
          'Telefon',
          'Adres',
          'Kullanıcı Ad Soyad',
          'Kullanıcı E-Posta',
          'Kullanıcı Telefon',
        ],
        [
          'Müşteri',
          'F.01',
          csvForceText('17999999999'),
          '',
          '',
          '',
          'Ahmet YILDIZ',
          'suleymannilginn@gmail.com',
          csvForceText('5435555555'),
          'Test Mah Test Cad. No:1 Kat:1 Merkez/Antalya',
          'AHMET YILDIZ',
          'suleymannilginn@gmail.com',
          csvForceText('5435555555'),
        ],
        [
          'Müşteri',
          'F.02',
          '',
          csvForceText('8999999999'),
          '',
          'Antalya Kurumlar',
          'YILDIZ TEKNOLOJİ LTD. ŞTİ',
          'yildiz@teknoloji.com',
          csvForceText('5435555555'),
          'Test Mah Test Cad. No:1 Kat:1 Merkez/Antalya',
          'ALİ YILDIZ',
          'yildiz@teknoloji.com',
          csvForceText('5435555555'),
        ],
        [
          'Bayi',
          'F.03',
          csvForceText('17777777777'),
          '',
          '',
          '',
          'Sena KAYA',
          'sena@kaya.com',
          csvForceText('5436666666'),
          'Test Mah Test Cad. No:1 Kat:1 Merkez/Antalya',
          'Sena Kaya',
          'sena@kaya.com',
          csvForceText('5436666666'),
        ],
        [
          'Bayi',
          'F.04',
          '',
          csvForceText('8777777777'),
          '',
          'Antalya Kurumlar',
          'Metal Teknoloji A.Ş.',
          'halil@metal.com',
          csvForceText('5438888888'),
          'Test Mah Test Cad. No:1 Kat:1 Merkez/Antalya',
          'Halil Metal',
          'halil@metal.com',
          csvForceText('5438888888'),
        ],
        [
          'Müşteri',
          '20048519166',
          csvForceText('20048519166'),
          '',
          '',
          '',
          'SİNAN OLCA',
          'sinanolcs@gmail.com',
          csvForceText('5523562384'),
          'Örnek — sistemde mevcut kayıt',
          'SİNAN OLCA',
          'sinanolcs@gmail.com',
          csvForceText('5523562384'),
        ],
      ],
      'musteri-ornek.csv',
    );
  }

  async function confirmExcelImport(list: Customer[]) {
    if (!token) return;
    let ok = 0;
    for (const c of list) {
      try {
        await api.post(
          '/api/customers',
          {
            code: c.code,
            title: c.title,
            kind: c.kind,
            phone: c.phone,
            email: c.email,
            taxNo: c.taxNo,
            taxOfficeId: c.taxOfficeId ?? null,
            identityNo: c.identityNo,
            address: c.address,
            accountTypeName: c.accountType,
            parentId: c.parentId ? Number(c.parentId) : null,
          },
          token,
        );
        if (c.accountType.trim()) addAccountType(c.accountType);
        ok += 1;
      } catch {
        /* satır atlanır */
      }
    }
    setExcelOpen(false);
    await reload();
    flash(ok > 0 ? `${ok} müşteri sisteme eklendi` : 'Hiçbir satır eklenemedi');
  }

  function renderCol(id: ColId, c: Customer, showEye: boolean) {
    if (id === 'actions') {
      return (
        <div key={id} className="flex items-center gap-2 pr-2">
          {ROW_ACTIONS.map((a) => (
            <button
              key={a.kind}
              type="button"
              title={a.label}
              aria-label={a.label}
              onClick={(e) => {
                e.stopPropagation();
                onRowAction(a.kind, c);
              }}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition hover:scale-110 hover:shadow-md active:scale-95 dark:ring-white/10',
                a.bg,
                a.fg,
              ].join(' ')}
            >
              <ActionIcon kind={a.kind} />
            </button>
          ))}
          {showEye ? (
            <>
              <span className="mx-0.5 h-6 w-px bg-[var(--panel-line)]" aria-hidden />
              <DrillEyeButton onGo={() => openDrill(c.id)} />
            </>
          ) : null}
        </div>
      );
    }
    if (id === 'identity') {
      return (
        <div key={id} className="flex min-w-0 flex-col gap-0.5 pl-1">
          <CopyLine
            value={c.title}
            onCopied={flash}
            className="text-[15px] font-semibold uppercase tracking-wide text-[var(--panel-ink)]"
          />
        </div>
      );
    }
    if (id === 'contact') {
      return (
        <div key={id} className="flex min-w-0 flex-col gap-0.5">
          <CopyLine
            value={formatPhoneLive(c.phone)}
            raw={c.phone}
            onCopied={flash}
            className="font-mono text-[15px] font-medium tabular-nums text-[var(--panel-ink)]"
          />
          <CopyLine
            value={c.email}
            onCopied={flash}
            className="text-[14px] text-[var(--panel-ink)]/75"
          />
        </div>
      );
    }
    return (
      <div key={id} className="flex min-w-0 flex-col gap-0.5">
        <CopyLine
          value={c.taxNo}
          onCopied={flash}
          className="font-mono text-[15px] font-medium tabular-nums text-[var(--panel-ink)]"
        />
        {c.taxOffice ? (
          <CopyLine
            value={c.taxOffice}
            onCopied={flash}
            className="text-[14px] text-[var(--panel-ink)]/75"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-1 flex flex-wrap items-center gap-x-0 text-sm text-[var(--panel-ink)]/65">
            <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
              Anasayfa
            </Link>
            <span className="mx-1.5 opacity-50">›</span>
            {parentChain.length === 0 ? (
              <span className="font-semibold text-[var(--panel-ink)]">Müşteriler</span>
            ) : (
              <>
                <Link
                  to="/musteriler"
                  className="font-medium hover:text-[var(--color-brand-600)]"
                >
                  Müşteriler
                </Link>
                {parentChain.map((p, idx) => (
                  <span key={p.id} className="contents">
                    <span className="mx-1.5 opacity-50">›</span>
                    {idx === parentChain.length - 1 ? (
                      <span className="font-semibold text-[var(--panel-ink)]">{p.title}</span>
                    ) : (
                      <button
                        type="button"
                        className="font-medium hover:text-[var(--color-brand-600)]"
                        onClick={() => setSearchParams({ ust: p.id })}
                      >
                        {p.title}
                      </button>
                    )}
                  </span>
                ))}
              </>
            )}
          </nav>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[var(--panel-ink)]">
            {parentCustomer ? `${parentCustomer.title} Müşterileri` : 'Müşteriler'}
          </h1>
          <p className="mt-1 text-[15px] text-[var(--panel-ink)]/70">
            {loading
              ? 'Müşteriler yükleniyor…'
              : parentCustomer
                ? 'Alt cari hesaplar — satıra gelince çıkan göze tıklayın.'
                : 'Cari hesapları buradan yönetin. Satıra gelince çıkan göze tıklayarak alt müşterilere geçin.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-km-jump
            onClick={openExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
          >
            <ExcelPillIcon />
            Excel&apos;den Yükle
          </button>

          <ExportDropdown onCsv={exportCsv} onCopy={copyList} />

          <button
            type="button"
            data-km-jump
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="text-lg leading-none">+</span>
            Ekle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-3.5 shadow-[var(--panel-shadow)]">
        <label className="flex items-center gap-2 text-[15px] text-[var(--panel-muted)]">
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
            className="w-11 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-[15px] font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
          veri göster
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
            <SearchIcon />
          </span>
          <input
            data-km-jump
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
            className="w-52 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2.5 pl-10 pr-3 text-[15px] text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-72"
          />
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="min-w-[920px]">
          <div
            className="grid gap-x-6 border-b border-[var(--panel-line)] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/55"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {cols.map((id) => (
              <button
                key={id}
                type="button"
                draggable
                title="Sürükleyerek sırayı değiştir"
                onDragStart={(e) => onHeaderDragStart(id, e)}
                onDragOver={(e) => onHeaderDragOver(id, e)}
                onDragLeave={() => setOverCol((o) => (o === id ? null : o))}
                onDrop={(e) => onHeaderDrop(id, e)}
                onDragEnd={() => {
                  setDragCol(null);
                  setOverCol(null);
                }}
                className={[
                  'flex cursor-grab items-center gap-1.5 text-left active:cursor-grabbing',
                  id === 'actions' ? 'pr-2' : '',
                  id === 'identity' ? 'pl-1' : '',
                  dragCol === id ? 'opacity-40' : '',
                  overCol === id && dragCol && dragCol !== id
                    ? 'rounded-lg bg-[var(--color-brand-500)]/10 text-[var(--color-brand-600)]'
                    : '',
                ].join(' ')}
              >
                <GripIcon />
                {COL_META[id].label}
              </button>
            ))}
            <span className="flex justify-end">
              {totalPages > 1 ? (
                <button
                  type="button"
                  data-km-page
                  aria-label="Sonraki sayfa"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-30"
                >
                  <ChevronRightIcon />
                </button>
              ) : null}
            </span>
          </div>

          {slice.length === 0 ? (
            <p className="px-5 py-14 text-center text-[15px] text-[var(--panel-muted)]">Kayıt yok.</p>
          ) : (
            <ul>
              {slice.map((c, i) => (
                <li
                  key={c.id}
                  data-km-row
                  data-customer-id={c.id}
                  tabIndex={-1}
                  onMouseEnter={() => setHoverRowId(c.id)}
                  onMouseLeave={() => setHoverRowId((id) => (id === c.id ? null : id))}
                  style={{
                    animationDelay: `${Math.min(i, 12) * 18}ms`,
                    gridTemplateColumns: gridTemplate,
                  }}
                  className="modules-row-in group grid items-center gap-x-6 border-b border-[var(--panel-line)] px-5 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/50"
                >
                  {cols.map((id) => renderCol(id, c, hoverRowId === c.id || kmRowId === c.id))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={(e) => {
                        e.stopPropagation();
                        askDelete(c);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[15px] text-[var(--panel-muted)]">
        <p>
          {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
          {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
          {filtered.length}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
            İlk
          </PagerBtn>
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Geri
          </PagerBtn>
          <PagerBtn active onClick={() => undefined}>
            {safePage}
          </PagerBtn>
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

      {excelOpen ? (
        <CustomerExcelModal
          onClose={() => setExcelOpen(false)}
          onDownloadSample={downloadSample}
          existing={customers}
          parentId={ustId}
          onConfirm={confirmExcelImport}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteCustomerModal
          name={deleteTarget.title}
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
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function DrillEyeButton({ onGo }: { onGo: () => void }) {
  return (
    <button
      type="button"
      data-km-jump
      title="Alt müşteriler"
      aria-label="Alt müşteriler"
      onClick={(e) => {
        e.stopPropagation();
        onGo();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft-bg)] text-[var(--color-brand-600)] ring-1 ring-[var(--color-brand-500)]/30 transition hover:scale-110 hover:ring-2 hover:ring-[var(--color-brand-500)]/45 active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" fill="var(--color-brand-600)" />
        <circle cx="13" cy="11" r="0.85" fill="white" />
      </svg>
    </button>
  );
}

function CopyLine({
  value,
  raw,
  className,
  onCopied,
}: {
  value: string;
  raw?: string;
  className?: string;
  onCopied: (msg: string) => void;
}) {
  const [ok, setOk] = useState(false);

  async function copy() {
    const text = raw ?? value;
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      onCopied('Kopyalandı');
      window.setTimeout(() => setOk(false), 1200);
    } catch {
      onCopied('Kopyalanamadı');
    }
  }

  return (
    <button
      type="button"
      title="Kopyala"
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      className={[
        'group/copy relative block w-full max-w-full truncate rounded-md py-0.5 text-left transition hover:bg-[var(--panel-hover)]/80',
        className,
      ].join(' ')}
    >
      <span className="pr-6">{value}</span>
      <span
        className={[
          'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rounded p-0.5 transition',
          ok
            ? 'bg-emerald-500/15 text-emerald-600 opacity-100'
            : 'text-[var(--panel-muted)] opacity-0 group-hover/copy:opacity-100',
        ].join(' ')}
      >
        {ok ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}

/** Excel’de bilimsel gösterimi engelle */
function csvForceText(value: string) {
  return `="${value.replace(/"/g, '""')}"`;
}

function csvEscape(cell: string) {
  if (/[;"\n\r]/.test(cell) || cell.includes('=')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function downloadCsv(rows: string[][], name: string) {
  const body = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
  // UTF-8 BOM — Excel TR karakterleri doğru okusun
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function PagerBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-km-page
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-w-10 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40',
        active
          ? 'bg-[var(--color-brand-600)] text-white'
          : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function DeleteCustomerModal({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
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
        if (!busy) onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [busy, onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <button
          type="button"
          aria-label="Kapat"
          disabled={busy}
          onClick={onCancel}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-40"
        >
          <CloseX />
        </button>
        <div className="mb-3 flex justify-center text-rose-500">
          <TrashIcon large />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">Müşteriyi sil?</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kaldırılacak.
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

function ActionIcon({ kind }: { kind: ActionKind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    'aria-hidden': true,
  };
  if (kind === 'pay') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 15h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'debt') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 8v8M9.5 10.5c.5-1 1.5-1.5 2.5-1.5s2 .6 2 1.5-1 1.5-2.5 1.5S9.5 13 9.5 14s1 1.5 2.5 1.5 2-.5 2.5-1.5"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'deal') {
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 16.5c1.1-1.8 2.4-2.6 4-2.6s2.9.8 4 2.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'person') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5 19.5c1.6-3.2 4.2-4.7 7-4.7s5.4 1.5 7 4.7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ExcelPillIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="m9.5 12.5 5 5m0-5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="opacity-40" aria-hidden>
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="11.5" r="1.2" />
      <circle cx="7.5" cy="11.5" r="1.2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 17;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
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
