'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { Hud, useIsTouch } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas, rr } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'dulce-match'
const STORE_KEY = 'arcade-dulce-match'
const ACCENT = '#f472b6'
const PLUM = '#7c2d5e'
const LEVELS = 30

const W0 = 360
const H0 = 580
const N = 8
const TOP = 78 // franja de metas arriba del tablero
const BOT = 12

// Mundo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0
let CS = 40 // lado de cada dulce, en px lógicos
let BX0 = 0 // esquina superior izquierda del tablero
let BY0 = 0

/** Ajusta el mundo a la pantalla y centra el tablero en la franja libre. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  CS = Math.floor(Math.min((W - 28) / N, (H - TOP - BOT) / N))
  BX0 = Math.round((W - CS * N) / 2)
  BY0 = TOP + Math.round((H - TOP - BOT - CS * N) / 2)
  publishLogical(f)
}

/** Dulces pastel: color base y brillo. Cada color tiene además su propia forma (ver dibujarForma). */
const CANDY = [
  { body: '#ff4d6d', hi: '#ffc2cf' }, // fresa
  { body: '#ffb020', hi: '#ffe7a3' }, // caramelo envuelto
  { body: '#f9a8d4', hi: '#ffe4f3' }, // dona con glaseado rosa
  { body: '#7ee0b8', hi: '#d6fbe9' }, // macaron de menta
  { body: '#7fb8ff', hi: '#d4e8ff' }, // cupcake
  { body: '#ffe04a', hi: '#fff9c4' }, // gomita estrella
]
const COLOR_NAMES = ['FRESA', 'CARAMELO', 'DONA', 'MACARON', 'CUPCAKE', 'ESTRELLA']
const BURST = CANDY.map((c) => c.body)

const INITIAL_UI: Ui = { view: 'map', level: 1, score: 0, moves: 0, mult: 1, over: null }
const DIRS: Record<'up' | 'down' | 'left' | 'right', [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}
const pixel = { fontFamily: 'var(--font-pixel)' }

// ---------- tipos ----------
// sp: 0 normal · 1 rayita horizontal · 2 rayita vertical · 3 bomba · 4 arcoíris
interface Cell {
  id: number
  col: number // 0..5; -1 = arcoíris
  sp: number
  jel: boolean // lleva gelatina
  r: number // posición lógica
  c: number
  vx: number // posición visual (en casillas)
  vy: number
  vs: number // escala visual
  vst: number // escala objetivo
}
type Grid = (Cell | null)[]
interface Run {
  cells: number[]
  h: boolean
}
interface Goal {
  kind: 'score' | 'color' | 'jelly'
  target: number
  color: number
}
interface LevelCfg {
  n: number
  colors: number
  moves: number
  goals: Goal[]
  jellies: number
}
interface Pop {
  x: number
  y: number
  col: number // -2 = gelatina rota
  sp: number
  t: number
  life: number
}
type Phase =
  | 'off'
  | 'ready'
  | 'idle'
  | 'swap'
  | 'revert'
  | 'resolve'
  | 'settle'
  | 'check'
  | 'shuffle'
  | 'bonus'
  | 'win'
  | 'lose'
  | 'offer'
  | 'done'
interface Game {
  cfg: LevelCfg
  n: number
  phase: Phase
  next: 'resolve' | 'check'
  paused: boolean
  t: number
  timer: number
  grid: Grid
  moves: number
  leftMoves: number
  score: number
  got: number[] // progreso de metas de color y gelatina
  wave: number // cascadas dentro de un mismo movimiento
  mult: number
  pair: [number, number] | null
  pendingPlayer: boolean
  sel: number
  cur: number
  keyMode: boolean
  idleT: number
  hint: [number, number] | null
  stars: number
  didShuffle: boolean
  pops: Pop[]
  bonusUsed: boolean // +5 movimientos gratis (una vez por nivel)
}
type Progress = Partial<Record<number, { s: number; p: number }>>
interface Result {
  win: boolean
  n: number
  stars: number
  points: number
  left: number
  total: number
  prevBest: number
  newBest: boolean
  hasNext: boolean
  /** true: se ofrece +5 movimientos gratis una vez por nivel antes de perder */
  offer?: boolean
}
interface Ui {
  view: 'map' | 'play'
  level: number
  score: number
  moves: number
  mult: number
  over: Result | null
}

// ---------- utilidades ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rand = (n: number) => Math.floor(Math.random() * n)
const roundTo = (x: number, m: number) => Math.round(x / m) * m
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const rowOf = (i: number) => Math.floor(i / N)
const colOf = (i: number) => i % N
const inBoard = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N
const adjacent = (a: number, b: number) =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1
function neighbors(i: number): number[] {
  const r = rowOf(i)
  const c = colOf(i)
  const out: number[] = []
  if (r > 0) out.push(i - N)
  if (r < N - 1) out.push(i + N)
  if (c > 0) out.push(i - 1)
  if (c < N - 1) out.push(i + 1)
  return out
}
function shuffleArr<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- niveles ----------
/** Parámetros de cada nivel: crecen con el número (colores, metas, gelatinas). */
function levelCfg(n: number): LevelCfg {
  const colors = clamp(4 + Math.floor((n - 1) / 10), 4, 6)
  const moves = Math.max(16, 24 - Math.floor((n - 1) / 4))
  const kind = n % 3 // 1: puntos · 2: juntar un color · 0: romper gelatinas
  const goals: Goal[] = []
  let jellies = 0
  if (kind === 1) goals.push({ kind: 'score', target: roundTo(500 + 90 * n, 50), color: 0 })
  if (kind === 2) goals.push({ kind: 'color', target: 6 + Math.floor(n * 0.35), color: (n * 5) % colors })
  if (kind === 0) {
    const target = 2 + Math.floor(n / 6)
    goals.push({ kind: 'jelly', target, color: 0 })
    jellies = target + 2
  }
  if (n >= 12 && kind !== 1) goals.push({ kind: 'score', target: roundTo(300 + 60 * n, 50), color: 0 })
  return { n, colors, moves, goals, jellies }
}

// ---------- celdas y tablero ----------
let uid = 1
function newCell(col: number, jel = false): Cell {
  return { id: uid++, col, sp: 0, jel, r: 0, c: 0, vx: 0, vy: 0, vs: 1, vst: 1 }
}
/** Pone una celda en la casilla i y actualiza su posición lógica. */
function put(G: Grid, i: number, cell: Cell | null) {
  G[i] = cell
  if (cell) {
    cell.r = rowOf(i)
    cell.c = colOf(i)
  }
}
function swapRaw(G: Grid, a: number, b: number) {
  const A = G[a]
  const B = G[b]
  put(G, a, B)
  put(G, b, A)
}

/** Tramos de 3 o más dulces del mismo color, en filas y columnas. */
function findRuns(G: Grid): Run[] {
  const runs: Run[] = []
  for (let r = 0; r < N; r++) {
    let c = 0
    while (c < N) {
      const a = G[r * N + c]
      if (!a || a.col < 0) {
        c++
        continue
      }
      let e = c + 1
      while (e < N && G[r * N + e]?.col === a.col) e++
      if (e - c >= 3) runs.push({ cells: Array.from({ length: e - c }, (_, k) => r * N + c + k), h: true })
      c = e
    }
  }
  for (let c = 0; c < N; c++) {
    let r = 0
    while (r < N) {
      const a = G[r * N + c]
      if (!a || a.col < 0) {
        r++
        continue
      }
      let e = r + 1
      while (e < N && G[e * N + c]?.col === a.col) e++
      if (e - r >= 3) runs.push({ cells: Array.from({ length: e - r }, (_, k) => (r + k) * N + c), h: false })
      r = e
    }
  }
  return runs
}

