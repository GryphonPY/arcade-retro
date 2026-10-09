'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useSettings } from '@/components/arcade/store'
import { getLogical, publishArea, publishLogical, subscribeStage } from './stage'

/**
 * Marco de pantalla de juego: ocupa todo el espacio disponible y escala la
 * pantalla (canvas + overlays) al mayor tamaño que quepa con el mundo lógico del
 * juego (`stage.ts`; si no publica uno, su tamaño base). El marcador (`hud`) se
 * alinea con el ancho real de la pantalla.
 */
export function GameScreen({
  width,
  height,
  hud,
  className,
  children,
}: {
  width: number
  height: number
  hud?: ReactNode
  className?: string
  children: ReactNode
}) {
  const areaRef = useRef<HTMLDivElement | null>(null)
  const hudRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const { crt } = useSettings()
  const logical = useSyncExternalStore(subscribeStage, getLogical, () => null)
  const lw = logical?.w ?? width
  const lh = logical?.h ?? height

  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const measure = () => {
      const cs = getComputedStyle(area)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const availW = area.clientWidth - padX
      const availH = area.clientHeight - padY - (hudRef.current?.offsetHeight ?? 0)
      if (availW <= 0 || availH <= 0) return
      publishArea({ w: availW, h: availH })
      if (logical?.stretch) {
        setSize({ w: availW, h: availH })
        return
      }
      const scale = Math.min(availW / lw, availH / lh)
      setSize({ w: Math.floor(lw * scale), h: Math.floor(lh * scale) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    if (hudRef.current) ro.observe(hudRef.current)
    return () => ro.disconnect()
  }, [lw, lh, logical?.stretch])

  // Al salir del juego se libera su tamaño lógico para el siguiente.
  useLayoutEffect(() => () => publishLogical(null), [])

  return (
    <div ref={areaRef} className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-2 py-2 sm:px-4 sm:py-3">
      {hud && (
        // Una sola línea y ancho del área: así su altura no depende del escalado (no hay bucle de medidas).
        <div ref={hudRef} className="shrink-0 w-full whitespace-nowrap">
          {hud}
        </div>
      )}
      <div
        className={`relative shrink-0 overflow-hidden ${crt ? 'crt' : ''} ${className ?? ''}`}
        style={size ? { width: size.w, height: size.h } : { width, height, visibility: 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}
