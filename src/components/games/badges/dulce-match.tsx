/** Portada de Dulce Match: tablero de dulces de colores con una carita feliz en el centro. */
const DULCES: [number, number, string][] = [
  [16, 16, '#f43f5e'],
  [32, 16, '#facc15'],
  [48, 16, '#38bdf8'],
  [16, 32, '#4ade80'],
  [48, 32, '#a78bfa'],
  [16, 48, '#fb923c'],
  [32, 48, '#f43f5e'],
  [48, 48, '#facc15'],
]

export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#1b0a14" />
      {DULCES.map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="6" fill={c} />
          <circle cx={x - 2} cy={y - 2} r="1.5" fill="#fff" opacity="0.7" />
        </g>
      ))}
      {/* dulce central: carita feliz */}
      <circle cx="32" cy="32" r="9" fill="#fb7185" style={{ filter: 'drop-shadow(0 0 6px #fb7185)' }} />
      <circle cx="29" cy="30" r="1.3" fill="#130709" />
      <circle cx="35" cy="30" r="1.3" fill="#130709" />
      <path d="M28.5 34 Q32 37 35.5 34" stroke="#130709" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
