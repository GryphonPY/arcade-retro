/** Portada de Nidito: casita rosa con puerta de corazón y un corazón flotando. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#2b1420" />
      {/* casa */}
      <path d="M12 32 L32 14 L52 32 V52 H12 Z" fill="#fff1f6" />
      <path d="M8 33 L32 12 L56 33" stroke="#fda4af" strokeWidth="4" strokeLinejoin="round" fill="none" />
      {/* ventanas */}
      <rect x="17" y="36" width="7" height="7" rx="1" fill="#fde68a" />
      <rect x="40" y="36" width="7" height="7" rx="1" fill="#fde68a" />
      {/* puerta */}
      <rect x="27" y="40" width="10" height="12" rx="2" fill="#fb7185" />
      <circle cx="35" cy="46" r="1" fill="#fff1f6" />
      {/* corazón flotando */}
      <circle cx="44" cy="10" r="2.5" fill="#fda4af" />
      <circle cx="48" cy="10" r="2.5" fill="#fda4af" />
      <polygon points="41.6,11 50.4,11 46,16" fill="#fda4af" style={{ filter: 'drop-shadow(0 0 4px #fda4af)' }} />
    </svg>
  )
}
