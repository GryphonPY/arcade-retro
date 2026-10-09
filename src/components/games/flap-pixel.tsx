'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'flap-pixel'
const ACCENT = '#4ade80'

const W0 = 360
const H0 = 560
// Mundo lógico: se ajusta a la pantalla (ver layout). El suelo siempre queda al fondo.
let W = W0
let H = H0
let GROUND = H0 - 72
const BX = 96 // posición horizontal fija del pájaro
const BIRD_R = 10 // radio de la hitbox (el sprite es más grande: perdona)

/** Ajusta el mundo lógico al área de la pantalla; el suelo se queda pegado al fondo. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  GROUND = H - 72
  publishLogical(f)
}

// Física
const GRAVITY = 1500
const FLAP_V = -410
const TERMINAL_V = 640

// Tuberías
const PIPE_W = 54
const CAP_H = 22
const CAP_EXTRA = 4

const MEDALS = [
  { at: 10, name: 'Bronce', color: '#cd7f32' },
  { at: 25, name: 'Plata', color: '#d6dde8' },
  { at: 50, name: 'Oro', color: '#fbbf24' },
  { at: 100, name: 'Platino', color: '#67e8f9' },
]

type Phase = 'menu' | 'playing' | 'dying' | 'over'
type RGB = [number, number, number]

interface Pipe {
  x: number
  base: number
  cy: number
  gap: number
  amp: number
  omega: number
  ph: number
  passed: boolean
}
interface Coin {
  x: number
  y: number
  taken: boolean
  ph: number
}
interface Cloud {
  x: number
  y: number
  s: number
  v: number
}
interface Game {
  phase: Phase
  paused: boolean
  t: number
  scroll: number
  y: number
  vy: number
  ang: number
  flapT: number
  sq: number
  pipes: Pipe[]
  coins: Coin[]
  nextX: number
  count: number
  lastCenter: number
  score: number
  passed: number
  coinsGot: number
  deadT: number
  landed: boolean
  overT: number
  dayPhase: number
  medalIdx: number
  banner: { text: string; color: string; t: number } | null
  deathBy: 'pipe' | 'ground'
}

// ---------- utilidades de color ----------
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// Ciclo día -> atardecer -> noche -> amanecer
const SKY_TOP: RGB[] = [
  [88, 190, 250],
  [84, 56, 150],
  [8, 10, 40],
  [96, 98, 178],
]
const SKY_BOT: RGB[] = [
  [196, 238, 255],
  [253, 146, 84],
  [30, 38, 96],
  [255, 196, 156],
]
const NIGHT_AMT = [0, 0.5, 1, 0.5]

const cycle = (arr: RGB[], p: number): RGB => {
  const x = (((p % 1) + 1) % 1) * 4
  const i = Math.floor(x)
  return mix(arr[i], arr[(i + 1) % 4], smooth(x - i))
}
const nightAt = (p: number) => {
  const x = (((p % 1) + 1) % 1) * 4
  const i = Math.floor(x)
  return lerp(NIGHT_AMT[i], NIGHT_AMT[(i + 1) % 4], smooth(x - i))
}

// ---------- sprite del pájaro (pixel art) ----------
const BIRD_BODY = [
  '....KKKKKK.....',
  '..KKYYYYYKKKK..',
  '.KYYYYYYKEEEEK.',
  'KYYYYYYYKEEPPK.',
  'KYYYYYYYKEEPPK.',
  'KYYYYYYYYKKKKKK',
  'KYYYYYYYYKOOOOK',
  'KDDYYYYYYYKRRRK',
  '.KDDDDDDDDKKKK.',
  '..KKDDDDKK.....',
  '....KKKK.......',
]
const WING_UP = ['KK....', 'KFKK..', 'KFFFK.', '.KFFFK', '..KKK.']
const WING_MID = ['.KKKK.', 'KFFFFK', 'KFFFFK', '.KKKK.']
const WING_DOWN = ['.KKKK.', 'KFFFFK', '.KFFK.', '..KK..']
const BIRD_PAL: Record<string, string> = {
  K: '#2b1a0e',
  Y: '#fbbf24',
  D: '#e8932a',
  E: '#ffffff',
  P: '#111111',
  O: '#fb923c',
  R: '#ef4444',
  F: '#fff6cf',
}
const CELL = 3

function makeBirdSprites(scale: number): HTMLCanvasElement[] {
  const wings = [
    { m: WING_UP, r: 1, c: 1 },
    { m: WING_MID, r: 4, c: 1 },
    { m: WING_DOWN, r: 5, c: 1 },
  ]
  return wings.map((w) => {
    const cv = document.createElement('canvas')
    const cw = BIRD_BODY[0].length * CELL
    const ch = BIRD_BODY.length * CELL
    cv.width = Math.round(cw * scale)
    cv.height = Math.round(ch * scale)
    const c = cv.getContext('2d')!
    c.scale(scale, scale)
    const paint = (m: string[], r0: number, c0: number) => {
      for (let r = 0; r < m.length; r++)
        for (let k = 0; k < m[r].length; k++) {
          const ch2 = m[r][k]
          if (ch2 === '.') continue
          c.fillStyle = BIRD_PAL[ch2]
          c.fillRect((c0 + k) * CELL, (r0 + r) * CELL, CELL, CELL)
        }
    }
    paint(BIRD_BODY, 0, 0)
    paint(w.m, w.r, w.c)
    return cv
  })
}

// ---------- sonidos locales ----------
const sFlap = () => tone({ freq: 380, to: 760, dur: 0.09, type: 'square', vol: 0.03 })
const sScore = (n: number) => {
  const f = 740 + (n % 8) * 55
  tone({ freq: f, dur: 0.07, type: 'square', vol: 0.035 })
  tone({ freq: f * 1.5, dur: 0.12, type: 'square', vol: 0.035, delay: 0.06 })
}
const sCoin = () => {
  tone({ freq: 1175, dur: 0.06, type: 'triangle', vol: 0.05 })
  tone({ freq: 1760, dur: 0.18, type: 'triangle', vol: 0.05, delay: 0.06 })
}
const sHit = () => {
  noise({ dur: 0.25, vol: 0.12, freq: 1400 })
  tone({ freq: 300, to: 70, dur: 0.22, type: 'sawtooth', vol: 0.07 })
}
const sThud = () => {
  noise({ dur: 0.18, vol: 0.09, freq: 420 })
  tone({ freq: 120, to: 50, dur: 0.15, type: 'triangle', vol: 0.06 })
}
const sMedal = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.07, type: 'square' }))
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })

function Medal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" className="inline-block size-4 align-[-3px]" aria-hidden>
      <path d="M4 0h3l1 5H5z M12 0H9L8 5h3z" fill="#ef4444" />
      <circle cx="8" cy="10" r="5.5" fill={color} stroke="#1f2937" strokeWidth="1.2" />
      <circle cx="8" cy="10" r="3" fill="none" stroke="#1f2937" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  )
}

function newGame(): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    scroll: 0,
    y: 250,
    vy: 0,
    ang: 0,
    flapT: 9,
    sq: 0,
    pipes: [],
    coins: [],
    nextX: W + 110,
    count: 0,
    lastCenter: 250,
    score: 0,
    passed: 0,
    coinsGot: 0,
    deadT: 0,
    landed: false,
    overT: 0,
    dayPhase: 0,
    medalIdx: -1,
    banner: null,
    deathBy: 'pipe',
  }
}

interface Result {
  score: number
  newBest: boolean
  coins: number
  medal: number
}

export default function FlapPixel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, newBest: false, coins: 0, medal: -1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const rs = canvas.width / W
    const sprites = makeBirdSprites(rs)
    const juice = new Juice(8)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let pointerFlap = false

    const clouds: Cloud[] = Array.from({ length: 7 }, (_, i) => ({
      x: (i / 7) * (W + 120) - 40,
      y: 40 + hash(i + 3) * 190,
      s: 0.7 + hash(i + 9) * 0.9,
      v: 4 + hash(i + 5) * 6,
    }))
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: hash(i * 3 + 1) * W, y: hash(i * 3 + 2) * 300, p: hash(i * 3 + 3) * 6 }))

    // ---------- lógica ----------
    const speedFor = (n: number) => 112 + Math.min(58, n * 1.35)

    const spawnPipe = () => {
      const n = g.count++
      const gap = Math.max(112, 158 - n * 1.0)
      const margin = 46
      const minC = margin + gap / 2
      const maxC = GROUND - margin - gap / 2
      const movingChance = n < 16 ? 0 : Math.min(0.6, 0.3 + (n - 16) * 0.02)
      const moving = Math.random() < movingChance
      const amp = moving ? Math.min(44, 24 + (n - 16) * 0.9) : 0
      const maxD = (n < 2 ? 40 : lerp(70, 150, Math.min(1, n / 14))) - amp * 0.6
      let c = g.lastCenter + (Math.random() * 2 - 1) * maxD
      c = clamp(c, minC + amp, maxC - amp)
      const prev = g.lastCenter
      g.lastCenter = c
      const p: Pipe = {
        x: g.nextX,
        base: c,
        cy: c,
        gap,
        amp,
        omega: 1.3 + Math.random() * 0.6,
        ph: Math.random() * Math.PI * 2,
        passed: false,
      }
      g.pipes.push(p)
      // moneda arriesgada entre la tubería anterior y esta
      if (n >= 3 && Math.random() < 0.3) {
        const side = Math.random() < 0.5 ? -1 : 1
        const off = 52 + Math.random() * 30
        const mid = (prev + c) / 2
        let cy = mid + side * off
        if (cy < 46 || cy > GROUND - 46) cy = mid - side * off
        g.coins.push({ x: p.x - spacing() / 2, y: clamp(cy, 40, GROUND - 40), taken: false, ph: Math.random() * 6 })
      }
      g.nextX += spacing()
    }
    const spacing = () => {
      const s = speedFor(g.passed)
      return 200 + (s - 112) * 0.6
    }

    const startGame = () => {
      Object.assign(g, newGame())
      g.phase = 'playing'
      g.vy = FLAP_V
      g.flapT = 0
      juice.reset()
      pointerFlap = false
      setScore(0)
      setUi('playing')
      sFlap()
    }
    startRef.current = startGame

    const flap = () => {
      g.vy = FLAP_V
      g.flapT = 0
      g.sq = 1
      sFlap()
      juice.burst(BX - 14, g.y + 6, ['#ffffff', '#fde68a'], { count: 3, speed: 45, angle: Math.PI * 0.75, arc: 1.2, life: 0.35, size: 3, gravity: 80 })
    }

    const die = (by: 'pipe' | 'ground') => {
      if (g.phase !== 'playing') return
      g.phase = 'dying'
      g.deathBy = by
      g.deadT = 0
      g.landed = by === 'ground'
      g.vy = by === 'ground' ? 0 : -150
      if (by === 'ground') g.y = GROUND - BIRD_R
      juice.flash('#ffffff', 0.9)
      juice.shake(0.9)
      juice.freeze(80)
      juice.burst(BX, g.y, ['#fbbf24', '#ffffff', '#fb923c'], { count: 16, speed: 170, life: 0.6, size: 4, gravity: 500 })
      sHit()
      if (by === 'ground') sThud()
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, newBest: nb, coins: g.coinsGot, medal: g.medalIdx })
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
    const onPointer = (e: PointerEvent) => {
      e.preventDefault()
      pointerFlap = true
    }
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    const circleRect = (cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) => {
      const nx = clamp(cx, rx, rx + rw)
      const ny = clamp(cy, ry, ry + rh)
      const dx = cx - nx
      const dy = cy - ny
      return dx * dx + dy * dy < r * r
    }

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const wantFlap = jp.has('action') || jp.has('up') || jp.has('left') || pointerFlap
      const wantPause = jp.has('pause')
      pointerFlap = false
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (g.phase === 'playing' && wantPause) togglePause()
      if (g.paused) {
        if (wantFlap) {
          g.paused = false
          sPause()
        }
        return
      }

      // ciclo día/noche: avanza con la puntuación y se suaviza
      const target = g.phase === 'menu' ? 0 : g.passed / 48
      g.dayPhase += (target - g.dayPhase) * Math.min(1, rawDt * 1.2)

      for (const c of clouds) {
        c.x -= (c.v + (g.phase === 'playing' ? speedFor(g.passed) * 0.08 : 0)) * rawDt
        if (c.x < -90) {
          c.x = W + 30 + Math.random() * 40
          c.y = 40 + Math.random() * 190
        }
      }

      if (g.phase === 'menu') {
        if (wantFlap) {
          startGame()
          return
        }
        g.scroll += 60 * rawDt
        g.y = 250 + Math.sin(g.t * 3.2) * 9
        g.vy = 0
        g.ang = Math.sin(g.t * 3.2) * 0.12
        g.flapT = (g.t * 5) % 1.2
        return
      }

      if (g.phase === 'over') {
        g.overT += rawDt
        if (wantFlap && g.overT > 0.3) startGame()
        return
      }

      g.flapT += rawDt
      g.sq = Math.max(0, g.sq - rawDt * 6)

      if (g.phase === 'dying') {
        if (dt === 0) return
        g.deadT += dt
        g.vy = Math.min(g.vy + 1800 * dt, 900)
        g.y += g.vy * dt
        g.ang += (1.65 - g.ang) * Math.min(1, dt * 7)
        if (g.y + BIRD_R >= GROUND && !g.landed) {
          g.landed = true
          g.y = GROUND - BIRD_R
          g.vy = 0
          sThud()
          juice.shake(0.35)
          juice.burst(BX, GROUND - 2, ['#d9b36a', '#f0d9a0'], { count: 10, speed: 90, angle: -Math.PI / 2, arc: 2.2, life: 0.5, size: 3, gravity: 300 })
        }
        if (g.landed) g.y = GROUND - BIRD_R
        if ((g.landed && g.deadT > 0.55) || g.deadT > 1.5) {
          g.phase = 'over'
          g.overT = 0
          setUi('over')
        }
        return
      }

      // ---- jugando ----
      if (dt === 0) return
      if (wantFlap) flap()
      const spd = speedFor(g.passed)
      g.scroll += spd * dt
      g.nextX -= spd * dt
      g.vy = Math.min(g.vy + GRAVITY * dt, TERMINAL_V)
      g.y += g.vy * dt
      if (g.y < BIRD_R) {
        g.y = BIRD_R
        if (g.vy < 0) g.vy = 0
      }
      const tgt = g.vy < 0 ? (g.vy / 410) * 0.5 : Math.pow(clamp((g.vy - 60) / 560, 0, 1), 1.4) * 1.3
      g.ang += (tgt - g.ang) * Math.min(1, dt * 14)

      while (g.nextX < W + 80) spawnPipe()
      let hit = false
      for (const p of g.pipes) {
        p.x -= spd * dt
        p.cy = p.amp ? clamp(p.base + p.amp * Math.sin(p.ph + g.t * p.omega), 0, GROUND) : p.base
        const top = p.cy - p.gap / 2
        const bot = p.cy + p.gap / 2
        if (!p.passed && p.x + PIPE_W / 2 < BX) {
          p.passed = true
          g.passed++
          g.score++
          setScore(g.score)
          sScore(g.score)
          juice.text(BX + 6, g.y - 26, '+1', '#ffffff', 14, 0.7)
          const mi = MEDALS.findIndex((m) => m.at === g.score)
          if (mi >= 0) {
            g.medalIdx = mi
            g.banner = { text: `¡MEDALLA DE ${MEDALS[mi].name.toUpperCase()}!`, color: MEDALS[mi].color, t: 1.8 }
            sMedal()
            juice.flash(MEDALS[mi].color, 0.25)
            juice.burst(W / 2, 150, MEDALS[mi].color, { count: 24, speed: 160, life: 0.8, size: 4, gravity: 200 })
          }
        }
        if (p.x < BX + BIRD_R + CAP_EXTRA && p.x + PIPE_W > BX - BIRD_R - CAP_EXTRA) {
          if (
            circleRect(BX, g.y, BIRD_R, p.x, -60, PIPE_W, top - CAP_H + 60) ||
            circleRect(BX, g.y, BIRD_R, p.x - CAP_EXTRA, top - CAP_H, PIPE_W + CAP_EXTRA * 2, CAP_H) ||
            circleRect(BX, g.y, BIRD_R, p.x, bot + CAP_H, PIPE_W, GROUND - bot - CAP_H) ||
            circleRect(BX, g.y, BIRD_R, p.x - CAP_EXTRA, bot, PIPE_W + CAP_EXTRA * 2, CAP_H)
          )
            hit = true
        }
      }
      for (const c of g.coins) {
        c.x -= spd * dt
        if (!c.taken && Math.hypot(c.x - BX, c.y - g.y) < 20) {
          c.taken = true
          g.coinsGot++
          g.score += 2
          setScore(g.score)
          sCoin()
          juice.text(c.x, c.y - 14, '+2', '#fde047', 14, 0.8)
          juice.burst(c.x, c.y, ['#fde047', '#ffffff'], { count: 10, speed: 110, life: 0.45, size: 3 })
          const mi = MEDALS.findIndex((m, i) => i > g.medalIdx && g.score >= m.at)
          if (mi >= 0) {
            g.medalIdx = mi
            g.banner = { text: `¡MEDALLA DE ${MEDALS[mi].name.toUpperCase()}!`, color: MEDALS[mi].color, t: 1.8 }
            sMedal()
          }
        }
      }
      g.pipes = g.pipes.filter((p) => p.x > -PIPE_W - 20)
      g.coins = g.coins.filter((c) => c.x > -20 && !c.taken)
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      if (hit) die('pipe')
      else if (g.y + BIRD_R >= GROUND) die('ground')
    }

    // ---------- dibujo ----------
    const drawBody = (x: number, y: number, w: number, h: number, pal: { o: string; b: string; l: string; d: string }) => {
      if (h <= 0) return
      ctx.fillStyle = pal.o
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = pal.b
      ctx.fillRect(x + 2, y, w - 4, h)
      ctx.fillStyle = pal.d
      ctx.fillRect(x + w - 12, y, 10, h)
      ctx.fillStyle = pal.l
      ctx.fillRect(x + 6, y, 6, h)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillRect(x + 14, y, 2, h)
    }
    const PAL_GREEN = { o: '#14401f', b: '#4cb44a', l: '#a8f08a', d: '#2f8a38' }
    const PAL_MOVE = { o: '#10304a', b: '#3aa6c4', l: '#9be8ff', d: '#2778a0' }

    const drawPipe = (p: Pipe) => {
      const pal = p.amp ? PAL_MOVE : PAL_GREEN
      const top = p.cy - p.gap / 2
      const bot = p.cy + p.gap / 2
      const x = Math.round(p.x)
      drawBody(x, -4, PIPE_W, top - CAP_H + 4, pal)
      drawBody(x - CAP_EXTRA, top - CAP_H, PIPE_W + CAP_EXTRA * 2, CAP_H, pal)
      drawBody(x, bot + CAP_H, PIPE_W, GROUND - bot - CAP_H, pal)
      drawBody(x - CAP_EXTRA, bot, PIPE_W + CAP_EXTRA * 2, CAP_H, pal)
      if (p.amp) {
        // flechas arriba/abajo: esta tubería se mueve
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        const cx = x + PIPE_W / 2
        for (const cyy of [top - CAP_H / 2, bot + CAP_H / 2]) {
          ctx.beginPath()
          ctx.moveTo(cx - 9, cyy + 3)
          ctx.lineTo(cx - 3, cyy + 3)
          ctx.lineTo(cx - 6, cyy - 4)
          ctx.closePath()
          ctx.moveTo(cx + 3, cyy - 3)
          ctx.lineTo(cx + 9, cyy - 3)
          ctx.lineTo(cx + 6, cyy + 4)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    const draw = () => {
      const p = g.dayPhase
      const n = nightAt(p)
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      juice.applyShake(ctx)

      // cielo
      const top = cycle(SKY_TOP, p)
      const bot = cycle(SKY_BOT, p)
      const grd = ctx.createLinearGradient(0, 0, 0, GROUND)
      grd.addColorStop(0, css(top))
      grd.addColorStop(1, css(bot))
      ctx.fillStyle = grd
      ctx.fillRect(-20, -20, W + 40, H + 40)

      // estrellas
      if (n > 0.3) {
        const a = clamp((n - 0.3) * 1.6, 0, 1)
        ctx.fillStyle = '#fff'
        for (const s of stars) {
          ctx.globalAlpha = a * (0.45 + 0.55 * Math.sin(g.t * 2 + s.p))
          ctx.fillRect(s.x | 0, s.y | 0, 2, 2)
        }
        ctx.globalAlpha = 1
      }

      // sol y luna
      const a = p * Math.PI * 2
      const sunX = W / 2 + Math.sin(a) * W * 0.42
      const sunY = 270 - Math.cos(a) * 215
      ctx.fillStyle = 'rgba(255,230,140,0.18)'
      ctx.beginPath()
      ctx.arc(sunX, sunY, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffe58a'
      ctx.beginPath()
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2)
      ctx.fill()
      const moonX = W / 2 + Math.sin(a + Math.PI) * W * 0.42
      const moonY = 270 - Math.cos(a + Math.PI) * 215
      ctx.fillStyle = '#e8eeff'
      ctx.beginPath()
      ctx.arc(moonX, moonY, 17, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(120,130,180,0.45)'
      ctx.beginPath()
      ctx.arc(moonX - 5, moonY - 3, 4, 0, Math.PI * 2)
      ctx.arc(moonX + 6, moonY + 5, 3, 0, Math.PI * 2)
      ctx.fill()

      // nubes
      ctx.fillStyle = css(mix([255, 255, 255], [74, 86, 140], n))
      ctx.globalAlpha = 0.92
      for (const c of clouds) {
        const x = Math.round(c.x)
        const y = Math.round(c.y)
        const s = c.s
        ctx.fillRect(x, y, 62 * s, 14 * s)
        ctx.fillRect(x + 10 * s, y - 9 * s, 30 * s, 12 * s)
        ctx.fillRect(x + 30 * s, y - 5 * s, 24 * s, 8 * s)
      }
      ctx.globalAlpha = 1

      // ciudad lejana
      const cityOff = g.scroll * 0.2
      const cityCol = css(mix([150, 186, 218], [20, 26, 62], n))
      const k0 = Math.floor(cityOff / 40)
      for (let k = k0; k < k0 + 11; k++) {
        const bw = 26 + hash(k + 1) * 12
        const bh = 50 + hash(k + 7) * 95
        const bx = Math.round(k * 40 - cityOff + (40 - bw) / 2)
        const by = GROUND - 30 - bh
        ctx.fillStyle = cityCol
        ctx.fillRect(bx, by, bw, bh + 30)
        if (n > 0.2) {
          ctx.fillStyle = `rgba(255,224,130,${clamp(n * 0.9, 0, 0.85)})`
          for (let r = 0; r < bh / 12 - 1; r++)
            for (let c = 0; c < bw / 9 - 0.5; c++)
              if (hash(k * 91 + r * 7 + c * 3) > 0.55) ctx.fillRect(bx + 4 + c * 9, by + 6 + r * 12, 4, 5)
        }
      }

      // colinas (dos capas con parallax)
      const hills = (off: number, base: number, amp: number, freq: number, col: string) => {
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(0, GROUND)
        for (let x = 0; x <= W; x += 8) {
          const wx = x + off
          const y = Math.round((base - (Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.3 + 1.7) * amp * 0.45)) / 4) * 4
          ctx.lineTo(x, y)
          ctx.lineTo(x + 8, y)
        }
        ctx.lineTo(W, GROUND)
        ctx.closePath()
        ctx.fill()
      }
      hills(g.scroll * 0.35, GROUND - 22, 22, 0.011, css(mix([116, 196, 140], [18, 44, 76], n)))
      hills(g.scroll * 0.6 + 140, GROUND - 6, 14, 0.019, css(mix([86, 176, 92], [14, 58, 58], n)))

      // monedas
      for (const c of g.coins) {
        const w = Math.abs(Math.cos(g.t * 5 + c.ph)) * 8 + 1.5
        const cy = c.y + Math.sin(g.t * 3 + c.ph) * 2
        ctx.fillStyle = '#92400e'
        ctx.fillRect(c.x - w - 1.5, cy - 11, w * 2 + 3, 22)
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(c.x - w, cy - 9.5, w * 2, 19)
        ctx.fillStyle = '#fef08a'
        ctx.fillRect(c.x - w + 1.5, cy - 8, Math.max(1, w * 0.7), 16)
      }

      // tuberías
      for (const pp of g.pipes) drawPipe(pp)

      // suelo
      const gy = GROUND
      ctx.fillStyle = css(mix([222, 184, 112], [78, 62, 66], n))
      ctx.fillRect(-20, gy, W + 40, H - gy + 20)
      ctx.fillStyle = css(mix([196, 156, 92], [60, 48, 54], n))
      for (let x = -((g.scroll * 1.0) % 48); x < W; x += 48) {
        ctx.fillRect(x + 10, gy + 34, 14, 4)
        ctx.fillRect(x + 32, gy + 52, 10, 4)
      }
      ctx.fillStyle = css(mix([40, 98, 36], [10, 40, 36], n))
      ctx.fillRect(-20, gy - 2, W + 40, 4)
      ctx.fillStyle = css(mix([120, 214, 84], [30, 96, 70], n))
      ctx.fillRect(-20, gy + 2, W + 40, 14)
      ctx.fillStyle = css(mix([92, 184, 66], [22, 78, 58], n))
      for (let x = -24 - ((g.scroll * 1.0) % 24); x < W + 24; x += 24) {
        ctx.beginPath()
        ctx.moveTo(x, gy + 2)
        ctx.lineTo(x + 12, gy + 2)
        ctx.lineTo(x + 4, gy + 16)
        ctx.lineTo(x - 8, gy + 16)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = css(mix([150, 110, 60], [44, 34, 40], n))
      ctx.fillRect(-20, gy + 16, W + 40, 3)

      // pájaro
      {
        let frame = 1
        if (g.phase === 'menu') {
          const k = Math.floor(g.flapT * 5) % 4
          frame = [0, 1, 2, 1][k]
        } else if (g.phase === 'dying') frame = 2
        else {
          const t = g.flapT
          frame = t < 0.06 ? 2 : t < 0.13 ? 1 : t < 0.28 ? 0 : g.vy > 250 ? 1 : 1
        }
        const sx = 1 - g.sq * 0.1
        const sy = 1 + g.sq * 0.16
        ctx.save()
        ctx.translate(BX, g.y)
        ctx.rotate(g.ang)
        ctx.scale(sx, sy)
        ctx.imageSmoothingEnabled = true
        const sp = sprites[frame]
        ctx.drawImage(sp, -sp.width / rs / 2 + 2, -sp.height / rs / 2, sp.width / rs, sp.height / rs)
        ctx.restore()
        ctx.imageSmoothingEnabled = false
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      // marcador grande
      if (g.phase === 'playing' || g.phase === 'dying') {
        ctx.font = `26px ${pf}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1b1b1b'
        ctx.strokeText(String(g.score), W / 2, 62)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(g.score), W / 2, 62)
        if (g.banner) {
          ctx.globalAlpha = clamp(g.banner.t * 2, 0, 1)
          ctx.font = `11px ${pf}`
          ctx.strokeText(g.banner.text, W / 2, 110)
          ctx.fillStyle = g.banner.color
          ctx.fillText(g.banner.text, W / 2, 110)
          ctx.globalAlpha = 1
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()

      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(6,12,8,0.62)'
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

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
      }
      update(dt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef])

  const nextMedal = MEDALS.find((m) => m.at > result.score)

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#4ade80]/40 bg-[#0b1020] shadow-[0_0_30px_rgba(74,222,128,0.18)]"
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
          aria-label="Juego Flap Pixel"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="FLAP PIXEL"
            accent={ACCENT}
            subtitle="Aletea entre las tuberías. Las azules se mueven. Las monedas valen doble."
            hint="Espacio o ↑ para aletear"
            touchHint="Toca la pantalla para aletear"
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
              {
                label: 'Medalla',
                value:
                  result.medal >= 0 ? (
                    <span>
                      <Medal color={MEDALS[result.medal].color} /> {MEDALS[result.medal].name}
                    </span>
                  ) : (
                    'Ninguna'
                  ),
              },
              { label: 'Monedas', value: result.coins },
              ...(nextMedal ? [{ label: 'Próxima', value: `${nextMedal.name} (${nextMedal.at})` }] : []),
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
    </div>
  )
}
