import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { formatPhoneLive, normalizePhoneInput } from '../../pages/customers/mockCustomers';

gsap.registerPlugin(useGSAP);

type Kind = 'text' | 'email' | 'phone';

type Props = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Girişe basılmadan önce normalize (trim, rakam vs.) — kind varsa üzerine yazar */
  normalize?: (raw: string) => string;
  validate?: (value: string) => string | null;
  hint?: ReactNode;
  leadingIcon?: ReactNode;
  /** e-posta önerileri / telefon canlı format */
  kind?: Kind;
};

/**
 * Virgüllü textarea yerine: değer chip’e kilitlenir, yanında yeni slot kayar.
 */
export function GrowingValueList({
  label,
  values,
  onChange,
  placeholder = 'Yazıp Enter’a bas…',
  normalize,
  validate,
  hint,
  leadingIcon,
  kind = 'text',
}: Props) {
  const autoId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef(new Map<string, HTMLSpanElement>());
  const prevLen = useRef(0);
  const booted = useRef(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);

  const suggestions = useMemo(
    () => (kind === 'email' ? emailSuggestions(draft) : []),
    [kind, draft],
  );

  const draftShown =
    kind === 'phone' ? formatPhoneLive(draft) : kind === 'email' ? draft.toLowerCase() : draft;

  function resolveNormalize(raw: string) {
    if (normalize) return normalize(raw);
    if (kind === 'email') return raw.trim().toLowerCase();
    if (kind === 'phone') return normalizePhoneInput(raw);
    return raw.trim();
  }

  function displayValue(v: string) {
    return kind === 'phone' ? formatPhoneLive(v) : v;
  }

  useGSAP(
    () => {
      const chips = rootRef.current?.querySelectorAll<HTMLElement>('[data-value-chip]');
      if (!chips?.length) {
        prevLen.current = values.length;
        booted.current = true;
        return;
      }

      if (!booted.current) {
        booted.current = true;
        prevLen.current = values.length;
        gsap.fromTo(
          chips,
          { autoAlpha: 0, scale: 0.9, y: 6 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.035,
            ease: 'power2.out',
          },
        );
        return;
      }

      const grew = values.length > prevLen.current;
      prevLen.current = values.length;
      if (!grew) return;

      const last = chips[chips.length - 1];
      gsap.fromTo(
        last,
        { autoAlpha: 0, scale: 0.82, y: 8 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.34, ease: 'back.out(1.7)' },
      );
      gsap.fromTo(
        draftRef.current,
        { x: 18, autoAlpha: 0.4 },
        { x: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' },
      );
    },
    { scope: rootRef, dependencies: [values.join('|')] },
  );

  function commit(raw: string) {
    const value = resolveNormalize(raw);
    if (!value) {
      setError(null);
      return false;
    }
    if (values.some((v) => v.toLocaleLowerCase('tr') === value.toLocaleLowerCase('tr'))) {
      setError('Bu değer zaten ekli');
      shakeDraft();
      return false;
    }
    const invalid = validate?.(value) ?? null;
    if (invalid) {
      setError(invalid);
      shakeDraft();
      return false;
    }
    setError(null);
    setDraft('');
    setSuggestOpen(false);
    onChange([...values, value]);
    window.requestAnimationFrame(() => draftRef.current?.focus());
    return true;
  }

  function shakeDraft() {
    gsap.fromTo(
      draftRef.current,
      { x: -4 },
      { x: 4, duration: 0.06, yoyo: true, repeat: 3, ease: 'power1.inOut', clearProps: 'x' },
    );
  }

  function removeAt(index: number) {
    const key = `${values[index]}-${index}`;
    const el = chipRefs.current.get(key);
    if (el) {
      gsap.to(el, {
        autoAlpha: 0,
        scale: 0.78,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          prevLen.current = values.length - 1;
          onChange(values.filter((_, i) => i !== index));
        },
      });
      return;
    }
    prevLen.current = values.length - 1;
    onChange(values.filter((_, i) => i !== index));
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (suggestOpen && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggest((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggest((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        setDraft(suggestions[activeSuggest] ?? suggestions[0]);
        setSuggestOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (suggestOpen && suggestions.length && e.key === 'Enter') {
        commit(suggestions[activeSuggest] ?? draft);
        return;
      }
      commit(draft);
      return;
    }
    if (e.key === 'Escape') {
      setSuggestOpen(false);
      return;
    }
    if (e.key === 'Backspace' && !draft && values.length) {
      e.preventDefault();
      removeAt(values.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <div className="relative">
        <div
          className={[
            'flex min-h-[3.25rem] w-full flex-wrap items-center gap-1.5 rounded-xl border bg-[var(--input-bg)] px-3 pb-2.5 pt-5 transition-colors',
            error
              ? 'border-red-400'
              : 'border-[var(--input-border)] focus-within:border-[var(--input-border-focus)]',
          ].join(' ')}
          onClick={() => draftRef.current?.focus()}
        >
          {leadingIcon ? (
            <span className="mb-0.5 mr-0.5 text-[var(--panel-muted)]">{leadingIcon}</span>
          ) : null}

          {values.map((v, i) => {
            const key = `${v}-${i}`;
            return (
              <span
                key={key}
                ref={(node) => {
                  if (node) chipRefs.current.set(key, node);
                  else chipRefs.current.delete(key);
                }}
                data-value-chip
                className="group inline-flex max-w-full items-center gap-1 rounded-lg bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] px-2 py-1 text-xs font-semibold text-[var(--panel-ink)] shadow-sm"
              >
                <span className={['truncate', kind === 'phone' ? 'font-mono tabular-nums' : ''].join(' ')}>
                  {displayValue(v)}
                </span>
                <button
                  type="button"
                  aria-label={`${displayValue(v)} kaldır`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[var(--panel-muted)] transition hover:bg-[color-mix(in_srgb,var(--color-brand-600)_22%,transparent)] hover:text-[var(--panel-ink)]"
                >
                  <XTiny />
                </button>
              </span>
            );
          })}

          <input
            ref={draftRef}
            id={autoId}
            value={draftShown}
            placeholder={values.length ? placeholder : ' '}
            inputMode={kind === 'phone' ? 'numeric' : kind === 'email' ? 'email' : 'text'}
            autoComplete="off"
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '');
              if (kind === 'phone') setDraft(normalizePhoneInput(raw));
              else if (kind === 'email') {
                setDraft(raw.toLowerCase());
                setSuggestOpen(true);
                setActiveSuggest(0);
              } else setDraft(raw);
              setError(null);
            }}
            onFocus={() => {
              if (kind === 'email') setSuggestOpen(true);
            }}
            onKeyDown={onDraftKey}
            onBlur={() => {
              window.setTimeout(() => setSuggestOpen(false), 120);
              if (draft.trim()) commit(draft);
            }}
            className={[
              'min-w-[9rem] flex-1 bg-transparent py-0.5 text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)]/70',
              kind === 'phone' ? 'font-mono tabular-nums' : '',
            ].join(' ')}
          />
        </div>

        <label
          htmlFor={autoId}
          className={[
            'input-label-gap is-gapped pointer-events-none absolute left-3 top-0 z-10 origin-left -translate-y-1/2',
            'px-1.5 text-xs font-medium transition-colors',
            error ? 'text-red-500' : 'text-[var(--panel-muted)]',
          ].join(' ')}
        >
          {label}
        </label>

        {suggestOpen && suggestions.length > 0 ? (
          <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={[
                    'w-full px-3 py-2 text-left text-sm transition',
                    i === activeSuggest
                      ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] text-[var(--panel-ink)]'
                      : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveSuggest(i)}
                  onClick={() => commit(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--panel-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function XTiny() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
