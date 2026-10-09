/** Portada de Chocones: ring circular con dos autos chocando y una mancha de aceite. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#141008" />
      {/* ring */}
      <circle cx="32" cy="32" r="25" stroke="#facc15" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="32" cy="32" r="19" fill="#1f1a0c" />
      {/* mancha de aceite */}
      <ellipse cx="22" cy="42" rx="5" ry="3" fill="#000" opacity="0.6" />
      {/* auto amarillo */}
      <g transform="translate(24 29) rotate(-20)">
        <rect x="-6" y="-4" width="12" height="8" rx="2" fill="#facc15" style={{ filter: 'drop-shadow(0 0 4px #facc15)' }} />
        <rect x="-2" y="-3" width="4" height="6" rx="1" fill="#141008" opacity="0.6" />
      </g>
      {/* auto rosa */}
      <g transform="translate(40 35) rotate(160)">
        <rect x="-6" y="-4" width="12" height="8" rx="2" fill="#f472b6" style={{ filter: 'drop-shadow(0 0 4px #f472b6)' }} />
        <rect x="-2" y="-3" width="4" height="6" rx="1" fill="#141008" opacity="0.6" />
      </g>
      {/* chispas del choque */}
      <circle cx="32" cy="32" r="1.5" fill="#fff" />
      <circle cx="34" cy="29" r="1" fill="#fde68a" />
      <circle cx="30" cy="36" r="1" fill="#fde68a" />
    </svg>
  )
}
