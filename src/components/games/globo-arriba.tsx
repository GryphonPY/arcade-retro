'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, sfx, tone } from './sfx'
import {
  BALLOON_COLORS,
  HIT,
  PLAYER_HIT,
  ZONES,
  drawBalloonPickup,
  drawBird,
  drawDecoCloud,
  drawGround,
  drawMeteor,
  drawPlane,
  drawPlayer,
  drawSky,
  drawStar,
  drawStorm,
  nightness,
  popColors,
} from './globo-arriba/art'

const GAME_ID = 'globo-arriba'
const ACCENT = '#4dc3ff'

const W0 = 360
const H0 = 560
// Mundo lógico: se ajusta a la pantalla (ver layout). La canasta siempre queda a la misma altura relativa.
let W = W0
let H = H0
let BASKET_Y = H0 * 0.72

/** Ajusta el mundo lógico al área de la pantalla; la canasta queda al 72% de la altura. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  BASKET_Y = H * 0.72
  publishLogical(f)
}

// Movimiento
const EDGE = 24 // margen lateral de la canasta
const MOVE_MAX = 420 // px/s máximos siguiendo el dedo o el mouse
const KEY_SPEED = 300 // px/s con las flechas
const CLIMB_MIN = 70 // px/s al empezar
const CLIMB_MAX = 170 // px/s al final de la rampa
const CLIMB_RAMP_PX = 6000 // distancia (px) para llegar a la velocidad máxima
const PX_PER_M = 10

// Juego
const INVULN = 1.5 // s de invulnerabilidad tras perder un globo
const SPAWN_Y = -60 // los obstáculos aparecen justo por encima de la pantalla
const STAR_BONUS = 5 // metros que vale cada estrella
/** Posiciones de cada globo respecto a la canasta (mismas que dibuja `drawPlayer`). */
const SPOTS = [
  { dx: -16, dy: -70 },
  { dx: 16, dy: -72 },
  { dx: 0, dy: -88 },
]
const ZONE_NAMES = ['Cielo', 'Atardecer', 'Noche', 'Espacio']
const ZONE_BANNERS = ['', '¡ATARDECER!', '¡NOCHE ESTRELLADA!', '¡EL ESPACIO!']
const ZONE_COLORS = ['#ffffff', '#fb923c', '#a5b4fc', '#c084fc']

type Phase = 'menu' | 'playing' | 'dying' | 'over'
type ObsKind = 'bird' | 'storm' | 'plane' | 'meteor'

interface Obs {
  kind: ObsKind
  x: number
  y: number
  vx: number
  /** Caída extra (solo meteoritos), además de la velocidad de subida. */
  ex: number
  dir: number
  /** Radio del meteorito. */
  r: number
  /** Ancho de la tormenta. */
  w: number
  ph: number
  seed: number
}
interface Pick {
  kind: 'star' | 'balloon'
  x: number
  y: number
  color: string
  ph: number
}
interface Cloud {
  x: number
  y: number
  s: number
  v: number
}
interface Circ {
  x: number
  y: number
  r: number
}
interface Game {
  phase: Phase
  paused: boolean
  t: number
  /** Px recorridos hacia arriba (el mundo baja en pantalla). */
  scroll: number
  /** Puntos extra de las estrellas (en metros). */
  bonus: number
  /** Altura actual en metros: es la puntuación. */
  alt: number
  stars: number
  zone: number
  x: number
  tx: number
  py: number
  tilt: number
  ang: number
  balloons: number
  invuln: number
  vyFall: number
  deadT: number
  overT: number
  obs: Obs[]
  pick: Pick[]
  obsT: number
  starT: number
  balloonT: number
  banner: { text: string; color: string; t: number } | null
}
interface Result {
  alt: number
  newBest: boolean
  stars: number
  zone: number
}

// ---------- utilidades ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
/** Intervalo con variación de ±40%. */
const jitter = (base: number) => base * rnd(0.6, 1.4)

/** ¿Se tocan dos círculos? */
const overlaps = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) => {
  const dx = ax - bx
  const dy = ay - by
  const rr = ar + br
  return dx * dx + dy * dy < rr * rr
}
/** ¿Toca un círculo a un rectángulo? */
const circleRect = (cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) => {
  const nx = clamp(cx, rx, rx + rw)
  const ny = clamp(cy, ry, ry + rh)
  return overlaps(cx, cy, r, nx, ny, 0)
}

