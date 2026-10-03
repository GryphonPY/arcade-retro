/**
 * Arte pixel generado por código: coches traseros con frames de giro y luces
 * de freno, objetos de la orilla por tema, carteles y pickups. Todo se pinta
 * una vez en canvases pequeños y se escala con vecino más cercano.
 */
import type { BodyStyle, CarColors, PickupKind, SpriteKind } from './data'
import { makeCanvas, type RGB } from './util'

type Ctx = CanvasRenderingContext2D

const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
const disc = (c: Ctx, cx: number, cy: number, r: number, col: string) => {
  c.fillStyle = col
  for (let y = -r; y <= r; y++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y)))
    c.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1)
  }
}
const ell = (c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) => {
  c.fillStyle = col
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))))
    c.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1)
  }
}
const poly = (c: Ctx, pts: number[], col: string) => {
  c.fillStyle = col
  c.beginPath()
  c.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1])
  c.closePath()
  c.fill()
}
const line = (c: Ctx, pts: number[], col: string, w: number) => {
  c.strokeStyle = col
  c.lineWidth = w
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1])
  c.stroke()
}

/** Endurece el alfa (sin antialias) para un look pixel nítido. */
function crisp(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d')
  if (!c) return
  const d = c.getImageData(0, 0, cv.width, cv.height)
  const a = d.data
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] >= 110 ? 255 : 0
  c.putImageData(d, 0, 0)
}

// ---------- fuente bitmap 3x5 para carteles ----------
const FONT: Record<string, string> = {
  A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '111100101101111', H: '101101111101101',
  I: '111010010010111', J: '001001001101111', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '111101101101111', P: '111101111100100',
  Q: '111101101111001', R: '110101110101101', S: '111100111001111', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
  '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
  '!': '010010010000010', '.': '000000000000010', '-': '000000111000000', ' ': '000000000000000',
  '/': '001001010100100',
}
export function bitText(c: Ctx, text: string, x: number, y: number, s: number, col: string) {
  c.fillStyle = col
  let cx = x
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']
    for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s)
    cx += 4 * s
  }
}
export const bitWidth = (text: string, s: number) => text.length * 4 * s - s

// ===================== Coches =====================

export const CAR_W = 72
export const CAR_H = 40

function wheels(c: Ctx, big: boolean, t: number) {
  const y = big ? 26 : 28
  const h = big ? 13 : 11
  const w = big ? 12 : 11
  const lx = (big ? 3 : 5) - Math.round(t * 0.5)
  const rx = big ? 57 : 56
  for (const x of [lx, rx]) {
    R(c, x, y, w + (x === lx ? Math.round(t * 0.5) : 0), h, '#121214')
    for (let yy = y + 1; yy < y + h - 1; yy += 2) R(c, x + 1, yy, w - 2, 1, '#26262c')
  }
}

function lights(c: Ctx, x: number, y: number, w: number, h: number, brake: boolean, night: boolean) {
  R(c, x, y, w, h, brake ? '#ff2e2e' : night ? '#e0262b' : '#9e141b')
  R(c, x + 1, y + 1, w - 2, Math.max(1, h - 2), brake ? '#ffb2a6' : night ? '#ff6b5e' : '#c42a2a')
}

/**
 * Coche visto desde atrás. `t` = 0..2 (giro a la derecha; el giro a la
 * izquierda se obtiene reflejando). `brake` enciende las luces.
 */
