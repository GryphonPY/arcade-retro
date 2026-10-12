/** Portada de Topo Loco: topo asomado del hoyo y el mazo a punto de caer. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ec8ff" />
          <stop offset="1" stopColor="#c9f0ff" />
        </linearGradient>
        <clipPath id="topo-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
        <clipPath id="topo-hole">
          <rect x="0" y="0" width="64" height="47" />
        </clipPath>
      </defs>
      <g clipPath="url(#topo-clip)">
        <rect width="64" height="64" fill="url(#topo-sky)" />
        <circle cx="54" cy="10" r="5" fill="#ffd84a" stroke="#2b1a12" strokeWidth="1.5" />
        <path d="M0 30q16-8 32-2t32-2v38H0z" fill="#8fd96a" />
        <rect y="34" width="64" height="30" fill="#6ad05c" />
        <rect y="46" width="64" height="9" fill="#5cc451" />
        {/* hoyo */}
        <ellipse cx="30" cy="48" rx="20" ry="7" fill="#a8693a" stroke="#2b1a12" strokeWidth="1.5" />
        <ellipse cx="30" cy="47" rx="15" ry="4.5" fill="#2a140a" />
        {/* topo */}
        <g clipPath="url(#topo-hole)">
          <path d="M19 52V31c0-12 22-12 22 0v21z" fill="#8a5a3c" stroke="#2b1a12" strokeWidth="2" />
          <ellipse cx="30" cy="43" rx="7" ry="8" fill="#e8c9a2" />
          <circle cx="26" cy="30" r="2.2" fill="#2b1a12" />
          <circle cx="34" cy="30" r="2.2" fill="#2b1a12" />
          <circle cx="25.4" cy="29.3" r="0.8" fill="#fff" />
          <circle cx="33.4" cy="29.3" r="0.8" fill="#fff" />
          <ellipse cx="22" cy="34.5" rx="2" ry="1.2" fill="#ff6e8c" opacity="0.6" />
          <ellipse cx="38" cy="34.5" rx="2" ry="1.2" fill="#ff6e8c" opacity="0.6" />
          <ellipse cx="30" cy="35" rx="4" ry="3" fill="#e8c9a2" stroke="#2b1a12" strokeWidth="1.2" />
          <ellipse cx="30" cy="33.6" rx="2.4" ry="1.8" fill="#ff7aa2" stroke="#2b1a12" strokeWidth="1" />
          <rect x="28.4" y="37" width="3.2" height="2.6" fill="#fff" stroke="#2b1a12" strokeWidth="0.8" />
        </g>
        <path d="M10 48a20 7 0 0 0 40 0" stroke="#c4834d" strokeWidth="3" />
        <path d="M9.5 48.5a20.5 8 0 0 0 41 0" stroke="#2b1a12" strokeWidth="1.5" />
        {/* mazo */}
        <g transform="rotate(-35 46 22)">
          <rect x="38" y="20" width="26" height="5" rx="2.5" fill="#d9a066" stroke="#2b1a12" strokeWidth="1.5" />
          <rect x="30" y="12" width="12" height="21" rx="3.5" fill="#ff4d5e" stroke="#2b1a12" strokeWidth="2" />
          <rect x="32" y="14" width="3" height="17" fill="#ff8a95" />
        </g>
        {/* líneas de movimiento */}
        <path d="M50 34l5 3M52 28l6 1" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
