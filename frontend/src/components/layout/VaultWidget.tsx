import gsap from 'gsap';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { VaultAuthLayer, VaultSetPasswordModal } from './VaultAuthModals';
import {
  tagClass,
  tagColorFor,
  VAULT_TAGS,
  vaultFetch,
  useVault,
  type VaultEntry,
} from './VaultContext';

const PANEL_W = 360;
const PANEL_H = 480;

/** Yüzen kasa widget + dock chip’ler */
export function VaultHost() {
  const { open, closing, unlocked, finishClose } = useVault();

  // Kilitliyken panel yok → kapanış animasyonu atlanır
  useEffect(() => {
    if (closing && !unlocked) finishClose();
  }, [closing, unlocked, finishClose]);

  return (
    <>
      <VaultAuthLayer />
      {open && unlocked ? <VaultFloatPanel /> : null}
    </>
  );
}

/** Header / footer’a yapışık küçük kasa düğmesi */
export function VaultDockChip({ place }: { place: 'header' | 'footer' }) {
  const { open, dock, openVault, closeVault, unlocked } = useVault();
  if (!open || dock !== place) return null;

  return (
    <button
      type="button"
      data-vault-dock={place}
      title="Kasa"
      onClick={() => {
        if (unlocked) closeVault();
        else openVault();
      }}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] text-amber-700 transition hover:border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-300"
    >
      <SafeIcon />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(0,0,0,0.12)]" />
    </button>
  );
}