export function paintCar(style: BodyStyle, k: CarColors, t: number, brake: boolean, night = false): HTMLCanvasElement {
  const [cv, c] = makeCanvas(CAR_W, CAR_H)
  const s = Math.round(t * 1.5)
  const side = t * 3
  const glass = '#26304a'
  const glassHi = '#4b5c82'
  const B = k.body
  const D = k.dark
  const L = k.light
  const T = k.trim
  if (style === 'gt') {
    wheels(c, false, t)
    if (side) R(c, 6 - side, 15, side, 13, D)
    R(c, 7, 27, 58, 5, D)
    R(c, 9, 31, 54, 2, T)
    R(c, 17, 30, 5, 3, '#a7a9b2')
    R(c, 18, 31, 3, 1, '#2a2a2a')
    R(c, 50, 30, 5, 3, '#a7a9b2')
    R(c, 51, 31, 3, 1, '#2a2a2a')
    R(c, 5, 16, 62, 12, B)
    R(c, 5, 16, 62, 1, L)
    R(c, 5, 26, 62, 1, D)
    R(c, 8, 18, 56, 7, '#121214')
    lights(c, 9, 19, 21, 5, brake, night)
    lights(c, 42, 19, 21, 5, brake, night)
    for (const yy of [20, 22]) {
      R(c, 9, yy, 21, 1, '#121214')
      R(c, 42, yy, 21, 1, '#121214')
    }
    R(c, 31, 24, 10, 4, '#f1eedd')
    R(c, 32, 25, 8, 1, '#3a3a3a')
    // cubierta trasera
    R(c, 9 + s, 11, 54, 5, B)
    R(c, 9 + s, 11, 54, 1, L)
    // parabrisas y ocupantes
    R(c, 16 + s, 5, 40, 1, T)
    R(c, 17 + s, 6, 38, 5, glass)
    R(c, 18 + s, 6, 10, 1, glassHi)
    // conductor y copiloto (vistos de espaldas)
    R(c, 21 + s, 8, 10, 3, '#f4f1ea')
    R(c, 22 + s, 8, 8, 1, '#ffffff')
    R(c, 23 + s, 2, 6, 7, '#3b2414')
    R(c, 24 + s, 2, 4, 1, '#5a3a22')
    R(c, 41 + s, 8, 10, 3, '#ec4899')
    R(c, 42 + s, 8, 8, 1, '#f9a8d4')
    R(c, 43 + s, 2, 6, 7, '#f3c341')
    R(c, 44 + s, 2, 4, 1, '#ffe08a')
    R(c, 49 + s, 4, 3, 2, '#f3c341')
    R(c, 51 + s, 5, 3, 2, '#e0a92a')
  } else if (style === 'wedge') {
    wheels(c, false, t)
    if (side) R(c, 5 - side, 14, side, 14, D)
    R(c, 6, 26, 60, 6, T)
    for (const x of [25, 30, 40, 45]) {
      R(c, x, 28, 4, 3, '#a7a9b2')
      R(c, x + 1, 29, 2, 1, '#202020')
    }
    R(c, 5, 15, 62, 11, B)
    R(c, 5, 15, 62, 1, L)
    lights(c, 7, 17, 18, 6, brake, night)
    lights(c, 47, 17, 18, 6, brake, night)
    R(c, 7, 19, 18, 1, '#4a0b0e')
    R(c, 47, 19, 18, 1, '#4a0b0e')
    R(c, 27, 17, 18, 6, '#121214')
    R(c, 31, 22, 10, 3, '#f1eedd')
    R(c, 10 + s, 10, 52, 5, B)
    for (let i = 0; i < 12; i++) R(c, 12 + s + i * 4, 11, 2, 3, D)
    R(c, 22 + s, 6, 28, 5, B)
    R(c, 25 + s, 7, 22, 3, glass)
    R(c, 26 + s, 7, 6, 1, glassHi)
    R(c, 16 + s, 3, 2, 8, T)
    R(c, 54 + s, 3, 2, 8, T)
    R(c, 3 + s, 1, 66, 3, B)
    R(c, 3 + s, 1, 66, 1, L)
    R(c, 3 + s, 3, 66, 1, D)
    if (k.stripe) R(c, 34 + s, 1, 4, 3, k.stripe)
  } else if (style === 'coupe') {
    wheels(c, false, t)
    if (side) {
      R(c, 6 - side, 15, side, 12, D)
      R(c, 18 + s - side, 7, side, 6, glass)
    }
    R(c, 6, 27, 60, 4, '#2a2a30')
    R(c, 52, 30, 6, 2, '#a7a9b2')
    R(c, 5, 16, 62, 11, B)
    R(c, 5, 16, 62, 1, L)
    if (k.stripe) {
      R(c, 31, 16, 3, 11, k.stripe)
      R(c, 38, 16, 3, 11, k.stripe)
    }
    R(c, 28, 18, 16, 5, '#121214')
    R(c, 31, 23, 10, 4, '#f1eedd')
    R(c, 32, 24, 8, 1, '#3a3a3a')
    for (const x of [13, 22, 50, 59]) {
      disc(c, x, 21, 3, brake ? '#ff2e2e' : night ? '#e0262b' : '#9e141b')
      disc(c, x, 21, 1, brake ? '#ffd0c8' : night ? '#ff7a6b' : '#d23a3a')
    }
    R(c, 6 + s, 13, 60, 3, D)
    R(c, 6 + s, 13, 60, 1, L)
    R(c, 15 + s, 6, 3, 7, B)
    R(c, 54 + s, 6, 3, 7, B)
    R(c, 18 + s, 6, 36, 7, glass)
    for (let i = 0; i < 4; i++) R(c, 22 + s + i * 3, 6 + i, 2, 1, glassHi)
    R(c, 20 + s, 3, 32, 3, B)
    R(c, 20 + s, 3, 32, 1, L)
    if (k.stripe) {
      R(c, 31 + s, 3, 3, 3, k.stripe)
      R(c, 38 + s, 3, 3, 3, k.stripe)
    }
  } else {
    // muscle
    wheels(c, true, t)
    if (side) R(c, 5 - side, 13, side, 14, D)
    R(c, 8, 29, 56, 3, D)
    R(c, 11, 30, 7, 3, '#b8bac2')
    R(c, 54, 30, 7, 3, '#b8bac2')
    R(c, 5, 14, 62, 12, B)
    R(c, 5, 14, 62, 1, L)
    if (k.stripe) {
      R(c, 27, 14, 5, 12, k.stripe)
      R(c, 40, 14, 5, 12, k.stripe)
    }
    lights(c, 8, 17, 56, 5, brake, night)
    for (let x = 15; x < 64; x += 7) R(c, x, 17, 1, 5, '#3a0b0e')
    R(c, 31, 22, 10, 4, '#f1eedd')
    R(c, 32, 23, 8, 1, '#3a3a3a')
    R(c, 5, 26, 62, 3, k.trim)
    R(c, 5, 28, 62, 1, '#7d808a')
    R(c, 18 + s, 4, 36, 10, B)
    R(c, 18 + s, 4, 36, 1, L)
    R(c, 20 + s, 6, 32, 7, glass)
    R(c, 21 + s, 6, 8, 1, glassHi)
    R(c, 31 + s, 0, 10, 5, '#c7c9d1')
    R(c, 32 + s, 1, 8, 1, '#7a7d86')
    R(c, 32 + s, 3, 8, 1, '#7a7d86')
  }
  return cv
}

