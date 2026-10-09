/** Tipos de enemigos: formas, comportamiento y patrones de disparo. */
import type { Game } from './game'
import type { Enemy, EnemyDef } from './types'
import { BIG, KUNAI, MED, RICE, SMALL, bs, cached, glow, shapeSprite, type ShapeDef, type Sprite } from './sprites'
import { H, TAU, W, clamp, easeOut, mix, rand, rgba } from './util'

// Colores de bala (índices en BCOL)
export const PINK = 0
export const ORANGE = 1
export const YELLOW = 2
export const RED = 3
export const VIOLET = 4
export const BLUE = 5
export const GREEN = 6
export const MAGENTA = 7

const sprOf = (id: string, def: ShapeDef) => (g: Game): Sprite => shapeSprite(id, def, g.sectorDef().tint)
const sprAlt = (id: string, def: ShapeDef) => (g: Game): Sprite => {
  const t = g.sectorDef().tint
  return shapeSprite(id, def, { ...t, main: t.accent, accent: t.main })
}

/** El enemigo dispara solo si está en pantalla y no encima del jugador. */
function canFire(g: Game, e: Enemy, minDist = 70): boolean {
  const p = g.nearest(e.x, e.y)
  if (!p.alive || g.mode === 'dead' || e.y < 6 || e.y > H - 40 || e.x < 4 || e.x > W - 4) return false
  const dx = p.x - e.x
  const dy = p.y - e.y
  return dx * dx + dy * dy > minDist * minDist
}

// ===================== Formas =====================

const ZAKO: ShapeDef = {
  w: 22,
  h: 18,
  layers: [
    { pts: [0, 9, 4, 3, 10, -4, 9, -8, 3, -5, 0, -7], fill: 'body', stroke: true },
    { pts: [7, -3, 10, -4, 9, -8, 7, -6], fill: 'main', pair: true },
    { pts: [0, 5, 2, 1, 2, -3, 0, -4], fill: 'glass' },
  ],
}
const DART: ShapeDef = {
  w: 16,
  h: 22,
  layers: [
    { pts: [0, 12, 3, 1, 8, -9, 2, -6, 0, -9], fill: 'body', stroke: true },
    { pts: [0, 7, 1.5, 0, 0, -3], fill: 'main' },
  ],
  lights: [0, -6, 1.4],
}
const GUNSHIP: ShapeDef = {
  w: 38,
  h: 30,
  layers: [
    { pts: [9, 2, 18, 5, 19, -6, 13, -10, 9, -6], fill: 'body', stroke: true, pair: true },
    { pts: [0, 15, 5, 10, 8, 2, 9, -8, 5, -13, 0, -12], fill: 'body', stroke: true },
    { pts: [15, 4, 17, 4, 17, 11, 15, 11], fill: 'main', pair: true },
    { pts: [0, 8, 3, 3, 3, -4, 0, -6], fill: 'dark' },
    { pts: [0, 4, 2, 1, 2, -2, 0, -3], fill: 'glass' },
  ],
  lights: [12, -4, 1.2],
}
const TURRET: ShapeDef = {
  w: 34,
  h: 34,
  layers: [
    { pts: [0, 16, 11, 12, 16, 0, 11, -12, 0, -16], fill: 'body', stroke: true },
    { pts: [0, 10, 7, 7, 10, 0, 7, -7, 0, -10], fill: 'dark', stroke: true },
  ],
  lights: [0, 0, 3.2, 12, 0, 1],
}
const CARRIER: ShapeDef = {
  w: 76,
  h: 48,
  layers: [
    { pts: [0, 23, 12, 19, 34, 9, 37, -6, 27, -19, 10, -23, 0, -21], fill: 'body', stroke: true },
    { pts: [18, 6, 30, 3, 31, -6, 20, -10], fill: 'dark', stroke: true, pair: true },
    { pts: [0, 15, 7, 11, 8, -10, 0, -14], fill: 'dark' },
    { pts: [22, 13, 27, 11, 27, 16, 22, 18], fill: 'main', pair: true },
    { pts: [0, 10, 3, 6, 3, -2, 0, -5], fill: 'glass' },
  ],
  lights: [25, -2, 2, 0, -16, 1.6],
}
const SNIPER: ShapeDef = {
  w: 20,
  h: 28,
  layers: [
    { pts: [0, 14, 2.5, 4, 9, -3, 9, -10, 3, -8, 0, -13], fill: 'body', stroke: true },
    { pts: [0, 14, 1, 6, 0, 2], fill: 'light' },
  ],
  lights: [0, -4, 1.6],
}
const WEAVER: ShapeDef = {
  w: 20,
  h: 18,
  layers: [
    { pts: [0, 9, 6, 5, 10, -2, 6, -8, 0, -6], fill: 'body', stroke: true },
    { pts: [8, 0, 11, 3, 10, -4], fill: 'main', pair: true },
  ],
  lights: [0, 0, 2.2],
}
const FRIGATE: ShapeDef = {
  w: 96,
  h: 64,
  layers: [
    { pts: [14, -2, 46, 4, 47, -12, 30, -22, 14, -18], fill: 'body', stroke: true, pair: true },
    { pts: [36, 4, 41, 4, 41, 18, 36, 18], fill: 'main', pair: true },
    { pts: [0, 30, 9, 22, 15, 8, 16, -16, 9, -28, 0, -30], fill: 'body', stroke: true },
    { pts: [0, 18, 6, 12, 6, -12, 0, -18], fill: 'dark', stroke: true },
    { pts: [0, 8, 3, 4, 3, -4, 0, -7], fill: 'glass' },
  ],
  lights: [30, -10, 2.2, 0, -22, 2],
}
const BLADE: ShapeDef = {
  w: 110,
  h: 50,
  layers: [
    { pts: [0, 22, 20, 12, 54, 4, 40, -4, 20, -14, 0, -20], fill: 'body', stroke: true },
    { pts: [30, 2, 52, 4, 38, -2], fill: 'main', pair: true },
    { pts: [0, 14, 8, 8, 8, -10, 0, -14], fill: 'dark', stroke: true },
    { pts: [0, 6, 3, 2, 3, -5, 0, -8], fill: 'glass' },
  ],
  lights: [20, -6, 2, 44, 2, 1.4],
}

