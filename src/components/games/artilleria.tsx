'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { rr, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const ACCENT = '#84cc16'
const BLUE = '#60a5fa'
const PINK = '#f472b6'
const LEVEL_NAMES = ['Fácil', 'Normal', 'Difícil']

// Vista lógica: fitStage la ajusta a la pantalla. El mundo es más grande y la cámara lo recorre.
const W0 = 640
const H0 = 400
let W = W0
let H = H0
const WW = 900
const WH = 800
const TC = 2 // px de mundo por celda del terreno
const TW = WW / TC
const TH = WH / TC
const TANK_X: [number, number] = [150, 750]
const TANK_HP = 100
const FUEL_TURN = 90
const MOVE_SPEED = 64
const G = 420
const TANK_G = 900
const WIND_MAX = 50
const SHOT_V = 6.2
const PULL_MAX = 150

/** Ajusta la vista al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

type Phase = 'menu' | 'aim' | 'fly' | 'settle' | 'win' | 'over'
type Level = 0 | 1 | 2
interface Cfg {
  cpu: boolean
  level: Level
}

interface Weapon {
  name: string
  label: string
  color: string
  ammo: number
  /** Radio de daño a tanques. */
  r: number
  dmg: number
  crater: number
  big?: boolean
}

const WEAPONS: Weapon[] = [
  { name: 'BALA', label: 'Bala', color: '#ffffff', ammo: Infinity, r: 16, dmg: 34, crater: 16 },
  { name: 'TRIPLE', label: 'Triple', color: '#fde047', ammo: 3, r: 13, dmg: 24, crater: 13 },
  { name: 'BOMBA', label: 'Bomba grande', color: '#fb923c', ammo: 2, r: 40, dmg: 60, crater: 42, big: true },
  { name: 'PERFO', label: 'Perforadora', color: '#67e8f9', ammo: 2, r: 20, dmg: 40, crater: 20 },
  { name: 'REBOTE', label: 'Rebotadora', color: '#86efac', ammo: 3, r: 18, dmg: 40, crater: 16 },
]

const freshAmmo = () => WEAPONS.map((w) => w.ammo)

interface Tank {
  index: number
  x: number
  /** Contacto con el suelo (base del tanque). */
  y: number
  dir: number
  hp: number
  falling: boolean
  vy: number
  fy0: number
  flash: number
}
interface Shell {
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  w: number
  owner: number
  pen: number
  bounces: number
  age: number
  /** Nació dentro de la roca (cañón contra una pendiente): no explota hasta salir. */
  ghost: boolean
  trail: { x: number; y: number }[]
}
interface Ring {
  x: number
  y: number
  t: number
  life: number
  r: number
  col: string
}
interface CpuState {
  stage: 'walk' | 'think' | 'aim'
  t: number
  tx: number
  delay: number
  plan: { a: number; p: number; w: number } | null
  hold: number
}
interface Game {
  cfg: Cfg
  phase: Phase
  paused: boolean
  t: number
  tanks: [Tank, Tank]
  cur: number
  turns: number
  wind: number
  fuel: number
  angle: number
  power: number
  angA: [number, number]
  powA: [number, number]
  sel: [number, number]
  ammo: number[][]
  shells: Shell[]
  rings: Ring[]
  clouds: { x: number; y: number; s: number }[]
  streaks: { x: number; y: number }[]
  dealt: [number, number]
  winner: number
  winT: number
  overT: number
  settleT: number
  banner: number
  focus: { x: number; y: number } | null
  focusT: number
  follow: boolean
  drag: { x: number; y: number } | null
  cpu: CpuState | null
  stepAcc: number
}

interface Ui {
  phase: 'menu' | 'play' | 'over'
  cfg: Cfg
  cur: number
  names: [string, string]
  hp: [number, number]
  wind: number
  angle: number
  power: number
  fuel: number
  canAct: boolean
  wLabel: string
  winner: number
  dealt: number
  turns: number
}

const INITIAL_UI: Ui = {
  phase: 'menu',
  cfg: { cpu: true, level: 1 },
  cur: 0,
  names: ['AZUL', 'CPU'],
  hp: [TANK_HP, TANK_HP],
  wind: 0,
  angle: 45,
  power: 55,
  fuel: 100,
  canAct: false,
  wLabel: 'Bala ∞',
  winner: -1,
  dealt: 0,
  turns: 0,
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const hash2 = (a: number, b: number) => hash(a * 157.3 + b * 91.7)

// Sonidos
const sShot = () => {
  noise({ dur: 0.1, vol: 0.05, freq: 2400 })
  tone({ freq: 480, to: 150, dur: 0.16, type: 'sawtooth', vol: 0.045 })
}
const sBoom = (big: boolean) => {
  noise({ dur: big ? 0.7 : 0.4, vol: big ? 0.16 : 0.11, freq: big ? 500 : 800 })
  tone({ freq: big ? 80 : 120, to: 28, dur: big ? 0.6 : 0.35, type: 'triangle', vol: big ? 0.1 : 0.07 })
}
const sBounce = () => tone({ freq: 360, to: 220, dur: 0.07, type: 'triangle', vol: 0.05 })
const sStep = () => tone({ freq: 150, to: 110, dur: 0.03, type: 'square', vol: 0.012 })
const sTick = () => tone({ freq: 660, dur: 0.05, type: 'square', vol: 0.035 })
const sTurn = (p: number) => {
  tone({ freq: p === 0 ? 523 : 392, dur: 0.1, vol: 0.04 })
  tone({ freq: p === 0 ? 784 : 587, dur: 0.14, vol: 0.04, delay: 0.1 })
}
const sThud = () => noise({ dur: 0.15, vol: 0.06, freq: 400 })
const sHurt = () => tone({ freq: 220, to: 90, dur: 0.25, vol: 0.05, type: 'sawtooth' })
const sWin = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.05, delay: i * 0.11 }))
const sLose = () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.05, delay: i * 0.15 }))

