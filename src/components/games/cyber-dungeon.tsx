'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, renderScale } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { StartOverlay, GameOverOverlay, Hud } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

const GAME_ID = 'cyber-dungeon'
const ACCENT = '#fbbf24'
const CYAN = '#22d3ee'

const VW = 384
const VH = 432
const TILE = 24
const MW = 40
const MH = 40
const TAU = Math.PI * 2

/* ------------------------------------------------------------------ */
/*  Tipos                                                               */
/* ------------------------------------------------------------------ */

type EKind = 'skeleton' | 'archer' | 'slime' | 'slimeS' | 'bat' | 'boss'

interface Enemy {
  id: number
  kind: EKind
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  speed: number
  dmg: number
  kx: number
  ky: number
  flash: number
  awake: boolean
  room: number
  st: string
  t: number
  cd: number
  ang: number
  dx: number
  dy: number
  stun: number
  face: number
  wob: number
  hurtDone: boolean
  step: number
  resist: number
  dead: boolean
}

interface Proj {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  dmg: number
  life: number
  color: string
  kind: 'arrow' | 'orb'
}

interface Item {
  kind: 'coin' | 'gem' | 'potion' | 'key'
  x: number
  y: number
  vx: number
  vy: number
  t: number
}

interface Chest {
  x: number
  y: number
  open: boolean
  t: number
}

interface SlashFx {
  x: number
  y: number
  angle: number
  arc: number
  reach: number
  t: number
  max: number
  big: boolean
}

interface Ghosting {
  x: number
  y: number
  life: number
}

interface Room {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

interface Level {
  grid: Uint8Array
  rooms: Room[]
  roomOf: Uint8Array
  explored: Uint8Array
  vis: Uint8Array
  start: { x: number; y: number }
  exit: { x: number; y: number; locked: boolean; shown: boolean }
  torches: { tx: number; ty: number }[]
  boss: boolean
}

interface Player {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hp: number
  maxHp: number
  face: number
  dmg: number
  speed: number
  atkCd: number
  reach: number
  crit: number
  dashCd: number
  leech: number
  magnet: number
  swingT: number
  swingCdT: number
  swingId: number
  comboStep: number
  comboT: number
  swingAngle: number
  atkBuf: number
  dash: number
  dashI: number
  dashCdT: number
  dashAng: number
  dodgeUsed: boolean
  inv: number
  hasKey: boolean
  killsSinceHeal: number
  walk: number
  moving: boolean
  readyPing: number
}

type Phase = 'idle' | 'play' | 'pick' | 'trans' | 'dying' | 'over'

interface Upgrade {
  id: string
  name: string
  desc: string
  color: string
  apply: (p: Player) => void
}

const UPGRADES: Upgrade[] = [
  { id: 'dmg', name: 'Filo Cibernético', desc: '+1 de daño con la espada', color: '#f87171', apply: (p) => void (p.dmg += 1) },
  {
    id: 'hp',
    name: 'Núcleo Reforzado',
    desc: '+1 corazón y curación total',
    color: '#fb7185',
    apply: (p) => {
      p.maxHp += 2
      p.hp = p.maxHp
    },
  },
  { id: 'spd', name: 'Botas Turbo', desc: '+12% de velocidad', color: '#4ade80', apply: (p) => void (p.speed *= 1.12) },
  { id: 'atk', name: 'Reflejos', desc: 'Atacas 15% más rápido', color: '#facc15', apply: (p) => void (p.atkCd *= 0.85) },
  { id: 'reach', name: 'Hoja Larga', desc: '+20% de alcance', color: '#60a5fa', apply: (p) => void (p.reach *= 1.2) },
  { id: 'dash', name: 'Propulsores', desc: 'El dash recarga 25% más rápido', color: CYAN, apply: (p) => void (p.dashCd *= 0.75) },
  { id: 'crit', name: 'Ojo Lógico', desc: '+12% de golpe crítico', color: '#fde047', apply: (p) => void (p.crit += 0.12) },
  { id: 'leech', name: 'Vampirismo', desc: 'Curas medio corazón cada 6 bajas', color: '#e879f9', apply: (p) => void (p.leech += 1) },
  { id: 'magnet', name: 'Imán de Datos', desc: 'Atraes el botín desde más lejos', color: '#a78bfa', apply: (p) => void (p.magnet += 38) },
]

/* ------------------------------------------------------------------ */
/*  Utilidades                                                          */
/* ------------------------------------------------------------------ */

const rand = (n: number) => Math.floor(Math.random() * n)
const rr = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const angDiff = (a: number, b: number) => Math.abs((((a - b) % TAU) + TAU * 1.5) % TAU - Math.PI)
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000

function genRooms(floor: number): Level | null {
  const grid = new Uint8Array(MW * MH)
  const rooms: Room[] = []
  const target = Math.min(10, 7 + Math.floor(floor / 2))
  for (let i = 0; i < 500 && rooms.length < target; i++) {
    const w = 5 + rand(5)
    const h = 5 + rand(4)
    const x = 2 + rand(MW - w - 4)
    const y = 2 + rand(MH - h - 4)
    if (rooms.some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) })
  }
  if (rooms.length < 6) return null
  const carve = (x: number, y: number) => {
    if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) grid[y * MW + x] = 1
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y)
  const corridor = (a: Room, b: Room) => {
    let x = a.cx
    let y = a.cy
    const horizFirst = Math.random() < 0.5
    const hseg = (x2: number) => {
      const s = Math.sign(x2 - x) || 1
      while (x !== x2) {
        carve(x, y)
        carve(x, y + 1)
        x += s
      }
    }
    const vseg = (y2: number) => {
      const s = Math.sign(y2 - y) || 1
      while (y !== y2) {
        carve(x, y)
        carve(x + 1, y)
        y += s
      }
    }
    if (horizFirst) {
      hseg(b.cx)
      vseg(b.cy)
    } else {
      vseg(b.cy)
      hseg(b.cx)
    }
    carve(x, y)
    carve(x + 1, y)
    carve(x, y + 1)
    carve(x + 1, y + 1)
  }
  const joined = new Set<number>([0])
  while (joined.size < rooms.length) {
    let bi = -1
    let bj = -1
    let bd = Infinity
    for (const i of joined) {
      for (let j = 0; j < rooms.length; j++) {
        if (joined.has(j)) continue
        const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy)
        if (d < bd) {
          bd = d
          bi = i
          bj = j
        }
      }
    }
    corridor(rooms[bi], rooms[bj])
    joined.add(bj)
  }
  for (let k = 0; k < 2; k++) {
    const a = rand(rooms.length)
    const b = rand(rooms.length)
    if (a !== b) corridor(rooms[a], rooms[b])
  }
  return finishLevel(grid, rooms, false)
}

function genBoss(): Level {
  const grid = new Uint8Array(MW * MH)
  const start: Room = { x: 4, y: 27, w: 8, h: 8, cx: 8, cy: 31 }
  const arena: Room = { x: 14, y: 5, w: 22, h: 16, cx: 25, cy: 13 }
  const rooms = [start, arena]
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y * MW + x] = 1
  // pasillo ancho entre ambas
  for (let y = 20; y <= 27; y++) {
    grid[y * MW + 8] = 1
    grid[y * MW + 9] = 1
  }
  for (let x = 8; x <= 16; x++) {
    grid[19 * MW + x] = 1
    grid[20 * MW + x] = 1
  }
  // pilares
  const pillars: [number, number][] = [
    [arena.x + 4, arena.y + 3],
    [arena.x + arena.w - 6, arena.y + 3],
    [arena.x + 4, arena.y + arena.h - 5],
    [arena.x + arena.w - 6, arena.y + arena.h - 5],
  ]
  for (const [px, py] of pillars) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) grid[(py + y) * MW + px + x] = 0
  return finishLevel(grid, rooms, true) as Level
}

function bfs(grid: Uint8Array, sx: number, sy: number): Int16Array {
  const d = new Int16Array(MW * MH).fill(-1)
  const q: number[] = [sy * MW + sx]
  d[q[0]] = 0
  for (let i = 0; i < q.length; i++) {
    const idx = q[i]
    const x = idx % MW
    const y = (idx / MW) | 0
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue
      const ni = ny * MW + nx
      if (!grid[ni] || d[ni] >= 0) continue
      d[ni] = d[idx] + 1
      q.push(ni)
    }
  }
  return d
}

function finishLevel(grid: Uint8Array, rooms: Room[], boss: boolean): Level | null {
  const roomOf = new Uint8Array(MW * MH).fill(255)
  rooms.forEach((r, i) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (grid[y * MW + x]) roomOf[y * MW + x] = i
  })
  const s = rooms[0]
  const torches: { tx: number; ty: number }[] = []
  for (const r of rooms) {
    if (r.w >= 5) {
      torches.push({ tx: r.x + 1, ty: r.y - 1 }, { tx: r.x + r.w - 2, ty: r.y - 1 })
    }
    if (boss && r === rooms[1]) {
      for (let i = 3; i < r.w - 3; i += 4) torches.push({ tx: r.x + i, ty: r.y - 1 })
    }
  }
  return {
    grid,
    rooms,
    roomOf,
    explored: new Uint8Array(MW * MH),
    vis: new Uint8Array(MW * MH),
    start: { x: (s.cx + 0.5) * TILE, y: (s.cy + 0.5) * TILE },
    exit: { x: 0, y: 0, locked: true, shown: !boss },
    torches: torches.filter((t) => grid[(t.ty + 1) * MW + t.tx] === 1 && grid[t.ty * MW + t.tx] === 0),
    boss,
  }
}

const solid = (lv: Level, tx: number, ty: number) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || lv.grid[ty * MW + tx] === 0

/* ------------------------------------------------------------------ */
/*  Sprites                                                             */
/* ------------------------------------------------------------------ */

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']

