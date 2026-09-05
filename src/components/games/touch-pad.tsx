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
      className={`select-none touch-none rounded-xl border border-white/20 bg-white/10 text-white/85 backdrop-blur-sm active:bg-white/30 flex items-center justify-center text-lg ${className ?? ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress(gameKey)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        onRelease(gameKey)
      }}
      onPointerLeave={() => onRelease(gameKey)}
      onPointerCancel={() => onRelease(gameKey)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyph}
    </button>
  )
}

/** Cruceta táctil visible solo en dispositivos con puntero grueso (móvil). */
export function TouchPad({
  onPress,
  onRelease,
  showAction = false,
}: {
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  showAction?: boolean
}) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de matchMedia tras montar (sistema externo)
    setIsTouch(mq.matches)
    const fn = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  if (!isTouch) return null

  return (
    <>
      <div className="fixed bottom-5 left-5 z-50 grid grid-cols-3 grid-rows-3 gap-1.5 w-44 h-44">
        <span />
        <PadButton gameKey="up" onPress={onPress} onRelease={onRelease} label="Arriba" glyph="▲" />
        <span />
        <PadButton gameKey="left" onPress={onPress} onRelease={onRelease} label="Izquierda" glyph="◀" />
        <span className="rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[9px] text-white/40 text-center leading-tight px-1">
          MOVER
        </span>
        <PadButton gameKey="right" onPress={onPress} onRelease={onRelease} label="Derecha" glyph="▶" />
        <span />
        <PadButton gameKey="down" onPress={onPress} onRelease={onRelease} label="Abajo" glyph="▼" />
        <span />
      </div>
      {showAction && (
        <div className="fixed bottom-8 right-6 z-50">
          <PadButton
            gameKey="action"
            onPress={onPress}
            onRelease={onRelease}
            label="Disparar"
            glyph="●"
            className="w-20 h-20 rounded-full !border-white/30 !bg-red-500/25 active:!bg-red-500/50"
          />
        </div>
      )}
    </>
  )
}
