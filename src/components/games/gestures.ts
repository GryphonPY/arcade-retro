'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { LogicalKey } from './use-keys'

type Press = (k: LogicalKey) => void
type Dir = 'up' | 'down' | 'left' | 'right'

const SWIPE_PX = 20

/**
 * Deslizar sobre el juego = mantener una dirección (hasta levantar el dedo o
 * deslizar hacia otro lado). Tocar sin deslizar = botón A.
 */
export function useSwipeKeys(press: Press, release: Press) {
  const ref = useRef<{ id: number; x: number; y: number; dir: Dir | null; moved: boolean } | null>(null)

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const t = ref.current
    if (!t || t.id !== e.pointerId) return
    ref.current = null
    if (t.dir) release(t.dir)
    else if (!t.moved && e.type === 'pointerup') {
      press('action')
      release('action')
    }
  }

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (ref.current) return
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // sin captura: el gesto sigue dentro del lienzo
      }
      ref.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null, moved: false }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const t = ref.current
      if (!t || t.id !== e.pointerId) return
      const dx = e.clientX - t.x
      const dy = e.clientY - t.y
      if (Math.hypot(dx, dy) < SWIPE_PX) return
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      t.moved = true
      // el origen sigue al dedo: se puede encadenar giros sin levantarlo
      t.x = e.clientX
      t.y = e.clientY
      if (dir === t.dir) return
      if (t.dir) release(t.dir)
      t.dir = dir
      press(dir)
    },
    onPointerUp: end,
    onPointerCancel: end,
  }
}

/**
 * El objeto sigue al dedo en horizontal: compara la x del dedo (en unidades del
 * juego) con la del objeto y mantiene izquierda/derecha. `hold` se mantiene
 * mientras el dedo esté apoyado (p. ej. disparo automático).
 */
export function useFollowKeys(
  press: Press,
  release: Press,
  opts: { worldW: () => number; targetX: () => number; dead?: number; hold?: LogicalKey },
) {
  const ref = useRef<{ id: number; x: number; side: 'left' | 'right' | null } | null>(null)

  const steer = (e: ReactPointerEvent<HTMLElement>) => {
    const t = ref.current
    if (!t || t.id !== e.pointerId) return
    const r = e.currentTarget.getBoundingClientRect()
    t.x = ((e.clientX - r.left) / r.width) * opts.worldW()
  }

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const t = ref.current
    if (!t || t.id !== e.pointerId) return
    ref.current = null
    if (t.side) release(t.side)
    if (opts.hold) release(opts.hold)
  }

  /** Llamar en cada cuadro del juego: decide hacia dónde moverse. */
  const tick = () => {
    const t = ref.current
    if (!t) return
    const d = t.x - opts.targetX()
    const dead = opts.dead ?? 6
    const side = d > dead ? 'right' : d < -dead ? 'left' : null
    if (side === t.side) return
    if (t.side) release(t.side)
    if (side) press(side)
    t.side = side
  }

  return {
    tick,
    /** Hay un dedo guiando ahora mismo. */
    active: () => ref.current !== null,
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (ref.current) return
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // sin captura
        }
        ref.current = { id: e.pointerId, x: 0, side: null }
        steer(e)
        if (opts.hold) press(opts.hold)
      },
      onPointerMove: steer,
      onPointerUp: end,
      onPointerCancel: end,
    },
  }
}
