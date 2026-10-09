'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, renderScale, aabb, rr } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { Hud, StartOverlay, GameOverOverlay, type OverlayStat } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

const ID = 'space-invasion'
const ACCENT = '#5fe8de'
const W0 = 400
const H0 = 540
// Campo lógico: se ajusta a la pantalla (ver layout). Búnkeres y nave van pegados al fondo.
let W = W0
let H = H0

// ---------- Sprites (pixel art) ----------
const SQUID_A = ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X']
const SQUID_B = ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.']
const CRAB_A = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...']
const CRAB_B = ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.']
const OCTO_A = ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX']
const OCTO_B = ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..']
const ARMOR_A = ['..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXX.XX.XXXX', 'XXXXXXXXXXXX', 'XXX.XXXX.XXX', 'XXXXXXXXXXXX', '.XX.X..X.XX.', '.XX......XX.']
const ARMOR_B = ['..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXX.XX.XXXX', 'XXXXXXXXXXXX', 'XXX.XXXX.XXX', 'XXXXXXXXXXXX', '.XX.X..X.XX.', 'XX........XX']
const BURST_A = ['....XXX....', '...XXXXX...', '.XXXXXXXXX.', 'XX.XXXXX.XX', 'XXXXXXXXXXX', 'X.XX.X.XX.X', 'X.X..X..X.X', '...XX.XX...']
const BURST_B = ['....XXX....', '...XXXXX...', '.XXXXXXXXX.', 'XX.XXXXX.XX', 'XXXXXXXXXXX', 'X.XX.X.XX.X', '.X.XX.XX.X.', 'X.........X']
const SPLIT_A = ['..XX..XX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXX..XXXX', '.XX.XX.XX.', 'X..X..X..X']
const SPLIT_B = ['..XX..XX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXX..XXXX', 'X.XX..XX.X', '..X....X..']
const DRONE_A = ['X.XXX.X', 'XXXXXXX', '.X.X.X.', '..XXX..', '...X...']
const DRONE_B = ['X.XXX.X', 'XXXXXXX', 'X.....X', '..XXX..', '...X...']
const SHIP = [
  '.....X.....',
  '.....X.....',
  '....XXX....',
  '.X..XXX..X.',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XX.XXXXX.XX',
]
const UFO = ['....XXXXX....', '..XXXXXXXXX..', '.XXXXXXXXXXX.', 'XX.XX.X.XX.XX', 'XXXXXXXXXXXXX', '..XXX...XXX..']
const BOSS = [
  '........XXXXXXXX........',
  '......XXXXXXXXXXXX......',
  '....XXXXXXXXXXXXXXXX....',
  '..XXXXXXXXXXXXXXXXXXXX..',
  '.XXXX..XXXXXXXXXX..XXXX.',
  'XXXXX..XXXXXXXXXX..XXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXX.XXXXXX.XXXXXXXX',
  'XXXX.XXX.XX..XX.XXX.XXXX',
  'XXX...XX........XX...XXX',
  'XX....X..X....X..X....XX',
  'X.....X..........X.....X',
]

const spriteCache = new WeakMap<string[], Map<string, HTMLCanvasElement>>()
function sprite(mat: string[], color: string, cell: number, dpr: number): HTMLCanvasElement {
  let byColor = spriteCache.get(mat)
  if (!byColor) {
    byColor = new Map()
    spriteCache.set(mat, byColor)
  }
  const key = `${color}|${cell}|${dpr}`
  let cv = byColor.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = mat[0].length * cell * dpr
    cv.height = mat.length * cell * dpr
    const c = cv.getContext('2d')
    if (c) {
      c.fillStyle = color
      const s = cell * dpr
      for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
          if (mat[y][x] === 'X') c.fillRect(x * s, y * s, s, s)
        }
      }
    }
    byColor.set(key, cv)
  }
  return cv
}

// ---------- Constantes de juego ----------
const GX = 34
const GY = 26
const FORM_TOP = 62
let BUNK_Y = H0 - 136
const BUNK_W = 24
const BUNK_H = 16
const BUNK_C = 2
let SHIP_Y_MIN = H0 - 66
let SHIP_Y_MAX = H0 - 28
let INVADE_Y = H0 - 90

