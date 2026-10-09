/** Portada de Artillería: dos tanques en lomas verdes, con un proyectil describiendo su arco. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0d1a2a" />
      {/* sol */}
      <circle cx="50" cy="14" r="5" fill="#fde68a" opacity="0.8" />
      {/* lomas */}
      <path d="M0 44 Q16 30 32 42 T64 38 V64 H0 Z" fill="#3f6212" />
      <path d="M0 52 Q20 44 40 52 T64 50 V64 H0 Z" fill="#365314" />
      {/* tanque izquierdo (lima) con cañón */}
      <rect x="8" y="40" width="14" height="6" rx="2" fill="#84cc16" />
      <rect x="11" y="36" width="8" height="5" rx="2" fill="#a3e635" />
      <line x1="19" y1="38" x2="27" y2="32" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" />
      {/* tanque derecho (rojo) */}
      <rect x="42" y="42" width="14" height="6" rx="2" fill="#ef4444" />
      <rect x="45" y="38" width="8" height="5" rx="2" fill="#f87171" />
      {/* trayectoria y proyectil */}
      <path d="M27 32 Q34 4 46 40" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 2" fill="none" />
      <circle cx="35" cy="20" r="2" fill="#fde68a" style={{ filter: 'drop-shadow(0 0 4px #fde68a)' }} />
      {/* impacto */}
      <circle cx="46" cy="40" r="6" fill="#f97316" opacity="0.35" />
    </svg>
  )
}
