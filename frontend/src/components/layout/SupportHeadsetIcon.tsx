/** Destek kulaklık ikonu — şeffaf, raster yok */
export function SupportHeadsetIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 12a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M4.5 12v3.2a2.3 2.3 0 0 0 2.3 2.3h.7"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 12v2.4a3.6 3.6 0 0 1-3.6 3.6h-1.1a1.8 1.8 0 0 0-1.8 1.8v.4"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3.2"
        y="11.2"
        width="3.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="17.6"
        y="11.2"
        width="3.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.85"
      />
    </svg>
  );
}
