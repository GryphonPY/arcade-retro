/** Arte de portada (SVG 64x64): nave ARCO frente a un jefe entre balas neón. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ns-neb1" cx="22%" cy="30%" r="60%">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ns-neb2" cx="80%" cy="62%" r="55%">
          <stop offset="0" stopColor="#c026d3" stopOpacity="0.45" />
          <stop offset="1" stopColor="#c026d3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ns-orb" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ff4fa3" />
          <stop offset="1" stopColor="#ff4fa3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ns-orb2" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ns-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ns-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ns-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="8" fill="#050816" />
      <g clipPath="url(#ns-clip)">
        <rect width="64" height="64" fill="url(#ns-neb1)" />
        <rect width="64" height="64" fill="url(#ns-neb2)" />
        {/* estrellas */}
        <g fill="#e0f2fe">
          <rect x="6" y="40" width="1" height="1" />
          <rect x="55" y="34" width="1" height="1" />
          <rect x="12" y="22" width="1" height="1" />
          <rect x="49" y="50" width="1" height="1" />
          <rect x="58" y="12" width="1" height="1" opacity="0.7" />
          <rect x="4" y="56" width="1" height="1" opacity="0.6" />
        </g>
        {/* jefe */}
        <g stroke="#f472b6" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M14 6 L26 7 L29 3 L35 3 L38 7 L50 6 L54 10 L46 13 L38 12 L35 17 L29 17 L26 12 L18 13 L10 10 Z" fill="#3b1030" />
          <path d="M29 5 L35 5 L36 10 L32 14 L28 10 Z" fill="#5a1a48" />
        </g>
        <circle cx="32" cy="9.5" r="4" fill="url(#ns-core)" />
        <circle cx="17" cy="10" r="1.6" fill="#fde68a" />
        <circle cx="47" cy="10" r="1.6" fill="#fde68a" />
        {/* lluvia de balas */}
        <g>
          {[
            [20, 22],
            [26, 20],
            [38, 20],
            [44, 22],
            [14, 27],
            [50, 27],
            [24, 30],
            [40, 30],
            [32, 24],
          ].map(([x, y]) => (
            <circle key={`a${x}-${y}`} cx={x} cy={y} r="2.2" fill="url(#ns-orb)" />
          ))}
          {[
            [9, 34],
            [55, 34],
            [18, 38],
            [46, 38],
          ].map(([x, y]) => (
            <circle key={`b${x}-${y}`} cx={x} cy={y} r="2" fill="url(#ns-orb2)" />
          ))}
        </g>
        {/* disparos del jugador */}
        <rect x="29.6" y="26" width="1.4" height="20" fill="url(#ns-beam)" />
        <rect x="33" y="26" width="1.4" height="20" fill="url(#ns-beam)" />
        <path d="M26 46 L22 30" stroke="#67e8f9" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <path d="M38 46 L42 30" stroke="#67e8f9" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        {/* nave ARCO */}
        <g stroke="#22d3ee" strokeWidth="0.7" strokeLinejoin="round">
          <path d="M28 51 L21 55 L20 59 L24 58.5 L28 56 Z" fill="#0c3a4a" />
          <path d="M36 51 L43 55 L44 59 L40 58.5 L36 56 Z" fill="#0c3a4a" />
          <path d="M32 43 L34 47 L35 52 L35 58 L33.5 60.5 L30.5 60.5 L29 58 L29 52 L30 47 Z" fill="#124a5c" />
        </g>
        <path d="M32 46 L33 49 L33 51.5 L31 51.5 L31 49 Z" fill="#cffafe" />
        <rect x="19.6" y="57" width="1.2" height="2.4" fill="#22d3ee" />
        <rect x="43.2" y="57" width="1.2" height="2.4" fill="#22d3ee" />
        <ellipse cx="32" cy="62.5" rx="2.2" ry="2.5" fill="#22d3ee" opacity="0.6" />
        <circle cx="32" cy="53" r="1.3" fill="#ffffff" />
        <circle cx="32" cy="53" r="2.2" stroke="#22d3ee" strokeWidth="0.5" />
      </g>
      <rect x="0.5" y="0.5" width="63" height="63" rx="7.5" stroke="#22d3ee" strokeOpacity="0.35" />
    </svg>
  )
}
