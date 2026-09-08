'use client'

import { useCallback, useEffect, useState } from 'react'
import SnakeNeon from '@/components/games/snake-neon'
import SpaceInvasion from '@/components/games/space-invasion'
import DesertRunner from '@/components/games/desert-runner'
import GhostMaze from '@/components/games/ghost-maze'
import TrafficRacer from '@/components/games/traffic-racer'
import BrickBreaker from '@/components/games/brick-breaker'
import HitAndRun from '@/components/games/hit-and-run'
import GunAndRun from '@/components/games/gun-and-run'
import AsteroidDrift from '@/components/games/asteroid-drift'
import CyberDungeon from '@/components/games/cyber-dungeon'
import { CartridgeBadge } from '@/components/games/cartridge-badge'
import { loadBest } from '@/components/games/game-utils'
import { sfx, loadMutePref, setMuted } from '@/components/games/sfx'
import { loadMusicPref, setMusicEnabled, primeMusic, startMusic } from '@/components/games/music'

interface GameMeta {
  id: string
  name: string
  cartCode: string
  megaSpec: string
  tag: string
  desc: string
  controls: string
  accent: string
  borderAccent: string
  textColor: string
  viewBg: string
}

const GAMES: GameMeta[] = [
  {
    id: 'asteroid-drift',
    name: 'Asteroid Drift 360°',
    cartCode: 'NGM-009',
    megaSpec: 'VECTOR 256-MEGA',
    tag: '360° Inercial',
    desc: 'Física espacial inercial 360°: destruye asteroides vectoriales y ovnis alienígenas.',
    controls: '← → giro · ↑ empuje · ESPACIO láser · ↓ warp',
    accent: '#38bdf8',
    borderAccent: '#0284c7',
    textColor: '#e0f2fe',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(56,189,248,0.15), transparent), #050710',
  },
  {
    id: 'cyber-dungeon',
    name: 'Cyber Dungeon Slayer',
    cartCode: 'NGM-010',
    megaSpec: 'ROGUE 330-MEGA',
    tag: 'Mazmorra Rogue',
    desc: 'Explora pisos de mazmorra, corta esqueletos con tu espada y halla la Llave Dorada.',
    controls: 'Flechas / WASD · ESPACIO espada · SHIFT poción',
    accent: '#f59e0b',
    borderAccent: '#d97706',
    textColor: '#fef3c7',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(245,158,11,0.16), transparent), #100c08',
  },
  {
    id: 'snake-neon',
    name: 'Snake Neón',
    cartCode: 'NGM-001',
    megaSpec: 'MAX 330 MEGA',
    tag: 'Synthwave',
    desc: 'La serpiente clásica en una rejilla de neón que late al ritmo de tus puntos.',
    controls: '↑ ↓ ← → / WASD',
    accent: '#22f7c5',
    borderAccent: '#059669',
    textColor: '#9BF5E0',
    viewBg: 'radial-gradient(900px 480px at 50% -10%, rgba(176,38,255,0.22), transparent), radial-gradient(700px 420px at 80% 110%, rgba(34,247,197,0.14), transparent), #0C0A14',
  },
  {
    id: 'space-invasion',
    name: 'Invasión Espacial',
    cartCode: 'NGM-002',
    megaSpec: 'PRO-GEAR 100M',
    tag: 'Pixel Retro',
    desc: 'Oleadas de invasores pixelados descienden. Tú eres la última línea de defensa.',
    controls: 'Mover + ESPACIO',
    accent: '#5fe8de',
    borderAccent: '#0891b2',
    textColor: '#B9F5EF',
    viewBg: 'radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 20%, #fff6, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff5, transparent), radial-gradient(1px 1px at 85% 60%, #fff7, transparent), #050510',
  },
  {
    id: 'desert-runner',
    name: 'Corredor del Desierto',
    cartCode: 'NGM-003',
    megaSpec: 'ACTION 120-MEGA',
    tag: 'Sol Poniente',
    desc: 'Un armadillo veloz esquiva cactus, rocas y buitres bajo un sol de justicia.',
    controls: '↑ saltar · ↓ agacharse',
    accent: '#E8A94F',
    borderAccent: '#b45309',
    textColor: '#FFE9B8',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(232,169,79,0.2), transparent), #1c1308',
  },
  {
    id: 'ghost-maze',
    name: 'Laberinto Fantasma',
    cartCode: 'NGM-004',
    megaSpec: 'CLASSIC 160-MEGA',
    tag: 'Arcade Clásico',
    desc: 'Devora todas las bolitas del laberinto mientras tres fantasmas te dan caza.',
    controls: '↑ ↓ ← → / WASD',
    accent: '#FFE23D',
    borderAccent: '#ca8a04',
    textColor: '#FFE9A0',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(77,99,255,0.16), transparent), #04040E',
  },
  {
    id: 'traffic-racer',
    name: 'Carrera de Tráfico',
    cartCode: 'NGM-005',
    megaSpec: 'TURBO 200-MEGA',
    tag: 'Asfalto Nocturno',
    desc: 'Autopista crepuscular a fondo: zigzaguea entre coches y acumula kilómetros.',
    controls: '← → mover · ↑ acelerón',
    accent: '#E85D5D',
    borderAccent: '#dc2626',
    textColor: '#F2B8B8',
    viewBg: 'radial-gradient(760px 420px at 50% 0%, rgba(232,93,93,0.16), transparent), #14121C',
  },
  {
    id: 'brick-breaker',
    name: 'Rompe Ladrillos',
    cartCode: 'NGM-006',
    megaSpec: 'PRISM 140-MEGA',
    tag: 'Prisma Neón',
    desc: 'La paleta, la bola y un muro de colores pastel que pide ser derrumbado.',
    controls: '← → / A D + ESPACIO',
    accent: '#7DD8B7',
    borderAccent: '#059669',
    textColor: '#E6FFF5',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(125,216,183,0.18), transparent), #0a1410',
  },
  {
    id: 'hit-and-run',
    name: 'Hit & Run',
    cartCode: 'NGM-007',
    megaSpec: 'TAXI 220-MEGA',
    tag: 'Pixel City',
    desc: 'Embiste taxis en la ciudad de píxeles y escapa con turbo de la policía.',
    controls: 'Mover · ↑ turbo · ↓ freno',
    accent: '#FFC531',
    borderAccent: '#d97706',
    textColor: '#FFE9A0',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(255,197,49,0.14), transparent), #0E0E1E',
  },
  {
    id: 'gun-and-run',
    name: 'Gun & Run',
    cartCode: 'NGM-008',
    megaSpec: 'COMMANDO 330M',
    tag: 'Run & Gun',
    desc: 'Corre, salta y dispara por la selva al atardecer: soldados, drones y torretas.',
    controls: 'Mover · ↑ salto · ESPACIO disparo',
    accent: '#FF8A3D',
    borderAccent: '#ea580c',
    textColor: '#FFC9A0',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(255,138,61,0.16), transparent), #17100A',
  },
]

