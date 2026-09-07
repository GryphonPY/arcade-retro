'use client'

import { useEffect, useState } from 'react'
import type { LogicalKey } from './use-keys'

function PadButton({
  gameKey,
  onPress,
  onRelease,
  label,
  glyph,
  className,
}: {
  gameKey: LogicalKey
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  label: string
  glyph: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`select-none touch-none rounded-xl border border-white/20 bg-white/10 text-white/85 backdrop-blur-sm active:bg-white/30 flex items-center justify-center text-xl leading-none [-webkit-tap-highlight-color:transparent] ${className ?? ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        // libera la captura implícita del toque para poder deslizar entre botones
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          // sin captura activa
        }
        onPress(gameKey)
      }}
      // deslizar el dedo hacia otro botón lo pulsa (el dedo sigue apoyado)
      onPointerEnter={(e) => {
        if (e.buttons > 0) {
          e.preventDefault()
          onPress(gameKey)
        }
      }}
      onPointerLeave={() => onRelease(gameKey)}
      onPointerUp={() => onRelease(gameKey)}
      onPointerCancel={() => onRelease(gameKey)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  )
}

/**
 * Cruceta táctil visible solo en dispositivos con puntero grueso (móvil/tablet).
 * Cruceta fija abajo a la izquierda + botón de acción abajo a la derecha.
 * Soporta multi-touch y deslizar el dedo entre direcciones.
 */
export function TouchPad({
  onPress,
  onRelease,
  showAction = false,
  actionLabel = 'Disparar',
  actionGlyph = '●',
}: {
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  showAction?: boolean
  actionLabel?: string
  actionGlyph?: string
}) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    // ?touch=1 fuerza la cruceta (útil para probar en escritorio)
    const force = new URLSearchParams(window.location.search).get('touch') === '1'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de matchMedia/URL tras montar (sistema externo)
    setIsTouch(mq.matches || force)
    const fn = (e: MediaQueryListEvent) => setIsTouch(e.matches || force)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  if (!isTouch) return null

  return (
    <>
      <div
        className="fixed bottom-5 left-4 z-50 grid grid-cols-3 grid-rows-3 gap-1.5 w-42 h-42 sm:w-44 sm:h-44"
        style={{
          bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          width: '10.5rem',
          height: '10.5rem',
        }}
      >
        <span />
        <PadButton gameKey="up" onPress={onPress} onRelease={onRelease} label="Arriba" glyph="▲" />
        <span />
        <PadButton gameKey="left" onPress={onPress} onRelease={onRelease} label="Izquierda" glyph="◀" />
        <span className="rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[8px] text-white/40 text-center leading-tight px-1">
          MOVER
        </span>
        <PadButton gameKey="right" onPress={onPress} onRelease={onRelease} label="Derecha" glyph="▶" />
        <span />
        <PadButton gameKey="down" onPress={onPress} onRelease={onRelease} label="Abajo" glyph="▼" />
        <span />
      </div>
      {showAction && (
        <div
          className="fixed right-5 z-50"
          style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <PadButton
            gameKey="action"
            onPress={onPress}
            onRelease={onRelease}
            label={actionLabel}
            glyph={actionGlyph}
            className="w-20 h-20 rounded-full !border-white/30 !bg-red-500/25 active:!bg-red-500/50"
          />
        </div>
      )}
    </>
  )
}
