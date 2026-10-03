/** Cielo, sol/luna y capas de fondo con parallax para cada tema y hora del día. */
import type { Theme, Tod } from './data'
import { hex, makeCanvas, mix, mixHex, rng, tintHex, type Rng } from './util'

export const LW = 960 // ancho de cada capa (se repite)

export interface Layer {
  img: HTMLCanvasElement
  /** Factor de parallax horizontal (por unidad de curva acumulada). */
  speed: number
  /** Cuánto se hunde/eleva con las colinas. */
  vy: number
}

export interface Scenery {
  sky: [string, string, string, string]
  fog: string
  sun: HTMLCanvasElement
  sunGlow: HTMLCanvasElement
  sunR: number
  sunY: number
  moon: boolean
  stars: HTMLCanvasElement | null
  clouds: HTMLCanvasElement | null
  layers: Layer[]
  below: HTMLCanvasElement
  sea: boolean
}

type Ctx = CanvasRenderingContext2D

/** Altura periódica (se repite cada LW px) como suma de senos. */
function ridge(r: Rng, octaves: [number, number][]): (x: number) => number {
  const ph = octaves.map(() => r() * Math.PI * 2)
  return (x: number) => {
    let v = 0
    octaves.forEach(([k, a], i) => {
      v += Math.sin((x / LW) * Math.PI * 2 * k + ph[i]) * a
    })
    return v
  }
}

function columns(c: Ctx, h: number, fn: (x: number) => number, col: string, step = 1) {
  c.fillStyle = col
  for (let x = 0; x < LW; x += step) {
    const y = Math.round(fn(x))
    if (y < h) c.fillRect(x, y, step, h - y)
  }
}

function makeSun(t: Tod): [HTMLCanvasElement, HTMLCanvasElement] {
  const r = t.sun.r
  const [cv, c] = makeCanvas(r * 2 + 2, r * 2 + 2)
  const g = c.createLinearGradient(0, 0, 0, r * 2)
  g.addColorStop(0, t.sun.c1)
  g.addColorStop(1, t.sun.c2)
  c.fillStyle = g
  for (let y = -r; y <= r; y++) {
    const hw = Math.round(Math.sqrt(r * r - y * y))
    const yy = y + r + 1
    if (t.sun.stripes && y > -r * 0.15) {
      // franjas retro: más gruesas hacia abajo
      const k = (y + r * 0.15) / (r * 1.15)
      const period = 9
      const gap = 1 + Math.floor(k * 5)
      if ((y + r) % period < gap) continue
    }
    c.fillRect(r + 1 - hw, yy, hw * 2, 1)
  }
  if (t.sun.kind === 'moon') {
    c.fillStyle = 'rgba(120,120,140,0.35)'
    c.beginPath()
    c.arc(r * 0.7, r * 0.8, r * 0.22, 0, Math.PI * 2)
    c.arc(r * 1.3, r * 1.25, r * 0.16, 0, Math.PI * 2)
    c.arc(r * 1.05, r * 0.55, r * 0.1, 0, Math.PI * 2)
    c.fill()
  }
  const gs = Math.round(r * 5)
  const [gv, gc] = makeCanvas(gs, gs)
  const gg = gc.createRadialGradient(gs / 2, gs / 2, r * 0.6, gs / 2, gs / 2, gs / 2)
  const [gr, ggn, gb] = hex(t.sun.glow)
  gg.addColorStop(0, `rgba(${gr},${ggn},${gb},0.55)`)
  gg.addColorStop(0.4, `rgba(${gr},${ggn},${gb},0.18)`)
  gg.addColorStop(1, `rgba(${gr},${ggn},${gb},0)`)
  gc.fillStyle = gg
  gc.fillRect(0, 0, gs, gs)
  return [cv, gv]
}

function makeStars(r: Rng): HTMLCanvasElement {
  const [cv, c] = makeCanvas(LW, 200)
  for (let i = 0; i < 170; i++) {
    const x = Math.floor(r() * LW)
    const y = Math.floor(r() * r() * 190)
    const b = r()
    c.fillStyle = b > 0.92 ? '#ffffff' : b > 0.6 ? '#c9cff7' : '#7d82b8'
    c.fillRect(x, y, b > 0.95 ? 2 : 1, b > 0.95 ? 2 : 1)
  }
  return cv
}

