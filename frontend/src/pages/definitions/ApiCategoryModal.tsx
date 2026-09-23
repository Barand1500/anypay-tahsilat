import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CreatableFilterInput } from '../../components/ui/CreatableFilterInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { GrowingValueList } from '../../components/ui/GrowingValueList';
import { TextInput } from '../../components/ui/TextInput';
import { districtsOf, PROVINCES } from '../customers/mockLocations';
import { BankPicker } from './BankPicker';
import type { BankRow, BinRow, LocationRow, TaxOfficeRow } from './mockApiSettings';

type TaxMode = { type: 'create' } | { type: 'edit'; row: TaxOfficeRow };
type BankMode = { type: 'create' } | { type: 'edit'; row: BankRow };
type BinMode = { type: 'create' } | { type: 'edit'; row: BinRow };

type Props =
  | {
      category: 'tax-offices';
      mode: TaxMode;
      locations: LocationRow[];
      focusField?: string | null;
      onClose: () => void;
      onSave: (row: Omit<TaxOfficeRow, 'id'> & { id?: string }) => void;
    }
  | {
      category: 'banks';
      mode: BankMode;
      focusField?: string | null;
      onClose: () => void;
      onSave: (row: Omit<BankRow, 'id'> & { id?: string }) => void;
    }
  | {
      category: 'bin';
      mode: BinMode;
      focusField?: string | null;
      /** Mükerrer BIN kontrolü */
      existingBins?: string[];
      onClose: () => void;
      onSave: (rows: Array<Omit<BinRow, 'id'> & { id?: string }>) => void;
    };

const BIN_TYPE_OPTS = [
  { value: 'Credit', label: 'Credit' },
  { value: 'Debit', label: 'Debit' },
];

const BIN_BRAND_OPTS = [
  { value: 'Visa', label: 'Visa' },
  { value: 'MasterCard', label: 'MasterCard' },
  { value: 'Troy', label: 'Troy' },
  { value: 'Amex', label: 'Amex' },
];

const BIN_KIND_OPTS = [
  { value: 'Bireysel', label: 'Bireysel' },
  { value: 'Ticari', label: 'Ticari' },
];

function uniqSorted(items: string[]) {
  const map = new Map<string, string>();
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLocaleLowerCase('tr');
    if (!map.has(key)) map.set(key, t);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'tr'));
}