function VaultFloatPanel() {
  const { token } = useAuth();
  const {
    dock,
    pos,
    setPos,
    setDock,
    closing,
    closeVault,
    finishClose,
    sidebarBtnRef,
    entries,
    loadingEntries,
    reloadEntries,
    unlockToken,
    hasPassword,
  } = useVault();

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tip, setTip] = useState('iban');
  const [customTag, setCustomTag] = useState('');
  const [baslik, setBaslik] = useState('');
  const [deger, setDeger] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Açılış animasyonu
  useEffect(() => {
    const el = panelRef.current;
    if (!el || dock !== 'float') return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, scale: 0.86, y: 24 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.38, ease: 'power3.out' },
    );
  }, [dock]);

  // Kapanış → sidebar butonuna uç
  useEffect(() => {
    if (!closing) return;
    const el = panelRef.current;
    const btn = sidebarBtnRef.current;
    if (!el) {
      finishClose();
      return;
    }
    const from = el.getBoundingClientRect();
    const to = btn?.getBoundingClientRect();
    const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : -120;
    const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : 80;
    gsap.to(el, {
      x: dx,
      y: dy,
      scale: 0.15,
      autoAlpha: 0,
      duration: 0.42,
      ease: 'power2.in',
      onComplete: finishClose,
    });
  }, [closing, finishClose, sidebarBtnRef]);

  function onDragStart(e: ReactPointerEvent) {
    if (dock !== 'float') return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  }

  function onDragMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const nx = d.px + (e.clientX - d.ox);
    const ny = d.py + (e.clientY - d.oy);
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, nx)),
      y: Math.max(8, Math.min(window.innerHeight - 120, ny)),
    });
  }

  function onDragEnd(e: ReactPointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    const y = e.clientY;
    if (y < 72) {
      setDock('header');
      return;
    }
    if (y > window.innerHeight - 72) {
      setDock('footer');
      return;
    }
    setDock('float');
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const preset = VAULT_TAGS.find((t) => t.tip === tip);
    const etiket = tip === 'ozel' ? customTag.trim() || 'Özel' : preset?.etiket || tip;
    setBusy(true);
    setErr('');
    try {
      await vaultFetch('POST', '/api/vault/entries', token, unlockToken, {
        tip: tip === 'ozel' ? 'ozel' : tip,
        etiket,
        baslik: baslik.trim(),
        deger: deger.trim(),
      });
      setBaslik('');
      setDeger('');
      setCustomTag('');
      setAdding(false);
      await reloadEntries();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!token) return;
    try {
      await vaultFetch('DELETE', `/api/vault/entries/${id}`, token, unlockToken);
      await reloadEntries();
    } catch {
      /* */
    }
  }

  async function copyValue(entry: VaultEntry) {
    try {
      await navigator.clipboard.writeText(entry.deger);
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      /* */
    }
  }

  // Header / footer’a yapışıkken sağda yüzen panel
  const dockedStyle =
    dock === 'header'
      ? { top: 72, right: 16, left: 'auto' as const }
      : dock === 'footer'
        ? { bottom: 72, right: 16, top: 'auto' as const, left: 'auto' as const }
        : { left: pos.x, top: pos.y };

  const isFloat = dock === 'float';

  return createPortal(
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Kasa"
        style={{
          ...dockedStyle,
          width: PANEL_W,
          maxHeight: PANEL_H,
          ...(isFloat ? {} : { position: 'fixed' }),
        }}
        className={[
          'fixed z-[11500] flex flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_20px_50px_rgba(0,0,0,0.22)]',
        ].join(' ')}
      >
        <header
          onPointerDown={isFloat ? onDragStart : undefined}
          onPointerMove={isFloat ? onDragMove : undefined}
          onPointerUp={isFloat ? onDragEnd : undefined}
          className={[
            'flex items-center gap-2 border-b border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--color-brand-500)_8%,var(--panel-elevated))] px-3 py-2.5',
            isFloat ? 'cursor-grab active:cursor-grabbing' : '',
          ].join(' ')}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <SafeIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--panel-ink)]">Kasa</p>
            <p className="truncate text-[10px] text-[var(--panel-muted)]">
              {isFloat ? 'Sürükle · üste/alta yapıştır' : dock === 'header' ? 'Header’da sabit' : 'Footer’da sabit'}
            </p>
          </div>
          <button
            type="button"
            title={hasPassword ? 'Şifre ayarları' : 'Şifre koy'}
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <GearIcon />
          </button>
          {!isFloat ? (
            <button
              type="button"
              title="Serbest bırak"
              onClick={() => {
                setDock('float');
                setPos({
                  x: Math.max(16, window.innerWidth - PANEL_W - 24),
                  y: dock === 'header' ? 88 : Math.max(88, window.innerHeight - PANEL_H - 88),
                });
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            >
              <UnpinIcon />
            </button>
          ) : null}
          <button
            type="button"
            title="Kapat"
            onClick={closeVault}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {loadingEntries ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
          ) : entries.length === 0 && !adding ? (
            <div className="rounded-xl border border-dashed border-[var(--panel-line)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--panel-ink)]">Kasa boş</p>
              <p className="mt-1 text-xs text-[var(--panel-muted)]">
                IBAN, kart veya kendi etiketinizle ekleyin
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const color = tagColorFor(entry.tip);
              const show = revealed[entry.id];
              return (
                <article
                  key={entry.id}
                  className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                        tagClass(color),
                      ].join(' ')}
                    >
                      {entry.etiket}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--panel-ink)]">
                      {entry.baslik}
                    </span>
                  </div>
                  <p className="break-all font-mono text-xs text-[var(--panel-ink)]/90">
                    {show ? entry.deger : maskValue(entry.deger)}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <IconBtn
                      title={show ? 'Gizle' : 'Göster'}
                      onClick={() =>
                        setRevealed((m) => ({ ...m, [entry.id]: !m[entry.id] }))
                      }
                    >
                      {show ? <EyeOffIcon /> : <EyeIcon />}
                    </IconBtn>
                    <IconBtn title="Kopyala" onClick={() => void copyValue(entry)}>
                      {copiedId === entry.id ? <CheckIcon /> : <CopyIcon />}
                    </IconBtn>
                    <IconBtn title="Sil" danger onClick={() => void onDelete(entry.id)}>
                      <TrashIcon />
                    </IconBtn>
                  </div>
                </article>
              );
            })
          )}

          {adding ? (
            <form
              onSubmit={(e) => void onAdd(e)}
              className="space-y-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-3"
            >
              <div className="flex flex-wrap gap-1.5">
                {VAULT_TAGS.map((t) => (
                  <button
                    key={t.tip}
                    type="button"
                    onClick={() => setTip(t.tip)}
                    className={[
                      'rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition',
                      tip === t.tip
                        ? tagClass(t.color) + ' ring-2'
                        : 'bg-[var(--panel-elevated)] text-[var(--panel-muted)] ring-[var(--panel-line)]',
                    ].join(' ')}
                  >
                    {t.etiket}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTip('ozel')}
                  className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition',
                    tip === 'ozel'
                      ? tagClass('amber') + ' ring-2'
                      : 'bg-[var(--panel-elevated)] text-[var(--panel-muted)] ring-[var(--panel-line)]',
                  ].join(' ')}
                >
                  Özel
                </button>
              </div>
              {tip === 'ozel' ? (
                <input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="Etiket adı"
                  className="w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-2 text-sm outline-none focus:border-[var(--color-brand-500)]"
                />
              ) : null}
              <input
                required
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                placeholder="Başlık (örn. İş hesabı)"
                className="w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-2 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              <textarea
                required
                value={deger}
                onChange={(e) => setDeger(e.target.value)}
                placeholder="Değer (IBAN / kart no…)"
                rows={2}
                className="w-full resize-none rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-2 font-mono text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              {err ? <p className="text-xs text-rose-500">{err}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="flex-1 rounded-lg border border-[var(--panel-line)] py-2 text-xs font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-[var(--color-brand-600)] py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? '…' : 'Kaydet'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {!adding ? (
          <div className="border-t border-[var(--panel-line)] p-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              <span className="text-lg leading-none">+</span>
              Ekle
            </button>
          </div>
        ) : null}
      </div>

      {settingsOpen ? <VaultSetPasswordModal onClose={() => setSettingsOpen(false)} /> : null}
    </>,
    document.body,
  );
}

function maskValue(v: string) {
  if (v.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-lg transition',
        danger
          ? 'text-[var(--panel-muted)] hover:bg-rose-500/10 hover:text-rose-500'
          : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function SafeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 14.2V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 8h2M15 8h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnpinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 17v4M9 3l6 6M8 14l-4 4M15 3v6h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m4 4 16 16M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9M6.1 6.5C3.8 8.2 2 12 2 12s3.5 7 10 7a11 11 0 0 0 5-.9M10.5 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-1.7 2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
