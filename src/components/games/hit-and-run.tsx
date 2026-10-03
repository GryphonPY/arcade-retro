'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { StartOverlay, GameOverOverlay, Hud } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

// ---------------------------------------------------------------------------
// Constantes del mundo
// ---------------------------------------------------------------------------
const W = 360
const H = 480
const SW_L = 40 // inicio de la banqueta izquierda
const ROAD_L = 62
const ROAD_R = 298
const SW_R = 320
const LANE_W = (ROAD_R - ROAD_L) / 4
const CW = 24
const CH = 36
const TRUCK_H = 54
const PY_MIN = H - 270
const PY_MAX = H - 64 - CH
const ACCENT = '#ffc531'

const laneCx = (i: number) => ROAD_L + LANE_W * (i + 0.5)
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

// ---------------------------------------------------------------------------
// Sprites pixel-art (se pre-renderizan una sola vez)
// X carrocería · K carrocería oscura · L faros · G cristal · T pilotos · W llantas · S letrero
// ---------------------------------------------------------------------------
const CAR_PIX = [
  '..KKKK..',
  '.XXXXXX.',
  '.XLXXLX.',
  'WXGGGGXW',
  '.XGGGGX.',
  '.XXXXXX.',
  '.XXXXXX.',
  'WXGGGGXW',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XTXXTX.',
  '..KKKK..',
]
const TAXI_PIX = [
  '..KKKK..',
  '.XXXXXX.',
  '.XLXXLX.',
  'WXGGGGXW',
  '.XGGGGX.',
  '.XSSSSX.',
  '.XXXXXX.',
  'WXGGGGXW',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XTXXTX.',
  '..KKKK..',
]
const TRUCK_PIX = [
  '..KKKK..',
  '.XXXXXX.',
  '.XLXXLX.',
  'WXGGGGXW',
  '.XGGGGX.',
  '.XXXXXX.',
  '.KKKKKK.',
  '.BBBBBB.',
  'WBBBBBBW',
  '.BCCCCB.',
  '.BCCCCB.',
  '.BBBBBB.',
  'WBBBBBBW',
  '.BBBBBB.',
  '.BBBBBB.',
  '.BBBBBB.',
  '.BTBBTB.',
  '..KKKK..',
]

type Pal = Record<string, string>
const base = { L: '#fff3b0', G: '#1d2b45', T: '#ff7a6a', W: '#07070d', S: '#fff7c2' }
const PAL_PLAYER: Pal = { ...base, X: '#e63946', K: '#9c1c2a' }
const PAL_TAXI: Pal = { ...base, X: '#ffc531', K: '#b98410', S: '#fffbe0' }
const PAL_COP: Pal = { ...base, X: '#f4f4fa', K: '#1c2033' }
const PAL_CIV: Pal[] = [
  { ...base, X: '#3a86ff', K: '#1f4fa8' },
  { ...base, X: '#2ec27e', K: '#17784c' },
  { ...base, X: '#9b5de5', K: '#5f2fa0' },
  { ...base, X: '#9aa3b2', K: '#5c6475' },
  { ...base, X: '#ff7f50', K: '#b04a28' },
]
const PAL_TRUCK: Pal = { ...base, X: '#d04a2f', K: '#7a2616', B: '#e6e6ee', C: '#4b6fb0' }

function makeSprite(matrix: string[], pal: Pal, cell = 3): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = matrix[0].length * cell
  c.height = matrix.length * cell
  const x = c.getContext('2d')!
  for (let r = 0; r < matrix.length; r++) {
    for (let col = 0; col < matrix[r].length; col++) {
      const ch = matrix[r][col]
      if (ch === '.') continue
      x.fillStyle = pal[ch] ?? '#f0f'
      x.fillRect(col * cell, r * cell, cell, cell)
    }
  }
  return c
}

interface Sprites {
  player: HTMLCanvasElement
  taxi: HTMLCanvasElement
  cop: HTMLCanvasElement
  civ: HTMLCanvasElement[]
  truck: HTMLCanvasElement
  glow: HTMLCanvasElement
  vignette: HTMLCanvasElement
  asphalt: HTMLCanvasElement
  sideL: HTMLCanvasElement
  sideR: HTMLCanvasElement
}

const SIDE_TILE = 660
const ASPHALT_TILE = 512

const DISTRICTS = [
  { roof: ['#1b1b30', '#22223a', '#191927', '#26263e'], neon: ['#ff3d8b', '#35e0ff', '#ffc531'] },
  { roof: ['#1f1a30', '#2a2040', '#18142a', '#2d2347'], neon: ['#b56bff', '#ff5d9b', '#5dffd0'] },
  { roof: ['#16262b', '#1c3138', '#12202a', '#213a40'], neon: ['#3dffb0', '#ffd23d', '#ff6a3d'] },
  { roof: ['#2a1c1c', '#35221f', '#221616', '#3a2824'], neon: ['#ff4d4d', '#ffb13d', '#fff03d'] },
]

function makeSideTile(seed: number, dist: (typeof DISTRICTS)[number]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = ROAD_L
  c.height = SIDE_TILE
  const x = c.getContext('2d')!
  let s = seed * 9301 + 49297
  const r = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  x.fillStyle = '#0a0a13'
  x.fillRect(0, 0, ROAD_L, SIDE_TILE)
  // banqueta
  x.fillStyle = '#34344a'
  x.fillRect(SW_L, 0, ROAD_L - SW_L, SIDE_TILE)
  x.fillStyle = '#2a2a3e'
  for (let y = 0; y < SIDE_TILE; y += 22) x.fillRect(SW_L, y, ROAD_L - SW_L, 1)
  x.fillStyle = '#51516e'
  x.fillRect(ROAD_L - 2, 0, 2, SIDE_TILE)
  // edificios (vista cenital: azoteas)
  let y = 0
  while (y < SIDE_TILE) {
    let h = 70 + Math.floor(r() * 80)
    if (SIDE_TILE - y - h < 80) h = SIDE_TILE - y
    const roof = dist.roof[Math.floor(r() * dist.roof.length)]
    x.fillStyle = roof
    x.fillRect(0, y + 2, SW_L - 2, h - 4)
    x.fillStyle = 'rgba(255,255,255,0.07)'
    x.fillRect(0, y + 2, SW_L - 2, 2)
    x.fillStyle = 'rgba(0,0,0,0.35)'
    x.fillRect(0, y + h - 5, SW_L - 2, 3)
    // equipos de azotea
    const n = 1 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const bx = 4 + Math.floor(r() * (SW_L - 20))
      const by = y + 8 + Math.floor(r() * Math.max(1, h - 28))
      const kind = r()
      if (kind < 0.45) {
        x.fillStyle = '#5a5a74'
        x.fillRect(bx, by, 10, 10)
        x.fillStyle = '#2b2b3e'
        x.fillRect(bx + 2, by + 2, 6, 6)
        x.fillStyle = '#8c8caa'
        x.fillRect(bx + 4, by + 4, 2, 2)
      } else if (kind < 0.75) {
        x.fillStyle = 'rgba(80,220,255,0.35)'
        x.fillRect(bx, by, 12, 8)
        x.fillStyle = 'rgba(200,250,255,0.45)'
        x.fillRect(bx + 1, by + 1, 4, 2)
      } else {
        x.fillStyle = '#3d3d52'
        x.beginPath()
        x.arc(bx + 6, by + 6, 6, 0, Math.PI * 2)
        x.fill()
        x.fillStyle = '#5a5a74'
        x.beginPath()
        x.arc(bx + 6, by + 6, 3, 0, Math.PI * 2)
        x.fill()
      }
    }
    // letrero de neón hacia la calle
    if (r() < 0.55) {
      const neon = dist.neon[Math.floor(r() * dist.neon.length)]
      const ny = y + 10 + Math.floor(r() * Math.max(1, h - 40))
      const nl = 14 + Math.floor(r() * 18)
      const grad = x.createLinearGradient(SW_L - 2, 0, ROAD_L, 0)
      grad.addColorStop(0, neon + '3a')
      grad.addColorStop(1, neon + '00')
      x.fillStyle = grad
      x.fillRect(SW_L - 2, ny - 4, ROAD_L - SW_L + 2, nl + 8)
      x.fillStyle = neon
      x.fillRect(SW_L - 4, ny, 3, nl)
    }
    y += h
  }
  return c
}

function makeSprites(districtIdx: number): Sprites {
  const glow = document.createElement('canvas')
  glow.width = glow.height = 128
  const gx = glow.getContext('2d')!
  const gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gg.addColorStop(0, 'rgba(255,224,150,0.5)')
  gg.addColorStop(1, 'rgba(255,224,150,0)')
  gx.fillStyle = gg
  gx.fillRect(0, 0, 128, 128)

  const vignette = document.createElement('canvas')
  vignette.width = W
  vignette.height = H
  const vx = vignette.getContext('2d')!
  const vg = vx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.8)
  vg.addColorStop(0, 'rgba(0,0,10,0)')
  vg.addColorStop(1, 'rgba(0,0,10,0.55)')
  vx.fillStyle = vg
  vx.fillRect(0, 0, W, H)

  const asphalt = document.createElement('canvas')
  asphalt.width = ROAD_R - ROAD_L
  asphalt.height = ASPHALT_TILE
  const ax = asphalt.getContext('2d')!
  ax.fillStyle = '#1c1c2a'
  ax.fillRect(0, 0, asphalt.width, ASPHALT_TILE)
  let s = 7
  const r = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < 420; i++) {
    ax.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.25)'
    ax.fillRect(Math.floor(r() * asphalt.width), Math.floor(r() * ASPHALT_TILE), 2, 2)
  }
  ax.strokeStyle = 'rgba(0,0,0,0.3)'
  ax.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    ax.beginPath()
    let cx = r() * asphalt.width
    let cy = r() * ASPHALT_TILE
    ax.moveTo(cx, cy)
    for (let k = 0; k < 4; k++) {
      cx += (r() - 0.5) * 14
      cy += 6 + r() * 10
      ax.lineTo(cx, cy)
    }
    ax.stroke()
  }
  const d = DISTRICTS[districtIdx % DISTRICTS.length]
  return {
    player: makeSprite(CAR_PIX, PAL_PLAYER),
    taxi: makeSprite(TAXI_PIX, PAL_TAXI),
    cop: makeSprite(CAR_PIX, PAL_COP),
    civ: PAL_CIV.map((p) => makeSprite(CAR_PIX, p)),
    truck: makeSprite(TRUCK_PIX, PAL_TRUCK),
    glow,
    vignette,
    asphalt,
    sideL: makeSideTile(3 + districtIdx * 11, d),
    sideR: makeSideTile(8 + districtIdx * 17, d),
  }
}

