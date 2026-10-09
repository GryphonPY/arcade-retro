/** Portada de Guerra de Castillos: dos castillos enfrentados por carriles y soldados en marcha. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#1a1205" />
      {/* carriles */}
      <path d="M0 22H64M0 42H64" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 3" />
      {/* castillo azul */}
      <g fill="#3b82f6">
        <rect x="2" y="26" width="12" height="22" />
        <rect x="2" y="22" width="3" height="4" />
        <rect x="7.5" y="22" width="3" height="4" />
        <rect x="13" y="22" width="3" height="4" />
      </g>
      {/* castillo rojo */}
      <g fill="#ef4444">
        <rect x="50" y="26" width="12" height="22" />
        <rect x="50" y="22" width="3" height="4" />
        <rect x="55.5" y="22" width="3" height="4" />
        <rect x="61" y="22" width="3" height="4" />
      </g>
      {/* soldados */}
      <g fill="#93c5fd">
        <circle cx="22" cy="32" r="2.5" />
        <rect x="20" y="34" width="4" height="6" />
      </g>
      <g fill="#fca5a5">
        <circle cx="42" cy="32" r="2.5" />
        <rect x="40" y="34" width="4" height="6" />
      </g>
      {/* catapulta lanzando una piedra */}
      <path d="M28 50 Q32 36 36 50" stroke="#fbbf24" strokeWidth="2" fill="none" />
      <circle cx="32" cy="30" r="2.5" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px #fbbf24)' }} />
    </svg>
  )
}