function makeClouds(r: Rng, t: Tod): HTMLCanvasElement {
  const [cv, c] = makeCanvas(LW, 150)
  const lit = t.id === 'tarde' ? '#ffffff' : t.id === 'noche' ? '#2d2a5e' : t.sun.glow
  const body = t.id === 'tarde' ? '#e7eef7' : t.id === 'noche' ? '#1d1b48' : mixHex(t.sky[1], t.sky[2], 0.5)
  const shade = mixHex(body, t.sky[0], 0.35)
  const n = t.id === 'tarde' ? 9 : 12
  for (let i = 0; i < n; i++) {
    const cx = r() * LW
    const cy = 20 + r() * 100
    const w = 60 + r() * 140
    const h = 3 + Math.floor(r() * 4)
    const draw = (x: number) => {
      c.fillStyle = shade
      c.fillRect(Math.round(x - w / 2), Math.round(cy + 2), Math.round(w), h)
      c.fillStyle = body
      c.fillRect(Math.round(x - w / 2 + 6), Math.round(cy), Math.round(w - 12), h)
      c.fillStyle = lit
      c.fillRect(Math.round(x - w / 2 + 14), Math.round(cy + h - 1), Math.round(w * 0.5), 1)
    }
    draw(cx)
    if (cx + w / 2 > LW) draw(cx - LW)
    if (cx - w / 2 < 0) draw(cx + LW)
  }
  return cv
}

function windows(c: Ctx, x: number, y: number, w: number, h: number, r: Rng, night: boolean, dim: boolean) {
  for (let yy = y + 3; yy < y + h - 2; yy += 4) {
    for (let xx = x + 2; xx < x + w - 2; xx += 3) {
      const v = r()
      if (night ? v < (dim ? 0.35 : 0.5) : v < 0.12) {
        c.fillStyle = night ? (v < 0.08 ? '#7fe7ff' : '#ffd88a') : '#ffe2b0'
        c.globalAlpha = dim ? 0.55 : 0.9
        c.fillRect(xx, yy, 1, 2)
      }
    }
  }
  c.globalAlpha = 1
}