function drawHeart(g: CanvasRenderingContext2D, x: number, y: number, fill: 0 | 1 | 2, pulse: number) {
  const s = 2
  for (let r = 0; r < HEART.length; r++) {
    for (let c = 0; c < HEART[r].length; c++) {
      if (HEART[r][c] !== 'X') continue
      const on = fill === 2 || (fill === 1 && c < 4)
      g.fillStyle = on ? (pulse > 0 && r < 2 ? '#ff9aa8' : r < 2 ? '#ff6b7e' : '#ef4458') : '#2b2438'
      g.fillRect(x + c * s, y + r * s, s, s)
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Componente                                                          */
/* ------------------------------------------------------------------ */

export default function CyberDungeon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest(GAME_ID) : 0))
  const [floor, setFloor] = useState(1)
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ floor: 1, kills: 0, combo: 0, chests: 0 })
  const [choices, setChoices] = useState<number[] | null>(null)
  const [sel, setSel] = useState(0)
  const beginRef = useRef<() => void>(() => {})
  const pickRef = useRef<(i: number) => void>(() => {})

  const begin = useCallback(() => beginRef.current(), [])
  const pick = useCallback((i: number) => pickRef.current(i), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = renderScale()
    canvas.width = Math.round(VW * dpr)
    canvas.height = Math.round(VH * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) return
    const ctx: CanvasRenderingContext2D = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    const pixelFont =
      getComputedStyle(canvas).getPropertyValue('--font-pixel').trim() || '"Press Start 2P", monospace'
    const font = (px: number) => `${px}px ${pixelFont}`

    const juice = new Juice(6)
    const mini = document.createElement('canvas')
    mini.width = MW
    mini.height = MH
    const miniCtx = mini.getContext('2d')

    /* ---------- estado ---------- */
    let enemyId = 1
    const newPlayer = (): Player => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 6,
      hp: 6,
      maxHp: 6,
      face: Math.PI / 2,
      dmg: 2,
      speed: 112,
      atkCd: 0.34,
      reach: 31,
      crit: 0.08,
      dashCd: 0.85,
      leech: 0,
      magnet: 34,
      swingT: 0,
      swingCdT: 0,
      swingId: 0,
      comboStep: 0,
      comboT: 0,
      swingAngle: 0,
      atkBuf: 0,
      dash: 0,
      dashI: 0,
      dashCdT: 0,
      dashAng: 0,
      dodgeUsed: false,
      inv: 0,
      hasKey: false,
      killsSinceHeal: 0,
      walk: 0,
      moving: false,
      readyPing: 0,
    })

    const G = {
      phase: 'idle' as Phase,
      time: 0,
      floor: 1,
      score: 0,
      kills: 0,
      chests: 0,
      combo: 0,
      comboT: 0,
      bestCombo: 0,
      paused: false,
      lv: genRooms(1) ?? genBoss(),
      P: newPlayer(),
      enemies: [] as Enemy[],
      projs: [] as Proj[],
      items: [] as Item[],
      chestsList: [] as Chest[],
      slashes: [] as SlashFx[],
      ghosts: [] as Ghosting[],
      camX: 0,
      camY: 0,
      transT: 0,
      transDone: false,
      banner: { text: '', sub: '', t: 0 },
      pickIdx: 0,
      pickLock: 0,
      pickChoices: [] as number[],
      slow: 0,
      flowDist: new Int16Array(MW * MH) as Int16Array,
      flowTx: -1,
      flowTy: -1,
      visT: 0,
      visTx: -99,
      visTy: -99,
      miniDirty: true,
      hintT: 0,
      deathT: 0,
      keyHintCd: 0,
      bossRef: null as Enemy | null,
      bossMax: 1,
      bossIntro: 0,
      msgT: 0,
    }

    const ui = { score: -1, floor: -1 }
    const syncUi = () => {
      if (ui.score !== G.score) {
        ui.score = G.score
        setScore(G.score)
      }
      if (ui.floor !== G.floor) {
        ui.floor = G.floor
        setFloor(G.floor)
      }
    }

    /* ---------- colisión / vista ---------- */
    const blocked = (x: number, y: number, r: number) => {
      const x0 = Math.floor((x - r) / TILE)
      const x1 = Math.floor((x + r) / TILE)
      const y0 = Math.floor((y - r) / TILE)
      const y1 = Math.floor((y + r) / TILE)
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(G.lv, tx, ty)) return true
      return false
    }
    const moveBy = (e: { x: number; y: number; r: number }, dx: number, dy: number) => {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6))
      const sx = dx / n
      const sy = dy / n
      let hit = false
      for (let i = 0; i < n; i++) {
        if (!blocked(e.x + sx, e.y, e.r)) e.x += sx
        else hit = true
        if (!blocked(e.x, e.y + sy, e.r)) e.y += sy
        else hit = true
      }
      return hit
    }
    const lineClear = (x0: number, y0: number, x1: number, y1: number) => {
      const d = Math.hypot(x1 - x0, y1 - y0)
      const n = Math.ceil(d / 8)
      for (let i = 1; i < n; i++) {
        const t = i / n
        if (solid(G.lv, Math.floor((x0 + (x1 - x0) * t) / TILE), Math.floor((y0 + (y1 - y0) * t) / TILE))) return false
      }
      return true
    }
    const tileLos = (x0: number, y0: number, x1: number, y1: number) => {
      // Bresenham en casillas; true si no hay muro antes de llegar (el destino puede ser muro)
      let dx = Math.abs(x1 - x0)
      const dy = Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx - dy
      let x = x0
      let y = y0
      dx = Math.abs(x1 - x0)
      for (let guard = 0; guard < 40; guard++) {
        if (x === x1 && y === y1) return true
        if ((x !== x0 || y !== y0) && solid(G.lv, x, y)) return false
        const e2 = 2 * err
        if (e2 > -dy) {
          err -= dy
          x += sx
        }
        if (e2 < dx) {
          err += dx
          y += sy
        }
      }
      return true
    }

    const updateVis = () => {
      const P = G.P
      const lv = G.lv
      const ptx = Math.floor(P.x / TILE)
      const pty = Math.floor(P.y / TILE)
      lv.vis.fill(0)
      const R = 8
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue
          const tx = ptx + dx
          const ty = pty + dy
          if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue
          if (tileLos(ptx, pty, tx, ty)) {
            const i = ty * MW + tx
            lv.vis[i] = 1
            if (!lv.explored[i]) {
              lv.explored[i] = 1
              G.miniDirty = true
            }
          }
        }
      }
      // habitación completa
      const ri = lv.roomOf[pty * MW + ptx]
      if (ri !== 255) {
        const r = lv.rooms[ri]
        for (let y = r.y - 1; y <= r.y + r.h; y++) {
          for (let x = r.x - 1; x <= r.x + r.w; x++) {
            if (x < 0 || y < 0 || x >= MW || y >= MH) continue
            const i = y * MW + x
            lv.vis[i] = 1
            if (!lv.explored[i]) {
              lv.explored[i] = 1
              G.miniDirty = true
            }
          }
        }
      }
    }

    const updateFlow = () => {
      const tx = Math.floor(G.P.x / TILE)
      const ty = Math.floor(G.P.y / TILE)
      if (tx === G.flowTx && ty === G.flowTy) return
      G.flowTx = tx
      G.flowTy = ty
      G.flowDist = bfs(G.lv.grid, tx, ty)
    }

    const chaseVec = (e: Enemy): { x: number; y: number } => {
      const P = G.P
      if (lineClear(e.x, e.y, P.x, P.y)) {
        const d = Math.hypot(P.x - e.x, P.y - e.y) || 1
        return { x: (P.x - e.x) / d, y: (P.y - e.y) / d }
      }
      const tx = Math.floor(e.x / TILE)
      const ty = Math.floor(e.y / TILE)
      const f = G.flowDist
      let best = f[ty * MW + tx] >= 0 ? f[ty * MW + tx] : 9999
      let bx = tx
      let by = ty
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const nx = tx + dx
        const ny = ty + dy
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue
        if (dx && dy && (solid(G.lv, tx + dx, ty) || solid(G.lv, tx, ty + dy))) continue
        const v = f[ny * MW + nx]
        if (v >= 0 && v < best) {
          best = v
          bx = nx
          by = ny
        }
      }
      const cx = (bx + 0.5) * TILE
      const cy = (by + 0.5) * TILE
      const d = Math.hypot(cx - e.x, cy - e.y) || 1
      return { x: (cx - e.x) / d, y: (cy - e.y) / d }
    }

    /* ---------- creación de nivel ---------- */
    const makeEnemy = (kind: EKind, x: number, y: number, room: number, floor: number): Enemy => {
      const sc = 1 + 0.14 * (floor - 1)
      const base = {
        skeleton: { hp: 4, r: 7, speed: 54, dmg: 2, resist: 1 },
        archer: { hp: 3, r: 7, speed: 46, dmg: 1, resist: 1 },
        slime: { hp: 5, r: 9, speed: 78, dmg: 1, resist: 0.8 },
        slimeS: { hp: 2, r: 5, speed: 92, dmg: 1, resist: 1.1 },
        bat: { hp: 2, r: 6, speed: 78, dmg: 1, resist: 1.5 },
        boss: { hp: 46, r: 17, speed: 52, dmg: 2, resist: 0.12 },
      }[kind]
      const hp = kind === 'boss' ? base.hp + 24 * (Math.floor(floor / 5) - 1) : Math.max(1, Math.round(base.hp * sc))
      return {
        id: enemyId++,
        kind,
        x,
        y,
        r: base.r,
        hp,
        maxHp: hp,
        speed: base.speed * (1 + 0.025 * (floor - 1)),
        dmg: base.dmg + (floor >= 7 && kind !== 'slimeS' && kind !== 'bat' ? 1 : 0),
        kx: 0,
        ky: 0,
        flash: 0,
        awake: false,
        room,
        st: kind === 'slime' || kind === 'slimeS' ? 'wait' : kind === 'bat' ? 'hover' : kind === 'archer' ? 'pos' : 'chase',
        t: rr(0.1, 0.8),
        cd: rr(0.8, 2),
        ang: Math.random() * TAU,
        dx: 0,
        dy: 0,
        stun: 0,
        face: 1,
        wob: Math.random() * 10,
        hurtDone: false,
        step: 0,
        resist: base.resist,
        dead: false,
      }
    }

    const randFloorIn = (lv: Level, r: Room, margin = 1) => {
      for (let i = 0; i < 30; i++) {
        const tx = r.x + margin + rand(Math.max(1, r.w - margin * 2))
        const ty = r.y + margin + rand(Math.max(1, r.h - margin * 2))
        if (!solid(lv, tx, ty)) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }
      }
      return { x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE }
    }

    const pickKind = (floor: number): EKind => {
      const bag: EKind[] = ['skeleton', 'skeleton', 'slime', 'slime', 'bat']
      if (floor >= 2) bag.push('archer', 'bat', 'skeleton')
      if (floor >= 3) bag.push('archer', 'slime')
      return bag[rand(bag.length)]
    }

    const buildFloor = (floor: number) => {
      G.floor = floor
      const lv = floor % 5 === 0 ? genBoss() : (genRooms(floor) ?? genRooms(floor) ?? genRooms(floor) ?? genBoss())
      G.lv = lv
      G.enemies = []
      G.projs = []
      G.items = []
      G.chestsList = []
      G.slashes = []
      G.ghosts = []
      G.bossRef = null
      G.flowTx = -1
      G.visTx = -99
      G.miniDirty = true
      G.hintT = floor === 1 ? 7 : 0
      const P = G.P
      P.x = lv.start.x
      P.y = lv.start.y
      P.vx = 0
      P.vy = 0
      P.hasKey = false
      P.dash = 0
      P.dashI = 0
      P.inv = 1.2
      const rooms = lv.rooms
      const sx = Math.floor(P.x / TILE)
      const sy = Math.floor(P.y / TILE)
      if (lv.boss) {
        const arena = rooms[1]
        lv.exit.x = (arena.cx + 0.5) * TILE
        lv.exit.y = (arena.cy + 0.5) * TILE
        lv.exit.locked = true
        const b = makeEnemy('boss', lv.exit.x, lv.exit.y - 40, 1, floor)
        b.awake = false
        b.st = 'sleep'
        G.enemies.push(b)
        G.bossRef = b
        G.bossMax = b.maxHp
        G.bossIntro = 0
        G.banner = { text: '¡JEFE!', sub: `Piso ${floor}`, t: 2.4 }
        return
      }
      const dist = bfs(lv.grid, sx, sy)
      const order = rooms
        .map((r, i) => ({ i, d: dist[r.cy * MW + r.cx] }))
        .filter((o) => o.i !== 0)
        .sort((a, b) => b.d - a.d)
      const exitRoom = order[0].i
      const keyRoom = order[Math.min(order.length - 1, 1 + rand(2))].i
      lv.exit.x = (rooms[exitRoom].cx + 0.5) * TILE
      lv.exit.y = (rooms[exitRoom].cy + 0.5) * TILE
      lv.exit.locked = true
      const kp = randFloorIn(lv, rooms[keyRoom], 1)
      G.items.push({ kind: 'key', x: kp.x, y: kp.y, vx: 0, vy: 0, t: 0 })
      // cofres
      const chestRooms = rooms
        .map((_, i) => i)
        .filter((i) => i !== 0 && i !== exitRoom)
        .sort(() => Math.random() - 0.5)
      const nChests = 1 + (floor >= 3 && Math.random() < 0.5 ? 1 : 0)
      for (let c = 0; c < nChests && c < chestRooms.length; c++) {
        const p = randFloorIn(lv, rooms[chestRooms[c]], 1)
        G.chestsList.push({ x: p.x, y: p.y, open: false, t: 0 })
      }
      // enemigos
      rooms.forEach((r, i) => {
        if (i === 0) return
        let n = 2 + rand(2) + Math.floor(floor / 3)
        if (i === keyRoom) n += 1
        n = Math.min(n, 7)
        for (let k = 0; k < n; k++) {
          const p = randFloorIn(lv, r, 1)
          if (Math.hypot(p.x - P.x, p.y - P.y) < 150) continue
          G.enemies.push(makeEnemy(pickKind(floor), p.x, p.y, i, floor))
        }
        if (Math.random() < 0.45) {
          const p = randFloorIn(lv, r, 1)
          G.items.push({ kind: Math.random() < 0.55 ? 'coin' : 'gem', x: p.x, y: p.y, vx: 0, vy: 0, t: 0 })
        }
        if (Math.random() < 0.3) {
          const p = randFloorIn(lv, r, 1)
          G.items.push({ kind: 'potion', x: p.x, y: p.y, vx: 0, vy: 0, t: 0 })
        }
      })
      G.banner = { text: `PISO ${floor}`, sub: floor === 1 ? 'Encuentra la llave' : 'Baja más profundo', t: 2.0 }
    }

    /* ---------- daño y efectos ---------- */
    const addScore = (n: number) => {
      G.score += n
    }

    const spawnDrop = (x: number, y: number, kind: Item['kind']) => {
      const a = Math.random() * TAU
      G.items.push({ kind, x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, t: 0 })
    }

    const killEnemy = (e: Enemy) => {
      if (e.dead) return
      e.dead = true
      G.kills++
      G.combo++
      G.comboT = 3.2
      G.bestCombo = Math.max(G.bestCombo, G.combo)
      const mult = Math.min(5, 1 + Math.floor(G.combo / 3))
      const basePts = { skeleton: 100, archer: 120, slime: 60, slimeS: 25, bat: 70, boss: 3000 }[e.kind]
      const pts = basePts * mult
      addScore(pts)
      const col = { skeleton: '#e5e7eb', archer: '#2dd4bf', slime: '#4ade80', slimeS: '#4ade80', bat: '#c084fc', boss: '#e879f9' }[e.kind]
      juice.text(e.x, e.y - e.r - 10, mult > 1 ? `+${pts} x${mult}` : `+${pts}`, mult > 2 ? '#fde047' : '#fbbf24', 9, 0.9)
      juice.burst(e.x, e.y, [col, '#ffffff', col], { count: e.kind === 'boss' ? 40 : 14, speed: 140, life: 0.5, size: 3, drag: 3 })
      if (e.kind !== 'boss') {
        juice.freeze(55)
        juice.shake(0.18)
        sfx.pop()
      }
      if (G.combo === 5 || G.combo === 10 || G.combo === 20) {
        juice.text(G.P.x, G.P.y - 34, `¡RACHA ${G.combo}!`, '#fde047', 10, 1.1)
        sfx.golden()
      }
      // botín
      if (e.kind !== 'boss') {
        const hurt = G.P.hp < G.P.maxHp
        if (Math.random() < 0.34) spawnDrop(e.x, e.y, Math.random() < 0.2 ? 'gem' : 'coin')
        if (Math.random() < (hurt ? 0.14 : 0.05)) spawnDrop(e.x, e.y, 'potion')
      }
      // vampirismo
      const P = G.P
      if (P.leech > 0) {
        P.killsSinceHeal++
        if (P.killsSinceHeal >= Math.max(2, 7 - P.leech)) {
          P.killsSinceHeal = 0
          if (P.hp < P.maxHp) {
            P.hp = Math.min(P.maxHp, P.hp + 1)
            juice.text(P.x, P.y - 24, '+1', '#f472b6', 9, 0.8)
          }
        }
      }
      if (e.kind === 'slime') {
        for (let i = 0; i < 2; i++) {
          const s = makeEnemy('slimeS', e.x + (i ? 6 : -6), e.y, e.room, G.floor)
          s.awake = true
          s.kx = (i ? 1 : -1) * 150
          s.ky = rr(-80, 80)
          s.st = 'hop'
          s.t = 0.3
          G.enemies.push(s)
        }
      }
      if (e.kind === 'boss') {
        juice.freeze(320)
        juice.shake(1)
        juice.flash('#ffffff', 0.7)
        sfx.bomb()
        for (let i = 0; i < 6; i++) {
          juice.burst(e.x + rr(-24, 24), e.y + rr(-24, 24), ['#e879f9', '#ffffff', '#22d3ee', '#fde047'], {
            count: 22,
            speed: 220,
            life: 0.9,
            size: 4,
          })
        }
        for (const o of G.enemies) {
          if (o !== e && !o.dead) {
            o.dead = true
            juice.burst(o.x, o.y, '#c084fc', { count: 10, speed: 100 })
          }
        }
        G.projs = []
        for (let i = 0; i < 14; i++) spawnDrop(e.x, e.y, i % 4 === 0 ? 'gem' : 'coin')
        spawnDrop(e.x, e.y, 'potion')
        spawnDrop(e.x, e.y, 'potion')
        G.lv.exit.shown = true
        G.lv.exit.locked = false
        G.chestsList.push({ x: e.x, y: e.y + 30, open: false, t: 0 })
        G.banner = { text: 'JEFE DERROTADO', sub: 'Abre el cofre y baja', t: 3 }
        G.bossRef = null
        sfx.levelUp()
      }
    }

    const hitEnemy = (e: Enemy, dmg: number, ang: number, big: boolean) => {
      const P = G.P
      const crit = Math.random() < P.crit
      let d = Math.round(dmg * (big ? 1.6 : 1) * (crit ? 2 : 1))
      if (e.kind === 'boss' && e.st === 'stun') d = Math.round(d * 1.5)
      d = Math.max(1, d)
      e.hp -= d
      e.flash = 0.12
      e.awake = true
      if (e.kind !== 'boss') {
        e.stun = big ? 0.4 : 0.22
        if (e.st === 'wind' || e.st === 'aim') {
          e.st = e.kind === 'skeleton' ? 'chase' : 'pos'
        }
      }
      const kb = (big ? 280 : 200) * e.resist
      e.kx += Math.cos(ang) * kb
      e.ky += Math.sin(ang) * kb
      juice.text(e.x + rr(-4, 4), e.y - e.r - 6, String(d), crit ? '#fde047' : '#ffffff', crit ? 12 : 9, 0.7)
      juice.burst(e.x, e.y, crit ? ['#fde047', '#ffffff'] : ['#fef3c7', '#fbbf24'], {
        count: crit ? 12 : 7,
        speed: 130,
        life: 0.3,
        size: 2.5,
        angle: ang,
        arc: 1.6,
      })
      if (e.hp <= 0) {
        killEnemy(e)
      } else {
        juice.freeze(crit || big ? 70 : 42)
        juice.shake(big ? 0.3 : crit ? 0.22 : 0.12)
      }
      if (crit) {
        tone({ freq: 1320, to: 1760, dur: 0.09, vol: 0.05, type: 'triangle' })
        juice.flash('#fde047', 0.12)
      }
      sfx.hit()
    }

    const gameOverNow = () => {
      G.phase = 'dying'
      G.deathT = 0
      juice.freeze(300)
      juice.shake(0.9)
      juice.flash('#ef4444', 0.5)
      sfx.crash()
      const P = G.P
      juice.burst(P.x, P.y, ['#60a5fa', '#e2e8f0', '#22d3ee', '#ef4444'], { count: 36, speed: 200, life: 0.9, size: 3.4 })
    }

    const hurtPlayer = (dmg: number, fromX: number, fromY: number): boolean => {
      const P = G.P
      if (G.phase !== 'play') return false
      if (P.dashI > 0) {
        if (!P.dodgeUsed) {
          P.dodgeUsed = true
          P.dashCdT = 0
          G.slow = 0.55
          addScore(40)
          juice.text(P.x, P.y - 22, '¡ESQUIVA!', CYAN, 10, 1)
          juice.burst(P.x, P.y, [CYAN, '#ffffff'], { count: 12, speed: 120, life: 0.4, size: 2.6 })
          tone({ freq: 700, to: 1400, dur: 0.14, vol: 0.05, type: 'sine' })
        }
        return false
      }
      if (P.inv > 0) return false
      P.hp -= dmg
      P.inv = 1.1
      G.combo = 0
      G.comboT = 0
      const a = Math.atan2(P.y - fromY, P.x - fromX)
      P.vx = Math.cos(a) * 190
      P.vy = Math.sin(a) * 190
      juice.freeze(95)
      juice.shake(0.6)
      juice.flash('#ef4444', 0.28)
      juice.text(P.x, P.y - 16, `-${dmg}`, '#fb7185', 11, 0.9)
      juice.burst(P.x, P.y, ['#ef4444', '#fb7185'], { count: 12, speed: 140, life: 0.4, size: 3 })
      sfx.hurt()
      if (P.hp <= 0) {
        P.hp = 0
        gameOverNow()
      }
      return true
    }

    /* ---------- jugador ---------- */
    const doSwing = () => {
      const P = G.P
      let aim = P.face
      // asistencia de puntería hacia enemigos cercanos al frente
      let bestE: Enemy | null = null
      let bestD = Infinity
      for (const e of G.enemies) {
        if (e.dead || e.st === 'sleep') continue
        const d = Math.hypot(e.x - P.x, e.y - P.y)
        if (d > P.reach + 34) continue
        const a = Math.atan2(e.y - P.y, e.x - P.x)
        if (angDiff(a, P.face) < 1.05 && d < bestD) {
          bestD = d
          bestE = e
        }
      }
      if (bestE) aim = Math.atan2(bestE.y - P.y, bestE.x - P.x)
      P.face = aim
      P.swingAngle = aim
      P.swingId++
      P.comboStep = P.comboT > 0 ? (P.comboStep + 1) % 3 : 0
      P.comboT = 0.75
      const big = P.comboStep === 2
      P.swingT = 0.17
      P.swingCdT = P.atkCd * (big ? 1.3 : 1)
      const arc = big ? 3.6 : 2.5
      const reach = P.reach * (big ? 1.25 : 1)
      P.vx += Math.cos(aim) * 80
      P.vy += Math.sin(aim) * 80
      if (big) {
        tone({ freq: 520, to: 160, dur: 0.14, vol: 0.06, type: 'sawtooth' })
        noise({ dur: 0.1, vol: 0.06, freq: 1800 })
      } else sfx.slash()
      let hits = 0
      for (const e of G.enemies) {
        if (e.dead || e.st === 'sleep') continue
        const dx = e.x - P.x
        const dy = e.y - P.y
        const d = Math.hypot(dx, dy)
        if (d > reach + e.r + 3) continue
        if (d > e.r + 8 && angDiff(Math.atan2(dy, dx), aim) > arc / 2) continue
        hits++
        hitEnemy(e, P.dmg, Math.atan2(dy, dx), big)
      }
      // desvío de proyectiles
      for (let i = G.projs.length - 1; i >= 0; i--) {
        const pr = G.projs[i]
        const dx = pr.x - P.x
        const dy = pr.y - P.y
        const d = Math.hypot(dx, dy)
        if (d < reach + 12 && angDiff(Math.atan2(dy, dx), aim) < arc / 2 + 0.3) {
          G.projs.splice(i, 1)
          addScore(20)
          juice.text(pr.x, pr.y - 8, 'DESVIO', CYAN, 8, 0.7)
          juice.burst(pr.x, pr.y, [CYAN, '#ffffff'], { count: 8, speed: 120, life: 0.3, size: 2.4 })
          tone({ freq: 1500, to: 2200, dur: 0.06, vol: 0.04, type: 'square' })
        }
      }
      G.slashes.push({ x: P.x, y: P.y, angle: aim, arc, reach, t: 0.17, max: 0.17, big })
      if (hits === 0) P.vx += Math.cos(aim) * 30
    }

    const updatePlayer = (dt: number) => {
      const P = G.P
      const keys = pressedRef.current
      const jp = justPressedRef.current
      let ix = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
      let iy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0)
      const mag = Math.hypot(ix, iy)
      if (mag > 0) {
        ix /= mag
        iy /= mag
      }
      P.swingT = Math.max(0, P.swingT - dt)
      P.swingCdT = Math.max(0, P.swingCdT - dt)
      P.comboT = Math.max(0, P.comboT - dt)
      P.inv = Math.max(0, P.inv - dt)
      P.dashI = Math.max(0, P.dashI - dt)
      P.atkBuf = Math.max(0, P.atkBuf - dt)
      const wasCd = P.dashCdT > 0
      P.dashCdT = Math.max(0, P.dashCdT - dt)
      if (wasCd && P.dashCdT <= 0) P.readyPing = 0.25
      P.readyPing = Math.max(0, P.readyPing - dt)

      if (mag > 0 && P.dash <= 0) P.face = Math.atan2(iy, ix)

      // dash
      if (jp.has('action2') && P.dashCdT <= 0 && P.dash <= 0) {
        P.dashAng = mag > 0 ? Math.atan2(iy, ix) : P.face
        P.dash = 0.17
        P.dashI = 0.3
        P.dodgeUsed = false
        P.dashCdT = P.dashCd
        P.swingT = 0
        juice.burst(P.x, P.y + 4, ['#94a3b8', '#e2e8f0'], { count: 8, speed: 70, life: 0.35, size: 3, angle: P.dashAng + Math.PI, arc: 1.2 })
        tone({ freq: 260, to: 720, dur: 0.12, vol: 0.05, type: 'sawtooth' })
        noise({ dur: 0.08, vol: 0.03, freq: 2200 })
      }
      // ataque
      if (jp.has('action')) P.atkBuf = 0.18
      if ((P.atkBuf > 0 || keys.has('action')) && P.swingCdT <= 0 && P.dash <= 0) {
        P.atkBuf = 0
        doSwing()
      }

      if (P.dash > 0) {
        P.dash -= dt
        P.vx = Math.cos(P.dashAng) * 440
        P.vy = Math.sin(P.dashAng) * 440
        if (Math.random() < 0.9) G.ghosts.push({ x: P.x, y: P.y, life: 0.22 })
        if (P.dash <= 0) {
          P.vx *= 0.3
          P.vy *= 0.3
        }
      } else {
        const sp = P.speed * (P.swingT > 0 ? 0.6 : 1)
        const k = Math.min(1, dt * 14)
        P.vx += (ix * sp - P.vx) * k
        P.vy += (iy * sp - P.vy) * k
      }
      moveBy(P, P.vx * dt, P.vy * dt)
      P.moving = Math.hypot(P.vx, P.vy) > 20
      if (P.moving) P.walk += dt * 9
    }

    /* ---------- enemigos ---------- */
    const shoot = (x: number, y: number, ang: number, speed: number, dmg: number, kind: 'arrow' | 'orb', color: string) => {
      G.projs.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        r: kind === 'orb' ? 5 : 3,
        dmg,
        life: 4,
        color,
        kind,
      })
    }

    const updateEnemy = (e: Enemy, dt: number) => {
      const P = G.P
      e.flash = Math.max(0, e.flash - dt)
      e.stun = Math.max(0, e.stun - dt)
      if (Math.abs(e.kx) + Math.abs(e.ky) > 4) {
        moveBy(e, e.kx * dt, e.ky * dt)
        const k = Math.max(0, 1 - 9 * dt)
        e.kx *= k
        e.ky *= k
      }
      const dx = P.x - e.x
      const dy = P.y - e.y
      const dist = Math.hypot(dx, dy)
      if (!e.awake) {
        if (e.st === 'sleep') return
        const pr = G.lv.roomOf[Math.floor(P.y / TILE) * MW + Math.floor(P.x / TILE)]
        if ((pr === e.room && pr !== 255) || (dist < 130 && lineClear(e.x, e.y, P.x, P.y))) e.awake = true
        else return
      }
      if (e.stun > 0 && e.kind !== 'boss') return
      e.face = dx >= 0 ? 1 : -1
      const touch = (extra = 0) => dist < e.r + P.r + extra
      switch (e.kind) {
        case 'skeleton': {
          if (e.st === 'chase') {
            const v = chaseVec(e)
            moveBy(e, v.x * e.speed * dt, v.y * e.speed * dt)
            e.step += dt * 7
            if (dist < 30 && lineClear(e.x, e.y, P.x, P.y)) {
              e.st = 'wind'
              e.t = 0.46
              e.hurtDone = false
              tone({ freq: 400, dur: 0.05, vol: 0.03, type: 'square' })
            }
          } else if (e.st === 'wind') {
            e.t -= dt
            e.ang = Math.atan2(dy, dx)
            if (e.t <= 0) {
              e.st = 'atk'
              e.t = 0.17
              e.dx = Math.cos(e.ang)
              e.dy = Math.sin(e.ang)
              sfx.slash()
            }
          } else if (e.st === 'atk') {
            e.t -= dt
            moveBy(e, e.dx * 210 * dt, e.dy * 210 * dt)
            if (!e.hurtDone && Math.hypot(P.x - (e.x + e.dx * 10), P.y - (e.y + e.dy * 10)) < 15) {
              e.hurtDone = true
              hurtPlayer(e.dmg, e.x, e.y)
            }
            if (e.t <= 0) {
              e.st = 'rec'
              e.t = 0.6
            }
          } else {
            e.t -= dt
            if (e.t <= 0) e.st = 'chase'
          }
          break
        }
        case 'archer': {
          const los = lineClear(e.x, e.y, P.x, P.y)
          e.cd -= dt
          if (e.st === 'pos') {
            let mx = 0
            let my = 0
            if (dist < 95) {
              mx = -dx / dist
              my = -dy / dist
            } else if (dist > 165 || !los) {
              const v = chaseVec(e)
              mx = v.x
              my = v.y
            } else {
              mx = (-dy / dist) * Math.sin(G.time * 0.8 + e.wob)
              my = (dx / dist) * Math.sin(G.time * 0.8 + e.wob)
            }
            moveBy(e, mx * e.speed * dt, my * e.speed * dt)
            e.step += dt * 6
            if (los && dist < 230 && e.cd <= 0) {
              e.st = 'aim'
              e.t = 0.65
              e.ang = Math.atan2(dy, dx)
              tone({ freq: 300, to: 600, dur: 0.2, vol: 0.03, type: 'triangle' })
            }
          } else {
            e.t -= dt
            if (e.t > 0.25) e.ang = Math.atan2(dy, dx)
            if (e.t <= 0) {
              shoot(e.x, e.y, e.ang, 150 + G.floor * 3, e.dmg, 'arrow', '#5eead4')
              sfx.shoot()
              e.st = 'pos'
              e.cd = rr(1.7, 2.6)
            }
          }
          break
        }
        case 'slime':
        case 'slimeS': {
          if (e.st === 'wait') {
            e.t -= dt
            if (e.t <= 0) {
              const v = chaseVec(e)
              e.dx = v.x + rr(-0.25, 0.25)
              e.dy = v.y + rr(-0.25, 0.25)
              e.st = 'hop'
              e.t = 0.38
            }
          } else {
            e.t -= dt
            const k = Math.sin((Math.max(0, e.t) / 0.38) * Math.PI)
            moveBy(e, e.dx * e.speed * (0.4 + k) * dt, e.dy * e.speed * (0.4 + k) * dt)
            if (e.t <= 0) {
              e.st = 'wait'
              e.t = e.kind === 'slimeS' ? rr(0.25, 0.45) : rr(0.4, 0.7)
            }
          }
          if (touch(2)) hurtPlayer(e.dmg, e.x, e.y)
          break
        }
        case 'bat': {
          e.cd -= dt
          e.step += dt * 14
          if (e.st === 'hover') {
            e.ang += dt * 2.6
            const tx = P.x + Math.cos(e.ang) * 66
            const ty = P.y + Math.sin(e.ang) * 66
            const d = Math.hypot(tx - e.x, ty - e.y) || 1
            const wob = Math.sin(G.time * 7 + e.wob) * 0.5
            moveBy(
              e,
              ((tx - e.x) / d + Math.cos(e.ang + 1.57) * wob) * e.speed * dt,
              ((ty - e.y) / d + Math.sin(e.ang + 1.57) * wob) * e.speed * dt,
            )
            if (e.cd <= 0 && dist < 170) {
              e.st = 'dive'
              e.t = 0.55
              const a = Math.atan2(dy, dx)
              e.dx = Math.cos(a)
              e.dy = Math.sin(a)
              e.flash = 0.18
              tone({ freq: 900, to: 400, dur: 0.12, vol: 0.03, type: 'sawtooth' })
            }
          } else {
            e.t -= dt
            const hit = moveBy(e, e.dx * e.speed * 2.6 * dt, e.dy * e.speed * 2.6 * dt)
            if (e.t <= 0 || hit) {
              e.st = 'hover'
              e.cd = rr(1.6, 2.8)
            }
          }
          if (touch(1)) hurtPlayer(e.dmg, e.x, e.y)
          break
        }
        case 'boss': {
          updateBoss(e, dt, dx, dy, dist)
          break
        }
      }
    }

    const bossNext = (e: Enemy) => {
      const frac = e.hp / e.maxHp
      const opts = ['ring', 'charge', 'fan']
      if (frac < 0.65) opts.push('summon', 'ring')
      if (frac < 0.35) opts.push('charge', 'fan')
      const pick = opts[rand(opts.length)]
      if (pick === 'ring') {
        e.st = 'ring_wind'
        e.t = 0.8
        e.ang = 0
      } else if (pick === 'charge') {
        e.st = 'charge_wind'
        e.t = frac < 0.35 ? 0.7 : 0.95
      } else if (pick === 'fan') {
        e.st = 'fan'
        e.t = 0.6
        e.cd = 0
        e.step = 3
      } else {
        e.st = 'summon'
        e.t = 0.9
      }
    }

    const updateBoss = (e: Enemy, dt: number, dx: number, dy: number, dist: number) => {
      const P = G.P
      const frac = e.hp / e.maxHp
      const rage = frac < 0.35 ? 1.25 : 1
      e.wob += dt
      switch (e.st) {
        case 'walk': {
          const v = chaseVec(e)
          moveBy(e, v.x * e.speed * rage * dt, v.y * e.speed * rage * dt)
          e.t -= dt
          if (e.t <= 0) bossNext(e)
          break
        }
        case 'ring_wind': {
          e.t -= dt
          if (e.t <= 0) {
            e.st = 'ring'
            e.step = 3
            e.cd = 0
          }
          break
        }
        case 'ring': {
          e.cd -= dt
          if (e.cd <= 0) {
            const n = frac < 0.5 ? 16 : 12
            const off = e.step * 0.26
            for (let i = 0; i < n; i++) shoot(e.x, e.y, off + (i / n) * TAU, 105 * rage, 1, 'orb', '#e879f9')
            tone({ freq: 160, to: 90, dur: 0.2, vol: 0.06, type: 'sawtooth' })
            juice.shake(0.2)
            e.step--
            e.cd = 0.5
            if (e.step <= 0) {
              e.st = 'walk'
              e.t = 1.0
            }
          }
          break
        }
        case 'fan': {
          e.t -= dt
          if (e.t <= 0 && e.step > 0) {
            const a = Math.atan2(dy, dx)
            for (let i = -2; i <= 2; i++) shoot(e.x, e.y, a + i * 0.2, 150 * rage, 1, 'orb', '#fb7185')
            sfx.shoot()
            e.step--
            e.t = 0.42
          }
          if (e.step <= 0) {
            e.st = 'walk'
            e.t = 1.0
          }
          break
        }
        case 'charge_wind': {
          e.t -= dt
          e.ang = Math.atan2(dy, dx)
          if (e.t <= 0) {
            e.st = 'charge'
            e.t = 1.1
            e.dx = Math.cos(e.ang)
            e.dy = Math.sin(e.ang)
            tone({ freq: 140, to: 320, dur: 0.3, vol: 0.07, type: 'sawtooth' })
          }
          break
        }
        case 'charge': {
          e.t -= dt
          const hit = moveBy(e, e.dx * 330 * rage * dt, e.dy * 330 * rage * dt)
          if (Math.random() < 0.7) juice.burst(e.x, e.y, ['#e879f9', '#7c3aed'], { count: 1, speed: 30, life: 0.3, size: 4 })
          if (dist < e.r + P.r + 2) hurtPlayer(2, e.x, e.y)
          if (hit || e.t <= 0) {
            e.st = 'stun'
            e.t = 1.3
            if (hit) {
              juice.shake(0.7)
              juice.freeze(80)
              sfx.crash()
              juice.burst(e.x, e.y, ['#a78bfa', '#ffffff'], { count: 20, speed: 180, life: 0.5, size: 3 })
              juice.text(e.x, e.y - 30, '¡ATACALO!', '#fde047', 9, 1)
            }
          }
          break
        }
        case 'stun': {
          e.t -= dt
          if (e.t <= 0) {
            e.st = 'walk'
            e.t = 0.8
          }
          break
        }
        case 'summon': {
          e.t -= dt
          if (e.t <= 0) {
            const alive = G.enemies.filter((o) => !o.dead && o.kind !== 'boss').length
            if (alive < 5) {
              for (let i = 0; i < 2; i++) {
                const a = Math.random() * TAU
                const m = makeEnemy(i ? 'bat' : 'skeleton', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, 1, G.floor)
                if (blocked(m.x, m.y, m.r)) {
                  m.x = e.x
                  m.y = e.y
                }
                m.awake = true
                G.enemies.push(m)
                juice.burst(m.x, m.y, ['#e879f9', '#ffffff'], { count: 10, speed: 90, life: 0.4, size: 3 })
              }
              sfx.warp()
            }
            e.st = 'walk'
            e.t = 1.2
          }
          break
        }
        default:
          break
      }
      if ((e.st === 'walk' || e.st === 'stun') && dist < e.r + P.r + 1) hurtPlayer(1, e.x, e.y)
    }

    /* ---------- bucle de simulación ---------- */
    const openChest = (c: Chest) => {
      c.open = true
      G.chests++
      sfx.golden()
      juice.burst(c.x, c.y, ['#fde047', '#ffffff', '#fbbf24'], { count: 22, speed: 150, life: 0.6, size: 3.4, gravity: 120 })
      juice.flash('#fde047', 0.2)
      const ids = UPGRADES.map((_, i) => i).sort(() => Math.random() - 0.5)
      G.pickChoices = ids.slice(0, 3)
      G.pickIdx = 0
      G.pickLock = 0.7
      G.phase = 'pick'
      setSel(0)
      setChoices(G.pickChoices)
    }

    const startTransition = () => {
      G.phase = 'trans'
      G.transT = 0
      G.transDone = false
      addScore(250 + G.floor * 50)
      sfx.warp()
    }

    const updatePlay = (dt: number) => {
      const P = G.P
      const lv = G.lv
      G.time += dt
      if (G.slow > 0) G.slow -= dt
      updatePlayer(dt)
      if (G.phase !== 'play') return
      updateFlow()

      // enemigos
      for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt)
      // separación
      const list = G.enemies
      for (let i = 0; i < list.length; i++) {
        const a = list[i]
        if (a.dead || !a.awake) continue
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j]
          if (b.dead || !b.awake) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.hypot(dx, dy)
          const min = a.r + b.r - 2
          if (d < min && d > 0.01) {
            const push = (min - d) * 0.5
            if (a.kind !== 'boss') moveBy(a, (-dx / d) * push, (-dy / d) * push)
            if (b.kind !== 'boss') moveBy(b, (dx / d) * push, (dy / d) * push)
          }
        }
      }
      if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead)

      // proyectiles
      for (let i = G.projs.length - 1; i >= 0; i--) {
        const pr = G.projs[i]
        pr.x += pr.vx * dt
        pr.y += pr.vy * dt
        pr.life -= dt
        let rm = pr.life <= 0
        if (!rm && solid(lv, Math.floor(pr.x / TILE), Math.floor(pr.y / TILE))) {
          rm = true
          juice.burst(pr.x, pr.y, pr.color, { count: 4, speed: 60, life: 0.25, size: 2 })
        }
        if (!rm && Math.hypot(P.x - pr.x, P.y - pr.y) < P.r + pr.r) {
          if (P.dashI > 0 || P.inv <= 0) {
            hurtPlayer(pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05)
            if (P.dashI <= 0) rm = true
          }
        }
        if (rm) G.projs.splice(i, 1)
        if (G.phase !== 'play') return
      }

      // objetos
      for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i]
        it.t += dt
        if (Math.abs(it.vx) + Math.abs(it.vy) > 3) {
          const nx = it.x + it.vx * dt
          const ny = it.y + it.vy * dt
          if (!solid(lv, Math.floor(nx / TILE), Math.floor(it.y / TILE))) it.x = nx
          if (!solid(lv, Math.floor(it.x / TILE), Math.floor(ny / TILE))) it.y = ny
          const k = Math.max(0, 1 - 6 * dt)
          it.vx *= k
          it.vy *= k
        }
        const dx = P.x - it.x
        const dy = P.y - it.y
        const d = Math.hypot(dx, dy)
        const canTake = it.kind !== 'potion' || P.hp < P.maxHp
        if (canTake && it.t > 0.25 && d < P.magnet && it.kind !== 'key') {
          const sp = 190 * dt
          it.x += (dx / d) * sp
          it.y += (dy / d) * sp
        }
        if (d < 14 && canTake && it.t > 0.15) {
          if (it.kind === 'coin') {
            addScore(25)
            sfx.eat()
            juice.text(it.x, it.y - 8, '+25', '#fbbf24', 8, 0.6)
          } else if (it.kind === 'gem') {
            addScore(150)
            sfx.golden()
            juice.text(it.x, it.y - 8, '+150', '#38bdf8', 9, 0.8)
            juice.burst(it.x, it.y, ['#38bdf8', '#ffffff'], { count: 8, speed: 90, life: 0.4, size: 2.6 })
          } else if (it.kind === 'potion') {
            P.hp = Math.min(P.maxHp, P.hp + 2)
            sfx.potion()
            juice.text(it.x, it.y - 10, '+1 CORAZON', '#4ade80', 8, 1)
            juice.burst(it.x, it.y, ['#4ade80', '#ffffff'], { count: 10, speed: 80, life: 0.5, size: 2.8 })
          } else {
            P.hasKey = true
            sfx.key()
            juice.text(it.x, it.y - 12, '¡LLAVE!', '#fde047', 10, 1.3)
            juice.burst(it.x, it.y, ['#fde047', '#ffffff'], { count: 16, speed: 120, life: 0.6, size: 3 })
            juice.flash('#fde047', 0.15)
            G.banner = { text: 'LLAVE OBTENIDA', sub: 'Ve a la escalera', t: 1.8 }
          }
          G.items.splice(i, 1)
        }
      }

      // cofres
      for (const c of G.chestsList) {
        c.t += dt
        if (!c.open && Math.hypot(P.x - c.x, P.y - c.y) < 18) {
          openChest(c)
          return
        }
      }

      // escalera / puerta
      const ex = lv.exit
      if (ex.shown) {
        const d = Math.hypot(P.x - ex.x, P.y - ex.y)
        if (ex.locked) {
          if (d < 36) {
            if (P.hasKey) {
              ex.locked = false
              P.hasKey = false
              sfx.key()
              juice.text(ex.x, ex.y - 22, '¡PUERTA ABIERTA!', '#4ade80', 9, 1.4)
              juice.burst(ex.x, ex.y, ['#4ade80', '#ffffff'], { count: 20, speed: 120, life: 0.6, size: 3 })
              juice.shake(0.3)
            } else if (G.keyHintCd <= 0) {
              G.keyHintCd = 2
              juice.text(ex.x, ex.y - 22, 'NECESITAS LA LLAVE', '#fca5a5', 8, 1.3)
              tone({ freq: 160, dur: 0.12, vol: 0.04, type: 'square' })
            }
          }
        } else if (d < 12) {
          startTransition()
        }
      }
      G.keyHintCd = Math.max(0, G.keyHintCd - dt)

      // combo
      if (G.comboT > 0) {
        G.comboT -= dt
        if (G.comboT <= 0) G.combo = 0
      }

      // jefe: despertar y barra
      if (G.bossRef && G.bossRef.st === 'sleep') {
        const b = G.bossRef
        if (Math.hypot(P.x - b.x, P.y - b.y) < 190) {
          b.st = 'walk'
          b.t = 1.2
          b.awake = true
          juice.shake(0.6)
          juice.flash('#a78bfa', 0.3)
          tone({ freq: 90, to: 50, dur: 0.7, vol: 0.09, type: 'sawtooth' })
          G.banner = { text: 'NUCLEO CENTINELA', sub: 'Esquiva y golpea tras su embestida', t: 2.4 }
        }
      }
    }

    /* ---------- fases ---------- */
    const beginGame = () => {
      juice.reset()
      G.P = newPlayer()
      G.score = 0
      G.kills = 0
      G.chests = 0
      G.combo = 0
      G.comboT = 0
      G.bestCombo = 0
      G.paused = false
      G.slow = 0
      G.time = 0
      G.msgT = 0
      buildFloor(1)
      updateVis()
      G.camX = clamp(G.P.x - VW / 2, 0, MW * TILE - VW)
      G.camY = clamp(G.P.y - VH / 2, 0, MH * TILE - VH)
      G.phase = 'play'
      ui.score = -1
      ui.floor = -1
      syncUi()
      setOver(false)
      setNewBest(false)
      setChoices(null)
      setStarted(true)
      sfx.start()
    }
    beginRef.current = beginGame

    pickRef.current = (i: number) => {
      if (G.phase !== 'pick') return
      const idx = G.pickChoices[i]
      if (idx === undefined) return
      const up = UPGRADES[idx]
      up.apply(G.P)
      sfx.levelUp()
      juice.text(G.P.x, G.P.y - 26, up.name.toUpperCase(), up.color, 9, 1.6)
      juice.burst(G.P.x, G.P.y, [up.color, '#ffffff'], { count: 22, speed: 140, life: 0.6, size: 3 })
      juice.flash(up.color, 0.2)
      G.phase = 'play'
      setChoices(null)
      justPressedRef.current.clear()
    }

    const finishGame = () => {
      G.phase = 'over'
      const isNew = saveBest(GAME_ID, G.score)
      setNewBest(isNew)
      setBest((b) => Math.max(b, G.score))
      setStats({ floor: G.floor, kills: G.kills, combo: G.bestCombo, chests: G.chests })
      syncUi()
      setOver(true)
      sfx.gameOver()
    }

    const update = (dtReal: number) => {
      const jp = justPressedRef.current
      if (G.phase === 'idle') {
        if (jp.has('action') || jp.has('action2')) beginGame()
        return
      }
      if (G.phase === 'over') {
        if (jp.has('action') || jp.has('action2')) beginGame()
        return
      }
      if (G.phase === 'pick') {
        G.pickLock = Math.max(0, G.pickLock - dtReal)
        juice.update(dtReal)
        G.time += dtReal
        if (jp.has('left') || jp.has('up')) {
          G.pickIdx = (G.pickIdx + 2) % 3
          setSel(G.pickIdx)
          sfx.bounce()
        }
        if (jp.has('right') || jp.has('down')) {
          G.pickIdx = (G.pickIdx + 1) % 3
          setSel(G.pickIdx)
          sfx.bounce()
        }
        if (G.pickLock <= 0 && (jp.has('action') || jp.has('action2'))) pickRef.current(G.pickIdx)
        return
      }
      if (jp.has('pause') && (G.phase === 'play' || G.paused)) {
        G.paused = !G.paused
        sfx.pause()
      }
      if (G.paused) return

      const dtJ = juice.update(dtReal)
      const scale = G.slow > 0 ? 0.4 : 1
      const dt = dtJ * scale

      if (G.banner.t > 0) G.banner.t -= dtReal
      if (G.hintT > 0 && G.phase === 'play') G.hintT -= dtReal

      switch (G.phase) {
        case 'play': {
          if (dt > 0) updatePlay(dt)
          break
        }
        case 'trans': {
          G.transT += dtReal
          if (!G.transDone && G.transT >= 0.45) {
            G.transDone = true
            G.P.hp = Math.min(G.P.maxHp, G.P.hp + 2)
            buildFloor(G.floor + 1)
            updateVis()
            G.camX = clamp(G.P.x - VW / 2, 0, MW * TILE - VW)
            G.camY = clamp(G.P.y - VH / 2, 0, MH * TILE - VH)
          }
          if (G.transT >= 1.0) {
            G.phase = 'play'
            sfx.levelUp()
          }
          break
        }
        case 'dying': {
          G.deathT += dtReal
          if (G.deathT >= 1.5) finishGame()
          break
        }
        default:
          break
      }

      // cámara y visibilidad
      const P = G.P
      {
        const tx = clamp(P.x - VW / 2 + Math.cos(P.face) * 14, 0, MW * TILE - VW)
        const ty = clamp(P.y - VH / 2 + Math.sin(P.face) * 14, 0, MH * TILE - VH)
        const k = Math.min(1, dtReal * 7)
        G.camX += (tx - G.camX) * k
        G.camY += (ty - G.camY) * k
        const ptx = Math.floor(P.x / TILE)
        const pty = Math.floor(P.y / TILE)
        G.visT -= dtReal
        if (ptx !== G.visTx || pty !== G.visTy || G.visT <= 0) {
          G.visTx = ptx
          G.visTy = pty
          G.visT = 0.15
          updateVis()
        }
      }
      for (let i = G.slashes.length - 1; i >= 0; i--) {
        G.slashes[i].t -= dtReal
        if (G.slashes[i].t <= 0) G.slashes.splice(i, 1)
      }
      for (let i = G.ghosts.length - 1; i >= 0; i--) {
        G.ghosts[i].life -= dtReal
        if (G.ghosts[i].life <= 0) G.ghosts.splice(i, 1)
      }
      syncUi()
    }

    /* ---------- dibujo ---------- */
    const drawTiles = () => {
      const lv = G.lv
      const x0 = Math.max(0, Math.floor(G.camX / TILE))
      const y0 = Math.max(0, Math.floor(G.camY / TILE))
      const x1 = Math.min(MW - 1, x0 + Math.ceil(VW / TILE) + 1)
      const y1 = Math.min(MH - 1, y0 + Math.ceil(VH / TILE) + 1)
      const tint = lv.boss ? 1 : 0
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const i = ty * MW + tx
          if (!lv.explored[i]) continue
          const lit = lv.vis[i] === 1
          const px = tx * TILE
          const py = ty * TILE
          const h = hash(tx, ty)
          if (lv.grid[i]) {
            const chk = (tx + ty) & 1
            ctx.fillStyle = lit ? (tint ? (chk ? '#33274a' : '#3a2d54') : chk ? '#312e4c' : '#383558') : tint ? '#1b1326' : '#191828'
            ctx.fillRect(px, py, TILE, TILE)
            ctx.fillStyle = lit ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)'
            ctx.fillRect(px, py, TILE, 1)
            ctx.fillRect(px, py, 1, TILE)
            if (solid(lv, tx, ty - 1)) {
              ctx.fillStyle = 'rgba(0,0,0,0.3)'
              ctx.fillRect(px, py, TILE, 7)
            }
            if (lit) {
              if (h % 13 === 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.25)'
                ctx.fillRect(px + 4 + (h % 9), py + 8, 7, 1)
                ctx.fillRect(px + 8 + (h % 5), py + 9, 1, 5)
              } else if (h % 29 === 0) {
                ctx.fillStyle = tint ? 'rgba(232,121,249,0.5)' : 'rgba(34,211,238,0.45)'
                ctx.fillRect(px + 10, py + 11, 3, 3)
              }
            }
          } else {
            const below = !solid(lv, tx, ty + 1)
            if (below) {
              ctx.fillStyle = lit ? (tint ? '#4a3468' : '#38335c') : '#1a1830'
              ctx.fillRect(px, py, TILE, TILE)
              ctx.fillStyle = lit ? '#242040' : '#100f20'
              ctx.fillRect(px, py + 8, TILE, 1)
              ctx.fillRect(px, py + 16, TILE, 1)
              ctx.fillRect(px + ((h % 2) * 12 + 6), py, 1, 8)
              ctx.fillRect(px + (((h >> 1) % 2) * 12 + 2), py + 9, 1, 7)
              ctx.fillRect(px + (((h >> 2) % 2) * 12 + 8), py + 17, 1, 7)
              ctx.fillStyle = lit ? (tint ? '#e879f9' : '#7c6df0') : '#2b2750'
              ctx.fillRect(px, py, TILE, 2)
            } else {
              ctx.fillStyle = lit ? '#0e0c1a' : '#0a0911'
              ctx.fillRect(px, py, TILE, TILE)
              if (lit) {
                ctx.fillStyle = '#1f1b36'
                if (!solid(lv, tx - 1, ty) && !solid(lv, tx - 1, ty + 1)) ctx.fillRect(px, py, 1, TILE)
                if (!solid(lv, tx + 1, ty)) ctx.fillRect(px + TILE - 1, py, 1, TILE)
              }
            }
          }
        }
      }
      // antorchas
      for (const t of lv.torches) {
        const i = t.ty * MW + t.tx
        if (!lv.explored[i] || t.ty * TILE + TILE < G.camY || t.ty * TILE > G.camY + VH) continue
        const lit = lv.vis[i] === 1
        const px = t.tx * TILE + TILE / 2
        const py = t.ty * TILE + 12
        ctx.fillStyle = '#44403c'
        ctx.fillRect(px - 1, py, 2, 6)
        if (lit) {
          const fl = Math.sin(G.time * 12 + t.tx) * 1.5
          ctx.fillStyle = lv.boss ? '#e879f9' : '#f59e0b'
          ctx.fillRect(px - 2, py - 4 + fl * 0.3, 4, 5)
          ctx.fillStyle = lv.boss ? '#fdf4ff' : '#fde68a'
          ctx.fillRect(px - 1, py - 2, 2, 3)
          const gr = ctx.createRadialGradient(px, py + 6, 2, px, py + 14, 46 + fl)
          gr.addColorStop(0, lv.boss ? 'rgba(232,121,249,0.28)' : 'rgba(251,191,36,0.26)')
          gr.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = gr
          ctx.fillRect(px - 50, py - 40, 100, 110)
        } else {
          ctx.fillStyle = '#57534e'
          ctx.fillRect(px - 2, py - 3, 4, 4)
        }
      }
    }

    const isVisPx = (x: number, y: number) => {
      const tx = Math.floor(x / TILE)
      const ty = Math.floor(y / TILE)
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false
      return G.lv.vis[ty * MW + tx] === 1
    }

    const shadow = (x: number, y: number, rx: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(x, y, rx, rx * 0.45, 0, 0, TAU)
      ctx.fill()
    }

    const drawStairs = () => {
      const ex = G.lv.exit
      if (!ex.shown || !G.lv.explored[Math.floor(ex.y / TILE) * MW + Math.floor(ex.x / TILE)]) return
      ctx.save()
      ctx.translate(Math.round(ex.x), Math.round(ex.y))
      ctx.fillStyle = '#0b0914'
      ctx.fillRect(-13, -13, 26, 26)
      ctx.fillStyle = ex.locked ? '#475569' : '#14532d'
      for (let i = 0; i < 4; i++) ctx.fillRect(-11 + i * 2, -11 + i * 6, 22 - i * 4, 5)
      ctx.strokeStyle = ex.locked ? '#94a3b8' : '#4ade80'
      ctx.lineWidth = 2
      ctx.strokeRect(-13, -13, 26, 26)
      if (ex.locked) {
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 2
        for (let x = -9; x <= 9; x += 6) {
          ctx.beginPath()
          ctx.moveTo(x, -12)
          ctx.lineTo(x, 12)
          ctx.stroke()
        }
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(-4, -3, 8, 7)
        ctx.strokeStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(0, -4, 3.5, Math.PI, 0)
        ctx.stroke()
      } else {
        const p = 0.5 + 0.5 * Math.sin(G.time * 5)
        ctx.fillStyle = `rgba(74,222,128,${0.15 + p * 0.2})`
        ctx.fillRect(-13, -13, 26, 26)
      }
      ctx.restore()
    }

    const drawItems = () => {
      for (const it of G.items) {
        if (!isVisPx(it.x, it.y)) continue
        const bob = Math.sin(G.time * 5 + it.x) * 2
        const x = Math.round(it.x)
        const y = Math.round(it.y + bob)
        shadow(x, Math.round(it.y) + 7, 5)
        if (it.kind === 'key') {
          const gr = ctx.createRadialGradient(x, y, 1, x, y, 20)
          gr.addColorStop(0, 'rgba(253,224,71,0.5)')
          gr.addColorStop(1, 'rgba(253,224,71,0)')
          ctx.fillStyle = gr
          ctx.fillRect(x - 20, y - 20, 40, 40)
          ctx.fillStyle = '#fde047'
          ctx.fillRect(x - 4, y - 7, 8, 8)
          ctx.fillStyle = '#0b0914'
          ctx.fillRect(x - 2, y - 5, 4, 4)
          ctx.fillStyle = '#fde047'
          ctx.fillRect(x - 1, y + 1, 3, 9)
          ctx.fillRect(x + 2, y + 5, 4, 2)
          ctx.fillRect(x + 2, y + 8, 3, 2)
        } else if (it.kind === 'coin') {
          const w = Math.abs(Math.cos(G.time * 6 + it.x)) * 6 + 1
          ctx.fillStyle = '#f59e0b'
          ctx.fillRect(Math.round(x - w), y - 5, Math.round(w * 2), 10)
          ctx.fillStyle = '#fde68a'
          ctx.fillRect(Math.round(x - w + 1), y - 4, Math.max(1, Math.round(w)), 3)
        } else if (it.kind === 'gem') {
          ctx.fillStyle = '#0891b2'
          ctx.beginPath()
          ctx.moveTo(x, y - 7)
          ctx.lineTo(x + 6, y)
          ctx.lineTo(x, y + 7)
          ctx.lineTo(x - 6, y)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#67e8f9'
          ctx.fillRect(x - 2, y - 4, 3, 3)
        } else {
          ctx.fillStyle = '#e5e7eb'
          ctx.fillRect(x - 2, y - 8, 4, 4)
          ctx.fillStyle = '#ef4458'
          ctx.fillRect(x - 5, y - 4, 10, 10)
          ctx.fillStyle = '#ff9aa8'
          ctx.fillRect(x - 3, y - 2, 2, 5)
        }
      }
      for (const c of G.chestsList) {
        if (!isVisPx(c.x, c.y) && !G.lv.explored[Math.floor(c.y / TILE) * MW + Math.floor(c.x / TILE)]) continue
        const x = Math.round(c.x)
        const y = Math.round(c.y)
        shadow(x, y + 9, 10)
        if (!c.open) {
          const gr = ctx.createRadialGradient(x, y, 2, x, y, 26)
          gr.addColorStop(0, 'rgba(251,191,36,0.35)')
          gr.addColorStop(1, 'rgba(251,191,36,0)')
          ctx.fillStyle = gr
          ctx.fillRect(x - 26, y - 26, 52, 52)
        }
        ctx.fillStyle = '#7c4a1d'
        ctx.fillRect(x - 10, y - 4, 20, 13)
        ctx.fillStyle = c.open ? '#3b2410' : '#9a5b26'
        ctx.fillRect(x - 10, c.open ? y - 11 : y - 8, 20, c.open ? 6 : 6)
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(x - 10, y - 1, 20, 2)
        ctx.fillRect(x - 2, y - 3, 4, 6)
        if (c.open) {
          ctx.fillStyle = '#fde68a'
          ctx.fillRect(x - 7, y - 3, 14, 3)
        }
      }
    }

    const drawEnemy = (e: Enemy) => {
      const x = Math.round(e.x)
      const y = Math.round(e.y)
      const white = e.flash > 0
      ctx.save()
      ctx.translate(x, y)
      if (e.kind === 'boss') {
        shadow(0, 20, 20)
        const stun = e.st === 'stun'
        const wind = e.st === 'charge_wind' || e.st === 'ring_wind' || e.st === 'summon'
        // anillos orbitando
        for (let i = 0; i < 4; i++) {
          const a = e.wob * (stun ? 0.6 : 2.2) + (i * TAU) / 4
          const rx = Math.cos(a) * 26
          const ry = Math.sin(a) * 26
          ctx.fillStyle = white ? '#fff' : '#a78bfa'
          ctx.fillRect(rx - 4, ry - 4, 8, 8)
        }
        ctx.fillStyle = white ? '#ffffff' : stun ? '#52525b' : wind ? '#c026d3' : '#7c3aed'
        ctx.beginPath()
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + Math.PI / 8
          ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18)
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = white ? '#fff' : '#e879f9'
        ctx.lineWidth = 2
        ctx.stroke()
        // ojo que sigue al jugador
        const ea = Math.atan2(G.P.y - e.y, G.P.x - e.x)
        ctx.fillStyle = '#0b0914'
        ctx.beginPath()
        ctx.arc(0, 0, 9, 0, TAU)
        ctx.fill()
        ctx.fillStyle = stun ? '#a1a1aa' : '#fde047'
        ctx.beginPath()
        ctx.arc(Math.cos(ea) * 3, Math.sin(ea) * 3, 5, 0, TAU)
        ctx.fill()
        ctx.fillStyle = '#0b0914'
        ctx.fillRect(Math.cos(ea) * 4 - 1, Math.sin(ea) * 4 - 1, 2, 2)
        ctx.restore()
        return
      }
      const sx = e.face
      if (e.kind === 'skeleton') {
        shadow(0, 9, 7)
        const bob = e.st === 'chase' ? Math.abs(Math.sin(e.step)) * 1.5 : 0
        const wind = e.st === 'wind'
        const body = white ? '#ffffff' : wind ? '#fecaca' : '#e5e7eb'
        ctx.translate(0, -bob)
        ctx.fillStyle = white ? '#fff' : '#94a3b8'
        ctx.fillRect(-4, 3, 3, 5)
        ctx.fillRect(1, 3, 3, 5)
        ctx.fillStyle = body
        ctx.fillRect(-5, -3, 10, 7)
        ctx.fillStyle = '#334155'
        ctx.fillRect(-4, -1, 8, 1)
        ctx.fillRect(-4, 2, 8, 1)
        ctx.fillStyle = body
        ctx.fillRect(-5, -11, 10, 8)
        ctx.fillStyle = '#0b0914'
        ctx.fillRect(-3, -9, 2, 3)
        ctx.fillRect(1, -9, 2, 3)
        ctx.fillStyle = wind ? '#ff3b3b' : '#ef4444'
        ctx.fillRect(-3, -8, 2, 2)
        ctx.fillRect(1, -8, 2, 2)
        // arma
        ctx.fillStyle = '#cbd5e1'
        if (wind) {
          ctx.fillRect(sx * 6 - 1, -17, 3, 11)
        } else if (e.st === 'atk') {
          ctx.fillRect(sx > 0 ? 5 : -15, -2, 10, 3)
        } else {
          ctx.fillRect(sx * 7 - 1, -4, 3, 9)
        }
        if (wind) {
          ctx.fillStyle = '#fca5a5'
          ctx.font = font(9)
          ctx.textAlign = 'center'
          ctx.fillText('!', 0, -17)
        }
      } else if (e.kind === 'archer') {
        shadow(0, 9, 7)
        const bob = e.st === 'pos' ? Math.abs(Math.sin(e.step)) * 1.2 : 0
        ctx.translate(0, -bob)
        const c = white ? '#ffffff' : '#0f766e'
        ctx.fillStyle = c
        ctx.fillRect(-5, -4, 10, 12)
        ctx.fillStyle = white ? '#fff' : '#14b8a6'
        ctx.fillRect(-5, -11, 10, 8)
        ctx.fillStyle = '#0b0914'
        ctx.fillRect(-3, -8, 6, 4)
        ctx.fillStyle = '#5eead4'
        ctx.fillRect(sx > 0 ? 0 : -3, -7, 3, 2)
        // arco
        const aim = e.st === 'aim'
        const a = aim ? e.ang : Math.atan2(G.P.y - e.y, G.P.x - e.x)
        ctx.strokeStyle = '#d6a05a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8 - 2, 6, a - 1.2, a + 1.2)
        ctx.stroke()
        if (aim) {
          ctx.fillStyle = '#5eead4'
          ctx.fillRect(Math.cos(a) * 8 - 1, Math.sin(a) * 8 - 3, 3, 3)
          ctx.setLineDash([3, 4])
          ctx.strokeStyle = `rgba(94,234,212,${0.25 + (0.65 - e.t) * 0.7})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10 - 2)
          ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 150 - 2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      } else if (e.kind === 'slime' || e.kind === 'slimeS') {
        const big = e.kind === 'slime'
        const R = big ? 10 : 6
        const hop = e.st === 'hop' ? Math.sin((Math.max(0, e.t) / 0.38) * Math.PI) : 0
        const squash = e.st === 'wait' ? Math.sin(G.time * 6 + e.wob) * 0.08 : -hop * 0.22
        shadow(0, R * 0.7, R * 0.9)
        ctx.translate(0, -hop * 6)
        ctx.fillStyle = white ? '#fff' : '#16a34a'
        ctx.beginPath()
        ctx.ellipse(0, 0, R * (1 + squash), R * (0.85 - squash), 0, Math.PI, 0)
        ctx.lineTo(R * (1 + squash), R * 0.5)
        ctx.lineTo(-R * (1 + squash), R * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = white ? '#fff' : '#4ade80'
        ctx.beginPath()
        ctx.ellipse(0, 1, R * (1 + squash) * 0.85, R * 0.35, 0, 0, Math.PI)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.fillRect(-R * 0.5, -R * 0.6, 3, 2)
        ctx.fillStyle = '#052e16'
        ctx.fillRect(-R * 0.45 - 1, -R * 0.1, 2, big ? 4 : 3)
        ctx.fillRect(R * 0.45 - 1, -R * 0.1, 2, big ? 4 : 3)
      } else if (e.kind === 'bat') {
        const flap = Math.sin(e.step) * 6
        const diving = e.st === 'dive'
        shadow(0, 12, 5)
        ctx.translate(0, -8)
        ctx.fillStyle = white ? '#fff' : diving ? '#e879f9' : '#a855f7'
        ctx.beginPath()
        ctx.moveTo(-3, 0)
        ctx.lineTo(-12, -5 + flap)
        ctx.lineTo(-8, 2)
        ctx.lineTo(-5, 1 + flap * 0.4)
        ctx.lineTo(0, 4)
        ctx.lineTo(5, 1 + flap * 0.4)
        ctx.lineTo(8, 2)
        ctx.lineTo(12, -5 + flap)
        ctx.lineTo(3, 0)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = white ? '#fff' : '#581c87'
        ctx.fillRect(-3, -4, 6, 7)
        ctx.fillStyle = '#fde047'
        ctx.fillRect(-3, -2, 2, 2)
        ctx.fillRect(1, -2, 2, 2)
      }
      ctx.restore()
    }

    const drawPlayer = () => {
      const P = G.P
      const x = Math.round(P.x)
      const y = Math.round(P.y)
      if (P.inv > 0 && P.dashI <= 0 && Math.floor(G.time * 22) % 2 === 0) return
      ctx.save()
      ctx.translate(x, y)
      shadow(0, 9, 8)
      const right = Math.cos(P.face) >= 0 ? 1 : -1
      const up = Math.sin(P.face) < -0.6
      const bob = P.moving ? Math.abs(Math.sin(P.walk)) * 1.6 : Math.sin(G.time * 3) * 0.4
      const stretch = P.dash > 0 ? 1.25 : 1
      ctx.scale(P.dash > 0 ? 1 / stretch : 1, 1)
      ctx.translate(0, -bob)
      // piernas
      const l = P.moving ? Math.sin(P.walk) * 2 : 0
      ctx.fillStyle = '#1e3a8a'
      ctx.fillRect(-4, 3 + (l > 0 ? 0 : 1), 3, 5)
      ctx.fillRect(1, 3 + (l > 0 ? 1 : 0), 3, 5)
      // capa
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(right > 0 ? -7 : 3, -4, 4, 9)
      // cuerpo
      ctx.fillStyle = P.dash > 0 ? '#bae6fd' : '#3b82f6'
      ctx.fillRect(-5, -4, 10, 9)
      ctx.fillStyle = '#93c5fd'
      ctx.fillRect(-5, -4, 10, 2)
      ctx.fillStyle = CYAN
      ctx.fillRect(-1, -1, 2, 3)
      // casco
      ctx.fillStyle = '#cbd5e1'
      ctx.fillRect(-5, -12, 10, 8)
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(-5, -12, 10, 2)
      if (!up) {
        ctx.fillStyle = CYAN
        ctx.fillRect(right > 0 ? -1 : -5, -9, 6, 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(right > 0 ? 3 : -5, -9, 1, 1)
      }
      // espada en reposo
      if (P.swingT <= 0) {
        ctx.fillStyle = '#e2e8f0'
        const sxo = right > 0 ? 6 : -9
        ctx.fillRect(sxo, -6, 3, 10)
        ctx.fillStyle = '#facc15'
        ctx.fillRect(sxo - 1, 3, 5, 2)
      }
      ctx.restore()
    }

    const drawSlash = (s: SlashFx) => {
      const k = 1 - s.t / s.max
      const a0 = s.angle - s.arc / 2
      const a1 = a0 + s.arc * Math.min(1, k * 1.7 + 0.2)
      ctx.save()
      ctx.translate(Math.round(G.P.x), Math.round(G.P.y))
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6)
      ctx.lineCap = 'round'
      ctx.strokeStyle = s.big ? '#fde047' : '#bae6fd'
      ctx.lineWidth = s.big ? 7 : 5
      ctx.beginPath()
      ctx.arc(0, 0, s.reach * 0.86, a0 + s.arc * Math.max(0, k * 1.2 - 0.5), a1)
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = s.big ? 3 : 2
      ctx.beginPath()
      ctx.arc(0, 0, s.reach * 0.86, a0 + s.arc * Math.max(0, k * 1.2 - 0.35), a1)
      ctx.stroke()
      // hoja
      const ba = a1
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(Math.cos(ba) * 8, Math.sin(ba) * 8)
      ctx.lineTo(Math.cos(ba) * (s.reach * 0.95), Math.sin(ba) * (s.reach * 0.95))
      ctx.stroke()
      ctx.restore()
    }

    const drawProj = (p: Proj) => {
      if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx)
        ctx.save()
        ctx.translate(Math.round(p.x), Math.round(p.y))
        ctx.rotate(a)
        ctx.fillStyle = '#d6a05a'
        ctx.fillRect(-7, -1, 12, 2)
        ctx.fillStyle = p.color
        ctx.fillRect(4, -2, 4, 4)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(-8, -2, 2, 4)
        ctx.restore()
      } else {
        const gr = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 10)
        gr.addColorStop(0, '#ffffff')
        gr.addColorStop(0.4, p.color)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.fillRect(p.x - 10, p.y - 10, 20, 20)
      }
    }

    const drawHud = () => {
      const P = G.P
      // corazones
      const n = P.maxHp / 2
      for (let i = 0; i < n; i++) {
        const v = P.hp - i * 2
        drawHeart(ctx, 8 + i * 17, 8, v >= 2 ? 2 : v >= 1 ? 1 : 0, P.hp <= 2 ? Math.sin(G.time * 8) : 0)
      }
      // dash
      const ready = P.dashCdT <= 0
      const k = ready ? 1 : 1 - P.dashCdT / P.dashCd
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(8, 24, 48, 6)
      ctx.fillStyle = ready ? (P.readyPing > 0 ? '#ffffff' : CYAN) : '#0e7490'
      ctx.fillRect(9, 25, 46 * k, 4)
      ctx.fillStyle = '#9ca3af'
      ctx.font = font(6)
      ctx.textAlign = 'left'
      ctx.fillText('DASH', 60, 30)
      if (P.hasKey) {
        ctx.fillStyle = '#fde047'
        ctx.fillRect(8, 35, 6, 6)
        ctx.fillStyle = '#0b0914'
        ctx.fillRect(10, 37, 2, 2)
        ctx.fillStyle = '#fde047'
        ctx.fillRect(13, 37, 8, 2)
        ctx.fillRect(18, 39, 2, 3)
      }
      // minimapa
      if (miniCtx) {
        if (G.miniDirty) {
          G.miniDirty = false
          const lv = G.lv
          const img = miniCtx.createImageData(MW, MH)
          for (let i = 0; i < MW * MH; i++) {
            if (!lv.explored[i]) continue
            const o = i * 4
            if (lv.grid[i]) {
              img.data[o] = 96
              img.data[o + 1] = 110
              img.data[o + 2] = 170
              img.data[o + 3] = 255
            } else {
              const tx = i % MW
              const ty = (i / MW) | 0
              const edge =
                (tx > 0 && lv.grid[i - 1]) || (tx < MW - 1 && lv.grid[i + 1]) || (ty > 0 && lv.grid[i - MW]) || (ty < MH - 1 && lv.grid[i + MW])
              if (!edge) continue
              img.data[o] = 38
              img.data[o + 1] = 40
              img.data[o + 2] = 70
              img.data[o + 3] = 255
            }
          }
          miniCtx.putImageData(img, 0, 0)
        }
        const s = 1.8
        const mx = VW - MW * s - 6
        const my = 6
        ctx.fillStyle = 'rgba(5,4,12,0.6)'
        ctx.fillRect(mx - 2, my - 2, MW * s + 4, MH * s + 4)
        ctx.drawImage(mini, mx, my, MW * s, MH * s)
        const lv = G.lv
        const ex = lv.exit
        if (ex.shown && lv.explored[Math.floor(ex.y / TILE) * MW + Math.floor(ex.x / TILE)]) {
          ctx.fillStyle = ex.locked ? '#f87171' : '#4ade80'
          ctx.fillRect(mx + (ex.x / TILE) * s - 1.5, my + (ex.y / TILE) * s - 1.5, 3, 3)
        }
        for (const it of G.items) {
          if (it.kind === 'key' && lv.explored[Math.floor(it.y / TILE) * MW + Math.floor(it.x / TILE)]) {
            ctx.fillStyle = '#fde047'
            ctx.fillRect(mx + (it.x / TILE) * s - 1.5, my + (it.y / TILE) * s - 1.5, 3, 3)
          }
        }
        for (const c of G.chestsList) {
          if (!c.open && lv.explored[Math.floor(c.y / TILE) * MW + Math.floor(c.x / TILE)]) {
            ctx.fillStyle = '#fb923c'
            ctx.fillRect(mx + (c.x / TILE) * s - 1, my + (c.y / TILE) * s - 1, 2.5, 2.5)
          }
        }
        if (Math.floor(G.time * 4) % 2 === 0) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(mx + (P.x / TILE) * s - 1.5, my + (P.y / TILE) * s - 1.5, 3, 3)
        }
      }
      // combo
      if (G.combo >= 2) {
        const mult = Math.min(5, 1 + Math.floor(G.combo / 3))
        ctx.textAlign = 'left'
        ctx.font = font(10)
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillText(`x${mult}`, 9, VH - 21)
        ctx.fillStyle = mult >= 3 ? '#fde047' : '#fbbf24'
        ctx.fillText(`x${mult}`, 8, VH - 22)
        ctx.font = font(6)
        ctx.fillStyle = '#d1d5db'
        ctx.fillText(`${G.combo} BAJAS`, 34, VH - 22)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(8, VH - 16, 54, 4)
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(8, VH - 16, 54 * clamp(G.comboT / 3.2, 0, 1), 4)
      }
      // jefe
      const b = G.bossRef
      if (b && b.st !== 'sleep') {
        const w = VW - 80
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(40, VH - 26, w, 10)
        ctx.fillStyle = '#c026d3'
        ctx.fillRect(41, VH - 25, (w - 2) * clamp(b.hp / b.maxHp, 0, 1), 8)
        ctx.fillStyle = '#fdf4ff'
        ctx.font = font(6)
        ctx.textAlign = 'center'
        ctx.fillText('NUCLEO CENTINELA', VW / 2, VH - 30)
        ctx.textAlign = 'left'
      }
      // flecha al objetivo
      const lv = G.lv
      if (G.phase === 'play') {
        let tx = 0
        let ty = 0
        let has = false
        if (lv.exit.shown && P.hasKey) {
          tx = lv.exit.x
          ty = lv.exit.y
          has = true
        } else if (lv.exit.shown && !lv.exit.locked) {
          tx = lv.exit.x
          ty = lv.exit.y
          has = true
        } else if (!P.hasKey) {
          const key = G.items.find((i) => i.kind === 'key')
          if (key && lv.explored[Math.floor(key.y / TILE) * MW + Math.floor(key.x / TILE)]) {
            tx = key.x
            ty = key.y
            has = true
          }
        }
        if (has) {
          const d = Math.hypot(tx - P.x, ty - P.y)
          if (d > 90) {
            const a = Math.atan2(ty - P.y, tx - P.x)
            const px = P.x - G.camX + Math.cos(a) * 34
            const py = P.y - G.camY + Math.sin(a) * 34
            ctx.save()
            ctx.translate(px, py)
            ctx.rotate(a)
            ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.time * 6)
            ctx.fillStyle = P.hasKey || !lv.exit.locked ? '#4ade80' : '#fde047'
            ctx.beginPath()
            ctx.moveTo(6, 0)
            ctx.lineTo(-4, -5)
            ctx.lineTo(-4, 5)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
        }
      }
    }

    const drawBanner = (text: string, y: number, color: string, size: number) => {
      ctx.font = font(size)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.fillText(text, VW / 2 + 2, y + 2)
      ctx.fillStyle = color
      ctx.fillText(text, VW / 2, y)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      ctx.fillStyle = '#05040b'
      ctx.fillRect(0, 0, VW, VH)
      ctx.save()
      juice.applyShake(ctx)
      const cx = Math.round(G.camX)
      const cy = Math.round(G.camY)
      ctx.translate(-cx, -cy)
      drawTiles()
      drawStairs()
      drawItems()
      // fantasmas del dash
      for (const gh of G.ghosts) {
        ctx.globalAlpha = (gh.life / 0.22) * 0.45
        ctx.fillStyle = CYAN
        ctx.fillRect(Math.round(gh.x) - 5, Math.round(gh.y) - 11, 10, 18)
      }
      ctx.globalAlpha = 1
      // entidades ordenadas por y
      const ents: { y: number; fn: () => void }[] = []
      for (const e of G.enemies) {
        if (e.dead) continue
        if (!isVisPx(e.x, e.y)) continue
        ents.push({ y: e.y, fn: () => drawEnemy(e) })
      }
      if (G.phase !== 'dying' && G.phase !== 'over') ents.push({ y: G.P.y, fn: drawPlayer })
      ents.sort((a, b) => a.y - b.y)
      for (const en of ents) en.fn()
      for (const p of G.projs) drawProj(p)
      for (const s of G.slashes) drawSlash(s)
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pixelFont)
      ctx.restore()

      // iluminación ambiente
      const px = G.P.x - cx
      const py = G.P.y - cy
      const gr = ctx.createRadialGradient(px, py, 50, px, py, 230)
      gr.addColorStop(0, 'rgba(0,0,0,0)')
      gr.addColorStop(1, 'rgba(2,1,8,0.5)')
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, VW, VH)
      if (G.P.hp <= 2 && G.phase === 'play') {
        const a = 0.12 + 0.1 * Math.sin(G.time * 7)
        const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.75)
        vg.addColorStop(0, 'rgba(239,68,68,0)')
        vg.addColorStop(1, `rgba(239,68,68,${a})`)
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, VW, VH)
      }
      juice.drawFlash(ctx, VW, VH)
      if (G.phase !== 'idle') drawHud()

      // textos de estado
      if (G.banner.t > 0 && (G.phase === 'play' || G.phase === 'trans')) {
        const a = clamp(G.banner.t / 0.5, 0, 1)
        ctx.globalAlpha = a
        drawBanner(G.banner.text, VH * 0.3, G.lv.boss ? '#e879f9' : ACCENT, 14)
        drawBanner(G.banner.sub, VH * 0.3 + 20, '#e5e7eb', 7)
        ctx.globalAlpha = 1
      }
      if (G.hintT > 0 && G.phase === 'play' && G.banner.t <= 0) {
        ctx.globalAlpha = clamp(G.hintT / 1, 0, 1)
        drawBanner('A espada    B esquiva', VH - 56, '#e5e7eb', 7)
        ctx.globalAlpha = 1
      }
      if (G.phase === 'trans') {
        const t = G.transT
        const a = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.55)
        ctx.fillStyle = `rgba(2,1,8,${clamp(a, 0, 1)})`
        ctx.fillRect(0, 0, VW, VH)
      }
      if (G.phase === 'dying') {
        ctx.fillStyle = `rgba(2,1,8,${clamp(G.deathT / 1.4, 0, 0.75)})`
        ctx.fillRect(0, 0, VW, VH)
      }
      if (G.paused) {
        ctx.fillStyle = 'rgba(5,4,12,0.78)'
        ctx.fillRect(0, 0, VW, VH)
        drawBanner('PAUSA', VH / 2 - 10, ACCENT, 20)
        drawBanner('Pulsa P para seguir', VH / 2 + 22, '#ffffff', 8)
      }
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      update(dt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const autoPause = () => {
      if (G.phase === 'play') G.paused = true
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
  }, [justPressedRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={VW}
        height={VH}
        className="rounded-xl border-2 border-amber-600/40 bg-[#05040b] shadow-[0_0_30px_rgba(217,119,6,0.2)]"
        hud={
          <Hud>
            <span className="text-amber-300">PISO {floor}</span>
            <span className="text-cyan-300">PTS {score.toLocaleString('es-MX')}</span>
            <span className="text-white/60">HI {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Cyber Dungeon"
        />
        {!started && !over && (
          <StartOverlay
            title="CYBER DUNGEON"
            accent={ACCENT}
            subtitle="Recorre la mazmorra, recoge la llave y baja por la escalera. Cada cofre te da una mejora y cada 5 pisos te espera un jefe."
            hint="Pulsa ESPACIO para entrar"
            touchHint="Toca A para entrar"
            onStart={begin}
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-xs text-white/70">
              <dt className="font-semibold text-amber-300">Mover</dt>
              <dd>Flechas / WASD / cruceta</dd>
              <dt className="font-semibold text-amber-300">A - Espada</dt>
              <dd>Espacio, Z o J. Encadena 3 golpes para el tajo grande</dd>
              <dt className="font-semibold text-cyan-300">B - Esquiva</dt>
              <dd>X, K o Shift. Invulnerable un instante</dd>
              <dt className="font-semibold text-emerald-300">Pociones</dt>
              <dd>Se usan solas al recogerlas</dd>
            </dl>
          </StartOverlay>
        )}
        {choices && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3 text-center"
            style={{ background: 'rgba(5,4,12,0.88)' }}
          >
            <p className="text-sm text-amber-300 sm:text-base" style={{ fontFamily: 'var(--font-pixel)' }}>
              ELIGE UNA MEJORA
            </p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {choices.map((idx, i) => {
                const u = UPGRADES[idx]
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pick(i)}
                    onPointerEnter={() => setSel(i)}
                    className="rounded-lg border px-3 py-2 text-left transition active:scale-[0.98]"
                    style={{
                      borderColor: sel === i ? u.color : 'rgba(255,255,255,0.15)',
                      background: sel === i ? `${u.color}22` : 'rgba(255,255,255,0.04)',
                      boxShadow: sel === i ? `0 0 18px ${u.color}55` : 'none',
                    }}
                  >
                    <span className="block text-sm font-semibold" style={{ color: u.color }}>
                      {u.name}
                    </span>
                    <span className="block text-xs text-white/70">{u.desc}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/40">Toca una opción, o usa flechas y A</p>
          </div>
        )}
        {over && (
          <GameOverOverlay
            title="HAS CAIDO"
            accent={ACCENT}
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Piso', value: stats.floor },
              { label: 'Bajas', value: stats.kills },
              { label: 'Mejor racha', value: stats.combo },
              { label: 'Cofres', value: stats.chests },
            ]}
            onRestart={begin}
          />
        )}
      </GameScreen>

      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Espada"
        actionGlyph="A"
        showAction2
        action2Label="Esquiva"
        action2Glyph="B"
      />
    </div>
  )
}
