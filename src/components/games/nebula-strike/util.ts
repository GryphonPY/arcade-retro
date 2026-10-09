/** Constantes y utilidades matemáticas compartidas por Nebula Strike. */

export const GAME_ID = 'nebula-strike'
export const ACCENT = '#22d3ee'

/** Resolución lógica (vertical). */
import { fitStage, publishLogical } from '../stage'

export const W0 = 360
export const H0 = 540
// Mundo lógico (live bindings): `layoutWorld` lo ajusta a la pantalla al abrir el juego.
export let W = W0
export let H = H0

export function layoutWorld() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}
/** Factor del lienzo interno (backing store) respecto a la resolución lógica. */
export const RS = 2

export const TAU = Math.PI * 2

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randi = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1))
export const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0]
export const sign = (v: number) => (v < 0 ? -1 : 1)
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Diferencia angular normalizada a -PI..PI. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** RNG determinista (mulberry32) para composiciones repetibles. */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Formatea puntuación con separadores de miles (es-MX). */
export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('es-MX')
}

/** Mezcla dos colores hex (#rrggbb). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t))
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t))
  const bl = Math.round(lerp(pa & 255, pb & 255, t))
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)
}

export function rgba(hex: string, a: number): string {
  const p = parseInt(hex.slice(1), 16)
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`
}

/** Familia tipográfica pixel resuelta desde la variable CSS de next/font. */
let pixelFamily = ''
export function pixelFont(): string {
  if (!pixelFamily) {
    let v = ''
    try {
      v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    } catch {
      // sin DOM
    }
    pixelFamily = `${v ? v + ', ' : ''}"Press Start 2P", monospace`
  }
  return pixelFamily
}
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
