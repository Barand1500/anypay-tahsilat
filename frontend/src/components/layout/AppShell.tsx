import { useEffect, useState, type MouseEvent } from 'react';
import { Outlet } from 'react-router-dom';
import { KeyboardModeProvider } from '../../keyboard/KeyboardModeContext';
import { PermissionProvider } from '../../permissions/PermissionContext';
import { Header } from './Header';
import { QuickAccessProvider } from './QuickAccessContext';
import { Sidebar } from './Sidebar';

const HEADER_H = 64;

/** Panel kabuğu — sidebar + auto-hide header + içerik */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [peek, setPeek] = useState(false);

  const headerOpen = !autoHide || peek;

  useEffect(() => {
    if (!autoHide) setPeek(false);
  }, [autoHide]);

  function onHeaderDoubleClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('button, input, a, select, textarea, label, [data-quick-slot]')) return;

    if (!autoHide) {
      setAutoHide(true);
      setPeek(false);
      return;
    }
    setAutoHide(false);
    setPeek(false);
  }

  return (
    <QuickAccessProvider>
      <PermissionProvider>
        <KeyboardModeProvider>
          <div className="flex h-screen overflow-hidden bg-[var(--panel-bg)] text-[var(--panel-ink)]">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

            <div className="relative flex min-w-0 flex-1 flex-col">
              {autoHide && !peek ? (
                <div
                  className="absolute inset-x-0 top-0 z-50 h-3"
                  onMouseEnter={() => setPeek(true)}
                  title="Header’ı göstermek için fareyi yukarı getir"
                />
              ) : null}

              <div
                className="shrink-0 overflow-hidden transition-[height] duration-300 ease-out"
                style={{ height: headerOpen ? HEADER_H : 0 }}
                onMouseLeave={() => {
                  if (autoHide) setPeek(false);
                }}
              >
                <Header autoHide={autoHide} onHeaderDoubleClick={onHeaderDoubleClick} />
              </div>

              <main className="flex-1 overflow-y-auto p-4 transition-[padding] duration-300 sm:p-5 lg:p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </KeyboardModeProvider>
      </PermissionProvider>
    </QuickAccessProvider>
  );
}