const climbOf = (scroll: number) => lerp(CLIMB_MIN, CLIMB_MAX, Math.min(1, scroll / CLIMB_RAMP_PX))
const zoneOf = (alt: number) => (alt >= ZONES.space ? 3 : alt >= ZONES.night ? 2 : alt >= ZONES.sunset ? 1 : 0)
/** Los pájaros aletean con un pequeño vaivén vertical. */
const obsY = (o: Obs, t: number) => (o.kind === 'bird' ? o.y + Math.sin(t * 2.5 + o.ph) * 8 : o.y)

// ---------- sonidos locales ----------
const sPop = () => {
  noise({ dur: 0.18, vol: 0.1, freq: 2200 })
  tone({ freq: 1400, to: 500, dur: 0.15, type: 'square', vol: 0.04 })
}
const sStar = () => {
  tone({ freq: 1319, dur: 0.08, type: 'square', vol: 0.035 })
  tone({ freq: 1760, dur: 0.14, type: 'square', vol: 0.035, delay: 0.07 })
}
const sBalloon = () => {
  ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.07, type: 'triangle' }))
}
const sChime = () => {
  tone({ freq: 880, dur: 0.12, type: 'triangle', vol: 0.05 })
  tone({ freq: 1320, dur: 0.25, type: 'triangle', vol: 0.05, delay: 0.12 })
}
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })

function newGame(): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    scroll: 0,
    bonus: 0,
    alt: 0,
    stars: 0,
    zone: 0,
    x: W / 2,
    tx: W / 2,
    py: BASKET_Y,
    tilt: 0,
    ang: 0,
    balloons: 3,
    invuln: 0,
    vyFall: 0,
    deadT: 0,
    overT: 0,
    obs: [],
    pick: [],
    obsT: 1.2,
    starT: jitter(2.5),
    balloonT: jitter(18),
    banner: null,
  }
}

