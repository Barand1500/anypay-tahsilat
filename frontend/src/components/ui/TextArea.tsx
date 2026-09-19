import { useId, type TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

/** Outlined textarea — TextInput ile aynı yüzen etiket */
export function TextArea({ label, error, id, className = '', rows = 4, ...rest }: Props) {
  const autoId = useId();
  const areaId = id || rest.name || autoId;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <textarea
          id={areaId}
          rows={rows}
          placeholder=" "
          className={[
            'peer w-full resize-y rounded-xl border bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 text-sm outline-none transition-colors',
            'border-[var(--input-border)] text-[var(--panel-ink)]',
            'focus:border-[var(--input-border-focus)] focus:ring-0',
            error ? '!border-red-400 focus:!border-red-400' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        <label
          htmlFor={areaId}
          className={[
            'input-label-gap pointer-events-none absolute left-3 top-4 z-10 origin-left',
            'px-1.5 text-sm text-[var(--panel-muted)] transition-all duration-200',
            'peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[var(--input-label)]',
            'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium',
            error ? 'peer-focus:!text-red-500' : '',
          ].join(' ')}
        >
          {label}
        </label>
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
