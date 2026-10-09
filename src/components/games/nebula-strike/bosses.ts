/**
 * Jefes: uno por sector, con entrada dramática, piezas destruibles, fases
 * con patrones propios y una muerte espectacular (hit-stop + cámara lenta).
 */
import type { Game } from './game'
import type { Boss, BossDef, Enemy, EnemyDef } from './types'
import { fx } from './audio'
import { bossPiece, BLUE, GREEN, MAGENTA, ORANGE, PINK, RED, VIOLET, YELLOW } from './enemies'
import { BIG, KUNAI, MED, RICE, RING, SMALL, bs, cached, shapeSprite, type ShapeDef, type Sprite, type Tint } from './sprites'
import { TAU, W, clamp, easeOut, mix, rand, rgba } from './util'

// ===================== Utilidades de patrón =====================

function every(g: Game, b: Boss, i: number, dt: number, period: number): boolean {
  b.timers[i] -= dt * g.diff.rate
  if (b.timers[i] <= 0) {
    b.timers[i] += period
    if (b.timers[i] < 0) b.timers[i] = period
    return true
  }
  return false
}
const partAlive = (b: Boss, i: number) => !!b.parts[i]?.alive
/** Contador de disparos del jefe (para alternar patrones). */
const nextN = (b: Boss) => b.count++
const cx = (b: Boss) => b.x
const cy = (b: Boss) => b.y + b.def.coreY
function glide(b: Boss, tx: number, ty: number, dt: number, k = 1.5) {
  b.x += (tx - b.x) * Math.min(1, dt * k)
  b.y += (ty - b.y) * Math.min(1, dt * k)
}

const tintOf = (g: Game): Tint => g.sectorDef().tint
const bodyOf = (id: string, def: ShapeDef) => (g: Game): Sprite => shapeSprite('boss-' + id, def, tintOf(g))

function turretSprite(g: Game): Sprite {
  const t = tintOf(g)
  return cached('bturret|' + t.main, 34, 38, (ctx) => {
    ctx.translate(17, 17)
    ctx.fillStyle = t.dark
    ctx.strokeStyle = t.main
    ctx.lineWidth = 1.2
    ctx.fillRect(-3.5, 2, 7, 16)
    ctx.strokeRect(-3.5, 2, 7, 16)
    const gr = ctx.createRadialGradient(-4, -4, 1, 0, 0, 13)
    gr.addColorStop(0, mix(t.main, '#ffffff', 0.4))
    gr.addColorStop(0.45, t.body)
    gr.addColorStop(1, t.dark)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, 12.5, 0, TAU)
    ctx.fill()
    ctx.save()
    ctx.shadowColor = t.main
    ctx.shadowBlur = 6
    ctx.stroke()
    ctx.restore()
    const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, 6)
    eye.addColorStop(0, '#ffffff')
    eye.addColorStop(0.4, t.accent)
    eye.addColorStop(1, rgba(t.accent, 0))
    ctx.fillStyle = eye
    ctx.beginPath()
    ctx.arc(0, 0, 6, 0, TAU)
    ctx.fill()
  })
}

function orbPart(g: Game, r: number, key: string): Sprite {
  const t = tintOf(g)
  return cached(key + '|' + t.main, r * 2 + 12, r * 2 + 12, (ctx) => {
    const c = r + 6
    ctx.translate(c, c)
    const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r)
    gr.addColorStop(0, '#ffffff')
    gr.addColorStop(0.25, t.accent)
    gr.addColorStop(0.6, t.body)
    gr.addColorStop(1, t.dark)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
    ctx.save()
    ctx.shadowColor = t.main
    ctx.shadowBlur = 8
    ctx.strokeStyle = t.main
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  })
}

const partSprite = (def: ShapeDef, id: string) => (g: Game): Sprite => {
  const t = tintOf(g)
  return shapeSprite('bp-' + id, def, { ...t, main: t.accent, accent: t.main })
}

// ===================== Formas de los jefes =====================

