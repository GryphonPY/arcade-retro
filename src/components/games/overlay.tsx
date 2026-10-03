'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { OnlineScore } from '@/components/arcade/online-score'
import { useActiveGame } from '@/components/arcade/online'

function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia('(pointer: coarse)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** true en pantallas táctiles: sirve para adaptar los textos de ayuda. */
export function useIsTouch() {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  )
}

const pixel = { fontFamily: 'var(--font-pixel)' }

function Shell({ children, tint }: { children: ReactNode; tint: string }) {
  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      style={{ background: `radial-gradient(circle at 50% 40%, ${tint}22, transparent 70%), rgba(6,6,12,0.82)` }}
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-5 py-4 text-center">{children}</div>
    </div>
  )
}

/**
 * Pantalla de título de un juego. `hint` describe cómo empezar con teclado y
 * `touchHint` con el mando táctil; se muestra el que corresponda al dispositivo.
 */
export function StartOverlay({
  title,
  accent,
  subtitle,
  hint = 'Pulsa ESPACIO para empezar',
  touchHint = 'Toca A para empezar',
  onStart,
  children,
}: {
  title: string
  accent: string
  subtitle?: ReactNode
  hint?: string
  touchHint?: string
  onStart?: () => void
  children?: ReactNode
}) {
  const touch = useIsTouch()
  return (
    <Shell tint={accent}>
      <p
        className="text-base leading-relaxed sm:text-xl"
        style={{ ...pixel, color: accent, textShadow: `0 0 18px ${accent}aa, 3px 3px 0 #000` }}
      >
        {title}
      </p>
      {subtitle && <p className="max-w-xs text-sm leading-relaxed text-white/75">{subtitle}</p>}
      {children}
      {onStart ? (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur()
            onStart()
          }}
          className="mt-1 rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
          style={{ background: accent, boxShadow: `0 0 24px ${accent}66` }}
        >
          Jugar
        </button>
      ) : null}
      <p className="blink text-[10px] text-white/60" style={pixel}>
        {touch ? touchHint : hint}
      </p>
    </Shell>
  )
}

export interface OverlayStat {
  label: string
  value: ReactNode
}

/** Pantalla de fin de partida con puntuación, récord y botón de reintento. */
export function GameOverOverlay({
  title = 'GAME OVER',
  accent,
  score,
  best,
  newBest,
  stats,
  onRestart,
  hint = 'o pulsa ESPACIO',
  touchHint = 'o toca A',
  ranked = true,
}: {
  title?: string
  accent: string
  score: number
  best: number
  newBest?: boolean
  stats?: OverlayStat[]
  onRestart: () => void
  hint?: string
  touchHint?: string
  /** false para partidas que no van a la tabla mundial (p. ej. 2 jugadores). */
  ranked?: boolean
}) {
  const touch = useIsTouch()
  const game = useActiveGame()
  return (
    <Shell tint={newBest ? '#fbbf24' : accent}>
      <p className="text-base sm:text-xl" style={{ ...pixel, color: '#fff', textShadow: '3px 3px 0 #000' }}>
        {title}
      </p>
      {newBest && (
        <p className="animate-pulse text-[10px] text-amber-300" style={pixel}>
          ¡NUEVO RECORD!
        </p>
      )}
      <div className="mt-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Puntuación</p>
        <p className="text-3xl font-semibold tabular-nums sm:text-4xl" style={{ color: accent }}>
          {score.toLocaleString('es-MX')}
        </p>
        {ranked && (
          <p className="mt-1 text-xs text-white/50 tabular-nums">Récord {Math.max(best, score).toLocaleString('es-MX')}</p>
        )}
      </div>
      {stats && stats.length > 0 && (
        <dl className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs">
          {stats.map((s) => (
            <div key={s.label} className="flex gap-1.5">
              <dt className="text-white/50">{s.label}</dt>
              <dd className="font-medium text-white tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {ranked && game && <OnlineScore game={game} score={score} accent={accent} />}
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur()
          onRestart()
        }}
        className="mt-1 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
      >
        Jugar otra vez
      </button>
      <p className="text-[11px] text-white/45">{touch ? touchHint : hint}</p>
    </Shell>
  )
}

/** Marcador estándar sobre la pantalla de juego (se pasa como `hud` a GameScreen). */
export function Hud({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex w-full items-center justify-between gap-3 px-1 pb-1.5 text-[10px] sm:text-xs"
      style={pixel}
    >
      {children}
    </div>
  )
}