function mineSprite(g: Game): Sprite {
  const t = g.sectorDef().tint
  return cached('mine|' + t.main, 28, 28, (ctx) => {
    ctx.translate(14, 14)
    ctx.strokeStyle = t.main
    ctx.lineWidth = 1.6
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6)
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11)
      ctx.stroke()
    }
    const gr = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8)
    gr.addColorStop(0, mix(t.main, '#ffffff', 0.5))
    gr.addColorStop(0.5, t.body)
    gr.addColorStop(1, t.dark)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, 7.5, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = t.main
    ctx.lineWidth = 1
    ctx.stroke()
  })
}

function itemShipSprite(): Sprite {
  return cached('itemship', 36, 26, (ctx) => {
    ctx.translate(18, 13)
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16)
    g.addColorStop(0, 'rgba(253,224,71,0.6)')
    g.addColorStop(1, 'rgba(253,224,71,0)')
    ctx.fillStyle = g
    ctx.fillRect(-18, -13, 36, 26)
    ctx.fillStyle = '#3f2d05'
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.ellipse(0, 0, 14, 7, 0, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fef9c3'
    ctx.beginPath()
    ctx.ellipse(0, -2, 6, 4, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#facc15'
    for (const x of [-10, -5, 5, 10]) ctx.fillRect(x - 1, 2, 2, 2)
  })
}

function sentinelSprite(g: Game): Sprite {
  const t = g.sectorDef().tint
  return cached('sentinel|' + t.main, 84, 84, (ctx) => {
    ctx.translate(42, 42)
    ctx.save()
    ctx.shadowColor = t.main
    ctx.shadowBlur = 10
    ctx.strokeStyle = t.main
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 34, 0, TAU)
    ctx.stroke()
    ctx.restore()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU
      ctx.save()
      ctx.rotate(a)
      ctx.fillStyle = t.body
      ctx.strokeStyle = t.main
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(26, -7)
      ctx.lineTo(38, -4)
      ctx.lineTo(38, 4)
      ctx.lineTo(26, 7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    const gr = ctx.createRadialGradient(-6, -6, 2, 0, 0, 25)
    gr.addColorStop(0, mix(t.main, '#ffffff', 0.4))
    gr.addColorStop(0.4, t.body)
    gr.addColorStop(1, t.dark)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, 25, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = t.main
    ctx.lineWidth = 1.5
    ctx.stroke()
    const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, 11)
    eye.addColorStop(0, '#ffffff')
    eye.addColorStop(0.35, t.accent)
    eye.addColorStop(1, rgba(t.accent, 0))
    ctx.fillStyle = eye
    ctx.beginPath()
    ctx.arc(0, 0, 11, 0, TAU)
    ctx.fill()
  })
}