const VIGIA_BODY: ShapeDef = {
  w: 196,
  h: 116,
  layers: [
    { pts: [30, -12, 82, -6, 96, 10, 88, 28, 60, 24, 30, 14], fill: 'body', stroke: true, pair: true },
    { pts: [60, 0, 86, 4, 90, 16, 62, 18], fill: 'dark', stroke: true, pair: true },
    { pts: [22, -44, 28, -58, 34, -40], fill: 'main', pair: true },
    { pts: [0, 52, 18, 42, 34, 18, 38, -18, 24, -46, 0, -54], fill: 'body', stroke: true },
    { pts: [0, 38, 12, 30, 22, 10, 22, -22, 12, -36, 0, -40], fill: 'dark', stroke: true },
    { pts: [0, 18, 9, 10, 9, -4, 0, -10], fill: 'glass' },
  ],
  lights: [26, -28, 2, 48, 12, 1.6, 0, 44, 2.2],
}
const MANTIS_BODY: ShapeDef = {
  w: 190,
  h: 150,
  layers: [
    { pts: [18, -8, 74, -58, 90, -40, 42, 2], fill: 'dark', stroke: true, pair: true },
    { pts: [26, -14, 66, -48, 74, -40, 38, -8], fill: 'main', pair: true },
    { pts: [0, -72, 14, -62, 20, -36, 14, -14, 0, -8], fill: 'body', stroke: true },
    { pts: [22, 4, 52, 10, 58, 22, 30, 18], fill: 'body', stroke: true, pair: true },
    { pts: [0, 50, 10, 42, 22, 18, 24, -6, 14, -16, 0, -14], fill: 'body', stroke: true },
    { pts: [8, 44, 15, 60, 6, 66, 3, 52], fill: 'main', pair: true },
    { pts: [7, 28, 14, 24, 14, 33, 9, 35], fill: 'glass', pair: true },
  ],
  lights: [0, -40, 2.4, 0, 8, 2],
}
const SCYTHE: ShapeDef = {
  w: 30,
  h: 46,
  layers: [
    { pts: [0, -20, 8, -12, 10, 6, 4, 22, 0, 12], fill: 'body', stroke: true },
    { pts: [0, 22, 3, 10, 0, 2], fill: 'light' },
  ],
  lights: [0, -8, 2.4],
}
const HYDRA_BODY: ShapeDef = {
  w: 210,
  h: 130,
  layers: [
    { pts: [30, 0, 46, 10, 58, 30, 48, 38, 34, 18, 22, 10], fill: 'body', stroke: true, pair: true },
    { pts: [0, -52, 32, -48, 62, -32, 74, -4, 52, 20, 20, 28, 0, 26], fill: 'body', stroke: true },
    { pts: [20, -38, 48, -28, 42, -14, 18, -24], fill: 'dark', stroke: true, pair: true },
    { pts: [0, -30, 10, -20, 10, 6, 0, 14], fill: 'dark', stroke: true },
    { pts: [0, 18, 9, 26, 9, 46, 0, 52], fill: 'body', stroke: true },
  ],
  lights: [60, -10, 2, 34, -40, 1.6],
}
const HEAD: ShapeDef = {
  w: 30,
  h: 32,
  layers: [
    { pts: [0, 16, 7, 10, 12, -2, 9, -12, 0, -15], fill: 'body', stroke: true },
    { pts: [3, 12, 6, 18, 2, 18], fill: 'light', pair: true },
    { pts: [4, 0, 8, -2, 7, 3], fill: 'glass', pair: true },
  ],
}
const LEVI_BODY: ShapeDef = {
  w: 180,
  h: 196,
  layers: [
    { pts: [40, -10, 78, 10, 84, 42, 44, 30], fill: 'body', stroke: true, pair: true },
    { pts: [0, 96, 20, 82, 40, 40, 46, -40, 34, -82, 0, -96], fill: 'body', stroke: true },
    { pts: [0, 72, 16, 58, 26, 20, 28, -52, 18, -72, 0, -78], fill: 'dark', stroke: true },
    { pts: [6, -88, 10, -100, 14, -84], fill: 'main', pair: true },
    { pts: [0, 14, 13, 6, 13, -16, 0, -22], fill: 'main' },
    { pts: [0, 6, 7, 2, 7, -10, 0, -14], fill: 'glass' },
  ],
  lights: [20, 60, 1.6, 22, -66, 1.6, 0, 84, 2.4, 70, 30, 1.4],
}
const NEXO_BODY: ShapeDef = {
  w: 236,
  h: 150,
  layers: [
    { pts: [28, -26, 108, -62, 114, -18, 72, 32, 30, 12], fill: 'dark', stroke: true, pair: true },
    { pts: [40, -16, 98, -46, 74, 12], fill: 'main', pair: true },
    { pts: [20, 30, 36, 60, 14, 46], fill: 'body', stroke: true, pair: true },
    { pts: [0, -64, 32, -20, 24, 32, 0, 64], fill: 'body', stroke: true },
    { pts: [0, -42, 17, -12, 13, 22, 0, 42], fill: 'glass' },
  ],
  lights: [104, -30, 2.2, 0, -52, 2],
}
const WING: ShapeDef = {
  w: 40,
  h: 40,
  layers: [
    { pts: [0, -18, 14, -4, 10, 14, 0, 18], fill: 'body', stroke: true },
    { pts: [0, -10, 7, -2, 5, 8, 0, 10], fill: 'glass' },
  ],
}