/** ¿Sirve el intercambio ya aplicado a (a, b)? Los especiales siempre sirven. */
function swapValid(G: Grid, a: number, b: number): boolean {
  const A = G[a]
  const B = G[b]
  if (!A || !B) return false
  if (A.sp || B.sp) return true
  return findRuns(G).some((run) => run.cells.includes(a) || run.cells.includes(b))
}

/** Busca un intercambio válido (para la pista y para detectar tableros sin jugadas). */
function findMove(G: Grid): [number, number] | null {
  for (let i = 0; i < N * N; i++) {
    for (const j of [colOf(i) < N - 1 ? i + 1 : -1, rowOf(i) < N - 1 ? i + N : -1]) {
      if (j < 0) continue
      swapRaw(G, i, j)
      const ok = swapValid(G, i, j)
      swapRaw(G, i, j)
      if (ok) return [i, j]
    }
  }
  return null
}

function presentColor(G: Grid): number {
  const cols = G.flatMap((c) => (c && c.col >= 0 ? [c.col] : []))
  return cols.length ? cols[rand(cols.length)] : 0
}

/** Tablero inicial: sin tramos hechos y con al menos una jugada. */
function newBoard(cfg: LevelCfg): Grid {
  let G: Grid = []
  for (let attempt = 0; attempt < 300; attempt++) {
    G = new Array<Cell | null>(N * N).fill(null)
    for (let i = 0; i < N * N; i++) {
      const r = rowOf(i)
      const c = colOf(i)
      let col = rand(cfg.colors)
      while (
        (c >= 2 && G[i - 1]?.col === col && G[i - 2]?.col === col) ||
        (r >= 2 && G[i - N]?.col === col && G[i - 2 * N]?.col === col)
      ) {
        col = rand(cfg.colors)
      }
      const cell = newCell(col)
      put(G, i, cell)
      cell.vx = c
      cell.vy = r
    }
    if (findMove(G)) break
  }
  const free = shuffleArr(Array.from({ length: N * N }, (_, i) => i))
  for (let k = 0; k < cfg.jellies; k++) {
    const cell = G[free[k]]
    if (cell) cell.jel = true
  }
  return G
}

/** Gravedad y relleno: las celdas caen; las nuevas entran desde arriba del tablero. */
function gravity(G: Grid, colors: number) {
  for (let c = 0; c < N; c++) {
    const list: Cell[] = []
    for (let r = N - 1; r >= 0; r--) {
      const cell = G[r * N + c]
      if (cell) list.push(cell)
    }
    const m = N - list.length
    for (let k = 0; k < N; k++) {
      const r = N - 1 - k
      if (k < list.length) {
        put(G, r * N + c, list[k])
      } else {
        const cell = newCell(rand(colors))
        put(G, r * N + c, cell)
        cell.vx = c
        cell.vy = r - m
      }
    }
  }
}

/** Mueve la vista de cada celda hacia su posición lógica. */
function easeCells(G: Grid, dt: number) {
  const k = 1 - Math.exp(-dt * 18)
  for (const cell of G) {
    if (!cell) continue
    cell.vx += (cell.c - cell.vx) * k
    cell.vy += (cell.r - cell.vy) * k
    cell.vs += (cell.vst - cell.vs) * k
  }
}

function settled(G: Grid): boolean {
  for (const cell of G) {
    if (!cell) continue
    if (Math.abs(cell.vx - cell.c) > 0.02 || Math.abs(cell.vy - cell.r) > 0.02 || Math.abs(cell.vs - cell.vst) > 0.02) {
      return false
    }
  }
  return true
}

// ---------- cascadas ----------
interface Wave {
  clear: Set<number>
  spawn: Map<number, number> // casilla -> especial que nace ahí
  specials: number // especiales que actuaron
}

/**
 * Calcula qué se borra en una oleada: combinaciones de especiales intercambiados,
 * tramos de 3+ (4 = rayita, forma de L/T = bomba, 5 = arcoíris) y la cadena de
 * especiales activados. Las casillas donde nace un especial no se borran.
 */
function computeWave(G: Grid, pair: [number, number] | null): Wave {
  const clear = new Set<number>()
  const spawn = new Map<number, number>()
  const seen = new Set<number>()
  const rowAll = (r: number) => {
    for (let c = 0; c < N; c++) clear.add(r * N + c)
  }
  const colAll = (c: number) => {
    for (let r = 0; r < N; r++) clear.add(r * N + c)
  }
  const area = (i: number, rad: number) => {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = rowOf(i) + dr
        const c = colOf(i) + dc
        if (inBoard(r, c)) clear.add(r * N + c)
      }
    }
  }

  if (pair) {
    const [a, b] = pair
    const A = G[a]
    const B = G[b]
    if (A && B && (A.sp || B.sp)) {
      clear.add(a)
      clear.add(b)
      if (A.sp === 4 && B.sp === 4) {
        for (let i = 0; i < N * N; i++) clear.add(i)
      } else if (A.sp === 4 || B.sp === 4) {
        // arcoíris + otro: se borran todos los de ese color (y se convierten si el otro es especial)
        const rb = A.sp === 4 ? a : b
        const other = G[rb === a ? b : a]
        if (other) {
          seen.add(rb)
          for (let i = 0; i < N * N; i++) {
            const cell = G[i]
            if (!cell || cell.col !== other.col) continue
            if (other.sp && cell.sp === 0) cell.sp = other.sp === 3 ? 3 : 1 + rand(2)
            clear.add(i)
          }
        }
      } else if (A.sp === 3 && B.sp === 3) {
        area(b, 2)
      } else if (A.sp !== 3 && B.sp !== 3) {
        // dos rayitas: cruz en ambas casillas
        rowAll(rowOf(a))
        colAll(colOf(a))
        rowAll(rowOf(b))
        colAll(colOf(b))
      } else {
        // rayita + bomba: tres filas y tres columnas
        for (let d = -1; d <= 1; d++) {
          if (inBoard(rowOf(b) + d, 0)) rowAll(rowOf(b) + d)
          if (inBoard(0, colOf(b) + d)) colAll(colOf(b) + d)
        }
      }
    }
  }

  // tramos: intersección horizontal + vertical = bomba; 5 = arcoíris; 4 = rayita
  const runs = findRuns(G)
  for (const hr of runs) {
    if (!hr.h) continue
    for (const vr of runs) {
      if (vr.h) continue
      const x = hr.cells.find((i) => vr.cells.includes(i))
      if (x !== undefined) spawn.set(x, 3)
    }
  }
  for (const run of runs) {
    const len = run.cells.length
    if (len >= 4) {
      let pos = run.cells[Math.floor(len / 2)]
      if (pair) {
        const moved = run.cells.find((i) => i === pair[0] || i === pair[1])
        if (moved !== undefined) pos = moved
      }
      if (!spawn.has(pos)) spawn.set(pos, len >= 5 ? 4 : run.h ? 1 : 2)
    }
    for (const i of run.cells) clear.add(i)
  }

  // activación en cadena de los especiales que se van a borrar
  let specials = 0
  for (;;) {
    let next = -1
    for (const i of clear) {
      if (!seen.has(i) && G[i]?.sp) {
        next = i
        break
      }
    }
    if (next < 0) break
    seen.add(next)
    specials++
    const sp = G[next]?.sp ?? 0
    if (sp === 1) rowAll(rowOf(next))
    else if (sp === 2) colAll(colOf(next))
    else if (sp === 3) area(next, 1)
    else if (sp === 4) {
      const target = presentColor(G)
      for (let i = 0; i < N * N; i++) if (G[i]?.col === target) clear.add(i)
    }
  }

  for (const i of spawn.keys()) clear.delete(i)
  return { clear, spawn, specials }
}


