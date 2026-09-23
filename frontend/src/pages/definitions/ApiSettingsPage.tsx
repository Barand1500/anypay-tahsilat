import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { ApiCategoryModal } from './ApiCategoryModal';
import { ApiExcelModal } from './ApiExcelModal';
import { LocationModal, type LocationFocusField } from './LocationModal';
import {
  API_CATEGORIES,
  INITIAL_BANKS,
  INITIAL_BINS,
  INITIAL_LOCATIONS,
  INITIAL_TAX_OFFICES,
  categoryMeta,
  ensureLocationPath,
  getApiBaseUrl,
  locationAncestors,
  locationDuplicate,
  locationParentName,
  mockFetchCategory,
  setApiBaseUrl,
  type ApiCategoryId,
  type BankRow,
  type BinRow,
  type LocationLevel,
  type LocationRow,
  type TaxOfficeRow,
} from './mockApiSettings';

gsap.registerPlugin(useGSAP);

type Toast = { kind: 'ok' | 'err'; text: string } | null;

/**
 * Tanımlamalar › Api Ayarları — hub (kategori kutuları) + detay çarşaf liste.
 */
export default function ApiSettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [baseUrl, setBaseUrl] = useState(() => getApiBaseUrl());
  const [category, setCategory] = useState<ApiCategoryId | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [apiBusy, setApiBusy] = useState(false);

  const [locations, setLocations] = useState(() =>
    INITIAL_LOCATIONS.map((r) => ({ ...r })),
  );
  const [taxOffices, setTaxOffices] = useState(() => INITIAL_TAX_OFFICES.map((r) => ({ ...r })));
  const [banks, setBanks] = useState(() => INITIAL_BANKS.map((r) => ({ ...r })));
  const [bins, setBins] = useState(() => INITIAL_BINS.map((r) => ({ ...r })));

  const [endpointDraft, setEndpointDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filterCountryId, setFilterCountryId] = useState<string | null>(null);
  const [filterCityId, setFilterCityId] = useState<string | null>(null);
  const [filterDistrictId, setFilterDistrictId] = useState<string | null>(null);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [locFocus, setLocFocus] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const meta = category ? categoryMeta(category) : null;

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: rootRef, dependencies: [category] },
  );

  useEffect(() => {
    if (!category) return;
    setEndpointDraft(`${baseUrl.replace(/\/$/, '')}${categoryMeta(category).path}`);
    setQuery('');
    setPage(1);
    setFilterCountryId(null);
    setFilterCityId(null);
    setFilterDistrictId(null);
    setEditId(null);
    setLocFocus(null);
    setDeleteId(null);
  }, [category, baseUrl]);

  useEffect(() => setPage(1), [query, pageSize, filterCountryId, filterCityId, filterDistrictId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!deleteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteId]);

  function persistBaseUrl() {
    const next = baseUrl.trim() || getApiBaseUrl();
    setBaseUrl(next);
    setApiBaseUrl(next);
    setToast({ kind: 'ok', text: 'Genel API yolu kaydedildi' });
  }

  function openCategory(id: ApiCategoryId) {
    setCategory(id);
  }

  async function retryApi() {
    if (!category) return;
    setApiBusy(true);
    const res = await mockFetchCategory(category, endpointDraft);
    setApiBusy(false);
    if (res.ok) {
      // Mock: veriyi başlangıç setine “yenile”
      if (category === 'locations') setLocations(INITIAL_LOCATIONS.map((r) => ({ ...r })));
      if (category === 'tax-offices') setTaxOffices(INITIAL_TAX_OFFICES.map((r) => ({ ...r })));
      if (category === 'banks') setBanks(INITIAL_BANKS.map((r) => ({ ...r })));
      if (category === 'bin') setBins(INITIAL_BINS.map((r) => ({ ...r })));
      setToast({ kind: 'ok', text: `API başarılı — ${res.count} kayıt alındı` });
    } else {
      setToast({ kind: 'err', text: res.message });
    }
  }

  // ——— filtre / sayfalama ———
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (category === 'locations') {
      let list: LocationRow[];
      if (!filterCountryId) {
        list = locations.filter((r) => r.level === 'Ülke');
      } else if (!filterCityId) {
        list = locations.filter((r) => r.level === 'İl' && r.parentId === filterCountryId);
      } else if (!filterDistrictId) {
        list = locations.filter((r) => r.level === 'İlçe' && r.parentId === filterCityId);
      } else {
        list = locations.filter((r) => r.level === 'Mahalle' && r.parentId === filterDistrictId);
      }
      if (!q) return list;
      return list.filter((r) => {
        const a = locationAncestors(locations, r);
        return `${r.name} ${a.countryName} ${a.cityName} ${a.districtName}`
          .toLocaleLowerCase('tr')
          .includes(q);
      });
    }
    if (category === 'tax-offices') {
      const list = taxOffices;
      if (!q) return list;
      return list.filter((r) =>
        `${r.city} ${r.district} ${r.name}`.toLocaleLowerCase('tr').includes(q),
      );
    }
    if (category === 'banks') {
      const list = banks;
      if (!q) return list;
      return list.filter((r) =>
        `${r.name} ${r.shortName}`.toLocaleLowerCase('tr').includes(q),
      );
    }
    if (category === 'bin') {
      const list = bins;
      if (!q) return list;
      return list.filter((r) =>
        `${r.bank} ${r.bin} ${r.type} ${r.brand} ${r.kind}`.toLocaleLowerCase('tr').includes(q),
      );
    }
    return [];
  }, [
    category,
    locations,
    taxOffices,
    banks,
    bins,
    query,
    filterCountryId,
    filterCityId,
    filterDistrictId,
  ]);

  const countryOptions = useMemo(
    () =>
      locations
        .filter((r) => r.level === 'Ülke')
        .map((r) => ({ value: r.id, label: r.name })),
    [locations],
  );
  const cityOptions = useMemo(() => {
    if (!filterCountryId) return [];
    return locations
      .filter((r) => r.level === 'İl' && r.parentId === filterCountryId)
      .map((r) => ({ value: r.id, label: r.name }));
  }, [locations, filterCountryId]);
  const districtOptions = useMemo(() => {
    if (!filterCityId) return [];
    return locations
      .filter((r) => r.level === 'İlçe' && r.parentId === filterCityId)
      .map((r) => ({ value: r.id, label: r.name }));
  }, [locations, filterCityId]);

  const locationViewLevel: LocationLevel = !filterCountryId
    ? 'Ülke'
    : !filterCityId
      ? 'İl'
      : !filterDistrictId
        ? 'İlçe'
        : 'Mahalle';

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-api-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.22, stagger: 0.025, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|'), category]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function exportCsv() {
    if (!category) return;
    let header: string[] = [];
    let lines: string[] = [];
    if (category === 'locations') {
      header = ['Adı', 'Seviye', 'Ülke', 'Şehir', 'İlçe'];
      lines = (filtered as LocationRow[]).map((r) => {
        const a = locationAncestors(locations, r);
        return csvLine([r.name, r.level, a.countryName, a.cityName, a.districtName]);
      });
    } else if (category === 'tax-offices') {
      header = ['İl', 'İlçe', 'Adı'];
      lines = (filtered as TaxOfficeRow[]).map((r) => csvLine([r.city, r.district, r.name]));
    } else if (category === 'banks') {
      header = ['Adı', 'Kısa Adı'];
      lines = (filtered as BankRow[]).map((r) => csvLine([r.name, r.shortName]));
    } else {
      header = ['Banka', 'BIN', 'Tip', 'Marka', 'Tür'];
      lines = (filtered as BinRow[]).map((r) =>
        csvLine([r.bank, r.bin, r.type, r.brand, r.kind]),
      );
    }
    downloadCsv(`${category}.csv`, [header.join(';'), ...lines].join('\n'));
  }

  function copyList() {
    void navigator.clipboard.writeText(
      filtered
        .map((r) => Object.values(r).filter((v) => v !== (r as { id: string }).id).join('\t'))
        .join('\n'),
    );
  }

  function excelMeta() {
    if (category === 'locations') {
      return {
        columns: ['Ülke', 'Şehir', 'İlçe', 'Mahalle'],
        sample:
          'Ülke;Şehir;İlçe;Mahalle\nTürkiye;Mersin;Toroslar;\nTürkiye;Antalya;Kepez;Gazi\n',
      };
    }
    if (category === 'tax-offices') {
      return {
        columns: ['İl', 'İlçe', 'Adı'],
        sample: 'İl;İlçe;Adı\nBursa;Nilüfer;Nilüfer V.D.\n',
      };
    }
    if (category === 'banks') {
      return {
        columns: ['Adı', 'Kısa Adı'],
        sample: 'Adı;Kısa Adı\nDenizbank A.Ş.;DENİZBANK\n',
      };
    }
    return {
      columns: ['Banka', 'BIN', 'Tip', 'Marka', 'Tür'],
      sample: 'Banka;BIN;Tip;Marka;Tür\nDenizbank;521347;Credit;MasterCard;Bireysel\n',
    };
  }

  function classifyExcelRow(cells: string[]): { status: 'new' | 'exists' | 'invalid'; note: string } {
    if (category === 'locations') {
      const [country, city, district, mahalle] = cells;
      if (!country?.trim()) return { status: 'invalid', note: 'Ülke boş' };
      const leaf = mahalle?.trim()
        ? { name: mahalle, level: 'Mahalle' as const }
        : district?.trim()
          ? { name: district, level: 'İlçe' as const }
          : city?.trim()
            ? { name: city, level: 'İl' as const }
            : { name: country, level: 'Ülke' as const };
      // parent resolve roughly for duplicate check
      let parentId: string | null = null;
      if (leaf.level === 'İl') {
        parentId =
          locations.find(
            (r) =>
              r.level === 'Ülke' &&
              r.name.toLocaleLowerCase('tr') === country.trim().toLocaleLowerCase('tr'),
          )?.id ?? null;
      }
      if (leaf.level === 'İlçe' && city) {
        parentId =
          locations.find(
            (r) =>
              r.level === 'İl' &&
              r.name.toLocaleLowerCase('tr') === city.trim().toLocaleLowerCase('tr'),
          )?.id ?? null;
      }
      if (leaf.level === 'Mahalle' && district) {
        parentId =
          locations.find(
            (r) =>
              r.level === 'İlçe' &&
              r.name.toLocaleLowerCase('tr') === district.trim().toLocaleLowerCase('tr'),
          )?.id ?? null;
      }
      if (locationDuplicate(locations, leaf.name, leaf.level, parentId)) {
        return { status: 'exists', note: 'Zaten kayıtlı' };
      }
      return { status: 'new', note: 'Eklenecek' };
    }
    if (category === 'tax-offices') {
      if (!cells[0]?.trim() || !cells[2]?.trim()) return { status: 'invalid', note: 'İl / Ad zorunlu' };
      const exists = taxOffices.some(
        (r) =>
          r.name.toLocaleLowerCase('tr') === cells[2].trim().toLocaleLowerCase('tr') &&
          r.city.toLocaleLowerCase('tr') === cells[0].trim().toLocaleLowerCase('tr'),
      );
      return exists
        ? { status: 'exists', note: 'Zaten kayıtlı' }
        : { status: 'new', note: 'Eklenecek' };
    }
    if (category === 'banks') {
      if (!cells[0]?.trim()) return { status: 'invalid', note: 'Ad boş' };
      const exists = banks.some(
        (r) => r.name.toLocaleLowerCase('tr') === cells[0].trim().toLocaleLowerCase('tr'),
      );
      return exists
        ? { status: 'exists', note: 'Zaten kayıtlı' }
        : { status: 'new', note: 'Eklenecek' };
    }
    if (!cells[1]?.trim()) return { status: 'invalid', note: 'BIN boş' };
    const exists = bins.some((r) => r.bin === cells[1].replace(/\D/g, ''));
    return exists ? { status: 'exists', note: 'Zaten kayıtlı' } : { status: 'new', note: 'Eklenecek' };
  }

  function confirmExcelRows(data: string[][]) {
    if (!category) return;
    let added = 0;
    if (category === 'locations') {
      let working = [...locations];
      for (const row of data) {
        const [country, city, district, mahalle] = row;
        const res = ensureLocationPath(working, {
          country: country || undefined,
          city: city || undefined,
          district: district || undefined,
          neighborhood: mahalle || undefined,
        });
        working = res.list;
        added += 1;
      }
      setLocations(working);
    } else if (category === 'tax-offices') {
      const next = data.map((row, i) => ({
        id: `to-imp-${Date.now()}-${i}`,
        city: row[0] || '—',
        district: row[1] || '—',
        name: row[2] || `İçe aktarım ${i + 1}`,
      }));
      setTaxOffices((list) => [...list, ...next]);
      added = next.length;
    } else if (category === 'banks') {
      const next = data.map((row, i) => ({
        id: `bk-imp-${Date.now()}-${i}`,
        name: row[0] || `Banka ${i + 1}`,
        shortName: row[1] || row[0] || '—',
      }));
      setBanks((list) => [...list, ...next]);
      added = next.length;
    } else {
      const next = data.map((row, i) => ({
        id: `bin-imp-${Date.now()}-${i}`,
        bank: row[0] || '—',
        bin: (row[1] || '000000').replace(/\D/g, '').slice(0, 8),
        type: row[2] || 'Credit',
        brand: row[3] || 'Visa',
        kind: row[4] || 'Bireysel',
      }));
      setBins((list) => [...list, ...next]);
      added = next.length;
    }
    setExcelOpen(false);
    setToast({
      kind: added ? 'ok' : 'err',
      text: added ? `Excel: ${added} satır işlendi` : 'Satır bulunamadı',
    });
  }

  function confirmDelete() {
    if (!category || !deleteId) return;
    if (category === 'locations') setLocations((l) => l.filter((r) => r.id !== deleteId));
    if (category === 'tax-offices') setTaxOffices((l) => l.filter((r) => r.id !== deleteId));
    if (category === 'banks') setBanks((l) => l.filter((r) => r.id !== deleteId));
    if (category === 'bin') setBins((l) => l.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  }

  const editRow = editId
    ? category === 'locations'
      ? locations.find((r) => r.id === editId)
      : category === 'tax-offices'
        ? taxOffices.find((r) => r.id === editId)
        : category === 'banks'
          ? banks.find((r) => r.id === editId)
          : bins.find((r) => r.id === editId)
    : null;

  // ——— HUB ———
  if (!category) {
    return (
      <div ref={rootRef} className="w-full">
        <div data-anim className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Api Ayarları</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            API’den gelen tanımları buradan yönetin. Kategoriye girip ekleyebilir, düzenleyebilir veya
            Excel’den içe aktarabilirsiniz.
          </p>
        </div>

        <div
          data-anim
          className="mb-6 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <TextInput
                data-km-jump
                label="Genel API"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.ornek.com/v1"
              />
            </div>
            <button
              type="button"
              data-km-jump
              onClick={persistBaseUrl}
              className="inline-flex h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Kaydet
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {API_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              data-anim
              data-km-jump
              onClick={() => openCategory(c.id)}
              className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-6 text-center shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-brand-500)_45%,var(--panel-line))] hover:shadow-md"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-bg))] text-[var(--color-brand-600)] transition group-hover:scale-105">
                <CategoryIcon id={c.id} />
              </span>
              <span>
                <span className="block text-base font-bold text-[var(--panel-ink)]">{c.label}</span>
                <span className="mt-1 block text-xs text-[var(--panel-muted)]">{c.description}</span>
              </span>
            </button>
          ))}
        </div>

        {toast ? <ToastBanner toast={toast} onClose={() => setToast(null)} /> : null}
      </div>
    );
  }

  // ——— DETAIL ———
  const excel = excelMeta();

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-km-jump
          onClick={() => setCategory(null)}
          title="Geri"
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] shadow-sm transition hover:bg-[var(--panel-hover)]"
        >
          <BackIcon />
        </button>
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-tight text-[var(--panel-ink)]">
            {meta?.label}
          </h1>
        </div>
      </div>

      <div
        data-anim
        className="mb-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-5 [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <TextInput
              data-km-jump
              label="API Yolu"
              value={endpointDraft}
              onChange={(e) => setEndpointDraft(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:pb-0.5">
            <button
              type="button"
              data-km-jump
              disabled={apiBusy}
              onClick={() => void retryApi()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-500/15 disabled:opacity-50"
            >
              <RefreshIcon />
              {apiBusy ? 'Çekiliyor…' : 'API Tekrar Dene'}
            </button>
            <button
              type="button"
              data-km-jump
              onClick={() => setExcelOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              <ExcelPillIcon />
              Excel&apos;den Yükle
            </button>
            <ExportDropdown onCsv={exportCsv} onCopy={copyList} />
            <button
              type="button"
              data-km-jump
              onClick={() => {
                setEditId(null);
                setLocFocus(category === 'locations' ? 'level' : null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              <span className="text-lg leading-none">+</span>
              Ekle
            </button>
          </div>
        </div>
      </div>

      <section
        data-anim
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
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
          <div className="flex flex-wrap items-center gap-2">
            {category === 'locations' ? (
              <>
                <div className="w-40 [--input-notch:var(--panel-elevated)]">
                  <FloatingSearchSelect
                    label="Ülke"
                    options={countryOptions}
                    value={filterCountryId}
                    onChange={(v) => {
                      setFilterCountryId(v);
                      setFilterCityId(null);
                      setFilterDistrictId(null);
                    }}
                    placeholder="Ülke seçin"
                    kmJump
                  />
                </div>
                {filterCountryId ? (
                  <div className="w-40 [--input-notch:var(--panel-elevated)]">
                    <FloatingSearchSelect
                      label="Şehir"
                      options={cityOptions}
                      value={filterCityId}
                      onChange={(v) => {
                        setFilterCityId(v);
                        setFilterDistrictId(null);
                      }}
                      placeholder="Şehir seçin"
                      kmJump
                    />
                  </div>
                ) : null}
                {filterCityId ? (
                  <div className="w-40 [--input-notch:var(--panel-elevated)]">
                    <FloatingSearchSelect
                      label="İlçe"
                      options={districtOptions}
                      value={filterDistrictId}
                      onChange={setFilterDistrictId}
                      placeholder="İlçe seçin"
                      kmJump
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
                <SearchIcon />
              </span>
              <input
                data-km-jump
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara…"
                className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand-500)] sm:w-56"
              />
            </div>
          </div>
        </div>

        <div ref={tableRef} className="overflow-x-auto">
          <CategoryTable
            category={category}
            locationViewLevel={locationViewLevel}
            allLocations={locations}
            rows={slice}
            onEdit={(id, focus) => {
              setEditId(id);
              setLocFocus(focus ?? 'name');
              setModalOpen(true);
            }}
            onDelete={setDeleteId}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
          <p>
            {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
            {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
            {filtered.length}
          </p>
          <div className="flex flex-wrap gap-1">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
              İlk
            </PagerBtn>
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Geri
            </PagerBtn>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-2 text-xs font-bold text-white">
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

      {toast ? <ToastBanner toast={toast} onClose={() => setToast(null)} /> : null}

      {excelOpen && category ? (
        <ApiExcelModal
          category={category}
          title={meta?.label ?? ''}
          columns={excel.columns}
          sampleCsv={excel.sample}
          classify={classifyExcelRow}
          onClose={() => setExcelOpen(false)}
          onConfirm={confirmExcelRows}
        />
      ) : null}

      {modalOpen && category === 'locations' ? (
        <LocationModal
          locations={locations}
          focusField={(locFocus as LocationFocusField | null) ?? null}
          preset={{
            countryId: filterCountryId,
            cityId: filterCityId,
            districtId: filterDistrictId,
          }}
          mode={editRow ? { type: 'edit', row: editRow as LocationRow } : { type: 'create' }}
          onClose={() => {
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
          onSave={(nextList) => {
            setLocations(nextList);
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
        />
      ) : null}

      {modalOpen && category === 'tax-offices' ? (
        <ApiCategoryModal
          category="tax-offices"
          locations={locations}
          focusField={locFocus}
          mode={editRow ? { type: 'edit', row: editRow as TaxOfficeRow } : { type: 'create' }}
          onClose={() => {
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
          onSave={(row) => {
            if (row.id) {
              setTaxOffices((list) =>
                list.map((r) =>
                  r.id === row.id
                    ? { ...r, city: row.city, district: row.district, name: row.name }
                    : r,
                ),
              );
            } else {
              setTaxOffices((list) => [
                ...list,
                {
                  id: `to-${Date.now()}`,
                  city: row.city,
                  district: row.district,
                  name: row.name,
                },
              ]);
            }
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
        />
      ) : null}

      {modalOpen && category === 'banks' ? (
        <ApiCategoryModal
          category="banks"
          focusField={locFocus}
          mode={editRow ? { type: 'edit', row: editRow as BankRow } : { type: 'create' }}
          onClose={() => {
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
          onSave={(row) => {
            if (row.id) {
              setBanks((list) =>
                list.map((r) =>
                  r.id === row.id ? { ...r, name: row.name, shortName: row.shortName } : r,
                ),
              );
            } else {
              setBanks((list) => [
                ...list,
                { id: `bk-${Date.now()}`, name: row.name, shortName: row.shortName },
              ]);
            }
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
        />
      ) : null}

      {modalOpen && category === 'bin' ? (
        <ApiCategoryModal
          category="bin"
          focusField={locFocus}
          existingBins={bins.map((b) => b.bin)}
          mode={editRow ? { type: 'edit', row: editRow as BinRow } : { type: 'create' }}
          onClose={() => {
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
          onSave={(rows) => {
            const edited = rows.find((r) => r.id);
            if (edited?.id) {
              setBins((list) =>
                list.map((r) =>
                  r.id === edited.id
                    ? {
                        ...r,
                        bank: edited.bank,
                        bin: edited.bin,
                        type: edited.type,
                        brand: edited.brand,
                        kind: edited.kind,
                      }
                    : r,
                ),
              );
            } else {
              const stamp = Date.now();
              setBins((list) => [
                ...list,
                ...rows.map((row, i) => ({
                  id: `bin-${stamp}-${i}`,
                  bank: row.bank,
                  bin: row.bin,
                  type: row.type,
                  brand: row.brand,
                  kind: row.kind,
                })),
              ]);
              setToast({
                kind: 'ok',
                text:
                  rows.length > 1
                    ? `${rows.length} BIN eklendi`
                    : 'BIN eklendi',
              });
            }
            setModalOpen(false);
            setEditId(null);
            setLocFocus(null);
          }}
        />
      ) : null}

      {deleteId
        ? createPortal(
            <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
              <div
                role="dialog"
                aria-modal
                className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
              >
                <h3 className="text-lg font-bold text-[var(--panel-ink)]">Kaydı sil</h3>
                <p className="mt-2 text-sm text-[var(--panel-muted)]">Bu kayıt silinsin mi?</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteId(null)}
                    className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CategoryTable({
  category,
  locationViewLevel,
  allLocations,
  rows,
  onEdit,
  onDelete,
}: {
  category: ApiCategoryId;
  locationViewLevel: LocationLevel;
  allLocations: LocationRow[];
  rows: { id: string }[];
  onEdit: (id: string, focus?: string | null) => void;
  onDelete: (id: string) => void;
}) {
  function focusFromEvent(e: ReactMouseEvent, fallback = 'name') {
    const col = (e.target as HTMLElement)
      .closest('[data-api-col]')
      ?.getAttribute('data-api-col');
    return col || fallback;
  }

  if (category === 'locations') {
    const list = rows as LocationRow[];
    if (locationViewLevel === 'Ülke') {
      return (
        <Sheet
          cols="grid-cols-[minmax(200px,1fr)_44px]"
          headers={['Ülke']}
          empty={!list.length}
          rows={list.map((r) => ({
            id: r.id,
            onEdit: (e) => onEdit(r.id, focusFromEvent(e, 'name')),
            onDelete: () => onDelete(r.id),
            cells: [
              <span
                key="n"
                data-api-col="name"
                className="truncate text-sm font-medium text-[var(--panel-ink)]"
              >
                {r.name}
              </span>,
            ],
          }))}
        />
      );
    }
    if (locationViewLevel === 'İl') {
      return (
        <Sheet
          cols="grid-cols-[minmax(160px,1fr)_minmax(140px,0.8fr)_44px]"
          headers={['Şehir', 'Ülke']}
          empty={!list.length}
          rows={list.map((r) => ({
            id: r.id,
            onEdit: (e) => onEdit(r.id, focusFromEvent(e, 'name')),
            onDelete: () => onDelete(r.id),
            cells: [
              <span
                key="n"
                data-api-col="name"
                className="truncate text-sm font-medium text-[var(--panel-ink)]"
              >
                {r.name}
              </span>,
              <span
                key="p"
                data-api-col="country"
                className="truncate text-sm text-[var(--panel-muted)]"
              >
                {locationParentName(allLocations, r.parentId)}
              </span>,
            ],
          }))}
        />
      );
    }
    if (locationViewLevel === 'İlçe') {
      return (
        <Sheet
          cols="grid-cols-[minmax(140px,1fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_44px]"
          headers={['İlçe', 'Şehir', 'Ülke']}
          empty={!list.length}
          rows={list.map((r) => {
            const a = locationAncestors(allLocations, r);
            return {
              id: r.id,
              onEdit: (e: ReactMouseEvent) => onEdit(r.id, focusFromEvent(e, 'name')),
              onDelete: () => onDelete(r.id),
              cells: [
                <span
                  key="n"
                  data-api-col="name"
                  className="truncate text-sm font-medium text-[var(--panel-ink)]"
                >
                  {r.name}
                </span>,
                <span
                  key="p"
                  data-api-col="city"
                  className="truncate text-sm text-[var(--panel-muted)]"
                >
                  {a.cityName}
                </span>,
                <span
                  key="c"
                  data-api-col="country"
                  className="truncate text-sm text-[var(--panel-muted)]"
                >
                  {a.countryName}
                </span>,
              ],
            };
          })}
        />
      );
    }
    return (
      <Sheet
        cols="grid-cols-[minmax(140px,1fr)_minmax(110px,0.65fr)_minmax(110px,0.65fr)_minmax(110px,0.65fr)_44px]"
        headers={['Mahalle', 'İlçe', 'Şehir', 'Ülke']}
        empty={!list.length}
        rows={list.map((r) => {
          const a = locationAncestors(allLocations, r);
          return {
            id: r.id,
            onEdit: (e: ReactMouseEvent) => onEdit(r.id, focusFromEvent(e, 'name')),
            onDelete: () => onDelete(r.id),
            cells: [
              <span
                key="n"
                data-api-col="name"
                className="truncate text-sm font-medium text-[var(--panel-ink)]"
              >
                {r.name}
              </span>,
              <span
                key="d"
                data-api-col="district"
                className="truncate text-sm text-[var(--panel-muted)]"
              >
                {a.districtName}
              </span>,
              <span
                key="p"
                data-api-col="city"
                className="truncate text-sm text-[var(--panel-muted)]"
              >
                {a.cityName}
              </span>,
              <span
                key="c"
                data-api-col="country"
                className="truncate text-sm text-[var(--panel-muted)]"
              >
                {a.countryName}
              </span>,
            ],
          };
        })}
      />
    );
  }
  if (category === 'tax-offices') {
    const list = rows as TaxOfficeRow[];
    return (
      <Sheet
        cols="grid-cols-[minmax(100px,0.7fr)_minmax(100px,0.7fr)_minmax(160px,1.2fr)_44px]"
        headers={['İl', 'İlçe', 'Adı']}
        empty={!list.length}
        rows={list.map((r) => ({
          id: r.id,
          onEdit: (e) => onEdit(r.id, focusFromEvent(e, 'name')),
          onDelete: () => onDelete(r.id),
          cells: [
            <span
              key="c"
              data-api-col="city"
              className="truncate text-sm text-[var(--panel-ink)]"
            >
              {r.city}
            </span>,
            <span
              key="d"
              data-api-col="district"
              className="truncate text-sm text-[var(--panel-muted)]"
            >
              {r.district}
            </span>,
            <span
              key="n"
              data-api-col="name"
              className="truncate text-sm font-medium text-[var(--panel-ink)]"
            >
              {r.name}
            </span>,
          ],
        }))}
      />
    );
  }
  if (category === 'banks') {
    const list = rows as BankRow[];
    return (
      <Sheet
        cols="grid-cols-[minmax(200px,1.4fr)_minmax(120px,0.8fr)_44px]"
        headers={['Adı', 'Kısa Adı']}
        empty={!list.length}
        rows={list.map((r) => ({
          id: r.id,
          onEdit: (e) => onEdit(r.id, focusFromEvent(e, 'name')),
          onDelete: () => onDelete(r.id),
          cells: [
            <span
              key="n"
              data-api-col="name"
              className="truncate text-sm font-medium text-[var(--panel-ink)]"
            >
              {r.name}
            </span>,
            <span
              key="s"
              data-api-col="shortName"
              className="truncate text-sm text-[var(--panel-muted)]"
            >
              {r.shortName}
            </span>,
          ],
        }))}
      />
    );
  }
  const list = rows as BinRow[];
  return (
    <Sheet
      cols="grid-cols-[minmax(110px,0.9fr)_88px_88px_100px_100px_44px]"
      headers={['Banka', 'BIN', 'Tip', 'Marka', 'Tür']}
      empty={!list.length}
      rows={list.map((r) => ({
        id: r.id,
        onEdit: (e) => onEdit(r.id, focusFromEvent(e, 'bank')),
        onDelete: () => onDelete(r.id),
        cells: [
          <span
            key="b"
            data-api-col="bank"
            className="truncate text-sm font-medium text-[var(--panel-ink)]"
          >
            {r.bank}
          </span>,
          <span
            key="bin"
            data-api-col="bin"
            className="font-mono text-sm tabular-nums text-[var(--panel-ink)]"
          >
            {r.bin}
          </span>,
          <span key="t" data-api-col="type" className="text-sm text-[var(--panel-muted)]">
            {r.type}
          </span>,
          <span key="br" data-api-col="brand" className="text-sm text-[var(--panel-muted)]">
            {r.brand}
          </span>,
          <span key="k" data-api-col="kind" className="text-sm text-[var(--panel-muted)]">
            {r.kind}
          </span>,
        ],
      }))}
    />
  );
}

function Sheet({
  cols,
  headers,
  rows,
  empty,
}: {
  cols: string;
  headers: string[];
  empty: boolean;
  rows: {
    id: string;
    onEdit: (e: ReactMouseEvent) => void;
    onDelete: () => void;
    cells: ReactNode[];
  }[];
}) {
  return (
    <div className="min-w-[560px]">
      <div
        className={`grid ${cols} gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50`}
      >
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
        <span className="sr-only">Sil</span>
      </div>
      {empty ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Kayıt bulunamadı</p>
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            data-api-row
            data-km-row
            tabIndex={-1}
            title="Çift tıkla: düzenle"
            onDoubleClick={r.onEdit}
            className={`grid ${cols} cursor-pointer items-center gap-3 border-b border-[var(--panel-line)]/70 px-5 py-3 transition hover:bg-[var(--panel-hover)]`}
          >
            {r.cells}
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Sil"
                title="Sil"
                onClick={(e) => {
                  e.stopPropagation();
                  r.onDelete();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ToastBanner({ toast, onClose }: { toast: NonNullable<Toast>; onClose: () => void }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[12000] flex justify-center px-4">
      <div
        className={[
          'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg',
          toast.kind === 'ok'
            ? 'border-emerald-600/30 bg-emerald-100 text-emerald-900'
            : 'border-rose-600/30 bg-rose-100 text-rose-900',
        ].join(' ')}
      >
        <span className="flex-1">{toast.text}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs opacity-70 hover:opacity-100"
        >
          Kapat
        </button>
      </div>
    </div>,
    document.body,
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-[var(--panel-line)] px-2.5 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function csvLine(cells: string[]) {
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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

function CategoryIcon({ id }: { id: ApiCategoryId }) {
  if (id === 'locations') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (id === 'tax-offices') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20V9l8-5 8 5v11M8 20v-6h8v6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === 'banks') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M4 18h16M12 4 3 9h18L12 4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 15h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
