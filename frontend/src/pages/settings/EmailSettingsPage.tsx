import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { EmailTemplateModal } from './EmailTemplateModal';
import {
  type EmailTemplate,
  type SmtpSettings,
} from './emailTemplateTypes';

gsap.registerPlugin(useGSAP);

type PanelFocus = 'both' | 'smtp' | 'templates';

type SmtpApi = SmtpSettings & { passwordSet: boolean };

const EMPTY_SMTP: SmtpSettings = {
  host: '',
  port: '587',
  email: '',
  password: '',
  ssl: false,
  tls: true,
};

/**
 * Ayarlar › E-Posta — SMTP DB; şablonlar şimdilik local mock.
 */
export default function EmailSettingsPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<PanelFocus>('both');

  const [smtp, setSmtp] = useState<SmtpSettings>({ ...EMPTY_SMTP });
  const [smtpBase, setSmtpBase] = useState<SmtpSettings>({ ...EMPTY_SMTP });
  const [passwordSet, setPasswordSet] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplModalError, setTplModalError] = useState<string | null>(null);
  const [deletingTpl, setDeletingTpl] = useState(false);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    { type: 'create' } | { type: 'edit'; template: EmailTemplate } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const loadSmtp = useCallback(async () => {
    if (!token) return;
    setSmtpLoading(true);
    setSmtpError(null);
    try {
      const data = await api.get<SmtpApi>('/api/settings/email/smtp', token);
      const next: SmtpSettings = {
        host: data.host || '',
        port: data.port || '587',
        email: data.email || '',
        password: '',
        ssl: Boolean(data.ssl),
        tls: data.tls !== false,
      };
      setSmtp(next);
      setSmtpBase({ ...next });
      setPasswordSet(Boolean(data.passwordSet));
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : 'SMTP yüklenemedi');
    } finally {
      setSmtpLoading(false);
    }
  }, [token]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setTplLoading(true);
    setTplError(null);
    try {
      const list = await api.get<EmailTemplate[]>('/api/settings/email/templates', token);
      setTemplates(list);
    } catch (err) {
      setTplError(err instanceof Error ? err.message : 'Şablonlar yüklenemedi');
      setTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSmtp();
  }, [loadSmtp]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const smtpDirty =
    smtp.host !== smtpBase.host ||
    smtp.port !== smtpBase.port ||
    smtp.email !== smtpBase.email ||
    smtp.password !== '' ||
    smtp.ssl !== smtpBase.ssl ||
    smtp.tls !== smtpBase.tls;

  const suggestions = useMemo(() => emailSuggestions(testEmail), [testEmail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLocaleLowerCase('tr').includes(q) ||
        t.subject.toLocaleLowerCase('tr').includes(q),
    );
  }, [templates, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const usedTypeKeys = templates.map((t) => t.typeKey);

  const showSmtp = focus !== 'templates';
  const showTemplates = focus !== 'smtp';

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
    { scope: rootRef },
  );

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-tpl-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  useEffect(() => {
    if (!deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteTarget(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function patchSmtp<K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) {
    setSmtp((s) => ({ ...s, [key]: value }));
  }

  async function saveSmtp(e: FormEvent) {
    e.preventDefault();
    if (!token || !smtpDirty || smtpSaving) return;
    setSmtpSaving(true);
    setSmtpError(null);
    try {
      const data = await api.patch<SmtpApi>(
        '/api/settings/email/smtp',
        {
          host: smtp.host,
          port: smtp.port,
          email: smtp.email,
          password: smtp.password,
          ssl: smtp.ssl,
          tls: smtp.tls,
        },
        token,
      );
      const next: SmtpSettings = {
        host: data.host,
        port: data.port,
        email: data.email,
        password: '',
        ssl: data.ssl,
        tls: data.tls,
      };
      setSmtp(next);
      setSmtpBase({ ...next });
      setPasswordSet(Boolean(data.passwordSet));
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 1600);
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSmtpSaving(false);
    }
  }

  async function resetSmtp() {
    if (!token) return;
    setSmtpSaving(true);
    setSmtpError(null);
    try {
      await api.delete('/api/settings/email/smtp', token);
      setSmtp({ ...EMPTY_SMTP });
      setSmtpBase({ ...EMPTY_SMTP });
      setPasswordSet(false);
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : 'Sıfırlanamadı');
    } finally {
      setSmtpSaving(false);
    }
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!testEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestMsg('Geçerli bir e-posta girin');
      setTestOk(false);
      return;
    }
    setTestBusy(true);
    setTestMsg(null);
    setTestOk(false);
    try {
      await api.post('/api/settings/email/test', { email: testEmail.trim().toLowerCase() }, token);
      setTestMsg(`Sınama gönderildi → ${testEmail}`);
      setTestOk(true);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : 'Sınama gönderilemedi');
      setTestOk(false);
    } finally {
      setTestBusy(false);
    }
  }

  async function saveTemplate(row: Omit<EmailTemplate, 'id'> & { id?: string }) {
    if (!token) return;
    setTplSaving(true);
    setTplModalError(null);
    try {
      const payload = { typeKey: row.typeKey, subject: row.subject, body: row.body };
      if (row.id) {
        const updated = await api.patch<EmailTemplate>(
          `/api/settings/email/templates/${encodeURIComponent(row.id)}`,
          payload,
          token,
        );
        setTemplates((list) => list.map((t) => (t.id === row.id ? updated : t)));
      } else {
        const created = await api.post<EmailTemplate>(
          '/api/settings/email/templates',
          payload,
          token,
        );
        setTemplates((list) =>
          [...list, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
        );
      }
      setModal(null);
    } catch (err) {
      setTplModalError(err instanceof Error ? err.message : 'Şablon kaydedilemedi');
    } finally {
      setTplSaving(false);
    }
  }

  async function confirmDeleteTemplate() {
    if (!token || !deleteTarget) return;
    setDeletingTpl(true);
    setTplError(null);
    try {
      await api.delete(
        `/api/settings/email/templates/${encodeURIComponent(deleteTarget.id)}`,
        token,
      );
      setTemplates((list) => list.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setTplError(err instanceof Error ? err.message : 'Şablon silinemedi');
    } finally {
      setDeletingTpl(false);
    }
  }

  function exportCsv() {
    const header = ['Şablon Adı', 'Konu'];
    const lines = filtered.map((t) =>
      [t.name, t.subject].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'e-posta-sablonlari.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyList() {
    void navigator.clipboard.writeText(
      filtered.map((t) => `${t.name}\t${t.subject}`).join('\n'),
    );
  }

  function onArrowLeft() {
    setFocus((f) => (f === 'templates' ? 'templates' : f === 'smtp' ? 'both' : 'templates'));
  }

  function onArrowRight() {
    setFocus((f) => (f === 'smtp' ? 'smtp' : f === 'templates' ? 'both' : 'smtp'));
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            E-Posta Ayarları
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            E-posta gönderebilmek için gerekli ayarlar. Kaydedin ve sınayın.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-km-jump
            title="Şablonları büyüt (sunucu ayarlarını gizle)"
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
            title="Sunucu ayarlarını büyüt (şablonları gizle)"
            aria-label="Sunucu ayarlarını büyüt"
            onClick={onArrowRight}
            disabled={focus === 'smtp'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] shadow-sm transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronIcon dir="right" />
          </button>
        </div>
      </div>

      {smtpError || tplError ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {smtpError || tplError}
        </p>
      ) : null}

      <div
        className={[
          'grid gap-5 transition-[grid-template-columns] duration-300',
          focus === 'both'
            ? 'xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'
            : 'xl:grid-cols-1',
        ].join(' ')}
      >
        {showSmtp ? (
          <div className="space-y-5">
            <form
              data-anim
              onSubmit={(e) => void saveSmtp(e)}
              className="space-y-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
            >
              <div>
                <h2 className="text-base font-bold text-[var(--panel-ink)]">Sunucu Ayarları</h2>
                {smtpLoading ? (
                  <p className="mt-1 text-xs text-[var(--panel-muted)]">Yükleniyor…</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  data-km-jump
                  label="E-Posta Sunucusu"
                  value={smtp.host}
                  onChange={(e) => patchSmtp('host', e.target.value)}
                  disabled={smtpLoading}
                />
                <TextInput
                  data-km-jump
                  label="E-Posta Sunucu Portu"
                  inputMode="numeric"
                  value={smtp.port}
                  onChange={(e) => patchSmtp('port', e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="font-mono tabular-nums"
                  disabled={smtpLoading}
                />
                <TextInput
                  data-km-jump
                  label="E-Posta Adresi"
                  type="email"
                  value={smtp.email}
                  onChange={(e) => patchSmtp('email', e.target.value.toLowerCase())}
                  disabled={smtpLoading}
                />
                <TextInput
                  data-km-jump
                  label={passwordSet ? 'E-Posta Şifresi (değiştirmek için yazın)' : 'E-Posta Şifresi'}
                  type={showPass ? 'text' : 'password'}
                  value={smtp.password}
                  placeholder={passwordSet ? '••••••••••' : ''}
                  onChange={(e) => patchSmtp('password', e.target.value)}
                  disabled={smtpLoading}
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
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleRow
                  label="SSL Kullanımı"
                  checked={smtp.ssl}
                  onChange={(v) => patchSmtp('ssl', v)}
                />
                <ToggleRow
                  label="TLS Kullanımı"
                  checked={smtp.tls}
                  onChange={(v) => patchSmtp('tls', v)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]">
                  <Button
                    type="submit"
                    disabled={(!smtpDirty && !saveOk) || smtpSaving || smtpLoading}
                    loading={smtpSaving}
                    success={saveOk}
                  >
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
                  disabled={smtpSaving || smtpLoading}
                  onClick={() => void resetSmtp()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/8 text-rose-500 transition hover:bg-rose-500/15 disabled:opacity-50"
                >
                  <TrashIcon />
                </button>
              </div>
            </form>

            <form
              data-anim
              onSubmit={(e) => void sendTest(e)}
              className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
            >
              <div className="mb-4">
                <h2 className="text-base font-bold text-[var(--panel-ink)]">E-Posta Sınama</h2>
                <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
                  Kayıtlı SMTP ayarlarıyla gerçek sınama gönderir.
                </p>
              </div>
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative min-w-0 flex-1">
                  <TextInput
                    data-km-jump
                    label="E-Posta Adresi *"
                    type="email"
                    value={testEmail}
                    onChange={(e) => {
                      setTestEmail(e.target.value.toLowerCase());
                      setTestOpen(true);
                      setTestMsg(null);
                    }}
                    onFocus={() => setTestOpen(true)}
                    onBlur={() => window.setTimeout(() => setTestOpen(false), 120)}
                    autoComplete="off"
                  />
                  {testOpen && suggestions.length > 0 ? (
                    <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                      {suggestions.map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel-hover)]"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTestEmail(s);
                              setTestOpen(false);
                            }}
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
                <p
                  className={[
                    'mt-2 text-xs font-medium',
                    testOk ? 'text-emerald-600' : 'text-rose-600',
                  ].join(' ')}
                >
                  {testMsg}
                </p>
              ) : null}
            </form>
          </div>
        ) : null}

        {showTemplates ? (
          <section
            data-anim
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
                <ExportDropdown onCsv={exportCsv} onCopy={copyList} />
                <button
                  type="button"
                  data-km-jump
                  onClick={() => {
                    setTplModalError(null);
                    setModal({ type: 'create' });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  <span className="text-lg leading-none">+</span>
                  Ekle
                </button>
              </div>
            </div>

            <div ref={tableRef} className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[minmax(160px,1.1fr)_minmax(160px,1fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
                  <span>Şablon Adı</span>
                  <span>Konu</span>
                  <span className="sr-only">Sil</span>
                </div>

                {tplLoading ? (
                  <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                    Şablonlar yükleniyor…
                  </p>
                ) : slice.length ? (
                  slice.map((t) => (
                    <div
                      key={t.id}
                      data-tpl-row
                      title="Çift tıkla: düzenle"
                      onDoubleClick={() => {
                        setTplModalError(null);
                        setModal({ type: 'edit', template: t });
                      }}
                      className="grid cursor-default grid-cols-[minmax(160px,1.1fr)_minmax(160px,1fr)_44px] gap-3 border-b border-[var(--panel-line)]/70 px-5 py-3 transition hover:bg-[var(--panel-hover)]"
                    >
                      <span className="truncate text-sm font-medium text-[var(--panel-ink)]">
                        {t.name}
                      </span>
                      <span className="truncate text-sm text-[var(--panel-muted)]">{t.subject}</span>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-label="Sil"
                          title="Sil"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(t);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                    Şablon bulunamadı
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
              <p>
                {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
                {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
                {filtered.length}
              </p>
              <div className="flex flex-wrap gap-1">
                <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
                  İlk
                </PagerBtn>
                <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Geri
                </PagerBtn>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-2 text-xs font-bold text-white">
                  {safePage}
                </span>
                <PagerBtn
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  İleri
                </PagerBtn>
                <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
                  Son
                </PagerBtn>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {modal ? (
        <EmailTemplateModal
          mode={modal}
          usedTypeKeys={usedTypeKeys}
          saving={tplSaving}
          error={tplModalError}
          onClose={() => {
            if (!tplSaving) {
              setModal(null);
              setTplModalError(null);
            }
          }}
          onSave={(row) => void saveTemplate(row)}
        />
      ) : null}

      {deleteTarget
        ? createPortal(
            <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
              <div
                role="dialog"
                aria-modal
                className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
              >
                <h3 className="text-lg font-bold text-[var(--panel-ink)]">Şablonu sil</h3>
                <p className="mt-2 text-sm text-[var(--panel-muted)]">
                  <span className="font-semibold text-[var(--panel-ink)]">{deleteTarget.name}</span>{' '}
                  silinsin mi?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={deletingTpl}
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={deletingTpl}
                    onClick={() => void confirmDeleteTemplate()}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {deletingTpl ? 'Siliniyor…' : 'Sil'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
