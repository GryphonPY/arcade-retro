'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, rr, renderScale, setupCanvas } from './game-utils'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameScreen } from './game-screen'
import { Hud, StartOverlay, GameOverOverlay } from './overlay'
import { Juice } from './juice'
import { sfx, tone } from './sfx'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const GAME_ID = 'brick-breaker'
const W0 = 400
const H0 = 520
// Mundo lógico: se ajusta a la pantalla al abrir el juego y en cada partida (ver layout).
let W = W0
let H = H0
const TOP = 30 // franja superior con vidas / nivel / combo
const BCOLS = 8
const BW = 40
const BH = 16
const BGX = 4
const BGY = 4
let BX0 = (W0 - (BCOLS * BW + (BCOLS - 1) * BGX)) / 2
const BTOP = 88
let PY = H0 - 58
const PH = 12
const PW0 = 78
const PW_WIDE = 126
const R = 6.5
const BLAST_R = 56
const START_LIVES = 3
const MAX_LIVES = 5
const MAX_BALLS = 6

const ROW_COLORS = ['#F8A8C0', '#FFC98A', '#FFE787', '#A8E0C0', '#CDB4E8']
const ROW_POINTS = [50, 40, 30, 20, 10]
const HP_COLORS: Record<number, string> = { 3: '#7b72c9', 2: '#8fb0e8', 1: '#cfe0fa' }

const INK = '#8D7B62'
const MINT = '#7DD8B7'
const CORAL = '#FF8A7A'
const ROSE = '#E8899E'

type Power = 'wide' | 'multi' | 'fire' | 'laser' | 'sticky' | 'slow' | 'life'
type TimedPower = 'wide' | 'fire' | 'laser' | 'sticky' | 'slow'
type Kind = 'n' | 'm' | 'x' | 'b'
type Phase = 'ready' | 'playing' | 'clear' | 'dying' | 'over'
type UiPhase = 'ready' | 'playing' | 'over'

const POWERS: Record<Power, { color: string; label: string; dur: number; weight: number }> = {
  wide: { color: '#4fc79e', label: 'ANCHA', dur: 12, weight: 20 },
  multi: { color: '#f2a93b', label: 'MULTIBOLA', dur: 0, weight: 18 },
  fire: { color: '#ff7a3d', label: 'FUEGO', dur: 8, weight: 12 },
  laser: { color: '#e5484d', label: 'LASER', dur: 10, weight: 14 },
  sticky: { color: '#a98bec', label: 'PEGAJOSA', dur: 12, weight: 14 },
  slow: { color: '#4fb0e8', label: 'LENTA', dur: 8, weight: 12 },
  life: { color: '#ff6f9c', label: '+1 VIDA', dur: 0, weight: 5 },
}
const TIMED: TimedPower[] = ['wide', 'fire', 'laser', 'sticky', 'slow']
const POWER_KEYS = Object.keys(POWERS) as Power[]

// a-e = ladrillo normal (color/puntos por letra), 2/3 = varios golpes,
// X = indestructible, B = explosivo, . = vacío
const PATTERNS: string[][] = [
  ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'dddddddd'],
  ['...aa...', '..bbbb..', '.cccccc.', 'dddddddd', '.eeeeee.', '..dddd..'],
  ['a2a2a2a2', '2b2b2b2b', 'c2c2c2c2', '2d2d2d2d', 'e2e2e2e2'],
  ['X.aaaa.X', 'X.bbbb.X', 'X.2222.X', 'X.cccc.X', '..dddd..', '..eeee..'],
  ['cccBBccc', 'bb2222bb', 'aaBccBaa', '.2dddd2.', '..eeee..'],
  ['XXX..XXX', 'a222222a', 'b3bBBb3b', 'c222222c', 'dddddddd'],
  ['.aa..aa.', 'a3aaaa3a', 'aaaaaaaa', 'a2aaaa2a', '.aaBBaa.', '..aaaa..', '...aa...'],
  ['aaaaaaaa', 'XXX..XXX', 'bbbbbbbb', '..XXXX..', 'cccccccc', '3333B333'],
]

function genLevel(level: number): string[] {
  const rows = 6 + (level % 3)
  const out: string[] = []
  const pM = Math.min(0.5, 0.2 + 0.03 * (level - 8))
  for (let r = 0; r < rows; r++) {
    let half = ''
    for (let c = 0; c < BCOLS / 2; c++) {
      const x = Math.random()
      if (x < 0.09) half += 'X'
      else if (x < 0.17) half += 'B'
      else if (x < 0.17 + pM) half += Math.random() < 0.35 ? '3' : '2'
      else if (x < 0.17 + pM + 0.1) half += '.'
      else half += 'abcde'[r % 5]
    }
    out.push(half + half.split('').reverse().join(''))
  }
  return out
}

interface Brick {
  x: number
  y: number
  cx: number
  cy: number
  kind: Kind
  hp: number
  maxHp: number
  color: string
  points: number
  alive: boolean
  flash: number
  bump: number
  appearAt: number
}
interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  stuck: boolean
  stickOff: number
  trail: { x: number; y: number }[]
}
interface Capsule {
  x: number
  y: number
  kind: Power
  t: number
}
interface Boom {
  x: number
  y: number
  t: number
}
interface Ring {
  x: number
  y: number
  t: number
  max: number
  color: string
}
interface Laser {
  x: number
  y: number
}

interface BS {
  phase: Phase
  paused: boolean
  t: number
  padCx: number
  padTx: number
  padW: number
  padVx: number
  squash: number
  balls: Ball[]
  bricks: Brick[]
  capsules: Capsule[]
  lasers: Laser[]
  booms: Boom[]
  rings: Ring[]
  lives: number
  level: number
  score: number
  broken: number
  combo: number
  maxMult: number
  multPop: number
  ramp: number
  speed: number
  fx: Record<TimedPower, number>
  laserCd: number
  autoLaunch: number
  clearT: number
  dyingT: number
  banner: { text: string; sub?: string; t: number } | null
  newBest: boolean
}

// ---------------------------------------------------------------------------
// Construcción de niveles
// ---------------------------------------------------------------------------

