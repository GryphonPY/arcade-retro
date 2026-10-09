'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { TouchPad } from './touch-pad'
import { GameOverOverlay, Hud, StartOverlay, useIsTouch } from './overlay'
import { Juice } from './juice'
import { loadBest, renderScale, rr, saveBest, setupCanvas } from './game-utils'
import { noise, sfx, tone } from './sfx'

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#a78bfa'
const COLS = 10
const HIDDEN = 2
const CELL = 24
const W0 = 360
const H0 = 520
const BY = 24 // origen Y del tablero (fila visible 0)
// Medidas lógicas: el tablero se centra a lo ancho y gana filas si sobra alto (ver layout).
let W = W0
let H = H0
let ROWS = 22 // 20 visibles + 2 ocultas
const BW = COLS * CELL
let BX = (W0 - BW) / 2 // origen X del tablero
let BH = 20 * CELL

/** Ajusta el tablero y los paneles laterales al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  BX = (W - BW) / 2
  BH = Math.max(20, Math.floor((H - BY - 16) / CELL)) * CELL
  ROWS = BH / CELL + HIDDEN
  publishLogical(f)
}

const DAS = 0.15
const ARR = 0.04
const LOCK_DELAY = 0.5
const MAX_LOCK_RESETS = 15
const CLEAR_TIME = 0.46

/** Tetrominós: I O T S Z J L */
const DEFS: { n: number; cells: [number, number][] }[] = [
  { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { n: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
]
const T_I = 0
const T_O = 1
const T_T = 2

/** SHAPES[tipo][rotación] = celdas [x, y] dentro de su caja */
const SHAPES: [number, number][][][] = DEFS.map((d, t) => {
  const out: [number, number][][] = [d.cells]
  for (let r = 1; r < 4; r++) {
    const prev = out[r - 1]
    out.push(t === T_O ? prev : prev.map(([x, y]) => [d.n - 1 - y, x] as [number, number]))
  }
  return out
})

/** Tablas de wall kick SRS (coordenadas con Y hacia arriba, como en la guía). */
type Kicks = Record<string, [number, number][]>
const KICK_JLSTZ: Kicks = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}
const KICK_I: Kicks = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

/* ------------------------------------------------------------------ */
/* Colores y dibujo de celdas                                          */
/* ------------------------------------------------------------------ */

function mix(hex: string, to: number, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const m = (v: number) => Math.round(v + (to - v) * a)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

const BASE_COLORS = ['#22d3ee', '#facc15', '#a855f7', '#4ade80', '#ef4444', '#3b82f6', '#fb923c', '#6b7280']
const COLORS = BASE_COLORS.map((base) => ({
  base,
  light: mix(base, 255, 0.55),
  dark: mix(base, 0, 0.35),
  edge: mix(base, 0, 0.78),
}))

function drawCell(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, a = 1) {
  const col = COLORS[t]
  const b = Math.max(1, Math.round(s / 8))
  c.globalAlpha = a
  c.fillStyle = col.edge
  c.fillRect(x, y, s, s)
  c.fillStyle = col.base
  c.fillRect(x + 1, y + 1, s - 2, s - 2)
  c.fillStyle = col.light
  c.fillRect(x + 1, y + 1, s - 2, b)
  c.fillRect(x + 1, y + 1, b, s - 2)
  c.fillStyle = col.dark
  c.fillRect(x + 1, y + s - 1 - b, s - 2, b)
  c.fillRect(x + s - 1 - b, y + 1, b, s - 2)
  if (s >= 16) {
    c.fillStyle = 'rgba(255,255,255,0.5)'
    c.fillRect(x + 1 + b + 1, y + 1 + b + 1, b, b)
  }
  c.globalAlpha = 1
}

/* ------------------------------------------------------------------ */
/* Sonidos locales                                                     */
/* ------------------------------------------------------------------ */

const snd = {
  move() {
    tone({ freq: 190, dur: 0.025, vol: 0.02, type: 'triangle' })
  },
  rotate() {
    tone({ freq: 300, to: 430, dur: 0.045, vol: 0.03, type: 'square' })
  },
  land() {
    noise({ dur: 0.05, vol: 0.04, freq: 500 })
    tone({ freq: 130, to: 80, dur: 0.06, vol: 0.04, type: 'triangle' })
  },
  hard() {
    noise({ dur: 0.1, vol: 0.08, freq: 900 })
    tone({ freq: 170, to: 50, dur: 0.12, vol: 0.07, type: 'triangle' })
  },
  hold() {
    tone({ freq: 560, to: 360, dur: 0.08, vol: 0.04, type: 'sine' })
    tone({ freq: 420, to: 640, dur: 0.08, vol: 0.03, type: 'sine', delay: 0.06 })
  },
  clear(n: number) {
    const seqs = [
      [523, 659],
      [523, 659, 784],
      [523, 659, 784, 988],
      [523, 659, 784, 1047, 1319],
    ]
    seqs[Math.min(4, n) - 1].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.055, type: 'square' }))
    if (n >= 4) {
      noise({ dur: 0.4, vol: 0.1, freq: 1400 })
      tone({ freq: 98, to: 49, dur: 0.4, vol: 0.08, type: 'sawtooth' })
      tone({ freq: 1568, dur: 0.25, vol: 0.04, delay: 0.3, type: 'triangle' })
    } else {
      noise({ dur: 0.1 + n * 0.04, vol: 0.05, freq: 1800 })
    }
  },
  tspin() {
    tone({ freq: 300, to: 900, dur: 0.18, vol: 0.05, type: 'sawtooth' })
    tone({ freq: 600, to: 1200, dur: 0.16, vol: 0.04, type: 'triangle', delay: 0.1 })
  },
  combo(n: number) {
    tone({ freq: 440 * Math.pow(1.0595, Math.min(n, 12) * 2), dur: 0.09, vol: 0.04, type: 'triangle', delay: 0.22 })
  },
}

