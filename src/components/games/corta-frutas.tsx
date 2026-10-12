'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'
import {
  BLADE_LIFE,
  BOMB_R,
  COMMON_FRUITS,
  FRUITS,
  drawBackground,
  drawBlade,
  drawBomb,
  drawExplosion,
  drawFruit,
  drawHalf,
  drawLives,
  drawMissMark,
  drawSplat,
  type BladePoint,
  type FruitKind,
} from './corta-frutas/art'

const GAME_ID = 'corta-frutas'
const ACCENT = '#ff5a6e'

const W0 = 360
const H0 = 560
// Mundo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0

/** Ajusta el mundo lógico al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

// Física y ritmo
const GRAVITY = 520
const MIN_SLICE = 6 // px: un toque corto no cuenta como tajo
const SWISH_MIN = 25 // px: segmentos rápidos suenan a "swish"
const SWISH_GAP = 0.12 // s entre swishes
const COMBO_GAP = 0.25 // s máximos entre dos cortes de la misma combinación
const SPLAT_LIFE = 3 // s que dura la mancha de jugo
const MISS_LIFE = 0.8 // s que dura la marca roja de fruta perdida
const MISSES_MAX = 3
const EXPLOSION_T = 0.8 // s de la explosión de la bomba
const BOOM_FREEZE = 150 // ms de congelación al tocar una bomba
const GOLD_CHANCE = 0.04
const GOLD_FROM = 15

type Phase = 'menu' | 'playing' | 'dying' | 'over'
type Kind = FruitKind | 'bomba'

interface Obj {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  dead: boolean
}
interface Half {
  kind: FruitKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  side: -1 | 1
}
interface Splat {
  x: number
  y: number
  color: string
  size: number
  seed: number
  life: number
}
interface MissMark {
  x: number
  t: number
}
interface Seg {
  ax: number
  ay: number
  bx: number
  by: number
}
interface Queued {
  at: number
  kind: Kind
}
interface Banner {
  text: string
  sub: string
  t: number
}
interface Game {
  phase: Phase
  paused: boolean
  /** Tiempo de animación (siempre avanza). */
  t: number
  /** Tiempo de juego (no avanza en pausa ni en hit-stop). */
  clock: number
  nextWave: number
  objs: Obj[]
  halves: Half[]
  splats: Splat[]
  blade: BladePoint[]
  segs: Seg[]
  queue: Queued[]
  misses: MissMark[]
  missed: number
  missPulse: number
  score: number
  cut: number
  bestCombo: number
  golden: number
  comboN: number
  comboStroke: number
  comboLast: number
  strokeId: number
  down: boolean
  lx: number
  ly: number
  lastSwish: number
  deadT: number
  overT: number
  boom: { x: number; y: number } | null
  deathBy: 'bomba' | 'fallo'
  banner: Banner | null
}

interface Result {
  score: number
  newBest: boolean
  cut: number
  bestCombo: number
  golden: number
}

// ---------- sonidos locales ----------
const sSlice = (n: number) => {
  noise({ dur: 0.12, vol: 0.1, freq: 1800 })
  tone({ freq: 280 + Math.min(n, 10) * 35, to: 110, dur: 0.14, type: 'triangle', vol: 0.07 })
}
const sGold = () => [659, 880, 1175, 1397].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.05, delay: i * 0.06, type: 'triangle' }))
const sCombo = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.06, type: 'square' }))
const sSwish = () => noise({ dur: 0.09, vol: 0.03, freq: 2600 })
const sBomb = () => {
  noise({ dur: 0.6, vol: 0.14, freq: 600 })
  tone({ freq: 160, to: 25, dur: 0.5, vol: 0.09, type: 'triangle' })
}
const sMiss = () => tone({ freq: 220, to: 90, dur: 0.25, vol: 0.06, type: 'sawtooth' })
const sStart = () => [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.09, delay: i * 0.09 }))
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })

