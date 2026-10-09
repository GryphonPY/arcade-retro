'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys } from './use-keys'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { GameScreen } from './game-screen'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas, rr } from './game-utils'
import { noise, sfx, tone } from './sfx'

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const GAME_ID = 'cruza-camino'
const ACCENT = '#38f0a0'
const W = 360
const H = 560
const TILE = 40
const COLS = 9
const HOP_T = 0.115
const PIXEL_FONT = '"Press Start 2P", var(--font-pixel), monospace'
const VEH_COLORS = ['#ff5a5f', '#4cc3ff', '#ffd23f', '#b074ff', '#ff9a3c', '#eef0f6', '#4ee08a']
const ROAD_MARGIN = 110
const RIVER_MARGIN = 150

type Kind = 'grass' | 'road' | 'river' | 'rail'
type Dir4 = 'up' | 'down' | 'left' | 'right'
type Cause = 'car' | 'train' | 'water' | 'eagle' | 'drift'
type VKind = 'car' | 'sport' | 'van' | 'truck' | 'bus' | 'bike'

interface Vehicle {
  x: number
  w: number
  kind: VKind
  color: string
  dark: string
  light: string
  nm: boolean
  honk: boolean
}
interface Platform {
  x: number
  w: number
  turtle: boolean
  phase: number
}
interface Flower {
  c: number
  ox: number
  oy: number
  k: number
}
interface Row {
  r: number
  kind: Kind
  shade: number
  obst: number[]
  coin: number
  coinTaken: boolean
  flowers: Flower[]
  dir: number
  speed: number
  vehicles: Vehicle[]
  plats: Platform[]
  pads: boolean[] | null
  lily: boolean
  rs: number
  rt: number
  trainX: number
  trainLen: number
  warnDur: number
  bell: number
}
interface Gen {
  next: number
  last: Kind | null
  reach: boolean[]
}
interface Ring {
  x: number
  y: number
  t: number
}
interface Result {
  score: number
  rows: number
  coins: number
  chain: number
  cause: Cause
  newBest: boolean
  best: number
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]
const diffAt = (r: number) => clamp(r / 120, 0, 1)
const colOf = (x: number) => clamp(Math.round((x - TILE / 2) / TILE), 0, COLS - 1)
const colX = (c: number) => c * TILE + TILE / 2

function hash(a: number, b: number) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255)
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `rgb(${r},${g},${b})`
}

function newRow(r: number, kind: Kind): Row {
  return {
    r,
    kind,
    shade: r & 1,
    obst: new Array(COLS).fill(0),
    coin: -1,
    coinTaken: false,
    flowers: [],
    dir: 1,
    speed: 0,
    vehicles: [],
    plats: [],
    pads: null,
    lily: false,
    rs: 0,
    rt: 0,
    trainX: 0,
    trainLen: 0,
    warnDur: 1.2,
    bell: 0,
  }
}

function computeReach(prev: boolean[], free: boolean[]): boolean[] {
  const out: boolean[] = new Array(COLS).fill(false)
  for (let c = 0; c < COLS; c++) out[c] = prev[c] && free[c]
  for (let c = 1; c < COLS; c++) if (out[c - 1] && free[c]) out[c] = true
  for (let c = COLS - 2; c >= 0; c--) if (out[c + 1] && free[c]) out[c] = true
  return out
}
const anyTrue = (a: boolean[]) => a.some(Boolean)

/** Cuerpos de vehículos: ancho y probabilidad según perfil de carril. */
function makeVehicle(kind: VKind, x: number): Vehicle {
  const w = { car: 34, sport: 36, van: 42, truck: 96, bus: 104, bike: 22 }[kind]
  const color = kind === 'truck' || kind === 'bus' ? pick(['#ff9a3c', '#4cc3ff', '#ffd23f', '#4ee08a', '#ff5a5f']) : pick(VEH_COLORS)
  return { x, w, kind, color, dark: shade(color, -0.35), light: shade(color, 0.35), nm: false, honk: false }
}

/* ------------------------------------------------------------------ */
/* Generación procedural                                               */
/* ------------------------------------------------------------------ */

function makeGrassRow(g: Gen, r: number, free: boolean): Row {
  const d = diffAt(r)
  const row = newRow(r, 'grass')
  const prev = g.reach
  if (!free) {
    const dens = r <= 2 ? 0 : lerp(0.14, 0.3, d)
    for (let c = 0; c < COLS; c++) {
      const edge = c <= 1 || c >= COLS - 2
      const p = r <= 2 ? (edge ? 0.5 : 0) : edge ? dens + 0.12 : dens
      if (r <= 0 && c >= 3 && c <= 5) continue
      if (Math.random() < p) {
        const q = Math.random()
        row.obst[c] = q < 0.4 ? 1 : q < 0.65 ? 2 : q < 0.88 ? 3 : 4
      }
    }
  }
  const freeCells = () => row.obst.map((o) => o === 0)
  let reach = computeReach(prev, freeCells())
  let guard = 0
  while (!anyTrue(reach) && guard++ < 20) {
    const cand: number[] = []
    for (let c = 0; c < COLS; c++) if (prev[c] && row.obst[c] > 0) cand.push(c)
    if (cand.length === 0) break
    row.obst[pick(cand)] = 0
    reach = computeReach(prev, freeCells())
  }
  g.reach = reach
  // monedas y flores
  if (r > 0 && Math.random() < 0.3) {
    const cand: number[] = []
    for (let c = 0; c < COLS; c++) if (reach[c] && row.obst[c] === 0) cand.push(c)
    if (cand.length) row.coin = pick(cand)
  }
  const nf = (Math.random() * 4) | 0
  for (let i = 0; i < nf; i++) {
    const c = (Math.random() * COLS) | 0
    if (row.obst[c] === 0 && c !== row.coin) {
      row.flowers.push({ c, ox: rand(6, 30), oy: rand(8, 32), k: (Math.random() * 3) | 0 })
    }
  }
  return row
}

function fillVehicles(row: Row, d: number, profile: 'cars' | 'heavy' | 'mixed') {
  const loop = W + ROAD_MARGIN * 2
  const minGap = lerp(104, 70, d)
  const maxGap = lerp(190, 120, d)
  let x = -ROAD_MARGIN + rand(0, 100)
  for (let i = 0; i < 12; i++) {
    let kind: VKind
    const q = Math.random()
    if (profile === 'heavy') kind = q < 0.55 ? 'truck' : q < 0.85 ? 'bus' : 'van'
    else if (profile === 'cars') kind = q < 0.55 ? 'car' : q < 0.8 ? 'sport' : q < 0.93 ? 'van' : 'bike'
    else kind = q < 0.45 ? 'car' : q < 0.6 ? 'van' : q < 0.72 ? 'bike' : q < 0.88 ? 'truck' : 'bus'
    const v = makeVehicle(kind, 0)
    x += v.w / 2
    if (x + v.w / 2 > ROAD_MARGIN + W - minGap) break
    v.x = x
    row.vehicles.push(v)
    x += v.w / 2 + rand(minGap, maxGap)
    if (x > loop) break
  }
  if (row.vehicles.length === 0) row.vehicles.push(makeVehicle('car', rand(0, W)))
}

function addRoadZone(g: Gen, rows: Map<number, Row>) {
  const r0 = g.next
  const d = diffAt(r0)
  const maxLanes = r0 < 12 ? 2 : Math.min(4, 2 + Math.floor(d * 3))
  const n = 1 + ((Math.random() * maxLanes) | 0)
  let dir = Math.random() < 0.5 ? 1 : -1
  for (let i = 0; i < n; i++) {
    const row = newRow(g.next, 'road')
    const q = Math.random()
    const profile: 'cars' | 'heavy' | 'mixed' = q < 0.5 ? 'cars' : q < 0.7 ? 'heavy' : 'mixed'
    const fast = profile === 'cars' && Math.random() < 0.1 + d * 0.2
    row.dir = dir
    row.speed = rand(58, 116) * (1 + 0.9 * d) * (profile === 'heavy' ? 0.72 : 1) * (fast ? 1.3 : 1)
    fillVehicles(row, d, profile)
    if (Math.random() < 0.12) row.coin = (Math.random() * COLS) | 0
    rows.set(row.r, row)
    g.next++
    dir = Math.random() < 0.75 ? -dir : dir
  }
  g.reach = new Array(COLS).fill(true)
  g.last = 'road'
}