function buildBricks(level: number, now: number): Brick[] {
  const rows = level <= PATTERNS.length ? PATTERNS[level - 1] : genLevel(level)
  const out: Brick[] = []
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < BCOLS; c++) {
      const ch = rows[r][c]
      if (!ch || ch === '.') continue
      const x = BX0 + c * (BW + BGX)
      const y = BTOP + r * (BH + BGY)
      let kind: Kind = 'n'
      let hp = 1
      let color = '#F8A8C0'
      let points = 10
      if (ch >= 'a' && ch <= 'e') {
        const i = ch.charCodeAt(0) - 97
        color = ROW_COLORS[i]
        points = ROW_POINTS[i]
      } else if (ch === '2' || ch === '3') {
        kind = 'm'
        hp = Number(ch)
        color = HP_COLORS[hp]
        points = 35 * hp
      } else if (ch === 'X') {
        kind = 'x'
        hp = 99
        color = '#aeb4be'
        points = 0
      } else if (ch === 'B') {
        kind = 'b'
        color = '#ff8a65'
        points = 30
      }
      out.push({
        x,
        y,
        cx: x + BW / 2,
        cy: y + BH / 2,
        kind,
        hp,
        maxHp: hp,
        color,
        points,
        alive: true,
        flash: 0,
        bump: 0,
        appearAt: now + 0.1 + r * 0.07 + c * 0.015,
      })
    }
  }
  return out
}

/** Ajusta el mundo lógico al área de la pantalla y recalcula lo que depende de su tamaño. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  BX0 = (W - (BCOLS * BW + (BCOLS - 1) * BGX)) / 2
  PY = H - 58
  publishLogical(f)
}

const newBall = (cx: number): Ball => ({ x: cx, y: PY - R - 1, vx: 0, vy: 0, stuck: true, stickOff: 0, trail: [] })

function initial(): BS {
  return {
    phase: 'ready',
    paused: false,
    t: 0,
    padCx: W / 2,
    padTx: W / 2,
    padW: PW0,
    padVx: 0,
    squash: 0,
    balls: [newBall(W / 2)],
    bricks: buildBricks(1, 0),
    capsules: [],
    lasers: [],
    booms: [],
    rings: [],
    lives: START_LIVES,
    level: 1,
    score: 0,
    broken: 0,
    combo: 0,
    maxMult: 1,
    multPop: 0,
    ramp: 0,
    speed: 330,
    fx: { wide: 0, fire: 0, laser: 0, sticky: 0, slow: 0 },
    laserCd: 0,
    autoLaunch: 0,
    clearT: 0,
    dyingT: 0,
    banner: null,
    newBest: false,
  }
}

const multOf = (combo: number) => Math.min(6, 1 + Math.floor(combo / 4))
const targetSpeed = (s: BS) => Math.min(560, 330 + (s.level - 1) * 18 + s.ramp) * (s.fx.slow > 0 ? 0.72 : 1)

function pickPower(lives: number): Power {
  let total = 0
  for (const k of POWER_KEYS) total += k === 'life' && lives >= MAX_LIVES ? 0 : POWERS[k].weight
  let r = Math.random() * total
  for (const k of POWER_KEYS) {
    const w = k === 'life' && lives >= MAX_LIVES ? 0 : POWERS[k].weight
    if (r < w) return k
    r -= w
  }
  return 'wide'
}

/** Mantiene la velocidad y evita ángulos casi horizontales o verticales (bucles infinitos). */
function fixBall(b: Ball, speed: number) {
  let sp = Math.hypot(b.vx, b.vy)
  if (sp < 1) {
    b.vx = 0
    b.vy = -speed
    sp = speed
  }
  let vx = (b.vx / sp) * speed
  let vy = (b.vy / sp) * speed
  const minVy = speed * 0.3
  if (Math.abs(vy) < minVy) {
    vy = (vy >= 0 ? 1 : -1) * minVy
    vx = (vx >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, speed * speed - vy * vy))
  }
  const minVx = speed * 0.12
  if (Math.abs(vx) < minVx) {
    vx = (vx === 0 ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(vx)) * minVx
    vy = (vy >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, speed * speed - vx * vx))
  }
  b.vx = vx
  b.vy = vy
}

// ---------------------------------------------------------------------------
// Dibujo auxiliar
// ---------------------------------------------------------------------------

function drawPowerIcon(ctx: CanvasRenderingContext2D, kind: Power, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.3, r * 0.28)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'wide') {
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx - r * 0.45, cy - r * 0.55)
    ctx.lineTo(cx - r, cy)
    ctx.lineTo(cx - r * 0.45, cy + r * 0.55)
    ctx.moveTo(cx + r * 0.45, cy - r * 0.55)
    ctx.lineTo(cx + r, cy)
    ctx.lineTo(cx + r * 0.45, cy + r * 0.55)
    ctx.stroke()
  } else if (kind === 'multi') {
    for (const [dx, dy] of [[-0.7, 0.45], [0.7, 0.45], [0, -0.6]]) {
      ctx.beginPath()
      ctx.arc(cx + dx * r, cy + dy * r, r * 0.38, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'fire') {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.quadraticCurveTo(cx + r * 1.05, cy + r * 0.1, cx, cy + r)
    ctx.quadraticCurveTo(cx - r * 1.05, cy + r * 0.1, cx, cy - r)
    ctx.fill()
  } else if (kind === 'laser') {
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.6, cy + r)
    ctx.lineTo(cx - r * 0.6, cy - r * 0.2)
    ctx.moveTo(cx + r * 0.6, cy + r)
    ctx.lineTo(cx + r * 0.6, cy - r * 0.2)
    ctx.moveTo(cx - r * 0.6, cy - r)
    ctx.lineTo(cx - r * 0.6, cy - r * 0.55)
    ctx.moveTo(cx + r * 0.6, cy - r)
    ctx.lineTo(cx + r * 0.6, cy - r * 0.55)
    ctx.stroke()
  } else if (kind === 'sticky') {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.2, cx + r * 0.7, cy + r * 0.45)
    ctx.arc(cx, cy + r * 0.3, r * 0.72, 0.3, Math.PI - 0.3)
    ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.2, cx, cy - r)
    ctx.fill()
  } else if (kind === 'slow') {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 0.6)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + r * 0.45, cy + r * 0.25)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(cx, cy + r * 0.95)
    ctx.bezierCurveTo(cx - r * 1.5, cy, cx - r * 0.9, cy - r * 1.1, cx, cy - r * 0.35)
    ctx.bezierCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.5, cy, cx, cy + r * 0.95)
    ctx.fill()
  }
  ctx.restore()
}

