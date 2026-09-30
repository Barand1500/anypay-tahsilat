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

type Props = {
  amount: number;
  preferredBankId?: string | null;
  onClose: () => void;
  allowedInstallments?: number[] | null;
  musteriId?: number | null;
  agreementCode?: string | null;
  onPick?: (bank: BankInfo, installment: number) => void;
};

/** Taksit karşılaştırma — Esc / X; oranlar kart anlaşmasından */
export function InstallmentOptionsModal({
  amount,
  preferredBankId,
  onClose,
  allowedInstallments,
  musteriId,
  agreementCode,
}: Props) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [segment, setSegment] = useState<CardSegment>("tumu");
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [rowsByBank, setRowsByBank] = useState<
    Record<string, InstallmentRow[]>
  >({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesRequestKey, setRatesRequestKey] = useState("");
  const bankIds = banks.map((b) => b.id).join("|");
  const rateKey = `${amount}|${segment}|${agreementCode ?? ""}|${musteriId ?? ""}|${bankIds}`;

  useEffect(() => {
    let cancelled = false;
    async function loadBanks() {
      if (!token) {
        setBanks([]);
        setBanksLoading(false);
        return;
      }
      setBanksLoading(true);
      try {
        const list = await api.get<{ id: string; name: string; logo: string }[]>(
          "/api/payments/banks",
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
  }, [token, preferredBankId]);

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
      if (banksLoading) return;
      if (!amount || amount <= 0) {
        setRowsByBank({});
        setRatesLoading(false);
        setRatesRequestKey(rateKey);
        return;
      }
      setRatesLoading(true);
      const next: Record<string, InstallmentRow[]> = {};
      await Promise.all(
        banks.map(async (bank) => {
          if (!token) {
            next[bank.id] = [];
            return;
          }
          try {
            const q = new URLSearchParams();
            q.set("amount", String(amount));
            // Serbest ödeme tabloda tüm kartlar için geçerli oranları kullanır.
            q.set("segment", segment === "serbest" ? "tumu" : segment);
            q.set("bankName", bank.fullName || bank.name);
            q.set("bankId", bank.id);
            if (agreementCode) q.set("code", agreementCode);
            if (musteriId != null) q.set("musteriId", String(musteriId));
            const data = await api.get<{ rows: InstallmentRow[] }>(
              `/api/card-agreements/rates?${q}`,
              token,
            );
            next[bank.id] = data.rows ?? [];
          } catch {
            next[bank.id] = [];
          }
        }),
      );
      if (!cancelled) {
        setRowsByBank(next);
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
    segment,
    token,
    agreementCode,
    musteriId,
    banksLoading,
    rateKey,
  ]);

  const currentRatesLoading = banksLoading || ratesLoading || ratesRequestKey !== rateKey;

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
                Banka bazlı uygulanan taksit bilgileri
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-[var(--panel-line)] p-0.5">
                {(
                  [
                    ["tumu", "Tümü"],
                    ["bireysel", "Bireysel"],
                    ["ticari", "Ticari"],
                    ["serbest", "Serbest ödeme"],
                  ] as const
                ).map(([k, label]) => (
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
                    {label}
                  </button>
                ))}
              </div>
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
          ) : null}
          {!currentRatesLoading && banks.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {banks.filter((bank) => (rowsByBank[bank.id] ?? []).length > 0).map((bank) => {
              const rows = rowsByBank[bank.id] ?? [];
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
                      <col className="w-[14%]" />
                      <col className="w-[18%]" />
                      <col className="w-[26%]" />
                      <col className="w-[28%]" />
                      {showMinLimit ? <col className="w-[14%]" /> : null}
                    </colgroup>
                    <thead>
                      <tr className="text-[9px] uppercase leading-tight tracking-wide text-[var(--panel-muted)] sm:text-[10px]">
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Taksit
                        </th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Komisyon
                        </th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Taksit
                          <br />
                          tutarı
                        </th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Toplam
                          <br />
                          tutar
                        </th>
                        {showMinLimit ? (
                          <th className="px-2 py-2 text-right font-semibold sm:px-3">
                            Taksit Alt
                            <br />
                            Limiti
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const ok =
                          !allowedInstallments?.length ||
                          allowedInstallments.includes(r.n);
                        return (
                          <tr
                            key={r.n}
                            title={ok ? undefined : "Size atanmadı"}
                            className={[
                              "border-t border-[var(--panel-line)]/80",
                              ok
                                ? "hover:bg-[var(--panel-hover)]/50"
                                : "cursor-not-allowed opacity-45",
                            ].join(" ")}
                          >
                            <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--panel-ink)] sm:px-3">
                              {r.plusN > 0 ? `${r.n}+${r.plusN}` : r.n}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-3">
                              % {formatMoneyTr(r.commissionPct)}
                            </td>
                            <td className="px-2 py-2 text-right font-medium tabular-nums text-[var(--panel-ink)] sm:px-3">
                              {formatMoneyDisplay(r.installmentAmount)}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--panel-ink)] sm:px-3">
                              {formatMoneyDisplay(r.totalAmount)}
                            </td>
                            <td hidden={!showMinLimit} className="px-2 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-3">
                              {ok
                                ? r.minLimit > 0
                                  ? formatMoneyDisplay(r.minLimit)
                                  : "—"
                                : "Size atanmadı"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
          )}
          {!currentRatesLoading && banks.length > 0 &&
          banks.every((bank) => (rowsByBank[bank.id] ?? []).length === 0) ? (
            <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Bu tutar ve müşteri grubu için tanımlı taksit seçeneği bulunamadı.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}



