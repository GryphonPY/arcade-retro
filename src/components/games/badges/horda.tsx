/** Arte de portada (SVG 64x64) para la sala: héroe encapuchado rodeado de orbes, murciélagos y lápidas bajo la luna. */
const BATS: [number, number][] = [
  [8, 14],
  [50, 20],
  [12, 40],
  [53, 44],
]

function Bat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#fb7185">
      <rect x="0" y="0" width="2" height="2" />
      <rect x="2" y="1" width="2" height="2" />
      <rect x="4" y="0" width="2" height="3" fill="#e11d48" />
      <rect x="6" y="1" width="2" height="2" />
      <rect x="8" y="0" width="2" height="2" />
      <rect x="3" y="3" width="4" height="2" fill="#e11d48" />
      <rect x="4" y="1" width="1" height="1" fill="#fff" />
      <rect x="5" y="1" width="1" height="1" fill="#fff" />
    </g>
  )
}

export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hd-glow" cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="#c084fc" stopOpacity="0.45" />
          <stop offset="1" stopColor="#c084fc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="8" fill="#150d24" />
      <rect width="64" height="64" rx="8" fill="url(#hd-glow)" />
      {/* luna */}
      <circle cx="49" cy="13" r="7" fill="#f5e9ff" />
      <circle cx="52" cy="11" r="6" fill="#150d24" />
      {/* estrellas */}
      <g fill="#e9d5ff">
        <rect x="10" y="7" width="1.5" height="1.5" />
        <rect x="26" y="10" width="1" height="1" />
        <rect x="36" y="5" width="1.5" height="1.5" />
        <rect x="20" y="22" width="1" height="1" />
      </g>
      {/* suelo */}
      <rect x="0" y="52" width="64" height="12" fill="#1f1433" />
      <rect x="0" y="52" width="64" height="1.5" fill="#2e1f4a" />
      {/* lápidas */}
      <g fill="#6b6280">
        <rect x="6" y="46" width="7" height="9" rx="3" />
        <rect x="50" y="48" width="7" height="8" rx="3" />
      </g>
      <g fill="#3b3350">
        <rect x="8.5" y="48" width="2" height="5" />
        <rect x="7" y="50" width="5" height="1.5" />
      </g>
      {/* aro de orbes */}
      <ellipse cx="32" cy="38" rx="19" ry="14" stroke="#c084fc" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="13" cy="38" r="3.2" fill="#e9d5ff" />
      <circle cx="13" cy="38" r="1.6" fill="#a855f7" />
      <circle cx="51" cy="38" r="3.2" fill="#e9d5ff" />
      <circle cx="51" cy="38" r="1.6" fill="#a855f7" />
      <circle cx="32" cy="52" r="3.2" fill="#e9d5ff" />
      <circle cx="32" cy="52" r="1.6" fill="#a855f7" />
      {/* héroe */}
      <g>
        <rect x="26" y="26" width="12" height="3" fill="#2a1250" />
        <rect x="25" y="28" width="14" height="14" fill="#a855f7" />
        <rect x="27" y="25" width="10" height="4" fill="#a855f7" />
        <rect x="27" y="29" width="10" height="7" fill="#fde7c6" />
        <rect x="29" y="31" width="2" height="2.5" fill="#1b1033" />
        <rect x="33" y="31" width="2" height="2.5" fill="#1b1033" />
        <rect x="25" y="38" width="14" height="5" fill="#7e22ce" />
        <rect x="27" y="43" width="3.5" height="3" fill="#2a1250" />
        <rect x="33.5" y="43" width="3.5" height="3" fill="#2a1250" />
      </g>
      {/* chispa de arma */}
      <path d="M40 30 L46 24 M43 32 L52 31" stroke="#fde047" strokeWidth="1.6" strokeLinecap="square" />
      {BATS.map(([x, y]) => (
        <Bat key={`${x}-${y}`} x={x} y={y} />
      ))}
    </svg>
  )
}
