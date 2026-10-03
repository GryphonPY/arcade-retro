/**
 * HUD clásico dibujado en un canvas 2D a la misma resolución interna que el
 * 3D: fuente bitmap 5x7 propia, números grandes rojos, barra inferior con la
 * cara del soldado que reacciona.
 */
import { Img } from './paint'
import { rng, shade } from './util'

// ---------------------------------------------------------------------------
// Fuente bitmap 5x7
// ---------------------------------------------------------------------------

const G: Record<string, string> = {
  A: '.###.#...##...#######...##...##...#',
  B: '####.#...##...#####.#...##...#####.',
  C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####',
  F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####',
  H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#....#.#..#..##..',
  K: '#...##..#.#.#..##...#.#..#..#.#...#',
  L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#',
  N: '#...##...###..##.#.##..###...##...#',
  O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#',
  R: '####.#...##...#####.#.#..#..#.#...#',
  S: '.#####....#.....###.....#....#####.',
  T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..',
  W: '#...##...##...##.#.##.#.##.#.#.#.#.',
  X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..',
  Z: '#####....#...#...#...#...#....#####',
  '0': '.###.#...##..###.#.###..##...#.###.',
  '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####',
  '3': '####.....#....#.###.....#....#####.',
  '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.',
  '6': '.###.#....#....####.#...##...#.###.',
  '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#....#.###.',
  '.': '..........................##...##..',
  ',': '.....................##....#...#...',
  ':': '......##...##..........##...##.....',
  '!': '..#....#....#....#....#.........#..',
  '?': '.###.#...#....#...#...#.........#..',
  '+': '.......#....#..#####..#....#.......',
  '-': '...............#####...............',
  '/': '....#....#...#...#...#...#....#....',
  '%': '##..###..#...#...#...#...#..###..##',
  "'": '..#....#...#.......................',
  '(': '...#...#...#....#....#.....#.....#.',
  ')': '.#.....#.....#....#....#...#...#...',
  '>': '.#.....#.....#.....#...#...#...#...',
  '<': '...#...#...#...#.....#.....#.....#.',
  '=': '..........#####.....#####..........',
  '*': '.....#.#.#.###.#####.###.#.#.#.....',
  x: '..........#...#.#.#...#...#.#.#...#',
  _: '..............................#####',
  ' ': '...................................',
}

export const FONT_W = 6
export const FONT_H = 8

type Align = 'left' | 'center' | 'right'

export interface HudState {
  hp: number
  maxHp: number
  armor: number
  ammo: number
  ammoInfinite: boolean
  ammoTable: [string, number, number][]
  owned: boolean[]
  current: number
  faceTier: number
  faceLook: number
  faceMode: 'normal' | 'pain' | 'grin' | 'dead' | 'angry'
  skin: number
  hair: number
}