export default function Artilleria() {
  const { justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(c: Cfg) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const cmdRef = useRef<string[]>([])
  const holdRef = useRef({ left: false, right: false })
  const [ui, setUi] = useState<Ui>(INITIAL_UI)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const tcv = document.createElement('canvas')
    tcv.width = TW
    tcv.height = TH
    const tctx = tcv.getContext('2d')
    if (!tctx) return
    const timg = tctx.createImageData(TW, TH)
    const solid = new Uint8Array(TW * TH)
    const juice = new Juice(10)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    const cmds = cmdRef.current
    const hold = holdRef.current
    const held = new Set<string>()
    let lastCfg: Cfg = { cpu: true, level: 1 }
    let camX = 0
    let camY = 0
    let dragId: number | null = null
    let dragLen = 0
    let dragMoved = false
    let downX = 0
    let downY = 0
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let lastKey = ''

    // ---------- terreno: máscara de celdas que las explosiones destruyen ----------
    const paint = (c0: number, r0: number, c1: number, r1: number) => {
      const d = timg.data
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * TW + c
          const o = i * 4
          if (!solid[i]) {
            d[o + 3] = 0
            continue
          }
          let up = 0
          while (up < 6 && r - up - 1 >= 0 && solid[(r - up - 1) * TW + c]) up++
          const k = hash2(c, r)
          let R: number
          let Gc: number
          let B: number
          if (up === 0) {
            R = 98 + k * 26
            Gc = 190 + k * 34
            B = 64 + k * 16
          } else if (up < 3) {
            R = 74 + k * 18
            Gc = 150 + k * 22
            B = 52 + k * 12
          } else {
            const sh = r > 330 ? 0.8 : r > 300 ? 0.9 : 1
            R = (134 + k * 24) * sh
            Gc = (90 + k * 16) * sh
            B = (54 + k * 10) * sh
            if (k > 0.94) {
              R = 112
              Gc = 112
              B = 120
            }
          }
          d[o] = R
          d[o + 1] = Gc
          d[o + 2] = B
          d[o + 3] = 255
        }
      }
      tctx.putImageData(timg, 0, 0, c0, r0, c1 - c0 + 1, r1 - r0 + 1)
    }

    const genTerrain = () => {
      const base = TH * 0.75
      const p1 = Math.random() * 6.28
      const p2 = Math.random() * 6.28
      const p3 = Math.random() * 6.28
      const f1 = 0.02 + Math.random() * 0.014
      const f2 = 0.05 + Math.random() * 0.03
      const f3 = 0.12 + Math.random() * 0.06
      const a1 = 20 + Math.random() * 10
      const a2 = 8 + Math.random() * 6
      const a3 = 2 + Math.random() * 3
      for (let c = 0; c < TW; c++) {
        let h = base - (Math.sin(c * f1 + p1) * a1 + Math.sin(c * f2 + p2) * a2 + Math.sin(c * f3 + p3) * a3)
        // zonas planas bajo los tanques
        for (const tx of TANK_X) {
          const k = clamp(1 - Math.abs(c - tx / TC) / 28, 0, 1)
          const w = k * k * (3 - 2 * k)
          h = h * (1 - w) + base * w
        }
        const top = Math.round(h)
        for (let r = 0; r < TH; r++) solid[r * TW + c] = r >= top ? 1 : 0
      }
      paint(0, 0, TW - 1, TH - 1)
    }

    /** Destruye el terreno dentro de un círculo y repinta solo la zona afectada. */
    const carve = (cx: number, cy: number, R: number) => {
      const c0 = Math.max(0, Math.floor((cx - R) / TC))
      const c1 = Math.min(TW - 1, Math.floor((cx + R) / TC))
      const r0 = Math.max(0, Math.floor((cy - R) / TC))
      const r1 = Math.min(TH - 1, Math.floor((cy + R) / TC))
      let changed = false
      for (let r = r0; r <= r1; r++) {
        const py = r * TC + 1 - cy
        for (let c = c0; c <= c1; c++) {
          const i = r * TW + c
          if (!solid[i]) continue
          const px = c * TC + 1 - cx
          if (px * px + py * py <= R * R) {
            solid[i] = 0
            changed = true
          }
        }
      }
      // las celdas de abajo cambian su borde de hierba
      if (changed) paint(c0, r0, c1, Math.min(TH - 1, r1 + 7))
    }

    const solidAt = (x: number, y: number) => {
      const c = Math.floor(x / TC)
      const r = Math.floor(y / TC)
      if (c < 0 || c >= TW || r < 0) return false
      if (r >= TH) return true
      return solid[r * TW + c] === 1
    }

    const surfaceAt = (x: number) => {
      const c = clamp(Math.floor(x / TC), 0, TW - 1)
      for (let r = 0; r < TH; r++) if (solid[r * TW + c]) return r * TC
      return WH
    }

    // ---------- estado ----------
    const newGame = (cfg: Cfg): Game => {
      genTerrain()
      const mk = (i: number, dir: number): Tank => ({
        index: i,
        x: TANK_X[i],
        y: surfaceAt(TANK_X[i]),
        dir,
        hp: TANK_HP,
        falling: false,
        vy: 0,
        fy0: 0,
        flash: 0,
      })
      return {
        cfg,
        phase: 'menu',
        paused: false,
        t: 0,
        tanks: [mk(0, 1), mk(1, -1)],
        cur: 0,
        turns: 0,
        wind: 0,
        fuel: FUEL_TURN,
        angle: 45,
        power: 55,
        angA: [45, 45],
        powA: [55, 55],
        sel: [0, 0],
        ammo: [freshAmmo(), freshAmmo()],
        shells: [],
        rings: [],
        clouds: Array.from({ length: 6 }, (_, i) => ({ x: hash(i + 1) * WW, y: 90 + hash(i + 9) * 170, s: 0.8 + hash(i + 4) * 0.8 })),
        streaks: Array.from({ length: 26 }, (_, i) => ({ x: hash(i * 3 + 2) * WW, y: 60 + hash(i * 5 + 1) * 420 })),
        dealt: [0, 0],
        winner: -1,
        winT: 0,
        overT: 0,
        settleT: 0,
        banner: 0,
        focus: null,
        focusT: 0,
        follow: false,
        drag: null,
        cpu: null,
        stepAcc: 0,
      }
    }

    let g: Game = newGame(lastCfg)
    g.phase = 'menu'

    const nameOf = (p: number) => (g.cfg.cpu && p === 1 ? 'CPU' : p === 0 ? 'AZUL' : 'ROSA')
    const isLive = () => g.phase === 'aim' || g.phase === 'fly' || g.phase === 'settle'
    const humanAim = () => g.phase === 'aim' && !(g.cfg.cpu && g.cur === 1)

    const snapshot = (): Ui => {
      const p = g.cur
      const wi = g.sel[p]
      const w = WEAPONS[wi]
      const n = g.ammo[p][wi]
      return {
        phase: g.phase === 'menu' ? 'menu' : g.phase === 'over' ? 'over' : 'play',
        cfg: g.cfg,
        cur: p,
        names: [nameOf(0), nameOf(1)],
        hp: [g.tanks[0].hp, g.tanks[1].hp],
        wind: g.wind,
        angle: Math.round(g.angle),
        power: Math.round(g.power),
        fuel: Math.round((g.fuel / FUEL_TURN) * 100),
        canAct: humanAim(),
        wLabel: `${w.label} ${w.ammo === Infinity ? '∞' : `x${n}`}`,
        winner: g.winner,
        dealt: g.winner >= 0 ? g.dealt[g.winner] : 0,
        turns: g.turns,
      }
    }

    const sync = () => {
      const s = snapshot()
      const k = JSON.stringify(s)
      if (k !== lastKey) {
        lastKey = k
        setUi(s)
      }
    }

    // ---------- física de tanques ----------
    const damage = (t: Tank, dmg: number, by: number) => {
      if (dmg <= 0) return
      t.hp = Math.max(0, t.hp - dmg)
      t.flash = 0.3
      if (by >= 0) g.dealt[by] += dmg
      juice.text(t.x, t.y - 46, `-${dmg}`, '#fca5a5', 12, 1)
    }

    const updateTank = (t: Tank, dt: number) => {
      if (t.hp <= 0) return
      const sy = surfaceAt(t.x)
      if (!t.falling) {
        if (sy - t.y > 1.5) {
          t.falling = true
          t.vy = 0
          t.fy0 = t.y
        } else {
          t.y = sy
        }
        return
      }
      t.vy += TANK_G * dt
      t.y += t.vy * dt
      if (t.y >= sy) {
        const dist = sy - t.fy0
        t.y = sy
        t.falling = false
        t.vy = 0
        const dmg = Math.round(Math.max(0, dist - 26) * 0.5)
        if (dmg > 0) {
          damage(t, dmg, -1)
          sHurt()
          juice.shake(0.35)
        }
        sThud()
        juice.burst(t.x, t.y, ['#8b5a2b', '#d6b98a'], { count: 10, speed: 120, angle: -Math.PI / 2, arc: Math.PI, life: 0.5, size: 3, gravity: 400 })
      }
    }

    /** Mueve el tanque; devuelve la distancia recorrida (0 si está bloqueado). */
    const moveTank = (t: Tank, dir: number, dt: number): number => {
      if (dir === 0 || g.fuel <= 0 || t.falling || t.hp <= 0) return 0
      const step = clamp(dir * MOVE_SPEED * dt, -g.fuel, g.fuel)
      const nx = clamp(t.x + step, 40, WW - 40)
      const other = g.tanks[1 - t.index]
      if (other.hp > 0 && Math.abs(nx - other.x) < 36) return 0
      // una pendiente de más de 10 px por paso no se sube
      if (surfaceAt(t.x) - surfaceAt(nx) > 10) return 0
      const moved = Math.abs(nx - t.x)
      if (moved < 0.001) return 0
      t.x = nx
      g.fuel -= moved
      g.stepAcc += moved
      if (g.stepAcc > 14) {
        g.stepAcc = 0
        sStep()
      }
      return moved
    }

    // ---------- disparo y explosiones ----------
    const explode = (x: number, y: number, w: Weapon, owner: number) => {
      carve(x, y, w.crater)
      for (const t of g.tanks) {
        if (t.hp <= 0) continue
        const d = Math.hypot(x - t.x, y - (t.y - 10))
        const reach = w.r + 14
        if (d >= reach) continue
        damage(t, Math.round(w.dmg * (0.2 + 0.8 * (1 - d / reach))), owner)
      }
      juice.shake(w.big ? 0.9 : 0.5)
      juice.freeze(w.big ? 90 : 50)
      juice.flash(w.big ? '#fff7ed' : '#fde68a', w.big ? 0.3 : 0.12)
      juice.burst(x, y, ['#fde047', '#fb923c', '#ffffff', '#ef4444'], { count: w.big ? 46 : 26, speed: w.big ? 320 : 230, life: 0.6, size: 4, gravity: 240 })
      juice.burst(x, y, ['#8b5a2b', '#a16207', '#57534e'], { count: w.big ? 22 : 12, speed: 200, life: 0.7, size: 3, gravity: 500 })
      juice.burst(x, y - 6, ['#6b7280', '#9ca3af'], { count: 10, speed: 50, life: 1.1, size: 6, gravity: -30, drag: 1.6, angle: -Math.PI / 2, arc: Math.PI * 0.9 })
      g.rings.push({ x, y, t: 0, life: 0.45, r: w.r * 2.4, col: w.big ? '#fdba74' : '#fde047' })
      g.focus = { x, y }
      g.focusT = 1
      sBoom(!!w.big)
    }

    /** Avanza un proyectil; devuelve false cuando ya no existe (explotó o salió del mundo). */
    const stepShell = (s: Shell, dt: number): boolean => {
      const w = WEAPONS[s.w]
      const n = Math.min(14, Math.max(1, Math.ceil((Math.hypot(s.vx, s.vy) * dt) / 1.5)))
      const h = dt / n
      for (let i = 0; i < n; i++) {
        s.px = s.x
        s.py = s.y
        s.vx += g.wind * h
        s.vy += G * h
        s.x += s.vx * h
        s.y += s.vy * h
        s.age += h
        if (s.x < -400 || s.x > WW + 400 || s.y > WH + 100 || s.age > 7) return false
        for (const t of g.tanks) {
          if (t.hp <= 0 || (t.index === s.owner && s.age < 0.12)) continue
          if (Math.abs(s.x - t.x) < 15 && s.y > t.y - 20 && s.y < t.y + 2) {
            explode(s.x, s.y, w, s.owner)
            return false
          }
        }
        if (!solidAt(s.x, s.y)) {
          s.ghost = false
          continue
        }
        if (s.ghost) continue
        if (w.name === 'PERFO') {
          // atraviesa la tierra abriendo un túnel; explota al agotar su penetración
          s.pen += Math.hypot(s.vx, s.vy) * h
          carve(s.x, s.y, 7)
          if (s.pen > 90) {
            explode(s.x, s.y, w, s.owner)
            return false
          }
          continue
        }
        if (w.name === 'REBOTE' && s.bounces < 3) {
          const gx = (solidAt(s.x + 3, s.y) ? 1 : 0) - (solidAt(s.x - 3, s.y) ? 1 : 0)
          const gy = (solidAt(s.x, s.y + 3) ? 1 : 0) - (solidAt(s.x, s.y - 3) ? 1 : 0)
          let nx = -gx
          let ny = -gy
          const len = Math.hypot(nx, ny)
          if (len === 0) {
            nx = 0
            ny = -1
          } else {
            nx /= len
            ny /= len
          }
          s.x = s.px
          s.y = s.py
          const dot = s.vx * nx + s.vy * ny
          if (dot < 0) {
            s.vx -= 1.55 * dot * nx
            s.vy -= 1.55 * dot * ny
          }
          s.bounces++
          sBounce()
          juice.burst(s.x, s.y, ['#d6b98a', '#86efac'], { count: 6, speed: 90, life: 0.3, size: 2.5, gravity: 300 })
          if (s.bounces >= 3 || Math.hypot(s.vx, s.vy) < 60) {
            explode(s.x, s.y, w, s.owner)
            return false
          }
          continue
        }
        explode(s.px, s.py, w, s.owner)
        return false
      }
      return true
    }

    const fire = () => {
      if (g.phase !== 'aim') return
      const p = g.cur
      const t = g.tanks[p]
      const wi = g.sel[p]
      const w = WEAPONS[wi]
      if (t.hp <= 0 || g.ammo[p][wi] <= 0) return
      const isCpu = g.cfg.cpu && p === 1
      if (!isCpu && g.power < 3) return
      if (w.ammo !== Infinity) g.ammo[p][wi] -= 1
      // si se acabó el arma, vuelve a la bala
      if (g.ammo[p][wi] <= 0) g.sel[p] = 0
      g.angA[p] = g.angle
      g.powA[p] = g.power
      const a = (g.angle * Math.PI) / 180
      const sp = g.power * SHOT_V
      const mx = t.x + Math.cos(a) * t.dir * 22
      const my = t.y - 14 - Math.sin(a) * 22
      const spread = w.name === 'TRIPLE' ? [-0.08, 0, 0.08] : [0]
      for (const d of spread) {
        const aa = a + d
        g.shells.push({
          x: mx,
          y: my,
          px: mx,
          py: my,
          vx: Math.cos(aa) * t.dir * sp,
          vy: -Math.sin(aa) * sp,
          w: wi,
          owner: p,
          pen: 0,
          bounces: 0,
          age: 0,
          ghost: solidAt(mx, my),
          trail: [],
        })
      }
      g.phase = 'fly'
      g.drag = null
      juice.burst(mx, my, ['#fde047', '#ffffff'], { count: 10, speed: 90, life: 0.25, size: 3 })
      juice.shake(0.12)
      sShot()
    }

    // ---------- turnos ----------
    const endGame = () => {
      const a = g.tanks[0].hp > 0
      const b = g.tanks[1].hp > 0
      g.winner = a && !b ? 0 : b && !a ? 1 : 1 - g.cur
      g.phase = 'win'
      g.winT = 0
      const wt = g.tanks[g.winner]
      const win = !g.cfg.cpu || g.winner === 0
      if (win) sWin()
      else sLose()
      juice.flash(g.winner === 0 ? BLUE : PINK, 0.3)
      juice.burst(wt.x, wt.y - 20, [BLUE, PINK, '#fde047', '#ffffff'], { count: 60, speed: 260, life: 1.2, size: 4, gravity: 200 })
    }

    const beginTurn = (p: number) => {
      g.cur = p
      g.turns++
      g.wind = Math.round((Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * (WIND_MAX - 6)))
      g.fuel = FUEL_TURN
      g.phase = 'aim'
      g.angle = g.angA[p]
      g.power = g.powA[p]
      const t = g.tanks[p]
      const o = g.tanks[1 - p]
      t.dir = o.x >= t.x ? 1 : -1
      if (g.ammo[p][g.sel[p]] <= 0) g.sel[p] = 0
      g.banner = 1.2
      g.drag = null
      dragId = null
      dragMoved = false
      hold.left = false
      hold.right = false
      if (g.cfg.cpu && p === 1) {
        const wander = Math.random() < 0.5 ? 0 : (Math.random() * 2 - 1) * 80
        g.cpu = { stage: 'walk', t: 0, tx: clamp(t.x + wander, 60, WW - 60), delay: [1.5, 1, 0.6][g.cfg.level], plan: null, hold: 0 }
      } else {
        g.cpu = null
      }
      sTurn(p)
    }

    const endTurn = () => {
      if (g.tanks.some((t) => t.hp <= 0)) {
        endGame()
        return
      }
      beginTurn(1 - g.cur)
    }

    // ---------- CPU ----------
    /** Simula un tiro sin viento cambiante del turno: devuelve dónde cae. */
    const simImpact = (t: Tank, deg: number, pw: number) => {
      const a = (deg * Math.PI) / 180
      const sp = pw * SHOT_V
      let x = t.x + Math.cos(a) * t.dir * 22
      let y = t.y - 14 - Math.sin(a) * 22
      let vx = Math.cos(a) * t.dir * sp
      let vy = -Math.sin(a) * sp
      const dt = 0.02
      let ghost = solidAt(x, y)
      for (let i = 0; i < 700; i++) {
        vx += g.wind * dt
        vy += G * dt
        const px = x
        const py = y
        x += vx * dt
        y += vy * dt
        if (x < -400 || x > WW + 400 || y > WH + 100) return { x: clamp(x, 0, WW), y: WH }
        if (solidAt(x, y)) {
          if (!ghost) return { x: px, y: py }
        } else ghost = false
      }
      return { x, y }
    }

    const cpuPlan = (): { a: number; p: number; w: number } => {
      const t = g.tanks[1]
      const o = g.tanks[0]
      t.dir = o.x >= t.x ? 1 : -1
      const tx = o.x
      const ty = o.y - 10
      let best = { a: 45, p: 60, d: Infinity }
      for (let a = 6; a <= 84; a += 3) {
        for (let p = 20; p <= 100; p += 3) {
          const r = simImpact(t, a, p)
          const d = Math.hypot(r.x - tx, r.y - ty)
          if (d < best.d) best = { a, p, d }
        }
      }
      const lv = g.cfg.level
      const errA = [12, 6, 1.5][lv]
      const errP = [18, 9, 3][lv]
      let w = 0
      if (g.ammo[1][2] > 0) {
        if (lv === 2 && best.d < 46) w = 2
        else if (lv === 1 && best.d < 70 && Math.random() < 0.4) w = 2
      }
      return {
        a: clamp(best.a + (Math.random() * 2 - 1) * errA, 2, 88),
        p: clamp(best.p + (Math.random() * 2 - 1) * errP, 5, 100),
        w,
      }
    }

    const cpuUpdate = (dt: number) => {
      const c = g.cpu
      if (!c) return
      const t = g.tanks[1]
      c.t += dt
      if (c.stage === 'walk') {
        const want = Math.sign(c.tx - t.x)
        const moved = want === 0 ? 0 : moveTank(t, want, dt)
        const done = want === 0 || Math.abs(c.tx - t.x) < 2 || g.fuel <= 0 || c.t > 3.5 || (moved === 0 && c.t > 0.4)
        if (done) {
          c.plan = cpuPlan()
          g.sel[1] = c.plan.w
          c.stage = 'think'
          c.t = 0
        }
      } else if (c.stage === 'think') {
        if (c.t >= c.delay) {
          c.stage = 'aim'
          c.t = 0
        }
      } else {
        if (!c.plan) return
        const pl = c.plan
        g.angle += clamp(pl.a - g.angle, -55 * dt, 55 * dt)
        g.power += clamp(pl.p - g.power, -60 * dt, 60 * dt)
        if (Math.abs(pl.a - g.angle) < 0.5 && Math.abs(pl.p - g.power) < 0.8) {
          c.hold += dt
          if (c.hold > 0.35) fire()
        }
      }
    }

    // ---------- entrada del jugador ----------
    const humanUpdate = (dt: number) => {
      if (held.has('ArrowUp')) g.angle = clamp(g.angle + 40 * dt, 0, 88)
      if (held.has('ArrowDown')) g.angle = clamp(g.angle - 40 * dt, 0, 88)
      if (held.has('KeyD')) g.power = clamp(g.power + 36 * dt, 0, 100)
      if (held.has('KeyA')) g.power = clamp(g.power - 36 * dt, 0, 100)
      const mv = (held.has('ArrowRight') || hold.right ? 1 : 0) - (held.has('ArrowLeft') || hold.left ? 1 : 0)
      moveTank(g.tanks[g.cur], mv, dt)
    }

    /** Apunta con el arrastre: el tanque es el punto de anclaje, como una resortera. */
    const aimFrom = (p: { x: number; y: number }) => {
      const t = g.tanks[g.cur]
      const pullX = t.x - p.x
      const pullY = t.y - 14 - p.y
      if (Math.abs(pullX) > 2) t.dir = pullX > 0 ? 1 : -1
      g.angle = clamp((Math.atan2(-pullY, Math.abs(pullX)) * 180) / Math.PI, 2, 88)
      dragLen = Math.hypot(pullX, pullY)
      g.power = clamp((dragLen / PULL_MAX) * 100, 0, 100)
      g.drag = { x: p.x, y: p.y }
    }

    const cycleWeapon = (step: number) => {
      const p = g.cur
      for (let k = 1; k <= WEAPONS.length; k++) {
        const i = (((g.sel[p] + step * k) % WEAPONS.length) + WEAPONS.length) % WEAPONS.length
        if (g.ammo[p][i] > 0) {
          g.sel[p] = i
          sTick()
          return
        }
      }
    }

    const pickWeapon = (i: number) => {
      if (i < 0 || i >= WEAPONS.length || g.ammo[g.cur][i] <= 0) return
      g.sel[g.cur] = i
      sTick()
    }

    const runCmd = (c: string) => {
      if (!c || !humanAim()) return
      if (c === 'fire') fire()
      else if (c === 'next') cycleWeapon(1)
      else if (c === 'prev') cycleWeapon(-1)
      else if (c[0] === 'w') pickWeapon(Number(c.slice(1)))
    }

    // ---------- actualización ----------
    const updateAmbient = (dt: number) => {
      const sgn = Math.sign(g.wind) || 1
      for (const c of g.clouds) {
        c.x += (10 + g.wind * 0.12) * dt
        if (c.x > WW + 120) c.x -= WW + 240
        if (c.x < -120) c.x += WW + 240
      }
      for (const s of g.streaks) {
        s.x = (((s.x + (g.wind * 1.4 + sgn * 30) * dt) % WW) + WW) % WW
      }
    }

    const update = (dt: number) => {
      g.t += dt
      g.banner = Math.max(0, g.banner - dt)
      g.focusT = Math.max(0, g.focusT - dt)
      for (const t of g.tanks) t.flash = Math.max(0, t.flash - dt * 3)
      for (const r of g.rings) r.t += dt
      g.rings = g.rings.filter((r) => r.t < r.life)
      updateAmbient(dt)
      if (g.phase === 'menu') return
      if (g.phase === 'over') {
        g.overT += dt
        return
      }
      for (const t of g.tanks) updateTank(t, dt)
      if (g.phase === 'win') {
        g.winT += dt
        if (g.winT > 1.4) {
          g.phase = 'over'
          g.overT = 0
        }
        return
      }
      if (g.phase === 'aim') {
        if (g.tanks.some((t) => t.hp <= 0)) {
          endGame()
          return
        }
        if (g.cfg.cpu && g.cur === 1) cpuUpdate(dt)
        else humanUpdate(dt)
      } else if (g.phase === 'fly') {
        const alive: Shell[] = []
        for (const s of g.shells) {
          s.trail.push({ x: s.x, y: s.y })
          if (s.trail.length > 12) s.trail.shift()
          if (stepShell(s, dt)) alive.push(s)
        }
        g.shells = alive
        if (alive.length === 0) {
          g.phase = 'settle'
          g.settleT = 0
        }
      } else if (g.phase === 'settle') {
        g.settleT += dt
        if (g.settleT > 0.45 && !g.tanks.some((t) => t.falling)) endTurn()
      }
    }

    // ---------- cámara ----------
    const fitAxis = (v: number, world: number, view: number) => (world >= view ? clamp(v, 0, world - view) : (world - view) / 2)

    const updateCamera = (dt: number) => {
      // por defecto: ambos tanques si caben en el cuadro; si no, el tanque en turno (en celular el cuadro es estrecho)
      const ct = g.tanks[g.cur]
      const ot = g.tanks[1 - g.cur]
      const span = Math.abs(ct.x - ot.x)
      let fx = span <= W - 120 ? (ct.x + ot.x) / 2 : ct.x + Math.sign(ot.x - ct.x) * (W / 2 - 90)
      let fy = WH - H / 2
      if (g.phase === 'win') {
        const wt = g.tanks[g.winner >= 0 ? g.winner : 0]
        fx = wt.x
        fy = wt.y - 60
      } else if (g.focus && g.focusT > 0) {
        fx = g.focus.x
        fy = g.focus.y
      }
      if (g.phase === 'fly' && g.shells.length > 0) {
        // la cámara sigue al proyectil si sale del cuadro, y regresa cuando vuelve
        const s = g.shells[0]
        const out = s.x < camX || s.x > camX + W || s.y < camY || s.y > camY + H
        if (!g.follow && out) g.follow = true
        else if (g.follow && s.x > camX + 60 && s.x < camX + W - 60 && s.y > camY + 60 && s.y < camY + H - 60) g.follow = false
        if (g.follow) {
          fx = s.x
          fy = s.y
        }
      } else {
        g.follow = false
      }
      const k = 1 - Math.exp(-dt * (g.follow ? 6 : 3))
      camX += (fitAxis(fx - W / 2, WW, W) - camX) * k
      camY += (fitAxis(fy - H / 2, WH, H) - camY) * k
    }

    // ---------- dibujo ----------
    const drawSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#1a1036')
      sky.addColorStop(0.6, '#5b2a6e')
      sky.addColorStop(1, '#f0875e')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(253,224,71,0.9)'
      ctx.beginPath()
      ctx.arc(W * 0.8, H * 0.3, 22, 0, Math.PI * 2)
      ctx.fill()
      const layer = (off: number, base: number, amp: number, col: string) => {
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(0, H)
        for (let x = 0; x <= W + 16; x += 16) {
          const wx = x + off
          ctx.lineTo(x, base - Math.sin(wx * 0.011) * amp - Math.sin(wx * 0.027 + 2) * amp * 0.4)
        }
        ctx.lineTo(W, H)
        ctx.closePath()
        ctx.fill()
      }
      layer(-camX * 0.25, H * 0.66, 34, 'rgba(76,29,96,0.55)')
      layer(-camX * 0.5 + 90, H * 0.74, 22, 'rgba(40,16,60,0.6)')
    }

    const drawAmbient = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (const c of g.clouds) {
        ctx.fillRect(c.x, c.y, 60 * c.s, 12 * c.s)
        ctx.fillRect(c.x + 12 * c.s, c.y - 8 * c.s, 30 * c.s, 10 * c.s)
      }
      const sgn = Math.sign(g.wind) || 1
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + (Math.abs(g.wind) / WIND_MAX) * 0.25})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const s of g.streaks) {
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x - sgn * (6 + Math.abs(g.wind) * 0.4), s.y)
      }
      ctx.stroke()
    }

    const drawTank = (t: Tank) => {
      const col = t.index === 0 ? BLUE : PINK
      const x = t.x
      const y = t.y
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x - 17, y - 1, 34, 4)
      if (t.hp <= 0) {
        ctx.fillStyle = '#374151'
        rr(ctx, x - 16, y - 7, 32, 7, 2)
        ctx.fill()
        ctx.fillStyle = '#1f2937'
        ctx.beginPath()
        ctx.arc(x + 4, y - 10, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        return
      }
      // orugas con ruedas
      const track = ctx.createLinearGradient(0, y - 7, 0, y)
      track.addColorStop(0, '#4b5563')
      track.addColorStop(1, '#111827')
      ctx.fillStyle = track
      rr(ctx, x - 17, y - 7, 34, 7, 3.5)
      ctx.fill()
      ctx.fillStyle = '#9ca3af'
      for (const dx of [-11, -4, 4, 11]) {
        ctx.beginPath()
        ctx.arc(x + dx, y - 3.5, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      // casco con degradado y placa frontal
      const hull = t.flash > 0 ? '#ffffff' : col
      const hg = ctx.createLinearGradient(0, y - 14, 0, y - 6)
      hg.addColorStop(0, t.flash > 0 ? '#ffffff' : 'rgba(255,255,255,0.35)')
      hg.addColorStop(0.35, hull)
      hg.addColorStop(1, 'rgba(0,0,0,0.35)')
      ctx.fillStyle = hg
      rr(ctx, x - 15, y - 13, 30, 8, 3)
      ctx.fill()
      // torreta
      ctx.fillStyle = t.flash > 0 ? '#ffffff' : 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(x, y - 14, 6, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = hull
      ctx.beginPath()
      ctx.arc(x, y - 14, 5.5, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x - 6, y - 14, 12, 1.2)
      const ang = g.phase === 'aim' && t.index === g.cur ? g.angle : g.angA[t.index]
      const r = (ang * Math.PI) / 180
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 5.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y - 14)
      ctx.lineTo(x + Math.cos(r) * t.dir * 22, y - 14 - Math.sin(r) * 22)
      ctx.stroke()
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 3
      ctx.stroke()
      const f = t.hp / TANK_HP
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x - 18, y - 30, 36, 5)
      ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#ef4444'
      ctx.fillRect(x - 18, y - 30, 36 * f, 5)
      if (g.phase === 'aim' && t.index === g.cur) {
        const bob = Math.sin(g.t * 6) * 2
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(x - 6, y - 44 + bob)
        ctx.lineTo(x + 6, y - 44 + bob)
        ctx.lineTo(x, y - 38 + bob)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    /** Trayectoria punteada corta: solo el inicio del tiro, con el viento actual. */
    const drawPreview = () => {
      if (!humanAim()) return
      const t = g.tanks[g.cur]
      const a = (g.angle * Math.PI) / 180
      const sp = g.power * SHOT_V
      let x = t.x + Math.cos(a) * t.dir * 22
      let y = t.y - 14 - Math.sin(a) * 22
      let vx = Math.cos(a) * t.dir * sp
      let vy = -Math.sin(a) * sp
      const dt = 0.045
      ctx.fillStyle = '#ffffff'
      let ghost = solidAt(x, y)
      for (let i = 1; i <= 14; i++) {
        vx += g.wind * dt
        vy += G * dt
        x += vx * dt
        y += vy * dt
        if (solidAt(x, y)) {
          if (!ghost) break
          continue
        }
        ghost = false
        ctx.globalAlpha = 0.9 - i * 0.055
        ctx.beginPath()
        ctx.arc(x, y, Math.max(1, 3 - i * 0.12), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const drawShells = () => {
      for (const s of g.shells) {
        const w = WEAPONS[s.w]
        const n = s.trail.length
        ctx.fillStyle = w.color
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / n
          ctx.globalAlpha = k * 0.6
          ctx.beginPath()
          ctx.arc(s.trail[i].x, s.trail[i].y, (w.big ? 3 : 1.5) * k + 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(s.x, s.y, w.big ? 5 : 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawRings = () => {
      ctx.lineWidth = 3
      for (const r of g.rings) {
        const k = r.t / r.life
        ctx.globalAlpha = 1 - k
        ctx.strokeStyle = r.col
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * k, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const drawWorld = () => {
      ctx.save()
      ctx.translate(-Math.round(camX), -Math.round(camY))
      drawAmbient()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tcv, 0, 0, WW, WH)
      for (const t of g.tanks) drawTank(t)
      drawPreview()
      if (g.drag && dragId !== null) {
        const t = g.tanks[g.cur]
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(t.x, t.y - 14)
        ctx.lineTo(g.drag.x, g.drag.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      drawShells()
      drawRings()
      if (humanAim()) {
        const t = g.tanks[g.cur]
        ctx.font = `7px ${pf}`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`ANG ${Math.round(g.angle)} POT ${Math.round(g.power)}`, t.x, t.y - 58)
      }
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
    }

    const drawHud = () => {
      if (g.phase === 'menu' || g.phase === 'over') return
      if (g.phase === 'win') {
        const col = g.winner === 0 ? BLUE : PINK
        const label = g.cfg.cpu ? (g.winner === 0 ? 'VICTORIA' : 'DERROTA') : `GANA ${nameOf(g.winner)}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `16px ${pf}`
        ctx.fillStyle = col
        ctx.fillText(label, W / 2, H * 0.3)
        return
      }
      const col = g.cur === 0 ? BLUE : PINK
      const label = `TURNO ${nameOf(g.cur)}`
      const pulse = g.banner > 0 ? 1 + g.banner * 0.2 : 1
      ctx.font = `${Math.round(11 * pulse)}px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const bw = ctx.measureText(label).width + 28
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      rr(ctx, W / 2 - bw / 2, 12, bw, 26, 13)
      ctx.fill()
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      rr(ctx, W / 2 - bw / 2, 12, bw, 26, 13)
      ctx.stroke()
      ctx.fillStyle = col
      ctx.fillText(label, W / 2, 25)
      // indicador de viento: la flecha crece con la fuerza
      const len = (Math.abs(g.wind) / WIND_MAX) * 70
      const sgn = Math.sign(g.wind)
      ctx.font = `7px ${pf}`
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText('VIENTO', W / 2, 54)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(W / 2, 66)
      ctx.lineTo(W / 2 + sgn * len, 66)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(W / 2 + sgn * len, 66)
      ctx.lineTo(W / 2 + sgn * (len - 7), 60)
      ctx.lineTo(W / 2 + sgn * (len - 7), 72)
      ctx.closePath()
      ctx.fill()
    }

    const draw = () => {
      drawSky()
      ctx.save()
      juice.applyShake(ctx)
      drawWorld()
      ctx.restore()
      drawHud()
      juice.drawFlash(ctx, W, H)
      if (g.paused) {
        ctx.fillStyle = 'rgba(8,4,14,0.7)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `22px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2 - 10)
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.font = `8px ${pf}`
        ctx.fillText('P O TOCA PARA SEGUIR', W / 2, H / 2 + 22)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // ---------- control de partida ----------
    const startGame = (c: Cfg) => {
      lastCfg = c
      juice.reset()
      held.clear()
      cmds.length = 0
      g = newGame(c)
      beginTurn(0)
      g.banner = 1.2
      g.follow = false
      updateCamera(10)
      sync()
    }
    startRef.current = startGame
    menuRef.current = () => {
      g = newGame(lastCfg)
      g.phase = 'menu'
      juice.reset()
      sync()
    }

    // ---------- entrada: puntero (táctil y ratón) ----------
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * W + camX,
        y: ((e.clientY - r.top) / r.height) * H + camY,
      }
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (!humanAim() || dragId !== null) return
      dragId = e.pointerId
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      const p0 = toWorld(e)
      downX = p0.x
      downY = p0.y
      dragMoved = false
      dragLen = 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      e.preventDefault()
      const p = toWorld(e)
      // un toque sin arrastrar no apunta ni dispara
      if (!dragMoved && Math.hypot(p.x - downX, p.y - downY) < 8) return
      dragMoved = true
      aimFrom(p)
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      dragId = null
      g.drag = null
      // soltar tras un jalón corto no dispara: evita tiros por accidente
      if (dragMoved && dragLen >= 10 && humanAim()) fire()
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return
      dragId = null
      dragMoved = false
      g.drag = null
    }
    const onCtx = (e: Event) => e.preventDefault()

    // ---------- teclado y foco ----------
    const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD'])
    const onKeyDown = (e: KeyboardEvent) => {
      if (KEYS.has(e.code)) {
        held.add(e.code)
        return
      }
      if (e.repeat) return
      const m = /^Digit([1-5])$/.exec(e.code)
      if (m) cmds.push(`w${Number(m[1]) - 1}`)
      else if (e.code === 'KeyE') cmds.push('next')
      else if (e.code === 'KeyQ') cmds.push('prev')
    }
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
    const pauseIfLive = () => {
      held.clear()
      hold.left = false
      hold.right = false
      dragId = null
      if (isLive()) g.paused = true
    }
    const onVis = () => {
      if (document.hidden) pauseIfLive()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('contextmenu', onCtx)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', pauseIfLive)
    document.addEventListener('visibilitychange', onVis)

    /** Al girar la pantalla en partida: el mundo no cambia, la cámara se reacomoda y se pausa. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layout()
      if (W === oldW && H === oldH) return
      setupCanvas(canvas, W, H)
      held.clear()
      dragId = null
      if (isLive()) g.paused = true
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      const jp = justPressedRef.current
      if (jp.has('pause') && isLive()) {
        g.paused = !g.paused
        held.clear()
      }
      if (jp.has('action')) {
        if (g.phase === 'menu') startGame(lastCfg)
        else if (g.phase === 'over' && g.overT > 0.6) startGame(g.cfg)
        else if (g.paused) g.paused = false
        else if (humanAim()) fire()
      }
      jp.clear()
      while (cmds.length > 0) runCmd(cmds.shift() ?? '')
      if (!g.paused) {
        const dtGame = juice.update(dt)
        if (dtGame > 0) update(dtGame)
      }
      updateCamera(dt)
      draw()
      sync()
    }
    raf = requestAnimationFrame((t) => {
      sync()
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('contextmenu', onCtx)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pauseIfLive)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef])

  const btn =
    'flex h-14 items-center justify-center rounded-2xl text-lg font-semibold transition select-none touch-none active:scale-95 disabled:opacity-40'

  const hud = (
    <Hud>
      <span style={{ color: BLUE }}>
        {ui.names[0]} {ui.hp[0]}
      </span>
      <span className="text-white/70">
        {ui.wind === 0 ? 'VIENTO --' : `VIENTO ${ui.wind < 0 ? '←' : '→'} ${Math.abs(ui.wind)}`}
      </span>
      <span style={{ color: PINK }}>
        {ui.names[1]} {ui.hp[1]}
      </span>
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen width={W0} height={H0} className="rounded-xl border border-lime-400/30 bg-[#0a0f06]" hud={hud}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Artillería"
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="ARTILLERIA"
            accent={ACCENT}
            subtitle="Dos tanques, un terreno que se destruye. Calcula el viento, el ángulo y la potencia."
            hint="Elige un modo o pulsa ESPACIO"
            touchHint="Elige un modo"
          >
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Contra la CPU</p>
              <div className="flex gap-2">
                {LEVEL_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      startRef.current({ cpu: true, level: i as Level })
                    }}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-black transition active:scale-95"
                    style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}55` }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  startRef.current({ cpu: false, level: 1 })
                }}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
                style={{ background: PINK, boxShadow: `0 0 24px ${PINK}66` }}
              >
                2 jugadores
              </button>
            </div>
            <p className="max-w-[18rem] text-[11px] leading-relaxed text-white/60">
              Teclado: ←/→ mover, ↑/↓ ángulo, A/D potencia, Espacio disparar. Celular: arrastra desde el tanque hacia atrás y suelta.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && ui.winner >= 0 && (
          <>
            <GameOverOverlay
              title={ui.cfg.cpu ? (ui.winner === 0 ? 'VICTORIA' : 'DERROTA') : ui.winner === 0 ? 'GANA AZUL' : 'GANA ROSA'}
              accent={ui.winner === 0 ? BLUE : PINK}
              score={ui.dealt}
              best={0}
              stats={[
                { label: 'Vida final', value: ui.hp[ui.winner] },
                { label: 'Turnos', value: ui.turns },
              ]}
              onRestart={() => startRef.current(ui.cfg)}
              ranked={false}
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                menuRef.current()
              }}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs text-white/70 transition active:scale-95"
            >
              Cambiar modo
            </button>
          </>
        )}
      </GameScreen>

      <div className="flex w-full max-w-xl shrink-0 flex-col gap-1.5 px-3 pb-2">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>
            Ángulo {ui.angle}° · Potencia {ui.power}%
          </span>
          <span className="flex items-center gap-1.5">
            Combustible
            <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full bg-lime-400" style={{ width: `${ui.fuel}%` }} />
            </span>
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            aria-label="Mover a la izquierda"
            disabled={!ui.canAct}
            className={`${btn} w-16 bg-white/10 text-white`}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={() => {
              holdRef.current.left = true
            }}
            onPointerUp={() => {
              holdRef.current.left = false
            }}
            onPointerLeave={() => {
              holdRef.current.left = false
            }}
            onPointerCancel={() => {
              holdRef.current.left = false
            }}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Mover a la derecha"
            disabled={!ui.canAct}
            className={`${btn} w-16 bg-white/10 text-white`}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={() => {
              holdRef.current.right = true
            }}
            onPointerUp={() => {
              holdRef.current.right = false
            }}
            onPointerLeave={() => {
              holdRef.current.right = false
            }}
            onPointerCancel={() => {
              holdRef.current.right = false
            }}
          >
            ▶
          </button>
          <button
            type="button"
            disabled={!ui.canAct}
            onClick={() => cmdRef.current.push('next')}
            className={`${btn} min-w-0 flex-1 flex-col border border-white/15 bg-white/5 px-2 text-white`}
          >
            <span className="text-[10px] font-normal text-white/50">Arma · toca para cambiar</span>
            <span className="max-w-full truncate">{ui.wLabel}</span>
          </button>
          <button
            type="button"
            disabled={!ui.canAct}
            onClick={() => cmdRef.current.push('fire')}
            className={`${btn} w-28 text-base text-black`}
            style={{ background: ACCENT, boxShadow: `0 0 22px ${ACCENT}66` }}
          >
            DISPARAR
          </button>
        </div>
      </div>
    </div>
  )
}
