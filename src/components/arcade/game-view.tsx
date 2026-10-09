'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, CircleHelp, Maximize, Minimize, Music, Pause, Trophy, Tv, Volume2, VolumeX, X } from 'lucide-react'
import type { GameMeta } from '@/components/games/catalog'
import { updateSettings, useBests, useSettings } from './store'
import { ActiveGameContext } from './online'
import { ControlList, IconButton } from './ui'
import { getRemountKey, subscribeStage } from '@/components/games/stage'

const loading = () => <div className="flex-1" />

// Cada juego se descarga solo cuando se abre.
const GAME_COMPONENTS: Record<string, ComponentType> = {
  'nebula-strike': dynamic(() => import('@/components/games/nebula-strike'), { ssr: false, loading }),
  'bunker-93': dynamic(() => import('@/components/games/bunker-93'), { ssr: false, loading }),
  'sunset-run': dynamic(() => import('@/components/games/sunset-run'), { ssr: false, loading }),
  'pong-duelo': dynamic(() => import('@/components/games/pong-duelo'), { ssr: false, loading }),
  'defensa-final': dynamic(() => import('@/components/games/defensa-final'), { ssr: false, loading }),
  horda: dynamic(() => import('@/components/games/horda'), { ssr: false, loading }),
  bloques: dynamic(() => import('@/components/games/bloques'), { ssr: false, loading }),
  'flap-pixel': dynamic(() => import('@/components/games/flap-pixel'), { ssr: false, loading }),
  'cruza-camino': dynamic(() => import('@/components/games/cruza-camino'), { ssr: false, loading }),
  'torre-neon': dynamic(() => import('@/components/games/torre-neon'), { ssr: false, loading }),
  'asteroid-drift': dynamic(() => import('@/components/games/asteroid-drift'), { ssr: false, loading }),
  'cyber-dungeon': dynamic(() => import('@/components/games/cyber-dungeon'), { ssr: false, loading }),
  'snake-neon': dynamic(() => import('@/components/games/snake-neon'), { ssr: false, loading }),
  'space-invasion': dynamic(() => import('@/components/games/space-invasion'), { ssr: false, loading }),
  'desert-runner': dynamic(() => import('@/components/games/desert-runner'), { ssr: false, loading }),
  'ghost-maze': dynamic(() => import('@/components/games/ghost-maze'), { ssr: false, loading }),
  'traffic-racer': dynamic(() => import('@/components/games/traffic-racer'), { ssr: false, loading }),
  'brick-breaker': dynamic(() => import('@/components/games/brick-breaker'), { ssr: false, loading }),
  'hit-and-run': dynamic(() => import('@/components/games/hit-and-run'), { ssr: false, loading }),
  'gun-and-run': dynamic(() => import('@/components/games/gun-and-run'), { ssr: false, loading }),
}

function subscribeFullscreen(cb: () => void) {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}

// Ya instalada como app (pantalla de inicio): no hay barras del navegador que quitar.
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function useFullscreen() {
  const isFull = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false)
  const supported = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenEnabled && !isStandalone(), () => false)
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  return { isFull, supported, toggle }
}

function pressPause() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p', code: 'KeyP', bubbles: true }))
}

export function GameView({ game, onExit }: { game: GameMeta; onExit: () => void }) {
  const settings = useSettings()
  const bests = useBests()
  const fullscreen = useFullscreen()
  const [helpOpen, setHelpOpen] = useState(false)
  const Game = GAME_COMPONENTS[game.id]
  // Cambia cuando un juego en espera debe volver a montarse con la pantalla actual.
  const remount = useSyncExternalStore(subscribeStage, getRemountKey, () => 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (helpOpen) setHelpOpen(false)
        else onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen, onExit])

  // Evita el desplazamiento/rebote de la página mientras se juega en móvil.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Un deslizamiento sobre el juego no debe desplazar la página: el navegador cancela el gesto
  // del juego (pointercancel) y en iPad hasta sale de pantalla completa. Solo se permite desplazar
  // paneles con scroll propio (p. ej. la pantalla de fin).
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = rootRef.current
    const html = document.documentElement
    const prevHtml = html.style.overscrollBehavior
    const prevBody = document.body.style.overscrollBehavior
    html.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    const block = (e: TouchEvent) => {
      for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'auto' && n.scrollHeight > n.clientHeight) return
      }
      if (e.cancelable) e.preventDefault()
    }
    el?.addEventListener('touchmove', block, { passive: false })
    return () => {
      el?.removeEventListener('touchmove', block)
      html.style.overscrollBehavior = prevHtml
      document.body.style.overscrollBehavior = prevBody
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex h-dvh flex-col overflow-hidden select-none"
      style={{ background: game.viewBg }}
    >
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-black/40 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-12 items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-9 items-center gap-1.5 rounded-full pl-2 pr-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="size-[18px]" />
            <span className="hidden sm:inline">Juegos</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start sm:pl-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: game.accent, boxShadow: `0 0 10px ${game.accent}` }} />
            <h1 className="truncate text-sm font-semibold sm:text-[15px]">{game.name}</h1>
            {(bests[game.id] ?? 0) > 0 && (
              <span className="hidden items-center gap-1 text-xs tabular-nums text-dim md:inline-flex">
                <Trophy className="size-3 text-coin" />
                {bests[game.id].toLocaleString('es-MX')}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center">
            <IconButton label="Pausa (P)" onClick={pressPause}>
              <Pause className="size-[18px]" />
            </IconButton>
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
              className="max-sm:hidden"
            >
              <Tv className="size-[18px]" />
            </IconButton>
            <IconButton label="Cómo se juega" onClick={() => setHelpOpen(true)}>
              <CircleHelp className="size-[18px]" />
            </IconButton>
            {fullscreen.supported && (
              <IconButton
                label={fullscreen.isFull ? 'Salir de pantalla completa' : 'Pantalla completa'}
                onClick={fullscreen.toggle}
                className="max-[419px]:hidden"
              >
                {fullscreen.isFull ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
              </IconButton>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <ActiveGameContext.Provider value={game.id}>
          <Game key={`${game.id}-${remount}`} />
        </ActiveGameContext.Provider>
      </main>

      <footer className="hidden shrink-0 items-center justify-center gap-6 border-t border-white/[0.06] bg-black/30 px-4 py-2.5 [@media(pointer:fine)]:flex">
        <ControlList controls={game.controls} />
        <span className="text-xs text-dim">
          <kbd className="font-mono text-zinc-300">P</kbd> pausa · <kbd className="font-mono text-zinc-300">Esc</kbd> salir
        </span>
      </footer>

      {helpOpen && <HelpSheet game={game} onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function HelpSheet({ game, onClose }: { game: GameMeta; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#121219] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: game.accent }}>
              {game.genre}
            </p>
            <h2 id="help-title" className="mt-1 text-xl font-semibold">
              {game.name}
            </h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{game.desc}</p>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-dim">Teclado</h3>
        <ControlList controls={game.controls} className="mt-2" />

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-dim">Celular</h3>
        <p className="mt-1 text-sm text-zinc-400">
          {game.touchHelp ?? 'Usa la cruceta y los botones A / B en la parte de abajo de la pantalla.'}
        </p>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-dim">Pantalla completa en iPad</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Para jugar sin las barras del navegador: abre la página en Safari, toca Compartir y elige Agregar a pantalla de inicio.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-full bg-white text-[15px] font-semibold text-black transition hover:bg-zinc-200"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
