/** Utilidades matemáticas y de color para Sunset Run. */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const easeIn = (a: number, b: number, t: number) => a + (b - a) * t * t
export const easeOut = (a: number, b: number, t: number) => a + (b - a) * (1 - (1 - t) * (1 - t))
export const easeInOut = (a: number, b: number, t: number) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5)
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step)

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Rng = ReturnType<typeof rng>
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length]
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r()

// ---------- color ----------
export type RGB = [number, number, number]

export function hex(c: string): RGB {
  const s = c.replace('#', '')
  const n = parseInt(s.length === 3 ? s.split('').map((ch) => ch + ch).join('') : s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function css(c: RGB, a = 1): string {
  const r = Math.round(clamp(c[0], 0, 255))
  const g = Math.round(clamp(c[1], 0, 255))
  const b = Math.round(clamp(c[2], 0, 255))
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`
}
export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}
export function mix(a: string, b: string, t: number): string {
  return css(mixRGB(hex(a), hex(b), t))
}
/** Multiplica un color por un tinte (luz ambiental). */
export function tint(c: string, light: RGB): string {
  const x = hex(c)
  return css([(x[0] * light[0]) / 255, (x[1] * light[1]) / 255, (x[2] * light[2]) / 255])
}
export function tintHex(c: string, light: RGB): string {
  const x = hex(c)
  const r = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')
  return '#' + r((x[0] * light[0]) / 255) + r((x[1] * light[1]) / 255) + r((x[2] * light[2]) / 255)
}
export function mixHex(a: string, b: string, t: number): string {
  const c = mixRGB(hex(a), hex(b), t)
  const r = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')
  return '#' + r(c[0]) + r(c[1]) + r(c[2])
}

/** Niveles de niebla precalculados para un color (evita crear strings por frame). */
export const FOG_STEPS = 24
export function fogRamp(c: string, fog: string): string[] {
  const out: string[] = []
  for (let i = 0; i < FOG_STEPS; i++) out.push(mix(c, fog, i / (FOG_STEPS - 1)))
  return out
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

export function fmtTime(t: number): string {
  if (!Number.isFinite(t)) return '--'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t * 100) % 100)
  return `${m}'${String(s).padStart(2, '0')}"${String(cs).padStart(2, '0')}`
}

export function ordinal(n: number): string {
  return `${n}º`
}
