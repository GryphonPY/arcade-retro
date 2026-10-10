'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { rr, setupCanvas } from './game-utils'
import { noise, sfx, tone } from './sfx'

const ACCENT = '#facc15'
const TAU = Math.PI * 2

const W0 = 360
const H0 = 560
// Mundo lógico: `layout()` lo ajusta a la pantalla. El ring está centrado en (CX, CY).
let W = W0
let H = H0
let CX = W0 / 2
let CY = H0 / 2
let R0 = Math.min(W0, H0) * 0.4

const CAR_R = 13 // radio del auto (choques y dibujo)
const ENGINE = 380 // aceleración del motor (px/s²)
const VMAX = 250
const VMAX_TURBO = 420
const GRIP = 6 // qué tan rápido muere el deslizamiento lateral (menos = más derrape)
const OIL_GRIP = 0.8
const TURN = 4.2 // giro máximo (rad/s)
const RESTIT = 0.45 // rebote en choques
const HEAVY = 2.3 // masa con escudo pesado (normal = 1)
const MAGNET_R = 190
const FALL_T = 0.8 // duración de la caída fuera del ring
const GRACE = 6 // s antes del primer encogimiento
const WARN = 1 // s de aviso con el borde brillando
const STEP = 0.12 // fracción de R0 que pierde el ring en cada paso
const MIN_RING = 0.3
const WIN_ROUNDS = 3 // mejor de 5
const INTRO_T = 3
const KO_T = 1.8
const STICK_MAX = 56 // px lógicos del joystick para ir a tope
const DEAD = 6
const DOUBLE_TAP_MS = 280
const BURST_COST = 0.25
const BURST_T = 0.6
const MAX_MARKS = 700

type Phase = 'menu' | 'intro' | 'play' | 'ko' | 'over'
/** 'duo' = dos jugadores en el mismo celular; un número = 1 jugador contra ese número de bots. */
type Mode = 'duo' | 1 | 2 | 3
type Kind = 'turbo' | 'oil' | 'magnet' | 'shield'

interface Input {
  thr: number
  dir: number
  turbo: boolean
}

interface Car {
  i: number
  name: string
  color: string
  slot: number // 0 o 1 = jugador que lo controla; -1 = bot
  x: number
  y: number
  vx: number
  vy: number
  h: number // rumbo (rad)
  w: number // velocidad de giro (rad/s)
  mass: number
  gauge: number // turbo 0..1
  burst: number // s de turbo por doble toque
  shield: number // s de escudo pesado
  magnet: number // s de imán
  oil: number // s soltando aceite
  oilT: number
  onOil: boolean
  slip: number
  boosting: boolean
  state: 'alive' | 'falling' | 'gone'
  out: number
  kickBy: number // último auto que lo golpeó fuerte (-1 nadie)
  kickT: number
  flash: number
  markX: number
  markY: number
  inp: Input
  ai: { timer: number; dir: number; turbo: boolean; skill: number }
}

interface Pickup {
  kind: Kind
  x: number
  y: number
  age: number
}

interface Slick {
  x: number
  y: number
  r: number
  life: number
  owner: number
}

interface Mark {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Stick {
  id: number
  ox: number
  oy: number
  x: number
  y: number
  t0: number
}

interface Slot {
  stick: Stick | null
  turbo: Set<number>
  tap: { t: number; x: number; y: number } | null
}

interface Game {
  phase: Phase
  mode: Mode
  paused: boolean
  t: number
  phaseT: number
  round: number
  wins: number[]
  kos: number[]
  cars: Car[]
  ringR: number
  ringTo: number
  ringT: number // s hasta el próximo encogimiento
  steps: number
  pickups: Pickup[]
  slicks: Slick[]
  marks: Mark[]
  spawnT: number
  winner: number | null
  matchWinner: number | null
  banner: { text: string; color: string; t: number } | null
}

interface Ui {
  phase: Phase
  mode: Mode
  round: number
  wins: number[]
  kos: number[]
  matchWinner: number | null
}

const initialUi: Ui = { phase: 'menu', mode: 'duo', round: 1, wins: [0, 0], kos: [0, 0], matchWinner: null }

const PK: Record<Kind, { color: string; label: string; toast: string }> = {
  turbo: { color: '#fde047', label: 'TURBO', toast: 'TURBO LLENO' },
  oil: { color: '#a78bfa', label: 'ACEITE', toast: 'ACEITE LISTO' },
  magnet: { color: '#f87171', label: 'IMAN', toast: 'IMAN ACTIVO' },
  shield: { color: '#67e8f9', label: 'ESCUDO', toast: 'ESCUDO PESADO' },
}

const P1 = { name: 'AMARILLO', color: '#facc15' }
const P2 = { name: 'CIAN', color: '#22d3ee' }
const BOTS = [
  { name: 'BOT 1', color: '#4ade80' },
  { name: 'BOT 2', color: '#fb923c' },
  { name: 'BOT 3', color: '#f472b6' },
]
/** Aclara (+) u oscurece (−) un color hex. */
const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

const metaOf = (mode: Mode) => (mode === 'duo' ? [P1, P2] : [{ name: 'TU', color: P1.color }, ...BOTS.slice(0, mode)])

const MENU: { label: string; mode: Mode; color: string }[] = [
  { label: 'Dos jugadores', mode: 'duo', color: P1.color },
  { label: '1 vs 1 bot', mode: 1, color: BOTS[0].color },
  { label: '1 vs 2 bots', mode: 2, color: BOTS[1].color },
  { label: '1 vs 3 bots', mode: 3, color: BOTS[2].color },
]

interface KeySet {
  left: string
  right: string
  up: string
  down: string
  turbo: string[]
}
const WASD: KeySet = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', turbo: ['ShiftLeft', 'ShiftRight'] }
const ARROWS: KeySet = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  turbo: ['Enter', 'NumpadEnter'],
}
const keysOf = (k: KeySet) => [k.left, k.right, k.up, k.down, ...k.turbo]
const TRACKED = new Set<string>([...keysOf(WASD), ...keysOf(ARROWS)])

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Diferencia de ángulos normalizada a (-PI, PI]. */
function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  else if (d < -Math.PI) d += TAU
  return d
}

