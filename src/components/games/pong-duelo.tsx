'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas, rr } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'pong-duelo'
const ACCENT = '#60a5fa'
const BLUE = '#60a5fa'
const PINK = '#f472b6'

const W0 = 360
const H0 = 560
// Cancha lógica: se ajusta a la pantalla (ver layout); la paleta de abajo va pegada al fondo.
let W = W0
let H = H0
let PAD_BOT = H0 - 46
const PW = 64 // ancho de paleta
const PH = 10 // alto de paleta
const PAD_TOP = 46
const BR = 7 // radio de la bola
const WIN = 7

/** Ajusta la cancha al área de la pantalla y recalcula lo que depende de su tamaño. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  PAD_BOT = H - 46
  publishLogical(f)
}

const SPEED0 = 300
const SPEED_INC = 17
const SPEED_MAX = 640
const KEY_SPEED = 520

type Mode = 1 | 2
type Phase = 'menu' | 'serve' | 'playing' | 'point' | 'over'
type Side = 0 | 1 // 0 = abajo (azul), 1 = arriba (rosa)

interface Paddle {
  x: number
  v: number
  target: number | null
  hit: number
  w: number
}
interface Game {
  phase: Phase
  paused: boolean
  mode: Mode
  t: number
  pads: [Paddle, Paddle]
  bx: number
  by: number
  vx: number
  vy: number
  speed: number
  trail: { x: number; y: number }[]
  rally: number
  bestRally: number
  pts: [number, number]
  played: number
  server: Side
  timer: number
  base: number // puntos acumulados (modo 1J)
  hits: number
  winner: Side | null
  overT: number
  lastScorer: Side
  banner: { text: string; color: string; t: number } | null
  cpu: { tracking: boolean; timer: number; aim: number; err: number; off: number; v: number }
}

interface Ui {
  phase: Phase
  mode: Mode
  p1: number
  p2: number
  rally: number
  score: number
  level: number
  best: number
  newBest: boolean
  winner: Side | null
  bestRally: number
  hits: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const levelOf = (played: number) => Math.min(5, 1 + Math.floor(played / 2.5))
const multOf = (level: number) => 1 + (level - 1) * 0.25

function newPad(): Paddle {
  return { x: W / 2, v: 0, target: null, hit: 0, w: PW }
}

function newGame(mode: Mode): Game {
  return {
    phase: 'serve',
    paused: false,
    mode,
    t: 0,
    pads: [newPad(), newPad()],
    bx: W / 2,
    by: H / 2,
    vx: 0,
    vy: 0,
    speed: SPEED0,
    trail: [],
    rally: 0,
    bestRally: 0,
    pts: [0, 0],
    played: 0,
    server: 0,
    timer: 1.6,
    base: 0,
    hits: 0,
    winner: null,
    overT: 0,
    lastScorer: 0,
    banner: null,
    cpu: { tracking: false, timer: 0, aim: W / 2, err: 0, off: 0, v: 0 },
  }
}

const initialUi = (best: number): Ui => ({
  phase: 'menu',
  mode: 1,
  p1: 0,
  p2: 0,
  rally: 0,
  score: 0,
  level: 1,
  best,
  newBest: false,
  winner: null,
  bestRally: 0,
  hits: 0,
})

/** Posición X a la que llegará la bola al plano `ty`, con rebotes en paredes. */
function predictX(bx: number, by: number, vx: number, vy: number, ty: number): number {
  if (vy === 0) return bx
  const t = (ty - by) / vy
  const x = bx + vx * t
  const lo = BR
  const span = W - 2 * BR
  let u = (x - lo) % (2 * span)
  if (u < 0) u += 2 * span
  if (u > span) u = 2 * span - u
  return lo + u
}

