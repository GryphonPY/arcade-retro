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
// Constantes
// ---------------------------------------------------------------------------
const W = 400
const H = 300
const GROUND = 252 // y de los pies sobre el suelo
const PW = 14
const PH = 28
const PH_CROUCH = 18
const GRAV = 900
const JUMP_V = -345
const RUN = 118
const ACCENT = '#ff8a3d'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0]
const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

type WId = 'pistol' | 'mg' | 'shotgun' | 'laser' | 'grenade'
const WEAPONS: Record<WId, { name: string; letter: string; cd: number; ammo: number; color: string }> = {
  pistol: { name: 'PISTOLA', letter: 'P', cd: 0.21, ammo: Infinity, color: '#ffd23d' },
  mg: { name: 'METRALLETA', letter: 'H', cd: 0.078, ammo: 150, color: '#ff5d5d' },
  shotgun: { name: 'ESCOPETA', letter: 'S', cd: 0.5, ammo: 24, color: '#ff9f43' },
  laser: { name: 'LÁSER', letter: 'L', cd: 0.15, ammo: 70, color: '#35e0ff' },
  grenade: { name: 'GRANADAS', letter: 'G', cd: 0.5, ammo: 16, color: '#7bd36b' },
}
const DROP_WEAPONS: WId[] = ['mg', 'shotgun', 'laser', 'grenade', 'mg', 'shotgun']

const BIOMES = [
  {
    name: 'SELVA', skyA: '#1b0f2e', skyB: '#6b2440', skyC: '#e8763a', sun: '#ffcf8a', far: '#3a2140',
    mid: '#233321', mid2: '#2e4a26', gTop: '#6ea344', gMid: '#4e7a33', dirt: '#4a3524', dirt2: '#3a2818', kind: 0,
  },
  {
    name: 'DESIERTO', skyA: '#2a1a3a', skyB: '#a8403a', skyC: '#f2a65a', sun: '#fff0b0', far: '#6a3340',
    mid: '#8a4a3a', mid2: '#a65f44', gTop: '#e0a95e', gMid: '#c98a4b', dirt: '#8a5a30', dirt2: '#6e4624', kind: 1,
  },
  {
    name: 'BASE ENEMIGA', skyA: '#070d1f', skyB: '#162a52', skyC: '#3a6ea5', sun: '#bcd8ff', far: '#10203a',
    mid: '#16294a', mid2: '#1d3560', gTop: '#7a8aa6', gMid: '#4a566e', dirt: '#323a4c', dirt2: '#252c3a', kind: 2,
  },
]
type Biome = (typeof BIOMES)[number]

const BOSS_NAMES = ['HELICÓPTERO ARTILLADO', 'TANQUE JEFE', 'MECA GIGANTE']

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type EType = 'grunt' | 'rusher' | 'bazooka' | 'drone' | 'turret' | 'jeep'

interface Ent {
  id: number
  t: EType
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  hp: number
  max: number
  face: 1 | -1
  hit: number
  kb: number
  st: number
  stT: number
  cd: number
  n: number
  ph: number
  fixed: boolean
  carry: WId | null
  ang: number
  base: number
  life: number
  turned: boolean
  n2: number
}
interface Prop {
  kind: 'barrel' | 'crate'
  x: number
  y: number
  w: number
  h: number
  hp: number
  hit: number
  fuse: number
}
interface Item {
  kind: WId | 'hp'
  x: number
  y: number
  vy: number
  ph: number
}
interface Hostage {
  x: number
  y: number
  st: 0 | 1 | 2
  t: number
  drop: WId | 'hp' | null
}
interface Plat {
  x: number
  y: number
  w: number
}
type BK = 'p' | 'mg' | 'pel' | 'las' | 'gre' | 'shell' | 'e' | 'rocket' | 'bomb' | 'wave' | 'mis'
interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  life: number
  k: BK
  ow: 0 | 1
  hits: number[] | null
  g: number
  r: number
}
interface Corpse {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rv: number
  t: number
  kind: EType
  face: 1 | -1
  bounced: boolean
}
interface Ring {
  x: number
  y: number
  r: number
  max: number
  life: number
  color: string
}
interface Boss {
  kind: 0 | 1 | 2
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  hp: number
  max: number
  hit: number
  st: number
  stT: number
  t: number
  cd: number
  cd2: number
  face: 1 | -1
  dying: boolean
  dieT: number
  burst: number
  phase2: boolean
  ground: boolean
}
interface Tank {
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  st: 0 | 1 | 2
  face: 1 | -1
  cd: number
  cdv: number
  hit: number
  inv: number
  aim: number
}
type EvType = 'grunt' | 'rusher' | 'bazooka' | 'drone' | 'turret' | 'jeep' | 'ambush' | 'crate' | 'hostage' | 'barrel' | 'scaffold' | 'tank' | 'weapon'
interface Ev {
  x: number
  t: EvType
  n: number
  w: WId | null
  done: boolean
}

interface Player {
  x: number
  y: number
  vx: number
  vy: number
  face: 1 | -1
  ground: boolean
  coyote: number
  jumpBuf: number
  crouch: boolean
  hp: number
  lives: number
  inv: number
  fireCd: number
  weapon: WId
  ammo: number
  aim: number
  run: number
  muzzle: number
  dead: boolean
  deadT: number
  mounted: boolean
  drop: number
  onPlat: boolean
  recoil: number
}

interface G {
  phase: 'ready' | 'play' | 'clear' | 'over'
  paused: boolean
  clock: number
  t: number
  zone: number
  biome: Biome
  len: number
  cam: number
  score: number
  nextLife: number
  p: Player
  ents: Ent[]
  props: Prop[]
  items: Item[]
  hostages: Hostage[]
  plats: Plat[]
  bullets: Bullet[]
  corpses: Corpse[]
  rings: Ring[]
  evs: Ev[]
  boss: Boss | null
  tank: Tank | null
  bossSpawned: boolean
  bossDone: boolean
  combo: number
  comboT: number
  maxCombo: number
  kills: number
  rescued: number
  hostTotal: number
  noDamage: boolean
  id: number
  banner: { text: string; sub: string; t: number; max: number } | null
  clearT: number
  fade: number
  idleT: number
  respawnT: number
  zoneTime: number
  lines: string[]
  bossHitFlash: number
}

const FIRE = ['#fff3b0', '#ffd23d', '#ff8a3d', '#e84c4c']
const SMOKE = ['#3b3b4d', '#55556b', '#2a2a38']
const SPARK = ['#fff3b0', '#ffd23d', '#ffffff']

function newPlayer(x: number): Player {
  return {
    x, y: GROUND - PH, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, jumpBuf: 0, crouch: false,
    hp: 3, lives: 3, inv: 0, fireCd: 0, weapon: 'pistol', ammo: Infinity, aim: 0, run: 0, muzzle: 0,
    dead: false, deadT: 0, mounted: false, drop: 0, onPlat: false, recoil: 0,
  }
}

function genZone(z: number): { len: number; evs: Ev[]; hostTotal: number } {
  const len = Math.min(7000, 3900 + z * 420)
  const evs: Ev[] = []
  const add = (x: number, t: EvType, n = 1, w: WId | null = null) => evs.push({ x, t, n, w, done: false })
  let x = 330
  let hostages = 0
  let sinceCrate = 0
  if (z === 1) add(560, 'weapon', 1, 'mg')
  while (x < len - 650) {
    const r = Math.random()
    const lvl = Math.min(z, 6)
    if (r < 0.3) add(x, 'grunt', 1 + (Math.random() < 0.4 + lvl * 0.05 ? 1 : 0) + (lvl > 3 && Math.random() < 0.4 ? 1 : 0))
    else if (r < 0.44) add(x, 'rusher', 1 + (Math.random() < 0.3 ? 1 : 0))
    else if (r < 0.57) add(x, 'drone', 1 + (lvl > 1 && Math.random() < 0.5 ? 1 : 0) + (lvl > 3 ? 1 : 0))
    else if (r < 0.68) add(x, lvl >= 2 ? 'bazooka' : 'grunt', 1)
    else if (r < 0.78) {
      add(x + 140, 'turret', 1)
      if (Math.random() < 0.6) add(x + 100, 'barrel', 2)
    } else if (r < 0.88) add(x, 'scaffold', Math.random() < 0.5 ? 1 : 0)
    else if (r < 0.94) add(x, lvl >= 2 ? 'jeep' : 'rusher', 1)
    else add(x, lvl >= 2 ? 'ambush' : 'grunt', 3)
    if (Math.random() < 0.3) add(x + 70, 'barrel', 1)
    sinceCrate += 1
    if (sinceCrate >= 4 && Math.random() < 0.6) {
      add(x + 110, 'crate', 1, pick(DROP_WEAPONS))
      sinceCrate = 0
    }
    if (hostages < 3 && x > len * (0.2 + hostages * 0.25) && Math.random() < 0.5) {
      add(x + 40, 'hostage', 1, pick(DROP_WEAPONS))
      hostages++
    }
    x += rand(185, 255) - Math.min(70, z * 10)
  }
  while (hostages < 3) {
    add(500 + hostages * (len / 4) + rand(0, 200), 'hostage', 1, pick(DROP_WEAPONS))
    hostages++
  }
  add(len * 0.42, 'tank')
  evs.sort((a, b) => a.x - b.x)
  return { len, evs, hostTotal: 3 }
}

function newGame(zone = 1): G {
  const { len, evs, hostTotal } = genZone(zone)
  return {
    phase: 'ready', paused: false, clock: 0, t: 0, zone, biome: BIOMES[(zone - 1) % BIOMES.length],
    len, cam: 0, score: 0, nextLife: 25000, p: newPlayer(60), ents: [], props: [], items: [], hostages: [],
    plats: [], bullets: [], corpses: [], rings: [], evs, boss: null, tank: null, bossSpawned: false,
    bossDone: false, combo: 0, comboT: 0, maxCombo: 0, kills: 0, rescued: 0, hostTotal, noDamage: true,
    id: 1, banner: null, clearT: 0, fade: 0, idleT: 0, respawnT: 0, zoneTime: 0, lines: [], bossHitFlash: 0,
  }
}

// ---------------------------------------------------------------------------
// Dibujo de soldados (procedural, apunta en 8 direcciones)
// ---------------------------------------------------------------------------
interface SoldierPal {
  helmet: string
  skin: string
  vest: string
  pants: string
  boots: string
  band: string | null
  eye: string
}
const PAL_PLAYER: SoldierPal = { helmet: '#2e6b4a', skin: '#e8b27d', vest: '#3e8e5a', pants: '#2b3b2e', boots: '#15181a', band: '#ff4d4d', eye: '#101010' }
const PAL_GRUNT: SoldierPal = { helmet: '#6b5b3a', skin: '#d9a66c', vest: '#8a7a55', pants: '#4a4030', boots: '#1d1a14', band: null, eye: '#ff4040' }
const PAL_RUSHER: SoldierPal = { helmet: '#7a2d2d', skin: '#d9a66c', vest: '#b8453a', pants: '#3a2a2a', boots: '#1d1414', band: '#ffd23d', eye: '#ffffff' }
const PAL_BAZ: SoldierPal = { helmet: '#3d4a5e', skin: '#d9a66c', vest: '#566a85', pants: '#2a3342', boots: '#14181f', band: null, eye: '#ff4040' }

interface SoldierOpts {
  face: 1 | -1
  pal: SoldierPal
  run: number
  air: boolean
  crouch: boolean
  aim: number | null // ángulo absoluto del arma, null = sin arma levantada
  weapon: WId | 'tube' | 'knife'
  white: boolean
  clock: number
  muzzle?: number
  pose?: 'salute' | 'tied'
}