export function ApiCategoryModal(props: Props) {
  const { category, mode, onClose, focusField = null } = props;
  const isEdit = mode.type === 'edit';
  const panelRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pulse, setPulse] = useState<string | null>(focusField);

  const tax = category === 'tax-offices' && isEdit ? (mode as TaxMode & { type: 'edit' }).row : null;
  const locations = category === 'tax-offices' ? props.locations : [];
  const [taxCity, setTaxCity] = useState(tax?.city ?? '');
  const [taxDistrict, setTaxDistrict] = useState(tax?.district ?? '');
  const [taxName, setTaxName] = useState(tax?.name ?? '');

  const bank = category === 'banks' && isEdit ? (mode as BankMode & { type: 'edit' }).row : null;
  const [bankName, setBankName] = useState(bank?.name ?? '');
  const [bankShort, setBankShort] = useState(bank?.shortName ?? '');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

  const bin = category === 'bin' && isEdit ? (mode as BinMode & { type: 'edit' }).row : null;
  const existingBins = category === 'bin' ? (props.existingBins ?? []) : [];
  const [binBank, setBinBank] = useState(bin?.bank ?? '');
  const [binCode, setBinCode] = useState(bin?.bin ?? '');
  /** Create: bir bankaya birden fazla BIN */
  const [binCodes, setBinCodes] = useState<string[]>(() => (bin?.bin ? [bin.bin] : []));
  const [binType, setBinType] = useState<string | null>(bin?.type ?? 'Credit');
  const [binBrand, setBinBrand] = useState<string | null>(bin?.brand ?? 'Visa');
  const [binKind, setBinKind] = useState<string | null>(bin?.kind ?? 'Bireysel');
  const [binPickerOpen, setBinPickerOpen] = useState(false);

  const cityOptions = useMemo(
    () =>
      uniqSorted([
        ...PROVINCES.map((p) => p.label),
        ...locations.filter((r) => r.level === 'İl').map((r) => r.name),
      ]),
    [locations],
  );

  const districtOptions = useMemo(() => {
    const cityKey = taxCity.trim().toLocaleLowerCase('tr');
    if (!cityKey) return [];
    const prov = PROVINCES.find((p) => p.label.toLocaleLowerCase('tr') === cityKey);
    const fromProv = prov ? districtsOf(prov.value).map((d) => d.label) : [];
    const cityRow = locations.find(
      (r) => r.level === 'İl' && r.name.toLocaleLowerCase('tr') === cityKey,
    );
    const fromLoc = cityRow
      ? locations.filter((r) => r.level === 'İlçe' && r.parentId === cityRow.id).map((r) => r.name)
      : [];
    return uniqSorted([...fromProv, ...fromLoc]);
  }, [locations, taxCity]);

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
        if (bankPickerOpen || binPickerOpen) {
          setBankPickerOpen(false);
          setBinPickerOpen(false);
          return;
        }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, bankPickerOpen, binPickerOpen]);

  useEffect(() => {
    const field = focusField ?? 'name';
    setPulse(field);
    const clear = window.setTimeout(() => setPulse(null), 1600);
    return () => window.clearTimeout(clear);
  }, [focusField]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};

    if (category === 'tax-offices') {
      if (!taxCity.trim()) next.city = 'İl gerekli';
      if (!taxDistrict.trim()) next.district = 'İlçe gerekli';
      if (!taxName.trim()) next.name = 'Ad gerekli';
      setErrors(next);
      if (Object.keys(next).length) return;
      props.onSave({
        id: tax?.id,
        city: taxCity.trim(),
        district: taxDistrict.trim(),
        name: taxName.trim(),
      });
      return;
    }

    if (category === 'banks') {
      if (!bankName.trim()) next.name = 'Ad gerekli';
      if (!bankShort.trim()) next.shortName = 'Kısa ad gerekli';
      setErrors(next);
      if (Object.keys(next).length) return;
      props.onSave({
        id: bank?.id,
        name: bankName.trim(),
        shortName: bankShort.trim(),
      });
      return;
    }

    if (category === 'bin') {
      if (!binBank.trim()) next.bank = 'Banka gerekli';
      if (!binType) next.type = 'Tip seçin';
      if (!binBrand) next.brand = 'Marka seçin';
      if (!binKind) next.kind = 'Tür seçin';

      if (isEdit) {
        if (!/^\d{4,8}$/.test(binCode.trim())) next.bin = 'BIN 4–8 rakam olmalı';
        else {
          const code = binCode.trim();
          const dup = existingBins.some((b) => b === code && b !== (bin?.bin ?? ''));
          if (dup) next.bin = 'Bu BIN zaten kayıtlı';
        }
        setErrors(next);
        if (Object.keys(next).length) return;
        props.onSave([
          {
            id: bin?.id,
            bank: binBank.trim(),
            bin: binCode.trim(),
            type: binType!,
            brand: binBrand!,
            kind: binKind!,
          },
        ]);
        return;
      }

      if (binCodes.length === 0) next.bin = 'En az bir BIN ekleyin';
      else {
        const bad = binCodes.find((c) => !/^\d{4,8}$/.test(c));
        if (bad) next.bin = `Geçersiz BIN: ${bad} (4–8 rakam)`;
        else {
          const dupLocal = binCodes.filter((c, i) => binCodes.indexOf(c) !== i);
          if (dupLocal.length) next.bin = `Tekrarlayan BIN: ${dupLocal[0]}`;
          else {
            const dupExist = binCodes.find((c) => existingBins.includes(c));
            if (dupExist) next.bin = `Bu BIN zaten kayıtlı: ${dupExist}`;
          }
        }
      }
      setErrors(next);
      if (Object.keys(next).length) return;
      props.onSave(
        binCodes.map((code) => ({
          bank: binBank.trim(),
          bin: code,
          type: binType!,
          brand: binBrand!,
          kind: binKind!,
        })),
      );
    }
  }

  const title =
    category === 'tax-offices'
      ? isEdit
        ? 'Vergi Dairesi Düzenle'
        : 'Vergi Dairesi Ekle'
      : category === 'banks'
        ? isEdit
          ? 'Banka Düzenle'
          : 'Banka Ekle'
        : isEdit
          ? 'BIN Düzenle'
          : 'BIN Ekle';

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div className="relative z-10 flex w-full max-w-lg flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:items-start">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal
          className="flex max-h-[min(92vh,640px)] w-full max-w-lg shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
            <h2 className="text-lg font-bold text-[var(--panel-ink)]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {category === 'tax-offices' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={pulse === 'city' ? 'field-focus-pulse rounded-xl' : ''}>
                      <CreatableFilterInput
                        label="İl *"
                        value={taxCity}
                        options={cityOptions}
                        required
                        kmJump
                        placeholder="İl yazın veya seçin"
                        onChange={(v) => {
                          setTaxCity(v);
                          setTaxDistrict('');
                          if (errors.city) setErrors((e) => ({ ...e, city: '' }));
                        }}
                      />
                      {errors.city ? (
                        <p className="mt-1 text-xs text-red-500">{errors.city}</p>
                      ) : null}
                    </div>
                    <div className={pulse === 'district' ? 'field-focus-pulse rounded-xl' : ''}>
                      <CreatableFilterInput
                        label="İlçe *"
                        value={taxDistrict}
                        options={districtOptions}
                        required
                        kmJump
                        placeholder={
                          taxCity.trim() ? 'İlçe yazın veya seçin' : 'Önce il seçin'
                        }
                        onChange={(v) => {
                          setTaxDistrict(v);
                          if (errors.district) setErrors((e) => ({ ...e, district: '' }));
                        }}
                      />
                      {errors.district ? (
                        <p className="mt-1 text-xs text-red-500">{errors.district}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
                    <TextInput
                      data-km-jump
                      label="Adı *"
                      value={taxName}
                      error={errors.name}
                      onChange={(e) => setTaxName(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : null}

              {category === 'banks' ? (
                <>
                  <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
                    <TextInput
                      data-km-jump
                      label="Adı *"
                      value={bankName}
                      error={errors.name}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      endAdornment={
                        <button
                          type="button"
                          data-km-jump
                          aria-label="Banka seç"
                          title="Banka seç"
                          onClick={() => setBankPickerOpen((v) => !v)}
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-lg transition',
                            bankPickerOpen
                              ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--color-brand-600)]'
                              : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                          ].join(' ')}
                        >
                          <BankPickIcon />
                        </button>
                      }
                    />
                  </div>
                  <div className={pulse === 'shortName' ? 'field-focus-pulse rounded-xl' : ''}>
                    <TextInput
                      data-km-jump
                      label="Kısa Adı *"
                      value={bankShort}
                      error={errors.shortName}
                      onChange={(e) => setBankShort(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : null}

              {category === 'bin' ? (
                <>
                  <div className={pulse === 'bank' ? 'field-focus-pulse rounded-xl' : ''}>
                    <TextInput
                      data-km-jump
                      label="Banka *"
                      value={binBank}
                      error={errors.bank}
                      onChange={(e) => setBinBank(e.target.value)}
                      required
                      endAdornment={
                        <button
                          type="button"
                          data-km-jump
                          aria-label="Banka seç"
                          title="Banka seç"
                          onClick={() => setBinPickerOpen((v) => !v)}
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-lg transition',
                            binPickerOpen
                              ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--color-brand-600)]'
                              : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                          ].join(' ')}
                        >
                          <BankPickIcon />
                        </button>
                      }
                    />
                  </div>

                  {isEdit ? (
                    <div className={pulse === 'bin' ? 'field-focus-pulse rounded-xl' : ''}>
                      <TextInput
                        data-km-jump
                        label="BIN *"
                        value={binCode}
                        error={errors.bin}
                        onChange={(e) =>
                          setBinCode(e.target.value.replace(/\D/g, '').slice(0, 8))
                        }
                        className="font-mono tabular-nums"
                        required
                      />
                    </div>
                  ) : (
                    <div className={pulse === 'bin' ? 'field-focus-pulse rounded-xl' : ''}>
                      <GrowingValueList
                        label="BIN kodları *"
                        values={binCodes}
                        onChange={(next) => {
                          setBinCodes(next);
                          if (errors.bin) setErrors((e) => ({ ...e, bin: '' }));
                        }}
                        placeholder="BIN yazıp Enter (4–8 rakam)…"
                        normalize={(raw) => raw.replace(/\D/g, '').slice(0, 8)}
                        validate={(v) =>
                          /^\d{4,8}$/.test(v) ? null : 'BIN 4–8 rakam olmalı'
                        }
                        hint={
                          <span className="text-[11px] text-[var(--panel-muted)]">
                            Aynı banka için birden fazla BIN ekleyebilirsiniz.
                          </span>
                        }
                      />
                      {errors.bin ? (
                        <p className="mt-1 text-xs text-red-500">{errors.bin}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className={pulse === 'type' ? 'field-focus-pulse rounded-xl' : ''}>
                      <FloatingSearchSelect
                        label="Tip *"
                        options={BIN_TYPE_OPTS}
                        value={binType}
                        onChange={setBinType}
                        placeholder="Tip"
                        kmJump
                        pulse={pulse === 'type'}
                      />
                    </div>
                    <div className={pulse === 'brand' ? 'field-focus-pulse rounded-xl' : ''}>
                      <FloatingSearchSelect
                        label="Marka *"
                        options={BIN_BRAND_OPTS}
                        value={binBrand}
                        onChange={setBinBrand}
                        placeholder="Marka"
                        kmJump
                        pulse={pulse === 'brand'}
                      />
                    </div>
                    <div className={pulse === 'kind' ? 'field-focus-pulse rounded-xl' : ''}>
                      <FloatingSearchSelect
                        label="Tür *"
                        options={BIN_KIND_OPTS}
                        value={binKind}
                        onChange={setBinKind}
                        placeholder="Tür"
                        kmJump
                        pulse={pulse === 'kind'}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--panel-line)] px-4 py-2 text-sm font-semibold"
              >
                Kapat
              </button>
              <button
                type="submit"
                data-km-jump
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white"
              >
                {category === 'bin' && !isEdit && binCodes.length > 1
                  ? `Kaydet (${binCodes.length} BIN)`
                  : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>

        {category === 'banks' ? (
          <BankPicker
            open={bankPickerOpen}
            value={bankName}
            onSelect={(b) => {
              setBankName(b.fullName);
              setBankShort(b.name.toLocaleUpperCase('tr'));
              setErrors((prev) => {
                const next = { ...prev };
                delete next.name;
                delete next.shortName;
                return next;
              });
            }}
            onClose={() => setBankPickerOpen(false)}
          />
        ) : null}

        {category === 'bin' ? (
          <BankPicker
            open={binPickerOpen}
            value={binBank}
            onSelect={(b) => {
              setBinBank(b.fullName);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.bank;
                return next;
              });
            }}
            onClose={() => setBinPickerOpen(false)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function BankPickIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M4 18h16M12 4 3 9h18L12 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