function addRiverZone(g: Gen, rows: Map<number, Row>) {
  const r0 = g.next
  const d = diffAt(r0)
  const n = 1 + ((Math.random() * (r0 < 24 ? 2 : 3)) | 0)
  const lily = Math.random() < 0.38
  let dir = Math.random() < 0.5 ? 1 : -1
  for (let i = 0; i < n; i++) {
    const row = newRow(g.next, 'river')
    if (lily) {
      row.lily = true
      const prev = g.reach
      const pads: boolean[] = new Array(COLS).fill(false)
      const p = lerp(0.62, 0.45, d)
      for (let c = 0; c < COLS; c++) pads[c] = Math.random() < p
      let reach = computeReach(prev, pads)
      let guard = 0
      while (!anyTrue(reach) && guard++ < 12) {
        const cand: number[] = []
        for (let c = 0; c < COLS; c++) if (prev[c]) cand.push(c)
        pads[pick(cand)] = true
        reach = computeReach(prev, pads)
      }
      row.pads = pads
      g.reach = reach
      if (Math.random() < 0.35) {
        const cand: number[] = []
        for (let c = 0; c < COLS; c++) if (pads[c]) cand.push(c)
        row.coin = pick(cand)
      }
    } else {
      const turtles = r0 > 14 && Math.random() < 0.3 + d * 0.15
      row.dir = dir
      row.speed = rand(34, 70) * (1 + 0.7 * d)
      const loop = W + RIVER_MARGIN * 2
      const gMin = lerp(48, 80, d)
      const gMax = lerp(110, 170, d)
      let x = -RIVER_MARGIN + rand(0, 90)
      for (let k = 0; k < 10; k++) {
        const w = turtles ? pick([80, 80, 120]) : pick([80, 120, 120, 160])
        x += w / 2
        if (x + w / 2 > RIVER_MARGIN + W - gMin) break
        row.plats.push({ x, w, turtle: turtles, phase: rand(0, 7.5) })
        x += w / 2 + rand(gMin, gMax)
        if (x > loop) break
      }
      if (row.plats.length === 0) row.plats.push({ x: W / 2, w: 120, turtle: false, phase: 0 })
      g.reach = new Array(COLS).fill(true)
    }
    rows.set(row.r, row)
    g.next++
    dir = -dir
  }
  g.last = 'river'
}

function addRailZone(g: Gen, rows: Map<number, Row>) {
  const d = diffAt(g.next)
  const n = Math.random() < 0.7 ? 1 : 2
  for (let i = 0; i < n; i++) {
    const row = newRow(g.next, 'rail')
    row.dir = Math.random() < 0.5 ? 1 : -1
    row.rs = 0
    row.rt = rand(1.4, 5)
    row.warnDur = lerp(1.7, 1.0, d)
    rows.set(row.r, row)
    g.next++
  }
  g.reach = new Array(COLS).fill(true)
  g.last = 'rail'
}

function extend(g: Gen, rows: Map<number, Row>, upTo: number) {
  while (g.next <= upTo) {
    const r = g.next
    const d = diffAt(r)
    if (r <= 2) {
      rows.set(r, makeGrassRow(g, r, false))
      g.next++
      g.last = 'grass'
      continue
    }
    if (g.last === 'grass') {
      const roll = Math.random()
      const pRiver = r < 10 ? 0 : lerp(0.2, 0.34, d)
      const pRail = r < 14 ? 0 : lerp(0.12, 0.22, d)
      if (roll < pRiver) addRiverZone(g, rows)
      else if (roll < pRiver + pRail) addRailZone(g, rows)
      else addRoadZone(g, rows)
    } else if (g.last === 'road' && r >= 14 && Math.random() < 0.16 + 0.1 * d) {
      addRailZone(g, rows)
    } else {
      const afterRiver = g.last === 'river'
      const count = 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        rows.set(g.next, makeGrassRow(g, g.next, afterRiver && i === 0))
        g.next++
      }
      g.last = 'grass'
    }
  }
}

/* ------------------------------------------------------------------ */
/* Plataformas del río                                                 */
/* ------------------------------------------------------------------ */

/** 0 = en la superficie, 1 = a punto de hundirse, 2 = hundida. */
function platState(p: Platform, t: number) {
  if (!p.turtle) return 0
  const ph = (t + p.phase) % 7.5
  if (ph < 4.6) return 0
  if (ph < 5.6) return 1
  return 2
}