// ---------- sonidos ----------
const sSwap = () => tone({ freq: 620, to: 880, dur: 0.08, type: 'triangle', vol: 0.05 })
const sNope = () => tone({ freq: 220, to: 150, dur: 0.14, type: 'triangle', vol: 0.05 })
const sSel = () => tone({ freq: 740, dur: 0.05, type: 'sine', vol: 0.04 })
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, type: 'triangle', vol: 0.04 })
const sPop = (k: number) => tone({ freq: 660 + Math.min(k, 10) * 60, dur: 0.1, type: 'sine', vol: 0.07 })
const sSpecial = () => {
  tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.06 })
  tone({ freq: 1320, dur: 0.16, type: 'triangle', vol: 0.06, delay: 0.07 })
  noise({ dur: 0.18, vol: 0.05, freq: 3000 })
}
const sBonus = (k: number) => tone({ freq: 880 + (k % 6) * 90, dur: 0.07, type: 'square', vol: 0.03 })
const sShuffle = () => noise({ dur: 0.4, vol: 0.06, freq: 2400 })
const sReady = () =>
  [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.08 }))
const sWin = () =>
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.04, delay: i * 0.1 }))
const sLose = () =>
  [440, 392, 330].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.05, delay: i * 0.18 }))

// ---------- dibujo de dulces ----------
function star4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.quadraticCurveTo(x, y, x - r, y)
  ctx.quadraticCurveTo(x, y, x, y - r)
  ctx.closePath()
  ctx.fill()
}

/** Carita feliz: ojos con brillo, mejillas y sonrisa. */
function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) {
  const ex = rad * 0.36
  const ey = rad * 0.04
  const er = rad * 0.1
  ctx.fillStyle = '#3d1d3f'
  ctx.beginPath()
  ctx.arc(x - ex, y + ey, er, 0, Math.PI * 2)
  ctx.arc(x + ex, y + ey, er, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x - ex + er * 0.35, y + ey - er * 0.4, er * 0.35, 0, Math.PI * 2)
  ctx.arc(x + ex + er * 0.35, y + ey - er * 0.4, er * 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,110,160,0.6)'
  ctx.beginPath()
  ctx.ellipse(x - rad * 0.56, y + rad * 0.26, rad * 0.17, rad * 0.1, 0, 0, Math.PI * 2)
  ctx.ellipse(x + rad * 0.56, y + rad * 0.26, rad * 0.17, rad * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3d1d3f'
  ctx.lineWidth = Math.max(1, rad * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y + rad * 0.16, rad * 0.2, Math.PI * 0.2, Math.PI * 0.8)
  ctx.stroke()
}

/** Forma base de cada color: fresa, caramelo envuelto, dona, macaron, cupcake y gomita estrella. */
function dibujarForma(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: number) {
  const base = CANDY[col]
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05)
  grad.addColorStop(0, base.hi)
  grad.addColorStop(0.55, base.body)
  grad.addColorStop(1, base.body)
  ctx.fillStyle = grad
  ctx.strokeStyle = base.body
  if (col === 0) {
    // fresa: cuerpo de corazón con semillitas y corona verde
    ctx.beginPath()
    ctx.moveTo(x, y + r)
    ctx.quadraticCurveTo(x - r * 1.12, y + r * 0.2, x - r * 0.9, y - r * 0.35)
    ctx.quadraticCurveTo(x - r * 0.5, y - r * 0.85, x, y - r * 0.5)
    ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.85, x + r * 0.9, y - r * 0.35)
    ctx.quadraticCurveTo(x + r * 1.12, y + r * 0.2, x, y + r)
    ctx.fill()
    ctx.fillStyle = '#fff3c4'
    for (const [dx, dy] of [
      [-0.62, 0.05],
      [0.62, 0.02],
      [-0.4, 0.62],
      [0.4, 0.62],
      [0, 0.85],
    ]) {
      ctx.beginPath()
      ctx.ellipse(x + dx * r, y + dy * r, r * 0.07, r * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#3fcf86'
    for (const [dx, rot] of [
      [-0.45, -0.6],
      [0.45, 0.6],
      [0, 0],
    ]) {
      ctx.beginPath()
      ctx.ellipse(x + dx * r, y - r * 0.55, r * 0.34, r * 0.13, rot, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (col === 1) {
    // caramelo envuelto: bola con las puntas torcidas del papel
    ctx.fillStyle = '#ffb020'
    ctx.beginPath()
    ctx.moveTo(x - r * 0.45, y - r * 0.12)
    ctx.lineTo(x - r * 1.05, y - r * 0.5)
    ctx.lineTo(x - r * 0.95, y + r * 0.5)
    ctx.lineTo(x - r * 0.45, y + r * 0.12)
    ctx.moveTo(x + r * 0.45, y - r * 0.12)
    ctx.lineTo(x + r * 1.05, y - r * 0.5)
    ctx.lineTo(x + r * 0.95, y + r * 0.5)
    ctx.lineTo(x + r * 0.45, y + r * 0.12)
    ctx.fill()
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r * 0.76, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = r * 0.14
    ctx.beginPath()
    ctx.arc(x, y, r * 0.5, Math.PI * 1.1, Math.PI * 1.45)
    ctx.stroke()
  } else if (col === 2) {
    // dona: anillo de masa con glaseado rosa y chispitas
    ctx.fillStyle = '#f0b86a'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r * 0.84, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff4fa'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2)
    ctx.fill()
    const sprinkles = ['#60a5fa', '#fde047', '#86efac', '#ffffff', '#c4b5fd']
    sprinkles.forEach((c, k) => {
      const a = 0.3 + k * 1.2
      ctx.strokeStyle = c
      ctx.lineWidth = Math.max(1.2, r * 0.12)
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5)
      ctx.lineTo(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66)
      ctx.stroke()
    })
  } else if (col === 3) {
    // macaron: dos discos con relleno cremoso en medio
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.4, r * 0.88, r * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x, y + r * 0.4, r * 0.88, r * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff7fb'
    rr(ctx, x - r * 0.84, y - r * 0.2, r * 1.68, r * 0.4, r * 0.18)
    ctx.fill()
  } else if (col === 4) {
    // cupcake: envoltura plisada, betún en espiral y cerecita
    ctx.fillStyle = base.body
    ctx.beginPath()
    ctx.moveTo(x - r * 0.62, y + r * 0.02)
    ctx.lineTo(x + r * 0.62, y + r * 0.02)
    ctx.lineTo(x + r * 0.46, y + r * 0.92)
    ctx.lineTo(x - r * 0.46, y + r * 0.92)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = Math.max(1, r * 0.08)
    ctx.beginPath()
    for (const dx of [-0.3, 0, 0.3]) {
      ctx.moveTo(x + dx * r, y + r * 0.1)
      ctx.lineTo(x + dx * r * 0.8, y + r * 0.88)
    }
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.02, r * 0.86, r * 0.56, 0, Math.PI, 0)
    ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.1, x, y + r * 0.04)
    ctx.quadraticCurveTo(x - r * 0.5, y - r * 0.1, x - r * 0.86, y - r * 0.02)
    ctx.fill()
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(x + r * 0.12, y - r * 0.66, r * 0.22, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // gomita estrella con puntas redondeadas
    ctx.fillStyle = grad
    ctx.strokeStyle = base.body
    ctx.lineJoin = 'round'
    ctx.lineWidth = r * 0.3
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? r * 1.02 : r * 0.5
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      const px = x + Math.cos(a) * rad
      const py = y + Math.sin(a) * rad
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/** Dibuja un dulce (normal, rayita, bomba o arcoíris) centrado en x, y. */
function drawCandy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  col: number,
  sp: number,
  id: number,
  t: number,
) {
  if (rad <= 0.5) return
  const alpha = ctx.globalAlpha
  const k = Math.max(0, col)
  const base = CANDY[k]
  ctx.save()
  if (sp) {
    // halo de brillo: los especiales se distinguen de un vistazo
    ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(t * 5 + id))
    ctx.fillStyle = sp === 4 ? '#ffffff' : sp === 3 ? '#fde047' : base.hi
    ctx.beginPath()
    ctx.arc(x, y, rad * 1.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = alpha
  }
  if (sp === 4) {
    // arcoíris: gajos de todos los colores que giran
    CANDY.forEach((c, j) => {
      ctx.fillStyle = c.body
      ctx.beginPath()
      ctx.moveTo(x, y)
      const a0 = t * 1.2 + (j * Math.PI * 2) / CANDY.length
      ctx.arc(x, y, rad, a0, a0 + (Math.PI * 2) / CANDY.length)
      ctx.closePath()
      ctx.fill()
    })
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, rad * 0.26, 0, Math.PI * 2)
    ctx.fill()
  } else if (sp === 3) {
    // bomba: bola ciruela oscura con aro dorado y mecha con chispa
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad)
    g.addColorStop(0, '#b65c93')
    g.addColorStop(1, '#4a1f3d')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = Math.max(1.5, rad * 0.14)
    ctx.beginPath()
    ctx.arc(x, y, rad * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#fde9b0'
    ctx.lineWidth = Math.max(1, rad * 0.08)
    ctx.beginPath()
    ctx.moveTo(x + rad * 0.55, y - rad * 0.75)
    ctx.quadraticCurveTo(x + rad * 0.9, y - rad * 1.2, x + rad * 1.05, y - rad * 1.0)
    ctx.stroke()
    ctx.fillStyle = '#fff7ad'
    ctx.beginPath()
    ctx.arc(x + rad * 1.05, y - rad * 1.0, rad * (0.14 + 0.05 * Math.sin(t * 20)), 0, Math.PI * 2)
    ctx.fill()
  } else {
    dibujarForma(ctx, x, y, rad, k)
  }
  if (sp === 1 || sp === 2) {
    // rayita: franja blanca horizontal o vertical que cruza el dulce
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    if (sp === 1) rr(ctx, x - rad * 1.02, y - rad * 0.16, rad * 2.04, rad * 0.32, rad * 0.16)
    else rr(ctx, x - rad * 0.16, y - rad * 1.02, rad * 0.32, rad * 2.04, rad * 0.16)
    ctx.fill()
  }
  // brillo general
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(x - rad * 0.42, y - rad * 0.5, rad * 0.18, rad * 0.11, -0.6, 0, Math.PI * 2)
  ctx.fill()
  drawFace(ctx, x, y, rad * 0.86)
  ctx.restore()
}

// ---------- progreso y puntuación ----------
function loadProgress(): Progress {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    const data: unknown = raw ? JSON.parse(raw) : {}
    return data && typeof data === 'object' ? (data as Progress) : {}
  } catch {
    return {}
  }
}
function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch {
    // sin acceso a localStorage: el progreso solo dura esta sesión
  }
}
/** Puntuación total: suma de la mejor puntuación de cada nivel. */
const totalOf = (p: Progress) => Object.values(p).reduce((a, v) => a + (v?.p ?? 0), 0)