export default function GloboArriba() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ alt: 0, newBest: false, stars: 0, zone: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let pointerTap = false
    let shownAlt = 0

    // Las nubes decorativas se regeneran al reacomodar (ver relayoutLive).
    const makeClouds = (): Cloud[] =>
      Array.from({ length: 7 }, () => ({
        x: rnd(0, W),
        y: rnd(0, H),
        s: rnd(0.8, 1.5),
        v: rnd(4, 10),
      }))
    let clouds = makeClouds()

    // ---------- lógica ----------
    const setTarget = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      if (r.width <= 0) return
      g.tx = clamp(((e.clientX - r.left) / r.width) * W, EDGE, W - EDGE)
    }

    /** Canasta: sigue el dedo/mouse; las flechas la mueven a velocidad fija. */
    const moveBasket = (dt: number) => {
      if (dt <= 0) return
      const pressed = pressedRef.current
      const k = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0)
      const prev = g.x
      if (k !== 0) {
        g.x += k * KEY_SPEED * dt
        g.tx = g.x
      } else {
        const step = (g.tx - g.x) * Math.min(1, dt * 10)
        g.x += clamp(step, -MOVE_MAX * dt, MOVE_MAX * dt)
      }
      g.x = clamp(g.x, EDGE, W - EDGE)
      g.tx = clamp(g.tx, EDGE, W - EDGE)
      const v = (g.x - prev) / dt
      g.tilt += (clamp(v / MOVE_MAX, -1, 1) - g.tilt) * Math.min(1, dt * 8)
    }

    /** Círculos de la canasta: el gatito y, si quedan, los globos. */
    const playerCircles = (): Circ[] => {
      const out: Circ[] = [{ x: g.x + PLAYER_HIT.basket.dx, y: g.py + PLAYER_HIT.basket.dy, r: PLAYER_HIT.basket.r }]
      if (g.balloons > 0) {
        out.push({ x: g.x + PLAYER_HIT.balloons.dx, y: g.py + PLAYER_HIT.balloons.dy, r: PLAYER_HIT.balloons.r })
      }
      return out
    }

    const obsHits = (o: Obs, c: Circ) => {
      const oy = obsY(o, g.t)
      if (o.kind === 'storm') {
        // aproximación: círculo contra elipse (w/2 × stormHH) agrandada por el radio del círculo
        const dx = (c.x - o.x) / (o.w / 2 + c.r)
        const dy = (c.y - oy) / (HIT.stormHH + c.r)
        return dx * dx + dy * dy < 1
      }
      if (o.kind === 'plane') {
        return circleRect(c.x, c.y, c.r, o.x - HIT.plane.hw, oy - HIT.plane.hh, HIT.plane.hw * 2, HIT.plane.hh * 2)
      }
      if (o.kind === 'meteor') return overlaps(o.x, oy, o.r * HIT.meteor, c.x, c.y, c.r)
      return overlaps(o.x, oy, HIT.bird, c.x, c.y, c.r)
    }

    const startGame = () => {
      Object.assign(g, newGame())
      g.phase = 'playing'
      juice.reset()
      pointerTap = false
      setScore(0)
      setUi('playing')
      sfx.start()
    }
    startRef.current = startGame

    /** Hueco horizontal para una tormenta nueva; null si no cabe sin dejar la fila cerrada. */
    const stormSlot = (w: number): number | null => {
      const band = g.obs.filter((o) => o.kind === 'storm' && Math.abs(o.y - SPAWN_Y) < 120)
      const used = band.reduce((s, o) => s + o.w, 0)
      if (W - (used + w) < 110) return null
      for (let k = 0; k < 10; k++) {
        const x = rnd(w / 2 + 6, W - w / 2 - 6)
        if (band.every((o) => Math.abs(x - o.x) > (w + o.w) / 2 + 40)) return x
      }
      return null
    }

    const spawnObstacle = () => {
      const zone = zoneOf(g.alt)
      const r = Math.random()
      let kind: ObsKind
      if (zone === 0) kind = r < 0.35 ? 'bird' : 'storm'
      else if (zone === 1) kind = r < 0.25 ? 'bird' : r < 0.7 ? 'storm' : 'plane'
      else if (zone === 2) kind = r < 0.08 ? 'bird' : r < 0.5 ? 'meteor' : r < 0.85 ? 'storm' : 'plane'
      else kind = r < 0.05 ? 'bird' : r < 0.65 ? 'meteor' : 'storm'

      if (kind === 'storm') {
        const w = rnd(100, 150)
        const x = stormSlot(w)
        if (x !== null) {
          g.obs.push({ kind: 'storm', x, y: SPAWN_Y, vx: 0, ex: 0, dir: 1, r: 0, w, ph: 0, seed: Math.random() * 100 })
          return
        }
        // no cabe otra tormenta en esa fila: se cambia por otro obstáculo
        kind = zone >= 2 ? 'meteor' : 'bird'
      }
      if (kind === 'meteor') {
        const rad = rnd(12, 22)
        g.obs.push({
          kind,
          x: rnd(rad, W - rad),
          y: SPAWN_Y,
          vx: rnd(-30, 30),
          ex: rnd(60, 140),
          dir: 1,
          r: rad,
          w: 0,
          ph: 0,
          seed: 0,
        })
        return
      }
      // pájaros y avionetas cruzan la pantalla de lado a lado
      const dir = Math.random() < 0.5 ? 1 : -1
      const fast = kind === 'plane'
      g.obs.push({
        kind,
        x: dir > 0 ? (fast ? -50 : -20) : W + (fast ? 50 : 20),
        y: SPAWN_Y,
        vx: dir * (fast ? rnd(140, 200) : rnd(60, 120)),
        ex: 0,
        dir,
        r: 0,
        w: 0,
        ph: Math.random() * Math.PI * 2,
        seed: 0,
      })
    }

    /** Un globo se revienta. Devuelve true si era el último (se acaba la partida). */
    const popBalloon = (): boolean => {
      const i = g.balloons - 1
      const s = SPOTS[i]
      juice.burst(g.x + s.dx, g.py + s.dy, popColors(i), { count: 14, speed: 150, life: 0.6, size: 4, gravity: 400 })
      g.balloons--
      sPop()
      if (g.balloons <= 0) {
        die()
        return true
      }
      g.invuln = INVULN
      juice.shake(0.5)
      juice.freeze(80)
      juice.flash('#ffffff', 0.3)
      return false
    }

    const die = () => {
      g.phase = 'dying'
      g.deadT = 0
      g.vyFall = 0
      g.invuln = 0
      juice.flash('#ffffff', 0.9)
      juice.shake(0.9)
      juice.freeze(80)
      juice.burst(g.x, g.py, ['#fbbf24', '#ffffff', '#ff9f43'], { count: 16, speed: 170, life: 0.6, size: 4, gravity: 500 })
      sfx.hurt()
      const nb = saveBest(GAME_ID, g.alt)
      setBest(Math.max(loadBest(GAME_ID), g.alt))
      setResult({ alt: g.alt, newBest: nb, stars: g.stars, zone: g.zone })
    }

    /** Recalcula la altura y avisa al cruzar una zona del cielo. */
    const syncAlt = () => {
      g.alt = Math.floor(g.scroll / PX_PER_M) + g.bonus
      const z = zoneOf(g.alt)
      if (z > g.zone) {
        g.zone = z
        g.banner = { text: ZONE_BANNERS[z], color: ZONE_COLORS[z], t: 2 }
        sChime()
        juice.flash(ZONE_COLORS[z], 0.25)
        juice.shake(0.2)
      }
    }

    const collectPick = (p: Pick) => {
      if (p.kind === 'star') {
        g.stars++
        g.bonus += STAR_BONUS
        sStar()
        juice.text(p.x, p.y - 22, `+${STAR_BONUS}`, '#fde047', 14, 0.8)
        juice.burst(p.x, p.y, ['#fde047', '#fff3a6', '#ffffff'], { count: 14, speed: 140, life: 0.5, size: 3 })
      } else {
        if (g.balloons < 3) g.balloons++
        sBalloon()
        juice.text(p.x, p.y - 24, '+1 globo', p.color, 12, 0.9)
        juice.burst(p.x, p.y, [p.color, '#ffffff'], { count: 14, speed: 130, life: 0.5, size: 4 })
      }
    }

    const togglePause = () => {
      if (g.phase !== 'playing') return
      g.paused = !g.paused
      sPause()
    }

    const onBlur = () => {
      if (g.phase === 'playing') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      pointerTap = true
      setTarget(e)
    }
    const onMove = (e: PointerEvent) => setTarget(e)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const wantAct = jp.has('action') || pointerTap
      const wantPause = jp.has('pause')
      pointerTap = false
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (g.phase === 'playing' && wantPause) togglePause()
      if (g.paused) {
        if (wantAct) {
          g.paused = false
          sPause()
        }
        return
      }

      // nubes: bajan con parallax (0.6 de la subida) y derivan despacio
      const cloudDrop = g.phase === 'playing' ? climbOf(g.scroll) * 0.6 : 0
      for (const c of clouds) {
        c.y += cloudDrop * rawDt
        c.x += c.v * rawDt
        if (c.x > W + 60) c.x = -60
        if (c.y > H + 40) {
          c.y = -40 - Math.random() * 80
          c.x = Math.random() * W
        }
      }

      if (g.phase === 'menu') {
        if (wantAct) {
          startGame()
          return
        }
        g.py = BASKET_Y + Math.sin(g.t * 2.4) * 5
        moveBasket(rawDt)
        return
      }

      if (g.phase === 'over') {
        g.overT += rawDt
        if (wantAct && g.overT > 0.3) startGame()
        return
      }

      if (g.phase === 'dying') {
        if (dt === 0) return
        g.deadT += dt
        g.vyFall = Math.min(g.vyFall + 1200 * dt, 1000)
        g.py += g.vyFall * dt
        g.ang = g.deadT * 4.5
        if (g.deadT > 0.8) {
          g.phase = 'over'
          g.overT = 0
          sfx.gameOver()
          setUi('over')
        }
        return
      }

      // ---- subiendo ----
      if (dt === 0) return
      g.py = BASKET_Y
      moveBasket(dt)
      const climb = climbOf(g.scroll)
      g.scroll += climb * dt
      syncAlt()

      // aparecen obstáculos y premios
      g.obsT -= dt
      if (g.obsT <= 0) {
        spawnObstacle()
        g.obsT = lerp(1.4, 0.7, Math.min(1, g.alt / ZONES.space)) * rnd(0.85, 1.15)
      }
      g.starT -= dt
      if (g.starT <= 0) {
        g.starT = jitter(2.5)
        g.pick.push({ kind: 'star', x: rnd(30, W - 30), y: -40, color: '#ffd23f', ph: Math.random() * 6 })
      }
      g.balloonT -= dt
      if (g.balloonT <= 0) {
        g.balloonT = jitter(18)
        if (g.balloons < 3) {
          g.pick.push({ kind: 'balloon', x: rnd(40, W - 40), y: -40, color: BALLOON_COLORS[g.balloons], ph: Math.random() * 6 })
        }
      }

      // todo el mundo baja con la subida
      for (const o of g.obs) {
        o.y += (climb + o.ex) * dt
        o.x += o.vx * dt
      }
      g.obs = g.obs.filter((o) => o.y < H + 100 && o.x > -120 && o.x < W + 120)
      for (const p of g.pick) p.y += climb * dt

      const cs = playerCircles()
      g.pick = g.pick.filter((p) => {
        const rad = p.kind === 'star' ? HIT.star : HIT.balloon
        if (cs.some((c) => overlaps(p.x, p.y, rad, c.x, c.y, c.r))) {
          collectPick(p)
          return false
        }
        return p.y < H + 60
      })
      syncAlt()

      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      g.invuln = Math.max(0, g.invuln - dt)
      if (g.invuln <= 0 && g.obs.some((o) => cs.some((c) => obsHits(o, c)))) {
        if (popBalloon()) return
      }
    }

    // ---------- dibujo ----------
    const drawObs = (o: Obs) => {
      const oy = obsY(o, g.t)
      if (o.kind === 'bird') drawBird(ctx, o.x, oy, o.dir, g.t)
      else if (o.kind === 'storm') drawStorm(ctx, o.x, o.y, o.w, g.t, o.seed)
      else if (o.kind === 'plane') drawPlane(ctx, o.x, o.y, o.dir, g.t)
      else drawMeteor(ctx, o.x, o.y, o.r, g.t)
    }

    const draw = () => {
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      juice.applyShake(ctx)

      drawSky(ctx, W, H, g.alt, g.scroll, g.t)
      drawGround(ctx, W, H, H * 0.86 + g.scroll)

      const cloudA = 0.9 * (1 - nightness(g.alt))
      for (const c of clouds) drawDecoCloud(ctx, c.x, c.y, c.s, cloudA)

      for (const p of g.pick) {
        if (p.kind === 'star') drawStar(ctx, p.x, p.y, g.t + p.ph)
        else drawBalloonPickup(ctx, p.x, p.y, p.color, g.t + p.ph)
      }

      for (const o of g.obs) drawObs(o)

      // el gatito: si cae, gira
      ctx.save()
      ctx.translate(g.x, g.py)
      ctx.rotate(g.phase === 'dying' ? g.ang : 0)
      drawPlayer(ctx, 0, 0, g.balloons, g.tilt, g.t, g.invuln)
      ctx.restore()

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      if (g.phase === 'playing' || g.phase === 'dying') {
        ctx.font = `26px ${pf}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1b1b1b'
        const label = `${g.alt} m`
        ctx.strokeText(label, W / 2, 62)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label, W / 2, 62)
        if (g.banner) {
          ctx.globalAlpha = clamp(g.banner.t * 2, 0, 1)
          ctx.font = `11px ${pf}`
          ctx.strokeText(g.banner.text, W / 2, H * 0.36)
          ctx.fillStyle = g.banner.color
          ctx.fillText(g.banner.text, W / 2, H * 0.36)
          ctx.globalAlpha = 1
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()

      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(6,12,20,0.62)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `24px ${pf}`
        ctx.fillStyle = ACCENT
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.font = `9px ${pf}`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillText('Toca o pulsa P para seguir', W / 2, H / 2 + 24)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** La canasta, los obstáculos y los premios conservan su posición relativa; las nubes se regeneran. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      const oldBY = BASKET_Y
      layout()
      if (W === oldW && H === oldH) return
      const kx = W / oldW
      const dy = BASKET_Y - oldBY
      setupCanvas(canvas, W, H)
      clouds = makeClouds()

      g.x = clamp(g.x * kx, EDGE, W - EDGE)
      g.tx = clamp(g.tx * kx, EDGE, W - EDGE)
      g.py += dy
      for (const o of g.obs) {
        o.x *= kx
        o.y += dy
      }
      for (const p of g.pick) {
        p.x *= kx
        p.y += dy
      }
      for (const pt of juice.particles) {
        pt.x *= kx
        pt.y += dy
      }
      for (const t of juice.texts) t.y += dy

      // pausa del propio juego (la misma que al perder el foco)
      if (g.phase === 'playing') g.paused = true
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      update(dt)
      if (g.alt !== shownAlt) {
        shownAlt = g.alt
        setScore(g.alt)
      }
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#4dc3ff]/40 bg-[#0b1020] shadow-[0_0_30px_rgba(77,195,255,0.18)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>ALTURA {score} m</span>
            <span className="text-white/60">RECORD {Math.max(best, score)} m</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Globo Arriba"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="GLOBO ARRIBA"
            accent={ACCENT}
            subtitle="Sube y sube con tu gatito. Esquiva pájaros, tormentas y meteoritos. ¡Cada golpe revienta un globo!"
            hint="← → o el mouse para moverte"
            touchHint="Arrastra el dedo para mover la canasta"
            onStart={() => startRef.current()}
          />
        )}
        {ui === 'over' && (
          <GameOverOverlay
            accent={ACCENT}
            score={result.alt}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Altura', value: `${result.alt} m` },
              { label: 'Estrellas', value: result.stars },
              { label: 'Zona', value: ZONE_NAMES[result.zone] },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
    </div>
  )
}