export default function PongDuelo() {
  const { pressedRef, justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(m: Mode) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Ui>(() => initialUi(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let g = newGame(1)
    g.phase = 'menu'
    let lastMode: Mode = 1
    let best = loadBest(GAME_ID)
    let newBest = false
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let finalScore = 0

    // ---------- sincronía con React ----------
    const level = () => levelOf(g.played)
    const liveScore = () => Math.round(g.base * multOf(level()))
    const sync = () => {
      setUi({
        phase: g.phase,
        mode: g.mode,
        p1: g.pts[0],
        p2: g.pts[1],
        rally: g.rally,
        score: g.phase === 'over' && g.mode === 1 ? finalScore : liveScore(),
        level: level(),
        best,
        newBest,
        winner: g.winner,
        bestRally: g.bestRally,
        hits: g.hits,
      })
    }

    // ---------- entrada ----------
    const held = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
        e.code === 'KeyA' || e.code === 'KeyD' ||
        e.code === 'KeyJ' || e.code === 'KeyL'
      ) held.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
    const toX = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientX - r.left) / r.width) * W
    }
    const toY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientY - r.top) / r.height) * H
    }
    const sideOf = (e: PointerEvent): Side => (g.mode === 1 ? 0 : toY(e) < H / 2 ? 1 : 0)
    const active = new Map<number, Side>()
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase === 'menu' || g.phase === 'over') return
      const s = sideOf(e)
      active.set(e.pointerId, s)
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      g.pads[s].target = toX(e)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (g.phase === 'menu' || g.phase === 'over') return
      if (e.pointerType === 'mouse') {
        g.pads[sideOf(e)].target = toX(e)
        return
      }
      const s = active.get(e.pointerId)
      if (s === undefined) return
      e.preventDefault()
      g.pads[s].target = toX(e)
    }
    const onPointerUp = (e: PointerEvent) => {
      active.delete(e.pointerId)
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const pauseIfPlaying = () => {
      held.clear()
      if (g.phase === 'serve' || g.phase === 'playing' || g.phase === 'point') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) pauseIfPlaying()
    }
    window.addEventListener('blur', pauseIfPlaying)
    document.addEventListener('visibilitychange', onVis)

    // ---------- control de partida ----------
    startRef.current = (m: Mode) => {
      lastMode = m
      newBest = false
      finalScore = 0
      juice.reset()
      active.clear()
      g = newGame(m)
      sync()
    }
    menuRef.current = () => {
      g = newGame(lastMode)
      g.phase = 'menu'
      juice.reset()
      sync()
    }

    const sfxHit = (rally: number) => {
      const f = 300 + Math.min(rally, 24) * 30
      tone({ freq: f, to: f * 1.25, dur: 0.07, type: 'square', vol: 0.06 })
      tone({ freq: f / 2, dur: 0.05, type: 'triangle', vol: 0.05 })
    }
    const sfxWall = () => tone({ freq: 190, to: 140, dur: 0.05, type: 'triangle', vol: 0.06 })
    const sfxPoint = (good: boolean) => {
      if (good) {
        tone({ freq: 392, dur: 0.1, type: 'square', vol: 0.06 })
        tone({ freq: 587, dur: 0.18, type: 'square', vol: 0.06, delay: 0.09 })
      } else {
        tone({ freq: 300, to: 110, dur: 0.35, type: 'sawtooth', vol: 0.06 })
        noise({ dur: 0.15, vol: 0.04 })
      }
    }
    const sfxWin = () => {
      ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.06, delay: i * 0.11 }))
    }
    const sfxTick = (hi: boolean) => tone({ freq: hi ? 880 : 520, dur: 0.07, type: 'square', vol: 0.05 })

    const launch = () => {
      // la bola sale hacia el rival de quien saca
      const toward = g.server === 0 ? -1 : 1
      g.speed = SPEED0 + (level() - 1) * 14
      const ang = (Math.random() - 0.5) * 2 * 0.42
      g.vx = Math.sin(ang) * g.speed
      g.vy = Math.cos(ang) * g.speed * toward
      g.rally = 0
      g.phase = 'playing'
      g.cpu.tracking = false
    }

    const score = (s: Side) => {
      g.pts[s]++
      g.played++
      g.lastScorer = s
      g.phase = 'point'
      g.timer = 1
      juice.shake(0.55)
      juice.flash(s === 0 ? BLUE : PINK, 0.3)
      const px = g.bx
      const py = s === 0 ? 8 : H - 8
      juice.burst(clamp(px, 10, W - 10), py, s === 0 ? BLUE : PINK, { count: 26, speed: 220, life: 0.6, size: 4 })
      juice.text(W / 2, s === 0 ? H * 0.62 : H * 0.38, s === 0 ? 'PUNTO AZUL' : 'PUNTO ROSA', s === 0 ? BLUE : PINK, 14, 1)
      if (g.mode === 1) {
        if (s === 0) {
          g.base += 100
          sfxPoint(true)
        } else sfxPoint(false)
      } else sfxPoint(true)
      g.server = (g.played % 2) as Side
      if (g.pts[s] >= WIN) {
        g.winner = s
        g.timer = 1.1
      }
    }

    const finish = () => {
      g.phase = 'over'
      g.overT = 0
      if (g.mode === 1) {
        if (g.winner === 0) g.base += 500
        finalScore = liveScore()
        newBest = saveBest(GAME_ID, finalScore)
        if (newBest) best = finalScore
      }
      if (g.winner === 0 || g.mode === 2) sfxWin()
      else sfxPoint(false)
      sync()
    }

    const paddleHit = (s: Side) => {
      const p = g.pads[s]
      const off = clamp((g.bx - p.x) / (p.w / 2 + BR), -1, 1)
      const kick = clamp(p.v / 600, -1, 1)
      const ang = clamp(off * 0.95 + kick * 0.3, -1.1, 1.1)
      g.speed = Math.min(SPEED_MAX, g.speed + SPEED_INC)
      const dirY = s === 0 ? -1 : 1
      g.vx = Math.sin(ang) * g.speed
      g.vy = Math.cos(ang) * g.speed * dirY
      g.by = s === 0 ? PAD_BOT - PH / 2 - BR : PAD_TOP + PH / 2 + BR
      g.rally++
      g.bestRally = Math.max(g.bestRally, g.rally)
      p.hit = 1
      const col = s === 0 ? BLUE : PINK
      juice.burst(g.bx, g.by + (s === 0 ? BR : -BR), [col, '#ffffff'], {
        count: 8 + Math.min(10, g.rally),
        speed: 130 + g.rally * 6,
        life: 0.35,
        size: 3,
        angle: s === 0 ? -Math.PI / 2 : Math.PI / 2,
        arc: Math.PI * 0.9,
      })
      juice.shake(0.1 + Math.min(0.25, g.rally * 0.012))
      if (g.speed > SPEED_MAX * 0.7 || g.rally >= 10) juice.freeze(45)
      sfxHit(g.rally)
      if (g.mode === 1 && s === 0) {
        g.hits++
        g.base += 10
        if (g.rally >= 10 && g.rally % 5 === 0) {
          g.base += 50
          juice.text(W / 2, H / 2, `+RALLY ${g.rally}`, '#fde047', 16, 1.1)
          juice.flash('#fde047', 0.12)
        }
      } else if (g.mode === 2 && g.rally >= 10 && g.rally % 5 === 0) {
        juice.text(W / 2, H / 2, `RALLY ${g.rally}`, '#fde047', 16, 1.1)
      }
      if (s === 1) g.cpu.tracking = false
      sync()
    }

    // ---------- CPU ----------
    const updateCpu = (dt: number) => {
      const c = g.cpu
      const p = g.pads[1]
      const lv = level()
      const s = 0.3 + 0.12 * (lv - 1)
      if (g.phase === 'playing' && g.vy < 0) {
        if (!c.tracking) {
          c.tracking = true
          c.err = (Math.random() - 0.5) * 2 * (1 - s) * 60
          c.off = (Math.random() - 0.5) * PW * 0.7
          c.timer = lerp(0.3, 0.08, s)
        }
        c.timer -= dt
        if (c.timer <= 0) {
          c.timer = lerp(0.2, 0.07, s) + Math.random() * 0.05
          const pred = predictX(g.bx, g.by, g.vx, g.vy, PAD_TOP + PH / 2 + BR)
          c.aim = lerp(g.bx, pred, 0.55 + 0.45 * s) + c.err + c.off
        }
      } else {
        c.tracking = false
        c.aim = lerp(c.aim, W / 2, Math.min(1, dt * 1.5))
      }
      const dx = c.aim - p.x
      const maxSp = lerp(230, 410, s)
      const want = Math.abs(dx) < 5 ? 0 : Math.sign(dx) * Math.min(maxSp, Math.abs(dx) * 7)
      c.v += (want - c.v) * Math.min(1, dt * 12)
      p.target = null
      p.x += c.v * dt
    }

    // ---------- actualización ----------
    const movePads = (dt: number) => {
      const dirOf = (l: string[], r: string[]) =>
        (r.some((k) => held.has(k)) ? 1 : 0) - (l.some((k) => held.has(k)) ? 1 : 0)
      const d0 = g.mode === 1
        ? dirOf(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) || (pressedRef.current.has('right') ? 1 : 0) - (pressedRef.current.has('left') ? 1 : 0)
        : dirOf(['ArrowLeft'], ['ArrowRight'])
      const d1 = dirOf(['KeyA', 'KeyJ'], ['KeyD', 'KeyL'])
      for (const s of [0, 1] as Side[]) {
        if (s === 1 && g.mode === 1) {
          updateCpu(dt)
        } else {
          const p = g.pads[s]
          const d = s === 0 ? d0 : d1
          const x0 = p.x
          if (d !== 0) {
            p.target = null
            p.x += d * KEY_SPEED * dt
          } else if (p.target !== null) {
            p.x += (p.target - p.x) * (1 - Math.exp(-dt * 28))
          }
          p.v = lerp(p.v, (p.x - x0) / Math.max(dt, 1e-3), 0.5)
        }
        const p = g.pads[s]
        const half = p.w / 2 + 4
        const before = p.x
        p.x = clamp(p.x, half, W - half)
        if (p.x !== before) p.v = 0
      }
      if (g.mode === 1) {
        // velocidad de la CPU para el efecto
        g.pads[1].v = g.cpu.v
      }
    }

    const stepBall = (dt: number) => {
      const steps = Math.max(1, Math.ceil((g.speed * dt) / 3.5))
      const h = dt / steps
      for (let i = 0; i < steps && g.phase === 'playing'; i++) {
        g.bx += g.vx * h
        g.by += g.vy * h
        if (g.bx < BR) {
          g.bx = BR
          g.vx = Math.abs(g.vx)
          sfxWall()
          juice.burst(BR, g.by, '#ffffff', { count: 4, speed: 70, life: 0.25, size: 2, angle: 0, arc: Math.PI })
        } else if (g.bx > W - BR) {
          g.bx = W - BR
          g.vx = -Math.abs(g.vx)
          sfxWall()
          juice.burst(W - BR, g.by, '#ffffff', { count: 4, speed: 70, life: 0.25, size: 2, angle: Math.PI, arc: Math.PI })
        }
        // paleta de abajo
        if (g.vy > 0 && g.by + BR >= PAD_BOT - PH / 2 && g.by - BR <= PAD_BOT + PH / 2) {
          if (Math.abs(g.bx - g.pads[0].x) <= g.pads[0].w / 2 + BR) {
            paddleHit(0)
            continue
          }
        }
        if (g.vy < 0 && g.by - BR <= PAD_TOP + PH / 2 && g.by + BR >= PAD_TOP - PH / 2) {
          if (Math.abs(g.bx - g.pads[1].x) <= g.pads[1].w / 2 + BR) {
            paddleHit(1)
            continue
          }
        }
        if (g.by < -BR * 2) {
          score(0)
          sync()
        } else if (g.by > H + BR * 2) {
          score(1)
          sync()
        }
      }
    }

    const update = (dt: number) => {
      g.t += dt
      for (const p of g.pads) p.hit = Math.max(0, p.hit - dt * 5)
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      if (g.phase === 'menu') return
      if (g.phase === 'over') {
        g.overT += dt
        return
      }
      movePads(dt)
      if (g.phase === 'serve') {
        const before = Math.ceil(g.timer / 0.5)
        g.timer -= dt
        const after = Math.ceil(g.timer / 0.5)
        if (after !== before && after > 0) sfxTick(false)
        g.bx = W / 2
        g.by = H / 2
        g.trail.length = 0
        if (g.timer <= 0) {
          sfxTick(true)
          launch()
        }
      } else if (g.phase === 'playing') {
        stepBall(dt)
        g.trail.push({ x: g.bx, y: g.by })
        if (g.trail.length > 14) g.trail.shift()
      } else if (g.phase === 'point') {
        g.timer -= dt
        if (g.trail.length) g.trail.shift()
        if (g.timer <= 0) {
          if (g.winner !== null) finish()
          else {
            g.phase = 'serve'
            g.timer = 1.6
            g.rally = 0
            sync()
          }
        }
      }
    }

    // ---------- dibujo ----------
    const drawPaddle = (s: Side) => {
      const p = g.pads[s]
      const y = s === 0 ? PAD_BOT : PAD_TOP
      const col = s === 0 ? BLUE : PINK
      const sq = p.hit
      const w = p.w * (1 + sq * 0.12)
      const h = PH * (1 - sq * 0.25)
      ctx.save()
      ctx.shadowColor = col
      ctx.shadowBlur = 10 + sq * 14
      ctx.fillStyle = sq > 0.3 ? '#ffffff' : col
      rr(ctx, p.x - w / 2, y - h / 2, w, h, 5)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      rr(ctx, p.x - w / 2 + 4, y - h / 2 + 1.5, w - 8, 2, 1)
      ctx.fill()
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      // fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#150a1c')
      bg.addColorStop(0.5, '#080b16')
      bg.addColorStop(1, '#0a1226')
      ctx.fillStyle = bg
      ctx.fillRect(-12, -12, W + 24, H + 24)
      // rejilla suave
      ctx.strokeStyle = 'rgba(148,163,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x <= W; x += 30) {
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, H)
      }
      for (let y = 0; y <= H; y += 30) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(W, y + 0.5)
      }
      ctx.stroke()
      // paredes neón
      ctx.fillStyle = 'rgba(96,165,250,0.35)'
      ctx.fillRect(0, 0, 2, H)
      ctx.fillRect(W - 2, 0, 2, H)
      // línea central
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, 38, 0, Math.PI * 2)
      ctx.stroke()

      // marcador grande tenue
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `44px ${pf}`
      ctx.fillStyle = 'rgba(244,114,182,0.16)'
      ctx.fillText(String(g.pts[1]), W / 2, H / 2 - 130)
      ctx.fillStyle = 'rgba(96,165,250,0.16)'
      ctx.fillText(String(g.pts[0]), W / 2, H / 2 + 130)

      if (g.phase !== 'menu') {
        // estela
        for (let i = 0; i < g.trail.length; i++) {
          const t = g.trail[i]
          const k = (i + 1) / g.trail.length
          ctx.globalAlpha = k * 0.35
          ctx.fillStyle = g.vy > 0 ? BLUE : PINK
          ctx.beginPath()
          ctx.arc(t.x, t.y, BR * (0.35 + k * 0.6), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        drawPaddle(1)
        drawPaddle(0)
        // bola
        if (g.phase === 'serve' || g.phase === 'playing') {
          const fast = clamp((g.speed - SPEED0) / (SPEED_MAX - SPEED0), 0, 1)
          ctx.save()
          ctx.shadowColor = fast > 0.6 ? '#fde047' : '#ffffff'
          ctx.shadowBlur = 12 + fast * 8
          ctx.fillStyle = '#ffffff'
          const pulse = g.phase === 'serve' ? 1 + Math.sin(g.t * 12) * 0.08 : 1
          ctx.beginPath()
          ctx.arc(g.bx, g.by, BR * pulse, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        // rally
        if (g.phase === 'playing' && g.rally >= 3) {
          ctx.font = `10px ${pf}`
          ctx.fillStyle = 'rgba(253,224,71,0.8)'
          ctx.fillText(`RALLY ${g.rally}`, W / 2, H / 2 + 54)
        }
        // cuenta regresiva
        if (g.phase === 'serve') {
          const n = Math.max(1, Math.ceil(g.timer / 0.5))
          const frac = 1 - ((g.timer / 0.5) % 1)
          ctx.globalAlpha = 0.9 - frac * 0.5
          ctx.font = `${Math.round(40 + (1 - frac) * 10)}px ${pf}`
          ctx.fillStyle = '#ffffff'
          ctx.fillText(String(Math.min(3, n)), W / 2, H / 2 + (g.server === 0 ? -70 : 70))
          ctx.globalAlpha = 1
        }
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(4,6,14,0.72)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `24px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `9px ${pf}`
        ctx.fillText('P o toca para seguir', W / 2, H / 2 + 22)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // ---------- bucle ----------
    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** Las paletas y la bola se corren al centro nuevo; la paleta de abajo y la de arriba van pegadas a sus bordes. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layout()
      if (W === oldW && H === oldH) return
      const dx = (W - oldW) / 2
      setupCanvas(canvas, W, H)

      for (const p of g.pads) {
        const half = p.w / 2 + 4
        p.x = clamp(p.x + dx, half, W - half)
        if (p.target !== null) p.target = clamp(p.target + dx, half, W - half)
      }
      g.cpu.aim = clamp(g.cpu.aim + dx, 0, W)
      g.bx = clamp(g.bx + dx, BR, W - BR)
      // la bola sigue entre las dos paletas, que ahora están en otra posición vertical
      g.by = clamp(g.by, PAD_TOP + BR, PAD_BOT - BR)
      for (const t of g.trail) {
        t.x = clamp(t.x + dx, 0, W)
        t.y = clamp(t.y, 0, H)
      }
      for (const pt of juice.particles) pt.x += dx
      for (const t of juice.texts) t.x += dx

      pauseIfPlaying()
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      const jp = justPressedRef.current
      if (jp.has('pause') && (g.phase === 'serve' || g.phase === 'playing' || g.phase === 'point')) {
        g.paused = !g.paused
        if (g.paused) held.clear()
      }
      if (jp.has('action')) {
        if (g.phase === 'menu') startRef.current(lastMode)
        else if (g.phase === 'over' && g.overT > 0.5) startRef.current(lastMode)
        else if (g.paused) g.paused = false
      }
      jp.clear()
      if (!g.paused) {
        const dtGame = juice.update(dt)
        if (dtGame > 0) update(dtGame)
      }
      draw()
    }
    raf = requestAnimationFrame((t) => {
      sync()
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pauseIfPlaying)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, pressedRef])

  const two = ui.mode === 2
  const winnerTitle = ui.winner === 0 ? 'GANA AZUL' : 'GANA ROSA'
  // `ranked` lo añade el coordinador al overlay; en 2J no se publica.
  const noRank = { ranked: false }

  const hud = (
    <Hud>
      {two && ui.phase !== 'menu' ? (
        <>
          <span style={{ color: BLUE }}>AZUL {ui.p1}</span>
          <span className="text-white/60">A {WIN}</span>
          <span style={{ color: PINK }}>ROSA {ui.p2}</span>
        </>
      ) : (
        <>
          <span style={{ color: BLUE }}>PTS {ui.score}</span>
          <span className="text-white/70">
            {ui.p1}-{ui.p2} · NV {ui.level}
          </span>
          <span className="text-white/60">MEJOR {ui.best}</span>
        </>
      )}
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={360}
        height={560}
        className="rounded-xl border border-blue-400/30 bg-[#080b16]"
        hud={hud}
      >
        <canvas ref={canvasRef} className="block h-full w-full touch-none select-none object-contain" style={{ touchAction: 'none' }} />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="DUELO PONG"
            accent={ACCENT}
            subtitle="Primero en llegar a 7 gana."
            hint="Elige un modo o pulsa ESPACIO"
            touchHint="Elige un modo"
          >
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  startRef.current(1)
                }}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
                style={{ background: BLUE, boxShadow: `0 0 24px ${BLUE}66` }}
              >
                1 jugador
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  startRef.current(2)
                }}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
                style={{ background: PINK, boxShadow: `0 0 24px ${PINK}66` }}
              >
                2 jugadores
              </button>
            </div>
            <p className="max-w-[17rem] text-[11px] leading-relaxed text-white/60">
              Azul (abajo): flechas ← → o ratón. Rosa (arriba, solo 2J): A / D o J / L. En el celular, arrastra un dedo en cada mitad.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <>
            <GameOverOverlay
              title={two ? winnerTitle : ui.winner === 0 ? 'VICTORIA' : 'DERROTA'}
              accent={two ? (ui.winner === 0 ? BLUE : PINK) : ACCENT}
              score={two ? Math.max(ui.p1, ui.p2) : ui.score}
              best={two ? 0 : ui.best}
              newBest={!two && ui.newBest}
              stats={[
                { label: 'Marcador', value: `${ui.p1} - ${ui.p2}` },
                { label: 'Mejor rally', value: ui.bestRally },
                ...(two ? [] : [{ label: 'Nivel', value: ui.level }]),
              ]}
              onRestart={() => startRef.current(ui.mode)}
              {...(two ? noRank : {})}
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                menuRef.current()
              }}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs text-white/70 transition active:scale-95"
            >
              Cambiar modo
            </button>
          </>
        )}
      </GameScreen>
    </div>
  )
}
