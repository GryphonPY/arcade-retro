/**
 * Sprites pre-renderizados en canvas offscreen. Todo lo que tiene brillo
 * (shadowBlur, degradados) se pinta UNA vez aquí y luego se dibuja con
 * drawImage, así cientos de balas cuestan muy poco por frame.
 */
import { RS, TAU, mix, rgba } from './util'

export interface Sprite {
  c: HTMLCanvasElement
  /** Tamaño lógico (px de juego). */
  w: number
  h: number
}

export function makeSprite(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * RS)
  c.height = Math.ceil(h * RS)
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.scale(RS, RS)
    draw(ctx)
  }
  return { c, w, h }
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1) {
  const w = s.w * scale
  const h = s.h * scale
  ctx.drawImage(s.c, x - w / 2, y - h / 2, w, h)
}

/** Origen actual (temblor de cámara) para las transformaciones absolutas. */
export const origin = { x: 0, y: 0 }
export function baseTransform(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(RS, 0, 0, RS, RS * origin.x, RS * origin.y)
}

/** Dibuja un sprite rotado (ángulo en radianes, 0 = apunta a +x). */
export function drawRot(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, ang: number, scale = 1, sx = 1) {
  const c = Math.cos(ang) * scale
  const si = Math.sin(ang) * scale
  ctx.setTransform(RS * c * sx, RS * si * sx, -RS * si, RS * c, RS * (x + origin.x), RS * (y + origin.y))
  ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h)
  ctx.setTransform(RS, 0, 0, RS, RS * origin.x, RS * origin.y)
}

/** Variantes pre-rotadas (ángulo cuantizado) para dibujar sin transformaciones. */
const ROT_STEPS = 64
const rotCache = new WeakMap<HTMLCanvasElement, (Sprite | undefined)[]>()
export function rotated(s: Sprite, ang: number): Sprite {
  let arr = rotCache.get(s.c)
  if (!arr) {
    arr = new Array(ROT_STEPS)
    rotCache.set(s.c, arr)
  }
  let i = Math.round((ang / TAU) * ROT_STEPS) % ROT_STEPS
  if (i < 0) i += ROT_STEPS
  let r = arr[i]
  if (!r) {
    const a = (i * TAU) / ROT_STEPS
    const d = Math.ceil(Math.hypot(s.w, s.h))
    r = makeSprite(d, d, (ctx) => {
      ctx.translate(d / 2, d / 2)
      ctx.rotate(a)
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h)
    })
    arr[i] = r
  }
  return r
}

/** Dibuja centrado usando la variante pre-rotada. */
export function drawAt(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, ang: number) {
  const r = rotated(s, ang)
  ctx.drawImage(r.c, x - r.w / 2, y - r.h / 2, r.w, r.h)
}

// ===================== Balas enemigas =====================

/** Colores de halo de las balas enemigas (núcleo siempre blanco). */
export const BCOL = ['#ff4fa3', '#ff8a3d', '#ffd23f', '#ff3b5c', '#b06bff', '#4fa8ff', '#5dff9a', '#ff6bff'] as const
export const NCOL = BCOL.length
/** Formas: 0 orbe chico, 1 orbe mediano, 2 orbe grande, 3 arroz, 4 kunai, 5 anillo. */
export const SHAPE_R = [2.4, 3.3, 6.2, 2.3, 2.3, 4] as const
export const SHAPE_ROT = [false, false, false, true, true, false] as const
export const SMALL = 0
export const MED = 1
export const BIG = 2
export const RICE = 3
export const KUNAI = 4
export const RING = 5
/** Índice de sprite de bala: forma * NCOL + color. */
export const bs = (shape: number, color: number) => shape * NCOL + color

function orb(r: number, color: string): Sprite {
  const size = Math.ceil(r * 4.6)
  return makeSprite(size, size, (ctx) => {
    const c = size / 2
    const halo = ctx.createRadialGradient(c, c, r * 0.6, c, c, size / 2)
    halo.addColorStop(0, rgba(color, 0.75))
    halo.addColorStop(0.45, rgba(color, 0.28))
    halo.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(c, c, r * 1.45, 0, TAU)
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(c, c, r * 1.05, 0, TAU)
    ctx.fillStyle = mix(color, '#ffffff', 0.75)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(c, c, r * 0.8, 0, TAU)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  })
}

