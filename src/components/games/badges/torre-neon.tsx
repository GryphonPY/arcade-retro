/** Portada de Torre Neón: torre isométrica de bloques en degradado neón. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="torre-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0410" />
          <stop offset="1" stopColor="#2a0f3a" />
        </linearGradient>
        <radialGradient id="torre-glow" cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor="#f472b6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </radialGradient>
        <clipPath id="torre-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#torre-clip)">
        <rect width="64" height="64" fill="url(#torre-bg)" />
        <rect width="64" height="64" fill="url(#torre-glow)" />
        {/* rejilla */}
        <path d="M0 52L32 36L64 52M0 60L32 44L64 60M32 36V64M16 44V64M48 44V64" stroke="#f472b6" strokeOpacity="0.25" strokeWidth="0.7" />
        {/* puntos de luz */}
        <rect x="8" y="10" width="1.5" height="1.5" fill="#fff" opacity="0.7" />
        <rect x="54" y="14" width="1.5" height="1.5" fill="#fff" opacity="0.5" />
        <rect x="14" y="26" width="1" height="1" fill="#fff" opacity="0.6" />
        <rect x="50" y="30" width="1" height="1" fill="#fff" opacity="0.6" />
        {/* torre */}
        <path d="M17 41L32 48.5V54.5L17 47Z" fill="#ec1c84" />
        <path d="M32 48.5L47 41V47L32 54.5Z" fill="#a90d5b" />
        <path d="M32 33.5L47 41L32 48.5L17 41Z" fill="#fa5fad" stroke="#feadd6" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M19.5 34.5L33.5 41.5V47.5L19.5 40.5Z" fill="#ec1cdb" />
        <path d="M33.5 41.5L47.5 34.5V40.5L33.5 47.5Z" fill="#a90d9c" />
        <path d="M33.5 27.5L47.5 34.5L33.5 41.5L19.5 34.5Z" fill="#fa5fed" stroke="#feadf8" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M18 28L31 34.5V40.5L18 34Z" fill="#a71cec" />
        <path d="M31 34.5L44 28V34L31 40.5Z" fill="#750da9" />
        <path d="M31 21.5L44 28L31 34.5L18 28Z" fill="#c75ffa" stroke="#e3adfe" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M21 21.5L32 27.0V33.0L21 27.5Z" fill="#501cec" />
        <path d="M32 27.0L43 21.5V27.5L32 33.0Z" fill="#340da9" />
        <path d="M32 16.0L43 21.5L32 27.0L21 21.5Z" fill="#865ffa" stroke="#c1adfe" strokeWidth="0.8" strokeLinejoin="round" />
        {/* pieza cortada cayendo */}
        <g transform="rotate(18 52 20)" opacity="0.9">
          <path d="M44 20L52 16L60 20L52 24Z" fill="#c4b5fd" stroke="#ede9fe" strokeWidth="0.7" strokeLinejoin="round" />
          <path d="M44 20L52 24V28L44 24Z" fill="#7c3aed" />
          <path d="M52 24L60 20V24L52 28Z" fill="#5b21b6" />
        </g>
        {/* destello de encaje perfecto */}
        <path d="M32 8v6M29 11h6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}
