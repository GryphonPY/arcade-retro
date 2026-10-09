/** Portada de Café Michi: taza de café humeante con corazón y una cabecita de gato. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#1a0f14" />
      {/* vapor */}
      <path d="M22 24 Q20 20 23 16 M30 24 Q28 20 31 16 M38 24 Q36 20 39 16" stroke="#f9a8d4" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      {/* taza */}
      <path d="M14 30 H44 V44 Q44 54 34 54 H24 Q14 54 14 44 Z" fill="#fff7fb" />
      <path d="M44 34 Q54 34 54 42 Q54 50 44 50" stroke="#fff7fb" strokeWidth="4" fill="none" />
      {/* café */}
      <ellipse cx="29" cy="31" rx="15" ry="3" fill="#7c2d12" />
      {/* corazón en la taza */}
      <circle cx="27" cy="42" r="2" fill="#f472b6" />
      <circle cx="31" cy="42" r="2" fill="#f472b6" />
      <polygon points="25,43 33,43 29,47" fill="#f472b6" />
      {/* gatito asomado */}
      <polygon points="45,17 46,11 49,15" fill="#fbbf24" />
      <polygon points="55,17 54,11 51,15" fill="#fbbf24" />
      <circle cx="50" cy="20" r="6" fill="#fbbf24" />
      <circle cx="48" cy="19" r="1" fill="#1a0f14" />
      <circle cx="52" cy="19" r="1" fill="#1a0f14" />
    </svg>
  )
}
