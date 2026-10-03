/**
 * Construcción de pistas por segmentos (técnica clásica pseudo 3D):
 * curvas, colinas, túneles, puentes, decorado por tema y pickups.
 */
import { CUPS, THEMES, TODS, type DecorRule, type PickupKind, type SpriteKind, type Theme, type Tod, type TrackMeta } from './data'
import { easeIn, easeInOut, pick, range, rng, type Rng } from './util'

export const SEG_LEN = 200
export const ROAD_W = 2000
export const RUMBLE = 3
export const LANES = 3
export const TUNNEL_H = 3800
export const WALL_X = 1.32
export const RAIL_X = 1.2
export const START_SEG = 34

export interface SpriteInst {
  kind: SpriteKind
  x: number
}
export interface PickupInst {
  kind: PickupKind
  x: number
  /** Desplazamiento visual (imán). */
  dx: number
  takenLap: number
}

export interface Seg {
  i: number
  wy1: number
  wy2: number
  curve: number
  tunnel: boolean
  tStart: boolean
  bridge: boolean
  bStart: boolean
  sprites: SpriteInst[] | null
  pickups: PickupInst[] | null
  cars: number[]
  alt: number
  // proyección (se reescribe cada frame)
  sx1: number
  sy1: number
  sw1: number
  sc1: number
  cz1: number
  sx2: number
  sy2: number
  sw2: number
  sc2: number
  cz2: number
  clip: number
  fog: number
  vis: boolean
}

export interface Track {
  meta: TrackMeta
  theme: Theme
  tod: Tod
  cup: number
  race: number
  segs: Seg[]
  N: number
  length: number
  mapX: Float32Array
  mapY: Float32Array
}

function newSeg(i: number, wy1: number, wy2: number, curve: number): Seg {
  return {
    i,
    wy1,
    wy2,
    curve,
    tunnel: false,
    tStart: false,
    bridge: false,
    bStart: false,
    sprites: null,
    pickups: null,
    cars: [],
    alt: Math.floor(i / RUMBLE) % 2,
    sx1: 0,
    sy1: 0,
    sw1: 0,
    sc1: 0,
    cz1: 0,
    sx2: 0,
    sy2: 0,
    sw2: 0,
    sc2: 0,
    cz2: 0,
    clip: 0,
    fog: 0,
    vis: false,
  }
}

interface Flags {
  tunnel?: boolean
  bridge?: boolean
}

export function buildTrack(cupIdx: number, raceIdx: number): Track {
  const meta = CUPS[cupIdx].tracks[raceIdx]
  return buildTrackFrom(meta, cupIdx, raceIdx)
}