function heliosBody(g: Game): Sprite {
  const t = tintOf(g)
  return cached('helios|' + t.main, 150, 150, (ctx) => {
    ctx.translate(75, 75)
    for (let i = 0; i < 3; i++) {
      ctx.save()
      ctx.shadowColor = t.main
      ctx.shadowBlur = 10
      ctx.strokeStyle = rgba(t.main, 0.7 - i * 0.18)
      ctx.lineWidth = 3 - i
      ctx.beginPath()
      ctx.arc(0, 0, 44 + i * 12, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
    for (let i = 0; i < 12; i++) {
      ctx.save()
      ctx.rotate((i / 12) * TAU)
      ctx.fillStyle = t.body
      ctx.strokeStyle = t.main
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(34, -5)
      ctx.lineTo(50, 0)
      ctx.lineTo(34, 5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    const gr = ctx.createRadialGradient(-8, -8, 2, 0, 0, 36)
    gr.addColorStop(0, '#fff7ed')
    gr.addColorStop(0.3, t.accent)
    gr.addColorStop(0.7, t.body)
    gr.addColorStop(1, t.dark)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, 34, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = t.main
    ctx.lineWidth = 2
    ctx.stroke()
  })
}

// ===================== Definiciones =====================

export const VIGIA: BossDef = {
  name: 'VIGIA',
  title: 'GUARDIAN DE LA NEBULOSA',
  hp: 1000,
  r: 24,
  coreY: 4,
  enterY: 110,
  sprite: bodyOf('vigia', VIGIA_BODY),
  parts: [
    { ox: -72, oy: 14, r: 14, hp: 110, score: 8000, sprite: turretSprite },
    { ox: 72, oy: 14, r: 14, hp: 110, score: 8000, sprite: turretSprite },
  ],
  phases: [
    {
      until: 0.62,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.5) * 60, 110, dt)
        if (every(g, b, 0, dt, 1.0)) {
          const i = nextN(b) % 2
          const p = b.parts[i]
          if (p?.alive) g.fan(p.x, p.y + 8, g.n(3), 0.4, 120, g.aim(p.x, p.y), bs(MED, ORANGE))
        }
        if (every(g, b, 1, dt, 1.7)) {
          b.spin += 0.13
          g.ring(cx(b), cy(b), g.n(16), 82, b.spin, bs(SMALL, PINK))
        }
      },
    },
    {
      until: 0.28,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.7) * 80, 100, dt)
        if (every(g, b, 0, dt, 0.085)) {
          b.spin += 0.21
          const arms = g.diff.lvl >= 2 ? 3 : 2
          for (let i = 0; i < arms; i++) {
            g.bullet(cx(b), cy(b), b.spin + (i * TAU) / arms, 105, bs(RICE, BLUE))
            g.bullet(cx(b), cy(b), -b.spin + (i * TAU) / arms + 0.3, 90, bs(RICE, VIOLET))
          }
        }
        if (every(g, b, 1, dt, 1.4)) {
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (p?.alive) g.fan(p.x, p.y + 8, g.n(5), 0.7, 140, g.aim(p.x, p.y), bs(MED, ORANGE))
          }
        }
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.9) * 50, 96 + Math.sin(b.t * 1.4) * 14, dt)
        if (every(g, b, 0, dt, 0.55)) {
          b.spin2 = -b.spin2 || 1
          g.ring(cx(b), cy(b), g.n(20), 95, b.t, bs(MED, PINK), { turn: 0.55 * b.spin2 })
        }
        if (every(g, b, 1, dt, 1.25)) {
          const a = g.aim(cx(b), cy(b))
          for (let k = 0; k < 5; k++) g.bullet(cx(b), cy(b), a, 150 + k * 22, bs(KUNAI, YELLOW))
        }
      },
    },
  ],
  overlay: coreGlow(0, 4, 18),
}

