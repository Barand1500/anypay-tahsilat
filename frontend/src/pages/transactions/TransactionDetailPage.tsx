import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  formatMoneyDisplay,
  formatTxDate,
  TX_STATUS_LABEL,
  type Transaction,
} from './transactionTypes';

type CustomerInfo = { title?: string; phone?: string; taxNo?: string; identityNo?: string };

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(12px,auto)_minmax(0,2fr)] gap-1 text-sm">
      <strong className="text-[var(--panel-ink)]/80">{label}</strong>
      <span>:</span>
      <span className="min-w-0 break-words text-[var(--panel-ink)]">{value || '—'}</span>
    </div>
  );
}

function Section({ title, children, className = '' }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] ${className}`}>
      <h2 className="mb-5 text-base font-semibold text-[var(--panel-ink)]">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export default function TransactionDetailPage() {
  const { id = '' } = useParams();
  const { token } = useAuth();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !id) return;
      setLoading(true);
      setError('');
      try {
        const data = await api.get<Transaction>(`/api/payments/${encodeURIComponent(id)}`, token);
        if (cancelled) return;
        setTx(data);
        if (data.customerId) {
          try {
            const customerData = await api.get<CustomerInfo>(`/api/customers/${encodeURIComponent(data.customerId)}`, token);
            if (!cancelled) setCustomer(customerData);
          } catch {
            if (!cancelled) setCustomer(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Hareket detayı yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token, id]);

  if (loading) return <div className="py-12 text-center text-sm text-[var(--panel-muted)]">Hareket detayı yükleniyor…</div>;
  if (!tx && error) return (
    <div className="space-y-4">
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">{error}</p>
      <Link to="/hareketler" className="text-sm font-semibold text-[var(--color-brand-600)]">← Hareketlere dön</Link>
    </div>
  );
  if (!tx) return <Navigate to="/hareketler" replace />;

  const date = tx.at ? formatTxDate(tx.at) : '—';
  const installmentLabel = tx.installments <= 1 ? 'Tek Çekim' : `${tx.installments} Taksit`;
  const total = tx.amount + tx.commission;

  return (
    <div className="space-y-3 pb-8">
      <nav className="text-sm text-[var(--panel-ink)]/70">
        <Link to="/" className="hover:text-[var(--color-brand-600)]">Anasayfa</Link>
        <span className="mx-2 opacity-50">›</span>
        <Link to="/hareketler" className="hover:text-[var(--color-brand-600)]">Hareketler</Link>
        <span className="mx-2 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">Hareket Detayı</span>
      </nav>

      <Section title="Müşteri Detayı">
        <Value label="Müşteri Ünvanı" value={customer?.title || tx.customerTitle} />
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Tahsilat Bilgileri">
          <Value label="Ad Soyad" value={tx.dekont.cardHolderName} />
          <Value label="T.C. Kimlik No" value={tx.dekont.identityNo} />
          <Value label="Telefon" value={tx.dekont.cardHolderPhoneMasked} />
          <Value label="Tutar" value={formatMoneyDisplay(tx.amount)} />
          <Value label="Komisyon" value={formatMoneyDisplay(tx.commission)} />
          <Value label="Komisyonlu Tutar" value={formatMoneyDisplay(total)} />
        </Section>

        <Section title="Ödeme Bilgileri">
          <Value label="Taksit" value={installmentLabel} />
          <Value label="Müşteri Komisyonu" value={`% ${formatMoneyDisplay(tx.detail.customerCommission)}`} />
          <Value label="Banka Komisyonu" value={`% ${formatMoneyDisplay(tx.detail.bankCommission)}`} />
          <Value label="Puan" value="0" />
          <Value label="Ek Taksit" value="0" />
          <Value label="Ödendi" value={tx.status === 'paid' ? 'Evet' : TX_STATUS_LABEL[tx.status]} />
        </Section>

        <Section title="Banka Bilgileri">
          <Value label="Banka Adı" value={tx.bankName} />
          <Value label="Tahsil Günü" value={tx.detail.collectionDay} />
          <Value label="Bloke Günü" value={tx.detail.blockDay} />
          <Value label="IP" value={tx.detail.ip} />
          <Value label="Oluşturulma Tarihi" value={date} />
        </Section>

        <Section title="Onay Bilgileri">
          <Value label="Onay Zamanı" value={date} />
          <Value label="İşlem No" value={tx.id} />
          <Value label="Referans Kodu" value={tx.detail.referenceNo} />
          <Value label="Onay Kodu" value={tx.detail.authCode} />
          <Value label="Kart No" value={tx.dekont.cardMasked} />
        </Section>
      </div>

      <Section title="HAREKETLER" className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--panel-line)] text-[11px] font-semibold uppercase text-[var(--panel-muted)]">
                <th className="px-4 py-3">İşlem Zamanı</th><th className="px-4 py-3">İşlem</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3 text-right">Tutar</th><th className="px-4 py-3">İşlem No</th><th className="px-4 py-3">Referans No</th><th className="px-4 py-3">Onay Kodu</th>
              </tr>
            </thead>
            <tbody>
              {tx.detail.operationHistory.map((entry, index) => (
                <tr key={`${entry.at}-${index}`} className="border-b border-[var(--panel-line)] last:border-0">
                  <td className="px-4 py-3">{formatTxDate(entry.at)}</td>
                  <td className="px-4 py-3 text-sky-600">{entry.operation}</td>
                  <td className="px-4 py-3 text-emerald-600">{entry.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoneyDisplay(entry.amount)}</td>
                  <td className="px-4 py-3">{tx.id}</td>
                  <td className="px-4 py-3">{entry.referenceNo || '—'}</td>
                  <td className="px-4 py-3">{entry.authCode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
