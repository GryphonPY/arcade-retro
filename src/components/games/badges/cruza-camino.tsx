/** Arte de portada (SVG 64x64) para la sala: pollito cruzando carretera, río y vías. */
export function Badge() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <rect width="64" height="64" rx="8" fill="#0b1f18" />
      {/* pasto superior */}
      <rect x="0" y="0" width="64" height="12" rx="8" fill="#4cc760" />
      <rect x="0" y="8" width="64" height="4" fill="#4cc760" />
      <rect x="0" y="12" width="64" height="3" fill="#2f8f45" />
      {/* arbolito */}
      <rect x="9" y="3" width="6" height="7" fill="#7a4a2a" />
      <rect x="6" y="0" width="12" height="5" fill="#2e9d4a" />
      {/* río */}
      <rect x="0" y="15" width="64" height="13" fill="#2b8fd9" />
      <rect x="0" y="15" width="64" height="3" fill="#1f78bd" />
      <rect x="6" y="21" width="22" height="6" fill="#8a5a33" />
      <rect x="6" y="21" width="22" height="2" fill="#a8743f" />
      <rect x="26" y="21" width="2" height="6" fill="#c99a62" />
      <rect x="40" y="24" width="8" height="2" fill="#6cc0f2" />
      <rect x="50" y="19" width="6" height="2" fill="#6cc0f2" />
      {/* carretera */}
      <rect x="0" y="28" width="64" height="16" fill="#454a5a" />
      <rect x="4" y="35" width="8" height="2" fill="#e6e8ef" />
      <rect x="20" y="35" width="8" height="2" fill="#e6e8ef" />
      <rect x="36" y="35" width="8" height="2" fill="#e6e8ef" />
      <rect x="52" y="35" width="8" height="2" fill="#e6e8ef" />
      {/* coche rojo */}
      <rect x="35" y="38" width="22" height="2" fill="#000" opacity="0.3" />
      <rect x="35" y="30" width="22" height="9" rx="2" fill="#ff5a5f" />
      <rect x="40" y="32" width="9" height="5" fill="#ffd1d3" />
      <rect x="55" y="31" width="2" height="2" fill="#fff6b0" />
      <rect x="55" y="36" width="2" height="2" fill="#fff6b0" />
      {/* vías */}
      <rect x="0" y="44" width="64" height="12" fill="#8c7b68" />
      <rect x="4" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="14" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="24" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="34" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="44" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="54" y="44" width="3" height="12" fill="#5b4636" />
      <rect x="0" y="47" width="64" height="2" fill="#d5dae3" />
      <rect x="0" y="52" width="64" height="2" fill="#d5dae3" />
      <rect x="0" y="56" width="64" height="8" rx="8" fill="#4cc760" />
      <rect x="0" y="56" width="64" height="4" fill="#4cc760" />
      {/* pollito */}
      <rect x="21" y="45" width="14" height="3" fill="#000" opacity="0.28" />
      <rect x="24" y="37" width="3" height="8" fill="#ff9a3c" />
      <rect x="29" y="37" width="3" height="8" fill="#ff9a3c" />
      <rect x="20" y="30" width="16" height="14" rx="3" fill="#f0b81f" />
      <rect x="20" y="29" width="16" height="12" rx="3" fill="#ffd83a" />
      <rect x="27" y="25" width="2" height="4" fill="#ff5a4a" />
      <rect x="24" y="26" width="2" height="4" fill="#ff5a4a" />
      <rect x="24" y="32" width="2" height="3" fill="#111" />
      <rect x="31" y="32" width="2" height="3" fill="#111" />
      <rect x="24" y="32" width="1" height="1" fill="#fff" />
      <rect x="31" y="32" width="1" height="1" fill="#fff" />
      <rect x="26" y="36" width="4" height="3" fill="#ff8a1f" />
    </svg>
  )
}