export function buildTrackFrom(meta: TrackMeta, cupIdx: number, raceIdx: number): Track {
  const theme = THEMES[meta.theme]
  const tod = TODS[meta.tod]
  const r = rng(meta.seed * 131 + 7)
  const segs: Seg[] = []
  let lastY = 0

  const addSeg = (curve: number, y: number, f: Flags) => {
    const s = newSeg(segs.length, lastY, y, curve)
    if (f.tunnel) s.tunnel = true
    if (f.bridge) s.bridge = true
    segs.push(s)
    lastY = y
  }
  /** Tramo con entrada/mantenimiento/salida de curva y cambio de altura (en segmentos). */
  const addRoad = (enter: number, hold: number, leave: number, curve: number, dy: number, f: Flags = {}) => {
    const startY = lastY
    const endY = startY + dy * SEG_LEN
    const total = enter + hold + leave
    for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total), f)
    for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(startY, endY, (enter + n) / total), f)
    for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total), f)
  }

  const hillDy = (scale: number) => {
    if (r() > 0.25 + meta.hilly * 0.65) return 0
    const curY = lastY / SEG_LEN
    const mag = range(r, 12, 30 + meta.hilly * 40) * scale
    let dir = r() < 0.5 ? -1 : 1
    if (curY > 50) dir = -1
    if (curY < -25) dir = 1
    return Math.round(dir * mag)
  }

  const curveMag = () => {
    const x = r()
    const c = cupIdx
    const hard = 0.08 + meta.curvy * 0.3 + c * 0.05
    const med = 0.35 + meta.curvy * 0.2
    if (x < hard) return range(r, 4.6, 5.6 + c * 0.5)
    if (x < hard + med) return range(r, 3, 4.2)
    return range(r, 1.6, 2.6)
  }

  // ---- tramo de salida ----
  addRoad(0, START_SEG + 26, 0, 0, 0)

  // planificación de túneles y puentes a lo largo de la vuelta
  const target = meta.length
  const specials: { at: number; kind: 'tunnel' | 'bridge' }[] = []
  const nSpec = meta.tunnels + meta.bridges
  const kinds: ('tunnel' | 'bridge')[] = []
  for (let i = 0; i < meta.tunnels; i++) kinds.push('tunnel')
  for (let i = 0; i < meta.bridges; i++) kinds.push('bridge')
  // intercalar
  kinds.sort(() => r() - 0.5)
  for (let i = 0; i < nSpec; i++) {
    specials.push({ at: Math.round(target * ((i + 0.6 + r() * 0.5) / (nSpec + 0.8))), kind: kinds[i] })
  }

  while (segs.length < target - 110) {
    const sp = specials[0]
    if (sp && segs.length >= sp.at) {
      specials.shift()
      if (sp.kind === 'tunnel') {
        addRoad(8, 12, 8, 0, 0)
        const len = Math.round(range(r, 70, 120))
        const cv = r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1) * range(r, 1.5, 3)
        addRoad(Math.round(len * 0.3), Math.round(len * 0.4), Math.round(len * 0.3), cv, 0, { tunnel: true })
        addRoad(0, 10, 0, 0, 0)
      } else {
        addRoad(10, 10, 10, 0, 0)
        const len = Math.round(range(r, 60, 100))
        const cv = r() < 0.6 ? 0 : (r() < 0.5 ? -1 : 1) * range(r, 1, 2)
        addRoad(Math.round(len * 0.3), Math.round(len * 0.4), Math.round(len * 0.3), cv, 0, { bridge: true })
        addRoad(0, 8, 0, 0, 0)
      }
      continue
    }
    const p = r()
    const straightP = 0.16 + (1 - meta.curvy) * 0.18
    if (p < straightP) {
      const n = Math.round(range(r, 18, 46))
      addRoad(Math.round(n / 3), Math.round(n / 3), Math.round(n / 3), 0, hillDy(1))
    } else if (p < 0.78) {
      const dir = r() < 0.5 ? -1 : 1
      const mag = curveMag()
      const hold = Math.round(range(r, 14, 40 + meta.curvy * 20))
      addRoad(Math.round(range(r, 10, 22)), hold, Math.round(range(r, 10, 22)), dir * mag, hillDy(1))
    } else {
      const dir = r() < 0.5 ? -1 : 1
      const m1 = curveMag()
      const m2 = curveMag()
      addRoad(12, Math.round(range(r, 12, 26)), 10, dir * m1, hillDy(0.6))
      addRoad(10, Math.round(range(r, 12, 26)), 12, -dir * m2, hillDy(0.6))
    }
  }
  // cerrar: volver a altura 0 y recta hacia la salida
  const back = -lastY / SEG_LEN
  const blen = Math.max(60, Math.round(Math.abs(back) * 2.2))
  addRoad(Math.round(blen / 3), Math.round(blen / 3), Math.round(blen / 3), 0, back)
  addRoad(0, 24, 0, 0, 0)
  // corrige el error de redondeo final
  const last = segs[segs.length - 1]
  last.wy2 = 0
  for (const s of segs) {
    if (Math.abs(s.wy1) < 1e-6) s.wy1 = 0
  }

  const N = segs.length
  // marcar entradas
  for (let i = 0; i < N; i++) {
    const s = segs[i]
    const prev = segs[(i - 1 + N) % N]
    if (s.tunnel && !prev.tunnel) s.tStart = true
    if (s.bridge && !prev.bridge) s.bStart = true
  }

  decorate(segs, theme, r, cupIdx)
  placePickups(segs, r, cupIdx)

  // minimapa
  const mx = new Float32Array(N + 1)
  const my = new Float32Array(N + 1)
  let hx = 0
  let px = 0
  let py = 0
  // reparte el giro sobrante para que el minimapa sea un circuito cerrado
  let sumC = 0
  for (const sg of segs) sumC += sg.curve
  const kc = 0.0016
  const total = sumC * kc
  const loopTurn = total >= 0 ? Math.PI * 2 : -Math.PI * 2
  const extra = (loopTurn - total) / N
  for (let i = 0; i < N; i++) {
    hx += segs[i].curve * kc + extra
    px += Math.sin(hx)
    py -= Math.cos(hx)
    mx[i + 1] = px
    my[i + 1] = py
  }
  // cierre lineal del recorrido
  const ex = mx[N]
  const ey = my[N]
  for (let i = 0; i <= N; i++) {
    mx[i] -= (ex * i) / N
    my[i] -= (ey * i) / N
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i <= N; i++) {
    minX = Math.min(minX, mx[i])
    maxX = Math.max(maxX, mx[i])
    minY = Math.min(minY, my[i])
    maxY = Math.max(maxY, my[i])
  }
  const sc = 1 / Math.max(maxX - minX, maxY - minY, 1)
  for (let i = 0; i <= N; i++) {
    mx[i] = (mx[i] - (minX + maxX) / 2) * sc
    my[i] = (my[i] - (minY + maxY) / 2) * sc
  }

  return { meta, theme, tod, cup: cupIdx, race: raceIdx, segs, N, length: N * SEG_LEN, mapX: mx, mapY: my }
}

