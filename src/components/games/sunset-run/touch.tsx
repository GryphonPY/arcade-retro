'use client'

/** Controles táctiles para celular horizontal, giro por inclinación y aviso de girar el teléfono. */
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as RPE, type ReactNode } from 'react'
import type { LogicalKey } from '../use-keys'

const pixel = { fontFamily: 'var(--font-pixel)' }

function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // sin vibración
  }
}

function subscribeOrientation(cb: () => void) {
  const mq = window.matchMedia('(orientation: portrait)')
  mq.addEventListener('change', cb)
  window.addEventListener('resize', cb)
  return () => {
    mq.removeEventListener('change', cb)
    window.removeEventListener('resize', cb)
  }
}

/** true si es pantalla táctil en vertical. */
export function usePortraitTouch() {
  return useSyncExternalStore(
    subscribeOrientation,
    () => window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth,
    () => false,
  )
}

export function RotateNotice() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3">
      <div
        className="flex items-center gap-3 rounded-2xl border border-orange-400/40 bg-black/85 px-4 py-3 shadow-[0_0_30px_rgba(249,115,22,0.35)]"
        role="status"
      >
        <div className="sr-rotate relative h-10 w-6 rounded-md border-2 border-orange-300">
          <div className="absolute inset-x-1 bottom-0.5 h-0.5 rounded bg-orange-300" />
        </div>
        <div>
          <p className="text-[10px] text-orange-300" style={pixel}>
            GIRA TU CELULAR
          </p>
          <p className="mt-1 text-xs text-white/70">Sunset Run se juega en horizontal.</p>
        </div>
      </div>
      <style>{`
        @keyframes srRotate { 0%,30% { transform: rotate(0deg) } 60%,100% { transform: rotate(-90deg) } }
        .sr-rotate { animation: srRotate 1.8s ease-in-out infinite alternate }
      `}</style>
    </div>
  )
}

interface PadProps {
  press: (k: LogicalKey) => void
  release: (k: LogicalKey) => void
}

/** Zona de dirección: un solo área con dos mitades para poder deslizar el pulgar. */
function SteerPad({ press, release }: PadProps) {
  const cur = useRef<'left' | 'right' | null>(null)
  const ptr = useRef<number | null>(null)
  const leftEl = useRef<HTMLDivElement | null>(null)
  const rightEl = useRef<HTMLDivElement | null>(null)
  const set = (d: 'left' | 'right' | null) => {
    if (cur.current === d) return
    if (cur.current) release(cur.current)
    if (d) {
      press(d)
      haptic()
    }
    cur.current = d
    leftEl.current?.classList.toggle('sr-on', d === 'left')
    rightEl.current?.classList.toggle('sr-on', d === 'right')
  }
  const track = (e: RPE<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    set(e.clientX < r.left + r.width / 2 ? 'left' : 'right')
  }
  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-3 flex touch-none select-none gap-3"
      onPointerDown={(e) => {
        e.preventDefault()
        ptr.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        track(e)
      }}
      onPointerMove={(e) => {
        if (ptr.current === e.pointerId) track(e)
      }}
      onPointerUp={(e) => {
        if (ptr.current !== e.pointerId) return
        ptr.current = null
        set(null)
      }}
      onPointerCancel={() => {
        ptr.current = null
        set(null)
      }}
    >
      <div ref={leftEl} className="sr-btn flex size-[74px] items-center justify-center rounded-full">
        <Arrow dir={-1} />
      </div>
      <div ref={rightEl} className="sr-btn flex size-[74px] items-center justify-center rounded-full">
        <Arrow dir={1} />
      </div>
    </div>
  )
}

function Arrow({ dir }: { dir: number }) {
  return (
    <svg viewBox="0 0 24 24" className="size-8" style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}>
      <path d="M8 4l9 8-9 8z" fill="currentColor" />
    </svg>
  )
}