/** Ajusta el mundo lógico al área de la pantalla y recalcula el ring. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  CX = W / 2
  CY = H / 2
  R0 = Math.min(W, H) * 0.4
  publishLogical(f)
}

function newGame(mode: Mode): Game {
  const n = mode === 'duo' ? 2 : 1 + mode
  return {
    phase: 'menu',
    mode,
    paused: false,
    t: 0,
    phaseT: 0,
    round: 1,
    wins: new Array<number>(n).fill(0),
    kos: new Array<number>(n).fill(0),
    cars: [],
    ringR: R0,
    ringTo: R0,
    ringT: GRACE,
    steps: 0,
    pickups: [],
    slicks: [],
    marks: [],
    spawnT: 2.5,
    winner: null,
    matchWinner: null,
    banner: null,
  }
}

/** Coloca a los autos en círculo, mirando hacia el centro. */
function placeCars(g: Game) {
  const meta = metaOf(g.mode)
  const n = meta.length
  g.cars = meta.map((m, i): Car => {
    const a = Math.PI / 2 + (i * TAU) / n
    return {
      i,
      name: m.name,
      color: m.color,
      slot: g.mode === 'duo' ? i : i === 0 ? 0 : -1,
      x: CX + Math.cos(a) * R0 * 0.5,
      y: CY + Math.sin(a) * R0 * 0.5,
      vx: 0,
      vy: 0,
      h: a + Math.PI,
      w: 0,
      mass: 1,
      gauge: 1,
      burst: 0,
      shield: 0,
      magnet: 0,
      oil: 0,
      oilT: 0,
      onOil: false,
      slip: 0,
      boosting: false,
      state: 'alive',
      out: 0,
      kickBy: -1,
      kickT: 0,
      flash: 0,
      markX: NaN,
      markY: NaN,
      inp: { thr: 0, dir: 0, turbo: false },
      ai: { timer: 0, dir: 0, turbo: false, skill: 0.55 + Math.random() * 0.45 },
    }
  })
}

