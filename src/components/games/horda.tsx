'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { TouchPad } from './touch-pad'
import { Juice } from './juice'
import { loadBest, renderScale, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'horda'
const ACCENT = '#c084fc'

const W0 = 360
const H0 = 560
// Arena lógica: se ajusta a la pantalla al abrir el juego (ver layout).
let W = W0
let H = H0

/** Ajusta la arena al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

const MAXE = 300 // enemigos simultáneos
const MAXP = 140 // proyectiles
const MAXI = 420 // gemas y objetos
const CELL = 32 // celda de la rejilla espacial
const WIN_TIME = 600 // amanecer: se sobrevive 10 minutos
const MAX_WEAPONS = 6
const MAX_LVL = 5

type Phase = 'menu' | 'playing' | 'dying' | 'over'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const hash2 = (x: number, y: number, s = 0) => hash(x * 91.7 + y * 313.3 + s * 17.1)
const fmtTime = (s: number) => {
  const t = Math.floor(s)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Datos: armas y pasivos
// ---------------------------------------------------------------------------
type WId = 'magic' | 'whip' | 'aura' | 'axe' | 'knife' | 'bolt' | 'orb'
type PId = 'speed' | 'area' | 'cool' | 'magnet' | 'hp' | 'regen' | 'might'

interface WDef {
  id: WId
  name: string
  color: string
  desc: string[]
}
interface PDef {
  id: PId
  name: string
  color: string
  desc: string
}

const WDEFS: WDef[] = [
  {
    id: 'magic',
    name: 'Proyectil Mágico',
    color: '#c084fc',
    desc: ['Dispara al enemigo más cercano', 'Más daño', 'Dispara 2 proyectiles', 'Atraviesa a 1 enemigo', 'Dispara 3 proyectiles que atraviesan'],
  },
  {
    id: 'whip',
    name: 'Látigo',
    color: '#fb7185',
    desc: ['Azota en arco frente a ti', 'Más daño y alcance', 'También golpea hacia atrás', 'Más daño y alcance', 'Más rápido y muy letal'],
  },
  {
    id: 'aura',
    name: 'Aura Espectral',
    color: '#67e8f9',
    desc: ['Daña a los enemigos cercanos', 'Más radio y daño', 'Más radio y daño', 'Más radio y ralentiza', 'Aura enorme y devastadora'],
  },
  {
    id: 'axe',
    name: 'Hachas',
    color: '#fbbf24',
    desc: ['Lanza un hacha en parábola', 'Lanza 2 hachas', 'Más daño', 'Lanza 3 hachas', 'Lanza 4 hachas más fuertes'],
  },
  {
    id: 'knife',
    name: 'Cuchillos',
    color: '#e5e7eb',
    desc: ['Lanza cuchillos hacia donde caminas', '2 cuchillos por tanda', '3 cuchillos que perforan', 'Mayor cadencia', '4 cuchillos muy rápidos'],
  },
  {
    id: 'bolt',
    name: 'Tormenta',
    color: '#fde047',
    desc: ['Un rayo cae sobre un enemigo', 'Más daño', 'Caen 2 rayos', 'Más área y daño', 'Caen 3 rayos'],
  },
  {
    id: 'orb',
    name: 'Orbes Guardianes',
    color: '#4ade80',
    desc: ['2 orbes giran a tu alrededor', 'Orbita más amplia', '3 orbes', '4 orbes', '5 orbes veloces'],
  },
]

const PDEFS: PDef[] = [
  { id: 'speed', name: 'Botas Veloces', color: '#38bdf8', desc: '+10% velocidad de movimiento' },
  { id: 'area', name: 'Tomo Arcano', color: '#a78bfa', desc: '+12% área de las armas' },
  { id: 'cool', name: 'Reloj de Arena', color: '#f472b6', desc: '-8% tiempo de enfriamiento' },
  { id: 'magnet', name: 'Imán', color: '#f87171', desc: '+35% radio de recogida de gemas' },
  { id: 'hp', name: 'Corazón', color: '#ef4444', desc: '+20 de vida máxima y te cura 20' },
  { id: 'regen', name: 'Regeneración', color: '#4ade80', desc: '+0.5 de vida por segundo' },
  { id: 'might', name: 'Poder', color: '#fb923c', desc: '+10% de daño de todas las armas' },
]

const WCD: Record<WId, number[]> = {
  magic: [0.75, 0.7, 0.65, 0.58, 0.5],
  whip: [1.4, 1.3, 1.2, 1.1, 0.95],
  aura: [0.5, 0.5, 0.5, 0.5, 0.5],
  axe: [1.7, 1.6, 1.5, 1.35, 1.2],
  knife: [0.9, 0.8, 0.75, 0.65, 0.55],
  bolt: [2.4, 2.2, 2.0, 1.8, 1.5],
  orb: [1, 1, 1, 1, 1],
}
const W_DMG: Record<WId, number[]> = {
  magic: [12, 15, 15, 18, 22],
  whip: [10, 13, 16, 20, 27],
  aura: [3, 4, 5, 6, 8],
  axe: [15, 15, 19, 19, 25],
  knife: [6, 7, 8, 9, 11],
  bolt: [20, 24, 24, 30, 36],
  orb: [7, 8, 9, 10, 12],
}
const WHIP_REACH = [56, 60, 64, 68, 78]
const AURA_R = [38, 46, 54, 62, 74]
const MAGIC_N = [1, 1, 2, 2, 3]
const MAGIC_PIERCE = [0, 0, 0, 1, 2]
const AXE_N = [1, 2, 2, 3, 4]
const KNIFE_N = [1, 2, 3, 3, 4]
const KNIFE_PIERCE = [0, 0, 1, 1, 2]
const BOLT_N = [1, 1, 2, 2, 3]
const BOLT_R = [20, 22, 24, 28, 30]
const ORB_N = [2, 2, 3, 4, 5]
const ORB_R = [46, 52, 54, 58, 64]
const ORB_SPD = [2.2, 2.4, 2.6, 2.8, 3.4]

// ---------------------------------------------------------------------------
// Enemigos
// ---------------------------------------------------------------------------
interface EType {
  hp: number
  speed: number
  r: number
  dmg: number
  xp: number
  colors: string[]
}
const ET: EType[] = [
  { hp: 3, speed: 82, r: 7, dmg: 4, xp: 1, colors: ['#e11d48', '#fb7185'] }, // 0 murciélago
  { hp: 9, speed: 36, r: 8, dmg: 6, xp: 1, colors: ['#84cc16', '#4d7c0f'] }, // 1 zombi
  { hp: 8, speed: 54, r: 7, dmg: 5, xp: 2, colors: ['#e5e7eb', '#9ca3af'] }, // 2 esqueleto
  { hp: 14, speed: 46, r: 8, dmg: 7, xp: 3, colors: ['#a5f3fc', '#67e8f9'] }, // 3 fantasma
  { hp: 2, speed: 112, r: 4, dmg: 3, xp: 1, colors: ['#be123c', '#fb7185'] }, // 4 enjambre
  { hp: 70, speed: 30, r: 12, dmg: 11, xp: 8, colors: ['#d97706', '#92400e'] }, // 5 tanque
  { hp: 1, speed: 45, r: 17, dmg: 14, xp: 0, colors: ['#fff', '#ef4444'] }, // 6 jefe
]
const BOSS_NAMES = ['REY ESQUELETO', 'EL SEGADOR', 'COLOSO PUTRIDO']
const BOSS_COLORS = ['#e5e7eb', '#38bdf8', '#84cc16']

interface Enemy {
  on: boolean
  id: number
  type: number
  boss: number // 0 = no, 1..3 = tipo de jefe
  x: number
  y: number
  kx: number
  ky: number
  hp: number
  mhp: number
  r: number
  sp: number
  dmg: number
  xp: number
  flash: number
  slow: number
  orbT: number
  ph: number
  st: number // jefe: 0 camina, 1 aviso, 2 embestida
  stT: number
  dx: number
  dy: number
}
interface Item {
  on: boolean
  type: number // 0 gema, 1 gema media, 2 gema grande, 3 poción, 4 cofre
  x: number
  y: number
  val: number
  state: number
  sp: number
  ph: number
}
interface Proj {
  on: boolean
  kind: number // 0 magia, 1 cuchillo, 2 hacha
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  pierce: number
  life: number
  r: number
  rehit: number
  rehitT: number
  hits: Int32Array
  nh: number
  rot: number
}
interface Slash {
  x: number
  y: number
  a: number
  reach: number
  t: number
  life: number
  color: string
}
interface Bolt {
  x: number
  y: number
  t: number
  seed: number
  r: number
}
interface WState {
  id: WId
  lvl: number
  cd: number
}
interface Card {
  kind: 'w' | 'p' | 'heal' | 'gold'
  id: string
  name: string
  desc: string
  color: string
  lvl: number
  isNew: boolean
}
interface Choice {
  title: string
  cards: Card[]
}
interface Result {
  score: number
  newBest: boolean
  time: number
  kills: number
  level: number
  bonus: number
  won: boolean
}

// ---------------------------------------------------------------------------
// Sprites (pixel art)
// ---------------------------------------------------------------------------
type Pal = Record<string, string>
interface Spr {
  n: HTMLCanvasElement[]
  w: HTMLCanvasElement[]
  lw: number
  lh: number
}

function makeSprite(rows: string[], pal: Pal, cell: number, rs: number, white: boolean): HTMLCanvasElement {
  const cols = rows[0].length
  const cv = document.createElement('canvas')
  cv.width = Math.round(cols * cell * rs)
  cv.height = Math.round(rows.length * cell * rs)
  const x = cv.getContext('2d')
  if (!x) return cv
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = rows[r][c]
      if (ch === '.' || ch === undefined) continue
      const color = white ? '#ffffff' : pal[ch]
      if (!color) continue
      const x0 = Math.round(c * cell * rs)
      const y0 = Math.round(r * cell * rs)
      x.fillStyle = color
      x.fillRect(x0, y0, Math.round((c + 1) * cell * rs) - x0, Math.round((r + 1) * cell * rs) - y0)
    }
  }
  return cv
}

function makeSpr(frames: string[][], pal: Pal, cell: number, rs: number): Spr {
  return {
    n: frames.map((f) => makeSprite(f, pal, cell, rs, false)),
    w: frames.map((f) => makeSprite(f, pal, cell, rs, true)),
    lw: frames[0][0].length * cell,
    lh: frames[0].length * cell,
  }
}

const PLAYER_A = [
  '...KKKK...',
  '..KPPPPK..',
  '.KPPPPPPK.',
  '.KPSSSSPK.',
  '.KPSESESK.',
  '.KPSSSSPK.',
  '..KPPPPK..',
  '.KPPLLPPK.',
  '.KPPLLPPK.',
  '.KQQQQQQK.',
  '..KQ..QK..',
  '..KK..KK..',
]
const PLAYER_B = [
  '...KKKK...',
  '..KPPPPK..',
  '.KPPPPPPK.',
  '.KPSSSSPK.',
  '.KPSESESK.',
  '.KPSSSSPK.',
  '..KPPPPK..',
  '.KPPLLPPK.',
  '.KPPLLPPK.',
  '.KQQQQQQK.',
  '...KQQK...',
  '...KKKK...',
]
const PLAYER_PAL: Pal = { K: '#1b0f33', P: '#a855f7', Q: '#7e22ce', L: '#d8b4fe', S: '#fde7c6', E: '#1b1033' }

const BAT_A = ['K.......K', 'KK.KKK.KK', 'KKKKKKKKK', '.KKRKRKK.', '..K...K..']
const BAT_B = ['.........', '..KKKKK..', 'KKKRKRKKK', 'KKKKKKKKK', 'K.K...K.K']
const ZOMBIE_A = ['..MMMM..', '.MMMMMM.', '.MEMMEM.', '.MMMMMM.', '..MDDM..', 'LMMMMMML', 'L.MMMM.L', '..MMMM..', '..MM.M..', '..MM.MM.']
const ZOMBIE_B = ['..MMMM..', '.MMMMMM.', '.MEMMEM.', '.MMMMMM.', '..MDDM..', 'LMMMMMML', 'L.MMMM.L', '..MMMM..', '..M.MM..', '.MM..MM.']
const SKEL_A = ['..LLLL..', '.LLLLLL.', '.LKLLKL.', '..LKKL..', '.LLMMLL.', 'L.LMML.L', '..LLLL..', '..L..L..', '.LL..LL.']
const SKEL_B = ['..LLLL..', '.LLLLLL.', '.LKLLKL.', '..LKKL..', '.LLMMLL.', '.LLMMLL.', '..LLLL..', '..LL.L..', '..L..LL.']
const GHOST_A = ['..LLLLL..', '.LLLLLLL.', 'LLKKLKKLL', 'LLKKLKKLL', 'LLLLLLLLL', 'LLLLKLLLL', 'LLLLLLLLL', 'LLLLLLLLL', 'LL.LLL.LL']
const GHOST_B = ['..LLLLL..', '.LLLLLLL.', 'LLKKLKKLL', 'LLKKLKKLL', 'LLLLLLLLL', 'LLLLKLLLL', 'LLLLLLLLL', 'LLLLLLLLL', 'L.LLLLL.L']
const SWARM_A = ['K...K', 'KKKKK', '.KRK.']
const SWARM_B = ['.....', 'KKKKK', 'K.R.K']
const TANK_A = [
  '...MMMMMM...',
  '..MMMMMMMM..',
  '..MEMMMMEM..',
  '..MMMMMMMM..',
  '.MMMDDDDMMM.',
  'MMMMMMMMMMMM',
  'MMMMMMMMMMMM',
  'LMMMMMMMMMML',
  'LL.MMMMMM.LL',
  '...MMMMMM...',
  '...MM..MM...',
  '..MMM..MMM..',
]
const TANK_B = [
  '...MMMMMM...',
  '..MMMMMMMM..',
  '..MEMMMMEM..',
  '..MMMMMMMM..',
  '.MMMDDDDMMM.',
  'MMMMMMMMMMMM',
  'MMMMMMMMMMMM',
  'LMMMMMMMMMML',
  'LL.MMMMMM.LL',
  '...MMMMMM...',
  '..MMM..MM...',
  '..MMM.MMM...',
]
const BOSS_A = [
  'KK..........KK',
  '.KK........KK.',
  '..KKKKKKKKKK..',
  '.KMMMMMMMMMMK.',
  '.KMEEMMMMEEMK.',
  '.KMEEMMMMEEMK.',
  '.KMMMMMMMMMMK.',
  '..KMMDDDDMMK..',
  '..KMMMMMMMMK..',
  '.KKMMMMMMMMKK.',
  'KMMKMMMMMMKMMK',
  'KM.KMMMMMMK.MK',
  '...KMM..MMK...',
  '..KKM....MKK..',
]
const BOSS_B = [
  'KK..........KK',
  '.KK........KK.',
  '..KKKKKKKKKK..',
  '.KMMMMMMMMMMK.',
  '.KMEEMMMMEEMK.',
  '.KMEEMMMMEEMK.',
  '.KMMMMMMMMMMK.',
  '..KMMDDDDMMK..',
  '..KMMMMMMMMK..',
  '.KKMMMMMMMMKK.',
  'KMMKMMMMMMKMMK',
  'KM.KMMMMMMK.MK',
  '..KMM....MMK..',
  '.KKM......MKK.',
]
const BOSS_PALS: Pal[] = [
  { K: '#3f3f46', M: '#e5e7eb', D: '#9ca3af', E: '#ef4444' },
  { K: '#082f49', M: '#0ea5e9', D: '#0369a1', E: '#fde047' },
  { K: '#1a2e05', M: '#65a30d', D: '#3f6212', E: '#f43f5e' },
]

interface Sprites {
  player: Spr
  enemy: Spr[]
  boss: Spr[]
  vignette: HTMLCanvasElement
  glow: HTMLCanvasElement
  floor: HTMLCanvasElement
}

const FLOOR = 256

/** Viñeta oscura del tamaño actual de la arena (depende de W y H). */
function buildVignette(rs: number): HTMLCanvasElement {
  const vignette = document.createElement('canvas')
  vignette.width = Math.round(W * rs)
  vignette.height = Math.round(H * rs)
  const x = vignette.getContext('2d')
  if (x) {
    const g = x.createRadialGradient(vignette.width / 2, vignette.height / 2, vignette.height * 0.25, vignette.width / 2, vignette.height / 2, vignette.height * 0.62)
    g.addColorStop(0, 'rgba(5,2,12,0)')
    g.addColorStop(1, 'rgba(5,2,12,0.72)')
    x.fillStyle = g
    x.fillRect(0, 0, vignette.width, vignette.height)
  }
  return vignette
}

function buildSprites(rs: number): Sprites {
  const player = makeSpr([PLAYER_A, PLAYER_B], PLAYER_PAL, 1.9, rs)
  const enemy: Spr[] = [
    makeSpr([BAT_A, BAT_B], { K: '#7f1d3a', R: '#fde047' }, 2.0, rs),
    makeSpr([ZOMBIE_A, ZOMBIE_B], { M: '#84cc16', D: '#3f6212', L: '#a3e635', E: '#1a2e05' }, 2.0, rs),
    makeSpr([SKEL_A, SKEL_B], { L: '#e5e7eb', M: '#9ca3af', K: '#27272a' }, 2.0, rs),
    makeSpr([GHOST_A, GHOST_B], { L: '#bae6fd', K: '#0c4a6e' }, 2.0, rs),
    makeSpr([SWARM_A, SWARM_B], { K: '#be123c', R: '#fde047' }, 2.0, rs),
    makeSpr([TANK_A, TANK_B], { M: '#d97706', D: '#7c2d12', L: '#fbbf24', E: '#fef3c7' }, 2.1, rs),
  ]
  const boss = BOSS_PALS.map((p) => makeSpr([BOSS_A, BOSS_B], p, 2.7, rs))

  const vignette = buildVignette(rs)
  // resplandor de antorcha
  const glow = document.createElement('canvas')
  glow.width = glow.height = 64
  {
    const x = glow.getContext('2d')
    if (x) {
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,170,60,0.7)')
      g.addColorStop(1, 'rgba(255,120,30,0)')
      x.fillStyle = g
      x.fillRect(0, 0, 64, 64)
    }
  }
  // suelo teselado
  const floor = document.createElement('canvas')
  floor.width = floor.height = FLOOR * rs
  {
    const x = floor.getContext('2d')
    if (x) {
      x.scale(rs, rs)
      const base = ['#171123', '#1b1429', '#150f20', '#1d152c']
      for (let ty = 0; ty < FLOOR / 16; ty++) {
        for (let tx = 0; tx < FLOOR / 16; tx++) {
          x.fillStyle = base[Math.floor(hash2(tx, ty, 3) * 4)]
          x.fillRect(tx * 16, ty * 16, 16, 16)
        }
      }
      // juntas de losas
      x.fillStyle = 'rgba(0,0,0,0.22)'
      for (let i = 0; i < FLOOR; i += 64) {
        x.fillRect(i, 0, 1, FLOOR)
        x.fillRect(0, i, FLOOR, 1)
      }
      // hierba, piedras y grietas
      for (let i = 0; i < 90; i++) {
        const px = Math.floor(hash(i * 3 + 1) * (FLOOR - 8)) + 2
        const py = Math.floor(hash(i * 3 + 2) * (FLOOR - 8)) + 2
        const k = hash(i * 3 + 3)
        if (k < 0.5) {
          x.fillStyle = '#2b1f45'
          x.fillRect(px, py, 1, 3)
          x.fillRect(px + 2, py + 1, 1, 2)
          x.fillRect(px - 2, py + 1, 1, 2)
        } else if (k < 0.8) {
          x.fillStyle = '#2a2140'
          x.fillRect(px, py, 3, 2)
          x.fillStyle = '#352a52'
          x.fillRect(px, py, 3, 1)
        } else {
          x.fillStyle = 'rgba(0,0,0,0.3)'
          x.fillRect(px, py, 4, 1)
          x.fillRect(px + 3, py + 1, 3, 1)
          x.fillRect(px + 5, py + 2, 1, 2)
        }
      }
    }
  }
  return { player, enemy, boss, vignette, glow, floor }
}