export class Hud93 {
  readonly ctx: CanvasRenderingContext2D
  W = 320
  H = 200
  readonly barH = 38
  private cache = new Map<string, HTMLCanvasElement>()
  private faces = new Map<string, HTMLCanvasElement>()
  private bar: HTMLCanvasElement | null = null

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D no disponible')
    this.ctx = ctx
  }

  resize(W: number, H: number) {
    this.W = W
    this.H = H
    this.canvas.width = W
    this.canvas.height = H
    this.ctx.imageSmoothingEnabled = false
    this.bar = null
  }

  /** Ancho en píxeles de un texto con la fuente bitmap. */
  measure(s: string, scale = 1) {
    return s.length * FONT_W * scale - scale
  }

  private glyphs(s: string, color: string, scale: number, shadow: boolean, grad: boolean): HTMLCanvasElement {
    const key = `${s}|${color}|${scale}|${shadow ? 1 : 0}|${grad ? 1 : 0}`
    const hit = this.cache.get(key)
    if (hit) return hit
    if (this.cache.size > 400) this.cache.clear()
    const cv = document.createElement('canvas')
    const w = Math.max(1, s.length * FONT_W * scale + scale)
    const h = 7 * scale + scale
    cv.width = w
    cv.height = h
    const c = cv.getContext('2d')
    if (!c) return cv
    const base = parseInt(color.slice(1), 16)
    const drawPass = (ox: number, oy: number, col: number | null) => {
      for (let i = 0; i < s.length; i++) {
        const gl = G[s[i]] ?? G[s[i].toUpperCase()] ?? G['?']
        for (let y = 0; y < 7; y++) {
          if (col === null) {
            const k = grad ? 1.25 - (y / 6) * 0.6 : 1
            c.fillStyle = '#' + shade(base, k).toString(16).padStart(6, '0')
          }
          for (let x = 0; x < 5; x++) {
            if (gl[y * 5 + x] !== '#') continue
            c.fillRect(ox + (i * FONT_W + x) * scale, oy + y * scale, scale, scale)
          }
        }
      }
    }
    if (shadow) {
      c.fillStyle = '#000000'
      drawPass(scale, scale, 0)
    }
    drawPass(0, 0, null)
    this.cache.set(key, cv)
    return cv
  }

  text(s: string, x: number, y: number, color = '#ffffff', scale = 1, align: Align = 'left', shadow = true, grad = false) {
    const cv = this.glyphs(s.toUpperCase(), color, scale, shadow, grad)
    let dx = x
    if (align === 'center') dx = x - Math.floor((cv.width - scale) / 2)
    else if (align === 'right') dx = x - (cv.width - scale)
    this.ctx.drawImage(cv, Math.round(dx), Math.round(y))
  }

  // ---------------------------------------------------------------------
  // Cara del soldado
  // ---------------------------------------------------------------------
  face(skin: number, hair: number, tier: number, look: number, mode: string): HTMLCanvasElement {
    const key = `${skin}|${tier}|${look}|${mode}`
    const hit = this.faces.get(key)
    if (hit) return hit
    const g = new Img(24, 29)
    const dead = mode === 'dead'
    const sk = dead ? shade(skin, 0.7) : skin
    const lx = look
    // cuello y hombros
    g.rect(4, 25, 16, 4, 0x4a5634)
    g.rect(9, 22, 6, 4, shade(sk, 0.8))
    // cabeza
    g.blob(12 + lx * 0.5, 13, 9, 11, sk, 0.25)
    // pelo rapado
    for (let y = 2; y < 8; y++)
      for (let x = 3; x < 22; x++) if (g.get(x, y) >= 0 && (y < 6 || x < 5 || x > 19)) g.px(x, y, (x + y) % 3 ? hair : shade(hair, 1.3))
    // orejas
    g.rect(2 + lx, 11, 2, 5, shade(sk, 0.85))
    g.rect(20 + lx, 11, 2, 5, shade(sk, 0.85))
    // cejas y ojos
    const ex = 12 + lx
    const angry = mode === 'angry' || mode === 'pain'
    g.rect(ex - 7, angry ? 9 : 8, 5, 1, shade(hair, 0.8))
    g.rect(ex + 2, angry ? 9 : 8, 5, 1, shade(hair, 0.8))
    if (angry) {
      g.px(ex - 2, 8, shade(hair, 0.8))
      g.px(ex + 2, 8, shade(hair, 0.8))
    }
    if (dead) {
      g.rect(ex - 6, 11, 4, 1, 0x3a1010)
      g.rect(ex + 2, 11, 4, 1, 0x3a1010)
    } else if (mode === 'pain') {
      g.rect(ex - 6, 11, 4, 1, 0x2a1a10)
      g.rect(ex + 2, 11, 4, 1, 0x2a1a10)
      g.px(ex - 5, 10, 0x2a1a10)
      g.px(ex + 4, 10, 0x2a1a10)
    } else {
      g.rect(ex - 6, 10, 4, 3, 0xf0f0e8)
      g.rect(ex + 2, 10, 4, 3, 0xf0f0e8)
      const p = look < 0 ? 0 : look > 0 ? 2 : 1
      g.rect(ex - 6 + p, 10, 2, 3, 0x3a5a8a)
      g.rect(ex + 2 + p, 10, 2, 3, 0x3a5a8a)
    }
    // nariz
    g.rect(ex - 1, 13, 2, 4, shade(sk, 0.82))
    g.px(ex - 1, 16, shade(sk, 0.6))
    // boca
    if (mode === 'grin') {
      g.rect(ex - 4, 19, 8, 3, 0x2a0a0a)
      g.rect(ex - 3, 19, 6, 1, 0xf8f8f0)
      g.px(ex - 5, 18, shade(sk, 0.6))
      g.px(ex + 4, 18, shade(sk, 0.6))
    } else if (mode === 'pain' || dead) {
      g.rect(ex - 3, 19, 6, 3, 0x2a0606)
      g.rect(ex - 2, 19, 4, 1, 0xd8d0c0)
    } else {
      g.rect(ex - 3, 20, 6, 1, shade(sk, 0.55))
    }
    // daño acumulado
    const r = rng(tier * 7 + 3)
    const blood = 0x9a0c0c
    if (tier >= 1) {
      g.rect(ex + 4, 15, 2, 1, blood)
      g.rect(ex - 7, 6, 3, 1, blood)
    }
    if (tier >= 2) {
      for (let i = 0; i < 6; i++) g.px(ex + 5, 15 + i, blood)
      g.blob(ex - 5, 15, 2, 1.5, 0x7a4a6a, 0)
    }
    if (tier >= 3) {
      for (let i = 0; i < 14; i++) g.px(3 + Math.floor(r() * 18), 4 + Math.floor(r() * 18), blood)
      for (let i = 0; i < 7; i++) g.px(ex - 4, 6 + i, blood)
      g.blob(ex + 4, 11, 2.5, 2, 0x6a3a5a, 0)
    }
    if (tier >= 4 || dead) {
      for (let i = 0; i < 30; i++) g.px(3 + Math.floor(r() * 18), 3 + Math.floor(r() * 20), r() < 0.5 ? blood : 0x6a0606)
    }
    g.outline(0x0a0606)
    const cv = g.toCanvas()
    this.faces.set(key, cv)
    return cv
  }

  // ---------------------------------------------------------------------
  // Barra inferior
  // ---------------------------------------------------------------------
  private buildBar(): HTMLCanvasElement {
    const W = this.W
    const h = this.barH
    const g = new Img(W, h)
    const r = rng(42)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < W; x++) g.px(x, y, shade(0x5a5048, 0.85 + r() * 0.2 - (y === 0 ? 0 : 0)))
    g.rect(0, 0, W, 1, 0x9a8a78)
    g.rect(0, 1, W, 1, 0x2a2420)
    const x0 = Math.floor((W - 320) / 2)
    const box = (x: number, w: number) => {
      g.rect(x0 + x, 3, w, h - 5, 0x1e1a18)
      g.rect(x0 + x, 3, w, 1, 0x0e0c0a)
      g.rect(x0 + x, h - 3, w, 1, 0x8a7a68)
      g.rect(x0 + x + w - 1, 3, 1, h - 5, 0x8a7a68)
    }
    box(2, 46)
    box(50, 54)
    box(106, 40)
    box(148, 26)
    box(176, 56)
    box(234, 84)
    // remaches decorativos a los lados
    for (let x = 4; x < x0 - 4; x += 12) {
      g.px(x, 6, 0xb0a090)
      g.px(x, h - 6, 0xb0a090)
      g.px(W - x, 6, 0xb0a090)
      g.px(W - x, h - 6, 0xb0a090)
    }
    return g.toCanvas()
  }

  drawBar(s: HudState) {
    const c = this.ctx
    if (!this.bar) this.bar = this.buildBar()
    const y0 = this.H - this.barH
    c.drawImage(this.bar, 0, y0)
    const x0 = Math.floor((this.W - 320) / 2)
    const red = '#e02a1a'
    // munición
    this.text(s.ammoInfinite ? '--' : String(s.ammo), x0 + 25, y0 + 8, red, 2, 'center', true, true)
    this.text('CARGA', x0 + 25, y0 + 29, '#b8a890', 1, 'center', false)
    // salud
    const hpCol = s.hp <= 25 ? '#ff3020' : red
    this.text(`${Math.max(0, Math.ceil(s.hp))}%`, x0 + 77, y0 + 8, hpCol, 2, 'center', true, true)
    this.text('SALUD', x0 + 77, y0 + 29, '#b8a890', 1, 'center', false)
    // armas 1-5
    for (let i = 0; i < 5; i++) {
      const col = i < 3 ? i : i - 3
      const row = i < 3 ? 0 : 1
      const x = x0 + 112 + col * 12
      const y = y0 + 7 + row * 11
      const own = s.owned[i]
      const cur = s.current === i
      if (cur) {
        c.fillStyle = '#5a1a10'
        c.fillRect(x - 2, y - 1, 9, 9)
      }
      this.text(String(i + 1), x, y, cur ? '#ffe060' : own ? '#e8c860' : '#5a5048', 1, 'left', false)
    }
    this.text('ARMAS', x0 + 126, y0 + 29, '#b8a890', 1, 'center', false)
    // cara
    c.fillStyle = s.faceMode === 'dead' ? '#300808' : '#2a1410'
    c.fillRect(x0 + 149, y0 + 4, 24, this.barH - 7)
    const f = this.face(s.skin, s.hair, s.faceTier, s.faceLook, s.faceMode)
    c.drawImage(f, x0 + 149, y0 + 3)
    // armadura
    this.text(`${Math.ceil(s.armor)}%`, x0 + 204, y0 + 8, s.armor > 0 ? '#40d060' : '#3a5a3a', 2, 'center', true, true)
    this.text('ARMADURA', x0 + 204, y0 + 29, '#b8a890', 1, 'center', false)
    // tabla de munición
    for (let i = 0; i < s.ammoTable.length; i++) {
      const [lab, cur, max] = s.ammoTable[i]
      const y = y0 + 4 + i * 8
      this.text(lab, x0 + 238, y, '#c8b898', 1, 'left', false)
      this.text(`${cur}/${max}`, x0 + 314, y, cur > 0 ? '#ffd040' : '#6a5a40', 1, 'right', false)
    }
  }
}
