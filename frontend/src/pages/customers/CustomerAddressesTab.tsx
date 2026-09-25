import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import type { CustomerAddress } from './mockCustomerDetail';
import type { Customer } from './mockCustomers';
import { mapCustomer, type ApiCustomer } from './customersApi';

type LocOpt = { value: string; label: string };
type ApiAddress = CustomerAddress & {
  contactNames?: string[];
  ulkeId?: number;
  ilId?: number;
  ilceId?: number;
  semtId?: number;
  mahalleId?: number;
  sokakId?: number;
};

type Props = {
  customer: Customer;
  flash: (m: string) => void;
  onCustomerPatched?: (c: Customer) => void;
};

/** Müşteri adresleri — çift tık düzenle, yalnızca sil ikonu */
export function CustomerAddressesTab({ customer, flash, onCustomerPatched }: Props) {
  const { token } = useAuth();
  const [list, setList] = useState<ApiAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [primaryEdit, setPrimaryEdit] = useState(false);
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [directions, setDirections] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [countries, setCountries] = useState<LocOpt[]>([]);
  const [provinces, setProvinces] = useState<LocOpt[]>([]);
  const [districts, setDistricts] = useState<LocOpt[]>([]);
  const [towns, setTowns] = useState<LocOpt[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<LocOpt[]>([]);
  const [streets, setStreets] = useState<LocOpt[]>([]);

  async function reload() {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await api.get<ApiAddress[]>(
        `/api/customers/${encodeURIComponent(customer.id)}/addresses`,
        token,
      );
      setList(rows);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Adresler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, token, customer.address]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const rows = await api.get<LocOpt[]>('/api/customers/locations/countries', token);
        setCountries(rows);
        const tr = rows.find((r) => r.label.toLocaleLowerCase('tr').includes('türkiye'));
        if (tr) setCountry((c) => c ?? tr.value);
      } catch {
        /* loc opsiyonel */
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !country) {
      setProvinces([]);
      return;
    }
    void (async () => {
      try {
        setProvinces(
          await api.get<LocOpt[]>(
            `/api/customers/locations/provinces?ulkeId=${encodeURIComponent(country)}`,
            token,
          ),
        );
      } catch {
        setProvinces([]);
      }
    })();
  }, [token, country]);

  useEffect(() => {
    if (!token || !province) {
      setDistricts([]);
      return;
    }
    void (async () => {
      try {
        setDistricts(
          await api.get<LocOpt[]>(
            `/api/customers/locations/districts?ilId=${encodeURIComponent(province)}`,
            token,
          ),
        );
      } catch {
        setDistricts([]);
      }
    })();
  }, [token, province]);

  useEffect(() => {
    if (!token || !district) {
      setTowns([]);
      return;
    }
    void (async () => {
      try {
        setTowns(
          await api.get<LocOpt[]>(
            `/api/customers/locations/towns?ilceId=${encodeURIComponent(district)}`,
            token,
          ),
        );
      } catch {
        setTowns([]);
      }
    })();
  }, [token, district]);

  useEffect(() => {
    if (!token || !town) {
      setNeighborhoods([]);
      return;
    }
    void (async () => {
      try {
        setNeighborhoods(
          await api.get<LocOpt[]>(
            `/api/customers/locations/neighborhoods?semtId=${encodeURIComponent(town)}`,
            token,
          ),
        );
      } catch {
        setNeighborhoods([]);
      }
    })();
  }, [token, town]);

  useEffect(() => {
    if (!token || !neighborhood) {
      setStreets([]);
      return;
    }
    void (async () => {
      try {
        setStreets(
          await api.get<LocOpt[]>(
            `/api/customers/locations/streets?mahalleId=${encodeURIComponent(neighborhood)}`,
            token,
          ),
        );
      } catch {
        setStreets([]);
      }
    })();
  }, [token, neighborhood]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return list;
    return list.filter(
      (a) =>
        a.label.toLocaleLowerCase('tr').includes(q) ||
        a.address.toLocaleLowerCase('tr').includes(q) ||
        a.contactName.toLocaleLowerCase('tr').includes(q) ||
        (a.contactNames || []).some((n) => n.toLocaleLowerCase('tr').includes(q)),
    );
  }, [list, query]);

  function resetForm() {
    setEditingId(null);
    setPrimaryEdit(false);
    setLabel('');
    setProvince(null);
    setDistrict(null);
    setTown(null);
    setNeighborhood(null);
    setStreet(null);
    setDirections('');
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(a: ApiAddress) {
    setEditingId(a.id);
    setPrimaryEdit(Boolean(a.isPrimary));
    setLabel(a.label);
    setCountry(a.ulkeId ? String(a.ulkeId) : null);
    setProvince(a.ilId ? String(a.ilId) : null);
    setDistrict(a.ilceId ? String(a.ilceId) : null);
    setTown(a.semtId ? String(a.semtId) : null);
    setNeighborhood(a.mahalleId ? String(a.mahalleId) : null);
    setStreet(a.sokakId ? String(a.sokakId) : null);
    setDirections(a.isPrimary ? a.address : a.directions || '');
    setFormError(null);
    setFormOpen(true);
  }

  async function patchCustomerAddress(addressText: string) {
    if (!token) return;
    const raw = await api.patch<ApiCustomer>(
      `/api/customers/${encodeURIComponent(customer.id)}`,
      {
        code: customer.code,
        title: customer.title,
        kind: customer.kind,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        taxOfficeId: customer.taxOfficeId ?? null,
        identityNo: customer.identityNo,
        address: addressText,
        accountTypeName: customer.accountType || undefined,
        parentId: customer.parentId ? Number(customer.parentId) : null,
      },
      token,
    );
    onCustomerPatched?.(mapCustomer(raw));
  }

  async function saveAddr(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (primaryEdit) {
      if (!directions.trim()) {
        setFormError('Adres gerekli');
        return;
      }
      setSaving(true);
      setFormError(null);
      try {
        await patchCustomerAddress(directions.trim());
        flash('Adres güncellendi');
        setFormOpen(false);
        resetForm();
        await reload();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Adres kaydedilemedi');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!label.trim()) {
      setFormError('Adres adı gerekli');
      return;
    }
    if (!country || !province || !district || !town || !neighborhood || !street) {
      setFormError('Zorunlu adres alanlarını doldurun');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      label: label.trim(),
      ulkeId: Number(country),
      ilId: Number(province),
      ilceId: Number(district),
      semtId: Number(town),
      mahalleId: Number(neighborhood),
      sokakId: Number(street),
      directions: directions.trim(),
    };
    try {
      if (editingId) {
        const row = await api.patch<ApiAddress>(
          `/api/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(editingId)}`,
          body,
          token,
        );
        setList((prev) => prev.map((a) => (a.id === editingId ? row : a)));
        flash('Adres güncellendi');
      } else {
        const row = await api.post<ApiAddress>(
          `/api/customers/${encodeURIComponent(customer.id)}/addresses`,
          body,
          token,
        );
        setList((prev) => [row, ...prev]);
        flash('Adres eklendi');
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Adres kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function removeAddr(a: ApiAddress) {
    if (!token) return;
    try {
      if (a.isPrimary || a.id.startsWith('primary-')) {
        await patchCustomerAddress('');
        flash('Adres silindi');
        await reload();
        return;
      }
      await api.delete(
        `/api/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(a.id)}`,
        token,
      );
      setList((prev) => prev.filter((x) => x.id !== a.id));
      flash('Adres silindi');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  return (
    <section
      data-anim
      className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold text-[var(--panel-ink)]">Müşteri Adresleri</h1>
        <button
          type="button"
          data-km-jump
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <span className="text-lg leading-none">+</span>
          Ekle
        </button>
      </div>

      {formOpen ? (
        <form
          onSubmit={(e) => void saveAddr(e)}
          className="space-y-4 border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-5 sm:px-6 [--input-notch:var(--panel-elevated)]"
        >
          <h2 className="text-sm font-bold text-[var(--panel-ink)]">
            {editingId ? 'Adres Düzenle' : 'Adres Ekle'}
          </h2>

          {primaryEdit ? (
            <TextInput
              label="Kayıt Adresi *"
              value={directions}
              onChange={(e) => setDirections(e.target.value)}
              required
              data-km-jump
            />
          ) : (
            <>
              <TextInput
                label="Adres Adı *"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                data-km-jump
              />
              <FloatingSearchSelect
                label="Ülke *"
                options={countries}
                value={country}
                onChange={(v) => {
                  setCountry(v);
                  setProvince(null);
                  setDistrict(null);
                  setTown(null);
                  setNeighborhood(null);
                  setStreet(null);
                }}
                placeholder="Ülke seçiniz."
                required
                kmJump
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingSearchSelect
                  label="İl *"
                  options={provinces}
                  value={province}
                  onChange={(v) => {
                    setProvince(v);
                    setDistrict(null);
                    setTown(null);
                    setNeighborhood(null);
                    setStreet(null);
                  }}
                  placeholder="İl seçiniz."
                  required
                  kmJump
                />
                <FloatingSearchSelect
                  label="İlçe *"
                  options={districts}
                  value={district}
                  onChange={(v) => {
                    setDistrict(v);
                    setTown(null);
                    setNeighborhood(null);
                    setStreet(null);
                  }}
                  placeholder="İlçe seçiniz."
                  required
                  kmJump
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingSearchSelect
                  label="Semt *"
                  options={towns}
                  value={town}
                  onChange={(v) => {
                    setTown(v);
                    setNeighborhood(null);
                    setStreet(null);
                  }}
                  placeholder="Semt seçiniz."
                  required
                  kmJump
                />
                <FloatingSearchSelect
                  label="Mahalle *"
                  options={neighborhoods}
                  value={neighborhood}
                  onChange={(v) => {
                    setNeighborhood(v);
                    setStreet(null);
                  }}
                  placeholder="Mahalle seçiniz."
                  required
                  kmJump
                />
              </div>
              <FloatingSearchSelect
                label="Cadde/Sokak *"
                options={streets}
                value={street}
                onChange={setStreet}
                placeholder="Sokak seçiniz."
                required
                kmJump
              />
              <TextInput
                label="Adres Tarifi"
                value={directions}
                onChange={(e) => setDirections(e.target.value)}
                data-km-jump
              />
            </>
          )}

          <div className="flex shrink-0 gap-2">
            <button
              type="submit"
              disabled={saving}
              data-km-jump
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
            >
              İptal
            </button>
          </div>
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <p className="text-sm text-[var(--panel-muted)]">{filtered.length} kayıt</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ara…"
          className="w-full max-w-[220px] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-500)]"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-y border-[var(--panel-line)] text-[11px] uppercase tracking-wide text-[var(--panel-muted)]">
              <th className="px-5 py-2.5 font-semibold sm:px-6">Adı</th>
              <th className="px-3 py-2.5 font-semibold">Adres</th>
              <th className="px-3 py-2.5 font-semibold">Yetkililer</th>
              <th className="px-5 py-2.5 font-semibold sm:px-6" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[var(--panel-muted)]">
                  {loading ? 'Yükleniyor…' : 'Adres yok.'}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr
                  key={a.id}
                  onDoubleClick={() => openEdit(a)}
                  title="Çift tıkla düzenle"
                  className="cursor-pointer border-b border-[var(--panel-line)]/80 hover:bg-[var(--panel-hover)]/40"
                >
                  <td className="px-5 py-3 font-bold text-[var(--panel-ink)] sm:px-6">
                    {a.label}
                    {a.isPrimary ? (
                      <span className="ml-2 rounded-md bg-[var(--brand-soft-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-600)]">
                        Cari
                      </span>
                    ) : null}
                    {a.isDefault && !a.isPrimary ? (
                      <span className="ml-2 rounded-md bg-[var(--brand-soft-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-600)]">
                        Varsayılan
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-[var(--panel-ink)]/80">{a.address}</td>
                  <td className="px-3 py-3 font-medium text-[var(--panel-ink)]">
                    {(a.contactNames && a.contactNames.length
                      ? a.contactNames.join(', ')
                      : a.contactName) || '—'}
                  </td>
                  <td
                    className="px-5 py-3 sm:px-6"
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={() => {
                        void removeAddr(a);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
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
