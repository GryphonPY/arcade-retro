'use client'

/**
 * Tamaño lógico adaptable de los juegos. `GameScreen` publica el área útil de
 * la pantalla y cada juego pide su mundo lógico con `fitStage`: el diseño base
 * manda la escala y el espacio sobrante se reparte a lo ancho o a lo alto (hasta
 * `maxX` / `maxY` veces el diseño). Así el marco llena la pantalla sin bandas.
 */

export interface Size {
  w: number
  h: number
  /** Estira el mundo para llenar el área (tableros de cuadrícula, diferencias de pocos px). */
  stretch?: boolean
}

let area: Size | null = null
let areaVersion = 0
let logical: Size | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function subscribeStage(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getLogical(): Size | null {
  return logical
}

/** Lo publica el juego activo; `null` al salir para que otros juegos usen su tamaño base. */
export function publishLogical(size: Size | null) {
  if (logical?.w === size?.w && logical?.h === size?.h && logical?.stretch === size?.stretch) return
  logical = size
  emit()
}

/** Lo llama `GameScreen` al medir el área útil (px CSS, sin relleno ni marcador). */
export function publishArea(next: Size) {
  if (area && area.w === next.w && area.h === next.h) return
  area = next
  areaVersion += 1
}

/** Cambia cada vez que la pantalla cambia de tamaño (rotación, pantalla completa...). */
export function stageVersion(): number {
  return areaVersion
}

export function fitStage(baseW: number, baseH: number, maxX = 1.6, maxY = 2): Size {
  if (!area || area.w <= 0 || area.h <= 0) return { w: baseW, h: baseH }
  const s = Math.min(area.w / baseW, area.h / baseH)
  return {
    w: Math.round(Math.min(baseW * maxX, Math.max(baseW, area.w / s))),
    h: Math.round(Math.min(baseH * maxY, Math.max(baseH, area.h / s))),
  }
}

// Un juego en espera (menú o fin de partida) se vuelve a montar si la pantalla
// cambió de tamaño: así su mundo se recalcula desde cero. Durante una partida
// no se toca; el marco muestra bandas hasta el siguiente inicio.
let remountKey = 0

export function requestRemount() {
  remountKey += 1
  emit()
}

export function getRemountKey(): number {
  return remountKey
}