function makeGame(n: number): Game {
  const cfg = levelCfg(n)
  return {
    cfg,
    n,
    phase: 'off',
    next: 'check',
    paused: false,
    t: 0,
    timer: 0,
    grid: newBoard(cfg),
    moves: cfg.moves,
    leftMoves: cfg.moves,
    score: 0,
    got: cfg.goals.map(() => 0),
    wave: 0,
    mult: 1,
    pair: null,
    pendingPlayer: false,
    sel: -1,
    cur: 27,
    keyMode: false,
    idleT: 0,
    hint: null,
    stars: 1,
    didShuffle: false,
    pops: [],
    bonusUsed: false,
  }
}

const goalsDone = (g: Game) => g.cfg.goals.every((goal, k) => (goal.kind === 'score' ? g.score : g.got[k]) >= goal.target)

/** Reordena las celdas al azar hasta que no haya tramos y sí haya jugada. */
function shuffleBoard(g: Game) {
  const cells = g.grid.filter((c): c is Cell => c !== null)
  for (let tries = 0; tries < 200; tries++) {
    shuffleArr(cells)
    const G: Grid = new Array<Cell | null>(N * N).fill(null)
    cells.forEach((cell, i) => put(G, i, cell))
    if (findRuns(G).length === 0 && findMove(G)) {
      for (const cell of G) if (cell) cell.vst = 1
      g.grid = G
      return
    }
  }
  g.grid = newBoard(g.cfg)
}

// ---------- componente ----------
/** Posición de cada nivel en un camino en zigzag (en % y en unidades del SVG de 100 x filas*20). */
function camino(n: number): { x: number; y: number } {
  const i = n - 1
  const fila = Math.floor(i / 5)
  const col = i % 5
  const c = fila % 2 ? 4 - col : col
  return { x: 10 + c * 20, y: fila * 20 + 10 }
}

