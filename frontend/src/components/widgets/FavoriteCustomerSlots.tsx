import { useEffect, useMemo, useRef, useState } from 'react';

export type FavCustomer = { id: string; name: string };

const STORAGE_KEY = 'anypay_tahsilat_fav_customers';
const SLOT_COUNT = 3;

const MOCK_CUSTOMERS: FavCustomer[] = [
  { id: '1', name: 'Anadolu Market A.Ş.' },
  { id: '2', name: 'Güzel Teknoloji' },
  { id: '3', name: 'Mavi Deniz Ltd.' },
  { id: '4', name: 'Ege Yazılım' },
  { id: '5', name: 'Karadeniz Lojistik' },
  { id: '6', name: 'Atlas Perakende' },
  { id: '7', name: 'Nilüfer Gıda' },
  { id: '8', name: 'App Test Müşteri' },
];

function readSlots(): (FavCustomer | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

/** Haftalık kart altı — favori müşteri yuvaları */
export function FavoriteCustomerSlots() {
  const [slots, setSlots] = useState<(FavCustomer | null)[]>(() =>
    typeof window === 'undefined' ? Array(SLOT_COUNT).fill(null) : readSlots(),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

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

  const filtered = useMemo(() => {
    const taken = new Set(slots.filter(Boolean).map((s) => s!.id));
    const qq = q.trim().toLocaleLowerCase('tr');
    return MOCK_CUSTOMERS.filter((c) => !taken.has(c.id) && (!qq || c.name.toLocaleLowerCase('tr').includes(qq)));
  }, [q, slots]);

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
                title={`${c.name} — sağ tık: kaldır`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
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
              <div className="absolute bottom-[calc(100%+6px)] left-1/2 z-40 w-[220px] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-2 shadow-[var(--panel-shadow)]">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Müşteri ara…"
                  className="mb-1.5 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1.5 text-xs text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
                />
                <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="px-2 py-2 text-[11px] text-[var(--panel-muted)]">Sonuç yok</li>
                  ) : (
                    filtered.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => pick(i, m)}
                          className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                        >
                          {m.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {c ? (
                  <button
                    type="button"
                    onClick={() => clear(i)}
                    className="mt-1 w-full rounded-lg px-2 py-1 text-[10px] text-rose-500 hover:bg-rose-500/10"
                  >
                    Kaldır
                  </button>
                ) : null}
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
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
