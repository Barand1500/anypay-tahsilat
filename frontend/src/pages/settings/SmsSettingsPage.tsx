import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui/Button';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { SmsProviderModal } from './SmsProviderModal';
import { SmsTemplateModal } from './SmsTemplateModal';
import {
  INITIAL_SMS_PROVIDERS,
  INITIAL_SMS_SETTINGS,
  INITIAL_SMS_TEMPLATES,
  type SmsProvider,
  type SmsSettings,
  type SmsTemplate,
} from './mockSmsSettings';

gsap.registerPlugin(useGSAP);

type Section = 'ayarlar' | 'saglayicilar';
type PanelFocus = 'both' | 'settings' | 'templates';

/**
 * Ayarlar › SMS — sol ayar+sınama / sağ şablon; Sağlayıcılar ayrı çarşaf liste.
 */
export default function SmsSettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tplTableRef = useRef<HTMLDivElement>(null);
  const provTableRef = useRef<HTMLDivElement>(null);

  const [section, setSection] = useState<Section>('ayarlar');
  const [focus, setFocus] = useState<PanelFocus>('both');

  const [providers, setProviders] = useState<SmsProvider[]>(() =>
    INITIAL_SMS_PROVIDERS.map((p) => ({ ...p, variables: [...p.variables] })),
  );
  const [settings, setSettings] = useState<SmsSettings>(() => ({ ...INITIAL_SMS_SETTINGS }));
  const [settingsBase, setSettingsBase] = useState(settings);
  const [showPass, setShowPass] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const [testPhone, setTestPhone] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const [templates, setTemplates] = useState<SmsTemplate[]>(() =>
    INITIAL_SMS_TEMPLATES.map((t) => ({ ...t })),
  );

  // Şablon liste
  const [tplQuery, setTplQuery] = useState('');
  const [tplPageSizeText, setTplPageSizeText] = useState('10');
  const [tplPageSize, setTplPageSize] = useState(10);
  const [tplPage, setTplPage] = useState(1);
  const [tplModal, setTplModal] = useState<
    { type: 'create' } | { type: 'edit'; template: SmsTemplate } | null
  >(null);
  const [tplDelete, setTplDelete] = useState<SmsTemplate | null>(null);

  // Sağlayıcı liste
  const [provQuery, setProvQuery] = useState('');
  const [provPageSizeText, setProvPageSizeText] = useState('10');
  const [provPageSize, setProvPageSize] = useState(10);
  const [provPage, setProvPage] = useState(1);
  const [provModal, setProvModal] = useState<
    { type: 'create' } | { type: 'edit'; provider: SmsProvider } | null
  >(null);
  const [provDelete, setProvDelete] = useState<SmsProvider | null>(null);

  const settingsDirty =
    settings.providerId !== settingsBase.providerId ||
    settings.username !== settingsBase.username ||
    settings.password !== settingsBase.password ||
    settings.title !== settingsBase.title ||
    settings.active !== settingsBase.active;

  const providerOptions = providers.map((p) => ({ value: p.id, label: p.name }));

  const tplFiltered = useMemo(() => {
    const q = tplQuery.trim().toLocaleLowerCase('tr');
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLocaleLowerCase('tr').includes(q) ||
        t.body.toLocaleLowerCase('tr').includes(q),
    );
  }, [templates, tplQuery]);

  const tplTotalPages = Math.max(1, Math.ceil(tplFiltered.length / tplPageSize));
  const tplSafePage = Math.min(tplPage, tplTotalPages);
  const tplSlice = tplFiltered.slice(
    (tplSafePage - 1) * tplPageSize,
    tplSafePage * tplPageSize,
  );
  const usedTypeKeys = templates.map((t) => t.typeKey);

  const provFiltered = useMemo(() => {
    const q = provQuery.trim().toLocaleLowerCase('tr');
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLocaleLowerCase('tr').includes(q) ||
        p.variables.some((v) => v.toLocaleLowerCase('tr').includes(q)),
    );
  }, [providers, provQuery]);

  const provTotalPages = Math.max(1, Math.ceil(provFiltered.length / provPageSize));
  const provSafePage = Math.min(provPage, provTotalPages);
  const provSlice = provFiltered.slice(
    (provSafePage - 1) * provPageSize,
    provSafePage * provPageSize,
  );

  const showSettings = section === 'ayarlar' && focus !== 'templates';
  const showTemplates = section === 'ayarlar' && focus !== 'settings';

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: rootRef, dependencies: [section] },
  );

  useEffect(() => setTplPage(1), [tplQuery, tplPageSize]);
  useEffect(() => setProvPage(1), [provQuery, provPageSize]);

  useEffect(() => {
    const els = tplTableRef.current?.querySelectorAll('[data-tpl-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [tplSlice.map((r) => r.id).join('|')]);

  useEffect(() => {
    const els = provTableRef.current?.querySelectorAll('[data-prov-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [provSlice.map((r) => r.id).join('|')]);

  useEffect(() => {
    if (!tplDelete && !provDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTplDelete(null);
        setProvDelete(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tplDelete, provDelete]);

  function applyTplPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setTplPageSize(n);
    setTplPageSizeText(String(n));
  }

  function applyProvPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setProvPageSize(n);
    setProvPageSizeText(String(n));
  }

  function patchSettings<K extends keyof SmsSettings>(key: K, value: SmsSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSettingsBase({ ...settings });
    setSaveOk(true);
    window.setTimeout(() => setSaveOk(false), 1600);
  }

  function resetSettings() {
    setSettings({ ...INITIAL_SMS_SETTINGS });
    setSettingsBase({ ...INITIAL_SMS_SETTINGS });
  }

  function sendTest(e: FormEvent) {
    e.preventDefault();
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setTestMsg('Geçerli bir telefon numarası girin');
      return;
    }
    setTestBusy(true);
    setTestMsg(null);
    window.setTimeout(() => {
      setTestBusy(false);
      setTestMsg(`Sınama SMS gönderildi → ${testPhone} (mock)`);
    }, 700);
  }

  function exportTemplatesCsv() {
    const header = ['Şablon Adı', 'İçerik'];
    const lines = tplFiltered.map((t) =>
      [t.name, t.body].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'),
    );
    downloadCsv('sms-sablonlari.csv', [header.join(';'), ...lines].join('\n'));
  }

  function copyTemplates() {
    void navigator.clipboard.writeText(tplFiltered.map((t) => `${t.name}\t${t.body}`).join('\n'));
  }

  function exportProvidersCsv() {
    const header = ['Sağlayıcı Adı', 'Değişkenler'];
    const lines = provFiltered.map((p) =>
      [p.name, p.variables.join(', ')].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'),
    );
    downloadCsv('sms-saglayicilar.csv', [header.join(';'), ...lines].join('\n'));
  }

  function copyProviders() {
    void navigator.clipboard.writeText(
      provFiltered.map((p) => `${p.name}\t${p.variables.join(', ')}`).join('\n'),
    );
  }

  function onArrowLeft() {
    setFocus((f) => (f === 'templates' ? 'templates' : f === 'settings' ? 'both' : 'templates'));
  }

  function onArrowRight() {
    setFocus((f) => (f === 'settings' ? 'settings' : f === 'templates' ? 'both' : 'settings'));
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            SMS Ayarları
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            SMS gönderebilmek için gerekli ayarlar. Doldurun ve sınayın.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-1 shadow-sm">
            {(
              [
                { id: 'ayarlar', label: 'Ayarlar' },
                { id: 'saglayicilar', label: 'Sağlayıcılar' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-km-jump
                onClick={() => {
                  setSection(tab.id);
                  if (tab.id === 'ayarlar') setFocus('both');
                }}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  section === tab.id
                    ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                    : 'text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {section === 'ayarlar' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-km-jump
                title="Şablonları büyüt (ayarları gizle)"
                aria-label="Şablonları büyüt"
                onClick={onArrowLeft}
                disabled={focus === 'templates'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] shadow-sm transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronIcon dir="left" />
              </button>
              <button
                type="button"
                data-km-jump
                title="Ayarları büyüt (şablonları gizle)"
                aria-label="Ayarları büyüt"
                onClick={onArrowRight}
                disabled={focus === 'settings'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] shadow-sm transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronIcon dir="right" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {section === 'ayarlar' ? (
        <div
          className={[
            'grid gap-5 transition-[grid-template-columns] duration-300',
            focus === 'both'
              ? 'xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'
              : 'xl:grid-cols-1',
          ].join(' ')}
        >
          {showSettings ? (
            <div className="space-y-5">
              <form
                data-anim
                onSubmit={saveSettings}
                className="space-y-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
              >
                <div>
                  <h2 className="text-base font-bold text-[var(--panel-ink)]">SMS Ayarları</h2>
                </div>

                <FloatingSearchSelect
                  label="Sağlayıcı"
                  options={providerOptions}
                  value={settings.providerId || null}
                  onChange={(v) => patchSettings('providerId', v ?? '')}
                  placeholder="Sağlayıcı seçin"
                  kmJump
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    data-km-jump
                    label="Kullanıcı adı"
                    value={settings.username}
                    onChange={(e) => patchSettings('username', e.target.value)}
                  />
                  <TextInput
                    data-km-jump
                    label="Şifre"
                    type={showPass ? 'text' : 'password'}
                    value={settings.password}
                    onChange={(e) => patchSettings('password', e.target.value)}
                    endAdornment={
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                        onClick={() => setShowPass((v) => !v)}
                      >
                        {showPass ? 'Gizle' : 'Göster'}
                      </button>
                    }
                  />
                  <TextInput
                    data-km-jump
                    label="Başlık"
                    value={settings.title}
                    onChange={(e) => patchSettings('title', e.target.value)}
                  />
                  <ToggleRow
                    label="Durum"
                    checked={settings.active}
                    onChange={(v) => patchSettings('active', v)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]">
                    <Button type="submit" disabled={!settingsDirty && !saveOk} success={saveOk}>
                      <span className="inline-flex items-center gap-2">
                        <SaveIcon />
                        Değişiklikleri Kaydet
                      </span>
                    </Button>
                  </div>
                  <button
                    type="button"
                    data-km-jump
                    title="Sıfırla"
                    aria-label="Sıfırla"
                    onClick={resetSettings}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/8 text-rose-500 transition hover:bg-rose-500/15"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </form>

              <form
                data-anim
                onSubmit={sendTest}
                className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
              >
                <div className="mb-4">
                  <h2 className="text-base font-bold text-[var(--panel-ink)]">SMS Gönderim Sınama</h2>
                  <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
                    SMS ayarlarınızı kontrol edin!
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      data-km-jump
                      label="Telefon Numarası"
                      inputMode="tel"
                      value={testPhone}
                      onChange={(e) => {
                        setTestPhone(formatPhone(e.target.value));
                        setTestMsg(null);
                      }}
                      autoComplete="tel"
                    />
                  </div>
                  <button
                    type="submit"
                    data-km-jump
                    disabled={testBusy}
                    className="inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  >
                    <SendIcon />
                    {testBusy ? 'Gönderiliyor…' : 'Gönder'}
                  </button>
                </div>
                {testMsg ? (
                  <p className="mt-2 text-xs font-medium text-[var(--panel-muted)]">{testMsg}</p>
                ) : null}
              </form>
            </div>
          ) : null}

          {showTemplates ? (
            <SheetList
              dataAnim
              tableRef={tplTableRef}
              pageSizeText={tplPageSizeText}
              setPageSizeText={setTplPageSizeText}
              applyPageSize={applyTplPageSize}
              query={tplQuery}
              setQuery={setTplQuery}
              onExportCsv={exportTemplatesCsv}
              onCopy={copyTemplates}
              onAdd={() => setTplModal({ type: 'create' })}
              columns={['Şablon Adı']}
              gridCols="grid-cols-[minmax(0,1fr)_44px]"
              empty="Şablon bulunamadı"
              rows={tplSlice.map((t) => ({
                key: t.id,
                rowAttr: 'data-tpl-row' as const,
                onDoubleClick: () => setTplModal({ type: 'edit', template: t }),
                onDelete: () => setTplDelete(t),
                cells: [
                  <span key="n" className="truncate text-sm font-medium text-[var(--panel-ink)]">
                    {t.name}
                  </span>,
                ],
              }))}
              rangeText={`${(tplSafePage - 1) * tplPageSize + (tplSlice.length ? 1 : 0)} ile ${Math.min(tplSafePage * tplPageSize, tplFiltered.length)} arasında veri gösteriliyor. Toplam: ${tplFiltered.length}`}
              page={tplSafePage}
              totalPages={tplTotalPages}
              setPage={setTplPage}
            />
          ) : null}
        </div>
      ) : (
        <SheetList
          dataAnim
          tableRef={provTableRef}
          pageSizeText={provPageSizeText}
          setPageSizeText={setProvPageSizeText}
          applyPageSize={applyProvPageSize}
          query={provQuery}
          setQuery={setProvQuery}
          onExportCsv={exportProvidersCsv}
          onCopy={copyProviders}
          onAdd={() => setProvModal({ type: 'create' })}
          columns={['Sağlayıcı Adı', 'Değişkenler']}
          gridCols="grid-cols-[minmax(140px,0.9fr)_minmax(200px,1.2fr)_44px]"
          empty="Sağlayıcı bulunamadı"
          rows={provSlice.map((p) => ({
            key: p.id,
            rowAttr: 'data-prov-row' as const,
            onDoubleClick: () => setProvModal({ type: 'edit', provider: p }),
            onDelete: () => setProvDelete(p),
            cells: [
              <span key="n" className="truncate text-sm font-medium text-[var(--panel-ink)]">
                {p.name}
              </span>,
              <div key="v" className="flex flex-wrap gap-1.5">
                {p.variables.length ? (
                  p.variables.map((v) => (
                    <span key={v} className="user-chip user-chip--active">
                      {v}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--panel-muted)]">—</span>
                )}
              </div>,
            ],
          }))}
          rangeText={`${(provSafePage - 1) * provPageSize + (provSlice.length ? 1 : 0)} ile ${Math.min(provSafePage * provPageSize, provFiltered.length)} arasında veri gösteriliyor. Toplam: ${provFiltered.length}`}
          page={provSafePage}
          totalPages={provTotalPages}
          setPage={setProvPage}
        />
      )}

      {tplModal ? (
        <SmsTemplateModal
          mode={tplModal}
          usedTypeKeys={usedTypeKeys}
          onClose={() => setTplModal(null)}
          onSave={(row) => {
            if (row.id) {
              setTemplates((list) =>
                list.map((t) =>
                  t.id === row.id
                    ? { ...t, typeKey: row.typeKey, name: row.name, body: row.body }
                    : t,
                ),
              );
            } else {
              setTemplates((list) => [
                ...list,
                {
                  id: `st-${Date.now()}`,
                  typeKey: row.typeKey,
                  name: row.name,
                  body: row.body,
                },
              ]);
            }
            setTplModal(null);
          }}
        />
      ) : null}

      {provModal ? (
        <SmsProviderModal
          mode={provModal}
          onClose={() => setProvModal(null)}
          onSave={(row) => {
            if (row.id) {
              setProviders((list) =>
                list.map((p) =>
                  p.id === row.id
                    ? { ...p, name: row.name, code: row.code, variables: row.variables }
                    : p,
                ),
              );
            } else {
              const id = `sp-${Date.now()}`;
              setProviders((list) => [
                ...list,
                { id, name: row.name, code: row.code, variables: row.variables },
              ]);
            }
            setProvModal(null);
          }}
        />
      ) : null}

      {tplDelete
        ? createPortal(
            <ConfirmDelete
              title="Şablonu sil"
              name={tplDelete.name}
              onCancel={() => setTplDelete(null)}
              onConfirm={() => {
                setTemplates((list) => list.filter((t) => t.id !== tplDelete.id));
                setTplDelete(null);
              }}
            />,
            document.body,
          )
        : null}

      {provDelete
        ? createPortal(
            <ConfirmDelete
              title="Sağlayıcıyı sil"
              name={provDelete.name}
              onCancel={() => setProvDelete(null)}
              onConfirm={() => {
                const id = provDelete.id;
                setProviders((list) => list.filter((p) => p.id !== id));
                if (settings.providerId === id) {
                  const next = providers.find((p) => p.id !== id);
                  patchSettings('providerId', next?.id ?? '');
                }
                setProvDelete(null);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function SheetList({
  dataAnim,
  tableRef,
  pageSizeText,
  setPageSizeText,
  applyPageSize,
  query,
  setQuery,
  onExportCsv,
  onCopy,
  onAdd,
  columns,
  gridCols,
  empty,
  rows,
  rangeText,
  page,
  totalPages,
  setPage,
}: {
  dataAnim?: boolean;
  tableRef: RefObject<HTMLDivElement | null>;
  pageSizeText: string;
  setPageSizeText: (v: string) => void;
  applyPageSize: (raw: string) => void;
  query: string;
  setQuery: (v: string) => void;
  onExportCsv: () => void;
  onCopy: () => void;
  onAdd: () => void;
  columns: string[];
  gridCols: string;
  empty: string;
  rows: {
    key: string;
    rowAttr: 'data-tpl-row' | 'data-prov-row';
    onDoubleClick: () => void;
    onDelete: () => void;
    cells: ReactNode[];
  }[];
  rangeText: string;
  page: number;
  totalPages: number;
  setPage: (fn: number | ((p: number) => number)) => void;
}) {
  return (
    <section
      {...(dataAnim ? { 'data-anim': true } : {})}
      className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
        <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
          <input
            type="text"
            inputMode="numeric"
            data-km-jump
            value={pageSizeText}
            onChange={(e) => setPageSizeText(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => applyPageSize(pageSizeText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="w-11 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
          veri göster
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
              <SearchIcon />
            </span>
            <input
              data-km-jump
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara…"
              className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-56"
            />
          </div>
          <ExportDropdown onCsv={onExportCsv} onCopy={onCopy} />
          <button
            type="button"
            data-km-jump
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="text-lg leading-none">+</span>
            Ekle
          </button>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div
            className={`grid ${gridCols} gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50`}
          >
            {columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
            <span className="sr-only">Sil</span>
          </div>

          {rows.length ? (
            rows.map((r) => (
              <div
                key={r.key}
                {...{ [r.rowAttr]: true }}
                title="Çift tıkla: düzenle"
                onDoubleClick={r.onDoubleClick}
                className={`grid ${gridCols} cursor-default gap-3 border-b border-[var(--panel-line)]/70 px-5 py-3 transition hover:bg-[var(--panel-hover)]`}
              >
                {r.cells}
                <div className="flex justify-end">
                  <button
                    type="button"
                    aria-label="Sil"
                    title="Sil"
                    onClick={(e) => {
                      e.stopPropagation();
                      r.onDelete();
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">{empty}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
        <p>{rangeText}</p>
        <div className="flex flex-wrap gap-1">
          <PagerBtn disabled={page <= 1} onClick={() => setPage(1)}>
            İlk
          </PagerBtn>
          <PagerBtn disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Geri
          </PagerBtn>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-2 text-xs font-bold text-white">
            {page}
          </span>
          <PagerBtn
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            İleri
          </PagerBtn>
          <PagerBtn disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
            Son
          </PagerBtn>
        </div>
      </div>
    </section>
  );
}

function ConfirmDelete({
  title,
  name,
  onCancel,
  onConfirm,
}: {
  title: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <h3 className="text-lg font-bold text-[var(--panel-ink)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{name}</span> silinsin mi?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-km-jump
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition',
        checked
          ? 'border-[color-mix(in_srgb,var(--color-brand-500)_45%,var(--panel-line))] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)]',
      ].join(' ')}
    >
      <span className="text-sm font-semibold text-[var(--panel-ink)]">{label}</span>
      <span
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : '',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-[var(--panel-line)] px-2.5 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={dir === 'right' ? 'rotate-180' : ''}
    >
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5a2 2 0 0 1 2-2h9l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 4.5v5h7v-5M8 19v-5h8v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12 20 4l-7 16-2-7-7-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