export default function Chocones() {
  const { justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(m: Mode) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Ui>(initialUi)

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

    let g = newGame('duo')
    placeCars(g)
    let lastMode: Mode = 'duo'
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let introIdx = -1

    // ---------- sincronía con React ----------
    const sync = () => {
      setUi({
        phase: g.phase,
        mode: g.mode,
        round: g.round,
        wins: [...g.wins],
        kos: [...g.kos],
        matchWinner: g.matchWinner,
      })
    }

    // ---------- entrada ----------
    const held = new Set<string>()
    const slots: Slot[] = [
      { stick: null, turbo: new Set<number>(), tap: null },
      { stick: null, turbo: new Set<number>(), tap: null },
    ]
    const ptr = new Map<number, { slot: number; kind: 'stick' | 'turbo' }>()

    const onKeyDown = (e: KeyboardEvent) => {
      if (TRACKED.has(e.code)) held.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code)
    }
    const toX = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientX - r.left) / r.width) * W
    }
    const toY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientY - r.top) / r.height) * H
    }
    // En 2 jugadores cada quien usa su mitad; con bots, el jugador usa toda la pantalla.
    const slotAt = (y: number) => (g.mode === 'duo' && y < CY ? 1 : 0)

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase === 'menu' || g.phase === 'over') return
      const x = toX(e)
      const y = toY(e)
      const si = slotAt(y)
      const s = slots[si]
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      if (!s.stick) {
        const now = performance.now()
        s.stick = { id: e.pointerId, ox: x, oy: y, x, y, t0: now }
        ptr.set(e.pointerId, { slot: si, kind: 'stick' })
        const tap = s.tap
        if (tap && now - tap.t < DOUBLE_TAP_MS && Math.hypot(x - tap.x, y - tap.y) < 50) {
          // doble toque: impulso de turbo si hay carga
          s.tap = null
          const c = g.cars.find((cc) => cc.slot === si)
          if (c && c.state === 'alive' && g.phase === 'play') {
            if (c.gauge >= BURST_COST) {
              c.gauge -= BURST_COST
              c.burst = BURST_T
            } else {
              juice.text(c.x, c.y - 22, 'SIN TURBO', '#fca5a5', 8, 0.8)
            }
          }
        }
      } else {
        // segundo dedo en la misma zona: turbo sostenido
        s.turbo.add(e.pointerId)
        ptr.set(e.pointerId, { slot: si, kind: 'turbo' })
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = ptr.get(e.pointerId)
      if (!p || p.kind !== 'stick') return
      const st = slots[p.slot].stick
      if (!st || st.id !== e.pointerId) return
      e.preventDefault()
      st.x = toX(e)
      st.y = toY(e)
    }
    const onUp = (e: PointerEvent) => {
      const p = ptr.get(e.pointerId)
      if (!p) return
      ptr.delete(e.pointerId)
      const s = slots[p.slot]
      if (p.kind === 'turbo') {
        s.turbo.delete(e.pointerId)
      } else if (s.stick && s.stick.id === e.pointerId) {
        const st = s.stick
        const now = performance.now()
        const moved = Math.hypot(st.x - st.ox, st.y - st.oy)
        // un toque corto y quieto cuenta para el doble toque
        s.tap =
          moved < 10 && e.type === 'pointerup' && now - st.t0 < 260 ? { t: now, x: st.ox, y: st.oy } : null
        s.stick = null
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const clearInputs = () => {
      held.clear()
      for (const s of slots) {
        s.stick = null
        s.turbo.clear()
        s.tap = null
      }
    }
    const pauseIfPlaying = () => {
      clearInputs()
      if (g.phase === 'intro' || g.phase === 'play' || g.phase === 'ko') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) pauseIfPlaying()
    }
    window.addEventListener('blur', pauseIfPlaying)
    document.addEventListener('visibilitychange', onVis)

    /** Teclas de cada jugador: J1 WASD (+ flechas si juega contra bots), J2 flechas. */
    const keySetsOf = (c: Car): KeySet[] => {
      if (c.slot === 1) return [ARROWS]
      return g.mode === 'duo' ? [WASD] : [WASD, ARROWS]
    }

    const readHuman = (c: Car) => {
      const s = slots[c.slot]
      let kx = 0
      let ky = 0
      let kt = false
      for (const k of keySetsOf(c)) {
        if (held.has(k.left)) kx -= 1
        if (held.has(k.right)) kx += 1
        if (held.has(k.up)) ky -= 1
        if (held.has(k.down)) ky += 1
        if (k.turbo.some((code) => held.has(code))) kt = true
      }
      let thr = 0
      let dir = c.inp.dir
      if (s.stick) {
        const dx = s.stick.x - s.stick.ox
        const dy = s.stick.y - s.stick.oy
        const len = Math.hypot(dx, dy)
        if (len > DEAD) {
          thr = Math.min(1, (len - DEAD) / (STICK_MAX - DEAD))
          dir = Math.atan2(dy, dx)
        }
      } else if (kx || ky) {
        thr = 1
        dir = Math.atan2(ky, kx)
      }
      c.inp = { thr, dir, turbo: s.turbo.size > 0 || kt }
    }

    /** Bot: persigue al rival más cercano, lo empuja hacia afuera o toma objetos. */
    const think = (c: Car, dt: number) => {
      const ai = c.ai
      ai.timer -= dt
      if (ai.timer <= 0) {
        ai.timer = 0.2 + Math.random() * 0.2
        const rivals = g.cars.filter((o) => o !== c && o.state === 'alive')
        let tx = CX
        let ty = CY
        let turbo = false
        const fromCenter = Math.hypot(c.x - CX, c.y - CY)
        if (rivals.length > 0 && fromCenter < g.ringR - 44) {
          let near = rivals[0]
          let nd = Infinity
          for (const o of rivals) {
            const d = Math.hypot(o.x - c.x, o.y - c.y)
            if (d < nd) {
              nd = d
              near = o
            }
          }
          let pick: Pickup | null = null
          let pd = 220
          for (const p of g.pickups) {
            const d = Math.hypot(p.x - c.x, p.y - c.y)
            if (d < pd) {
              pd = d
              pick = p
            }
          }
          if (pick && nd > 130) {
            tx = pick.x
            ty = pick.y
          } else {
            const od = Math.hypot(near.x - CX, near.y - CY)
            if (od > g.ringR * 0.5) {
              // apunta más allá del rival para empujarlo hacia afuera
              const ux = (near.x - CX) / od
              const uy = (near.y - CY) / od
              tx = near.x + ux * 40
              ty = near.y + uy * 40
            } else {
              tx = near.x + near.vx * 0.35
              ty = near.y + near.vy * 0.35
            }
            turbo = nd < 120 && c.gauge > 0.35 && Math.random() < 0.7 * ai.skill
          }
        }
        // en el borde (o sin rivales) vuelve al centro
        const err = (1 - ai.skill) * 0.5
        ai.dir = Math.atan2(ty - c.y, tx - c.x) + (Math.random() * 2 - 1) * err
        ai.turbo = turbo
      }
      c.inp = { thr: 1, dir: ai.dir, turbo: ai.turbo }
    }

    // ---------- control de partida ----------
    const startRound = () => {
      g.ringR = R0
      g.ringTo = R0
      g.ringT = GRACE
      g.steps = 0
      g.pickups = []
      g.slicks = []
      g.marks = []
      g.spawnT = 2.5
      g.winner = null
      g.banner = null
      placeCars(g)
      g.phase = 'intro'
      g.phaseT = 0
      introIdx = -1
    }

    const winText = (i: number) => {
      const m = metaOf(g.mode)[i]
      return m.name === 'TU' ? 'GANASTE' : `${m.name} GANA`
    }

    const finishRound = () => {
      if (g.winner !== null) {
        g.wins[g.winner]++
        if (g.wins[g.winner] >= WIN_ROUNDS) {
          g.matchWinner = g.winner
          g.phase = 'over'
          g.phaseT = 0
          g.banner = null
          if (g.mode !== 'duo' && g.matchWinner !== 0) sfx.gameOver()
          sync()
          return
        }
        g.round++
      }
      startRound()
      sync()
    }

    const endRound = () => {
      const left = g.cars.filter((c) => c.state === 'alive')
      g.winner = left.length === 1 ? left[0].i : null
      g.phase = 'ko'
      g.phaseT = 0
      const win = g.winner
      const color = win === null ? '#e2e8f0' : metaOf(g.mode)[win].color
      g.banner = { text: win === null ? 'EMPATE' : winText(win), color, t: KO_T }
      juice.flash(color, 0.25)
      juice.freeze(90)
      if (win !== null && (g.mode === 'duo' || win === 0)) sfx.levelUp()
      else if (win !== null) sfx.hurt()
      else sfx.pause()
      sync()
    }

    // ---------- físicas ----------
    const fall = (c: Car) => {
      c.state = 'falling'
      c.out = 0
      if (c.kickBy >= 0 && g.t - c.kickT < 3) g.kos[c.kickBy]++
      juice.burst(c.x, c.y, [c.color, '#ffffff'], { count: 26, speed: 220, life: 0.6, size: 4 })
      juice.shake(0.4)
      juice.text(c.x, c.y - 22, 'FUERA!', c.color, 10, 1)
      sfx.hurt()
    }

    const fallStep = (c: Car, dt: number) => {
      c.out += dt
      c.vx *= Math.exp(-dt * 2)
      c.vy *= Math.exp(-dt * 2)
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.h += dt * 9
      if (c.out >= FALL_T) c.state = 'gone'
    }

    const drive = (c: Car, dt: number) => {
      const { thr, dir } = c.inp
      const speed = Math.hypot(c.vx, c.vy)
      if (thr > 0.05) {
        // girar cuesta más con poca velocidad, con escudo y sobre aceite
        const handling = ((c.onOil ? 0.45 : 1) * clamp(0.35 + speed / 180, 0.35, 1)) / Math.sqrt(c.mass)
        const want = clamp(angDiff(dir, c.h) * 4.2, -TURN, TURN) * handling
        c.w += (want - c.w) * Math.min(1, dt * 7)
      } else {
        c.w *= Math.exp(-dt * 3)
      }
      c.w = clamp(c.w, -TURN * 1.6, TURN * 1.6)
      c.h += c.w * dt
      // la velocidad se separa en avance y deslizamiento lateral: ahí nace el derrape
      const fx = Math.cos(c.h)
      const fy = Math.sin(c.h)
      let vf = c.vx * fx + c.vy * fy
      let vl = c.vy * fx - c.vx * fy
      const accel = (ENGINE * thr * (c.boosting ? 1.9 : 1)) / Math.pow(c.mass, 0.6)
      vf += accel * dt
      vf *= Math.exp(-dt * (thr > 0.05 ? 0.2 : 1.4))
      const vmax = c.boosting ? VMAX_TURBO : VMAX
      if (vf > vmax) vf += (vmax - vf) * Math.min(1, dt * 3)
      vl *= Math.exp(-dt * (c.onOil ? OIL_GRIP : GRIP))
      c.slip = Math.abs(vl)
      c.vx = vf * fx - vl * fy
      c.vy = vf * fy + vl * fx
      c.x += c.vx * dt
      c.y += c.vy * dt
    }

    /** Choque entre dos autos: impulso según masas, velocidad relativa y rebote. */
    const collide = (a: Car, b: Car) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      const minD = CAR_R * 2
      if (d >= minD) return
      const nx = d > 1e-4 ? dx / d : 1
      const ny = d > 1e-4 ? dy / d : 0
      const ia = 1 / a.mass
      const ib = 1 / b.mass
      // separar los autos encimados (el más pesado se mueve menos)
      const pen = minD - d
      a.x -= (nx * pen * ia) / (ia + ib)
      a.y -= (ny * pen * ia) / (ia + ib)
      b.x += (nx * pen * ib) / (ia + ib)
      b.y += (ny * pen * ib) / (ia + ib)

      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const vn = rvx * nx + rvy * ny
      if (vn >= 0) return // ya se separan
      const j = (-(1 + RESTIT) * vn) / (ia + ib)
      a.vx -= j * ia * nx
      a.vy -= j * ia * ny
      b.vx += j * ib * nx
      b.vy += j * ib * ny
      // roce tangencial: el choque de lado hace girar el auto
      const vt = -rvx * ny + rvy * nx
      a.w = clamp(a.w - vt * 0.01, -9, 9)
      b.w = clamp(b.w + vt * 0.01, -9, 9)

      const impact = -vn
      if (impact > 60) {
        a.kickBy = b.i
        a.kickT = g.t
        b.kickBy = a.i
        b.kickT = g.t
        a.flash = 1
        b.flash = 1
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        juice.burst(mx, my, ['#fde047', '#ffffff', '#fb923c'], {
          count: 6 + Math.min(14, Math.round(impact / 25)),
          speed: 90 + impact * 0.5,
          life: 0.35,
          size: 3,
        })
        juice.shake(clamp(impact / 900, 0.12, 0.45))
        if (impact > 300) {
          juice.freeze(50)
          sfx.crash()
        } else {
          tone({ freq: 260, to: 150, dur: 0.08, vol: 0.05, type: 'square' })
        }
      }
    }

    const checkFalls = () => {
      for (const c of g.cars) {
        if (c.state === 'alive' && Math.hypot(c.x - CX, c.y - CY) > g.ringR - 1) fall(c)
      }
    }

    const substep = (dt: number) => {
      const alive = g.cars.filter((c) => c.state === 'alive')
      for (const c of alive) {
        c.onOil = g.slicks.some(
          (s) => s.owner !== c.i && Math.hypot(c.x - s.x, c.y - s.y) < s.r + CAR_R * 0.4,
        )
      }
      // imán: jala a los rivales cercanos
      for (const m of alive) {
        if (m.magnet <= 0) continue
        for (const o of alive) {
          if (o === m) continue
          const dx = m.x - o.x
          const dy = m.y - o.y
          const d = Math.hypot(dx, dy)
          if (d > MAGNET_R || d < 1) continue
          const f = (420 * (1 - d / MAGNET_R) * dt) / Math.sqrt(o.mass)
          o.vx += (dx / d) * f
          o.vy += (dy / d) * f
        }
      }
      for (const c of alive) drive(c, dt)
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j])
      }
      checkFalls()
    }

    /** Estado por cuadro: turbo, aceite, escudo, imán y marcas de llanta. */
    const frameCars = (dt: number) => {
      for (const c of g.cars) {
        if (c.state !== 'alive') continue
        if (c.burst > 0) c.burst = Math.max(0, c.burst - dt)
        const holding = c.inp.turbo && c.inp.thr > 0.05 && c.gauge > 0.01
        if (holding) c.gauge = Math.max(0, c.gauge - dt * 0.5)
        else c.gauge = Math.min(1, c.gauge + dt * 0.12)
        const was = c.boosting
        c.boosting = c.burst > 0 || holding
        if (c.boosting && !was) sfx.boost()
        if (c.boosting) {
          juice.burst(c.x - Math.cos(c.h) * CAR_R, c.y - Math.sin(c.h) * CAR_R, ['#fb923c', '#fde047'], {
            count: 2,
            speed: 60,
            life: 0.25,
            size: 3,
            angle: c.h + Math.PI,
            arc: 0.6,
          })
        }
        c.mass = c.shield > 0 ? HEAVY : 1
        if (c.shield > 0) c.shield -= dt
        if (c.magnet > 0) c.magnet -= dt
        const speed = Math.hypot(c.vx, c.vy)
        if (c.oil > 0) {
          c.oil -= dt
          c.oilT -= dt
          if (c.oilT <= 0 && speed > 40) {
            g.slicks.push({
              x: c.x - Math.cos(c.h) * CAR_R * 1.2,
              y: c.y - Math.sin(c.h) * CAR_R * 1.2,
              r: 22,
              life: 7,
              owner: c.i,
            })
            c.oilT = 0.22
          }
        }
        if (c.slip > 60 || (c.onOil && speed > 60)) {
          const rx = c.x - Math.cos(c.h) * CAR_R * 0.7
          const ry = c.y - Math.sin(c.h) * CAR_R * 0.7
          if (!Number.isNaN(c.markX)) g.marks.push({ x1: c.markX, y1: c.markY, x2: rx, y2: ry })
          c.markX = rx
          c.markY = ry
        } else {
          c.markX = NaN
          c.markY = NaN
        }
      }
      if (g.marks.length > MAX_MARKS) g.marks.splice(0, g.marks.length - MAX_MARKS)
      for (const c of g.cars) c.flash = Math.max(0, c.flash - dt * 6)
    }

    const applyPickup = (c: Car, p: Pickup) => {
      const meta = PK[p.kind]
      if (p.kind === 'turbo') c.gauge = 1
      else if (p.kind === 'oil') {
        c.oil = 4.5
        c.oilT = 0
      } else if (p.kind === 'magnet') c.magnet = 5
      else c.shield = 7
      juice.burst(p.x, p.y, [meta.color, '#ffffff'], { count: 16, speed: 170, life: 0.45, size: 4 })
      juice.text(c.x, c.y - 22, meta.toast, meta.color, 8, 1)
      juice.flash(meta.color, 0.12)
      sfx.power()
    }

    const spawnPickup = () => {
      for (let tries = 0; tries < 8; tries++) {
        const a = Math.random() * TAU
        const r = Math.sqrt(Math.random()) * g.ringR * 0.78
        const x = CX + Math.cos(a) * r
        const y = CY + Math.sin(a) * r
        if (g.cars.some((c) => c.state === 'alive' && Math.hypot(c.x - x, c.y - y) < 48)) continue
        const q = Math.random()
        const kind: Kind = q < 0.35 ? 'turbo' : q < 0.6 ? 'oil' : q < 0.8 ? 'magnet' : 'shield'
        g.pickups.push({ kind, x, y, age: 0 })
        juice.burst(x, y, PK[kind].color, { count: 10, speed: 70, life: 0.4, size: 3 })
        return
      }
    }

    const pickupsStep = (dt: number) => {
      g.spawnT -= dt
      if (g.spawnT <= 0) {
        g.spawnT = 3.2 + Math.random() * 1.6
        if (g.pickups.length < 3) spawnPickup()
      }
      for (const p of g.pickups) p.age += dt
      const keep: Pickup[] = []
      for (const p of g.pickups) {
        const who = g.cars.find((c) => c.state === 'alive' && Math.hypot(c.x - p.x, c.y - p.y) < CAR_R + 12)
        if (who) applyPickup(who, p)
        else if (p.age < 11) keep.push(p)
      }
      g.pickups = keep
    }

    /** Cuenta regresiva del encogimiento, borde que se derrumba y muerte súbita en el mínimo. */
    const ringStep = (dt: number) => {
      const minR = R0 * MIN_RING
      const shrinking = g.ringTo > minR + 0.5
      if (shrinking) {
        const prev = g.ringT
        g.ringT -= dt
        if (prev >= WARN && g.ringT < WARN) tone({ freq: 880, dur: 0.12, vol: 0.05, type: 'square' })
        if (g.ringT <= 0) {
          g.steps++
          g.ringTo = Math.max(minR, g.ringTo - STEP * R0)
          g.ringT = Math.max(2.6, 5.2 - g.steps * 0.45)
          juice.shake(0.3)
          noise({ dur: 0.45, vol: 0.07, freq: 700 })
        }
      } else {
        // en el mínimo el ring sigue cerrándose despacio: nadie se queda eterno
        g.ringTo = Math.max(0, g.ringTo - dt * 2.5)
      }
      g.ringR += (g.ringTo - g.ringR) * Math.min(1, dt * 3.5)
      if (g.ringR - g.ringTo > 1) {
        // pedazos del borde que caen mientras el ring se retira
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * TAU
          const r = g.ringTo + Math.random() * (g.ringR - g.ringTo)
          juice.burst(CX + Math.cos(a) * r, CY + Math.sin(a) * r, ['#c4b5fd', '#f5f3ff', '#7c3aed'], {
            count: 1,
            speed: 30,
            life: 0.9,
            size: 4,
            gravity: 320,
            drag: 0.6,
            angle: a,
            arc: 0.4,
          })
        }
      }
      g.pickups = g.pickups.filter((p) => Math.hypot(p.x - CX, p.y - CY) < g.ringR - 8)
    }

    const update = (dt: number) => {
      g.t += dt
      g.phaseT += dt
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      for (const c of g.cars) if (c.state === 'falling') fallStep(c, dt)
      if (g.phase === 'menu' || g.phase === 'over') return

      if (g.phase === 'intro') {
        const idx = Math.min(3, Math.floor(g.phaseT / 0.75))
        if (idx !== introIdx) {
          introIdx = idx
          tone({ freq: idx === 3 ? 1320 : 520 + idx * 120, dur: 0.1, vol: 0.05, type: 'square' })
        }
        if (g.phaseT >= INTRO_T) {
          g.phase = 'play'
          g.phaseT = 0
        }
        return
      }

      if (g.phase === 'ko') {
        if (g.phaseT >= KO_T) finishRound()
        return
      }

      // play
      ringStep(dt)
      pickupsStep(dt)
      for (const c of g.cars) {
        if (c.state !== 'alive') continue
        if (c.slot >= 0) readHuman(c)
        else think(c, dt)
      }
      frameCars(dt)
      const vmax = Math.max(1, ...g.cars.map((c) => Math.hypot(c.vx, c.vy)))
      const n = clamp(Math.ceil((vmax * dt) / 3), 1, 10)
      for (let s = 0; s < n; s++) substep(dt / n)
      if (g.cars.filter((c) => c.state === 'alive').length <= 1) endRound()
    }

    startRef.current = (m: Mode) => {
      lastMode = m
      juice.reset()
      clearInputs()
      ptr.clear()
      g = newGame(m)
      startRound()
      sfx.start()
      sync()
    }
    menuRef.current = () => {
      g = newGame(lastMode)
      placeCars(g)
      g.phase = 'menu'
      juice.reset()
      sync()
    }

    // ---------- dibujo ----------
    const drawIcon = (kind: Kind) => {
      if (kind === 'turbo') {
        ctx.fillStyle = '#fde047'
        ctx.beginPath()
        ctx.moveTo(2, -7)
        ctx.lineTo(-4, 1)
        ctx.lineTo(0, 1)
        ctx.lineTo(-2, 7)
        ctx.lineTo(4, -1)
        ctx.lineTo(0, -1)
        ctx.closePath()
        ctx.fill()
      } else if (kind === 'oil') {
        ctx.fillStyle = '#1e1436'
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.lineTo(-5, 1)
        ctx.arc(0, 1, 5, Math.PI, 0, true)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#c4b5fd'
        ctx.beginPath()
        ctx.arc(-2, 0, 1.4, 0, TAU)
        ctx.fill()
      } else if (kind === 'magnet') {
        ctx.lineWidth = 3.5
        ctx.strokeStyle = '#f87171'
        ctx.beginPath()
        ctx.arc(0, 1, 5, Math.PI, 0)
        ctx.stroke()
        ctx.strokeStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.moveTo(-5, 1)
        ctx.lineTo(-5, 5)
        ctx.moveTo(5, 1)
        ctx.lineTo(5, 5)
        ctx.stroke()
      } else {
        ctx.fillStyle = 'rgba(103,232,249,0.35)'
        ctx.strokeStyle = '#67e8f9'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6
          const px = Math.cos(a) * 7
          const py = Math.sin(a) * 7
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }

    const drawCar = (c: Car) => {
      if (c.state === 'gone') return
      const falling = c.state === 'falling'
      const k = falling ? Math.max(0.05, 1 - c.out / FALL_T) : 1
      if (c.shield > 0 && !falling) {
        ctx.fillStyle = 'rgba(103,232,249,0.15)'
        ctx.beginPath()
        ctx.arc(c.x, c.y, CAR_R + 7, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = 'rgba(103,232,249,0.9)'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.lineDashOffset = -g.t * 20
        ctx.beginPath()
        ctx.arc(c.x, c.y, CAR_R + 7, 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      }
      ctx.save()
      ctx.globalAlpha = falling ? k : 1
      ctx.translate(c.x, c.y)
      if (!falling) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.ellipse(3, 4, CAR_R * 1.1, CAR_R * 0.9, 0, 0, TAU)
        ctx.fill()
      }
      ctx.rotate(c.h)
      ctx.scale(k, k)
      if (c.boosting && !falling) {
        ctx.fillStyle = '#fb923c'
        ctx.beginPath()
        ctx.moveTo(-CAR_R + 1, -4)
        ctx.lineTo(-CAR_R - 8 - Math.random() * 5, 0)
        ctx.lineTo(-CAR_R + 1, 4)
        ctx.closePath()
        ctx.fill()
      }
      // carrito chocón visto desde arriba: falda de goma, carrocería, asiento, conductor y antena
      const L = CAR_R * 1.25 // medio largo
      const Wd = CAR_R * 0.95 // medio ancho
      // falda de goma (parachoques que rodea todo)
      ctx.fillStyle = '#1e1b2e'
      rr(ctx, -L - 3, -Wd - 3, (L + 3) * 2, (Wd + 3) * 2, Wd + 3)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()
      // carrocería con brillo
      const body = ctx.createLinearGradient(0, -Wd, 0, Wd)
      body.addColorStop(0, shade(c.color, 0.35))
      body.addColorStop(0.5, c.color)
      body.addColorStop(1, shade(c.color, -0.3))
      ctx.fillStyle = body
      rr(ctx, -L, -Wd, L * 2, Wd * 2, Wd * 0.9)
      ctx.fill()
      // franja deportiva
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      rr(ctx, L * 0.15, -2, L * 0.75, 4, 2)
      ctx.fill()
      // asiento
      ctx.fillStyle = shade(c.color, -0.45)
      rr(ctx, -L * 0.75, -Wd * 0.62, L * 0.7, Wd * 1.24, 4)
      ctx.fill()
      // conductor: cabecita redonda con pelo
      ctx.fillStyle = '#fcd9b6'
      ctx.beginPath()
      ctx.arc(-L * 0.38, 0, Wd * 0.48, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#4a2c2a'
      ctx.beginPath()
      ctx.arc(-L * 0.46, 0, Wd * 0.46, Math.PI * 0.5, Math.PI * 1.5)
      ctx.fill()
      // volante
      ctx.strokeStyle = '#1e1b2e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(L * 0.05, 0, Wd * 0.32, -1.2, 1.2)
      ctx.stroke()
      // faros
      ctx.fillStyle = '#fef9c3'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(L - 2.5, s * Wd * 0.55, 2.2, 0, TAU)
        ctx.fill()
      }
      // antena con chispa (como en la feria)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-L * 0.85, 0)
      ctx.lineTo(-L * 1.05, 0)
      ctx.stroke()
      const spark = 0.6 + 0.4 * Math.sin(g.t * 30 + c.slot * 2)
      ctx.fillStyle = `rgba(253,224,71,${spark})`
      ctx.beginPath()
      ctx.arc(-L * 1.08, 0, 2.6, 0, TAU)
      ctx.fill()
      if (c.flash > 0) {
        ctx.globalAlpha *= c.flash * 0.7
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(0, 0, CAR_R + 2, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    const drawGauges = (pf2: string) => {
      const shown = g.mode === 'duo' ? [0, 1] : [0]
      ctx.font = `7px ${pf2}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const si of shown) {
        const c = g.cars.find((cc) => cc.slot === si)
        if (!c) continue
        const y = si === 0 ? H - 14 : 14
        const bw = 110
        const x0 = CX - bw / 2
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        rr(ctx, x0, y, bw, 6, 3)
        ctx.fill()
        if (c.gauge > 0.01) {
          ctx.fillStyle = c.color
          rr(ctx, x0, y, bw * c.gauge, 6, 3)
          ctx.fill()
        }
        const ready = c.gauge >= BURST_COST
        ctx.fillStyle = ready ? c.color : 'rgba(255,255,255,0.45)'
        ctx.fillText(ready ? 'TURBO LISTO' : 'TURBO', CX, si === 0 ? y - 8 : y + 10)
      }
    }

    const draw = () => {
      const minR = R0 * MIN_RING
      const rad = Math.max(0.5, g.ringR)
      ctx.save()
      juice.applyShake(ctx)
      // fondo
      const bg = ctx.createRadialGradient(CX, CY, R0 * 0.3, CX, CY, Math.max(W, H) * 0.75)
      bg.addColorStop(0, '#1d1333')
      bg.addColorStop(1, '#07040e')
      ctx.fillStyle = bg
      ctx.fillRect(-20, -20, W + 40, H + 40)
      // luces de feria alrededor de la arena
      const nBulbs = 28
      for (let i = 0; i < nBulbs; i++) {
        const a = (i / nBulbs) * TAU + g.t * 0.15
        const on = Math.floor(g.t * 3 + i) % 3 === 0
        const bx = CX + Math.cos(a) * (R0 + 22)
        const by = CY + Math.sin(a) * (R0 + 22)
        ctx.fillStyle = on ? ['#fde047', '#f472b6', '#22d3ee'][i % 3] : 'rgba(255,255,255,0.12)'
        ctx.beginPath()
        ctx.arc(bx, by, on ? 3.2 : 2.4, 0, TAU)
        ctx.fill()
      }
      // pista: piso metálico de feria a cuadros
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rad, 0, TAU)
      ctx.clip()
      const floor = ctx.createRadialGradient(CX, CY, 0, CX, CY, rad)
      floor.addColorStop(0, '#3b2f63')
      floor.addColorStop(1, '#1d1538')
      ctx.fillStyle = floor
      ctx.fillRect(CX - rad, CY - rad, rad * 2, rad * 2)
      const tile = 26
      ctx.fillStyle = 'rgba(255,255,255,0.035)'
      for (let ty = CY - rad - tile; ty < CY + rad + tile; ty += tile) {
        for (let tx = CX - rad - tile; tx < CX + rad + tile; tx += tile) {
          if ((Math.round((tx - CX) / tile) + Math.round((ty - CY) / tile)) % 2 === 0) ctx.fillRect(tx, ty, tile, tile)
        }
      }
      // estrella central de la feria
      ctx.fillStyle = 'rgba(244,114,182,0.12)'
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2
        const rr2 = i % 2 === 0 ? rad * 0.22 : rad * 0.1
        ctx.lineTo(CX + Math.cos(a) * rr2, CY + Math.sin(a) * rr2)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      if (g.mode === 'duo') {
        ctx.setLineDash([8, 8])
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'
        ctx.beginPath()
        ctx.moveTo(0, CY)
        ctx.lineTo(W, CY)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // marcas, aceite y objetos: recortados al ring
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rad, 0, TAU)
      ctx.clip()
      ctx.strokeStyle = 'rgba(12,8,20,0.32)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const m of g.marks) {
        ctx.moveTo(m.x1, m.y1)
        ctx.lineTo(m.x2, m.y2)
      }
      ctx.stroke()
      for (const s of g.slicks) {
        ctx.globalAlpha = Math.min(1, s.life / 2)
        ctx.fillStyle = 'rgba(14,10,24,0.9)'
        ctx.beginPath()
        ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = 'rgba(167,139,250,0.45)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(94,234,212,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(s.x - 4, s.y - 3, s.r * 0.5, s.r * 0.25, 0, 0, TAU)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      for (const p of g.pickups) {
        if (p.age > 8 && Math.floor(p.age * 8) % 2 === 0) continue
        const pk = PK[p.kind]
        const pulse = 1 + Math.sin(g.t * 6 + p.x) * 0.08
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.globalAlpha = 0.3
        ctx.fillStyle = pk.color
        ctx.beginPath()
        ctx.arc(0, 0, 17 * pulse, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = '#0b0714'
        ctx.beginPath()
        ctx.arc(0, 0, 12, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = pk.color
        ctx.lineWidth = 2.5
        ctx.stroke()
        drawIcon(p.kind)
        ctx.font = `8px ${pf}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillText(pk.label, 1, 26)
        ctx.fillStyle = pk.color
        ctx.fillText(pk.label, 0, 25)
        ctx.restore()
      }
      ctx.restore()

      // borde del ring: brilla y parpadea cuando se va a encoger
      const shrinking = g.ringTo > minR + 0.5
      const warn = g.phase === 'play' && shrinking && g.ringT < WARN
      const pulse = 0.5 + 0.5 * Math.sin(g.t * (warn ? 24 : 4))
      const edge = warn ? (pulse > 0.5 ? '#fef08a' : '#f472b6') : '#a855f7'
      ctx.save()
      ctx.lineWidth = warn ? 5 + pulse * 4 : 4
      ctx.strokeStyle = edge
      ctx.shadowColor = edge
      ctx.shadowBlur = warn ? 28 : 16
      ctx.beginPath()
      ctx.arc(CX, CY, rad, 0, TAU)
      ctx.stroke()
      ctx.restore()
      if (g.ringR - g.ringTo > 1) {
        ctx.strokeStyle = 'rgba(248,113,113,0.85)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(CX, CY, Math.max(0.5, g.ringTo), 0, TAU)
        ctx.stroke()
      }

      // campo magnético: anillos pulsantes y líneas hacia los rivales jalados
      for (const m of g.cars) {
        if (m.state !== 'alive' || m.magnet <= 0) continue
        const frac = (g.t * 1.2) % 1
        ctx.strokeStyle = `rgba(248,113,113,${(1 - frac) * 0.7})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(m.x, m.y, 22 + frac * 60, 0, TAU)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(248,113,113,0.45)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 5])
        for (const o of g.cars) {
          if (o === m || o.state !== 'alive') continue
          if (Math.hypot(o.x - m.x, o.y - m.y) > MAGNET_R) continue
          ctx.beginPath()
          ctx.moveTo(m.x, m.y)
          ctx.lineTo(o.x, o.y)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // en el menú la pista queda sola: los autos y sus nombres no compiten con el texto del overlay
      const showCars = g.phase !== 'menu' && g.phase !== 'over'
      if (showCars) for (const c of g.cars) drawCar(c)
      for (const c of g.cars) {
        if (!showCars || c.state === 'gone') continue
        ctx.font = `8px ${pf}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillText(c.name, c.x + 1, c.y - CAR_R - 9)
        ctx.fillStyle = c.color
        ctx.fillText(c.name, c.x, c.y - CAR_R - 10)
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (g.phase === 'intro') {
        const idx = Math.min(3, Math.floor(g.phaseT / 0.75))
        const frac = (g.phaseT - idx * 0.75) / 0.75
        ctx.globalAlpha = Math.max(0, 1 - frac * 0.6)
        ctx.font = `${Math.round(44 + (1 - frac) * 16)}px ${pf}`
        ctx.fillStyle = '#ffffff'
        ctx.fillText(['3', '2', '1', 'YA!'][idx], CX, CY)
        ctx.globalAlpha = 1
      }
      if (g.phase === 'ko' && g.phaseT < 0.9) {
        ctx.globalAlpha = 1 - g.phaseT / 0.9
        ctx.font = `${Math.round(36 + g.phaseT * 30)}px ${pf}`
        ctx.fillStyle = '#fef08a'
        ctx.fillText('KO', CX, CY)
        ctx.globalAlpha = 1
      }
      if (g.banner) {
        ctx.globalAlpha = Math.min(1, g.banner.t * 2.5)
        ctx.font = `14px ${pf}`
        const by = Math.max(24, CY - rad - 26)
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillText(g.banner.text, CX + 2, by + 2)
        ctx.fillStyle = g.banner.color
        ctx.fillText(g.banner.text, CX, by)
        ctx.globalAlpha = 1
      }
      if (g.phase === 'intro' || g.phase === 'play' || g.phase === 'ko') drawGauges(pf)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(4,6,14,0.72)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `24px ${pf}`
        ctx.fillText('PAUSA', CX, CY - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `9px ${pf}`
        ctx.fillText('P O TOCA PARA SEGUIR', CX, CY + 22)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // ---------- reacomodo al girar la pantalla ----------
    /** Los autos, objetos y marcas conservan su lugar relativo al centro del ring nuevo. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      const oldCX = CX
      const oldCY = CY
      const oldR0 = R0
      layout()
      if (W === oldW && H === oldH) return
      setupCanvas(canvas, W, H)
      const k = R0 / oldR0
      const mx = (x: number) => CX + (x - oldCX) * k
      const my = (y: number) => CY + (y - oldCY) * k
      for (const c of g.cars) {
        c.x = mx(c.x)
        c.y = my(c.y)
        c.vx *= k
        c.vy *= k
      }
      for (const p of g.pickups) {
        p.x = mx(p.x)
        p.y = my(p.y)
      }
      for (const s of g.slicks) {
        s.x = mx(s.x)
        s.y = my(s.y)
        s.r *= k
      }
      for (const m of g.marks) {
        m.x1 = mx(m.x1)
        m.y1 = my(m.y1)
        m.x2 = mx(m.x2)
        m.y2 = my(m.y2)
      }
      g.ringR *= k
      g.ringTo *= k
      for (const p of juice.particles) {
        p.x = mx(p.x)
        p.y = my(p.y)
      }
      for (const t of juice.texts) {
        t.x = mx(t.x)
        t.y = my(t.y)
      }
      pauseIfPlaying()
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
      if (jp.has('pause') && (g.phase === 'intro' || g.phase === 'play' || g.phase === 'ko')) {
        g.paused = !g.paused
        if (g.paused) clearInputs()
      }
      if (jp.has('action')) {
        if (g.phase === 'menu') startRef.current(lastMode)
        else if (g.phase === 'over' && g.phaseT > 0.6) startRef.current(lastMode)
        else if (g.paused) g.paused = false
      }
      jp.clear()
      if (!g.paused) {
        const dtGame = juice.update(dt)
        if (dtGame > 0) update(dtGame)
      }
      draw()
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pauseIfPlaying)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef])

  const meta = metaOf(ui.mode)
  const hud = (
    <Hud>
      {ui.phase === 'menu' ? (
        <span className="text-white/60">CHOCONES</span>
      ) : (
        <>
          <span className="text-white/70">Ronda {ui.round}</span>
          <span className="flex items-center gap-2.5">
            {meta.map((m, i) => (
              <span key={m.name} className="flex items-center gap-1" style={{ color: m.color }}>
                <i className="inline-block h-2 w-2 rounded-sm" style={{ background: m.color }} />
                {ui.wins[i]}
              </span>
            ))}
          </span>
        </>
      )}
    </Hud>
  )

  const mw = ui.matchWinner ?? 0
  // contra bots la marca es la del jugador (índice 0), aunque gane un bot
  const me = ui.mode === 'duo' ? mw : 0
  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={360}
        height={560}
        className="rounded-xl border border-yellow-400/30 bg-[#0b0714]"
        hud={hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="CHOCONES"
            accent={ACCENT}
            subtitle="Saca al otro del ring. Mejor de 5 rondas."
            hint="Elige un modo o pulsa ESPACIO"
            touchHint="Elige un modo"
          >
            <div className="grid grid-cols-2 gap-2">
              {MENU.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    startRef.current(m.mode)
                  }}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-black transition active:scale-95"
                  style={{ background: m.color, boxShadow: `0 0 20px ${m.color}66` }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="max-w-[17rem] text-[11px] leading-relaxed text-white/60">
              Celular: arrastra para conducir; dos dedos o doble toque = turbo. En 2 jugadores, cada quien usa su
              mitad. Teclado: J1 WASD + Shift, J2 flechas + Enter.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <>
            <GameOverOverlay
              title={
                ui.mode === 'duo' ? `GANA ${meta[mw].name}` : mw === 0 ? 'VICTORIA' : 'DERROTA'
              }
              accent={meta[mw].color}
              score={(ui.wins[me] ?? 0) * 100 + (ui.kos[me] ?? 0) * 50}
              best={0}
              stats={[
                { label: 'Marcador', value: ui.wins.join(' - ') },
                { label: 'KOs', value: ui.kos[me] ?? 0 },
              ]}
              onRestart={() => startRef.current(ui.mode)}
              touchHint="Toca el botón para seguir"
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
    </div>
  )
}
