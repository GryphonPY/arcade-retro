/**
 * Atlas de texturas del mundo (muros, suelos, techos) pintado por código.
 * Cada baldosa mide 32x32 px; el atlas tiene 8 columnas x 4 filas.
 */
import { Img } from './paint'
import { rng, shade, mixColor } from './util'

export const TILE = 32
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 4

export const T = {
  METAL: 0,
  METAL_STRIPE: 1,
  CONCRETE: 2,
  HANGAR_FLOOR: 3,
  FLOOR_LINE: 4,
  CEIL_PANEL: 5,
  CEIL_LAMP: 6,
  DOOR: 7,
  PILLAR: 8,
  CRATE: 9,
  CRATE_TOP: 10,
  LAB_WALL: 11,
  LAB_WALL2: 12,
  LAB_FLOOR: 13,
  VAT: 14,
  SLIME: 15,
  REACTOR_WALL: 16,
  REACTOR_FLOOR: 17,
  RIM_TOP: 18,
  RIM_SIDE: 19,
  GRATE: 20,
  CEIL_ALARM: 21,
  REACTOR_WALL2: 22,
  LAB_CEIL: 23,
} as const

type Painter = (g: Img, ox: number, oy: number, r: () => number) => void

function noiseFill(g: Img, ox: number, oy: number, base: number, amt: number, r: () => number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) g.px(ox + x, oy + y, shade(base, 1 + (r() - 0.5) * amt))
}

function rivet(g: Img, x: number, y: number, c: number) {
  g.px(x, y, shade(c, 1.5))
  g.px(x + 1, y + 1, shade(c, 0.5))
  g.px(x + 1, y, shade(c, 1.1))
  g.px(x, y + 1, shade(c, 0.8))
}

function plate(g: Img, x: number, y: number, w: number, h: number, c: number, r: () => number) {
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) g.px(x + xx, y + yy, shade(c, 1 + (r() - 0.5) * 0.12))
  g.rect(x, y, w, 1, shade(c, 1.35))
  g.rect(x, y, 1, h, shade(c, 1.2))
  g.rect(x, y + h - 1, w, 1, shade(c, 0.55))
  g.rect(x + w - 1, y, 1, h, shade(c, 0.65))
  rivet(g, x + 2, y + 2, c)
  rivet(g, x + w - 4, y + 2, c)
  rivet(g, x + 2, y + h - 4, c)
  rivet(g, x + w - 4, y + h - 4, c)
}

function grime(g: Img, ox: number, oy: number, r: () => number, n: number, c = 0x000000, k = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * TILE)
    let y = Math.floor(r() * TILE)
    const len = 2 + Math.floor(r() * 8)
    for (let j = 0; j < len && y < TILE; j++, y++) {
      const old = g.get(ox + x, oy + y)
      if (old >= 0) g.px(ox + x, oy + y, mixColor(old, c, k))
    }
  }
}

