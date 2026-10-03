'use client'

/**
 * Controles táctiles para jugar con el celular acostado: joystick flotante a
 * la izquierda, arrastre a la derecha para girar, botón grande de disparo,
 * botón de cambio de arma y (si se tiene la mejora) disparo doble.
 */
import { useRef, type PointerEvent as RPE } from 'react'
import type { Game } from './game'

const TURN_SENS = 0.0062

function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // sin vibración
  }
}

export function TouchControls({ game, barCss, showAlt }: { game: Game; barCss: number; showAlt: boolean }) {
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null)
  const look = useRef<{ id: number; x: number } | null>(null)
  const fireId = useRef<{ id: number; x: number } | null>(null)
  const base = useRef<HTMLDivElement | null>(null)
  const knob = useRef<HTMLDivElement | null>(null)
  const R = 56

  const showStick = (x: number, y: number, kx: number, ky: number, on: boolean) => {
    const b = base.current
    const k = knob.current
    if (!b || !k) return
    b.style.opacity = on ? '1' : '0'
    b.style.transform = `translate(${x - R}px, ${y - R}px)`
    k.style.transform = `translate(${kx - x + R - 22}px, ${ky - y + R - 22}px)`
  }

  const onDown = (e: RPE<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    game.audio.unlock()
    if (x < r.width * 0.42 && !stick.current) {
      stick.current = { id: e.pointerId, ox: x, oy: y }
      e.currentTarget.setPointerCapture(e.pointerId)
      showStick(x, y, x, y, true)
    } else if (!look.current) {
      look.current = { id: e.pointerId, x: e.clientX }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onMove = (e: RPE<HTMLDivElement>) => {
    const s = stick.current
    if (s && s.id === e.pointerId) {
      const r = e.currentTarget.getBoundingClientRect()
      let dx = e.clientX - r.left - s.ox
      let dy = e.clientY - r.top - s.oy
      const d = Math.hypot(dx, dy)
      if (d > R) {
        // el joystick sigue al dedo si se pasa del radio
        s.ox += (dx / d) * (d - R)
        s.oy += (dy / d) * (d - R)
        dx = (dx / d) * R
        dy = (dy / d) * R
      }
      const dead = 0.12
      let mx = dx / R
      let my = dy / R
      const m = Math.hypot(mx, my)
      if (m < dead) {
        mx = 0
        my = 0
      }
      game.setMove(mx, my)
      showStick(s.ox, s.oy, s.ox + dx, s.oy + dy, true)
      return
    }
    const l = look.current
    if (l && l.id === e.pointerId) {
      game.addTurn((e.clientX - l.x) * TURN_SENS)
      l.x = e.clientX
    }
  }

  const onUp = (e: RPE<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) {
      stick.current = null
      game.setMove(0, 0)
      showStick(0, 0, 0, 0, false)
    }
    if (look.current?.id === e.pointerId) look.current = null
  }

  const fireDown = (e: RPE<HTMLButtonElement>) => {
    e.stopPropagation()
    game.audio.unlock()
    e.currentTarget.setPointerCapture(e.pointerId)
    fireId.current = { id: e.pointerId, x: e.clientX }
    game.setFire(true)
    haptic(10)
  }
  const fireMove = (e: RPE<HTMLButtonElement>) => {
    const f = fireId.current
    if (f && f.id === e.pointerId) {
      // arrastrar desde el botón de disparo también gira
      game.addTurn((e.clientX - f.x) * TURN_SENS)
      f.x = e.clientX
    }
  }
  const fireUp = (e: RPE<HTMLButtonElement>) => {
    if (fireId.current?.id === e.pointerId) {
      fireId.current = null
      game.setFire(false)
    }
  }

  const btn =
    'absolute flex items-center justify-center rounded-full border-2 font-bold text-white/90 touch-none select-none active:scale-95'
  const pixel = { fontFamily: 'var(--font-pixel)' }

  return (
    <div
      className="absolute inset-0 z-[5] touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        ref={base}
        className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-white/25 bg-white/5 opacity-0 transition-opacity"
        style={{ width: R * 2, height: R * 2 }}
      >
        <div
          ref={knob}
          className="absolute left-0 top-0 size-11 rounded-full border-2 border-white/40 bg-white/20"
        />
      </div>
      <p
        className="pointer-events-none absolute left-4 text-[9px] text-white/35"
        style={{ ...pixel, bottom: barCss + 10 }}
      >
        MOVER
      </p>
      <button
        type="button"
        aria-label="Disparar"
        className={btn + ' border-red-400/70 bg-red-600/35 text-sm'}
        style={{ ...pixel, width: 88, height: 88, right: 18, bottom: barCss + 14 }}
        onPointerDown={fireDown}
        onPointerMove={fireMove}
        onPointerUp={fireUp}
        onPointerCancel={fireUp}
      >
        FUEGO
      </button>
      <button
        type="button"
        aria-label="Cambiar arma"
        className={btn + ' border-white/35 bg-black/35 text-[9px]'}
        style={{ ...pixel, width: 58, height: 58, right: 116, bottom: barCss + 22 }}
        onPointerDown={(e) => {
          e.stopPropagation()
          game.cycleWeapon(1)
          haptic()
        }}
      >
        ARMA
      </button>
      {showAlt && (
        <button
          type="button"
          aria-label="Disparo doble"
          className={btn + ' border-amber-300/60 bg-amber-500/25 text-[10px]'}
          style={{ ...pixel, width: 58, height: 58, right: 34, bottom: barCss + 112 }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            game.setAlt(true)
            haptic(14)
          }}
          onPointerUp={() => game.setAlt(false)}
          onPointerCancel={() => game.setAlt(false)}
        >
          2X
        </button>
      )}
    </div>
  )
}