export const MANTIS: BossDef = {
  name: 'MANTIS',
  title: 'SEGADORA DE ASTEROIDES',
  hp: 1150,
  r: 22,
  coreY: 22,
  enterY: 120,
  sprite: bodyOf('mantis', MANTIS_BODY),
  parts: [
    { ox: -58, oy: 34, r: 15, hp: 130, score: 9000, sprite: partSprite(SCYTHE, 'scythe') },
    { ox: 58, oy: 34, r: 15, hp: 130, score: 9000, sprite: partSprite(SCYTHE, 'scythe') },
  ],
  phases: [
    {
      until: 0.62,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.6) * 70, 118, dt)
        if (every(g, b, 0, dt, 0.12)) {
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (!p?.alive) continue
            const s = i === 0 ? -1 : 1
            g.bullet(p.x, p.y + 14, Math.PI / 2 + s * (0.35 + Math.sin(b.t * 2) * 0.5), 115, bs(RICE, MAGENTA), { turn: -s * 0.45 })
          }
        }
        if (every(g, b, 1, dt, 2.0)) g.fan(cx(b), cy(b), g.n(3), 0.5, 95, g.aim(cx(b), cy(b)), bs(BIG, ORANGE))
      },
    },
    {
      until: 0.3,
      update(g, b, dt) {
        const side = Math.sin(b.t * 0.35) > 0 ? 1 : -1
        glide(b, W / 2 + side * 70, 110, dt, 1.2)
        if (every(g, b, 0, dt, 0.07)) {
          b.spin += 0.09
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (!p?.alive) continue
            const s = i === 0 ? 1 : -1
            const sweep = Math.sin(b.spin) * 0.9
            g.bullet(p.x, p.y + 12, Math.PI / 2 + s * sweep, 165, bs(KUNAI, PINK))
          }
          if (!partAlive(b, 0) && !partAlive(b, 1) && b.timers[3]-- <= 0) {
            b.timers[3] = 3
            g.bullet(cx(b), cy(b), Math.PI / 2 + Math.sin(b.spin * 1.3) * 1.1, 150, bs(KUNAI, PINK))
          }
        }
        if (every(g, b, 1, dt, 1.4)) g.ring(cx(b), cy(b), g.n(18), 85, b.t, bs(MED, VIOLET))
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        if (every(g, b, 2, dt, 2.2)) {
          b.tx = clamp(g.nearest(cx(b), cy(b)).x, 70, W - 70)
          b.ty = rand(90, 140)
        }
        glide(b, b.tx || W / 2, b.ty || 110, dt, 2.5)
        if (every(g, b, 0, dt, 0.5)) {
          const a = g.aim(cx(b), cy(b))
          g.fan(cx(b), cy(b), g.n(3), 0.22, 175, a, bs(MED, RED))
          g.fan(cx(b), cy(b), g.n(3), 0.22, 140, a, bs(MED, RED))
        }
        if (every(g, b, 1, dt, 0.05)) g.bullet(cx(b), cy(b), rand(0.2, Math.PI - 0.2), rand(70, 120), bs(SMALL, YELLOW))
      },
    },
  ],
  overlay: coreGlow(0, 22, 14),
}

export const HIDRA: BossDef = {
  name: 'HIDRA',
  title: 'BESTIA DE TRES CABEZAS',
  hp: 1300,
  r: 16,
  coreY: 54,
  enterY: 96,
  sprite: bodyOf('hidra', HYDRA_BODY),
  parts: [
    { ox: -54, oy: 44, r: 14, hp: 160, score: 10000, sprite: partSprite(HEAD, 'head') },
    { ox: 54, oy: 44, r: 14, hp: 160, score: 10000, sprite: partSprite(HEAD, 'head') },
  ],
  phases: [
    {
      until: 0.62,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.45) * 50, 96, dt)
        if (every(g, b, 0, dt, 0.13)) {
          b.spin += 0.27
          const p0 = b.parts[0]
          const p1 = b.parts[1]
          if (p0?.alive) for (let i = 0; i < 2; i++) g.bullet(p0.x, p0.y + 10, b.spin + i * Math.PI, 100, bs(SMALL, GREEN))
          if (p1?.alive) for (let i = 0; i < 2; i++) g.bullet(p1.x, p1.y + 10, -b.spin + i * Math.PI, 100, bs(SMALL, VIOLET))
        }
        if (every(g, b, 1, dt, 1.5)) g.fan(cx(b), cy(b), g.n(7), 1.0, 125, g.aim(cx(b), cy(b)), bs(RICE, ORANGE))
      },
    },
    {
      until: 0.3,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.6) * 70, 100, dt)
        if (every(g, b, 0, dt, 2.0)) {
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (p?.alive) g.bullet(p.x, p.y + 10, g.aim(p.x, p.y) + (i ? 0.25 : -0.25), 80, bs(BIG, GREEN), { split: 1.2, splitN: g.n(14), splitSpr: bs(SMALL, GREEN), splitV: 80 })
          }
        }
        if (every(g, b, 1, dt, 0.08)) {
          b.spin += 0.16
          g.bullet(cx(b), cy(b), Math.PI / 2 + Math.sin(b.spin) * 1.2, 120, bs(RICE, YELLOW))
          g.bullet(cx(b), cy(b), Math.PI / 2 - Math.sin(b.spin) * 1.2, 120, bs(RICE, ORANGE))
        }
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.8) * 60, 92, dt)
        if (every(g, b, 0, dt, 1.6)) g.bullet(cx(b), cy(b), g.aim(cx(b), cy(b)), 70, bs(BIG, RED), { split: 0.9, splitN: g.n(18), splitSpr: bs(MED, RED), splitV: 95 })
        if (every(g, b, 1, dt, 0.1)) {
          b.spin += 0.37
          const n = g.diff.lvl >= 3 ? 5 : 4
          for (let i = 0; i < n; i++) g.bullet(cx(b), cy(b), b.spin + (i * TAU) / n, 85, bs(SMALL, MAGENTA), { acc: 40, maxV: 160 })
        }
      },
    },
  ],
  overlay: coreGlow(0, 54, 12),
}

