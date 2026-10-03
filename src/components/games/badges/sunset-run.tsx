/** Portada de Sunset Run: carretera al atardecer con sol a franjas, palmeras y el deportivo rojo. */
export function Badge() {
  // franjas del sol (y, alto)
  const gaps = [
    [27, 0.8],
    [29.6, 1],
    [32, 1.3],
  ]
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1040" />
          <stop offset="0.45" stopColor="#7c2a6d" />
          <stop offset="0.8" stopColor="#e4515a" />
          <stop offset="1" stopColor="#ffb35a" />
        </linearGradient>
        <linearGradient id="sr-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff27a" />
          <stop offset="1" stopColor="#ff4f6a" />
        </linearGradient>
        <linearGradient id="sr-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2a072" />
          <stop offset="1" stopColor="#e9c98f" />
        </linearGradient>
        <radialGradient id="sr-glow" cx="0.5" cy="0.52" r="0.5">
          <stop offset="0" stopColor="#ff9a5a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff9a5a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="sr-clip">
          <rect width="64" height="64" rx="8" />
        </clipPath>
        <mask id="sr-sun-mask">
          <rect width="64" height="64" fill="#fff" />
          {gaps.map(([y, h]) => (
            <rect key={y} x="0" y={y} width="64" height={h} fill="#000" />
          ))}
        </mask>
      </defs>
      <g clipPath="url(#sr-clip)" shapeRendering="crispEdges">
        <rect width="64" height="64" fill="url(#sr-sky)" />
        <rect x="6" y="6" width="52" height="40" fill="url(#sr-glow)" shapeRendering="auto" />
        {/* nubes */}
        <rect x="6" y="11" width="16" height="1.5" fill="#f08a9a" opacity="0.8" />
        <rect x="9" y="12.5" width="14" height="1" fill="#5a2060" opacity="0.6" />
        <rect x="40" y="15" width="18" height="1.5" fill="#f08a9a" opacity="0.8" />
        <rect x="44" y="16.5" width="12" height="1" fill="#5a2060" opacity="0.6" />
        {/* sol */}
        <circle cx="32" cy="31" r="13" fill="url(#sr-sun)" mask="url(#sr-sun-mask)" shapeRendering="auto" />
        {/* montañas */}
        <path d="M0 37 L8 31 L14 34 L22 28 L30 35 L36 33 L44 27 L52 33 L58 30 L64 33 V38 H0Z" fill="#6e2a5e" />
        <path d="M0 38 L10 34 L18 36 L26 33 L34 37 L46 34 L56 36 L64 34 V39 H0Z" fill="#3e1a45" />
        {/* suelo */}
        <rect x="0" y="38" width="64" height="26" fill="url(#sr-ground)" />
        {/* carretera */}
        <path d="M30.5 38 H33.5 L60 64 H4 Z" fill="#6e6c78" />
        <path d="M30.5 38 L29.8 38 L1 64 H4 Z" fill="#f4f1ea" />
        <path d="M33.5 38 L34.2 38 L63 64 H60 Z" fill="#f4f1ea" />
        <path d="M29.4 42 L28.2 44 L24.6 50 L22.8 53 L18 61 L16.2 64 H12.6 L14.6 61 L20.2 53 L22.2 50 L26.4 44 L27.8 42Z" fill="#d7352f" />
        <path d="M34.6 42 L35.8 44 L39.4 50 L41.2 53 L46 61 L47.8 64 H51.4 L49.4 61 L43.8 53 L41.8 50 L37.6 44 L36.2 42Z" fill="#d7352f" />
        <path d="M31.7 41 h0.6 v2 h-0.6Z M31.5 46 h1 v3 h-1Z M31.2 53 h1.6 v4 h-1.6Z" fill="#f7f3e8" />
        {/* palmeras */}
        <g fill="#2a0f3c">
          <path d="M7 50 L8.4 50 L10.4 30 L9.2 30 Z" />
          <path d="M9.8 30 C6 27 3 28 1 31 C4 29.5 7 29.5 9.6 31 Z" />
          <path d="M9.8 30 C13 26.5 17 27 19 30 C16 28.6 13 29 10.2 31 Z" />
          <path d="M9.8 30 C8 25 5 24 2.5 24.5 C5.5 25.5 8 27.5 9.4 30.5 Z" />
          <path d="M9.8 30 C11.5 25 15 23.6 17.5 24.2 C14.5 25.4 12 27.4 10.4 30.6 Z" />
          <path d="M55.6 52 L57 52 L54.4 33 L53.4 33 Z" />
          <path d="M54 33 C50.6 30.4 47.4 31 45.6 33.6 C48.6 32.4 51.4 32.6 53.8 34 Z" />
          <path d="M54 33 C57 30 60.6 30.4 62.6 33 C59.6 31.8 57 32.4 54.4 34 Z" />
          <path d="M54 33 C52.6 28.6 49.8 27.6 47.6 28 C50.4 29 52.6 30.8 53.6 33.6 Z" />
          <path d="M54 33 C55.6 28.6 58.6 27.4 61 28 C58.2 29.2 56 31 54.6 33.8 Z" />
        </g>
        {/* coche (vista trasera) */}
        <g>
          <rect x="21" y="58.5" width="22" height="2" fill="#000" opacity="0.35" />
          <rect x="21.5" y="55.5" width="4" height="4.5" fill="#121214" />
          <rect x="38.5" y="55.5" width="4" height="4.5" fill="#121214" />
          <rect x="22" y="50" width="20" height="6.5" fill="#e3262f" />
          <rect x="22" y="50" width="20" height="0.8" fill="#ff7a6b" />
          <rect x="23.2" y="51.6" width="17.6" height="2.6" fill="#121214" />
          <rect x="23.8" y="52" width="6.4" height="1.8" fill="#ff3b3b" />
          <rect x="33.8" y="52" width="6.4" height="1.8" fill="#ff3b3b" />
          <rect x="30.4" y="54.4" width="3.2" height="1.4" fill="#f1eedd" />
          <rect x="24.5" y="47.6" width="15" height="2.6" fill="#e3262f" />
          <rect x="26" y="45.8" width="12" height="1.8" fill="#26304a" />
          <rect x="27" y="44.2" width="2.6" height="2.6" fill="#3b2414" />
          <rect x="34.2" y="43.8" width="2.6" height="3" fill="#f3c341" />
          <rect x="36.8" y="44.6" width="1.4" height="1" fill="#f3c341" />
        </g>
      </g>
    </svg>
  )
}
