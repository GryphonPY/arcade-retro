'use client'

import { useEffect, useState } from 'react'
import type { LogicalKey } from './use-keys'

function triggerHaptic() {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {
      // Ignorar si el navegador bloquea vibración
    }
  }
}

function DPadButton({
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
      className={`select-none touch-none rounded-xl border border-white/20 bg-zinc-900/90 text-amber-300 backdrop-blur-md active:bg-amber-400 active:text-black flex items-center justify-center text-lg leading-none shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_4px_8px_rgba(0,0,0,0.6)] active:shadow-inner active:scale-95 transition-transform [-webkit-tap-highlight-color:transparent] ${className ?? ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          // sin captura
        }
        triggerHaptic()
        onPress(gameKey)
      }}
      onPointerEnter={(e) => {
        if (e.buttons > 0) {
          e.preventDefault()
          triggerHaptic()
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

function SanwaButton({
  gameKey,
  onPress,
  onRelease,
  label,
  letter,
  glyph,
  colorScheme = 'red',
}: {
  gameKey: LogicalKey
  onPress: (k: LogicalKey) => void
  onRelease: (k: LogicalKey) => void
  label: string
  letter: string
  glyph?: string
  colorScheme?: 'red' | 'blue' | 'yellow'
}) {
  const colorStyles = {
    red: 'border-red-500/80 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_6px_0_#7f1d1d,0_8px_16px_rgba(239,68,68,0.4)] active:shadow-[0_2px_0_#7f1d1d] active:translate-y-1',
    blue: 'border-cyan-400/80 bg-gradient-to-b from-cyan-500 to-blue-600 text-white shadow-[0_6px_0_#1e3a8a,0_8px_16px_rgba(6,182,212,0.4)] active:shadow-[0_2px_0_#1e3a8a] active:translate-y-1',
    yellow: 'border-amber-400/80 bg-gradient-to-b from-amber-400 to-amber-600 text-zinc-950 shadow-[0_6px_0_#78350f,0_8px_16px_rgba(245,158,11,0.4)] active:shadow-[0_2px_0_#78350f] active:translate-y-1',
  }[colorScheme]

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label}
        className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full border-2 select-none touch-none flex flex-col items-center justify-center font-black transition-all [-webkit-tap-highlight-color:transparent] ${colorStyles}`}
        onPointerDown={(e) => {
          e.preventDefault()
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            // sin captura
          }
          triggerHaptic()
          onPress(gameKey)
        }}
        onPointerLeave={() => onRelease(gameKey)}
        onPointerUp={() => onRelease(gameKey)}
        onPointerCancel={() => onRelease(gameKey)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="text-base sm:text-lg tracking-tight font-extrabold">{letter}</span>
        {glyph && <span className="text-[10px] opacity-80 -mt-1 font-mono">{glyph}</span>}
      </button>
      <span className="text-[9px] uppercase font-bold tracking-wider text-white/60 drop-shadow">
        {label}
      </span>
    </div>
  )
}

/**
 * Mando arcade virtual táctil con cruceta japonesa y botones Sanwa.
 * Se muestra automáticamente en pantallas táctiles o si se fuerza por prop/URL.
 */
export function TouchPad({
  onPress,
  onRelease,
  showAction = false,
  actionLabel = 'Disparar',
  actionGlyph = 'A',
  showAction2 = false,
  action2Label = 'Bomba',
  action2Glyph = 'B',
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
  forceVisible?: boolean
}) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    if (forceVisible) {
      setIsTouch(true)
      return
    }
    const mq = window.matchMedia('(pointer: coarse)')
    const forceUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('touch') === '1'
    setIsTouch(mq.matches || forceUrl)
    const fn = (e: MediaQueryListEvent) => setIsTouch(e.matches || forceUrl)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [forceVisible])

  if (!isTouch) return null

  return (
    <nav
      aria-label="Controles táctiles arcade"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 flex items-end justify-between select-none"
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Cruceta Arcade (D-Pad) */}
      <div
        className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5 p-2 rounded-2xl bg-zinc-950/85 border border-zinc-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md"
        style={{
          width: '9.5rem',
          height: '9.5rem',
        }}
      >
        <span />
        <DPadButton gameKey="up" onPress={onPress} onRelease={onRelease} label="Arriba" glyph="▲" />
        <span />
        <DPadButton gameKey="left" onPress={onPress} onRelease={onRelease} label="Izquierda" glyph="◀" />
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <span className="text-[7px] text-amber-300/70 font-mono mt-0.5 font-bold">MVS</span>
        </div>
        <DPadButton gameKey="right" onPress={onPress} onRelease={onRelease} label="Derecha" glyph="▶" />
        <span />
        <DPadButton gameKey="down" onPress={onPress} onRelease={onRelease} label="Abajo" glyph="▼" />
        <span />
      </div>

      {/* Botones de acción Sanwa */}
      {(showAction || showAction2) && (
        <div className="pointer-events-auto flex items-end gap-3 p-2 rounded-2xl bg-zinc-950/85 border border-zinc-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md">
          {showAction2 && (
            <SanwaButton
              gameKey="action2"
              onPress={onPress}
              onRelease={onRelease}
              letter={action2Glyph}
              label={action2Label}
              colorScheme="blue"
            />
          )}
          {showAction && (
            <SanwaButton
              gameKey="action"
              onPress={onPress}
              onRelease={onRelease}
              letter={actionGlyph}
              label={actionLabel}
              colorScheme="red"
            />
          )}
        </div>
      )}
    </nav>
  )
}