export interface CarFrames {
  /** frames[turn 0..2][brake 0/1] */
  frames: HTMLCanvasElement[][]
}
const carCache = new Map<string, CarFrames>()
export function carFrames(style: BodyStyle, k: CarColors, night: boolean): CarFrames {
  const key = `${style}|${k.body}|${k.stripe ?? ''}|${night ? 1 : 0}`
  const hit = carCache.get(key)
  if (hit) return hit
  const frames = [0, 1, 2].map((t) => [paintCar(style, k, t, false, night), paintCar(style, k, t, true, night)])
  const f = { frames }
  carCache.set(key, f)
  return f
}

// ===================== Objetos de la orilla =====================

export interface SpriteDef {
  img: HTMLCanvasElement
  flip: HTMLCanvasElement
  /** Ancho en unidades de mundo. */
  w: number
  /** Fracción del ancho que colisiona (0 = no colisiona). */
  hit: number
}

interface ArtDef {
  w: number
  h: number
  world: number
  hit: number
  paint: (c: Ctx, w: number, h: number) => void
  /** Partes emisivas (no se oscurecen de noche). */
  glow?: (c: Ctx, w: number, h: number, night: boolean) => void
}

function palmArt(lean: number, tall: boolean): ArtDef['paint'] {
  return (c, w, h) => {
    const bx = w / 2 - lean * 4
    const top = tall ? 18 : 22
    const tx = w / 2 + lean * 6
    // tronco
    const n = 16
    for (let i = 0; i <= n; i++) {
      const k = i / n
      const x = bx + (tx - bx) * (k * k)
      const y = h - 1 - (h - 1 - top) * k
      const tw = 5 - k * 1.6
      R(c, x - tw / 2, y - 3, tw, 4, i % 2 ? '#8b5a31' : '#714522')
      R(c, x - tw / 2, y - 3, 1, 4, '#5a3518')
    }
    // hojas
    const leaves = [
      [-1, -0.25], [-0.75, 0.2], [-0.35, 0.55], [0.2, 0.6], [0.65, 0.25], [1, -0.2], [0.05, -0.55], [-0.45, -0.5], [0.5, -0.45],
    ]
    for (const [dx, dy] of leaves) {
      const ex = tx + dx * 20
      const ey = top + dy * 12 + 9
      const mx = tx + dx * 11
      const my = top + dy * 6 - 4
      line(c, [tx, top, mx, my, ex, ey], '#1c6b2f', 5)
    }
    for (const [dx, dy] of leaves) {
      const ex = tx + dx * 19
      const ey = top + dy * 12 + 7
      const mx = tx + dx * 10
      const my = top + dy * 6 - 5
      line(c, [tx, top, mx, my, ex, ey], '#2f9a45', 3)
      line(c, [tx, top - 1, mx, my - 1], '#6ccf6e', 1)
    }
    disc(c, tx - 2, top + 3, 2, '#5a3518')
    disc(c, tx + 2, top + 4, 2, '#6b4423')
  }
}

function cactusArt(two: boolean): ArtDef['paint'] {
  return (c, w, h) => {
    const cx = Math.round(w / 2)
    const g = '#2f8a3e'
    const gd = '#1f6a2c'
    const gl = '#57b562'
    R(c, cx - 4, 6, 8, h - 6, g)
    disc(c, cx, 6, 4, g)
    R(c, cx - 4, 6, 2, h - 6, gl)
    R(c, cx + 2, 6, 2, h - 6, gd)
    // brazos
    const arm = (side: number, y: number, len: number, up: number) => {
      const x0 = side < 0 ? cx - 4 - len : cx + 4
      R(c, x0, y, len, 5, g)
      const ax = side < 0 ? x0 : x0 + len - 5
      R(c, ax, y - up, 5, up + 5, g)
      disc(c, ax + 2, y - up, 2, g)
      R(c, ax, y - up, 1, up + 5, gl)
    }
    arm(-1, two ? 20 : 18, 6, 10)
    if (two) arm(1, 14, 5, 8)
    else arm(1, 24, 6, 7)
    for (let y = 9; y < h - 2; y += 4) {
      R(c, cx - 1, y, 1, 1, '#d9f99d')
      R(c, cx + 1, y + 2, 1, 1, '#d9f99d')
    }
  }
}