// ===================== Comportamientos =====================

/** Zako: caza ligero. a = modo (0 serpentea, 1 rizo lateral, 2 picada), b = lado, d = x base. */
export const zako: EnemyDef = {
  id: 'zako',
  hp: 2.6,
  r: 9,
  score: 100,
  size: 0,
  rotates: true,
  sprite: sprOf('zako', ZAKO),
  update(g, e, dt) {
    const lvl = g.diff.lvl
    if (e.a === 0) {
      e.y += (78 + lvl * 6) * dt
      const nx = e.d + Math.sin(e.t * 2.4 + e.c) * 34
      e.vx = (nx - e.x) / Math.max(dt, 0.001)
      e.x = nx
      e.ang = Math.PI / 2 - clamp(e.vx / 300, -0.6, 0.6)
    } else if (e.a === 1) {
      // rizo estilo galaga: gira hacia el lado contrario mientras baja
      const sp = 150 + lvl * 8
      const turn = e.t < 0.6 ? 0 : e.t < 2.6 ? 1.9 : 0
      e.ang += -e.b * turn * dt
      e.x += Math.cos(e.ang) * sp * dt
      e.y += Math.sin(e.ang) * sp * dt
    } else {
      // picada: baja, se detiene y se lanza hacia el jugador
      if (e.t < 0.8) e.y += 160 * dt * (1 - e.t / 0.8) + 20 * dt
      else {
        if (e.fireN === 0) {
          e.fireN = 1
          e.ang = Math.atan2(g.nearest(e.x, e.y).y - e.y, g.nearest(e.x, e.y).x - e.x)
          e.ang = clamp(e.ang, 0.5, Math.PI - 0.5)
        }
        const sp = 210 + lvl * 10
        e.x += Math.cos(e.ang) * sp * dt
        e.y += Math.sin(e.ang) * sp * dt
      }
    }
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0) {
      e.fireT = rand(1.4, 2.8)
      if (canFire(g, e, 90) && e.y < g.nearest(e.x, e.y).y - 60 && Math.random() < 0.35 + lvl * 0.1) {
        const a = g.aim(e.x, e.y)
        if (lvl >= 3) g.fan(e.x, e.y, 2, 0.16, 120, a, bs(SMALL, PINK))
        else g.bullet(e.x, e.y, a, 120, bs(SMALL, PINK))
      }
    }
  },
}

/** Dardo: cae rápido y suelta un kunai apuntado. */
export const dart: EnemyDef = {
  id: 'dart',
  hp: 3.5,
  r: 8,
  score: 150,
  size: 0,
  sprite: sprOf('dart', DART),
  update(g, e, dt) {
    const sp = 230 + g.diff.lvl * 12
    if (e.t < 0.5) e.x += clamp(g.nearest(e.x, e.y).x - e.x, -60, 60) * dt * 1.2
    e.y += sp * dt
    if (e.fireN === 0 && e.y > 70 && g.diff.lvl >= 1) {
      e.fireN = 1
      if (canFire(g, e)) g.bullet(e.x, e.y, g.aim(e.x, e.y), 170, bs(KUNAI, ORANGE))
    }
  },
}