function support(row: Row, x: number, t: number): Platform | null {
  for (const p of row.plats) {
    if (Math.abs(x - p.x) <= p.w / 2 + 4 && platState(p, t) !== 2) return p
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

const CAUSE_TITLE: Record<Cause, string> = {
  car: 'ATROPELLADO',
  train: '¡TRENAZO!',
  water: '¡CHAPUZON!',
  eagle: '¡EL AGUILA!',
  drift: 'ARRASTRADO',
}

export default function CruzaCamino() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [coins, setCoins] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest(GAME_ID) : 0))
  const [result, setResult] = useState<Result | null>(null)
  const ctl = useRef<{ begin: () => void; restart: () => void }>({ begin: () => {}, restart: () => {} })
  const touch = useRef<{ id: number; sx: number; sy: number; fired: boolean } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(9)

    /* ---------------- estado del juego ---------------- */
    const rows = new Map<number, Row>()
    let gen: Gen = { next: -8, last: null, reach: new Array(COLS).fill(true) }
    const rings: Ring[] = []

    const G = {
      t: 0,
      cam: -4,
      phase: 'ready' as 'ready' | 'playing' | 'over',
      moved: false,
      paused: false,
      dead: false,
      deathT: 0,
      cause: 'car' as Cause,
      deathX: 0,
      deathRow: 0,
      finalized: false,
      maxRow: 0,
      coins: 0,
      bonus: 0,
      chain: 0,
      maxChain: 0,
      lastFwd: -10,
      eagleArmed: true,
      overAt: 0,
      lastShownScore: -1,
      lastShownCoins: -1,
    }
    const P = {
      x: colX(4),
      row: 0,
      fx: 0,
      frow: 0,
      tx: 0,
      trow: 0,
      hopping: false,
      hopT: 0,
      face: 'up' as Dir4,
      land: 0,
      bump: 0,
      blink: 2,
      holdDir: null as Dir4 | null,
      holdT: 0,
    }
    let buf: Dir4[] = []

    const scoreNow = () => G.maxRow + G.bonus + G.coins * 5

    function getRow(r: number): Row {
      let row = rows.get(r)
      if (!row) {
        extend(gen, rows, r + 4)
        row = rows.get(r)
      }
      return row ?? newRow(r, 'grass')
    }

    function resetWorld() {
      rows.clear()
      gen = { next: -8, last: null, reach: new Array(COLS).fill(true) }
      extend(gen, rows, 24)
      rings.length = 0
      juice.reset()
      const start = rows.get(0)
      if (start) start.obst[4] = 0
      Object.assign(G, {
        t: 0,
        cam: -4,
        moved: false,
        paused: false,
        dead: false,
        deathT: 0,
        finalized: false,
        maxRow: 0,
        coins: 0,
        bonus: 0,
        chain: 0,
        maxChain: 0,
        lastFwd: -10,
        eagleArmed: true,
        lastShownScore: -1,
        lastShownCoins: -1,
      })
      Object.assign(P, {
        x: colX(4),
        row: 0,
        hopping: false,
        hopT: 0,
        face: 'up',
        land: 0,
        bump: 0,
        holdDir: null,
        holdT: 0,
      })
      buf = []
      keyQueueRef.current = []
      setScore(0)
      setCoins(0)
    }

    function setGamePhase(ph: 'ready' | 'playing' | 'over') {
      G.phase = ph
      setPhase(ph)
    }

    function begin() {
      if (G.phase === 'playing') return
      resetWorld()
      setGamePhase('playing')
      sfx.start()
    }
    ctl.current = { begin, restart: begin }

    resetWorld()

    /* ---------------- sonidos locales ---------------- */
    const snd = {
      hop(n: number) {
        tone({ freq: 360 + (n % 6) * 26, to: 560 + (n % 6) * 26, dur: 0.07, vol: 0.035, type: 'square' })
      },
      plank() {
        tone({ freq: 150, to: 110, dur: 0.07, vol: 0.05, type: 'triangle' })
      },
      pad() {
        tone({ freq: 700, to: 900, dur: 0.05, vol: 0.025, type: 'sine' })
      },
      bump() {
        tone({ freq: 120, to: 90, dur: 0.06, vol: 0.04, type: 'square' })
      },
      horn() {
        tone({ freq: 300, dur: 0.26, vol: 0.035, type: 'sawtooth' })
        tone({ freq: 378, dur: 0.26, vol: 0.03, type: 'sawtooth' })
      },
      bell(hi: boolean) {
        tone({ freq: hi ? 1480 : 1180, dur: 0.12, vol: 0.04, type: 'sine' })
      },
      train() {
        noise({ dur: 1.1, vol: 0.09, freq: 520 })
        tone({ freq: 190, to: 150, dur: 0.7, vol: 0.05, type: 'sawtooth' })
        tone({ freq: 240, to: 200, dur: 0.7, vol: 0.035, type: 'sawtooth' })
      },
      splash() {
        noise({ dur: 0.4, vol: 0.09, freq: 2800 })
        tone({ freq: 620, to: 160, dur: 0.28, vol: 0.05, type: 'sine' })
      },
      squash() {
        noise({ dur: 0.2, vol: 0.12, freq: 700 })
        tone({ freq: 150, to: 45, dur: 0.28, vol: 0.07, type: 'square' })
      },
      screech() {
        tone({ freq: 1900, to: 950, dur: 0.38, vol: 0.04, type: 'sawtooth' })
        tone({ freq: 1500, to: 800, dur: 0.38, vol: 0.025, type: 'square', delay: 0.05 })
      },
      combo(n: number) {
        tone({ freq: 660 + n * 40, dur: 0.07, vol: 0.04 })
        tone({ freq: 990 + n * 40, dur: 0.1, vol: 0.04, delay: 0.07 })
      },
    }

    /* ---------------- puntuación ---------------- */
    function refreshHud() {
      const s = scoreNow()
      if (s !== G.lastShownScore) {
        G.lastShownScore = s
        setScore(s)
      }
      if (G.coins !== G.lastShownCoins) {
        G.lastShownCoins = G.coins
        setCoins(G.coins)
      }
    }

    function rowTop(r: number) {
      return Math.round(H - (r - G.cam + 1) * TILE)
    }

    /* ---------------- muertes ---------------- */
    function die(cause: Cause, x: number, row: number) {
      if (G.dead) return
      G.dead = true
      G.cause = cause
      G.deathT = 0
      G.deathX = x
      G.deathRow = row
      P.hopping = false
      P.bump = 0
      const y = rowTop(row) + TILE - 10
      if (cause === 'car' || cause === 'train') {
        juice.freeze(cause === 'train' ? 95 : 75)
        juice.shake(cause === 'train' ? 0.95 : 0.75)
        juice.flash('#ffffff', 0.28)
        juice.burst(x, y - 8, ['#ffd83a', '#f0b81f', '#fff3a0', '#ffffff'], { count: 20, speed: 150, life: 0.7, size: 4, gravity: 260, drag: 1.5 })
        juice.burst(x, y - 8, ['#ff5a4a', '#ff9a3c'], { count: 6, speed: 90, life: 0.5, size: 3, gravity: 200 })
        snd.squash()
        if (cause === 'car') snd.horn()
      } else if (cause === 'water' || cause === 'drift') {
        juice.shake(0.3)
        juice.freeze(40)
        juice.burst(x, y - 4, ['#bfe8ff', '#6cc0f2', '#ffffff', '#2b8fd9'], { count: 22, speed: 130, life: 0.8, size: 4, gravity: 340, drag: 1.2, angle: -Math.PI / 2, arc: Math.PI * 0.9 })
        rings.push({ x, y, t: 0 }, { x, y, t: -0.12 })
        snd.splash()
      } else {
        juice.shake(0.35)
        snd.screech()
      }
    }

    function finalize() {
      if (G.finalized) return
      G.finalized = true
      const s = scoreNow()
      const isBest = saveBest(GAME_ID, s)
      const b = Math.max(loadBest(GAME_ID), s)
      setBest(b)
      setResult({ score: s, rows: G.maxRow, coins: G.coins, chain: G.maxChain, cause: G.cause, newBest: isBest, best: b })
      G.overAt = G.t
      setGamePhase('over')
      sfx.gameOver()
    }

    /* ---------------- movimiento ---------------- */
    function settleNearMiss(row: Row) {
      for (const v of row.vehicles) {
        if (v.nm) {
          v.nm = false
          G.bonus += 2
          juice.text(P.x, rowTop(row.r) - 2, '¡CASI! +2', '#ffe066', 9, 0.8)
          sfx.nearMiss()
        }
      }
    }

    function tryHop(d: Dir4): boolean {
      if (P.hopping || G.dead) return false
      const dx = d === 'left' ? -1 : d === 'right' ? 1 : 0
      const dr = d === 'up' ? 1 : d === 'down' ? -1 : 0
      P.face = d
      const nrow = P.row + dr
      let nx = P.x + dx * TILE
      const bump = () => {
        P.bump = 0.16
        snd.bump()
        return false
      }
      if (nrow < G.cam - 0.3) return bump()
      if (dx !== 0 && (nx < TILE / 2 - 2 || nx > W - TILE / 2 + 2)) return bump()
      const tr = getRow(nrow)
      const onLogs = tr.kind === 'river' && !tr.lily
      if (!onLogs) {
        const col = colOf(nx)
        if (tr.kind === 'grass' && tr.obst[col] > 0) return bump()
        nx = colX(col)
      }
      const here = getRow(P.row)
      if (here.kind === 'road') settleNearMiss(here)
      P.fx = P.x
      P.frow = P.row
      P.tx = nx
      P.trow = nrow
      P.hopping = true
      P.hopT = 0
      if (!G.moved) G.moved = true
      snd.hop(G.maxRow)
      return true
    }

    function pickCoin(row: Row) {
      if (row.coin >= 0 && !row.coinTaken && colOf(P.x) === row.coin && Math.abs(P.x - colX(row.coin)) < 16) {
        row.coinTaken = true
        G.coins++
        const y = rowTop(row.r)
        juice.text(P.x, y - 6, '+5', '#ffd54a', 11, 0.8)
        juice.burst(P.x, y + 14, ['#ffd54a', '#fff3a0', '#ffffff'], { count: 8, speed: 80, life: 0.4, size: 3 })
        sfx.coin()
      }
    }

    function landed() {
      P.x = P.tx
      P.row = P.trow
      P.hopping = false
      P.land = 1
      const row = getRow(P.row)
      const y = rowTop(P.row)
      if (row.kind === 'river') {
        if (row.lily) {
          const col = colOf(P.x)
          if (!row.pads?.[col]) {
            die('water', P.x, P.row)
            return
          }
          snd.pad()
        } else {
          if (!support(row, P.x, G.t)) {
            die('water', P.x, P.row)
            return
          }
          snd.plank()
          juice.burst(P.x, y + 28, ['#bfe8ff', '#ffffff'], { count: 4, speed: 40, life: 0.3, size: 2 })
        }
      } else if (row.kind === 'grass') {
        juice.burst(P.x, y + 32, ['#9bf0a3', '#3fa855', '#c8ffd0'], { count: 4, speed: 40, life: 0.3, size: 3, gravity: 80, angle: -Math.PI / 2, arc: Math.PI })
      } else {
        juice.burst(P.x, y + 32, ['#9aa0b4', '#c9ceda'], { count: 3, speed: 36, life: 0.25, size: 2 })
      }
      pickCoin(row)
      if (P.row > G.maxRow) {
        G.maxRow = P.row
        if (G.t - G.lastFwd > 0.95) G.chain = 0
        if (row.kind !== 'grass') G.chain++
        G.lastFwd = G.t
        if (G.chain > G.maxChain) G.maxChain = G.chain
        if (G.chain >= 3) {
          const b = (G.chain - 2) * 2
          G.bonus += b
          juice.text(P.x, y - 10, `COMBO x${G.chain} +${b}`, '#7dffc8', 9, 0.95)
          snd.combo(Math.min(G.chain, 10))
          juice.shake(0.06)
        }
        if (G.maxRow % 25 === 0) {
          juice.text(W / 2, H * 0.3, `FILA ${G.maxRow}`, ACCENT, 14, 1.2)
          sfx.levelUp()
        }
      }
      refreshHud()
    }

    /* ---------------- actualización ---------------- */
    function updateRows(dt: number) {
      const lo = Math.floor(G.cam) - 2
      const hi = Math.ceil(G.cam + H / TILE) + 2
      for (let r = lo; r <= hi; r++) {
        const row = rows.get(r)
        if (!row) continue
        if (row.kind === 'road') {
          const loop = W + ROAD_MARGIN * 2
          for (const v of row.vehicles) {
            v.x += row.dir * row.speed * dt
            if (row.dir > 0 && v.x > W + ROAD_MARGIN) v.x -= loop
            else if (row.dir < 0 && v.x < -ROAD_MARGIN) v.x += loop
          }
        } else if (row.kind === 'river' && !row.lily) {
          const loop = W + RIVER_MARGIN * 2
          for (const p of row.plats) {
            p.x += row.dir * row.speed * dt
            if (row.dir > 0 && p.x > W + RIVER_MARGIN) p.x -= loop
            else if (row.dir < 0 && p.x < -RIVER_MARGIN) p.x += loop
          }
        } else if (row.kind === 'rail') {
          const near = Math.abs(row.r - P.row) <= 8 && G.phase === 'playing'
          if (row.rs === 0) {
            row.rt -= dt
            if (row.rt <= 0) {
              row.rs = 1
              row.rt = row.warnDur
              row.bell = 0
              row.dir = Math.random() < 0.5 ? 1 : -1
              row.trainLen = rand(520, 780)
              row.trainX = row.dir > 0 ? 0 : W
            }
          } else if (row.rs === 1) {
            row.rt -= dt
            row.bell -= dt
            if (row.bell <= 0) {
              row.bell = 0.26
              if (near) snd.bell(Math.floor(row.rt / 0.26) % 2 === 0)
            }
            if (row.rt <= 0) {
              row.rs = 2
              if (near) {
                snd.train()
                juice.shake(0.22)
              }
            }
          } else {
            row.trainX += row.dir * 1150 * dt
            const gone = row.dir > 0 ? row.trainX - row.trainLen > W + 30 : row.trainX + row.trainLen < -30
            if (gone) {
              row.rs = 0
              row.rt = rand(2.4, 6.5) * (1 - 0.3 * diffAt(row.r))
            }
          }
        }
      }
    }

    function processInput(dt: number) {
      justPressedRef.current.clear()
      const q = keyQueueRef.current
      let wantsAny = false
      if (q.length) {
        keyQueueRef.current = []
        for (const k of q) {
          if (k === 'pause') {
            if (G.phase === 'playing' && !G.dead) G.paused = !G.paused
            if (G.paused) sfx.pause()
          } else if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
            wantsAny = true
            buf.push(k)
          } else if (k === 'action') {
            wantsAny = true
            buf.push('up')
          }
        }
        if (buf.length > 2) buf = buf.slice(-2)
      }
      if (G.phase === 'ready') {
        if (wantsAny) {
          const first = buf[0]
          const fromAction = q.includes('action') && !q.some((k) => k === 'up' || k === 'down' || k === 'left' || k === 'right')
          begin()
          buf = fromAction ? [] : first ? [first] : []
        }
        return
      }
      if (G.phase === 'over') {
        if (wantsAny && G.t - G.overAt > 0.4) {
          begin()
          buf = []
        } else buf = []
        return
      }
      if (G.dead) {
        // reinicio rápido: se puede saltar la animación de muerte
        if (wantsAny && G.deathT > 0.55) {
          finalize()
          begin()
        }
        buf = []
        return
      }
      if (G.paused) {
        buf = []
        return
      }
      // mantener pulsado = avanzar repetidamente
      const pr = pressedRef.current
      const held: Dir4 | null = pr.has('up') || pr.has('action') ? 'up' : pr.has('left') ? 'left' : pr.has('right') ? 'right' : pr.has('down') ? 'down' : null
      if (held !== P.holdDir) {
        P.holdDir = held
        P.holdT = 0
      } else if (held) {
        P.holdT += dt
        if (P.holdT > 0.24 && !P.hopping && buf.length === 0) {
          P.holdT = 0
          buf.push(held)
        }
      }
    }

    function consumeBuffer() {
      while (buf.length && !P.hopping && !G.dead) {
        const d = buf.shift()
        if (d) tryHop(d)
      }
    }

    function checkHazards(dt: number) {
      if (G.dead) return
      const hopFrac = P.hopping ? P.hopT : 0
      const rEff = P.hopping ? (hopFrac > 0.5 ? P.trow : P.frow) : P.row
      const px = P.hopping ? lerp(P.fx, P.tx, hopFrac) : P.x
      const row = rows.get(rEff)
      if (!row) return
      if (row.kind === 'road') {
        for (const v of row.vehicles) {
          const dist = Math.abs(v.x - px)
          const gap = dist - (v.w / 2 + 10)
          if (gap <= 0) {
            die('car', px, rEff)
            return
          }
          if (gap < 11) v.nm = true
          else if (v.nm && gap >= 18) {
            v.nm = false
            G.bonus += 2
            juice.text(px, rowTop(rEff) - 2, '¡CASI! +2', '#ffe066', 9, 0.8)
            sfx.nearMiss()
            refreshHud()
          }
          const toward = row.dir * (px - v.x) > 0
          if (!v.honk && toward && gap < 54 && gap > 14 && (v.w > 60 || Math.random() < 0.02)) {
            v.honk = true
            snd.horn()
          } else if (v.honk && gap > 150) v.honk = false
        }
      } else if (row.kind === 'rail') {
        if (row.rs === 2) {
          const a = row.dir > 0 ? row.trainX - row.trainLen : row.trainX
          const b = row.dir > 0 ? row.trainX : row.trainX + row.trainLen
          if (px + 9 > a && px - 9 < b) {
            die('train', px, rEff)
            return
          }
        }
      } else if (row.kind === 'river' && !P.hopping) {
        if (row.lily) return
        const sup = support(row, P.x, G.t)
        if (!sup) {
          die('water', P.x, P.row)
          return
        }
        P.x += row.dir * row.speed * dt
        if (P.x < 4 || P.x > W - 4) die('drift', P.x, P.row)
      }
    }

    function step(dtReal: number) {
      const dt = juice.update(dtReal)
      processInput(dtReal)
      if (G.paused) return
      if (G.phase === 'ready') {
        G.t += dt
        updateRows(dt)
        return
      }
      G.t += dt
      updateRows(dt)
      if (G.phase === 'playing' || G.phase === 'over') {
        for (const rg of rings) rg.t += dt
        if (rings.length > 8) rings.splice(0, rings.length - 8)
      }
      if (G.dead) {
        G.deathT += dt
        const limit = G.cause === 'eagle' ? 1.45 : G.cause === 'water' || G.cause === 'drift' ? 1.0 : 1.05
        if (G.deathT > limit) finalize()
        return
      }
      if (G.phase !== 'playing') return

      // salto
      if (P.hopping) {
        P.hopT += dt / HOP_T
        if (P.hopT >= 1) landed()
      }
      if (P.land > 0) P.land = Math.max(0, P.land - dt / 0.14)
      if (P.bump > 0) P.bump = Math.max(0, P.bump - dt)
      P.blink -= dt
      if (P.blink < -0.12) P.blink = rand(1.8, 4)
      consumeBuffer()
      checkHazards(dt)
      if (G.dead) return

      // cámara
      const d = diffAt(G.maxRow)
      const vrow = P.hopping ? lerp(P.frow, P.trow, P.hopT) : P.row
      if (G.moved) G.cam += lerp(0.6, 0.95, d) * dt
      const target = vrow - 4
      if (target > G.cam) G.cam += (target - G.cam) * (1 - Math.exp(-7 * dt))

      // águila
      const lvl = clamp(1 - (vrow - G.cam + 0.45) / 2.2, 0, 1)
      if (G.moved) {
        if (lvl > 0.12 && G.eagleArmed) {
          G.eagleArmed = false
          snd.screech()
        } else if (lvl < 0.04) G.eagleArmed = true
        if (vrow < G.cam - 0.45) die('eagle', P.x, Math.round(vrow))
      }
      extend(gen, rows, Math.ceil(G.cam + H / TILE) + 8)
      const cut = Math.floor(G.cam) - 12
      if (rows.size > 80) for (const k of rows.keys()) if (k < cut) rows.delete(k)
    }

    /* ---------------- dibujo ---------------- */
    function drawGround(row: Row, y: number) {
      const t = G.t
      if (row.kind === 'grass') {
        ctx.fillStyle = row.shade ? '#62d46f' : '#58c866'
        ctx.fillRect(0, y, W, TILE)
        ctx.fillStyle = row.shade ? '#54bf61' : '#4eb65b'
        for (let c = 0; c < COLS; c++) {
          const h = hash(row.r, c)
          if (h < 0.5) {
            ctx.fillRect(c * TILE + 4 + h * 40, y + 8 + hash(c, row.r) * 20, 3, 2)
            ctx.fillRect(c * TILE + 22 + h * 10, y + 24 + h * 8, 2, 3)
          }
        }
        for (const f of row.flowers) {
          const fx = f.c * TILE + f.ox
          const fy = y + f.oy
          ctx.fillStyle = f.k === 0 ? '#ffffff' : f.k === 1 ? '#ff8fb8' : '#ffe066'
          ctx.fillRect(fx, fy, 3, 3)
          ctx.fillStyle = '#ffd23f'
          ctx.fillRect(fx + 1, fy + 1, 1, 1)
        }
      } else if (row.kind === 'road') {
        ctx.fillStyle = '#454a5a'
        ctx.fillRect(0, y, W, TILE)
        ctx.fillStyle = '#3d4150'
        for (let c = 0; c < COLS; c++) {
          const h = hash(row.r + 7, c)
          if (h < 0.4) ctx.fillRect(c * TILE + h * 60, y + 10 + h * 40, 5, 2)
        }
        const far = rows.get(row.r + 1)
        const near = rows.get(row.r - 1)
        if (!far || far.kind !== 'road') {
          ctx.fillStyle = '#6b7388'
          ctx.fillRect(0, y, W, 3)
        } else {
          ctx.fillStyle = 'rgba(235,238,246,0.55)'
          for (let x = 4; x < W; x += 36) ctx.fillRect(x, y - 1, 20, 2)
        }
        if (!near || near.kind !== 'road') {
          ctx.fillStyle = '#6b7388'
          ctx.fillRect(0, y + TILE - 3, W, 3)
        }
      } else if (row.kind === 'river') {
        ctx.fillStyle = '#2b8fd9'
        ctx.fillRect(0, y, W, TILE)
        ctx.fillStyle = '#2381c9'
        ctx.fillRect(0, y, W, 8)
        ctx.fillStyle = 'rgba(190,230,255,0.45)'
        const dirv = row.lily ? 1 : row.dir
        for (let k = 0; k < 6; k++) {
          const wx = (((k * 83 + row.r * 37 + t * 14 * dirv) % (W + 60)) + (W + 60)) % (W + 60) - 30
          ctx.fillRect(wx, y + 12 + (k % 3) * 9, 14 + (k % 2) * 8, 2)
        }
        if (row.lily && row.pads) {
          for (let c = 0; c < COLS; c++) {
            if (!row.pads[c]) continue
            const cx = colX(c)
            const bob = Math.sin(t * 2 + c + row.r) * 1
            ctx.fillStyle = 'rgba(0,0,0,0.2)'
            ctx.beginPath()
            ctx.ellipse(cx + 2, y + 24 + bob, 15, 11, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#2f9a4b'
            ctx.beginPath()
            ctx.ellipse(cx, y + 21 + bob, 15, 11, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#4fcf6e'
            ctx.beginPath()
            ctx.ellipse(cx, y + 19 + bob, 13, 9, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#2b8fd9'
            ctx.beginPath()
            ctx.moveTo(cx, y + 19 + bob)
            ctx.lineTo(cx + 8, y + 12 + bob)
            ctx.lineTo(cx + 12, y + 17 + bob)
            ctx.closePath()
            ctx.fill()
            if (hash(row.r, c + 11) < 0.25) {
              ctx.fillStyle = '#ff8fb8'
              ctx.fillRect(cx - 5, y + 16 + bob, 5, 5)
              ctx.fillStyle = '#ffe066'
              ctx.fillRect(cx - 3, y + 18 + bob, 2, 2)
            }
          }
        }
      } else {
        ctx.fillStyle = '#8c7b68'
        ctx.fillRect(0, y, W, TILE)
        ctx.fillStyle = '#7a6a58'
        for (let c = 0; c < COLS; c++) {
          const h = hash(row.r + 3, c)
          ctx.fillRect(c * TILE + h * 30, y + 4 + h * 30, 3, 2)
        }
        ctx.fillStyle = '#5b4636'
        for (let x = 2; x < W; x += 14) ctx.fillRect(x, y + 4, 7, TILE - 8)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(0, y + 14, W, 2)
        ctx.fillRect(0, y + 30, W, 2)
        ctx.fillStyle = '#d5dae3'
        ctx.fillRect(0, y + 12, W, 3)
        ctx.fillRect(0, y + 28, W, 3)
        ctx.fillStyle = '#f4f6fb'
        ctx.fillRect(0, y + 12, W, 1)
        ctx.fillRect(0, y + 28, W, 1)
        if (row.rs === 1) {
          const on = Math.floor(t * 8) % 2 === 0
          ctx.fillStyle = on ? 'rgba(255,60,60,0.22)' : 'rgba(255,60,60,0.06)'
          ctx.fillRect(0, y, W, TILE)
        }
      }
      // borde elevado del pasto sobre filas más bajas
      if (row.kind === 'grass') {
        const near = rows.get(row.r - 1)
        if (near && near.kind !== 'grass') {
          ctx.fillStyle = '#3a9a4c'
          ctx.fillRect(0, y + TILE, W, 6)
          ctx.fillStyle = '#2d7f3d'
          ctx.fillRect(0, y + TILE + 4, W, 2)
        }
      }
    }

    function drawTree(kind: number, cx: number, y: number, seed: number) {
      const sway = Math.sin(G.t * 1.6 + seed * 6) * 0.8
      if (kind === 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.24)'
        rr(ctx, cx - 12, y + 20, 30, 14, 6)
        ctx.fill()
        ctx.fillStyle = '#7d8699'
        rr(ctx, cx - 14, y + 14, 28, 20, 7)
        ctx.fill()
        ctx.fillStyle = '#a9b2c4'
        rr(ctx, cx - 13, y + 10, 24, 16, 7)
        ctx.fill()
        ctx.fillStyle = '#c9d0de'
        ctx.fillRect(cx - 8, y + 13, 7, 3)
        ctx.fillStyle = '#8f98ab'
        ctx.fillRect(cx + 3, y + 19, 5, 3)
        return
      }
      if (kind === 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)'
        rr(ctx, cx - 12, y + 22, 30, 12, 6)
        ctx.fill()
        ctx.fillStyle = '#2a8c45'
        rr(ctx, cx - 14, y + 16, 28, 18, 8)
        ctx.fill()
        ctx.fillStyle = '#45c063'
        rr(ctx, cx - 12, y + 10, 24, 17, 8)
        ctx.fill()
        ctx.fillStyle = '#ff5a5f'
        ctx.fillRect(cx - 6, y + 15, 3, 3)
        ctx.fillRect(cx + 3, y + 19, 3, 3)
        ctx.fillRect(cx - 1, y + 22, 3, 3)
        return
      }
      ctx.fillStyle = 'rgba(0,0,0,0.24)'
      rr(ctx, cx - 11, y + 22, 32, 13, 6)
      ctx.fill()
      ctx.fillStyle = '#7a4a2a'
      ctx.fillRect(cx - 4, y + 20, 8, 15)
      ctx.fillStyle = '#5e3720'
      ctx.fillRect(cx + 1, y + 20, 3, 15)
      if (kind === 1) {
        ctx.fillStyle = '#2e9d4a'
        rr(ctx, cx - 16 + sway * 0.3, y + 6, 32, 22, 7)
        ctx.fill()
        ctx.fillStyle = '#3cb55a'
        rr(ctx, cx - 14 + sway * 0.6, y - 4, 28, 18, 7)
        ctx.fill()
        ctx.fillStyle = '#58d476'
        rr(ctx, cx - 10 + sway, y - 12, 20, 14, 6)
        ctx.fill()
        ctx.fillStyle = '#8bf0a4'
        ctx.fillRect(cx - 7 + sway, y - 9, 6, 3)
      } else {
        const tier = (cy: number, hw: number, col: string) => {
          ctx.fillStyle = col
          ctx.beginPath()
          ctx.moveTo(cx + sway * 0.5, cy - 14)
          ctx.lineTo(cx + hw, cy + 6)
          ctx.lineTo(cx - hw, cy + 6)
          ctx.closePath()
          ctx.fill()
        }
        tier(y + 20, 17, '#23823c')
        tier(y + 8, 14, '#2fa24f')
        tier(y - 3, 10, '#45c564')
        ctx.fillStyle = '#9af5b0'
        ctx.fillRect(cx - 2 + sway * 0.5, y - 12, 3, 3)
      }
    }

    function drawCoin(cx: number, y: number, seed: number) {
      const t = G.t
      const bob = Math.sin(t * 4 + seed) * 2
      const wv = Math.abs(Math.cos(t * 5 + seed))
      const w = 3 + wv * 8
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(cx + 2, y + 31, 8, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      const cy = y + 17 + bob
      ctx.fillStyle = '#d98f00'
      rr(ctx, cx - w, cy - 9, w * 2, 18, Math.min(w, 6))
      ctx.fill()
      ctx.fillStyle = '#ffd54a'
      rr(ctx, cx - w + 1, cy - 8, Math.max(2, w * 2 - 3), 15, Math.min(w, 5))
      ctx.fill()
      if (w > 6) {
        ctx.fillStyle = '#fff3a0'
        ctx.fillRect(cx - 1, cy - 5, 2, 9)
      }
    }

    function drawVehicle(v: Vehicle, dir: number, y: number) {
      const L = v.x - v.w / 2
      const w = v.w
      const front = dir > 0 ? L + w : L
      const rear = dir > 0 ? L : L + w
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      rr(ctx, L + 3, y + 14, w, 24, 6)
      ctx.fill()
      const wheel = (wx: number) => {
        ctx.fillStyle = '#16181f'
        ctx.fillRect(wx, y + 30, 9, 6)
      }
      if (v.kind === 'bike') {
        ctx.fillStyle = '#16181f'
        ctx.fillRect(L + 1, y + 27, 7, 8)
        ctx.fillRect(L + w - 8, y + 27, 7, 8)
        ctx.fillStyle = v.dark
        rr(ctx, L + 4, y + 20, w - 8, 12, 4)
        ctx.fill()
        ctx.fillStyle = v.color
        rr(ctx, L + 4, y + 17, w - 8, 11, 4)
        ctx.fill()
        ctx.fillStyle = '#2b3550'
        ctx.beginPath()
        ctx.arc(v.x + (dir > 0 ? -1 : 1), y + 14, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffdfb8'
        ctx.fillRect(v.x + (dir > 0 ? 1 : -4), y + 12, 3, 3)
        ctx.fillStyle = '#fff6b0'
        ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 24, 3, 3)
        return
      }
      if (v.kind === 'truck') {
        const cabW = 30
        const cabL = dir > 0 ? L + w - cabW : L
        const boxL = dir > 0 ? L : L + cabW
        const boxW = w - cabW - 2
        ctx.fillStyle = '#9aa2b6'
        rr(ctx, boxL, y + 8, boxW, 26, 3)
        ctx.fill()
        ctx.fillStyle = '#eef1f7'
        rr(ctx, boxL, y + 4, boxW, 26, 3)
        ctx.fill()
        ctx.fillStyle = v.color
        ctx.fillRect(boxL + 2, y + 15, boxW - 4, 5)
        ctx.fillStyle = v.dark
        rr(ctx, cabL, y + 11, cabW, 23, 5)
        ctx.fill()
        ctx.fillStyle = v.color
        rr(ctx, cabL, y + 7, cabW, 22, 5)
        ctx.fill()
        ctx.fillStyle = '#27324a'
        ctx.fillRect(dir > 0 ? cabL + cabW - 11 : cabL + 3, y + 10, 8, 14)
        wheel(boxL + 8)
        wheel(boxL + boxW - 20)
        wheel(cabL + 8)
        ctx.fillStyle = '#fff6b0'
        ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 10, 3, 4)
        ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 24, 3, 4)
        ctx.fillStyle = '#ff3b3b'
        ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 12, 3, 4)
        ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 22, 3, 4)
        return
      }
      if (v.kind === 'bus') {
        ctx.fillStyle = v.dark
        rr(ctx, L, y + 10, w, 26, 6)
        ctx.fill()
        ctx.fillStyle = v.color
        rr(ctx, L, y + 5, w, 26, 6)
        ctx.fill()
        ctx.fillStyle = v.light
        rr(ctx, L + 4, y + 7, w - 8, 6, 3)
        ctx.fill()
        ctx.fillStyle = '#27324a'
        for (let i = 0; i < 6; i++) ctx.fillRect(L + 8 + i * 14, y + 16, 10, 8)
        wheel(L + 12)
        wheel(L + w - 22)
        ctx.fillStyle = '#fff6b0'
        ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 10, 3, 4)
        ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 24, 3, 4)
        ctx.fillStyle = '#ff3b3b'
        ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 10, 3, 4)
        ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 24, 3, 4)
        return
      }
      // coche / deportivo / van
      ctx.fillStyle = v.dark
      rr(ctx, L, y + 12, w, 23, 6)
      ctx.fill()
      ctx.fillStyle = v.color
      rr(ctx, L, y + 8, w, 23, 6)
      ctx.fill()
      const cabW = v.kind === 'van' ? w - 14 : w * 0.52
      const cabL = v.kind === 'van' ? (dir > 0 ? L + 3 : L + 11) : dir > 0 ? L + w * 0.2 : L + w * 0.28
      ctx.fillStyle = '#27324a'
      rr(ctx, cabL, y + 11, cabW, 17, 3)
      ctx.fill()
      ctx.fillStyle = v.light
      rr(ctx, cabL + 3, y + 12, cabW - 6, 14, 3)
      ctx.fill()
      wheel(L + 5)
      wheel(L + w - 14)
      ctx.fillStyle = '#fff6b0'
      ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 11, 3, 4)
      ctx.fillRect(front - (dir > 0 ? 3 : 0), y + 24, 3, 4)
      ctx.fillStyle = '#ff3b3b'
      ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 11, 3, 4)
      ctx.fillRect(rear - (dir > 0 ? 0 : 3), y + 24, 3, 4)
      if (v.kind === 'sport') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(L + 6, y + 18, w - 12, 2)
      }
    }

    function drawPlatform(p: Platform, y: number) {
      const t = G.t
      const L = p.x - p.w / 2
      const bob = Math.sin(t * 2.2 + p.x * 0.03) * 1.2
      const st = platState(p, t)
      if (!p.turtle) {
        ctx.fillStyle = 'rgba(0,30,70,0.25)'
        rr(ctx, L + 3, y + 14 + bob, p.w, 24, 8)
        ctx.fill()
        ctx.fillStyle = '#6b4424'
        rr(ctx, L, y + 11 + bob, p.w, 24, 9)
        ctx.fill()
        ctx.fillStyle = '#8e5c30'
        rr(ctx, L, y + 8 + bob, p.w, 22, 9)
        ctx.fill()
        ctx.fillStyle = '#a8743f'
        ctx.fillRect(L + 8, y + 11 + bob, p.w - 16, 3)
        ctx.fillStyle = '#6b4424'
        for (let x = L + 22; x < L + p.w - 14; x += 30) ctx.fillRect(x, y + 17 + bob, 12, 2)
        ctx.fillStyle = '#d3a86c'
        rr(ctx, L, y + 8 + bob, 9, 22, 5)
        ctx.fill()
        rr(ctx, L + p.w - 9, y + 8 + bob, 9, 22, 5)
        ctx.fill()
        ctx.fillStyle = '#9a6c3a'
        ctx.fillRect(L + 3, y + 16 + bob, 3, 6)
        ctx.fillRect(L + p.w - 6, y + 16 + bob, 3, 6)
        return
      }
      // tortugas
      const n = Math.round(p.w / TILE)
      const sink = st === 2 ? 1 : st === 1 ? (Math.floor(t * 10) % 2 === 0 ? 0.35 : 0) : 0
      for (let i = 0; i < n; i++) {
        const cx = L + TILE * i + TILE / 2
        ctx.globalAlpha = st === 2 ? 0.25 : 1
        const oy = y + bob + sink * 5
        ctx.fillStyle = 'rgba(0,30,70,0.25)'
        ctx.beginPath()
        ctx.ellipse(cx + 2, oy + 25, 16, 12, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7bc97b'
        ctx.fillRect(cx - 14, oy + 10, 5, 5)
        ctx.fillRect(cx + 9, oy + 10, 5, 5)
        ctx.fillRect(cx - 14, oy + 27, 5, 5)
        ctx.fillRect(cx + 9, oy + 27, 5, 5)
        ctx.fillStyle = '#7bc97b'
        ctx.fillRect(cx - 5, oy + 4, 10, 8)
        ctx.fillStyle = '#1f6b3a'
        ctx.beginPath()
        ctx.ellipse(cx, oy + 21, 15, 13, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = st === 1 ? '#c9a04a' : '#2f9a55'
        ctx.beginPath()
        ctx.ellipse(cx, oy + 19, 13, 11, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = st === 1 ? '#e6c36e' : '#49c277'
        ctx.fillRect(cx - 6, oy + 14, 5, 5)
        ctx.fillRect(cx + 1, oy + 20, 5, 5)
        ctx.fillStyle = '#111'
        ctx.fillRect(cx - 3, oy + 6, 2, 2)
        ctx.fillRect(cx + 1, oy + 6, 2, 2)
        ctx.globalAlpha = 1
      }
      if (st === 2) {
        ctx.fillStyle = 'rgba(220,245,255,0.6)'
        for (let i = 0; i < n; i++) {
          const cx = L + TILE * i + TILE / 2
          ctx.fillRect(cx - 5 + Math.sin(t * 8 + i) * 2, y + 20, 10, 2)
        }
      }
    }

    function drawTrain(row: Row, y: number) {
      const len = row.trainLen
      const dir = row.dir
      const x0 = dir > 0 ? row.trainX - len : row.trainX
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x0 + 3, y + 8, len, 32)
      const segs: number[] = []
      let acc = 0
      segs.push(92)
      acc = 92
      while (acc < len) {
        const sw = Math.min(104, len - acc)
        segs.push(sw)
        acc += sw
      }
      let px = dir > 0 ? x0 + len : x0
      for (let i = 0; i < segs.length; i++) {
        const sw = segs[i]
        const sx = dir > 0 ? px - sw : px
        px = dir > 0 ? px - sw : px + sw
        if (sx > W || sx + sw < 0) continue
        const loco = i === 0
        const body = loco ? '#d83a3a' : i % 2 ? '#3c6fd1' : '#d4a62a'
        ctx.fillStyle = shade(body, -0.4)
        rr(ctx, sx + 1, y + 8, sw - 3, 30, 4)
        ctx.fill()
        ctx.fillStyle = body
        rr(ctx, sx + 1, y + 2, sw - 3, 29, 4)
        ctx.fill()
        ctx.fillStyle = shade(body, 0.35)
        ctx.fillRect(sx + 4, y + 4, sw - 9, 4)
        ctx.fillStyle = '#ffeaa0'
        const nwin = loco ? 3 : 4
        for (let k = 0; k < nwin; k++) ctx.fillRect(sx + 8 + k * ((sw - 20) / nwin), y + 14, (sw - 20) / nwin - 5, 8)
        ctx.fillStyle = '#1a1d28'
        ctx.fillRect(sx + 3, y + 30, sw - 7, 3)
        if (loco) {
          const nose = dir > 0 ? sx + sw - 8 : sx + 2
          ctx.fillStyle = '#ffe066'
          ctx.fillRect(nose, y + 6, 6, 22)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(dir > 0 ? sx + sw - 5 : sx + 1, y + 12, 3, 4)
          ctx.fillRect(dir > 0 ? sx + sw - 5 : sx + 1, y + 20, 3, 4)
        }
      }
    }

    function drawSignal(row: Row, y: number) {
      const on = row.rs === 1 && Math.floor(G.t * 8) % 2 === 0
      const on2 = row.rs === 1 && !on
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(16, y + 24, 14, 5)
      ctx.fillStyle = '#4b5060'
      ctx.fillRect(10, y - 8, 5, 38)
      ctx.fillStyle = '#e8ecf3'
      ctx.fillRect(2, y - 14, 20, 8)
      ctx.fillStyle = '#1a1d28'
      ctx.fillRect(4, y - 12, 16, 12)
      ctx.fillStyle = on ? '#ff4040' : '#5a1e1e'
      ctx.fillRect(6, y - 10, 5, 5)
      ctx.fillStyle = on2 ? '#ff4040' : '#5a1e1e'
      ctx.fillRect(13, y - 10, 5, 5)
      if (on || on2) {
        ctx.fillStyle = 'rgba(255,64,64,0.35)'
        ctx.beginPath()
        ctx.arc(on ? 8 : 15, y - 7, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawChick(x: number, feetY: number, sx: number, sy: number, hopH: number, face: Dir4, blinking: boolean, alpha = 1) {
      const sh = clamp(1 - hopH / 40, 0.4, 1)
      ctx.globalAlpha = 0.28 * alpha
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(x + 2, feetY + 1, 11 * sh * sx, 4.5 * sh, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = alpha
      ctx.save()
      ctx.translate(x, feetY - hopH)
      ctx.scale(sx, sy)
      const ox = face === 'left' ? -2.5 : face === 'right' ? 2.5 : 0
      const oy = face === 'up' ? -1.5 : face === 'down' ? 1.2 : 0
      // patas
      ctx.fillStyle = '#ff9a3c'
      ctx.fillRect(-7, -4, 5, 5)
      ctx.fillRect(2, -4, 5, 5)
      // alas
      ctx.fillStyle = '#f0b81f'
      ctx.fillRect(-15, -17, 5, 10)
      ctx.fillRect(10, -17, 5, 10)
      // cuerpo
      ctx.fillStyle = '#f0b81f'
      rr(ctx, -13, -26, 26, 24, 7)
      ctx.fill()
      ctx.fillStyle = '#ffd83a'
      rr(ctx, -13, -26, 26, 20, 7)
      ctx.fill()
      ctx.fillStyle = '#fff09a'
      ctx.fillRect(-9, -23, 7, 3)
      // cresta
      ctx.fillStyle = '#ff5a4a'
      ctx.fillRect(-2 + ox * 0.5, -31, 4, 6)
      ctx.fillRect(-6 + ox * 0.5, -29, 3, 4)
      ctx.fillRect(3 + ox * 0.5, -29, 3, 4)
      // ojos
      const ey = -17 + oy
      if (blinking) {
        ctx.fillStyle = '#222'
        ctx.fillRect(-7 + ox, ey + 1, 4, 1)
        ctx.fillRect(3 + ox, ey + 1, 4, 1)
      } else {
        ctx.fillStyle = '#16161f'
        ctx.fillRect(-7 + ox, ey - 1, 4, 5)
        ctx.fillRect(3 + ox, ey - 1, 4, 5)
        ctx.fillStyle = '#fff'
        ctx.fillRect(-6 + ox, ey, 1, 1)
        ctx.fillRect(4 + ox, ey, 1, 1)
      }
      // pico
      ctx.fillStyle = '#ff8a1f'
      if (face === 'left' || face === 'right') ctx.fillRect(-3 + ox * 1.6, -11 + oy, 6, 4)
      else ctx.fillRect(-3, -11 + oy + (face === 'up' ? -1 : 1), 6, 4)
      ctx.fillStyle = '#e06f10'
      ctx.fillRect(-3 + (face === 'left' || face === 'right' ? ox * 1.6 : 0), -8 + oy + (face === 'up' ? -1 : face === 'down' ? 1 : 0), 6, 1)
      ctx.restore()
      ctx.globalAlpha = 1
    }

    function drawEagle(x: number, y: number, flap: number) {
      const wing = Math.sin(flap * 18) * 10
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(x + 8, y + 50, 40, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5b3a1e'
      ctx.beginPath()
      ctx.moveTo(x - 6, y - 4)
      ctx.lineTo(x - 52, y - 14 - wing)
      ctx.lineTo(x - 44, y + 8 - wing * 0.5)
      ctx.lineTo(x - 10, y + 12)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x + 6, y - 4)
      ctx.lineTo(x + 52, y - 14 - wing)
      ctx.lineTo(x + 44, y + 8 - wing * 0.5)
      ctx.lineTo(x + 10, y + 12)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#7a5028'
      rr(ctx, x - 12, y - 8, 24, 30, 9)
      ctx.fill()
      ctx.fillStyle = '#fff3e0'
      rr(ctx, x - 8, y - 18, 16, 14, 6)
      ctx.fill()
      ctx.fillStyle = '#ffb300'
      ctx.fillRect(x - 3, y - 8, 6, 6)
      ctx.fillStyle = '#16161f'
      ctx.fillRect(x - 6, y - 14, 3, 3)
      ctx.fillRect(x + 3, y - 14, 3, 3)
      ctx.fillStyle = '#ffb300'
      ctx.fillRect(x - 8, y + 22, 4, 8)
      ctx.fillRect(x + 4, y + 22, 4, 8)
    }

    function drawCenterText(text: string, y: number, size: number, color: string) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${size}px ${PIXEL_FONT}`
      ctx.fillStyle = '#000'
      ctx.fillText(text, W / 2 + 2, y + 2)
      ctx.fillStyle = color
      ctx.fillText(text, W / 2, y)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    function draw() {
      ctx.save()
      ctx.fillStyle = '#58c866'
      ctx.fillRect(0, 0, W, H)
      juice.applyShake(ctx)
      const lo = Math.floor(G.cam) - 1
      const hi = Math.ceil(G.cam + H / TILE) + 1

      // suelo: de cerca a lejos (los bordes elevados tapan la fila de abajo)
      for (let r = lo; r <= hi; r++) {
        const row = rows.get(r)
        if (row) drawGround(row, rowTop(r))
      }
      // sombra de la sombra de zona de peligro de tren (resplandor)
      // objetos: de lejos a cerca
      const vrow = P.hopping ? lerp(P.frow, P.trow, P.hopT) : P.row
      const playerDrawRow = G.dead ? G.deathRow : Math.round(vrow)
      for (let r = hi; r >= lo; r--) {
        const row = rows.get(r)
        if (!row) continue
        const y = rowTop(r)
        if (row.kind === 'grass') {
          for (let c = 0; c < COLS; c++) if (row.obst[c] > 0) drawTree(row.obst[c], colX(c), y, hash(r, c))
          if (row.coin >= 0 && !row.coinTaken) drawCoin(colX(row.coin), y, row.r + row.coin)
        } else if (row.kind === 'road') {
          for (const v of row.vehicles) if (v.x + v.w / 2 > -4 && v.x - v.w / 2 < W + 4) drawVehicle(v, row.dir, y)
          if (row.coin >= 0 && !row.coinTaken) drawCoin(colX(row.coin), y, row.r)
        } else if (row.kind === 'river') {
          if (!row.lily) {
            for (const p of row.plats) if (p.x + p.w / 2 > -4 && p.x - p.w / 2 < W + 4) drawPlatform(p, y)
          } else if (row.coin >= 0 && !row.coinTaken) drawCoin(colX(row.coin), y, row.r)
        } else {
          drawSignal(row, y)
          if (row.rs === 2) drawTrain(row, y)
        }
        if (r === playerDrawRow) drawPlayer()
      }

      // águila (aviso por abajo y captura)
      if (!G.dead && G.moved && G.phase === 'playing') {
        const lvl = clamp(1 - (vrow - G.cam + 0.45) / 2.2, 0, 1)
        if (lvl > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(G.t * 10)
          const grad = ctx.createLinearGradient(0, H, 0, H - 120)
          grad.addColorStop(0, `rgba(255,60,60,${(0.45 * lvl * (0.6 + pulse * 0.4)).toFixed(3)})`)
          grad.addColorStop(1, 'rgba(255,60,60,0)')
          ctx.fillStyle = grad
          ctx.fillRect(0, H - 120, W, 120)
          ctx.globalAlpha = 0.35 * lvl
          ctx.fillStyle = '#000'
          const ex = W / 2 + Math.sin(G.t * 2) * 80
          const ey = H - 22 - lvl * 22
          ctx.beginPath()
          ctx.moveTo(ex - 70, ey - 8)
          ctx.lineTo(ex, ey + 8)
          ctx.lineTo(ex + 70, ey - 8)
          ctx.lineTo(ex + 14, ey + 22)
          ctx.lineTo(ex - 14, ey + 22)
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      if (G.dead && G.cause === 'eagle') {
        const k = G.deathT
        const px = G.deathX
        const py = rowTop(G.deathRow) + TILE - 10
        let ey: number
        if (k < 0.5) ey = lerp(-70, py - 44, (k / 0.5) * (k / 0.5))
        else ey = lerp(py - 44, -120, ((k - 0.5) / 0.9) ** 1.6)
        drawEagle(px, ey, G.t)
      }

      // anillos de agua
      for (const rg of rings) {
        if (rg.t < 0) continue
        const k = rg.t / 0.7
        if (k > 1) continue
        ctx.globalAlpha = 1 - k
        ctx.strokeStyle = '#e8f7ff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(rg.x, rg.y, 6 + k * 22, 3 + k * 10, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      juice.drawParticles(ctx)
      juice.drawTexts(ctx)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (G.paused) {
        ctx.fillStyle = 'rgba(6,6,12,0.7)'
        ctx.fillRect(0, 0, W, H)
        drawCenterText('PAUSA', H / 2 - 12, 22, ACCENT)
        drawCenterText('Pulsa P para seguir', H / 2 + 22, 9, '#ffffff')
      }
    }

    function drawPlayer() {
      const t = G.t
      if (G.dead) {
        const x = G.deathX
        const y = rowTop(G.deathRow)
        const k = G.deathT
        if (G.cause === 'car' || G.cause === 'train') {
          const a = clamp(k / 0.08, 0, 1)
          drawChick(x, y + TILE - 8, lerp(1, 1.6, a), lerp(1, 0.22, a), 0, P.face, false)
          // ojitos de X
          ctx.fillStyle = '#16161f'
          ctx.fillRect(x - 8, y + TILE - 14, 3, 1)
          ctx.fillRect(x + 5, y + TILE - 14, 3, 1)
        } else if (G.cause === 'water' || G.cause === 'drift') {
          const a = clamp(k / 0.7, 0, 1)
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, y - 40, W, 40 + TILE - 6 + 2)
          ctx.clip()
          drawChick(x, y + TILE - 8 + a * 26, 1 - a * 0.3, 1 - a * 0.2, Math.max(0, Math.sin(Math.min(1, k / 0.25) * Math.PI) * 10), P.face, false, 1 - a)
          ctx.restore()
        } else if (G.cause === 'eagle') {
          if (k < 0.5) drawChick(x, y + TILE - 8, 1, 1, 0, P.face, false)
          else {
            const py = rowTop(G.deathRow) + TILE - 10
            const ey = lerp(py - 44, -120, ((k - 0.5) / 0.9) ** 1.6)
            drawChick(x, ey + 56, 0.9, 1.1, 0, 'down', false)
          }
        }
        return
      }
      const x = P.hopping ? lerp(P.fx, P.tx, P.hopT) : P.x
      const vr = P.hopping ? lerp(P.frow, P.trow, P.hopT) : P.row
      const row = getRow(P.hopping ? (P.hopT > 0.5 ? P.trow : P.frow) : P.row)
      let feet = rowTop(vr) + TILE - 8
      if (row.kind === 'river' && !P.hopping) feet += Math.sin(t * 2.2 + x * 0.03) * 1.2 + (row.lily ? 0 : -1)
      const hopH = P.hopping ? Math.sin(P.hopT * Math.PI) * 15 : 0
      let sx = 1
      let sy = 1
      if (P.hopping) {
        const s = Math.sin(P.hopT * Math.PI)
        sx = 1 - 0.14 * s
        sy = 1 + 0.2 * s
      } else if (P.land > 0) {
        sx = 1 + 0.26 * P.land
        sy = 1 - 0.26 * P.land
      } else {
        sy = 1 + Math.sin(t * 4) * 0.02
      }
      let bx = 0
      if (P.bump > 0) bx = (P.face === 'left' ? -1 : P.face === 'right' ? 1 : 0) * Math.sin((P.bump / 0.16) * Math.PI) * 4
      drawChick(x + bx, feet, sx, sy, hopH, P.face, P.blink < 0 && !P.hopping)
    }

    /* ---------------- bucle ---------------- */
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const autoPause = () => {
      if (G.phase === 'playing' && !G.dead) G.paused = true
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
  }, [])

  /* ---------------- gestos sobre el canvas (tipo Subway Surfers) ---------------- */
  // Deslizar izq/der = cambiar de carril, arriba = avanzar, abajo = retroceder, toque = avanzar.
  // Cada gesto manda UN movimiento en cuanto pasa el umbral (sin esperar a soltar el dedo).
  const SWIPE_PX = 22
  const fireDir = (d: Dir4) => {
    virtualPress(d)
    virtualRelease(d)
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    touch.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, fired: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const t = touch.current
    if (!t || t.id !== e.pointerId || t.fired) return
    const dx = e.clientX - t.sx
    const dy = e.clientY - t.sy
    if (Math.hypot(dx, dy) < SWIPE_PX) return
    fireDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
    t.fired = true
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const t = touch.current
    if (!t || t.id !== e.pointerId) return
    touch.current = null
    if (!t.fired) fireDir('up')
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border border-white/10 bg-[#58c866] shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>FILAS {score}</span>
            <span className="text-amber-300">MONEDAS {coins}</span>
            <span className="text-white/60">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Cruza el Camino"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            touch.current = null
          }}
        />
        {phase === 'ready' && (
          <StartOverlay
            title="CRUZA EL CAMINO"
            accent={ACCENT}
            subtitle="Cruza carreteras, ríos y vías del tren. Junta monedas y no te quedes quieto: ¡el águila vigila!"
            hint="Flechas / WASD para saltar"
            touchHint="Desliza sobre el juego: ← → cambias de carril, ↑ avanzas. Toca para avanzar"
            onStart={() => ctl.current.begin()}
          />
        )}
        {phase === 'over' && result && (
          <GameOverOverlay
            title={CAUSE_TITLE[result.cause]}
            accent={ACCENT}
            score={result.score}
            best={result.best}
            newBest={result.newBest}
            stats={[
              { label: 'Filas', value: result.rows },
              { label: 'Monedas', value: result.coins },
              { label: 'Mejor racha', value: `x${result.chain}` },
            ]}
            onRestart={() => ctl.current.restart()}
            hint="o pulsa ESPACIO / una flecha"
            touchHint="o toca la pantalla"
          />
        )}
      </GameScreen>
    </div>
  )
}