function rockArt(base: string, dark: string, light: string, snow: boolean): ArtDef['paint'] {
  return (c, w, h) => {
    poly(c, [2, h, 5, h * 0.45, w * 0.3, h * 0.15, w * 0.62, 2, w * 0.85, h * 0.3, w - 2, h * 0.6, w - 1, h], base)
    poly(c, [w * 0.62, 2, w * 0.85, h * 0.3, w - 2, h * 0.6, w - 1, h, w * 0.6, h], dark)
    poly(c, [5, h * 0.45, w * 0.3, h * 0.15, w * 0.4, h * 0.4, w * 0.18, h * 0.6], light)
    if (snow) {
      poly(c, [w * 0.25, h * 0.2, w * 0.62, 1, w * 0.86, h * 0.3, w * 0.7, h * 0.36, w * 0.5, h * 0.25, w * 0.35, h * 0.34], '#f8fbff')
    }
  }
}

function pineArt(tall: boolean): ArtDef['paint'] {
  return (c, w, h) => {
    const cx = w / 2
    R(c, cx - 2, h - 9, 4, 9, '#5b3a22')
    const tiers = tall ? 5 : 4
    const th = (h - 8) / tiers
    for (let i = 0; i < tiers; i++) {
      const y0 = 2 + i * th * 0.85
      const half = 4 + (i + 1) * (w / 2 - 4) / tiers
      poly(c, [cx, y0, cx + half, y0 + th * 1.35, cx - half, y0 + th * 1.35], '#1d5a3a')
      poly(c, [cx, y0, cx + half * 0.15, y0 + th * 1.35, cx - half, y0 + th * 1.35], '#2a7550')
      // nieve
      poly(c, [cx, y0, cx + half * 0.55, y0 + th * 0.75, cx + half * 0.1, y0 + th * 0.6, cx - half * 0.3, y0 + th * 0.8, cx - half * 0.6, y0 + th * 0.7], '#f4f8ff')
    }
  }
}

function buildingArt(kind: 0 | 1 | 2): ArtDef {
  const dims = [
    { w: 48, h: 110, world: 3400, body: '#5b4b7a', edge: '#3f3358' },
    { w: 60, h: 78, world: 3900, body: '#7a4b5b', edge: '#563441' },
    { w: 42, h: 140, world: 3100, body: '#3e5a7a', edge: '#2b3f57' },
  ][kind]
  const win = (c: Ctx, w: number, h: number, lit: (i: number, j: number) => string | null) => {
    let j = 0
    for (let y = 10; y < h - 10; y += 7, j++) {
      let i = 0
      for (let x = 5; x < w - 6; x += 6, i++) {
        const col = lit(i, j)
        if (col) R(c, x, y, 4, 4, col)
      }
    }
  }
  const seed = (i: number, j: number) => {
    const s = Math.sin(i * 12.9898 + j * 78.233 + kind * 37.7) * 43758.5453
    return s - Math.floor(s)
  }
  return {
    w: dims.w,
    h: dims.h,
    world: dims.world,
    hit: 0.95,
    paint: (c, w, h) => {
      R(c, 0, 6, w, h - 6, dims.body)
      R(c, w - 6, 6, 6, h - 6, dims.edge)
      R(c, 0, 6, w, 2, '#2a2236')
      R(c, 3, 0, w - 6, 6, dims.edge)
      if (kind === 2) {
        R(c, w / 2 - 1, -1, 2, 6, '#9aa0b0')
      }
      win(c, w, h, () => '#1f2033')
      R(c, w / 2 - 6, h - 12, 12, 12, '#1a1a26')
    },
    glow: (c, w, h, night) => {
      win(c, w, h, (i, j) => {
        const r = seed(i, j)
        if (night) return r < 0.55 ? (r < 0.12 ? '#9fe7ff' : r < 0.3 ? '#ffd27a' : '#ffe9a8') : null
        return r < 0.25 ? '#ffd9a0' : r < 0.6 ? '#8fb2d8' : null
      })
      if (night) R(c, w / 2 - 6, h - 12, 12, 2, '#ff4fb4')
    },
  }
}

function billboardArt(text: string, sub: string, bg: string, fg: string): ArtDef {
  return {
    w: 64,
    h: 46,
    world: 2800,
    hit: 0.2,
    paint: (c, w, h) => {
      R(c, 10, 28, 3, h - 28, '#4a4a52')
      R(c, w - 13, 28, 3, h - 28, '#4a4a52')
      R(c, 0, 0, w, 30, '#2a2a32')
      R(c, 2, 2, w - 4, 26, bg)
      R(c, 2, 24, w - 4, 4, 'rgba(0,0,0,0.25)')
    },
    glow: (c, w) => {
      const s = text.length > 8 ? 1 : 2
      bitText(c, text, Math.round((w - bitWidth(text, s)) / 2), s === 2 ? 5 : 8, s, fg)
      bitText(c, sub, Math.round((w - bitWidth(sub, 1)) / 2), 19, 1, fg)
    },
  }
}