// ---------------------------------------------------------------------------
// Sonidos locales (con límite para no saturar)
// ---------------------------------------------------------------------------
const lastSfx: Record<string, number> = {}
const gate = (k: string, ms: number) => {
  const n = performance.now()
  if (n - (lastSfx[k] ?? 0) < ms) return false
  lastSfx[k] = n
  return true
}
const sHit = () => gate('hit', 50) && tone({ freq: 220, to: 110, dur: 0.05, type: 'square', vol: 0.025 })
const sKill = () => {
  if (!gate('kill', 70)) return
  noise({ dur: 0.07, vol: 0.035, freq: 1100 })
  tone({ freq: 340, to: 120, dur: 0.08, type: 'triangle', vol: 0.04 })
}
const sGem = (chain: number) => gate('gem', 35) && tone({ freq: 620 + Math.min(chain, 12) * 55, dur: 0.06, type: 'sine', vol: 0.04 })
const sHurt = () => {
  tone({ freq: 220, to: 55, dur: 0.22, type: 'sawtooth', vol: 0.07 })
  noise({ dur: 0.14, vol: 0.07, freq: 700 })
}
const sLevel = () => {
  ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'square', vol: 0.05, delay: i * 0.07 }))
}
const sPick = () => {
  tone({ freq: 440, to: 880, dur: 0.12, type: 'triangle', vol: 0.06 })
}
const sWhip = () => gate('whip', 120) && noise({ dur: 0.1, vol: 0.05, freq: 2400 })
const sShoot = () => gate('shoot', 90) && tone({ freq: 700, to: 1100, dur: 0.06, type: 'triangle', vol: 0.03 })
const sBolt = () => {
  if (!gate('bolt', 80)) return
  noise({ dur: 0.2, vol: 0.08, freq: 3000 })
  tone({ freq: 900, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.05 })
}
const sChest = () => {
  ;[392, 523, 659, 784, 988].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', vol: 0.05, delay: i * 0.06 }))
}
const sBoss = () => {
  tone({ freq: 110, to: 55, dur: 0.6, type: 'sawtooth', vol: 0.08 })
  tone({ freq: 82, to: 41, dur: 0.7, type: 'square', vol: 0.05, delay: 0.1 })
}
const sPause = () => tone({ freq: 330, to: 220, dur: 0.1, type: 'square', vol: 0.04 })
const sHeal = () => tone({ freq: 500, to: 900, dur: 0.18, type: 'sine', vol: 0.06 })

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function Horda() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const pickRef = useRef<(i: number) => void>(() => {})
  const selRef = useRef(0)
  const choiceRef = useRef<Choice | null>(null)
  const [ui, setUi] = useState<Phase>('menu')
  const [hud, setHud] = useState({ score: 0, level: 1 })
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [choice, setChoice] = useState<Choice | null>(null)
  const [sel, setSel] = useState(0)
  const [result, setResult] = useState<Result>({ score: 0, newBest: false, time: 0, kills: 0, level: 1, bonus: 0, won: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const rs = canvas.width / W
    const spr = buildSprites(rs)
    const juice = new Juice(6)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    // ---------- piscinas ----------
    const E: Enemy[] = Array.from({ length: MAXE }, () => ({
      on: false, id: 0, type: 0, boss: 0, x: 0, y: 0, kx: 0, ky: 0, hp: 0, mhp: 0, r: 6, sp: 0, dmg: 0, xp: 0,
      flash: 0, slow: 0, orbT: 0, ph: 0, st: 0, stT: 0, dx: 0, dy: 0,
    }))
    const IT: Item[] = Array.from({ length: MAXI }, () => ({ on: false, type: 0, x: 0, y: 0, val: 0, state: 0, sp: 0, ph: 0 }))
    const P: Proj[] = Array.from({ length: MAXP }, () => ({
      on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, pierce: 0, life: 0, r: 4, rehit: 0, rehitT: 0,
      hits: new Int32Array(8), nh: 0, rot: 0,
    }))
    let slashes: Slash[] = []
    let bolts: Bolt[] = []

    // rejilla espacial
    const head = new Int16Array(64 * 64)
    const nxt = new Int16Array(MAXE)
    const scratch = new Int16Array(MAXE)
    const cellIdx = (cx: number, cy: number) => (cx & 63) + ((cy & 63) << 6)
    const buildGrid = () => {
      head.fill(-1)
      for (let i = 0; i < MAXE; i++) {
        const e = E[i]
        if (!e.on) continue
        const k = cellIdx(Math.floor(e.x / CELL), Math.floor(e.y / CELL))
        nxt[i] = head[k]
        head[k] = i
      }
    }
    const near = (x: number, y: number, r: number) => {
      let n = 0
      const x0 = Math.floor((x - r) / CELL)
      const x1 = Math.floor((x + r) / CELL)
      const y0 = Math.floor((y - r) / CELL)
      const y1 = Math.floor((y + r) / CELL)
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          let i = head[cellIdx(cx, cy)]
          while (i >= 0) {
            scratch[n++] = i
            i = nxt[i]
          }
        }
      }
      return n
    }

    // ---------- estado ----------
    const g = {
      phase: 'menu' as Phase,
      paused: false,
      choosing: false,
      guard: 0,
      clock: 0,
      time: 0,
      px: 0,
      py: 0,
      fx: 1,
      fy: 0,
      hp: 100,
      iframes: 0,
      walk: 0,
      moving: false,
      face: 1,
      camx: -W / 2,
      camy: -H / 2,
      kills: 0,
      level: 1,
      xp: 0,
      pending: 0,
      bonus: 0,
      choiceKind: 'level' as 'level' | 'chest',
      weapons: [] as WState[],
      pass: { speed: 0, area: 0, cool: 0, magnet: 0, hp: 0, regen: 0, might: 0 } as Record<PId, number>,
      alive: 0,
      eid: 1,
      spawnAcc: 0,
      nextSwarm: 50,
      nextBoss: 120,
      bossN: 0,
      aTick: 0,
      orbAng: 0,
      chain: 0,
      chainT: 0,
      banner: null as { text: string; color: string; t: number } | null,
      deadT: 0,
      overT: 0,
      hudT: 0,
      win: false,
      xpPulse: 0,
      hurtT: 0,
    }
    const st = { spd: 1, area: 1, cool: 1, mag: 44, maxhp: 100, regen: 0, might: 1 }
    const computeStats = () => {
      const p = g.pass
      st.spd = 1 + 0.1 * p.speed
      st.area = 1 + 0.12 * p.area
      st.cool = 1 - 0.08 * p.cool
      st.mag = 44 * (1 + 0.35 * p.magnet)
      st.maxhp = 100 + 20 * p.hp
      st.regen = 0.5 * p.regen
      st.might = 1 + 0.1 * p.might
    }
    const needXp = (l: number) => Math.round(5 + (l - 1) * 7 + (l - 1) * (l - 1) * 0.6)
    const score = () => g.kills * 10 + Math.floor(g.time) * 5 + g.level * 100 + g.bonus

    const reset = () => {
      for (const e of E) e.on = false
      for (const i of IT) i.on = false
      for (const p of P) p.on = false
      slashes = []
      bolts = []
      juice.reset()
      Object.assign(g, {
        paused: false, choosing: false, guard: 0, time: 0, px: 0, py: 0, fx: 1, fy: 0, hp: 100, iframes: 0,
        walk: 0, moving: false, face: 1, camx: -W / 2, camy: -H / 2, kills: 0, level: 1, xp: 0, pending: 0,
        bonus: 0, alive: 0, spawnAcc: 0, nextSwarm: 50, nextBoss: 120, bossN: 0, aTick: 0, orbAng: 0,
        chain: 0, chainT: 0, banner: null, deadT: 0, overT: 0, hudT: 0, win: false, xpPulse: 0, hurtT: 0,
      })
      g.pass = { speed: 0, area: 0, cool: 0, magnet: 0, hp: 0, regen: 0, might: 0 }
      g.weapons = [{ id: 'magic', lvl: 1, cd: 0.3 }]
      computeStats()
    }

    // ---------- utilidades de juego ----------
    let slotPtr = 0
    const freeEnemy = () => {
      for (let k = 0; k < MAXE; k++) {
        const i = (slotPtr + k) % MAXE
        if (!E[i].on) {
          slotPtr = (i + 1) % MAXE
          return E[i]
        }
      }
      return null
    }
    const edgePoint = (margin: number): [number, number] => {
      const hw = W / 2 + margin
      const hh = H / 2 + margin
      let u = Math.random() * (4 * hw + 4 * hh)
      let x: number, y: number
      if (u < 2 * hw) {
        x = -hw + u
        y = -hh
      } else if ((u -= 2 * hw) < 2 * hh) {
        x = hw
        y = -hh + u
      } else if ((u -= 2 * hh) < 2 * hw) {
        x = hw - u
        y = hh
      } else {
        u -= 2 * hw
        x = -hw
        y = hh - u
      }
      return [g.px + x, g.py + y]
    }
    const spawnEnemy = (type: number, x: number, y: number, boss = 0) => {
      const e = freeEnemy()
      if (!e) return null
      const t = ET[type]
      const hpMul = type === 4 ? 1 + g.time / 400 : 1 + g.time / 200
      e.on = true
      e.id = g.eid++
      e.type = type
      e.boss = boss
      e.x = x
      e.y = y
      e.kx = e.ky = 0
      e.hp = e.mhp = boss ? 380 + g.time * 2.4 : Math.max(1, Math.round(t.hp * hpMul))
      e.r = boss ? 17 : t.r
      e.sp = t.speed * (type === 0 ? 0.9 + Math.random() * 0.25 : 0.92 + Math.random() * 0.16)
      e.dmg = Math.round(t.dmg * (1 + g.time / 500))
      e.xp = t.xp
      e.flash = 0
      e.slow = 0
      e.orbT = 0
      e.ph = Math.random() * 10
      e.st = 0
      e.stT = 2.5
      e.dx = e.dy = 0
      g.alive++
      return e
    }
    const pickType = (t: number) => {
      const w = [t < 200 ? 3 : 2, 3, t >= 35 ? Math.min(2.5, (t - 35) / 30) : 0, t >= 90 ? Math.min(1.8, (t - 90) / 40) : 0, 0, t >= 120 ? Math.min(0.9, (t - 120) / 120 + 0.3) : 0]
      let sum = 0
      for (const v of w) sum += v
      let r = Math.random() * sum
      for (let i = 0; i < w.length; i++) {
        r -= w[i]
        if (r <= 0) return i
      }
      return 0
    }
    const addItem = (type: number, x: number, y: number, val: number) => {
      for (const it of IT) {
        if (it.on) continue
        it.on = true
        it.type = type
        it.x = x
        it.y = y
        it.val = val
        it.state = 0
        it.sp = -50
        it.ph = Math.random() * 6
        return true
      }
      return false
    }
    const banner = (text: string, color: string) => {
      g.banner = { text, color, t: 2.2 }
    }

    const kill = (e: Enemy) => {
      e.on = false
      g.alive--
      g.kills++
      const c = ET[e.type].colors
      if (e.boss) {
        juice.burst(e.x, e.y, [BOSS_COLORS[e.boss - 1], '#ffffff', '#fde047'], { count: 46, speed: 190, life: 0.8, size: 4, drag: 2 })
        juice.shake(0.8)
        juice.freeze(130)
        juice.flash('#ffffff', 0.5)
        addItem(4, e.x, e.y, 0)
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          addItem(2, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, 25)
        }
        sBoss()
        banner('¡JEFE DERROTADO!', '#fde047')
        return
      }
      juice.burst(e.x, e.y, c, { count: e.type === 5 ? 14 : 6, speed: 80, life: 0.4, size: 3, drag: 3 })
      if (e.type === 5) juice.shake(0.15)
      sKill()
      if (Math.random() < 0.012 && e.type !== 4) addItem(3, e.x, e.y, 0)
      const v = e.xp
      if (!addItem(v >= 5 ? 1 : 0, e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, v)) gainXp(v)
    }

    const gainXp = (v: number) => {
      g.xp += v
      g.xpPulse = 1
      let need = needXp(g.level)
      while (g.xp >= need) {
        g.xp -= need
        g.level++
        g.pending++
        need = needXp(g.level)
      }
    }

    const hurtEnemy = (e: Enemy, base: number, kx: number, ky: number, kb: number) => {
      const crit = Math.random() < 0.08
      const dmg = base * st.might * (crit ? 2 : 1)
      e.hp -= dmg
      e.flash = 0.09
      const m = e.boss ? 0.06 : e.type === 5 ? 0.3 : 1
      e.kx += kx * kb * m
      e.ky += ky * kb * m
      if (juice.texts.length < 36) {
        juice.text(e.x + (Math.random() - 0.5) * 8, e.y - e.r - 4, String(Math.max(1, Math.round(dmg))), crit ? '#fde047' : '#ffffff', crit ? 10 : 7, 0.55)
      }
      sHit()
      if (e.hp <= 0) kill(e)
    }

    const hurtPlayer = (d: number) => {
      g.hp -= d
      g.iframes = 0.6
      g.hurtT = 0.25
      juice.shake(0.4)
      juice.freeze(55)
      juice.flash('#ef4444', 0.28)
      juice.burst(g.px, g.py, ['#ef4444', '#fca5a5'], { count: 8, speed: 100, life: 0.4, size: 3 })
      sHurt()
      if (g.hp <= 0) {
        g.hp = 0
        g.phase = 'dying'
        g.deadT = 0
        juice.shake(1)
        juice.freeze(180)
        juice.burst(g.px, g.py, ['#c084fc', '#ffffff', '#ef4444'], { count: 40, speed: 170, life: 0.9, size: 4 })
      }
    }

    const finish = () => {
      g.phase = 'over'
      g.overT = 0
      const s = score()
      const nb = saveBest(GAME_ID, s)
      setBest(Math.max(loadBest(GAME_ID), s))
      setResult({ score: s, newBest: nb, time: g.time, kills: g.kills, level: g.level, bonus: g.bonus, won: g.win })
      setUi('over')
    }

    // ---------- cartas ----------
    const makeCards = (): Card[] => {
      const opts: Card[] = []
      for (const d of WDEFS) {
        const w = g.weapons.find((x) => x.id === d.id)
        if (w) {
          if (w.lvl < MAX_LVL) opts.push({ kind: 'w', id: d.id, name: d.name, desc: d.desc[w.lvl], color: d.color, lvl: w.lvl + 1, isNew: false })
        } else if (g.weapons.length < MAX_WEAPONS) {
          opts.push({ kind: 'w', id: d.id, name: d.name, desc: d.desc[0], color: d.color, lvl: 1, isNew: true })
        }
      }
      for (const d of PDEFS) {
        const l = g.pass[d.id]
        if (l < MAX_LVL) opts.push({ kind: 'p', id: d.id, name: d.name, desc: d.desc, color: d.color, lvl: l + 1, isNew: l === 0 })
      }
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[opts[i], opts[j]] = [opts[j], opts[i]]
      }
      if (g.weapons.length < 3) {
        const k = opts.findIndex((o) => o.kind === 'w' && o.isNew)
        if (k > 2) [opts[0], opts[k]] = [opts[k], opts[0]]
      }
      const out = opts.slice(0, 3)
      const fallback: Card[] = [
        { kind: 'heal', id: 'heal', name: 'Pollo asado', desc: 'Recupera 40% de tu vida', color: '#f87171', lvl: 0, isNew: false },
        { kind: 'gold', id: 'gold', name: 'Tesoro', desc: '+300 puntos de bonificación', color: '#fbbf24', lvl: 0, isNew: false },
      ]
      for (const f of fallback) if (out.length < 3) out.push(f)
      return out
    }
    const openChoice = (kind: 'level' | 'chest') => {
      g.choosing = true
      g.choiceKind = kind
      g.guard = 0.35
      selRef.current = 0
      setSel(0)
      const ch = { title: kind === 'chest' ? 'COFRE' : `NIVEL ${g.level}`, cards: makeCards() }
      choiceRef.current = ch
      setChoice(ch)
      if (kind === 'chest') sChest()
      else sLevel()
      juice.flash('#c084fc', 0.3)
    }
    const applyCard = (c: Card) => {
      if (c.kind === 'w') {
        const w = g.weapons.find((x) => x.id === c.id)
        if (w) w.lvl = Math.min(MAX_LVL, w.lvl + 1)
        else g.weapons.push({ id: c.id as WId, lvl: 1, cd: 0.2 })
      } else if (c.kind === 'p') {
        const id = c.id as PId
        g.pass[id] = Math.min(MAX_LVL, g.pass[id] + 1)
        computeStats()
        if (id === 'hp') g.hp = Math.min(st.maxhp, g.hp + 20)
      } else if (c.kind === 'heal') {
        g.hp = Math.min(st.maxhp, g.hp + st.maxhp * 0.4)
        sHeal()
      } else {
        g.bonus += 300
      }
    }
    pickRef.current = (i: number) => {
      if (!g.choosing || g.guard > 0) return
      const card = choiceRef.current?.cards[i]
      if (card) applyCard(card)
      choiceRef.current = null
      setChoice(null)
      sPick()
      g.choosing = false
      g.iframes = Math.max(g.iframes, 0.8)
      if (g.choiceKind === 'level') g.pending = Math.max(0, g.pending - 1)
      g.choiceKind = 'level'
    }

    // ---------- cambio de tamaño en partida ----------
    // La arena es relativa al jugador: solo cambian el canvas, la viñeta y el
    // centro de cámara. Se pausa para que el jugador se reacomode.
    const relayoutLive = () => {
      layout()
      setupCanvas(canvas, W, H)
      spr.vignette = buildVignette(renderScale())
      g.camx = g.px - W / 2
      g.camy = g.py - H / 2
      if (!g.choosing) g.paused = true
    }

    // ---------- inicio / pausa ----------
    startRef.current = () => {
      reset()
      g.phase = 'playing'
      choiceRef.current = null
      setChoice(null)
      setHud({ score: 0, level: 1 })
      setUi('playing')
      sPause()
    }
    const onBlur = () => {
      if (g.phase === 'playing' && !g.choosing) g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    const onPointer = () => {
      if (g.paused) {
        g.paused = false
        sPause()
      }
    }
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    // ---------- armas ----------
    const nearestEnemy = (maxD: number, skip = -1) => {
      let best: Enemy | null = null
      let bd = maxD * maxD
      for (let i = 0; i < MAXE; i++) {
        const e = E[i]
        if (!e.on || i === skip) continue
        const d = (e.x - g.px) ** 2 + (e.y - g.py) ** 2
        if (d < bd) {
          bd = d
          best = e
        }
      }
      return best
    }
    const newProj = () => {
      for (const p of P) if (!p.on) return p
      return null
    }
    const shoot = (kind: number, x: number, y: number, vx: number, vy: number, dmg: number, pierce: number, life: number, r: number, rehit = 0) => {
      const p = newProj()
      if (!p) return
      p.on = true
      p.kind = kind
      p.x = x
      p.y = y
      p.vx = vx
      p.vy = vy
      p.dmg = dmg
      p.pierce = pierce
      p.life = life
      p.r = r
      p.rehit = rehit
      p.rehitT = rehit
      p.nh = 0
      p.rot = Math.random() * 6
    }

    const fireWeapon = (w: WState, dt: number) => {
      const L = w.lvl - 1
      const cdv = WCD[w.id][L] * st.cool
      const dmg = W_DMG[w.id][L]
      switch (w.id) {
        case 'magic': {
          w.cd -= dt
          if (w.cd > 0) return
          const t = nearestEnemy(320)
          if (!t) {
            w.cd = 0.1
            return
          }
          w.cd = cdv
          const n = MAGIC_N[L]
          const base = Math.atan2(t.y - g.py, t.x - g.px)
          for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.22
            shoot(0, g.px, g.py - 4, Math.cos(a) * 230, Math.sin(a) * 230, dmg, MAGIC_PIERCE[L], 1.6, 4 * st.area)
          }
          sShoot()
          break
        }
        case 'knife': {
          w.cd -= dt
          if (w.cd > 0) return
          w.cd = cdv
          const n = KNIFE_N[L]
          const ang = Math.atan2(g.fy, g.fx)
          const nx = -Math.sin(ang)
          const ny = Math.cos(ang)
          for (let k = 0; k < n; k++) {
            const off = (k - (n - 1) / 2) * 7
            shoot(1, g.px + nx * off, g.py - 2 + ny * off, g.fx * 340, g.fy * 340, dmg, KNIFE_PIERCE[L], 1.0, 3.5 * st.area)
          }
          sShoot()
          break
        }
        case 'axe': {
          w.cd -= dt
          if (w.cd > 0) return
          w.cd = cdv
          const n = AXE_N[L]
          for (let k = 0; k < n; k++) {
            const vx = (k - (n - 1) / 2) * 55 + (Math.random() - 0.5) * 40 + g.fx * 20
            shoot(2, g.px, g.py - 6, vx, -260 - Math.random() * 40, dmg, 99, 2.2, 10 * st.area, 0.35)
          }
          sWhip()
          break
        }
        case 'whip': {
          w.cd -= dt
          if (w.cd > 0) return
          w.cd = cdv
          const reach = WHIP_REACH[L] * st.area
          const a0 = Math.atan2(g.fy, g.fx)
          const doSlash = (a: number) => {
            slashes.push({ x: g.px, y: g.py, a, reach, t: 0.2, life: 0.2, color: '#fb7185' })
            for (let i = 0; i < MAXE; i++) {
              const e = E[i]
              if (!e.on) continue
              const dx = e.x - g.px
              const dy = e.y - g.py
              const d = Math.hypot(dx, dy)
              if (d > reach + e.r) continue
              let da = Math.atan2(dy, dx) - a
              da = Math.atan2(Math.sin(da), Math.cos(da))
              if (Math.abs(da) < 1.0 || d < e.r + 10) hurtEnemy(e, dmg, dx / (d || 1), dy / (d || 1), 220)
            }
          }
          doSlash(a0)
          if (w.lvl >= 3) doSlash(a0 + Math.PI)
          sWhip()
          juice.shake(0.06)
          break
        }
        case 'aura': {
          w.cd -= dt
          if (w.cd > 0) return
          w.cd = cdv
          const R = AURA_R[L] * st.area
          for (let i = 0; i < MAXE; i++) {
            const e = E[i]
            if (!e.on) continue
            const dx = e.x - g.px
            const dy = e.y - g.py
            const d = Math.hypot(dx, dy)
            if (d < R + e.r) {
              if (w.lvl >= 4) e.slow = 0.7
              hurtEnemy(e, dmg, dx / (d || 1), dy / (d || 1), 40)
            }
          }
          break
        }
        case 'bolt': {
          w.cd -= dt
          if (w.cd > 0) return
          const n = BOLT_N[L]
          const cand: number[] = []
          for (let i = 0; i < MAXE; i++) {
            const e = E[i]
            if (e.on && Math.abs(e.x - g.px) < W / 2 - 10 && Math.abs(e.y - g.py) < H / 2 - 20) cand.push(i)
          }
          if (cand.length === 0) {
            w.cd = 0.25
            return
          }
          w.cd = cdv
          const R = BOLT_R[L] * st.area
          for (let k = 0; k < n && cand.length > 0; k++) {
            const ci = Math.floor(Math.random() * cand.length)
            const t = E[cand[ci]]
            cand.splice(ci, 1)
            bolts.push({ x: t.x, y: t.y, t: 0.28, seed: Math.random() * 100, r: R })
            juice.burst(t.x, t.y, ['#fde047', '#ffffff'], { count: 8, speed: 120, life: 0.35, size: 3 })
            for (let i = 0; i < MAXE; i++) {
              const e = E[i]
              if (!e.on) continue
              const dx = e.x - t.x
              const dy = e.y - t.y
              const d = Math.hypot(dx, dy)
              if (d < R + e.r) hurtEnemy(e, dmg, dx / (d || 1), dy / (d || 1), 120)
            }
          }
          juice.shake(0.18)
          sBolt()
          break
        }
        case 'orb': {
          const n = ORB_N[L]
          const R = ORB_R[L] * st.area
          for (let k = 0; k < n; k++) {
            const a = g.orbAng + (k / n) * Math.PI * 2
            const ox = g.px + Math.cos(a) * R
            const oy = g.py + Math.sin(a) * R * 0.9
            const c = near(ox, oy, 8 + 20)
            for (let q = 0; q < c; q++) {
              const e = E[scratch[q]]
              if (!e.on || g.time < e.orbT) continue
              const dx = e.x - ox
              const dy = e.y - oy
              const rr = 7 * st.area + e.r
              if (dx * dx + dy * dy < rr * rr) {
                e.orbT = g.time + 0.45
                const d = Math.hypot(dx, dy) || 1
                hurtEnemy(e, dmg, dx / d, dy / d, 200)
              }
            }
          }
          break
        }
      }
    }

    // ---------- actualización ----------
    const dirKeys = (pk: Set<string>) => {
      let dx = 0
      let dy = 0
      if (pk.has('left')) dx -= 1
      if (pk.has('right')) dx += 1
      if (pk.has('up')) dy -= 1
      if (pk.has('down')) dy += 1
      return [dx, dy] as const
    }

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      keyQueueRef.current.length = 0
      g.clock += rawDt
      g.guard = Math.max(0, g.guard - rawDt)
      const anyDir = jp.has('up') || jp.has('down') || jp.has('left') || jp.has('right')

      if (g.phase === 'menu') {
        if (jp.has('action') || anyDir) startRef.current()
        return
      }
      if (g.phase === 'over') {
        g.overT += rawDt
        juice.update(rawDt)
        if (jp.has('action') && g.overT > 0.6) startRef.current()
        return
      }
      if (g.choosing) {
        const n = 3
        if (jp.has('left') || jp.has('up')) {
          selRef.current = (selRef.current + n - 1) % n
          setSel(selRef.current)
        }
        if (jp.has('right') || jp.has('down')) {
          selRef.current = (selRef.current + 1) % n
          setSel(selRef.current)
        }
        if (jp.has('action') && g.guard <= 0) pickRef.current(selRef.current)
        return
      }
      if (g.phase === 'playing' && jp.has('pause')) {
        g.paused = !g.paused
        sPause()
      }
      if (g.paused) {
        if (jp.has('action')) {
          g.paused = false
          sPause()
        }
        return
      }

      const dt = juice.update(rawDt)

      if (g.phase === 'dying') {
        g.deadT += rawDt
        if (g.deadT > 1.2) finish()
        return
      }
      if (dt <= 0) return

      g.time += dt
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      g.xpPulse = Math.max(0, g.xpPulse - dt * 4)
      g.hurtT = Math.max(0, g.hurtT - dt)
      g.chainT -= dt
      if (g.chainT <= 0) g.chain = 0

      // amanecer: victoria
      if (g.time >= WIN_TIME) {
        g.win = true
        g.bonus += 1500
        juice.flash('#fde68a', 0.7)
        finish()
        return
      }

      // movimiento del jugador
      let [mx, my] = dirKeys(pressedRef.current)
      g.moving = mx !== 0 || my !== 0
      if (g.moving) {
        const l = Math.hypot(mx, my)
        mx /= l
        my /= l
        g.fx = mx
        g.fy = my
        if (mx !== 0) g.face = mx > 0 ? 1 : -1
        const sp = 96 * st.spd
        g.px += mx * sp * dt
        g.py += my * sp * dt
        g.walk += dt * 9
      }
      g.iframes = Math.max(0, g.iframes - dt)
      if (st.regen > 0) g.hp = Math.min(st.maxhp, g.hp + st.regen * dt)

      // generación de enemigos
      const t = g.time
      const target = Math.min(MAXE - 14, Math.round(10 + 0.45 * t + (t > 300 ? (t - 300) * 0.2 : 0)))
      g.spawnAcc += dt * (3 + t / 16)
      while (g.spawnAcc >= 1) {
        g.spawnAcc -= 1
        if (g.alive >= target) {
          g.spawnAcc = Math.min(g.spawnAcc, 2)
          break
        }
        const [x, y] = edgePoint(26)
        spawnEnemy(pickType(t), x, y)
      }
      if (t >= g.nextSwarm) {
        g.nextSwarm += 40
        const n = Math.min(40, 14 + Math.floor(t / 25))
        const side = Math.floor(Math.random() * 4)
        const horiz = side < 2
        const sgn = side % 2 === 0 ? -1 : 1
        for (let k = 0; k < n; k++) {
          const off = (k - n / 2) * 12
          const x = g.px + (horiz ? off : sgn * (W / 2 + 30 + (k % 3) * 8))
          const y = g.py + (horiz ? sgn * (H / 2 + 30 + (k % 3) * 8) : off * 1.4)
          spawnEnemy(4, x, y)
        }
        banner('¡ENJAMBRE!', '#fb7185')
        sBoss()
      }
      if (t >= g.nextBoss) {
        g.nextBoss += 150
        const [x, y] = edgePoint(40)
        const kind = (g.bossN % 3) + 1
        g.bossN++
        const e = spawnEnemy(6, x, y, kind)
        if (e) {
          banner(`¡JEFE: ${BOSS_NAMES[kind - 1]}!`, BOSS_COLORS[kind - 1])
          juice.shake(0.5)
          sBoss()
        }
      }

      // enemigos
      for (let i = 0; i < MAXE; i++) {
        const e = E[i]
        if (!e.on) continue
        const dx = g.px - e.x
        const dy = g.py - e.y
        const d = Math.hypot(dx, dy) || 1
        let ux = dx / d
        let uy = dy / d
        let sp = e.sp * (e.slow > 0 ? 0.5 : 1)
        if (e.type === 0 || e.type === 4) {
          const w = Math.sin(g.clock * 5 + e.ph) * (e.type === 0 ? 0.7 : 0.25)
          const tx = ux
          ux = ux - uy * w
          uy = uy + tx * w
        }
        if (e.boss) {
          e.stT -= dt
          if (e.st === 0 && e.stT <= 0) {
            e.st = 1
            e.stT = 0.6
            e.dx = ux
            e.dy = uy
          } else if (e.st === 1) {
            sp = 0
            e.dx = ux
            e.dy = uy
            if (e.stT <= 0) {
              e.st = 2
              e.stT = 0.55
            }
          } else if (e.st === 2) {
            ux = e.dx
            uy = e.dy
            sp = 260
            if (e.stT <= 0) {
              e.st = 0
              e.stT = 3.2
            }
          }
        }
        e.x += (ux * sp + e.kx) * dt
        e.y += (uy * sp + e.ky) * dt
        const kd = Math.max(0, 1 - 9 * dt)
        e.kx *= kd
        e.ky *= kd
        e.flash -= dt
        e.slow -= dt
        if (d > 540 && !e.boss) {
          const [x, y] = edgePoint(26)
          e.x = x
          e.y = y
        }
      }
      buildGrid()
      // separación suave entre enemigos
      for (let i = 0; i < MAXE; i++) {
        const e = E[i]
        if (!e.on || e.type === 3) continue
        const cx = Math.floor(e.x / CELL)
        const cy = Math.floor(e.y / CELL)
        for (let yy = cy - 1; yy <= cy + 1; yy++) {
          for (let xx = cx - 1; xx <= cx + 1; xx++) {
            let j = head[cellIdx(xx, yy)]
            while (j >= 0) {
              if (j > i) {
                const o = E[j]
                if (o.type !== 3) {
                  const dx = o.x - e.x
                  const dy = o.y - e.y
                  const rr = (e.r + o.r) * 0.8
                  const d2 = dx * dx + dy * dy
                  if (d2 < rr * rr && d2 > 0.0001) {
                    const d = Math.sqrt(d2)
                    const push = ((rr - d) * 0.5 * Math.min(1, dt * 12)) / d
                    const we = o.boss ? 0.1 : e.boss ? 1.9 : 1
                    const wo = e.boss ? 0.1 : o.boss ? 1.9 : 1
                    e.x -= dx * push * we
                    e.y -= dy * push * we
                    o.x += dx * push * wo
                    o.y += dy * push * wo
                  }
                }
              }
              j = nxt[j]
            }
          }
        }
      }

      // armas
      g.orbAng += dt * (g.weapons.find((w) => w.id === 'orb') ? ORB_SPD[g.weapons.find((w) => w.id === 'orb')!.lvl - 1] : 0)
      for (const w of g.weapons) fireWeapon(w, dt)

      // proyectiles
      for (const p of P) {
        if (!p.on) continue
        if (p.kind === 2) {
          p.vy += 430 * dt
          p.rot += dt * 14
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
        if (p.life <= 0 || Math.abs(p.x - g.px) > 420 || Math.abs(p.y - g.py) > 520) {
          p.on = false
          continue
        }
        if (p.rehit > 0) {
          p.rehitT -= dt
          if (p.rehitT <= 0) {
            p.nh = 0
            p.rehitT = p.rehit
          }
        }
        const n = near(p.x, p.y, p.r + 20)
        for (let q = 0; q < n; q++) {
          const e = E[scratch[q]]
          if (!e.on) continue
          const dx = e.x - p.x
          const dy = e.y - p.y
          const rr = p.r + e.r
          if (dx * dx + dy * dy > rr * rr) continue
          let seen = false
          const cnt = Math.min(p.nh, 8)
          for (let h = 0; h < cnt; h++) if (p.hits[h] === e.id) seen = true
          if (seen) continue
          p.hits[p.nh % 8] = e.id
          p.nh++
          const sp = Math.hypot(p.vx, p.vy) || 1
          hurtEnemy(e, p.dmg, p.vx / sp, p.vy / sp, p.kind === 2 ? 90 : 160)
          if (p.kind === 0) juice.burst(p.x, p.y, ['#e9d5ff', '#c084fc'], { count: 4, speed: 70, life: 0.25, size: 2 })
          if (p.kind !== 2) {
            if (p.pierce-- <= 0) {
              p.on = false
              break
            }
          }
        }
      }

      // contacto con el jugador
      if (g.iframes <= 0 && g.phase === 'playing') {
        const n = near(g.px, g.py, 26)
        let worst = 0
        for (let q = 0; q < n; q++) {
          const e = E[scratch[q]]
          if (!e.on) continue
          const dx = e.x - g.px
          const dy = e.y - g.py
          const rr = 5 + e.r * 0.85
          if (dx * dx + dy * dy < rr * rr && e.dmg > worst) worst = e.dmg
        }
        if (worst > 0) hurtPlayer(worst)
      }

      // gemas y objetos
      for (const it of IT) {
        if (!it.on) continue
        it.ph += dt
        const dx = g.px - it.x
        const dy = g.py - it.y
        const d = Math.hypot(dx, dy) || 1
        if (it.type === 4) {
          if (d < 20) {
            it.on = false
            openChoice('chest')
          }
          continue
        }
        if (it.state === 0 && d < st.mag) it.state = 1
        if (it.state === 1) {
          it.sp = Math.min(520, it.sp + 800 * dt)
          const m = Math.min(d, it.sp * dt)
          it.x += (dx / d) * m
          it.y += (dy / d) * m
        }
        if (d < 8) {
          it.on = false
          if (it.type === 3) {
            g.hp = Math.min(st.maxhp, g.hp + st.maxhp * 0.25)
            juice.text(g.px, g.py - 16, '+VIDA', '#4ade80', 8, 0.8)
            sHeal()
          } else {
            g.chain++
            g.chainT = 0.35
            gainXp(it.val)
            sGem(g.chain)
          }
        }
      }

      // efectos
      for (const s of slashes) s.t -= dt
      slashes = slashes.filter((s) => s.t > 0)
      for (const b of bolts) b.t -= dt
      bolts = bolts.filter((b) => b.t > 0)

      // subir de nivel
      if (g.pending > 0 && !g.choosing && g.phase === 'playing') openChoice('level')

      // cámara
      const k = Math.min(1, rawDt * 9)
      g.camx += (g.px - W / 2 - g.camx) * k
      g.camy += (g.py - H / 2 - g.camy) * k

      // HUD de React (limitado)
      g.hudT -= rawDt
      if (g.hudT <= 0) {
        g.hudT = 0.25
        setHud({ score: score(), level: g.level })
      }
    }

    // ---------- dibujo ----------
    const drawDeco = (camx: number, camy: number) => {
      const S = 80
      const cx0 = Math.floor(camx / S) - 1
      const cy0 = Math.floor(camy / S) - 1
      const nx = Math.ceil(W / S) + 3
      const ny = Math.ceil(H / S) + 3
      for (let cy = cy0; cy < cy0 + ny; cy++) {
        for (let cx = cx0; cx < cx0 + nx; cx++) {
          const h = hash2(cx, cy, 7)
          if (h > 0.34) continue
          const x = Math.round(cx * S + 10 + hash2(cx, cy, 1) * (S - 20) - camx)
          const y = Math.round(cy * S + 14 + hash2(cx, cy, 2) * (S - 28) - camy)
          if (cx === -1 && cy === -1) continue
          if (h < 0.1) {
            // lápida
            ctx.fillStyle = 'rgba(0,0,0,0.3)'
            ctx.fillRect(x - 6, y + 8, 14, 3)
            ctx.fillStyle = '#6b6280'
            ctx.fillRect(x - 5, y - 6, 10, 14)
            ctx.fillRect(x - 4, y - 8, 8, 2)
            ctx.fillStyle = '#8a82a0'
            ctx.fillRect(x - 5, y - 6, 2, 14)
            ctx.fillStyle = '#3b3350'
            ctx.fillRect(x - 1, y - 4, 2, 7)
            ctx.fillRect(x - 3, y - 2, 6, 2)
          } else if (h < 0.17) {
            // árbol seco
            ctx.fillStyle = 'rgba(0,0,0,0.3)'
            ctx.fillRect(x - 7, y + 10, 16, 3)
            ctx.fillStyle = '#2b1d22'
            ctx.fillRect(x - 2, y - 14, 5, 25)
            ctx.fillRect(x - 9, y - 12, 8, 2)
            ctx.fillRect(x - 11, y - 16, 2, 5)
            ctx.fillRect(x + 3, y - 8, 9, 2)
            ctx.fillRect(x + 10, y - 13, 2, 6)
            ctx.fillRect(x - 5, y - 20, 2, 7)
            ctx.fillStyle = '#3d2a30'
            ctx.fillRect(x - 2, y - 14, 2, 25)
          } else if (h < 0.2) {
            // antorcha
            const fl = Math.sin(g.clock * 12 + cx * 3) > 0 ? 1 : 0
            ctx.globalAlpha = 0.55 + fl * 0.15
            ctx.drawImage(spr.glow, x - 40, y - 52, 80, 80)
            ctx.globalAlpha = 1
            ctx.fillStyle = '#4a3320'
            ctx.fillRect(x - 1, y - 8, 3, 18)
            ctx.fillStyle = '#6b4a2a'
            ctx.fillRect(x - 2, y - 10, 5, 3)
            ctx.fillStyle = '#f97316'
            ctx.fillRect(x - 2, y - 17 - fl, 5, 7 + fl)
            ctx.fillStyle = '#fde047'
            ctx.fillRect(x - 1, y - 15 - fl, 3, 5)
          } else if (h < 0.27) {
            // huesos
            ctx.fillStyle = '#c9c3d6'
            ctx.fillRect(x - 5, y, 8, 2)
            ctx.fillRect(x - 6, y - 1, 2, 4)
            ctx.fillRect(x + 2, y - 1, 2, 4)
            ctx.fillRect(x - 1, y + 4, 6, 1)
          } else {
            // roca
            ctx.fillStyle = 'rgba(0,0,0,0.25)'
            ctx.fillRect(x - 6, y + 4, 14, 3)
            ctx.fillStyle = '#3a3050'
            ctx.fillRect(x - 5, y - 3, 11, 8)
            ctx.fillStyle = '#4b3f68'
            ctx.fillRect(x - 5, y - 3, 11, 2)
            ctx.fillRect(x - 3, y - 5, 6, 2)
          }
        }
      }
    }

    const drawEnemy = (e: Enemy, camx: number, camy: number) => {
      const s = e.boss ? spr.boss[e.boss - 1] : spr.enemy[e.type]
      const fr = Math.floor(g.clock * (e.type === 0 || e.type === 4 ? 9 : 4) + e.ph) & 1
      const sx = Math.round(e.x - camx)
      const sy = Math.round(e.y - camy)
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return
      let white = e.flash > 0
      if (e.boss && e.st === 1 && Math.floor(g.clock * 16) % 2 === 0) white = true
      const img = white ? s.w[fr] : s.n[fr]
      if (e.type !== 3 && e.type !== 0 && e.type !== 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)'
        ctx.fillRect(sx - s.lw * 0.35, sy + s.lh / 2 - 2, s.lw * 0.7, 3)
      }
      let oy = 0
      if (e.type === 0 || e.type === 4) oy = Math.sin(g.clock * 6 + e.ph) * 2
      if (e.type === 3) {
        oy = Math.sin(g.clock * 3 + e.ph) * 2
        ctx.globalAlpha = 0.68
      }
      ctx.drawImage(img, sx - s.lw / 2, sy - s.lh / 2 + oy, s.lw, s.lh)
      if (e.type === 3) ctx.globalAlpha = 1
    }

    const drawGem = (it: Item, camx: number, camy: number) => {
      const x = Math.round(it.x - camx)
      const y = Math.round(it.y - camy)
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return
      if (it.type === 4) {
        const bob = Math.round(Math.sin(it.ph * 3) * 2)
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(it.ph * 4)
        ctx.drawImage(spr.glow, x - 26, y - 30 + bob, 52, 52)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#5b3a12'
        ctx.fillRect(x - 9, y - 6 + bob, 18, 13)
        ctx.fillStyle = '#d99a2b'
        ctx.fillRect(x - 8, y - 5 + bob, 16, 5)
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(x - 8, y - 5 + bob, 16, 2)
        ctx.fillStyle = '#8a5a1a'
        ctx.fillRect(x - 8, y + bob, 16, 6)
        ctx.fillStyle = '#fde047'
        ctx.fillRect(x - 2, y - 2 + bob, 4, 5)
        return
      }
      if (it.type === 3) {
        ctx.fillStyle = '#7f1d1d'
        ctx.fillRect(x - 3, y - 2, 7, 7)
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(x - 2, y - 1, 5, 5)
        ctx.fillStyle = '#d6b88a'
        ctx.fillRect(x - 1, y - 5, 3, 3)
        ctx.fillStyle = '#fecaca'
        ctx.fillRect(x - 1, y, 1, 2)
        return
      }
      const a = it.type === 2 ? 1.9 : it.type === 1 ? 1.4 : 1
      const col = it.type === 2 ? '#f472b6' : it.type === 1 ? '#4ade80' : '#38bdf8'
      ctx.fillStyle = col
      ctx.fillRect(x - a, y - 2 * a, 2 * a, 4 * a)
      ctx.fillRect(x - 2 * a, y - a, 4 * a, 2 * a)
      const tw = Math.sin(it.ph * 6) > 0.6
      ctx.fillStyle = tw ? '#ffffff' : 'rgba(255,255,255,0.7)'
      ctx.fillRect(x - a * 0.6, y - a * 0.9, a * 0.8, a * 0.8)
    }

    const drawOffscreenArrow = (wx: number, wy: number, color: string) => {
      const dx = wx - g.px
      const dy = wy - g.py
      if (Math.abs(dx) < W / 2 - 6 && Math.abs(dy) < H / 2 - 6) return
      const k = Math.min((W / 2 - 16) / Math.abs(dx || 1e-6), (H / 2 - 28) / Math.abs(dy || 1e-6))
      const ax = W / 2 + dx * k
      const ay = H / 2 + dy * k
      const a = Math.atan2(dy, dx)
      ctx.save()
      ctx.translate(Math.round(ax), Math.round(ay))
      ctx.rotate(a)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.lineTo(-5, -6)
      ctx.lineTo(-5, 6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const text = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') => {
      ctx.font = `${size}px ${pf}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.fillText(s, x + 1.5, y + 1.5)
      ctx.fillStyle = color
      ctx.fillText(s, x, y)
    }

    const draw = () => {
      const camx = Math.round(g.camx)
      const camy = Math.round(g.camy)
      ctx.save()
      juice.applyShake(ctx)
      // suelo
      ctx.fillStyle = '#171123'
      ctx.fillRect(-10, -10, W + 20, H + 20)
      const ox = -(((camx % FLOOR) + FLOOR) % FLOOR)
      const oy = -(((camy % FLOOR) + FLOOR) % FLOOR)
      for (let yy = oy; yy < H; yy += FLOOR) for (let xx = ox; xx < W; xx += FLOOR) ctx.drawImage(spr.floor, xx, yy, FLOOR, FLOOR)
      drawDeco(camx, camy)

      // objetos
      for (const it of IT) if (it.on) drawGem(it, camx, camy)

      // aura
      const aura = g.weapons.find((w) => w.id === 'aura')
      if (aura && g.phase !== 'menu') {
        const R = AURA_R[aura.lvl - 1] * st.area
        const sx = Math.round(g.px - camx)
        const sy = Math.round(g.py - camy)
        const pulse = 0.5 + 0.5 * Math.sin(g.clock * 5)
        ctx.fillStyle = `rgba(103,232,249,${0.07 + pulse * 0.04})`
        ctx.beginPath()
        ctx.arc(sx, sy, R, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = `rgba(165,243,252,${0.35 + pulse * 0.25})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(sx, sy, R, 0, Math.PI * 2)
        ctx.stroke()
      }

      // enemigos (los fantasmas por encima)
      for (const e of E) if (e.on && e.type !== 3) drawEnemy(e, camx, camy)
      for (const e of E) if (e.on && e.type === 3) drawEnemy(e, camx, camy)

      // jugador
      {
        const sx = Math.round(g.px - camx)
        const sy = Math.round(g.py - camy)
        const blink = g.iframes > 0 && Math.floor(g.clock * 20) % 2 === 0 && g.phase === 'playing'
        if (g.phase !== 'dying' && !blink) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          ctx.fillRect(sx - 6, sy + 8, 12, 3)
          const fr = g.moving ? Math.floor(g.walk) & 1 : 0
          const bob = g.moving && fr === 1 ? -1 : 0
          const img = g.hurtT > 0.18 ? spr.player.w[fr] : spr.player.n[fr]
          ctx.save()
          ctx.translate(sx, sy + bob)
          ctx.scale(g.face, 1)
          ctx.drawImage(img, -spr.player.lw / 2, -spr.player.lh / 2, spr.player.lw, spr.player.lh)
          ctx.restore()
        }
        if (g.phase === 'playing') {
          // barra de vida bajo el jugador
          const bw = 22
          ctx.fillStyle = '#000000'
          ctx.fillRect(sx - bw / 2 - 1, sy + 12, bw + 2, 5)
          ctx.fillStyle = '#4c0519'
          ctx.fillRect(sx - bw / 2, sy + 13, bw, 3)
          const f = clamp(g.hp / st.maxhp, 0, 1)
          ctx.fillStyle = f > 0.35 ? '#4ade80' : '#ef4444'
          ctx.fillRect(sx - bw / 2, sy + 13, Math.round(bw * f), 3)
        }
      }

      // látigos
      for (const s of slashes) {
        const k = s.t / s.life
        const sx = g.px - camx
        const sy = g.py - camy
        ctx.globalAlpha = Math.min(1, k * 1.6)
        ctx.strokeStyle = '#fecdd3'
        ctx.lineWidth = 8 * k + 2
        ctx.beginPath()
        ctx.arc(sx, sy, s.reach * (0.65 + 0.35 * (1 - k)), s.a - 0.95, s.a + 0.95)
        ctx.stroke()
        ctx.strokeStyle = s.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(sx, sy, s.reach * (0.65 + 0.35 * (1 - k)), s.a - 0.95, s.a + 0.95)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // proyectiles
      for (const p of P) {
        if (!p.on) continue
        const x = Math.round(p.x - camx)
        const y = Math.round(p.y - camy)
        if (p.kind === 0) {
          ctx.fillStyle = 'rgba(168,85,247,0.55)'
          ctx.fillRect(x - 5, y - 5, 10, 10)
          ctx.fillStyle = '#e9d5ff'
          ctx.fillRect(x - 3, y - 3, 6, 6)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(x - 1, y - 1, 2, 2)
        } else if (p.kind === 1) {
          const a = Math.atan2(p.vy, p.vx)
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(a)
          ctx.fillStyle = '#9ca3af'
          ctx.fillRect(-6, -1, 5, 2)
          ctx.fillStyle = '#f3f4f6'
          ctx.fillRect(-1, -2, 8, 4)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(5, -1, 3, 2)
          ctx.restore()
        } else {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(p.rot)
          ctx.fillStyle = '#7c4a1d'
          ctx.fillRect(-1, -9, 3, 18)
          ctx.fillStyle = '#d1d5db'
          ctx.fillRect(1, -9, 8, 8)
          ctx.fillStyle = '#fbbf24'
          ctx.fillRect(1, -9, 8, 2)
          ctx.fillRect(7, -9, 2, 8)
          ctx.restore()
        }
      }

      // orbes
      const orb = g.weapons.find((w) => w.id === 'orb')
      if (orb && g.phase !== 'menu') {
        const n = ORB_N[orb.lvl - 1]
        const R = ORB_R[orb.lvl - 1] * st.area
        for (let k = 0; k < n; k++) {
          const a = g.orbAng + (k / n) * Math.PI * 2
          const x = Math.round(g.px - camx + Math.cos(a) * R)
          const y = Math.round(g.py - camy + Math.sin(a) * R * 0.9)
          ctx.fillStyle = 'rgba(74,222,128,0.35)'
          ctx.fillRect(x - 8, y - 8, 16, 16)
          ctx.fillStyle = '#86efac'
          ctx.fillRect(x - 5, y - 5, 10, 10)
          ctx.fillStyle = '#16a34a'
          ctx.fillRect(x - 3, y - 3, 6, 6)
          ctx.fillStyle = '#f0fdf4'
          ctx.fillRect(x - 4, y - 4, 3, 3)
        }
      }

      // rayos
      for (const b of bolts) {
        const k = b.t / 0.28
        const x = b.x - camx
        const y = b.y - camy
        ctx.globalAlpha = k
        ctx.fillStyle = 'rgba(253,224,71,0.3)'
        ctx.beginPath()
        ctx.arc(x, y, b.r * (1.3 - k * 0.4), 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fef9c3'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x, y)
        let cx = x
        let cy = y
        for (let s = 1; s <= 8; s++) {
          cy = y - s * 40
          cx = x + (hash(b.seed + s) - 0.5) * 28 * (s < 8 ? 1 : 0.2)
          ctx.lineTo(cx, cy)
        }
        ctx.stroke()
        ctx.strokeStyle = '#fde047'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // partículas y números (coordenadas del mundo)
      ctx.save()
      ctx.translate(-camx, -camy)
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()

      ctx.drawImage(spr.vignette, 0, 0, W, H)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.phase === 'menu') return

      // indicadores fuera de pantalla
      for (const e of E) if (e.on && e.boss) drawOffscreenArrow(e.x, e.y, BOSS_COLORS[e.boss - 1])
      for (const it of IT) if (it.on && it.type === 4) drawOffscreenArrow(it.x, it.y, '#fde047')

      // barra de XP
      const need = needXp(g.level)
      ctx.fillStyle = '#0d0818'
      ctx.fillRect(0, 0, W, 12)
      ctx.fillStyle = g.xpPulse > 0 ? '#e9d5ff' : '#a855f7'
      ctx.fillRect(0, 0, Math.round((W * g.xp) / need), 12)
      ctx.fillStyle = '#581c87'
      ctx.fillRect(0, 11, W, 1)
      text(`NV ${g.level}`, 6, 6.5, 7, '#ffffff', 'left')

      // temporizador y bajas
      text(fmtTime(g.time), W / 2, 32, 18, '#ffffff')
      text(`${g.kills}`, W - 8, 30, 9, '#fda4af', 'right')
      text('BAJAS', W - 8, 42, 6, 'rgba(255,255,255,0.6)', 'right')

      // barra del jefe
      const boss = E.find((e) => e.on && e.boss > 0)
      if (boss) {
        const bw = 190
        const bx = (W - bw) / 2
        ctx.fillStyle = '#000'
        ctx.fillRect(bx - 1, 52, bw + 2, 9)
        ctx.fillStyle = '#3b0a14'
        ctx.fillRect(bx, 53, bw, 7)
        ctx.fillStyle = BOSS_COLORS[boss.boss - 1]
        ctx.fillRect(bx, 53, Math.round(bw * clamp(boss.hp / boss.mhp, 0, 1)), 7)
        text(BOSS_NAMES[boss.boss - 1], W / 2, 70, 6, '#ffffff')
      }

      // armas y pasivos
      for (let i = 0; i < g.weapons.length; i++) {
        const w = g.weapons[i]
        const d = WDEFS.find((x) => x.id === w.id)
        if (!d) continue
        const x = 6 + i * 20
        const y = H - 24
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(x, y, 17, 17)
        ctx.fillStyle = d.color
        ctx.fillRect(x + 3, y + 2, 11, 8)
        for (let k = 0; k < MAX_LVL; k++) {
          ctx.fillStyle = k < w.lvl ? '#ffffff' : 'rgba(255,255,255,0.2)'
          ctx.fillRect(x + 2 + k * 3, y + 13, 2, 2)
        }
      }
      let pi = 0
      for (const d of PDEFS) {
        const l = g.pass[d.id]
        if (l <= 0) continue
        const x = W - 6 - (pi + 1) * 12
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(x, H - 20, 10, 13)
        ctx.fillStyle = d.color
        ctx.fillRect(x + 2, H - 18, 6, 5)
        ctx.fillStyle = '#fff'
        ctx.fillRect(x + 1, H - 11, Math.min(8, l * 2 - 1), 2)
        pi++
      }

      // cartela
      if (g.banner) {
        const k = g.banner.t
        ctx.globalAlpha = Math.min(1, k * 2, (2.2 - k) * 4)
        text(g.banner.text, W / 2, 118, 12, g.banner.color)
        ctx.globalAlpha = 1
      }

      if (g.paused) {
        ctx.fillStyle = 'rgba(6,6,12,0.72)'
        ctx.fillRect(0, 0, W, H)
        text('PAUSA', W / 2, H / 2 - 14, 24, ACCENT)
        text('Pulsa P o toca para seguir', W / 2, H / 2 + 22, 8, 'rgba(255,255,255,0.8)')
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      update(dt)
      justPressedRef.current.clear()
      if (g.phase === 'menu') {
        g.camx = -W / 2
        g.camy = -H / 2
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    reset()
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#c084fc]/40 bg-[#171123] shadow-[0_0_30px_rgba(192,132,252,0.18)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PUNTOS {hud.score.toLocaleString('es-MX')}</span>
            <span className="text-white/60">RECORD {Math.max(best, hud.score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Horda Nocturna"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="HORDA NOCTURNA"
            accent={ACCENT}
            subtitle="Sobrevive 10 minutos hasta el amanecer. Tus armas atacan solas: tú solo esquiva, recoge gemas y elige mejoras."
            hint="Espacio o una flecha para empezar. Muévete con flechas o WASD."
            touchHint="Toca Jugar. Muévete con la cruceta."
            onStart={() => startRef.current()}
          />
        )}
        {choice && ui === 'playing' && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3"
            style={{ background: 'radial-gradient(circle at 50% 40%, rgba(192,132,252,0.16), transparent 70%), rgba(6,6,12,0.84)' }}
          >
            <p
              className="mb-1 text-sm sm:text-lg"
              style={{ fontFamily: 'var(--font-pixel)', color: choice.title === 'COFRE' ? '#fde047' : ACCENT, textShadow: '3px 3px 0 #000' }}
            >
              {choice.title === 'COFRE' ? 'COFRE: ELIGE UNA MEJORA' : `¡${choice.title}!`}
            </p>
            {choice.cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  pickRef.current(i)
                }}
                onMouseEnter={() => {
                  selRef.current = i
                  setSel(i)
                }}
                className="flex w-full max-w-[19rem] items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition active:scale-[0.98]"
                style={{
                  borderColor: sel === i ? c.color : 'rgba(255,255,255,0.14)',
                  background: sel === i ? `${c.color}26` : 'rgba(255,255,255,0.05)',
                  boxShadow: sel === i ? `0 0 16px ${c.color}55` : 'none',
                }}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-base font-bold text-black"
                  style={{ background: c.color, fontFamily: 'var(--font-pixel)' }}
                >
                  {c.kind === 'heal' ? '+' : c.kind === 'gold' ? '$' : c.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{c.name}</span>
                    {c.kind === 'w' || c.kind === 'p' ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold text-black"
                        style={{ background: c.isNew ? '#fde047' : c.color, fontFamily: 'var(--font-pixel)' }}
                      >
                        {c.isNew ? 'NUEVA' : `NV ${c.lvl}`}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-white/70">{c.desc}</span>
                </span>
              </button>
            ))}
            <p className="mt-1 text-[10px] text-white/50">Elige con flechas y Espacio, o toca una carta</p>
          </div>
        )}
        {ui === 'over' && (
          <GameOverOverlay
            title={result.won ? '¡AMANECER!' : 'TE ALCANZARON'}
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Tiempo', value: fmtTime(result.time) },
              { label: 'Bajas', value: result.kills },
              { label: 'Nivel', value: result.level },
              { label: 'Puntos', value: `bajas×10 + seg×5 + nivel×100${result.bonus > 0 ? ` + ${result.bonus}` : ''}` },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
      <TouchPad onPress={virtualPress} onRelease={virtualRelease} />
    </div>
  )
}
