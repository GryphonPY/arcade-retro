/** Arte de portada (SVG 64x64): cancha vertical neón con paletas azul y rosa y la bola con estela. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0a0f1e" />
      <rect x="1" y="1" width="62" height="62" rx="7" stroke="#60a5fa" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="0" y="0" width="64" height="32" rx="8" fill="#f472b6" fillOpacity="0.06" />
      <path d="M6 32H58" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="32" cy="32" r="8" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1" />
      {/* paletas */}
      <rect x="16" y="9" width="20" height="4" rx="2" fill="#f472b6" />
      <rect x="16" y="9" width="20" height="4" rx="2" fill="#f472b6" opacity="0.4" transform="translate(0 0)" />
      <rect x="28" y="51" width="20" height="4" rx="2" fill="#60a5fa" />
      {/* estela y bola */}
      <circle cx="40" cy="20" r="1.5" fill="#f472b6" opacity="0.25" />
      <circle cx="37.5" cy="25" r="2" fill="#a78bfa" opacity="0.4" />
      <circle cx="35" cy="30" r="2.6" fill="#93c5fd" opacity="0.6" />
      <circle cx="32.5" cy="36" r="3.4" fill="#ffffff" />
      <circle cx="32.5" cy="36" r="5.5" fill="#60a5fa" opacity="0.25" />
    </svg>
  )
}
