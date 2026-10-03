'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Crown, Globe, Music, Play, Trophy, Tv, Volume2, VolumeX } from 'lucide-react'
import { CATEGORIES, GAMES, type Category, type GameMeta } from '@/components/games/catalog'
import { CartridgeBadge } from '@/components/games/cartridge-badge'
import { updateSettings, useBests, useRecent, useSettings } from './store'
import { fetchGameTop, useNickname, useOnlineSummary, type OnlineEntry } from './online'
import { ControlList, GameArt, IconButton } from './ui'

const fmt = (n: number) => n.toLocaleString('es-MX')
const byId = (id: string) => GAMES.find((g) => g.id === id)
const ROTATE_MS = 7000
// Primero los juegos estrella, luego las novedades y el resto del catálogo.
const SHOWCASE = [
  ...GAMES.filter((g) => g.flagship),
  ...GAMES.filter((g) => !g.flagship && g.isNew),
  ...GAMES.filter((g) => !g.flagship && !g.isNew),
]
const FLAGSHIPS = GAMES.filter((g) => g.flagship)

export function Hub({ onPlay }: { onPlay: (id: string) => void }) {
  const settings = useSettings()
  const bests = useBests()
  const recent = useRecent()
  const world = useOnlineSummary()
  const [filter, setFilter] = useState<Category | 'todos'>('todos')
  const catalog = GAMES.filter((g) => !g.flagship)
  const visible = filter === 'todos' ? catalog : catalog.filter((g) => g.category === filter)
  const played = GAMES.filter((g) => bests[g.id] > 0).length

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
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
        <Showcase recent={recent} bests={bests} world={world} onPlay={onPlay} />

        {recent.length > 0 && (
          <section aria-labelledby="recent" className="mt-10">
            <h2 id="recent" className="mb-3 text-lg font-semibold tracking-tight">
              Sigue jugando
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {recent.map((id) => {
                const g = byId(id)
                if (!g) return null
                return (
                  <li key={id} className="snap-start">
                    <button
                      type="button"
                      onClick={() => onPlay(id)}
                      className="group flex w-56 items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-2 pr-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <GameArt accent={g.accent} className="size-14 shrink-0 rounded-xl">
                        <div className="absolute inset-0 p-2">
                          <CartridgeBadge gameId={id} />
                        </div>
                      </GameArt>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{g.name}</span>
                        <span className="flex items-center gap-1 text-xs tabular-nums text-dim">
                          {bests[id] > 0 ? (
                            <>
                              <Trophy className="size-3 text-coin" /> {fmt(bests[id])}
                            </>
                          ) : (
                            g.genre
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {FLAGSHIPS.length > 0 && (
          <section aria-labelledby="flagships" className="mt-10 sm:mt-12">
            <h2 id="flagships" className="text-xl font-semibold tracking-tight sm:text-2xl">
              Juegos estrella
            </h2>
            <p className="mt-1 text-sm text-dim">Nuestros juegos más grandes: campañas largas, jefes y mejoras en cada nivel.</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3">
              {FLAGSHIPS.map((g) => (
                <li key={g.id}>
                  <FlagshipCard game={g} best={bests[g.id] ?? 0} champion={world?.[g.id]?.[0]} onPlay={onPlay} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="all-games" className="mt-10 sm:mt-12">
          <div className="mb-4">
            <h2 id="all-games" className="text-xl font-semibold tracking-tight sm:text-2xl">
              Todos los juegos
            </h2>
            <p className="mt-1 text-sm text-dim">
              {played > 0 ? `Has puesto récord en ${played} de ${GAMES.length}` : `${GAMES.length} juegos, listos para jugar`}
            </p>
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

          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" onKeyDown={moveFocus}>
            {visible.map((g) => (
              <li key={g.id}>
                <GameCard game={g} best={bests[g.id] ?? 0} champion={world?.[g.id]?.[0]} onPlay={onPlay} />
              </li>
            ))}
          </ul>
        </section>

        {world && <HallOfFame world={world} onPlay={onPlay} />}
      </main>

      <footer className="mx-auto mt-16 max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-line pt-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>Hecho con Canvas y WebAudio. Tus récords personales se guardan en este navegador.</p>
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

// ---------- carrusel destacado ----------

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const update = () => setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    update()
    return subscribeReduced(update)
  }, [])
  return reduced
}

function Showcase({
  recent,
  bests,
  world,
  onPlay,
}: {
  recent: string[]
  bests: Record<string, number>
  world: Record<string, OnlineEntry[]> | null
  onPlay: (id: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  const touchX = useRef<number | null>(null)
  const game = SHOWCASE[index]

  // Al volver de un juego, el carrusel muestra el último jugado.
  const last = recent[0]
  const [seenLast, setSeenLast] = useState(last)
  if (last !== seenLast) {
    setSeenLast(last)
    const i = SHOWCASE.findIndex((g) => g.id === last)
    if (i >= 0) setIndex(i)
  }

  useEffect(() => {
    if (paused || reduced) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % SHOWCASE.length), ROTATE_MS)
    return () => window.clearTimeout(t)
  }, [index, paused, reduced])

  const go = (d: number) => setIndex((i) => (i + d + SHOWCASE.length) % SHOWCASE.length)
  const top = world?.[game.id] ?? []

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Juegos destacados"
      className="relative mt-4 overflow-hidden rounded-3xl border border-line sm:mt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
        setPaused(true)
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        touchX.current = null
        if (start === null) return
        const dx = e.changedTouches[0].clientX - start
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
      }}
      style={{ background: `linear-gradient(120deg, ${game.accent}2e, transparent 55%), #0f0f16`, transition: 'background 600ms' }}
    >
      <div key={game.id} className="showcase-in grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[1.1fr_1fr] md:gap-10 md:p-10">
        <div className="order-2 md:order-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]" style={{ color: game.accent }}>
            {game.isNew && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tracking-wide text-black">Nuevo</span>}
            {game.genre} · Estilo {game.year}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{game.name}</h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-pretty text-zinc-300">{game.desc}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay(game.id)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.97]"
            >
              <Play className="size-4 fill-current" />
              Jugar
            </button>
            {bests[game.id] > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-zinc-300">
                <Trophy className="size-3.5 text-coin" />
                Tu récord {fmt(bests[game.id])}
              </span>
            )}
          </div>

          {top.length > 0 ? (
            <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm" aria-label="Mejores del mundo">
              {top.map((e, i) => (
                <li key={e.name} className="flex items-center gap-1.5 text-zinc-300">
                  {i === 0 ? <Crown className="size-3.5 text-coin" /> : <span className="w-3.5 text-center text-xs text-dim">{i + 1}</span>}
                  <span className="max-w-[9rem] truncate">{e.name}</span>
                  <span className="tabular-nums text-dim">{fmt(e.score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ControlList controls={game.controls} className="mt-6 hidden sm:flex" />
          )}
        </div>

        <GameArt accent={game.accent} className="order-1 aspect-[2/1] rounded-2xl border border-line md:order-2 md:aspect-[4/3]">
          <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
            <div className="showcase-float aspect-square h-full max-h-64 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
              <CartridgeBadge gameId={game.id} />
            </div>
          </div>
        </GameArt>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-4 sm:px-8 md:px-10">
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {SHOWCASE.map((g, i) => (
            <button
              key={g.id}
              type="button"
              aria-label={`Ver ${g.name}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 transition-all hover:bg-white/25"
              style={{ maxWidth: i === index ? 48 : 20 }}
            >
              {i === index && (
                <span
                  key={`${g.id}-${paused || reduced}`}
                  className={`absolute inset-y-0 left-0 rounded-full ${paused || reduced ? 'w-full' : 'showcase-progress'}`}
                  style={{ background: g.accent, animationDuration: `${ROTATE_MS}ms` }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label="Anterior" onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton label="Siguiente" onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      </div>
    </section>
  )
}

// ---------- tarjetas ----------

function FlagshipCard({
  game,
  best,
  champion,
  onPlay,
}: {
  game: GameMeta
  best: number
  champion?: OnlineEntry
  onPlay: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(game.id)}
      className="group relative block w-full overflow-hidden rounded-3xl border border-line text-left transition duration-300 hover:-translate-y-1 hover:border-white/25"
      style={{ background: `linear-gradient(160deg, ${game.accent}33, transparent 60%), #0f0f16` }}
      aria-label={`Jugar ${game.name}`}
      data-game={game.id}
    >
      <GameArt accent={game.accent} className="aspect-[16/10]">
        <div className="showcase-float absolute inset-0 grid place-items-center p-[12%] transition duration-300 group-hover:scale-105">
          <CartridgeBadge gameId={game.id} />
        </div>
        {game.isNew && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
            Nuevo
          </span>
        )}
      </GameArt>
      <div className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: game.accent }}>
          {game.genre}
          {game.landscape && <span className="ml-2 text-dim">· Mejor en horizontal</span>}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">{game.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{game.desc}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-dim">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {champion ? (
              <>
                <Crown className="size-3 shrink-0 text-coin" />
                <span className="truncate">{champion.name}</span> · {fmt(champion.score)}
              </>
            ) : best > 0 ? (
              <>
                <Trophy className="size-3 text-coin" /> {fmt(best)}
              </>
            ) : (
              'Sin récords todavía'
            )}
          </span>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-black">
            <Play className="size-3 fill-current" /> Jugar
          </span>
        </div>
      </div>
    </button>
  )
}

function GameCard({
  game,
  best,
  champion,
  onPlay,
}: {
  game: GameMeta
  best: number
  champion?: OnlineEntry
  onPlay: (id: string) => void
}) {
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
              {fmt(best)}
            </span>
          )}
        </p>
        {champion && (
          <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-dim" title="Récord mundial">
            <Crown className="size-3 shrink-0 text-coin" />
            <span className="truncate">{champion.name}</span>
            <span className="tabular-nums">· {fmt(champion.score)}</span>
          </p>
        )}
      </div>
    </button>
  )
}

// ---------- salón de la fama ----------

function HallOfFame({ world, onPlay }: { world: Record<string, OnlineEntry[]>; onPlay: (id: string) => void }) {
  const nick = useNickname()
  const firstWithScores = GAMES.find((g) => world[g.id]?.length)
  const [selected, setSelected] = useState<string | null>(null)
  const current = byId(selected ?? firstWithScores?.id ?? GAMES[0].id) ?? GAMES[0]
  const [rows, setRows] = useState<{ game: string; list: OnlineEntry[] | null } | null>(null)

  useEffect(() => {
    let alive = true
    void fetchGameTop(current.id, 10).then((list) => {
      if (alive) setRows({ game: current.id, list })
    })
    return () => {
      alive = false
    }
  }, [current.id, world])

  const list = rows?.game === current.id ? rows.list : null

  return (
    <section aria-labelledby="hall" className="mt-14">
      <div className="mb-4">
        <h2 id="hall" className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Globe className="size-5 text-coin" /> Salón de la fama
        </h2>
        <p className="mt-1 text-sm text-dim">Los mejores del mundo en cada juego. Termina una partida para entrar.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:max-h-[30rem] md:flex-col md:overflow-y-auto md:px-0">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              aria-pressed={g.id === current.id}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm transition-colors md:rounded-xl ${
                g.id === current.id ? 'bg-white text-black' : 'bg-white/[0.05] text-zinc-300 hover:bg-white/10'
              }`}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: g.accent }} />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-line bg-white/[0.02] p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-medium">{current.name}</p>
            <button
              type="button"
              onClick={() => onPlay(current.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Play className="size-3.5 fill-current" /> Jugar
            </button>
          </div>
          {list && list.length > 0 ? (
            <ol className="divide-y divide-white/[0.06]">
              {list.map((r, i) => {
                const mine = !!nick && r.name.toLowerCase() === nick.toLowerCase()
                return (
                  <li key={r.name} className={`flex items-center gap-3 py-2.5 text-sm ${mine ? 'text-white' : 'text-zinc-300'}`}>
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                        i === 0 ? 'bg-coin text-black' : i < 3 ? 'bg-white/15 text-white' : 'text-dim'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${mine ? 'font-semibold' : ''}`}>
                      {r.name}
                      {mine && <span className="ml-2 text-xs font-normal text-dim">(tú)</span>}
                    </span>
                    <span className="tabular-nums">{fmt(r.score)}</span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-dim">
              {list === null && rows?.game !== current.id ? 'Cargando…' : 'Nadie ha publicado todavía. El primer lugar es tuyo.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