export default function DulceMatch() {
  const { justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(n: number) => void>(() => {})
  const mapRef = useRef<() => void>(() => {})
  const extraRef = useRef<{ aceptar: () => void; rendirse: () => void }>({ aceptar: () => {}, rendirse: () => {} })
  const [ui, setUi] = useState<Ui>(INITIAL_UI)
  const [progress, setProgress] = useState<Progress>({})
  const touch = useIsTouch()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(10)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let prog: Progress = {}
    let g = makeGame(1)
    g.phase = 'off'
    const pointers = new Map<number, { i: number; x: number; y: number; moved: boolean }>()
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()

    // ---------- sincronía con React ----------
    const sync = () => setUi((u) => ({ ...u, level: g.n, score: g.score, moves: g.moves, mult: g.mult }))
    const canPause = () => g.phase !== 'off' && g.phase !== 'done'
    const togglePause = () => {
      if (!canPause()) return
      g.paused = !g.paused
      sPause()
    }

    const nextLevel = () => {
      for (let n = 1; n <= LEVELS; n++) if (!prog[n]?.s) return n
      return 1
    }

    const startLevel = (n: number) => {
      pointers.clear()
      g = makeGame(n)
      g.phase = 'ready'
      g.timer = 1.3
      sReady()
      setUi({ view: 'play', level: n, score: 0, moves: g.moves, mult: 1, over: null })
    }

    const toMap = () => {
      pointers.clear()
      g.phase = 'off'
      g.paused = false
      setUi((u) => ({ ...u, view: 'map', over: null }))
    }

    // ---------- intercambios ----------
    const trySwap = (a: number, b: number) => {
      g.sel = -1
      g.hint = null
      g.idleT = 0
      g.cur = b
      swapRaw(g.grid, a, b)
      g.pair = [a, b]
      g.phase = 'swap'
      g.timer = 0
      sSwap()
    }

    /** Tras la animación: si el cambio sirve se resuelve; si no, regresa las piezas. */
    const finishSwap = () => {
      const pair = g.pair
      if (pair && swapValid(g.grid, pair[0], pair[1])) {
        g.pendingPlayer = true
        g.wave = 0
        g.phase = 'resolve'
      } else {
        if (pair) swapRaw(g.grid, pair[0], pair[1])
        g.pair = null
        sNope()
        juice.shake(0.12)
        g.phase = 'revert'
        g.timer = 0
      }
    }

    /** Una oleada: borra, suma puntos y metas, y deja caer las piezas. */
    const doResolve = () => {
      const pair = g.pendingPlayer ? g.pair : null
      if (g.pendingPlayer) {
        g.moves--
        g.pendingPlayer = false
        g.pair = null
      }
      const w = computeWave(g.grid, pair)
      if (w.clear.size === 0) {
        g.phase = 'check'
        return
      }
      const mult = Math.min(5, 1 + g.wave * 0.5)
      g.mult = mult
      const cells = [...w.clear]

      // gelatinas rotas por vecinos que se borran
      const broken: number[] = []
      for (const i of cells) {
        for (const j of neighbors(i)) {
          const cell = g.grid[j]
          if (!w.clear.has(j) && cell?.jel) {
            cell.jel = false
            broken.push(j)
          }
        }
      }

      let pts = 0
      let sx = 0
      let sy = 0
      let jellyHits = broken.length
      cells.forEach((i, k) => {
        const cell = g.grid[i]
        if (!cell) return
        pts += 30 * mult
        sx += colOf(i)
        sy += rowOf(i)
        if (cell.jel) jellyHits++
        g.cfg.goals.forEach((goal, gi) => {
          if (goal.kind === 'color' && cell.col >= 0 && goal.color === cell.col) g.got[gi]++
        })
        g.pops.push({ x: cell.vx, y: cell.vy, col: cell.col, sp: cell.sp, t: 0, life: 0.34 })
        if (k < 14) {
          juice.burst(BX0 + (cell.vx + 0.5) * CS, BY0 + (cell.vy + 0.5) * CS, BURST, {
            count: 6,
            speed: 150,
            life: 0.45,
            size: 4,
            gravity: 260,
          })
        }
        g.grid[i] = null
      })
      for (const j of broken) {
        const cell = g.grid[j]
        if (cell) g.pops.push({ x: cell.vx, y: cell.vy, col: -2, sp: 0, t: 0, life: 0.4 })
      }
      if (jellyHits) {
        g.cfg.goals.forEach((goal, gi) => {
          if (goal.kind === 'jelly') g.got[gi] += jellyHits
        })
      }
      pts += 30 * w.specials
      g.score += pts

      // nacen especiales en las casillas reservadas
      for (const [i, sp] of w.spawn) {
        const cell = g.grid[i]
        if (!cell) continue
        cell.sp = sp
        if (sp === 4) cell.col = -1
        const name = sp === 4 ? 'ARCOIRIS' : sp === 3 ? 'BOMBA' : 'RAYITA'
        juice.text(BX0 + (colOf(i) + 0.5) * CS, BY0 + (rowOf(i) + 0.5) * CS, name, '#c026d3', 10, 0.9)
      }

      gravity(g.grid, g.cfg.colors)
      if (w.specials) {
        sSpecial()
        juice.shake(0.35)
        juice.freeze(60)
      }
      sPop(g.wave)
      const n = cells.length
      const cx = BX0 + (sx / n + 0.5) * CS
      const cy = BY0 + (sy / n + 0.5) * CS
      if (g.wave >= 1 || n >= 6) juice.text(cx, cy, 'DULCE!', '#ff3d8b', 15, 0.9)
      if (g.wave >= 2 || n >= 9 || w.specials >= 2) juice.text(cx, cy + CS * 0.5, 'DELICIOSO!', '#9333ea', 11, 1.1)
      juice.shake(Math.min(0.4, 0.1 + g.wave * 0.06))
      g.wave++
      g.phase = 'settle'
      g.timer = 0
      g.next = 'resolve'
      sync()
    }

    /** Al quedar quieto el tablero: meta cumplida, sin movimientos, sin jugadas o seguir. */
    const doCheck = () => {
      g.wave = 0
      g.mult = 1
      if (goalsDone(g)) {
        const m = g.cfg.moves
        g.leftMoves = g.moves
        g.stars = 1 + (g.moves >= Math.ceil(m * 0.2) ? 1 : 0) + (g.moves >= Math.ceil(m * 0.45) ? 1 : 0)
        g.phase = 'bonus'
        g.timer = 0.6
        sync()
        return
      }
      if (g.moves <= 0) {
        g.phase = 'lose'
        g.timer = 1.1
        sLose()
        sync()
        return
      }
      if (!findMove(g.grid)) {
        g.phase = 'shuffle'
        g.timer = 0
        g.didShuffle = false
        sync()
        return
      }
      g.phase = 'idle'
      g.idleT = 0
      g.hint = null
      sync()
    }

    /** Antes de perder se ofrece +5 movimientos gratis (solo una vez por nivel). */
    const offerMoves = () => {
      g.phase = 'offer'
      setUi((u) => ({
        ...u,
        over: {
          win: false,
          n: g.n,
          stars: 0,
          points: g.score,
          left: 0,
          total: totalOf(prog),
          prevBest: loadBest(GAME_ID),
          newBest: false,
          hasNext: false,
          offer: true,
        },
      }))
    }
    const aceptarMovimientos = () => {
      if (g.phase !== 'offer' || g.bonusUsed) return
      g.bonusUsed = true
      g.moves += 5
      g.phase = 'check'
      g.timer = 0
      sSel()
      setUi((u) => ({ ...u, over: null, moves: g.moves }))
      sync()
    }

    /** Cierra el nivel: guarda progreso y muestra el resultado. */
    const finish = (win: boolean) => {
      g.phase = 'done'
      if (win) {
        const old = prog[g.n]
        prog = { ...prog, [g.n]: { s: Math.max(old?.s ?? 0, g.stars), p: Math.max(old?.p ?? 0, g.score) } }
        saveProgress(prog)
        setProgress(prog)
      }
      const total = totalOf(prog)
      const prevBest = loadBest(GAME_ID)
      const newBest = saveBest(GAME_ID, total)
      const res: Result = {
        win,
        n: g.n,
        stars: win ? g.stars : 0,
        points: g.score,
        left: win ? g.leftMoves : 0,
        total,
        prevBest,
        newBest,
        hasNext: g.n < LEVELS,
      }
      setUi((u) => ({ ...u, over: res }))
    }

    // ---------- actualización ----------
    const update = (dt: number) => {
      g.t += dt
      easeCells(g.grid, dt)
      g.pops = g.pops.filter((p) => {
        p.t += dt
        return p.t < p.life
      })
      switch (g.phase) {
        case 'ready':
          g.timer -= dt
          if (g.timer <= 0) {
            g.phase = 'idle'
            g.idleT = 0
          }
          break
        case 'idle':
          g.idleT += dt
          if (!g.hint && g.idleT > 5) g.hint = findMove(g.grid)
          break
        case 'swap':
          g.timer += dt
          if (g.timer > 0.12 && settled(g.grid)) finishSwap()
          break
        case 'revert':
          g.timer += dt
          if (g.timer > 0.12 && settled(g.grid)) {
            g.phase = 'idle'
            g.idleT = 0
          }
          break
        case 'settle':
          g.timer += dt
          if (g.timer > 0.12 && settled(g.grid)) {
            g.phase = g.next
            g.timer = 0
          }
          break
        case 'resolve':
          doResolve()
          break
        case 'check':
          doCheck()
          break
        case 'shuffle':
          g.timer += dt
          if (g.timer < 0.35) {
            for (const cell of g.grid) if (cell) cell.vst = 0
          } else if (!g.didShuffle) {
            shuffleBoard(g)
            g.didShuffle = true
            sShuffle()
          } else if (g.timer > 0.7 && settled(g.grid)) {
            g.didShuffle = false
            g.phase = 'check'
          }
          break
        case 'bonus':
          // los movimientos sobrantes se convierten en puntos
          g.timer -= dt
          if (g.timer <= 0) {
            if (g.moves > 0) {
              g.moves--
              g.score += 50
              sBonus(g.moves)
              juice.text(W / 2, BY0 + (CS * N) / 2, '+50', '#16a34a', 14, 0.6)
              g.timer = 0.14
              sync()
            } else {
              g.phase = 'win'
              g.timer = 1.0
              sWin()
            }
          }
          break
        case 'win':
          g.timer -= dt
          if (g.timer <= 0) finish(true)
          break
        case 'lose':
          g.timer -= dt
          if (g.timer <= 0) {
            if (g.bonusUsed) finish(false)
            else offerMoves()
          }
          break
      }
    }

    // ---------- entrada ----------
    const toPx = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    }
    const cellAt = (x: number, y: number) => {
      const c = Math.floor((x - BX0) / CS)
      const r = Math.floor((y - BY0) / CS)
      return inBoard(r, c) ? r * N + c : -1
    }
    const tapCell = (i: number) => {
      if (g.phase !== 'idle') return
      g.cur = i
      if (g.sel < 0) {
        g.sel = i
        sSel()
      } else if (g.sel === i) {
        g.sel = -1
      } else if (adjacent(g.sel, i)) {
        trySwap(g.sel, i)
      } else {
        g.sel = i
        sSel()
      }
    }
    const moveKey = (dir: 'up' | 'down' | 'left' | 'right') => {
      const [dr, dc] = DIRS[dir]
      g.keyMode = true
      g.hint = null
      g.idleT = 0
      if (g.sel >= 0) {
        // con una pieza tomada, la flecha la empuja a la casilla vecina
        const nr = rowOf(g.sel) + dr
        const nc = colOf(g.sel) + dc
        if (!inBoard(nr, nc)) sNope()
        else trySwap(g.sel, nr * N + nc)
        return
      }
      const nr = rowOf(g.cur) + dr
      const nc = colOf(g.cur) + dc
      if (inBoard(nr, nc)) g.cur = nr * N + nc
    }
    const actionKey = () => {
      g.keyMode = true
      g.hint = null
      g.idleT = 0
      if (g.sel < 0) {
        g.sel = g.cur
        sSel()
      } else if (g.sel === g.cur) {
        g.sel = -1
      } else if (adjacent(g.sel, g.cur)) {
        trySwap(g.sel, g.cur)
      } else {
        g.sel = g.cur
        sSel()
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase !== 'idle') return
      const p = toPx(e)
      const i = cellAt(p.x, p.y)
      if (i < 0) return
      g.keyMode = false
      g.hint = null
      g.idleT = 0
      pointers.set(e.pointerId, { i, x: p.x, y: p.y, moved: false })
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      const t = pointers.get(e.pointerId)
      if (!t || t.moved || g.phase !== 'idle') return
      const p = toPx(e)
      const dx = p.x - t.x
      const dy = p.y - t.y
      if (Math.hypot(dx, dy) < CS * 0.3) return
      t.moved = true
      // deslizar hacia un lado: intercambia con esa vecina
      const horiz = Math.abs(dx) > Math.abs(dy)
      const nr = rowOf(t.i) + (horiz ? 0 : dy > 0 ? 1 : -1)
      const nc = colOf(t.i) + (horiz ? (dx > 0 ? 1 : -1) : 0)
      if (inBoard(nr, nc)) trySwap(t.i, nr * N + nc)
    }
    const onPointerUp = (e: PointerEvent) => {
      const t = pointers.get(e.pointerId)
      pointers.delete(e.pointerId)
      if (!t || t.moved) return
      tapCell(t.i)
    }
    const onPointerCancel = (e: PointerEvent) => pointers.delete(e.pointerId)

    const handleKeys = () => {
      const jp = justPressedRef.current
      if (jp.has('pause')) togglePause()
      if (g.paused) {
        if (jp.has('action')) g.paused = false
      } else if (g.phase === 'off') {
        if (jp.has('action')) startLevel(nextLevel())
      } else if (g.phase === 'idle') {
        if (jp.has('action')) actionKey()
        else
          for (const d of ['up', 'down', 'left', 'right'] as const) {
            if (jp.has(d)) {
              moveKey(d)
              break
            }
          }
      }
      jp.clear()
    }

    const onBlur = () => {
      if (canPause()) g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }

    /** Reacomoda el tablero si la pantalla cambia durante una partida, y pausa. */
    const relayoutLive = () => {
      layout()
      setupCanvas(canvas, W, H)
      // al entrar al nivel el marco se vuelve a medir (cambia la franja del marcador): no es una rotación
      if (canPause() && g.phase !== 'ready') g.paused = true
    }

    // ---------- dibujo ----------
    const star = (x: number, y: number, r: number) => star4(ctx, x, y, r)

    const banner = (text: string, y: number, size: number, color: string) => {
      ctx.font = `${size}px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(4, size * 0.4)
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeText(text, W / 2, y)
      ctx.fillStyle = color
      ctx.fillText(text, W / 2, y)
    }

    const drawSparkles = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (let k = 0; k < 22; k++) {
        const x = hash(k) * W
        const y = (hash(k + 50) * H + g.t * (8 + hash(k + 90) * 14)) % H
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(g.t * 2 + k)
        ctx.beginPath()
        ctx.arc(x, y, 1.5 + hash(k + 7) * 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    /** Dulces flotando detrás del mapa. */
    const drawBackdrop = () => {
      for (let k = 0; k < 16; k++) {
        const x = hash(k + 1) * W
        const y = ((hash(k + 31) * H + g.t * (10 + hash(k + 5) * 12)) % (H + 80)) - 40
        drawCandy(ctx, x, y, 14 + hash(k + 11) * 10, k % CANDY.length, 0, k, g.t)
      }
    }

    /** Metas del nivel arriba del tablero. */
    const drawGoals = () => {
      const goals = g.cfg.goals
      const colW = W / goals.length
      goals.forEach((goal, k) => {
        const cx = colW * (k + 0.5) - colW * 0.36
        const have = goal.kind === 'score' ? g.score : g.got[k]
        const y = 28
        if (goal.kind === 'color') drawCandy(ctx, cx, y, 11, goal.color, 0, 0, g.t)
        else if (goal.kind === 'jelly') {
          ctx.fillStyle = 'rgba(125,211,252,0.85)'
          rr(ctx, cx - 9, y - 9, 18, 18, 5)
          ctx.fill()
        } else {
          ctx.fillStyle = '#facc15'
          star(cx, y, 10)
        }
        const label = goal.kind === 'score' ? 'PUNTOS' : goal.kind === 'color' ? COLOR_NAMES[goal.color] : 'GELATINA'
        ctx.font = `9px ${pf}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = have >= goal.target ? '#15803d' : PLUM
        ctx.fillText(`${label} ${Math.min(have, goal.target)}/${goal.target}`, cx + 14, y)
      })
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const drawJelly = (cell: Cell) => {
      const x = BX0 + cell.vx * CS + CS * 0.06
      const y = BY0 + cell.vy * CS + CS * 0.06
      ctx.fillStyle = 'rgba(125,211,252,0.55)'
      rr(ctx, x, y, CS * 0.88, CS * 0.88, CS * 0.25)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    const drawCell = (cell: Cell) => {
      const x = BX0 + (cell.vx + 0.5) * CS
      const y = BY0 + (cell.vy + 0.5) * CS
      const pulse = cell.sp ? 1 + Math.sin(g.t * 6 + cell.id) * 0.05 : 1
      drawCandy(ctx, x, y, CS * 0.43 * cell.vs * pulse, cell.col, cell.sp, cell.id, g.t)
    }

    const drawBoard = () => {
      const size = CS * N
      // bandeja de galleta: borde rosa con sombra
      ctx.fillStyle = 'rgba(190,80,140,0.25)'
      rr(ctx, BX0 - 5, BY0 - 3, size + 14, size + 14, CS * 0.34)
      ctx.fill()
      ctx.fillStyle = '#fff6fb'
      rr(ctx, BX0 - 7, BY0 - 7, size + 14, size + 14, CS * 0.34)
      ctx.fill()
      ctx.strokeStyle = '#f9a8d4'
      ctx.lineWidth = 3
      ctx.stroke()
      // casillas tipo galleta: un bisel suave debajo de cada una
      for (let i = 0; i < N * N; i++) {
        const r = rowOf(i)
        const c = colOf(i)
        const x = BX0 + c * CS + 2
        const y = BY0 + r * CS + 2
        ctx.fillStyle = (r + c) % 2 ? '#f6cde5' : '#f0bfdc'
        rr(ctx, x, y + 3, CS - 4, CS - 4, CS * 0.24)
        ctx.fill()
        ctx.fillStyle = (r + c) % 2 ? '#fff9fd' : '#fdf1f8'
        rr(ctx, x, y, CS - 4, CS - 4, CS * 0.24)
        ctx.fill()
      }
      // los dulces que caen entran desde detrás del marco
      ctx.save()
      ctx.beginPath()
      ctx.rect(BX0 - 7, BY0 - 7, size + 14, size + 14)
      ctx.clip()
      for (const cell of g.grid) if (cell?.jel) drawJelly(cell)
      for (const cell of g.grid) if (cell) drawCell(cell)
      ctx.restore()
    }

    const drawPops = () => {
      for (const p of g.pops) {
        const k = p.t / p.life
        const x = BX0 + (p.x + 0.5) * CS
        const y = BY0 + (p.y + 0.5) * CS
        ctx.save()
        ctx.globalAlpha = 1 - k
        if (p.col === -2) {
          const s = CS * (0.8 + k * 0.5)
          ctx.fillStyle = 'rgba(125,211,252,0.85)'
          rr(ctx, x - s / 2, y - s / 2, s, s, CS * 0.25)
          ctx.fill()
        } else {
          ctx.strokeStyle = p.col >= 0 ? CANDY[p.col].body : '#ffffff'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(x, y, CS * (0.4 + k * 0.7), 0, Math.PI * 2)
          ctx.stroke()
          drawCandy(ctx, x, y, CS * 0.43 * (1 + k * 0.4), p.col, p.sp, 0, g.t)
        }
        ctx.restore()
      }
    }

    /** Selección, pista y cursor de teclado. */
    const drawMarks = () => {
      const mark = (i: number, color: string, pulse: number) => {
        const cell = g.grid[i]
        if (!cell) return
        const x = BX0 + (cell.vx + 0.5) * CS
        const y = BY0 + (cell.vy + 0.5) * CS
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, CS * (0.47 + pulse * 0.04), 0, Math.PI * 2)
        ctx.stroke()
      }
      if (g.sel >= 0) mark(g.sel, '#ffffff', Math.sin(g.t * 10))
      if (g.hint && g.phase === 'idle') {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.t * 5)
        mark(g.hint[0], '#fde047', 0.5)
        mark(g.hint[1], '#fde047', 0.5)
        ctx.globalAlpha = 1
      }
      if (g.keyMode && g.phase === 'idle') {
        ctx.strokeStyle = '#db2777'
        ctx.lineWidth = 2.5
        ctx.setLineDash([5, 4])
        rr(ctx, BX0 + colOf(g.cur) * CS + 3, BY0 + rowOf(g.cur) * CS + 3, CS - 6, CS - 6, CS * 0.2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    const drawBanners = () => {
      const mid = BY0 + (CS * N) / 2
      if (g.phase === 'ready') {
        banner(`NIVEL ${g.n}`, mid - 10, 20, '#db2777')
        banner(`MOVIMIENTOS ${g.moves}`, mid + 22, 9, PLUM)
      }
      if (g.phase === 'shuffle' && g.timer > 0.2) banner('MEZCLANDO', mid, 14, '#7c3aed')
      if (g.phase === 'bonus' || g.phase === 'win') banner('NIVEL LISTO', mid, 16, '#16a34a')
      if (g.phase === 'lose') banner('SIN MOVIMIENTOS', mid, 13, '#be123c')
      if (g.mult > 1 && g.phase === 'settle') {
        ctx.font = `10px ${pf}`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#db2777'
        ctx.fillText(`COMBO X${g.mult}`, W - 16, TOP - 14)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const drawPause = () => {
      ctx.fillStyle = 'rgba(255,240,250,0.9)'
      ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#db2777'
      ctx.font = `24px ${pf}`
      ctx.fillText('PAUSA', W / 2, H / 2 - 12)
      ctx.fillStyle = PLUM
      ctx.font = `9px ${pf}`
      ctx.fillText('P O TOCA PARA SEGUIR', W / 2, H / 2 + 22)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#ffd6e9')
      bg.addColorStop(0.5, '#e9d3ff')
      bg.addColorStop(1, '#ffe2cf')
      ctx.fillStyle = bg
      ctx.fillRect(-20, -20, W + 40, H + 40)
      // patrón de puntitos sutiles
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.beginPath()
      for (let py = 8; py < H + 20; py += 26) {
        for (let px = ((py / 26) % 2) * 13 + 6; px < W + 20; px += 26) {
          ctx.moveTo(px + 2.4, py)
          ctx.arc(px, py, 2.4, 0, Math.PI * 2)
        }
      }
      ctx.fill()
      drawSparkles()
      if (g.phase === 'off') drawBackdrop()
      else {
        drawGoals()
        drawBoard()
        drawPops()
        drawMarks()
        drawBanners()
      }
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      if (g.paused) drawPause()
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'off' || g.phase === 'done') requestRemount()
        else relayoutLive()
      }
      handleKeys()
      const dtGame = juice.update(dt)
      if (!g.paused) update(dtGame)
      draw()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    startRef.current = startLevel
    mapRef.current = toMap
    extraRef.current = { aceptar: aceptarMovimientos, rendirse: () => finish(false) }

    raf = requestAnimationFrame((t) => {
      prog = loadProgress()
      setProgress(prog)
      last = t
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef])

  const playing = ui.view === 'play'
  const over = ui.over
  const starsTotal = Object.values(progress).reduce((a, v) => a + (v?.s ?? 0), 0)
  const levels = Array.from({ length: LEVELS }, (_, k) => k + 1)

  const hud = (
    <Hud>
      {playing ? (
        <>
          <span style={{ color: ACCENT }}>PUNTOS {ui.score}</span>
          <span style={{ color: PLUM }}>NIVEL {ui.level}</span>
          <span style={{ color: PLUM }}>MOVS {ui.moves}</span>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur()
              mapRef.current()
            }}
            className="rounded-full border border-[#7c2d5e]/30 bg-white/70 px-2 py-0.5 transition active:scale-95"
            style={{ color: PLUM }}
          >
            MAPA
          </button>
        </>
      ) : (
        <span style={{ color: ACCENT }}>MAPA DE NIVELES · ★ {starsTotal}</span>
      )}
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W0}
        height={H0}
        className="rounded-xl border-2 border-pink-300/70 bg-[#fdeaf6] shadow-[0_0_30px_rgba(244,114,182,0.3)]"
        hud={hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Tablero de Dulce Match"
          style={{ touchAction: 'none' }}
        />
        {!playing && (
          <div className="absolute inset-0 z-10 overflow-y-auto overscroll-contain bg-[#fdeaf6]/90">
            <div className="flex min-h-full flex-col items-center gap-3 px-4 py-4 text-center text-[#5b2350]">
              <p className="text-base sm:text-xl" style={{ ...pixel, color: '#db2777', textShadow: '2px 2px 0 #ffffff' }}>
                DULCE MATCH
              </p>
              <p className="text-xs text-[#7c2d5e]">Elige un nivel para comenzar</p>
              <div className="relative w-full max-w-md" style={{ height: `max(${(LEVELS / 5) * 84}px, 74dvh)` }}>
                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 100 ${(LEVELS / 5) * 20}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <polyline
                    points={levels.map((n) => `${camino(n).x},${camino(n).y}`).join(' ')}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="7"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 14 }}
                  />
                  <polyline
                    points={levels.map((n) => `${camino(n).x},${camino(n).y}`).join(' ')}
                    fill="none"
                    stroke="#f9a8d4"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeDasharray="1 7"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 7 }}
                  />
                </svg>
                {levels.map((n) => {
                  const s = progress[n]?.s ?? 0
                  const open = n === 1 || (progress[n - 1]?.s ?? 0) > 0
                  const p = camino(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!open}
                      onClick={(e) => {
                        e.currentTarget.blur()
                        startRef.current(n)
                      }}
                      aria-label={open ? `Nivel ${n}` : `Nivel ${n}, bloqueado`}
                      className="absolute flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] border-white text-sm font-bold shadow-[0_4px_0_rgba(190,80,140,0.35)] transition active:translate-y-0.5 active:scale-95 disabled:shadow-none"
                      style={{
                        left: `${p.x}%`,
                        top: `${(p.y / ((LEVELS / 5) * 20)) * 100}%`,
                        background: s
                          ? 'radial-gradient(circle at 35% 30%,#fffbe0,#ffd166 70%)'
                          : open
                            ? 'radial-gradient(circle at 35% 30%,#ffffff,#ffc2dd 70%)'
                            : '#e6dcef',
                        color: PLUM,
                      }}
                    >
                      {open ? (
                        <>
                          <span className="text-sm leading-none">{n}</span>
                          <span className="mt-0.5 text-[9px] leading-none text-amber-500">
                            {'★'.repeat(s) + '☆'.repeat(3 - s)}
                          </span>
                        </>
                      ) : (
                        <Lock className="size-4 text-[#a78bb0]" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-[#7c2d5e]/80">
                {touch ? 'Toca un nivel para jugar' : 'Elige un nivel con el ratón o pulsa ESPACIO'}
              </p>
            </div>
          </div>
        )}
        {playing && over && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 overflow-y-auto bg-[#fdeaf6]/90 px-5 py-4 text-center text-[#5b2350]">
            <div className="flex w-full max-w-xs flex-col items-center gap-2.5 rounded-[2rem] border-2 border-white bg-white/85 px-5 py-5 shadow-[0_10px_30px_rgba(190,80,140,0.25)]">
            <p className="text-sm sm:text-base" style={{ ...pixel, color: '#db2777', textShadow: '2px 2px 0 #ffffff' }}>
              {over.win ? `NIVEL ${over.n} LISTO` : 'SIN MOVIMIENTOS'}
            </p>
            {over.newBest && (
              <p className="text-[10px] text-amber-500" style={pixel}>
                ¡NUEVO RECORD!
              </p>
            )}
            {!over.offer && (
              <p className="text-2xl leading-none text-amber-400 drop-shadow-sm" aria-label={`${over.stars} de 3 estrellas`}>
                {'★'.repeat(over.stars) + '☆'.repeat(3 - over.stars)}
              </p>
            )}
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#7c2d5e]/70">Puntos del nivel</p>
            <p className="text-3xl font-semibold tabular-nums" style={{ color: '#db2777' }}>
              {over.points.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-[#7c2d5e]/80 tabular-nums">
              Total de Dulce Match {over.total.toLocaleString('es-MX')}
              {over.win && ` · movimientos sobrantes ${over.left}`}
            </p>
            {over.offer ? (
              <div className="mt-1 flex w-full max-w-xs flex-col items-center gap-2">
                <p className="text-xs text-[#7c2d5e]/80">Te quedaste sin movimientos. Puedes seguir una vez más.</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    extraRef.current.aceptar()
                  }}
                  className="rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95"
                >
                  +5 movimientos gratis
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    extraRef.current.rendirse()
                  }}
                  className="rounded-full px-4 py-1.5 text-xs underline underline-offset-4 transition active:scale-95"
                  style={{ color: PLUM }}
                >
                  Rendirse
                </button>
              </div>
            ) : (
            <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
              {over.win && over.hasNext && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    startRef.current(over.n + 1)
                  }}
                  className="rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95"
                >
                  Siguiente nivel
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  startRef.current(over.n)
                }}
                className={
                  over.win && over.hasNext
                    ? 'rounded-full border border-[#7c2d5e]/30 bg-white/80 px-6 py-2 text-xs transition active:scale-95'
                    : 'rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95'
                }
                style={over.win && over.hasNext ? { color: PLUM } : undefined}
              >
                {over.win ? 'Repetir nivel' : 'Reintentar'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  mapRef.current()
                }}
                className="rounded-full px-4 py-1.5 text-xs underline underline-offset-4 transition active:scale-95"
                style={{ color: PLUM }}
              >
                Mapa de niveles
              </button>
            </div>
            )}
            </div>
          </div>
        )}
      </GameScreen>
    </div>
  )
}
