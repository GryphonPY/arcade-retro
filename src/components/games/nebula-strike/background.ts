/**
 * Fondo espacial con nebulosas pre-renderizadas (mosaico vertical sin
 * costuras), tres capas de estrellas en paralaje y decorados por sector.
 */
import { baseTransform, makeSprite, glow, type Sprite } from './sprites'
import { sectorFor, type Palette } from './sectors'
import { H, RS, TAU, W, mix, rgba, seeded } from './util'

const TILE_H = 720

function nebulaTile(pal: Palette, seed: number): HTMLCanvasElement {
  // Resolución baja a propósito (es niebla): 1x lógico.
  const c = document.createElement('canvas')
  c.width = W
  c.height = TILE_H
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const r = seeded(seed)
  ctx.fillStyle = pal.base
  ctx.fillRect(0, 0, W, TILE_H)
  const blob = (x: number, y: number, rad: number, col: string, a: number) => {
    for (const oy of [-TILE_H, 0, TILE_H]) {
      const g = ctx.createRadialGradient(x, y + oy, 0, x, y + oy, rad)
      g.addColorStop(0, rgba(col, a))
      g.addColorStop(0.5, rgba(col, a * 0.45))
      g.addColorStop(1, rgba(col, 0))
      ctx.fillStyle = g
      ctx.fillRect(x - rad, y + oy - rad, rad * 2, rad * 2)
    }
  }
  ctx.globalCompositeOperation = 'lighter'
  // nubes grandes
  for (let i = 0; i < 9; i++) {
    const col = pal.neb[i % pal.neb.length]
    blob(r() * W, r() * TILE_H, 90 + r() * 150, col, 0.1 + r() * 0.12)
  }
  // filamentos
  for (let i = 0; i < 26; i++) {
    const col = pal.neb[(i + 1) % pal.neb.length]
    const x = r() * W
    const y = r() * TILE_H
    for (let k = 0; k < 4; k++) blob(x + k * (r() * 30 - 15), y + k * (r() * 40 - 10), 18 + r() * 40, col, 0.05 + r() * 0.07)
  }
  // polvo estelar fino
  for (let i = 0; i < 260; i++) {
    const x = r() * W
    const y = r() * TILE_H
    ctx.fillStyle = rgba(i % 3 === 0 ? pal.star : '#ffffff', 0.15 + r() * 0.35)
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.globalCompositeOperation = 'source-over'
  // oscurece un poco para que las balas resalten
  ctx.fillStyle = 'rgba(2,2,10,0.28)'
  ctx.fillRect(0, 0, W, TILE_H)
  return c
}

// ===================== Decorados =====================

function planetSprite(main: string, ring: boolean, r: number): Sprite {
  const pad = ring ? r * 0.9 : 12
  return makeSprite(r * 2 + pad * 2, r * 2 + pad * 2, (ctx) => {
    const c = r + pad
    const halo = ctx.createRadialGradient(c, c, r * 0.9, c, c, r + pad)
    halo.addColorStop(0, rgba(main, 0.35))
    halo.addColorStop(1, rgba(main, 0))
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, c * 2, c * 2)
    if (ring) {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(-0.35)
      ctx.scale(1, 0.26)
      ctx.lineWidth = r * 0.22
      ctx.strokeStyle = rgba(mix(main, '#ffffff', 0.3), 0.35)
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.55, Math.PI, TAU)
      ctx.stroke()
      ctx.restore()
    }
    const g = ctx.createRadialGradient(c - r * 0.4, c - r * 0.45, r * 0.1, c, c, r)
    g.addColorStop(0, mix(main, '#ffffff', 0.35))
    g.addColorStop(0.5, mix(main, '#0b0b1a', 0.45))
    g.addColorStop(1, '#05050c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, r, 0, TAU)
    ctx.fill()
    // bandas
    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, r, 0, TAU)
    ctx.clip()
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rgba(i % 2 ? '#ffffff' : main, 0.06)
      ctx.fillRect(c - r, c - r + i * r * 0.36 + r * 0.1, r * 2, r * 0.14)
    }
    ctx.restore()
    if (ring) {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(-0.35)
      ctx.scale(1, 0.26)
      ctx.lineWidth = r * 0.22
      ctx.strokeStyle = rgba(mix(main, '#ffffff', 0.4), 0.5)
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.55, 0, Math.PI)
      ctx.stroke()
      ctx.restore()
    }
  })
}

function rockSprite(seed: number, size: number, tint: string): Sprite {
  const r = seeded(seed)
  return makeSprite(size * 2 + 4, size * 2 + 4, (ctx) => {
    const c = size + 2
    ctx.beginPath()
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      const rr = size * (0.7 + r() * 0.3)
      if (i === 0) ctx.moveTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr)
      else ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr)
    }
    ctx.closePath()
    const g = ctx.createLinearGradient(0, 0, size * 2, size * 2)
    g.addColorStop(0, mix(tint, '#1a1028', 0.6))
    g.addColorStop(1, '#07050c')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = rgba(tint, 0.45)
    ctx.lineWidth = 1
    ctx.stroke()
  })
}