export default function Home() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bests, setBests] = useState<Record<string, number>>({})
  const [muted, setMutedState] = useState(false)
  const [musicOn, setMusicOn] = useState(true)
  const [crtFilter, setCrtFilter] = useState(true)
  const [credits, setCredits] = useState(4)
  const [coinAnim, setCoinAnim] = useState(false)

  const refreshBests = useCallback(() => {
    const map: Record<string, number> = {}
    for (const g of GAMES) map[g.id] = loadBest(g.id)
    setBests(map)
  }, [])

  useEffect(() => {
    refreshBests()
  }, [refreshBests, activeId])

  useEffect(() => {
    setMutedState(loadMutePref())
    setMusicOn(loadMusicPref())
    try {
      const crtPref = window.localStorage.getItem('arcade-crt')
      if (crtPref !== null) setCrtFilter(crtPref === '1')
      const savedCredits = window.localStorage.getItem('arcade-credits')
      if (savedCredits !== null) setCredits(parseInt(savedCredits, 10) || 4)
    } catch {
      // sin acceso
    }
  }, [])

  // Inicializar WebAudio tras gesto del usuario
  useEffect(() => {
    primeMusic()
  }, [])

  // Melodía chiptune interactiva
  useEffect(() => {
    startMusic(activeId ?? 'hub')
  }, [activeId])

  // Tecla ESC para regresar a la sala
  useEffect(() => {
    if (!activeId) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activeId])

  const insertCoin = () => {
    sfx.coinInsert()
    setCoinAnim(true)
    setTimeout(() => setCoinAnim(false), 300)
    const newCreds = credits + 1
    setCredits(newCreds)
    try {
      window.localStorage.setItem('arcade-credits', String(newCreds))
    } catch {
      // sin acceso
    }
  }

  const toggleCrt = () => {
    const next = !crtFilter
    setCrtFilter(next)
    try {
      window.localStorage.setItem('arcade-crt', next ? '1' : '0')
    } catch {
      // sin acceso
    }
  }

  const launchGame = (id: string) => {
    if (credits > 0 && credits < 99) {
      const next = credits - 1
      setCredits(next)
      try {
        window.localStorage.setItem('arcade-credits', String(next))
      } catch {
        // sin acceso
      }
    }
    sfx.coin()
    setActiveId(id)
  }

  const activeGame = GAMES.find((g) => g.id === activeId) ?? null

  return (
    <div className="min-h-screen flex flex-col bg-[#07070a] text-zinc-100 relative overflow-x-hidden selection:bg-amber-400 selection:text-black">
      {/* Filtro CRT Scanlines opcional y auténtico */}
      {crtFilter && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 crt-overlay crt-vignette opacity-80"
        />
      )}

      {/* MARQUEE SUPERIOR ESTILO CABINA NEO-GEO MVS / CANDY CAB */}
      <header className="relative z-20 w-full max-w-6xl mx-auto pt-6 pb-4 px-3 sm:px-4">
        <div className="rounded-2xl border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-3 sm:p-5 shadow-[0_15px_35px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] relative">
          {/* Tornillos de chasis en esquinas */}
          <div className="absolute top-2 left-3 text-zinc-600 text-[10px] font-mono select-none">✦</div>
          <div className="absolute top-2 right-3 text-zinc-600 text-[10px] font-mono select-none">✦</div>
          <div className="absolute bottom-2 left-3 text-zinc-600 text-[10px] font-mono select-none">✦</div>
          <div className="absolute bottom-2 right-3 text-zinc-600 text-[10px] font-mono select-none">✦</div>

          {/* Banner iluminado Neo-Geo MVS */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-red-500/20 to-cyan-500/15 p-3 sm:p-4 text-center relative overflow-hidden shadow-[inset_0_0_20px_rgba(245,158,11,0.2)]">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.2em] text-emerald-400 font-bold uppercase">
                  STEREO CHIPTUNE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.2em] text-amber-300 font-bold uppercase">
                  RGB 15kHz CRT
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.2em] text-rose-400 font-bold uppercase">
                  PRO-GEAR SPEC 100M
                </span>
              </div>
            </div>

            <h1 className="font-pixel text-xl sm:text-3xl md:text-4xl text-amber-300 tracking-wider arcade-text-glow leading-snug">
              NEO•ARCADE MVS
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs font-mono text-zinc-300 tracking-widest uppercase">
              10 Cartuchos Clásicos de Recreativa · Sintetizador WebAudio
            </p>
          </div>

          {/* PANEL DE SERVICIO: MONEDERO INTERACTIVO Y BOTONES SANWA */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-700/80">
            {/* Ranura y pulsador interactivo INSERT COIN */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={insertCoin}
                aria-label="Insertar moneda de 25 centavos"
                className={`relative px-4 py-2 rounded-xl border-2 border-red-500 bg-gradient-to-b from-red-600 to-red-800 text-white font-mono text-xs font-black tracking-wider flex items-center gap-2 shadow-[0_4px_12px_rgba(239,68,68,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] active:scale-95 transition-all ${
                  coinAnim ? 'scale-105 brightness-125 shadow-[0_0_20px_#facc15]' : ''
                }`}
              >
                <span className="w-2.5 h-5 rounded-sm bg-zinc-950 border border-red-400 flex items-center justify-center">
                  <span className="w-0.5 h-3 bg-amber-400" />
                </span>
                <span>25¢ INSERT COIN</span>
              </button>

              <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs">
                {credits >= 10 ? (
                  <span className="text-emerald-400 font-black animate-pulse">★ FREE PLAY ★</span>
                ) : (
                  <span className="text-amber-400 font-bold">
                    CREDITS [ {String(credits).padStart(2, '0')} ]
                  </span>
                )}
              </div>
            </div>

            {/* Pulsadores tipo Sanwa para sonido, música y filtro CRT */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const v = !muted
                  setMuted(v)
                  setMutedState(v)
                  if (!v) sfx.coin()
                }}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 text-xs font-mono text-zinc-200 hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 shadow"
                title={muted ? 'Activar sonido' : 'Silenciar sonido'}
              >
                <span>{muted ? '🔇' : '🔊'}</span>
                <span className="hidden sm:inline">SFX</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const v = !musicOn
                  setMusicEnabled(v)
                  setMusicOn(v)
                }}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 text-xs font-mono text-zinc-200 hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 shadow"
                title={musicOn ? 'Desactivar música' : 'Activar música'}
              >
                <span className={musicOn ? 'text-amber-300' : 'text-zinc-500 line-through'}>🎵</span>
                <span className="hidden sm:inline">MÚSICA</span>
              </button>

              <button
                type="button"
                onClick={toggleCrt}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono active:scale-95 transition-all flex items-center gap-1.5 shadow ${
                  crtFilter
                    ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-300'
                    : 'border-zinc-700 bg-zinc-800/90 text-zinc-400'
                }`}
                title="Alternar filtro retro CRT Scanlines"
              >
                <span>📺</span>
                <span>CRT: {crtFilter ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: CATÁLOGO DE CARTUCHOS O JUEGO ACTIVO */}
      <main className="relative z-20 flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 pb-16">
        {!activeGame ? (
          <div>
            {/* Título de sala de cartuchos */}
            <div className="flex items-center justify-between my-5 px-1">
              <div>
                <h2 className="text-xs sm:text-sm font-mono tracking-widest text-zinc-400 uppercase">
                  SELECCIONA CARTUCHO MVS (10 TÍTULOS DISPONIBLES)
                </h2>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Haz clic en un cartucho para insertarlo en la cabina y jugar
                </p>
              </div>
              <span className="hidden sm:inline-block font-pixel text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded">
                1 COIN = 1 JUEGO
              </span>
            </div>

            {/* Cuadrícula de Cartuchos Físicos MVS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
              {GAMES.map((g, idx) => {
                const record = bests[g.id] ?? 0
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      launchGame(g.id)
                    }}
                    className="group text-left rounded-2xl border-2 border-zinc-800 bg-[#121216] overflow-hidden transition-all duration-200 hover:-translate-y-2 hover:border-amber-400/80 hover:shadow-[0_15px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex flex-col justify-between relative"
                    aria-label={`Insertar cartucho de ${g.name}`}
                  >
                    {/* Hendiduras de agarre plástico del cartucho superior */}
                    <div className="h-4 w-full cartridge-ribs border-b border-zinc-800/80" />

                    {/* Cabecera del cartucho con código de serie MVS */}
                    <div className="p-3 pb-2 flex items-center justify-between border-b border-zinc-800 text-[9px] font-mono">
                      <span className="text-zinc-400 font-bold tracking-wider">{g.cartCode}</span>
                      <span
                        className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[8px]"
                        style={{
                          backgroundColor: `${g.accent}18`,
                          color: g.accent,
                          borderColor: `${g.accent}40`,
                        }}
                      >
                        {g.megaSpec}
                      </span>
                    </div>

                    {/* Badge Ilustrado Pixel Art del Juego (NO OS EMOJIS) */}
                    <div className="px-3 pt-3">
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-2 relative group-hover:border-zinc-600 transition-colors">
                        <CartridgeBadge gameId={g.id} />
                        <span
                          className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest font-bold border backdrop-blur-sm"
                          style={{
                            backgroundColor: '#000000aa',
                            color: g.accent,
                            borderColor: `${g.accent}40`,
                          }}
                        >
                          {g.tag}
                        </span>
                      </div>
                    </div>

                    {/* Ficha técnica y título */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black font-mono tracking-tight group-hover:text-amber-300 transition-colors" style={{ color: g.textColor }}>
                          {g.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {g.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex flex-col gap-1.5">
                        {/* Controles simplificados */}
                        <span className="text-[9px] font-mono text-zinc-500 truncate">
                          🕹️ {g.controls}
                        </span>

                        {/* Placa de récord */}
                        <div className="flex items-center justify-between font-mono text-[10px] mt-0.5">
                          <span className="text-zinc-400">RÉCORD:</span>
                          <span className="font-bold text-amber-300">
                            {record > 0 ? record.toLocaleString() : '---'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pines dorados de contacto PCB al fondo del cartucho */}
                    <div className="h-2 w-full pcb-pins border-t border-zinc-800" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* PANTALLA DE JUEGO ACTIVO CON MARCO DE CABINA */
          <section
            className="rounded-3xl border-2 border-zinc-700 bg-zinc-950 p-3 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden"
            style={{ background: activeGame.viewBg }}
            aria-label={`Juego activo: ${activeGame.name}`}
          >
            {/* Barra superior de control en partida */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-mono font-bold text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all shadow"
                >
                  ← Volver a Cartuchos (ESC)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = !muted
                    setMuted(v)
                    setMutedState(v)
                    if (!v) sfx.coin()
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs hover:bg-zinc-800"
                  title="Sonido"
                >
                  {muted ? '🔇' : '🔊'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = !musicOn
                    setMusicEnabled(v)
                    setMusicOn(v)
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs hover:bg-zinc-800"
                  title="Música"
                >
                  <span className={musicOn ? 'text-amber-300' : 'line-through text-zinc-500'}>🎵</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }))
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs hover:bg-zinc-800 font-mono"
                  title="Pausar o reanudar partida (P)"
                >
                  ⏸️ P
                </button>
              </div>

              {/* Título de cartucho activo */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {activeGame.cartCode}
                </span>
                <h2
                  className="text-sm sm:text-base font-black font-mono tracking-wide"
                  style={{ color: activeGame.textColor, textShadow: `0 0 15px ${activeGame.accent}66` }}
                >
                  {activeGame.name}
                </h2>
              </div>

              {/* Información de control */}
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  P = Pausa
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  ESC = Menú
                </span>
              </div>
            </div>

            {/* Contenedor central del canvas */}
            <div className="flex justify-center items-center py-1 sm:py-2">
              {activeGame.id === 'asteroid-drift' && <AsteroidDrift />}
              {activeGame.id === 'cyber-dungeon' && <CyberDungeon />}
              {activeGame.id === 'snake-neon' && <SnakeNeon />}
              {activeGame.id === 'space-invasion' && <SpaceInvasion />}
              {activeGame.id === 'desert-runner' && <DesertRunner />}
              {activeGame.id === 'ghost-maze' && <GhostMaze />}
              {activeGame.id === 'traffic-racer' && <TrafficRacer />}
              {activeGame.id === 'brick-breaker' && <BrickBreaker />}
              {activeGame.id === 'hit-and-run' && <HitAndRun />}
              {activeGame.id === 'gun-and-run' && <GunAndRun />}
            </div>
          </section>
        )}
      </main>

      {/* PIE DE CABINA ARCADE */}
      <footer className="relative z-20 mt-auto border-t border-zinc-800/80 bg-zinc-950/80 py-4 px-4 text-center font-mono text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <p>🕹️ NEO•ARCADE MVS SYSTEM · 10 JUEGOS DISPONIBLES</p>
          <p>Tus récords se guardan automáticamente en tu navegador</p>
        </div>
      </footer>
    </div>
  )
}
