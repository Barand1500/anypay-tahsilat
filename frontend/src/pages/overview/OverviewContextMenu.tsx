import { useState } from 'react';
import { useTheme, type AccentColor } from '../../theme/ThemeProvider';
import { GROUP_LABEL, type OverviewGroupId } from './overviewLayout';

const COLORS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: 'blue', label: 'Mavi', swatch: '#2f80ed' },
  { id: 'green', label: 'Yeşil', swatch: '#16a34a' },
  { id: 'purple', label: 'Mor', swatch: '#a855f7' },
];

type Props = {
  x: number;
  y: number;
  hidden: OverviewGroupId[];
  onRestore: (id: OverviewGroupId) => void;
  onClose: () => void;
};

export function OverviewContextMenu({ x, y, hidden, onRestore, onClose }: Props) {
  const { accent, applyAccent } = useTheme();
  const [submenu, setSubmenu] = useState<'hidden' | 'colors' | null>(null);
  const toLeft = x + 430 > window.innerWidth;
  const sideClass = toLeft ? 'right-full' : 'left-full';
  const menuHeight = Math.max(150, Math.min(220, hidden.length * 36 + 16));
  const rowClass = 'flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] focus:bg-[var(--panel-hover)] focus:outline-none';

  return (
    <div
      role="menu"
      aria-label="Özet sayfası ayarları"
      className="fixed z-[100] w-52 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-1.5 shadow-[var(--panel-shadow)]"
      style={{ left: Math.max(8, Math.min(x, window.innerWidth - 216)), top: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)) }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative" onMouseEnter={() => setSubmenu('hidden')} onMouseLeave={() => setSubmenu(null)}>
        <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenu === 'hidden'} onFocus={() => setSubmenu('hidden')} className={rowClass}>
          <span>Gizlenen bölümler</span><span aria-hidden>›</span>
        </button>
        {submenu === 'hidden' ? (
          <div role="menu" aria-label="Gizlenen bölümler" className={`absolute top-0 z-10 w-56 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-1.5 shadow-[var(--panel-shadow)] ${sideClass}`}>
            {hidden.length ? hidden.map((id) => (
              <button key={id} type="button" role="menuitem" className={rowClass} onClick={() => { onRestore(id); onClose(); }}>
                {GROUP_LABEL[id]}
              </button>
            )) : <p className="px-3 py-2 text-xs text-[var(--panel-muted)]">Gizlenen bölüm yok</p>}
          </div>
        ) : null}
      </div>
      <div className="relative" onMouseEnter={() => setSubmenu('colors')} onMouseLeave={() => setSubmenu(null)}>
        <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenu === 'colors'} onFocus={() => setSubmenu('colors')} className={rowClass}>
          <span>Panel rengi</span><span aria-hidden>›</span>
        </button>
        {submenu === 'colors' ? (
          <div role="menu" aria-label="Panel renkleri" className={`absolute top-0 z-10 w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-1.5 shadow-[var(--panel-shadow)] ${sideClass}`}>
            {COLORS.map((color) => (
              <button key={color.id} type="button" role="menuitemradio" aria-checked={accent === color.id} className={rowClass} onClick={() => { applyAccent(color.id); onClose(); }}>
                <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: color.swatch }} />{color.label}</span>
                {accent === color.id ? <span aria-hidden>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
