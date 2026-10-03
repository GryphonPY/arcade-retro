'use client'

import { Music, Play, Trophy, Tv, Volume2, VolumeX } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { CATEGORIES, GAMES, type Category, type GameMeta } from '@/components/games/catalog'
import { CartridgeBadge } from '@/components/games/cartridge-badge'
import { updateSettings, useBests, useSettings } from './store'
import { ControlList, GameArt, IconButton } from './ui'

function formatScore(n: number) {
  return n.toLocaleString('es-MX')
}

export function Hub({ featuredId, onPlay }: { featuredId: string; onPlay: (id: string) => void }) {
  const settings = useSettings()
  const bests = useBests()
  const featured = GAMES.find((g) => g.id === featuredId) ?? GAMES[0]
  const played = GAMES.filter((g) => bests[g.id] > 0).length
  const [filter, setFilter] = useState<Category | 'todos'>('todos')
  const visible = filter === 'todos' ? GAMES : GAMES.filter((g) => g.category === filter)

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5"
            aria-label="Arcade Retro, volver arriba"
          >
            <img src="/logo.svg" alt="" className="size-7 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">Arcade Retro</span>
          </button>
          <div className="flex items-center gap-0.5">
            <IconButton
              label={settings.sfx ? 'Silenciar efectos' : 'Activar efectos'}
              active={settings.sfx}
              onClick={() => updateSettings({ sfx: !settings.sfx })}
            >
              {settings.sfx ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
            </IconButton>
            <IconButton
              label={settings.music ? 'Apagar música' : 'Encender música'}
              active={settings.music}
              onClick={() => updateSettings({ music: !settings.music })}
            >
              <Music className="size-[18px]" />
            </IconButton>
            <IconButton
              label={settings.crt ? 'Quitar filtro CRT' : 'Poner filtro CRT'}
              active={settings.crt}
              onClick={() => updateSettings({ crt: !settings.crt })}
            >
              <Tv className="size-[18px]" />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <Featured game={featured} best={bests[featured.id] ?? 0} onPlay={onPlay} />

        <section aria-labelledby="all-games" className="mt-10 sm:mt-14">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="all-games" className="text-xl font-semibold tracking-tight sm:text-2xl">
                Todos los juegos
              </h2>
              <p className="mt-1 text-sm text-dim">
                {played > 0 ? `Has puesto récord en ${played} de ${GAMES.length}` : `${GAMES.length} juegos, listos para jugar`}
              </p>
            </div>
          </div>

          <div role="tablist" aria-label="Filtrar por categoría" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {[{ id: 'todos' as const, label: 'Todos' }, ...CATEGORIES].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={filter === c.id}
                onClick={() => setFilter(c.id)}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
                  filter === c.id ? 'bg-white text-black' : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <ul
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            onKeyDown={moveFocus}
          >
            {visible.map((g) => (
              <li key={g.id}>
                <GameCard game={g} best={bests[g.id] ?? 0} onPlay={onPlay} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto mt-16 max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-line pt-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>Hecho con Canvas y WebAudio. Tus récords se guardan en este navegador.</p>
          <a href="https://github.com/GryphonPY/arcade-retro" className="hover:text-white" target="_blank" rel="noreferrer">
            GitHub · @GryphonPY
          </a>
        </div>
      </footer>
    </div>
  )
}

/** Flechas del teclado para moverse entre tarjetas como en un menú arcade. */
function moveFocus(e: KeyboardEvent<HTMLUListElement>) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if (!keys.includes(e.key)) return
  const cards = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-game]'))
  const i = cards.indexOf(document.activeElement as HTMLButtonElement)
  if (i < 0) return
  const top = cards[0].offsetTop
  const cols = Math.max(1, cards.filter((c) => c.offsetTop === top).length)
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key] ?? 0
  const next = cards[i + delta]
  if (next) {
    e.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

function Featured({ game, best, onPlay }: { game: GameMeta; best: number; onPlay: (id: string) => void }) {
  return (
    <section
      aria-label="Juego destacado"
      className="relative mt-4 overflow-hidden rounded-3xl border border-line sm:mt-6"
      style={{ background: `linear-gradient(120deg, ${game.accent}26, transparent 55%), #0f0f16` }}
    >
      <div className="grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[1.1fr_1fr] md:gap-10 md:p-10">
        <div className="order-2 md:order-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: game.accent }}>
            {game.genre} · Estilo {game.year}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{game.name}</h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-300 text-pretty">{game.desc}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay(game.id)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.97]"
            >
              <Play className="size-4 fill-current" />
              Jugar
            </button>
            {best > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-zinc-300">
                <Trophy className="size-3.5 text-coin" />
                Récord {formatScore(best)}
              </span>
            )}
          </div>

          <ControlList controls={game.controls} className="mt-6 hidden sm:flex" />
        </div>

        <GameArt accent={game.accent} className="order-1 aspect-[2/1] rounded-2xl border border-line md:order-2 md:aspect-[4/3]">
          <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
            <div className="aspect-square h-full max-h-64 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
              <CartridgeBadge gameId={game.id} />
            </div>
          </div>
        </GameArt>
      </div>
    </section>
  )
}

function GameCard({ game, best, onPlay }: { game: GameMeta; best: number; onPlay: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPlay(game.id)}
      className="group block w-full text-left"
      aria-label={`Jugar ${game.name}`}
      data-game={game.id}
    >
      <GameArt
        accent={game.accent}
        className="aspect-[4/3] rounded-2xl border border-line transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-0 grid place-items-center p-[11%] transition duration-300 group-hover:scale-105">
          <CartridgeBadge gameId={game.id} />
        </div>
        {game.isNew && (
          <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
            Nuevo
          </span>
        )}
        <span className="absolute bottom-2 right-2 flex size-8 translate-y-1 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Play className="size-3.5 fill-current" />
        </span>
      </GameArt>
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-[15px] font-medium leading-tight">{game.name}</h3>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-[13px] text-dim">
          <span className="truncate">{game.genre}</span>
          {best > 0 && (
            <span className="flex shrink-0 items-center gap-1 tabular-nums text-zinc-300">
              <Trophy className="size-3 text-coin" />
              {formatScore(best)}
            </span>
          )}
        </p>
      </div>
    </button>
  )
}
