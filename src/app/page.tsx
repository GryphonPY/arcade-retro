'use client'

import { useCallback, useEffect, useState } from 'react'
import SnakeNeon from '@/components/games/snake-neon'
import SpaceInvasion from '@/components/games/space-invasion'
import DesertRunner from '@/components/games/desert-runner'
import GhostMaze from '@/components/games/ghost-maze'
import TrafficRacer from '@/components/games/traffic-racer'
import BrickBreaker from '@/components/games/brick-breaker'
import { loadBest } from '@/components/games/game-utils'

interface GameMeta {
  id: string
  name: string
  emoji: string
  tag: string
  desc: string
  controls: string
  accent: string
  cardBg: string
  viewBg: string
  textColor: string
}

const GAMES: GameMeta[] = [
  {
    id: 'snake-neon',
    name: 'Snake Neón',
    emoji: '🐍',
    tag: 'Synthwave',
    desc: 'La serpiente clásica en una rejilla de neón que late al ritmo de tus puntos.',
    controls: '↑ ↓ ← → / WASD',
    accent: '#22f7c5',
    cardBg: 'linear-gradient(140deg,#120826 0%,#070213 60%,#1b0a2e 100%)',
    viewBg: 'radial-gradient(900px 480px at 50% -10%, rgba(176,38,255,0.22), transparent), radial-gradient(700px 420px at 80% 110%, rgba(34,247,197,0.14), transparent), #0C0A14',
    textColor: '#9BF5E0',
  },
  {
    id: 'space-invasion',
    name: 'Invasión Espacial',
    emoji: '🚀',
    tag: 'Pixel retro',
    desc: 'Oleadas de invasores pixelados descienden. Tú eres la última línea de defensa.',
    controls: 'Mover + ESPACIO',
    accent: '#5fe8de',
    cardBg: 'linear-gradient(150deg,#0b0f2a 0%,#050510 55%,#210b2e 100%)',
    viewBg: 'radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 20%, #fff6, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff5, transparent), radial-gradient(1px 1px at 85% 60%, #fff7, transparent), #050510',
    textColor: '#B9F5EF',
  },
  {
    id: 'desert-runner',
    name: 'Corredor del Desierto',
    emoji: '🌵',
    tag: 'Cartoon soleado',
    desc: 'Un armadillo veloz esquiva cactus, rocas y buitres bajo un sol de justicia.',
    controls: '↑ saltar · ↓ agacharse',
    accent: '#E8A94F',
    cardBg: 'linear-gradient(150deg,#FFE9B8 0%,#FFCE7A 55%,#F5A45C 100%)',
    viewBg: 'linear-gradient(180deg,#FFE9B8 0%,#FFDD9A 45%,#F7C06B 100%)',
    textColor: '#7A3E14',
  },
  {
    id: 'ghost-maze',
    name: 'Laberinto Fantasma',
    emoji: '👻',
    tag: 'Arcade clásico',
    desc: 'Devora todas las bolitas del laberinto mientras tres fantasmas te dan caza.',
    controls: '↑ ↓ ← → / WASD',
    accent: '#FFE23D',
    cardBg: 'linear-gradient(150deg,#10143D 0%,#04040E 60%,#1A1060 100%)',
    viewBg: 'radial-gradient(800px 460px at 50% 0%, rgba(77,99,255,0.16), transparent), #04040E',
    textColor: '#FFE9A0',
  },
  {
    id: 'traffic-racer',
    name: 'Carrera de Tráfico',
    emoji: '🏎️',
    tag: 'Asfalto nocturno',
    desc: 'Autopista crepuscular a fondo: zigzaguea entre coches y acumula kilómetros.',
    controls: '← → mover · ↑ ↑acelerón',
    accent: '#E85D5D',
    cardBg: 'linear-gradient(150deg,#23202E 0%,#14121C 55%,#3A1E22 100%)',
    viewBg: 'radial-gradient(760px 420px at 50% 0%, rgba(232,93,93,0.12), transparent), #14121C',
    textColor: '#F2B8B8',
  },
  {
    id: 'brick-breaker',
    name: 'Rompe Ladrillos',
    emoji: '🧱',
    tag: 'Pastel suave',
    desc: 'La paleta, la bola y un muro de colores pastel que pide ser derrumbado.',
    controls: '← → / A D + ESPACIO',
    accent: '#7DD8B7',
    cardBg: 'linear-gradient(150deg,#FBF3E4 0%,#F6E3D0 60%,#F3D4CB 100%)',
    viewBg: 'linear-gradient(180deg,#FBF3E4 0%,#F5E7D8 100%)',
    textColor: '#B47A8C',
  },
]

function ControlChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/75">
      {children}
    </span>
  )
}

export default function Home() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bests, setBests] = useState<Record<string, number>>({})

  const refreshBests = useCallback(() => {
    const map: Record<string, number> = {}
    for (const g of GAMES) map[g.id] = loadBest(g.id)
    setBests(map)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    refreshBests()
  }, [refreshBests, activeId])

  // ESC vuelve a la sala arcade
  useEffect(() => {
    if (!activeId) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activeId])

  const activeGame = GAMES.find((g) => g.id === activeId) ?? null

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0A14] text-white relative overflow-x-hidden">
      {/* líneas de barrido CRT muy sutiles */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)',
        }}
      />

      <header className="relative z-10 pt-12 pb-8 px-4 text-center">
        <p className="text-[10px] tracking-[0.35em] text-white/40 uppercase mb-3">
          Sala de mini-juegos · inserta una moneda
        </p>
        <h1
          className="text-2xl sm:text-3xl md:text-4xl leading-relaxed text-[#FFE23D]"
          style={{
            fontFamily: 'var(--font-pixel)',
            textShadow:
              '0 0 12px rgba(255,226,61,0.55), 0 0 40px rgba(255,113,206,0.35), 4px 4px 0 rgba(176,38,255,0.6)',
          }}
        >
          ARCADE RETRO
        </h1>
        <p className="mt-4 text-sm text-white/55 max-w-md mx-auto">
          Seis juegos sencillos con estilos totalmente distintos. Todo se juega con
          las <b className="text-white/80">flechas</b> o <b className="text-white/80">WASD</b>.
        </p>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 pb-16">
        {!activeGame ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {GAMES.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  setActiveId(g.id)
                }}
                className="group relative text-left rounded-2xl border border-white/10 overflow-hidden transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: g.cardBg,
                  boxShadow: `0 10px 30px rgba(0,0,0,0.35)`,
                }}
                aria-label={`Jugar a ${g.name}`}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ boxShadow: `inset 0 0 0 2px ${g.accent}66, 0 0 26px ${g.accent}33` }}
                />
                <div className="flex items-start justify-between p-5 pb-0">
                  <span className="text-[40px] leading-none drop-shadow-lg" role="img" aria-hidden>
                    {g.emoji}
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border"
                    style={{ color: g.accent, borderColor: `${g.accent}55`, backgroundColor: `${g.accent}14` }}
                  >
                    {g.tag}
                  </span>
                </div>
                <div className={`p-5 ${g.id === 'desert-runner' || g.id === 'brick-breaker' ? 'text-[#4A3520]' : 'text-white'}`}>
                  <h2 className="text-lg font-extrabold leading-tight" style={{ color: g.textColor }}>
                    {g.name}
                  </h2>
                  <p className={`mt-1.5 text-xs leading-relaxed ${g.id === 'desert-runner' || g.id === 'brick-breaker' ? 'text-[#6B5236]' : 'text-white/55'}`}>
                    {g.desc}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <ControlChip>{g.controls}</ControlChip>
                    {(bests[g.id] ?? 0) > 0 && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${g.accent}22`, color: g.textColor }}
                      >
                        🏆 {bests[g.id]}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-4 text-xs font-bold opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ color: g.accent }}
                  >
                    ▸ Jugar partida {String(i + 1).padStart(2, '0')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <section
            className="rounded-3xl border border-white/10 p-4 sm:p-6 -mx-2"
            style={{ background: activeGame.viewBg }}
            aria-label={`Juego activo: ${activeGame.name}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white/85 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                ← Volver a la sala
              </button>
              <h2
                className="text-sm sm:text-base font-extrabold tracking-wide"
                style={{ color: activeGame.textColor, textShadow: `0 0 18px ${activeGame.accent}55` }}
              >
                {activeGame.emoji} {activeGame.name}
              </h2>
              <span className="hidden sm:inline-block rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/70">
                {activeGame.controls} · ESC = salir
              </span>
            </div>

            <div className="flex justify-center py-2">
              {activeGame.id === 'snake-neon' && <SnakeNeon />}
              {activeGame.id === 'space-invasion' && <SpaceInvasion />}
              {activeGame.id === 'desert-runner' && <DesertRunner />}
              {activeGame.id === 'ghost-maze' && <GhostMaze />}
              {activeGame.id === 'traffic-racer' && <TrafficRacer />}
              {activeGame.id === 'brick-breaker' && <BrickBreaker />}
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 py-5 px-4 text-center">
        <p className="text-[11px] text-white/35">
          🕹️ Arcade Retro · tus récords se guardan en este navegador · juega con moderación
        </p>
      </footer>
    </div>
  )
}