function HoldButton({
  k,
  press,
  release,
  className,
  children,
  tint,
}: PadProps & { k: LogicalKey; className: string; children: ReactNode; tint: string }) {
  const ptrs = useRef<Set<number>>(new Set())
  const el = useRef<HTMLDivElement | null>(null)
  const down = (e: RPE<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (ptrs.current.size === 0) {
      press(k)
      haptic()
      el.current?.classList.add('sr-on')
    }
    ptrs.current.add(e.pointerId)
  }
  const up = (e: RPE<HTMLDivElement>) => {
    if (!ptrs.current.delete(e.pointerId)) return
    if (ptrs.current.size === 0) {
      release(k)
      el.current?.classList.remove('sr-on')
    }
  }
  return (
    <div
      ref={el}
      className={`sr-btn pointer-events-auto flex touch-none select-none flex-col items-center justify-center rounded-full ${className}`}
      style={{ ['--sr-tint' as string]: tint }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {children}
    </div>
  )
}

export function TouchControls({
  press,
  release,
  auto,
  onRadio,
}: PadProps & { auto: boolean; onRadio: () => void }) {
  // suelta todo al desmontar
  useEffect(() => {
    return () => {
      for (const k of ['left', 'right', 'up', 'down', 'action'] as LogicalKey[]) release(k)
    }
  }, [release])
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <style>{`
        .sr-btn { background: rgba(10,8,20,0.38); border: 2px solid rgba(255,255,255,0.28); color: rgba(255,255,255,0.85); transition: transform .06s, background .06s; }
        .sr-btn.sr-on { background: var(--sr-tint, rgba(249,115,22,0.55)); transform: scale(0.94); border-color: rgba(255,255,255,0.7); }
      `}</style>
      <SteerPad press={press} release={release} />
      <div className="absolute bottom-3 right-3 flex items-end gap-3">
        <HoldButton k="down" press={press} release={release} className="size-[64px]" tint="rgba(239,68,68,0.55)">
          <span className="text-[8px]" style={pixel}>
            FRENO
          </span>
        </HoldButton>
        <div className="flex flex-col items-center gap-3">
          <HoldButton k="action" press={press} release={release} className={auto ? 'size-[78px]' : 'size-[62px]'} tint="rgba(59,130,246,0.6)">
            <span className="text-[8px]" style={pixel}>
              NITRO
            </span>
          </HoldButton>
          {!auto && (
            <HoldButton k="up" press={press} release={release} className="size-[78px]" tint="rgba(34,197,94,0.55)">
              <span className="text-[8px]" style={pixel}>
                ACEL
              </span>
            </HoldButton>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur()
          onRadio()
        }}
        className="sr-btn pointer-events-auto absolute right-3 top-[84px] flex h-9 items-center gap-1 rounded-full px-3 text-[8px]"
        style={pixel}
      >
        RADIO
      </button>
    </div>
  )
}

// ===================== Inclinación =====================

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Pide permiso (iOS) para usar el giroscopio. Debe llamarse desde un gesto. */
export async function requestTilt(): Promise<boolean> {
  try {
    const C = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent
    if (!C) return false
    if (typeof C.requestPermission === 'function') {
      const r = await C.requestPermission()
      return r === 'granted'
    }
    return true
  } catch {
    return false
  }
}

/** Escribe en `out.current` la dirección analógica (-1..1) según la inclinación tipo volante. */
export function useTilt(enabled: boolean, outRef: { current: number | null }) {
  useEffect(() => {
    if (!enabled) {
      outRef.current = null
      return
    }
    const onOri = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      const b = (e.beta * Math.PI) / 180
      const g = (e.gamma * Math.PI) / 180
      // gravedad en coordenadas del dispositivo
      const dx = Math.cos(b) * Math.sin(g)
      const dy = -Math.sin(b)
      const ang = ((screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) * Math.PI) / 180
      const sx = dx * Math.cos(ang) - dy * Math.sin(ang)
      const sy = dx * Math.sin(ang) + dy * Math.cos(ang)
      if (Math.hypot(sx, sy) < 0.25) {
        outRef.current = 0
        return
      }
      // girar a la derecha (horario) hace que la gravedad apunte abajo-derecha en pantalla
      const deg = (Math.atan2(sx, -sy) * 180) / Math.PI
      const dead = 2.5
      const v = Math.abs(deg) < dead ? 0 : (deg - Math.sign(deg) * dead) / 22
      outRef.current = Math.max(-1, Math.min(1, v))
    }
    window.addEventListener('deviceorientation', onOri)
    return () => {
      window.removeEventListener('deviceorientation', onOri)
      outRef.current = null
    }
  }, [enabled, outRef])
}