const ART: Record<SpriteKind, ArtDef> = {
  palm: { w: 48, h: 84, world: 1900, hit: 0.18, paint: palmArt(1, false) },
  palm2: { w: 48, h: 92, world: 1900, hit: 0.18, paint: palmArt(-1, true) },
  umbrella: {
    w: 34,
    h: 32,
    world: 1200,
    hit: 0.25,
    paint: (c, w, h) => {
      R(c, w / 2 - 1, 8, 2, h - 8, '#e8e2d0')
      for (let i = 0; i < 6; i++) {
        const x0 = 1 + i * ((w - 2) / 6)
        poly(c, [w / 2, 1, x0, 11, x0 + (w - 2) / 6, 11], i % 2 ? '#f7f3e8' : '#e8473c')
      }
      R(c, 1, 11, w - 2, 1, '#00000033')
      R(c, 4, h - 3, 12, 2, '#3fa7d6')
      R(c, 4, h - 4, 12, 1, '#7cc8ea')
    },
  },
  hut: {
    w: 60,
    h: 42,
    world: 2800,
    hit: 0.85,
    paint: (c, w, h) => {
      R(c, 6, 18, w - 12, h - 18, '#c98b52')
      for (let x = 8; x < w - 8; x += 4) R(c, x, 18, 1, h - 18, '#a8703f')
      poly(c, [0, 20, w / 2, 2, w, 20], '#d8b25c')
      poly(c, [0, 20, w / 2, 2, w / 2, 20], '#e8c870')
      R(c, w / 2 - 6, h - 14, 12, 14, '#5a3a22')
      R(c, 12, 24, 10, 7, '#3fa7d6')
      R(c, w - 22, 24, 10, 7, '#3fa7d6')
    },
  },
  lighthouse: {
    w: 30,
    h: 100,
    world: 1900,
    hit: 0.6,
    paint: (c, w, h) => {
      poly(c, [7, h, 10, 20, w - 10, 20, w - 7, h], '#f4f1ea')
      for (let i = 0; i < 4; i++) {
        const y = 28 + i * 18
        poly(c, [8 - i * 0.4, y + 9, 9 - i * 0.2, y, w - 9 + i * 0.2, y, w - 8 + i * 0.4, y + 9], '#d7352f')
      }
      R(c, 8, 16, w - 16, 4, '#2a2a32')
      R(c, 10, 8, w - 20, 8, '#3a3a44')
      poly(c, [9, 8, w / 2, 0, w - 9, 8], '#d7352f')
    },
    glow: (c, w) => {
      R(c, 11, 9, w - 22, 6, '#fff3b0')
    },
  },
  rock: { w: 38, h: 22, world: 1600, hit: 0.85, paint: rockArt('#8a7a6a', '#6a5a4c', '#a8988a', false) },
  cactus: { w: 26, h: 50, world: 950, hit: 0.45, paint: cactusArt(false) },
  cactus2: { w: 28, h: 42, world: 1000, hit: 0.45, paint: cactusArt(true) },
  boulder: { w: 42, h: 26, world: 1800, hit: 0.85, paint: rockArt('#b0643a', '#8a4a2a', '#d0844f', false) },
  mesa: {
    w: 100,
    h: 50,
    world: 11000,
    hit: 0,
    paint: (c, w, h) => {
      poly(c, [0, h, 12, 10, 22, 6, 70, 6, 80, 12, 92, 30, w, h], '#b4552e')
      poly(c, [70, 6, 80, 12, 92, 30, w, h, 60, h], '#8e3f22')
      for (let y = 14; y < h; y += 7) R(c, 10, y, 78, 1, '#9a4626')
      R(c, 22, 6, 48, 2, '#d47a48')
    },
  },
  deadtree: {
    w: 38,
    h: 46,
    world: 1600,
    hit: 0.2,
    paint: (c, w, h) => {
      const cx = w / 2
      line(c, [cx, h, cx, h * 0.45, cx - 9, h * 0.2, cx - 14, 6], '#5b4636', 3)
      line(c, [cx, h * 0.55, cx + 8, h * 0.3, cx + 15, h * 0.18], '#5b4636', 2)
      line(c, [cx - 5, h * 0.32, cx + 2, 6], '#5b4636', 2)
      line(c, [cx + 8, h * 0.3, cx + 6, 8], '#5b4636', 1)
    },
  },
  bldgA: buildingArt(0),
  bldgB: buildingArt(1),
  bldgC: buildingArt(2),
  lamp: {
    w: 26,
    h: 70,
    world: 1000,
    hit: 0.15,
    paint: (c, w, h) => {
      R(c, 3, 8, 3, h - 8, '#5a5e6a')
      R(c, 2, h - 4, 5, 4, '#3e414a')
      R(c, 3, 8, w - 5, 2, '#5a5e6a')
      R(c, w - 9, 10, 8, 3, '#3e414a')
    },
    glow: (c, w, _h, night) => {
      R(c, w - 8, 12, 6, 2, night ? '#fff1b8' : '#d8d8d8')
    },
  },
  neon: {
    w: 50,
    h: 60,
    world: 2000,
    hit: 0.12,
    paint: (c, w, h) => {
      R(c, w / 2 - 2, 26, 4, h - 26, '#4a4a56')
      R(c, 0, 0, w, 27, '#15121e')
    },
    glow: (c, w) => {
      R(c, 1, 1, w - 2, 1, '#ff4fd8')
      R(c, 1, 25, w - 2, 1, '#ff4fd8')
      R(c, 1, 1, 1, 25, '#ff4fd8')
      R(c, w - 2, 1, 1, 25, '#ff4fd8')
      bitText(c, 'MOTEL', 6, 5, 2, '#4ff0ff')
      bitText(c, 'SUNSET', 13, 18, 1, '#ffd166')
    },
  },
  pine: { w: 34, h: 66, world: 1400, hit: 0.25, paint: pineArt(false) },
  pine2: { w: 42, h: 84, world: 1800, hit: 0.25, paint: pineArt(true) },
  snowrock: { w: 38, h: 24, world: 1600, hit: 0.85, paint: rockArt('#7d8796', '#5f6878', '#a2acba', true) },
  cabin: {
    w: 58,
    h: 46,
    world: 2800,
    hit: 0.85,
    paint: (c, w, h) => {
      R(c, 6, 20, w - 12, h - 20, '#7a4a2a')
      for (let y = 22; y < h; y += 4) R(c, 6, y, w - 12, 1, '#5e3820')
      poly(c, [0, 22, w / 2, 4, w, 22], '#4a2c1a')
      poly(c, [2, 21, w / 2, 3, w - 2, 21, w / 2, 9], '#f4f8ff')
      R(c, w - 18, 4, 5, 10, '#5a5a62')
      R(c, w / 2 - 5, h - 13, 10, 13, '#3a2214')
    },
    glow: (c, w, _h, night) => {
      R(c, 11, 27, 9, 7, night ? '#ffd27a' : '#8fb2d8')
      R(c, w - 20, 27, 9, 7, night ? '#ffd27a' : '#8fb2d8')
    },
  },
  snowman: {
    w: 22,
    h: 34,
    world: 800,
    hit: 0.6,
    paint: (c, w, h) => {
      disc(c, w / 2, h - 8, 8, '#f4f8ff')
      disc(c, w / 2, h - 20, 6, '#ffffff')
      disc(c, w / 2, 8, 4, '#ffffff')
      R(c, w / 2 - 4, 1, 8, 3, '#1a1a22')
      R(c, w / 2 - 5, 4, 10, 1, '#1a1a22')
      R(c, w / 2 - 6, 12, 12, 2, '#e11d48')
      R(c, w / 2, 8, 3, 1, '#f97316')
      R(c, w / 2 - 2, 7, 1, 1, '#111')
      R(c, w / 2 + 1, 7, 1, 1, '#111')
    },
  },
  jtree: {
    w: 66,
    h: 88,
    world: 2800,
    hit: 0.15,
    paint: (c, w, h) => {
      const cx = w / 2
      R(c, cx - 3, 30, 6, h - 30, '#5b3e2a')
      R(c, cx - 3, 30, 2, h - 30, '#7a5638')
      line(c, [cx, 50, cx - 14, 34], '#5b3e2a', 3)
      line(c, [cx, 44, cx + 16, 30], '#5b3e2a', 3)
      const blobs = [
        [cx, 18, 18, 14], [cx - 18, 30, 14, 10], [cx + 18, 26, 15, 11], [cx - 6, 8, 12, 8], [cx + 10, 10, 12, 9],
      ]
      for (const [x, y, rx, ry] of blobs) ell(c, x, y + 2, rx, ry, '#145a2a')
      for (const [x, y, rx, ry] of blobs) ell(c, x - 2, y, rx - 3, ry - 3, '#1f7a38')
      for (const [x, y, rx, ry] of blobs) ell(c, x - 4, y - 3, rx * 0.45, ry * 0.4, '#3fa04f')
      // lianas
      for (const x of [cx - 20, cx + 6, cx + 22]) R(c, x, 34, 1, 18, '#2f7a3a')
    },
  },
  fern: {
    w: 38,
    h: 22,
    world: 1200,
    hit: 0,
    paint: (c, w, h) => {
      for (const [ex, ey] of [[2, 8], [8, 2], [19, 0], [30, 2], [36, 8], [12, 6], [26, 6]]) {
        line(c, [w / 2, h, (w / 2 + ex) / 2, ey + 4, ex, ey + 2], '#1f7a38', 4)
        line(c, [w / 2, h, (w / 2 + ex) / 2, ey + 3, ex, ey + 1], '#3fa04f', 2)
      }
    },
  },
  banana: {
    w: 44,
    h: 64,
    world: 1700,
    hit: 0.18,
    paint: (c, w, h) => {
      const cx = w / 2
      R(c, cx - 2, 22, 4, h - 22, '#6a8a3a')
      R(c, cx - 2, 22, 1, h - 22, '#8aaa4a')
      const L = [[-1, 0.5], [-0.7, -0.3], [0, -0.7], [0.7, -0.3], [1, 0.5]]
      for (const [dx, dy] of L) {
        poly(c, [cx, 22, cx + dx * 20, 22 + dy * 18 - 4, cx + dx * 22, 22 + dy * 18 + 4], '#1f7a38')
        poly(c, [cx, 22, cx + dx * 20, 22 + dy * 18 - 4, cx + dx * 12, 22 + dy * 10], '#3fa04f')
      }
      R(c, cx + 2, 26, 4, 6, '#f4d03f')
    },
  },
  ruin: {
    w: 42,
    h: 58,
    world: 1900,
    hit: 0.9,
    paint: (c, w, h) => {
      R(c, 4, 10, w - 8, h - 10, '#7d7a66')
      for (let y = 10; y < h; y += 8) {
        R(c, 4, y, w - 8, 1, '#5d5a4a')
        for (let x = 4 + ((y / 8) % 2) * 6; x < w - 4; x += 12) R(c, x, y, 1, 8, '#5d5a4a')
      }
      R(c, 0, 4, w, 7, '#8d8a76')
      R(c, 2, 0, w - 4, 4, '#6d6a58')
      R(c, w / 2 - 6, 24, 12, 10, '#3a3a2e')
      R(c, w / 2 - 4, 26, 3, 3, '#1f7a38')
      for (const x of [6, 30]) R(c, x, 10, 3, 20, '#2f8a3e')
    },
    glow: (c, w, _h, night) => {
      if (night) {
        R(c, w / 2 - 4, 27, 2, 2, '#4fffb0')
        R(c, w / 2 + 2, 27, 2, 2, '#4fffb0')
      }
    },
  },
  hoodoo: {
    w: 30,
    h: 76,
    world: 1700,
    hit: 0.55,
    paint: (c, w, h) => {
      poly(c, [6, h, 9, 40, 7, 26, 11, 14, 19, 14, 23, 28, 21, 44, 25, h], '#c0582f')
      poly(c, [19, 14, 23, 28, 21, 44, 25, h, 17, h, 17, 14], '#98421f')
      for (let y = 22; y < h; y += 9) R(c, 8, y, 16, 2, '#a84a26')
      ell(c, 15, 10, 11, 6, '#8a6a52')
      ell(c, 13, 8, 8, 3, '#a8886e')
    },
  },
  billboard: billboardArt('SUNSET', 'RADIO 101.5', '#ff7a2f', '#fff7e0'),
  billboard2: billboardArt('NITRO', 'TURBO OIL 86', '#1e40af', '#ffe14f'),
  billboard3: billboardArt('COPA', 'SUNSET RUN', '#be185d', '#ffffff'),
  chevL: {
    w: 34,
    h: 26,
    world: 1000,
    hit: 0.25,
    paint: (c, w, h) => {
      R(c, 8, 16, 2, h - 16, '#3a3a40')
      R(c, w - 10, 16, 2, h - 16, '#3a3a40')
      R(c, 0, 0, w, 17, '#111114')
      R(c, 1, 1, w - 2, 15, '#f2c200')
      for (let i = 0; i < 3; i++) {
        const x = 6 + i * 9
        poly(c, [x + 6, 3, x, 8.5, x + 6, 14, x + 9, 14, x + 3, 8.5, x + 9, 3], '#111114')
      }
    },
  },
  chevR: {
    w: 34,
    h: 26,
    world: 1000,
    hit: 0.25,
    paint: (c, w, h) => {
      R(c, 8, 16, 2, h - 16, '#3a3a40')
      R(c, w - 10, 16, 2, h - 16, '#3a3a40')
      R(c, 0, 0, w, 17, '#111114')
      R(c, 1, 1, w - 2, 15, '#f2c200')
      for (let i = 0; i < 3; i++) {
        const x = 4 + i * 9
        poly(c, [x + 3, 3, x + 9, 8.5, x + 3, 14, x, 14, x + 6, 8.5, x, 3], '#111114')
      }
    },
  },
  gantry: {
    w: 168,
    h: 86,
    world: 5600,
    hit: 0,
    paint: (c, w, h) => {
      R(c, 4, 10, 7, h - 10, '#3a3a44')
      R(c, w - 11, 10, 7, h - 10, '#3a3a44')
      R(c, 5, 10, 2, h - 10, '#5a5a66')
      R(c, w - 10, 10, 2, h - 10, '#5a5a66')
      R(c, 0, 4, w, 26, '#16161c')
      for (let x = 0; x < w; x += 6) for (let y = 0; y < 2; y++) R(c, x + (y % 2) * 3, 25 + y * 3, 3, 3, '#f4f4f4')
      R(c, 0, 4, w, 2, '#f97316')
    },
    glow: (c, w) => {
      const t = 'SUNSET RUN'
      bitText(c, t, Math.round((w - bitWidth(t, 3)) / 2), 8, 3, '#ffd166')
    },
  },
  tower: {
    w: 30,
    h: 124,
    world: 1800,
    hit: 0.6,
    paint: (c, w, h) => {
      R(c, 6, 0, 6, h, '#c2412d')
      R(c, w - 12, 0, 6, h, '#c2412d')
      R(c, 6, 0, 2, h, '#e26a4d')
      R(c, w - 12, 0, 2, h, '#e26a4d')
      for (const y of [6, 40, 80]) R(c, 6, y, w - 12, 6, '#a8341f')
      R(c, 4, h - 6, w - 8, 6, '#7a2a1a')
    },
    glow: (c, w, _h, night) => {
      if (night) {
        R(c, 8, 1, 2, 2, '#ff3b3b')
        R(c, w - 10, 1, 2, 2, '#ff3b3b')
      }
    },
  },
}

