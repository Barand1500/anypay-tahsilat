import {
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { LegalDocsMenu } from './LegalDocsMenu';
import {
  type DockItemId,
  useDockMode,
} from './DockModeContext';
import { ProfileMenu } from './ProfileMenu';
import { QuickAccessSlots } from './QuickAccessSlots';
import { RatesFooterStage } from './RatesFooterStage';
import { SearchTrigger } from './SearchTrigger';
import { ThemeBurstToggle } from './ThemeBurstToggle';

type Props = {
  autoHide?: boolean;
  onFooterDoubleClick?: (e: MouseEvent) => void;
  onOpenSearch?: () => void;
};

export const PAYMENT_BADGES = [
  { src: '/payments/iyzico.jpg', alt: 'iyzico ile Öde', className: 'h-7 w-auto max-w-[6.5rem]' },
  { src: '/payments/mastercard.jpg', alt: 'Mastercard', className: 'h-8 w-auto max-w-[4.5rem]' },
  { src: '/payments/visa.png', alt: 'Visa', className: 'h-6 w-auto max-w-[4.25rem]' },
  { src: '/payments/amex.png', alt: 'American Express', className: 'h-8 w-auto max-w-[2.75rem]' },
  { src: '/payments/troy.png', alt: 'Troy', className: 'h-6 w-auto max-w-[5rem]' },
] as const;

/**
 * Alt çubuk — rozetler / dock araçları; RatesFooterStage ile kur şeridi.
 */
export function Footer({ autoHide = false, onFooterDoubleClick, onOpenSearch }: Props) {
  const {
    enabled: dockOn,
    reordering,
    order,
    moveItem,
    animating,
    finishReorder,
  } = useDockMode();
  const [dragId, setDragId] = useState<DockItemId | null>(null);
  const [overId, setOverId] = useState<DockItemId | null>(null);
  const dragIdRef = useRef<DockItemId | null>(null);

  function onDragStart(e: ReactDragEvent, id: DockItemId) {
    if (!dockOn || !reordering || animating) {
      e.preventDefault();
      return;
    }
    dragIdRef.current = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e: ReactDragEvent, id: DockItemId) {
    if (!dockOn || !reordering) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onDrop(e: ReactDragEvent, id: DockItemId) {
    e.preventDefault();
    if (!reordering) return;
    const from = (e.dataTransfer.getData('text/plain') as DockItemId) || dragIdRef.current;
    if (from) moveItem(from, id);
    setDragId(null);
    setOverId(null);
    dragIdRef.current = null;
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
    dragIdRef.current = null;
  }

  if (!dockOn) {
    return (
      <RatesFooterStage>
        <div
          onDoubleClick={onFooterDoubleClick}
          title={autoHide ? 'Çift tıkla: footer’ı sabitle' : 'Çift tıkla: footer’ı gizle'}
          className="flex h-full w-full items-center gap-3 px-3 sm:px-4"
        >
          <div className="min-w-0 flex-1">
            {autoHide ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--panel-muted)]">
                Otomatik gizle
              </span>
            ) : null}
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5 sm:gap-2"
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label="Kabul edilen ödeme yöntemleri"
          >
            <PaymentBadges />
          </div>

          <div className="shrink-0" onDoubleClick={(e) => e.stopPropagation()}>
            <LegalDocsMenu />
          </div>
        </div>
      </RatesFooterStage>
    );
  }

  function renderItem(id: DockItemId) {
    const dragging = dragId === id;
    const dropTarget = overId === id && dragId !== id;

    return (
      <DockChip
        key={id}
        id={id}
        reordering={reordering}
        dragging={dragging}
        dropTarget={dropTarget}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        {id === 'search' ? <SearchTrigger onOpen={onOpenSearch} /> : null}
        {id === 'quick' ? <QuickAccessSlots /> : null}
        {id === 'badges' ? <PaymentBadges compact /> : null}
        {id === 'legal' ? <LegalDocsMenu /> : null}
        {id === 'theme' ? <ThemeBurstToggle /> : null}
        {id === 'profile' ? <ProfileMenu /> : null}
      </DockChip>
    );
  }

  const pushRightAt = order.findIndex((id) => id === 'theme' || id === 'profile');

  return (
    <RatesFooterStage>
      <div
        title={reordering ? 'Sırayı düzenle — bitince Taşımayı kaydet’e bas' : 'Dock modu'}
        className={[
          'flex h-full w-full items-center gap-2 px-2 sm:gap-2.5 sm:px-3',
          reordering
            ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_6%,transparent)]'
            : '',
        ].join(' ')}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {order.map((id, i) => (
            <div
              key={id}
              className={i === pushRightAt ? 'ml-auto flex shrink-0 items-center' : undefined}
            >
              {renderItem(id)}
            </div>
          ))}
        </div>

        {reordering ? (
          <div className="flex shrink-0 items-center border-l border-[var(--panel-line)] pl-2">
            <button
              type="button"
              data-km-jump
              onClick={finishReorder}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-brand-600)] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-700)]"
            >
              <CheckIcon />
              Taşımayı kaydet
            </button>
          </div>
        ) : null}
      </div>
    </RatesFooterStage>
  );
}

function DockChip({
  id,
  children,
  reordering,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  id: DockItemId;
  children: ReactNode;
  reordering: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (e: ReactDragEvent, id: DockItemId) => void;
  onDragOver: (e: ReactDragEvent, id: DockItemId) => void;
  onDrop: (e: ReactDragEvent, id: DockItemId) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-dock-target={id}
      onDragOver={(e) => onDragOver(e, id)}
      onDrop={(e) => onDrop(e, id)}
      className={[
        'relative flex shrink-0 items-center rounded-xl',
        dragging ? 'opacity-40' : '',
        reordering && dropTarget
          ? 'ring-2 ring-[var(--color-brand-500)]/50 ring-offset-1 ring-offset-[var(--panel-header)]'
          : '',
      ].join(' ')}
    >
      {reordering ? (
        <button
          type="button"
          draggable
          aria-label="Sırayı değiştir"
          title="Sürükleyerek sırayı değiştir"
          onDragStart={(e) => onDragStart(e, id)}
          onDragEnd={onDragEnd}
          className="mr-0.5 flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-[var(--panel-muted)]/70 transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] active:cursor-grabbing"
        >
          <GripMini />
        </button>
      ) : null}
      {children}
    </div>
  );
}

function PaymentBadges({ compact }: { compact?: boolean }) {
  return (
    <div
      className={['flex shrink-0 items-center', compact ? 'gap-1' : 'gap-1.5 sm:gap-2'].join(' ')}
      aria-label="Kabul edilen ödeme yöntemleri"
    >
      {PAYMENT_BADGES.map((b) => (
        <span
          key={b.src}
          className={[
            'flex items-center justify-center rounded-lg border border-[var(--panel-line)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[var(--panel-elevated)]',
            compact ? 'h-9 px-1.5' : 'h-10 px-2',
          ].join(' ')}
          title={b.alt}
        >
          <img
            src={b.src}
            alt={b.alt}
            className={`object-contain ${compact ? b.className.replace('h-7', 'h-6').replace('h-8', 'h-7') : b.className}`}
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GripMini() {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden>
      <circle cx="2" cy="2" r="1.1" />
      <circle cx="6" cy="2" r="1.1" />
      <circle cx="2" cy="6" r="1.1" />
      <circle cx="6" cy="6" r="1.1" />
      <circle cx="2" cy="10" r="1.1" />
      <circle cx="6" cy="10" r="1.1" />
    </svg>
  );
}