const painters: Record<number, Painter> = {
  [T.METAL]: (g, ox, oy, r) => {
    const c = 0x4a5160
    plate(g, ox, oy, 16, 16, c, r)
    plate(g, ox + 16, oy, 16, 16, shade(c, 0.92), r)
    plate(g, ox, oy + 16, 32, 16, shade(c, 0.96), r)
    // panel de ventilación
    for (let i = 0; i < 4; i++) g.rect(ox + 6, oy + 20 + i * 2, 20, 1, 0x1c2028)
    grime(g, ox, oy, r, 10)
  },
  [T.METAL_STRIPE]: (g, ox, oy, r) => {
    painters[T.METAL](g, ox, oy, r)
    for (let y = 22; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const s = ((x + y) >> 2) & 1
        g.px(ox + x, oy + y, shade(s ? 0xd4a017 : 0x1a1a1a, 1 + (r() - 0.5) * 0.15))
      }
    g.rect(ox, oy + 21, 32, 1, 0x101010)
    grime(g, ox, oy + 16, r, 8)
  },
  [T.CONCRETE]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x5b5852, 0.18, r)
    g.rect(ox, oy + 15, 32, 1, 0x3a3834)
    g.rect(ox + 15, oy, 1, 15, 0x3a3834)
    g.rect(ox + 7, oy + 16, 1, 16, 0x3a3834)
    grime(g, ox, oy, r, 14)
  },
  [T.HANGAR_FLOOR]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x3d3f42, 0.22, r)
    g.rect(ox, oy, 32, 1, 0x26282a)
    g.rect(ox, oy, 1, 32, 0x26282a)
    // grietas
    let x = 4 + Math.floor(r() * 20)
    for (let y = 3; y < 28; y++) {
      x += Math.floor(r() * 3) - 1
      g.px(ox + x, oy + y, 0x202224)
    }
    // mancha de aceite
    for (let i = 0; i < 18; i++) g.px(ox + 20 + Math.floor(r() * 7), oy + 20 + Math.floor(r() * 5), 0x2c2a26)
  },
  [T.FLOOR_LINE]: (g, ox, oy, r) => {
    painters[T.HANGAR_FLOOR](g, ox, oy, r)
    for (let y = 0; y < 32; y++)
      for (let x = 12; x < 20; x++) if (r() > 0.12) g.px(ox + x, oy + y, shade(0xc8a020, 0.8 + r() * 0.3))
  },
  [T.CEIL_PANEL]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x25272c, 0.2, r)
    g.rect(ox, oy, 32, 2, 0x15161a)
    g.rect(ox, oy, 2, 32, 0x15161a)
    g.rect(ox + 15, oy, 2, 32, 0x2f3238)
    rivet(g, ox + 5, oy + 5, 0x3a3d44)
    rivet(g, ox + 26, oy + 26, 0x3a3d44)
  },
  [T.CEIL_LAMP]: (g, ox, oy, r) => {
    painters[T.CEIL_PANEL](g, ox, oy, r)
    g.rect(ox + 6, oy + 6, 20, 20, 0x22252a)
    g.em = true
    g.rect(ox + 8, oy + 8, 16, 16, 0xfff1c8)
    g.rect(ox + 8, oy + 15, 16, 2, 0xd9c69a)
    g.rect(ox + 15, oy + 8, 2, 16, 0xd9c69a)
    g.em = false
  },
  [T.CEIL_ALARM]: (g, ox, oy, r) => {
    painters[T.CEIL_PANEL](g, ox, oy, r)
    g.disc(ox + 16, oy + 16, 9, 0x2a1010)
    g.em = true
    g.disc(ox + 16, oy + 16, 7, 0xff2a1a)
    g.disc(ox + 14, oy + 14, 3, 0xff9a80)
    g.em = false
  },
  [T.DOOR]: (g, ox, oy, r) => {
    const c = 0x5a4a3c
    noiseFill(g, ox, oy, c, 0.12, r)
    // marco
    g.rect(ox, oy, 32, 3, 0x2a2420)
    g.rect(ox, oy, 3, 32, 0x2a2420)
    g.rect(ox + 29, oy, 3, 32, 0x2a2420)
    // chevrons de peligro
    for (let y = 8; y < 30; y++)
      for (let x = 3; x < 29; x++) {
        const s = ((x - (y >> 0) * 1 + 64) >> 2) & 1
        if (y > 18) g.px(ox + x, oy + y, s ? 0xb08a18 : 0x262018)
      }
    g.rect(ox + 15, oy + 3, 2, 29, 0x1a1512)
    g.em = true
    g.rect(ox + 12, oy + 4, 8, 3, 0xff3020)
    g.em = false
    grime(g, ox, oy, r, 12)
  },
  [T.PILLAR]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x3a3f46, 0.15, r)
    // tuberías verticales
    for (const px of [4, 13, 22]) {
      for (let y = 0; y < 32; y++) {
        g.px(ox + px, oy + y, 0x6a7280)
        g.px(ox + px + 1, oy + y, 0x8a94a4)
        g.px(ox + px + 2, oy + y, 0x5a616c)
        g.px(ox + px + 3, oy + y, 0x2c3036)
        g.px(ox + px + 4, oy + y, 0x22252a)
      }
      g.rect(ox + px - 1, oy + 10, 7, 2, 0x7a6a40)
      g.rect(ox + px - 1, oy + 24, 7, 2, 0x7a6a40)
    }
    g.em = true
    g.px(ox + 10, oy + 6, 0x40ff60)
    g.px(ox + 19, oy + 18, 0xff4030)
    g.em = false
  },
  [T.CRATE]: (g, ox, oy, r) => {
    const c = 0x5e5134
    noiseFill(g, ox, oy, c, 0.1, r)
    g.rect(ox, oy, 32, 3, shade(c, 0.6))
    g.rect(ox, oy + 29, 32, 3, shade(c, 0.6))
    g.rect(ox, oy, 3, 32, shade(c, 0.6))
    g.rect(ox + 29, oy, 3, 32, shade(c, 0.6))
    for (let i = 3; i < 29; i++) {
      g.px(ox + i, oy + i, shade(c, 0.6))
      g.px(ox + i + 1, oy + i, shade(c, 0.7))
    }
    g.rect(ox + 6, oy + 6, 6, 4, 0xc8b070)
    g.px(ox + 7, oy + 7, 0x302818)
    g.px(ox + 9, oy + 7, 0x302818)
  },
  [T.CRATE_TOP]: (g, ox, oy, r) => {
    const c = 0x6a5c3c
    noiseFill(g, ox, oy, c, 0.1, r)
    for (let x = 0; x < 32; x += 8) g.rect(ox + x, oy, 1, 32, shade(c, 0.6))
    g.rect(ox, oy, 32, 2, shade(c, 0.5))
    g.rect(ox, oy + 30, 32, 2, shade(c, 0.5))
  },
  [T.LAB_WALL]: (g, ox, oy, r) => {
    for (let ty = 0; ty < 4; ty++)
      for (let tx = 0; tx < 4; tx++) {
        const c = shade(0xa8b4ae, 0.92 + r() * 0.12)
        g.rect(ox + tx * 8, oy + ty * 8, 8, 8, c)
        g.rect(ox + tx * 8, oy + ty * 8, 8, 1, 0x6a7470)
        g.rect(ox + tx * 8, oy + ty * 8, 1, 8, 0x6a7470)
      }
    g.rect(ox, oy + 24, 32, 8, 0x3a6a5c)
    g.rect(ox, oy + 24, 32, 1, 0x5a8a7c)
    grime(g, ox, oy, r, 22, 0x203020, 0.4)
    // salpicadura de sangre
    if (r() > 0.3) {
      const bx = 6 + Math.floor(r() * 18)
      for (let i = 0; i < 26; i++) g.px(ox + bx + Math.floor(r() * 9), oy + 6 + Math.floor(r() * 10), 0x6a0e0a)
      for (let i = 0; i < 4; i++) g.rect(ox + bx + 1 + i * 2, oy + 12, 1, 4 + Math.floor(r() * 8), 0x58100c)
    }
  },
  [T.LAB_WALL2]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x3c4644, 0.1, r)
    g.bevel(ox + 2, oy + 3, 28, 16, 0x1c2222)
    g.em = true
    g.rect(ox + 4, oy + 5, 24, 12, 0x0a3020)
    for (let i = 0; i < 5; i++) g.rect(ox + 5, oy + 6 + i * 2, 4 + Math.floor(r() * 16), 1, 0x40ff90)
    g.rect(ox + 22, oy + 14, 4, 2, 0xff5040)
    g.px(ox + 5, oy + 24, 0x40ff60)
    g.px(ox + 8, oy + 24, 0xffd040)
    g.px(ox + 11, oy + 24, 0xff4030)
    g.em = false
    for (let i = 0; i < 6; i++) g.rect(ox + 16 + i * 2, oy + 22, 1, 6, 0x22282a)
  },
  [T.LAB_FLOOR]: (g, ox, oy, r) => {
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const c = (tx + ty) & 1 ? 0x8c9692 : 0x4a5250
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) g.px(ox + tx * 16 + x, oy + ty * 16 + y, shade(c, 0.9 + r() * 0.15))
      }
    grime(g, ox, oy, r, 10, 0x102018, 0.3)
  },
  [T.VAT]: (g, ox, oy, r) => {
    g.rect(ox, oy, 32, 32, 0x2a3434)
    g.em = true
    for (let y = 3; y < 29; y++)
      for (let x = 3; x < 29; x++) g.px(ox + x, oy + y, shade(0x2ad070, 0.55 + (y / 32) * 0.5 + (r() - 0.5) * 0.1))
    // espécimen
    g.blob(ox + 16, oy + 13, 5, 6, 0x0e4a24, 0)
    g.limb(ox + 16, oy + 18, ox + 16, oy + 27, 3, 0x0e4a24, 0)
    g.limb(ox + 13, oy + 19, ox + 9, oy + 25, 1.5, 0x0e4a24, 0)
    g.limb(ox + 19, oy + 19, ox + 23, oy + 24, 1.5, 0x0e4a24, 0)
    for (let i = 0; i < 8; i++) g.px(ox + 5 + Math.floor(r() * 22), oy + 4 + Math.floor(r() * 24), 0xb0ffd0)
    g.rect(ox + 6, oy + 4, 1, 22, 0x9affc8)
    g.em = false
    g.rect(ox, oy, 32, 3, 0x505a5a)
    g.rect(ox, oy + 29, 32, 3, 0x505a5a)
  },
  [T.SLIME]: (g, ox, oy, r) => {
    g.em = true
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const w = Math.sin((x + y * 0.5) * 0.45) + Math.sin((y - x * 0.3) * 0.6)
        g.px(ox + x, oy + y, shade(0x34c040, 0.65 + w * 0.12 + r() * 0.08))
      }
    for (let i = 0; i < 10; i++) g.px(ox + Math.floor(r() * 32), oy + Math.floor(r() * 32), 0xc8ffb0)
    g.em = false
  },
  [T.REACTOR_WALL]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x2c2828, 0.18, r)
    plate(g, ox, oy, 32, 12, 0x3a3434, r)
    g.rect(ox, oy + 18, 32, 6, 0x1a1616)
    g.em = true
    for (let x = 0; x < 32; x++) g.px(ox + x, oy + 20, x % 6 < 4 ? 0xff7a20 : 0xc04010)
    g.rect(ox, oy + 21, 32, 1, 0xa03808)
    g.em = false
    for (let x = 4; x < 32; x += 9) g.rect(ox + x, oy + 17, 3, 8, 0x4a4040)
    grime(g, ox, oy, r, 12)
  },
  [T.REACTOR_WALL2]: (g, ox, oy, r) => {
    painters[T.REACTOR_WALL](g, ox, oy, r)
    g.rect(ox + 6, oy + 2, 20, 8, 0xc89a18)
    g.rect(ox + 7, oy + 3, 18, 6, 0x1a1408)
    // "93"
    const digits = ['111', '101', '111', '001', '111']
    const digits3 = ['111', '001', '111', '001', '111']
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 3; x++) {
        if (digits[y][x] === '1') g.px(ox + 11 + x, oy + 4 + y, 0xffc030)
        if (digits3[y][x] === '1') g.px(ox + 17 + x, oy + 4 + y, 0xffc030)
      }
  },
  [T.REACTOR_FLOOR]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x343030, 0.15, r)
    for (let y = 0; y < 32; y += 8)
      for (let x = 0; x < 32; x += 8) {
        const off = (y >> 3) & 1 ? 4 : 0
        g.bevel(ox + ((x + off) % 32), oy + y, 7, 7, 0x3e3836, 0.3)
      }
  },
  [T.RIM_TOP]: (g, ox, oy, r) => {
    g.rect(ox, oy, 32, 32, 0x201410)
    g.em = true
    for (let y = 2; y < 30; y += 4)
      for (let x = 2; x < 30; x++) g.px(ox + x, oy + y, shade(0xff8a2a, 0.7 + r() * 0.5))
    for (let y = 3; y < 30; y += 4)
      for (let x = 2; x < 30; x++) g.px(ox + x, oy + y, shade(0xffd060, 0.6 + r() * 0.5))
    g.em = false
  },
  [T.RIM_SIDE]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x3a3436, 0.15, r)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) if (y > 20 && ((x + y) >> 2) & 1) g.px(ox + x, oy + y, 0xc09018)
    g.em = true
    g.rect(ox, oy + 2, 32, 2, 0xff6a20)
    g.em = false
  },
  [T.GRATE]: (g, ox, oy, r) => {
    g.rect(ox, oy, 32, 32, 0x121414)
    for (let y = 0; y < 32; y += 4) g.rect(ox, oy + y, 32, 2, shade(0x4a5052, 0.9 + r() * 0.2))
    for (let x = 0; x < 32; x += 8) g.rect(ox + x, oy, 2, 32, 0x5a6062)
  },
  [T.LAB_CEIL]: (g, ox, oy, r) => {
    noiseFill(g, ox, oy, 0x6a706e, 0.1, r)
    for (let i = 0; i < 40; i++) g.px(ox + Math.floor(r() * 32), oy + Math.floor(r() * 32), 0x4a504e)
    g.rect(ox, oy, 32, 1, 0x3a403e)
    g.rect(ox, oy, 1, 32, 0x3a403e)
    g.rect(ox, oy + 16, 32, 1, 0x3a403e)
    g.rect(ox + 16, oy, 1, 32, 0x3a403e)
  },
}

/** Genera el atlas como buffer RGBA (alfa 200 = emisivo). */
export function buildWorldAtlas(): Img {
  const g = new Img(TILE * ATLAS_COLS, TILE * ATLAS_ROWS)
  for (const key of Object.keys(painters)) {
    const id = Number(key)
    const ox = (id % ATLAS_COLS) * TILE
    const oy = Math.floor(id / ATLAS_COLS) * TILE
    painters[id](g, ox, oy, rng(1000 + id * 77))
    g.em = false
  }
  return g
}
