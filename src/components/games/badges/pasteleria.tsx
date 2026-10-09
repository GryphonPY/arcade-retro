/** Portada de Pastelería en Pareja: pastel de dos pisos con betún rosa y una cereza encima. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#2a0f1e" />
      {/* plato */}
      <ellipse cx="32" cy="50" rx="24" ry="4" fill="#fff" opacity="0.15" />
      {/* piso de abajo */}
      <rect x="12" y="38" width="40" height="12" rx="3" fill="#fbcfe8" />
      {/* piso de arriba */}
      <rect x="18" y="27" width="28" height="11" rx="3" fill="#f9a8d4" />
      {/* betún */}
      <path d="M18 29 Q22 35 26 29 Q30 35 34 29 Q38 35 42 29 Q44 32 46 29 V26 H18 Z" fill="#fff" />
      {/* confeti */}
      <rect x="21" y="42" width="2" height="3" fill="#facc15" />
      <rect x="31" y="44" width="2" height="3" fill="#60a5fa" />
      <rect x="41" y="42" width="2" height="3" fill="#4ade80" />
      {/* cereza */}
      <circle cx="32" cy="21" r="3" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
      <path d="M32 18 Q33 13 37 12" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