// ---------- utilidades ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Distancia del punto (cx, cy) al segmento (ax, ay)-(bx, by). */
function segDist(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / len2, 0, 1) : 0
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy)
}

const radiusOf = (k: Kind) => (k === 'bomba' ? BOMB_R : FRUITS[k].r)

function newGame(): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    clock: 0,
    nextWave: 0.8,
    objs: [],
    halves: [],
    splats: [],
    blade: [],
    segs: [],
    queue: [],
    misses: [],
    missed: 0,
    missPulse: 0,
    score: 0,
    cut: 0,
    bestCombo: 0,
    golden: 0,
    comboN: 0,
    comboStroke: -1,
    comboLast: 0,
    strokeId: 0,
    down: false,
    lx: 0,
    ly: 0,
    lastSwish: -1,
    deadT: 0,
    overT: 0,
    boom: null,
    deathBy: 'fallo',
    banner: null,
  }
}

export default function CortaFrutas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, newBest: false, cut: 0, bestCombo: 0, golden: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(10)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    // ---------- combos y puntuación ----------
    /** Cierra la combinación en curso: si llegó a 3 cortes, da el bono. */
    const flushCombo = () => {
      const n = g.comboN
      g.comboN = 0
      if (n < 3) return
      g.score += n
      g.banner = { text: `¡COMBO x${n}!`, sub: `+${n}`, t: 1 }
      sCombo()
      juice.flash('#fde047', 0.2)
      juice.shake(0.2)
      juice.burst(W / 2, H * 0.42, ['#fde047', '#ffffff', ACCENT], { count: 18, speed: 160, life: 0.7, size: 4, gravity: 200 })
      setScore(g.score)
    }

    /** Termina la partida. `x`, `y` sitúan la explosión si fue una bomba. */
    const die = (by: 'bomba' | 'fallo', x = 0, y = 0) => {
      if (g.phase !== 'playing') return
      g.phase = 'dying'
      g.deathBy = by
      g.deadT = 0
      g.comboN = 0
      g.down = false
      if (by === 'bomba') {
        g.boom = { x, y }
        juice.flash('#ffffff', 0.9)
        juice.shake(1)
        juice.freeze(BOOM_FREEZE)
        sBomb()
      } else {
        juice.flash('#ff3b3b', 0.35)
        juice.shake(0.6)
        juice.freeze(80)
      }
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, newBest: nb, cut: g.cut, bestCombo: g.bestCombo, golden: g.golden })
    }

    const startGame = () => {
      Object.assign(g, newGame())
      g.phase = 'playing'
      juice.reset()
      setScore(0)
      setUi('playing')
      sStart()
    }
    startRef.current = startGame

    const togglePause = () => {
      if (g.phase !== 'playing') return
      g.paused = !g.paused
      g.down = false
      sPause()
    }

    // ---------- oleadas ----------
    /** Lanza un objeto desde debajo del borde inferior en una parábola hacia el centro. */
    const launch = (kind: Kind) => {
      const r = radiusOf(kind)
      const x0 = W * (0.2 + Math.random() * 0.6)
      const y0 = H + r + 10
      const peakY = H * (0.25 + Math.random() * 0.35)
      const vy = -Math.sqrt(2 * GRAVITY * (y0 - peakY))
      const airT = (-2 * vy) / GRAVITY
      const tx = W * (0.25 + Math.random() * 0.5)
      g.objs.push({
        kind,
        x: x0,
        y: y0,
        vx: (tx - x0) / airT,
        vy,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 5,
        dead: false,
      })
    }

    /** Programa la siguiente oleada: crece con la puntuación y las bombas aparecen desde 8 puntos. */
    const scheduleWave = () => {
      const s = g.score
      const maxN = s < 10 ? 2 : Math.min(5, 3 + Math.floor((s - 10) / 10))
      let n = 1 + Math.floor(Math.random() * maxN)
      const bombP = s >= 8 ? lerp(0.1, 0.25, Math.min(1, (s - 8) / 30)) : 0
      const hasBomb = Math.random() < bombP
      if (hasBomb && n < 2) n = 2
      const bombIdx = hasBomb ? Math.floor(Math.random() * n) : -1
      const stagger = Math.random() < 0.4
      for (let i = 0; i < n; i++) {
        let kind: Kind
        if (i === bombIdx) kind = 'bomba'
        else if (s > GOLD_FROM && Math.random() < GOLD_CHANCE) kind = 'dorada'
        else kind = COMMON_FRUITS[Math.floor(Math.random() * COMMON_FRUITS.length)]
        g.queue.push({ at: g.clock + (stagger ? i * 0.15 : 0), kind })
      }
      g.nextWave = g.clock + lerp(1.2, 0.6, Math.min(1, s / 40))
    }

    // ---------- cortes ----------
    const missFruit = (x: number) => {
      g.missed += 1
      g.missPulse = 1
      g.misses.push({ x: clamp(x, 24, W - 24), t: MISS_LIFE })
      sMiss()
      juice.shake(0.15)
      if (g.missed >= MISSES_MAX) die('fallo')
    }

    const slice = (o: Obj, ang: number) => {
      const kind = o.kind
      if (kind === 'bomba') return
      const def = FRUITS[kind]
      // las dos mitades se separan perpendicular al tajo y giran igual (el corte queda paralelo)
      const nx = -Math.sin(ang)
      const ny = Math.cos(ang)
      const sp = (Math.random() * 2 - 1) * 4
      for (const side of [-1, 1] as const) {
        const push = side * 90
        g.halves.push({
          kind,
          x: o.x,
          y: o.y,
          vx: o.vx + nx * push,
          vy: o.vy + ny * push,
          rot: ang,
          spin: sp,
          side,
        })
      }
      g.splats.push({
        x: o.x,
        y: o.y,
        color: def.juice,
        size: def.r * 1.1,
        seed: Math.floor(Math.random() * 997),
        life: SPLAT_LIFE,
      })
      if (g.splats.length > 40) g.splats.shift()
      juice.burst(o.x, o.y, def.juice, { count: 14, speed: 180, life: 0.5, size: 4, gravity: 500 })
      juice.text(o.x, o.y - def.r - 4, `+${def.points}`, kind === 'dorada' ? '#fde047' : '#ffffff', 14, 0.7)

      if (g.comboN > 0 && (g.strokeId !== g.comboStroke || g.clock - g.comboLast > COMBO_GAP)) flushCombo()
      g.comboN += 1
      g.comboStroke = g.strokeId
      g.comboLast = g.clock
      g.bestCombo = Math.max(g.bestCombo, g.comboN)
      g.score += def.points
      g.cut += 1
      if (kind === 'dorada') {
        g.golden += 1
        sGold()
      } else sSlice(g.comboN)
      setScore(g.score)
    }

    /** Aplica los tajos registrados desde el último frame contra las frutas y bombas vivas. */
    const processSegs = () => {
      const segs = g.segs.splice(0)
      for (const s of segs) {
        const dx = s.bx - s.ax
        const dy = s.by - s.ay
        const len = Math.hypot(dx, dy)
        if (len > SWISH_MIN && g.clock - g.lastSwish >= SWISH_GAP) {
          g.lastSwish = g.clock
          sSwish()
        }
        if (len < MIN_SLICE) continue
        const ang = Math.atan2(dy, dx)
        for (const o of g.objs) {
          if (o.dead) continue
          if (segDist(s.ax, s.ay, s.bx, s.by, o.x, o.y) >= radiusOf(o.kind)) continue
          o.dead = true
          if (o.kind === 'bomba') {
            g.objs = g.objs.filter((q) => !q.dead)
            die('bomba', o.x, o.y)
            return
          }
          slice(o, ang)
        }
      }
      g.objs = g.objs.filter((q) => !q.dead)
    }

    /** Mueve frutas, bombas y mitades; cuenta las frutas que caen sin cortar. */
    const stepWorld = (dt: number) => {
      for (const o of g.objs) {
        o.vy += GRAVITY * dt
        o.x += o.vx * dt
        o.y += o.vy * dt
        o.rot += o.spin * dt
      }
      for (const h of g.halves) {
        h.vy += GRAVITY * dt
        h.x += h.vx * dt
        h.y += h.vy * dt
        h.rot += h.spin * dt
      }
      g.halves = g.halves.filter((h) => h.y < H + 80)
      for (const s of g.splats) s.life -= dt
      g.splats = g.splats.filter((s) => s.life > 0)
      for (const m of g.misses) m.t -= dt
      g.misses = g.misses.filter((m) => m.t > 0)
      g.missPulse = Math.max(0, g.missPulse - dt * 3)
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }

      const keep: Obj[] = []
      for (const o of g.objs) {
        if (o.dead) continue
        if (o.vy > 0 && o.y - radiusOf(o.kind) > H) {
          if (o.kind !== 'bomba' && g.phase === 'playing') missFruit(o.x)
          continue
        }
        keep.push(o)
      }
      g.objs = keep
    }

    // ---------- lógica ----------
    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const wantStart = jp.has('action')
      const wantPause = jp.has('pause')
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt
      for (const p of g.blade) p.age += rawDt
      g.blade = g.blade.filter((p) => p.age < BLADE_LIFE)

      if (g.phase === 'playing' && wantPause) togglePause()
      if (g.paused) return

      if (g.phase === 'menu') {
        if (wantStart) startGame()
        return
      }

      if (g.phase === 'over') {
        g.overT += rawDt
        if (wantStart && g.overT > 0.3) startGame()
        return
      }

      if (g.phase === 'dying') {
        g.deadT += rawDt
        stepWorld(dt)
        if (g.deadT >= (g.deathBy === 'bomba' ? EXPLOSION_T : 0.6)) {
          g.phase = 'over'
          g.overT = 0
          setUi('over')
        }
        return
      }

      // ---- jugando ----
      g.clock += dt
      if (g.clock >= g.nextWave) scheduleWave()
      if (g.queue.length) {
        g.queue = g.queue.filter((q) => {
          if (q.at > g.clock) return true
          launch(q.kind)
          return false
        })
      }
      processSegs()
      if (g.phase !== 'playing') return
      if (g.comboN > 0 && (!g.down || g.clock - g.comboLast > COMBO_GAP)) flushCombo()
      stepWorld(dt)
    }

    // ---------- dibujo ----------
    const draw = () => {
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      juice.applyShake(ctx)
      drawBackground(ctx, W, H)

      // sandía flotando detrás de la pantalla de inicio
      if (g.phase === 'menu') {
        ctx.save()
        ctx.translate(W / 2, H * 0.42 + Math.sin(g.t * 1.6) * 12)
        ctx.rotate(Math.sin(g.t * 1.1) * 0.15)
        ctx.scale(2.2, 2.2)
        drawFruit(ctx, 'sandia', 0, 0, 0, g.t)
        ctx.restore()
      }

      for (const s of g.splats) drawSplat(ctx, s.x, s.y, s.color, s.size, s.seed, Math.min(1, s.life))
      for (const h of g.halves) drawHalf(ctx, h.kind, h.x, h.y, h.rot, h.side)
      for (const o of g.objs) {
        if (o.kind === 'bomba') drawBomb(ctx, o.x, o.y, o.rot, g.t)
        else drawFruit(ctx, o.kind, o.x, o.y, o.rot, g.t)
      }
      for (const m of g.misses) drawMissMark(ctx, m.x, H, m.t / MISS_LIFE)
      juice.drawParticles(ctx)
      drawBlade(ctx, g.blade)
      juice.drawTexts(ctx, pf)
      if (g.boom) drawExplosion(ctx, g.boom.x, g.boom.y, Math.min(1, g.deadT / EXPLOSION_T))

      if (g.phase !== 'menu') {
        // marcador: puntos a la izquierda, vidas (cruces) a la derecha
        ctx.font = `22px ${pf}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1b1b1b'
        ctx.strokeText(String(g.score), 16, 34)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(g.score), 16, 34)
        drawLives(ctx, W - 12, 32, g.missed, g.missPulse)
      }

      if (g.banner) {
        ctx.globalAlpha = clamp(g.banner.t * 2, 0, 1)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1b1b1b'
        ctx.font = `16px ${pf}`
        ctx.strokeText(g.banner.text, W / 2, H * 0.42)
        ctx.fillStyle = '#fde047'
        ctx.fillText(g.banner.text, W / 2, H * 0.42)
        ctx.font = `12px ${pf}`
        ctx.strokeText(g.banner.sub, W / 2, H * 0.42 + 28)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(g.banner.sub, W / 2, H * 0.42 + 28)
        ctx.globalAlpha = 1
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.restore()

      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(26,8,12,0.62)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `24px ${pf}`
        ctx.fillStyle = ACCENT
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.font = `9px ${pf}`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillText('Toca la pantalla o pulsa P para seguir', W / 2, H / 2 + 24)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- entrada: la espada ----------
    const toLogical = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.phase !== 'playing') return
      // con el juego en pausa, cualquier toque reanuda
      if (g.paused) {
        g.paused = false
        sPause()
        return
      }
      canvas.setPointerCapture(e.pointerId)
      const p = toLogical(e)
      g.down = true
      g.strokeId += 1
      g.lx = p.x
      g.ly = p.y
      g.blade.push({ x: p.x, y: p.y, age: 0 })
    }
    const onMove = (e: PointerEvent) => {
      if (!g.down || g.paused || g.phase !== 'playing') return
      const p = toLogical(e)
      g.segs.push({ ax: g.lx, ay: g.ly, bx: p.x, by: p.y })
      g.lx = p.x
      g.ly = p.y
      g.blade.push({ x: p.x, y: p.y, age: 0 })
    }
    const onUp = () => {
      g.down = false
    }
    const onBlur = () => {
      g.down = false
      if (g.phase === 'playing') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** Los objetos conservan su distancia al borde inferior (dy); el tablero se regenera. */
    const relayoutLive = () => {
      const oldH = H
      const oldW = W
      layout()
      if (W === oldW && H === oldH) return
      const dy = H - oldH
      setupCanvas(canvas, W, H)
      for (const o of g.objs) {
        o.x = clamp(o.x, 0, W)
        o.y += dy
      }
      for (const h of g.halves) {
        h.x = clamp(h.x, 0, W)
        h.y += dy
      }
      for (const s of g.splats) {
        s.x = clamp(s.x, 0, W)
        s.y += dy
      }
      for (const m of g.misses) m.x = clamp(m.x, 0, W)
      for (const pt of juice.particles) pt.y += dy
      for (const t of juice.texts) t.y += dy
      g.blade = []
      g.segs = []
      g.down = false
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
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#ff5a6e]/40 bg-[#1a0f0a] shadow-[0_0_30px_rgba(255,90,110,0.18)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PUNTOS {score}</span>
            <span className="text-white/60">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Corta Frutas"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="CORTA FRUTAS"
            accent={ACCENT}
            subtitle="Desliza el dedo como una espada y corta toda la fruta. ¡No toques las bombas!"
            hint="Arrastra el mouse para cortar"
            touchHint="Desliza el dedo para cortar"
            onStart={() => startRef.current()}
          />
        )}
        {ui === 'over' && (
          <GameOverOverlay
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Frutas cortadas', value: result.cut },
              { label: 'Mejor combo', value: result.bestCombo },
              { label: 'Doradas', value: result.golden },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
    </div>
  )
}
