'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys, type Dir } from './use-keys'
import { useSwipeKeys } from './gestures'
import { loadBest, saveBest, renderScale } from './game-utils'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { StartOverlay, GameOverOverlay, Hud } from './overlay'
import { Juice } from './juice'
import { sfx, tone } from './sfx'

const GAME_ID = 'ghost-maze'
const ACCENT = '#FFE23D'

/* ------------------------------------------------------------------ */
/*  Laberintos: banda superior + centro (casa de fantasmas) + inferior  */
/* ------------------------------------------------------------------ */

const COLS = 17
const ROWS = 23
const T = 24
// Laberinto fijo (MW x MH). El lienzo lógico (W x H) lo llena la pantalla: el laberinto va centrado.
const MW = COLS * T
const MH = ROWS * T
let W = MW
let H = MH
let OX = 0
let OY = 0

/** Ajusta el lienzo al área de la pantalla y centra el laberinto dentro. */
function layout() {
  const f = fitStage(MW, MH)
  W = f.w
  H = f.h
  OX = (W - MW) / 2
  OY = (H - MH) / 2
  publishLogical(f)
}
const TUNNEL_ROW = 11
const EXIT_TILE = { c: 8, r: 9 }
const PLAYER_START = { c: 8, r: 18 }
const FRUIT_TILE = { c: 8, r: 13 }

const TOP_BANDS: string[][] = [
  [
    '#o.............o#',
    '#.##.###.###.##.#',
    '#.##.###.###.##.#',
    '#...............#',
    '#.##.###.###.##.#',
    '#.##.###.###.##.#',
    '#...............#',
  ],
  [
    '#o.............o#',
    '#.##.#######.##.#',
    '#.##.#######.##.#',
    '#...............#',
    '#.######.######.#',
    '#.######.######.#',
    '#...............#',
  ],
  [
    '#o.............o#',
    '#.####.###.####.#',
    '#.####.###.####.#',
    '#...............#',
    '#.##.#.###.#.##.#',
    '#.##.#.###.#.##.#',
    '#...............#',
  ],
]

const MID_BANDS: string[][] = [
  [
    '####.###.###.####',
    '####.........####',
    '####.###-###.####',
    '    .##GGG##.    ',
    '####.#######.####',
    '####.........####',
    '####.###.###.####',
  ],
  [
    '####.#.###.#.####',
    '####.........####',
    '####.###-###.####',
    '    .##GGG##.    ',
    '####.#######.####',
    '####.........####',
    '####.#.###.#.####',
  ],
]

interface Theme {
  wall: string
  glow: string
  fill: string
}

const THEMES: Theme[] = [
  { wall: '#5b7bff', glow: '#3350ff', fill: '#0a0f3a' },
  { wall: '#ff5fd8', glow: '#e020b0', fill: '#2a0a2c' },
  { wall: '#3cffa0', glow: '#10c070', fill: '#06261a' },
  { wall: '#ffa23c', glow: '#e07010', fill: '#2a1604' },
  { wall: '#3ce6ff', glow: '#10a8d0', fill: '#062430' },
  { wall: '#b08cff', glow: '#7a50f0', fill: '#170c36' },
]

// [banda superior, centro, banda inferior (espejada)]
const MAZE_COMBOS: [number, number, number][] = [
  [0, 0, 1],
  [1, 1, 2],
  [2, 0, 0],
  [2, 1, 1],
  [1, 0, 2],
  [0, 1, 0],
]

function mazeRows(combo: number): string[] {
  const [t, m, b] = MAZE_COMBOS[combo % MAZE_COMBOS.length]
  return ['#################', ...TOP_BANDS[t], ...MID_BANDS[m], ...[...TOP_BANDS[b]].reverse(), '#################']
}

/* ------------------------------------------------------------------ */
/*  Tipos y utilidades                                                  */
/* ------------------------------------------------------------------ */

const TIE_ORDER: Dir[] = ['up', 'left', 'down', 'right']
const VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIR_ANGLE: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }

type Phase = 'idle' | 'ready' | 'play' | 'dying' | 'clear' | 'inter' | 'over'
type GhostState = 'house' | 'leaving' | 'active' | 'eyes' | 'entering'

interface Mover {
  /** Posición en unidades de casilla (centro de la casilla c = c + 0.5). */
  x: number
  y: number
  c: number
  r: number
  tc: number
  tr: number
  moving: boolean
  dir: Dir
}

interface Player extends Mover {
  want: Dir | null
  wantT: number
  chomp: number
  speedMul: number
}

interface Ghost extends Mover {
  id: number
  color: string
  state: GhostState
  fright: boolean
  rev: boolean
  releaseT: number
  slotX: number
}

interface Fruit {
  kind: number
  t: number
}

interface World {
  combo: number
  grid: string[][]
  pellets: Uint8Array
  left: number
  total: number
  dist: Int16Array
  player: Player
  ghosts: Ghost[]
  phase: Phase
  phaseT: number
  level: number
  score: number
  lives: number
  modeIdx: number
  modeT: number
  scaredT: number
  scaredDur: number
  chain: number
  fruit: Fruit | null
  fruitsSpawned: number
  extraLifeGiven: boolean
  paused: boolean
  time: number
  sirenT: number
  waka: boolean
  hideGhosts: boolean
  readyDur: number
  stats: { ghosts: number; fruits: number; pellets: number }
}

const FRUITS = [
  { name: 'Cereza', pts: 100 },
  { name: 'Fresa', pts: 300 },
  { name: 'Naranja', pts: 500 },
  { name: 'Manzana', pts: 700 },
  { name: 'Melón', pts: 1000 },
  { name: 'Estrella', pts: 2000 },
  { name: 'Campana', pts: 3000 },
  { name: 'Llave', pts: 5000 },
]

const GHOST_DEFS = [
  { color: '#ff3b3b', scatter: { c: 14, r: -2 }, slotX: 8.5 },
  { color: '#ff8fd0', scatter: { c: 2, r: -2 }, slotX: 8.5 },
  { color: '#3fe8ff', scatter: { c: 16, r: 24 }, slotX: 7.5 },
  { color: '#ffa53a', scatter: { c: 0, r: 24 }, slotX: 9.5 },
]

// Tiempos de dispersión / persecución (alternan). Infinity = persecución final.
function modeTimes(level: number): number[] {
  if (level === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity]
  if (level < 5) return [7, 20, 7, 20, 5, 40, 3, Infinity]
  return [5, 20, 5, 20, 4, 60, 2, Infinity]
}