// ---------------------------------------------------------------------------
// Tipos de estado
// ---------------------------------------------------------------------------
type VKind = 'taxi' | 'civ' | 'cop' | 'truck'

interface Veh {
  id: number
  kind: VKind
  x: number
  y: number
  w: number
  h: number
  own: number // velocidad propia hacia adelante (px/s del mundo)
  pal: number
  sway: number
  tx: number // centro del carril objetivo
  laneT: number
  vx: number
  vy: number
  rot: number
  rv: number
  wreck: number // >0: segundos para explotar
  nm: boolean
  cool: number
  hit: number
  // policías
  st: 0 | 1 | 2
  stT: number
  cd: number
  dx: number
  dy: number
  side: number
  near: boolean
  gap: number
}

type PKind = 'cone' | 'barrel' | 'hydrant' | 'mailbox' | 'trash'
interface Prop {
  kind: PKind
  x: number
  y: number
  dead: boolean
}
interface Pick {
  kind: 'cash' | 'wrench' | 'nitro'
  x: number
  y: number
  ph: number
}
interface Block {
  y: number
  gx0: number
  gx1: number
  aliveL: boolean
  aliveR: boolean
  passed: boolean
}
interface Fountain {
  x: number
  y: number
  t: number
}
interface Ring {
  x: number
  y: number
  r: number
  max: number
  life: number
  color: string
}
interface Decal {
  x: number
  y: number
  kind: 0 | 1 // 0 marca de llanta · 1 mancha de quemado
  life: number
}
interface Heli {
  x: number
  y: number
  sx: number
  sy: number
  spot: number
  rotor: number
  tick: number
  call: number
}
interface Mission {
  kind: 'taxis' | 'cash' | 'near' | 'break' | 'drift'
  need: number
  have: number
  left: number
  total: number
  label: string
}

interface G {
  phase: 'ready' | 'play' | 'dying' | 'over'
  paused: boolean
  t: number
  clock: number
  dist: number
  scroll: number
  cruise: number
  level: number
  score: number
  dscore: number
  px: number
  py: number
  vx: number
  vy: number
  rot: number
  armor: number
  invuln: number
  turbo: number
  lock: boolean
  boosting: boolean
  braking: boolean
  heat: number
  stars: number
  spotted: boolean
  combo: number
  comboT: number
  maxCombo: number
  vehs: Veh[]
  props: Prop[]
  picks: Pick[]
  blocks: Block[]
  fount: Fountain[]
  rings: Ring[]
  decals: Decal[]
  heli: Heli | null
  tTraffic: number
  tCop: number
  tBlock: number
  tCone: number
  tSide: number
  tCash: number
  tPick: number
  spawned: number
  mission: Mission | null
  missionDelay: number
  banner: { text: string; sub: string; t: number } | null
  skidT: number
  driftT: number
  driftScore: number
  deadT: number
  cause: 'cop' | 'crash'
  id: number
  wallT: number
  stats: { taxis: number; near: number; cash: number; breaks: number; missions: number }
}

function newGame(): G {
  return {
    phase: 'ready',
    paused: false,
    t: 0,
    clock: 0,
    dist: 0,
    scroll: 220,
    cruise: 235,
    level: 1,
    score: 0,
    dscore: 0,
    px: W / 2 - CW / 2,
    py: H - 150,
    vx: 0,
    vy: 0,
    rot: 0,
    armor: 4,
    invuln: 0,
    turbo: 60,
    lock: false,
    boosting: false,
    braking: false,
    heat: 0,
    stars: 0,
    spotted: false,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    vehs: [],
    props: [],
    picks: [],
    blocks: [],
    fount: [],
    rings: [],
    decals: [],
    heli: null,
    tTraffic: 0.6,
    tCop: 3,
    tBlock: 14,
    tCone: 6,
    tSide: 0.5,
    tCash: 3,
    tPick: 28,
    spawned: 0,
    mission: null,
    missionDelay: 7,
    banner: null,
    skidT: 0,
    driftT: 0,
    driftScore: 0,
    deadT: 0,
    cause: 'crash',
    id: 1,
    wallT: 0,
    stats: { taxis: 0, near: 0, cash: 0, breaks: 0, missions: 0 },
  }
}

const FIRE = ['#fff3b0', '#ffd23d', '#ff8a3d', '#e84c4c']
const SMOKE = ['#3b3b4d', '#55556b', '#2a2a38']
const SPARK = ['#fff3b0', '#ffd23d', '#ffffff']

