'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys } from './use-keys'
import { useFollowKeys } from './gestures'
import { loadBest, saveBest, aabb, rr, renderScale } from './game-utils'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { StartOverlay, GameOverOverlay, Hud, useIsTouch } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

const ID = 'traffic-racer'
const ACCENT = '#e85d5d'

// ---------------------------------------------------------------------------
// Dimensiones (vertical, pensado para el celular)
// ---------------------------------------------------------------------------
const W0 = 380
const H0 = 520
// Carretera lógica: se ajusta a la pantalla (ver layout). El auto del jugador va cerca del fondo.
let W = W0
let H = H0
const LANES = 4
const LANE_W = 68
const ROAD_W = LANES * LANE_W
let ROAD_X = (W0 - ROAD_W) / 2
const PW = 36
const PH = 62
let PLAYER_Y = H0 - 128
const MAX_VX = 270
const NM_DIST = 22
const CELL = 64

const laneCenter = (l: number) => ROAD_X + l * LANE_W + LANE_W / 2

/** Ajusta la carretera al área de la pantalla: más espacio arriba y a los lados. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  ROAD_X = (W - ROAD_W) / 2
  PLAYER_Y = H - 128
  publishLogical(f)
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

// zonas por distancia recorrida (px)
const ZONE_LEN = [16000, 16000, 10000]
const CYCLE = 42000
const ZONE_NAMES = ['CIUDAD', 'DESIERTO', 'TUNEL']

type CarKind = 'sedan' | 'truck' | 'bike' | 'police'

interface Car {
  kind: CarKind
  x: number
  y: number
  w: number
  h: number
  speed: number
  boost: number // >0: persigue desde atrás (moto / policía)
  color: string
  // cambio de carril
  changer: boolean
  plan: 0 | 1 | 2
  planT: number
  dir: number
  fromX: number
  toX: number
  // cercanías
  alongside: boolean
  minGap: number
  awarded: boolean
  rot: number
  knock: number
}

interface Item {
  kind: 'coin' | 'can'
  x: number
  y: number
  t: number
}

interface Warn {
  lane: number
  t: number
  kind: 'bike' | 'police'
}

interface Streak {
  x: number
  y: number
  len: number
  sp: number
  a: number
}

interface Race {
  started: boolean
  paused: boolean
  dead: boolean
  deathT: number
  time: number
  px: number
  vx: number
  yOff: number
  speed: number
  dist: number
  bonus: number
  turbo: number
  boosting: boolean
  boostLock: boolean
  fov: number
  chain: number
  chainT: number
  bestChain: number
  nearMisses: number
  coins: number
  cars: Car[]
  items: Item[]
  warns: Warn[]
  streaks: Streak[]
  nextCar: number
  nextCoins: number
  nextCan: number
  nextBike: number
  nextPolice: number
  nextRush: number
  rushT: number
  zone: number
  banner: { text: string; sub: string; color: string; t: number } | null
  sirenT: number
  hitCar: Car | null
  hintT: number
}

function initial(started: boolean): Race {
  const streaks: Streak[] = []
  for (let i = 0; i < 26; i++) {
    streaks.push({ x: Math.random() * W, y: Math.random() * H, len: 20 + Math.random() * 50, sp: 0.8 + Math.random() * 0.9, a: 0.06 + Math.random() * 0.16 })
  }
  return {
    started,
    paused: false,
    dead: false,
    deathT: 0,
    time: 0,
    px: laneCenter(1) + LANE_W / 2 - PW / 2,
    vx: 0,
    yOff: 0,
    speed: started ? 260 : 110,
    dist: 0,
    bonus: 0,
    turbo: 0.35,
    boosting: false,
    boostLock: false,
    fov: 0,
    chain: 0,
    chainT: 0,
    bestChain: 0,
    nearMisses: 0,
    coins: 0,
    cars: [],
    items: [],
    warns: [],
    streaks,
    nextCar: 120,
    nextCoins: 700,
    nextCan: 6500,
    nextBike: 5200,
    nextPolice: 11000,
    nextRush: 15000,
    rushT: 0,
    zone: 0,
    banner: null,
    sirenT: 0,
    hitCar: null,
    hintT: started ? 5 : 0,
  }
}

// ---------------------------------------------------------------------------
// Zonas: paletas
// ---------------------------------------------------------------------------
type RGB = [number, number, number]
interface ZonePal {
  bg: RGB
  road: RGB
  roadHi: RGB
  line: RGB
  curbA: RGB
  curbB: RGB
  tint: RGB
  tintA: number
}
const ZONES: ZonePal[] = [
  { bg: [20, 19, 31], road: [52, 55, 63], roadHi: [66, 70, 79], line: [242, 242, 236], curbA: [232, 76, 76], curbB: [242, 242, 236], tint: [20, 10, 50], tintA: 0.12 },
  { bg: [190, 122, 68], road: [76, 70, 72], roadHi: [92, 85, 87], line: [250, 236, 204], curbA: [216, 90, 60], curbB: [244, 230, 196], tint: [255, 120, 40], tintA: 0.17 },
  { bg: [10, 10, 14], road: [40, 42, 47], roadHi: [56, 59, 66], line: [236, 222, 160], curbA: [242, 200, 40], curbB: [28, 28, 32], tint: [0, 0, 12], tintA: 0.32 },
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const rgb = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

function zoneAt(d: number): { idx: number; start: number; end: number; k: number } {
  const k = Math.floor(d / CYCLE)
  let pos = d - k * CYCLE
  let acc = 0
  for (let i = 0; i < ZONE_LEN.length; i++) {
    if (pos < acc + ZONE_LEN[i]) return { idx: i, start: k * CYCLE + acc, end: k * CYCLE + acc + ZONE_LEN[i], k }
    acc += ZONE_LEN[i]
  }
  pos = 0
  return { idx: 0, start: k * CYCLE, end: k * CYCLE + ZONE_LEN[0], k }
}

function palFor(d: number): ZonePal {
  const z = zoneAt(d)
  const next = ZONES[(z.idx + 1) % ZONES.length]
  const cur = ZONES[z.idx]
  const win = 700
  const t = clamp((d - (z.end - win)) / win, 0, 1)
  if (t <= 0) return cur
  const s = t * t * (3 - 2 * t)
  return {
    bg: mixRGB(cur.bg, next.bg, s),
    road: mixRGB(cur.road, next.road, s),
    roadHi: mixRGB(cur.roadHi, next.roadHi, s),
    line: mixRGB(cur.line, next.line, s),
    curbA: mixRGB(cur.curbA, next.curbA, s),
    curbB: mixRGB(cur.curbB, next.curbB, s),
    tint: mixRGB(cur.tint, next.tint, s),
    tintA: lerp(cur.tintA, next.tintA, s),
  }
}

const hash = (n: number) => {
  let h = Math.imul(n | 0, 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const CAR_COLORS = ['#4C8DE8', '#58C27D', '#E8B54C', '#B06CE8', '#E87A4C', '#7DC4E8', '#C4C9D4', '#E85DA0']
const TRUCK_COLORS = ['#e8e8ea', '#d9b45a', '#6fa8dc', '#c0c4cc']
const BUILD_COLORS = ['#232338', '#2b2540', '#1f2d3d', '#33263a', '#262a40']
const NEON = ['#ff3d9a', '#3df0ff', '#ffd23d', '#7dff6a', '#b06cff']

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, ((n >> 16) & 255) + amt)
  const g = Math.min(255, ((n >> 8) & 255) + amt)
  const b = Math.min(255, (n & 255) + amt)
  return `rgb(${r},${g},${b})`
}
function darken(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 255) - amt)
  const g = Math.max(0, ((n >> 8) & 255) - amt)
  const b = Math.max(0, (n & 255) - amt)
  return `rgb(${r},${g},${b})`
}

function Tips() {
  const touch = useIsTouch()
  return (
    <ul className="max-w-[17rem] space-y-1 text-left text-xs leading-snug text-white/70">
      <li>
        <b className="text-white">{touch ? 'Cruceta' : '← → / A D'}</b> para mover el coche con suavidad.
      </li>
      <li>
        <b className="text-white">Roza a otros coches</b> sin chocar: encadena CERCAS y llena el turbo.
      </li>
      <li>
        <b className="text-white">{touch ? 'Botón A' : 'ESPACIO / ↑'}</b> activa el turbo. <b className="text-white">↓</b> frena.
      </li>
      <li className="text-white/55">Junta monedas y bidones de gasolina.</li>
    </ul>
  )
}

export default function TrafficRacer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [juice] = useState(() => new Juice(11))
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [kmh, setKmh] = useState(0)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ km: '0.00', nm: 0, chain: 0, coins: 0 })

  const R = useRef<Race>(initial(false))
  // Un dedo: el auto lo sigue. Un segundo dedo en cualquier parte: turbo.
  const follow = useFollowKeys(virtualPress, virtualRelease, {
    worldW: () => W,
    targetX: () => R.current.px + PW / 2,
    dead: 8,
  })
  const boostRef = useRef<number | null>(null)
  const touch = {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (boostRef.current === null && follow.active()) {
        boostRef.current = e.pointerId
        virtualPress('action')
        return
      }
      follow.handlers.onPointerDown(e)
    },
    onPointerMove: follow.handlers.onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (boostRef.current === e.pointerId) {
        boostRef.current = null
        virtualRelease('action')
        return
      }
      follow.handlers.onPointerUp(e)
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (boostRef.current === e.pointerId) {
        boostRef.current = null
        virtualRelease('action')
        return
      }
      follow.handlers.onPointerCancel(e)
    },
  }
  const scoreRef = useRef(0)
  const phaseRef = useRef<'start' | 'play' | 'over'>('start')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest(ID))
  }, [])

  const begin = useCallback(() => {
    R.current = initial(true)
    juice.reset()
    scoreRef.current = 0
    setScore(0)
    setKmh(0)
    setNewBest(false)
    phaseRef.current = 'play'
    setPhase('play')
    sfx.start()
  }, [juice])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    R.current = initial(false)
    const dpr = renderScale()
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) throw new Error('Canvas 2D no disponible')
    const ctx = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pixVar = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    const PIX = pixVar ? `${pixVar}, monospace` : 'monospace'

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let hudT = 0

    // ------------------ sprites de brillo ------------------
    const makeGlow = (r: number, g: number, b: number) => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const x = c.getContext('2d')
      if (x) {
        const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
        gr.addColorStop(0, `rgba(${r},${g},${b},1)`)
        gr.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`)
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
        x.fillStyle = gr
        x.fillRect(0, 0, 64, 64)
      }
      return c
    }
    const glows = {
      warm: makeGlow(255, 214, 140),
      red: makeGlow(255, 40, 40),
      blue: makeGlow(60, 110, 255),
      cyan: makeGlow(80, 230, 255),
      orange: makeGlow(255, 150, 40),
    }
    const glow = (g: HTMLCanvasElement, x: number, y: number, r: number, a: number) => {
      ctx.globalAlpha = a
      ctx.drawImage(g, x - r, y - r, r * 2, r * 2)
    }

    const makeVignette = (color: string) => {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const x = c.getContext('2d')
      if (x) {
        const gr = x.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72)
        gr.addColorStop(0, 'rgba(0,0,0,0)')
        gr.addColorStop(1, color)
        x.fillStyle = gr
        x.fillRect(0, 0, W, H)
      }
      return c
    }
    // Viñetas a tamaño de pantalla: se rehacen al girar (ver relayoutLive).
    let vigDark = makeVignette('rgba(0,0,0,0.55)')
    let vigTurbo = makeVignette('rgba(90,220,255,0.55)')

    // ------------------ lógica ------------------
    const scoreOf = (s: Race) => Math.floor(s.dist / 8) + s.bonus

    const laneOf = (x: number, w: number) => clamp(Math.floor((x + w / 2 - ROAD_X) / LANE_W), 0, LANES - 1)

    /** ¿carril libre en la franja superior? (incluye coches que van a cambiarse a él) */
    const laneBusy = (s: Race, lane: number, yMax = 280, yMin = -400) => {
      for (const c of s.cars) {
        if (c.boost > 0) continue
        if (c.y > yMax || c.y + c.h < yMin) continue
        const lo = c.plan > 0 ? Math.min(c.fromX, c.toX) : c.x
        const hi = (c.plan > 0 ? Math.max(c.fromX, c.toX) : c.x) + c.w
        const l0 = laneOf(lo, 0.1)
        const l1 = laneOf(hi - 0.1, 0.1)
        if (lane >= l0 && lane <= l1) return true
      }
      return false
    }

    const makeCar = (kind: CarKind, lane: number, y: number, s: Race): Car => {
      let w = 38
      let h = 66
      let speed = 120 + Math.random() * 110
      let color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0]
      let boost = 0
      if (kind === 'truck') {
        w = 44
        h = 124
        speed = 90 + Math.random() * 40
        color = TRUCK_COLORS[(Math.random() * TRUCK_COLORS.length) | 0]
      } else if (kind === 'bike') {
        w = 16
        h = 42
        boost = 190 + Math.random() * 40
        speed = s.speed + boost
        color = '#2b2f3a'
      } else if (kind === 'police') {
        w = 38
        h = 66
        boost = 250
        speed = s.speed + boost
        color = '#f2f4f8'
      }
      const x = laneCenter(lane) - w / 2
      return {
        kind,
        x,
        y,
        w,
        h,
        speed,
        boost,
        color,
        changer: false,
        plan: 0,
        planT: 0,
        dir: 0,
        fromX: x,
        toX: x,
        alongside: false,
        minGap: 999,
        awarded: false,
        rot: 0,
        knock: 0,
      }
    }

    const banner = (s: Race, text: string, sub: string, color: string, t = 2) => {
      s.banner = { text, sub, color, t }
    }

    const spawnTraffic = (s: Race) => {
      const free: number[] = []
      for (let l = 0; l < LANES; l++) if (!laneBusy(s, l, 250)) free.push(l)
      if (free.length <= 1) return
      const km = s.dist / 8
      // pared con hueco
      if (km > 1800 && free.length === LANES && Math.random() < 0.1) {
        const gap = (Math.random() * LANES) | 0
        for (let l = 0; l < LANES; l++) {
          if (l === gap) continue
          if (Math.random() < 0.85) {
            const c = makeCar('sedan', l, -90 - Math.random() * 24, s)
            c.speed = 130 + Math.random() * 40
            s.cars.push(c)
          }
        }
        return
      }
      const lane = free[(Math.random() * free.length) | 0]
      let kind: CarKind = 'sedan'
      if (km > 380 && Math.random() < 0.13 && free.length >= 3) kind = 'truck'
      const c = makeCar(kind, lane, kind === 'truck' ? -150 : -90, s)
      if (kind === 'sedan' && km > 300 && Math.random() < Math.min(0.4, 0.12 + km * 0.00012)) c.changer = true
      s.cars.push(c)
    }

    const spawnCoins = (s: Race) => {
      const free: number[] = []
      for (let l = 0; l < LANES; l++) if (!laneBusy(s, l, 300)) free.push(l)
      if (free.length === 0) return
      const lane = free[(Math.random() * free.length) | 0]
      const diag = Math.random() < 0.4
      const n = diag ? 6 : 5
      const side = lane < LANES - 1 && free.includes(lane + 1) ? 1 : lane > 0 && free.includes(lane - 1) ? -1 : 0
      for (let i = 0; i < n; i++) {
        let x = laneCenter(lane)
        if (diag && side !== 0) {
          const u = i / (n - 1)
          x = lerp(laneCenter(lane), laneCenter(lane + side), u * u * (3 - 2 * u))
        }
        s.items.push({ kind: 'coin', x, y: -30 - i * 42, t: i * 0.35 })
      }
    }

    const spawnCan = (s: Race) => {
      const free: number[] = []
      for (let l = 0; l < LANES; l++) if (!laneBusy(s, l, 300)) free.push(l)
      if (free.length === 0) return
      const lane = free[(Math.random() * free.length) | 0]
      s.items.push({ kind: 'can', x: laneCenter(lane), y: -40, t: 0 })
    }

    const gainTurbo = (s: Race, amt: number) => {
      s.turbo = Math.min(1, s.turbo + amt)
    }

    const registerNear = (s: Race, c: Car) => {
      c.awarded = true
      s.nearMisses++
      s.chain = s.chainT > 0 ? s.chain + 1 : 1
      s.chainT = 3.2
      s.bestChain = Math.max(s.bestChain, s.chain)
      const mult = Math.min(8, s.chain)
      const base = c.kind === 'bike' || c.kind === 'police' ? 50 : c.kind === 'truck' ? 35 : 25
      const pts = base * mult * (s.boosting ? 2 : 1)
      s.bonus += pts
      gainTurbo(s, 0.1 + 0.025 * Math.min(6, s.chain))
      const cx = s.px + PW / 2
      juice.text(cx, PLAYER_Y - 18 - Math.min(40, s.chain * 6), `¡CERCA! x${s.chain}`, s.chain >= 4 ? '#ffd23d' : '#7df9ff', 10 + Math.min(4, s.chain), 1)
      juice.text(cx, PLAYER_Y + 6, `+${pts}`, '#ffffff', 8, 0.8)
      juice.burst(c.x + c.w / 2 + (cx > c.x + c.w / 2 ? c.w / 2 : -c.w / 2), c.y + c.h / 2, ['#ffd23d', '#ffffff', '#7df9ff'], { count: 8, speed: 140, life: 0.3, size: 3, drag: 4 })
      juice.shake(0.1 + Math.min(0.2, s.chain * 0.03))
      s.fov = Math.min(1, s.fov + 0.25)
      const f = 520 + Math.min(8, s.chain) * 70
      tone({ freq: f, to: f * 1.5, dur: 0.12, vol: 0.045, type: 'sine' })
      if (s.chain >= 3) {
        tone({ freq: 330, dur: 0.1, vol: 0.02, type: 'sawtooth', delay: 0.05 })
        tone({ freq: 415, dur: 0.14, vol: 0.02, type: 'sawtooth', delay: 0.05 })
      }
    }

    const crash = (s: Race, c: Car) => {
      s.dead = true
      s.deathT = 0
      s.hitCar = c
      s.boosting = false
      s.chain = 0
      s.chainT = 0
      const side = s.px + PW / 2 < c.x + c.w / 2 ? -1 : 1
      c.knock = -side
      s.vx = side * 190
      juice.freeze(100)
      juice.shake(0.95)
      juice.flash('#ffffff', 0.55)
      const hx = clamp(s.px + PW / 2, c.x, c.x + c.w)
      const hy = clamp(PLAYER_Y + PH / 2, c.y, c.y + c.h)
      juice.burst(hx, hy, ['#ffd23d', '#ff9a2e', '#ffffff'], { count: 26, speed: 330, life: 0.55, size: 3, drag: 2.2, gravity: 200 })
      juice.burst(hx, hy, [c.color, '#e83a3a', '#444851'], { count: 14, speed: 200, life: 0.8, size: 5, gravity: 300 })
      sfx.crash()
      const sc = scoreOf(s)
      scoreRef.current = sc
      setScore(sc)
      if (saveBest(ID, sc)) setNewBest(true)
      setBest((b) => Math.max(b, sc))
    }

    // ------------------ paso de simulación ------------------
    const step = (real: number) => {
      const s = R.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current

      if (jp.has('pause') && s.started && !s.dead) {
        s.paused = !s.paused
        sfx.pause()
        return
      }
      if (s.paused) return

      const goKey = jp.has('action') || jp.has('up') || jp.has('left') || jp.has('right')
      if (!s.started) {
        if (goKey) {
          begin()
          return
        }
      } else if (s.dead && s.deathT > 0.5 && (jp.has('action') || jp.has('up'))) {
        begin()
        return
      }

      const dt = juice.update(real)
      if (dt <= 0) return
      s.time += dt

      // ----- fondo siempre en movimiento -----
      if (!s.started) {
        s.dist += s.speed * dt
        return
      }

      // ----- muerte -----
      if (s.dead) {
        s.deathT += dt
        s.speed *= Math.exp(-dt * 3.2)
        s.dist += s.speed * dt
        s.px += s.vx * dt
        s.vx *= Math.exp(-dt * 1.6)
        s.fov = Math.max(0, s.fov - dt * 2)
        if (s.hitCar) {
          s.hitCar.x += s.hitCar.knock * 150 * dt
          s.hitCar.rot += s.hitCar.knock * 5 * dt
        }
        for (const c of s.cars) c.y += (s.speed - c.speed) * dt
        if (s.deathT < 1.1 && Math.random() < 0.6) {
          juice.burst(s.px + PW / 2, PLAYER_Y + 6, ['#555a64', '#7a808c', '#2e3138'], { count: 1, speed: 40, angle: -Math.PI / 2, arc: 1, life: 0.9, size: 7, gravity: -20, drag: 1.2 })
        }
        if (s.deathT > 0.85 && phaseRef.current !== 'over') {
          phaseRef.current = 'over'
          setStats({ km: (s.dist / 8000).toFixed(2), nm: s.nearMisses, chain: s.bestChain, coins: s.coins })
          setScore(scoreRef.current)
          setPhase('over')
          sfx.gameOver()
        }
        return
      }

      // ----- entradas -----
      const left = pressed.has('left')
      const right = pressed.has('right')
      const wantBoost = pressed.has('up') || pressed.has('action')
      const braking = pressed.has('down')

      // dirección con aceleración suave
      const dir = (right ? 1 : 0) - (left ? 1 : 0)
      const accel = dir !== 0 ? 10 : 13
      s.vx += (dir * MAX_VX - s.vx) * Math.min(1, dt * accel)
      s.px += s.vx * dt
      const minX = ROAD_X + 4
      const maxX = ROAD_X + ROAD_W - PW - 4
      if (s.px < minX) {
        s.px = minX
        if (s.vx < 0) s.vx = 0
      } else if (s.px > maxX) {
        s.px = maxX
        if (s.vx > 0) s.vx = 0
      }

      // turbo
      if (!wantBoost) s.boostLock = false
      if (s.boosting && (!wantBoost || s.turbo <= 0)) {
        s.boosting = false
        if (s.turbo <= 0) s.boostLock = true
      }
      if (!s.boosting && wantBoost && !s.boostLock && s.turbo > 0.1) {
        s.boosting = true
        sfx.boost()
        noise({ dur: 0.25, vol: 0.04, freq: 1800 })
        juice.flash('#7df9ff', 0.18)
        juice.shake(0.2)
      }
      if (s.boosting) {
        s.turbo = Math.max(0, s.turbo - dt * 0.26)
        if (Math.random() < 0.9) {
          juice.burst(s.px + PW / 2 + (Math.random() * 14 - 7), PLAYER_Y + PH + 4, ['#7df9ff', '#ffffff', '#ffb347'], { count: 1, speed: 160, angle: Math.PI / 2, arc: 0.5, life: 0.28, size: 4, drag: 2 })
        }
      }

      // velocidad
      const km = s.dist / 8
      const base = Math.min(520, 290 + s.dist * 0.0085)
      const target = base + (s.boosting ? 170 : 0) - (braking ? 130 : 0)
      s.speed += (target - s.speed) * Math.min(1, dt * (s.boosting ? 3 : 1.7))
      s.speed = Math.max(160, s.speed)
      s.dist += s.speed * dt
      s.hintT = Math.max(0, s.hintT - dt)
      const fovT = clamp((s.speed - 340) / 330, 0, 1)
      s.fov += (fovT - s.fov) * Math.min(1, dt * 3)
      const yTarget = s.boosting ? -8 : braking ? 6 : 0
      s.yOff += (yTarget - s.yOff) * Math.min(1, dt * 7)

      if (s.chainT > 0) {
        s.chainT -= dt
        if (s.chainT <= 0) s.chain = 0
      }
      if (s.banner) {
        s.banner.t -= dt
        if (s.banner.t <= 0) s.banner = null
      }

      // zona
      const z = zoneAt(s.dist)
      if (z.idx !== s.zone) {
        s.zone = z.idx
        banner(s, ZONE_NAMES[z.idx], 'NUEVA ZONA', '#ffffff', 2.2)
        tone({ freq: 523, dur: 0.1, vol: 0.04, type: 'triangle' })
        tone({ freq: 784, dur: 0.16, vol: 0.04, type: 'triangle', delay: 0.1 })
      }

      // ----- eventos -----
      if (s.rushT > 0) {
        s.rushT -= dt
        if (s.rushT <= 0) banner(s, 'TRAFICO NORMAL', 'RESPIRA', '#9be8a0', 1.6)
      }
      if (s.dist >= s.nextRush) {
        s.nextRush = s.dist + 22000 + Math.random() * 8000
        s.rushT = 9
        banner(s, 'HORA PICO', 'MAS TRAFICO, MAS MONEDAS', '#ffd23d', 2.4)
        sfx.siren()
      }
      if (s.dist >= s.nextBike) {
        s.nextBike = s.dist + 6500 + Math.random() * 4000
        s.warns.push({ lane: laneOf(s.px, PW), t: 1.2, kind: 'bike' })
      }
      if (s.dist >= s.nextPolice) {
        s.nextPolice = s.dist + 15000 + Math.random() * 7000
        s.warns.push({ lane: laneOf(s.px, PW), t: 1.5, kind: 'police' })
        banner(s, '¡POLICIA!', 'APARTATE DEL CARRIL', '#ff5d5d', 1.8)
      }
      for (const w of s.warns) {
        const prev = w.t
        w.t -= dt
        if (Math.floor(prev * 6) !== Math.floor(w.t * 6)) tone({ freq: w.kind === 'police' ? 880 : 1100, dur: 0.05, vol: 0.03, type: 'square' })
        if (w.t <= 0) {
          const c = makeCar(w.kind === 'bike' ? 'bike' : 'police', w.lane, H + 90, s)
          s.cars.push(c)
          if (w.kind === 'police') sfx.siren()
        }
      }
      s.warns = s.warns.filter((w) => w.t > 0)

      // ----- generación -----
      if (s.dist >= s.nextCar) {
        spawnTraffic(s)
        const rush = s.rushT > 0 ? 0.55 : 1
        s.nextCar = s.dist + Math.max(120, 300 - km * 0.05) * (0.7 + Math.random() * 0.6) * rush
      }
      if (s.dist >= s.nextCoins) {
        spawnCoins(s)
        s.nextCoins = s.dist + (s.rushT > 0 ? 700 : 1300) + Math.random() * 900
      }
      if (s.dist >= s.nextCan) {
        spawnCan(s)
        s.nextCan = s.dist + 8000 + Math.random() * 4000
      }

      // ----- coches -----
      const pcx = s.px + PW / 2
      const py = PLAYER_Y + s.yOff
      let policeOn = false
      for (const c of s.cars) {
        if (c.boost > 0) c.speed = s.speed + c.boost
        c.y += (s.speed - c.speed) * dt
        if (c.kind === 'police') policeOn = true

        // cambio de carril con intermitente
        if (c.changer && c.plan === 0 && c.y > 20 && c.y < 200 && Math.random() < dt * 1.4) {
          const l = laneOf(c.x, c.w)
          const dir = Math.random() < 0.5 ? -1 : 1
          const t = l + dir
          if (t >= 0 && t < LANES && !laneBusy(s, t, c.y + c.h + 90, c.y - 90)) {
            c.plan = 1
            c.planT = 0.95
            c.dir = dir
            c.fromX = c.x
            c.toX = laneCenter(t) - c.w / 2
          } else c.changer = false
        } else if (c.plan === 1) {
          c.planT -= dt
          if (c.planT <= 0) {
            c.plan = 2
            c.planT = 0.6
          }
        } else if (c.plan === 2) {
          c.planT -= dt
          const u = 1 - clamp(c.planT / 0.6, 0, 1)
          c.x = lerp(c.fromX, c.toX, u * u * (3 - 2 * u))
          if (c.planT <= 0) {
            c.plan = 0
            c.changer = false
            c.x = c.toX
          }
        }

        // cercanías
        const vOverlap = c.y < py + PH + 6 && c.y + c.h > py - 6
        if (vOverlap) {
          const gap = Math.abs(c.x + c.w / 2 - pcx) - (c.w + PW) / 2
          if (gap < c.minGap) c.minGap = gap
          c.alongside = true
        } else if (c.alongside && !c.awarded) {
          c.alongside = false
          if (c.minGap > 0 && c.minGap < NM_DIST) registerNear(s, c)
          else c.awarded = true
        }

        // colisión
        if (aabb(s.px + 5, py + 5, PW - 10, PH - 10, c.x + 3, c.y + 3, c.w - 6, c.h - 6)) {
          crash(s, c)
          return
        }
      }
      s.cars = s.cars.filter((c) => c.y < H + 220 && c.y + c.h > -420 && !(c.boost > 0 && c.y + c.h < PLAYER_Y - 150))

      // sirena
      if (policeOn) {
        s.sirenT -= dt
        if (s.sirenT <= 0) {
          s.sirenT = 0.42
          tone({ freq: 760, to: 980, dur: 0.18, vol: 0.022, type: 'square' })
        }
      }

      // ----- objetos -----
      for (const it of s.items) {
        it.y += s.speed * dt
        it.t += dt
        const r = it.kind === 'coin' ? 9 : 12
        if (aabb(s.px + 2, py + 2, PW - 4, PH - 4, it.x - r, it.y - r, r * 2, r * 2)) {
          it.y = 9999
          if (it.kind === 'coin') {
            s.coins++
            s.bonus += 10
            gainTurbo(s, 0.025)
            const f = 880 + Math.min(10, s.coins % 12) * 40
            tone({ freq: f, dur: 0.06, vol: 0.035, type: 'square' })
            tone({ freq: f * 1.5, dur: 0.08, vol: 0.03, type: 'square', delay: 0.045 })
            juice.burst(it.x, py - 6, ['#ffd23d', '#fff3b0'], { count: 4, speed: 80, life: 0.3, size: 3 })
          } else {
            s.bonus += 75
            gainTurbo(s, 0.4)
            juice.text(it.x, py - 16, 'GASOLINA +TURBO', '#7df9ff', 8, 1.1)
            juice.burst(it.x, py, ['#7df9ff', '#ffffff', '#ffd23d'], { count: 16, speed: 170, life: 0.5, size: 4 })
            juice.flash('#7df9ff', 0.14)
            sfx.power()
            sfx.potion()
          }
        }
      }
      s.items = s.items.filter((it) => it.y < H + 60)

      // humo / vibración leve se calculan en draw; HUD limitado
      hudT += dt
      if (hudT > 0.1) {
        hudT = 0
        const sc = scoreOf(s)
        if (sc !== scoreRef.current) {
          scoreRef.current = sc
          setScore(sc)
        }
        setKmh(Math.round(s.speed * 0.42))
      }
      // franjas de velocidad
      for (const st of s.streaks) {
        st.y += s.speed * st.sp * 1.5 * dt
        if (st.y > H + 80) {
          st.y = -80
          st.x = Math.random() * W
        }
      }
    }

    // ------------------ dibujo ------------------
    const txt = (str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') => {
      ctx.font = `${size}px ${PIX}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillText(str, x + 1.2, y + 1.2)
      ctx.fillStyle = color
      ctx.fillText(str, x, y)
    }

    const blinkOn = (t: number) => Math.floor(t * 5) % 2 === 0

    const drawCar = (c: { kind: CarKind; x: number; y: number; w: number; h: number; color: string; rot?: number }, player: boolean, s: Race, tilt = 0, blinkDir = 0) => {
      const { x, y, w, h } = c
      ctx.save()
      ctx.translate(x + w / 2, y + h / 2)
      ctx.rotate((c.rot ?? 0) + tilt)
      ctx.translate(-w / 2, -h / 2)
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      rr(ctx, 3, 5, w, h, 9)
      ctx.fill()

      if (c.kind === 'bike') {
        ctx.fillStyle = '#12141b'
        rr(ctx, w / 2 - 3, 0, 6, h, 3)
        ctx.fill()
        ctx.fillStyle = '#3a3f4d'
        rr(ctx, w / 2 - 5, 10, 10, 22, 4)
        ctx.fill()
        ctx.fillStyle = '#ff6b3d'
        ctx.beginPath()
        ctx.arc(w / 2, 20, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#f2f2f2'
        ctx.beginPath()
        ctx.arc(w / 2, 14, 4.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffefa8'
        ctx.fillRect(w / 2 - 2, 0, 4, 3)
        ctx.fillStyle = '#ff4d4d'
        ctx.fillRect(w / 2 - 2.5, h - 3, 5, 3)
        ctx.restore()
        return
      }

      if (c.kind === 'truck') {
        // caja
        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, darken(c.color.length === 7 ? c.color : '#c0c4cc', 20))
        grad.addColorStop(0.5, c.color)
        grad.addColorStop(1, darken(c.color.length === 7 ? c.color : '#c0c4cc', 20))
        ctx.fillStyle = grad
        rr(ctx, 0, 30, w, h - 30, 5)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'
        ctx.lineWidth = 1.5
        for (let i = 1; i < 5; i++) {
          ctx.beginPath()
          ctx.moveTo(4, 30 + i * ((h - 34) / 5))
          ctx.lineTo(w - 4, 30 + i * ((h - 34) / 5))
          ctx.stroke()
        }
        // cabina
        ctx.fillStyle = '#c8383a'
        rr(ctx, 2, 0, w - 4, 34, 7)
        ctx.fill()
        ctx.fillStyle = 'rgba(20,26,36,0.9)'
        rr(ctx, 6, 7, w - 12, 10, 3)
        ctx.fill()
        ctx.fillStyle = '#ffefa8'
        ctx.fillRect(5, 0, 8, 3)
        ctx.fillRect(w - 13, 0, 8, 3)
        ctx.fillStyle = '#ff4d4d'
        ctx.fillRect(3, h - 4, 9, 4)
        ctx.fillRect(w - 12, h - 4, 9, 4)
      } else {
        const body = c.color
        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, darken(body, 24))
        grad.addColorStop(0.5, lighten(body, 22))
        grad.addColorStop(1, darken(body, 24))
        ctx.fillStyle = grad
        rr(ctx, 0, 0, w, h, 10)
        ctx.fill()
        if (c.kind === 'police') {
          ctx.fillStyle = '#16181f'
          rr(ctx, 0, h * 0.5, w, h * 0.5, 10)
          ctx.fill()
          ctx.fillStyle = '#f2f4f8'
          ctx.fillRect(3, h * 0.55, w - 6, h * 0.16)
        }
        if (player) {
          // franja deportiva
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.fillRect(w / 2 - 3, 0, 2, h)
          ctx.fillRect(w / 2 + 1, 0, 2, h)
        }
        // cristales
        ctx.fillStyle = 'rgba(18,24,34,0.9)'
        rr(ctx, 5, h * 0.26, w - 10, h * 0.2, 5)
        ctx.fill()
        ctx.fillStyle = 'rgba(18,24,34,0.72)'
        rr(ctx, 6, h * 0.64, w - 12, h * 0.14, 4)
        ctx.fill()
        // faros delanteros y pilotos
        ctx.fillStyle = '#ffefa8'
        rr(ctx, 4, 1, 9, 4, 2)
        ctx.fill()
        rr(ctx, w - 13, 1, 9, 4, 2)
        ctx.fill()
        ctx.fillStyle = '#ff4d4d'
        rr(ctx, 4, h - 5, 9, 4, 2)
        ctx.fill()
        rr(ctx, w - 13, h - 5, 9, 4, 2)
        ctx.fill()
      }

      // intermitentes
      if (blinkDir !== 0 && blinkOn(s.time)) {
        ctx.fillStyle = '#ffb020'
        const bx = blinkDir < 0 ? -2 : w - 3
        ctx.fillRect(bx, 3, 5, 6)
        ctx.fillRect(bx, h - 10, 5, 6)
      }
      ctx.restore()
    }

    const drawPolice = (c: Car, s: Race) => {
      // barra de luces rojo / azul
      const flip = Math.floor(s.time * 8) % 2 === 0
      const cx = c.x + c.w / 2
      const cy = c.y + c.h * 0.42
      ctx.fillStyle = flip ? '#ff3030' : '#2a4bff'
      ctx.fillRect(cx - 9, cy - 3, 9, 6)
      ctx.fillStyle = flip ? '#2a4bff' : '#ff3030'
      ctx.fillRect(cx, cy - 3, 9, 6)
    }

    const drawLightsPass = (s: Race) => {
      ctx.globalCompositeOperation = 'lighter'
      const py = PLAYER_Y + s.yOff
      // haz de faros del jugador
      const beam = ctx.createLinearGradient(0, py, 0, py - 150)
      beam.addColorStop(0, 'rgba(255,236,170,0.28)')
      beam.addColorStop(1, 'rgba(255,236,170,0)')
      ctx.globalAlpha = 1
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(s.px + 6, py)
      ctx.lineTo(s.px - 14, py - 150)
      ctx.lineTo(s.px + PW + 14, py - 150)
      ctx.lineTo(s.px + PW - 6, py)
      ctx.closePath()
      ctx.fill()
      glow(glows.warm, s.px + 8, py + 2, 11, 0.8)
      glow(glows.warm, s.px + PW - 8, py + 2, 11, 0.8)
      glow(glows.red, s.px + 8, py + PH, 12, s.boosting ? 0.5 : 0.9)
      glow(glows.red, s.px + PW - 8, py + PH, 12, s.boosting ? 0.5 : 0.9)
      for (const c of s.cars) {
        if (c.y < -c.h - 30 || c.y > H + 30) continue
        if (c.kind === 'bike') {
          glow(glows.red, c.x + c.w / 2, c.y + c.h, 10, 0.8)
          glow(glows.warm, c.x + c.w / 2, c.y, 11, 0.7)
        } else {
          glow(glows.red, c.x + 8, c.y + c.h - 2, 11, 0.7)
          glow(glows.red, c.x + c.w - 8, c.y + c.h - 2, 11, 0.7)
          if (c.kind === 'police') {
            const flip = Math.floor(s.time * 8) % 2 === 0
            glow(flip ? glows.red : glows.blue, c.x + c.w / 2 - 5, c.y + c.h * 0.42, 34, 0.75)
            glow(flip ? glows.blue : glows.red, c.x + c.w / 2 + 5, c.y + c.h * 0.42, 34, 0.75)
          }
        }
        if (c.plan > 0 && blinkOn(s.time)) {
          const bx = c.dir < 0 ? c.x : c.x + c.w
          glow(glows.orange, bx, c.y + 6, 14, 0.9)
          glow(glows.orange, bx, c.y + c.h - 6, 14, 0.9)
        }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const drawSide = (s: Race) => {
      const dist = s.dist
      const first = Math.floor((dist - (H - PLAYER_Y) - 120) / CELL)
      const lastC = Math.floor((dist + PLAYER_Y + 120) / CELL)
      for (let k = first; k <= lastC; k++) {
        const wy = k * CELL
        const y = PLAYER_Y + dist - wy - CELL // arriba de la celda en pantalla
        const z = zoneAt(wy)
        for (let side = 0; side < 2; side++) {
          const left = side === 0
          const edge = left ? ROAD_X - 8 : ROAD_X + ROAD_W + 8
          const hs = hash(k * 17 + side * 101 + 9)
          const hs2 = hash(k * 23 + side * 57 + 1)
          if (z.idx === 0) {
            // ciudad: azoteas con neón
            if (hs > 0.14) {
              const bw = 38 + hs2 * 40
              const bh = CELL - 8
              const bx = left ? edge - bw : edge
              ctx.fillStyle = BUILD_COLORS[((hs * 50) | 0) % BUILD_COLORS.length]
              ctx.fillRect(bx, y + 4, bw, bh)
              ctx.fillStyle = 'rgba(255,255,255,0.05)'
              ctx.fillRect(bx + 3, y + 7, bw - 6, bh - 6)
              // equipos / ventanas de la azotea
              ctx.fillStyle = 'rgba(255,255,255,0.10)'
              ctx.fillRect(bx + 6 + hs2 * 10, y + 12, 10, 8)
              if (hs2 > 0.5) ctx.fillRect(bx + 8, y + 30, 14, 10)
              // neón en el borde junto a la calle
              const nc = NEON[(hs2 * 5) | 0]
              ctx.fillStyle = nc
              ctx.globalAlpha = 0.85
              ctx.fillRect(left ? edge - 3 : edge, y + 8, 3, bh - 8)
              ctx.globalAlpha = 1
            }
            // farola
            if (k % 2 === 0) {
              const lx = left ? ROAD_X - 5 : ROAD_X + ROAD_W + 5
              ctx.fillStyle = '#8a8fa0'
              ctx.fillRect(lx - 1, y + CELL / 2 - 1, 2, 2)
              ctx.globalCompositeOperation = 'lighter'
              glow(glows.warm, lx + (left ? 12 : -12), y + CELL / 2, 26, 0.35)
              ctx.globalAlpha = 1
              ctx.globalCompositeOperation = 'source-over'
            }
          } else if (z.idx === 1) {
            // desierto: cactus, rocas y postes
            const fx = left ? edge - 6 - hs * 40 : edge + 6 + hs * 40
            if (hs2 < 0.35) {
              ctx.fillStyle = '#2d7a43'
              rr(ctx, fx - 3, y + 14, 6, 22, 3)
              ctx.fill()
              rr(ctx, fx - 9, y + 22, 7, 4, 2)
              ctx.fill()
              rr(ctx, fx - 9, y + 16, 4, 10, 2)
              ctx.fill()
              rr(ctx, fx + 2, y + 26, 7, 4, 2)
              ctx.fill()
              rr(ctx, fx + 5, y + 19, 4, 11, 2)
              ctx.fill()
            } else if (hs2 < 0.7) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)'
              ctx.beginPath()
              ctx.ellipse(fx + 2, y + 34, 12, 6, 0, 0, Math.PI * 2)
              ctx.fill()
              ctx.fillStyle = '#9a6a40'
              ctx.beginPath()
              ctx.ellipse(fx, y + 30, 11, 8, 0.2, 0, Math.PI * 2)
              ctx.fill()
              ctx.fillStyle = '#b98859'
              ctx.beginPath()
              ctx.ellipse(fx - 3, y + 27, 6, 4, 0.2, 0, Math.PI * 2)
              ctx.fill()
            } else {
              ctx.strokeStyle = '#b4895a'
              ctx.lineWidth = 1.5
              ctx.beginPath()
              ctx.arc(fx, y + 32, 6, 0, Math.PI * 2)
              ctx.moveTo(fx - 6, y + 32)
              ctx.lineTo(fx + 6, y + 32)
              ctx.moveTo(fx, y + 26)
              ctx.lineTo(fx, y + 38)
              ctx.stroke()
            }
            // postes
            if (k % 2 === 0) {
              ctx.fillStyle = '#5a3d28'
              ctx.fillRect(left ? ROAD_X - 12 : ROAD_X + ROAD_W + 9, y + CELL / 2 - 2, 3, 5)
            }
          } else {
            // túnel: muros con losas y luces
            const wx = left ? -40 : ROAD_X + ROAD_W + 7
            const ww = left ? ROAD_X + 40 - 7 : W + 40 - (ROAD_X + ROAD_W + 7)
            ctx.fillStyle = (k + side) % 2 === 0 ? '#2a2c33' : '#25272d'
            ctx.fillRect(wx, y, ww, CELL + 0.5)
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.fillRect(wx, y, ww, 1.5)
            if (k % 2 === 0) {
              const lx = left ? ROAD_X - 14 : ROAD_X + ROAD_W + 10
              ctx.fillStyle = '#ffcf7a'
              ctx.fillRect(lx, y + CELL / 2 - 6, 4, 12)
              ctx.globalCompositeOperation = 'lighter'
              glow(glows.orange, lx + 2, y + CELL / 2, 24, 0.55)
              ctx.globalAlpha = 1
              ctx.globalCompositeOperation = 'source-over'
            }
          }
        }
      }
    }

    const drawGates = (s: Race) => {
      const k0 = Math.floor(s.dist / CYCLE)
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        let acc = 0
        for (let i = 0; i < ZONE_LEN.length; i++) {
          const wy = k * CYCLE + acc
          acc += ZONE_LEN[i]
          const y = PLAYER_Y + s.dist - wy
          if (y < -90 || y > H + 90 || wy <= 0) continue
          if (i === 2) {
            // boca del túnel
            ctx.fillStyle = '#17181d'
            ctx.fillRect(-40, y - 52, W + 80, 52)
            ctx.fillStyle = '#34373f'
            ctx.fillRect(-40, y - 52, W + 80, 6)
            ctx.fillStyle = '#05060a'
            ctx.fillRect(ROAD_X - 6, y - 46, ROAD_W + 12, 46)
            ctx.fillStyle = '#f2c828'
            for (let b = 0; b < 12; b++) ctx.fillRect(-40 + b * 40, y - 52, 20, 5)
            txt('TUNEL', W / 2, y - 24, 9, '#ffd23d', 'center')
          } else {
            // pórtico con letrero
            ctx.fillStyle = '#20222b'
            ctx.fillRect(ROAD_X - 12, y - 8, ROAD_W + 24, 8)
            ctx.fillRect(ROAD_X - 12, y - 8, 6, 8)
            ctx.fillStyle = i === 0 ? '#1b5e3b' : '#8a3d1c'
            rr(ctx, W / 2 - 80, y - 36, 160, 28, 5)
            ctx.fill()
            ctx.strokeStyle = '#f2f2ec'
            ctx.lineWidth = 2
            ctx.stroke()
            txt(ZONE_NAMES[i], W / 2, y - 22, 9, '#ffffff', 'center')
          }
        }
      }
    }

    const drawWorld = (s: Race) => {
      const pal = palFor(s.dist)
      ctx.fillStyle = rgb(pal.bg)
      ctx.fillRect(-80, -120, W + 160, H + 240)

      // arena / textura del suelo lateral en el desierto
      drawSide(s)

      // asfalto
      const road = ctx.createLinearGradient(ROAD_X, 0, ROAD_X + ROAD_W, 0)
      road.addColorStop(0, rgb(pal.road))
      road.addColorStop(0.5, rgb(pal.roadHi))
      road.addColorStop(1, rgb(pal.road))
      ctx.fillStyle = road
      ctx.fillRect(ROAD_X, -120, ROAD_W, H + 240)

      // motas del asfalto
      ctx.fillStyle = 'rgba(255,255,255,0.035)'
      const scroll = s.dist % 22
      for (let i = 0; i < 50; i++) {
        const gx = ROAD_X + ((i * 53) % ROAD_W)
        const gy = (i * 97 + scroll * 4) % (H + 120)
        ctx.fillRect(gx, gy - 60, 2, 2)
      }

      // bordillos
      const stripeH = 26
      const off = s.dist % (stripeH * 2)
      for (let y = -stripeH * 4 + off; y < H + stripeH * 4; y += stripeH * 2) {
        ctx.fillStyle = rgb(pal.curbA)
        ctx.fillRect(ROAD_X - 7, y, 7, stripeH)
        ctx.fillRect(ROAD_X + ROAD_W, y, 7, stripeH)
        ctx.fillStyle = rgb(pal.curbB)
        ctx.fillRect(ROAD_X - 7, y + stripeH, 7, stripeH)
        ctx.fillRect(ROAD_X + ROAD_W, y + stripeH, 7, stripeH)
      }

      // líneas de carril
      ctx.fillStyle = rgba(pal.line, 0.85)
      const dash = s.dist % 64
      const stretch = s.boosting ? 22 : Math.max(0, (s.speed - 420) / 12)
      for (let l = 1; l < LANES; l++) {
        const x = ROAD_X + l * LANE_W - 2.5
        for (let y = -128 + dash; y < H + 64; y += 64) ctx.fillRect(x, y, 5, 34 + stretch)
      }

      drawGates(s)

      // objetos
      for (const it of s.items) {
        if (it.y < -30 || it.y > H + 30) continue
        if (it.kind === 'coin') {
          const sw = Math.abs(Math.cos(it.t * 5)) * 0.7 + 0.3
          ctx.globalCompositeOperation = 'lighter'
          glow(glows.warm, it.x, it.y, 16, 0.45)
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = '#c9901b'
          ctx.beginPath()
          ctx.ellipse(it.x, it.y, 8.5 * sw + 0.5, 9, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffd23d'
          ctx.beginPath()
          ctx.ellipse(it.x, it.y, 6.5 * sw + 0.4, 7.2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff3b0'
          ctx.fillRect(it.x - 1 * sw - 0.3, it.y - 4, 2 * sw + 0.6, 5)
        } else {
          const bob = Math.sin(it.t * 4) * 2
          ctx.globalCompositeOperation = 'lighter'
          glow(glows.cyan, it.x, it.y + bob, 26, 0.55)
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = '#d63b3b'
          rr(ctx, it.x - 9, it.y - 11 + bob, 18, 22, 3)
          ctx.fill()
          ctx.fillStyle = '#f26a6a'
          ctx.fillRect(it.x - 7, it.y - 9 + bob, 4, 18)
          ctx.fillStyle = '#2b2f3a'
          ctx.fillRect(it.x - 4, it.y - 14 + bob, 8, 4)
          ctx.fillStyle = '#fff'
          ctx.fillRect(it.x - 1, it.y - 4 + bob, 6, 2)
          ctx.fillRect(it.x + 1, it.y - 6 + bob, 2, 8)
        }
      }

      // avisos de motos / policía en el borde inferior
      for (const w of s.warns) {
        if (Math.floor(w.t * 8) % 2 === 0) continue
        const cx = laneCenter(w.lane)
        ctx.fillStyle = w.kind === 'police' ? 'rgba(255,60,60,0.22)' : 'rgba(255,200,40,0.2)'
        ctx.fillRect(ROAD_X + w.lane * LANE_W, H - 150, LANE_W, 150)
        ctx.fillStyle = w.kind === 'police' ? '#ff4d4d' : '#ffd23d'
        for (let i = 0; i < 3; i++) {
          const yy = H - 24 - i * 22
          ctx.beginPath()
          ctx.moveTo(cx, yy - 9)
          ctx.lineTo(cx + 14, yy + 5)
          ctx.lineTo(cx - 14, yy + 5)
          ctx.closePath()
          ctx.fill()
        }
      }

      // coches
      for (const c of s.cars) {
        if (c.y < -c.h - 20 || c.y > H + 20) continue
        const fade = c.boost > 0 ? clamp((c.y + c.h - (PLAYER_Y - 150)) / 90, 0, 1) : 1
        ctx.globalAlpha = fade
        drawCar(c, false, s, 0, c.plan > 0 ? c.dir : 0)
        if (c.kind === 'police') {
          ctx.save()
          drawPolice(c, s)
          ctx.restore()
        }
        ctx.globalAlpha = 1
      }

      // humo / llama del jugador
      const py = PLAYER_Y + s.yOff
      if (s.boosting) {
        const fl = 26 + Math.random() * 20
        const gr = ctx.createLinearGradient(0, py + PH, 0, py + PH + fl)
        gr.addColorStop(0, 'rgba(255,255,255,0.95)')
        gr.addColorStop(0.3, 'rgba(125,249,255,0.8)')
        gr.addColorStop(1, 'rgba(125,249,255,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.moveTo(s.px + 8, py + PH - 2)
        ctx.lineTo(s.px + PW / 2 - 4, py + PH + fl)
        ctx.lineTo(s.px + PW / 2 + 4, py + PH + fl * 0.85)
        ctx.lineTo(s.px + PW - 8, py + PH - 2)
        ctx.closePath()
        ctx.fill()
      }

      // jugador
      const tilt = clamp(s.vx / MAX_VX, -1, 1) * 0.13
      drawCar({ kind: 'sedan', x: s.px, y: py, w: PW, h: PH, color: '#e83a3a', rot: s.dead ? s.vx * 0.004 * s.deathT * 10 : 0 }, true, s, tilt, 0)

      drawLightsPass(s)

      // tinte de zona + luces de túnel
      ctx.fillStyle = rgba(pal.tint, pal.tintA)
      ctx.fillRect(-80, -120, W + 160, H + 240)
      if (pal.tintA > 0.2) {
        const bars = (s.dist % 150) / 150
        for (let b = -1; b < 5; b++) {
          const yy = (b + bars) * 150
          const g2 = ctx.createLinearGradient(0, yy - 22, 0, yy + 22)
          g2.addColorStop(0, 'rgba(255,190,100,0)')
          g2.addColorStop(0.5, `rgba(255,190,100,${0.16 * clamp((pal.tintA - 0.2) / 0.12, 0, 1)})`)
          g2.addColorStop(1, 'rgba(255,190,100,0)')
          ctx.fillStyle = g2
          ctx.fillRect(-80, yy - 22, W + 160, 44)
        }
      }

      // luces de sirena sobre la pista
      let police = false
      for (const c of s.cars) if (c.kind === 'police' && c.y > -150 && c.y < H + 100) police = true
      if (police) {
        const flip = Math.floor(s.time * 8) % 2 === 0
        ctx.globalCompositeOperation = 'lighter'
        const gl = ctx.createLinearGradient(0, 0, W, 0)
        gl.addColorStop(0, flip ? 'rgba(255,40,40,0.28)' : 'rgba(40,80,255,0.28)')
        gl.addColorStop(0.35, 'rgba(0,0,0,0)')
        gl.addColorStop(0.65, 'rgba(0,0,0,0)')
        gl.addColorStop(1, flip ? 'rgba(40,80,255,0.28)' : 'rgba(255,40,40,0.28)')
        ctx.fillStyle = gl
        ctx.fillRect(-80, -120, W + 160, H + 240)
        ctx.globalCompositeOperation = 'source-over'
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, PIX)
    }

    const drawFx = (s: Race) => {
      // líneas de velocidad
      const intensity = clamp((s.speed - 380) / 260, 0, 1) + (s.boosting ? 0.5 : 0)
      if (s.started && intensity > 0.02) {
        ctx.strokeStyle = s.boosting ? '#bff6ff' : '#ffffff'
        ctx.lineWidth = 1.5
        for (const st of s.streaks) {
          ctx.globalAlpha = Math.min(0.5, st.a * intensity * 1.8)
          ctx.beginPath()
          ctx.moveTo(st.x, st.y)
          ctx.lineTo(st.x, st.y + st.len * (0.6 + intensity))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      // viñeta
      ctx.globalAlpha = 0.7
      ctx.drawImage(vigDark, 0, 0, W, H)
      if (s.boosting) {
        ctx.globalAlpha = 0.45 + Math.sin(s.time * 20) * 0.1
        ctx.drawImage(vigTurbo, 0, 0, W, H)
      }
      ctx.globalAlpha = 1
    }

    const drawUi = (s: Race) => {
      // distancia y velocidad
      txt(`${(s.dist / 8000).toFixed(2)} KM`, 12, 18, 10, '#ffffff')
      txt(`${Math.round(s.speed * 0.42)}`, W - 44, 18, 12, s.boosting ? '#7df9ff' : '#ffffff', 'right')
      txt('KM/H', W - 12, 19, 7, 'rgba(255,255,255,0.7)', 'right')

      // medidor de turbo
      const bx = 12
      const by = 32
      const bw = 112
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      rr(ctx, bx - 2, by - 2, bw + 4, 12, 4)
      ctx.fill()
      const ready = s.turbo > 0.1
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0)
      grad.addColorStop(0, '#2f9bff')
      grad.addColorStop(1, '#7df9ff')
      ctx.fillStyle = ready ? grad : '#5a5f6e'
      rr(ctx, bx, by, Math.max(0, bw * s.turbo), 8, 3)
      ctx.fill()
      if (s.turbo >= 0.999 || (ready && !s.boosting && blinkOn(s.time * 0.6) && s.turbo > 0.5)) {
        ctx.strokeStyle = 'rgba(125,249,255,0.9)'
        ctx.lineWidth = 1.5
        rr(ctx, bx - 2, by - 2, bw + 4, 12, 4)
        ctx.stroke()
      }
      txt('TURBO', bx + bw + 8, by + 4.5, 7, ready ? '#7df9ff' : 'rgba(255,255,255,0.45)')

      // cadena
      if (s.chain > 0 && s.chainT > 0) {
        const f = clamp(s.chainT / 3.2, 0, 1)
        txt(`CADENA x${s.chain}`, W - 12, 42, 8, s.chain >= 4 ? '#ffd23d' : '#7df9ff', 'right')
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(W - 12 - 90, 50, 90, 4)
        ctx.fillStyle = f < 0.3 ? '#ff6b6b' : '#ffd23d'
        ctx.fillRect(W - 12 - 90 * f, 50, 90 * f, 4)
      }

      // banner de eventos
      if (s.banner) {
        const k = s.banner.t
        const a = clamp(Math.min(k * 3, 1), 0, 1)
        ctx.globalAlpha = a
        const pop = k > 1.85 ? 1 + (k - 1.85) * 2.5 : 1
        ctx.save()
        ctx.translate(W / 2, 110)
        ctx.scale(pop, pop)
        txt(s.banner.text, 0, 0, 18, s.banner.color, 'center')
        txt(s.banner.sub, 0, 22, 7, '#ffffff', 'center')
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // pista inicial
      if (s.hintT > 0 && !s.dead) {
        ctx.globalAlpha = Math.min(1, s.hintT)
        txt('ROZA OTROS COCHES PARA LLENAR EL TURBO', W / 2, 170, 7, '#ffffff', 'center')
        ctx.globalAlpha = 1
      }

      if (s.paused) {
        ctx.fillStyle = 'rgba(10,8,18,0.7)'
        ctx.fillRect(0, 0, W, H)
        txt('PAUSA', W / 2, H / 2 - 10, 24, '#ff7a7a', 'center')
        txt('PULSA P PARA SEGUIR', W / 2, H / 2 + 24, 8, '#ffffff', 'center')
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      const s = R.current
      ctx.save()
      juice.applyShake(ctx)
      // vibración leve a alta velocidad
      const vib = s.started && !s.dead ? clamp((s.speed - 470) / 220, 0, 1) * 0.9 + (s.boosting ? 0.7 : 0) : 0
      if (vib > 0) ctx.translate((Math.random() - 0.5) * vib, (Math.random() - 0.5) * vib)
      // campo de visión: se aleja la cámara con la velocidad
      const z = 1 - 0.06 * s.fov
      ctx.translate(W / 2, PLAYER_Y)
      ctx.scale(z, z)
      ctx.translate(-W / 2, -PLAYER_Y)
      drawWorld(s)
      ctx.restore()
      drawFx(s)
      juice.drawFlash(ctx, W, H)
      drawUi(s)
    }

    // Pantalla girada o cambiada en plena partida. La carretera va centrada: todo lo de
    // la carretera se desplaza con ROAD_X; coches, monedas y latas se mueven con el fondo
    // (PLAYER_Y) para conservar la distancia al jugador. Queda en pausa.
    const relayoutLive = () => {
      const s = R.current
      const oldW = W
      const oldH = H
      const oldRoadX = ROAD_X
      const oldPY = PLAYER_Y
      layout()
      if (W === oldW && H === oldH) return
      const dx = ROAD_X - oldRoadX
      const dy = PLAYER_Y - oldPY
      const dpr = renderScale()
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      vigDark = makeVignette('rgba(0,0,0,0.55)')
      vigTurbo = makeVignette('rgba(90,220,255,0.55)')
      s.px += dx
      for (const c of s.cars) {
        c.x += dx
        c.fromX += dx
        c.toX += dx
        c.y += dy
      }
      // el coche que chocó puede salir de la lista durante la animación de choque
      if (s.hitCar && !s.cars.includes(s.hitCar)) {
        s.hitCar.x += dx
        s.hitCar.y += dy
      }
      for (const it of s.items) {
        it.x += dx
        it.y += dy
      }
      for (const st of s.streaks) {
        st.x *= W / oldW
        st.y *= H / oldH
      }
      if (s.started && !s.dead) s.paused = true
    }

    const loop = (now: number) => {
      follow.tick()
      const real = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (phaseRef.current !== 'play') requestRemount()
        else relayoutLive()
      }
      step(real)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const autoPause = () => {
      const s = R.current
      if (s.started && !s.dead && !s.paused) s.paused = true
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
  }, [begin, juice, justPressedRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border border-[#e85d5d]/40 bg-[#14121c] shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PUNTOS {score.toLocaleString('es-MX')}</span>
            <span className="text-amber-300">{kmh} KM/H</span>
            <span className="text-white/60">RECORD {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full object-contain touch-none select-none"
          {...touch}
          aria-label="Juego Carrera de Tráfico"
        />
        {phase === 'start' && (
          <StartOverlay
            title="CARRERA DE TRAFICO"
            accent={ACCENT}
            subtitle="Zigzaguea entre el tráfico por la ciudad, el desierto y el túnel."
            hint="Pulsa ESPACIO o una flecha"
            touchHint="Arrastra el dedo para manejar; con otro dedo, turbo"
            onStart={begin}
          >
            <Tips />
          </StartOverlay>
        )}
        {phase === 'over' && (
          <GameOverOverlay
            title="¡CHOQUE!"
            accent={ACCENT}
            score={score}
            best={best}
            newBest={newBest}
            stats={[
              { label: 'Distancia', value: `${stats.km} km` },
              { label: 'Cercas', value: stats.nm },
              { label: 'Mejor cadena', value: `x${stats.chain}` },
              { label: 'Monedas', value: stats.coins },
            ]}
            onRestart={begin}
          />
        )}
      </GameScreen>

    </div>
  )
}