export const LEVIATAN: BossDef = {
  name: 'LEVIATAN',
  title: 'ACORAZADO ESPECTRAL',
  hp: 1500,
  r: 18,
  coreY: -4,
  enterY: 122,
  sprite: bodyOf('levi', LEVI_BODY),
  parts: [
    { ox: -30, oy: -52, r: 12, hp: 100, score: 7000, sprite: turretSprite },
    { ox: 30, oy: -52, r: 12, hp: 100, score: 7000, sprite: turretSprite },
    { ox: -64, oy: 30, r: 12, hp: 100, score: 7000, sprite: turretSprite },
    { ox: 64, oy: 30, r: 12, hp: 100, score: 7000, sprite: turretSprite },
  ],
  phases: [
    {
      until: 0.65,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.35) * 40, 110, dt)
        if (every(g, b, 0, dt, 0.32)) {
          const p = b.parts[nextN(b) % 4]
          if (p?.alive) g.bullet(p.x, p.y + 6, g.aim(p.x, p.y), 150, bs(MED, ORANGE))
        }
        if (every(g, b, 1, dt, 2.3)) {
          // andanada horizontal con hueco
          const gap = clamp(g.nearest(cx(b), cy(b)).x + rand(-50, 50), 40, W - 40)
          const n = g.n(16)
          for (let r = 0; r < 2; r++)
            for (let i = 0; i < n; i++) {
              const x = (i + 0.5) * (W / n)
              if (Math.abs(x - gap) < 34) continue
              g.bullet(x, -6 - r * 18, Math.PI / 2, 95, bs(RICE, YELLOW))
            }
        }
      },
    },
    {
      until: 0.32,
      update(g, b, dt) {
        glide(b, W / 2, 100, dt)
        if (every(g, b, 0, dt, 3.0)) {
          const xs = [rand(40, 120), rand(140, 220), rand(240, 320)]
          for (const x of xs) g.beam(x, 0, Math.PI / 2, 22, 1.0, 0.8, RED)
        }
        if (every(g, b, 1, dt, 1.2)) g.ring(cx(b), cy(b), g.n(18), 80, b.t, bs(SMALL, PINK))
        if (every(g, b, 2, dt, 0.6)) {
          for (let i = 0; i < 4; i++) {
            const p = b.parts[i]
            if (p?.alive && nextN(b) % 2 === i % 2) g.fan(p.x, p.y, 3, 0.3, 140, g.aim(p.x, p.y), bs(KUNAI, YELLOW))
          }
        }
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.5) * 30, 104, dt)
        if (every(g, b, 0, dt, 4.2)) {
          const dir = Math.random() < 0.5 ? 1 : -1
          g.beam(cx(b), cy(b), Math.PI / 2 - dir * 0.9, 18, 0.9, 2.4, MAGENTA, b.core, dir * 0.75)
        }
        if (every(g, b, 1, dt, 0.9)) {
          b.spin += 0.3
          g.ring(cx(b), cy(b), g.n(14), 95, b.spin, bs(RING, VIOLET))
        }
        if (every(g, b, 2, dt, 1.7)) g.fan(cx(b), cy(b), g.n(5), 0.6, 160, g.aim(cx(b), cy(b)), bs(KUNAI, RED))
      },
    },
  ],
  overlay: coreGlow(0, -4, 14),
}

export const HELIOS: BossDef = {
  name: 'HELIOS',
  title: 'CORAZON DE LA TORMENTA',
  hp: 1600,
  r: 30,
  coreY: 0,
  enterY: 130,
  sprite: heliosBody,
  parts: Array.from({ length: 6 }, (_, i) => ({
    ox: Math.cos((i / 6) * TAU) * 70,
    oy: Math.sin((i / 6) * TAU) * 70,
    r: 11,
    hp: 70,
    score: 6000,
    sprite: (g: Game) => orbPart(g, 10, 'pod'),
  })),
  phases: [
    {
      until: 0.62,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.4) * 50, 130, dt)
        b.spin2 += dt * 0.6
        if (every(g, b, 0, dt, 0.42)) {
          for (const p of b.parts) {
            if (!p.alive) continue
            const a = Math.atan2(p.y - b.y, p.x - b.x)
            g.bullet(p.x, p.y, a, 95, bs(MED, YELLOW))
          }
        }
        if (every(g, b, 1, dt, 2.0)) g.ring(cx(b), cy(b), g.n(24), 40, b.t, bs(SMALL, ORANGE), { acc: 70, maxV: 170 })
      },
    },
    {
      until: 0.3,
      update(g, b, dt) {
        glide(b, W / 2, 120, dt)
        b.spin2 -= dt * 0.9
        if (every(g, b, 0, dt, 1.6)) {
          // llamaradas: rayos curvos de velocidad creciente
          const n = g.n(8)
          const off = Math.random() * TAU
          const dir = nextN(b) % 2 ? 1 : -1
          for (let i = 0; i < n; i++)
            for (let k = 0; k < 5; k++) g.bullet(cx(b), cy(b), off + (i * TAU) / n, 70 + k * 18, bs(RICE, RED), { turn: dir * 0.35 })
        }
        if (every(g, b, 1, dt, 0.9)) {
          for (const p of b.parts) if (p.alive && Math.random() < 0.5) g.bullet(p.x, p.y, g.aim(p.x, p.y), 130, bs(SMALL, YELLOW))
        }
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t) * 30, 120 + Math.sin(b.t * 0.7) * 20, dt)
        b.spin2 += dt * 1.4
        if (every(g, b, 0, dt, 0.09)) {
          b.spin += 0.19 + Math.sin(b.t * 0.5) * 0.08
          const n = g.diff.lvl >= 4 ? 6 : 5
          for (let i = 0; i < n; i++) g.bullet(cx(b), cy(b), b.spin + (i * TAU) / n, 95, bs(SMALL, ORANGE))
        }
        if (every(g, b, 1, dt, 1.8)) g.ring(cx(b), cy(b), g.n(20), 30, -b.spin, bs(MED, RED), { acc: 90, maxV: 190 })
      },
    },
  ],
  overlay(ctx, g, b) {
    coreGlow(0, 0, 30)(ctx, g, b)
  },
}

