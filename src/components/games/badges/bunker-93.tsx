/** Arte de portada (SVG 64x64): pasillo del búnker con un mutante y la escopeta. */
export function Badge() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      <rect width="64" height="64" rx="8" fill="#120707" />
      {/* techo y suelo en perspectiva */}
      <path d="M4 6h56L42 22H22z" fill="#2a2024" />
      <path d="M4 58h56L42 40H22z" fill="#3a2e2a" />
      <path d="M4 6l18 16v18L4 58z" fill="#40343a" />
      <path d="M60 6L42 22v18l18 18z" fill="#352a30" />
      {/* lámparas de alarma */}
      <rect x="29" y="9" width="6" height="3" fill="#ff3020" />
      <rect x="26" y="12" width="12" height="2" fill="#ff3020" opacity="0.35" />
      <rect x="6" y="20" width="3" height="5" fill="#ff3020" opacity="0.8" />
      <rect x="55" y="20" width="3" height="5" fill="#ff3020" opacity="0.8" />
      {/* fondo del pasillo con resplandor */}
      <rect x="22" y="22" width="20" height="18" fill="#5a1410" />
      <rect x="24" y="24" width="16" height="14" fill="#8a2014" />
      {/* mutante */}
      <rect x="29" y="23" width="6" height="5" fill="#c08c7a" />
      <rect x="30" y="25" width="1" height="1" fill="#fff060" />
      <rect x="33" y="25" width="1" height="1" fill="#fff060" />
      <rect x="27" y="28" width="10" height="7" fill="#b07868" />
      <rect x="24" y="27" width="3" height="7" fill="#9a6656" />
      <rect x="37" y="27" width="3" height="7" fill="#9a6656" />
      <rect x="23" y="34" width="1" height="3" fill="#f0e6cc" />
      <rect x="40" y="34" width="1" height="3" fill="#f0e6cc" />
      <rect x="28" y="35" width="3" height="5" fill="#8a5a4a" />
      <rect x="33" y="35" width="3" height="5" fill="#8a5a4a" />
      <rect x="30" y="29" width="4" height="3" fill="#5a1a18" />
      {/* escopeta en primera persona */}
      <path d="M29 42h6l4 22H25z" fill="#2c2e34" />
      <path d="M30 42h2l-2 22h-4z" fill="#5a606c" />
      <path d="M26 50h12l2 8H24z" fill="#6a4424" />
      <rect x="26" y="52" width="12" height="1" fill="#3a2410" />
      {/* fogonazo */}
      <path d="M32 33l2 4 4-1-3 3 3 3-4-1-2 4-2-4-4 1 3-3-3-3 4 1z" fill="#ffb030" />
      <rect x="31" y="38" width="2" height="2" fill="#fff8c0" />
      {/* marco HUD */}
      <rect x="4" y="58" width="56" height="2" fill="#ef4444" opacity="0.7" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="7.5" stroke="#ef4444" strokeOpacity="0.45" />
    </svg>
  )
}