function drawSoldier(ctx: CanvasRenderingContext2D, x: number, footY: number, o: SoldierOpts) {
  const c = (col: string) => (o.white ? '#ffffff' : col)
  ctx.save()
  ctx.translate(Math.round(x), Math.round(footY))
  ctx.scale(o.face, 1)
  const p = o.pal
  const crouch = o.crouch
  const sh = crouch ? 8 : 0 // cuánto baja el torso
  // piernas
  ctx.fillStyle = c(p.pants)
  if (o.air) {
    ctx.fillRect(-5, -9 + sh * 0.2, 4, 6)
    ctx.fillRect(1, -7 + sh * 0.2, 4, 5)
    ctx.fillStyle = c(p.boots)
    ctx.fillRect(-6, -3, 5, 3)
    ctx.fillRect(1, -3, 5, 3)
  } else if (crouch) {
    ctx.fillRect(-6, -6, 12, 6)
    ctx.fillStyle = c(p.boots)
    ctx.fillRect(-7, -3, 6, 3)
    ctx.fillRect(1, -3, 6, 3)
  } else {
    const s = Math.sin(o.run)
    const l1 = Math.max(0, s) * 3
    const l2 = Math.max(0, -s) * 3
    ctx.fillRect(-5 + s * 2.2, -9, 4, 9 - l1)
    ctx.fillRect(1 - s * 2.2, -9, 4, 9 - l2)
    ctx.fillStyle = c(p.boots)
    ctx.fillRect(-6 + s * 2.2, -3 - l1, 5, 3)
    ctx.fillRect(1 - s * 2.2, -3 - l2, 5, 3)
  }
  // torso
  const ty = -19 + sh
  const tH = crouch ? 11 : 12
  ctx.fillStyle = c(p.vest)
  ctx.fillRect(-5, ty, 10, tH - 1)
  ctx.fillStyle = c(p.pants)
  ctx.fillRect(-5, ty + tH - 3, 10, 2)
  // cabeza
  const hy = ty - 8
  ctx.fillStyle = c(p.skin)
  ctx.fillRect(-4, hy + 3, 8, 6)
  ctx.fillStyle = c(p.helmet)
  ctx.fillRect(-5, hy, 10, 4)
  ctx.fillRect(-5, hy + 3, 2, 3)
  if (!o.white) {
    ctx.fillStyle = p.eye
    ctx.fillRect(1, hy + 5, 2, 2)
  }
  if (p.band) {
    ctx.fillStyle = c(p.band)
    ctx.fillRect(-4, hy + 3, 8, 1)
    const w = Math.sin(o.clock * 14) * 1.5
    ctx.fillRect(-9, hy + 3 + w, 5, 1)
    ctx.fillRect(-11, hy + 5 - w, 3, 1)
  }
  // brazo y arma
  const pivX = 2
  const pivY = ty + 4
  if (o.pose === 'salute') {
    ctx.fillStyle = c(p.skin)
    ctx.fillRect(3, hy + 1, 3, 3)
    ctx.fillRect(3, hy + 3, 2, 7)
  } else if (o.aim !== null) {
    let a = Math.atan2(Math.sin(o.aim), Math.cos(o.aim) * o.face)
    ctx.save()
    ctx.translate(pivX, pivY)
    ctx.rotate(a)
    ctx.fillStyle = c(p.skin)
    ctx.fillRect(0, -1.5, 6, 3)
    switch (o.weapon) {
      case 'mg':
        ctx.fillStyle = c('#2a2e33')
        ctx.fillRect(4, -2.5, 13, 5)
        ctx.fillStyle = c('#8a8f99')
        ctx.fillRect(12, -1.5, 8, 2)
        ctx.fillStyle = c('#1a1d21')
        ctx.fillRect(7, 2, 3, 4)
        break
      case 'shotgun':
        ctx.fillStyle = c('#5a3b22')
        ctx.fillRect(3, -2, 7, 4)
        ctx.fillStyle = c('#9aa0a8')
        ctx.fillRect(9, -1.5, 13, 3)
        break
      case 'laser':
        ctx.fillStyle = c('#2b3f55')
        ctx.fillRect(4, -3, 12, 6)
        ctx.fillStyle = c('#35e0ff')
        ctx.fillRect(14, -2, 6, 4)
        break
      case 'grenade':
        ctx.fillStyle = c('#4b6b3a')
        ctx.fillRect(2, -3.5, 13, 7)
        ctx.fillStyle = c('#2a3d20')
        ctx.fillRect(13, -4.5, 4, 9)
        break
      case 'tube':
        ctx.fillStyle = c('#3a3f47')
        ctx.fillRect(-4, -4, 20, 8)
        ctx.fillStyle = c('#ff8a3d')
        ctx.fillRect(15, -3, 2, 6)
        break
      case 'knife':
        ctx.fillStyle = c('#d8dde6')
        ctx.fillRect(5, -1, 9, 2)
        break
      default:
        ctx.fillStyle = c('#22262b')
        ctx.fillRect(4, -2, 9, 4)
        ctx.fillStyle = c('#7c828c')
        ctx.fillRect(10, -1, 5, 2)
    }
    if (o.muzzle && o.muzzle > 0) {
      const len = o.weapon === 'mg' ? 20 : o.weapon === 'shotgun' ? 22 : 15
      ctx.fillStyle = o.white ? '#fff' : '#fff3b0'
      ctx.beginPath()
      ctx.moveTo(len, 0)
      ctx.lineTo(len + 5, -4)
      ctx.lineTo(len + 11, 0)
      ctx.lineTo(len + 5, 4)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#ffa63d'
      ctx.fillRect(len, -1.5, 5, 3)
    }
    ctx.restore()
    a = 0
  } else {
    ctx.fillStyle = c(p.skin)
    ctx.fillRect(-1, pivY, 3, 7)
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function GunAndRun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const beginRef = useRef<() => void>(() => {})
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest('gun-and-run') : 0))
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [zone, setZone] = useState(1)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ zone: 1, kills: 0, rescued: 0, combo: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const rawFont = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    const FONT = rawFont ? `${rawFont}, monospace` : '"Press Start 2P", monospace'
    try {
      void document.fonts?.load(`10px ${FONT}`).catch(() => {})
    } catch {
      // sin API de fuentes
    }

    let g = newGame(1)
    let raf = 0
    let last = performance.now()
    let hudT = 0
    let lastScoreShown = -1
    let lastZone = 1
    const skyCache = new Map<string, HTMLCanvasElement>()

    const getSky = (b: Biome) => {
      let c = skyCache.get(b.name)
      if (c) return c
      c = document.createElement('canvas')
      c.width = W
      c.height = GROUND
      const x = c.getContext('2d')!
      const gr = x.createLinearGradient(0, 0, 0, GROUND)
      gr.addColorStop(0, b.skyA)
      gr.addColorStop(0.55, b.skyB)
      gr.addColorStop(1, b.skyC)
      x.fillStyle = gr
      x.fillRect(0, 0, W, GROUND)
      const sg = x.createRadialGradient(W * 0.72, 125, 4, W * 0.72, 125, 110)
      sg.addColorStop(0, b.sun + 'cc')
      sg.addColorStop(1, b.sun + '00')
      x.fillStyle = sg
      x.fillRect(0, 0, W, GROUND)
      x.fillStyle = b.sun
      x.beginPath()
      x.arc(W * 0.72, 125, 22, 0, Math.PI * 2)
      x.fill()
      // estrellas
      for (let i = 0; i < 40; i++) {
        x.fillStyle = `rgba(255,255,255,${0.25 + hash01(i * 3) * 0.5})`
        x.fillRect(Math.floor(hash01(i) * W), Math.floor(hash01(i + 77) * 90), 1, 1)
      }
      skyCache.set(b.name, c)
      return c
    }

    // ---------- utilidades ----------
    const pw = () => (g.p.crouch ? PH_CROUCH : PH)
    const pcx = () => (g.p.mounted && g.tank ? g.tank.x + 23 : g.p.x + PW / 2)
    const pcy = () => (g.p.mounted && g.tank ? g.tank.y + 14 : g.p.y + pw() / 2)
    const mult = () => (g.combo >= 15 ? 4 : g.combo >= 8 ? 3 : g.combo >= 4 ? 2 : 1)
    const text = (x: number, y: number, s: string, color = '#fff', size = 10, life = 0.9) => juice.text(x, y, s, color, size, life)

    const addScore = (n: number) => {
      g.score += Math.round(n)
      while (g.score >= g.nextLife) {
        g.nextLife += 25000
        g.p.lives = Math.min(5, g.p.lives + 1)
        g.p.hp = 3
        text(g.cam + W / 2, 100, 'VIDA EXTRA', '#5df2a3', 12, 1.6)
        sfx.levelUp()
      }
    }

    const sparks = (x: number, y: number, n = 6, color: string | string[] = SPARK) =>
      juice.burst(x, y, color, { count: n, speed: 150, life: 0.28, size: 2.2, drag: 3 })

    const addRing = (x: number, y: number, max: number, color = '#ffd23d') =>
      g.rings.push({ x, y, r: 6, max, life: 0.32, color })

    const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
      ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by

    // ---------- efectos grandes ----------
    const explode = (x: number, y: number, r: number, dmg: number, hurtsPlayer: boolean, depth = 0) => {
      juice.burst(x, y, FIRE, { count: Math.round(14 + r * 0.45), speed: 90 + r * 2.4, life: 0.55, size: 4.5, drag: 2.2 })
      juice.burst(x, y, SMOKE, { count: 7, speed: 50, life: 0.9, size: 6, drag: 1.5 })
      addRing(x, y, r * 1.2)
      juice.shake(r > 50 ? 0.5 : 0.28)
      if (r > 50) juice.flash('#ffd9a0', 0.2)
      if (r > 50) sfx.bomb()
      else sfx.explode()
      for (const e of g.ents) {
        const dx = e.x + e.w / 2 - x
        const dy = e.y + e.h / 2 - y
        if (dx * dx + dy * dy < (r + e.w * 0.4) * (r + e.w * 0.4)) dmgEnt(e, dmg, Math.sign(dx) * 200, true)
      }
      const b = g.boss
      if (b && !b.dying) {
        const dx = b.x + b.w / 2 - x
        const dy = b.y + b.h / 2 - y
        if (Math.hypot(dx, dy) < r + b.w * 0.45) dmgBoss(Math.ceil(dmg * 0.8), x, y)
      }
      for (const pr of g.props) {
        const dx = pr.x + pr.w / 2 - x
        const dy = pr.y + pr.h / 2 - y
        if (pr.fuse <= 0 && dx * dx + dy * dy < (r + 10) * (r + 10) && depth < 3) {
          pr.hp = 0
          pr.fuse = 0.1
        }
      }
      if (hurtsPlayer) {
        const dx = pcx() - x
        const dy = pcy() - y
        if (dx * dx + dy * dy < (r * 0.9) * (r * 0.9)) hurtPlayer(x)
      }
    }

    const dropItem = (x: number, y: number, kind: WId | 'hp') => g.items.push({ kind, x, y, vy: -120, ph: Math.random() * 6 })

    // ---------- daño ----------
    function hurtPlayer(srcX: number) {
      const p = g.p
      if (g.phase !== 'play' || p.dead || p.inv > 0) return
      g.noDamage = false
      if (p.mounted && g.tank) {
        const t = g.tank
        if (t.inv > 0) return
        t.hp -= 1
        t.hit = 0.15
        t.inv = 0.6
        sparks(t.x + 23, t.y + 10, 10)
        juice.shake(0.35)
        juice.freeze(50)
        sfx.hurt()
        if (t.hp <= 0) {
          t.st = 2
          p.mounted = false
          p.x = t.x + 10
          p.y = t.y - 10
          p.vy = -260
          p.vx = (t.x < srcX ? -1 : 1) * 80
          p.inv = 2
          explode(t.x + 23, t.y + 12, 64, 8, false)
          juice.freeze(120)
          text(t.x + 23, t.y - 10, 'TANQUE DESTRUIDO', '#ff5d5d', 9, 1.4)
        }
        return
      }
      p.hp -= 1
      p.inv = 1.8
      p.vy = -190
      p.vx = (p.x + PW / 2 < srcX ? -1 : 1) * 140
      p.ground = false
      g.combo = 0
      g.comboT = 0
      sparks(p.x + PW / 2, p.y + 12, 14, ['#ff5d5d', '#ffd23d', '#ffffff'])
      juice.shake(0.55)
      juice.freeze(90)
      juice.flash('#ff3b3b', 0.35)
      sfx.hurt()
      if (p.hp <= 0) {
        p.dead = true
        p.deadT = 0
        p.lives -= 1
        p.vy = -280
        explode(p.x + PW / 2, p.y + 12, 36, 2, false)
        juice.shake(0.8)
        sfx.gameOver()
        if (p.lives < 0) {
          p.lives = 0
          g.respawnT = -1
        } else {
          g.respawnT = 1.4
        }
      }
    }

    function killEnt(e: Ent, bvx: number, big: boolean) {
      const idx = g.ents.indexOf(e)
      if (idx >= 0) g.ents.splice(idx, 1)
      g.kills++
      g.combo++
      g.maxCombo = Math.max(g.maxCombo, g.combo)
      g.comboT = 2.4
      const base = { grunt: 100, rusher: 150, bazooka: 250, drone: 200, turret: 300, jeep: 500 }[e.t]
      const m = mult()
      addScore(base * m)
      const cx = e.x + e.w / 2
      const cy = e.y + e.h / 2
      text(cx, e.y - 4, m > 1 ? `+${base * m} x${m}` : `+${base}`, m >= 3 ? '#ff8a3d' : '#ffd23d', m > 1 ? 10 : 9, 0.9)
      if (e.t === 'grunt' || e.t === 'rusher' || e.t === 'bazooka') {
        const dir = bvx === 0 ? e.face * -1 : Math.sign(bvx)
        g.corpses.push({
          x: e.x, y: e.y, vx: dir * (110 + (big ? 90 : 0)), vy: big ? -230 : -170, rot: 0, rv: dir * rand(8, 14), t: 0,
          kind: e.t, face: e.face, bounced: false,
        })
        juice.burst(cx, cy, ['#ff5d5d', '#ffd23d', '#ffffff'], { count: 8, speed: 130, life: 0.3, size: 2.5, drag: 3 })
        sfx.hit()
        if (big) juice.freeze(40)
      } else {
        explode(cx, cy, e.t === 'jeep' ? 52 : 34, e.t === 'jeep' ? 3 : 2, false)
        juice.freeze(e.t === 'jeep' ? 70 : 40)
        if (e.t === 'drone') {
          g.corpses.push({ x: e.x, y: e.y, vx: bvx * 0.2, vy: 0, rot: 0, rv: rand(-6, 6), t: 0, kind: 'drone', face: e.face, bounced: false })
        }
      }
      if (e.carry) {
        dropItem(cx, e.y, e.carry)
      } else if (Math.random() < 0.05) {
        dropItem(cx, e.y, 'hp')
      }
    }

    function dmgEnt(e: Ent, dmg: number, bvx: number, big = false) {
      e.hp -= dmg
      e.hit = 0.09
      if (e.t !== 'turret' && e.t !== 'jeep') e.kb += Math.sign(bvx) * (big ? 130 : 55)
      if (e.hp <= 0) killEnt(e, bvx, big || dmg >= 3)
    }

    function dmgBoss(dmg: number, bx: number, by: number) {
      const b = g.boss
      if (!b || b.dying || b.st === 0) return
      b.hp -= dmg
      b.hit = 0.07
      g.bossHitFlash = 0.07
      sparks(bx, by, 4)
      if (Math.random() < 0.3) tone({ freq: 180, to: 120, dur: 0.05, vol: 0.04, type: 'square' })
      if (!b.phase2 && b.hp < b.max * 0.5) {
        b.phase2 = true
        juice.shake(0.5)
        juice.flash('#ff3b3b', 0.3)
        text(b.x + b.w / 2, b.y - 10, '¡FURIA!', '#ff5d5d', 12, 1.4)
        sfx.siren()
      }
      if (b.hp <= 0) {
        b.hp = 0
        b.dying = true
        b.dieT = 0
        b.vx = 0
        juice.freeze(160)
        juice.shake(0.9)
        juice.flash('#ffffff', 0.5)
        for (const bu of g.bullets) if (bu.ow === 1) bu.life = 0
      }
    }

    function breakProp(pr: Prop) {
      const i = g.props.indexOf(pr)
      if (i >= 0) g.props.splice(i, 1)
      const cx = pr.x + pr.w / 2
      const cy = pr.y + pr.h / 2
      if (pr.kind === 'barrel') {
        addScore(50)
        text(cx, pr.y - 6, '+50', '#ffd23d', 9, 0.8)
        explode(cx, cy, 58, 5, true)
      } else {
        addScore(40)
        juice.burst(cx, cy, ['#a87a45', '#6b4a28', '#d9b27a'], { count: 12, speed: 140, life: 0.5, size: 3, gravity: 500, drag: 1 })
        noise({ dur: 0.1, vol: 0.05, freq: 1500 })
        juice.shake(0.12)
        dropItem(cx, pr.y, Math.random() < 0.2 ? 'hp' : pick(DROP_WEAPONS))
      }
    }

    // ---------- disparos del jugador ----------
    const addBullet = (b: Partial<Bullet> & Pick<Bullet, 'x' | 'y' | 'vx' | 'vy' | 'k'>) =>
      g.bullets.push({ dmg: 1, life: 1.2, ow: 0, hits: null, g: 0, r: 3, ...b })

    const shootPlayer = (dt: number) => {
      void dt
      const p = g.p
      const k = pressedRef.current
      const tank = p.mounted ? g.tank : null
      const ax = Math.cos(p.aim)
      const ay = Math.sin(p.aim)
      let ox: number
      let oy: number
      if (tank) {
        ox = tank.x + 23 + ax * 24
        oy = tank.y + 8 + ay * 22
      } else {
        ox = p.x + PW / 2 + p.face * 2 + ax * 6
        oy = p.y + (p.crouch ? 8 : 11) + ay * 6
      }
      const tx = ox + ax * 12
      const ty = oy + ay * 12
      if (tank) {
        tank.cdv -= 0
        // cañón principal
        if (tank.cd <= 0) {
          tank.cd = 0.55
          addBullet({ x: tx, y: ty, vx: ax * 360, vy: ay * 360, dmg: 4, life: 1.2, k: 'shell', r: 5 })
          juice.shake(0.25)
          juice.burst(tx, ty, FIRE, { count: 6, speed: 120, life: 0.2, size: 3, angle: p.aim, arc: 0.8 })
          noise({ dur: 0.14, vol: 0.09, freq: 700 })
          tone({ freq: 140, to: 60, dur: 0.14, vol: 0.06, type: 'triangle' })
          tank.vx -= ax * 40
          p.muzzle = 0.06
        }
        // ametralladora
        if (tank.cdv <= 0) {
          tank.cdv = 0.11
          const a = p.aim + rand(-0.06, 0.06)
          addBullet({ x: tx, y: ty - 6, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, k: 'mg', life: 0.9 })
          tone({ freq: 700, to: 420, dur: 0.03, vol: 0.02, type: 'square' })
        }
        return
      }
      if (p.fireCd > 0) return
      if (p.weapon !== 'pistol' && p.ammo <= 0) {
        p.weapon = 'pistol'
        p.ammo = Infinity
        text(p.x, p.y - 10, 'SIN MUNICIÓN', '#ff5d5d', 9, 1)
        return
      }
      const w = WEAPONS[p.weapon]
      p.fireCd = w.cd
      p.muzzle = 0.055
      if (p.weapon !== 'pistol') p.ammo -= 1
      const cs = () =>
        juice.burst(ox, oy, '#e8c35a', {
          count: 1, speed: 80, angle: -Math.PI / 2 - p.face * 0.7, arc: 0.7, gravity: 700, size: 2.2, life: 0.55, drag: 0.4,
        })
      switch (p.weapon) {
        case 'pistol': {
          const a = p.aim + rand(-0.02, 0.02)
          addBullet({ x: tx, y: ty, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, k: 'p', life: 0.9 })
          tone({ freq: 880, to: 300, dur: 0.06, vol: 0.04, type: 'square' })
          noise({ dur: 0.04, vol: 0.03, freq: 2500 })
          cs()
          p.recoil = 0.6
          break
        }
        case 'mg': {
          const a = p.aim + rand(-0.07, 0.07)
          addBullet({ x: tx, y: ty, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, k: 'mg', life: 0.9 })
          tone({ freq: 760, to: 360, dur: 0.045, vol: 0.03, type: 'square' })
          noise({ dur: 0.03, vol: 0.025, freq: 2800 })
          cs()
          juice.shake(0.03)
          p.recoil = 0.5
          break
        }
        case 'shotgun': {
          for (let i = 0; i < 6; i++) {
            const a = p.aim + (i - 2.5) * 0.11 + rand(-0.03, 0.03)
            const sp = rand(380, 460)
            addBullet({ x: tx, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k: 'pel', life: 0.3, dmg: 1 })
          }
          noise({ dur: 0.18, vol: 0.1, freq: 1400 })
          tone({ freq: 150, to: 60, dur: 0.14, vol: 0.06, type: 'triangle' })
          cs()
          cs()
          juice.shake(0.16)
          juice.burst(tx, ty, FIRE, { count: 6, speed: 130, life: 0.2, size: 3, angle: p.aim, arc: 0.7 })
          if (!p.ground) p.vy -= ay * 0
          p.vx -= ax * 70
          p.recoil = 1
          break
        }
        case 'laser': {
          addBullet({ x: tx, y: ty, vx: ax * 720, vy: ay * 720, k: 'las', life: 0.75, dmg: 2, hits: [], r: 4 })
          sfx.laser()
          p.recoil = 0.3
          break
        }
        case 'grenade': {
          addBullet({
            x: tx, y: ty, vx: ax * 230 + p.vx * 0.4, vy: ay * 230 - 140, k: 'gre', life: 2.2, dmg: 5, g: 620, r: 4,
          })
          tone({ freq: 300, to: 520, dur: 0.1, vol: 0.04, type: 'triangle' })
          p.recoil = 0.5
          break
        }
      }
      void k
    }

    // ---------- disparos enemigos ----------
    const enemyShot = (x: number, y: number, speed: number, err = 0.07, kind: BK = 'e') => {
      const dx = pcx() - x
      const dy = pcy() - y
      const a = Math.atan2(dy, dx) + rand(-err, err)
      const sp = speed * (1 + (g.zone - 1) * 0.05)
      addBullet({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k: kind, ow: 1, life: 4, r: 3 })
      juice.burst(x, y, ['#fff3b0', '#ff8a3d'], { count: 3, speed: 60, life: 0.15, size: 2.5 })
      tone({ freq: 520, to: 260, dur: 0.07, vol: 0.025, type: 'square' })
    }

    const lob = (x: number, y: number, tx: number, ty: number, T: number, kind: BK, dmg = 1) => {
      const gg = 420
      const vx = (tx - x) / T
      const vy = (ty - y - 0.5 * gg * T * T) / T
      addBullet({ x, y, vx, vy, k: kind, ow: 1, g: gg, life: T + 1.5, dmg, r: 4 })
      tone({ freq: 240, to: 420, dur: 0.18, vol: 0.04, type: 'sawtooth' })
    }

    // ---------- creación de enemigos ----------
    const mkEnt = (t: EType, x: number, y: number): Ent => {
      const sizes: Record<EType, [number, number, number]> = {
        grunt: [14, 28, 2], rusher: [14, 28, 1], bazooka: [16, 28, 3], drone: [28, 16, 2], turret: [30, 24, 7], jeep: [52, 26, 6],
      }
      const [w, h, hp0] = sizes[t]
      const hp = Math.max(1, Math.round(hp0 * (1 + 0.12 * (g.zone - 1))))
      return {
        id: g.id++, t, x, y, w, h, vx: 0, vy: 0, hp, max: hp, face: -1, hit: 0, kb: 0, st: 0, stT: 0,
        cd: rand(0.4, 1.4), n: rand(130, 210), ph: Math.random() * 6, fixed: false, carry: null, ang: Math.PI,
        base: y, life: 0, turned: false, n2: 0,
      }
    }

    const spawnEnemy = (t: EType, x: number, y?: number, fixed = false) => {
      const e = mkEnt(t, x, 0)
      e.y = y ?? (t === 'drone' ? rand(54, 120) : GROUND - e.h)
      e.base = e.y
      e.fixed = fixed
      e.face = x > g.cam + W / 2 ? -1 : 1
      if (t === 'drone') e.vx = e.face * rand(60, 85)
      if (t === 'jeep') e.vx = e.face * rand(140, 165)
      if ((t === 'grunt' || t === 'bazooka') && Math.random() < 0.16) e.carry = pick(DROP_WEAPONS)
      g.ents.push(e)
      return e
    }

    const spawnEv = (ev: Ev) => {
      const right = g.cam + W + 30
      switch (ev.t) {
        case 'grunt':
          for (let i = 0; i < ev.n; i++) spawnEnemy('grunt', right + i * 34)
          break
        case 'rusher':
          for (let i = 0; i < ev.n; i++) spawnEnemy('rusher', right + i * 40)
          break
        case 'bazooka':
          spawnEnemy('bazooka', right + 10)
          break
        case 'drone':
          for (let i = 0; i < ev.n; i++) spawnEnemy('drone', right + i * 60, rand(50, 120))
          break
        case 'jeep':
          spawnEnemy('jeep', right + 20)
          text(g.cam + W - 60, 120, '¡VEHÍCULO!', '#ff5d5d', 9, 1)
          break
        case 'turret':
          spawnEnemy('turret', ev.x, GROUND - 24, true)
          break
        case 'ambush':
          text(g.cam + W / 2, 90, '¡EMBOSCADA!', '#ff5d5d', 12, 1.3)
          sfx.siren()
          for (let i = 0; i < 2; i++) spawnEnemy('grunt', right + i * 30)
          spawnEnemy('rusher', g.cam - 34)
          spawnEnemy('grunt', g.cam - 70)
          break
        case 'barrel':
          for (let i = 0; i < ev.n; i++) g.props.push({ kind: 'barrel', x: ev.x + i * 18, y: GROUND - 20, w: 16, h: 20, hp: 2, hit: 0, fuse: 0 })
          break
        case 'crate':
          g.props.push({ kind: 'crate', x: ev.x, y: GROUND - 22, w: 22, h: 22, hp: 3, hit: 0, fuse: 0 })
          break
        case 'weapon':
          g.items.push({ kind: ev.w ?? 'mg', x: ev.x, y: GROUND - 20, vy: 0, ph: 0 })
          break
        case 'hostage':
          g.hostages.push({ x: ev.x, y: GROUND - 18, st: 0, t: 0, drop: Math.random() < 0.7 ? (ev.w ?? 'mg') : 'hp' })
          break
        case 'scaffold': {
          const py = GROUND - 52
          g.plats.push({ x: ev.x, y: py, w: 92 })
          if (ev.n) {
            const e = spawnEnemy('grunt', ev.x + 50, py - 28, true)
            e.base = py - 28
            e.face = -1
          } else {
            g.items.push({ kind: pick(DROP_WEAPONS), x: ev.x + 38, y: py - 18, vy: 0, ph: 0 })
          }
          break
        }
        case 'tank':
          g.tank = { x: ev.x, y: GROUND - 30, vx: 0, vy: 0, hp: 8, st: 0, face: 1, cd: 0, cdv: 0, hit: 0, inv: 0, aim: 0 }
          break
      }
    }

    const spawnBoss = () => {
      const kind = ((g.zone - 1) % 3) as 0 | 1 | 2
      const round = Math.floor((g.zone - 1) / 3)
      const dims: Record<number, [number, number, number]> = { 0: [100, 52, 70], 1: [120, 62, 90], 2: [66, 104, 120] }
      const [w, h, hp0] = dims[kind]
      const hp = Math.round(hp0 * (1 + 0.4 * round))
      const ground = kind !== 0
      g.boss = {
        kind, x: g.cam + W + 40, y: ground ? GROUND - h : 40, w, h, vx: 0, vy: 0, hp, max: hp, hit: 0, st: 0, stT: 1.8, t: 0,
        cd: 2, cd2: 3.5, face: -1, dying: false, dieT: 0, burst: 0, phase2: false, ground,
      }
      g.bossSpawned = true
      g.banner = { text: '¡ALERTA!', sub: BOSS_NAMES[kind], t: 2.4, max: 2.4 }
      sfx.siren()
      juice.flash('#ff3b3b', 0.3)
    }

    // ---------- inicio de zona ----------
    const startZone = (z: number, keep?: G) => {
      const fresh = newGame(z)
      if (keep) {
        fresh.score = keep.score
        fresh.nextLife = keep.nextLife
        fresh.p = { ...newPlayer(60), hp: 3, lives: keep.p.lives, weapon: keep.p.weapon, ammo: keep.p.ammo }
        if (fresh.p.weapon !== 'pistol' && fresh.p.ammo <= 0) {
          fresh.p.weapon = 'pistol'
          fresh.p.ammo = Infinity
        }
        fresh.kills = keep.kills
        fresh.rescued = keep.rescued
        fresh.maxCombo = keep.maxCombo
      }
      fresh.phase = 'play'
      fresh.banner = { text: `ZONA ${z}`, sub: fresh.biome.name, t: 2.4, max: 2.4 }
      g = fresh
      juice.reset()
    }

    // ---------- actualización ----------
    const updatePlayer = (dt: number) => {
      const p = g.p
      const k = pressedRef.current
      const jp = justPressedRef.current
      const tank = p.mounted ? g.tank : null
      p.inv = Math.max(0, p.inv - dt)
      p.fireCd = Math.max(0, p.fireCd - dt)
      p.muzzle = Math.max(0, p.muzzle - dt)
      p.recoil = Math.max(0, p.recoil - dt * 6)
      p.drop = Math.max(0, p.drop - dt)

      if (p.dead) {
        p.deadT += dt
        p.vy += GRAV * dt
        p.y += p.vy * dt
        p.x += p.vx * dt
        p.vx *= 1 - Math.min(1, dt * 2)
        if (p.y > GROUND - 6) {
          p.y = GROUND - 6
          p.vy = 0
        }
        if (g.respawnT > 0) {
          g.respawnT -= dt
          if (g.respawnT <= 0) {
            const lives = p.lives
            g.p = newPlayer(clamp(g.cam + 60, 0, 99999))
            g.p.lives = lives
            g.p.inv = 2.6
            sfx.start()
          }
        } else if (g.respawnT < 0 && p.deadT > 1.3) {
          finish()
        }
        return
      }

      const right = k.has('right')
      const left = k.has('left')
      const up = k.has('up')
      const down = k.has('down')
      const dirX = (right ? 1 : 0) - (left ? 1 : 0)
      const fire = k.has('action')
      const jumpHeld = k.has('action2')

      // ----- en tanque -----
      if (tank) {
        if (dirX !== 0) tank.face = dirX as 1 | -1
        p.face = tank.face
        const ang = up ? (dirX !== 0 ? (tank.face > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4) : -Math.PI / 2) : tank.face > 0 ? 0 : Math.PI
        p.aim += (ang - p.aim) * Math.min(1, dt * 18)
        tank.vx += (dirX * 85 - tank.vx) * Math.min(1, dt * 8)
        tank.x += tank.vx * dt
        tank.cd -= dt
        tank.cdv -= dt
        tank.hit = Math.max(0, tank.hit - dt)
        tank.inv = Math.max(0, tank.inv - dt)
        if (jp.has('action2') && tank.y >= GROUND - 31) {
          tank.vy = -230
          sfx.jump()
        }
        tank.vy += GRAV * dt
        tank.y += tank.vy * dt
        if (tank.y > GROUND - 30) {
          if (tank.vy > 200) {
            juice.shake(0.2)
            juice.burst(tank.x + 23, GROUND, ['#8a7a60', '#5a4a38'], { count: 6, speed: 80, life: 0.3, size: 3, angle: -Math.PI / 2, arc: 2 })
          }
          tank.y = GROUND - 30
          tank.vy = 0
        }
        tank.x = clamp(tank.x, g.cam + 2, g.cam + W - 48)
        p.x = tank.x + 14
        p.y = tank.y
        if (fire) shootPlayer(dt)
        void jumpHeld
        return
      }

      // ----- movimiento -----
      p.crouch = p.ground && down
      const target = p.crouch ? 0 : dirX * RUN
      const acc = (p.ground ? 1300 : 800) * dt
      p.vx += clamp(target - p.vx, -acc, acc)
      if (dirX !== 0) p.face = dirX as 1 | -1
      if (p.ground && Math.abs(p.vx) > 20) p.run += dt * 15
      else if (p.ground) p.run = 0

      // ----- salto con coyote, buffer y salto variable -----
      if (jp.has('action2')) p.jumpBuf = 0.12
      else p.jumpBuf = Math.max(0, p.jumpBuf - dt)
      p.coyote = p.ground ? 0.1 : Math.max(0, p.coyote - dt)
      if (p.jumpBuf > 0 && p.coyote > 0) {
        if (down && p.onPlat) {
          p.drop = 0.28
          p.ground = false
          p.onPlat = false
          p.vy = 60
        } else {
          p.vy = JUMP_V
          p.ground = false
          sfx.jump()
          juice.burst(p.x + PW / 2, GROUND - 1, ['#8a7a60', '#5a4a38'], { count: 4, speed: 50, life: 0.25, size: 2.5, angle: -Math.PI / 2, arc: 2.5 })
        }
        p.jumpBuf = 0
        p.coyote = 0
      }
      const gmul = p.vy < 0 && !jumpHeld ? 2.4 : 1
      p.vy += GRAV * gmul * dt
      const prevBottom = p.y + pw()
      p.x += p.vx * dt
      p.y += p.vy * dt
      const wasGround = p.ground
      p.ground = false
      p.onPlat = false
      // suelo
      if (p.y + pw() >= GROUND) {
        if (!wasGround && p.vy > 160) {
          sfx.land()
          juice.burst(p.x + PW / 2, GROUND - 1, ['#8a7a60', '#5a4a38'], { count: 5, speed: 60, life: 0.25, size: 2.5, angle: -Math.PI / 2, arc: 2.5 })
        }
        p.y = GROUND - pw()
        p.vy = 0
        p.ground = true
      } else if (p.vy >= 0 && p.drop <= 0) {
        for (const pl of g.plats) {
          if (p.x + PW > pl.x && p.x < pl.x + pl.w && prevBottom <= pl.y + 3 && p.y + pw() >= pl.y) {
            p.y = pl.y - pw()
            p.vy = 0
            p.ground = true
            p.onPlat = true
            break
          }
        }
      }
      // crouch cambia la altura: mantener pies
      p.x = clamp(p.x, g.cam + 2, Math.min(g.cam + W - PW - 2, g.len + 30))

      // ----- apuntado en 8 direcciones -----
      let ang = p.face > 0 ? 0 : Math.PI
      if (up) ang = dirX !== 0 ? (p.face > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4) : -Math.PI / 2
      else if (down && !p.ground) ang = dirX !== 0 ? (p.face > 0 ? Math.PI / 4 : (3 * Math.PI) / 4) : Math.PI / 2
      // interpola por el camino corto
      let d = ang - p.aim
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      p.aim += d * Math.min(1, dt * 22)
      if (Math.abs(d) < 0.02) p.aim = ang
      if (fire) shootPlayer(dt)

      // ----- tanque: subirse -----
      const t = g.tank
      if (t && t.st === 0 && overlap(p.x, p.y, PW, pw(), t.x, t.y, 46, 30)) {
        t.st = 1
        p.mounted = true
        p.inv = Math.max(p.inv, 0.5)
        text(t.x + 23, t.y - 10, '¡TANQUE!', '#7bd36b', 11, 1.3)
        sfx.power()
        juice.flash('#7bd36b', 0.2)
      }
    }

    const updateEnts = (dt: number) => {
      const p = g.p
      const tx = pcx()
      const alive = !p.dead
      for (const e of [...g.ents]) {
        e.hit = Math.max(0, e.hit - dt)
        e.stT -= dt
        e.cd -= dt
        e.life += dt
        if (e.kb !== 0) {
          e.x += e.kb * dt
          e.kb *= 1 - Math.min(1, dt * 9)
          if (Math.abs(e.kb) < 4) e.kb = 0
        }
        const cx = e.x + e.w / 2
        const dx = tx - cx
        const onscreen = e.x > g.cam - 4 && e.x + e.w < g.cam + W + 4
        switch (e.t) {
          case 'grunt': {
            e.face = dx >= 0 ? 1 : -1
            if (e.st === 0) {
              e.vx = e.fixed ? 0 : e.face * (32 + g.zone * 2)
              if (onscreen && e.cd <= 0 && Math.abs(dx) < e.n + 60 && alive) {
                e.st = 1
                e.stT = 0.55
                e.vx = 0
              }
            } else if (e.st === 1) {
              e.vx = 0
              if (e.stT <= 0) {
                enemyShot(cx + e.face * 11, e.y + 12, 175, 0.08)
                e.n2 = e.n2 + 1
                if (e.n2 < 2 && Math.random() < 0.4) e.stT = 0.17
                else {
                  e.n2 = 0
                  e.st = 2
                  e.stT = rand(0.7, 1.2)
                }
              }
            } else {
              e.vx = e.fixed ? 0 : -e.face * 20
              if (e.stT <= 0) {
                e.st = 0
                e.cd = rand(0.7, 1.7)
              }
            }
            break
          }
          case 'rusher': {
            e.face = dx >= 0 ? 1 : -1
            if (e.st === 0) {
              e.vx = e.face * (118 + g.zone * 5)
              if (Math.abs(dx) < 50 && alive) {
                e.st = 1
                e.stT = 0.3
                e.vx = e.face * 230
                tone({ freq: 900, to: 300, dur: 0.1, vol: 0.03, type: 'sawtooth' })
              }
            } else if (e.st === 1) {
              if (e.stT <= 0) {
                e.st = 2
                e.stT = 0.7
                e.vx = 0
              }
            } else if (e.stT <= 0) e.st = 0
            break
          }
          case 'bazooka': {
            e.face = dx >= 0 ? 1 : -1
            e.vx = 0
            if (e.st === 0 && onscreen && e.cd <= 0 && alive) {
              e.st = 1
              e.stT = 0.75
            } else if (e.st === 1 && e.stT <= 0) {
              lob(cx + e.face * 12, e.y + 8, tx, GROUND - 6, 1.0, 'rocket', 1)
              e.st = 0
              e.cd = rand(2.2, 3.2)
            }
            break
          }
          case 'drone': {
            e.ph += dt * 3
            e.y = e.base + Math.sin(e.ph) * 16
            if (e.vx > 0 && cx > g.cam + W - 24) e.vx = -Math.abs(e.vx)
            if (e.vx < 0 && cx < g.cam + 24) e.vx = Math.abs(e.vx)
            e.face = e.vx >= 0 ? 1 : -1
            if (onscreen && alive && e.cd <= 0 && Math.abs(dx) < 26) {
              addBullet({ x: cx, y: e.y + e.h, vx: 0, vy: 40, k: 'bomb', ow: 1, g: 520, life: 3, dmg: 1, r: 4 })
              e.cd = 1.6
              tone({ freq: 700, to: 300, dur: 0.15, vol: 0.03, type: 'sine' })
            }
            if (e.life > 15) {
              e.y -= 90 * dt
              e.base -= 90 * dt
            }
            break
          }
          case 'turret': {
            const tcx = cx
            const tcy = e.y + 8
            const wantAng = Math.atan2(pcy() - tcy, dx)
            let d = wantAng - e.ang
            while (d > Math.PI) d -= Math.PI * 2
            while (d < -Math.PI) d += Math.PI * 2
            e.ang += d * Math.min(1, dt * 3)
            if (onscreen && alive) {
              if (e.st === 0 && e.cd <= 0) {
                e.st = 1
                e.stT = 0.45
              } else if (e.st === 1 && e.stT <= 0) {
                e.n2 = e.n2 + 1
                enemyShot(tcx + Math.cos(e.ang) * 16, tcy + Math.sin(e.ang) * 16, 190, 0.05)
                if (e.n2 >= 3) {
                  e.n2 = 0
                  e.st = 0
                  e.cd = rand(1.8, 2.6)
                } else e.stT = 0.17
              }
            }
            break
          }
          case 'jeep': {
            if (onscreen && alive && e.cd <= 0) {
              e.cd = 1.5
              enemyShot(cx + e.face * 16, e.y + 4, 190, 0.06)
            }
            if ((e.vx < 0 && e.x < g.cam - 120) || (e.vx > 0 && e.x > g.cam + W + 120)) {
              g.ents.splice(g.ents.indexOf(e), 1)
              continue
            }
            break
          }
        }
        e.x += e.vx * dt
        if (e.t === 'grunt' || e.t === 'rusher' || e.t === 'bazooka') {
          if (!e.fixed) e.y = GROUND - e.h
        }
        if (e.t !== 'jeep' && !e.fixed && e.t !== 'drone' && e.x < g.cam - 220) {
          g.ents.splice(g.ents.indexOf(e), 1)
          continue
        }
        // contacto con el jugador
        if (alive && p.inv <= 0 && !p.mounted) {
          const contact = e.t === 'rusher' || e.t === 'jeep' || e.t === 'drone' || (e.t === 'grunt' && false)
          if (contact && overlap(p.x + 2, p.y + 2, PW - 4, pw() - 4, e.x + 3, e.y + 3, e.w - 6, e.h - 6)) hurtPlayer(cx)
        } else if (alive && p.mounted && g.tank) {
          const t = g.tank
          if (overlap(t.x + 2, t.y + 2, 42, 26, e.x + 3, e.y + 3, e.w - 6, e.h - 6)) {
            if (e.t === 'grunt' || e.t === 'rusher' || e.t === 'bazooka') dmgEnt(e, 99, t.vx, true)
            else if (e.t === 'jeep' || e.t === 'drone') hurtPlayer(cx)
          }
        }
      }
    }

    const bossEnemyShot = (x: number, y: number, speed: number, spread = 0) => {
      const a = Math.atan2(pcy() - y, pcx() - x) + spread + rand(-0.03, 0.03)
      addBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, k: 'e', ow: 1, life: 4, r: 3 })
    }

    const updateBoss = (dt: number) => {
      const b = g.boss
      if (!b) return
      b.hit = Math.max(0, b.hit - dt)
      b.t += dt
      b.stT -= dt
      const p = g.p
      const alive = !p.dead
      const px = pcx()
      const dxp = px - (b.x + b.w / 2)
      const camL = g.cam
      if (b.dying) {
        b.dieT += dt
        b.vy += 400 * dt
        if (!b.ground) {
          b.y += b.vy * dt * 0.6
          b.x += Math.sin(b.dieT * 12) * 30 * dt
        }
        if (Math.random() < 0.35) {
          const ex = b.x + rand(0, b.w)
          const ey = b.y + rand(0, b.h)
          explode(ex, ey, 30, 0, false, 3)
          juice.shake(0.3)
        }
        if (b.dieT > 1.7 || (!b.ground && b.y + b.h >= GROUND)) {
          explode(b.x + b.w / 2, b.y + b.h / 2, 90, 0, false, 3)
          for (let i = 0; i < 4; i++) addRing(b.x + b.w / 2, b.y + b.h / 2, 60 + i * 22, i % 2 ? '#ffffff' : '#ffd23d')
          const pts = 5000 * g.zone
          addScore(pts)
          text(b.x + b.w / 2, b.y - 6, `+${pts}`, '#ffd23d', 14, 1.6)
          juice.shake(1)
          juice.flash('#ffffff', 0.7)
          juice.freeze(200)
          g.boss = null
          g.bossDone = true
          g.phase = 'clear'
          g.clearT = 0
          const bonus = g.rescued * 500
          addScore(bonus)
          let t2 = 0
          if (g.noDamage) {
            addScore(1000)
            t2 = 1000
          }
          g.lines = [`REHENES ${g.rescued}/${g.hostTotal}   +${bonus}`]
          if (t2) g.lines.push('SIN DAÑO   +1000')
          sfx.levelUp()
          for (const e of [...g.ents]) killEnt(e, 0, true)
        }
        return
      }
      const fast = b.phase2 ? 1.35 : 1
      if (b.kind === 0) {
        // ---------- helicóptero ----------
        if (b.st === 0) {
          b.x += (camL + W - 150 - b.x) * Math.min(1, dt * 2.2)
          if (b.stT <= 0) b.st = 1
        } else {
          const tx = clamp(px - b.w / 2 + Math.sin(b.t * 0.7) * 80, camL + 20, camL + W - b.w - 20)
          b.x += clamp(tx - b.x, -85 * fast * dt, 85 * fast * dt)
          b.y = 54 + Math.sin(b.t * 1.5) * 12
          b.face = dxp >= 0 ? 1 : -1
          b.cd -= dt
          b.cd2 -= dt
          if (b.burst > 0) {
            if (b.stT <= 0 && alive) {
              bossEnemyShot(b.x + b.w / 2, b.y + b.h - 6, 190, 0)
              b.burst--
              b.stT = 0.14
            }
          } else if (b.cd <= 0 && alive) {
            b.burst = b.phase2 ? 5 : 3
            b.stT = 0.1
            b.cd = 2.2 / fast
          }
          if (b.cd2 <= 0 && alive) {
            b.cd2 = 4.4 / fast
            for (let i = -1; i <= 1; i++) {
              addBullet({ x: b.x + b.w / 2 + i * 26, y: b.y + b.h, vx: i * 28, vy: 40, k: 'bomb', ow: 1, g: 520, life: 4, dmg: 1, r: 5 })
            }
            tone({ freq: 500, to: 200, dur: 0.3, vol: 0.05, type: 'sawtooth' })
            if (b.phase2) {
              for (const sx of [b.x + 4, b.x + b.w - 4]) {
                addBullet({ x: sx, y: b.y + 20, vx: (px - sx) * 0.4, vy: -40, k: 'mis', ow: 1, life: 3.2, dmg: 1, r: 5 })
              }
            }
          }
        }
      } else if (b.kind === 1) {
        // ---------- tanque jefe ----------
        b.y = GROUND - b.h
        if (b.st === 0) {
          b.x += (camL + W - 170 - b.x) * Math.min(1, dt * 2)
          if (b.stT <= 0) b.st = 1
        } else if (b.st === 1) {
          b.face = dxp >= 0 ? 1 : -1
          const want = Math.abs(dxp) > 230 ? 1 : Math.abs(dxp) < 150 ? -1 : 0
          b.vx = want * b.face * 38 * fast
          b.x += b.vx * dt
          b.x = clamp(b.x, camL + 10, camL + W - b.w - 6)
          b.cd -= dt
          b.cd2 -= dt
          if (b.cd <= 0 && alive) {
            b.cd = 2.3 / fast
            const sx = b.x + b.w / 2 + b.face * 30
            lob(sx, b.y + 6, px, GROUND - 6, 1.1, 'rocket', 1)
            juice.shake(0.22)
            juice.burst(sx, b.y + 6, FIRE, { count: 6, speed: 100, life: 0.2, size: 3 })
          }
          if (b.cd2 <= 0 && alive) {
            b.cd2 = 1.4 / fast
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                if (g.boss === b && !b.dying) bossEnemyShot(b.x + b.w / 2 + b.face * 40, b.y + 30, 200)
              }, i * 130)
            }
          }
          if (b.phase2 && b.stT <= 0 && alive) {
            b.st = 2
            b.stT = 0.9
            text(b.x + b.w / 2, b.y - 8, '¡CARGA!', '#ff5d5d', 10, 0.9)
            tone({ freq: 120, to: 240, dur: 0.8, vol: 0.05, type: 'sawtooth' })
          }
        } else if (b.st === 2) {
          b.x += Math.sin(b.t * 60) * 0.6
          if (b.stT <= 0) {
            b.st = 3
            b.stT = 0.9
            b.vx = b.face * 300
          }
        } else if (b.st === 3) {
          b.x += b.vx * dt
          if (b.x < camL + 6 || b.x + b.w > camL + W - 4) {
            b.x = clamp(b.x, camL + 6, camL + W - b.w - 4)
            b.vx = 0
            b.st = 4
            b.stT = 1.1
            juice.shake(0.6)
            explode(b.x + (b.face > 0 ? b.w : 0), GROUND - 14, 36, 0, false, 3)
          }
          if (b.stT <= 0) {
            b.st = 4
            b.stT = 0.9
            b.vx = 0
          }
        } else {
          if (b.stT <= 0) {
            b.st = 1
            b.stT = 6
          }
        }
        if (b.st === 1 && b.stT < -100) b.stT = 6
      } else {
        // ---------- meca ----------
        b.y = b.st === 3 ? b.y : GROUND - b.h
        if (b.st === 0) {
          b.x += (camL + W - 130 - b.x) * Math.min(1, dt * 2)
          if (b.stT <= 0) {
            b.st = 1
            b.stT = 2
          }
        } else if (b.st === 1) {
          b.face = dxp >= 0 ? 1 : -1
          const want = Math.abs(dxp) > 150 ? 1 : Math.abs(dxp) < 90 ? -1 : 0
          b.x += want * b.face * 42 * fast * dt
          b.x = clamp(b.x, camL + 10, camL + W - b.w - 6)
          if (b.stT <= 0) {
            const r = Math.random()
            if (r < 0.4) {
              b.st = 2
              b.burst = 3
              b.stT = 0.4
            } else if (r < 0.8) {
              b.st = 3
              b.stT = 0
              b.vy = -430
              b.vx = clamp((px - (b.x + b.w / 2)) * 0.9, -240, 240)
              tone({ freq: 140, to: 300, dur: 0.3, vol: 0.06, type: 'sawtooth' })
            } else if (b.phase2) {
              b.st = 4
              b.stT = 0.6
            } else {
              b.stT = 1
            }
          }
        } else if (b.st === 2) {
          if (b.stT <= 0) {
            if (b.burst > 0) {
              const cx = b.x + b.w / 2
              for (let i = -1; i <= 1; i++) bossEnemyShot(cx + b.face * 14, b.y + 30, 185, i * 0.28)
              b.burst--
              b.stT = 0.42
            } else {
              b.st = 1
              b.stT = rand(1.3, 2.1) / fast
            }
          }
        } else if (b.st === 3) {
          b.vy += 1000 * dt
          b.y += b.vy * dt
          b.x += b.vx * dt
          b.x = clamp(b.x, camL + 6, camL + W - b.w - 6)
          if (b.y + b.h >= GROUND && b.vy > 0) {
            b.y = GROUND - b.h
            b.vy = 0
            b.vx = 0
            b.st = 1
            b.stT = rand(1.2, 1.8) / fast
            juice.shake(0.7)
            juice.freeze(60)
            sfx.bomb()
            const cx = b.x + b.w / 2
            addBullet({ x: cx - 20, y: GROUND - 8, vx: -190, vy: 0, k: 'wave', ow: 1, life: 3, dmg: 1, r: 8 })
            addBullet({ x: cx + 20, y: GROUND - 8, vx: 190, vy: 0, k: 'wave', ow: 1, life: 3, dmg: 1, r: 8 })
            juice.burst(cx, GROUND, ['#8a7a60', '#d9c9a0'], { count: 14, speed: 140, life: 0.4, size: 3, angle: -Math.PI / 2, arc: 2.8 })
          }
        } else if (b.st === 4) {
          if (b.stT <= 0) {
            const cx = b.x + b.w / 2
            for (const sx of [cx - 24, cx + 24]) addBullet({ x: sx, y: b.y + 10, vx: (px - sx) * 0.3, vy: -60, k: 'mis', ow: 1, life: 3.2, dmg: 1, r: 5 })
            b.st = 1
            b.stT = rand(1.4, 2) / fast
            tone({ freq: 300, to: 500, dur: 0.2, vol: 0.05, type: 'sawtooth' })
          }
        }
      }
      b.x = clamp(b.x, camL - 40, camL + W + 60)
      // contacto con el jugador
      if (alive && b.st !== 0) {
        const hurtBox = b.kind === 1 && b.st === 3 ? 1 : 0
        if (p.inv <= 0 && !p.mounted && overlap(p.x + 2, p.y + 2, PW - 4, pw() - 4, b.x + 8, b.y + 14, b.w - 16, b.h - 14) && (b.kind !== 0 || hurtBox === 0 || true)) {
          if (b.kind !== 0 || b.y + b.h > p.y) hurtPlayer(b.x + b.w / 2)
        } else if (p.mounted && g.tank && overlap(g.tank.x, g.tank.y, 46, 30, b.x + 8, b.y + 14, b.w - 16, b.h - 14) && b.kind !== 0) {
          hurtPlayer(b.x + b.w / 2)
        }
      }
    }

    const bulletHitsPlayer = (bu: Bullet) => {
      const p = g.p
      if (p.dead) return false
      if (p.mounted && g.tank) return overlap(bu.x - bu.r, bu.y - bu.r, bu.r * 2, bu.r * 2, g.tank.x + 2, g.tank.y + 2, 42, 26)
      return overlap(bu.x - bu.r, bu.y - bu.r, bu.r * 2, bu.r * 2, p.x + 2, p.y + 1, PW - 4, pw() - 2)
    }

    const updateBullets = (dt: number) => {
      const keep: Bullet[] = []
      const b0 = g.boss
      for (const bu of g.bullets) {
        bu.life -= dt
        if (bu.life <= 0) {
          if (bu.k === 'gre' || bu.k === 'shell') explode(bu.x, bu.y, bu.k === 'gre' ? 44 : 38, bu.dmg, false)
          continue
        }
        // homing de misiles
        if (bu.k === 'mis') {
          const a = Math.atan2(bu.vy, bu.vx)
          const want = Math.atan2(pcy() - bu.y, pcx() - bu.x)
          let d = want - a
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          const na = a + clamp(d, -1.6 * dt, 1.6 * dt)
          const sp = 125
          bu.vx = Math.cos(na) * sp
          bu.vy = Math.sin(na) * sp
          if (Math.random() < 0.5) juice.burst(bu.x, bu.y, ['#d8d8e8', '#ff8a3d'], { count: 1, speed: 15, life: 0.35, size: 3 })
        }
        const sp = Math.hypot(bu.vx, bu.vy)
        const steps = Math.max(1, Math.ceil((sp * dt) / 8))
        const sdt = dt / steps
        let dead = false
        for (let s = 0; s < steps && !dead; s++) {
          bu.vy += bu.g * sdt
          bu.x += bu.vx * sdt
          bu.y += bu.vy * sdt
          const hw = bu.k === 'las' ? 12 : bu.r
          const hh = bu.k === 'las' ? 3 : bu.r
          if (bu.ow === 0) {
            // contra enemigos
            for (const e of g.ents) {
              if (bu.hits && bu.hits.includes(e.id)) continue
              if (overlap(bu.x - hw, bu.y - hh, hw * 2, hh * 2, e.x + 1, e.y + 1, e.w - 2, e.h - 2)) {
                if (bu.k === 'gre' || bu.k === 'shell') {
                  explode(bu.x, bu.y, bu.k === 'gre' ? 44 : 38, bu.dmg, false)
                  dead = true
                  break
                }
                dmgEnt(e, bu.dmg, bu.vx, bu.k === 'pel' || bu.k === 'las')
                sparks(bu.x, bu.y, 3)
                if (bu.hits) bu.hits.push(e.id)
                else {
                  dead = true
                  break
                }
              }
            }
            if (dead) break
            // contra el jefe
            const b = b0 ?? g.boss
            if (b && !b.dying && b.st !== 0 && !(bu.hits && bu.hits.includes(-1))) {
              if (overlap(bu.x - hw, bu.y - hh, hw * 2, hh * 2, b.x + 4, b.y + 4, b.w - 8, b.h - 6)) {
                if (bu.k === 'gre' || bu.k === 'shell') {
                  explode(bu.x, bu.y, bu.k === 'gre' ? 44 : 38, bu.dmg, false)
                  dead = true
                  break
                }
                dmgBoss(bu.dmg, bu.x, bu.y)
                if (bu.hits) bu.hits.push(-1)
                else {
                  dead = true
                  break
                }
              }
            }
            // contra props
            for (const pr of g.props) {
              if (pr.fuse > 0) continue
              if (overlap(bu.x - hw, bu.y - hh, hw * 2, hh * 2, pr.x, pr.y, pr.w, pr.h)) {
                if (bu.k === 'gre' || bu.k === 'shell') {
                  explode(bu.x, bu.y, bu.k === 'gre' ? 44 : 38, bu.dmg, false)
                  dead = true
                  break
                }
                pr.hp -= bu.dmg
                pr.hit = 0.08
                sparks(bu.x, bu.y, 3)
                if (pr.hp <= 0) pr.fuse = 0.08
                if (!bu.hits) {
                  dead = true
                  break
                }
              }
            }
            if (dead) break
            // disparos enemigos interceptables (misiles)
            for (const o of g.bullets) {
              if (o.ow === 1 && o.k === 'mis' && Math.abs(o.x - bu.x) < 8 && Math.abs(o.y - bu.y) < 8) {
                o.life = 0
                explode(o.x, o.y, 28, 0, false)
                addScore(100)
                text(o.x, o.y - 8, '+100', '#ffd23d', 8, 0.7)
                dead = true
                break
              }
            }
          } else if (bulletHitsPlayer(bu)) {
            if (bu.k === 'rocket' || bu.k === 'bomb' || bu.k === 'mis') explode(bu.x, bu.y, bu.k === 'mis' ? 30 : 36, 1, true)
            else hurtPlayer(bu.x - bu.vx)
            dead = true
            break
          }
          // suelo
          if (bu.y >= GROUND - 2 && (bu.k === 'gre' || bu.k === 'rocket' || bu.k === 'bomb' || bu.k === 'shell' || bu.k === 'mis')) {
            if (bu.ow === 0) explode(bu.x, GROUND - 4, bu.k === 'gre' ? 44 : 38, bu.dmg, false)
            else explode(bu.x, GROUND - 4, bu.k === 'mis' ? 30 : 38, 1, true)
            dead = true
            break
          }
          if (bu.k === 'wave') bu.y = GROUND - 8
          if (bu.k !== 'gre' && bu.k !== 'bomb' && bu.k !== 'rocket' && (bu.y < -20 || bu.y > GROUND + 4)) {
            dead = true
            break
          }
        }
        if (dead) continue
        if (bu.x < g.cam - 60 || bu.x > g.cam + W + 60) continue
        keep.push(bu)
      }
      g.bullets = keep
    }

    const updateMisc = (dt: number) => {
      const p = g.p
      // props
      for (const pr of [...g.props]) {
        pr.hit = Math.max(0, pr.hit - dt)
        if (pr.fuse > 0) {
          pr.fuse -= dt
          if (pr.fuse <= 0) breakProp(pr)
        }
      }
      // objetos
      for (const it of [...g.items]) {
        it.ph += dt * 4
        if (it.vy !== 0 || it.y < GROUND - 20) {
          it.vy += 600 * dt
          it.y += it.vy * dt
          if (it.y >= GROUND - 20) {
            it.y = GROUND - 20
            it.vy = 0
          }
          for (const pl of g.plats) {
            if (it.vy > 0 && it.x > pl.x && it.x < pl.x + pl.w && it.y + 18 >= pl.y && it.y + 18 <= pl.y + 10) {
              it.y = pl.y - 18
              it.vy = 0
            }
          }
        }
        if (!p.dead && Math.abs(it.x - pcx()) < 18 && Math.abs(it.y + 8 - pcy()) < 24) {
          g.items.splice(g.items.indexOf(it), 1)
          if (it.kind === 'hp') {
            p.hp = Math.min(3, p.hp + 1)
            text(it.x, it.y - 10, '+1 SALUD', '#5df2a3', 9, 1)
            sfx.potion()
          } else {
            const w = WEAPONS[it.kind]
            if (p.weapon === it.kind) p.ammo = Math.min(w.ammo * 1.6, p.ammo + w.ammo)
            else {
              p.weapon = it.kind
              p.ammo = w.ammo
            }
            text(it.x, it.y - 12, `¡${w.name}!`, w.color, 11, 1.3)
            addScore(100)
            sfx.golden()
          }
          juice.burst(it.x, it.y + 8, ['#ffffff', '#ffd23d'], { count: 10, speed: 110, life: 0.4, size: 2.5 })
          juice.flash('#ffffff', 0.1)
        }
      }
      // rehenes
      for (const h of [...g.hostages]) {
        if (h.st === 0) {
          if (!p.dead && Math.abs(h.x + 6 - pcx()) < 20 && Math.abs(h.y + 8 - pcy()) < 30) {
            h.st = 1
            h.t = 0
            g.rescued++
            addScore(500)
            text(h.x + 6, h.y - 14, '¡REHÉN LIBRE! +500', '#5df2a3', 9, 1.5)
            sfx.coin()
            sfx.golden()
            juice.burst(h.x + 6, h.y, ['#ffffff', '#5df2a3'], { count: 14, speed: 120, life: 0.5, size: 3 })
            juice.shake(0.1)
          }
        } else if (h.st === 1) {
          h.t += dt
          if (h.t > 0.9) {
            h.st = 2
            h.t = 0
            if (h.drop) dropItem(h.x + 6, h.y - 10, h.drop)
          }
        } else {
          h.t += dt
          h.x += 90 * dt
          if (h.t > 3) g.hostages.splice(g.hostages.indexOf(h), 1)
        }
      }
      // cadáveres
      for (const c of [...g.corpses]) {
        c.t += dt
        c.vy += GRAV * dt
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.rot += c.rv * dt
        if (c.kind === 'drone') {
          c.rot += c.rv * dt
          if (c.y > GROUND - 10) {
            explode(c.x + 14, GROUND - 8, 36, 2, false)
            g.corpses.splice(g.corpses.indexOf(c), 1)
            continue
          }
        } else if (c.y > GROUND - 28) {
          c.y = GROUND - 28
          if (!c.bounced) {
            c.bounced = true
            c.vy = -90
            c.vx *= 0.5
            c.rv *= 0.5
          } else {
            c.vy = 0
            c.vx *= 0.9
            c.rv *= 0.8
          }
        }
        if (c.t > 1.4) g.corpses.splice(g.corpses.indexOf(c), 1)
      }
      for (const r of g.rings) {
        r.life -= dt
        r.r += (r.max - r.r) * Math.min(1, dt * 12)
      }
      g.rings = g.rings.filter((r) => r.life > 0)
      // combo
      if (g.comboT > 0) {
        g.comboT -= dt
        if (g.comboT <= 0) g.combo = 0
      }
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
    }

    const step = (dt: number, real: number) => {
      void real
      g.t += dt
      if (g.phase === 'play') g.zoneTime += dt
      updatePlayer(dt)

      if (g.phase === 'clear') {
        g.clearT += real
        if (g.clearT > 5.2) g.fade = Math.min(1, g.fade + real * 1.5)
        if (g.fade >= 1) {
          startZone(g.zone + 1, g)
          return
        }
      }

      // cámara
      if (g.phase === 'play' || g.phase === 'clear') {
        const maxCam = g.len - W + 60
        const lockCam = g.bossSpawned ? g.cam : maxCam
        if (!g.p.dead || true) {
          const want = clamp(pcx() - W * 0.42, g.cam, lockCam)
          g.cam += (want - g.cam) * Math.min(1, dt * 7)
          if (want > g.cam) g.cam = Math.min(want, g.cam + 260 * dt)
        }
        // eventos
        if (!g.bossSpawned) {
          for (const ev of g.evs) {
            if (ev.done) continue
            if (g.cam + W + 40 >= ev.x) {
              ev.done = true
              spawnEv(ev)
            }
          }
          if (g.cam >= maxCam - 8 && g.evs.every((e) => e.done)) spawnBoss()
        }
      }
      updateEnts(dt)
      updateBoss(dt)
      updateBullets(dt)
      updateMisc(dt)

      // pista de avance
      const near = g.ents.some((e) => e.x < g.cam + W && e.x > g.cam - 20)
      g.idleT = near || g.bossSpawned || g.p.dead ? 0 : g.idleT + dt
      // plataformas fuera de pantalla
      g.plats = g.plats.filter((pl) => pl.x + pl.w > g.cam - 100)
      g.props = g.props.filter((pr) => pr.x + pr.w > g.cam - 100)
    }

    const finish = () => {
      if (g.phase === 'over') return
      g.phase = 'over'
      const final = g.score
      const isBest = saveBest('gun-and-run', final)
      setNewBest(isBest)
      setBest((b) => Math.max(b, final))
      setScore(final)
      setStats({ zone: g.zone, kills: g.kills, rescued: g.rescued, combo: g.maxCombo })
      setPhase('over')
    }

    const begin = () => {
      startZone(1)
      g.p.lives = 3
      lastScoreShown = -1
      lastZone = 1
      setScore(0)
      setZone(1)
      setNewBest(false)
      setPhase('play')
      sfx.start()
    }
    beginRef.current = begin
    ;(window as unknown as { __gg?: () => G }).__gg = () => g // DEBUGTMP

    // ---------- dibujo ----------
    const label = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') => {
      ctx.font = `${size}px ${FONT}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.fillText(s, x + 1.5, y + 1.5)
      ctx.fillStyle = color
      ctx.fillText(s, x, y)
    }

    const drawBackground = () => {
      const b = g.biome
      ctx.drawImage(getSky(b), 0, 0)
      const cam = g.cam
      // silueta lejana
      ctx.fillStyle = b.far
      const farOff = cam * 0.1
      ctx.beginPath()
      ctx.moveTo(0, GROUND)
      for (let x = -20; x <= W + 20; x += 20) {
        const wx = x + farOff
        const hgt = b.kind === 2 ? 50 + hash01(Math.floor(wx / 20) * 3.1) * 70 : 40 + Math.sin(wx * 0.011) * 30 + Math.sin(wx * 0.027) * 18 + 30
        ctx.lineTo(x, GROUND - hgt)
      }
      ctx.lineTo(W + 20, GROUND)
      ctx.closePath()
      ctx.fill()
      if (b.kind === 2) {
        ctx.fillStyle = 'rgba(255,230,150,0.5)'
        for (let x = -20; x <= W + 20; x += 20) {
          const i = Math.floor((x + farOff) / 20)
          const hgt = 50 + hash01(i * 3.1) * 70
          for (let wy = GROUND - hgt + 8; wy < GROUND - 8; wy += 14) {
            if (hash01(i * 7 + wy) < 0.25) ctx.fillRect(x - ((farOff % 20) + 20) % 20 + 4, wy, 3, 4)
          }
        }
      }
      // capa media
      const midOff = cam * 0.35
      const sp = b.kind === 1 ? 150 : b.kind === 2 ? 90 : 62
      const i0 = Math.floor(midOff / sp) - 1
      for (let i = i0; i < i0 + W / sp + 3; i++) {
        const x = i * sp - midOff + hash01(i) * 22
        const hh = hash01(i + 9.7)
        if (b.kind === 0) {
          const th = 62 + hh * 52
          ctx.fillStyle = b.mid
          ctx.fillRect(x, GROUND - th, 4, th)
          ctx.fillStyle = b.mid2
          ctx.beginPath()
          ctx.moveTo(x + 2, GROUND - th - 4)
          ctx.lineTo(x - 26, GROUND - th + 14)
          ctx.lineTo(x + 30, GROUND - th + 14)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x + 2, GROUND - th - 18)
          ctx.lineTo(x - 18, GROUND - th + 2)
          ctx.lineTo(x + 22, GROUND - th + 2)
          ctx.closePath()
          ctx.fill()
        } else if (b.kind === 1) {
          const pw2 = 70 + hh * 60
          const ph2 = 40 + hh * 40
          ctx.fillStyle = b.mid
          ctx.beginPath()
          ctx.moveTo(x - pw2, GROUND)
          ctx.lineTo(x, GROUND - ph2)
          ctx.lineTo(x + pw2, GROUND)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = b.mid2
          ctx.beginPath()
          ctx.moveTo(x, GROUND - ph2)
          ctx.lineTo(x + pw2, GROUND)
          ctx.lineTo(x + 6, GROUND)
          ctx.closePath()
          ctx.fill()
          if (hash01(i + 3) < 0.5) {
            ctx.fillStyle = '#3d5a2c'
            ctx.fillRect(x + 90, GROUND - 30, 5, 30)
            ctx.fillRect(x + 85, GROUND - 22, 5, 3)
            ctx.fillRect(x + 85, GROUND - 22, 2, 9)
            ctx.fillRect(x + 95, GROUND - 18, 6, 3)
            ctx.fillRect(x + 99, GROUND - 26, 2, 10)
          }
        } else {
          const bh = 55 + hh * 70
          ctx.fillStyle = b.mid
          ctx.fillRect(x, GROUND - bh, 44, bh)
          ctx.fillStyle = b.mid2
          ctx.fillRect(x, GROUND - bh, 44, 4)
          ctx.fillRect(x + 20, GROUND - bh - 16, 3, 16)
          for (let wy = GROUND - bh + 10; wy < GROUND - 8; wy += 12) {
            for (let wx = x + 6; wx < x + 40; wx += 10) {
              if (hash01(i * 13 + wx + wy) < 0.4) {
                ctx.fillStyle = '#ffd98a'
                ctx.fillRect(wx, wy, 4, 5)
              }
            }
          }
        }
      }
      // suelo
      const gx = -(cam % 24)
      ctx.fillStyle = b.dirt
      ctx.fillRect(0, GROUND, W, H - GROUND)
      ctx.fillStyle = b.dirt2
      for (let x = gx - 24; x < W + 24; x += 24) {
        const i = Math.floor((x + cam) / 24)
        ctx.fillRect(x + hash01(i) * 14, GROUND + 14 + hash01(i + 5) * 28, 8, 3)
        if (hash01(i + 11) < 0.3) ctx.fillRect(x + 6, GROUND + 8, 5, 5)
      }
      ctx.fillStyle = b.gMid
      ctx.fillRect(0, GROUND, W, 8)
      ctx.fillStyle = b.gTop
      ctx.fillRect(0, GROUND, W, 3)
      for (let x = gx - 24; x < W + 24; x += 12) {
        const i = Math.floor((x + cam) / 12)
        if (hash01(i + 40) < 0.5) {
          ctx.fillStyle = b.gTop
          ctx.fillRect(x, GROUND - 3, 2, 3)
          ctx.fillRect(x + 4, GROUND - 2, 2, 2)
        }
      }
    }

    const drawPlatform = (pl: Plat) => {
      const x = pl.x - g.cam
      ctx.fillStyle = '#3a2a1a'
      ctx.fillRect(x + 6, pl.y, 5, GROUND - pl.y)
      ctx.fillRect(x + pl.w - 11, pl.y, 5, GROUND - pl.y)
      ctx.fillStyle = '#4a3624'
      for (let y = pl.y + 8; y < GROUND - 4; y += 14) {
        ctx.fillRect(x + 6, y, pl.w - 12, 2)
      }
      ctx.fillStyle = '#8a6238'
      ctx.fillRect(x, pl.y, pl.w, 6)
      ctx.fillStyle = '#b07f4a'
      ctx.fillRect(x, pl.y, pl.w, 2)
      ctx.fillStyle = '#5c431f'
      for (let i = 10; i < pl.w; i += 14) ctx.fillRect(x + i, pl.y + 2, 1, 4)
    }

    const drawProp = (pr: Prop) => {
      const x = Math.round(pr.x - g.cam)
      const flash = pr.hit > 0
      if (pr.kind === 'barrel') {
        ctx.fillStyle = flash ? '#fff' : '#c4402f'
        ctx.fillRect(x, pr.y, pr.w, pr.h)
        ctx.fillStyle = flash ? '#fff' : '#ffd23d'
        ctx.fillRect(x, pr.y + 5, pr.w, 3)
        ctx.fillRect(x, pr.y + 13, pr.w, 2)
        ctx.fillStyle = flash ? '#fff' : '#7a1d14'
        ctx.fillRect(x + 2, pr.y, 3, pr.h)
        ctx.fillStyle = '#ffd23d'
        ctx.fillRect(x + 6, pr.y + 8, 4, 4)
      } else {
        ctx.fillStyle = flash ? '#fff' : '#a87a45'
        ctx.fillRect(x, pr.y, pr.w, pr.h)
        ctx.fillStyle = flash ? '#fff' : '#6b4a28'
        ctx.fillRect(x, pr.y, pr.w, 2)
        ctx.fillRect(x, pr.y + pr.h - 2, pr.w, 2)
        ctx.fillRect(x + pr.w / 2 - 1, pr.y, 2, pr.h)
        ctx.fillStyle = flash ? '#fff' : '#d9b27a'
        ctx.fillRect(x + 2, pr.y + 3, 4, 2)
        label('?', x + pr.w / 2, pr.y + pr.h / 2 + 1, 9, '#fff3b0', 'center')
      }
    }

    const drawItem = (it: Item) => {
      const x = Math.round(it.x - g.cam)
      const bob = Math.sin(it.ph) * 2
      const y = Math.round(it.y + bob)
      if (it.kind === 'hp') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillRect(x - 8, y, 16, 14)
        ctx.fillStyle = '#e84c4c'
        ctx.fillRect(x - 2, y + 2, 4, 10)
        ctx.fillRect(x - 6, y + 5, 12, 4)
        return
      }
      const w = WEAPONS[it.kind]
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(x, y + 7, 16 + Math.sin(it.ph * 1.5) * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1a24'
      ctx.fillRect(x - 10, y - 1, 20, 16)
      ctx.fillStyle = w.color
      ctx.fillRect(x - 9, y, 18, 14)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(x - 9, y, 18, 3)
      label(w.letter, x, y + 8, 10, '#101010', 'center')
    }

    const drawHostage = (h: Hostage) => {
      const x = Math.round(h.x - g.cam)
      if (h.st === 0) {
        ctx.fillStyle = '#3b6ea8'
        ctx.fillRect(x + 1, h.y + 6, 10, 9)
        ctx.fillStyle = '#e8b27d'
        ctx.fillRect(x + 2, h.y, 8, 7)
        ctx.fillStyle = '#4a3524'
        ctx.fillRect(x + 2, h.y, 8, 2)
        ctx.fillStyle = '#e8e8e8'
        ctx.fillRect(x, h.y + 9, 12, 2)
        ctx.fillRect(x + 4, h.y + 3, 4, 2)
        ctx.fillStyle = '#2b2b3a'
        ctx.fillRect(x + 1, h.y + 14, 4, 4)
        ctx.fillRect(x + 7, h.y + 14, 4, 4)
        const by = Math.sin(g.clock * 5) * 3
        ctx.fillStyle = '#ffd23d'
        ctx.beginPath()
        ctx.moveTo(x + 6, h.y - 8 + by)
        ctx.lineTo(x + 1, h.y - 15 + by)
        ctx.lineTo(x + 11, h.y - 15 + by)
        ctx.closePath()
        ctx.fill()
      } else {
        const pal: SoldierPal = { helmet: '#4a3524', skin: '#e8b27d', vest: '#3b6ea8', pants: '#2b2b3a', boots: '#14141a', band: null, eye: '#101010' }
        drawSoldier(ctx, x + 6, GROUND, {
          face: h.st === 1 ? 1 : 1, pal, run: g.clock * 14, air: false, crouch: false, aim: null,
          weapon: 'pistol', white: false, clock: g.clock, pose: h.st === 1 ? 'salute' : undefined,
        })
      }
    }

    const drawEnt = (e: Ent) => {
      const x = e.x - g.cam
      const white = e.hit > 0
      const cx = x + e.w / 2
      switch (e.t) {
        case 'grunt':
        case 'rusher':
        case 'bazooka': {
          const pal = e.t === 'grunt' ? PAL_GRUNT : e.t === 'rusher' ? PAL_RUSHER : PAL_BAZ
          const aimA = e.face > 0 ? 0 : Math.PI
          const wpn = e.t === 'bazooka' ? 'tube' : e.t === 'rusher' ? 'knife' : 'pistol'
          const showAim = e.t === 'rusher' ? true : e.t === 'bazooka' ? true : e.st === 1 || e.st === 0
          drawSoldier(ctx, cx, e.y + e.h, {
            face: e.face, pal, run: e.life * 11, air: false, crouch: false, aim: showAim ? aimA : null, weapon: wpn, white,
            clock: g.clock, muzzle: e.t === 'grunt' && e.st === 1 && e.stT < 0.1 ? 1 : 0,
          })
          if (e.carry) {
            ctx.fillStyle = '#ffd23d'
            ctx.fillRect(cx - e.face * 9 - 3, e.y + 10, 6, 8)
            ctx.fillStyle = '#7a5a10'
            ctx.fillRect(cx - e.face * 9 - 3, e.y + 12, 6, 1)
          }
          if (e.st === 1 && (e.t === 'grunt' || e.t === 'bazooka')) {
            ctx.fillStyle = Math.floor(g.clock * 20) % 2 ? '#ff5d5d' : '#ffd23d'
            ctx.fillRect(cx - 1, e.y - 12, 3, 7)
            ctx.fillRect(cx - 1, e.y - 3, 3, 2)
          }
          break
        }
        case 'drone': {
          const bx = Math.round(x)
          const by = Math.round(e.y)
          ctx.fillStyle = 'rgba(0,0,0,0.25)'
          ctx.fillRect(bx + 4, GROUND - 3, 20, 3)
          ctx.fillStyle = white ? '#fff' : '#8a8a96'
          ctx.fillRect(bx + 2, by + 6, 24, 6)
          ctx.fillStyle = white ? '#fff' : '#d84040'
          ctx.fillRect(bx + 6, by + 2, 16, 6)
          ctx.fillStyle = white ? '#fff' : '#a02828'
          ctx.fillRect(bx + 6, by + 6, 16, 2)
          ctx.fillStyle = white ? '#fff' : '#ffd23d'
          ctx.fillRect(bx + 12, by + 4, 4, 3)
          const rot = Math.floor(g.clock * 30) % 2 ? 14 : 10
          ctx.fillStyle = white ? '#fff' : '#cfd3e0'
          ctx.fillRect(bx - 4 + (14 - rot) / 2, by, rot, 2)
          ctx.fillRect(bx + 18 + (14 - rot) / 2, by, rot, 2)
          ctx.fillStyle = white ? '#fff' : '#555'
          ctx.fillRect(bx + 4, by + 12, 3, 3)
          ctx.fillRect(bx + 21, by + 12, 3, 3)
          break
        }
        case 'turret': {
          const bx = Math.round(x)
          ctx.fillStyle = white ? '#fff' : '#2e2e3a'
          ctx.fillRect(bx, e.y + 12, 30, 12)
          ctx.fillStyle = white ? '#fff' : '#565668'
          ctx.fillRect(bx + 2, e.y + 12, 26, 3)
          ctx.fillStyle = white ? '#fff' : '#6a6a7e'
          ctx.beginPath()
          ctx.arc(bx + 15, e.y + 10, 9, Math.PI, 0)
          ctx.fill()
          ctx.fillRect(bx + 6, e.y + 10, 18, 3)
          ctx.save()
          ctx.translate(bx + 15, e.y + 8)
          ctx.rotate(e.ang)
          ctx.fillStyle = white ? '#fff' : '#1e1e2c'
          ctx.fillRect(0, -3, 20, 6)
          ctx.fillStyle = e.st === 1 ? (Math.floor(g.clock * 20) % 2 ? '#ff5d5d' : '#ffd23d') : '#3a3a4c'
          ctx.fillRect(17, -2, 4, 4)
          ctx.restore()
          // barra de vida
          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(bx + 2, e.y - 6, 26, 3)
          ctx.fillStyle = '#ff5d5d'
          ctx.fillRect(bx + 2, e.y - 6, 26 * clamp(e.hp / e.max, 0, 1), 3)
          break
        }
        case 'jeep': {
          const bx = Math.round(x)
          ctx.save()
          ctx.translate(bx + e.w / 2, e.y + e.h / 2)
          ctx.scale(e.face, 1)
          ctx.fillStyle = 'rgba(0,0,0,0.25)'
          ctx.fillRect(-24, 14, 50, 3)
          ctx.fillStyle = white ? '#fff' : '#5e6b3a'
          ctx.fillRect(-26, -4, 52, 14)
          ctx.fillStyle = white ? '#fff' : '#4a5530'
          ctx.fillRect(-26, 6, 52, 4)
          ctx.fillStyle = white ? '#fff' : '#7a8a4a'
          ctx.fillRect(-12, -12, 22, 9)
          ctx.fillStyle = white ? '#fff' : '#2a2f3d'
          ctx.fillRect(-8, -10, 14, 6)
          ctx.fillStyle = white ? '#fff' : '#d84040'
          ctx.fillRect(20, -1, 5, 3)
          ctx.fillStyle = white ? '#fff' : '#fff3b0'
          ctx.fillRect(22, 1, 3, 2)
          // artillero
          ctx.fillStyle = white ? '#fff' : '#d9a66c'
          ctx.fillRect(-2, -16, 6, 6)
          ctx.fillStyle = white ? '#fff' : '#6b5b3a'
          ctx.fillRect(-3, -18, 8, 3)
          ctx.fillStyle = white ? '#fff' : '#22262b'
          ctx.fillRect(2, -12, 10, 3)
          ctx.fillStyle = '#15151c'
          for (const wx of [-16, 14]) {
            ctx.beginPath()
            ctx.arc(wx, 10, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#6a6a78'
            ctx.beginPath()
            ctx.arc(wx, 10, 2.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#15151c'
          }
          ctx.restore()
          break
        }
      }
    }

    const drawCorpse = (c: Corpse) => {
      const x = c.x - g.cam
      const pal = c.kind === 'grunt' ? PAL_GRUNT : c.kind === 'rusher' ? PAL_RUSHER : PAL_BAZ
      ctx.save()
      ctx.globalAlpha = c.t > 1 ? clamp((1.4 - c.t) / 0.4, 0, 1) : 1
      ctx.translate(x + 7, c.y + 14)
      ctx.rotate(c.rot)
      drawSoldier(ctx, 0, 14, {
        face: c.face, pal, run: 0, air: true, crouch: false, aim: null, weapon: 'pistol', white: c.t < 0.08, clock: g.clock,
      })
      ctx.restore()
      ctx.globalAlpha = 1
      if (c.kind === 'drone') {
        ctx.save()
        ctx.translate(x + 14, c.y + 8)
        ctx.rotate(c.rot)
        ctx.fillStyle = '#d84040'
        ctx.fillRect(-12, -6, 24, 10)
        ctx.restore()
        if (Math.random() < 0.6) juice.burst(c.x + 14, c.y + 8, SMOKE, { count: 1, speed: 20, life: 0.5, size: 5 })
      }
    }

    const drawTank = (t: Tank, p: Player) => {
      const x = Math.round(t.x - g.cam)
      const y = Math.round(t.y)
      const mounted = t.st === 1
      const white = t.hit > 0
      ctx.save()
      ctx.translate(x + 23, y + 15)
      ctx.scale(t.face, 1)
      if (t.st === 2) ctx.globalAlpha = 0.5
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(-24, 15, 48, 3)
      // orugas
      ctx.fillStyle = white ? '#fff' : '#1f2418'
      ctx.fillRect(-23, 6, 46, 10)
      ctx.fillStyle = white ? '#fff' : '#3a4428'
      for (let i = -20; i <= 18; i += 6) ctx.fillRect(i + ((g.clock * 40 * (Math.abs(t.vx) > 5 ? 1 : 0)) % 6), 12, 3, 3)
      ctx.fillStyle = white ? '#fff' : '#555d3d'
      for (const wx of [-17, -6, 6, 17]) {
        ctx.beginPath()
        ctx.arc(wx, 11, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      // casco
      ctx.fillStyle = white ? '#fff' : '#6b8a3d'
      ctx.fillRect(-20, -2, 40, 11)
      ctx.fillStyle = white ? '#fff' : '#86a84d'
      ctx.fillRect(-20, -2, 40, 3)
      // torreta
      ctx.fillStyle = white ? '#fff' : '#5a7632'
      ctx.fillRect(-10, -12, 22, 11)
      ctx.fillStyle = white ? '#fff' : '#86a84d'
      ctx.fillRect(-10, -12, 22, 3)
      ctx.fillStyle = '#ffd23d'
      ctx.fillRect(-14, 1, 4, 4)
      ctx.restore()
      // cañón
      if (t.st !== 2) {
        ctx.save()
        ctx.translate(x + 23, y + 8)
        const a = mounted ? p.aim : t.face > 0 ? 0 : Math.PI
        ctx.rotate(a)
        ctx.fillStyle = white ? '#fff' : '#2c3520'
        ctx.fillRect(0, -3, 26, 6)
        ctx.fillStyle = '#16190f'
        ctx.fillRect(22, -4, 5, 8)
        if (mounted && p.muzzle > 0) {
          ctx.fillStyle = '#fff3b0'
          ctx.fillRect(27, -5, 8, 10)
        }
        ctx.restore()
      }
      if (mounted) {
        // piloto
        drawSoldier(ctx, x + 23 - t.face * 6, y + 3, {
          face: t.face, pal: PAL_PLAYER, run: 0, air: false, crouch: true, aim: null, weapon: 'pistol', white: false, clock: g.clock,
        })
        // barra de blindaje
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(x + 4, y - 26, 38, 4)
        ctx.fillStyle = '#7bd36b'
        ctx.fillRect(x + 4, y - 26, 38 * clamp(t.hp / 8, 0, 1), 4)
      } else if (t.st === 0) {
        const by = Math.sin(g.clock * 5) * 3
        ctx.fillStyle = '#7bd36b'
        ctx.beginPath()
        ctx.moveTo(x + 23, y - 6 + by)
        ctx.lineTo(x + 16, y - 16 + by)
        ctx.lineTo(x + 30, y - 16 + by)
        ctx.closePath()
        ctx.fill()
      }
    }

    const drawBoss = (b: Boss) => {
      const x = Math.round(b.x - g.cam)
      const y = Math.round(b.y)
      const white = b.hit > 0
      const col = (c: string) => (white ? '#ffffff' : c)
      ctx.save()
      ctx.translate(x + b.w / 2, y + b.h / 2)
      if (b.dying) ctx.translate(Math.sin(b.dieT * 40) * 2, 0)
      if (b.kind === 0) {
        ctx.scale(b.face, 1)
        // sombra del rotor
        ctx.fillStyle = col('#2a3550')
        ctx.fillRect(-46, -16, 92, 32)
        ctx.fillStyle = col('#3b4a70')
        ctx.fillRect(-46, -16, 92, 8)
        ctx.fillStyle = col('#1f2840')
        ctx.fillRect(-50, 8, 100, 6)
        ctx.fillStyle = col('#7dd8ff')
        ctx.fillRect(18, -12, 24, 14)
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillRect(20, -12, 8, 5)
        // cola
        ctx.fillStyle = col('#2a3550')
        ctx.fillRect(-84, -8, 40, 8)
        ctx.fillStyle = col('#3b4a70')
        ctx.fillRect(-90, -18, 8, 20)
        // patines y cañón
        ctx.fillStyle = col('#15192a')
        ctx.fillRect(-30, 18, 56, 3)
        ctx.fillRect(-24, 14, 3, 6)
        ctx.fillRect(18, 14, 3, 6)
        ctx.fillStyle = col('#555d7a')
        ctx.fillRect(6, 14, 14, 5)
        ctx.fillStyle = '#ff5d5d'
        ctx.fillRect(-6, -14, 5, 3)
        // rotor
        ctx.restore()
        ctx.save()
        ctx.translate(x + b.w / 2, y + b.h / 2 - 20)
        ctx.fillStyle = col('#15192a')
        ctx.fillRect(-4, -4, 8, 8)
        ctx.globalAlpha = 0.55
        ctx.fillStyle = col('#cfd6ff')
        const sway = Math.sin(g.clock * 40) * 6
        ctx.fillRect(-70 + sway, -4, 140 - sway * 2, 3)
        ctx.globalAlpha = 0.14
        ctx.beginPath()
        ctx.ellipse(0, -2, 76, 8, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      } else if (b.kind === 1) {
        ctx.scale(b.face, 1)
        const charge = b.st === 2 || b.st === 3
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(-60, 30, 120, 3)
        ctx.fillStyle = col('#1a1d28')
        ctx.fillRect(-60, 12, 120, 20)
        ctx.fillStyle = col('#3a3f52')
        for (let i = -52; i <= 46; i += 14) {
          ctx.beginPath()
          ctx.arc(i + 7, 24, 7, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = col(charge ? '#d94a3a' : '#7a2d3a')
        ctx.fillRect(-56, -8, 112, 22)
        ctx.fillStyle = col(charge ? '#ff7a5a' : '#a53d4a')
        ctx.fillRect(-56, -8, 112, 5)
        ctx.fillStyle = col('#5e2030')
        ctx.fillRect(-20, -24, 52, 18)
        ctx.fillStyle = col('#a53d4a')
        ctx.fillRect(-20, -24, 52, 4)
        ctx.fillStyle = col('#1c1c26')
        ctx.fillRect(30, -20, 44, 8)
        ctx.fillStyle = '#ffd23d'
        ctx.fillRect(-52, -2, 8, 4)
        ctx.fillStyle = '#ff5d5d'
        ctx.fillRect(-4, -20, 6, 3)
      } else {
        ctx.scale(b.face, 1)
        const j = b.st === 3
        // piernas
        const step = Math.sin(g.clock * 6) * (b.st === 1 ? 6 : 0)
        ctx.fillStyle = col('#2d3550')
        ctx.fillRect(-26, 20 + (j ? -10 : 0), 18, 34)
        ctx.fillRect(8, 20 + (j ? -10 : 0), 18, 34)
        ctx.fillStyle = col('#1a1f33')
        ctx.fillRect(-30 + step, 46, 26, 6)
        ctx.fillRect(4 - step, 46, 26, 6)
        // torso
        ctx.fillStyle = col('#4a5a8a')
        ctx.fillRect(-30, -32, 60, 54)
        ctx.fillStyle = col('#6a7ab0')
        ctx.fillRect(-30, -32, 60, 6)
        ctx.fillStyle = col('#2d3550')
        ctx.fillRect(-12, -22, 24, 20)
        ctx.fillStyle = b.phase2 ? '#ff5d5d' : '#7dd8ff'
        ctx.fillRect(-9, -19, 18, 8)
        // hombros / cañones
        ctx.fillStyle = col('#2d3550')
        ctx.fillRect(-40, -36, 14, 22)
        ctx.fillRect(26, -36, 14, 22)
        ctx.fillStyle = col('#8a93b8')
        ctx.fillRect(-40, -36, 14, 4)
        ctx.fillRect(26, -36, 14, 4)
        ctx.fillStyle = col('#15192a')
        ctx.fillRect(30, -10, 22, 8)
        // cabeza
        ctx.fillStyle = col('#2d3550')
        ctx.fillRect(-10, -46, 20, 14)
        ctx.fillStyle = '#ff5d5d'
        ctx.fillRect(-6, -42, 12, 4)
      }
      ctx.restore()
    }

    const drawBullet = (bu: Bullet) => {
      const x = bu.x - g.cam
      const y = bu.y
      if (bu.ow === 0) {
        switch (bu.k) {
          case 'las': {
            const a = Math.atan2(bu.vy, bu.vx)
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(a)
            ctx.fillStyle = 'rgba(53,224,255,0.35)'
            ctx.fillRect(-18, -4, 36, 8)
            ctx.fillStyle = '#35e0ff'
            ctx.fillRect(-14, -2, 28, 4)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(-12, -1, 24, 2)
            ctx.restore()
            break
          }
          case 'gre': {
            ctx.fillStyle = '#2a3d20'
            ctx.beginPath()
            ctx.arc(x, y, 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#7bd36b'
            ctx.beginPath()
            ctx.arc(x - 1, y - 1, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#ffd23d'
            ctx.fillRect(x - 1, y - 7, 2, 3)
            break
          }
          case 'shell': {
            ctx.fillStyle = '#fff3b0'
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#ff8a3d'
            ctx.beginPath()
            ctx.arc(x, y, 3.5, 0, Math.PI * 2)
            ctx.fill()
            break
          }
          default: {
            ctx.strokeStyle = bu.k === 'pel' ? '#ffb46b' : '#fff3b0'
            ctx.lineWidth = bu.k === 'mg' ? 2.4 : 3
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x - bu.vx * 0.022, y - bu.vy * 0.022)
            ctx.stroke()
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
          }
        }
        return
      }
      switch (bu.k) {
        case 'rocket':
        case 'mis': {
          const a = Math.atan2(bu.vy, bu.vx)
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(a)
          ctx.fillStyle = '#d8d8e8'
          ctx.fillRect(-6, -2.5, 12, 5)
          ctx.fillStyle = '#d84040'
          ctx.fillRect(4, -2.5, 4, 5)
          ctx.fillStyle = '#ffa63d'
          ctx.fillRect(-10, -2, 5, 4)
          ctx.restore()
          break
        }
        case 'bomb': {
          ctx.fillStyle = '#20222c'
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ff5d5d'
          ctx.fillRect(x - 1, y - 7, 2, 3)
          break
        }
        case 'wave': {
          ctx.fillStyle = '#ffd23d'
          ctx.fillRect(x - 6, y - 8, 12, 16)
          ctx.fillStyle = '#ff8a3d'
          ctx.fillRect(x - 4, y - 4, 8, 12)
          ctx.fillStyle = '#fff3b0'
          ctx.fillRect(x - 2, y, 4, 8)
          break
        }
        default: {
          // bala enemiga: núcleo claro y borde naranja para que destaque
          ctx.fillStyle = '#ff5a1f'
          ctx.fillRect(x - 3.5, y - 3.5, 7, 7)
          ctx.fillStyle = '#fff3b0'
          ctx.fillRect(x - 2, y - 2, 4, 4)
        }
      }
    }

    const drawPlayer = () => {
      const p = g.p
      if (p.dead) {
        ctx.save()
        const x = p.x - g.cam
        ctx.translate(x + 7, p.y + 14)
        ctx.rotate(Math.min(1.5, p.deadT * 5) * p.face * -1)
        ctx.globalAlpha = clamp(1.2 - p.deadT * 0.8, 0, 1)
        drawSoldier(ctx, 0, 14, { face: p.face, pal: PAL_PLAYER, run: 0, air: true, crouch: false, aim: null, weapon: 'pistol', white: false, clock: g.clock })
        ctx.restore()
        return
      }
      if (p.mounted) return
      const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0
      if (blink) return
      const x = p.x - g.cam
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      const shW = p.ground ? 16 : clamp(16 - (GROUND - (p.y + pw())) * 0.1, 6, 16)
      ctx.fillRect(x + 7 - shW / 2, GROUND - 2, shW, 3)
      drawSoldier(ctx, x + 7 - p.recoil * p.face * 1.2, p.y + pw(), {
        face: p.face, pal: PAL_PLAYER, run: p.run, air: !p.ground, crouch: p.crouch, aim: p.aim, weapon: p.weapon,
        white: false, clock: g.clock, muzzle: p.muzzle,
      })
    }

    const drawHeart = (x: number, y: number, full: boolean) => {
      ctx.fillStyle = full ? '#ff4d5d' : 'rgba(255,255,255,0.18)'
      ctx.fillRect(x + 1, y, 3, 2)
      ctx.fillRect(x + 6, y, 3, 2)
      ctx.fillRect(x, y + 2, 10, 3)
      ctx.fillRect(x + 1, y + 5, 8, 2)
      ctx.fillRect(x + 3, y + 7, 4, 2)
      if (full) {
        ctx.fillStyle = '#ffa0aa'
        ctx.fillRect(x + 1, y + 2, 2, 2)
      }
    }

    const drawHud = () => {
      const p = g.p
      // vida
      for (let i = 0; i < 3; i++) drawHeart(8 + i * 13, 8, i < p.hp)
      label(`x${p.lives}`, 8 + 3 * 13 + 4, 13, 10, '#ffffff')
      // arma
      const w = WEAPONS[p.weapon]
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(8, 24, 90, 18)
      ctx.fillStyle = w.color
      ctx.fillRect(10, 26, 14, 14)
      label(w.letter, 17, 34, 10, '#101010', 'center')
      if (p.weapon === 'pistol') label('INF', 29, 34, 9, '#ffffff')
      else {
        const maxA = w.ammo
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(29, 29, 38, 5)
        ctx.fillStyle = w.color
        ctx.fillRect(29, 29, 38 * clamp(p.ammo / maxA, 0, 1), 5)
        label(`${Math.max(0, Math.ceil(p.ammo))}`, 71, 35, 8, '#ffffff')
      }
      if (p.mounted && g.tank) label('TANQUE', 8, 50, 8, '#7bd36b')
      // combo
      if (g.combo >= 2) {
        const m = mult()
        label(`${g.combo} BAJAS`, W - 8, 14, 10, m >= 3 ? '#ff8a3d' : '#ffd23d', 'right')
        if (m > 1) label(`x${m}`, W - 8, 30, 14, '#ff5d5d', 'right')
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(W - 78, 40, 70, 4)
        ctx.fillStyle = '#ffd23d'
        ctx.fillRect(W - 78, 40, 70 * clamp(g.comboT / 2.4, 0, 1), 4)
      }
      // jefe
      const b = g.boss
      if (b && b.st !== 0) {
        const bw = 220
        const bx = (W - bw) / 2
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(bx - 3, 6, bw + 6, 20)
        ctx.fillStyle = '#3a1a1a'
        ctx.fillRect(bx, 17, bw, 6)
        ctx.fillStyle = b.phase2 ? '#ff5d5d' : '#ff9f43'
        ctx.fillRect(bx, 17, bw * clamp(b.hp / b.max, 0, 1), 6)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(bx, 17, bw * clamp(b.hp / b.max, 0, 1), 2)
        label(BOSS_NAMES[b.kind], W / 2, 11, 8, '#ffffff', 'center')
      }
      // avanza
      if (g.idleT > 2.2 && g.phase === 'play' && Math.floor(g.clock * 2.5) % 2 === 0) {
        label('AVANZA', W - 62, H / 2 - 40, 12, '#ffd23d', 'center')
        ctx.fillStyle = '#ffd23d'
        ctx.beginPath()
        ctx.moveTo(W - 14, H / 2 - 40)
        ctx.lineTo(W - 30, H / 2 - 50)
        ctx.lineTo(W - 30, H / 2 - 30)
        ctx.closePath()
        ctx.fill()
      }
      // cartel
      if (g.banner) {
        const bn = g.banner
        const k = clamp(Math.min(bn.t / 0.35, (bn.max - bn.t) / 0.25), 0, 1)
        ctx.globalAlpha = k
        ctx.fillStyle = 'rgba(8,8,16,0.72)'
        ctx.fillRect(0, 84, W, 62)
        ctx.fillStyle = ACCENT
        ctx.fillRect(0, 84, W, 2)
        ctx.fillRect(0, 144, W, 2)
        label(bn.text, W / 2, 104, 18, ACCENT, 'center')
        label(bn.sub, W / 2, 128, 9, '#ffffff', 'center')
        ctx.globalAlpha = 1
      }
      // zona completada
      if (g.phase === 'clear' && !g.boss) {
        const t = g.clearT
        if (t > 1.2) {
          ctx.fillStyle = 'rgba(8,8,16,0.7)'
          ctx.fillRect(0, 66, W, 120)
          ctx.fillStyle = '#5df2a3'
          ctx.fillRect(0, 66, W, 2)
          ctx.fillRect(0, 184, W, 2)
          label(`ZONA ${g.zone} COMPLETADA`, W / 2, 92, 14, '#5df2a3', 'center')
          g.lines.forEach((ln, i) => {
            if (t > 1.8 + i * 0.6) label(ln, W / 2, 122 + i * 20, 9, '#ffffff', 'center')
          })
          if (t > 3.2) label('PREPÁRATE...', W / 2, 170, 9, ACCENT, 'center')
        }
      }
    }

    const draw = () => {
      ctx.save()
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      juice.applyShake(ctx)
      drawBackground()
      for (const pl of g.plats) drawPlatform(pl)
      for (const pr of g.props) drawProp(pr)
      for (const h of g.hostages) drawHostage(h)
      for (const it of g.items) drawItem(it)
      if (g.tank) drawTank(g.tank, g.p)
      for (const e of g.ents) drawEnt(e)
      for (const c of g.corpses) drawCorpse(c)
      if (g.boss) drawBoss(g.boss)
      if (g.phase !== 'ready') drawPlayer()
      else {
        drawSoldier(ctx, 67, GROUND, { face: 1, pal: PAL_PLAYER, run: 0, air: false, crouch: false, aim: 0, weapon: 'pistol', white: false, clock: g.clock })
      }
      for (const bu of g.bullets) drawBullet(bu)
      for (const r of g.rings) {
        ctx.globalAlpha = clamp(r.life / 0.32, 0, 1) * 0.8
        ctx.strokeStyle = r.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(r.x - g.cam, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.save()
      ctx.translate(-g.cam, 0)
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, FONT)
      ctx.restore()
      ctx.restore()
      if (g.phase !== 'ready') drawHud()
      juice.drawFlash(ctx, W, H)
      if (g.fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${g.fade})`
        ctx.fillRect(0, 0, W, H)
      }
      if (g.paused) {
        ctx.fillStyle = 'rgba(8,8,16,0.7)'
        ctx.fillRect(0, 0, W, H)
        label('PAUSA', W / 2, H / 2 - 10, 22, ACCENT, 'center')
        label('Pulsa P para seguir', W / 2, H / 2 + 22, 9, '#fff', 'center')
      }
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000)
      last = now
      const jp = justPressedRef.current
      if (g.phase === 'ready') {
        if (jp.has('action') || jp.has('action2')) begin()
      } else if (g.phase === 'over') {
        if (jp.has('action')) begin()
      } else if (jp.has('pause')) {
        g.paused = !g.paused
        sfx.pause()
      }
      if (!g.paused) {
        g.clock += real
        const dt = juice.update(real)
        if (g.phase !== 'ready' && g.phase !== 'over') step(dt, real)
        else if (g.phase === 'over') {
          updateMisc(dt)
          updateBullets(dt)
        }
      }
      jp.clear()
      hudT += real
      if (hudT > 0.1) {
        hudT = 0
        if (g.score !== lastScoreShown) {
          lastScoreShown = g.score
          setScore(g.score)
        }
        if (g.zone !== lastZone) {
          lastZone = g.zone
          setZone(g.zone)
        }
      }
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const autoPause = () => {
      if ((g.phase === 'play' || g.phase === 'clear') && !g.paused) g.paused = true
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
        className="rounded-xl border-2 border-[#3a2a18] bg-[#1b0f2e] shadow-[0_0_40px_rgba(255,138,61,0.2)]"
        hud={
          <Hud>
            <span className="whitespace-nowrap text-[#ffd23d]">PTS {score.toLocaleString('es-MX')}</span>
            <span className="whitespace-nowrap text-[#ff8a3d]">ZONA {zone}</span>
            <span className="whitespace-nowrap text-white/60">HI {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ imageRendering: 'pixelated' }}
          aria-label="Juego Gun and Run"
        />
        {phase === 'ready' && (
          <StartOverlay
            title="GUN & RUN"
            accent={ACCENT}
            subtitle="Dispara en 8 direcciones, rescata rehenes, recoge armas y derrota al jefe de cada zona."
            hint="Flechas mover y apuntar · Z / ESPACIO disparar · X saltar"
            touchHint="A dispara (mantén para ráfaga) · B salta · Cruceta apunta"
            onStart={() => beginRef.current()}
          />
        )}
        {phase === 'over' && (
          <GameOverOverlay
            title="FIN DE LA MISIÓN"
            accent={ACCENT}
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Zona', value: stats.zone },
              { label: 'Bajas', value: stats.kills },
              { label: 'Rehenes', value: stats.rescued },
              { label: 'Mejor racha', value: stats.combo },
            ]}
            onRestart={() => beginRef.current()}
          />
        )}
      </GameScreen>
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Disparar"
        actionGlyph="A"
        showAction2
        action2Label="Saltar"
        action2Glyph="B"
      />
    </div>
  )
}