/* ------------------------------------------------------------------ */
/* Estado de juego                                                     */
/* ------------------------------------------------------------------ */

interface Piece {
  t: number
  rot: number
  x: number
  y: number
}

interface G {
  board: Uint8Array
  cur: Piece | null
  queue: number[]
  hold: number
  holdUsed: boolean
  score: number
  lines: number
  level: number
  combo: number
  maxCombo: number
  b2b: boolean
  gravAcc: number
  lockT: number
  lockResets: number
  lowest: number
  lastRot: boolean
  lastKick: number
  dasDir: number
  dasT: number
  arrT: number
  lastH: number
  phase: 'ready' | 'play' | 'clear' | 'over'
  paused: boolean
  clearRows: number[]
  clearT: number
  pendingLevel: number
  landCells: [number, number][]
  landT: number
  kick: number
  trails: { x: number; y1: number; y2: number; t: number; color: string }[]
  banner: { text: string; t: number } | null
  overT: number
  overShown: boolean
  bufRot: boolean
  bufHold: boolean
  top: number
  time: number
}

function newG(): G {
  return {
    board: new Uint8Array(COLS * ROWS),
    cur: null,
    queue: [],
    hold: -1,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    maxCombo: 0,
    b2b: false,
    gravAcc: 0,
    lockT: 0,
    lockResets: 0,
    lowest: 0,
    lastRot: false,
    lastKick: 0,
    dasDir: 0,
    dasT: 0,
    arrT: 0,
    lastH: 0,
    phase: 'ready',
    paused: false,
    clearRows: [],
    clearT: 0,
    pendingLevel: 1,
    landCells: [],
    landT: 0,
    kick: 0,
    trails: [],
    banner: null,
    overT: 0,
    overShown: false,
    bufRot: false,
    bufHold: false,
    top: ROWS,
    time: 0,
  }
}

function fits(g: G, t: number, rot: number, x: number, y: number): boolean {
  for (const [cx, cy] of SHAPES[t][rot]) {
    const nx = x + cx
    const ny = y + cy
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false
    if (g.board[ny * COLS + nx]) return false
  }
  return true
}

function occupied(g: G, x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y >= ROWS) return true
  if (y < 0) return false
  return g.board[y * COLS + x] !== 0
}

/** Gravedad en segundos por fila, curva de la guía. */
function gravityOf(level: number): number {
  const l = Math.min(level, 20)
  return Math.pow(0.8 - (l - 1) * 0.007, l - 1)
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nextType(g: G): number {
  while (g.queue.length < 8) g.queue.push(...shuffle([0, 1, 2, 3, 4, 5, 6]))
  return g.queue.shift()!
}

function computeTop(g: G) {
  g.top = ROWS
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (g.board[y * COLS + x]) {
        g.top = y
        return
      }
    }
  }
}

