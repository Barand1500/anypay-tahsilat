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
 * Kart anlaşmasından taksit oranları. Anlaşma yoksa sessizce örnek oran üretmez.
 */
export function useAgreementRates(opts: {
  amount: number;
  bankName?: string | null;
  bankId?: string | null;
  musteriId?: number | null;
  agreementCode?: string | null;
  segment?: CardSegment;
}) {
  const { token } = useAuth();
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const segment = opts.segment || 'bireysel';
  const amount = opts.amount;

  const load = useCallback(async () => {
    if (!amount || amount <= 0) {
      setRows([]);
      return;
    }
    if (!token) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('amount', String(amount));
      q.set('segment', segment);
      if (opts.agreementCode) q.set('code', opts.agreementCode);
      if (opts.musteriId != null) q.set('musteriId', String(opts.musteriId));
      if (opts.bankName) q.set('bankName', opts.bankName);
      if (opts.bankId && /^\d+$/.test(opts.bankId)) q.set('bankId', opts.bankId);

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
    opts.agreementCode,
    opts.musteriId,
    opts.bankName,
    opts.bankId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, reload: load };
}
