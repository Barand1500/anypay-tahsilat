import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCustomersList } from '../../pages/customers/useCustomersList';

export type FavCustomer = { id: string; name: string };

const STORAGE_KEY = 'anypay_tahsilat_fav_customers';
const SLOT_COUNT = 3;

function storageKey(userId: number | undefined) {
  return userId != null ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
}

function readSlots(userId: number | undefined): (FavCustomer | null)[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return Array(SLOT_COUNT).fill(null);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Array(SLOT_COUNT).fill(null);
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const v = parsed[i];
      if (v && typeof v === 'object' && 'id' in v && 'name' in v) {
        return v as FavCustomer;
      }
      return null;
    });
  } catch {
    return Array(SLOT_COUNT).fill(null);
  }
}

/** Haftalık kart altı — favori müşteri yuvaları (API listesi) */
export function FavoriteCustomerSlots() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { customers, loading } = useCustomersList({ parentId: 'all' });
  const [slots, setSlots] = useState<(FavCustomer | null)[]>(() =>
    typeof window === 'undefined' ? Array(SLOT_COUNT).fill(null) : readSlots(user?.id),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlots(readSlots(user?.id));
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem(storageKey(user?.id), JSON.stringify(slots));
  }, [slots, user?.id]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenIndex(null);
        setQ('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const catalog = useMemo<FavCustomer[]>(
    () =>
      customers.map((c) => ({
        id: c.id,
        name: c.title || c.code || `#${c.id}`,
      })),
    [customers],
  );

  const filtered = useMemo(() => {
    const taken = new Set(slots.filter(Boolean).map((s) => s!.id));
    const qq = q.trim().toLocaleLowerCase('tr');
    return catalog.filter(
      (c) => !taken.has(c.id) && (!qq || c.name.toLocaleLowerCase('tr').includes(qq)),
    );
  }, [q, slots, catalog]);

  function pick(index: number, c: FavCustomer) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = c;
      return next;
    });
    setOpenIndex(null);
    setQ('');
  }

  function clear(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  return (
    <div ref={rootRef} className="relative mt-auto pt-3">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
        Favori müşteriler
      </p>
      <div className="flex gap-1.5">
        {slots.map((c, i) => (
          <div key={i} className="relative flex-1">
            {c ? (
              <button
                type="button"
                title={`${c.name} — tıkla: aç · sağ tık: kaldır`}
                onClick={() => navigate(`/musteriler/${c.id}`)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  clear(i);
                }}
                className="flex h-9 w-full items-center justify-center truncate rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-1.5 text-[10px] font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]"
              >
                {initials(c.name)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpenIndex(openIndex === i ? null : i);
                  setQ('');
                }}
                className="flex h-9 w-full items-center justify-center rounded-xl border border-dashed border-[var(--panel-line)] text-[var(--panel-muted)] transition hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)]"
                title="Favori müşteri ekle"
              >
                +
              </button>
            )}

            {openIndex === i ? (
              <div className="absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-lg">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={loading ? 'Yükleniyor…' : 'Müşteri ara…'}
                  className="w-full border-b border-[var(--panel-line)] bg-transparent px-2.5 py-2 text-[11px] outline-none"
                  autoFocus
                />
                <ul className="max-h-40 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <li className="px-2.5 py-2 text-[10px] text-[var(--panel-muted)]">
                      {loading ? '…' : 'Sonuç yok'}
                    </li>
                  ) : (
                    filtered.slice(0, 40).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => pick(i, item)}
                          className="w-full truncate px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                        >
                          {item.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