export default function HitAndRun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const juiceRef = useRef<Juice | null>(null)
  const beginRef = useRef<() => void>(() => {})
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest('hit-and-run') : 0))
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [stars, setStars] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [overTitle, setOverTitle] = useState('TE ATRAPARON')
  const [stats, setStats] = useState({ taxis: 0, combo: 0, meters: 0, missions: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(9)
    juiceRef.current = juice
    const rawFont = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    const FONT = rawFont ? `${rawFont}, monospace` : '"Press Start 2P", monospace'
    try {
      void document.fonts?.load(`10px ${FONT}`).catch(() => {})
    } catch {
      // sin API de fuentes
    }

    let districtIdx = 0
    let spr = makeSprites(districtIdx)
    let g = newGame()
    let raf = 0
    let last = performance.now()
    let hudT = 0
    let lastScoreShown = -1
    let lastStars = 0
    let helicopterTick = 0

    // ---------- utilidades de juego ----------
    const mult = () => Math.min(8, 1 + g.combo)

    const addScore = (n: number) => {
      g.score += Math.round(n)
    }

    const text = (x: number, y: number, s: string, color = '#fff', size = 10, life = 0.9) =>
      juice.text(x, y, s, color, size, life)

    const missionProgress = (kind: Mission['kind'], n = 1) => {
      const m = g.mission
      if (!m || m.kind !== kind) return
      m.have += n
      if (m.have >= m.need) {
        const reward = 400 + g.level * 100
        addScore(reward)
        g.turbo = Math.min(100, g.turbo + 50)
        g.stats.missions++
        g.mission = null
        g.missionDelay = rand(6, 9)
        text(W / 2, 120, 'MISION CUMPLIDA', '#5df2a3', 12, 1.4)
        text(W / 2, 138, `+${reward}`, '#ffd23d', 12, 1.4)
        juice.flash('#5df2a3', 0.22)
        sfx.levelUp()
      }
    }

    const newMission = () => {
      const lv = g.level
      const kind = pick<Mission['kind']>(['taxis', 'cash', 'near', 'break', 'drift'])
      let need = 3
      let total = 13
      let label = ''
      switch (kind) {
        case 'taxis':
          need = 2 + Math.min(3, Math.floor(lv / 2) + (Math.random() < 0.5 ? 1 : 0))
          total = 8 + need * 2
          label = `Embiste ${need} taxis`
          break
        case 'cash':
          need = 5 + Math.floor(Math.random() * 3)
          total = 11
          label = `Junta ${need} billetes`
          break
        case 'near':
          need = 3 + Math.floor(Math.random() * 2)
          total = 13
          label = `${need} rozones a otros autos`
          break
        case 'break':
          need = 4 + Math.floor(Math.random() * 3)
          total = 12
          label = `Rompe ${need} objetos`
          break
        case 'drift':
          need = 3
          total = 15
          label = 'Derrapa 3 segundos'
          break
      }
      g.mission = { kind, need, have: 0, left: total, total, label }
      sfx.coin()
    }

    // ---------- efectos ----------
    const sparksAt = (x: number, y: number, n = 10, ang?: number) => {
      juice.burst(x, y, SPARK, {
        count: n,
        speed: 190,
        life: 0.35,
        size: 2.2,
        drag: 3,
        ...(ang !== undefined ? { angle: ang, arc: 2.2 } : {}),
      })
    }

    const explode = (x: number, y: number, radius: number, depth = 0) => {
      juice.burst(x, y, FIRE, { count: 28, speed: 220, life: 0.55, size: 5, drag: 2.4 })
      juice.burst(x, y, SMOKE, { count: 12, speed: 70, life: 1.0, size: 7, drag: 1.4 })
      g.rings.push({ x, y, r: 6, max: radius * 1.25, life: 0.35, color: '#ffd23d' })
      g.decals.push({ x, y, kind: 1, life: 6 })
      juice.shake(0.32)
      sfx.explode()
      let chain = 0
      for (const o of g.vehs) {
        if (o.wreck > 0 || o.kind === 'truck') continue
        const dx = o.x + o.w / 2 - x
        const dy = o.y + o.h / 2 - y
        if (dx * dx + dy * dy < radius * radius) {
          chain++
          const dir = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx)
          wreckVeh(o, dir * rand(70, 140), rand(-120, -40), rand(-7, 7), 0.28)
          const base = o.kind === 'cop' ? 150 : o.kind === 'taxi' ? 80 : 20
          const pts = base * (o.kind === 'civ' ? 1 : mult())
          addScore(pts)
          text(o.x + o.w / 2, o.y, o.kind === 'civ' ? `+${pts}` : `CADENA +${pts}`, '#ff8a3d', 9, 1.1)
          if (o.kind === 'taxi') g.stats.taxis++
        }
      }
      if (chain >= 2 && depth === 0) {
        text(W / 2, 170, `REACCION EN CADENA x${chain}`, '#ff8a3d', 10, 1.3)
        juice.shake(0.2)
        g.comboT = 4.5
      }
    }

    const wreckVeh = (v: Veh, vx: number, vy: number, rv: number, t = 0.55) => {
      v.wreck = t + rand(0, 0.12)
      v.vx = vx
      v.vy = vy
      v.rv = rv
      v.hit = 0.15
    }

    const pushDecal = (x: number, y: number) => {
      if (g.decals.length > 260) g.decals.shift()
      g.decals.push({ x, y, kind: 0, life: 2.4 })
    }

    const hurt = (cause: 'cop' | 'crash', dmg = 1): boolean => {
      if (g.invuln > 0 || g.phase !== 'play') return false
      g.armor -= dmg
      g.invuln = 1.5
      g.cause = cause
      if (g.combo > 0) text(g.px + CW / 2, g.py - 14, 'COMBO PERDIDO', '#ff5d5d', 8, 1)
      g.combo = 0
      g.comboT = 0
      const cx = g.px + CW / 2
      const cy = g.py + CH / 2
      sparksAt(cx, cy, 22)
      juice.burst(cx, cy, SMOKE, { count: 8, speed: 60, life: 0.8, size: 6, drag: 1.5 })
      juice.shake(0.6)
      juice.freeze(90)
      juice.flash('#ff3b3b', 0.35)
      sfx.crash()
      if (g.armor <= 0) {
        g.armor = 0
        g.phase = 'dying'
        g.deadT = 0
        explode(cx, cy, 70, 1)
        juice.shake(0.9)
        juice.freeze(160)
        juice.flash('#ffffff', 0.6)
        sfx.gameOver()
      }
      return true
    }

    const raiseHeat = (n: number) => {
      g.heat = Math.min(5, g.heat + n)
    }

    // ---------- apariciones ----------
    const laneFree = (lane: number, yMax: number) =>
      !g.vehs.some((v) => Math.abs(v.x + v.w / 2 - laneCx(lane)) < 30 && v.y < yMax)

    const spawnTraffic = (forceTaxi = false) => {
      const lanes = [0, 1, 2, 3].filter((l) => laneFree(l, 150))
      if (!lanes.length) return
      const lane = pick(lanes)
      let kind: VKind = 'civ'
      const r = Math.random()
      if (forceTaxi || r < 0.42) kind = 'taxi'
      else if (g.t > 16 && r > 0.9) kind = 'truck'
      const truck = kind === 'truck'
      const h = truck ? TRUCK_H : CH
      const own =
        kind === 'taxi'
          ? g.cruise * rand(0.3, 0.5)
          : truck
            ? g.cruise * 0.26
            : g.cruise * rand(0.35, 0.6)
      g.vehs.push({
        id: g.id++,
        kind,
        x: laneCx(lane) - CW / 2,
        y: -h - 10,
        w: CW,
        h,
        own,
        pal: (Math.random() * PAL_CIV.length) | 0,
        sway: Math.random() * 6.28,
        tx: laneCx(lane),
        laneT: rand(2, 5),
        vx: 0,
        vy: 0,
        rot: 0,
        rv: 0,
        wreck: 0,
        nm: false,
        cool: 0,
        hit: 0,
        st: 0,
        stT: 0,
        cd: 0,
        dx: 0,
        dy: 0,
        side: 0,
        near: false,
        gap: 0,
      })
      g.spawned++
    }

    const spawnCop = (x?: number) => {
      const cx = x ?? clamp(g.px + CW / 2 + rand(-80, 80), ROAD_L + 14, ROAD_R - 14)
      g.vehs.push({
        id: g.id++,
        kind: 'cop',
        x: cx - CW / 2,
        y: H + 30 + rand(0, 40),
        w: CW,
        h: CH,
        own: 0,
        pal: 0,
        sway: 0,
        tx: cx,
        laneT: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        rv: 0,
        wreck: 0,
        nm: false,
        cool: 0,
        hit: 0,
        st: 0,
        stT: 0,
        cd: rand(1.5, 3),
        dx: 0,
        dy: -1,
        side: 0,
        near: false,
        gap: rand(95, 135),
      })
      sfx.siren()
    }

    const spawnBlock = () => {
      const gapW = 92
      const gx0 = rand(SW_L + 18, SW_R - 18 - gapW)
      g.blocks.push({ y: -250, gx0, gx1: gx0 + gapW, aliveL: true, aliveR: true, passed: false })
      text(W / 2, 80, 'BLOQUEO ADELANTE', '#ff5d5d', 10, 1.4)
      sfx.siren()
    }

    const spawnCones = () => {
      const lane = (Math.random() * 4) | 0
      const cx = laneCx(lane)
      const n = 3 + ((Math.random() * 3) | 0)
      const diag = Math.random() < 0.5 ? 1 : -1
      for (let i = 0; i < n; i++) {
        g.props.push({ kind: 'cone', x: clamp(cx + diag * (i - n / 2) * 9, ROAD_L + 8, ROAD_R - 8), y: -20 - i * 24, dead: false })
      }
      if (Math.random() < 0.35) g.props.push({ kind: 'barrel', x: clamp(cx + rand(-24, 24), ROAD_L + 12, ROAD_R - 12), y: -90, dead: false })
    }

    const spawnSideProp = () => {
      const left = Math.random() < 0.5
      const kind = pick<PKind>(['hydrant', 'hydrant', 'mailbox', 'trash', 'mailbox'])
      g.props.push({ kind, x: left ? (SW_L + ROAD_L) / 2 : (ROAD_R + SW_R) / 2, y: -16, dead: false })
    }

    const spawnCash = () => {
      const lane = (Math.random() * 4) | 0
      const n = 4 + ((Math.random() * 3) | 0)
      const sway = Math.random() < 0.5
      for (let i = 0; i < n; i++) {
        const x = clamp(laneCx(lane) + (sway ? Math.sin(i * 0.9) * 22 : 0), ROAD_L + 10, ROAD_R - 10)
        g.picks.push({ kind: 'cash', x, y: -20 - i * 28, ph: i * 0.6 })
      }
    }

    const spawnHeli = () => {
      g.heli = { x: g.px, y: -40, sx: g.px + CW / 2, sy: g.py, spot: 0, rotor: 0, tick: 0, call: 0 }
      text(W / 2, 110, 'HELICOPTERO', '#ff5d5d', 11, 1.5)
      juice.flash('#ff3b3b', 0.2)
    }

    // ---------- colisiones concretas ----------
    const ramTaxi = (v: Veh) => {
      g.combo++
      g.maxCombo = Math.max(g.maxCombo, g.combo)
      g.comboT = 4.5
      const m = mult()
      const pts = Math.round(100 * m * (g.boosting ? 1.5 : 1))
      addScore(pts)
      g.stats.taxis++
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      const dir = cx >= g.px + CW / 2 ? 1 : -1
      wreckVeh(v, dir * rand(110, 190) + g.vx * 0.4, -rand(120, 200), dir * rand(5, 10))
      sparksAt(cx, cy, 16)
      juice.shake(0.42)
      juice.freeze(70)
      sfx.hit()
      tone({ freq: 160 + m * 25, to: 70, dur: 0.18, vol: 0.05, type: 'square' })
      g.scroll *= 0.95
      g.turbo = Math.min(100, g.turbo + 12)
      raiseHeat(0.5)
      text(cx, v.y - 6, g.boosting ? `A TODA MECHA +${pts}` : `+${pts}`, '#ffd23d', 10, 1)
      if (m > 1) text(cx, v.y - 20, `COMBO x${m}`, '#ff8a3d', 9, 1)
      missionProgress('taxis')
    }

    const takedownCop = (v: Veh) => {
      g.combo++
      g.maxCombo = Math.max(g.maxCombo, g.combo)
      g.comboT = 4.5
      const m = mult()
      const pts = 300 * m
      addScore(pts)
      const cx = v.x + v.w / 2
      const dir = cx >= g.px + CW / 2 ? 1 : -1
      wreckVeh(v, dir * rand(140, 220), -rand(160, 240), dir * rand(6, 11), 0.4)
      sparksAt(cx, v.y + v.h / 2, 18)
      juice.shake(0.5)
      juice.freeze(90)
      sfx.hit()
      sfx.golden()
      g.heat = Math.max(0, g.heat - 0.45)
      g.turbo = Math.min(100, g.turbo + 20)
      text(cx, v.y - 6, `TAKEDOWN +${pts}`, '#7dd8ff', 10, 1.2)
    }

    const bumpPlayer = (v: Veh, vxKick: number) => {
      g.vx = vxKick
      g.scroll *= 0.9
      v.cool = 0.8
    }

    const breakProp = (p: Prop) => {
      p.dead = true
      g.stats.breaks++
      g.comboT = Math.max(g.comboT, g.combo > 0 ? 2.2 : 0)
      raiseHeat(0.06)
      missionProgress('break')
      switch (p.kind) {
        case 'cone':
          addScore(10)
          text(p.x, p.y - 8, '+10', '#ff8a3d', 8, 0.7)
          juice.burst(p.x, p.y, ['#ff7a2d', '#ffffff'], { count: 8, speed: 130, life: 0.4, size: 3, drag: 2 })
          tone({ freq: 700, to: 300, dur: 0.07, vol: 0.04, type: 'triangle' })
          break
        case 'mailbox':
          addScore(30)
          text(p.x, p.y - 8, '+30', '#7dd8ff', 8, 0.8)
          juice.burst(p.x, p.y, ['#3a86ff', '#ffffff', '#1f4fa8'], { count: 12, speed: 150, life: 0.5, size: 3, drag: 2 })
          noise({ dur: 0.1, vol: 0.05, freq: 1800 })
          juice.shake(0.12)
          break
        case 'trash':
          addScore(20)
          text(p.x, p.y - 8, '+20', '#aab', 8, 0.8)
          juice.burst(p.x, p.y, ['#8a8a9a', '#55556b', '#c9c9d8'], { count: 12, speed: 130, life: 0.55, size: 3, drag: 2 })
          noise({ dur: 0.12, vol: 0.05, freq: 900 })
          break
        case 'hydrant':
          addScore(50)
          text(p.x, p.y - 8, '+50', '#7dd8ff', 9, 0.9)
          g.fount.push({ x: p.x, y: p.y, t: 1.8 })
          juice.shake(0.2)
          juice.freeze(40)
          noise({ dur: 0.25, vol: 0.06, freq: 3000 })
          tone({ freq: 500, to: 900, dur: 0.15, vol: 0.03, type: 'sine' })
          break
        case 'barrel':
          addScore(80)
          text(p.x, p.y - 10, 'BARRIL +80', '#ff8a3d', 9, 1)
          explode(p.x, p.y, 58)
          juice.freeze(60)
          break
      }
    }

    // ---------- bucle de simulación ----------
    const step = (dt: number, real: number) => {
      const k = pressedRef.current
      const playing = g.phase === 'play'
      g.t += dt

      // distrito (nivel)
      const lvl = 1 + Math.floor(g.t / 26)
      if (playing && lvl > g.level) {
        g.level = lvl
        g.banner = { text: `DISTRITO ${lvl}`, sub: 'Más tráfico, más velocidad', t: 2 }
        sfx.levelUp()
        districtIdx++
        spr = makeSprites(districtIdx)
      }

      g.cruise = Math.min(440, 235 + (g.level - 1) * 26 + g.stars * 7 + Math.min(30, g.t * 0.35))

      // ---- entrada y movimiento del jugador ----
      const steer = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0)
      const hb = playing && k.has('action2')
      g.braking = playing && k.has('down')
      const wantTurbo = playing && k.has('action')
      if (g.lock && g.turbo >= 22) g.lock = false
      const wasBoost = g.boosting
      g.boosting = wantTurbo && g.turbo > 0 && !g.lock
      if (g.boosting && !wasBoost) {
        sfx.boost()
        juice.shake(0.12)
      }
      if (g.boosting) {
        g.turbo -= 34 * dt
        if (g.turbo <= 0) {
          g.turbo = 0
          g.lock = true
          text(g.px + CW / 2, g.py - 12, 'SIN TURBO', '#ff5d5d', 9, 0.9)
          tone({ freq: 200, to: 90, dur: 0.18, vol: 0.04, type: 'sawtooth' })
        }
      } else if (playing) {
        g.turbo = Math.min(100, g.turbo + 5 * dt)
      }

      const onSide = g.px < ROAD_L - 3 || g.px + CW > ROAD_R + 3
      let target = g.cruise
      if (!playing) target = 0
      else if (g.boosting) target = g.cruise + 190
      else if (g.braking) target = g.cruise * 0.6
      else if (hb) target = g.cruise * 0.88
      if (onSide && playing) target *= 0.9
      g.scroll += (target - g.scroll) * Math.min(1, dt * (g.boosting ? 4 : playing ? 2.4 : 3))
      g.dist += g.scroll * dt
      g.dscore += (g.scroll * dt) / 40
      if (g.dscore >= 1) {
        const n = Math.floor(g.dscore)
        g.dscore -= n
        g.score += n
      }

      if (playing) {
        const maxV = hb ? 300 : 245
        const grip = hb ? 330 : 1700
        g.vx += clamp(steer * maxV - g.vx, -grip * dt, grip * dt)
        const vyT = ((k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0)) * 140
        g.vy += clamp(vyT - g.vy, -900 * dt, 900 * dt)
        g.px += g.vx * dt
        g.py += g.vy * dt
        g.py = clamp(g.py, PY_MIN, PY_MAX)
        const lo = SW_L - 2
        const hi = SW_R - CW + 2
        if (g.px < lo || g.px > hi) {
          g.px = clamp(g.px, lo, hi)
          if (Math.abs(g.vx) > 90) {
            sparksAt(g.px < W / 2 ? g.px : g.px + CW, g.py + CH / 2, 8, g.px < W / 2 ? 0 : Math.PI)
            juice.shake(0.14)
            noise({ dur: 0.08, vol: 0.04, freq: 2200 })
            g.scroll *= 0.97
          }
          g.vx = -g.vx * 0.25
        }
        if (onSide) {
          juice.trauma = Math.max(juice.trauma, 0.1)
          g.wallT -= dt
        }
        const rotT = (g.vx / maxV) * 0.2 + (hb ? (g.vx / 300) * 0.32 : 0)
        g.rot += (rotT - g.rot) * Math.min(1, dt * 14)
      } else {
        g.vx *= 1 - Math.min(1, dt * 3)
        g.rot *= 1 - Math.min(1, dt * 3)
      }

      // ---- derrape ----
      const skid = playing && hb && Math.abs(g.vx) > 45 && g.scroll > 120
      if (skid) {
        g.driftT += dt
        g.driftScore += (45 + g.driftT * 40) * dt
        g.turbo = Math.min(100, g.turbo + 15 * dt)
        missionProgress('drift', dt)
        g.skidT -= dt
        if (g.skidT <= 0) {
          g.skidT = 0.03
          const c = Math.cos(g.rot)
          const s = Math.sin(g.rot)
          const cx = g.px + CW / 2
          const cy = g.py + CH / 2
          for (const off of [-8, 8]) {
            const lx = off
            const ly = 13
            const wx = cx + lx * c - ly * s
            const wy = cy + lx * s + ly * c
            pushDecal(wx, wy)
          }
          if (Math.random() < 0.6) {
            juice.burst(cx - Math.sin(g.rot) * -13, cy + 14, ['#6b6b82', '#8c8ca6'], {
              count: 1,
              speed: 20,
              life: 0.5,
              size: 5,
              drag: 1.5,
            })
          }
        }
        if (Math.random() < 0.04) noise({ dur: 0.1, vol: 0.02, freq: 2600 })
      } else if (g.driftT > 0) {
        if (g.driftT > 0.6 && playing) {
          const pts = Math.round(g.driftScore)
          addScore(pts)
          text(g.px + CW / 2, g.py - 14, `DERRAPE +${pts}`, '#7dd8ff', 9, 1)
          sfx.nearMiss()
        }
        g.driftT = 0
        g.driftScore = 0
      }

      if (g.invuln > 0) g.invuln -= dt
      if (g.comboT > 0) {
        g.comboT -= dt
        if (g.comboT <= 0) g.combo = 0
      }

      // ---- calor y estrellas ----
      if (playing) {
        if (!g.spotted) g.heat = Math.max(0, g.heat - 0.085 * dt)
        const ns = g.heat > 0.001 ? Math.min(5, Math.ceil(g.heat)) : 0
        if (ns > g.stars) {
          text(W / 2, 100, `BUSCADO  ${ns}/5`, '#ff5d5d', 11, 1.3)
          juice.flash('#ff3b3b', 0.18)
          sfx.siren()
        }
        g.stars = ns
      }

      // ---- apariciones ----
      if (playing) {
        g.tTraffic -= dt
        if (g.tTraffic <= 0) {
          g.tTraffic = Math.max(0.5, 1.25 - g.level * 0.07 - g.stars * 0.03) * rand(0.7, 1.3)
          spawnTraffic(g.spawned < 3)
        }
        if (g.stars >= 1) {
          g.tCop -= dt * (g.spotted ? 2 : 1)
          const nCops = g.vehs.filter((v) => v.kind === 'cop' && v.wreck <= 0).length
          if (g.tCop <= 0) {
            g.tCop = Math.max(2.0, 6.5 - g.stars * 0.95) * rand(0.8, 1.2)
            if (nCops < Math.min(6, g.stars + 1)) spawnCop()
          }
        }
        if (g.stars >= 3) {
          g.tBlock -= dt
          if (g.tBlock <= 0) {
            g.tBlock = Math.max(9, 19 - g.stars * 2) * rand(0.85, 1.2)
            spawnBlock()
          }
        }
        if (g.stars >= 4 && !g.heli) spawnHeli()
        g.tCone -= dt
        if (g.tCone <= 0) {
          g.tCone = rand(6, 11)
          spawnCones()
        }
        g.tSide -= dt
        if (g.tSide <= 0) {
          g.tSide = rand(0.9, 1.7)
          spawnSideProp()
        }
        g.tCash -= dt
        if (g.tCash <= 0) {
          g.tCash = rand(4.5, 7.5)
          spawnCash()
        }
        g.tPick -= dt
        if (g.tPick <= 0) {
          g.tPick = rand(24, 34)
          const wrench = g.armor < 4 && Math.random() < 0.7
          g.picks.push({ kind: wrench ? 'wrench' : 'nitro', x: laneCx((Math.random() * 4) | 0), y: -24, ph: 0 })
        }
        // misiones
        if (g.mission) {
          g.mission.left -= dt
          if (g.mission.left <= 0) {
            text(W / 2, 120, 'MISION FALLIDA', '#ff5d5d', 10, 1.2)
            tone({ freq: 220, to: 110, dur: 0.3, vol: 0.05, type: 'sawtooth' })
            g.mission = null
            g.missionDelay = rand(4, 7)
          }
        } else {
          g.missionDelay -= dt
          if (g.missionDelay <= 0) newMission()
        }
      }
      if (g.banner) {
        g.banner.t -= real
        if (g.banner.t <= 0) g.banner = null
      }

      // ---- vehículos ----
      const pbx = g.px + 5
      const pby = g.py + 5
      const pbw = CW - 10
      const pbh = CH - 10
      const pcx = g.px + CW / 2
      const pcy = g.py + CH / 2
      let nearCops = false
      for (const v of g.vehs) {
        v.hit = Math.max(0, v.hit - dt)
        v.cool = Math.max(0, v.cool - dt)
        if (v.wreck > 0) {
          v.x += v.vx * dt
          v.y += (g.scroll - v.own) * dt + v.vy * dt
          v.vx *= 1 - Math.min(1, 1.1 * dt)
          v.vy *= 1 - Math.min(1, 1.4 * dt)
          v.own *= 1 - Math.min(1, 0.9 * dt)
          v.rot += v.rv * dt
          if (v.x < SW_L - 6 || v.x + v.w > SW_R + 6) {
            v.x = clamp(v.x, SW_L - 6, SW_R + 6 - v.w)
            v.vx = -v.vx * 0.5
          }
          if (Math.random() < 0.5) {
            juice.burst(v.x + v.w / 2, v.y + v.h / 2, Math.random() < 0.5 ? SMOKE : ['#ff8a3d', '#ffd23d'], {
              count: 1,
              speed: 25,
              life: 0.45,
              size: 4,
              drag: 1.5,
            })
          }
          v.wreck -= dt
          if (v.wreck <= 0) {
            v.wreck = -1
            explode(v.x + v.w / 2, v.y + v.h / 2, 48)
          }
          continue
        }
        if (v.kind === 'cop') {
          const stars = Math.max(1, g.stars)
          v.sway += dt
          // control de posición relativa
          const slip = (g.scroll - g.cruise) * 0.85
          const upMax = 75 + stars * 14
          if (v.st === 0 || v.st === 1) {
            const sideMode = v.st === 1 && v.side !== 0
            const tgtY = sideMode ? g.py + 4 : v.st === 1 ? g.py + 70 : g.py + v.gap
            let tgtX = pcx
            if (sideMode) tgtX = clamp(pcx + v.side * 64, ROAD_L + 14, ROAD_R - 14)
            const vy = clamp((tgtY - v.y) * 2, -upMax, 120) + slip
            v.y += vy * dt
            const cxs = v.x + v.w / 2
            const sp = (sideMode ? 150 : 62 + stars * 13) * dt
            v.x += clamp(tgtX - cxs, -sp, sp)
            v.cd -= dt
            if (v.st === 0 && v.cd <= 0 && playing && v.y < g.py + 190) {
              v.st = 1
              v.stT = stars >= 4 ? 0.5 : 0.65
              v.side = stars >= 3 && Math.random() < 0.5 ? (pcx < W / 2 ? 1 : -1) : 0
              tone({ freq: 900, to: 1400, dur: 0.12, vol: 0.03, type: 'square' })
            } else if (v.st === 1) {
              v.stT -= dt
              if (v.stT <= 0) {
                v.st = 2
                v.stT = 0.7
                const cx = v.x + v.w / 2
                const cy = v.y + v.h / 2
                let dx = pcx - cx
                let dy = pcy - cy
                const len = Math.hypot(dx, dy) || 1
                dx /= len
                dy /= len
                v.dx = dx
                v.dy = dy
                noise({ dur: 0.15, vol: 0.035, freq: 1500 })
              }
            }
          } else {
            const sp = 330
            v.x += v.dx * sp * dt
            v.y += v.dy * sp * dt + slip * dt
            v.stT -= dt
            if (v.stT <= 0) {
              v.st = 0
              v.cd = Math.max(1.1, rand(2.2, 4.2) - stars * 0.3)
            }
          }
          v.x = clamp(v.x, SW_L - 2, SW_R - v.w + 2)
          if (v.y < g.py + 200) v.near = true
          if (v.y < g.py + 240 && v.y > g.py - 40) nearCops = true
          if (v.y > H + 100) {
            if (v.near && playing) {
              addScore(100)
              text(W / 2, H - 70, 'POLICIA EVADIDA +100', '#5df2a3', 9, 1.1)
              sfx.coin()
            }
            v.wreck = -2
          }
          if (v.y < -80) v.wreck = -2
        } else {
          // tráfico normal
          v.y += (g.scroll - v.own) * dt
          v.laneT -= dt
          const cxs = v.x + v.w / 2
          if (Math.abs(v.tx - cxs) > 1) v.x += clamp(v.tx - cxs, -45 * dt, 45 * dt)
          else v.x += Math.sin(g.clock * 1.3 + v.sway) * 5 * dt
          // los taxis intentan huir si vienes detrás
          if (v.kind === 'taxi' && playing && v.laneT <= 0 && v.y < g.py - 20 && v.y > g.py - 190 && Math.abs(cxs - pcx) < 34) {
            const dir = cxs < W / 2 ? 1 : -1
            const nx = clamp(v.tx + dir * LANE_W, laneCx(0), laneCx(3))
            if (!g.vehs.some((o) => o !== v && Math.abs(o.x + o.w / 2 - nx) < 28 && Math.abs(o.y - v.y) < 90)) {
              v.tx = nx
              v.laneT = 3
            }
          }
          if (v.y > H + 80) v.wreck = -2
        }

        // colisión con el jugador
        if (!playing || v.wreck !== 0) continue
        const hx = v.x + 3
        const hy = v.y + 3
        const hw = v.w - 6
        const hh = v.h - 6
        const overlapY = pby < hy + hh + 5 && pby + pbh > hy - 5
        if (pbx < hx + hw && pbx + pbw > hx && pby < hy + hh && pby + pbh > hy) {
          if (v.cool > 0) continue
          const dir = v.x + v.w / 2 >= pcx ? -1 : 1
          if (v.kind === 'taxi') {
            ramTaxi(v)
          } else if (v.kind === 'cop') {
            if (g.boosting || g.invuln > 0.9) {
              takedownCop(v)
            } else if (hurt('cop')) {
              wreckVeh(v, -dir * rand(120, 180), -rand(80, 160), -dir * rand(5, 9), 0.45)
              g.vx = dir * 160
            } else {
              v.cool = 0.5
            }
          } else {
            // civil o camión
            if (hurt('crash')) {
              if (v.kind === 'civ') {
                v.tx = clamp(v.tx - dir * LANE_W, laneCx(0), laneCx(3))
                v.laneT = 3
                v.hit = 0.2
              }
              bumpPlayer(v, dir * 190)
              text(v.x + v.w / 2, v.y - 6, v.kind === 'truck' ? 'CAMION' : 'CIVIL', '#ff5d5d', 8, 0.9)
              if (v.kind === 'truck') g.scroll *= 0.6
            } else {
              v.cool = 0.4
            }
          }
          continue
        }
        // rozón (casi choque)
        if (!v.nm && overlapY) {
          const gapX = Math.max(hx - (pbx + pbw), pbx - (hx + hw))
          if (gapX > 0 && gapX < 8) {
            v.nm = true
            g.stats.near++
            const pts = 25 * mult()
            addScore(pts)
            g.turbo = Math.min(100, g.turbo + 10)
            g.comboT = Math.max(g.comboT, g.combo > 0 ? 2.5 : 0)
            text(v.x + v.w / 2 + (hx > pbx ? -22 : 22), pcy, `RASPON +${pts}`, '#7dd8ff', 8, 0.9)
            sfx.nearMiss()
            missionProgress('near')
          }
        }
      }
      g.vehs = g.vehs.filter((v) => v.wreck !== -1 && v.wreck !== -2)
      void nearCops

      // ---- props ----
      for (const p of g.props) {
        p.y += g.scroll * dt
        if (!p.dead && playing && Math.abs(p.x - pcx) < 14 && Math.abs(p.y - pcy) < 20) breakProp(p)
      }
      g.props = g.props.filter((p) => !p.dead && p.y < H + 30)

      // ---- recogibles ----
      for (const p of g.picks) {
        p.y += g.scroll * dt
        p.ph += dt * 6
      }
      for (const p of g.picks) {
        if (!playing) break
        if (Math.abs(p.x - pcx) < 17 && Math.abs(p.y - pcy) < 24) {
          p.y = H + 999
          if (p.kind === 'cash') {
            const pts = 30 * mult()
            addScore(pts)
            g.stats.cash++
            g.turbo = Math.min(100, g.turbo + 3)
            text(p.x, p.y - 6, `+${pts}`, '#5df2a3', 8, 0.7)
            tone({ freq: 880 + Math.min(g.stats.cash % 8, 7) * 90, dur: 0.07, vol: 0.04, type: 'triangle' })
            juice.burst(p.x, pcy - 10, ['#5df2a3', '#c8ffe0'], { count: 5, speed: 70, life: 0.35, size: 2.5 })
            missionProgress('cash')
          } else if (p.kind === 'wrench') {
            g.armor = Math.min(4, g.armor + 1)
            text(pcx, pcy - 20, 'REPARADO +1', '#5df2a3', 9, 1.1)
            juice.burst(pcx, pcy, ['#5df2a3', '#ffffff'], { count: 14, speed: 120, life: 0.6, size: 3 })
            sfx.potion()
          } else {
            g.turbo = 100
            g.lock = false
            text(pcx, pcy - 20, 'NITRO LLENO', '#7dd8ff', 9, 1.1)
            juice.burst(pcx, pcy, ['#7dd8ff', '#ffffff'], { count: 14, speed: 120, life: 0.6, size: 3 })
            sfx.power()
          }
        }
      }
      g.picks = g.picks.filter((p) => p.y < H + 30)

      // ---- bloqueos policiales ----
      for (const b of g.blocks) {
        b.y += g.scroll * dt
        const bh = 24
        if (playing) {
          const segs: Array<[boolean, number, number]> = [
            [b.aliveL, SW_L - 6, b.gx0],
            [b.aliveR, b.gx1, SW_R + 6],
          ]
          for (let i = 0; i < 2; i++) {
            const [alive, x0, x1] = segs[i]
            if (!alive) continue
            if (pbx < x1 && pbx + pbw > x0 && pby < b.y + bh && pby + pbh > b.y) {
              const hitNow = hurt('cop', 1)
              if (hitNow || g.invuln > 0) {
                if (i === 0) b.aliveL = false
                else b.aliveR = false
                explode((x0 + x1) / 2, b.y + bh / 2, 40, 1)
                g.scroll *= 0.7
                g.vx = (i === 0 ? 1 : -1) * 120
              }
            }
          }
          if (!b.passed && b.y > g.py + CH) {
            b.passed = true
            const pts = 150 * mult()
            addScore(pts)
            text(W / 2, H - 100, `BLOQUEO SUPERADO +${pts}`, '#5df2a3', 9, 1.2)
            sfx.coin()
          }
        }
      }
      g.blocks = g.blocks.filter((b) => b.y < H + 40)

      // ---- helicóptero ----
      if (g.heli) {
        const h = g.heli
        h.rotor += dt * 40
        h.tick += dt
        if (g.stars < 4) {
          h.y -= 90 * dt
          if (h.y < -80) g.heli = null
          g.spotted = false
        } else {
          const ty = 54 + Math.sin(g.t * 1.1) * 8
          h.y += (ty - h.y) * Math.min(1, dt * 1.5)
          h.x += clamp(pcx - 12 + Math.sin(g.t * 0.8) * 50 - h.x, -75 * dt, 75 * dt)
          const sp = 80 + g.stars * 6
          h.sx += clamp(pcx - h.sx, -sp * dt, sp * dt)
          h.sy += clamp(pcy - 6 - h.sy, -sp * dt, sp * dt)
          const inLight = Math.hypot(h.sx - pcx, h.sy - pcy) < 36 && playing
          g.spotted = inLight
          h.spot = inLight ? h.spot + dt : Math.max(0, h.spot - dt * 1.5)
          h.call = Math.max(0, h.call - dt)
          if (h.spot >= 2.4 && h.call <= 0) {
            h.call = 6
            h.spot = 1
            spawnCop(ROAD_L + 30)
            spawnCop(ROAD_R - 30)
            raiseHeat(0.25)
            text(W / 2, 100, 'REFUERZOS', '#ff5d5d', 11, 1.2)
            juice.shake(0.25)
          }
          helicopterTick += dt
          if (helicopterTick > 0.26) {
            helicopterTick = 0
            tone({ freq: 62, dur: 0.1, vol: 0.02, type: 'triangle' })
          }
        }
      } else {
        g.spotted = false
      }

      // ---- fuentes de hidrante ----
      for (const f of g.fount) {
        f.t -= dt
        f.y += g.scroll * dt
        if (Math.random() < 0.9) {
          juice.burst(f.x, f.y, ['#7dd8ff', '#cfefff', '#ffffff'], {
            count: 2,
            speed: 120,
            life: 0.7,
            size: 2.6,
            gravity: 260,
            angle: -Math.PI / 2,
            arc: 0.9,
            drag: 0.6,
          })
        }
      }
      g.fount = g.fount.filter((f) => f.t > 0)

      // ---- decals y anillos ----
      for (const d of g.decals) {
        d.y += g.scroll * dt
        d.life -= dt
      }
      g.decals = g.decals.filter((d) => d.life > 0 && d.y < H + 20)
      for (const r of g.rings) {
        r.life -= dt
        r.r += (r.max - r.r) * Math.min(1, dt * 12)
      }
      g.rings = g.rings.filter((r) => r.life > 0)

      // ---- muerte ----
      if (g.phase === 'dying') {
        g.deadT += real
        if (g.deadT > 1.1) finish()
      }
    }

    const finish = () => {
      g.phase = 'over'
      const final = Math.round(g.score)
      const isBest = saveBest('hit-and-run', final)
      setNewBest(isBest)
      setBest((b) => Math.max(b, final))
      setScore(final)
      setStats({ taxis: g.stats.taxis, combo: g.maxCombo, meters: Math.floor(g.dist / 12), missions: g.stats.missions })
      setOverTitle(g.cause === 'cop' ? 'TE ATRAPARON' : 'AUTO DESTROZADO')
      setPhase('over')
    }

    const begin = () => {
      districtIdx = 0
      spr = makeSprites(0)
      g = newGame()
      juice.reset()
      g.phase = 'play'
      g.scroll = 240
      lastScoreShown = -1
      lastStars = 0
      setScore(0)
      setStars(0)
      setNewBest(false)
      setPhase('play')
      sfx.start()
      g.banner = { text: 'DISTRITO 1', sub: 'Embiste taxis. Evita civiles.', t: 2.2 }
    }
    beginRef.current = begin

    // ---------- dibujo ----------
    const px2 = (n: number) => Math.round(n)

    const label = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') => {
      ctx.font = `${size}px ${FONT}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillText(s, x + 1.5, y + 1.5)
      ctx.fillStyle = color
      ctx.fillText(s, x, y)
    }

    const drawVeh = (v: Veh) => {
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      const img = v.kind === 'taxi' ? spr.taxi : v.kind === 'cop' ? spr.cop : v.kind === 'truck' ? spr.truck : spr.civ[v.pal]
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(px2(v.x + 3), px2(v.y + 4), v.w, v.h)
      ctx.save()
      ctx.translate(cx, cy)
      let rot = v.rot
      if (v.wreck === 0 && v.kind !== 'cop') rot += (v.tx - cx) * 0.004
      if (v.wreck === 0 && v.kind === 'cop' && v.st === 2) rot += Math.atan2(v.dx, -v.dy) * 0.5
      ctx.rotate(rot)
      ctx.drawImage(img, -v.w / 2, -v.h / 2)
      if (v.hit > 0) {
        ctx.globalAlpha = 0.7
        ctx.fillStyle = '#fff'
        ctx.fillRect(-v.w / 2 + 3, -v.h / 2 + 3, v.w - 6, v.h - 6)
        ctx.globalAlpha = 1
      }
      if (v.kind === 'cop') {
        const on = Math.floor(g.clock * 8 + v.id) % 2 === 0
        ctx.fillStyle = on ? '#ff3b3b' : '#3b6bff'
        ctx.fillRect(-9, -3, 8, 4)
        ctx.fillStyle = on ? '#3b6bff' : '#ff3b3b'
        ctx.fillRect(1, -3, 8, 4)
        if (v.wreck === 0 && v.st === 1) {
          ctx.strokeStyle = Math.floor(g.clock * 16) % 2 === 0 ? '#ff3b3b' : '#ffffff'
          ctx.lineWidth = 2
          ctx.strokeRect(-v.w / 2 - 2, -v.h / 2 - 2, v.w + 4, v.h + 4)
        }
      }
      if (v.wreck > 0) {
        ctx.fillStyle = 'rgba(20,10,10,0.45)'
        ctx.fillRect(-v.w / 2, -v.h / 2, v.w, v.h)
      }
      ctx.restore()
      if (v.kind === 'cop' && v.wreck === 0) {
        const on = Math.floor(g.clock * 8 + v.id) % 2 === 0
        ctx.globalAlpha = 0.13
        ctx.fillStyle = on ? '#ff3b3b' : '#3b6bff'
        ctx.beginPath()
        ctx.arc(cx + (on ? -7 : 7), cy, 26, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    const drawProp = (p: Prop) => {
      const x = p.x
      const y = p.y
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(x + 1, y + 3, 6, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      switch (p.kind) {
        case 'cone':
          ctx.fillStyle = '#ff7a2d'
          ctx.fillRect(x - 5, y - 5, 10, 10)
          ctx.fillStyle = '#fff'
          ctx.fillRect(x - 3, y - 3, 6, 2)
          ctx.fillStyle = '#c24d0a'
          ctx.fillRect(x - 1, y - 1, 2, 2)
          break
        case 'barrel':
          ctx.fillStyle = '#c93a2d'
          ctx.fillRect(x - 7, y - 7, 14, 14)
          ctx.fillStyle = '#ffd23d'
          ctx.fillRect(x - 7, y - 2, 14, 3)
          ctx.fillStyle = '#7a1d14'
          ctx.fillRect(x - 3, y - 3, 6, 6)
          break
        case 'hydrant':
          ctx.fillStyle = '#d33'
          ctx.fillRect(x - 4, y - 4, 8, 8)
          ctx.fillStyle = '#f66'
          ctx.fillRect(x - 6, y - 1, 12, 3)
          ctx.fillStyle = '#fff3b0'
          ctx.fillRect(x - 1, y - 1, 2, 2)
          break
        case 'mailbox':
          ctx.fillStyle = '#1f4fa8'
          ctx.fillRect(x - 5, y - 6, 10, 12)
          ctx.fillStyle = '#3a86ff'
          ctx.fillRect(x - 5, y - 6, 10, 3)
          ctx.fillStyle = '#fff'
          ctx.fillRect(x - 3, y, 6, 1)
          break
        case 'trash':
          ctx.fillStyle = '#55556b'
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#8a8a9a'
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#3b3b4d'
          ctx.fillRect(x - 1, y - 1, 2, 2)
          break
      }
    }

    const drawBlock = (b: Block) => {
      const bh = 24
      const flash = Math.floor(g.clock * 8) % 2 === 0
      const segs: Array<[boolean, number, number]> = [
        [b.aliveL, SW_L - 6, b.gx0],
        [b.aliveR, b.gx1, SW_R + 6],
      ]
      for (const [alive, x0, x1] of segs) {
        // cinta
        if (alive) {
          const n = Math.max(1, Math.round((x1 - x0) / 38))
          const cw = (x1 - x0) / n
          for (let i = 0; i < n; i++) {
            const cx = x0 + cw * (i + 0.5)
            const cy = b.y + bh / 2
            ctx.fillStyle = 'rgba(0,0,0,0.3)'
            ctx.fillRect(cx - 18 + 3, cy - 12 + 4, 36, 24)
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(Math.PI / 2)
            ctx.scale(1, cw / 36 < 1 ? 1 : 1)
            ctx.drawImage(spr.cop, -12, -18)
            ctx.restore()
            ctx.fillStyle = flash ? '#ff3b3b' : '#3b6bff'
            ctx.fillRect(cx - 8, cy - 4, 8, 7)
            ctx.fillStyle = flash ? '#3b6bff' : '#ff3b3b'
            ctx.fillRect(cx, cy - 4, 8, 7)
          }
        }
      }
      // flechas de paso
      ctx.fillStyle = flash ? '#fff3b0' : '#ffc531'
      const gx = (b.gx0 + b.gx1) / 2
      ctx.fillRect(b.gx0 - 3, b.y, 3, bh)
      ctx.fillRect(b.gx1, b.y, 3, bh)
      if (b.y < 30) {
        ctx.fillStyle = flash ? '#ff3b3b' : '#ffd23d'
        ctx.beginPath()
        ctx.moveTo(gx, 22)
        ctx.lineTo(gx - 14, 2)
        ctx.lineTo(gx + 14, 2)
        ctx.closePath()
        ctx.fill()
        label('!', gx, 9, 8, '#000', 'center')
      }
    }

    const drawHeli = (h: Heli) => {
      const hx = h.x + 12
      // cono de luz
      const red = clamp(h.spot / 2.4, 0, 1)
      const col = red > 0.4 ? '255,90,70' : '255,250,210'
      ctx.fillStyle = `rgba(${col},${0.1 + red * 0.1})`
      ctx.beginPath()
      ctx.moveTo(hx - 3, h.y + 6)
      ctx.lineTo(hx + 3, h.y + 6)
      ctx.lineTo(h.sx + 38, h.sy)
      ctx.lineTo(h.sx - 38, h.sy)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = `rgba(${col},${0.2 + red * 0.15})`
      ctx.beginPath()
      ctx.ellipse(h.sx, h.sy, 38, 30, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(${col},0.5)`
      ctx.lineWidth = 1.5
      ctx.stroke()
      // helicóptero
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(hx - 7 + 8, h.y - 12 + 18, 14, 26)
      ctx.fillStyle = '#2b3350'
      ctx.fillRect(hx - 7, h.y - 12, 14, 24)
      ctx.fillStyle = '#7dd8ff'
      ctx.fillRect(hx - 5, h.y - 10, 10, 8)
      ctx.fillStyle = '#2b3350'
      ctx.fillRect(hx - 2, h.y + 12, 4, 18)
      ctx.fillRect(hx - 6, h.y + 26, 12, 3)
      ctx.fillStyle = Math.floor(g.clock * 4) % 2 ? '#ff3b3b' : '#3b6bff'
      ctx.fillRect(hx - 1, h.y + 28, 3, 3)
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#cfd6ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(hx + Math.cos(h.rotor) * 34, h.y + Math.sin(h.rotor) * 34)
      ctx.lineTo(hx - Math.cos(h.rotor) * 34, h.y - Math.sin(h.rotor) * 34)
      ctx.moveTo(hx + Math.cos(h.rotor + 1.57) * 34, h.y + Math.sin(h.rotor + 1.57) * 34)
      ctx.lineTo(hx - Math.cos(h.rotor + 1.57) * 34, h.y - Math.sin(h.rotor + 1.57) * 34)
      ctx.stroke()
      ctx.globalAlpha = 0.1
      ctx.fillStyle = '#cfd6ff'
      ctx.beginPath()
      ctx.arc(hx, h.y, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    const drawPlayer = () => {
      if (g.phase === 'dying' || g.phase === 'over') return
      const blink = g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0
      const cx = g.px + CW / 2
      const cy = g.py + CH / 2
      // faros
      if (!blink) {
        const head = ctx.createLinearGradient(0, g.py - 70, 0, g.py)
        head.addColorStop(0, 'rgba(255,244,190,0)')
        head.addColorStop(1, 'rgba(255,244,190,0.2)')
        ctx.fillStyle = head
        ctx.beginPath()
        ctx.moveTo(cx - 8, g.py + 2)
        ctx.lineTo(cx - 24, g.py - 70)
        ctx.lineTo(cx + 24, g.py - 70)
        ctx.lineTo(cx + 8, g.py + 2)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(px2(g.px + 3), px2(g.py + 4), CW, CH)
      if (g.boosting) {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = '#35e0ff'
        ctx.beginPath()
        ctx.ellipse(cx, cy + 2, 22, 30, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(g.rot)
      if (!blink) ctx.drawImage(spr.player, -CW / 2, -CH / 2)
      if (!blink && g.braking) {
        ctx.fillStyle = '#ff2020'
        ctx.fillRect(-9, CH / 2 - 8, 6, 3)
        ctx.fillRect(3, CH / 2 - 8, 6, 3)
        ctx.globalAlpha = 0.25
        ctx.fillRect(-12, CH / 2 - 10, 24, 10)
        ctx.globalAlpha = 1
      }
      if (g.boosting) {
        for (const ox of [-6, 6]) {
          const len = 10 + Math.random() * 12
          ctx.fillStyle = '#35e0ff'
          ctx.fillRect(ox - 2, CH / 2, 4, len)
          ctx.fillStyle = '#fff'
          ctx.fillRect(ox - 1, CH / 2, 2, len * 0.55)
        }
      }
      ctx.restore()
    }

    const drawHud = () => {
      // combo
      if (g.combo > 0) {
        const m = mult()
        label(`x${m}`, 12, 22, 20, m >= 5 ? '#ff5d5d' : m >= 3 ? '#ff8a3d' : '#ffd23d')
        label('COMBO', 12, 40, 7, '#ffffff')
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(12, 48, 56, 4)
        ctx.fillStyle = '#ffd23d'
        ctx.fillRect(12, 48, 56 * clamp(g.comboT / 4.5, 0, 1), 4)
      }
      // blindaje
      for (let i = 0; i < 4; i++) {
        const x = W - 18 - i * 16
        ctx.fillStyle = i < g.armor ? '#5df2a3' : 'rgba(255,255,255,0.15)'
        ctx.fillRect(x, 12, 12, 12)
        ctx.fillStyle = i < g.armor ? '#c8ffe0' : 'rgba(255,255,255,0.1)'
        ctx.fillRect(x + 2, 14, 8, 2)
      }
      // medidor de turbo
      const bw = 150
      const bx = (W - bw) / 2
      const by = H - 18
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(bx - 2, by - 2, bw + 4, 12)
      const tcol = g.lock ? '#ff5d5d' : g.turbo > 99 ? '#ffffff' : '#35e0ff'
      ctx.fillStyle = tcol
      ctx.fillRect(bx, by, bw * clamp(g.turbo / 100, 0, 1), 8)
      if (g.lock) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.fillRect(bx + bw * 0.22 - 1, by - 2, 2, 12)
      }
      label('TURBO', bx - 6, by + 4, 7, '#cfefff', 'right')
      // misión
      if (g.mission && g.phase === 'play') {
        const m = g.mission
        const mw = 240
        const mx = 76
        const my = 36
        ctx.fillStyle = 'rgba(8,8,20,0.72)'
        ctx.fillRect(mx, my, mw, 26)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(mx, my + 22, mw, 4)
        ctx.fillStyle = m.left < 4 ? '#ff5d5d' : '#5df2a3'
        ctx.fillRect(mx, my + 22, mw * clamp(m.left / m.total, 0, 1), 4)
        const prog = m.kind === 'drift' ? `${Math.min(m.need, Math.floor(m.have))}/${m.need}` : `${m.have}/${m.need}`
        label(m.label, mx + 6, my + 10, 7, '#ffffff')
        label(prog, mx + mw - 6, my + 10, 7, '#ffd23d', 'right')
      }
      // alerta de calor
      if (g.spotted) {
        const f = Math.floor(g.clock * 8) % 2 === 0
        label('EN EL FOCO', W / 2, H - 38, 8, f ? '#ff5d5d' : '#ffffff', 'center')
      }
      // cartel de distrito
      if (g.banner) {
        const k = Math.min(1, g.banner.t / 0.4, (2.2 - g.banner.t) / 0.25 + 0.001)
        ctx.globalAlpha = clamp(k, 0, 1)
        ctx.fillStyle = 'rgba(8,8,20,0.7)'
        ctx.fillRect(0, H * 0.3, W, 54)
        ctx.fillStyle = ACCENT
        ctx.fillRect(0, H * 0.3, W, 2)
        ctx.fillRect(0, H * 0.3 + 52, W, 2)
        label(g.banner.text, W / 2, H * 0.3 + 20, 15, ACCENT, 'center')
        label(g.banner.sub, W / 2, H * 0.3 + 40, 7, '#ffffff', 'center')
        ctx.globalAlpha = 1
      }
    }

    const draw = () => {
      ctx.save()
      ctx.fillStyle = '#0a0a13'
      ctx.fillRect(0, 0, W, H)
      juice.applyShake(ctx)

      // asfalto
      const ao = Math.floor(g.dist) % ASPHALT_TILE
      for (let y = ao - ASPHALT_TILE; y < H; y += ASPHALT_TILE) ctx.drawImage(spr.asphalt, ROAD_L, y)

      // marcas del suelo
      for (const d of g.decals) {
        if (d.kind === 0) {
          ctx.globalAlpha = clamp(d.life / 1.4, 0, 0.55)
          ctx.fillStyle = '#05050a'
          ctx.fillRect(Math.round(d.x - 1.5), Math.round(d.y - 2), 3, 5)
        } else {
          ctx.globalAlpha = clamp(d.life / 3, 0, 0.55)
          ctx.fillStyle = '#05050a'
          ctx.beginPath()
          ctx.ellipse(d.x, d.y, 20, 15, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // líneas de carril
      ctx.fillStyle = '#9a9ab4'
      const dashOff = Math.floor(g.dist) % 48
      for (let i = 1; i < 4; i++) {
        const lx = ROAD_L + LANE_W * i
        for (let y = dashOff - 48; y < H; y += 48) ctx.fillRect(Math.round(lx - 1.5), y, 3, 24)
      }
      // pasos de cebra
      const crossGap = 2400
      const cIdx = Math.floor((g.dist - H) / crossGap)
      for (let ci = cIdx; ci <= cIdx + 2; ci++) {
        const wy = H - (ci * crossGap + crossGap * 0.6 - g.dist)
        if (wy < -50 || wy > H + 20) continue
        ctx.fillStyle = 'rgba(220,220,235,0.55)'
        for (let sx = ROAD_L + 4; sx < ROAD_R - 6; sx += 14) ctx.fillRect(sx, Math.round(wy), 8, 26)
      }

      // banquetas y azoteas
      const so = Math.floor(g.dist * 1) % SIDE_TILE
      for (let y = so - SIDE_TILE; y < H; y += SIDE_TILE) {
        ctx.drawImage(spr.sideL, 0, y)
        ctx.save()
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(spr.sideR, 0, y)
        ctx.restore()
      }
      // bordes de calle
      ctx.fillStyle = '#d8d8c8'
      ctx.fillRect(ROAD_L, 0, 2, H)
      ctx.fillRect(ROAD_R - 2, 0, 2, H)

      // charcos de luz de farolas
      const lampGap = 230
      const lo = Math.floor(g.dist) % lampGap
      ctx.globalAlpha = 0.55
      for (let y = lo - lampGap; y < H + 60; y += lampGap) {
        ctx.drawImage(spr.glow, ROAD_L - 38, y - 64)
        ctx.drawImage(spr.glow, ROAD_R - 90, y + lampGap / 2 - 64)
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffe9a0'
      for (let y = lo - lampGap; y < H + 60; y += lampGap) {
        ctx.fillRect(ROAD_L - 6, y - 2, 4, 4)
        ctx.fillRect(ROAD_R + 2, y + lampGap / 2 - 2, 4, 4)
      }

      // foco del helicóptero se dibuja luego; props y recogibles
      for (const p of g.props) drawProp(p)
      for (const f of g.fount) {
        ctx.fillStyle = 'rgba(125,216,255,0.25)'
        ctx.beginPath()
        ctx.ellipse(f.x, f.y + 2, 11, 6, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const b of g.blocks) drawBlock(b)
      for (const p of g.picks) {
        const bob = Math.sin(p.ph) * 2
        if (p.kind === 'cash') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.fillRect(p.x - 5, p.y + 4 + bob, 10, 3)
          ctx.fillStyle = '#2fa86a'
          ctx.fillRect(p.x - 6, p.y - 4 + bob, 12, 8)
          ctx.fillStyle = '#7dffb8'
          ctx.fillRect(p.x - 4, p.y - 2 + bob, 8, 4)
          ctx.fillStyle = '#1b6b44'
          ctx.fillRect(p.x - 1, p.y - 1 + bob, 2, 2)
        } else {
          ctx.fillStyle = p.kind === 'wrench' ? '#5df2a3' : '#35e0ff'
          ctx.globalAlpha = 0.3
          ctx.beginPath()
          ctx.arc(p.x, p.y + bob, 14, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.fillStyle = p.kind === 'wrench' ? '#2fa86a' : '#1a88b0'
          ctx.fillRect(p.x - 8, p.y - 8 + bob, 16, 16)
          ctx.fillStyle = '#fff'
          if (p.kind === 'wrench') {
            ctx.fillRect(p.x - 2, p.y - 6 + bob, 4, 12)
            ctx.fillRect(p.x - 6, p.y - 2 + bob, 12, 4)
          } else {
            ctx.fillRect(p.x - 5, p.y - 6 + bob, 4, 12)
            ctx.fillRect(p.x + 1, p.y - 6 + bob, 4, 12)
          }
        }
      }

      // vehículos (los destrozados al fondo)
      for (const v of g.vehs) if (v.wreck > 0) drawVeh(v)
      for (const v of g.vehs) if (v.wreck === 0) drawVeh(v)
      drawPlayer()

      // líneas de velocidad con el turbo
      if (g.boosting || g.scroll > g.cruise + 60) {
        ctx.fillStyle = 'rgba(200,240,255,0.25)'
        for (let i = 0; i < 9; i++) {
          const sx = ROAD_L + ((i * 53 + Math.floor(g.dist * 0.7)) % (ROAD_R - ROAD_L))
          const sy = (g.dist * 2.2 + i * 97) % (H + 80)
          ctx.fillRect(sx, sy - 40, 1.5, 36)
        }
      }

      if (g.heli) drawHeli(g.heli)

      // anillos de explosión
      for (const r of g.rings) {
        ctx.globalAlpha = clamp(r.life / 0.35, 0, 1) * 0.8
        ctx.strokeStyle = r.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, FONT)
      ctx.restore()

      // viñeta y UI (sin temblor)
      ctx.drawImage(spr.vignette, 0, 0)
      if (g.phase !== 'ready') drawHud()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(8,8,20,0.7)'
        ctx.fillRect(0, 0, W, H)
        label('PAUSA', W / 2, H / 2 - 10, 20, ACCENT, 'center')
        label('Pulsa P para seguir', W / 2, H / 2 + 22, 8, '#fff', 'center')
      }
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000)
      last = now
      const jp = justPressedRef.current
      const k = pressedRef.current

      if (g.phase === 'ready') {
        if (jp.has('action') || jp.has('up') || jp.has('left') || jp.has('right')) begin()
      } else if (g.phase === 'over') {
        if (jp.has('action')) begin()
      } else if (jp.has('pause')) {
        g.paused = !g.paused
        sfx.pause()
      }
      void k

      if (!g.paused) {
        g.clock += real
        let dt = juice.update(real)
        if (g.phase === 'dying') dt *= 0.35
        if (g.phase !== 'ready') step(dt, real)
        else {
          // ambiente en la pantalla de título: el mundo avanza despacio
          g.dist += 90 * real
        }
      }
      jp.clear()

      // marcador de React (throttle)
      hudT += real
      if (hudT > 0.1) {
        hudT = 0
        const sc = Math.round(g.score)
        if (sc !== lastScoreShown) {
          lastScoreShown = sc
          setScore(sc)
        }
        if (g.stars !== lastStars) {
          lastStars = g.stars
          setStars(g.stars)
        }
      }

      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const autoPause = () => {
      if (g.phase === 'play' && !g.paused) g.paused = true
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
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#34344a] bg-[#0a0a13] shadow-[0_0_40px_rgba(255,197,49,0.15)]"
        hud={
          <Hud>
            <span className="whitespace-nowrap text-[#ffc531]">PTS {score.toLocaleString('es-MX')}</span>
            <span className="flex items-center gap-0.5" aria-label={`Nivel de búsqueda ${stars} de 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} viewBox="0 0 10 10" className={`size-3 ${i < stars ? 'text-[#ff5d5d]' : 'text-white/20'}`} fill="currentColor">
                  <path d="M5 .5 6.5 3.7 10 4.1 7.4 6.5 8.1 10 5 8.2 1.9 10 2.6 6.5 0 4.1 3.5 3.7z" />
                </svg>
              ))}
            </span>
            <span className="whitespace-nowrap text-white/60">HI {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ imageRendering: 'pixelated' }}
          aria-label="Juego Hit and Run"
        />
        {phase === 'ready' && (
          <StartOverlay
            title="HIT & RUN"
            accent={ACCENT}
            subtitle="Embiste taxis para armar combos, esquiva a los civiles y no dejes que la policía te alcance."
            hint="Flechas mover · ESPACIO turbo · X derrape"
            touchHint="Cruceta mover · Turbo y Derrape a la derecha"
            onStart={() => beginRef.current()}
          />
        )}
        {phase === 'over' && (
          <GameOverOverlay
            title={overTitle}
            accent={ACCENT}
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Taxis', value: stats.taxis },
              { label: 'Combo máx.', value: `x${Math.min(8, 1 + stats.combo)}` },
              { label: 'Metros', value: stats.meters },
              { label: 'Misiones', value: stats.missions },
            ]}
            onRestart={() => beginRef.current()}
          />
        )}
      </GameScreen>
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Turbo"
        actionGlyph="T"
        showAction2
        action2Label="Derrape"
        action2Glyph="D"
      />
    </div>
  )
}
