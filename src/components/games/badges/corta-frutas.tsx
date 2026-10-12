/** Portada de Corta Frutas: sandía partida por un tajo de espada sobre la tabla. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="corta-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#corta-clip)">
        {/* tabla de madera */}
        <rect width="64" height="64" fill="#9a6238" />
        <rect x="0" width="16" height="64" fill="#a86c3e" />
        <rect x="32" width="16" height="64" fill="#a86c3e" />
        <path d="M16 0v64M32 0v64M48 0v64" stroke="#5a3418" strokeWidth="1" opacity="0.6" />
        {/* mancha de jugo */}
        <path d="M8 46c4-6 12-5 15 0s-2 10-8 9-10-4-7-9z" fill="#ef3b4f" opacity="0.55" />
        <circle cx="26" cy="52" r="2" fill="#ef3b4f" opacity="0.55" />
        <circle cx="6" cy="40" r="1.5" fill="#ef3b4f" opacity="0.55" />
        {/* mitad de arriba de la sandía */}
        <g transform="translate(-3 -4) rotate(-8 32 30)">
          <path d="M12 32a20 17 0 0 1 40 0z" fill="#1f6e2a" stroke="#2a1610" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M16 31a16 13 0 0 1 32 0z" fill="#3fae3a" />
          <path d="M22 20q2 6 0 11M32 16q2 7 0 15M42 20q-2 6 0 11" stroke="#1f6e2a" strokeWidth="2.5" />
          <ellipse cx="32" cy="32" rx="20" ry="6" fill="#fff2c4" stroke="#2a1610" strokeWidth="2.2" />
          <ellipse cx="32" cy="32" rx="16.5" ry="4.2" fill="#ff4d5e" />
          <path d="M25 32h1.6M31 31h1.6M37 32.5h1.6" stroke="#2a1610" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        {/* mitad de abajo de la sandía */}
        <g transform="translate(3 6) rotate(-8 32 30)">
          <path d="M12 32a20 17 0 0 0 40 0z" fill="#1f6e2a" stroke="#2a1610" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M16 33a16 13 0 0 0 32 0z" fill="#3fae3a" />
          <ellipse cx="32" cy="32" rx="20" ry="6" fill="#fff2c4" stroke="#2a1610" strokeWidth="2.2" />
          <ellipse cx="32" cy="32" rx="16.5" ry="4.2" fill="#ff4d5e" />
          <path d="M27 32.5h1.6M35 31.5h1.6" stroke="#2a1610" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        {/* tajo de la espada */}
        <path d="M2 40 L62 22" stroke="#7fe8ff" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
        <path d="M4 39.5 L61 22.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        {/* gotas */}
        <circle cx="48" cy="12" r="2.2" fill="#ff4d5e" />
        <circle cx="54" cy="16" r="1.4" fill="#ff4d5e" />
        <circle cx="14" cy="50" r="1.6" fill="#ff4d5e" />
        {/* chispa */}
        <path d="M58 8l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#fff7a6" />
      </g>
    </svg>
  )
}
