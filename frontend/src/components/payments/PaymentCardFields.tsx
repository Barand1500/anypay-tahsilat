import { useSyncExternalStore, type ReactNode } from 'react';
import { TextInput } from '../ui/TextInput';
import { AnimatedPayCard } from './AnimatedPayCard';
import type { BankInfo } from '../../pages/payments/mockBanks';
import {
  getStoredCardDesign,
  type CardDesignId,
} from '../../pages/settings/personalPrefs';
import { formatPhoneLive } from '../../pages/customers/mockCustomers';

type Errors = Partial<{
  holder: string;
  tc: string;
  phone: string;
  card: string;
  expiry: string;
  cvc: string;
}>;

type Props = {
  holder: string;
  tc: string;
  phone: string;
  card: string;
  expiry: string;
  cvc: string;
  errors: Errors;
  bank: BankInfo | null;
  cardFaulty?: boolean;
  expiryOk?: boolean;
  expiryFaulty?: boolean;
  onHolder: (v: string) => void;
  onTc: (v: string) => void;
  onPhone: (v: string) => void;
  onCard: (v: string) => void;
  onExpiry: (v: string) => void;
  onCvc: (v: string) => void;
  onCardBlur?: () => void;
  onExpiryBlur?: () => void;
  /** Üst başlık metni (SectionHead yoksa) */
  title?: string;
  SectionHead?: (props: { children: ReactNode }) => ReactNode;
  /** Sade modda başlık metni */
  heading?: string;
};

function subscribeCardDesign(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'anypay_tahsilat_card_design') cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('anypay-card-design', cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('anypay-card-design', cb);
  };
}

function readCardDesign(): CardDesignId {
  return getStoredCardDesign();
}

export function notifyCardDesignChange() {
  window.dispatchEvent(new Event('anypay-card-design'));
}

function FaultBadge() {
  return (
    <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">
      Hatalı
    </span>
  );
}

function OkBadge() {
  return (
    <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
      OK
    </span>
  );
}

/**
 * Ödeme kart alanları — kişisel tercihe göre sade form veya 3D kart.
 * Ana grid genişliğini bozmaz.
 */
export function PaymentCardFields(props: Props) {
  const design = useSyncExternalStore(subscribeCardDesign, readCardDesign, () => 'plain');
  const Head = props.SectionHead;

  if (design === 'animated') {
    return (
      <div className="flex flex-col gap-3">
        {Head ? <Head>{props.heading || 'Kredi kartı'}</Head> : null}
        {props.title && !Head ? (
          <p className="text-sm font-bold text-[var(--panel-ink)]">{props.title}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <TextInput
            data-km-jump
            label="T.C. Kimlik"
            value={props.tc}
            error={props.errors.tc}
            onChange={(e) => props.onTc(e.target.value)}
            inputMode="numeric"
            className="!h-11 !pb-1.5 !pt-4 font-mono text-xs tabular-nums"
          />
          <TextInput
            data-km-jump
            label="Telefon"
            value={formatPhoneLive(props.phone)}
            error={props.errors.phone}
            onChange={(e) => props.onPhone(e.target.value)}
            inputMode="tel"
            className="!h-11 !pb-1.5 !pt-4 font-mono text-xs tabular-nums"
          />
        </div>

        <AnimatedPayCard
          values={{
            holder: props.holder,
            card: props.card,
            expiry: props.expiry,
            cvc: props.cvc,
          }}
          errors={{
            holder: props.errors.holder,
            card: props.errors.card,
            expiry: props.errors.expiry,
            cvc: props.errors.cvc,
          }}
          bank={props.bank}
          cardFaulty={props.cardFaulty}
          expiryOk={props.expiryOk}
          expiryFaulty={props.expiryFaulty}
          onHolder={props.onHolder}
          onCard={props.onCard}
          onExpiry={props.onExpiry}
          onCvc={props.onCvc}
          onCardBlur={props.onCardBlur}
          onExpiryBlur={props.onExpiryBlur}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Head ? <Head>{props.heading || 'Kredi kartı'}</Head> : null}
      {props.title && !Head ? (
        <p className="text-sm font-bold text-[var(--panel-ink)]">{props.title}</p>
      ) : null}
      <TextInput
        data-km-jump
        label="Ad Soyad"
        value={props.holder}
        error={props.errors.holder}
        onChange={(e) => props.onHolder(e.target.value)}
      />
      <TextInput
        data-km-jump
        label="T.C. Kimlik No"
        value={props.tc}
        error={props.errors.tc}
        onChange={(e) => props.onTc(e.target.value)}
        inputMode="numeric"
        className="font-mono tabular-nums"
      />
      <TextInput
        data-km-jump
        label="Telefon No"
        value={formatPhoneLive(props.phone)}
        error={props.errors.phone}
        onChange={(e) => props.onPhone(e.target.value)}
        inputMode="tel"
        className="font-mono tabular-nums"
      />
      <div>
        <TextInput
          data-km-jump
          label="Kart No"
          value={props.card}
          error={props.errors.card}
          onChange={(e) => props.onCard(e.target.value)}
          onBlur={props.onCardBlur}
          inputMode="numeric"
          autoComplete="cc-number"
          className="!pr-[7rem] font-mono tabular-nums"
          endAdornment={
            props.cardFaulty ? (
              <FaultBadge />
            ) : props.bank ? (
              <img
                src={props.bank.logo}
                alt=""
                title={props.bank.name}
                className="h-7 w-auto max-w-[80px] object-contain"
              />
            ) : (
              <span className="rounded-md bg-[var(--panel-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--panel-muted)]">
                BIN
              </span>
            )
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          data-km-jump
          label="Son kullanım"
          value={props.expiry}
          error={props.errors.expiry}
          onChange={(e) => props.onExpiry(e.target.value)}
          onBlur={props.onExpiryBlur}
          inputMode="numeric"
          autoComplete="cc-exp"
          className="!pr-20 font-mono tabular-nums"
          endAdornment={
            props.expiryFaulty ? <FaultBadge /> : props.expiryOk ? <OkBadge /> : null
          }
        />
        <TextInput
          data-km-jump
          label="CVC"
          value={props.cvc}
          error={props.errors.cvc}
          onChange={(e) => props.onCvc(e.target.value)}
          inputMode="numeric"
          className="font-mono tabular-nums"
        />
      </div>
    </div>
  );
}
