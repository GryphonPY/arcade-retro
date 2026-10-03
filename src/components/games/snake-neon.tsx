'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys, type Dir, type LogicalKey } from './use-keys'
import { loadBest, saveBest, rr, renderScale } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { Hud, StartOverlay, GameOverOverlay } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const GAME_ID = 'snake-neon'
const COLS = 20
const ROWS = 20
const CELL = 22
const W = COLS * CELL
const H = ROWS * CELL

const FOODS_PER_LEVEL = 6
const GOLD_EVERY = 5
const GOLD_LIFE = 8
const ITEM_LIFE = 10
const ROCKS_FROM_LEVEL = 3
const MAX_ROCKS = 16
const MAGNET_RANGE = 6.5

const CYAN = '#22f7c5'
const PINK = '#ff2fd6'
const GOLD = '#ffe23d'
const PURPLE = '#b026ff'

type Pt = { x: number; y: number }
type PowerKind = 'slow' | 'ghost' | 'magnet'
type Phase = 'ready' | 'playing' | 'dying' | 'over'
type UiPhase = 'ready' | 'playing' | 'over'

const POWER: Record<PowerKind, { color: string; label: string; dur: number }> = {
  slow: { color: '#5cc8ff', label: 'LENTO', dur: 6 },
  ghost: { color: '#d6b3ff', label: 'FANTASMA', dur: 5 },
  magnet: { color: '#ffb347', label: 'IMÁN', dur: 8 },
}
const POWER_KINDS: PowerKind[] = ['slow', 'ghost', 'magnet']

const DIRS: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

// paletas de fondo que cambian cada nivel
const PALETTES = [
  { top: '#0b0420', bottom: '#190636', grid: 'rgba(255,47,214,0.10)', border: PINK },
  { top: '#03111c', bottom: '#06263a', grid: 'rgba(34,247,197,0.10)', border: CYAN },
  { top: '#14061a', bottom: '#2a0a2a', grid: 'rgba(255,160,70,0.10)', border: '#ffa046' },
]

interface Orb extends Pt {
  vx: number
  vy: number
  age: number
}
interface GoldOrb extends Orb {
  life: number
  maxLife: number
}
interface Item extends Pt {
  kind: PowerKind
  life: number
  maxLife: number
  age: number
}
interface Rock extends Pt {
  warm: number
}

interface SnakeState {
  snake: Pt[]
  prev: Pt[]
  dir: Dir
  queue: Dir[]
  food: Orb
  gold: GoldOrb | null
  item: Item | null
  rocks: Rock[]
  eaten: number
  level: number
  score: number
  grow: number
  acc: number
  stepMs: number
  combo: number
  comboT: number
  comboWindow: number
  maxMult: number
  multPop: number
  fx: Record<PowerKind, number>
  sinceItem: number
  phase: Phase
  paused: boolean
  t: number
  wave: number
  nearCd: number
  banner: { text: string; sub?: string; t: number } | null
  deathT: number
  death: { cell: Pt; cause: 'wall' | 'self' | 'rock' } | null
  newBest: boolean
}

// ---------------------------------------------------------------------------
// Utilidades de estado
// ---------------------------------------------------------------------------

function mkOrb(p: Pt): Orb {
  return { x: p.x, y: p.y, vx: p.x, vy: p.y, age: 0 }
}

function onSnake(s: SnakeState, x: number, y: number) {
  return s.snake.some((p) => p.x === x && p.y === y)
}

function isRock(s: SnakeState, x: number, y: number, solidOnly = true) {
  return s.rocks.some((r) => r.x === x && r.y === y && (!solidOnly || r.warm <= 0))
}

/** Elige una celda libre al azar con restricciones opcionales. */
function pickFree(
  s: Pick<SnakeState, 'snake' | 'rocks' | 'dir'> & { food?: Pt | null; gold?: Pt | null; item?: Pt | null },
  o: { minDist?: number; inner?: boolean; clearAhead?: number } = {},
): Pt | null {
  const occ = new Uint8Array(COLS * ROWS)
  for (const p of s.snake) occ[p.y * COLS + p.x] = 1
  for (const r of s.rocks) occ[r.y * COLS + r.x] = 1
  for (const p of [s.food, s.gold, s.item]) if (p) occ[p.y * COLS + p.x] = 1
  const head = s.snake[0]
  const d = DIRS[s.dir]
  const cand: number[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (occ[y * COLS + x]) continue
      if (o.inner && (x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2)) continue
      if (o.minDist && Math.abs(x - head.x) + Math.abs(y - head.y) < o.minDist) continue
      if (o.clearAhead) {
        // evita bloquear el camino recto inmediato (y los dos carriles contiguos)
        const fx = x - head.x
        const fy = y - head.y
        const along = fx * d.x + fy * d.y
        const across = Math.abs(fx * d.y - fy * d.x)
        if (along > 0 && along <= o.clearAhead && across <= 1) continue
      }
      cand.push(y * COLS + x)
    }
  }
  if (cand.length === 0) return null
  const c = cand[(Math.random() * cand.length) | 0]
  return { x: c % COLS, y: Math.floor(c / COLS) }
}