interface Api {
  shift: (d: number) => void
  rotate: () => void
  hard: () => void
  soft: () => void
  hold: () => void
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function Bloques() {
  const { pressedRef, justPressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<() => void>(() => {})
  const apiRef = useRef<Api | null>(null)
  const gest = useRef({ id: -1, x0: 0, y0: 0, t0: 0, ax: 0, ay: 0, moved: false })
  const touch = useIsTouch()

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [hud, setHud] = useState({ score: 0, level: 1, lines: 0 })
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ lines: 0, level: 1, combo: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const dpr = renderScale()
    const juice = new Juice(7)
    const fontFam = (getComputedStyle(canvas).getPropertyValue('--font-pixel') || '').trim() || 'monospace'
    const font = `${fontFam}, monospace`
    let g = newG()
    let clearWasB2B = false
    let lastHud = { score: -1, level: -1, lines: -1 }
    let raf = 0
    let alive = true

    setBest(loadBest('bloques'))

    /* ---------- capa estática ---------- */
    const stat = document.createElement('canvas')
    stat.width = Math.round(W * dpr)
    stat.height = Math.round(H * dpr)
    {
      const s = stat.getContext('2d')!
      s.scale(dpr, dpr)
      const bg = s.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0f0b24')
      bg.addColorStop(1, '#090714')
      s.fillStyle = bg
      s.fillRect(0, 0, W, H)
      // paneles
      const panel = (x: number, y: number, w: number, h: number) => {
        rr(s, x, y, w, h, 6)
        s.fillStyle = 'rgba(167,139,250,0.07)'
        s.fill()
        s.strokeStyle = 'rgba(167,139,250,0.32)'
        s.lineWidth = 1
        s.stroke()
      }
      panel(4, BY, 52, 66)
      panel(4, BY + 74, 52, 58)
      panel(BX + BW + 4, BY, W - BX - BW - 8, 218)
      // zona de aparición
      s.fillStyle = 'rgba(167,139,250,0.05)'
      s.fillRect(BX, 0, BW, BY)
      // fondo del tablero
      const bb = s.createLinearGradient(0, BY, 0, BY + BH)
      bb.addColorStop(0, '#0c0920')
      bb.addColorStop(1, '#100b2b')
      s.fillStyle = bb
      s.fillRect(BX, BY, BW, BH)
      s.strokeStyle = 'rgba(255,255,255,0.045)'
      s.lineWidth = 1
      s.beginPath()
      for (let i = 1; i < COLS; i++) {
        s.moveTo(BX + i * CELL + 0.5, BY)
        s.lineTo(BX + i * CELL + 0.5, BY + BH)
      }
      for (let j = 1; j < ROWS - HIDDEN; j++) {
        s.moveTo(BX, BY + j * CELL + 0.5)
        s.lineTo(BX + BW, BY + j * CELL + 0.5)
      }
      s.stroke()
      // marco con neón
      s.save()
      s.shadowColor = ACCENT
      s.shadowBlur = 14
      s.strokeStyle = ACCENT
      s.lineWidth = 2
      s.strokeRect(BX - 1, BY - 1, BW + 2, BH + 2)
      s.restore()
      s.strokeStyle = 'rgba(255,255,255,0.25)'
      s.lineWidth = 1
      s.strokeRect(BX - 3.5, BY - 3.5, BW + 7, BH + 7)
    }

    /* ---------- utilidades ---------- */
    const txt = (
      c: CanvasRenderingContext2D,
      s: string,
      x: number,
      y: number,
      size: number,
      color: string,
      align: CanvasTextAlign = 'center',
    ) => {
      c.font = `${size}px ${font}`
      c.textAlign = align
      c.textBaseline = 'middle'
      c.fillStyle = color
      c.fillText(s, x, y)
    }

    const pushHud = () => {
      if (lastHud.score !== g.score || lastHud.level !== g.level || lastHud.lines !== g.lines) {
        lastHud = { score: g.score, level: g.level, lines: g.lines }
        setHud({ score: g.score, level: g.level, lines: g.lines })
      }
    }

    const boardX = (x: number) => BX + x * CELL
    const boardY = (y: number) => BY + (y - HIDDEN) * CELL

    /* ---------- lógica ---------- */
    const gameOver = () => {
      if (g.phase === 'over') return
      g.phase = 'over'
      g.cur = null
      g.overT = 0
      g.overShown = false
      g.paused = false
      sfx.gameOver()
      juice.shake(0.8)
      juice.flash('#ef4444', 0.4)
      const isNew = saveBest('bloques', g.score)
      setNewBest(isNew)
      setBest(Math.max(loadBest('bloques'), g.score))
      setStats({ lines: g.lines, level: g.level, combo: g.maxCombo })
      pushHud()
    }

    const resetLockState = () => {
      g.gravAcc = 0
      g.lockT = 0
      g.lockResets = 0
      g.lastRot = false
      g.lastKick = 0
    }

    const grounded = () => {
      const c = g.cur
      return !!c && !fits(g, c.t, c.rot, c.x, c.y + 1)
    }

    const spawn = (t: number) => {
      g.cur = { t, rot: 0, x: 3, y: 1 }
      resetLockState()
      if (!fits(g, t, 0, 3, 1)) {
        if (fits(g, t, 0, 3, 0)) g.cur.y = 0
        else {
          gameOver()
          return
        }
      }
      g.lowest = g.cur.y
      if (g.bufHold) {
        g.bufHold = false
        doHold()
      }
      if (g.bufRot && g.phase === 'play') {
        g.bufRot = false
        tryRotate(true)
      }
      g.bufRot = false
    }

    const afterMove = () => {
      if (grounded()) {
        if (g.lockResets < MAX_LOCK_RESETS) {
          g.lockT = 0
          g.lockResets++
        }
      } else {
        g.lockT = 0
      }
    }

    const tryMove = (dx: number, quiet = false): boolean => {
      const c = g.cur
      if (!c || g.phase !== 'play') return false
      if (!fits(g, c.t, c.rot, c.x + dx, c.y)) return false
      c.x += dx
      g.lastRot = false
      afterMove()
      if (!quiet) snd.move()
      return true
    }

    function tryRotate(silentFail = false): boolean {
      const c = g.cur
      if (!c || g.phase !== 'play' || c.t === T_O) return false
      const nr = (c.rot + 1) % 4
      const table = c.t === T_I ? KICK_I : KICK_JLSTZ
      const kicks = table[`${c.rot}${nr}`]
      for (let i = 0; i < kicks.length; i++) {
        const nx = c.x + kicks[i][0]
        const ny = c.y - kicks[i][1]
        if (fits(g, c.t, nr, nx, ny)) {
          c.rot = nr
          c.x = nx
          c.y = ny
          g.lastRot = true
          g.lastKick = i
          if (c.y > g.lowest) g.lowest = c.y
          afterMove()
          snd.rotate()
          return true
        }
      }
      void silentFail
      return false
    }

    function doHold() {
      const c = g.cur
      if (!c || g.phase !== 'play' || g.holdUsed) return
      const prev = g.hold
      g.hold = c.t
      g.holdUsed = true
      snd.hold()
      juice.burst(boardX(c.x + 1.5), boardY(c.y + 1), COLORS[c.t].base, { count: 8, speed: 80, life: 0.35, size: 3 })
      if (prev < 0) {
        spawn(nextType(g))
      } else {
        spawn(prev)
      }
    }

    const softStep = () => {
      const c = g.cur
      if (!c || g.phase !== 'play') return
      if (fits(g, c.t, c.rot, c.x, c.y + 1)) {
        c.y++
        g.score++
        g.lastRot = false
        g.gravAcc = 0
        if (c.y > g.lowest) {
          g.lowest = c.y
          g.lockResets = 0
          g.lockT = 0
        }
      }
    }

    const hardDrop = () => {
      const c = g.cur
      if (!c || g.phase !== 'play') return
      const startY = c.y
      let dist = 0
      while (fits(g, c.t, c.rot, c.x, c.y + 1)) {
        c.y++
        dist++
      }
      if (dist > 0) g.lastRot = false
      g.score += dist * 2
      // estela por columna
      const colTop = new Map<number, number>()
      for (const [cx, cy] of SHAPES[c.t][c.rot]) {
        const cur = colTop.get(cx)
        if (cur === undefined || cy < cur) colTop.set(cx, cy)
      }
      if (dist > 0) {
        for (const [cx, cy] of colTop) {
          g.trails.push({
            x: boardX(c.x + cx),
            y1: boardY(startY + cy),
            y2: boardY(c.y + cy),
            t: 0.22,
            color: COLORS[c.t].light,
          })
        }
      }
      snd.hard()
      juice.shake(0.12 + Math.min(0.1, dist * 0.006))
      lockPiece(true)
    }

    const lockPiece = (hard: boolean) => {
      const c = g.cur
      if (!c) return
      // T-spin (3 esquinas)
      let tspin = 0
      if (c.t === T_T && g.lastRot) {
        const corners: [number, number][] = [[0, 0], [2, 0], [0, 2], [2, 2]]
        const occ = corners.reduce((n, [cx, cy]) => n + (occupied(g, c.x + cx, c.y + cy) ? 1 : 0), 0)
        if (occ >= 3) {
          const front: [number, number][][] = [
            [[0, 0], [2, 0]],
            [[2, 0], [2, 2]],
            [[2, 2], [0, 2]],
            [[0, 2], [0, 0]],
          ]
          const fo = front[c.rot].reduce((n, [cx, cy]) => n + (occupied(g, c.x + cx, c.y + cy) ? 1 : 0), 0)
          tspin = fo === 2 || g.lastKick === 4 ? 2 : 1
        }
      }
      // colocar
      let allHidden = true
      g.landCells = []
      for (const [cx, cy] of SHAPES[c.t][c.rot]) {
        const x = c.x + cx
        const y = c.y + cy
        if (y >= 0 && y < ROWS) g.board[y * COLS + x] = c.t + 1
        if (y >= HIDDEN) allHidden = false
        g.landCells.push([x, y])
      }
      g.landT = 0.2
      g.kick = hard ? 5 : 2.5
      g.cur = null
      g.holdUsed = false
      g.trails = g.trails.slice(-12)
      // polvo
      const baseY = Math.max(...g.landCells.map((p) => p[1]))
      for (const [x, y] of g.landCells) {
        if (y === baseY) {
          juice.burst(boardX(x) + CELL / 2, boardY(y) + CELL, COLORS[c.t].light, {
            count: hard ? 3 : 1,
            speed: hard ? 70 : 40,
            life: 0.3,
            size: 2.5,
            gravity: 120,
            angle: -Math.PI / 2,
            arc: Math.PI,
          })
        }
      }
      computeTop(g)
      if (allHidden) {
        gameOver()
        return
      }
      const rows: number[] = []
      for (let y = 0; y < ROWS; y++) {
        let full = true
        for (let x = 0; x < COLS; x++) {
          if (!g.board[y * COLS + x]) {
            full = false
            break
          }
        }
        if (full) rows.push(y)
      }
      if (rows.length === 0) {
        g.combo = -1
        if (tspin) {
          const pts = (tspin === 2 ? 400 : 100) * g.level
          g.score += pts
          snd.tspin()
          juice.shake(0.25)
          juice.text(BX + BW / 2, boardY(c.y + 1), tspin === 2 ? 'T-SPIN' : 'T-SPIN MINI', '#f0abfc', 12, 1)
          juice.text(BX + BW / 2, boardY(c.y + 1) + 16, `+${pts}`, '#ffffff', 9, 0.9)
        } else if (!hard) {
          snd.land()
        }
        pushHud()
        spawn(nextType(g))
        return
      }
      startClear(rows, tspin, c)
    }

    const startClear = (rows: number[], tspin: number, c: Piece) => {
      const n = rows.length
      const lvl = g.level
      let base: number
      let label: string
      if (tspin === 2) {
        base = [400, 800, 1200, 1600][n]
        label = ['', 'T-SPIN SENCILLO', 'T-SPIN DOBLE', 'T-SPIN TRIPLE'][n]
      } else if (tspin === 1) {
        base = [100, 200, 400, 600][n]
        label = n === 1 ? 'T-SPIN MINI' : 'T-SPIN MINI DOBLE'
      } else {
        base = [0, 100, 300, 500, 800][n]
        label = ['', 'SENCILLO', 'DOBLE', 'TRIPLE', 'TETRA'][n]
      }
      let pts = base * lvl
      const difficult = n === 4 || tspin > 0
      const gotB2B = difficult && g.b2b
      if (gotB2B) pts = Math.floor(pts * 1.5)
      clearWasB2B = gotB2B
      g.b2b = difficult
      g.combo++
      if (g.combo > 0) pts += 50 * g.combo * lvl
      g.maxCombo = Math.max(g.maxCombo, g.combo + 1)
      g.score += pts
      g.lines += n
      const newLevel = Math.min(20, 1 + Math.floor(g.lines / 10))
      g.pendingLevel = newLevel

      g.phase = 'clear'
      g.clearRows = rows
      g.clearT = 0

      // juice
      const cx = BX + BW / 2
      const midY = Math.min(boardY(rows.reduce((a, b) => a + b, 0) / n) + CELL / 2, BY + BH - 56)
      const isTetra = n === 4
      const titleColor = tspin ? '#f0abfc' : isTetra ? '#fde047' : '#e9e5ff'
      juice.text(cx, midY, label, titleColor, isTetra ? 18 : label.length > 11 ? 10 : 13, 1.25)
      juice.text(cx, midY + 20, `+${pts}`, '#ffffff', 10, 1.0)
      let off = -22
      if (gotB2B) {
        juice.text(cx, midY + off, 'B2B', '#fb923c', 12, 1.25)
        off -= 18
      }
      if (g.combo >= 1) {
        juice.text(cx, midY + off, `COMBO x${g.combo + 1}`, '#67e8f9', 11, 1.25)
        snd.combo(g.combo)
      }
      for (const r of rows) {
        for (let x = 0; x < COLS; x++) {
          const t = g.board[r * COLS + x] - 1
          juice.burst(boardX(x) + CELL / 2, boardY(r) + CELL / 2, [COLORS[t]?.base ?? '#fff', COLORS[t]?.light ?? '#fff', '#ffffff'], {
            count: isTetra ? 3 : 2,
            speed: isTetra ? 230 : 150,
            life: 0.7,
            size: 3.5,
            gravity: 380,
            drag: 1.2,
          })
        }
      }
      juice.shake(isTetra ? 0.55 : tspin ? 0.35 : 0.1 + n * 0.06)
      if (isTetra) {
        juice.freeze(70)
        juice.flash('#fde047', 0.28)
      } else if (tspin) {
        juice.freeze(40)
        juice.flash('#f0abfc', 0.2)
      } else {
        juice.flash('#ffffff', 0.08 + n * 0.04)
      }
      if (tspin) snd.tspin()
      snd.clear(n)
      void c
      pushHud()
    }

    const finishClear = () => {
      const rows = g.clearRows
      const nb = new Uint8Array(COLS * ROWS)
      let wy = ROWS - 1
      for (let y = ROWS - 1; y >= 0; y--) {
        if (rows.includes(y)) continue
        nb.set(g.board.subarray(y * COLS, (y + 1) * COLS), wy * COLS)
        wy--
      }
      g.board = nb
      g.clearRows = []
      computeTop(g)
      g.phase = 'play'
      // todo limpio
      if (g.top === ROWS) {
        const pts = ([0, 800, 1200, 1800, 2000][Math.min(4, rows.length)] ?? 800) * g.level
        const bonus = rows.length === 4 && clearWasB2B ? 3200 * g.level : pts
        g.score += bonus
        juice.text(BX + BW / 2, BY + BH / 2 - 20, 'TODO LIMPIO', '#fde047', 14, 1.8)
        juice.text(BX + BW / 2, BY + BH / 2, `+${bonus}`, '#ffffff', 11, 1.6)
        juice.flash('#fde047', 0.4)
        juice.burst(BX + BW / 2, BY + BH / 2, ['#fde047', '#ffffff', ACCENT], {
          count: 50,
          speed: 260,
          life: 1,
          size: 4,
          gravity: 200,
        })
        sfx.golden()
      }
      if (g.pendingLevel > g.level) {
        g.level = g.pendingLevel
        g.banner = { text: `NIVEL ${g.level}`, t: 1.5 }
        sfx.levelUp()
        juice.flash(ACCENT, 0.2)
      }
      pushHud()
      spawn(nextType(g))
    }

    const startGame = () => {
      g = newG()
      g.phase = 'play'
      juice.reset()
      lastHud = { score: -1, level: -1, lines: -1 }
      spawn(nextType(g))
      pushHud()
      setPhase('playing')
      setNewBest(false)
      setStats({ lines: 0, level: 1, combo: 0 })
      sfx.start()
    }
    startRef.current = startGame

    apiRef.current = {
      shift: (d) => {
        if (!g.paused) tryMove(d)
      },
      rotate: () => {
        if (!g.paused) tryRotate()
      },
      hard: () => {
        if (!g.paused) hardDrop()
      },
      soft: () => {
        if (!g.paused) softStep()
      },
      hold: () => {
        if (!g.paused) doHold()
      },
    }

    const autoPause = () => {
      if ((g.phase === 'play' || g.phase === 'clear') && !g.paused) g.paused = true
    }
    const onVis = () => {
      if (document.hidden) autoPause()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', autoPause)

    /* ---------- horizontal DAS / ARR ---------- */
    const updateHorizontal = (dt: number) => {
      const p = pressedRef.current
      const jp = justPressedRef.current
      const L = p.has('left')
      const R = p.has('right')
      if (jp.has('left')) g.lastH = -1
      if (jp.has('right')) g.lastH = 1
      let dir = 0
      if (L && R) dir = g.lastH
      else if (L) dir = -1
      else if (R) dir = 1
      if (dir !== g.dasDir) {
        g.dasDir = dir
        g.arrT = 0
        if (dir !== 0) {
          const fresh = dir === -1 ? jp.has('left') : jp.has('right')
          if (fresh) {
            g.dasT = 0
            tryMove(dir)
          } else {
            g.dasT = DAS
          }
        } else {
          g.dasT = 0
        }
      } else if (dir !== 0) {
        g.dasT += dt
        if (g.dasT >= DAS) {
          g.arrT += dt
          let guard = 0
          while (g.arrT >= ARR && guard++ < 12) {
            g.arrT -= ARR
            if (!tryMove(dir, true)) {
              g.arrT = 0
              break
            }
          }
        }
      }
    }

    /* ---------- paso de simulación ---------- */
    const step = (dt: number) => {
      const jp = justPressedRef.current
      const queue = keyQueueRef.current

      if (g.phase === 'ready') {
        if (jp.has('action')) startGame()
        jp.clear()
        keyQueueRef.current = []
        return
      }

      if (g.phase === 'over') {
        g.overT += dt
        juice.update(dt)
        if (!g.overShown && g.overT > 0.9) {
          g.overShown = true
          setPhase('over')
        }
        if (g.overT > 0.7 && jp.has('action')) startGame()
        jp.clear()
        keyQueueRef.current = []
        return
      }

      // jugando o animando borrado
      if (jp.has('pause') || (g.paused && jp.has('action'))) {
        g.paused = !g.paused
        sfx.pause()
        jp.clear()
        keyQueueRef.current = []
        return
      }
      if (g.paused) {
        jp.clear()
        keyQueueRef.current = []
        return
      }

      const gdt = juice.update(dt)
      if (gdt === 0) return // hit-stop: conserva las entradas para después

      g.time += gdt
      g.kick *= Math.exp(-gdt * 16)
      if (g.landT > 0) g.landT -= gdt
      for (const tr of g.trails) tr.t -= gdt
      g.trails = g.trails.filter((tr) => tr.t > 0)
      if (g.banner) {
        g.banner.t -= gdt
        if (g.banner.t <= 0) g.banner = null
      }

      if (g.phase === 'clear') {
        for (const k of queue) {
          if (k === 'up') g.bufRot = true
          if (k === 'action2') g.bufHold = true
        }
        updateHorizontal(gdt)
        g.clearT += gdt
        if (g.clearT >= CLEAR_TIME) finishClear()
        jp.clear()
        keyQueueRef.current = []
        return
      }

      // entradas discretas en orden cronológico
      for (const k of queue) {
        if (g.phase !== 'play') break
        if (k === 'up') tryRotate()
        else if (k === 'action') hardDrop()
        else if (k === 'action2') doHold()
      }
      if (g.phase === 'play') {
        updateHorizontal(gdt)
        const c = g.cur
        if (c) {
          const gr = gravityOf(g.level)
          const soft = pressedRef.current.has('down')
          const interval = soft ? Math.min(gr, 0.035) : gr
          if (!grounded()) {
            g.gravAcc += gdt
            let n = 0
            while (g.gravAcc >= interval && n < 24) {
              g.gravAcc -= interval
              if (fits(g, c.t, c.rot, c.x, c.y + 1)) {
                c.y++
                if (soft) g.score++
                g.lastRot = false
                n++
              } else break
            }
            if (c.y > g.lowest) {
              g.lowest = c.y
              g.lockResets = 0
              g.lockT = 0
            }
          }
          if (grounded()) {
            g.gravAcc = 0
            g.lockT += gdt
            if (g.lockT >= LOCK_DELAY) {
              lockPiece(false)
            }
          }
        }
        pushHud()
      }
      jp.clear()
      keyQueueRef.current = []
    }

    /* ---------- dibujo ---------- */
    const drawMini = (t: number, cx: number, cy: number, s: number, a: number) => {
      const cells = SHAPES[t][0]
      let minX = 9
      let maxX = -1
      let minY = 9
      let maxY = -1
      for (const [x, y] of cells) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      const ox = cx - ((maxX - minX + 1) * s) / 2
      const oy = cy - ((maxY - minY + 1) * s) / 2
      for (const [x, y] of cells) drawCell(ctx, Math.round(ox + (x - minX) * s), Math.round(oy + (y - minY) * s), s, t, a)
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      juice.applyShake(ctx)
      ctx.drawImage(stat, 0, 0, W, H)

      // paneles laterales
      txt(ctx, 'GUARDAR', BX / 2, BY + 9, 6, 'rgba(221,214,254,0.75)')
      txt(ctx, 'PROX.', W - BX / 2, BY + 9, 6, 'rgba(221,214,254,0.75)')
      if (g.hold >= 0) drawMini(g.hold, BX / 2, BY + 40, 10, g.holdUsed ? 0.3 : 1)
      for (let i = 0; i < 5; i++) {
        const t = g.queue[i]
        if (t === undefined) continue
        drawMini(t, W - BX / 2, BY + 36 + i * 36, i === 0 ? 11 : 10, i === 0 ? 1 : 0.85)
      }
      // progreso de nivel
      txt(ctx, 'NIVEL', BX / 2, BY + 74 + 11, 6, 'rgba(221,214,254,0.75)')
      txt(ctx, String(g.level), BX / 2, BY + 74 + 29, 14, '#ffffff')
      const prog = (g.lines % 10) / 10
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(12, BY + 74 + 44, 36, 5)
      ctx.fillStyle = ACCENT
      ctx.fillRect(12, BY + 74 + 44, 36 * (g.level >= 20 ? 1 : prog), 5)
      // combo / b2b
      let chipY = BY + 74 + 66
      if (g.combo >= 1 && g.phase !== 'over') {
        rr(ctx, 6, chipY, 48, 28, 5)
        ctx.fillStyle = 'rgba(103,232,249,0.16)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(103,232,249,0.6)'
        ctx.lineWidth = 1
        ctx.stroke()
        txt(ctx, 'COMBO', BX / 2, chipY + 8, 6, '#67e8f9')
        txt(ctx, `x${g.combo + 1}`, BX / 2, chipY + 20, 10, '#ffffff')
        chipY += 34
      }
      if (g.b2b && g.phase !== 'over') {
        rr(ctx, 6, chipY, 48, 20, 5)
        ctx.fillStyle = 'rgba(251,146,60,0.16)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(251,146,60,0.6)'
        ctx.lineWidth = 1
        ctx.stroke()
        txt(ctx, 'B2B', BX / 2, chipY + 10, 9, '#fb923c')
      }

      // peligro
      if (g.phase !== 'ready' && g.top < HIDDEN + 6) {
        const k = 0.15 + 0.1 * Math.sin(g.time * 8 + performance.now() * 0.002)
        const gr = ctx.createLinearGradient(0, BY, 0, BY + 90)
        gr.addColorStop(0, `rgba(239,68,68,${k * 2})`)
        gr.addColorStop(1, 'rgba(239,68,68,0)')
        ctx.fillStyle = gr
        ctx.fillRect(BX, BY, BW, 90)
      }

      // tablero
      ctx.save()
      ctx.beginPath()
      ctx.rect(BX, BY, BW, BH)
      ctx.clip()
      ctx.translate(0, g.kick)
      const grayRows = g.phase === 'over' ? Math.floor(g.overT * 42) : -1
      for (let y = HIDDEN; y < ROWS; y++) {
        const clearing = g.phase === 'clear' && g.clearRows.includes(y)
        for (let x = 0; x < COLS; x++) {
          const v = g.board[y * COLS + x]
          if (!v) continue
          const px = boardX(x)
          const py = boardY(y)
          if (clearing) {
            const t = g.clearT
            if (t < 0.14) {
              drawCell(ctx, px, py, CELL, v - 1)
              ctx.fillStyle = `rgba(255,255,255,${Math.floor(t * 34) % 2 ? 0.9 : 0.45})`
              ctx.fillRect(px, py, CELL, CELL)
            } else {
              const p = Math.min(1, Math.max(0, (t - 0.14 - x * 0.016) / 0.2))
              if (p < 1) {
                const s = CELL * (1 - p)
                ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - p)})`
                ctx.fillRect(px + (CELL - s) / 2, py + (CELL - s) / 2, s, s)
              }
            }
          } else {
            const gray = grayRows >= 0 && y >= ROWS - 1 - grayRows
            drawCell(ctx, px, py, CELL, gray ? 7 : v - 1, gray ? 0.8 : 1)
          }
        }
      }
      // destello al aterrizar
      if (g.landT > 0 && g.phase !== 'over') {
        ctx.fillStyle = `rgba(255,255,255,${(g.landT / 0.2) * 0.65})`
        for (const [x, y] of g.landCells) {
          if (y >= HIDDEN) ctx.fillRect(boardX(x), boardY(y), CELL, CELL)
        }
      }
      // barrido luminoso en el borrado
      if (g.phase === 'clear' && g.clearT > 0.1) {
        const k = Math.min(1, (g.clearT - 0.1) / 0.3)
        const bx = BX + k * (BW + 80) - 40
        for (const r of g.clearRows) {
          const gr = ctx.createLinearGradient(bx - 40, 0, bx + 40, 0)
          gr.addColorStop(0, 'rgba(255,255,255,0)')
          gr.addColorStop(0.5, 'rgba(255,255,255,0.9)')
          gr.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = gr
          ctx.fillRect(bx - 40, boardY(r), 80, CELL)
        }
      }
      // estelas de caída dura
      for (const tr of g.trails) {
        ctx.globalAlpha = (tr.t / 0.22) * 0.4
        const gr = ctx.createLinearGradient(0, tr.y1, 0, tr.y2 + CELL)
        gr.addColorStop(0, 'rgba(255,255,255,0)')
        gr.addColorStop(1, tr.color)
        ctx.fillStyle = gr
        ctx.fillRect(tr.x + 2, tr.y1, CELL - 4, tr.y2 + CELL - tr.y1)
      }
      ctx.globalAlpha = 1

      // fantasma
      const c = g.cur
      if (c && g.phase === 'play') {
        let gy = c.y
        while (fits(g, c.t, c.rot, c.x, gy + 1)) gy++
        if (gy !== c.y) {
          const col = COLORS[c.t]
          for (const [cx, cy] of SHAPES[c.t][c.rot]) {
            const y = gy + cy
            if (y < HIDDEN) continue
            const px = boardX(c.x + cx)
            const py = boardY(y)
            ctx.fillStyle = col.base
            ctx.globalAlpha = 0.14
            ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
            ctx.globalAlpha = 0.75
            ctx.strokeStyle = col.base
            ctx.lineWidth = 2
            ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4)
            ctx.globalAlpha = 1
          }
        }
      }
      ctx.restore()

      // pieza activa (puede asomar en la zona de aparición)
      if (c && g.phase === 'play') {
        let sub = 0
        if (!grounded()) {
          const gr = gravityOf(g.level)
          const soft = pressedRef.current.has('down')
          const interval = soft ? Math.min(gr, 0.035) : gr
          sub = Math.min(1, g.gravAcc / interval) * CELL * 0.9
        }
        const glow = grounded() ? (g.lockT / LOCK_DELAY) * 0.45 : 0
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, BY + BH)
        ctx.clip()
        for (const [cx, cy] of SHAPES[c.t][c.rot]) {
          const y = c.y + cy
          if (y < 0) continue
          const px = boardX(c.x + cx)
          const py = boardY(y) + sub + g.kick * 0.5
          drawCell(ctx, px, py, CELL, c.t, y < HIDDEN ? 0.5 : 1)
          if (glow > 0 && y >= HIDDEN) {
            ctx.fillStyle = `rgba(255,255,255,${glow})`
            ctx.fillRect(px, py, CELL, CELL)
          }
        }
        ctx.restore()
      }

      // efectos
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, font)

      // cartela de nivel
      if (g.banner) {
        const k = g.banner.t / 1.5
        const a = k > 0.85 ? (1 - k) / 0.15 : k < 0.2 ? k / 0.2 : 1
        const slide = k > 0.85 ? (k - 0.85) / 0.15 : k < 0.2 ? -(0.2 - k) / 0.2 : 0
        const cy = BY + BH * 0.4
        ctx.globalAlpha = a
        ctx.fillStyle = 'rgba(10,8,26,0.85)'
        ctx.fillRect(BX, cy - 26, BW, 52)
        ctx.fillStyle = ACCENT
        ctx.fillRect(BX, cy - 26, BW, 2)
        ctx.fillRect(BX, cy + 24, BW, 2)
        txt(ctx, g.banner.text, BX + BW / 2 + slide * 120, cy - 2, 20, '#ffffff')
        txt(ctx, 'LA GRAVEDAD SUBE', BX + BW / 2 - slide * 120, cy + 16, 6, ACCENT)
        ctx.globalAlpha = 1
      }

      // pausa
      if (g.paused) {
        ctx.fillStyle = 'rgba(8,6,20,0.93)'
        ctx.fillRect(BX, BY, BW, BH)
        txt(ctx, 'PAUSA', BX + BW / 2, BY + BH / 2 - 14, 22, ACCENT)
        txt(ctx, 'P PARA SEGUIR', BX + BW / 2, BY + BH / 2 + 18, 8, '#e9e5ff')
        txt(ctx, 'O A / ESPACIO', BX + BW / 2, BY + BH / 2 + 34, 7, 'rgba(233,229,255,0.6)')
      }

      ctx.restore()
      juice.drawFlash(ctx, W, H)
    }

    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'ready' || g.phase === 'over') requestRemount()
      }
      step(dt)
      render()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', autoPause)
      apiRef.current = null
    }
  }, [pressedRef, justPressedRef, keyQueueRef])

  /* ---------- gestos táctiles sobre el canvas ---------- */
  const onPD = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    gest.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), ax: e.clientX, ay: e.clientY, moved: false }
  }
  const onPM = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = gest.current
    const api = apiRef.current
    if (s.id !== e.pointerId || !api) return
    const cell = (e.currentTarget.getBoundingClientRect().width / W) * CELL
    const stepX = cell * 0.9
    while (e.clientX - s.ax >= stepX) {
      api.shift(1)
      s.ax += stepX
      s.moved = true
    }
    while (s.ax - e.clientX >= stepX) {
      api.shift(-1)
      s.ax -= stepX
      s.moved = true
    }
    const vertical = Math.abs(e.clientY - s.y0) > Math.abs(e.clientX - s.x0) * 1.3
    if (vertical && e.clientY > s.y0) {
      while (e.clientY - s.ay >= cell) {
        api.soft()
        s.ay += cell
        s.moved = true
      }
    } else {
      s.ay = Math.max(s.ay, e.clientY)
    }
  }
  const onPU = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = gest.current
    const api = apiRef.current
    if (s.id !== e.pointerId) return
    s.id = -1
    if (!api) return
    const cell = (e.currentTarget.getBoundingClientRect().width / W) * CELL
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0
    const dur = performance.now() - s.t0
    if (dy > cell * 2.5 && dy / Math.max(1, dur) > 0.55 && Math.abs(dy) > Math.abs(dx) * 1.5) api.hard()
    else if (dy < -cell * 2.5 && -dy / Math.max(1, dur) > 0.45 && Math.abs(dy) > Math.abs(dx) * 1.5) api.hold()
    else if (!s.moved && Math.hypot(dx, dy) < cell * 0.6 && dur < 300) api.rotate()
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border border-violet-400/30 bg-[#090714] shadow-[0_0_40px_rgba(167,139,250,0.18)]"
        hud={
          <Hud>
            <span className="text-white/55">
              PTS <span style={{ color: ACCENT }}>{hud.score.toLocaleString('es-MX')}</span>
            </span>
            <span className="text-white/55">
              NIV <span className="text-white">{hud.level}</span>
            </span>
            <span className="text-white/55">
              LIN <span className="text-white">{hud.lines}</span>
            </span>
            <span className="hidden text-white/40 sm:inline">REC {best.toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          onPointerDown={onPD}
          onPointerMove={onPM}
          onPointerUp={onPU}
          onPointerCancel={() => {
            gest.current.id = -1
          }}
        />
        {phase === 'ready' && (
          <StartOverlay
            title="BLOQUES"
            accent={ACCENT}
            subtitle="Encaja las piezas, borra líneas y busca el tetra."
            onStart={() => startRef.current()}
          >
            <p className="max-w-[16rem] text-[11px] leading-relaxed text-white/55">
              {touch
                ? 'Toca para girar, desliza para mover y hacia abajo rápido para soltar. Guardar con el botón azul.'
                : 'Flechas para mover y girar, Espacio suelta la pieza, Shift la guarda. P pausa.'}
            </p>
          </StartOverlay>
        )}
        {phase === 'over' && (
          <GameOverOverlay
            accent={ACCENT}
            score={hud.score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Líneas', value: stats.lines },
              { label: 'Nivel', value: stats.level },
              { label: 'Máx. combo', value: stats.combo > 1 ? `x${stats.combo}` : '-' },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Soltar"
        showAction2
        action2Label="Guardar"
        action2Glyph="H"
      />
    </div>
  )
}