function rice(color: string): Sprite {
  return makeSprite(22, 12, (ctx) => {
    ctx.translate(11, 6)
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 10)
    halo.addColorStop(0, rgba(color, 0.6))
    halo.addColorStop(1, rgba(color, 0))
    ctx.save()
    ctx.scale(1, 0.55)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, 10.5, 0, TAU)
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.ellipse(0, 0, 7, 3.4, 0, 0, TAU)
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0.5, 0, 5, 1.9, 0, 0, TAU)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  })
}

function kunai(color: string): Sprite {
  return makeSprite(22, 14, (ctx) => {
    ctx.translate(11, 7)
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 10)
    halo.addColorStop(0, rgba(color, 0.55))
    halo.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = halo
    ctx.fillRect(-11, -7, 22, 14)
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(-5, -4.2)
    ctx.lineTo(-3, 0)
    ctx.lineTo(-5, 4.2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-3, -2)
    ctx.lineTo(-2, 0)
    ctx.lineTo(-3, 2)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  })
}

function ringB(color: string): Sprite {
  return makeSprite(20, 20, (ctx) => {
    const halo = ctx.createRadialGradient(10, 10, 3, 10, 10, 10)
    halo.addColorStop(0, rgba(color, 0.5))
    halo.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, 20, 20)
    ctx.lineWidth = 2.6
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(10, 10, 5, 0, TAU)
    ctx.stroke()
    ctx.lineWidth = 1.3
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(10, 10, 1.6, 0, TAU)
    ctx.fill()
  })
}

let bulletSprites: Sprite[] | null = null
export function bulletSprite(i: number): Sprite {
  if (!bulletSprites) {
    bulletSprites = []
    for (let s = 0; s < 6; s++) {
      for (let c = 0; c < NCOL; c++) {
        const col = BCOL[c]
        bulletSprites.push(
          s === 0 ? orb(SHAPE_R[0], col) : s === 1 ? orb(SHAPE_R[1], col) : s === 2 ? orb(SHAPE_R[2], col) : s === 3 ? rice(col) : s === 4 ? kunai(col) : ringB(col),
        )
      }
    }
  }
  return bulletSprites[i]
}

// ===================== Brillos y partículas =====================

const glowCache = new Map<string, Sprite>()
/** Círculo de brillo suave (para dibujar con 'lighter'). */
export function glow(color: string, r: number, core = 0.0): Sprite {
  const key = `${color}|${r}|${core}`
  let s = glowCache.get(key)
  if (!s) {
    s = makeSprite(r * 2, r * 2, (ctx) => {
      const g = ctx.createRadialGradient(r, r, 0, r, r, r)
      if (core > 0) {
        g.addColorStop(0, '#ffffff')
        g.addColorStop(core, color)
      } else g.addColorStop(0, color)
      g.addColorStop(Math.max(core, 0.35), rgba(color, 0.45))
      g.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, r * 2, r * 2)
    })
    glowCache.set(key, s)
  }
  return s
}

const flashCache = new WeakMap<HTMLCanvasElement, Sprite>()
/** Silueta blanca de un sprite (destello de impacto). */
export function flashOf(s: Sprite): Sprite {
  let f = flashCache.get(s.c)
  if (!f) {
    f = makeSprite(s.w, s.h, (ctx) => {
      ctx.drawImage(s.c, 0, 0, s.w, s.h)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(0, 0, s.w, s.h)
    })
    flashCache.set(s.c, f)
  }
  return f
}

// ===================== Naves vectoriales (polígonos espejados) =====================

export type Fill = 'body' | 'dark' | 'main' | 'accent' | 'light' | 'glass'
export interface Layer {
  /** Mitad derecha: pares x,y relativos al centro (x >= 0). Se refleja sola. */
  pts: number[]
  fill: Fill
  stroke?: boolean
  /** Si es true la capa no se refleja (se dibuja tal cual). */
  solo?: boolean
  /** Dibuja el polígono y su reflejo como dos piezas separadas. */
  pair?: boolean
}
export interface ShapeDef {
  w: number
  h: number
  layers: Layer[]
  /** Luces: x, y, radio (se reflejan si x != 0). */
  lights?: number[]
}

export interface Tint {
  main: string
  accent: string
  body: string
  dark: string
}

export function tintFrom(main: string, accent: string, base = '#0b0b18'): Tint {
  return { main, accent, body: mix(base, main, 0.32), dark: mix(base, main, 0.12) }
}

