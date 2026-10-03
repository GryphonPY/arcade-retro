/** Utilidades numéricas compartidas por los módulos de Búnker 93. */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const TAU = Math.PI * 2

/** Diferencia angular normalizada a (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d <= -Math.PI) d += TAU
  return d
}

/** PRNG determinista (mulberry32) para que el arte procedural sea estable. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randi = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1))
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Mezcla dos colores 0xRRGGBB. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return (
    (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
  )
}

/** Escala la luminosidad de un color 0xRRGGBB. */
export function shade(c: number, k: number): number {
  const r = clamp(Math.round(((c >> 16) & 255) * k), 0, 255)
  const g = clamp(Math.round(((c >> 8) & 255) * k), 0, 255)
  const b = clamp(Math.round((c & 255) * k), 0, 255)
  return (r << 16) | (g << 8) | b
}

export const css = (c: number) => '#' + c.toString(16).padStart(6, '0')