export function buildScenery(theme: Theme, t: Tod, seed: number): Scenery {
  const r = rng(seed * 7 + 3)
  const [sun, sunGlow] = makeSun(t)
  const far = t.far
  const mid = t.mid
  const near = t.near
  const H = 170
  const layers: Layer[] = []
  const L = (draw: (c: Ctx) => void, speed: number, vy: number) => {
    const [cv, c] = makeCanvas(LW, H)
    draw(c)
    layers.push({ img: cv, speed, vy })
  }
  const groundFar = mixHex(tintHex(theme.ground[1], t.light), t.fog, 0.55)

  if (theme.id === 'costa') {
    L((c) => {
      const f = ridge(r, [[2, 10], [5, 6], [11, 3]])
      // islas lejanas: solo en parte del ancho
      c.fillStyle = far
      for (let x = 0; x < LW; x++) {
        const k = Math.sin((x / LW) * Math.PI * 4 + 1)
        if (k < 0.2) continue
        const y = H - 4 - (k - 0.2) * 26 - f(x) * 0.6
        c.fillRect(x, Math.round(y), 1, H - Math.round(y))
      }
    }, 0.002, 0.04)
    L((c) => {
      const f = ridge(r, [[1, 18], [3, 9], [9, 3]])
      c.fillStyle = mid
      for (let x = 0; x < LW; x++) {
        const k = Math.sin((x / LW) * Math.PI * 2 + 2.4)
        if (k < 0.1) continue
        const y = H - (k - 0.1) * 60 - f(x) * 0.5
        c.fillRect(x, Math.round(y), 1, H - Math.round(y))
      }
      // palmeras en silueta sobre la loma
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(r() * LW)
        const k = Math.sin((x / LW) * Math.PI * 2 + 2.4)
        if (k < 0.3) continue
        const base = H - (k - 0.1) * 60 - f(x) * 0.5
        const hh = 18 + r() * 14
        c.fillStyle = near
        c.fillRect(x, Math.round(base - hh), 2, Math.round(hh))
        for (const [dx, dy] of [[-7, 3], [7, 3], [-5, -2], [5, -2], [0, -3]]) {
          c.fillRect(Math.min(x, x + dx), Math.round(base - hh + dy / 2), Math.abs(dx) + 2, 2)
          c.fillRect(x + dx, Math.round(base - hh + dy), 2, 3)
        }
      }
    }, 0.004, 0.09)
  } else if (theme.id === 'desierto' || theme.id === 'canon') {
    const canyon = theme.id === 'canon'
    L((c) => {
      const tops = 7
      c.fillStyle = far
      for (let i = 0; i < tops; i++) {
        const cx = (i + r() * 0.6) * (LW / tops)
        const w = 50 + r() * 90
        const h = (canyon ? 60 : 30) + r() * (canyon ? 60 : 30)
        for (let x = Math.round(cx - w / 2 - 12); x < cx + w / 2 + 12; x++) {
          const d = Math.abs(x - cx) - w / 2
          const y = d < 0 ? H - h : H - h + d * 2.4
          const xx = ((x % LW) + LW) % LW
          if (y < H) c.fillRect(xx, Math.round(y), 1, H - Math.round(y))
        }
      }
    }, 0.002, 0.04)
    L((c) => {
      const f = ridge(r, [[2, 10], [5, 5], [13, 2]])
      columns(c, H, (x) => H - 26 - f(x), mid)
      // estratos
      c.fillStyle = mixHex(mid, far, 0.5)
      for (let x = 0; x < LW; x += 1) {
        const y = H - 26 - f(x)
        c.fillRect(x, Math.round(y + 8), 1, 1)
      }
    }, 0.004, 0.08)
    L((c) => {
      const f = ridge(r, [[3, 6], [7, 3]])
      const dune = mixHex(near, theme.ground[1], 0.35)
      columns(c, H, (x) => H - 10 - f(x), dune)
      if (canyon) {
        for (let i = 0; i < 10; i++) {
          const x = Math.floor(r() * LW)
          const h = 24 + r() * 30
          c.fillStyle = near
          c.fillRect(x, Math.round(H - 10 - h), 5, Math.round(h))
          c.fillRect(x - 2, Math.round(H - 12 - h), 9, 3)
        }
      } else {
        for (let i = 0; i < 12; i++) {
          const x = Math.floor(r() * LW)
          const h = 8 + r() * 10
          c.fillStyle = near
          c.fillRect(x, Math.round(H - 8 - f(x) - h), 2, Math.round(h))
          c.fillRect(x - 3, Math.round(H - 8 - f(x) - h * 0.7), 3, 2)
          c.fillRect(x - 3, Math.round(H - 8 - f(x) - h * 0.7 - 3), 1, 3)
        }
      }
    }, 0.007, 0.14)
  } else if (theme.id === 'ciudad') {
    L((c) => {
      for (let x = 0; x < LW; ) {
        const w = 12 + Math.floor(r() * 26)
        const h = 30 + Math.floor(r() * 60)
        c.fillStyle = far
        c.fillRect(x, H - h, w, h)
        windows(c, x, H - h, w, h, r, t.night, true)
        x += w + Math.floor(r() * 3)
      }
    }, 0.002, 0.04)
    L((c) => {
      for (let x = 0; x < LW; ) {
        const w = 18 + Math.floor(r() * 34)
        const h = 40 + Math.floor(r() * 90)
        c.fillStyle = mid
        c.fillRect(x, H - h, w, h)
        c.fillStyle = mixHex(mid, '#000000', 0.25)
        c.fillRect(x + w - 3, H - h, 3, h)
        windows(c, x, H - h, w - 3, h, r, t.night, false)
        if (r() < 0.35) {
          c.fillStyle = mid
          c.fillRect(x + Math.floor(w / 2), H - h - 10, 1, 10)
          c.fillStyle = '#ff3b3b'
          c.fillRect(x + Math.floor(w / 2), H - h - 11, 1, 1)
        }
        if (t.night && r() < 0.25) {
          c.fillStyle = r() < 0.5 ? '#ff4fd8' : '#4ff0ff'
          c.fillRect(x + 3, H - h + 6, w - 8, 2)
        }
        x += w + Math.floor(r() * 6)
      }
    }, 0.0045, 0.08)
  } else if (theme.id === 'nieve') {
    L((c) => {
      const f = ridge(r, [[3, 26], [7, 12], [17, 5]])
      const snow = tintHex('#f4f8ff', t.light)
      for (let x = 0; x < LW; x++) {
        const y = Math.round(H - 70 - f(x))
        c.fillStyle = far
        c.fillRect(x, y, 1, H - y)
        const cap = Math.max(0, 22 - (H - 70 - f(x) - (H - 120)) * 0.4)
        c.fillStyle = mixHex(snow, far, 0.3)
        c.fillRect(x, y, 1, Math.round(Math.min(cap, 20)))
      }
    }, 0.002, 0.05)
    L((c) => {
      const f = ridge(r, [[2, 18], [6, 8], [14, 3]])
      const snow = tintHex('#e8eef8', t.light)
      for (let x = 0; x < LW; x++) {
        const y = Math.round(H - 40 - f(x))
        c.fillStyle = mid
        c.fillRect(x, y, 1, H - y)
        c.fillStyle = mixHex(snow, mid, 0.25)
        c.fillRect(x, y, 1, 4 + Math.round(Math.max(0, f(x)) * 0.4))
      }
    }, 0.004, 0.09)
    L((c) => {
      c.fillStyle = near
      c.fillRect(0, H - 8, LW, 8)
      for (let x = 0; x < LW; x += 5 + Math.floor(r() * 5)) {
        const h = 12 + r() * 22
        for (let y = 0; y < h; y++) {
          const hw = Math.round((y / h) * 4)
          c.fillRect(x - hw, Math.round(H - 8 - h + y), hw * 2 + 1, 1)
        }
      }
    }, 0.007, 0.14)
  } else {
    // selva
    L((c) => {
      const f = ridge(r, [[2, 22], [4, 10], [9, 4]])
      columns(c, H, (x) => H - 55 - f(x), far)
      // volcán
      const vx = Math.floor(r() * LW)
      for (let x = -90; x <= 90; x++) {
        const y = Math.max(H - 120 + Math.abs(x) * 0.9, H - 115)
        c.fillStyle = far
        c.fillRect((((vx + x) % LW) + LW) % LW, Math.round(y), 1, H)
      }
    }, 0.002, 0.05)
    L((c) => {
      const f = ridge(r, [[3, 12], [8, 5]])
      columns(c, H, (x) => H - 30 - f(x), mid)
    }, 0.004, 0.09)
    L((c) => {
      c.fillStyle = near
      c.fillRect(0, H - 10, LW, 10)
      for (let x = 0; x < LW; x += 10 + Math.floor(r() * 14)) {
        const rr = 6 + r() * 12
        const cy = H - 10 - rr * 0.6 - r() * 10
        for (let y = -rr; y <= rr; y++) {
          const hw = Math.round(Math.sqrt(rr * rr - y * y) * 1.3)
          c.fillRect(x - hw, Math.round(cy + y), hw * 2, 1)
        }
        c.fillRect(x - 1, Math.round(cy), 2, Math.round(H - cy))
      }
    }, 0.007, 0.14)
  }

  // franja bajo el horizonte (mar en la costa, terreno lejano en el resto)
  const [bv, bc] = makeCanvas(LW, 90)
  const sea = theme.id === 'costa'
  if (sea) {
    const deep = tintHex('#1d5f9e', t.light)
    const g = bc.createLinearGradient(0, 0, 0, 90)
    g.addColorStop(0, mix(deep, t.fog, 0.45))
    g.addColorStop(1, deep)
    bc.fillStyle = g
    bc.fillRect(0, 0, LW, 90)
    const rr = rng(seed + 99)
    for (let i = 0; i < 260; i++) {
      const y = Math.floor(rr() * rr() * 88)
      const x = Math.floor(rr() * LW)
      bc.fillStyle = rr() < 0.5 ? mix(t.sun.glow, '#ffffff', 0.3) : mix(deep, '#ffffff', 0.25)
      bc.globalAlpha = 0.35 + rr() * 0.4
      bc.fillRect(x, y, 2 + Math.floor(rr() * 10), 1)
    }
    bc.globalAlpha = 1
  } else {
    bc.fillStyle = groundFar
    bc.fillRect(0, 0, LW, 90)
  }

  return {
    sky: t.sky,
    fog: t.fog,
    sun,
    sunGlow,
    sunR: t.sun.r,
    sunY: t.sun.y,
    moon: t.sun.kind === 'moon',
    stars: t.night || t.id === 'crepusculo' ? makeStars(r) : null,
    clouds: t.night && theme.id === 'ciudad' ? null : makeClouds(r, t),
    layers,
    below: bv,
    sea,
  }
}
