import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import {
  BANKS,
  formatMoneyTr,
  formatMoneyDisplay,
  type BankInfo,
  type CardSegment,
  type InstallmentRow,
} from "./mockBanks";
import { formatInstallmentExtraHint, InstallmentBadge } from "./installmentDisplay";

type Props = {
  amount: number;
  preferredBankId?: string | null;
  onClose: () => void;
  allowedInstallments?: number[] | null;
  musteriId?: number | null;
  agreementCode?: string | null;
  agreementScope?: 'customer' | 'pos';
  /** Public ödeme linki — auth olmadan karşılaştırma */
  publicToken?: string | null;
  onPick?: (bank: BankInfo, installment: number) => void;
};
type VisibleSegment = Exclude<CardSegment, 'serbest'>;

/** Mevcut sekme geçerliyse koru; değilse bireysel, yoksa ilk segment */
function preferSegment(ordered: VisibleSegment[], current?: VisibleSegment): VisibleSegment {
  if (current && ordered.includes(current)) return current;
  if (ordered.includes('bireysel')) return 'bireysel';
  return ordered[0]!;
}

/** Taksit karşılaştırma — Esc / X; oranlar kart anlaşmasından */
export function InstallmentOptionsModal({
  amount,
  preferredBankId,
  onClose,
  allowedInstallments,
  musteriId,
  agreementCode,
  agreementScope = 'customer',
  publicToken = null,
}: Props) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [segment, setSegment] = useState<VisibleSegment>("bireysel");
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [rowsBySegment, setRowsBySegment] = useState<Record<VisibleSegment, Record<string, InstallmentRow[]>>>(
    { tumu: {}, bireysel: {}, ticari: {} },
  );
  const [availableSegments, setAvailableSegments] = useState<VisibleSegment[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesRequestKey, setRatesRequestKey] = useState("");
  const bankIds = banks.map((b) => b.id).join("|");
  const rateKey = publicToken
    ? `public|${publicToken}|${amount}`
    : `${amount}|${agreementCode ?? ""}|${musteriId ?? ""}|${agreementScope}|${bankIds}`;

  useEffect(() => {
    let cancelled = false;
    async function loadBanks() {
      // Public link: bankalar installment-options cevabından gelir
      if (publicToken) {
        setBanksLoading(false);
        return;
      }
      if (!token) {
        setBanks([]);
        setBanksLoading(false);
        return;
      }
      setBanksLoading(true);
      try {
        const list = await api.get<{ id: string; name: string; logo: string }[]>(
          "/api/payments/banks?excludeRedirected=1",
          token,
        );
        if (!cancelled) {
          const preferred = BANKS.find((item) => item.id === preferredBankId);
          const mapped = list.map((bank) => ({
            id: bank.id,
            name: bank.name,
            fullName: bank.name,
            logo: bank.logo || preferred?.logo || "",
            bins: [],
          }));
          const preferredName = preferred?.name.toLocaleLowerCase("tr");
          if (preferredName) {
            mapped.sort((a, b) =>
              Number(b.name.toLocaleLowerCase("tr").includes(preferredName)) -
              Number(a.name.toLocaleLowerCase("tr").includes(preferredName)),
            );
          }
          setBanks(mapped);
        }
      } catch {
        if (!cancelled) setBanks([]);
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    }
    void loadBanks();
    return () => {
      cancelled = true;
    };
  }, [token, preferredBankId, publicToken]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!amount || amount <= 0) {
        setRowsBySegment({ tumu: {}, bireysel: {}, ticari: {} });
        setAvailableSegments([]);
        setRatesLoading(false);
        setRatesRequestKey(rateKey);
        return;
      }

      // Public ödeme — tek endpoint (banksLoading set etme → efekt döngüsü olmasın)
      if (publicToken) {
        setRatesLoading(true);
        try {
          const q = new URLSearchParams({ amount: String(amount) });
          const data = await api.get<{
            banks: { id: string; name: string; logo: string }[];
            rowsBySegment: Record<VisibleSegment, Record<string, InstallmentRow[]>>;
            availableSegments: VisibleSegment[];
          }>(`/api/pay/${encodeURIComponent(publicToken)}/installment-options?${q}`);
          if (cancelled) return;
          const preferred = BANKS.find((item) => item.id === preferredBankId);
          const preferredName = preferred?.name.toLocaleLowerCase("tr");
          const mapped = (data.banks ?? []).map((bank) => {
            const catalog = BANKS.find(
              (b) =>
                b.id === bank.id ||
                b.name.toLocaleLowerCase("tr") === bank.name.toLocaleLowerCase("tr") ||
                bank.name.toLocaleLowerCase("tr").includes(b.name.toLocaleLowerCase("tr")),
            );
            return {
              id: bank.id,
              name: bank.name,
              fullName: bank.name,
              logo: bank.logo || catalog?.logo || "",
              bins: [] as string[],
            };
          });
          if (preferredName) {
            mapped.sort(
              (a, b) =>
                Number(b.name.toLocaleLowerCase("tr").includes(preferredName)) -
                Number(a.name.toLocaleLowerCase("tr").includes(preferredName)),
            );
          }
          setBanks(mapped);
          setRowsBySegment({
            tumu: data.rowsBySegment?.tumu ?? {},
            bireysel: data.rowsBySegment?.bireysel ?? {},
            ticari: data.rowsBySegment?.ticari ?? {},
          });
          const ordered = (["tumu", "bireysel", "ticari"] as const).filter((key) =>
            (data.availableSegments ?? []).includes(key),
          );
          setAvailableSegments(ordered);
          if (ordered.length) {
            setSegment((current) => preferSegment(ordered, current));
          }
        } catch {
          if (!cancelled) {
            setBanks([]);
            setRowsBySegment({ tumu: {}, bireysel: {}, ticari: {} });
            setAvailableSegments([]);
          }
        } finally {
          if (!cancelled) {
            setRatesLoading(false);
            setRatesRequestKey(rateKey);
          }
        }
        return;
      }

      if (banksLoading) return;
      if (!token) {
        setRowsBySegment({ tumu: {}, bireysel: {}, ticari: {} });
        setAvailableSegments([]);
        setRatesLoading(false);
        setRatesRequestKey(rateKey);
        return;
      }
      setRatesLoading(true);
      const next: Record<VisibleSegment, Record<string, InstallmentRow[]>> = { tumu: {}, bireysel: {}, ticari: {} };
      const nextSegments = new Set<VisibleSegment>();
      await Promise.all(
        banks.map(async (bank) => {
          try {
            const q = new URLSearchParams();
            q.set("amount", String(amount));
            q.set("segment", "tumu");
            q.set("bankName", bank.fullName || bank.name);
            q.set("bankId", bank.id);
            q.set("scope", agreementScope);
            q.set("strictSegments", "1");
            if (agreementCode) q.set("code", agreementCode);
            if (musteriId != null) q.set("musteriId", String(musteriId));
            const data = await api.get<{
              rows: InstallmentRow[];
              rowsBySegment?: Record<VisibleSegment, InstallmentRow[]>;
              availableSegments?: VisibleSegment[];
            }>(
              `/api/card-agreements/rates?${q}`,
              token,
            );
            for (const key of ["tumu", "bireysel", "ticari"] as const) {
              next[key][bank.id] = data.rowsBySegment?.[key] ?? (key === 'tumu' ? data.rows ?? [] : []);
            }
            data.availableSegments?.forEach((key) => nextSegments.add(key));
          } catch {
            for (const key of ["tumu", "bireysel", "ticari"] as const) next[key][bank.id] = [];
          }
        }),
      );
      if (!cancelled) {
        setRowsBySegment(next);
        const orderedSegments = (["tumu", "bireysel", "ticari"] as const).filter((key) => nextSegments.has(key));
        setAvailableSegments(orderedSegments);
        if (orderedSegments.length) {
          setSegment((current) => preferSegment(orderedSegments, current));
        }
        setRatesLoading(false);
        setRatesRequestKey(rateKey);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    amount,
    token,
    publicToken,
    preferredBankId,
    agreementCode,
    agreementScope,
    musteriId,
    // Public modda banksLoading değişimi isteği iptal etmesin
    publicToken ? null : banksLoading,
    rateKey,
  ]);

  const currentRatesLoading =
    (!publicToken && banksLoading) || ratesLoading || ratesRequestKey !== rateKey;
  const visibleSegments = currentRatesLoading ? [] : availableSegments;
  const rowsByBank = rowsBySegment[segment];

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="taksit-title"
        className="relative z-10 flex h-[min(82vh,740px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="shrink-0 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="taksit-title"
                className="text-lg font-bold leading-tight text-[var(--panel-ink)]"
              >
                Taksit Seçenekleri
              </h2>
              <p className="text-xs text-[var(--panel-muted)]">
                Banka bazlı taksit seçeneklerini karşılaştırın. Taksit tutarları, toplam tutarlar ve varsa taksit alt limitleri görüntülenir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {visibleSegments.length > 0 ? <div className="flex rounded-xl border border-[var(--panel-line)] p-0.5">
                {visibleSegments.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSegment(k)}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      segment === k
                        ? "bg-[var(--color-brand-600)] text-white"
                        : "text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]",
                    ].join(" ")}
                  >
                    {k === "tumu" ? "Tümü" : k === "bireysel" ? "Bireysel" : "Ticari"}
                  </button>
                ))}
              </div> : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                aria-label="Kapat"
              >
                <span className="text-base leading-none">X</span>
                ESC
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          {banksLoading || currentRatesLoading ? (
            <div className="grid gap-4 xl:grid-cols-2" aria-label="Taksit seçenekleri yükleniyor">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-[var(--panel-line)] bg-[var(--panel-hover)]/60" />)}</div>
          ) : banks.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Gösterilecek taksit seçeneği bulunamadı.</p>
          ) : ratesLoading ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Taksit seçenekleri yükleniyor…</p>
          ) : availableSegments.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Bu tutar için etkin taksit anlaşması bulunamadı.</p>
          ) : null}
          {!currentRatesLoading && banks.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {banks
              .map((bank) => {
                const allRows = rowsByBank[bank.id] ?? [];
                const rows = !allowedInstallments?.length
                  ? allRows
                  : allRows.filter((r) => allowedInstallments.includes(r.n));
                return { bank, rows };
              })
              .filter(({ rows }) => rows.length > 0)
              .map(({ bank, rows }) => {
              const showMinLimit = rows.some((r) => r.minLimit > 0);
              return (
                <article
                  key={bank.id}
                  className="overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]"
                >
                  <div className="flex items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5">
                    <img
                      src={bank.logo}
                      alt=""
                      className="h-8 w-auto max-w-[120px] shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1 text-right text-sm font-bold leading-snug text-[var(--panel-ink)]">
                      {bank.fullName}
                    </span>
                  </div>
                  <table className="w-full table-fixed text-left text-[11px] sm:text-[12px]">
                    <colgroup>
                      <col className={showMinLimit ? "w-[11%]" : "w-[14%]"} />
                      <col className={showMinLimit ? "w-[15%]" : "w-[18%]"} />
                      <col className={showMinLimit ? "w-[23%]" : "w-[26%]"} />
                      <col className={showMinLimit ? "w-[25%]" : "w-[28%]"} />
                      {showMinLimit ? <col className="w-[26%]" /> : null}
                    </colgroup>
                    <thead>
                      <tr className="text-[9px] uppercase leading-tight tracking-wide text-[var(--panel-muted)] sm:text-[10px]">
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold sm:px-3">
                          Taksit
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold sm:px-3">
                          Komisyon
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold sm:px-3">
                          Taksit tutarı
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold sm:px-3">
                          Toplam tutar
                        </th>
                        {showMinLimit ? (
                          <th className="px-1.5 py-2 text-right font-semibold leading-tight sm:px-2">
                            {/* Yer varsa tek satır; daralınca iki satıra kırılır — ₺ tutarla hep yan yana */}
                            <span className="inline-block max-w-full text-right [text-wrap:balance]">
                              Taksit Alt Limiti
                            </span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                          <tr
                            key={r.n}
                            className="border-t border-[var(--panel-line)]/80 hover:bg-[var(--panel-hover)]/50"
                          >
                            <td className="px-2 py-2 text-right sm:px-3">
                              <InstallmentBadge n={r.n} plusN={r.plusN} className="text-sm sm:text-[13px]" />
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-3">
                              % {formatMoneyTr(r.commissionPct)}
                            </td>
                            <td className="px-2 py-2 text-right sm:px-3">
                              <p className="font-medium tabular-nums text-[var(--panel-ink)]">
                                {formatMoneyDisplay(r.installmentAmount)}
                              </p>
                              {formatInstallmentExtraHint(r.n, r.plusN) ? (
                                <p className="mt-0.5 text-[9px] font-semibold leading-tight text-[var(--color-brand-600)]">
                                  {formatInstallmentExtraHint(r.n, r.plusN)}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--panel-ink)] sm:px-3">
                              {formatMoneyDisplay(r.totalAmount)}
                            </td>
                            {showMinLimit ? (
                              <td className="px-1.5 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-2">
                                {r.minLimit > 0 ? (
                                  <span className="whitespace-nowrap">
                                    {formatMoneyTr(r.minLimit)} ₺
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
          )}
          {!currentRatesLoading && banks.length > 0 &&
          banks.every((bank) => {
            const all = rowsByBank[bank.id] ?? [];
            const visible = !allowedInstallments?.length
              ? all
              : all.filter((r) => allowedInstallments.includes(r.n));
            return visible.length === 0;
          }) ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Bu tutar ve müşteri grubu için tanımlı taksit seçeneği bulunamadı.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}