const baseCache = new Map<SpriteKind, HTMLCanvasElement>()
function baseArt(kind: SpriteKind): HTMLCanvasElement {
  const hit = baseCache.get(kind)
  if (hit) return hit
  const a = ART[kind]
  const [cv, c] = makeCanvas(a.w, a.h)
  a.paint(c, a.w, a.h)
  crisp(cv)
  baseCache.set(kind, cv)
  return cv
}

function flipped(src: HTMLCanvasElement): HTMLCanvasElement {
  const [cv, c] = makeCanvas(src.width, src.height)
  c.translate(src.width, 0)
  c.scale(-1, 1)
  c.drawImage(src, 0, 0)
  return cv
}

/** Crea el set de sprites teñido con la luz de la hora del día. */
export function buildSprites(light: RGB, night: boolean): Record<SpriteKind, SpriteDef> {
  const out = {} as Record<SpriteKind, SpriteDef>
  for (const kind of Object.keys(ART) as SpriteKind[]) {
    const a = ART[kind]
    const base = baseArt(kind)
    const [cv, c] = makeCanvas(a.w, a.h)
    c.drawImage(base, 0, 0)
    c.globalCompositeOperation = 'multiply'
    c.fillStyle = `rgb(${light[0]},${light[1]},${light[2]})`
    c.fillRect(0, 0, a.w, a.h)
    c.globalCompositeOperation = 'destination-in'
    c.drawImage(base, 0, 0)
    c.globalCompositeOperation = 'source-over'
    if (a.glow) {
      const [gv, g] = makeCanvas(a.w, a.h)
      a.glow(g, a.w, a.h, night)
      crisp(gv)
      c.drawImage(gv, 0, 0)
    }
    out[kind] = { img: cv, flip: flipped(cv), w: a.world, hit: a.hit }
  }
  return out
}