const fearDuration = (level: number) => Math.max(1.4, 7.5 - (level - 1) * 0.9)
const playerBaseSpeed = (level: number) => Math.min(6.0, 5.4 + (level - 1) * 0.07)
const ghostBaseSpeed = (level: number) => Math.min(5.55, 4.3 + (level - 1) * 0.2)

const cellOpen = (grid: string[][], c: number, r: number): boolean => {
  if (c < 0 || c >= COLS) return r === TUNNEL_ROW
  if (r < 0 || r >= ROWS) return false
  const ch = grid[r][c]
  return ch !== '#' && ch !== '-' && ch !== 'G'
}

/** Distancias (BFS) desde la casilla de salida de la casa: así los ojos siempre vuelven. */
function buildHomeDist(grid: string[][]): Int16Array {
  const d = new Int16Array(ROWS * COLS).fill(-1)
  const q: number[] = [EXIT_TILE.r * COLS + EXIT_TILE.c]
  d[q[0]] = 0
  for (let i = 0; i < q.length; i++) {
    const idx = q[i]
    const c = idx % COLS
    const r = (idx / COLS) | 0
    for (const dir of TIE_ORDER) {
      let nc = c + VEC[dir].x
      const nr = r + VEC[dir].y
      if (nc < 0) nc = COLS - 1
      else if (nc >= COLS) nc = 0
      if (nr < 0 || nr >= ROWS || !cellOpen(grid, nc, nr)) continue
      const ni = nr * COLS + nc
      if (d[ni] >= 0) continue
      d[ni] = d[idx] + 1
      q.push(ni)
    }
  }
  return d
}

/* ------------------------------------------------------------------ */
/*  Capas de dibujo cacheadas (muros)                                   */
/* ------------------------------------------------------------------ */

function cellPath(
  p: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  p.moveTo(x + tl, y)
  p.lineTo(x + w - tr, y)
  if (tr) p.arcTo(x + w, y, x + w, y + tr, tr)
  else p.lineTo(x + w, y)
  p.lineTo(x + w, y + h - br)
  if (br) p.arcTo(x + w, y + h, x + w - br, y + h, br)
  else p.lineTo(x + w, y + h)
  p.lineTo(x + bl, y + h)
  if (bl) p.arcTo(x, y + h, x, y + h - bl, bl)
  else p.lineTo(x, y + h)
  p.lineTo(x, y + tl)
  if (tl) p.arcTo(x, y, x + tl, y, tl)
  else p.lineTo(x, y)
  p.closePath()
}

function buildWallLayer(grid: string[][], theme: Theme, flash: boolean): HTMLCanvasElement {
  const dpr = renderScale()
  const cv = document.createElement('canvas')
  cv.width = MW * dpr
  cv.height = MH * dpr
  const g = cv.getContext('2d')
  if (!g) return cv
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.fillStyle = '#04040E'
  g.fillRect(0, 0, MW, MH)
  const isWall = (c: number, r: number) => {
    if (c < 0 || c >= COLS) return r !== TUNNEL_ROW
    if (r < 0 || r >= ROWS) return true
    return grid[r][c] === '#'
  }
  const rad = 9
  const fillP = new Path2D()
  const lineP = new Path2D()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r)) continue
      const x = c * T
      const y = r * T
      const U = !isWall(c, r - 1)
      const D = !isWall(c, r + 1)
      const L = !isWall(c - 1, r)
      const R = !isWall(c + 1, r)
      const tl = U && L
      const tr = U && R
      const br = D && R
      const bl = D && L
      cellPath(fillP, x, y, T, T, tl ? rad : 0, tr ? rad : 0, br ? rad : 0, bl ? rad : 0)
      if (U) {
        lineP.moveTo(x + (tl ? rad : 0), y)
        lineP.lineTo(x + T - (tr ? rad : 0), y)
      }
      if (D) {
        lineP.moveTo(x + (bl ? rad : 0), y + T)
        lineP.lineTo(x + T - (br ? rad : 0), y + T)
      }
      if (L) {
        lineP.moveTo(x, y + (tl ? rad : 0))
        lineP.lineTo(x, y + T - (bl ? rad : 0))
      }
      if (R) {
        lineP.moveTo(x + T, y + (tr ? rad : 0))
        lineP.lineTo(x + T, y + T - (br ? rad : 0))
      }
      if (tl) {
        lineP.moveTo(x, y + rad)
        lineP.arc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5)
      }
      if (tr) {
        lineP.moveTo(x + T - rad, y)
        lineP.arc(x + T - rad, y + rad, rad, Math.PI * 1.5, Math.PI * 2)
      }
      if (br) {
        lineP.moveTo(x + T, y + T - rad)
        lineP.arc(x + T - rad, y + T - rad, rad, 0, Math.PI * 0.5)
      }
      if (bl) {
        lineP.moveTo(x + rad, y + T)
        lineP.arc(x + rad, y + T - rad, rad, Math.PI * 0.5, Math.PI)
      }
    }
  }
  g.fillStyle = flash ? '#cfd6ff' : theme.fill
  g.fill(fillP)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = flash ? '#ffffff' : theme.glow
  g.globalAlpha = 0.28
  g.lineWidth = 8
  g.stroke(lineP)
  g.globalAlpha = 0.55
  g.lineWidth = 5
  g.stroke(lineP)
  g.globalAlpha = 1
  g.strokeStyle = flash ? '#ffffff' : theme.wall
  g.lineWidth = 2.4
  g.stroke(lineP)
  // puerta de la casa
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '-') continue
      g.fillStyle = '#ff9ad5'
      g.fillRect(c * T + 1, r * T + T / 2 - 2, T - 2, 4)
    }
  }
  return cv
}

/* ------------------------------------------------------------------ */
/*  Sprites                                                             */
/* ------------------------------------------------------------------ */

function drawPac(g: CanvasRenderingContext2D, x: number, y: number, r: number, dir: Dir, mouth: number) {
  const a = DIR_ANGLE[dir]
  g.fillStyle = ACCENT
  g.beginPath()
  g.moveTo(x, y)
  g.arc(x, y, r, a + mouth * Math.PI, a - mouth * Math.PI)
  g.closePath()
  g.fill()
  // brillo
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.beginPath()
  g.arc(x - r * 0.25, y - r * 0.4, r * 0.22, 0, Math.PI * 2)
  g.fill()
}

