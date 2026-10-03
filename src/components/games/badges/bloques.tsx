/** Arte de portada (SVG 64x64) para la sala: pila de tetrominós con una T neón cayendo. */
const S = 6
const OX = 11
const OY = 11

// [columna, fila, color]
const STACK: [number, number, string][] = [
  // L naranja
  [0, 5, '#fb923c'], [0, 6, '#fb923c'], [1, 6, '#fb923c'], [2, 6, '#fb923c'],
  // S verde
  [1, 5, '#4ade80'], [2, 5, '#4ade80'], [2, 4, '#4ade80'], [3, 4, '#4ade80'],
  // J azul
  [3, 6, '#3b82f6'], [3, 5, '#3b82f6'], [4, 6, '#3b82f6'],
  // O amarillo
  [4, 5, '#facc15'], [5, 5, '#facc15'], [5, 6, '#facc15'],
  // I cian
  [6, 3, '#22d3ee'], [6, 4, '#22d3ee'], [6, 5, '#22d3ee'], [6, 6, '#22d3ee'],
]

const TPIECE: [number, number][] = [
  [2, 0],
  [3, 0],
  [4, 0],
  [3, 1],
]

export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bq-bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1b1438" />
          <stop offset="1" stopColor="#0d0a1e" />
        </linearGradient>
        <filter id="bq-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="8" fill="url(#bq-bg)" />
      <rect x="9.5" y="9.5" width="45" height="45" rx="2" stroke="#a78bfa" strokeOpacity="0.55" />
      {/* rejilla tenue */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i} stroke="#ffffff" strokeOpacity="0.05">
          <path d={`M${OX + i * S} 11V53`} />
          <path d={`M11 ${OY + i * S}H53`} />
        </g>
      ))}
      {/* estela de caída */}
      <rect x={OX + 3 * S} y={OY} width={S} height={S * 3} fill="#a78bfa" fillOpacity="0.1" />
      {/* fantasma de la T */}
      <g stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="1">
        {TPIECE.map(([c, r], i) => (
          <rect key={i} x={OX + c * S + 0.5} y={OY + (r + 3) * S + 0.5} width={S - 1} height={S - 1} />
        ))}
      </g>
      {/* pila */}
      {STACK.map(([c, r, col], i) => (
        <g key={i}>
          <rect x={OX + c * S} y={OY + r * S} width={S} height={S} fill={col} />
          <rect x={OX + c * S} y={OY + r * S} width={S} height="1.4" fill="#ffffff" fillOpacity="0.45" />
          <rect x={OX + c * S} y={OY + r * S + S - 1.4} width={S} height="1.4" fill="#000000" fillOpacity="0.28" />
          <rect x={OX + c * S} y={OY + r * S} width={S} height={S} stroke="#0d0a1e" strokeOpacity="0.8" strokeWidth="0.6" />
        </g>
      ))}
      {/* T neón cayendo */}
      <g filter="url(#bq-glow)" opacity="0.9">
        {TPIECE.map(([c, r], i) => (
          <rect key={i} x={OX + c * S} y={OY + r * S} width={S} height={S} fill="#a78bfa" />
        ))}
      </g>
      {TPIECE.map(([c, r], i) => (
        <g key={i}>
          <rect x={OX + c * S} y={OY + r * S} width={S} height={S} fill="#a78bfa" />
          <rect x={OX + c * S} y={OY + r * S} width={S} height="1.6" fill="#ffffff" fillOpacity="0.6" />
          <rect x={OX + c * S} y={OY + r * S + S - 1.4} width={S} height="1.4" fill="#000000" fillOpacity="0.3" />
          <rect x={OX + c * S} y={OY + r * S} width={S} height={S} stroke="#0d0a1e" strokeOpacity="0.8" strokeWidth="0.6" />
        </g>
      ))}
    </svg>
  )
}
