import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';

type PayResult = {
  kind: 'ok' | 'fail';
  odemeNo: string;
  amount: number;
  message: string;
};

/** Başarılıda kısa, hatada mesajı okumaya yetecek kadar bekler */
const AUTO_CLOSE_MS = { ok: 6000, fail: 9000 } as const;

function parseResult(search: string): PayResult | null {
  const q = new URLSearchParams(search);
  const pay = q.get('pay');
  if (pay !== 'ok' && pay !== 'fail') return null;
  const msg = (q.get('msg') || '').trim();
  const odemeNo = msg.match(/#([A-Za-z0-9_-]+)/)?.[1] || '';
  const amount = Number((q.get('amount') || '').replace(',', '.'));
  const message = msg.replace(/\s*[—-]\s*#[A-Za-z0-9_-]+\s*$/, '').trim();
  return {
    kind: pay,
    odemeNo,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    message,
  };
}

/** Banka/sistem mesajını müşterinin anlayacağı bir açıklamaya çevirir (teknik kod göstermez) */
function friendlyFailure(raw: string): { title: string; hint: string } {
  const m = raw.toLowerCase();
  const rules: Array<[RegExp, { title: string; hint: string }]> = [
    [/yetersiz|insufficient/, { title: 'Kart limiti veya bakiye yetersiz', hint: 'Kartınızın limitini kontrol edip tekrar deneyebilir ya da başka bir kart kullanabilirsiniz.' }],
    [/cvv|cvc|güvenlik kodu/, { title: 'Güvenlik kodu (CVC) hatalı', hint: 'Kartın arkasındaki 3 haneli kodu kontrol edip tekrar deneyin.' }],
    [/son kullanma|expir|süresi dol/, { title: 'Kartın son kullanma tarihi hatalı', hint: 'Tarihi kontrol edip tekrar deneyin.' }],
    [/kart numaras|geçersiz kart|invalid card/, { title: 'Kart numarası geçersiz', hint: 'Kart numarasını kontrol edip tekrar deneyin.' }],
    [/mdstatus|doğrulama (başarısız|hata)|not\s+authenticated|3d.*(başarısız|hata)|sms|şifre.*yanlış/, { title: '3D Secure doğrulaması tamamlanamadı', hint: 'SMS ile gelen kodu hatalı girmiş veya işlemi iptal etmiş olabilirsiniz. Lütfen tekrar deneyin.' }],
    [/challenge|ödeme sonucu yok|zaman aşımı|timeout/, { title: 'Bankadan sonuç alınamadı', hint: 'Doğrulama ekranı tamamlanmadan kapanmış olabilir. Kartınızdan para çekilmedi; tekrar deneyebilirsiniz.' }],
    [/kod 92|provizyon|auth|para çekilmedi|çekim reddedildi/, { title: 'Banka işlemi onaylamadı', hint: 'Kartınızdan para çekilmedi. Başka bir kartla deneyin veya bankanızla görüşün.' }],
    [/iptal|cancel/, { title: 'İşlem iptal edildi', hint: 'Kartınızdan para çekilmedi.' }],
    [/zaten/, { title: 'Bu işlem daha önce sonuçlanmış', hint: 'İşlem durumunu Hareketler sayfasından kontrol edebilirsiniz.' }],
    [/ulaşıl|bağlanıl|network|fetch|ağ hata/, { title: 'Bankaya şu an ulaşılamıyor', hint: 'Lütfen biraz sonra tekrar deneyin. Kartınızdan para çekilmedi.' }],
    [/reddedil|başarısız|declin|hata/, { title: 'İşlem bankanız tarafından reddedildi', hint: 'Kartınızdan para çekilmedi. Başka bir kart deneyebilir veya bankanızla görüşebilirsiniz.' }],
  ];
  for (const [re, out] of rules) if (re.test(m)) return out;
  return { title: 'Ödeme tamamlanamadı', hint: 'Kartınızdan para çekilmedi. Lütfen tekrar deneyin; sorun sürerse bizimle iletişime geçin.' };
}

function formatTry(amount: number): string {
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

/**
 * 3DS dönüşünde (?pay=ok|fail&msg=…&amount=…) her sayfada açılan sonuç ekranı.
 * Kendiliğinden kapanır; parametreleri adresten temizler.
 */
export function PaymentResultOverlay() {
  const [searchParams, setSearchParams] = useSearchParams();
  // İlk render'da yakala: sayfa bileşenleri parametreyi silse bile ekran kalsın
  const [result, setResult] = useState<PayResult | null>(() => parseResult(window.location.search));
  const reduced = useReducedMotion();

  useEffect(() => {
    const parsed = parseResult(searchParams.toString());
    if (!parsed) return;
    setResult(parsed);
    const next = new URLSearchParams(searchParams);
    next.delete('pay');
    next.delete('msg');
    next.delete('amount');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Adreste tutar gelmediyse (Merkezi API dönüşü) işlem no ile tutarı çek
  const needAmountFor = result && result.amount === 0 && result.odemeNo ? result.odemeNo : '';
  useEffect(() => {
    if (!needAmountFor) return;
    let cancelled = false;
    void api
      .get<{ amount: number }>(`/api/payments/3d/result/${encodeURIComponent(needAmountFor)}`)
      .then((d) => {
        if (!cancelled && d?.amount > 0) {
          setResult((prev) => (prev && prev.odemeNo === needAmountFor ? { ...prev, amount: d.amount } : prev));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needAmountFor]);

  const close = useCallback(() => setResult(null), []);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(close, AUTO_CLOSE_MS[result.kind]);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [result, close]);

  const ok = result?.kind === 'ok';
  const failure = result && !ok ? friendlyFailure(result.message) : null;
  const accent = ok ? '#16a34a' : '#dc2626';

  return createPortal(
    <AnimatePresence>
      {result && (
        <motion.div
          key="pay-result"
          className="fixed inset-0 z-[10100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="alertdialog"
          aria-modal
          aria-live="assertive"
          aria-labelledby="pay-result-title"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]" onClick={close} aria-hidden />
          <motion.div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-6 pb-7 pt-9 text-center shadow-2xl"
            initial={reduced ? false : { opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              {!reduced && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ background: accent, opacity: 0.14 }}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: [0.6, 1.25, 1] }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              )}
              <svg viewBox="0 0 52 52" className="relative h-20 w-20" fill="none" aria-hidden>
                <motion.circle
                  cx="26"
                  cy="26"
                  r="23"
                  stroke={accent}
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
                {ok ? (
                  <motion.path
                    d="M15 27.5 22.5 35 37 19"
                    stroke={accent}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.45, ease: 'easeOut' }}
                  />
                ) : (
                  <>
                    <motion.path
                      d="M18 18 34 34"
                      stroke={accent}
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={reduced ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.28, delay: 0.45 }}
                    />
                    <motion.path
                      d="M34 18 18 34"
                      stroke={accent}
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={reduced ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.28, delay: 0.7 }}
                    />
                  </>
                )}
              </svg>
            </div>

            <h2 id="pay-result-title" className="text-xl font-bold text-[var(--panel-ink)]">
              {ok ? 'Ödeme Başarılı' : failure?.title || 'Ödeme Başarısız'}
            </h2>

            {result.amount > 0 && (
              <motion.p
                className="mt-2 text-3xl font-extrabold tabular-nums"
                style={{ color: accent }}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
              >
                {formatTry(result.amount)}
              </motion.p>
            )}

            <p className="mt-3 text-sm leading-relaxed text-[var(--panel-muted)]">
              {ok ? 'İşleminiz tamamlandı, tahsilat alındı.' : failure?.hint}
            </p>

            {result.odemeNo && (
              <p className="mt-3 inline-block rounded-full bg-[var(--panel-surface)] px-3 py-1 text-xs font-semibold text-[var(--panel-muted)]">
                İşlem No: #{result.odemeNo}
              </p>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-6 block w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: accent }}
            >
              {ok ? 'Tamam' : 'Kapat'}
            </button>

            <motion.div
              className="absolute inset-x-0 bottom-0 h-1 origin-left"
              style={{ background: accent, opacity: 0.55 }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_CLOSE_MS[result.kind] / 1000, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
