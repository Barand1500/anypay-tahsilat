import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import {
  ensureLocationPath,
  locationDuplicate,
  type LocationLevel,
  type LocationRow,
} from './mockApiSettings';

export type LocationFocusField = 'level' | 'name' | 'country' | 'city' | 'district';

type Mode = { type: 'create' } | { type: 'edit'; row: LocationRow };

type Preset = {
  countryId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
};

type Props = {
  mode: Mode;
  locations: LocationRow[];
  focusField?: LocationFocusField | null;
  /** Liste filtrelerinden gelen üst bağlam */
  preset?: Preset;
  onClose: () => void;
  onSave: (nextList: LocationRow[]) => void;
};

const LEVEL_OPTS = [
  { value: 'Ülke', label: 'Ülke' },
  { value: 'İl', label: 'Şehir (İl)' },
  { value: 'İlçe', label: 'İlçe' },
  { value: 'Mahalle', label: 'Mahalle' },
];

function initialLevel(mode: Mode, preset?: Preset): string | null {
  if (mode.type === 'edit') return mode.row.level;
  if (preset?.districtId) return 'Mahalle';
  if (preset?.cityId) return 'İlçe';
  if (preset?.countryId) return 'İl';
  return 'Ülke';
}

/**
 * Lokasyon ekle/düzenle — eksik üstleri otomatik oluşturur; mükerrer engeller.
 */