/** Cañonera: entra, se planta, dispara abanicos y se va. d = y objetivo. */
export const gunship: EnemyDef = {
  id: 'gunship',
  hp: 26,
  r: 15,
  score: 800,
  size: 1,
  sprite: sprOf('gunship', GUNSHIP),
  update(g, e, dt) {
    const stay = 5.5
    if (e.t < 1) e.y = e.c + (e.d - e.c) * easeOut(e.t)
    else if (e.t < 1 + stay) {
      e.x += Math.sin(e.t * 1.3 + e.seed * 6) * 18 * dt
      e.fireT -= dt * g.diff.rate
      if (e.fireT <= 0 && canFire(g, e)) {
        e.fireT = 1.15
        e.fireN++
        const a = g.aim(e.x, e.y)
        const n = g.n(e.fireN % 2 ? 5 : 4, 3)
        g.fan(e.x, e.y + 8, n, 0.55, 105, a, bs(e.fireN % 2 ? MED : RICE, e.fireN % 2 ? ORANGE : YELLOW))
        if (g.diff.lvl >= 2 && e.fireN % 3 === 0) g.ring(e.x, e.y, g.n(10), 80, e.seed * TAU, bs(SMALL, VIOLET))
      }
    } else e.y -= 70 * dt * Math.min(1, e.t - 1 - stay)
  },
}

/** Torreta pesada: desciende con el fondo girando una espiral. */
export const turret: EnemyDef = {
  id: 'turret',
  hp: 55,
  r: 16,
  score: 1200,
  size: 1,
  sprite: sprAlt('turret', TURRET),
  update(g, e, dt) {
    e.y += 34 * dt
    e.ang += dt * (1.6 + g.diff.lvl * 0.1) * (e.seed > 0.5 ? 1 : -1)
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0 && canFire(g, e, 60)) {
      e.fireT = 0.2
      const arms = g.diff.lvl >= 3 ? 3 : 2
      for (let i = 0; i < arms; i++) g.bullet(e.x, e.y, e.ang + (i * TAU) / arms, 95, bs(RICE, BLUE))
      e.fireN++
      if (e.fireN % 14 === 0) g.fan(e.x, e.y, 3, 0.3, 130, g.aim(e.x, e.y), bs(MED, RED))
    }
  },
}

/** Portanaves: grande, lento, lanza cortinas y suelta potenciadores. */
export const carrier: EnemyDef = {
  id: 'carrier',
  hp: 150,
  r: 26,
  score: 4000,
  size: 2,
  sprite: sprOf('carrier', CARRIER),
  onDeath(g, e) {
    g.dropItems('M3', e.x, e.y)
  },
  update(g, e, dt) {
    if (e.t < 2.2) e.y = -50 + 150 * easeOut(e.t / 2.2)
    else if (e.t < 15) e.x += Math.sin((e.t - 2.2) * 0.6) * 40 * dt
    else e.y += 40 * dt
    e.fireT -= dt * g.diff.rate
    if (e.t > 2 && e.t < 15 && e.fireT <= 0 && canFire(g, e, 40)) {
      e.fireN++
      if (e.fireN % 3 === 0) {
        e.fireT = 1.2
        g.ring(e.x, e.y, g.n(16), 85, e.t, bs(MED, PINK))
      } else {
        e.fireT = 0.9
        for (const s of [-1, 1]) g.fan(e.x + s * 25, e.y + 12, g.n(3), 0.5, 120, Math.PI / 2 + s * 0.25, bs(RICE, YELLOW))
      }
      if (e.fireN % 4 === 2) g.spawn(zako, e.x, e.y + 10, { a: 2, d: 0 })
    }
  },
}

