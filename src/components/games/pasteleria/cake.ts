/**
 * Modelo de un pastel visto desde arriba. Las posiciones de crema y adornos van en
 * unidades del radio (−1..1, centro en 0,0), así el pastel se puede dibujar en
 * cualquier tamaño (mesa, horno, mano, entrega).
 */
import { FROSTS, TOPS, type FlavorId, type FrostId, type TopId } from './content'

export const GRID = 28
const CELLS = GRID * GRID

export interface Piece {
  id: number
  top: TopId
  x: number
  y: number
  rot: number
  /** Animación al caer (1 → 0). */
  pop: number
}

export interface Cake {
  id: number
  flavor: FlavorId
  /** Masa vertida: ideal 0.85–1.05; más de 1.1 se derrama. */
  fill: number
  spill: number
  /** Horneado: <0.85 crudo, 0.9–1.15 en su punto, >1.4 quemado. */
  bake: number
  /** Índice en FROSTS por celda, −1 sin crema. */
  frost: Int8Array
  frostVer: number
  pieces: Piece[]
  /** Ángulos de corte (0..π), cada uno pasa por el centro. */
  cuts: number[]
}

let nextId = 1
export const newCake = (flavor: FlavorId): Cake => ({
  id: nextId++,
  flavor,
  fill: 0,
  spill: 0,
  bake: 0,
  frost: new Int8Array(CELLS).fill(-1),
  frostVer: 0,
  pieces: [],
  cuts: [],
})

const cellInCircle = (i: number) => {
  const cx = ((i % GRID) + 0.5) / GRID - 0.5
  const cy = (Math.floor(i / GRID) + 0.5) / GRID - 0.5
  return cx * cx + cy * cy <= 0.25
}
const INSIDE: boolean[] = Array.from({ length: CELLS }, (_, i) => cellInCircle(i))
const INSIDE_N = INSIDE.filter(Boolean).length

/** Unta crema en (x,y) (unidades del radio). Devuelve cuántas celdas nuevas cubrió. */
export function spread(c: Cake, x: number, y: number, rad: number, frost: FrostId): number {
  const fi = FROSTS.findIndex((f) => f.id === frost)
  const gx = ((x + 1) / 2) * GRID
  const gy = ((y + 1) / 2) * GRID
  const gr = (rad / 2) * GRID
  let n = 0
  for (let j = Math.max(0, Math.floor(gy - gr)); j <= Math.min(GRID - 1, Math.ceil(gy + gr)); j++) {
    for (let i = Math.max(0, Math.floor(gx - gr)); i <= Math.min(GRID - 1, Math.ceil(gx + gr)); i++) {
      const k = j * GRID + i
      if (!INSIDE[k]) continue
      const dx = i + 0.5 - gx
      const dy = j + 0.5 - gy
      if (dx * dx + dy * dy > gr * gr) continue
      if (c.frost[k] !== fi) {
        if (c.frost[k] === -1) n++
        c.frost[k] = fi
      }
    }
  }
  c.frostVer++
  return n
}

export interface FrostInfo {
  /** Fracción del pastel con crema. */
  cover: number
  /** Fracción por color (sobre el total del pastel). */
  by: Map<FrostId, number>
  /** Color dominante y su fracción en cada mitad (izquierda / derecha). */
  left: [FrostId | null, number]
  right: [FrostId | null, number]
}

export function frostInfo(c: Cake): FrostInfo {
  const by = new Map<FrostId, number>()
  const half = [new Map<number, number>(), new Map<number, number>()]
  const halfN = [0, 0]
  let n = 0
  for (let k = 0; k < CELLS; k++) {
    if (!INSIDE[k]) continue
    const side = k % GRID < GRID / 2 ? 0 : 1
    halfN[side]++
    const v = c.frost[k]
    if (v < 0) continue
    n++
    const id = FROSTS[v].id
    by.set(id, (by.get(id) ?? 0) + 1)
    half[side].set(v, (half[side].get(v) ?? 0) + 1)
  }
  for (const [k, v] of by) by.set(k, v / INSIDE_N)
  const dom = (s: 0 | 1): [FrostId | null, number] => {
    let best = -1
    let bn = 0
    for (const [k, v] of half[s]) if (v > bn) [best, bn] = [k, v]
    return [best < 0 ? null : FROSTS[best].id, bn / Math.max(1, halfN[s])]
  }
  return { cover: n / INSIDE_N, by, left: dom(0), right: dom(1) }
}

/** Echa un puño de adornos alrededor de (x,y). Devuelve los que cayeron fuera. */
export function sprinkle(c: Cake, top: TopId, x: number, y: number, n: number): number {
  let lost = 0
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = n === 1 ? 0 : 0.06 + Math.random() * 0.17
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (px * px + py * py > 0.93 * 0.93) {
      lost++
      continue
    }
    c.pieces.push({ id: nextId++, top, x: px, y: py, rot: (Math.random() - 0.5) * 1.2, pop: 1 })
  }
  return lost
}

export function addCut(c: Cake, angle: number): boolean {
  let a = angle % Math.PI
  if (a < 0) a += Math.PI
  for (const b of c.cuts) {
    const d = Math.abs(a - b)
    if (Math.min(d, Math.PI - d) < 0.18) return false
  }
  c.cuts.push(a)
  return true
}

export const slices = (c: Cake) => (c.cuts.length === 0 ? 1 : c.cuts.length * 2)
export const countOf = (c: Cake, t: TopId) => c.pieces.filter((p) => p.top === t).length
export const countSide = (c: Cake, t: TopId, side: 'l' | 'r') => c.pieces.filter((p) => p.top === t && (side === 'l' ? p.x < 0 : p.x >= 0)).length
export const fruitCount = (c: Cake) => c.pieces.filter((p) => TOPS.find((t) => t.id === p.top)?.fruit).length
export const variety = (c: Cake) => new Set(c.pieces.map((p) => p.top)).size

export type BakeLevel = 'crudo' | 'suave' | 'punto' | 'dorado' | 'quemado'
export function bakeLevel(b: number): BakeLevel {
  if (b < 0.8) return 'crudo'
  if (b < 0.95) return 'suave'
  if (b < 1.15) return 'punto'
  if (b < 1.4) return 'dorado'
  return 'quemado'
}

/** ¿Qué tan parejas son las rebanadas? 1 = perfectas. */
export function cutEvenness(c: Cake): number {
  if (c.cuts.length < 2) return 1
  const s = [...c.cuts].sort((a, b) => a - b)
  const ideal = Math.PI / s.length
  let err = 0
  for (let i = 0; i < s.length; i++) {
    const gap = i === s.length - 1 ? s[0] + Math.PI - s[i] : s[i + 1] - s[i]
    err += Math.abs(gap - ideal) / ideal
  }
  return Math.max(0, 1 - err / s.length)
}
