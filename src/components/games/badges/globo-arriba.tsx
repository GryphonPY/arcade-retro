/** Portada de Globo Arriba: gatito en su canasta con tres globos subiendo al atardecer. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="globo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2f8a" />
          <stop offset="0.55" stopColor="#7c5cc8" />
          <stop offset="1" stopColor="#ffb07a" />
        </linearGradient>
        <clipPath id="globo-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#globo-clip)">
        <rect width="64" height="64" fill="url(#globo-sky)" />
        <rect x="8" y="6" width="2" height="2" fill="#fff" />
        <rect x="52" y="9" width="2" height="2" fill="#fff" opacity="0.8" />
        <rect x="44" y="3" width="1.5" height="1.5" fill="#fff" opacity="0.7" />
        {/* nubes */}
        <path d="M2 54c2-5 9-5 11-1 3-3 9-1 9 3H2z" fill="#ffffff" opacity="0.85" />
        <path d="M42 46c2-4 8-4 10-1 3-2 8 0 8 3H42z" fill="#ffffff" opacity="0.7" />
        {/* pájaro lejano */}
        <path d="M50 22q2-2 4 0q2-2 4 0" stroke="#22172a" strokeWidth="1.3" />
        {/* hilos */}
        <path d="M29 42L22 26M32 42L32 20M35 42L42 26" stroke="#22172a" strokeWidth="1" opacity="0.8" />
        {/* globos */}
        <ellipse cx="22" cy="20" rx="7" ry="8" fill="#ff4d6d" stroke="#22172a" strokeWidth="1.8" />
        <ellipse cx="42" cy="20" rx="7" ry="8" fill="#4dc3ff" stroke="#22172a" strokeWidth="1.8" />
        <ellipse cx="32" cy="13" rx="7.5" ry="8.5" fill="#ffd23f" stroke="#22172a" strokeWidth="1.8" />
        <ellipse cx="19.5" cy="16.5" rx="1.6" ry="2.4" fill="#fff" opacity="0.7" />
        <ellipse cx="39.5" cy="16.5" rx="1.6" ry="2.4" fill="#fff" opacity="0.7" />
        <ellipse cx="29.5" cy="9.5" rx="1.6" ry="2.4" fill="#fff" opacity="0.7" />
        {/* gatito */}
        <path d="M26 41l-1-8 5 4zM38 41l1-8-5 4z" fill="#ff9f43" stroke="#22172a" strokeWidth="1.3" strokeLinejoin="round" />
        <ellipse cx="32" cy="41" rx="7.5" ry="6" fill="#ff9f43" stroke="#22172a" strokeWidth="1.6" />
        <circle cx="29.3" cy="40.5" r="1.3" fill="#22172a" />
        <circle cx="34.7" cy="40.5" r="1.3" fill="#22172a" />
        <ellipse cx="27" cy="43" rx="1.5" ry="1" fill="#ff6e8c" opacity="0.7" />
        <ellipse cx="37" cy="43" rx="1.5" ry="1" fill="#ff6e8c" opacity="0.7" />
        <path d="M31 42.5h2l-1 1z" fill="#ff7aa2" />
        {/* canasta */}
        <path d="M23 45h18l-2 10H25z" fill="#d99a55" stroke="#22172a" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M24 49h16M24.6 52h14.8M29 45l-0.6 10M35 45l0.6 10" stroke="#a8692e" strokeWidth="1" />
        <rect x="22" y="43.5" width="20" height="3" rx="1.5" fill="#b97c45" stroke="#22172a" strokeWidth="1.3" />
      </g>
    </svg>
  )
}