function drawGhost(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  dir: Dir,
  t: number,
  mode: 'normal' | 'fright' | 'frightFlash' | 'eyes',
) {
  const frame = Math.floor(t * 8) % 2
  if (mode !== 'eyes') {
    g.fillStyle = mode === 'normal' ? color : mode === 'fright' ? '#2a3be0' : '#f4f4ff'
    g.beginPath()
    g.arc(x, y - r * 0.1, r, Math.PI, 0)
    g.lineTo(x + r, y + r)
    const n = 6
    for (let i = 1; i <= n; i++) {
      const px = x + r - (i * 2 * r) / n
      const py = y + r - (i % 2 === frame ? r * 0.38 : 0)
      g.lineTo(px, py)
    }
    g.closePath()
    g.fill()
  }
  if (mode === 'normal' || mode === 'eyes') {
    const v = VEC[dir]
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(x - r * 0.38 + v.x * r * 0.1, y - r * 0.25 + v.y * r * 0.1, r * 0.3, r * 0.38, 0, 0, Math.PI * 2)
    g.ellipse(x + r * 0.38 + v.x * r * 0.1, y - r * 0.25 + v.y * r * 0.1, r * 0.3, r * 0.38, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1d2bd0'
    g.beginPath()
    g.arc(x - r * 0.38 + v.x * r * 0.28, y - r * 0.25 + v.y * r * 0.3, r * 0.15, 0, Math.PI * 2)
    g.arc(x + r * 0.38 + v.x * r * 0.28, y - r * 0.25 + v.y * r * 0.3, r * 0.15, 0, Math.PI * 2)
    g.fill()
  } else {
    // cara asustada
    const face = mode === 'frightFlash' ? '#e02020' : '#ffd9c0'
    g.fillStyle = face
    g.fillRect(x - r * 0.45, y - r * 0.4, r * 0.24, r * 0.24)
    g.fillRect(x + r * 0.21, y - r * 0.4, r * 0.24, r * 0.24)
    g.strokeStyle = face
    g.lineWidth = 1.6
    g.beginPath()
    const my = y + r * 0.28
    g.moveTo(x - r * 0.6, my)
    for (let i = 1; i <= 5; i++) g.lineTo(x - r * 0.6 + i * r * 0.24, my + (i % 2 ? -r * 0.18 : 0))
    g.stroke()
  }
}

function drawFruit(g: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  const k = kind % FRUITS.length
  if (k === 0) {
    // cereza
    g.strokeStyle = '#3ddc6a'
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(-4, 4)
    g.quadraticCurveTo(-2, -6, 4, -9)
    g.moveTo(4, 4)
    g.quadraticCurveTo(5, -4, 4, -9)
    g.stroke()
    g.fillStyle = '#ff2d4a'
    g.beginPath()
    g.arc(-4.5, 5, 4, 0, Math.PI * 2)
    g.arc(4.5, 5, 4, 0, Math.PI * 2)
    g.fill()
  } else if (k === 1) {
    // fresa
    g.fillStyle = '#ff3355'
    g.beginPath()
    g.moveTo(-7, -4)
    g.quadraticCurveTo(0, -8, 7, -4)
    g.quadraticCurveTo(6, 6, 0, 9)
    g.quadraticCurveTo(-6, 6, -7, -4)
    g.fill()
    g.fillStyle = '#3ddc6a'
    g.fillRect(-5, -7, 10, 3)
    g.fillStyle = '#ffe9a0'
    g.fillRect(-3, -1, 1.5, 1.5)
    g.fillRect(2, 1, 1.5, 1.5)
    g.fillRect(-1, 4, 1.5, 1.5)
  } else if (k === 2) {
    // naranja
    g.fillStyle = '#ff9a1a'
    g.beginPath()
    g.arc(0, 2, 7.5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#3ddc6a'
    g.fillRect(-1, -7, 5, 3)
  } else if (k === 3) {
    // manzana
    g.fillStyle = '#ff2d2d'
    g.beginPath()
    g.arc(-3, 2, 6, 0, Math.PI * 2)
    g.arc(3, 2, 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#3ddc6a'
    g.fillRect(0, -7, 4, 3)
    g.fillStyle = '#6b3a14'
    g.fillRect(-1, -6, 1.5, 4)
  } else if (k === 4) {
    // melón
    g.fillStyle = '#7ee05a'
    g.beginPath()
    g.arc(0, 1, 8, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#2a9a3a'
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(-6, -3)
    g.lineTo(6, 5)
    g.moveTo(-6, 3)
    g.lineTo(2, 8)
    g.moveTo(-1, -7)
    g.lineTo(7, 0)
    g.stroke()
  } else if (k === 5) {
    // estrella
    g.fillStyle = '#ffe23d'
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 4 : 9
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + 1)
    }
    g.closePath()
    g.fill()
  } else if (k === 6) {
    // campana
    g.fillStyle = '#ffd23d'
    g.beginPath()
    g.moveTo(-8, 7)
    g.quadraticCurveTo(-7, -8, 0, -8)
    g.quadraticCurveTo(7, -8, 8, 7)
    g.closePath()
    g.fill()
    g.fillStyle = '#ffffff'
    g.fillRect(-1.5, 7, 3, 3)
  } else {
    // llave
    g.strokeStyle = '#3ce6ff'
    g.lineWidth = 2.4
    g.beginPath()
    g.arc(0, -4, 4, 0, Math.PI * 2)
    g.moveTo(0, 0)
    g.lineTo(0, 9)
    g.moveTo(0, 6)
    g.lineTo(4, 6)
    g.moveTo(0, 9)
    g.lineTo(3, 9)
    g.stroke()
  }
  g.restore()
}

/* ------------------------------------------------------------------ */
/*  Componente                                                          */
/* ------------------------------------------------------------------ */

export default function GhostMaze() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, pressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const swipe = useSwipeKeys(virtualPress, virtualRelease)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest(GAME_ID) : 0))
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [newBest, setNewBest] = useState(false)
  const [finalStats, setFinalStats] = useState({ level: 1, ghosts: 0, fruits: 0 })
  const beginRef = useRef<() => void>(() => {})

  const begin = useCallback(() => beginRef.current(), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) return
    const ctx: CanvasRenderingContext2D = ctx0
    // Ajusta el canvas al lienzo actual (también al girar la pantalla en partida).
    const sizeCanvas = () => {
      const dpr = renderScale()
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()
    const pixelFont =
      getComputedStyle(canvas).getPropertyValue('--font-pixel').trim() || '"Press Start 2P", monospace'
    const font = (px: number) => `${px}px ${pixelFont}`

    const juice = new Juice(7)
    const layers = new Map<string, HTMLCanvasElement>()
    const getLayer = (combo: number, grid: string[][], flash: boolean) => {
      const key = `${combo}-${flash ? 1 : 0}`
      let l = layers.get(key)
      if (!l) {
        for (const k of [...layers.keys()]) if (!k.startsWith(`${combo}-`)) layers.delete(k)
        l = buildWallLayer(grid, THEMES[combo % THEMES.length], flash)
        layers.set(key, l)
      }
      return l
    }

    /* ---------- mundo ---------- */
    const makeMover = (c: number, r: number, dir: Dir): Mover => ({
      x: c + 0.5,
      y: r + 0.5,
      c,
      r,
      tc: c,
      tr: r,
      moving: false,
      dir,
    })

    const loadMaze = (w: World) => {
      const rows = mazeRows(w.combo)
      w.grid = rows.map((row) => row.split(''))
      w.pellets = new Uint8Array(ROWS * COLS)
      let n = 0
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const ch = w.grid[r][c]
          if (ch === '.') {
            w.pellets[r * COLS + c] = 1
            n++
          } else if (ch === 'o') {
            w.pellets[r * COLS + c] = 2
            n++
          }
        }
      }
      // sin bolita en la casilla de salida del jugador
      w.left = n
      w.total = n
      w.dist = buildHomeDist(w.grid)
    }

    const resetActors = (w: World) => {
      const p = w.player
      Object.assign(p, makeMover(PLAYER_START.c, PLAYER_START.r, 'left'))
      p.want = null
      p.wantT = 0
      p.speedMul = 1
      const relMul = Math.max(0.5, 1 - (w.level - 1) * 0.08)
      w.ghosts = GHOST_DEFS.map((def, i) => {
        const m = i === 0 ? makeMover(8, 9, 'left') : makeMover(8, 11, 'up')
        const gh: Ghost = {
          ...m,
          id: i,
          color: def.color,
          state: i === 0 ? 'active' : 'house',
          fright: false,
          rev: false,
          releaseT: [0, 1.4, 5, 9][i] * relMul,
          slotX: def.slotX,
        }
        if (i > 0) {
          gh.x = def.slotX
          gh.y = 11.5
        }
        return gh
      })
      w.modeIdx = 0
      w.modeT = modeTimes(w.level)[0]
      w.scaredT = 0
      w.chain = 0
      w.fruit = null
      w.hideGhosts = false
      w.sirenT = 0
    }

    const makeWorld = (): World => {
      const w = {
        combo: 0,
        grid: [],
        pellets: new Uint8Array(0),
        left: 0,
        total: 0,
        dist: new Int16Array(0),
        player: { ...makeMover(PLAYER_START.c, PLAYER_START.r, 'left'), want: null, wantT: 0, chomp: 0, speedMul: 1 },
        ghosts: [],
        phase: 'idle',
        phaseT: 0,
        level: 1,
        score: 0,
        lives: 3,
        modeIdx: 0,
        modeT: 7,
        scaredT: 0,
        scaredDur: 7,
        chain: 0,
        fruit: null,
        fruitsSpawned: 0,
        extraLifeGiven: false,
        paused: false,
        time: 0,
        sirenT: 0,
        waka: false,
        hideGhosts: false,
        readyDur: 2,
        stats: { ghosts: 0, fruits: 0, pellets: 0 },
      } as World
      loadMaze(w)
      resetActors(w)
      return w
    }

    let w = makeWorld()
    const ui = { score: 0, lives: 3, level: 1 }
    const syncUi = () => {
      if (ui.score !== w.score) {
        ui.score = w.score
        setScore(w.score)
      }
      if (ui.lives !== w.lives) {
        ui.lives = w.lives
        setLives(w.lives)
      }
      if (ui.level !== w.level) {
        ui.level = w.level
        setLevel(w.level)
      }
    }

    const addScore = (n: number) => {
      w.score += n
      if (!w.extraLifeGiven && w.score >= 10000) {
        w.extraLifeGiven = true
        w.lives = Math.min(5, w.lives + 1)
        sfx.levelUp()
        juice.text(MW / 2, 13.5 * T, 'VIDA EXTRA', '#ff6b8a', 12, 1.4)
      }
    }

    /* ---------- movimiento ---------- */
    const reverse = (m: Mover) => {
      const oc = m.c
      const or = m.r
      m.c = m.tc
      m.r = m.tr
      m.tc = oc
      m.tr = or
      m.dir = OPP[m.dir]
    }

    const stepMover = (
      m: Mover,
      speed: number,
      dt: number,
      decide: (m: Mover) => void,
      onArrive: (m: Mover) => void,
    ) => {
      let rem = speed * dt
      for (let guard = 0; guard < 8 && rem > 0; guard++) {
        if (!m.moving) {
          decide(m)
          if (!m.moving) return
        }
        const tx = m.tc + 0.5
        const ty = m.tr + 0.5
        const dx = tx - m.x
        const dy = ty - m.y
        const d = Math.abs(dx) + Math.abs(dy)
        if (d <= rem + 1e-9) {
          m.x = tx
          m.y = ty
          rem -= d
          m.moving = false
          m.c = m.tc
          m.r = m.tr
          if (m.c < 0) {
            m.c = COLS - 1
            m.x = COLS - 0.5
          } else if (m.c >= COLS) {
            m.c = 0
            m.x = 0.5
          }
          m.tc = m.c
          m.tr = m.r
          onArrive(m)
        } else {
          m.x += Math.sign(dx) * rem
          m.y += Math.sign(dy) * rem
          rem = 0
        }
      }
    }

    const setTarget = (m: Mover, d: Dir) => {
      m.dir = d
      m.tc = m.c + VEC[d].x
      m.tr = m.r + VEC[d].y
      m.moving = true
    }

    /* ---------- jugador ---------- */
    const playerDecide = (m: Mover) => {
      const p = m as Player
      if (p.want && cellOpen(w.grid, p.c + VEC[p.want].x, p.r + VEC[p.want].y)) {
        setTarget(p, p.want)
        return
      }
      if (cellOpen(w.grid, p.c + VEC[p.dir].x, p.r + VEC[p.dir].y)) setTarget(p, p.dir)
    }

    const spawnFruit = () => {
      w.fruit = { kind: w.level - 1, t: 10 }
      w.fruitsSpawned++
      sfx.coin()
    }

    const playerArrive = (m: Mover) => {
      const idx = m.r * COLS + m.c
      const v = w.pellets[idx]
      if (v === 1) {
        w.pellets[idx] = 0
        w.left--
        w.stats.pellets++
        addScore(10)
        w.waka = !w.waka
        tone({ freq: w.waka ? 440 : 560, dur: 0.05, vol: 0.022, type: 'triangle' })
        for (const g of w.ghosts) if (g.state === 'house') g.releaseT -= 0.25
      } else if (v === 2) {
        w.pellets[idx] = 0
        w.left--
        addScore(50)
        sfx.power()
        w.chain = 0
        w.scaredDur = fearDuration(w.level)
        w.scaredT = w.scaredDur
        for (const g of w.ghosts) {
          if (g.state === 'eyes' || g.state === 'entering') continue
          g.fright = true
          if (g.state === 'active') g.rev = true
        }
        juice.shake(0.25)
        juice.flash('#5b7bff', 0.18)
        juice.burst((m.c + 0.5) * T, (m.r + 0.5) * T, ['#ffe23d', '#ffffff', '#8fb0ff'], {
          count: 14,
          speed: 110,
          life: 0.45,
          size: 3,
        })
      }
      if (w.fruitsSpawned === 0 && w.total - w.left >= 50 && !w.fruit) spawnFruit()
      else if (w.fruitsSpawned === 1 && w.total - w.left >= 120 && !w.fruit) spawnFruit()
      if (w.fruit && m.c === FRUIT_TILE.c && m.r === FRUIT_TILE.r) {
        const f = FRUITS[w.fruit.kind % FRUITS.length]
        addScore(f.pts)
        w.stats.fruits++
        sfx.golden()
        const fx = (FRUIT_TILE.c + 0.5) * T
        const fy = (FRUIT_TILE.r + 0.5) * T
        juice.text(fx, fy - 8, `+${f.pts}`, '#ffd24a', 11, 1.2)
        juice.burst(fx, fy, ['#ffe23d', '#ff7a7a', '#7affb0'], { count: 14, speed: 120, life: 0.5, size: 3 })
        w.fruit = null
      }
      if (w.left <= 0) startClear()
    }

    const updatePlayer = (dt: number) => {
      const p = w.player
      // entrada: buffer de giro
      const q = keyQueueRef.current
      for (const k of q) {
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
          p.want = k
          p.wantT = 0.55
        }
      }
      q.length = 0
      if (p.want) {
        if (pressedRef.current.has(p.want)) p.wantT = 0.55
        else {
          p.wantT -= dt
          if (p.wantT <= 0) {
            const held = TIE_ORDER.find((d) => pressedRef.current.has(d))
            p.want = held ?? null
            p.wantT = 0.55
          }
        }
      }
      if (w.phase !== 'play') return
      p.chomp += dt * (p.moving ? 1 : 0.2)
      if (p.moving && p.want && p.want !== p.dir) {
        if (p.want === OPP[p.dir]) {
          reverse(p)
        } else if (p.c >= 0 && p.c < COLS) {
          // giro tardío: se perdona un poco si ya pasaste la intersección
          const dist = Math.abs(p.x - (p.c + 0.5)) + Math.abs(p.y - (p.r + 0.5))
          if (dist < 0.3 && cellOpen(w.grid, p.c + VEC[p.want].x, p.r + VEC[p.want].y)) {
            p.x = p.c + 0.5
            p.y = p.r + 0.5
            setTarget(p, p.want)
          }
        }
      }
      const base = playerBaseSpeed(w.level)
      stepMover(p, base * (w.scaredT > 0 ? 1.08 : 1), dt, playerDecide, playerArrive)
    }

    /* ---------- fantasmas ---------- */
    const ghostTarget = (g: Ghost): { c: number; r: number } => {
      const p = w.player
      const pc = Math.floor(p.x)
      const pr = Math.floor(p.y)
      const def = GHOST_DEFS[g.id]
      const chase = w.modeIdx % 2 === 1
      if (!chase) return def.scatter
      const v = VEC[p.dir]
      if (g.id === 0) return { c: pc, r: pr }
      if (g.id === 1) return { c: pc + v.x * 4, r: pr + v.y * 4 }
      if (g.id === 2) {
        const red = w.ghosts[0]
        const ax = pc + v.x * 2
        const ay = pr + v.y * 2
        return { c: 2 * ax - Math.floor(red.x), r: 2 * ay - Math.floor(red.y) }
      }
      const d = Math.hypot(g.c - pc, g.r - pr)
      return d > 8 ? { c: pc, r: pr } : def.scatter
    }

    const ghostDecide = (m: Mover) => {
      const g = m as Ghost
      if (g.state === 'eyes') {
        let bestD = Infinity
        let best: Dir = g.dir
        for (const d of TIE_ORDER) {
          let nc = g.c + VEC[d].x
          const nr = g.r + VEC[d].y
          if (nc < 0) nc = COLS - 1
          else if (nc >= COLS) nc = 0
          if (nr < 0 || nr >= ROWS || !cellOpen(w.grid, nc, nr)) continue
          const dd = w.dist[nr * COLS + nc]
          if (dd >= 0 && dd < bestD) {
            bestD = dd
            best = d
          }
        }
        setTarget(g, best)
        return
      }
      const opts: Dir[] = []
      for (const d of TIE_ORDER) {
        if (d === OPP[g.dir]) continue
        if (cellOpen(w.grid, g.c + VEC[d].x, g.r + VEC[d].y)) opts.push(d)
      }
      if (opts.length === 0) {
        const back = OPP[g.dir]
        if (cellOpen(w.grid, g.c + VEC[back].x, g.r + VEC[back].y)) opts.push(back)
        else return
      }
      let pick = opts[0]
      if (g.fright) {
        pick = opts[(Math.random() * opts.length) | 0]
      } else if (opts.length > 1) {
        const tgt = ghostTarget(g)
        let bestD = Infinity
        for (const d of opts) {
          const dd = Math.hypot(g.c + VEC[d].x - tgt.c, g.r + VEC[d].y - tgt.r)
          if (dd < bestD - 1e-9) {
            bestD = dd
            pick = d
          }
        }
      }
      setTarget(g, pick)
    }

    const ghostArrive = (m: Mover) => {
      const g = m as Ghost
      if (g.state === 'eyes' && g.c === EXIT_TILE.c && g.r === EXIT_TILE.r) {
        g.state = 'entering'
        g.x = EXIT_TILE.c + 0.5
        g.y = EXIT_TILE.r + 0.5
        g.moving = false
      }
    }

    const ghostSpeed = (g: Ghost): number => {
      if (g.state === 'eyes') return 10
      let s = ghostBaseSpeed(w.level)
      if (g.id === 0) {
        if (w.left <= 10) s += 0.5
        else if (w.left <= 22) s += 0.25
      }
      if (g.fright) s *= 0.52
      if (g.r === TUNNEL_ROW && (g.c <= 3 || g.c >= COLS - 4)) s *= 0.55
      return s
    }

    const killPlayer = () => {
      w.phase = 'dying'
      w.phaseT = 0
      w.hideGhosts = false
      w.fruit = null
      juice.freeze(220)
      juice.shake(0.55)
      juice.flash('#ff3b3b', 0.25)
      sfx.hurt()
    }

    function startClear() {
      w.phase = 'clear'
      w.phaseT = 0
      w.fruit = null
      w.scaredT = 0
      for (const g of w.ghosts) g.fright = false
      addScore(500)
      juice.freeze(260)
      juice.text(MW / 2, 13.5 * T, '+500', '#ffe23d', 12, 1.4)
      sfx.levelUp()
    }

    const updateGhosts = (dt: number) => {
      const p = w.player
      // alternancia dispersión / persecución (se detiene mientras hay miedo)
      if (w.scaredT <= 0) {
        const times = modeTimes(w.level)
        w.modeT -= dt
        if (w.modeT <= 0 && w.modeIdx < times.length - 1) {
          w.modeIdx++
          w.modeT = times[w.modeIdx]
          for (const g of w.ghosts) if (g.state === 'active') g.rev = true
        }
      } else {
        w.scaredT -= dt
        if (w.scaredT <= 0) {
          w.scaredT = 0
          for (const g of w.ghosts) g.fright = false
        }
      }
      for (const g of w.ghosts) {
        if (g.rev && g.state === 'active') {
          if (g.moving) reverse(g)
          else g.dir = OPP[g.dir]
          g.rev = false
        }
        switch (g.state) {
          case 'house': {
            g.releaseT -= dt
            g.y = 11.5 + Math.sin(w.time * 7 + g.id * 1.7) * 0.13
            if (g.releaseT <= 0) g.state = 'leaving'
            break
          }
          case 'leaving': {
            const sp = 3.6 * dt
            if (Math.abs(g.x - 8.5) > 0.02) {
              g.x += Math.sign(8.5 - g.x) * Math.min(sp, Math.abs(8.5 - g.x))
              g.y += Math.sign(11.5 - g.y) * Math.min(sp, Math.abs(11.5 - g.y))
            } else {
              g.x = 8.5
              g.y -= sp
              if (g.y <= EXIT_TILE.r + 0.5) {
                Object.assign(g, makeMover(EXIT_TILE.c, EXIT_TILE.r, Math.random() < 0.5 ? 'left' : 'right'))
                g.state = 'active'
              }
            }
            break
          }
          case 'entering': {
            g.y += 6.5 * dt
            if (g.y >= 11.5) {
              g.y = 11.5
              g.fright = false
              g.state = 'leaving'
              g.releaseT = 0
            }
            break
          }
          default:
            stepMover(g, ghostSpeed(g), dt, ghostDecide, ghostArrive)
        }
        // colisión con el jugador
        const solid = g.state === 'active' || (g.state === 'leaving' && g.y < 10.6)
        if (solid && Math.hypot(g.x - p.x, g.y - p.y) < 0.58) {
          if (g.fright) {
            g.state = 'eyes'
            g.fright = false
            g.rev = false
            w.chain++
            w.stats.ghosts++
            const pts = 200 * 2 ** (w.chain - 1)
            addScore(pts)
            sfx.eatGhost()
            const gx = g.x * T
            const gy = g.y * T
            juice.freeze(170)
            juice.shake(0.28)
            juice.flash(g.color, 0.2)
            juice.text(gx, gy - 10, `+${pts}`, '#7df9ff', 13, 1.2)
            juice.burst(gx, gy, [g.color, '#ffffff', '#4a6bff'], { count: 18, speed: 150, life: 0.5, size: 3.4 })
          } else {
            killPlayer()
            return
          }
        }
      }
    }

    /* ---------- fases ---------- */
    const startLevelReady = (isNewGame: boolean) => {
      w.phase = 'ready'
      w.phaseT = 0
      w.readyDur = isNewGame ? 2.2 : 1.6
      if (isNewGame) sfx.start()
    }

    const nextLevel = () => {
      w.level++
      w.combo = (w.combo + 1) % MAZE_COMBOS.length
      w.fruitsSpawned = 0
      loadMaze(w)
      resetActors(w)
      startLevelReady(false)
    }

    const finishGame = () => {
      w.phase = 'over'
      const isNew = saveBest(GAME_ID, w.score)
      setNewBest(isNew)
      setBest((b) => Math.max(b, w.score))
      setFinalStats({ level: w.level, ghosts: w.stats.ghosts, fruits: w.stats.fruits })
      setOver(true)
      sfx.gameOver()
    }

    const beginGame = () => {
      juice.reset()
      w = makeWorld()
      w.paused = false
      startLevelReady(true)
      ui.score = -1
      ui.lives = -1
      ui.level = -1
      syncUi()
      setOver(false)
      setNewBest(false)
      setStarted(true)
    }
    beginRef.current = beginGame

    /* ---------- bucle principal ---------- */
    const update = (dtReal: number) => {
      const jp = justPressedRef.current
      const dirPressed = TIE_ORDER.some((d) => jp.has(d))

      if (w.phase === 'idle') {
        if (jp.has('action') || dirPressed) beginGame()
        return
      }
      if (w.phase === 'over') {
        if (jp.has('action')) beginGame()
        return
      }
      if (jp.has('pause')) {
        w.paused = !w.paused
        sfx.pause()
      } else if (w.paused && jp.has('action')) {
        w.paused = false
        sfx.pause()
      }
      if (w.paused) {
        keyQueueRef.current.length = 0
        return
      }

      const dt = juice.update(dtReal)
      if (dt === 0) return
      w.time += dt
      w.phaseT += dt

      switch (w.phase) {
        case 'ready': {
          updatePlayer(dt)
          if (w.phaseT >= w.readyDur) {
            w.phase = 'play'
            w.phaseT = 0
          }
          break
        }
        case 'play': {
          updatePlayer(dt)
          if (w.phase !== 'play') break
          updateGhosts(dt)
          if (w.fruit) {
            w.fruit.t -= dt
            if (w.fruit.t <= 0) w.fruit = null
          }
          // sirena ambiental
          w.sirenT -= dt
          if (w.sirenT <= 0) {
            const eyes = w.ghosts.some((g) => g.state === 'eyes')
            if (eyes) {
              tone({ freq: 900, to: 500, dur: 0.1, vol: 0.016, type: 'sine' })
              w.sirenT = 0.1
            } else if (w.scaredT > 0) {
              tone({ freq: 300, to: 360, dur: 0.1, vol: 0.014, type: 'square' })
              w.sirenT = 0.13
            } else {
              const prog = 1 - w.left / w.total
              const f = 150 + prog * 90 + (Math.floor(w.time * 3) % 2) * 30
              tone({ freq: f, to: f + 25, dur: 0.16, vol: 0.011, type: 'triangle' })
              w.sirenT = 0.3 - prog * 0.1
            }
          }
          break
        }
        case 'dying': {
          if (w.phaseT > 0.55 && w.phaseT - dt <= 0.55) {
            sfx.hurt()
            w.hideGhosts = true
          }
          if (w.phaseT > 1.55 && w.phaseT - dt <= 1.55) {
            const p = w.player
            juice.burst(p.x * T, p.y * T, [ACCENT, '#ffffff', '#ffb43d'], {
              count: 26,
              speed: 170,
              life: 0.7,
              size: 3.6,
            })
            juice.shake(0.35)
            sfx.explode()
          }
          if (w.phaseT >= 2.3) {
            w.lives--
            if (w.lives <= 0) {
              w.lives = 0
              syncUi()
              finishGame()
            } else {
              resetActors(w)
              startLevelReady(false)
            }
          }
          break
        }
        case 'clear': {
          if (w.phaseT >= 2.1) {
            w.phase = 'inter'
            w.phaseT = 0
          }
          break
        }
        case 'inter': {
          if (w.phaseT >= 3.6 || (w.phaseT > 1 && jp.has('action'))) nextLevel()
          break
        }
        default:
          break
      }
      syncUi()
    }

    /* ---------- dibujo ---------- */
    const drawPellets = () => {
      const pulse = 0.5 + 0.5 * Math.sin(w.time * 7)
      ctx.fillStyle = '#ffd9a0'
      ctx.beginPath()
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (w.pellets[r * COLS + c] === 1) {
            const x = c * T + T / 2
            const y = r * T + T / 2
            ctx.moveTo(x + 2.5, y)
            ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          }
        }
      }
      ctx.fill()
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (w.pellets[r * COLS + c] !== 2) continue
          const x = c * T + T / 2
          const y = r * T + T / 2
          const rad = 5 + pulse * 2.2
          ctx.fillStyle = 'rgba(255,200,92,0.22)'
          ctx.beginPath()
          ctx.arc(x, y, rad + 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffd36b'
          ctx.beginPath()
          ctx.arc(x, y, rad, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff6d0'
          ctx.beginPath()
          ctx.arc(x - 1.5, y - 1.5, rad * 0.35, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const ghostMode = (g: Ghost): 'normal' | 'fright' | 'frightFlash' | 'eyes' => {
      if (g.state === 'eyes' || g.state === 'entering') return 'eyes'
      if (g.fright) {
        return w.scaredT < 2 && Math.floor(w.time * 8) % 2 === 0 ? 'frightFlash' : 'fright'
      }
      return 'normal'
    }

    const drawActors = () => {
      const p = w.player
      const R = T * 0.44
      // fruta
      if (w.fruit) {
        const blink = w.fruit.t < 2.5 && Math.floor(w.time * 10) % 2 === 0
        if (!blink) {
          const bob = Math.sin(w.time * 6) * 1.5
          drawFruit(ctx, w.fruit.kind, (FRUIT_TILE.c + 0.5) * T, (FRUIT_TILE.r + 0.5) * T + bob, 1.05)
        }
      }
      // jugador
      if (w.phase === 'dying') {
        const t = w.phaseT
        if (t < 0.55) {
          drawPac(ctx, p.x * T, p.y * T, R, p.dir, 0.1)
        } else if (t < 1.55) {
          const k = (t - 0.55) / 1.0
          ctx.save()
          const a = -Math.PI / 2
          const m = 0.08 + k * 0.92
          ctx.fillStyle = ACCENT
          ctx.beginPath()
          ctx.moveTo(p.x * T, p.y * T)
          ctx.arc(p.x * T, p.y * T, R, a + m * Math.PI, a - m * Math.PI)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      } else if (w.phase !== 'inter') {
        const open = p.moving ? 0.04 + 0.26 * Math.abs(Math.sin(p.chomp * 15)) : 0.1
        drawPac(ctx, p.x * T, p.y * T, R, p.dir, w.phase === 'ready' && w.phaseT < 0.01 ? 0.1 : open)
      }
      // fantasmas
      if (!w.hideGhosts && w.phase !== 'clear' && w.phase !== 'inter') {
        for (const g of w.ghosts) drawGhost(ctx, g.x * T, g.y * T, R, g.color, g.dir, w.time, ghostMode(g))
      } else if (w.phase === 'clear') {
        for (const g of w.ghosts) drawGhost(ctx, g.x * T, g.y * T, R, g.color, g.dir, 0, 'normal')
      }
    }

    const drawBanner = (text: string, y: number, color: string, size = 12, plate = false) => {
      ctx.font = font(size)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (plate) {
        const tw = ctx.measureText(text).width + 18
        ctx.fillStyle = 'rgba(4,4,14,0.82)'
        ctx.fillRect(W / 2 - tw / 2, y - size * 0.95, tw, size * 1.9)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillText(text, W / 2 + 2, y + 2)
      ctx.fillStyle = color
      ctx.fillText(text, W / 2, y)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const drawIntermission = () => {
      const lv = w.level
      const theme = THEMES[(w.combo + 1) % THEMES.length]
      ctx.fillStyle = '#04040E'
      ctx.fillRect(0, 0, W, H)
      // estrellitas de fondo
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % W
        const sy = (i * 173) % H
        const tw = (Math.sin(w.time * 3 + i) + 1) / 2
        ctx.globalAlpha = 0.15 + tw * 0.4
        ctx.fillRect(sx, sy, 2, 2)
      }
      ctx.globalAlpha = 1
      drawBanner(`NIVEL ${lv + 1}`, H * 0.2, theme.wall, 20)
      drawBanner(`NIVEL ${lv} COMPLETADO`, H * 0.28, '#ffffff', 9)
      const t = w.phaseT
      const dur = 3.6
      const half = dur / 2
      const baseY = H * 0.52
      ctx.save()
      if (t < half) {
        const k = t / half
        const x = -50 + k * (W + 140)
        ctx.translate(0, baseY)
        drawPac(ctx, x, 0, 26, 'right', 0.05 + 0.3 * Math.abs(Math.sin(t * 14)))
        drawGhost(ctx, x - 90, 0, 26, '#ff3b3b', 'right', w.time, 'normal')
        drawGhost(ctx, x - 150, 0, 26, '#ff8fd0', 'right', w.time + 0.1, 'normal')
      } else {
        const k = (t - half) / half
        const x = W + 90 - k * (W + 260)
        ctx.translate(0, baseY)
        drawPac(ctx, x, 0, 44, 'left', 0.05 + 0.3 * Math.abs(Math.sin(t * 14)))
        drawGhost(ctx, x - 100, 0, 24, '#ff3b3b', 'left', w.time, w.time % 0.3 < 0.15 ? 'fright' : 'frightFlash')
        drawGhost(ctx, x - 150, 0, 24, '#ff8fd0', 'left', w.time + 0.1, 'fright')
      }
      ctx.restore()
      const nf = FRUITS[lv % FRUITS.length]
      drawBanner(`Siguiente fruta: ${nf.name}`, H * 0.7, '#ffd9a0', 8)
      drawFruit(ctx, lv, W / 2, H * 0.77, 1.7)
      drawBanner('Los fantasmas se aceleran', H * 0.86, '#ff8fd0', 8)
    }

    const draw = () => {
      ctx.save()
      ctx.fillStyle = '#04040E'
      ctx.fillRect(0, 0, W, H)
      if (w.phase === 'inter') {
        drawIntermission()
        ctx.restore()
        return
      }
      juice.applyShake(ctx)
      // rejilla tenue en los márgenes (el laberinto la tapa con su propio fondo)
      ctx.strokeStyle = 'rgba(125,249,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = OX % T; x < W; x += T) {
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, H)
      }
      for (let y = OY % T; y < H; y += T) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(W, y + 0.5)
      }
      ctx.stroke()
      const flash = w.phase === 'clear' && w.phaseT > 0.35 && Math.floor((w.phaseT - 0.35) / 0.22) % 2 === 0
      // el laberinto va en sus propias coordenadas, centrado en el lienzo
      ctx.save()
      ctx.translate(OX, OY)
      ctx.drawImage(getLayer(w.combo, w.grid, flash), 0, 0, MW, MH)
      if (w.phase !== 'clear' || w.phaseT < 0.35) drawPellets()
      drawActors()
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pixelFont)
      ctx.restore()
      // rótulos de estado (coordenadas de pantalla)
      if (w.phase === 'ready' && w.phaseT >= 0) {
        drawBanner(`NIVEL ${w.level}`, OY + 8.5 * T, '#7df9ff', 11, true)
        drawBanner('¡LISTO!', OY + 13.5 * T, ACCENT, 13, true)
      }
      if (w.scaredT > 0 && w.phase === 'play') {
        const k = w.scaredT / w.scaredDur
        ctx.fillStyle = 'rgba(80,110,255,0.25)'
        ctx.fillRect(OX + T, OY + MH - 7, MW - 2 * T, 3)
        ctx.fillStyle = k < 0.3 ? '#ff6b8a' : '#7df9ff'
        ctx.fillRect(OX + T, OY + MH - 7, (MW - 2 * T) * k, 3)
      }
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      if (w.paused) {
        ctx.fillStyle = 'rgba(4,4,14,0.78)'
        ctx.fillRect(0, 0, W, H)
        drawBanner('PAUSA', H / 2 - 12, ACCENT, 20)
        drawBanner('Pulsa P o A para seguir', H / 2 + 20, '#ffffff', 8)
      }
    }

    // El laberinto es fijo (MW x MH) y va centrado con OX/OY: basta con
    // reajustar el lienzo y pausar para que el jugador se reacomode.
    const relayoutLive = () => {
      layout()
      sizeCanvas()
      if (w.phase !== 'idle' && w.phase !== 'over') w.paused = true
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (w.phase === 'idle' || w.phase === 'over') requestRemount()
        else relayoutLive()
      }
      update(dt)
      justPressedRef.current.clear()
      if (w.phase !== 'ready' && w.phase !== 'play') keyQueueRef.current.length = 0
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const autoPause = () => {
      if (w.phase !== 'idle' && w.phase !== 'over') w.paused = true
    }
    const onVis = () => {
      if (document.hidden) autoPause()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', autoPause)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', autoPause)
    }
  }, [justPressedRef, pressedRef, keyQueueRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#232B7E] bg-[#04040E] shadow-[0_0_36px_rgba(77,99,255,0.25)]"
        hud={
          <Hud>
            <span className="text-[#FFE23D]">PTS {score.toLocaleString('es-MX')}</span>
            <span className="text-[#7df9ff]">NIV {level}</span>
            <span className="flex items-center gap-1" aria-label={`Vidas: ${lives}`}>
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <span key={i} className="inline-block size-2.5 rounded-full bg-[#FFE23D]" />
              ))}
            </span>
            <span className="text-white/60">HI {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          {...swipe}
          aria-label="Juego Laberinto Fantasma"
        />
        {!started && !over && (
          <StartOverlay
            title="LABERINTO FANTASMA"
            accent={ACCENT}
            subtitle="Come todas las bolitas. Cada fantasma te persigue distinto: el rojo de frente, el rosa te corta el paso, el cian te flanquea y el naranja duda. Las bolas grandes los asustan."
            hint="Flecha o ESPACIO para empezar"
            touchHint="Desliza para girar; puedes hacerlo antes de llegar a la esquina"
            onStart={begin}
          >
            <p className="max-w-xs text-xs leading-relaxed text-white/55">
              Anticipa los giros: si pulsas antes de la esquina, Pac gira al llegar.
            </p>
          </StartOverlay>
        )}
        {over && (
          <GameOverOverlay
            title="TE ATRAPARON"
            accent={ACCENT}
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Nivel', value: finalStats.level },
              { label: 'Fantasmas', value: finalStats.ghosts },
              { label: 'Frutas', value: finalStats.fruits },
            ]}
            onRestart={begin}
          />
        )}
      </GameScreen>

    </div>
  )
}
