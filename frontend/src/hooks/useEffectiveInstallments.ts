import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { AccountTypeDef } from '../pages/definitions/accountTypeTypes';

export type InstallmentSource = 'user' | 'cari';

function pickEffective(
  order: InstallmentSource[],
  sources: { user: number[] | null; cari: number[] | null },
): number[] | null {
  for (const key of order) {
    const list = sources[key];
    if (list != null && list.length > 0) return list;
  }
  return null;
}

/**
 * Sıralama ayarına göre etkili taksit listesi.
 * null = kısıt yok (hepsi serbest).
 */
export function useEffectiveInstallments(accountTypeId?: number | null) {
  const { token, user } = useAuth();
  const [order, setOrder] = useState<InstallmentSource[]>(['user', 'cari']);
  const [cariInstallments, setCariInstallments] = useState<number[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const pri = await api.get<{ order: InstallmentSource[] }>(
        '/api/settings/installment-priority',
        token,
      );
      if (Array.isArray(pri.order) && pri.order.length) setOrder(pri.order);
    } catch {
      /* varsayılan */
    }

    if (accountTypeId != null && Number.isFinite(accountTypeId)) {
      try {
        const list = await api.get<AccountTypeDef[]>('/api/account-types', token);
        const hit = list.find((t) => t.id === String(accountTypeId));
        const inst = hit?.installments?.length ? hit.installments : null;
        setCariInstallments(inst);
      } catch {
        setCariInstallments(null);
      }
    } else {
      setCariInstallments(null);
    }
  }, [token, accountTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const userInstallments =
    user?.installments?.length ? user.installments : null;

  const allowed = useMemo(
    () => pickEffective(order, { user: userInstallments, cari: cariInstallments }),
    [order, userInstallments, cariInstallments],
  );

  return { allowed, order, reload: load };
}