function initial(): SnakeState {
  const snake: Pt[] = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
  ]
  const base = {
    snake,
    rocks: [] as Rock[],
    dir: 'right' as Dir,
  }
  const f = pickFree({ ...base, food: null, gold: null, item: null }, { minDist: 6 }) ?? { x: 14, y: 10 }
  return {
    snake,
    prev: snake.map((p) => ({ ...p })),
    dir: 'right',
    queue: [],
    food: mkOrb(f),
    gold: null,
    item: null,
    rocks: [],
    eaten: 0,
    level: 1,
    score: 0,
    grow: 0,
    acc: 0,
    stepMs: 150,
    combo: 0,
    comboT: 0,
    comboWindow: 3,
    maxMult: 1,
    multPop: 0,
    fx: { slow: 0, ghost: 0, magnet: 0 },
    sinceItem: 0,
    phase: 'ready',
    paused: false,
    t: 0,
    wave: -1,
    nearCd: 0,
    banner: null,
    deathT: 0,
    death: null,
    newBest: false,
  }
}

const multOf = (combo: number) => Math.min(5, 1 + Math.floor(combo / 2))

// ---------------------------------------------------------------------------
// Fondo en caché (rejilla + marco de neón)
// ---------------------------------------------------------------------------

function buildBg(pal: (typeof PALETTES)[number]): HTMLCanvasElement {
  const dpr = renderScale()
  const c = document.createElement('canvas')
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  const g = c.getContext('2d')
  if (!g) return c
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, pal.top)
  grad.addColorStop(1, pal.bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // tablero sutil
  g.fillStyle = 'rgba(255,255,255,0.018)'
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if ((x + y) % 2 === 0) g.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
  }
  g.strokeStyle = pal.grid
  g.lineWidth = 1
  g.beginPath()
  for (let i = 1; i < COLS; i++) {
    g.moveTo(i * CELL + 0.5, 0)
    g.lineTo(i * CELL + 0.5, H)
  }
  for (let j = 1; j < ROWS; j++) {
    g.moveTo(0, j * CELL + 0.5)
    g.lineTo(W, j * CELL + 0.5)
  }
  g.stroke()
  // viñeta
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  g.fillStyle = v
  g.fillRect(0, 0, W, H)
  // marco de neón: las paredes matan, que se note
  g.save()
  g.strokeStyle = pal.border
  g.shadowColor = pal.border
  g.shadowBlur = 10
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, W - 3, H - 3)
  g.restore()
  return c
}

// ---------------------------------------------------------------------------
// Iconos de power-ups
// ---------------------------------------------------------------------------