function wreckSprite(seed: number, tint: string): Sprite {
  const r = seeded(seed)
  return makeSprite(120, 220, (ctx) => {
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#0a1a1c'
    ctx.strokeStyle = rgba(tint, 0.6)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(60, 4)
    ctx.lineTo(96, 40)
    ctx.lineTo(100, 150)
    ctx.lineTo(80, 216)
    ctx.lineTo(40, 216)
    ctx.lineTo(20, 150)
    ctx.lineTo(24, 40)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = rgba(tint, 0.25)
      ctx.fillRect(30 + r() * 60, 20 + r() * 180, 8 + r() * 14, 2)
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = r() < 0.5 ? rgba(tint, 0.9) : 'rgba(255,200,120,0.8)'
      ctx.fillRect(28 + r() * 64, 20 + r() * 190, 1.5, 1.5)
    }
  })
}

function sunSprite(): Sprite {
  return makeSprite(360, 220, (ctx) => {
    const g = ctx.createRadialGradient(180, -60, 20, 180, -60, 260)
    g.addColorStop(0, '#fff7ed')
    g.addColorStop(0.18, '#fdba74')
    g.addColorStop(0.35, 'rgba(249,115,22,0.55)')
    g.addColorStop(0.6, 'rgba(220,38,38,0.18)')
    g.addColorStop(1, 'rgba(120,20,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 360, 220)
  })
}

function voidSprite(): Sprite {
  return makeSprite(220, 220, (ctx) => {
    const c = 110
    ctx.save()
    ctx.translate(c, c)
    for (let i = 0; i < 40; i++) {
      ctx.rotate(0.16)
      ctx.strokeStyle = rgba(i % 2 ? '#c084fc' : '#f0abfc', 0.05 + (i % 5) * 0.012)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, 100 - i * 0.6, 30 + i * 0.5, 0, 0, TAU)
      ctx.stroke()
    }
    ctx.restore()
    const g = ctx.createRadialGradient(c, c, 0, c, c, 42)
    g.addColorStop(0, '#000000')
    g.addColorStop(0.75, '#000000')
    g.addColorStop(0.86, 'rgba(240,171,252,0.9)')
    g.addColorStop(1, 'rgba(192,132,252,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, 42, 0, TAU)
    ctx.fill()
  })
}

interface Decor {
  spr: Sprite
  x: number
  y: number
  v: number
  rot: number
  spin: number
}

export class Background {
  sector = -1
  loop = 0
  tile: HTMLCanvasElement | null = null
  prevTile: HTMLCanvasElement | null = null
  fade = 1
  scroll = 0
  warp = 0
  pal: Palette = sectorFor(0).pal
  stars: Float32Array[] = []
  decor: Decor[] = []
  decorT = 0
  private tiles = new Map<string, HTMLCanvasElement>()

  constructor() {
    const counts = [46, 30, 16]
    for (let l = 0; l < 3; l++) {
      const a = new Float32Array(counts[l] * 2)
      for (let i = 0; i < counts[l]; i++) {
        a[i * 2] = Math.random() * W
        a[i * 2 + 1] = Math.random() * H
      }
      this.stars.push(a)
    }
  }

  /** Tesela del sector y bucle (cacheada al ancho actual de `W`). */
  private tileFor(s: number, loop: number): HTMLCanvasElement {
    const key = `${s}|${loop}`
    let t = this.tiles.get(key)
    if (!t) {
      const base = sectorFor(s).pal
      const pal = loop > 0 ? { ...base, base: mix(base.base, '#200008', 0.5), neb: base.neb.map((c) => mix(c, '#ff2050', 0.25)) } : base
      t = nebulaTile(pal, 1000 + s * 77 + loop * 13)
      this.tiles.set(key, t)
    }
    return t
  }

  /**
   * Tras girar la pantalla: las teselas se rehacen al nuevo ancho, y estrellas y
   * decorado se reescalan para seguir repartidos por todo el lienzo.
   */
  resize(oldW: number, oldH: number) {
    const sx = W / oldW
    const sy = H / oldH
    for (const a of this.stars) {
      for (let i = 0; i < a.length; i += 2) {
        a[i] *= sx
        a[i + 1] *= sy
      }
    }
    for (const d of this.decor) {
      d.x *= sx
      d.y *= sy
    }
    this.tiles.clear()
    this.tile = this.tileFor(this.sector, this.loop)
    this.prevTile = null
    this.fade = 1
  }

  setSector(s: number, loop: number) {
    if (s === this.sector && loop === this.loop && this.tile) return
    this.sector = s
    this.loop = loop
    this.pal = sectorFor(s).pal
    const t = this.tileFor(s, loop)
    this.prevTile = this.tile
    this.tile = t
    this.fade = this.prevTile ? 0 : 1
    this.decor = []
    this.decorT = 2
    this.spawnDecor(true)
  }

  spawnDecor(initial: boolean) {
    const kind = this.pal.decor
    const y0 = initial ? 60 : -140
    if (kind === 'planet') {
      this.decor.push({ spr: planetSprite(this.pal.neb[0], true, 54), x: 70 + Math.random() * 220, y: y0 - 60, v: 9, rot: 0, spin: 0 })
    } else if (kind === 'giant') {
      this.decor.push({ spr: planetSprite(this.pal.neb[1], false, 90), x: Math.random() < 0.5 ? 30 : W - 30, y: y0 - 100, v: 6, rot: 0, spin: 0 })
    } else if (kind === 'rocks') {
      for (let i = 0; i < 6; i++) {
        this.decor.push({
          spr: rockSprite(i * 31 + this.decorT, 8 + Math.random() * 18, this.pal.neb[0]),
          x: Math.random() * W,
          y: (initial ? Math.random() * H : -40 - Math.random() * 200) as number,
          v: 30 + Math.random() * 40,
          rot: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 1.5,
        })
      }
    } else if (kind === 'wrecks') {
      this.decor.push({ spr: wreckSprite(Math.floor(Math.random() * 1000), this.pal.neb[0]), x: Math.random() < 0.5 ? 40 : W - 40, y: y0 - 120, v: 26, rot: 0, spin: 0 })
    } else if (kind === 'sun') {
      if (initial) this.decor.push({ spr: sunSprite(), x: W / 2, y: 110, v: 0, rot: 0, spin: 0 })
    } else if (kind === 'void') {
      if (initial) this.decor.push({ spr: voidSprite(), x: W / 2, y: 150, v: 1.5, rot: 0, spin: 0.05 })
    }
  }

  update(dt: number, warp: number) {
    this.warp = warp
    const sp = 1 + warp * 14
    this.scroll = (this.scroll + dt * 14 * sp) % TILE_H
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt * 0.8)
    const speeds = [16, 40, 95]
    for (let l = 0; l < 3; l++) {
      const a = this.stars[l]
      const v = speeds[l] * sp * dt
      for (let i = 1; i < a.length; i += 2) {
        a[i] += v
        if (a[i] > H + 4) {
          a[i] -= H + 8
          a[i - 1] = Math.random() * W
        }
      }
    }
    for (let i = this.decor.length - 1; i >= 0; i--) {
      const d = this.decor[i]
      d.y += d.v * sp * dt
      d.rot += d.spin * dt
      if (d.y - d.spr.h / 2 > H + 20) this.decor.splice(i, 1)
    }
    this.decorT -= dt
    if (this.decorT <= 0) {
      this.decorT = this.pal.decor === 'rocks' ? 6 : 26 + Math.random() * 12
      if (this.pal.decor === 'rocks' || this.decor.length === 0) this.spawnDecor(false)
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const drawTile = (t: HTMLCanvasElement) => {
      const y = this.scroll - TILE_H
      ctx.drawImage(t, 0, y, W, TILE_H)
      ctx.drawImage(t, 0, y + TILE_H, W, TILE_H)
    }
    if (this.prevTile && this.fade < 1) {
      drawTile(this.prevTile)
      ctx.globalAlpha = this.fade
    }
    if (this.tile) drawTile(this.tile)
    ctx.globalAlpha = 1
    // decorados
    for (const d of this.decor) {
      if (d.spin !== 0) {
        const c = Math.cos(d.rot)
        const s = Math.sin(d.rot)
        ctx.setTransform(RS * c, RS * s, -RS * s, RS * c, RS * d.x, RS * d.y)
        ctx.drawImage(d.spr.c, -d.spr.w / 2, -d.spr.h / 2, d.spr.w, d.spr.h)
        baseTransform(ctx)
      } else {
        if (this.pal.decor === 'sun') ctx.globalAlpha = 0.75 + Math.sin(time * 1.3) * 0.15
        ctx.drawImage(d.spr.c, d.x - d.spr.w / 2, d.y - d.spr.h / 2, d.spr.w, d.spr.h)
        ctx.globalAlpha = 1
      }
    }
    // estrellas
    const w = this.warp
    const cols = ['#64748b', '#cbd5e1', '#ffffff']
    for (let l = 0; l < 3; l++) {
      const a = this.stars[l]
      ctx.fillStyle = l === 2 ? this.pal.star : cols[l]
      const len = 1 + w * (l + 1) * 22
      const sz = l === 2 ? 1.6 : 1
      for (let i = 0; i < a.length; i += 2) ctx.fillRect(a[i], a[i + 1], sz, len)
    }
    if (w < 0.2) {
      const gs = glow(this.pal.star, 4)
      ctx.globalCompositeOperation = 'lighter'
      const a = this.stars[2]
      for (let i = 0; i < a.length; i += 4) {
        ctx.globalAlpha = 0.5 + Math.sin(time * 3 + i) * 0.3
        ctx.drawImage(gs.c, a[i] - 3.2, a[i + 1] - 3.2, 8, 8)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}
