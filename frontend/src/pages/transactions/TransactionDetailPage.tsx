import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  formatMoneyDisplay,
  formatTxDate,
  maskCardForDekont,
  maskIdentityForDekont,
  maskPhoneForDekont,
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

/** Saat tarihin yanında; sütunlar eşit pay, aralarındaki boşluk aynı */
const historyGrid =
  'grid grid-cols-[12.5rem_repeat(6,minmax(7.25rem,1fr))] items-center gap-x-8';

/** Tarihin hemen yanında saat — panel fontu, rakamlar hizalı */
function HistoryStamp({ iso }: { iso: string }) {
  const full = formatTxDate(iso);
  const cut = full.lastIndexOf(' ');
  const date = cut > 0 ? full.slice(0, cut) : full;
  const time = cut > 0 ? full.slice(cut + 1) : '';
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap tabular-nums text-[var(--panel-ink)]">
      <span>{date}</span>
      <span className="inline-block w-[4.75rem] text-left">{time}</span>
    </span>
  );
}

function Section({ title, children, className = '', bodyClassName = 'space-y-2.5' }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] ${className}`}>
      <h2 className="mb-5 text-base font-semibold text-[var(--panel-ink)]">{title}</h2>
      <div className={bodyClassName}>{children}</div>
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
          <Value label="T.C. Kimlik No" value={maskIdentityForDekont(tx.dekont.identityNo)} />
          <Value label="Telefon" value={maskPhoneForDekont(tx.dekont.cardHolderPhoneMasked)} />
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
          <Value label="Kart No" value={maskCardForDekont(tx.dekont.cardMasked)} />
          <Value label="Kart Markası" value={tx.dekont.cardBrand || '—'} />
          <Value label="Kart Türü" value={tx.dekont.cardSegment || '—'} />
        </Section>
      </div>

      <Section title="Hareketler" bodyClassName="">
        <div className="overflow-x-auto">
          <div className="min-w-[920px] text-sm">
            <div
              className={`${historyGrid} border-b border-[var(--panel-line)] pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]`}
            >
              <span className="whitespace-nowrap">İşlem Zamanı</span>
              <span className="whitespace-nowrap">İşlem</span>
              <span className="whitespace-nowrap">Durum</span>
              <span className="whitespace-nowrap">Tutar</span>
              <span className="whitespace-nowrap">İşlem No</span>
              <span className="whitespace-nowrap">Referans No</span>
              <span className="whitespace-nowrap">Onay Kodu</span>
            </div>
            {tx.detail.operationHistory.length === 0 ? (
              <p className="py-4 text-[var(--panel-muted)]">Henüz işlem kaydı yok.</p>
            ) : (
              tx.detail.operationHistory.map((entry, index) => (
                <div
                  key={`${entry.operation}-${entry.at}-${index}`}
                  className={`${historyGrid} border-b border-[var(--panel-line)]/70 py-3 last:border-0`}
                >
                  <HistoryStamp iso={entry.at} />
                  <span className="whitespace-nowrap font-semibold text-sky-600">{entry.operation}</span>
                  <span
                    className={[
                      'whitespace-nowrap font-semibold',
                      entry.status === 'BAŞARILI' || entry.status === 'TAMAMLANDI'
                        ? 'text-emerald-600'
                        : entry.status === 'BAŞARISIZ'
                          ? 'text-rose-600'
                          : 'text-amber-600',
                    ].join(' ')}
                  >
                    {entry.status}
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-[var(--panel-ink)]">
                    {formatMoneyDisplay(entry.amount)}
                  </span>
                  <span className="whitespace-nowrap text-[var(--panel-ink)]">{tx.id}</span>
                  <span className="whitespace-nowrap text-[var(--panel-ink)]">{entry.referenceNo || '—'}</span>
                  <span className="whitespace-nowrap text-[var(--panel-ink)]">{entry.authCode || '—'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