/** Mina: deriva y estalla en anillo. */
export const mine: EnemyDef = {
  id: 'mine',
  hp: 5,
  r: 10,
  score: 250,
  size: 0,
  sprite: mineSprite,
  update(g, e, dt) {
    e.y += (45 + Math.sin(e.t * 2 + e.seed * 9) * 15) * dt
    e.x += Math.sin(e.t * 1.3 + e.seed * 5) * 20 * dt
    e.ang += dt * 2
    const fuse = 4.2 - g.diff.lvl * 0.15
    if (e.t > fuse - 0.8) e.flash = Math.sin(e.t * 30) > 0 ? 0.05 : 0
    if (e.t > fuse && g.diff.lvl >= 1) {
      e.alive = false
      g.puff(e.x, e.y, '#ffffff', 26, 0.2)
      g.sparks(e.x, e.y, g.sectorDef().tint.main, 10, 150)
      if (canFire(g, e, 50)) g.ring(e.x, e.y, g.n(10), 85, e.seed * TAU, bs(MED, MAGENTA))
    }
  },
  onDeath(g, e) {
    if (g.diff.lvl >= 4) g.ring(e.x, e.y, g.n(6), 70, e.seed * TAU, bs(SMALL, MAGENTA))
  },
}

/** Francotirador: apunta con una mira láser y dispara una ráfaga recta. b = lado. */
export const sniper: EnemyDef = {
  id: 'sniper',
  hp: 12,
  r: 10,
  score: 600,
  size: 0,
  rotates: true,
  sprite: sprOf('sniper', SNIPER),
  update(g, e, dt) {
    if (e.t < 0.9) {
      e.x += (e.d - e.x) * Math.min(1, dt * 4)
      e.y += (e.c - e.y) * Math.min(1, dt * 4)
      e.a = g.aim(e.x, e.y)
    } else if (e.t < 1.7) {
      e.a += clamp(g.aim(e.x, e.y) - e.a, -0.6 * dt, 0.6 * dt)
    } else if (e.t < 2.4) {
      e.fireT -= dt
      if (e.fireT <= 0 && e.fireN < 5 + Math.min(4, g.diff.lvl)) {
        e.fireT = 0.06
        e.fireN++
        if (canFire(g, e, 40)) g.bullet(e.x, e.y, e.a, 230 + e.fireN * 12, bs(KUNAI, RED))
      }
    } else {
      e.y -= 120 * dt
      e.x += e.b * 60 * dt
    }
    e.ang = e.a
  },
}

/** Tejedor: forma una serpiente que ondula. d = x base, c = índice. */
export const weaver: EnemyDef = {
  id: 'weaver',
  hp: 6,
  r: 9,
  score: 200,
  size: 0,
  sprite: sprOf('weaver', WEAVER),
  update(g, e, dt) {
    e.y += (72 + g.diff.lvl * 5) * dt
    e.x = e.d + Math.sin(e.t * 2.6 - e.c * 0.42) * 92
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0) {
      e.fireT = rand(1.5, 2.6)
      if (canFire(g, e) && e.c % 2 === 0) g.bullet(e.x, e.y, Math.PI / 2, 110, bs(RICE, GREEN))
    }
  },
}

/** Nave de suministros: no dispara; suelta un potenciador. b = dirección. */
export const itemShip: EnemyDef = {
  id: 'itemship',
  hp: 14,
  r: 13,
  score: 1000,
  size: 1,
  sprite: () => itemShipSprite(),
  update(g, e, dt) {
    e.x += e.b * 70 * dt
    e.y = e.d + Math.sin(e.t * 2.5) * 12
    if (Math.random() < 0.3) g.puff(e.x - e.b * 14, e.y, '#fde047', 8, 0.3)
  },
}

// ===================== Mid-bosses =====================

function midDeath(g: Game, e: Enemy) {
  g.item('P', e.x, e.y)
  g.dropItems('M3', e.x, e.y + 10)
  if (Math.random() < 0.35) g.item('B', e.x + 14, e.y)
  g.cancelBullets(true)
  g.juice.flash('#ffffff', 0.4)
  g.juice.freeze(120)
}

