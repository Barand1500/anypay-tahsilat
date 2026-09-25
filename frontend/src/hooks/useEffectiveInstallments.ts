import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { AccountTypeDef } from '../pages/definitions/accountTypeTypes';
import type { BranchDef } from '../pages/definitions/branchTypes';

export type InstallmentSource = 'user' | 'cari' | 'sube';

function pickEffective(
  order: InstallmentSource[],
  sources: { user: number[] | null; cari: number[] | null; sube: number[] | null },
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
  const [order, setOrder] = useState<InstallmentSource[]>(['user', 'cari', 'sube']);
  const [cariInstallments, setCariInstallments] = useState<number[] | null>(null);
  const [subeInstallments, setSubeInstallments] = useState<number[] | null>(null);

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

    const primaryBranchId = user?.branchIds?.[0];
    if (primaryBranchId != null) {
      try {
        const list = await api.get<BranchDef[]>('/api/branches', token);
        const hit = list.find((b) => b.id === String(primaryBranchId));
        const inst = hit?.installments?.length ? hit.installments : null;
        setSubeInstallments(inst);
      } catch {
        setSubeInstallments(null);
      }
    } else {
      setSubeInstallments(null);
    }
  }, [token, accountTypeId, user?.branchIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const userInstallments =
    user?.installments?.length ? user.installments : null;

  const allowed = useMemo(
    () =>
      pickEffective(order, {
        user: userInstallments,
        cari: cariInstallments,
        sube: subeInstallments,
      }),
    [order, userInstallments, cariInstallments, subeInstallments],
  );

  return { allowed, order, reload: load };
}
