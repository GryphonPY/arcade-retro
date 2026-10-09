/** Portada de Fútbol Cabezón: cancha verde con dos jugadores de cabeza enorme y el balón. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0b1a0e" />
      {/* cancha */}
      <rect x="3" y="3" width="58" height="58" rx="3" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      <line x1="32" y1="3" x2="32" y2="61" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      <circle cx="32" cy="32" r="8" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      {/* jugador azul: cabeza enorme, cuerpito */}
      <circle cx="20" cy="24" r="9" fill="#60a5fa" />
      <rect x="16" y="33" width="8" height="10" rx="2" fill="#60a5fa" opacity="0.7" />
      <circle cx="17" cy="23" r="1.5" fill="#0b1a0e" />
      <circle cx="23" cy="23" r="1.5" fill="#0b1a0e" />
      {/* jugadora rosa */}
      <circle cx="44" cy="24" r="9" fill="#f472b6" />
      <rect x="40" y="33" width="8" height="10" rx="2" fill="#f472b6" opacity="0.7" />
      <circle cx="41" cy="23" r="1.5" fill="#0b1a0e" />
      <circle cx="47" cy="23" r="1.5" fill="#0b1a0e" />
      {/* balón */}
      <circle cx="32" cy="48" r="4" fill="#fff" style={{ filter: 'drop-shadow(0 0 4px #a3e635)' }} />
    </svg>
  )
}