/** Ajusta el campo al área de la pantalla; búnkeres, nave y línea de invasión se anclan al fondo. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  BUNK_Y = H - 136
  SHIP_Y_MIN = H - 66
  SHIP_Y_MAX = H - 28
  INVADE_Y = H - 90
  publishLogical(f)
}

const PATTERNS: string[][] = [
  ['ggggggg', 'ggggggg', 'ggggggg'],
  ['g.......g', 'gg.....gg', '.gg...gg.', '..ggagg..', '....a....'],
  ['....g....', '...ggg...', '..gbgbg..', '.ggagagg.', '..gbgbg..', '...ggg...', '....g....'],
  ['s.g.s.g.s', '.g.a.a.g.', 'g.s.g.s.g', '.a.g.g.a.'],
  ['aaaaaaaaa', 'ggbgggbgg', 'sgggggggs', 'ggggggggg'],
  ['g.g.g.g.g', 'gbgagagbg', 'g.g.g.g.g', 'gsg.g.gsg'],
]

type Kind = 'grunt' | 'armor' | 'burst' | 'splitter' | 'drone'
type EState = 'form' | 'dive' | 'return'
type PType = 'double' | 'triple' | 'shield' | 'beam'

interface Enemy {
  kind: Kind
  look: number
  sx: number
  sy: number
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  pts: number
  st: EState
  t: number
  x0: number
  amp: number
  freq: number
  phase: number
  vy: number
  drift: number
  fired: boolean
  fireT: number
  burstLeft: number
  burstT: number
  flash: number
  trailT: number
  dead: boolean
}
interface Volley {
  alive: number
  hit: boolean
}
interface PBullet {
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  dmg: number
  vol: Volley
  dead: boolean
}
interface EBullet {
  x: number
  y: number
  vx: number
  vy: number
  big: boolean
}
interface PowerUp {
  x: number
  y: number
  type: PType
  t: number
}
interface Bunker {
  x: number
  cells: Uint8Array
}
interface Ufo {
  x: number
  y: number
  vx: number
  sndT: number
}
interface Boss {
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  t: number
  fireT: number
  phase: number
  flash: number
  dying: number
  idx: number
  alt: boolean
  burstLeft: number
  burstT: number
}
interface Banner {
  title: string
  sub: string
  t: number
  dur: number
  color: string
}
interface Star {
  x: number
  y: number
  s: number
  layer: number
  tw: number
}

type Mode = 'title' | 'play' | 'dying' | 'over'

interface State {
  mode: Mode
  paused: boolean
  wantStart: boolean
  time: number
  overT: number
  dyingT: number
  stars: Star[]
  ship: {
    x: number
    y: number
    vx: number
    vy: number
    cool: number
    invuln: number
    shield: number
    weapon: 'single' | 'double' | 'triple'
    weaponT: number
    beamT: number
    beamTick: number
    beamOn: boolean
    beamSnd: number
    trailT: number
  }
  enemies: Enemy[]
  pb: PBullet[]
  eb: EBullet[]
  pups: PowerUp[]
  bunkers: Bunker[]
  ufo: Ufo | null
  ufoT: number
  boss: Boss | null
  formX: number
  formY: number
  dir: number
  total: number
  wave: number
  waveT: number
  introT: number
  clearT: number
  diveT: number
  enemyFireT: number
  banner: Banner | null
  score: number
  lives: number
  chain: number
  bestChain: number
  mult: number
  kills: number
  nextLife: number
  dropPity: number
  tookHit: boolean
  cause: string
  newBest: boolean
  multPop: number
}

// ---------- Búnkers ----------
const BUNK_MASK = new Uint8Array(BUNK_W * BUNK_H)
for (let y = 0; y < BUNK_H; y++) {
  for (let x = 0; x < BUNK_W; x++) {
    let on = true
    const corner = 4 - y
    if (corner > 0 && (x < corner || x >= BUNK_W - corner)) on = false
    if (x >= 8 && x < 16 && y >= 9 + (x === 8 || x === 15 ? 1 : 0)) on = false
    BUNK_MASK[y * BUNK_W + x] = on ? 1 : 0
  }
}
function makeBunker(cx: number): Bunker {
  return { x: cx - (BUNK_W * BUNK_C) / 2, cells: BUNK_MASK.slice() }
}
function erode(b: Bunker, px: number, py: number, rad: number) {
  const cx = (px - b.x) / BUNK_C
  const cy = (py - BUNK_Y) / BUNK_C
  const r2 = Math.ceil(rad)
  for (let y = Math.floor(cy - r2); y <= Math.ceil(cy + r2); y++) {
    if (y < 0 || y >= BUNK_H) continue
    for (let x = Math.floor(cx - r2); x <= Math.ceil(cx + r2); x++) {
      if (x < 0 || x >= BUNK_W) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d <= rad - (Math.random() < 0.4 ? 0.9 : 0)) b.cells[y * BUNK_W + x] = 0
    }
  }
}
function eraseRect(b: Bunker, rx: number, ry: number, rw: number, rh: number) {
  const x0 = Math.max(0, Math.floor((rx - b.x) / BUNK_C))
  const x1 = Math.min(BUNK_W - 1, Math.floor((rx + rw - b.x) / BUNK_C))
  const y0 = Math.max(0, Math.floor((ry - BUNK_Y) / BUNK_C))
  const y1 = Math.min(BUNK_H - 1, Math.floor((ry + rh - BUNK_Y) / BUNK_C))
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.cells[y * BUNK_W + x] = 0
}
function bunkerCellAt(b: Bunker, px: number, py: number): boolean {
  const x = Math.floor((px - b.x) / BUNK_C)
  const y = Math.floor((py - BUNK_Y) / BUNK_C)
  if (x < 0 || x >= BUNK_W || y < 0 || y >= BUNK_H) return false
  return b.cells[y * BUNK_W + x] === 1
}

function makeStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < 80; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 1.6, layer: i % 3, tw: Math.random() * 6 })
  }
  return stars
}

function initial(): State {
  return {
    mode: 'title',
    paused: false,
    wantStart: false,
    time: 0,
    overT: 0,
    dyingT: 0,
    stars: makeStars(),
    ship: {
      x: W / 2,
      y: H - 40,
      vx: 0,
      vy: 0,
      cool: 0,
      invuln: 0,
      shield: 0,
      weapon: 'single',
      weaponT: 0,
      beamT: 0,
      beamTick: 0,
      beamOn: false,
      beamSnd: 0,
      trailT: 0,
    },
    enemies: [],
    pb: [],
    eb: [],
    pups: [],
    bunkers: [50, 150, 250, 350].map(makeBunker),
    ufo: null,
    ufoT: 16,
    boss: null,
    formX: 0,
    formY: FORM_TOP,
    dir: 1,
    total: 1,
    wave: 1,
    waveT: 0,
    introT: 0,
    clearT: -1,
    diveT: 6,
    enemyFireT: 2,
    banner: null,
    score: 0,
    lives: 3,
    chain: 0,
    bestChain: 0,
    mult: 1,
    kills: 0,
    nextLife: 4000,
    dropPity: 0,
    tookHit: false,
    cause: '',
    newBest: false,
    multPop: 0,
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const isBossWave = (n: number) => n % 5 === 0

const KIND_COLOR: Record<Kind, string> = {
  grunt: '#ff71ce',
  armor: '#9db4d6',
  burst: '#ff8a3d',
  splitter: '#c77dff',
  drone: '#d6a8ff',
}
const LOOK_COLORS = ['#ff71ce', '#5fe8de', '#ffd23d']
const PUP_INFO: Record<PType, { label: string; color: string; name: string }> = {
  double: { label: '2X', color: '#4dd0ff', name: 'DISPARO DOBLE' },
  triple: { label: '3X', color: '#ff9f43', name: 'DISPARO TRIPLE' },
  shield: { label: 'E', color: '#8aa8ff', name: 'ESCUDO' },
  beam: { label: 'R', color: '#ff4fd8', name: 'RAYO' },
}

function frames(e: Enemy): string[][] {
  switch (e.kind) {
    case 'grunt':
      return e.look === 0 ? [SQUID_A, SQUID_B] : e.look === 1 ? [CRAB_A, CRAB_B] : [OCTO_A, OCTO_B]
    case 'armor':
      return [ARMOR_A, ARMOR_B]
    case 'burst':
      return [BURST_A, BURST_B]
    case 'splitter':
      return [SPLIT_A, SPLIT_B]
    default:
      return [DRONE_A, DRONE_B]
  }
}

function makeEnemy(kind: Kind, look: number, sx: number, sy: number): Enemy {
  const f = frames({ kind, look } as Enemy)
  const w = f[0][0].length * 2
  const h = f[0].length * 2
  const hp = kind === 'armor' ? 2 : 1
  const pts = kind === 'grunt' ? [30, 20, 10][look] : kind === 'armor' ? 50 : kind === 'burst' ? 60 : kind === 'splitter' ? 50 : 10
  return {
    kind, look, sx, sy, x: 0, y: 0, w, h, hp, maxHp: hp, pts, st: 'form',
    t: 0, x0: 0, amp: 0, freq: 0, phase: 0, vy: 0, drift: 0, fired: false,
    fireT: 3 + Math.random() * 3, burstLeft: 0, burstT: 0, flash: 0, trailT: 0, dead: false,
  }
}

export default function SpaceInvasion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const stateRef = useRef<State>(initial())
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest(ID) : 0))
  const [ui, setUi] = useState({
    mode: 'title' as 'title' | 'play' | 'over',
    score: 0,
    wave: 1,
    lives: 3,
    newBest: false,
    bestChain: 0,
    kills: 0,
    cause: '',
  })

  const requestStart = useCallback(() => {
    stateRef.current.wantStart = true
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    stateRef.current = initial()
    const dpr = renderScale()
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) throw new Error('Canvas 2D no disponible')
    const ctx = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    const fam = getComputedStyle(canvas).getPropertyValue('--font-pixel').trim()
    const FONT = fam ? `${fam}, monospace` : '"Press Start 2P", monospace'
    const g = stateRef.current
    const juice = new Juice(9)

    // fondo de nebulosa pre-renderizado
    const bg = document.createElement('canvas')
    bg.width = W
    bg.height = H
    const bgc = bg.getContext('2d')
    if (bgc) {
      bgc.fillStyle = '#050510'
      bgc.fillRect(0, 0, W, H)
      const blob = (x: number, y: number, r: number, col: string) => {
        const gr = bgc.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, col)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        bgc.fillStyle = gr
        bgc.fillRect(0, 0, W, H)
      }
      blob(80, 140, 220, 'rgba(120,60,200,0.20)')
      blob(340, 330, 240, 'rgba(40,120,200,0.16)')
      blob(200, 540, 260, 'rgba(255,90,160,0.10)')
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let uiKey = ''

    const syncUi = () => {
      const mode = g.mode === 'title' ? 'title' : g.mode === 'over' ? 'over' : 'play'
      const key = `${mode}|${g.score}|${g.wave}|${g.lives}|${g.newBest}|${g.bestChain}|${g.kills}|${g.cause}`
      if (key === uiKey) return
      uiKey = key
      setUi({ mode, score: g.score, wave: g.wave, lives: g.lives, newBest: g.newBest, bestChain: g.bestChain, kills: g.kills, cause: g.cause })
    }

    // ---------- helpers de juego ----------
    const text = (x: number, y: number, t: string, color = '#fff', size = 9, life = 0.9) => juice.text(x, y, t, color, size, life)

    const addScore = (pts: number, x: number, y: number, color: string, useMult = true, label?: string) => {
      const v = Math.round(pts * (useMult ? g.mult : 1))
      g.score += v
      text(x, y, label ?? `+${v}`, color, v >= 300 ? 11 : 9)
      if (g.score >= g.nextLife) {
        g.nextLife += 5000
        if (g.lives < 5) {
          g.lives++
          text(g.ship.x, g.ship.y - 40, '+1 VIDA', '#7cff6b', 10, 1.4)
          sfx.levelUp()
        }
      }
    }

    const bumpChain = (n = 1) => {
      g.chain += n
      g.bestChain = Math.max(g.bestChain, g.chain)
      const m = Math.min(8, 1 + Math.floor(g.chain / 5))
      if (m > g.mult) {
        g.mult = m
        g.multPop = 1
        text(g.ship.x, g.ship.y - 36, `MULTIPLICADOR x${m}`, '#ffe23d', 8, 1.1)
        tone({ freq: 500 + m * 90, to: 900 + m * 120, dur: 0.14, vol: 0.04, type: 'triangle' })
      }
    }
    const breakChain = () => {
      if (g.chain >= 10) text(g.ship.x, g.ship.y - 34, 'CADENA PERDIDA', '#ff8a8a', 8, 1.1)
      g.chain = 0
      g.mult = 1
    }

    const spawnPowerUp = (x: number, y: number, type?: PType) => {
      const types: PType[] = ['double', 'triple', 'shield', 'beam']
      g.pups.push({ x, y, type: type ?? types[(Math.random() * types.length) | 0], t: 0 })
    }

    const fireAimed = (x: number, y: number, speed: number, off = 0, big = false) => {
      const a = clamp(Math.atan2(g.ship.x - x, g.ship.y - y), -0.75, 0.75) + off
      g.eb.push({ x, y, vx: Math.sin(a) * speed, vy: Math.cos(a) * speed, big })
    }
    const bulletSpeed = () => Math.min(250, 150 + g.wave * 7)

    const beginDive = (e: Enemy) => {
      e.st = 'dive'
      e.t = 0
      e.x0 = e.x
      e.amp = 30 + Math.random() * 45
      e.freq = 2 + Math.random() * 1.5
      e.phase = Math.random() * 3
      e.vy = Math.min(250, 125 + g.wave * 7 + Math.random() * 30)
      e.fired = false
      e.drift = 0
    }

    const killEnemy = (e: Enemy, byBeam = false) => {
      if (e.dead) return
      e.dead = true
      const diving = e.st === 'dive'
      const cx = e.x + e.w / 2
      const cy = e.y + e.h / 2
      const col = e.kind === 'grunt' ? LOOK_COLORS[e.look] : KIND_COLOR[e.kind]
      bumpChain(1)
      g.kills++
      const pts = e.pts * (diving ? 2 : 1)
      addScore(pts, cx, e.y - 4, diving ? '#ffe23d' : '#ffffff', true)
      const strong = e.kind === 'armor' || e.kind === 'burst' || e.kind === 'splitter'
      juice.burst(cx, cy, [col, '#ffffff', col], { count: strong ? 20 : 13, speed: 150, life: 0.55, size: 3.4, drag: 2.5 })
      juice.burst(cx, cy, '#ffe9a8', { count: 4, speed: 60, life: 0.3, size: 5, drag: 4 })
      juice.shake(strong ? 0.3 : 0.16)
      juice.freeze(strong ? 50 : 18)
      if (e.kind === 'drone') sfx.pop()
      else if (strong) sfx.explode()
      else sfx.pop()
      if (byBeam) noise({ dur: 0.05, vol: 0.03, freq: 2000 })
      if (e.kind === 'splitter') {
        for (const d of [-1, 1]) {
          const m = makeEnemy('drone', 0, 0, 0)
          m.x = cx - m.w / 2
          m.y = e.y
          beginDive(m)
          m.st = 'dive'
          m.x0 = m.x
          m.amp = 12
          m.drift = d * 70
          m.vy = 120 + g.wave * 4
          g.enemies.push(m)
        }
        text(cx, e.y - 14, 'DIVIDIDO', '#d6a8ff', 7, 0.8)
      }
      g.dropPity += 0.004
      if (Math.random() < 0.05 + g.dropPity + (e.kind === 'armor' ? 0.03 : 0)) {
        g.dropPity = 0
        spawnPowerUp(cx, cy)
      }
    }

    const hitEnemy = (e: Enemy, dmg: number, x: number, y: number, byBeam = false) => {
      if (e.dead) return
      e.hp -= dmg
      e.flash = 0.1
      if (e.hp <= 0) {
        killEnemy(e, byBeam)
      } else {
        bumpChain(1)
        juice.burst(x, y, ['#ffffff', '#ffd23d'], { count: 5, speed: 90, life: 0.25, size: 2.5 })
        juice.shake(0.1)
        tone({ freq: 200, to: 120, dur: 0.06, vol: 0.04, type: 'square' })
      }
    }

    const endBullet = (b: PBullet, hit: boolean) => {
      b.dead = true
      if (hit) b.vol.hit = true
      b.vol.alive--
      if (b.vol.alive <= 0 && !b.vol.hit) breakChain()
    }

    const clearShots = () => {
      g.eb.length = 0
    }

    const finish = (cause: string) => {
      if (g.mode !== 'play') return
      g.mode = 'dying'
      g.dyingT = 0
      g.cause = cause
      g.chain = 0
      clearShots()
      sfx.crash()
      juice.shake(1)
      juice.flash('#ff5d5d', 0.5)
    }

    const hurtPlayer = (x: number, y: number) => {
      const s = g.ship
      if (g.mode !== 'play' || s.invuln > 0) return
      clearShots()
      if (s.shield > 0) {
        s.shield = 0
        s.invuln = 1
        juice.burst(s.x, s.y, ['#8aa8ff', '#ffffff'], { count: 22, speed: 190, life: 0.45, size: 3 })
        juice.shake(0.35)
        juice.freeze(60)
        juice.flash('#8aa8ff', 0.3)
        text(s.x, s.y - 30, 'ESCUDO ROTO', '#8aa8ff', 8)
        sfx.hit()
        return
      }
      g.lives--
      g.tookHit = true
      breakChain()
      s.weapon = 'single'
      s.weaponT = 0
      s.beamT = 0
      juice.burst(s.x, s.y, ['#7cff6b', '#ffd23d', '#ffffff', '#ff8a3d'], { count: 30, speed: 220, life: 0.7, size: 4 })
      juice.burst(x, y, '#ffe9a8', { count: 8, speed: 120, life: 0.3, size: 5 })
      juice.shake(0.75)
      juice.freeze(110)
      juice.flash('#ff3a3a', 0.4)
      sfx.explode()
      if (g.lives <= 0) {
        g.lives = 0
        finish('Derribado')
      } else {
        s.invuln = 2.4
        s.x = W / 2
        s.vx = 0
      }
    }

    const restoreBunkers = (full: boolean) => {
      for (const b of g.bunkers) {
        for (let i = 0; i < b.cells.length; i++) {
          if (BUNK_MASK[i] === 1 && b.cells[i] === 0 && (full || Math.random() < 0.5)) b.cells[i] = 1
        }
      }
    }

    const spawnWave = (n: number) => {
      g.wave = n
      g.waveT = 0
      g.introT = 0
      g.clearT = -1
      g.tookHit = false
      g.enemies = []
      g.eb.length = 0
      g.boss = null
      g.dir = 1
      g.formY = FORM_TOP
      g.diveT = 7
      g.enemyFireT = 2.2
      restoreBunkers(isBossWave(n) || n === 1)
      if (isBossWave(n)) {
        const idx = n / 5
        const hp = 34 + idx * 14
        g.boss = {
          x: W / 2 - 48, y: -70, w: 96, h: 48, hp, maxHp: hp, t: 0, fireT: 2.4, phase: 0,
          flash: 0, dying: 0, idx, alt: false, burstLeft: 0, burstT: 0,
        }
        g.total = 1
        g.banner = { title: `OLEADA ${n}`, sub: 'JEFE NODRIZA', t: 0, dur: 2.4, color: '#ff4d6d' }
        sfx.siren()
        return
      }
      const k = n - Math.floor(n / 5)
      const pat = PATTERNS[(k - 1) % PATTERNS.length]
      const cols = Math.max(...pat.map((r) => r.length))
      g.formX = (W - cols * GX) / 2
      for (let r = 0; r < pat.length; r++) {
        for (let c = 0; c < pat[r].length; c++) {
          let ch = pat[r][c]
          if (ch === '.') continue
          if (ch === 'a' && n < 2) ch = 'g'
          if (ch === 'b' && n < 3) ch = 'g'
          if (ch === 's' && n < 4) ch = 'g'
          if (ch === 'g' && n >= 7 && Math.random() < Math.min(0.5, (n - 6) * 0.06)) ch = 'a'
          const kind: Kind = ch === 'a' ? 'armor' : ch === 'b' ? 'burst' : ch === 's' ? 'splitter' : 'grunt'
          const e = makeEnemy(kind, r % 3, c * GX + GX / 2, r * GY)
          e.x = g.formX + e.sx - e.w / 2
          e.y = g.formY + e.sy - 240
          g.enemies.push(e)
        }
      }
      g.total = g.enemies.length
      const subs: Record<number, string> = {
        1: 'DEFIENDE LA TIERRA',
        2: 'NUEVO: BLINDADOS Y PICADAS',
        3: 'NUEVO: ARTILLEROS',
        4: 'NUEVO: DIVISORES',
      }
      g.banner = { title: `OLEADA ${n}`, sub: subs[n] ?? 'RESISTE', t: 0, dur: 2.2, color: ACCENT }
      if (n > 1) sfx.levelUp()
    }

    const startGame = () => {
      const stars = g.stars
      Object.assign(g, initial())
      g.stars = stars
      g.mode = 'play'
      juice.reset()
      spawnWave(1)
      sfx.start()
      uiKey = ''
    }

    const setupTitle = () => {
      spawnWave(1)
      g.banner = null
      g.introT = 5
      for (const e of g.enemies) e.y = g.formY + e.sy
      g.mode = 'title'
    }
    setupTitle()

    // ---------- actualización ----------
    const shoot = () => {
      const s = g.ship
      const mk = (dx: number, vx: number, vol: Volley) => {
        g.pb.push({ x: s.x + dx, y: s.y - 14, px: s.x + dx, py: s.y - 14, vx, vy: -580, dmg: 1, vol, dead: false })
      }
      if (s.weapon === 'single') {
        const v = { alive: 1, hit: false }
        mk(0, 0, v)
      } else if (s.weapon === 'double') {
        const v = { alive: 2, hit: false }
        mk(-7, 0, v)
        mk(7, 0, v)
      } else {
        const v = { alive: 3, hit: false }
        mk(0, 0, v)
        mk(-8, -95, v)
        mk(8, 95, v)
      }
      s.cool = s.weapon === 'triple' ? 0.23 : 0.2
      tone({ freq: 980, to: 320, dur: 0.07, vol: 0.022, type: 'square' })
      juice.burst(s.x, s.y - 16, '#fff3a0', { count: 2, speed: 60, angle: -Math.PI / 2, arc: 1, life: 0.15, size: 2.5 })
    }

    const updatePlay = (dt: number) => {
      const s = g.ship
      const pressed = pressedRef.current
      g.waveT += dt
      g.introT += dt
      if (g.banner) {
        g.banner.t += dt
        if (g.banner.t > g.banner.dur) g.banner = null
      }
      if (g.multPop > 0) g.multPop = Math.max(0, g.multPop - dt * 3)
      const intro = g.introT < 1.8

      // ----- nave -----
      let ax = 0
      let ay = 0
      if (pressed.has('left')) ax -= 1
      if (pressed.has('right')) ax += 1
      if (pressed.has('up')) ay -= 1
      if (pressed.has('down')) ay += 1
      const k = Math.min(1, 16 * dt)
      s.vx += (ax * 270 - s.vx) * k
      s.vy += (ay * 150 - s.vy) * k
      s.x = clamp(s.x + s.vx * dt, 22, W - 22)
      s.y = clamp(s.y + s.vy * dt, SHIP_Y_MIN, SHIP_Y_MAX)
      if (s.invuln > 0) s.invuln -= dt
      if (s.shield > 0) s.shield -= dt
      if (s.weaponT > 0) {
        s.weaponT -= dt
        if (s.weaponT <= 0) s.weapon = 'single'
      }
      if (s.beamT > 0) s.beamT -= dt
      s.trailT -= dt
      if (s.trailT <= 0) {
        s.trailT = 0.035
        juice.burst(s.x + (Math.random() - 0.5) * 4, s.y + 13, ['#ffb347', '#ff6a3d', '#ffe23d'], {
          count: 1, speed: 70, angle: Math.PI / 2, arc: 0.5, life: 0.22, size: 2.6,
        })
      }

      s.cool -= dt
      s.beamOn = false
      if (pressed.has('action')) {
        if (s.beamT > 0) {
          s.beamOn = true
        } else if (s.cool <= 0) {
          shoot()
        }
      }
      // rayo: daño continuo en columna
      if (s.beamOn) {
        s.beamTick -= dt
        s.beamSnd -= dt
        if (s.beamSnd <= 0) {
          s.beamSnd = 0.09
          tone({ freq: 140 + Math.random() * 60, to: 90, dur: 0.1, vol: 0.025, type: 'sawtooth' })
        }
        const tick = s.beamTick <= 0
        if (tick) s.beamTick = 0.09
        const bx = s.x - 8
        for (const e of g.enemies) {
          if (e.dead) continue
          if (aabb(bx, 0, 16, s.y - 12, e.x, e.y, e.w, e.h)) {
            if (tick) hitEnemy(e, 1, e.x + e.w / 2, e.y + e.h, true)
          }
        }
        const bs = g.boss
        if (bs && bs.dying === 0 && tick && aabb(bx, 0, 16, s.y - 12, bs.x, bs.y, bs.w, bs.h)) {
          damageBoss(0.7, s.x, bs.y + bs.h)
        }
        if (g.ufo && aabb(bx, 0, 16, s.y - 12, g.ufo.x, g.ufo.y, 39, 18)) killUfo()
        for (const eb of g.eb) {
          if (Math.abs(eb.x - s.x) < 10) {
            eb.y = 9999
            juice.burst(eb.x, s.y - 80 - Math.random() * 100, '#ff4fd8', { count: 3, speed: 90, life: 0.2, size: 2.5 })
          }
        }
      }

      // ----- formación -----
      let formCount = 0
      let minX = Infinity
      let maxX = -Infinity
      for (const e of g.enemies) {
        if (e.st !== 'form' || e.dead) continue
        formCount++
        minX = Math.min(minX, e.x)
        maxX = Math.max(maxX, e.x + e.w)
      }
      const introOff = -Math.pow(1 - Math.min(1, g.introT / 1.1), 2) * 240
      if (formCount > 0) {
        const left = 1 - formCount / Math.max(1, g.total)
        const speed = (18 + Math.min(g.wave, 12) * 3.2) * (1 + left * 2.4)
        if (!intro || g.introT > 1.1) g.formX += g.dir * speed * dt
        if (g.dir > 0 && maxX > W - 10) {
          g.dir = -1
          g.formY += 14
          g.formX -= 2
        } else if (g.dir < 0 && minX < 10) {
          g.dir = 1
          g.formY += 14
          g.formX += 2
        }
      }

      for (const e of g.enemies) {
        if (e.dead) continue
        if (e.flash > 0) e.flash -= dt
        if (e.st === 'form') {
          e.x = g.formX + e.sx - e.w / 2
          e.y = g.formY + e.sy + introOff
          // artilleros: ráfagas propias
          if (e.kind === 'burst' && !intro) {
            e.fireT -= dt
            if (e.fireT <= 0 && e.burstLeft === 0) {
              e.burstLeft = 3
              e.burstT = 0
              e.fireT = Math.max(2.4, 6 - g.wave * 0.3) + Math.random() * 2
            }
          }
          if (e.burstLeft > 0) {
            e.burstT -= dt
            if (e.burstT <= 0) {
              e.burstT = 0.13
              e.burstLeft--
              fireAimed(e.x + e.w / 2, e.y + e.h, bulletSpeed() * 0.95)
              tone({ freq: 500, to: 260, dur: 0.06, vol: 0.02, type: 'sawtooth' })
            }
          }
        } else if (e.st === 'dive') {
          e.t += dt
          if (e.kind === 'drone') e.x0 += e.drift * dt
          else e.x0 += clamp(g.ship.x - (e.x0 + e.w / 2), -1, 1) * 55 * dt
          e.y += e.vy * dt
          e.x = e.x0 + Math.sin(e.t * e.freq + e.phase) * e.amp
          e.trailT -= dt
          if (e.trailT <= 0) {
            e.trailT = 0.06
            juice.burst(e.x + e.w / 2, e.y + 2, KIND_COLOR[e.kind], { count: 1, speed: 20, life: 0.25, size: 2.4 })
          }
          if (!e.fired && g.wave >= 3 && e.kind !== 'drone' && e.y > 120 && e.y < 300 && Math.random() < dt * 1.2) {
            e.fired = true
            fireAimed(e.x + e.w / 2, e.y + e.h, bulletSpeed() * 0.9)
          }
          if (e.y > H + 20) {
            if (e.kind === 'drone') {
              e.dead = true
            } else {
              e.st = 'return'
              e.y = -30
              e.x = g.formX + e.sx - e.w / 2
            }
          }
        } else {
          const tx = g.formX + e.sx - e.w / 2
          const ty = g.formY + e.sy
          const dx = tx - e.x
          const dy = ty - e.y
          const d = Math.hypot(dx, dy)
          if (d < 4) {
            e.st = 'form'
          } else {
            const sp = Math.min(d / dt, 230)
            e.x += (dx / d) * sp * dt
            e.y += (dy / d) * sp * dt
          }
        }
        // erosión de búnkers
        if (e.y + e.h > BUNK_Y && e.y < BUNK_Y + BUNK_H * BUNK_C) {
          for (const b of g.bunkers) eraseRect(b, e.x, e.y, e.w, e.h)
        }
        // choque contra la nave
        if (g.mode === 'play' && e.st !== 'return' && aabb(s.x - 8, s.y - 8, 16, 18, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
          hurtPlayer(e.x + e.w / 2, e.y + e.h / 2)
          killEnemy(e)
        }
        // invasión
        if (e.st === 'form' && e.y + e.h >= INVADE_Y && g.mode === 'play') {
          finish('Invasión')
        }
      }

      // picadas (estilo Galaga)
      const diveOk = g.wave >= 2 || g.waveT > 14
      if (diveOk && !intro && !g.boss) {
        g.diveT -= dt
        if (g.diveT <= 0) {
          g.diveT = Math.max(1.4, 5.4 - g.wave * 0.38) * (0.7 + Math.random() * 0.6)
          const n = 1 + (g.wave >= 4 && Math.random() < 0.6 ? 1 : 0) + (g.wave >= 8 ? 1 : 0)
          const cand = g.enemies.filter((e) => e.st === 'form' && !e.dead)
          for (let i = 0; i < n && cand.length > 0; i++) {
            // prefiere los de abajo de cada columna
            const e = cand.splice((Math.random() * cand.length) | 0, 1)[0]
            beginDive(e)
            tone({ freq: 760, to: 260, dur: 0.28, vol: 0.025, type: 'sine' })
          }
        }
      }

      // disparo enemigo desde la formación
      if (!intro && formCount > 0) {
        g.enemyFireT -= dt
        if (g.enemyFireT <= 0) {
          g.enemyFireT = Math.max(0.5, 1.4 - g.wave * 0.07) * (0.6 + Math.random() * 0.8)
          const front = new Map<number, Enemy>()
          for (const e of g.enemies) {
            if (e.st !== 'form' || e.dead) continue
            const col = Math.round(e.sx / GX)
            const cur = front.get(col)
            if (!cur || e.sy > cur.sy) front.set(col, e)
          }
          const list = [...front.values()]
          if (list.length > 0) {
            const e = list[(Math.random() * list.length) | 0]
            if (e.kind === 'burst') {
              e.burstLeft = 3
              e.burstT = 0
            } else {
              g.eb.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: 0, vy: bulletSpeed(), big: false })
            }
          }
        }
      }

      // ----- jefe -----
      if (g.boss) updateBoss(g.boss, dt)

      // ----- OVNI nodriza -----
      g.ufoT -= dt
      if (g.ufoT <= 0 && !g.ufo && !intro && !g.boss) {
        const right = Math.random() < 0.5
        g.ufo = { x: right ? -45 : W + 6, y: 36, vx: right ? 95 : -95, sndT: 0 }
        g.ufoT = 18 + Math.random() * 12
      }
      if (g.ufo) {
        g.ufo.x += g.ufo.vx * dt
        g.ufo.sndT -= dt
        if (g.ufo.sndT <= 0) {
          g.ufo.sndT = 0.32
          sfx.ufo()
        }
        if (g.ufo.x > W + 50 || g.ufo.x < -60) g.ufo = null
      }

      // ----- balas del jugador -----
      for (const b of g.pb) {
        if (b.dead) continue
        b.px = b.x
        b.py = b.y
        b.x += b.vx * dt
        b.y += b.vy * dt
        const rx = Math.min(b.px, b.x) - 2
        const ry = Math.min(b.py, b.y) - 6
        const rw = Math.abs(b.x - b.px) + 4
        const rh = Math.abs(b.y - b.py) + 12
        let used = false
        if (g.ufo && aabb(rx, ry, rw, rh, g.ufo.x, g.ufo.y, 39, 18)) {
          killUfo()
          endBullet(b, true)
          continue
        }
        const bs = g.boss
        if (bs && bs.dying === 0 && aabb(rx, ry, rw, rh, bs.x + 6, bs.y + 4, bs.w - 12, bs.h - 8)) {
          damageBoss(b.dmg, b.x, b.y)
          endBullet(b, true)
          continue
        }
        for (const e of g.enemies) {
          if (e.dead) continue
          if (aabb(rx, ry, rw, rh, e.x, e.y, e.w, e.h)) {
            hitEnemy(e, b.dmg, b.x, b.y)
            endBullet(b, true)
            used = true
            break
          }
        }
        if (used) continue
        if (b.y < -12 || b.x < -10 || b.x > W + 10) endBullet(b, false)
      }
      g.pb = g.pb.filter((b) => !b.dead)
      g.enemies = g.enemies.filter((e) => !e.dead)

      // ----- balas enemigas -----
      for (const b of g.eb) {
        const py = b.y
        b.x += b.vx * dt
        b.y += b.vy * dt
        // búnkers
        if (b.y > BUNK_Y - 6 && b.y < BUNK_Y + BUNK_H * BUNK_C + 12) {
          let hit = false
          for (let yy = py; yy <= b.y + 4 && !hit; yy += 2) {
            for (const bk of g.bunkers) {
              if (bunkerCellAt(bk, b.x, yy)) {
                erode(bk, b.x, yy, b.big ? 4 : 2.8)
                juice.burst(b.x, yy, '#4ade80', { count: 6, speed: 70, life: 0.3, size: 2, gravity: 120 })
                tone({ freq: 160, to: 80, dur: 0.06, vol: 0.03, type: 'square' })
                hit = true
                break
              }
            }
          }
          if (hit) {
            b.y = 9999
            continue
          }
        }
        if (g.mode === 'play' && aabb(b.x - 2, Math.min(py, b.y) - 4, 4, Math.abs(b.y - py) + 9, s.x - 8, s.y - 9, 16, 19)) {
          hurtPlayer(b.x, b.y)
          b.y = 9999
        }
      }
      g.eb = g.eb.filter((b) => b.y < H + 10 && b.y > -20 && b.x > -10 && b.x < W + 10)

      // ----- power-ups -----
      for (const p of g.pups) {
        p.t += dt
        p.y += 78 * dt
        if (g.mode === 'play' && aabb(p.x - 11, p.y - 9, 22, 18, s.x - 15, s.y - 14, 30, 28)) {
          p.y = 9999
          pickPowerUp(p)
        }
      }
      g.pups = g.pups.filter((p) => p.y < H + 20)

      // ----- fin de oleada -----
      if (g.mode === 'play' && !g.boss && g.enemies.length === 0 && g.clearT < 0 && g.introT > 1) {
        g.clearT = 2.1
        g.eb.length = 0
        const par = 10 + g.total * 1.5
        const rapid = Math.max(0, Math.round(((par - g.waveT) * 8) / 10) * 10)
        const base = 100 + g.wave * 25
        const clean = g.tookHit ? 0 : 250
        g.score += base + rapid + clean
        const parts = [`+${base}`]
        if (rapid > 0) parts.push(`RAPIDEZ +${rapid}`)
        if (clean > 0) parts.push(`SIN DAÑO +${clean}`)
        g.banner = { title: `OLEADA ${g.wave} SUPERADA`, sub: parts.join('  '), t: 0, dur: 2.1, color: '#ffe23d' }
        juice.flash('#ffffff', 0.18)
        sfx.levelUp()
        if (g.score >= g.nextLife && g.lives < 5) {
          g.lives++
          g.nextLife += 5000
          text(s.x, s.y - 40, '+1 VIDA', '#7cff6b', 10, 1.4)
        }
      }
      if (g.clearT >= 0) {
        g.clearT -= dt
        if (g.clearT <= 0) spawnWave(g.wave + 1)
      }
    }

    function killUfo() {
      const u = g.ufo
      if (!u) return
      g.ufo = null
      const pts = [100, 150, 200, 300, 500][(Math.random() * 5) | 0] * 1
      addScore(pts, u.x + 20, u.y, '#ff6b9a', true)
      juice.burst(u.x + 20, u.y + 9, ['#ff2e55', '#ffffff', '#ffd23d'], { count: 28, speed: 210, life: 0.7, size: 3.6 })
      juice.shake(0.4)
      juice.freeze(70)
      juice.flash('#ff2e55', 0.18)
      bumpChain(2)
      sfx.golden()
      spawnPowerUp(u.x + 20, u.y + 14)
      text(u.x + 20, u.y + 26, 'NODRIZA', '#ff6b9a', 8, 1)
    }

    function pickPowerUp(p: PowerUp) {
      const s = g.ship
      const info = PUP_INFO[p.type]
      if (p.type === 'double' || p.type === 'triple') {
        s.weapon = p.type
        s.weaponT = 14
      } else if (p.type === 'shield') {
        s.shield = 20
      } else {
        s.beamT = Math.min(8, s.beamT + 5)
      }
      g.score += 50
      text(s.x, s.y - 30, info.name, info.color, 8, 1.2)
      juice.burst(p.x, p.y, [info.color, '#ffffff'], { count: 14, speed: 140, life: 0.4, size: 3 })
      juice.flash(info.color, 0.16)
      sfx.power()
      tone({ freq: 880, to: 1320, dur: 0.12, vol: 0.04, type: 'triangle', delay: 0.1 })
    }

    function damageBoss(dmg: number, x: number, y: number) {
      const b = g.boss
      if (!b || b.dying > 0) return
      b.hp -= dmg
      b.flash = 0.08
      bumpChain(1)
      addScore(10, x, y - 6, '#ffffff', true)
      juice.burst(x, y, ['#ffffff', '#ff9f43'], { count: 5, speed: 100, life: 0.3, size: 2.8 })
      juice.shake(0.08)
      tone({ freq: 150, to: 100, dur: 0.05, vol: 0.04, type: 'square' })
      if (b.hp <= 0) {
        b.hp = 0
        b.dying = 0.01
        clearShots()
        juice.flash('#ffffff', 0.6)
        juice.freeze(160)
        sfx.bomb()
      }
    }

    function updateBoss(b: Boss, dt: number) {
      b.t += dt
      if (b.flash > 0) b.flash -= dt
      if (b.dying > 0) {
        b.dying += dt
        if (Math.random() < dt * 14) {
          const ex = b.x + Math.random() * b.w
          const ey = b.y + Math.random() * b.h
          juice.burst(ex, ey, ['#ff9f43', '#ffe23d', '#ffffff', '#ff4d6d'], { count: 12, speed: 160, life: 0.6, size: 4 })
          juice.shake(0.25)
          noise({ dur: 0.18, vol: 0.06, freq: 900 })
        }
        b.y += 6 * dt
        if (b.dying > 1.7) {
          const cx = b.x + b.w / 2
          const cy = b.y + b.h / 2
          juice.burst(cx, cy, ['#ff9f43', '#ffe23d', '#ffffff', '#ff4d6d', '#c77dff'], { count: 70, speed: 300, life: 1, size: 5 })
          juice.shake(1)
          juice.flash('#ffffff', 0.7)
          sfx.bomb()
          const pts = 1500 + 500 * b.idx
          g.score += pts
          text(cx, cy - 20, `+${pts}`, '#ffe23d', 14, 1.6)
          text(cx, cy + 6, 'JEFE DESTRUIDO', '#ff9f43', 9, 1.6)
          g.kills++
          spawnPowerUp(cx - 18, cy)
          spawnPowerUp(cx + 18, cy, 'shield')
          g.boss = null
          clearShots()
        }
        return
      }
      if (b.y < 66) {
        b.y += 60 * dt
        return
      }
      const range = W / 2 - 66
      b.x = W / 2 - b.w / 2 + Math.sin(b.t * (0.7 + b.idx * 0.08)) * range
      const ratio = b.hp / b.maxHp
      const ph = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2
      if (ph > b.phase) {
        b.phase = ph
        clearShots()
        juice.flash('#ff4d6d', 0.35)
        juice.shake(0.6)
        sfx.siren()
        text(W / 2, 130, `FASE ${ph + 1}`, '#ff4d6d', 12, 1.4)
        for (let i = 0; i < 2 + ph; i++) {
          const m = makeEnemy('drone', 0, 0, 0)
          m.x = b.x + 10 + (i * (b.w - 30)) / (1 + ph)
          m.y = b.y + b.h
          beginDive(m)
          m.amp = 25
          m.drift = (i % 2 === 0 ? -1 : 1) * 40
          m.vy = 130
          g.enemies.push(m)
        }
      }
      const cx = b.x + b.w / 2
      const cy = b.y + b.h - 6
      const sp = 165 + b.idx * 8
      // ráfaga en curso
      if (b.burstLeft > 0) {
        b.burstT -= dt
        if (b.burstT <= 0) {
          b.burstT = 0.14
          b.burstLeft--
          fireAimed(cx, cy, sp * 1.15, 0, true)
        }
      }
      b.fireT -= dt
      if (b.fireT <= 0) {
        b.alt = !b.alt
        if (ph === 0) {
          b.fireT = 1.5
          for (const off of [-0.28, 0, 0.28]) fireAimed(cx, cy, sp, off, true)
        } else if (ph === 1) {
          b.fireT = 1.25
          if (b.alt) {
            for (let i = -2; i <= 2; i++) g.eb.push({ x: cx, y: cy, vx: Math.sin(i * 0.22) * sp, vy: Math.cos(i * 0.22) * sp, big: true })
          } else {
            b.burstLeft = 3
            b.burstT = 0
          }
        } else {
          b.fireT = 1
          if (b.alt) {
            for (let i = -3; i <= 3; i++) g.eb.push({ x: cx, y: cy, vx: Math.sin(i * 0.2) * sp, vy: Math.cos(i * 0.2) * sp, big: true })
          } else {
            b.burstLeft = 4
            b.burstT = 0
          }
        }
        tone({ freq: 300, to: 120, dur: 0.18, vol: 0.04, type: 'sawtooth' })
      }
    }

    const update = (dtReal: number) => {
      // estrellas siempre en movimiento
      const ls = [12, 30, 62]
      for (const st of g.stars) {
        st.y += ls[st.layer] * dtReal
        if (st.y > H) {
          st.y = -2
          st.x = Math.random() * W
        }
      }
      g.time += dtReal
      const jp = justPressedRef.current

      if (g.mode === 'play' && jp.has('pause')) {
        g.paused = !g.paused
        sfx.pause()
      } else if (g.paused && jp.has('action')) {
        g.paused = false
        sfx.pause()
      }
      if (g.paused) return

      const dt = juice.update(dtReal)

      if (g.mode === 'title') {
        if (g.wantStart || jp.has('action')) startGame()
        g.wantStart = false
        return
      }
      if (g.mode === 'over') {
        g.overT += dtReal
        if (g.wantStart || (jp.has('action') && g.overT > 0.5)) startGame()
        g.wantStart = false
        return
      }
      g.wantStart = false
      if (g.mode === 'dying') {
        g.dyingT += dtReal
        if (g.dyingT > 1) {
          g.mode = 'over'
          g.overT = 0
          if (saveBest(ID, g.score)) g.newBest = true
          setBest((b) => Math.max(b, g.score))
          sfx.gameOver()
        }
        return
      }
      if (dt <= 0) return
      updatePlay(dt)
    }

    // ---------- dibujo ----------
    const drawSprite = (mat: string[], color: string, x: number, y: number, cell: number) => {
      ctx.drawImage(sprite(mat, color, cell, dpr), Math.round(x), Math.round(y), mat[0].length * cell, mat.length * cell)
    }

    const drawBunkers = () => {
      ctx.fillStyle = '#35a85f'
      ctx.beginPath()
      for (const b of g.bunkers) {
        for (let y = 0; y < BUNK_H; y++) {
          let x = 0
          while (x < BUNK_W) {
            if (b.cells[y * BUNK_W + x] === 1) {
              const x0 = x
              while (x < BUNK_W && b.cells[y * BUNK_W + x] === 1) x++
              ctx.rect(b.x + x0 * BUNK_C, BUNK_Y + y * BUNK_C, (x - x0) * BUNK_C, BUNK_C)
            } else x++
          }
        }
      }
      ctx.fill()
      ctx.fillStyle = '#9dffbd'
      ctx.beginPath()
      for (const b of g.bunkers) {
        for (let y = 0; y < BUNK_H; y++) {
          for (let x = 0; x < BUNK_W; x++) {
            if (b.cells[y * BUNK_W + x] === 1 && (y === 0 || b.cells[(y - 1) * BUNK_W + x] === 0)) {
              ctx.rect(b.x + x * BUNK_C, BUNK_Y + y * BUNK_C, BUNK_C, BUNK_C)
            }
          }
        }
      }
      ctx.fill()
    }

    const drawText = (t: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') => {
      ctx.font = `${size}px ${FONT}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillText(t, x + 1.5, y + 1.5)
      ctx.fillStyle = color
      ctx.fillText(t, x, y)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      ctx.drawImage(bg, 0, 0, W, H)
      const px = (g.ship.x - W / 2) * 0.02
      for (const st of g.stars) {
        const a = [0.3, 0.55, 0.9][st.layer] * (0.7 + 0.3 * Math.sin(g.time * 2 + st.tw))
        ctx.fillStyle = `rgba(220,235,255,${a})`
        ctx.fillRect(st.x - px * (st.layer + 1), st.y, st.s, st.s * (1 + st.layer * 0.6))
      }

      ctx.save()
      juice.applyShake(ctx)

      drawBunkers()

      // power-ups
      for (const p of g.pups) {
        const info = PUP_INFO[p.type]
        const bob = Math.sin(p.t * 6) * 1.5
        ctx.fillStyle = info.color
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(p.t * 8)
        ctx.beginPath()
        ctx.arc(p.x, p.y + bob, 15, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        rr(ctx, p.x - 11, p.y - 8 + bob, 22, 16, 8)
        ctx.fillStyle = '#0a0a18'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = info.color
        ctx.stroke()
        drawText(info.label, p.x, p.y + 1 + bob, 8, info.color)
      }

      // enemigos
      const fr = Math.floor(g.time * 2.4) % 2
      for (const e of g.enemies) {
        const f = frames(e)
        const mat = f[e.st === 'dive' ? Math.floor(g.time * 10) % 2 : fr]
        let col = e.kind === 'grunt' ? LOOK_COLORS[e.look] : KIND_COLOR[e.kind]
        if (e.kind === 'armor' && e.hp < e.maxHp) col = '#ff9f43'
        if (e.flash > 0) col = '#ffffff'
        drawSprite(mat, col, e.x, e.y, 2)
        if (e.kind === 'burst' && e.burstLeft > 0) {
          ctx.fillStyle = '#fff3a0'
          ctx.fillRect(Math.round(e.x + e.w / 2 - 2), Math.round(e.y + e.h - 2), 4, 4)
        }
      }

      // jefe
      const bs = g.boss
      if (bs) {
        const hit = bs.flash > 0
        const dying = bs.dying > 0
        const shk = dying ? (Math.random() - 0.5) * 5 : 0
        drawSprite(BOSS, hit ? '#ffffff' : dying ? '#ff9f43' : '#ff4d6d', bs.x + shk, bs.y, 4)
        if (!dying) {
          const eye = 0.6 + 0.4 * Math.sin(bs.t * 6)
          ctx.fillStyle = `rgba(255,240,140,${eye})`
          ctx.fillRect(Math.round(bs.x) + 20, Math.round(bs.y) + 16, 8, 8)
          ctx.fillRect(Math.round(bs.x) + 68, Math.round(bs.y) + 16, 8, 8)
        }
      }

      // OVNI nodriza
      if (g.ufo) {
        drawSprite(UFO, '#ff2e55', g.ufo.x, g.ufo.y, 3)
        ctx.fillStyle = Math.floor(g.time * 8) % 2 ? '#ffe23d' : '#ffffff'
        ctx.fillRect(Math.round(g.ufo.x) + 12, Math.round(g.ufo.y) + 9, 3, 3)
        ctx.fillRect(Math.round(g.ufo.x) + 24, Math.round(g.ufo.y) + 9, 3, 3)
      }

      // balas enemigas
      for (const b of g.eb) {
        if (b.big) {
          ctx.fillStyle = 'rgba(255,79,130,0.35)'
          ctx.beginPath()
          ctx.arc(b.x, b.y, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ff4f82'
          ctx.beginPath()
          ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillRect(b.x - 1, b.y - 1, 2, 2)
        } else {
          ctx.fillStyle = 'rgba(255,93,93,0.3)'
          ctx.fillRect(b.x - 4, b.y - 2, 8, 13)
          ctx.fillStyle = '#ff5d5d'
          ctx.fillRect(b.x - 2, b.y, 4, 9)
          ctx.fillStyle = '#ffd0d0'
          ctx.fillRect(b.x - 1, b.y + 1, 2, 5)
        }
      }

      // balas del jugador
      for (const b of g.pb) {
        ctx.fillStyle = 'rgba(255,226,61,0.28)'
        ctx.fillRect(b.x - 3, b.y - 6, 6, 22)
        ctx.fillStyle = '#ffe23d'
        ctx.fillRect(b.x - 2, b.y - 8, 4, 14)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(b.x - 1, b.y - 8, 2, 8)
      }

      // rayo
      const s = g.ship
      if (s.beamOn && g.mode === 'play') {
        const fl = 0.75 + 0.25 * Math.sin(g.time * 70)
        const top = 0
        const hgt = s.y - 14
        const grad = ctx.createLinearGradient(0, top, 0, s.y)
        grad.addColorStop(0, 'rgba(255,79,216,0.15)')
        grad.addColorStop(1, 'rgba(255,79,216,0.55)')
        ctx.fillStyle = grad
        ctx.fillRect(s.x - 10 * fl, top, 20 * fl, hgt)
        ctx.fillStyle = `rgba(255,190,240,${0.8 * fl})`
        ctx.fillRect(s.x - 5, top, 10, hgt)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(s.x - 2, top, 4, hgt)
      }

      // nave
      if (g.mode === 'play' || g.mode === 'title') {
        const blink = s.invuln > 0 && Math.floor(g.time * 14) % 2 === 0
        if (!blink) {
          const fl = 5 + Math.sin(g.time * 60) * 2 + Math.random() * 2
          ctx.fillStyle = '#ff8a3d'
          ctx.fillRect(Math.round(s.x) - 5, Math.round(s.y) + 11, 10, fl + 2)
          ctx.fillStyle = '#ffe23d'
          ctx.fillRect(Math.round(s.x) - 3, Math.round(s.y) + 11, 6, fl)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) + 11, 2, fl - 2)
          drawSprite(SHIP, '#7cff6b', s.x - 16.5, s.y - 12, 3)
          ctx.fillStyle = '#d8ffd0'
          ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 12, 3, 8)
        }
        if (s.shield > 0 && (s.shield > 3 || Math.floor(g.time * 10) % 2 === 0)) {
          ctx.lineWidth = 2
          ctx.strokeStyle = `rgba(138,168,255,${0.7 + 0.3 * Math.sin(g.time * 8)})`
          ctx.fillStyle = 'rgba(138,168,255,0.14)'
          ctx.beginPath()
          ctx.arc(s.x, s.y + 1, 24, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, FONT)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      // ----- HUD en el canvas -----
      if (g.mode === 'play' || g.mode === 'dying') {
        // multiplicador y cadena
        if (g.chain > 0) {
          const pop = 1 + g.multPop * 0.5
          drawText(`x${g.mult}`, 10, 18, Math.round(14 * pop), g.mult > 1 ? '#ffe23d' : '#ffffffaa', 'left')
          drawText(`CADENA ${g.chain}`, 10, 36, 7, '#ffffffbb', 'left')
          const prog = g.mult >= 8 ? 1 : (g.chain % 5) / 5
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(10, 44, 56, 4)
          ctx.fillStyle = '#ffe23d'
          ctx.fillRect(10, 44, 56 * prog, 4)
        }
        // barra del jefe
        if (g.boss && g.boss.dying === 0) {
          const bw = 220
          const bx = (W - bw) / 2
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(bx - 2, 8, bw + 4, 10)
          ctx.fillStyle = '#ff4d6d'
          ctx.fillRect(bx, 10, (bw * g.boss.hp) / g.boss.maxHp, 6)
          ctx.fillStyle = 'rgba(255,255,255,0.35)'
          ctx.fillRect(bx, 10, (bw * g.boss.hp) / g.boss.maxHp, 2)
        }
        // temporizadores de power-ups
        let ix = 8
        const chip = (label: string, color: string, frac: number) => {
          drawText(label, ix, H - 14, 7, color, 'left')
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(ix, H - 8, 26, 3)
          ctx.fillStyle = color
          ctx.fillRect(ix, H - 8, 26 * clamp(frac, 0, 1), 3)
          ix += 38
        }
        if (s.weaponT > 0) chip(s.weapon === 'double' ? '2X' : '3X', s.weapon === 'double' ? '#4dd0ff' : '#ff9f43', s.weaponT / 14)
        if (s.shield > 0) chip('ESC', '#8aa8ff', s.shield / 20)
        if (s.beamT > 0) chip('RAY', '#ff4fd8', s.beamT / 8)
      }

      // cartela
      if (g.banner && g.mode === 'play') {
        const bn = g.banner
        const a = Math.min(1, bn.t / 0.2, (bn.dur - bn.t) / 0.4)
        if (a > 0) {
          ctx.globalAlpha = Math.max(0, a)
          const pop = 1 + Math.max(0, 0.25 - bn.t) * 1.6
          const size = Math.min(22, Math.floor(340 / bn.title.length)) * pop
          drawText(bn.title, W / 2, H * 0.36, size, bn.color)
          drawText(bn.sub, W / 2, H * 0.36 + 26, Math.min(9, Math.floor(340 / Math.max(1, bn.sub.length))), '#ffffff')
          ctx.globalAlpha = 1
        }
      }

      if (g.paused) {
        ctx.fillStyle = 'rgba(5,5,16,0.78)'
        ctx.fillRect(0, 0, W, H)
        drawText('PAUSA', W / 2, H / 2 - 10, 24, ACCENT)
        drawText('Pulsa P o A para continuar', W / 2, H / 2 + 24, 8, '#ffffff')
      }
    }

    const onHide = () => {
      if (g.mode === 'play' && !g.paused) g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onHide()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onHide)

    const loop = (now: number) => {
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        const m = stateRef.current.mode
        if (m === 'title' || m === 'over') requestRemount()
      }
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      update(dt)
      justPressedRef.current.clear()
      draw()
      syncUi()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onHide)
    }
  }, [justPressedRef, pressedRef])

  const stats: OverlayStat[] = [
    { label: 'Oleada', value: ui.wave },
    { label: 'Bajas', value: ui.kills },
    { label: 'Mejor cadena', value: ui.bestChain },
    { label: 'Fin', value: ui.cause },
  ]

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#2a2a55] bg-[#050510] shadow-[0_0_40px_rgba(95,232,222,0.18)]"
        hud={
          <Hud>
            <span className="text-[#7cff6b] drop-shadow-[0_0_6px_rgba(124,255,107,0.8)]">PTS {ui.score}</span>
            <span className="flex items-center gap-2">
              <span className="text-[#ff71ce] drop-shadow-[0_0_6px_rgba(255,113,206,0.8)]">OLEADA {ui.wave}</span>
              <span className="text-[#5fe8de]" title="Vidas">
                {'▲'.repeat(Math.max(0, ui.lives))}
              </span>
            </span>
            <span className="text-[#ffe23d] drop-shadow-[0_0_6px_rgba(255,226,61,0.8)]">HI {Math.max(best, ui.score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Invasión Espacial"
        />
        {ui.mode === 'title' && (
          <StartOverlay
            title="INVASION ESPACIAL"
            accent={ACCENT}
            subtitle="Mantén pulsado el disparo para ráfaga automática. Encadena impactos sin fallar para subir el multiplicador."
            hint="Flechas / WASD mover · ESPACIO disparar (mantén)"
            touchHint="Toca A para empezar (mantenlo para disparar)"
            onStart={requestStart}
          />
        )}
        {ui.mode === 'over' && (
          <GameOverOverlay
            title="FIN DE LA MISION"
            accent={ACCENT}
            score={ui.score}
            best={best}
            newBest={ui.newBest}
            stats={stats}
            onRestart={requestStart}
          />
        )}
      </GameScreen>
      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Fuego" actionGlyph="A" />
    </div>
  )
}