export function LocationModal({
  mode,
  locations,
  focusField = null,
  preset,
  onClose,
  onSave,
}: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.row : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [level, setLevel] = useState<string | null>(() => initialLevel(mode, preset));
  const [name, setName] = useState(src?.name ?? '');
  const [countryId, setCountryId] = useState<string | null>(preset?.countryId ?? null);
  const [cityId, setCityId] = useState<string | null>(preset?.cityId ?? null);
  const [districtId, setDistrictId] = useState<string | null>(preset?.districtId ?? null);
  const [newCountry, setNewCountry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pulse, setPulse] = useState<LocationFocusField | null>(focusField);

  useEffect(() => {
    if (!src) return;
    if (src.level === 'İl') {
      setCountryId(src.parentId);
    } else if (src.level === 'İlçe') {
      setCityId(src.parentId);
      const city = locations.find((r) => r.id === src.parentId);
      setCountryId(city?.parentId ?? null);
    } else if (src.level === 'Mahalle') {
      setDistrictId(src.parentId);
      const dist = locations.find((r) => r.id === src.parentId);
      setCityId(dist?.parentId ?? null);
      const city = dist ? locations.find((r) => r.id === dist.parentId) : undefined;
      setCountryId(city?.parentId ?? null);
    }
  }, [src, locations]);

  const countries = useMemo(
    () => locations.filter((r) => r.level === 'Ülke').map((r) => ({ value: r.id, label: r.name })),
    [locations],
  );
  const cities = useMemo(() => {
    const cid = countryId;
    if (!cid) return [];
    return locations
      .filter((r) => r.level === 'İl' && r.parentId === cid)
      .map((r) => ({ value: r.id, label: r.name }));
  }, [locations, countryId]);
  const districts = useMemo(() => {
    const cid = cityId;
    if (!cid) return [];
    return locations
      .filter((r) => r.level === 'İlçe' && r.parentId === cid)
      .map((r) => ({ value: r.id, label: r.name }));
  }, [locations, cityId]);

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
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const field = focusField ?? (isEdit ? 'name' : 'level');
    setPulse(field);
    const t = window.setTimeout(() => {
      if (field === 'name') nameRef.current?.focus();
    }, 280);
    const clear = window.setTimeout(() => setPulse(null), 1600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [focusField, isEdit]);

  function onLevelChange(v: string | null) {
    setLevel(v);
    if (v === 'Ülke') {
      setCountryId(null);
      setCityId(null);
      setDistrictId(null);
      setNewCountry('');
      setNewCity('');
      setNewDistrict('');
    } else if (v === 'İl') {
      setCityId(null);
      setDistrictId(null);
      setNewCity('');
      setNewDistrict('');
    } else if (v === 'İlçe') {
      setDistrictId(null);
      setNewDistrict('');
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const nextErr: Record<string, string> = {};
    const nm = name.trim();
    if (!nm) nextErr.name = 'Ad gerekli';
    if (!level) nextErr.level = 'Ne ekleyeceğinizi seçin';

    const lv = level as LocationLevel;

    if (lv === 'Ülke') {
      if (locationDuplicate(locations, nm, 'Ülke', null, src?.id)) {
        nextErr.name = 'Bu ülke zaten var';
      }
      setErrors(nextErr);
      if (Object.keys(nextErr).length) return;
      if (isEdit && src) {
        onSave(locations.map((r) => (r.id === src.id ? { ...r, name: nm } : r)));
      } else {
        const { list } = ensureLocationPath(locations, { country: nm });
        onSave(list);
      }
      return;
    }

    const countryName =
      newCountry.trim() || locations.find((r) => r.id === countryId)?.name || '';
    if (!countryName) nextErr.country = 'Ülke seçin veya yeni ülke yazın';

    if (lv === 'İl') {
      setErrors(nextErr);
      if (Object.keys(nextErr).length) return;
      let working = locations;
      const ensured = ensureLocationPath(working, { country: countryName });
      working = ensured.list;
      const cId = ensured.id;
      if (locationDuplicate(working, nm, 'İl', cId, src?.id)) {
        setErrors({ name: 'Bu ülkede bu şehir zaten var' });
        return;
      }
      if (isEdit && src) {
        onSave(
          working.map((r) =>
            r.id === src.id ? { ...r, name: nm, parentId: cId, level: 'İl' } : r,
          ),
        );
      } else {
        onSave([...working, { id: `loc-${Date.now()}`, name: nm, level: 'İl', parentId: cId }]);
      }
      return;
    }

    const cityName = newCity.trim() || locations.find((r) => r.id === cityId)?.name || '';
    if (!cityName) nextErr.city = 'Şehir seçin veya yeni şehir yazın';

    if (lv === 'İlçe') {
      setErrors(nextErr);
      if (Object.keys(nextErr).length) return;
      let working = ensureLocationPath(locations, {
        country: countryName,
        city: cityName,
      }).list;
      const city = working.find(
        (r) =>
          r.level === 'İl' &&
          r.name.toLocaleLowerCase('tr') === cityName.toLocaleLowerCase('tr'),
      );
      const cId = city?.id ?? null;
      if (locationDuplicate(working, nm, 'İlçe', cId, src?.id)) {
        setErrors({ name: 'Bu şehirde bu ilçe zaten var' });
        return;
      }
      if (isEdit && src) {
        onSave(
          working.map((r) =>
            r.id === src.id ? { ...r, name: nm, parentId: cId, level: 'İlçe' } : r,
          ),
        );
      } else {
        onSave([...working, { id: `loc-${Date.now()}`, name: nm, level: 'İlçe', parentId: cId }]);
      }
      return;
    }

    const districtName =
      newDistrict.trim() || locations.find((r) => r.id === districtId)?.name || '';
    if (!districtName) nextErr.district = 'İlçe seçin veya yeni ilçe yazın';
    setErrors(nextErr);
    if (Object.keys(nextErr).length) return;

    let working = ensureLocationPath(locations, {
      country: countryName,
      city: cityName,
      district: districtName,
    }).list;
    const dist = working.find(
      (r) =>
        r.level === 'İlçe' &&
        r.name.toLocaleLowerCase('tr') === districtName.toLocaleLowerCase('tr'),
    );
    const dId = dist?.id ?? null;
    if (locationDuplicate(working, nm, 'Mahalle', dId, src?.id)) {
      setErrors({ name: 'Bu ilçede bu mahalle zaten var' });
      return;
    }
    if (isEdit && src) {
      onSave(
        working.map((r) =>
          r.id === src.id ? { ...r, name: nm, parentId: dId, level: 'Mahalle' } : r,
        ),
      );
    } else {
      onSave([...working, { id: `loc-${Date.now()}`, name: nm, level: 'Mahalle', parentId: dId }]);
    }
  }

  const hint =
    level === 'Mahalle'
      ? 'Örn. Toroslar yoksa hem Mersin hem Toroslar otomatik eklenir.'
      : level === 'İlçe'
        ? 'Şehir yoksa önce şehir oluşturulur, sonra ilçe eklenir.'
        : level === 'İl'
          ? 'Ülke yoksa yeni ülke de oluşturulur.'
          : 'Aynı isimde ülke varsa kayıt engellenir.';

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--panel-ink)]">
              {isEdit ? 'Lokasyon Düzenle' : 'Lokasyon Ekle'}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Ülke → Şehir → İlçe → Mahalle. Eksik üstler otomatik oluşur.
            </p>
          </div>
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
            <div className={pulse === 'level' ? 'field-focus-pulse rounded-xl' : ''}>
              <FloatingSearchSelect
                label="Ne ekliyorsunuz? *"
                options={LEVEL_OPTS}
                value={level}
                onChange={onLevelChange}
                placeholder="Ülke / Şehir / İlçe / Mahalle"
                kmJump
                pulse={pulse === 'level'}
              />
            </div>

            {level && level !== 'Ülke' ? (
              <div className="space-y-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  Üst kayıtlar
                </p>
                <div className={pulse === 'country' ? 'field-focus-pulse rounded-xl' : ''}>
                  <FloatingSearchSelect
                    label="Ülke *"
                    options={countries}
                    value={countryId}
                    onChange={(v) => {
                      setCountryId(v);
                      setNewCountry('');
                      setCityId(null);
                      setDistrictId(null);
                    }}
                    placeholder="Listeden seçin"
                    kmJump
                    pulse={pulse === 'country'}
                  />
                  <TextInput
                    className="mt-2"
                    data-km-jump
                    labelMode="placeholder"
                    label="veya yeni ülke adı"
                    value={newCountry}
                    onChange={(e) => {
                      setNewCountry(e.target.value);
                      if (e.target.value.trim()) setCountryId(null);
                    }}
                  />
                  {errors.country ? (
                    <p className="mt-1 text-xs text-red-500">{errors.country}</p>
                  ) : null}
                </div>

                {level === 'İlçe' || level === 'Mahalle' ? (
                  <div className={pulse === 'city' ? 'field-focus-pulse rounded-xl' : ''}>
                    <FloatingSearchSelect
                      label="Şehir *"
                      options={cities}
                      value={cityId}
                      onChange={(v) => {
                        setCityId(v);
                        setNewCity('');
                        setDistrictId(null);
                      }}
                      placeholder={countryId || newCountry ? 'Listeden seçin' : 'Önce ülke seçin'}
                      kmJump
                      pulse={pulse === 'city'}
                    />
                    <TextInput
                      className="mt-2"
                      data-km-jump
                      labelMode="placeholder"
                      label="veya yeni şehir adı"
                      value={newCity}
                      onChange={(e) => {
                        setNewCity(e.target.value);
                        if (e.target.value.trim()) setCityId(null);
                      }}
                    />
                    {errors.city ? (
                      <p className="mt-1 text-xs text-red-500">{errors.city}</p>
                    ) : null}
                  </div>
                ) : null}

                {level === 'Mahalle' ? (
                  <div className={pulse === 'district' ? 'field-focus-pulse rounded-xl' : ''}>
                    <FloatingSearchSelect
                      label="İlçe *"
                      options={districts}
                      value={districtId}
                      onChange={(v) => {
                        setDistrictId(v);
                        setNewDistrict('');
                      }}
                      placeholder={cityId || newCity ? 'Listeden seçin' : 'Önce şehir seçin'}
                      kmJump
                      pulse={pulse === 'district'}
                    />
                    <TextInput
                      className="mt-2"
                      data-km-jump
                      labelMode="placeholder"
                      label="veya yeni ilçe adı"
                      value={newDistrict}
                      onChange={(e) => {
                        setNewDistrict(e.target.value);
                        if (e.target.value.trim()) setDistrictId(null);
                      }}
                    />
                    {errors.district ? (
                      <p className="mt-1 text-xs text-red-500">{errors.district}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
              <TextInput
                ref={nameRef}
                data-km-jump
                label={
                  level === 'Ülke'
                    ? 'Ülke adı *'
                    : level === 'İl'
                      ? 'Şehir adı *'
                      : level === 'İlçe'
                        ? 'İlçe adı *'
                        : 'Mahalle adı *'
                }
                value={name}
                error={errors.name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <p className="rounded-xl border border-[var(--color-brand-500)]/25 bg-[var(--brand-soft-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--color-brand-700)]">
              {hint}
            </p>
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
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