/** Fragata: abanicos apuntados y cañones laterales. */
export const frigate: EnemyDef = {
  id: 'frigate',
  hp: 360,
  r: 26,
  score: 30000,
  size: 2,
  onDeath: midDeath,
  sprite: sprOf('frigate', FRIGATE),
  update(g, e, dt) {
    if (e.t < 2) e.y = -40 + 150 * easeOut(e.t / 2)
    else if (e.t < 24) e.x = W / 2 + Math.sin((e.t - 2) * 0.55) * 90
    else e.y -= 60 * dt
    if (e.t < 2.2 || e.t > 24) return
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0 && canFire(g, e, 30)) {
      e.fireN++
      const k = e.fireN % 4
      if (k === 0) {
        e.fireT = 1.1
        g.ring(e.x, e.y, g.n(20), 90, e.t * 0.7, bs(MED, PINK))
      } else {
        e.fireT = 0.45
        const a = g.aim(e.x, e.y)
        g.fan(e.x, e.y + 18, g.n(k === 2 ? 7 : 5), 0.8, 135, a, bs(RICE, ORANGE))
        for (const s of [-1, 1]) g.bullet(e.x + s * 38, e.y + 14, Math.PI / 2 + s * 0.15, 150, bs(KUNAI, YELLOW))
      }
    }
  },
}

/** Centinela: espiral de tres brazos y orbes que se dividen. */
export const sentinel: EnemyDef = {
  id: 'sentinel',
  hp: 400,
  r: 28,
  score: 32000,
  size: 2,
  onDeath: midDeath,
  sprite: sentinelSprite,
  rotates: true,
  update(g, e, dt) {
    if (e.t < 2) e.y = -40 + 160 * easeOut(e.t / 2)
    else if (e.t < 24) {
      e.x = W / 2 + Math.sin((e.t - 2) * 0.4) * 70
      e.y = 120 + Math.sin((e.t - 2) * 0.8) * 20
    } else e.y -= 60 * dt
    e.ang += dt * 0.8
    if (e.t < 2.2 || e.t > 24) return
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0 && canFire(g, e, 30)) {
      e.fireT = 0.11
      e.fireN++
      e.a += 0.23
      const arms = g.diff.lvl >= 3 ? 4 : 3
      for (let i = 0; i < arms; i++) g.bullet(e.x, e.y, e.a + (i * TAU) / arms, 100, bs(SMALL, VIOLET))
      if (e.fireN % 26 === 0) g.bullet(e.x, e.y, g.aim(e.x, e.y), 90, bs(BIG, MAGENTA), { split: 1.1, splitN: g.n(12), splitSpr: bs(SMALL, MAGENTA), splitV: 85 })
    }
  },
}

/** Hoja: embestidas laterales y cortinas de kunai. */
export const blade: EnemyDef = {
  id: 'blade',
  hp: 440,
  r: 26,
  score: 34000,
  size: 2,
  onDeath: midDeath,
  sprite: sprOf('blade', BLADE),
  update(g, e, dt) {
    if (e.t < 2) e.y = -40 + 140 * easeOut(e.t / 2)
    else if (e.t < 24) {
      const cyc = (e.t - 2) % 4
      if (cyc < 0.1 && e.b === 0) {
        e.b = 1
        e.c = clamp(g.nearest(e.x, e.y).x + rand(-60, 60), 60, W - 60)
      }
      if (cyc > 0.1) e.b = 0
      e.x += (e.c - e.x) * Math.min(1, dt * 2.5)
    } else e.y -= 60 * dt
    if (e.t < 2.2 || e.t > 24) return
    e.fireT -= dt * g.diff.rate
    if (e.fireT <= 0 && canFire(g, e, 30)) {
      e.fireN++
      if (e.fireN % 5 === 0) {
        e.fireT = 0.9
        // cortina con hueco
        const gap = rand(0.25, 0.75) * W
        const n = g.n(14)
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * (W / n)
          if (Math.abs(x - gap) < 36) continue
          g.bullet(x, e.y + 10, Math.PI / 2, 80, bs(KUNAI, RED), { delay: Math.abs(x - e.x) / 600 })
        }
      } else {
        e.fireT = 0.3
        for (const s of [-1, 1]) g.bullet(e.x + s * 40, e.y + 4, Math.PI / 2 + s * 0.5, 120, bs(RICE, ORANGE), { turn: -s * 0.55 })
      }
    }
  },
}

// ===================== Piezas de jefe (posicionadas por el jefe) =====================

export const bossPiece: EnemyDef = {
  id: 'bosspiece',
  hp: 1,
  r: 10,
  score: 0,
  size: 1,
  noChain: true,
  sprite: () => glow('#ffffff', 4),
  update() {},
}

