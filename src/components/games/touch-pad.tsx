'use client'

import { useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import type { LogicalKey } from './use-keys'

function haptic() {
  try {
    navigator.vibrate?.(8)
  } catch {
    // sin vibración
  }
}

function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia('(pointer: coarse)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function isTouchDevice() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    new URLSearchParams(window.location.search).get('touch') === '1'
  )
}

type Dir = 'up' | 'down' | 'left' | 'right'

/**
 * Cruceta analógica: un solo área táctil que calcula la dirección según la
 * posición del dedo respecto al centro, así se puede deslizar entre
 * direcciones (incluidas diagonales) sin levantar el pulgar.
 */
function DPad({ onPress, onRelease }: { onPress: (k: LogicalKey) => void; onRelease: (k: LogicalKey) => void }) {
  const active = useRef<Set<Dir>>(new Set())
  const knob = useRef<HTMLDivElement | null>(null)
  const arrows = useRef<Record<Dir, HTMLSpanElement | null>>({ up: null, down: null, left: null, right: null })

  const apply = (next: Set<Dir>) => {
    for (const d of active.current) if (!next.has(d)) onRelease(d)
    for (const d of next) if (!active.current.has(d)) onPress(d)
    if ([...next].some((d) => !active.current.has(d))) haptic()
    active.current = next
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      arrows.current[d]?.classList.toggle('dpad-on', next.has(d))
    }
  }

  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const dead = r.width * 0.12
    const next = new Set<Dir>()
    if (Math.hypot(dx, dy) > dead) {
      const a = Math.atan2(dy, dx) // -PI..PI, 0 = derecha
      const deg = (a * 180) / Math.PI
      // sectores de 90° con solape de 22.5° para diagonales
      if (deg > -67.5 && deg < 67.5) next.add('right')
      if (deg > 112.5 || deg < -112.5) next.add('left')
      if (deg > 22.5 && deg < 157.5) next.add('down')
      if (deg < -22.5 && deg > -157.5) next.add('up')
    }
    const max = r.width * 0.22
    const len = Math.hypot(dx, dy) || 1
    const k = Math.min(1, max / len)
    if (knob.current) knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`
    apply(next)
  }

  const end = () => {
    if (knob.current) knob.current.style.transform = ''
    apply(new Set())
  }

  const arrow = (d: Dir, cls: string, rotate: number) => (
    <span
      ref={(el) => {
        arrows.current[d] = el
      }}
      className={`absolute flex size-10 items-center justify-center text-sm text-white/45 transition-colors ${cls}`}
    >
      <svg viewBox="0 0 10 10" className="size-3.5 fill-current" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
        <path d="M5 1.5 9 8H1z" />
      </svg>
    </span>
  )

  return (
    <div
      role="group"
      aria-label="Cruceta de dirección"
      className="relative size-[clamp(6.75rem,17dvh,8.5rem)] shrink-0 touch-none rounded-full border border-white/10 bg-white/[0.04] shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        track(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0 || e.pointerType === 'touch') track(e)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {arrow('up', 'left-1/2 top-1 -translate-x-1/2', 0)}
      {arrow('down', 'bottom-1 left-1/2 -translate-x-1/2', 180)}
      {arrow('left', 'left-1 top-1/2 -translate-y-1/2', 270)}
      {arrow('right', 'right-1 top-1/2 -translate-y-1/2', 90)}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={knob}
          className="size-[42%] rounded-full border border-white/15 bg-gradient-to-b from-white/20 to-white/5 shadow-[0_6px_16px_rgba(0,0,0,0.6)] transition-transform duration-75"
        />
      </div>
    </div>
  )
}

function ActionButton({
  gameKey,
  onPress,
  onRelease,
  label,
  letter,
  tone,
}: {
  gameKey: LogicalKey
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  label: string
  letter: string
  tone: 'primary' | 'secondary'
}) {
  const styles =
    tone === 'primary'
      ? 'bg-gradient-to-b from-rose-400 to-rose-600 shadow-[0_5px_0_#881337,0_10px_24px_rgba(244,63,94,0.35)] active:shadow-[0_1px_0_#881337] size-[clamp(3.6rem,10dvh,4.5rem)]'
      : 'bg-gradient-to-b from-sky-400 to-sky-600 shadow-[0_5px_0_#0c4a6e,0_10px_24px_rgba(14,165,233,0.3)] active:shadow-[0_1px_0_#0c4a6e] size-[clamp(3.1rem,8.5dvh,4rem)]'
  const release = () => onRelease(gameKey)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        className={`touch-none select-none rounded-full text-lg font-bold text-white transition-transform active:translate-y-1 ${styles}`}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          haptic()
          onPress(gameKey)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        {letter}
      </button>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
    </div>
  )
}

/**
 * Mando táctil: cruceta a la izquierda y botones de acción a la derecha.
 * Solo se muestra en pantallas táctiles (o con ?touch=1 en la URL).
 */
export function TouchPad({
  onPress,
  onRelease,
  showAction = false,
  actionLabel = 'Acción',
  actionGlyph = 'A',
  showAction2 = false,
  action2Label = 'B',
  action2Glyph = 'B',
  showDpad = true,
  forceVisible = false,
}: {
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  showAction?: boolean
  actionLabel?: string
  actionGlyph?: string
  showAction2?: boolean
  action2Label?: string
  action2Glyph?: string
  /** false en juegos de un solo botón: oculta la cruceta. */
  showDpad?: boolean
  forceVisible?: boolean
}) {
  const isTouch = useSyncExternalStore(subscribeCoarse, isTouchDevice, () => false)
  if (!isTouch && !forceVisible) return null

  return (
    <nav
      aria-label="Controles táctiles"
      className="relative z-20 flex w-full shrink-0 select-none items-center justify-between gap-4 px-5 pt-2"
      style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom, 0px))' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {showDpad ? <DPad onPress={onPress} onRelease={onRelease} /> : <span />}
      {(showAction || showAction2) && (
        <div className="flex items-end gap-4">
          {showAction2 && (
            <div className="mb-[3dvh]">
              <ActionButton
                gameKey="action2"
                onPress={onPress}
                onRelease={onRelease}
                label={action2Label}
                letter={action2Glyph}
                tone="secondary"
              />
            </div>
          )}
          {showAction && (
            <ActionButton
              gameKey="action"
              onPress={onPress}
              onRelease={onRelease}
              label={actionLabel}
              letter={actionGlyph}
              tone="primary"
            />
          )}
        </div>
      )}
    </nav>
  )
}