function drawHeart(ctx: CanvasRenderingContext2D, hx: number, hy: number, color: string, k = 1) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(hx - 3.2 * k, hy - 1.5 * k, 4.2 * k, 0, Math.PI * 2)
  ctx.arc(hx + 3.2 * k, hy - 1.5 * k, 4.2 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(hx - 7.2 * k, hy + 0.5 * k)
  ctx.quadraticCurveTo(hx, hy + 11 * k, hx + 7.2 * k, hy + 0.5 * k)
  ctx.fill()
}

function buildBg(): HTMLCanvasElement {
  const dpr = renderScale()
  const c = document.createElement('canvas')
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  const g = c.getContext('2d')
  if (!g) return c
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#FDF7EA')
  grad.addColorStop(1, '#F6E6CC')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(210,180,150,0.22)'
  for (let y = 20; y < H; y += 26) {
    for (let x = 20 + ((y / 26) % 2) * 13; x < W; x += 26) {
      g.beginPath()
      g.arc(x, y, 1.6, 0, Math.PI * 2)
      g.fill()
    }
  }
  // zona de peligro bajo la paleta
  const d = g.createLinearGradient(0, H - 46, 0, H)
  d.addColorStop(0, 'rgba(255,138,122,0)')
  d.addColorStop(1, 'rgba(255,138,122,0.22)')
  g.fillStyle = d
  g.fillRect(0, H - 46, W, 46)
  // franja superior
  g.fillStyle = 'rgba(141,123,98,0.10)'
  g.fillRect(0, 0, W, TOP)
  g.fillStyle = 'rgba(141,123,98,0.28)'
  g.fillRect(0, TOP - 1, W, 2)
  return c
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface Actions {
  begin: () => void
  restart: () => void
  launch: () => void
}

export default function BrickBreaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<UiPhase>('ready')
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ level: 1, broken: 0, mult: 1 })

  const stateRef = useRef<BS>(initial())
  const actionsRef = useRef<Actions | null>(null)
  const dragRef = useRef<{ id: number; x: number; cx: number; t: number; moved: boolean } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest(GAME_ID))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)

    const pixelFont =
      getComputedStyle(canvas).getPropertyValue('--font-pixel').trim() || '"Press Start 2P", monospace'
    const font = (px: number) => `${px}px ${pixelFont}`

    const juice = new Juice(6)
    const bg = buildBg()
    stateRef.current = initial()

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()

    // ---- lógica ----------------------------------------------------------

    const padLeft = () => stateRef.current.padCx - stateRef.current.padW / 2

    const addScore = (pts: number) => {
      const s = stateRef.current
      s.score += pts
      setScore(s.score)
    }

    const bumpCombo = () => {
      const s = stateRef.current
      const before = multOf(s.combo)
      s.combo += 1
      s.ramp = Math.min(90, s.ramp + 1.4)
      const m = multOf(s.combo)
      s.maxMult = Math.max(s.maxMult, m)
      if (m > before) {
        s.multPop = 0.5
        juice.text(W / 2, TOP + 44, `x${m} COMBO`, m >= 4 ? '#e8a317' : ROSE, 13, 1.1)
        juice.shake(0.12)
        tone({ freq: 500 + m * 80, to: 900 + m * 110, dur: 0.12, vol: 0.045, type: 'triangle', delay: 0.04 })
      }
    }

    const launchBall = (b: Ball) => {
      const s = stateRef.current
      b.stuck = false
      let a = (b.stickOff / (s.padW / 2)) * 0.85
      if (Math.abs(a) < 0.22) a = (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.25)
      const sp = s.speed
      b.vx = Math.sin(a) * sp
      b.vy = -Math.cos(a) * sp
      fixBall(b, sp)
      b.trail.length = 0
    }

    const launchAll = () => {
      const s = stateRef.current
      let any = false
      for (const b of s.balls) {
        if (b.stuck) {
          launchBall(b)
          any = true
        }
      }
      if (any) {
        s.autoLaunch = 0
        tone({ freq: 360, to: 760, dur: 0.1, vol: 0.04, type: 'triangle' })
      }
    }

    const spawnCapsule = (x: number, y: number, chance: number) => {
      const s = stateRef.current
      if (s.capsules.length >= 3 || Math.random() > chance) return
      s.capsules.push({ x, y, kind: pickPower(s.lives), t: 0 })
    }

    const detonate = (x: number, y: number) => {
      const s = stateRef.current
      s.rings.push({ x, y, t: 0, max: BLAST_R + 14, color: '#ff8a65' })
      juice.burst(x, y, ['#ff8a65', '#ffc98a', '#ffe787', '#ffffff'], {
        count: 26,
        speed: 220,
        life: 0.6,
        size: 4.5,
        drag: 2.2,
        gravity: 200,
      })
      juice.shake(0.55)
      juice.freeze(70)
      juice.flash('#ffd7a8', 0.35)
      sfx.explode()
      for (let i = 0; i < s.bricks.length; i++) {
        const o = s.bricks[i]
        if (!o.alive || o.kind === 'x') continue
        if (Math.hypot(o.cx - x, o.cy - y) <= BLAST_R) hitBrick(i, 2)
      }
    }

    const breakBrick = (i: number) => {
      const s = stateRef.current
      const b = s.bricks[i]
      b.alive = false
      s.broken += 1
      bumpCombo()
      const m = multOf(s.combo)
      const pts = b.points * m
      addScore(pts)
      juice.burst(b.cx, b.cy, [b.color, b.color, '#ffffff'], { count: 9, speed: 150, life: 0.55, size: 4, gravity: 420, drag: 1.2 })
      if (juice.texts.length < 7) juice.text(b.cx, b.cy - 6, `+${pts}`, m > 1 ? '#d99a1d' : INK, m > 1 ? 11 : 9, 0.7)
      juice.shake(b.kind === 'm' ? 0.16 : 0.1)
      if (b.kind === 'b') {
        s.booms.push({ x: b.cx, y: b.cy, t: 0.07 })
      } else {
        tone({ freq: 520 + Math.min(s.combo, 16) * 30, dur: 0.07, vol: 0.04 })
      }
      spawnCapsule(b.cx, b.cy, b.kind === 'b' ? 0.3 : b.kind === 'm' ? 0.22 : 0.13)
    }

    /** Aplica daño; devuelve true si el ladrillo cayó. */
    function hitBrick(i: number, dmg: number): boolean {
      const s = stateRef.current
      const b = s.bricks[i]
      if (!b.alive) return false
      if (b.kind === 'x') {
        b.flash = 0.6
        b.bump = 1
        juice.burst(b.cx, b.cy, ['#ffffff', '#d3d8e0'], { count: 4, speed: 80, life: 0.25, size: 2.2 })
        tone({ freq: 1500, to: 950, dur: 0.05, vol: 0.03, type: 'square' })
        return false
      }
      b.hp -= dmg
      b.flash = 1
      b.bump = 1
      if (b.hp <= 0) {
        breakBrick(i)
        return true
      }
      if (b.kind === 'm') b.color = HP_COLORS[Math.max(1, b.hp)]
      bumpCombo()
      const m = multOf(s.combo)
      addScore(10 * m)
      juice.burst(b.cx, b.cy, [b.color, '#ffffff'], { count: 4, speed: 90, life: 0.3, size: 3, gravity: 200 })
      tone({ freq: 300 + b.hp * 60, dur: 0.06, vol: 0.04, type: 'square' })
      return false
    }

    const loseLife = () => {
      const s = stateRef.current
      s.lives -= 1
      s.combo = 0
      s.ramp *= 0.5
      s.capsules.length = 0
      s.lasers.length = 0
      s.fx = { wide: 0, fire: 0, laser: 0, sticky: 0, slow: 0 }
      juice.shake(0.7)
      juice.freeze(110)
      juice.flash('#ff6b6b', 0.28)
      sfx.hurt()
      if (s.lives <= 0) {
        s.phase = 'dying'
        s.dyingT = 0
        s.balls.length = 0
        juice.burst(s.padCx, PY + 6, [MINT, '#ffffff', '#7dd8b7', ROSE], { count: 36, speed: 260, life: 0.9, size: 5, gravity: 260, drag: 1.4 })
        juice.shake(0.9)
        sfx.crash()
        if (saveBest(GAME_ID, s.score)) s.newBest = true
      } else {
        s.balls = [newBall(s.padCx)]
        s.speed = targetSpeed(s)
        s.autoLaunch = 1.5
        s.banner = { text: s.lives === 1 ? 'ULTIMA VIDA' : `${s.lives} VIDAS`, t: 1.3 }
      }
    }

    const applyPower = (kind: Power, x: number, y: number) => {
      const s = stateRef.current
      const p = POWERS[kind]
      juice.text(x, y - 12, p.label, p.color, 10, 1.1)
      juice.burst(x, y, [p.color, '#ffffff'], { count: 14, speed: 140, life: 0.5, size: 3.5 })
      juice.flash(p.color, 0.15)
      if (kind === 'life') {
        s.lives = Math.min(MAX_LIVES, s.lives + 1)
        sfx.potion()
      } else if (kind === 'multi') {
        const flying = s.balls.filter((b) => !b.stuck)
        const src = flying.length ? flying : s.balls
        const extra: Ball[] = []
        for (const b of src) {
          for (const rot of [-0.42, 0.42]) {
            if (s.balls.length + extra.length >= MAX_BALLS) break
            const c = Math.cos(rot)
            const sn = Math.sin(rot)
            extra.push({
              x: b.x,
              y: b.y,
              vx: b.vx * c - b.vy * sn,
              vy: b.vx * sn + b.vy * c,
              stuck: b.stuck,
              stickOff: b.stickOff + rot * 20,
              trail: [],
            })
          }
        }
        for (const e of extra) {
          fixBall(e, s.speed)
          s.balls.push(e)
        }
        sfx.power()
      } else {
        s.fx[kind] = p.dur
        if (kind === 'laser') s.laserCd = 0
        sfx.power()
      }
    }

    /** Un sub-paso de física para una bola. Devuelve false si la bola se perdió. */
    const stepBall = (b: Ball, h: number): boolean => {
      const s = stateRef.current
      b.x += b.vx * h
      b.y += b.vy * h
      const fire = s.fx.fire > 0

      // paredes y techo
      if (b.x < R) {
        b.x = R
        b.vx = Math.abs(b.vx)
        tone({ freq: 240, dur: 0.03, vol: 0.02, type: 'triangle' })
      } else if (b.x > W - R) {
        b.x = W - R
        b.vx = -Math.abs(b.vx)
        tone({ freq: 240, dur: 0.03, vol: 0.02, type: 'triangle' })
      }
      if (b.y < TOP + R) {
        b.y = TOP + R
        b.vy = Math.abs(b.vy)
        fixBall(b, s.speed)
        tone({ freq: 300, dur: 0.04, vol: 0.025, type: 'triangle' })
      }

      // paleta
      const pl = padLeft()
      if (
        b.vy > 0 &&
        b.y + R >= PY &&
        b.y <= PY + PH * 0.75 &&
        b.x >= pl - R * 0.7 &&
        b.x <= pl + s.padW + R * 0.7
      ) {
        b.y = PY - R
        const off = Math.max(-1, Math.min(1, (b.x - s.padCx) / (s.padW / 2)))
        s.combo = 0
        s.squash = 1
        juice.burst(b.x, PY, [MINT, '#ffffff'], { count: 5, speed: 70, life: 0.25, size: 2.5, angle: -Math.PI / 2, arc: 2.4 })
        if (s.fx.sticky > 0) {
          b.stuck = true
          b.stickOff = off * (s.padW / 2)
          b.vx = 0
          b.vy = 0
          tone({ freq: 220, to: 160, dur: 0.1, vol: 0.04, type: 'sine' })
          return true
        }
        let a = off * 1.05 + Math.max(-0.18, Math.min(0.18, s.padVx * 0.0004))
        a = Math.max(-1.15, Math.min(1.15, a))
        b.vx = Math.sin(a) * s.speed
        b.vy = -Math.cos(a) * s.speed
        fixBall(b, s.speed)
        tone({ freq: 420 + Math.abs(off) * 90, dur: 0.05, vol: 0.04, type: 'triangle' })
      }

      // ladrillos
      let best = -1
      let bestD = Infinity
      let bpx = 0
      let bpy = 0
      for (let i = 0; i < s.bricks.length; i++) {
        const k = s.bricks[i]
        if (!k.alive) continue
        if (b.x < k.x - R || b.x > k.x + BW + R || b.y < k.y - R || b.y > k.y + BH + R) continue
        const px = Math.max(k.x, Math.min(b.x, k.x + BW))
        const py = Math.max(k.y, Math.min(b.y, k.y + BH))
        const d2 = (b.x - px) ** 2 + (b.y - py) ** 2
        if (d2 < R * R && d2 < bestD) {
          bestD = d2
          best = i
          bpx = px
          bpy = py
        }
      }
      if (best >= 0) {
        const k = s.bricks[best]
        const pierce = fire && k.kind !== 'x'
        let nx: number
        let ny: number
        const dist = Math.sqrt(bestD)
        if (dist > 1e-4) {
          nx = (b.x - bpx) / dist
          ny = (b.y - bpy) / dist
        } else {
          // el centro quedó dentro: sacar por el eje de menor penetración
          const l = b.x - k.x
          const r = k.x + BW - b.x
          const t = b.y - k.y
          const bt = k.y + BH - b.y
          const m = Math.min(l, r, t, bt)
          nx = m === l ? -1 : m === r ? 1 : 0
          ny = m === t ? -1 : m === bt ? 1 : 0
          if (nx !== 0) ny = 0
        }
        if (!pierce) {
          const dot = b.vx * nx + b.vy * ny
          if (dot < 0) {
            b.vx -= 2 * dot * nx
            b.vy -= 2 * dot * ny
          }
          b.x = bpx + nx * (R + 0.05)
          b.y = bpy + ny * (R + 0.05)
          if (k.kind === 'x') {
            const j = (Math.random() - 0.5) * 0.08
            const c = Math.cos(j)
            const sn = Math.sin(j)
            const vx = b.vx * c - b.vy * sn
            b.vy = b.vx * sn + b.vy * c
            b.vx = vx
          }
          fixBall(b, s.speed)
        }
        hitBrick(best, pierce ? 3 : 1)
        if (pierce) juice.freeze(12)
      }

      if (b.y > H + R + 8) return false
      return true
    }

    // ---- control de fases ------------------------------------------------

    const startLevel = (level: number) => {
      const s = stateRef.current
      s.level = level
      s.bricks = buildBricks(level, s.t)
      s.balls = [newBall(s.padCx)]
      s.capsules.length = 0
      s.lasers.length = 0
      s.booms.length = 0
      s.fx = { wide: 0, fire: 0, laser: 0, sticky: 0, slow: 0 }
      s.combo = 0
      s.ramp = 0
      s.speed = targetSpeed(s)
      s.autoLaunch = 1.6
      s.phase = 'playing'
      s.banner = { text: `NIVEL ${level}`, sub: level === 1 ? 'Rompe todos los ladrillos' : undefined, t: 1.6 }
    }

    const begin = () => {
      if (stateRef.current.phase !== 'ready') return
      startLevel(1)
      setPhase('playing')
      sfx.start()
    }

    const restart = () => {
      stateRef.current = initial()
      juice.reset()
      dragRef.current = null
      startLevel(1)
      setScore(0)
      setNewBest(false)
      setPhase('playing')
      sfx.start()
    }

    const launch = () => {
      const s = stateRef.current
      if (s.paused) {
        s.paused = false
        sfx.pause()
      } else if (s.phase === 'playing') launchAll()
    }

    actionsRef.current = { begin, restart, launch }

    const finishOver = () => {
      const s = stateRef.current
      s.phase = 'over'
      setBest(loadBest(GAME_ID))
      setNewBest(s.newBest)
      setScore(s.score)
      setStats({ level: s.level, broken: s.broken, mult: s.maxMult })
      setPhase('over')
    }

    const autoPause = () => {
      const s = stateRef.current
      if ((s.phase === 'playing' || s.phase === 'clear') && !s.paused) s.paused = true
    }
    const onVis = () => {
      if (document.hidden) autoPause()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', autoPause)

    // ---- actualización ---------------------------------------------------

    const update = (rawDt: number, dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      s.t += rawDt

      // paleta (usa tiempo real para que siempre responda)
      if (s.phase === 'playing' || s.phase === 'ready' || s.phase === 'clear') {
        if (pressed.has('left')) s.padTx -= 540 * rawDt
        if (pressed.has('right')) s.padTx += 540 * rawDt
      }
      const wTarget = s.fx.wide > 0 ? PW_WIDE : PW0
      s.padW += (wTarget - s.padW) * Math.min(1, rawDt * 9)
      const half = s.padW / 2
      s.padTx = Math.max(half + 4, Math.min(W - half - 4, s.padTx))
      const prevCx = s.padCx
      s.padCx += (s.padTx - s.padCx) * Math.min(1, rawDt * 34)
      s.padCx = Math.max(half + 4, Math.min(W - half - 4, s.padCx))
      s.padVx += ((s.padCx - prevCx) / Math.max(rawDt, 1e-3) - s.padVx) * Math.min(1, rawDt * 14)
      if (s.squash > 0) s.squash = Math.max(0, s.squash - rawDt * 6)
      if (s.multPop > 0) s.multPop -= rawDt
      if (s.banner) {
        s.banner.t -= rawDt
        if (s.banner.t <= 0) s.banner = null
      }
      for (const k of s.bricks) {
        if (k.flash > 0) k.flash = Math.max(0, k.flash - rawDt * 5)
        if (k.bump > 0) k.bump = Math.max(0, k.bump - rawDt * 6)
      }
      for (let i = s.rings.length - 1; i >= 0; i--) {
        s.rings[i].t += rawDt
        if (s.rings[i].t > 0.4) s.rings.splice(i, 1)
      }

      if (s.phase === 'ready') return

      if (s.phase === 'dying') {
        s.dyingT += rawDt
        if (s.dyingT > 0.5 && justPressedRef.current.has('action')) restart()
        else if (s.dyingT > 1.1) finishOver()
        return
      }
      if (s.phase === 'over') {
        if (justPressedRef.current.has('action')) restart()
        return
      }
      if (s.phase === 'clear') {
        s.clearT -= rawDt
        if (Math.random() < rawDt * 9) {
          juice.burst(40 + Math.random() * (W - 80), 120 + Math.random() * 160, ['#F8A8C0', '#FFE787', '#A8E0C0', '#CDB4E8', '#FFC98A'], {
            count: 14,
            speed: 130,
            life: 0.7,
            size: 3.5,
            gravity: 160,
          })
        }
        if (s.clearT <= 0) startLevel(s.level + 1)
        return
      }

      // --- jugando ---
      if (justPressedRef.current.has('action')) launchAll()

      for (const k of TIMED) {
        if (s.fx[k] > 0) {
          s.fx[k] -= dt
          if (s.fx[k] <= 0) {
            s.fx[k] = 0
            tone({ freq: 330, to: 200, dur: 0.14, vol: 0.035, type: 'triangle' })
            if (k === 'sticky') launchAll()
          }
        }
      }

      s.speed += (targetSpeed(s) - s.speed) * Math.min(1, dt * 2.5)

      if (s.autoLaunch > 0) {
        s.autoLaunch -= dt
        if (s.autoLaunch <= 0 && s.fx.sticky <= 0) launchAll()
      }

      // bolas pegadas siguen a la paleta
      for (const b of s.balls) {
        if (b.stuck) {
          const lim = s.padW / 2 - 2
          b.stickOff = Math.max(-lim, Math.min(lim, b.stickOff))
          b.x = s.padCx + b.stickOff
          b.y = PY - R - 1
        }
      }

      // láser automático
      if (s.fx.laser > 0) {
        s.laserCd -= dt
        if (s.laserCd <= 0 && s.balls.some((b) => !b.stuck)) {
          s.laserCd = 0.36
          const pl = padLeft()
          s.lasers.push({ x: pl + 7, y: PY - 2 }, { x: pl + s.padW - 7, y: PY - 2 })
          tone({ freq: 1500, to: 500, dur: 0.06, vol: 0.022, type: 'sawtooth' })
        }
      }
      for (let i = s.lasers.length - 1; i >= 0; i--) {
        const l = s.lasers[i]
        const step = 640 * dt
        let gone = false
        for (let m = 0; m < Math.ceil(step / 6) && !gone; m++) {
          l.y -= step / Math.ceil(step / 6)
          for (let j = 0; j < s.bricks.length; j++) {
            const k = s.bricks[j]
            if (!k.alive) continue
            if (l.x >= k.x && l.x <= k.x + BW && l.y >= k.y && l.y <= k.y + BH) {
              hitBrick(j, 1)
              juice.burst(l.x, l.y, ['#e5484d', '#ffffff'], { count: 4, speed: 80, life: 0.2, size: 2.5 })
              gone = true
              break
            }
          }
        }
        if (gone || l.y < TOP) s.lasers.splice(i, 1)
      }

      // cápsulas
      const pl = padLeft()
      for (let i = s.capsules.length - 1; i >= 0; i--) {
        const c = s.capsules[i]
        c.t += dt
        c.y += 120 * dt
        if (c.y + 8 >= PY && c.y - 8 <= PY + PH && c.x + 17 >= pl && c.x - 17 <= pl + s.padW) {
          applyPower(c.kind, c.x, c.y)
          s.capsules.splice(i, 1)
          s.squash = Math.max(s.squash, 0.6)
        } else if (c.y > H + 20) s.capsules.splice(i, 1)
      }

      // explosiones en cadena
      for (let i = s.booms.length - 1; i >= 0; i--) {
        s.booms[i].t -= dt
        if (s.booms[i].t <= 0) {
          const bm = s.booms[i]
          s.booms.splice(i, 1)
          detonate(bm.x, bm.y)
        }
      }

      // física de las bolas
      for (let bi = s.balls.length - 1; bi >= 0; bi--) {
        const b = s.balls[bi]
        if (b.stuck) continue
        const sp = Math.hypot(b.vx, b.vy)
        const steps = Math.max(1, Math.ceil((sp * dt) / 4))
        const h = dt / steps
        let alive = true
        for (let k = 0; k < steps; k++) {
          if (!stepBall(b, h)) {
            alive = false
            break
          }
          if (b.stuck) break
        }
        if (!alive) {
          s.balls.splice(bi, 1)
          continue
        }
        // mantener velocidad objetivo suavemente
        const cur = Math.hypot(b.vx, b.vy)
        if (cur > 1 && Math.abs(cur - s.speed) > 0.5) {
          b.vx *= s.speed / cur
          b.vy *= s.speed / cur
        }
        b.trail.push({ x: b.x, y: b.y })
        if (b.trail.length > 9) b.trail.shift()
        if (s.fx.fire > 0 && Math.random() < 0.8) {
          juice.burst(b.x, b.y, ['#ff7a3d', '#ffc247', '#ffe787'], { count: 1, speed: 28, life: 0.35, size: 4, drag: 3, gravity: -40 })
        }
      }

      if (s.balls.length === 0 && s.phase === 'playing') {
        loseLife()
        return
      }

      // nivel completado
      if (s.phase === 'playing' && !s.bricks.some((k) => k.alive && k.kind !== 'x') && s.booms.length === 0) {
        const bonus = 100 * s.level + s.lives * 50
        addScore(bonus)
        s.phase = 'clear'
        s.clearT = 2.1
        s.capsules.length = 0
        s.lasers.length = 0
        for (const b of s.balls) juice.burst(b.x, b.y, ['#ffffff', CORAL], { count: 10, speed: 120, life: 0.4, size: 3 })
        s.balls.length = 0
        s.banner = { text: '¡NIVEL SUPERADO!', sub: `Bono +${bonus}`, t: 2.0 }
        juice.flash('#ffffff', 0.4)
        juice.shake(0.3)
        sfx.levelUp()
      }
    }

    // ---- dibujo ----------------------------------------------------------

    const easeOutBack = (x: number) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
    }

    const drawBrick = (s: BS, k: Brick) => {
      const ap = Math.max(0, Math.min(1, (s.t - k.appearAt) / 0.35))
      if (ap <= 0) return
      const e = easeOutBack(ap)
      const yOff = (1 - e) * -34
      const sc = 1 - 0.14 * k.bump
      const w = BW * sc
      const h = BH * sc
      const x = k.x + (BW - w) / 2
      const y = k.y + (BH - h) / 2 + yOff
      ctx.globalAlpha = Math.min(1, ap * 1.6)
      if (k.kind === 'x') {
        ctx.fillStyle = '#9aa1ad'
        rr(ctx, x, y + 1.5, w, h, 5)
        ctx.fill()
        ctx.fillStyle = '#c4cad4'
        rr(ctx, x, y, w, h, 5)
        ctx.fill()
        ctx.save()
        rr(ctx, x, y, w, h, 5)
        ctx.clip()
        ctx.strokeStyle = 'rgba(120,128,142,0.45)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = -h; i < w; i += 9) {
          ctx.moveTo(x + i, y + h)
          ctx.lineTo(x + i + h, y)
        }
        ctx.stroke()
        ctx.restore()
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        rr(ctx, x + 3, y + 2, w - 6, 2.5, 1.2)
        ctx.fill()
        ctx.fillStyle = '#7d8492'
        ctx.beginPath()
        ctx.arc(x + 5, y + h / 2, 1.5, 0, Math.PI * 2)
        ctx.arc(x + w - 5, y + h / 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const base = k.kind === 'b' ? '#ff8a65' : k.color
        ctx.fillStyle = 'rgba(0,0,0,0.13)'
        rr(ctx, x, y + 2, w, h, 7)
        ctx.fill()
        ctx.fillStyle = base
        rr(ctx, x, y, w, h, 7)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.38)'
        rr(ctx, x + 4, y + 2.5, w - 8, 4.5, 2.2)
        ctx.fill()
        if (k.kind === 'm') {
          // pips de golpes restantes y grietas
          ctx.fillStyle = 'rgba(40,30,90,0.55)'
          for (let i = 0; i < k.hp; i++) {
            ctx.beginPath()
            ctx.arc(x + w / 2 + (i - (k.hp - 1) / 2) * 7, y + h - 5, 1.8, 0, Math.PI * 2)
            ctx.fill()
          }
          if (k.hp < k.maxHp) {
            ctx.strokeStyle = 'rgba(40,30,90,0.45)'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(x + w * 0.3, y + 1)
            ctx.lineTo(x + w * 0.42, y + h * 0.5)
            ctx.lineTo(x + w * 0.34, y + h - 1)
            if (k.hp === 1) {
              ctx.moveTo(x + w * 0.7, y + 1)
              ctx.lineTo(x + w * 0.6, y + h * 0.55)
              ctx.lineTo(x + w * 0.68, y + h - 1)
            }
            ctx.stroke()
          }
        } else if (k.kind === 'b') {
          const bx = x + w / 2
          const by = y + h / 2 + 1
          ctx.fillStyle = '#4a2c2a'
          ctx.beginPath()
          ctx.arc(bx, by, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#4a2c2a'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.moveTo(bx + 2, by - 4)
          ctx.quadraticCurveTo(bx + 5, by - 8, bx + 8, by - 6)
          ctx.stroke()
          ctx.fillStyle = Math.sin(s.t * 20) > 0 ? '#ffe787' : '#ff5c3a'
          ctx.beginPath()
          ctx.arc(bx + 8, by - 6, 1.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (k.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * k.flash})`
        rr(ctx, x, y, w, h, 7)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const draw = () => {
      const s = stateRef.current
      ctx.save()
      ctx.fillStyle = '#FBF3E4'
      ctx.fillRect(-10, -10, W + 20, H + 20)
      juice.applyShake(ctx)
      ctx.drawImage(bg, 0, 0, W, H)

      // ladrillos
      for (const k of s.bricks) if (k.alive) drawBrick(s, k)

      // ondas de explosión
      for (const r of s.rings) {
        const p = r.t / 0.4
        ctx.globalAlpha = (1 - p) * 0.7
        ctx.strokeStyle = r.color
        ctx.lineWidth = 4 * (1 - p) + 1
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.max * (0.25 + 0.75 * Math.sqrt(p)), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // cápsulas
      for (const c of s.capsules) {
        const p = POWERS[c.kind]
        const sway = Math.sin(c.t * 6) * 1.5
        const x = c.x + sway
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        rr(ctx, x - 17, c.y - 7, 34, 16, 8)
        ctx.fill()
        ctx.fillStyle = p.color
        rr(ctx, x - 17, c.y - 8, 34, 16, 8)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        rr(ctx, x - 13, c.y - 6.5, 26, 4, 2)
        ctx.fill()
        drawPowerIcon(ctx, c.kind, x, c.y, 4.6, '#ffffff')
      }

      // láseres
      if (s.lasers.length) {
        ctx.strokeStyle = '#e5484d'
        ctx.lineWidth = 2.4
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const l of s.lasers) {
          ctx.moveTo(l.x, l.y)
          ctx.lineTo(l.x, l.y + 10)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        for (const l of s.lasers) {
          ctx.moveTo(l.x, l.y)
          ctx.lineTo(l.x, l.y + 10)
        }
        ctx.stroke()
      }

      // bolas: estela + cuerpo
      const fire = s.fx.fire > 0
      for (const b of s.balls) {
        for (let i = 0; i < b.trail.length; i++) {
          const t = b.trail[i]
          const k = (i + 1) / b.trail.length
          ctx.fillStyle = fire ? `rgba(255,122,61,${0.32 * k})` : `rgba(255,138,122,${0.26 * k})`
          ctx.beginPath()
          ctx.arc(t.x, t.y, R * (0.45 + 0.55 * k), 0, Math.PI * 2)
          ctx.fill()
        }
        const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, R * 2.6)
        g.addColorStop(0, fire ? 'rgba(255,140,60,0.5)' : 'rgba(255,138,122,0.4)')
        g.addColorStop(1, 'rgba(255,138,122,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(b.x, b.y, R * 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = fire ? '#ff7a3d' : CORAL
        ctx.beginPath()
        ctx.arc(b.x, b.y, R, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.beginPath()
        ctx.arc(b.x - 2.1, b.y - 2.3, 2.1, 0, Math.PI * 2)
        ctx.fill()
      }

      // paleta (squash & stretch, ligera inclinación al moverse)
      if (s.phase !== 'dying' && s.phase !== 'over') {
        const sq = s.squash
        const w = s.padW * (1 + 0.14 * sq)
        const h = PH * (1 - 0.38 * sq)
        const tilt = Math.max(-0.07, Math.min(0.07, s.padVx * 0.00012))
        ctx.save()
        ctx.translate(s.padCx, PY + PH)
        ctx.rotate(tilt)
        const x = -w / 2
        const y = -h
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        rr(ctx, x, y + 2, w, h, 7)
        ctx.fill()
        ctx.fillStyle = s.fx.sticky > 0 ? '#b9a0f0' : MINT
        rr(ctx, x, y, w, h, 7)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.42)'
        rr(ctx, x + 6, y + 2.2, w - 12, Math.max(2, h * 0.28), 2)
        ctx.fill()
        if (s.fx.sticky > 0) {
          ctx.fillStyle = '#cdb8f7'
          for (let i = 0; i < 7; i++) {
            const gx = x + 8 + (i * (w - 16)) / 6
            ctx.beginPath()
            ctx.arc(gx, y - 0.5, 2.6 + (i % 2) * 0.8, Math.PI, 0)
            ctx.fill()
          }
        }
        if (s.fx.laser > 0) {
          ctx.fillStyle = '#e5484d'
          rr(ctx, x + 2, y - 5, 6, 7, 2)
          ctx.fill()
          rr(ctx, x + w - 8, y - 5, 6, 7, 2)
          ctx.fill()
        }
        ctx.restore()
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pixelFont)

      // franja superior: vidas, combo, nivel
      for (let i = 0; i < s.lives; i++) drawHeart(ctx, 16 + i * 19, 11, '#F29BB5', 0.85)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'right'
      ctx.font = font(9)
      ctx.fillStyle = INK
      ctx.fillText(`NIVEL ${s.level}`, W - 10, 16)
      if (s.combo >= 3 && s.phase === 'playing') {
        const m = multOf(s.combo)
        const pop = 1 + Math.max(0, s.multPop) * 0.5
        ctx.save()
        ctx.translate(W / 2, 16)
        ctx.scale(pop, pop)
        ctx.textAlign = 'center'
        ctx.font = font(10)
        ctx.fillStyle = m >= 4 ? '#d99a1d' : ROSE
        ctx.fillText(`COMBO ${s.combo}  x${m}`, 0, 0)
        ctx.restore()
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      // indicadores de power-ups activos (abajo)
      let row = 0
      for (const k of TIMED) {
        const left = s.fx[k]
        if (left <= 0) continue
        const p = POWERS[k]
        const x = 10 + row * 76
        const y = H - 20
        ctx.fillStyle = 'rgba(90,70,50,0.14)'
        rr(ctx, x, y - 8, 70, 16, 8)
        ctx.fill()
        drawPowerIcon(ctx, k, x + 11, y, 4.2, p.color)
        ctx.fillStyle = 'rgba(90,70,50,0.18)'
        rr(ctx, x + 22, y - 2.5, 41, 5, 2.5)
        ctx.fill()
        ctx.fillStyle = left < 2 && Math.sin(s.t * 18) > 0 ? '#ffffff' : p.color
        rr(ctx, x + 22, y - 2.5, Math.max(3, (41 * left) / p.dur), 5, 2.5)
        ctx.fill()
        row += 1
      }

      // pista de lanzamiento
      if (s.phase === 'playing' && s.balls.some((b) => b.stuck)) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(s.t * 6)
        ctx.font = font(8)
        ctx.textAlign = 'center'
        ctx.fillStyle = INK
        ctx.fillText(s.fx.sticky > 0 ? 'SUELTA: ESPACIO / TOCA' : 'LANZAR: ESPACIO / TOCA', W / 2, PY - 26)
        ctx.textAlign = 'left'
        ctx.globalAlpha = 1
      }

      // cartela
      if (s.banner) {
        const b = s.banner
        const k = Math.min(1, b.t / 0.35)
        ctx.save()
        ctx.globalAlpha = k
        ctx.translate(W / 2, H * 0.58)
        ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = font(b.text.length > 12 ? 15 : 20)
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillText(b.text, 2, 2)
        ctx.fillStyle = ROSE
        ctx.fillText(b.text, 0, 0)
        if (b.sub) {
          ctx.font = font(8)
          ctx.fillStyle = INK
          ctx.fillText(b.sub, 0, 28)
        }
        ctx.restore()
      }

      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (s.paused) {
        ctx.fillStyle = 'rgba(251,243,228,0.82)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = font(24)
        ctx.fillStyle = ROSE
        ctx.fillText('PAUSA', W / 2, H / 2 - 10)
        ctx.font = font(8)
        ctx.fillStyle = INK
        ctx.fillText('Pulsa P o toca la pantalla', W / 2, H / 2 + 22)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---- bucle -----------------------------------------------------------

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        const ph = stateRef.current.phase
        if (ph === 'ready' || ph === 'over') requestRemount()
      }
      const s = stateRef.current
      const jp = justPressedRef.current

      if (jp.has('pause') && (s.phase === 'playing' || s.phase === 'clear')) {
        s.paused = !s.paused
        sfx.pause()
      }
      if (s.paused) {
        jp.clear()
        draw()
        raf = requestAnimationFrame(loop)
        return
      }

      if (s.phase === 'ready' && (jp.has('action') || jp.has('left') || jp.has('right'))) begin()

      const dt = juice.update(rawDt)
      update(rawDt, dt)
      jp.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', autoPause)
      actionsRef.current = null
    }
  }, [justPressedRef, pressedRef])

  // ---- puntero: ratón (posición absoluta) y táctil (arrastre relativo) ----

  const toGame = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return ((e.clientX - rect.left) / rect.width) * W
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current
    if (e.pointerType === 'mouse') {
      s.padTx = toGame(e)
      actionsRef.current?.launch()
    } else {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // sin captura: el arrastre sigue funcionando dentro del canvas
      }
      dragRef.current = { id: e.pointerId, x: e.clientX, cx: s.padTx, t: performance.now(), moved: false }
    }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current
    if (e.pointerType === 'mouse') {
      s.padTx = toGame(e)
      return
    }
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = ((e.clientX - d.x) / rect.width) * W
    if (Math.abs(e.clientX - d.x) > 8) d.moved = true
    s.padTx = d.cx + dx * 1.15
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    if (!d.moved && performance.now() - d.t < 450) actionsRef.current?.launch()
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-3xl border-2 border-[#EBDDC8] bg-[#FBF3E4] shadow-[0_14px_40px_rgba(240,180,170,0.35)]"
        hud={
          <Hud>
            <span className="text-[#E8899E]">PUNTOS {score}</span>
            <span className="text-[#9DB8A8]">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null
          }}
          className="block h-full w-full cursor-pointer touch-none select-none object-contain"
          aria-label="Juego Rompe Ladrillos"
        />

        {phase === 'ready' && (
          <StartOverlay
            title="ROMPE LADRILLOS"
            accent="#7dd8b7"
            subtitle="Rompe el muro, encadena combos y atrapa los power-ups que caen."
            hint="Mueve con las flechas o el ratón. ESPACIO lanza"
            touchHint="Arrastra el dedo para mover la paleta"
            onStart={() => actionsRef.current?.begin()}
          />
        )}

        {phase === 'over' && (
          <GameOverOverlay
            title="SIN VIDAS"
            accent="#7dd8b7"
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Nivel', value: stats.level },
              { label: 'Ladrillos', value: stats.broken },
              { label: 'Combo máx.', value: `x${stats.mult}` },
            ]}
            onRestart={() => actionsRef.current?.restart()}
          />
        )}
      </GameScreen>

    </div>
  )
}
