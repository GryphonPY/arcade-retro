/** Portada de Flap Pixel: pájaro pixel art entre tuberías al atardecer. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flap-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1e3a" />
          <stop offset="0.55" stopColor="#3b3a7a" />
          <stop offset="1" stopColor="#f59e5b" />
        </linearGradient>
        <clipPath id="flap-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#flap-clip)">
        <rect width="64" height="64" fill="url(#flap-sky)" />
        {/* estrellas */}
        <rect x="8" y="8" width="2" height="2" fill="#fff" opacity="0.9" />
        <rect x="30" y="6" width="2" height="2" fill="#fff" opacity="0.6" />
        <rect x="52" y="10" width="2" height="2" fill="#fff" opacity="0.8" />
        <rect x="20" y="14" width="1" height="1" fill="#fff" opacity="0.7" />
        {/* ciudad */}
        <path d="M0 50h6v-8h6v6h5v-10h7v12h6v-7h6v9h6v-13h8v21H0z" fill="#241a4a" opacity="0.85" />
        {/* tubería superior */}
        <rect x="44" y="-2" width="13" height="19" fill="#14401f" />
        <rect x="45.5" y="-2" width="10" height="19" fill="#4cb44a" />
        <rect x="47" y="-2" width="3" height="19" fill="#a8f08a" />
        <rect x="42" y="15" width="17" height="7" fill="#14401f" />
        <rect x="43.5" y="16.5" width="14" height="4" fill="#4cb44a" />
        <rect x="45" y="16.5" width="3" height="4" fill="#a8f08a" />
        {/* tubería inferior */}
        <rect x="44" y="46" width="13" height="20" fill="#14401f" />
        <rect x="45.5" y="46" width="10" height="20" fill="#4cb44a" />
        <rect x="47" y="46" width="3" height="20" fill="#a8f08a" />
        <rect x="42" y="40" width="17" height="7" fill="#14401f" />
        <rect x="43.5" y="41.5" width="14" height="4" fill="#4cb44a" />
        <rect x="45" y="41.5" width="3" height="4" fill="#a8f08a" />
        {/* suelo */}
        <rect x="0" y="56" width="64" height="8" fill="#d9b36a" />
        <rect x="0" y="56" width="64" height="3" fill="#6bd05a" />
        <rect x="0" y="55" width="64" height="1.5" fill="#2d6a24" />
        {/* pájaro */}
        <g transform="rotate(-8 25 33)">
      <path d="M17 22h3v3h-3zM20 22h3v3h-3zM23 22h3v3h-3zM26 22h3v3h-3zM14 25h3v3h-3zM29 25h3v3h-3zM32 25h3v3h-3zM35 25h3v3h-3zM11 28h3v3h-3zM26 28h3v3h-3zM35 28h3v3h-3zM11 31h3v3h-3zM26 31h3v3h-3zM35 31h3v3h-3zM11 34h3v3h-3zM29 34h3v3h-3zM32 34h3v3h-3zM35 34h3v3h-3zM14 37h3v3h-3zM29 37h3v3h-3zM17 40h3v3h-3zM20 40h3v3h-3zM23 40h3v3h-3zM26 40h3v3h-3zM32 40h3v3h-3z" fill="#2b1a0e" />
      <path d="M17 25h3v3h-3zM20 25h3v3h-3zM23 25h3v3h-3zM26 25h3v3h-3zM14 28h3v3h-3zM17 28h3v3h-3zM20 28h3v3h-3zM23 28h3v3h-3zM14 31h3v3h-3zM17 31h3v3h-3zM14 34h3v3h-3zM26 34h3v3h-3zM17 37h3v3h-3zM20 37h3v3h-3zM23 37h3v3h-3zM26 37h3v3h-3z" fill="#fbbf24" />
      <path d="M29 28h3v3h-3zM32 28h3v3h-3zM29 31h3v3h-3z" fill="#ffffff" />
      <path d="M20 31h3v3h-3zM23 31h3v3h-3zM17 34h3v3h-3zM20 34h3v3h-3zM23 34h3v3h-3z" fill="#fff6cf" />
      <path d="M32 31h3v3h-3z" fill="#111111" />
      <path d="M32 37h3v3h-3zM35 37h3v3h-3z" fill="#fb923c" />
      <path d="M35 40h3v3h-3z" fill="#ef4444" />
        </g>
        {/* moneda */}
        <rect x="31" y="46" width="5" height="7" fill="#92400e" />
        <rect x="32" y="47" width="3" height="5" fill="#fbbf24" />
      </g>
    </svg>
  )
}