function drawIcon(ctx: CanvasRenderingContext2D, kind: PowerKind, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.4, r * 0.28)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'slow') {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 0.6)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + r * 0.45, cy + r * 0.25)
    ctx.stroke()
  } else if (kind === 'ghost') {
    ctx.beginPath()
    ctx.moveTo(cx - r, cy + r)
    ctx.lineTo(cx - r, cy)
    ctx.arc(cx, cy, r, Math.PI, 0)
    ctx.lineTo(cx + r, cy + r)
    ctx.lineTo(cx + r * 0.5, cy + r * 0.55)
    ctx.lineTo(cx, cy + r)
    ctx.lineTo(cx - r * 0.5, cy + r * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#0b0420'
    ctx.beginPath()
    ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.2, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.75, cy + r * 0.9)
    ctx.lineTo(cx - r * 0.75, cy)
    ctx.arc(cx, cy, r * 0.75, Math.PI, 0)
    ctx.lineTo(cx + r * 0.75, cy + r * 0.9)
    ctx.stroke()
    ctx.fillStyle = '#ff5c5c'
    ctx.fillRect(cx - r * 1.0, cy + r * 0.5, r * 0.5, r * 0.5)
    ctx.fillRect(cx + r * 0.5, cy + r * 0.5, r * 0.5, r * 0.5)
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface Actions {
  begin: (dir?: Dir) => void
  restart: () => void
  resume: () => void
}

export default function SnakeNeon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<UiPhase>('ready')
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ eaten: 0, length: 3, mult: 1, level: 1 })

  const stateRef = useRef<SnakeState>(initial())
  const actionsRef = useRef<Actions | null>(null)
  const swipeRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest(GAME_ID))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = renderScale()
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) return
    const ctx: CanvasRenderingContext2D = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pixelFont =
      getComputedStyle(canvas).getPropertyValue('--font-pixel').trim() || '"Press Start 2P", monospace'
    const font = (px: number) => `${px}px ${pixelFont}`

    const juice = new Juice(7)
    ;(window as unknown as { __dbg?: unknown }).__dbg = { get: () => stateRef.current, juice } // DBG
    const bgs: (HTMLCanvasElement | null)[] = PALETTES.map(() => null)
    const getBg = (lvl: number) => {
      const i = (lvl - 1) % PALETTES.length
      return (bgs[i] ??= buildBg(PALETTES[i]))
    }

    let raf = 0
    let last = performance.now()

    const syncHud = () => {
      const s = stateRef.current
      setScore(s.score)
      setLevel(s.level)
    }

    // ---- lógica ----------------------------------------------------------

    const cx = (c: number) => c * CELL + CELL / 2

    const spawnFood = () => {
      const s = stateRef.current
      const p = pickFree(s, { minDist: 3 })
      if (p) s.food = mkOrb(p)
    }

    const spawnRocks = (n: number) => {
      const s = stateRef.current
      for (let i = 0; i < n && s.rocks.length < MAX_ROCKS; i++) {
        const p = pickFree({ ...s, food: s.food, gold: s.gold, item: s.item }, { minDist: 5, inner: true, clearAhead: 7 })
        if (!p) break
        s.rocks.push({ x: p.x, y: p.y, warm: 1.8 + i * 0.35 })
      }
      tone({ freq: 160, to: 110, dur: 0.14, vol: 0.035, type: 'square' })
    }

    const bumpCombo = () => {
      const s = stateRef.current
      const before = multOf(s.combo)
      s.combo = s.comboT > 0 ? s.combo + 1 : 1
      s.comboT = s.comboWindow
      const m = multOf(s.combo)
      s.maxMult = Math.max(s.maxMult, m)
      if (m > before) {
        s.multPop = 0.5
        juice.text(W / 2, 54, `x${m} COMBO`, m >= 4 ? GOLD : PINK, 13, 1.1)
        juice.shake(0.1 + m * 0.03)
        tone({ freq: 500 + m * 90, to: 900 + m * 120, dur: 0.12, vol: 0.05, type: 'triangle', delay: 0.04 })
      }
    }

    const eatFood = () => {
      const s = stateRef.current
      const fx = cx(s.food.x)
      const fy = cx(s.food.y)
      bumpCombo()
      const m = multOf(s.combo)
      s.score += 10 * m
      juice.text(fx, fy - 8, `+${10 * m}`, m > 1 ? '#ffe9a8' : '#ff9ae8', m > 1 ? 11 : 9, 0.85)
      juice.burst(fx, fy, ['#ff7ae0', '#ff2fd6', '#ffffff'], { count: 10 + m * 2, speed: 110, life: 0.45, size: 3.5, drag: 3 })
      juice.shake(0.1)
      tone({ freq: 520 + Math.min(s.combo, 12) * 50, to: 820 + Math.min(s.combo, 12) * 60, dur: 0.08, vol: 0.045 })
      s.eaten += 1
      s.grow += 1
      s.wave = 0
      s.stepMs = Math.max(66, 150 - s.eaten * 2.4)
      s.comboWindow = Math.max(2, 3 - s.level * 0.1)
      s.sinceItem += 1

      if (s.eaten % GOLD_EVERY === 0 && !s.gold) {
        const p = pickFree(s, { minDist: 4 })
        if (p) {
          s.gold = { ...mkOrb(p), life: GOLD_LIFE, maxLife: GOLD_LIFE }
          juice.text(cx(p.x), cx(p.y) - 14, 'ORO', GOLD, 8, 0.9)
          tone({ freq: 1200, to: 1700, dur: 0.1, vol: 0.03, type: 'sine' })
        }
      }
      if (!s.item && s.eaten >= 3 && s.sinceItem >= 5 && (s.sinceItem >= 8 || Math.random() < 0.45)) {
        const p = pickFree({ ...s, item: null }, { minDist: 4 })
        if (p) {
          s.item = { ...p, kind: POWER_KINDS[(Math.random() * POWER_KINDS.length) | 0], life: ITEM_LIFE, maxLife: ITEM_LIFE, age: 0 }
          s.sinceItem = 0
        }
      }
      spawnFood()

      if (s.eaten % FOODS_PER_LEVEL === 0) {
        s.level += 1
        const bonus = 40 + s.level * 10
        s.score += bonus
        s.banner = {
          text: `NIVEL ${s.level}`,
          sub: s.level === ROCKS_FROM_LEVEL ? 'Cuidado: aparecen obstáculos' : `Bono +${bonus}`,
          t: 1.8,
        }
        juice.flash(CYAN, 0.25)
        juice.freeze(50)
        sfx.levelUp()
        if (s.level >= ROCKS_FROM_LEVEL) spawnRocks(2)
      }
      syncHud()
    }

    const eatGold = () => {
      const s = stateRef.current
      const g = s.gold
      if (!g) return
      const gx = cx(g.x)
      const gy = cx(g.y)
      bumpCombo()
      const m = multOf(s.combo)
      const pts = 60 * m
      s.score += pts
      s.grow += 2
      s.wave = 0
      s.gold = null
      juice.text(gx, gy - 8, `+${pts}`, GOLD, 13, 1.1)
      juice.burst(gx, gy, [GOLD, '#fff6b0', '#ffffff'], { count: 26, speed: 190, life: 0.7, size: 4, drag: 2.5 })
      juice.flash(GOLD, 0.28)
      juice.shake(0.28)
      juice.freeze(60)
      sfx.golden()
      syncHud()
    }

    const takeItem = () => {
      const s = stateRef.current
      const it = s.item
      if (!it) return
      const p = POWER[it.kind]
      s.fx[it.kind] = p.dur
      s.item = null
      s.score += 25
      const ix = cx(it.x)
      const iy = cx(it.y)
      juice.text(ix, iy - 10, p.label, p.color, 10, 1.1)
      juice.burst(ix, iy, [p.color, '#ffffff'], { count: 16, speed: 150, life: 0.55, size: 3.5 })
      juice.flash(p.color, 0.22)
      juice.shake(0.15)
      sfx.power()
      syncHud()
    }

    const collect = () => {
      const s = stateRef.current
      const h = s.snake[0]
      if (h.x === s.food.x && h.y === s.food.y) eatFood()
      if (s.gold && h.x === s.gold.x && h.y === s.gold.y) eatGold()
      if (s.item && h.x === s.item.x && h.y === s.item.y) takeItem()
    }

    const die = (cause: 'wall' | 'self' | 'rock', cell: Pt) => {
      const s = stateRef.current
      s.phase = 'dying'
      s.deathT = 0
      s.death = { cell, cause }
      s.queue.length = 0
      const n = s.snake.length
      for (let i = 0; i < n; i++) {
        const seg = s.snake[i]
        const t = n === 1 ? 0 : i / (n - 1)
        const color = `hsl(${166 + t * 134} 100% 60%)`
        juice.burst(cx(seg.x), cx(seg.y), [color, '#ffffff'], {
          count: i === 0 ? 14 : 4,
          speed: i === 0 ? 240 : 150,
          life: 0.9,
          size: i === 0 ? 5 : 4.5,
          drag: 1.6,
          gravity: 90,
        })
      }
      juice.shake(0.95)
      juice.freeze(140)
      juice.flash(PINK, 0.4)
      sfx.crash()
      noise({ dur: 0.25, vol: 0.05, freq: 2400, delay: 0.02 })
      // récord
      if (saveBest(GAME_ID, s.score)) s.newBest = true
    }

    const deadly = (s: SnakeState, x: number, y: number, tailMoves: boolean) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true
      if (isRock(s, x, y)) return true
      if (s.fx.ghost <= 0) {
        const lim = tailMoves ? s.snake.length - 1 : s.snake.length
        for (let i = 0; i < lim; i++) if (s.snake[i].x === x && s.snake[i].y === y) return true
      }
      return false
    }

    const step = () => {
      const s = stateRef.current
      const oldDir = s.dir
      let turned = false
      while (s.queue.length > 0) {
        const d = s.queue.shift() as Dir
        if (d !== s.dir && d !== OPPOSITE[s.dir]) {
          s.dir = d
          turned = true
          break
        }
      }
      const head = s.snake[0]
      const dv = DIRS[s.dir]
      const nh: Pt = { x: head.x + dv.x, y: head.y + dv.y }
      const tailMoves = s.grow <= 0

      if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS) return die('wall', nh)
      if (isRock(s, nh.x, nh.y)) return die('rock', nh)
      if (s.fx.ghost <= 0 && deadly(s, nh.x, nh.y, tailMoves)) return die('self', nh)

      // "por poco": giro de último segundo justo antes de un peligro
      if (turned && s.nearCd <= 0) {
        const od = DIRS[oldDir]
        if (deadly(s, head.x + od.x, head.y + od.y, tailMoves)) {
          const m = multOf(s.combo)
          const bonus = 15 * m
          s.score += bonus
          s.nearCd = 1
          juice.text(cx(head.x), cx(head.y) - 14, `¡POR POCO! +${bonus}`, '#7df9ff', 8, 0.9)
          juice.burst(cx(head.x), cx(head.y), ['#7df9ff', '#ffffff'], { count: 8, speed: 90, life: 0.35, size: 2.5 })
          juice.freeze(35)
          sfx.nearMiss()
          syncHud()
        }
      }

      // el "bulto" de comer avanza por el cuerpo un segmento por paso
      if (s.wave >= 0) {
        s.wave += 1
        if (s.wave > s.snake.length + 1) s.wave = -1
      }

      s.prev = s.snake
      s.snake = [nh, ...s.snake]
      if (s.grow > 0) s.grow -= 1
      else s.snake.pop()

      collect()

      // imán: acerca los orbes un paso por turno
      if (s.fx.magnet > 0) {
        const pull = (o: Pt) => {
          const h = s.snake[0]
          const dx = h.x - o.x
          const dy = h.y - o.y
          if (Math.hypot(dx, dy) > MAGNET_RANGE || (dx === 0 && dy === 0)) return
          const opts: Pt[] =
            Math.abs(dx) >= Math.abs(dy)
              ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
              : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }]
          for (const m of opts) {
            if (m.x === 0 && m.y === 0) continue
            const tx = o.x + m.x
            const ty = o.y + m.y
            if (isRock(s, tx, ty, false)) continue
            if (onSnake(s, tx, ty) && !(tx === h.x && ty === h.y)) continue
            o.x = tx
            o.y = ty
            break
          }
        }
        pull(s.food)
        if (s.gold) pull(s.gold)
        collect()
      }

    }

    // ---- control de fases ------------------------------------------------

    const resetAll = () => {
      stateRef.current = initial()
      juice.reset()
      swipeRef.current = null
    }

    const begin = (dir?: Dir) => {
      const s = stateRef.current
      if (s.phase !== 'ready') return
      s.phase = 'playing'
      if (dir && dir !== OPPOSITE[s.dir]) s.dir = dir
      setPhase('playing')
      sfx.start()
    }

    const restart = () => {
      resetAll()
      const s = stateRef.current
      s.phase = 'playing'
      setScore(0)
      setLevel(1)
      setNewBest(false)
      setPhase('playing')
      sfx.start()
    }

    const resume = () => {
      const s = stateRef.current
      if (s.paused) {
        s.paused = false
        sfx.pause()
      }
    }

    actionsRef.current = { begin, restart, resume }

    const finishOver = () => {
      const s = stateRef.current
      s.phase = 'over'
      setBest(loadBest(GAME_ID))
      setNewBest(s.newBest)
      setScore(s.score)
      setStats({ eaten: s.eaten, length: s.snake.length, mult: s.maxMult, level: s.level })
      setPhase('over')
    }

    const autoPause = () => {
      const s = stateRef.current
      if (s.phase === 'playing' && !s.paused) s.paused = true
    }
    const onVis = () => {
      if (document.hidden) autoPause()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', autoPause)

    // ---- dibujo ----------------------------------------------------------

    const snakeColor = (t: number) => `hsl(${166 + t * 134} 100% ${62 - t * 8}%)`

    const drawOrb = (o: Orb, color: string, glow: string, r0: number, pulse: number) => {
      const x = o.vx * CELL + CELL / 2
      const y = o.vy * CELL + CELL / 2
      const pop = Math.min(1, o.age / 0.25)
      const k = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.35 : 1
      const r = (r0 + pulse) * k * (0.3 + 0.7 * Math.min(1, pop * 1.4))
      const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.8)
      g.addColorStop(0, glow)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r * 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(x - r * 0.32, y - r * 0.35, r * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = () => {
      const s = stateRef.current
      const tt = s.phase === 'ready' || s.phase === 'over' ? 0 : Math.max(0, Math.min(1, s.acc / s.stepMs))

      ctx.save()
      ctx.fillStyle = '#070213'
      ctx.fillRect(-12, -12, W + 24, H + 24)
      juice.applyShake(ctx)
      ctx.drawImage(getBg(s.level), 0, 0, W, H)

      // pared letal resaltada al morir
      if (s.death && s.death.cause === 'wall') {
        const a = 0.35 + 0.35 * Math.sin(s.t * 18)
        const c = s.death.cell
        ctx.save()
        ctx.globalAlpha = Math.max(0, a)
        ctx.fillStyle = '#ff3b5c'
        if (c.x < 0) ctx.fillRect(0, 0, 6, H)
        else if (c.x >= COLS) ctx.fillRect(W - 6, 0, 6, H)
        else if (c.y < 0) ctx.fillRect(0, 0, W, 6)
        else ctx.fillRect(0, H - 6, W, 6)
        ctx.restore()
      }

      // obstáculos
      for (const r of s.rocks) {
        const x = r.x * CELL
        const y = r.y * CELL
        if (r.warm > 0) {
          const blink = Math.sin(s.t * 14) > 0 ? 0.9 : 0.35
          ctx.save()
          ctx.globalAlpha = blink
          ctx.strokeStyle = '#ff5c7a'
          ctx.lineWidth = 2
          ctx.setLineDash([4, 3])
          rr(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4)
          ctx.stroke()
          ctx.restore()
        } else {
          ctx.fillStyle = '#2b0f55'
          rr(ctx, x + 1.5, y + 1.5, CELL - 3, CELL - 3, 5)
          ctx.fill()
          ctx.strokeStyle = PURPLE
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.strokeStyle = 'rgba(176,38,255,0.55)'
          ctx.beginPath()
          ctx.moveTo(x + 6, y + 6)
          ctx.lineTo(x + CELL - 6, y + CELL - 6)
          ctx.moveTo(x + CELL - 6, y + 6)
          ctx.lineTo(x + 6, y + CELL - 6)
          ctx.stroke()
        }
      }

      // power-up
      if (s.item) {
        const it = s.item
        const p = POWER[it.kind]
        const x = cx(it.x)
        const y = cx(it.y)
        const hide = it.life < 2.5 && Math.sin(s.t * 16) > 0.2
        if (!hide) {
          const bob = Math.sin(s.t * 4) * 1.2
          const pop = Math.min(1, it.age / 0.25)
          ctx.save()
          ctx.translate(x, y + bob)
          ctx.scale(pop, pop)
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22)
          g.addColorStop(0, p.color + '66')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, 0, 22, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#12082c'
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, 9.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          drawIcon(ctx, it.kind, 0, 0, 4.6, p.color)
          ctx.restore()
        }
      }

      // orbes
      drawOrb(s.food, '#ff7ae0', 'rgba(255,47,214,0.55)', 6, Math.sin(s.t * 5) * 1.5)
      if (s.gold) {
        const g = s.gold
        const hide = g.life < 2.5 && Math.sin(s.t * 18) > 0.3
        if (!hide) {
          drawOrb(g, GOLD, 'rgba(255,226,61,0.6)', 7.5, Math.sin(s.t * 9) * 2)
          const gx = g.vx * CELL + CELL / 2
          const gy = g.vy * CELL + CELL / 2
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(gx, gy, 13, -Math.PI / 2, -Math.PI / 2 + (g.life / g.maxLife) * Math.PI * 2)
          ctx.stroke()
        }
      }

      // serpiente
      if (s.phase !== 'dying' && s.phase !== 'over') {
        const n = s.snake.length
        const pts: Pt[] = new Array(n)
        for (let i = 0; i < n; i++) {
          const a = s.prev[Math.min(i, s.prev.length - 1)]
          const b = s.snake[i]
          pts[i] = { x: (a.x + (b.x - a.x) * tt) * CELL + CELL / 2, y: (a.y + (b.y - a.y) * tt) * CELL + CELL / 2 }
        }
        const ghost = s.fx.ghost > 0
        const flicker = ghost && s.fx.ghost < 1.2 ? 0.25 + 0.35 * (Math.sin(s.t * 26) > 0 ? 1 : 0) : 0.55
        ctx.save()
        if (ghost) ctx.globalAlpha = flicker
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const base = CELL * 0.8
        for (let i = n - 1; i >= 1; i--) {
          const t = Math.min(1, i / Math.max(n - 1, 14))
          let w = base * (1 - 0.3 * t)
          if (s.wave >= 0) w *= 1 + 0.38 * Math.max(0, 1 - Math.abs(i - (s.wave + tt)) / 2)
          ctx.strokeStyle = snakeColor(t)
          ctx.lineWidth = w
          ctx.beginPath()
          ctx.moveTo(pts[i].x, pts[i].y)
          ctx.lineTo(pts[i - 1].x, pts[i - 1].y)
          ctx.stroke()
        }
        // brillo del lomo
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()

        // cabeza
        const h = pts[0]
        const dv = DIRS[s.dir]
        const pulse = s.wave === 0 ? 1.18 : 1
        ctx.save()
        ctx.shadowColor = CYAN
        ctx.shadowBlur = ghost ? 8 : 14
        ctx.fillStyle = '#2bffd0'
        ctx.beginPath()
        ctx.arc(h.x, h.y, CELL * 0.5 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        // lengua
        if ((s.t % 1.6) < 0.22 && s.phase === 'playing') {
          ctx.strokeStyle = '#ff4d6d'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          const tx = h.x + dv.x * (CELL * 0.5)
          const ty = h.y + dv.y * (CELL * 0.5)
          ctx.moveTo(tx, ty)
          ctx.lineTo(tx + dv.x * 5, ty + dv.y * 5)
          ctx.moveTo(tx + dv.x * 5, ty + dv.y * 5)
          ctx.lineTo(tx + dv.x * 8 + dv.y * 2.5, ty + dv.y * 8 + dv.x * 2.5)
          ctx.moveTo(tx + dv.x * 5, ty + dv.y * 5)
          ctx.lineTo(tx + dv.x * 8 - dv.y * 2.5, ty + dv.y * 8 - dv.x * 2.5)
          ctx.stroke()
        }
        // ojos
        const fx = s.food.vx * CELL + CELL / 2 - h.x
        const fy = s.food.vy * CELL + CELL / 2 - h.y
        const fl = Math.hypot(fx, fy) || 1
        const eyeSep = 4.2
        const fwd = 3
        for (const sd of [-1, 1]) {
          const ex = h.x + dv.x * fwd + -dv.y * sd * eyeSep
          const ey = h.y + dv.y * fwd + dv.x * sd * eyeSep
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(ex, ey, 3.1, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#070213'
          ctx.beginPath()
          ctx.arc(ex + (fx / fl) * 1.2, ey + (fy / fl) * 1.2, 1.7, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()

        // aura del imán
        if (s.fx.magnet > 0) {
          ctx.save()
          ctx.strokeStyle = POWER.magnet.color
          ctx.globalAlpha = 0.28 + 0.12 * Math.sin(s.t * 6)
          ctx.setLineDash([6, 8])
          ctx.lineDashOffset = -s.t * 30
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(h.x, h.y, MAGNET_RANGE * CELL, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      // marca de muerte (celda fatal)
      if (s.death && s.death.cause !== 'wall') {
        const c = s.death.cell
        ctx.save()
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(s.t * 18)
        ctx.strokeStyle = '#ff3b5c'
        ctx.lineWidth = 3
        rr(ctx, c.x * CELL + 2, c.y * CELL + 2, CELL - 4, CELL - 4, 5)
        ctx.stroke()
        ctx.restore()
      }

      // tinte de cámara lenta
      if (s.fx.slow > 0) {
        ctx.fillStyle = 'rgba(70,170,255,0.07)'
        ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = 'rgba(92,200,255,0.25)'
        ctx.lineWidth = 6
        ctx.strokeRect(3, 3, W - 6, H - 6)
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pixelFont)

      // combo (arriba a la izquierda)
      if (s.combo >= 2 && s.comboT > 0 && s.phase === 'playing') {
        const m = multOf(s.combo)
        const pop = 1 + Math.max(0, s.multPop) * 0.7
        ctx.save()
        ctx.translate(14, 24)
        ctx.scale(pop, pop)
        ctx.font = font(15)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillText(`x${m}`, 1.5, 1.5)
        ctx.fillStyle = m >= 4 ? GOLD : '#ff7ae0'
        ctx.fillText(`x${m}`, 0, 0)
        ctx.restore()
        const frac = Math.max(0, s.comboT / s.comboWindow)
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        rr(ctx, 12, 36, 56, 5, 2.5)
        ctx.fill()
        ctx.fillStyle = frac < 0.3 ? '#ff5c7a' : m >= 4 ? GOLD : '#ff7ae0'
        rr(ctx, 12, 36, Math.max(3, 56 * frac), 5, 2.5)
        ctx.fill()
      }

      // indicadores de power-ups activos (arriba a la derecha)
      let row = 0
      for (const kind of POWER_KINDS) {
        const left = s.fx[kind]
        if (left <= 0) continue
        const p = POWER[kind]
        const y = 22 + row * 20
        ctx.fillStyle = 'rgba(8,3,24,0.7)'
        rr(ctx, W - 96, y - 9, 86, 18, 9)
        ctx.fill()
        drawIcon(ctx, kind, W - 84, y - 1, 4.2, p.color)
        const frac = left / p.dur
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        rr(ctx, W - 72, y - 2.5, 56, 5, 2.5)
        ctx.fill()
        ctx.fillStyle = left < 1.5 && Math.sin(s.t * 20) > 0 ? '#ffffff' : p.color
        rr(ctx, W - 72, y - 2.5, Math.max(3, 56 * frac), 5, 2.5)
        ctx.fill()
        row += 1
      }

      // cartela de nivel
      if (s.banner) {
        const b = s.banner
        const k = Math.min(1, b.t / 0.4)
        const inK = Math.min(1, (1.8 - b.t) / 0.25)
        const sc = 0.7 + 0.3 * Math.min(1, inK) + (b.t > 1.55 ? (b.t - 1.55) * 0.5 : 0)
        ctx.save()
        ctx.globalAlpha = Math.min(1, k)
        ctx.translate(W / 2, H * 0.4)
        ctx.scale(sc, sc)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = font(24)
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.fillText(b.text, 3, 3)
        ctx.fillStyle = CYAN
        ctx.fillText(b.text, 0, 0)
        if (b.sub) {
          ctx.font = font(8)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(b.sub, 0, 30)
        }
        ctx.restore()
      }

      ctx.restore()
      juice.drawFlash(ctx, W, H)

      // pausa
      if (s.paused) {
        ctx.fillStyle = 'rgba(7,2,19,0.78)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = font(26)
        ctx.fillStyle = CYAN
        ctx.fillText('PAUSA', W / 2, H / 2 - 10)
        ctx.font = font(8)
        ctx.fillStyle = '#ffffff'
        ctx.fillText('Pulsa P o toca la pantalla', W / 2, H / 2 + 24)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---- bucle -----------------------------------------------------------

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const jp = justPressedRef.current
      const q = keyQueueRef.current

      if ((jp.has('pause') || jp.has('action')) && s.phase === 'playing') {
        s.paused = !s.paused
        sfx.pause()
      }

      if (s.paused) {
        jp.clear()
        q.length = 0
        draw()
        raf = requestAnimationFrame(loop)
        return
      }

      s.t += rawDt
      const dt = juice.update(rawDt)
      // los orbes se deslizan suavemente a su celda (imán) y aparecen con "pop"
      const sl = Math.min(1, rawDt * 16)
      for (const o of [s.food, s.gold]) {
        if (!o) continue
        o.vx += (o.x - o.vx) * sl
        o.vy += (o.y - o.vy) * sl
        o.age += rawDt
      }
      if (s.item) s.item.age += rawDt
      if (s.multPop > 0) s.multPop -= rawDt
      if (s.banner) {
        s.banner.t -= rawDt
        if (s.banner.t <= 0) s.banner = null
      }

      if (s.phase === 'ready') {
        const startKey = q.find((k) => k === 'up' || k === 'down' || k === 'left' || k === 'right')
        if (startKey) begin(startKey as Dir)
        else if (jp.has('action')) begin()
      } else if (s.phase === 'playing') {
        for (const k of q as LogicalKey[]) {
          if (k !== 'up' && k !== 'down' && k !== 'left' && k !== 'right') continue
          const ref = s.queue.length > 0 ? s.queue[s.queue.length - 1] : s.dir
          if (k !== ref && k !== OPPOSITE[ref] && s.queue.length < 3) s.queue.push(k)
        }

        // temporizadores del mundo (con dt de juego: se congelan en hit-stop)
        s.nearCd -= dt
        if (s.comboT > 0) {
          s.comboT -= dt
          if (s.comboT <= 0) {
            if (multOf(s.combo) >= 2) juice.text(W / 2, 54, 'combo perdido', '#9a8cc0', 8, 0.9)
            s.combo = 0
          }
        }
        for (const kind of POWER_KINDS) {
          if (s.fx[kind] > 0) {
            s.fx[kind] -= dt
            if (s.fx[kind] <= 0) {
              s.fx[kind] = 0
              tone({ freq: 330, to: 200, dur: 0.14, vol: 0.035, type: 'triangle' })
            }
          }
        }
        if (s.gold) {
          s.gold.life -= dt
          if (s.gold.life <= 0) {
            juice.burst(cx(s.gold.x), cx(s.gold.y), [GOLD], { count: 8, speed: 60, life: 0.4, size: 2.5 })
            s.gold = null
          }
        }
        if (s.item) {
          s.item.life -= dt
          if (s.item.life <= 0) s.item = null
        }
        for (const r of s.rocks) {
          if (r.warm > 0) {
            r.warm -= dt
            if (r.warm <= 0) {
              if (onSnake(s, r.x, r.y) || (s.food.x === r.x && s.food.y === r.y)) r.warm = 0.3
              else juice.burst(cx(r.x), cx(r.y), [PURPLE, '#ff5c7a'], { count: 6, speed: 60, life: 0.3, size: 2.5 })
            }
          }
        }

        s.acc += dt * 1000 * (s.fx.slow > 0 ? 0.58 : 1)
        while (s.acc >= s.stepMs && s.phase === 'playing') {
          s.acc -= s.stepMs
          step()
        }
      } else if (s.phase === 'dying') {
        s.deathT += rawDt
        if (s.deathT > 0.4 && (jp.has('action') || q.length > 0)) restart()
        else if (s.deathT > 0.95) finishOver()
      } else if (s.phase === 'over') {
        if (jp.has('action')) restart()
      }

      jp.clear()
      q.length = 0
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
  }, [justPressedRef, keyQueueRef])

  // ---- gestos táctiles sobre el tablero ------------------------------------

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return
    swipeRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const sw = swipeRef.current
    if (!sw || sw.id !== e.pointerId) return
    const dx = e.clientX - sw.x
    const dy = e.clientY - sw.y
    if (Math.hypot(dx, dy) < 18) return
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    keyQueueRef.current.push(d)
    sw.x = e.clientX
    sw.y = e.clientY
    sw.moved = true
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const sw = swipeRef.current
    if (!sw || sw.id !== e.pointerId) return
    swipeRef.current = null
    if (!sw.moved) actionsRef.current?.resume()
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-2xl bg-gradient-to-br from-[#22f7c5] via-[#b026ff] to-[#ff2fd6] p-[3px] shadow-[0_0_36px_rgba(176,38,255,0.35)]"
        hud={
          <Hud>
            <span className="text-[#22f7c5] drop-shadow-[0_0_6px_rgba(34,247,197,0.8)]">PUNTOS {score}</span>
            <span className="text-[#ffe23d]">NIVEL {level}</span>
            <span className="text-[#ff2fd6] drop-shadow-[0_0_6px_rgba(255,47,214,0.8)]">
              RÉCORD {Math.max(best, score)}
            </span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none rounded-[13px] bg-[#070213] object-contain"
          aria-label="Juego Snake Neón"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        />

        {phase === 'ready' && (
          <StartOverlay
            title="SNAKE NEÓN"
            accent="#22f7c5"
            subtitle="Come orbes rápido para encadenar combos. Recoge los power-ups y esquiva obstáculos."
            hint="Pulsa una flecha o WASD para empezar"
            touchHint="Desliza o usa la cruceta para empezar"
            onStart={() => actionsRef.current?.begin()}
          />
        )}

        {phase === 'over' && (
          <GameOverOverlay
            accent="#ff2fd6"
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Orbes', value: stats.eaten },
              { label: 'Longitud', value: stats.length },
              { label: 'Combo máx.', value: `x${stats.mult}` },
              { label: 'Nivel', value: stats.level },
            ]}
            onRestart={() => actionsRef.current?.restart()}
          />
        )}
      </GameScreen>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Pausa" />
    </div>
  )
}