// ===================== Pickups =====================

export const PICK_SIZE = 20
export function paintPickup(kind: PickupKind): HTMLCanvasElement {
  const [cv, c] = makeCanvas(PICK_SIZE, PICK_SIZE)
  const S = PICK_SIZE
  if (kind === 'nitro') {
    R(c, 6, 4, 8, 14, '#1d4ed8')
    R(c, 6, 4, 2, 14, '#60a5fa')
    R(c, 12, 4, 2, 14, '#1e3a8a')
    R(c, 7, 1, 6, 3, '#cbd5e1')
    R(c, 8, 0, 4, 1, '#94a3b8')
    // N
    R(c, 8, 8, 1, 6, '#ffffff')
    R(c, 11, 8, 1, 6, '#ffffff')
    R(c, 9, 9, 1, 2, '#ffffff')
    R(c, 10, 11, 1, 2, '#ffffff')
  } else if (kind === 'shield') {
    poly(c, [S / 2, 1, S - 2, 5, S - 3, 12, S / 2, S - 1, 3, 12, 2, 5], '#0891b2')
    poly(c, [S / 2, 3, S - 4, 6, S - 5, 12, S / 2, S - 4, 5, 12, 4, 6], '#67e8f9')
    poly(c, [S / 2, 3, S / 2, S - 4, 5, 12, 4, 6], '#a5f3fc')
    R(c, S / 2 - 1, 6, 2, 7, '#ffffff')
    R(c, S / 2 - 3, 8, 6, 2, '#ffffff')
  } else if (kind === 'magnet') {
    R(c, 3, 3, 5, 11, '#dc2626')
    R(c, 12, 3, 5, 11, '#dc2626')
    R(c, 3, 12, 14, 5, '#dc2626')
    R(c, 7, 12, 6, 1, '#7f1d1d')
    R(c, 3, 3, 2, 14, '#f87171')
    R(c, 3, 1, 5, 3, '#e5e7eb')
    R(c, 12, 1, 5, 3, '#e5e7eb')
  } else {
    disc(c, S / 2, S / 2, 8, '#b45309')
    disc(c, S / 2, S / 2, 7, '#facc15')
    disc(c, S / 2, S / 2, 5, '#eab308')
    R(c, S / 2 - 1, 6, 2, 8, '#fef08a')
    R(c, 5, 6, 2, 3, '#fffbe6')
  }
  crisp(cv)
  return cv
}

/** Halo radial para luces (se dibuja con mezcla aditiva). */
export function glowSprite(color: string, size = 32): HTMLCanvasElement {
  const [cv, c] = makeCanvas(size, size)
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(0, 0, size, size)
  return cv
}
