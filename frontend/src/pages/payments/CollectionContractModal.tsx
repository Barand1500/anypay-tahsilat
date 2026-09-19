import gsap from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Customer } from '../customers/mockCustomers';
import { formatPhoneLive } from '../customers/mockCustomers';

type Props = {
  customer: Customer;
  onClose: () => void;
};

/** Tahsilat sözleşmesi — Esc / X */
export function CollectionContractModal({ customer, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 18, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const phone = customer.phone
    ? `+90 ${formatPhoneLive(customer.phone)}`
    : '—';

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="contract-title"
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/15 via-transparent to-transparent px-5 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">×</span>
            Esc
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
            Güzel Teknoloji
          </p>
          <h2 id="contract-title" className="mt-1 text-xl font-bold tracking-tight text-[var(--panel-ink)]">
            Tahsilat Sözleşmesi
          </h2>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ — Elektronik POS Tahsilat Sözleşmesi
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 text-[13px] leading-relaxed text-[var(--panel-ink)]/85 sm:px-6">
          <Article n={1} title="Taraflar ve konu">
            İşbu sözleşme https://tahsilat.guzelteknoloji.com internet sitesinden (bundan sonra
            İNTERNET SİTESİ olarak anılacaktır) sanal-elektronik pos vasıtasıyla ÜRÜN VE HİZMET
            (bundan sonra ÖDEME olarak anılacaktır) ödemeyi yapacak kişi / kurum ve firma (bundan
            sonra MÜŞTERİ olarak anılacaktır) ile GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ - Yeni Emek
            Mah. Yıldırım Beyazıt Cad. No:130A Kepez / Antalya / Türkiye adresinde
            bilgi@guzelteknoloji.com bulunan GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ (bundan sonra
            SATICI / HİZMET SAĞLAYICI olarak anılacaktır) arasındaki tahsilat işlemlerine ilişkin
            olarak, MÜŞTERİ tarafından elektronik ortamda doldurulan, ÖDEME işlemleri ile ilgili
            özelliklerin, nitelik-niceliğinin, ÜRÜN VE HİZMET bedellerinin tahsilat usül-şartlarının
            ve ÖDEME işlem tarihinin belirtildiği tahsilat formu ile Tüketicilerin Korunması
            Hakkındaki Kanun ve Mesafeli Sözleşmeler Uygulama Esas ve Usulleri Hakkında Yönetmelik
            hükümleri kapsamında tarafların hak, hukuk ve yükümlülüklerini tespit eder. ÖDEME
            işlemlerine konu bedeller GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ faaliyet konusunda yer
            alan ve faturasını kestiği ÜRÜN VE HİZMETLERDEN oluşmaktadır.
          </Article>

          <Article n={2} title="Cayma hakkı">
            MÜŞTERİ; İşbu sözleşme tarihi itibariyle sanal-elektronik ortamda ve Madde 1’de sayılı
            gerekçelerle ve muaccel borcu bulunması şartıyla SATICI / HİZMET SAĞLAYICI’ya yapacağı
            ÜRÜN VE HİZMET kaynaklı her bir borç ÖDEME işlemi için, SATICI / HİZMET SAĞLAYICI’nın
            internet sitesinde yer alan kayıtlı hesaplarına yollanmış olması kaydıyla, yapılan
            ÖDEME’den hiçbir biçimde caymayacağını ve yapılan ÖDEME’nin hukuki ve cezai sorumluluğunu
            bildiğini kabul, beyan ve taahhüt eder. Aynı şekilde SATICI / HİZMET SAĞLAYICI de
            sanal-elektronik ortamda ve kendi internet sitesi aracılığıyla yapılan herhangi bir
            sehven sanal pos ödemesinin Madde 1 kapsamında yer alan ÜRÜN VE HİZMETİ bedeli olmadığını
            tespit etmesi halinde söz konusu ÖDEME’yi MÜŞTERİ hesabına / kartına iade edeceğini ve
            işlemi iptal ettireceğini kabul, beyan ve taahhüt eder.
          </Article>

          <Article n={3} title="Diğer hükümler">
            <p>
              <strong>3.1.</strong> MÜŞTERİ, İNTERNET SİTESİ&apos;nde belirtilen ürün ve hizmetlerin
              temel nitelikleri, maliyet oluşumu ve ÖDEME şekline ilişkin bilgileri okuyup bilgi
              sahibi olduğunu ve elektronik ortamda ÖDEME için gerekli teyidi verdiğini kabul, beyan
              ve taahhüt eder.
            </p>
            <p className="mt-2">
              <strong>3.2.</strong> İNTERNET SİTESİ&apos;nden yapılan her bir ÖDEME sırasında
              MÜŞTERİ tarafından daha önce imzalanmış ve onaylanmış olan işbu Sözleşme ve şartları
              geçerli olacaktır.
            </p>
            <p className="mt-2">
              <strong>3.3.</strong> MÜŞTERİ, ÖDEME’ye aracılık eden elektronik sistem lisans
              sahibine ya da MÜŞTERİ’ye atfedilemeyecek herhangi bir nedenle sanal-elektronik ortamı
              gerekçe göstererek uğradığını iddia ettiği bir zararın MÜŞTERİ tarafından tazminini
              isteyemeyeceğini bildiğini kabul, beyan ve taahhüt eder.
            </p>
            <p className="mt-2">
              <strong>3.4.</strong> SATICI / HİZMET SAĞLAYICI; MÜŞTERİ sehven borçlu olduğu tutardan
              fazla bir ÖDEME yapması halinde, ÜRÜN VE HİZMET borcu bulunmaması kaydıyla, yapılan
              fazla ÖDEME’yi MÜŞTERİ’ye iade edeceğini ve işlemi iptal ettireceğini kabul, beyan ve
              taahhüt eder.
            </p>
            <p className="mt-2">
              <strong>3.5.</strong> Tereddüte mahal vermemek bakımından; Bankalar ve finansman
              kuruluşları gibi kredi kartı, taksit kart v.b. veren kuruluşlarca sağlanan vadeli /
              taksitli ödeme imkanları bir kredi ve/veya doğrudan anılan kuruluşca sağlanmış
              taksitli ödeme imkanıdır; bu çerçevede MÜŞTERİ’nin herhangi bir gerçek ya da tüzel
              kişiliği olmayışı ve ticari bir faaliyette bulunması yasak oluşu gerekçeleriyle
              sanal-elektronik ortamda MÜŞTERİ tarafından yapılacak tüm ÖDEME’lerin peşin ÖDEME
              olacağı ya da sayılacağını Taraflar kabul, beyan ve taahhüt ederler.
            </p>
            <p className="mt-2">
              <strong>3.6.</strong> Olağanüstü durumlar ya da mücbir sebepler (hava muhalefeti,
              deprem, sel, yangın gibi) nedeni ile sanal-elektronik pos sisteminde arıza oluşması
              halinde MÜŞTERİ; arıza giderilinceye dek muaccel hale gelmiş Madde 1 kapsamındaki ÜRÜN
              VE HİZMET borçlarını diğer ödeme yöntem ve araçları ile ödeyeceğini kabul, beyan ve
              taahhüt eder.
            </p>
            <p className="mt-2">
              <strong>3.7.</strong> MÜŞTERİ; ÖDEME sistemine dair talep ve şikayetlerini SATICI /
              HİZMET SAĞLAYICI adresine yazılı olarak bildirebilir.
            </p>
          </Article>

          <Article n={4} title="Sözleşmenin feshi">
            İşbu sözleşme Taraflar’dan herhangi biri tarafından gerekçe göstermeksizin fesih
            tarihinden 1 ay önce yapılacak yazılı fesih bildirimine müteakip feshedilebilir.
          </Article>

          <Article n={5} title="Delil anlaşması ve yetkili mahkeme">
            Bu Sözleşme&apos;den ve/veya uygulanmasından doğabilecek her türlü uyuşmazlığın
            çözümünde SATICI / HİZMET SAĞLAYICI kayıtları (bilgisayar-ses kayıtları gibi manyetik
            ortamdaki kayıtlar dahil) kesin delil oluşturur; hukuki ihtilafların çözümünde SATICI /
            HİZMET SAĞLAYICI’in yerleşim yerindeki Mahkemeler ve İcra Müdürlükleri yetkilidir.
          </Article>

          <p>
            MÜŞTERİ bu Sözleşmede yazılı tüm koşulları ve açıklamaları okuduğunu, ÖDEME koşullarının
            ve sair tüm ön bilgileri aldığını, incelediğini ve tamamını kabul ettiğini beyan, kabul
            ve taahhüt eder.
          </p>

          <div className="rounded-xl border border-[var(--color-brand-500)]/25 bg-[var(--brand-soft-bg)] px-4 py-3.5">
            <p className="text-base font-bold text-[var(--panel-ink)]">{customer.title}</p>
            <dl className="mt-2 space-y-1 text-[12px] text-[var(--panel-ink)]/80">
              <div>
                <dt className="inline font-semibold text-[var(--panel-muted)]">Vergi &amp; TC No : </dt>
                <dd className="inline font-mono">
                  {customer.taxNo || customer.identityNo || '—'}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--panel-muted)]">Adres : </dt>
                <dd className="inline">{customer.address || '—'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--panel-muted)]">Telefon : </dt>
                <dd className="inline">{phone}</dd>
                <span className="mx-2 text-[var(--panel-muted)]">·</span>
                <dt className="inline font-semibold text-[var(--panel-muted)]">E-Posta : </dt>
                <dd className="inline">{customer.email || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--panel-line)] px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--color-brand-600)] py-3 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)]"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Article({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--color-brand-600)]">
        Madde {n}. {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