export const NEXO: BossDef = {
  name: 'NEXO',
  title: 'EMPERATRIZ DEL VACIO',
  hp: 2000,
  r: 20,
  coreY: 0,
  enterY: 112,
  sprite: bodyOf('nexo', NEXO_BODY),
  parts: [
    { ox: -84, oy: -16, r: 17, hp: 170, score: 12000, sprite: partSprite(WING, 'wing') },
    { ox: 84, oy: -16, r: 17, hp: 170, score: 12000, sprite: partSprite(WING, 'wing') },
    { ox: -30, oy: 48, r: 10, hp: 100, score: 8000, sprite: (g) => orbPart(g, 9, 'eye') },
    { ox: 30, oy: 48, r: 10, hp: 100, score: 8000, sprite: (g) => orbPart(g, 9, 'eye') },
  ],
  phases: [
    {
      until: 0.75,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.5) * 50, 112, dt)
        if (every(g, b, 0, dt, 1.1)) {
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (p?.alive) g.fan(p.x, p.y, g.n(5), 0.7, 130, g.aim(p.x, p.y), bs(RICE, MAGENTA))
          }
        }
        if (every(g, b, 1, dt, 0.7)) {
          b.spin += 0.2
          g.ring(cx(b), cy(b), g.n(12), 90, b.spin, bs(MED, VIOLET), { turn: 0.4 })
          g.ring(cx(b), cy(b), g.n(12), 90, -b.spin, bs(MED, PINK), { turn: -0.4 })
        }
      },
    },
    {
      until: 0.5,
      update(g, b, dt) {
        glide(b, W / 2, 104, dt)
        if (every(g, b, 0, dt, 3.6)) {
          for (let i = 0; i < 2; i++) {
            const p = b.parts[i]
            if (p?.alive) g.beam(p.x, p.y, Math.PI / 2 + (i ? 0.7 : -0.7), 16, 0.8, 2.2, VIOLET, p, i ? -0.6 : 0.6)
          }
          if (!partAlive(b, 0) && !partAlive(b, 1)) g.beam(cx(b), cy(b), Math.PI / 2 - 0.8, 16, 0.8, 2.2, VIOLET, b.core, 0.75)
        }
        if (every(g, b, 1, dt, 0.1)) {
          b.spin += 0.31
          for (let i = 0; i < 3; i++) g.bullet(cx(b), cy(b), b.spin + (i * TAU) / 3, 100, bs(SMALL, MAGENTA))
        }
        if (every(g, b, 2, dt, 1.3)) {
          for (let i = 2; i < 4; i++) {
            const p = b.parts[i]
            if (p?.alive) g.bullet(p.x, p.y, g.aim(p.x, p.y), 160, bs(KUNAI, YELLOW))
          }
        }
      },
    },
    {
      until: 0.25,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.7) * 70, 100, dt)
        if (every(g, b, 0, dt, 1.4)) {
          const a = g.aim(cx(b), cy(b))
          for (const s of [-0.5, 0, 0.5]) g.bullet(cx(b), cy(b), a + s, 75, bs(BIG, VIOLET), { split: 1.0, splitN: g.n(12), splitSpr: bs(RICE, PINK), splitV: 100 })
        }
        if (every(g, b, 1, dt, 2.4)) {
          const gap = clamp(g.nearest(cx(b), cy(b)).x + rand(-60, 60), 40, W - 40)
          const n = g.n(18)
          for (let i = 0; i < n; i++) {
            const x = (i + 0.5) * (W / n)
            if (Math.abs(x - gap) < 32) continue
            g.bullet(x, -8, Math.PI / 2, 105, bs(KUNAI, RED), { delay: (i % 3) * 0.08 })
          }
        }
      },
    },
    {
      until: 0,
      update(g, b, dt) {
        glide(b, W / 2 + Math.sin(b.t * 0.4) * 40, 118, dt)
        if (every(g, b, 0, dt, 0.075)) {
          b.spin += 0.13
          b.spin2 -= 0.17
          g.bullet(cx(b), cy(b), b.spin, 110, bs(RICE, MAGENTA), { turn: 0.3 })
          g.bullet(cx(b), cy(b), b.spin + Math.PI, 110, bs(RICE, MAGENTA), { turn: 0.3 })
          g.bullet(cx(b), cy(b), b.spin2, 95, bs(RICE, BLUE), { turn: -0.3 })
          g.bullet(cx(b), cy(b), b.spin2 + Math.PI, 95, bs(RICE, BLUE), { turn: -0.3 })
        }
        if (every(g, b, 1, dt, 1.6)) g.fan(cx(b), cy(b), g.n(5), 0.35, 150, g.aim(cx(b), cy(b)), bs(MED, YELLOW))
      },
    },
  ],
  overlay: coreGlow(0, 0, 20),
}

