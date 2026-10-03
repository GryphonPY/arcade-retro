/** Arte de portada (SVG 64x64) para la sala. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="df-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0f2e" />
          <stop offset="1" stopColor="#3b2a7a" />
        </linearGradient>
        <radialGradient id="df-boom">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fecdd3" />
          <stop offset="1" stopColor="#fb7185" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="8" fill="url(#df-sky)" />
      <g fill="#dbeafe">
        <rect x="8" y="7" width="1" height="1" />
        <rect x="50" y="9" width="1" height="1" />
        <rect x="30" y="5" width="1" height="1" />
        <rect x="57" y="22" width="1" height="1" />
      </g>
      <circle cx="32" cy="24" r="14" fill="url(#df-boom)" />
      <g stroke="#f87171" strokeWidth="1.2" opacity="0.8">
        <line x1="10" y1="2" x2="26" y2="30" />
        <line x1="54" y1="0" x2="40" y2="26" />
        <line x1="36" y1="3" x2="34" y2="22" />
      </g>
      <g stroke="#fecdd3" strokeWidth="1.2">
        <line x1="32" y1="52" x2="32" y2="30" />
      </g>
      <path d="M0 64V54h64v10z" fill="#10142e" />
      <rect x="0" y="54" width="64" height="1.5" fill="#fb7185" />
      <g fill="#3b4670">
        <rect x="6" y="46" width="5" height="8" />
        <rect x="12" y="42" width="5" height="12" />
        <rect x="18" y="47" width="5" height="7" />
        <rect x="41" y="44" width="5" height="10" />
        <rect x="47" y="40" width="5" height="14" />
        <rect x="53" y="46" width="5" height="8" />
      </g>
      <g fill="#fde68a">
        <rect x="7" y="48" width="1" height="2" />
        <rect x="13" y="44" width="1" height="2" />
        <rect x="14" y="48" width="1" height="2" />
        <rect x="42" y="46" width="1" height="2" />
        <rect x="48" y="42" width="1" height="2" />
        <rect x="49" y="47" width="1" height="2" />
        <rect x="54" y="48" width="1" height="2" />
      </g>
      <path d="M24 56l4-8h8l4 8z" fill="#64748b" />
      <rect x="31" y="48" width="2" height="4" fill="#fecdd3" />
    </svg>
  )
}
