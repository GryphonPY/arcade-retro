/** Portada de Torre Espiral: torre con pisos en anillo, huecos, rojo peligroso y la pelotita cayendo en fuego. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="espiral-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd6e8" />
          <stop offset="1" stopColor="#ff9cc8" />
        </linearGradient>
        <linearGradient id="espiral-pole" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3c6dc" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3c6dc" />
        </linearGradient>
        <clipPath id="espiral-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#espiral-clip)">
        <rect width="64" height="64" fill="url(#espiral-bg)" />
        <circle cx="10" cy="14" r="2" fill="#fff" opacity="0.5" />
        <circle cx="55" cy="40" r="3" fill="#fff" opacity="0.4" />
        {/* columna */}
        <rect x="28" y="-2" width="8" height="68" fill="url(#espiral-pole)" />
        {/* piso de arriba: con hueco al frente */}
        <path d="M6 20a26 8 0 0 1 52 0v3a26 8 0 0 1-17 7.5V27.5A26 8 0 0 0 58 20" fill="#6040d6" />
        <path d="M6 20a26 8 0 0 1 52 0a26 8 0 0 1-17 7.5L36 22h-8L23 27.6A26 8 0 0 1 6 20z" fill="#8a63ff" />
        <path d="M6 20v3a26 8 0 0 0 17 7.6v-3A26 8 0 0 1 6 20z" fill="#6040d6" />
        {/* piso de en medio con rojo */}
        <path d="M6 38a26 8 0 0 0 52 0v3a26 8 0 0 1-52 0z" fill="#6040d6" />
        <ellipse cx="32" cy="38" rx="26" ry="8" fill="#8a63ff" />
        <path d="M32 38L58 38A26 8 0 0 1 44 45.3z" fill="#ff3b3b" />
        <path d="M58 38v3a26 8 0 0 1-14 7.3v-3A26 8 0 0 0 58 38z" fill="#b81d1d" />
        <path d="M46 40l4 3M50 39l4 3" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="28" y="30" width="8" height="8" fill="url(#espiral-pole)" />
        {/* mancha */}
        <ellipse cx="22" cy="41.5" rx="5" ry="2" fill="#ff4f9a" />
        {/* piso de abajo */}
        <path d="M6 56a26 8 0 0 0 52 0v3a26 8 0 0 1-52 0z" fill="#6040d6" />
        <ellipse cx="32" cy="56" rx="26" ry="8" fill="#8a63ff" />
        <rect x="28" y="48" width="8" height="8" fill="url(#espiral-pole)" />
        {/* pelotita en fuego cayendo por el hueco */}
        <circle cx="32" cy="12" r="3" fill="#ffd23f" opacity="0.5" />
        <circle cx="32" cy="17" r="3.6" fill="#ffb000" opacity="0.75" />
        <circle cx="32" cy="23" r="4.6" fill="#ff6a00" stroke="#2a1640" strokeWidth="1.3" />
        <circle cx="30.5" cy="21.5" r="1.4" fill="#fff7c2" />
        {/* trozos volando */}
        <path d="M8 30l6-1 0 3-6 1z" fill="#8a63ff" />
        <path d="M52 27l5 1-1 3-5-1z" fill="#8a63ff" />
      </g>
    </svg>
  )
}