function pickRule(r: Rng, rules: DecorRule[]): DecorRule {
  let total = 0
  for (const d of rules) total += d.weight
  let x = r() * total
  for (const d of rules) {
    x -= d.weight
    if (x <= 0) return d
  }
  return rules[0]
}

function addSprite(s: Seg, kind: SpriteKind, x: number) {
  if (!s.sprites) s.sprites = []
  s.sprites.push({ kind, x })
}

function decorate(segs: Seg[], theme: Theme, r: Rng, cup: number) {
  const N = segs.length
  const nearTunnel = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (segs[i].tStart) for (let k = 1; k <= 8; k++) nearTunnel[(i - k + N) % N] = 1
  }
  addSprite(segs[START_SEG], 'gantry', 0)
  const boards: SpriteKind[] = ['billboard', 'billboard2', 'billboard3']
  let nextBoard = START_SEG + 40
  for (let i = 0; i < N; i++) {
    const s = segs[i]
    if (s.tunnel || nearTunnel[i]) continue
    if (s.bridge) {
      if (s.bStart || (i + 1 < N && !segs[i + 1].bridge)) {
        addSprite(s, 'tower', -1.42)
        addSprite(s, 'tower', 1.42)
      }
      continue
    }
    let leftBusy = false
    let rightBusy = false
    if (Math.abs(s.curve) >= 3 && i % 7 === 0) {
      const outside = s.curve > 0 ? -1 : 1
      addSprite(s, s.curve > 0 ? 'chevR' : 'chevL', outside * 1.32)
      if (outside < 0) leftBusy = true
      else rightBusy = true
    }
    if (i >= nextBoard && i < N - 30) {
      nextBoard = i + 90 + Math.floor(r() * 90)
      const side = r() < 0.5 ? -1 : 1
      if (!(side < 0 ? leftBusy : rightBusy)) {
        addSprite(s, pick(r, boards), side * 1.55)
        if (side < 0) leftBusy = true
        else rightBusy = true
      }
    }
    if (theme.id === 'ciudad' && i % 12 === 0) {
      if (!leftBusy) addSprite(s, 'lamp', -1.14)
      if (!rightBusy) addSprite(s, 'lamp', 1.14)
    }
    if (Math.abs(i - START_SEG) < 3) continue
    for (const side of [-1, 1]) {
      if (side < 0 ? leftBusy : rightBusy) continue
      if (r() < theme.density * (0.8 + cup * 0.1)) {
        const d = pickRule(r, theme.decor)
        addSprite(s, d.kind, side * range(r, d.min, d.max))
      }
    }
  }
}

function placePickups(segs: Seg[], r: Rng, cup: number) {
  const N = segs.length
  const spacing = 150 - cup * 28
  const lanes = [-0.62, 0, 0.62]
  let i = START_SEG + 70
  while (i < N - 40) {
    const roll = r()
    const lane = pick(r, lanes)
    const add = (s: Seg, kind: PickupKind, x: number) => {
      if (!s.pickups) s.pickups = []
      s.pickups.push({ kind, x, dx: 0, takenLap: -1 })
    }
    if (roll < 0.42) {
      const drift = r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1) * 0.12
      for (let k = 0; k < 6; k++) add(segs[(i + k * 3) % N], 'coin', Math.max(-0.8, Math.min(0.8, lane + drift * k)))
    } else if (roll < 0.72) {
      add(segs[i], 'nitro', lane)
    } else if (roll < 0.86) {
      add(segs[i], 'shield', lane)
    } else {
      add(segs[i], 'magnet', lane)
    }
    i += Math.round(spacing * (0.75 + r() * 0.5))
  }
}

export function findSeg(t: Track, z: number): Seg {
  const n = Math.floor(z / SEG_LEN) % t.N
  return t.segs[(n + t.N) % t.N]
}

export function wrapZ(t: Track, z: number) {
  const L = t.length
  return ((z % L) + L) % L
}
