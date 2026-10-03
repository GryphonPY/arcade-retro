'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSettings } from '@/components/arcade/store'

/**
 * Marco de pantalla de juego: ocupa todo el espacio disponible y escala la
 * pantalla (canvas + overlays) al mayor tamaño que quepa manteniendo la
 * relación de aspecto lógica del juego. El marcador (`hud`) se alinea con el
 * ancho real de la pantalla.
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
      const scale = Math.min(availW / width, availH / height)
      setSize({ w: Math.floor(width * scale), h: Math.floor(height * scale) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    if (hudRef.current) ro.observe(hudRef.current)
    return () => ro.disconnect()
  }, [width, height])

  return (
    <div ref={areaRef} className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-2 py-2 sm:px-4 sm:py-3">
      {hud && (
        <div ref={hudRef} className="shrink-0 w-full" style={{ maxWidth: size?.w ?? width }}>
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