/** Brillo pulsante del núcleo (se dibuja con 'lighter'). */
function coreGlow(ox: number, oy: number, r: number) {
  return (ctx: CanvasRenderingContext2D, g: Game, b: Boss) => {
    const t = tintOf(g)
    const pulse = 0.65 + Math.sin(b.t * 6) * 0.25 + (b.core.flash > 0 ? 0.4 : 0)
    const rr = r * (1.6 + Math.sin(b.t * 3) * 0.15)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = clamp(pulse, 0, 1)
    const s = coreSprite(t.accent)
    ctx.drawImage(s.c, b.x + ox - rr, b.y + oy - rr, rr * 2, rr * 2)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}
function coreSprite(col: string): Sprite {
  return cached('coreglow|' + col, 48, 48, (ctx) => {
    const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.2, col)
    g.addColorStop(0.55, rgba(col, 0.25))
    g.addColorStop(1, rgba(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 48, 48)
  })
}

// ===================== Ciclo de vida =====================

const coreDef: EnemyDef = { ...bossPiece, id: 'bosscore', size: 2 }


export function spawnBoss(g: Game, def: BossDef, mid: boolean): Boss {
  const hpMul = (1 + g.diff.lvl * 0.45) * g.hpK()
  const core = g.spawn(coreDef, W / 2, -120, { armor: 0 }) as Enemy
  core.maxHp = core.hp = def.hp * hpMul
  core.r = def.r
  core.seen = true
  const b: Boss = {
    def,
    x: W / 2,
    y: -140,
    t: 0,
    phase: 0,
    phaseT: 0,
    core,
    parts: [],
    timers: [1.5, 2, 2.5, 3, 3.5, 4],
    state: 'enter',
    stateT: 0,
    tx: W / 2,
    ty: def.enterY,
    spin: 0,
    spin2: 0,
    mid,
    hpShown: 0,
    deathT: 0,
    count: 0,
  }
  core.boss = b
  core.partIndex = -1
  for (let i = 0; i < def.parts.length; i++) {
    const pd = def.parts[i]
    const pdef: EnemyDef = { ...bossPiece, id: 'bosspart', r: pd.r, size: 1, sprite: (gg) => pd.sprite(gg, b) }
    const e = g.spawn(pdef, b.x + pd.ox, b.y + pd.oy, { armor: 0 }) as Enemy
    if (!e) continue
    e.maxHp = e.hp = pd.hp * hpMul
    e.r = pd.r
    e.boss = b
    e.partIndex = i
    e.seen = true
    e.score = pd.score
    b.parts.push(e)
  }
  g.showBanner(def.name, def.title, 3.2)
  g.juice.shake(0.5)
  return b
}

export function bossUpdate(g: Game, b: Boss, dt: number) {
  b.t += dt
  b.stateT += dt
  const def = b.def
  // posiciona piezas y núcleo
  const helios = def === HELIOS
  for (let i = 0; i < b.parts.length; i++) {
    const p = b.parts[i]
    if (!p.alive) continue
    const pd = def.parts[i]
    if (helios) {
      const a = (i / 6) * TAU + b.spin2
      p.x = b.x + Math.cos(a) * 70
      p.y = b.y + Math.sin(a) * 70
    } else {
      p.x = b.x + pd.ox
      p.y = b.y + pd.oy
    }
  }
  b.core.x = cx(b)
  b.core.y = cy(b)
  const frac = b.core.hp / b.core.maxHp
  b.hpShown += (frac - b.hpShown) * Math.min(1, dt * (b.state === 'enter' ? 1.2 : 6))

  if (b.state === 'enter') {
    const k = Math.min(1, b.stateT / 3)
    b.y = -140 + (def.enterY + 140) * easeOut(k)
    b.x = W / 2
    if (b.stateT > 0.5 && Math.random() < 0.3) g.juice.shake(0.06)
    if (k >= 1) {
      b.state = 'fight'
      b.stateT = 0
      b.core.armor = 1
      for (const p of b.parts) p.armor = 1
    }
    return
  }
  if (b.state === 'dying') {
    updateDeath(g, b, dt)
    return
  }
  if (b.state === 'trans') {
    b.core.armor = 0
    glide(b, W / 2, def.enterY, dt)
    if (Math.random() < 0.25) g.explode(b.x + rand(-60, 60), b.y + rand(-40, 40), 0, tintOf(g).main)
    if (b.stateT > 1.5) {
      b.state = 'fight'
      b.stateT = 0
      b.core.armor = 1
      b.timers = [0.8, 1.2, 1.6, 2, 2.4, 2.8]
    }
    return
  }
  // pelea: el núcleo resiste más mientras haya piezas vivas
  const anyPart = b.parts.some((p) => p.alive)
  b.core.armor = anyPart ? 0.6 : 1
  const ph = def.phases[b.phase]
  ph.update(g, b, dt)
  b.phaseT += dt
  if (ph.until > 0 && frac <= ph.until) {
    b.phase++
    b.phaseT = 0
    b.state = 'trans'
    b.stateT = 0
    g.cancelBullets(true)
    g.beams.length = 0
    g.juice.shake(0.55)
    g.juice.flash('#ffffff', 0.35)
    g.juice.freeze(90)
    g.shock(cx(b), cy(b), '#ffffff', 10, 380, 0.6, 4)
    fx.phase()
  }
}

/** Llamado desde Game.kill cuando muere el núcleo o una pieza. */
export function bossPartDestroyed(g: Game, e: Enemy) {
  const b = e.boss
  if (!b) return
  if (e === b.core) {
    b.state = 'dying'
    b.stateT = 0
    b.deathT = 0
    for (const p of b.parts) if (p.alive) p.alive = false
    g.cancelBullets(true)
    g.beams.length = 0
    g.juice.freeze(220)
    g.juice.flash('#ffffff', 0.7)
    g.juice.shake(0.8)
    g.slowT = 1.6
    g.slowK = 0.3
    g.chainT = Math.max(g.chainT, 4)
    g.setMode('bossdeath')
    for (const s of g.ships) s.inv = Math.max(s.inv, 6)
    fx.bigBoom()
    return
  }
  // pieza destruida
  const pts = e.score * g.mult * (1 + g.loop * 0.5)
  g.addScore(pts)
  g.juice.text(e.x, e.y - 10, `${Math.round(pts)}`, '#fde047', 11, 1)
  g.dropItems('M3', e.x, e.y)
  g.explode(e.x, e.y, 2, tintOf(g).main)
  g.juice.freeze(70)
  fx.bigBoom()
}

function updateDeath(g: Game, b: Boss, dt: number) {
  b.deathT += dt
  const def = b.def
  const col = tintOf(g).main
  b.x += Math.sin(b.deathT * 40) * 0.6
  if (Math.floor(b.deathT / 0.07) !== Math.floor((b.deathT - dt) / 0.07) && b.deathT < 2.4) {
    const ex = b.x + rand(-def.r * 3, def.r * 3)
    const ey = b.y + rand(-50, 50)
    g.explode(ex, ey, Math.random() < 0.3 ? 1 : 0, Math.random() < 0.5 ? col : '#fb923c')
    g.juice.shake(0.12)
  }
  if (b.deathT >= 2.4 && b.state === 'dying' && b.stateT < 100) {
    b.stateT = 100
    // explosión final
    const x = cx(b)
    const y = b.y
    for (let i = 0; i < 4; i++) g.explode(x + rand(-40, 40), y + rand(-30, 30), 2, i % 2 ? col : '#fde047')
    g.shock(x, y, '#ffffff', 20, 900, 1.0, 10)
    g.shock(x, y, col, 10, 600, 1.3, 7)
    g.shock(x, y, '#fde047', 10, 420, 1.5, 4)
    for (let i = 0; i < 12; i++) g.puff(x + rand(-80, 80), y + rand(-60, 60), i % 2 ? '#ffffff' : col, 80, 1.2, rand(-60, 60), rand(-60, 60), 0.6)
    g.debris(x, y, col, 40, 340)
    g.sparks(x, y, '#ffffff', 40, 420, 1)
    g.juice.flash('#ffffff', 1)
    g.juice.shake(1)
    g.juice.freeze(160)
    g.slowT = 1.2
    g.slowK = 0.45
    fx.bossDeath()
    for (let i = 0; i < 6; i++) g.item('M', x + rand(-60, 60), y + rand(-30, 30))
    g.item('P', x, y)
    g.bossDefeated(b)
  }
}

