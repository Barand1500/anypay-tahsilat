import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { CardSegment, InstallmentRow } from '../pages/payments/mockBanks';

type RatesResponse = {
  agreementCode: string | null;
  bankId: number | null;
  bankName: string | null;
  rows: InstallmentRow[];
};

/**
 * Kart anlaşmasından taksit oranları — public /installments ile aynı motor.
 * bin verilirse sunucu BIN’den banka + segment çözer.
 */
export function useAgreementRates(opts: {
  amount: number;
  bankName?: string | null;
  bankId?: string | null;
  bin?: string | null;
  musteriId?: number | null;
  agreementCode?: string | null;
  segment?: CardSegment;
  scope?: 'customer' | 'pos';
}) {
  const { token } = useAuth();
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const segment = opts.segment || 'bireysel';
  const amount = opts.amount;
  const bin = (opts.bin || '').replace(/\D/g, '');

  const load = useCallback(async () => {
    if (!amount || amount <= 0) {
      setRows([]);
      return;
    }
    if (!token) {
      setRows([]);
      return;
    }
    // Public gibi: banka veya yeterli BIN yoksa oran çekme
    if (!bin || bin.length < 6) {
      if (!opts.bankName && !(opts.bankId && /^\d+$/.test(opts.bankId))) {
        setRows([]);
        return;
      }
    }
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('amount', String(amount));
      q.set('segment', segment);
      if (opts.scope) q.set('scope', opts.scope);
      if (opts.agreementCode) q.set('code', opts.agreementCode);
      if (opts.musteriId != null) q.set('musteriId', String(opts.musteriId));
      // Kısa ad tercih (Garanti BBVA); fullName eşleşmesi sunucuda da fuzzy
      if (opts.bankName) q.set('bankName', opts.bankName);
      const bankId = (opts.bankId || '').trim();
      if (bankId && /^\d+$/.test(bankId)) q.set('bankId', bankId);
      if (bin.length >= 6) q.set('bin', bin.slice(0, 8));

      const data = await api.get<RatesResponse>(`/api/card-agreements/rates?${q}`, token);
      if (data.rows?.length) {
        setRows(data.rows);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    token,
    amount,
    segment,
    bin,
    opts.agreementCode,
    opts.musteriId,
    opts.bankName,
    opts.bankId,
    opts.scope,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, reload: load };
}