function fillFor(f: Fill, t: Tint, ctx: CanvasRenderingContext2D, h: number): string | CanvasGradient {
  switch (f) {
    case 'body': {
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
      g.addColorStop(0, mix(t.body, '#ffffff', 0.12))
      g.addColorStop(1, t.dark)
      return g
    }
    case 'dark':
      return t.dark
    case 'main':
      return t.main
    case 'accent':
      return t.accent
    case 'light':
      return mix(t.main, '#ffffff', 0.6)
    case 'glass': {
      const g = ctx.createLinearGradient(0, -h / 4, 0, h / 4)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.4, mix(t.accent, '#ffffff', 0.4))
      g.addColorStop(1, t.accent)
      return g
    }
  }
}

export function polyPath(ctx: CanvasRenderingContext2D, pts: number[], solo?: boolean, pair?: boolean) {
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  if (pair) {
    ctx.closePath()
    ctx.moveTo(-pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(-pts[i], pts[i + 1])
  } else if (!solo) for (let i = pts.length - 2; i >= 0; i -= 2) ctx.lineTo(-pts[i], pts[i + 1])
  ctx.closePath()
}

/** Pinta una nave definida por capas en un contexto ya trasladado a su centro. */
export function paintShape(ctx: CanvasRenderingContext2D, def: ShapeDef, t: Tint, glowAmt = 1) {
  for (const L of def.layers) {
    polyPath(ctx, L.pts, L.solo, L.pair)
    ctx.fillStyle = fillFor(L.fill, t, ctx, def.h)
    ctx.fill()
    if (L.stroke) {
      ctx.save()
      ctx.shadowColor = t.main
      ctx.shadowBlur = 6 * glowAmt
      ctx.strokeStyle = t.main
      ctx.lineWidth = 1.2
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.restore()
      ctx.strokeStyle = mix(t.main, '#ffffff', 0.55)
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }
  const lights = def.lights ?? []
  for (let i = 0; i < lights.length; i += 3) {
    const [x, y, r] = [lights[i], lights[i + 1], lights[i + 2]]
    for (const sx of x === 0 ? [0] : [x, -x]) {
      const g = ctx.createRadialGradient(sx, y, 0, sx, y, r * 2.4)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.3, t.accent)
      g.addColorStop(1, rgba(t.accent, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, y, r * 2.4, 0, TAU)
      ctx.fill()
    }
  }
}

const shapeCache = new Map<string, Sprite>()
export function shapeSprite(id: string, def: ShapeDef, t: Tint): Sprite {
  const key = `${id}|${t.main}|${t.accent}`
  let s = shapeCache.get(key)
  if (!s) {
    const pad = 8
    s = makeSprite(def.w + pad * 2, def.h + pad * 2, (ctx) => {
      ctx.translate((def.w + pad * 2) / 2, (def.h + pad * 2) / 2)
      paintShape(ctx, def, t)
    })
    shapeCache.set(key, s)
  }
  return s
}

/** Sprite genérico con caché por clave. */
const anyCache = new Map<string, Sprite>()
export function cached(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  let s = anyCache.get(key)
  if (!s) {
    s = makeSprite(w, h, draw)
    anyCache.set(key, s)
  }
  return s
}

// ===================== Disparos del jugador =====================

/** Aguja de energía alargada (apunta hacia arriba). */
export function needle(color: string, w: number, h: number): Sprite {
  return cached(`needle|${color}|${w}|${h}`, w + 8, h + 8, (ctx) => {
    const cx = (w + 8) / 2
    const cy = (h + 8) / 2
    const g = ctx.createLinearGradient(0, 4, 0, h + 4)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, color)
    g.addColorStop(1, rgba(color, 0))
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 5
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.ellipse(cx, cy - h * 0.15, w / 5, h / 3, 0, 0, TAU)
    ctx.fill()
  })
}

/** Misil teledirigido (apunta a +x para dibujarlo rotado). */
export function missileSprite(color: string): Sprite {
  return cached(`missile|${color}`, 18, 10, (ctx) => {
    ctx.translate(9, 5)
    const g = ctx.createLinearGradient(-9, 0, 0, 0)
    g.addColorStop(0, rgba(color, 0))
    g.addColorStop(1, color)
    ctx.fillStyle = g
    ctx.fillRect(-9, -1.6, 9, 3.2)
    ctx.fillStyle = '#e5e7eb'
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(1, -2.2)
    ctx.lineTo(-3, -2.2)
    ctx.lineTo(-3, 2.2)
    ctx.lineTo(1, 2.2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillRect(-3, -3, 2, 6)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(2, -0.8, 3, 1.6)
  })
}
