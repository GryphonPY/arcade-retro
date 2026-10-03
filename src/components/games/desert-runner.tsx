'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb, rr, renderScale } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { StartOverlay, GameOverOverlay, Hud, useIsTouch } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

const ID = 'desert-runner'
const ACCENT = '#e8a94f'

// ---------------------------------------------------------------------------
// Dimensiones y física (casi cuadrado: se ve bien en celular vertical)
// ---------------------------------------------------------------------------
const W = 420
const H = 380
const GROUND_Y = 300
const PX = 92 // borde izquierdo del armadillo
const PCX = PX + 21 // centro horizontal

const JUMP_V = 700
const DJUMP_V = 610
const G_HOLD = 1650 // gravedad al subir manteniendo el salto
const G_RELEASE = 3700 // gravedad al subir tras soltar (salto corto)
const G_FALL = 2400
const G_FAST = 6200 // caída rápida con ↓
const COYOTE = 0.1
const BUFFER = 0.13
const MAG_R = 135
const MILESTONE = 250
const M_PER_PX = 1 / 14

type ObsKind =
  | 'cactus-s'
  | 'cactus-b'
  | 'cactus-2'
  | 'cactus-3'
  | 'rock'
  | 'boulder'
  | 'tumble'
  | 'vulture-low'
  | 'vulture-high'
  | 'pit'

type ItemKind = 'coin' | 'gem' | 'shield' | 'magnet' | 'boots'

interface Obstacle {
  kind: ObsKind
  x: number
  y: number // arriba de la caja de colisión
  w: number
  h: number
  vx: number // velocidad extra hacia la izquierda
  t: number
  seed: number
  baseY: number
  minGap: number
  passed: boolean
  dead: boolean
}

interface Item {
  kind: ItemKind
  x: number
  y: number
  t: number
}

interface Cloud {
  x: number
  y: number
  s: number
}

interface Star {
  x: number
  y: number
  s: number
  ph: number
}

interface Game {
  started: boolean
  paused: boolean
  dead: boolean
  deathT: number
  deathPit: boolean
  hitObs: Obstacle | null
  time: number
  bg: number
  dist: number
  speed: number
  bonus: number
  // jugador
  y: number
  vy: number
  grounded: boolean
  air2: boolean
  coyote: number
  jumpBuf: number
  fastFall: boolean
  ducking: boolean
  legT: number
  spin: number
  sx: number
  sy: number
  dustT: number
  rot: number
  // efectos
  shield: boolean
  invuln: number
  magnetT: number
  bootsT: number
  streak: number
  comboT: number
  mult: number
  // spawns
  nextSpawn: number
  lastPU: number
  lastMile: number
  banner: { text: string; t: number } | null
  hintT: number
  // stats
  coins: number
  nearMisses: number
  bestMult: number
  obstacles: Obstacle[]
  items: Item[]
  clouds: Cloud[]
  stars: Star[]
}

function initial(started: boolean): Game {
  const clouds: Cloud[] = []
  for (let i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: 24 + Math.random() * 90, s: 0.6 + Math.random() * 0.8 })
  const stars: Star[] = []
  for (let i = 0; i < 38; i++) stars.push({ x: Math.random() * W, y: Math.random() * 190, s: 1 + Math.random() * 1.4, ph: Math.random() * 6 })
  return {
    started,
    paused: false,
    dead: false,
    deathT: 0,
    deathPit: false,
    hitObs: null,
    time: 0,
    bg: 0,
    dist: 0,
    speed: started ? 210 : 90,
    bonus: 0,
    y: GROUND_Y,
    vy: 0,
    grounded: true,
    air2: true,
    coyote: COYOTE,
    jumpBuf: 0,
    fastFall: false,
    ducking: false,
    legT: 0,
    spin: 0,
    sx: 1,
    sy: 1,
    dustT: 0,
    rot: 0,
    shield: false,
    invuln: 0,
    magnetT: 0,
    bootsT: 0,
    streak: 0,
    comboT: 0,
    mult: 1,
    nextSpawn: 120,
    lastPU: 90,
    lastMile: 0,
    banner: null,
    hintT: started ? 4.5 : 0,
    coins: 0,
    nearMisses: 0,
    bestMult: 1,
    obstacles: [],
    items: [],
    clouds,
    stars,
  }
}

// ---------------------------------------------------------------------------
// Paletas del ciclo día / atardecer / noche
// ---------------------------------------------------------------------------
type RGB = [number, number, number]
interface Pal {
  skyTop: RGB
  skyBot: RGB
  far: RGB
  mid: RGB
  near: RGB
  ground: RGB
  groundDark: RGB
  cloud: RGB
  stars: number
}

const hx = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mk = (a: string[], stars: number): Pal => ({
  skyTop: hx(a[0]),
  skyBot: hx(a[1]),
  far: hx(a[2]),
  mid: hx(a[3]),
  near: hx(a[4]),
  ground: hx(a[5]),
  groundDark: hx(a[6]),
  cloud: hx(a[7]),
  stars,
})

const P_DAWN = mk(['#6b78c4', '#ffb58c', '#a4727f', '#dc916c', '#c97b5a', '#dc9159', '#b56f44', '#ffd9c2'], 0.25)
const P_DAY = mk(['#6ec6f2', '#ffe9b8', '#dcae78', '#f1bd6c', '#e6a653', '#e8a94f', '#d98f3e', '#ffffff'], 0)
const P_SUNSET = mk(['#5a3e8c', '#ff9a5c', '#8c4a5e', '#cc6a5a', '#a9534c', '#bb6340', '#8c4430', '#ffc4a0'], 0.1)
const P_DUSK = mk(['#2b2a66', '#c85c6e', '#4a3a63', '#6a3e5a', '#53324e', '#6b3e48', '#4d2d3c', '#9a6a8a'], 0.6)
const P_NIGHT = mk(['#0a0e2e', '#262c68', '#1c1f4a', '#232957', '#1a1f47', '#2d2a55', '#1f1e40', '#5a6098'], 1)

const KEYS: { p: number; pal: Pal }[] = [
  { p: 0, pal: P_DAWN },
  { p: 0.12, pal: P_DAY },
  { p: 0.34, pal: P_DAY },
  { p: 0.46, pal: P_SUNSET },
  { p: 0.54, pal: P_DUSK },
  { p: 0.62, pal: P_NIGHT },
  { p: 0.88, pal: P_NIGHT },
  { p: 0.96, pal: P_DAWN },
  { p: 1, pal: P_DAWN },
]

const mixC = (a: RGB, b: RGB, t: number, out: RGB) => {
  out[0] = a[0] + (b[0] - a[0]) * t
  out[1] = a[1] + (b[1] - a[1]) * t
  out[2] = a[2] + (b[2] - a[2]) * t
}
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`

function makePalOut(): Pal {
  const z = (): RGB => [0, 0, 0]
  return { skyTop: z(), skyBot: z(), far: z(), mid: z(), near: z(), ground: z(), groundDark: z(), cloud: z(), stars: 0 }
}

function palAt(p: number, out: Pal) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p || 1)))
  const s = t * t * (3 - 2 * t)
  mixC(a.pal.skyTop, b.pal.skyTop, s, out.skyTop)
  mixC(a.pal.skyBot, b.pal.skyBot, s, out.skyBot)
  mixC(a.pal.far, b.pal.far, s, out.far)
  mixC(a.pal.mid, b.pal.mid, s, out.mid)
  mixC(a.pal.near, b.pal.near, s, out.near)
  mixC(a.pal.ground, b.pal.ground, s, out.ground)
  mixC(a.pal.groundDark, b.pal.groundDark, s, out.groundDark)
  mixC(a.pal.cloud, b.pal.cloud, s, out.cloud)
  out.stars = a.pal.stars + (b.pal.stars - a.pal.stars) * s
}

const PU_COLOR: Record<'shield' | 'magnet' | 'boots', string> = {
  shield: '#4cc9f0',
  magnet: '#ef476f',
  boots: '#ffd166',
}

function pick<T>(pool: [T, number][]): T {
  let total = 0
  for (const [, w] of pool) total += w
  let r = Math.random() * total
  for (const [v, w] of pool) {
    r -= w
    if (r <= 0) return v
  }
  return pool[0][0]
}

const speedAt = (m: number) => 262 + 360 * (1 - Math.exp(-m / 1500))

function Tips() {
  const touch = useIsTouch()
  return (
    <ul className="max-w-[17rem] space-y-1 text-left text-xs leading-snug text-white/70">
      {touch ? (
        <>
          <li>
            <b className="text-white">Toca la pantalla o A</b> para saltar. Mantén para saltar más alto.
          </li>
          <li>
            <b className="text-white">Toca otra vez en el aire</b> para el doble salto.
          </li>
          <li>
            <b className="text-white">B o desliza hacia abajo</b> para agacharte.
          </li>
        </>
      ) : (
        <>
          <li>
            <b className="text-white">ESPACIO / ↑</b> salta. Mantén para saltar más alto.
          </li>
          <li>
            <b className="text-white">Otra vez en el aire</b> para el doble salto.
          </li>
          <li>
            <b className="text-white">↓</b> te agacha, o cae rápido en el aire.
          </li>
        </>
      )}
      <li className="text-white/55">Junta monedas seguidas para subir el multiplicador.</li>
    </ul>
  )
}

export default function DesertRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [juice] = useState(() => new Juice(9))
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [score, setScore] = useState(0)
  const [mult, setMult] = useState(1)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ m: 0, coins: 0, nm: 0, mult: 1 })

  const G = useRef<Game>(initial(false))
  const scoreRef = useRef(0)
  const ptr = useRef<{ id: number; y0: number; ducking: boolean } | null>(null)
  const phaseRef = useRef<'start' | 'play' | 'over'>('start')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest(ID))
  }, [])

  const begin = useCallback(() => {
    G.current = initial(true)
    juice.reset()
    scoreRef.current = 0
    setScore(0)
    setMult(1)
    setNewBest(false)
    phaseRef.current = 'play'
    setPhase('play')
    sfx.start()
  }, [juice])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = renderScale()
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) throw new Error('Canvas 2D no disponible')
    const ctx = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pixVar = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    const PIX = pixVar ? `${pixVar}, monospace` : 'monospace'

    const pal = makePalOut()
    let raf = 0
    let last = performance.now()
    let hudT = 0

    // ------------------------------ helpers de juego ------------------------------
    const meters = (g: Game) => g.dist * M_PER_PX
    const scoreOf = (g: Game) => Math.floor(meters(g)) + g.bonus

    const addStreak = (g: Game, n: number) => {
      g.streak += n
      g.comboT = 2.6
      const nm = Math.min(5, 1 + Math.floor(g.streak / 6))
      if (nm > g.mult) {
        g.mult = nm
        g.bestMult = Math.max(g.bestMult, nm)
        juice.text(PCX, g.y - 70, `x${nm} COMBO`, '#ffd23d', 11, 1)
        sfx.levelUp()
        setMult(nm)
      }
    }

    const doJump = (g: Game, double: boolean) => {
      const boots = g.bootsT > 0
      g.jumpBuf = 0
      g.coyote = 0
      g.fastFall = false
      if (!double) {
        g.vy = -JUMP_V * (boots ? 1.18 : 1)
        g.grounded = false
        g.sx = 0.7
        g.sy = 1.38
        juice.burst(PCX - 4, GROUND_Y - 1, ['#e9c48e', '#d9a96a'], { count: 7, speed: 70, angle: Math.PI + 0.4, arc: 1.6, life: 0.4, size: 4, gravity: -20 })
        sfx.jump()
      } else {
        g.vy = -DJUMP_V * (boots ? 1.15 : 1)
        g.air2 = false
        g.sx = 0.74
        g.sy = 1.32
        juice.burst(PCX, g.y - 6, ['#ffffff', '#ffe9b8'], { count: 10, speed: 110, angle: Math.PI / 2, arc: 1.4, life: 0.35, size: 3, drag: 4 })
        tone({ freq: 420, to: 980, dur: 0.12, vol: 0.045, type: 'triangle' })
      }
    }

    const die = (g: Game, o: Obstacle | null, pit: boolean) => {
      g.dead = true
      g.deathT = 0
      g.deathPit = pit
      g.hitObs = o
      g.ducking = false
      g.streak = 0
      g.comboT = 0
      g.mult = 1
      setMult(1)
      if (!pit) {
        g.vy = -430
        juice.freeze(90)
        juice.shake(0.85)
        juice.flash('#ffffff', 0.5)
        juice.burst(PCX, g.y - 16, ['#d98241', '#b45e2c', '#f2c48d', '#ffffff'], { count: 22, speed: 230, life: 0.7, size: 5, gravity: 500 })
        sfx.crash()
      } else {
        juice.shake(0.5)
        juice.freeze(40)
        tone({ freq: 400, to: 60, dur: 0.6, vol: 0.06, type: 'triangle' })
      }
      const sc = scoreOf(g)
      scoreRef.current = sc
      setScore(sc)
      if (saveBest(ID, sc)) setNewBest(true)
      setBest((b) => Math.max(b, sc))
    }

    const nearMiss = (g: Game, o: Obstacle) => {
      g.nearMisses++
      g.bonus += 30
      addStreak(g, 3)
      juice.text(PCX + 24, g.y - 52, 'RASPON +30', '#7df9ff', 8, 0.9)
      juice.burst(o.x + o.w / 2, o.y + o.h / 2, ['#7df9ff', '#ffffff'], { count: 8, speed: 120, life: 0.35, size: 3 })
      juice.shake(0.12)
      sfx.nearMiss()
    }

    const getPlayerBox = (g: Game) =>
      g.ducking
        ? { x: PX + 3, y: g.y - 18, w: 36, h: 17 }
        : { x: PX + 8, y: g.y - 34, w: 26, h: 32 }

    // ------------------------------ generación de obstáculos ------------------------------
    const makeObstacle = (kind: ObsKind, x: number, m: number): Obstacle => {
      const base = { kind, x, vx: 0, t: 0, seed: Math.random() * 6.28, minGap: 999, passed: false, dead: false }
      switch (kind) {
        case 'cactus-s':
          return { ...base, w: 18, h: 40, y: GROUND_Y - 40, baseY: GROUND_Y - 40 }
        case 'cactus-b':
          return { ...base, w: 24, h: 56, y: GROUND_Y - 56, baseY: GROUND_Y - 56 }
        case 'cactus-2':
          return { ...base, w: 56, h: 46, y: GROUND_Y - 46, baseY: GROUND_Y - 46 }
        case 'cactus-3':
          return { ...base, w: 84, h: 50, y: GROUND_Y - 50, baseY: GROUND_Y - 50 }
        case 'rock':
          return { ...base, w: 34, h: 22, y: GROUND_Y - 22, baseY: GROUND_Y - 22 }
        case 'boulder':
          return { ...base, w: 30, h: 30, y: GROUND_Y - 30, baseY: GROUND_Y - 30, vx: 120 + Math.min(60, m * 0.05) }
        case 'tumble':
          return { ...base, w: 24, h: 24, y: GROUND_Y - 24, baseY: GROUND_Y - 24, vx: 45 }
        case 'vulture-low':
          return { ...base, w: 30, h: 18, y: GROUND_Y - 51, baseY: GROUND_Y - 51 }
        case 'vulture-high':
          return { ...base, w: 30, h: 18, y: GROUND_Y - 112, baseY: GROUND_Y - 112 }
        default:
          return { ...base, w: 58 + Math.min(26, m * 0.02), h: 0, y: GROUND_Y, baseY: GROUND_Y }
      }
    }

    const spawnEvent = (g: Game) => {
      const m = meters(g)
      const x0 = W + 40
      const pool: [ObsKind, number][] = [
        ['cactus-s', 30],
        ['cactus-b', 24],
        ['rock', 18],
      ]
      if (m >= 120) pool.push(['cactus-2', 14])
      if (m >= 220) pool.push(['tumble', 12])
      if (m >= 300) pool.push(['vulture-low', 12])
      if (m >= 350) pool.push(['pit', 13])
      if (m >= 450) pool.push(['cactus-3', 12])
      if (m >= 600) pool.push(['boulder', 12])
      if (m >= 700) pool.push(['vulture-high', 8])

      // respiro: solo monedas
      if (m > 40 && Math.random() < 0.12) {
        const n = 7 + ((Math.random() * 4) | 0)
        for (let i = 0; i < n; i++) {
          g.items.push({ kind: 'coin', x: x0 + i * 26, y: GROUND_Y - 24 - Math.sin((i / (n - 1)) * Math.PI) * 54, t: i * 0.4 })
        }
        g.nextSpawn = g.dist + n * 26 + g.speed * 0.9
        return
      }

      let cursor = x0
      // monedas a ras de suelo antes del obstáculo
      const pre = m > 15 && Math.random() < 0.5
      if (pre) {
        const n = 3 + ((Math.random() * 3) | 0)
        for (let i = 0; i < n; i++) g.items.push({ kind: 'coin', x: cursor + i * 26, y: GROUND_Y - 22, t: i * 0.4 })
        // power-up en la fila previa
        if (m > 100 && m - g.lastPU > 240 + Math.random() * 160) {
          const kind = pick<ItemKind>([
            ['shield', 40],
            ['magnet', 30],
            ['boots', 30],
          ])
          g.items.push({ kind, x: cursor + (n * 26) / 2, y: GROUND_Y - 34, t: 0 })
          g.lastPU = m
        }
        cursor += n * 26 + 70
      }

      const kind = pick(pool)
      const o = makeObstacle(kind, cursor, m)
      g.obstacles.push(o)

      // arco de monedas sobre el obstáculo que invita a saltar
      const arcKinds: ObsKind[] = ['cactus-s', 'cactus-b', 'cactus-2', 'cactus-3', 'rock', 'pit', 'tumble']
      if (arcKinds.includes(kind) && m > 10 && Math.random() < 0.62) {
        const n = kind === 'cactus-3' || kind === 'pit' ? 7 : 5
        const peak = Math.max(o.h, 24) + 42 + (kind === 'cactus-3' ? 18 : 0)
        const cx = o.x + o.w / 2
        const span = 30 * (n - 1)
        const gemAt = m > 300 && Math.random() < 0.14 ? Math.floor(n / 2) : -1
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1)
          g.items.push({
            kind: i === gemAt ? 'gem' : 'coin',
            x: cx - span / 2 + i * 30,
            y: GROUND_Y - 22 - (peak - 22) * Math.sin(u * Math.PI),
            t: i * 0.4,
          })
        }
      }

      const ease = 0.4 * Math.max(0, 1 - m / 1400)
      const extra = kind === 'boulder' ? 110 : kind === 'pit' ? 30 : kind === 'vulture-high' ? 40 : 0
      const gap = g.speed * (0.62 + Math.random() * 0.55 + ease) + extra
      g.nextSpawn = g.dist + (cursor - x0) + o.w + gap
    }

    // ------------------------------ actualización ------------------------------
    const step = (real: number) => {
      const g = G.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current
      const pressJump = jp.has('up') || jp.has('action')

      // pausa
      if (jp.has('pause') && g.started && !g.dead) {
        g.paused = !g.paused
        sfx.pause()
        return
      }
      if (g.paused) return

      // inicio / reinicio desde teclado
      if (!g.started) {
        if (pressJump) {
          begin()
          return
        }
      } else if (g.dead && g.deathT > 0.55 && pressJump) {
        begin()
        return
      }

      const dt = juice.update(real)
      if (pressJump) g.jumpBuf = BUFFER

      // ---- cielo y nubes siempre en movimiento ----
      const hold = pressed.has('up') || pressed.has('action')
      const spd = g.started ? g.speed : 90
      if (dt > 0) {
        g.time += dt
        g.bg += spd * dt
        for (const c of g.clouds) {
          c.x -= (6 + spd * 0.05) * c.s * dt
          if (c.x < -90) {
            c.x = W + 40
            c.y = 24 + Math.random() * 90
          }
        }
        g.sx += (1 - g.sx) * Math.min(1, dt * 14)
        g.sy += (1 - g.sy) * Math.min(1, dt * 14)
        g.legT += dt * (g.grounded ? 6 + spd * 0.03 : 3)
      }
      if (dt <= 0) return
      if (g.banner) {
        g.banner.t -= dt
        if (g.banner.t <= 0) g.banner = null
      }
      if (!g.started) return

      // ---- muerte: animación y fin ----
      if (g.dead) {
        g.deathT += dt
        g.speed *= Math.exp(-dt * 4.5)
        if (!g.deathPit) {
          g.vy += 1700 * dt
          g.y += g.vy * dt
          if (g.y > GROUND_Y) {
            g.y = GROUND_Y
            g.vy = -g.vy * 0.35
            if (Math.abs(g.vy) < 60) g.vy = 0
          }
          g.rot += dt * 11
        } else {
          g.vy += 1700 * dt
          g.y += g.vy * dt
        }
        if (g.deathT > 0.7 && phaseRef.current !== 'over') {
          phaseRef.current = 'over'
          const sc = scoreRef.current
          setStats({ m: Math.floor(meters(g)), coins: g.coins, nm: g.nearMisses, mult: g.bestMult })
          setScore(sc)
          setPhase('over')
        }
        for (const o of g.obstacles) o.x -= (g.speed + o.vx) * dt
        return
      }

      // ---- progresión ----
      const m = meters(g)
      const target = speedAt(m)
      g.speed += (target - g.speed) * Math.min(1, dt * 1.6)
      g.dist += g.speed * dt
      g.hintT = Math.max(0, g.hintT - dt)
      g.invuln = Math.max(0, g.invuln - dt)
      g.magnetT = Math.max(0, g.magnetT - dt)
      g.bootsT = Math.max(0, g.bootsT - dt)
      if (g.comboT > 0) {
        g.comboT -= dt
        if (g.comboT <= 0) {
          g.streak = 0
          if (g.mult > 1) {
            g.mult = 1
            setMult(1)
          }
        }
      }

      // hitos
      if (m >= g.lastMile + MILESTONE) {
        g.lastMile += MILESTONE
        g.banner = { text: `${g.lastMile} m`, t: 1.7 }
        g.bonus += 25
        sfx.golden()
        juice.burst(W / 2, 70, ['#ffd23d', '#ffffff', '#ff8a5c', '#7df9ff'], { count: 26, speed: 190, life: 0.9, size: 4, gravity: 260 })
        juice.flash('#ffe9b8', 0.18)
      }

      // ---- ¿hay un pozo bajo los pies? ----
      let overPit = false
      for (const o of g.obstacles) {
        if (o.kind === 'pit' && PCX > o.x + 7 && PCX < o.x + o.w - 7) overPit = true
      }

      // ---- salto / agacharse ----
      g.jumpBuf = Math.max(0, g.jumpBuf - dt)
      if (g.grounded && overPit) {
        g.grounded = false
        g.vy = 0
      }
      g.coyote = g.grounded ? COYOTE : Math.max(0, g.coyote - dt)
      g.ducking = g.grounded && (pressed.has('down') || pressed.has('action2'))

      if (g.jumpBuf > 0) {
        if (g.grounded || g.coyote > 0) {
          doJump(g, false)
        } else if (g.air2 && g.y < GROUND_Y + 24) {
          const nearGround = g.vy > 0 && GROUND_Y - g.y < 26 && !overPit
          if (!nearGround) doJump(g, true)
        }
      }

      if (!g.grounded) {
        const wantFast = pressed.has('down') || pressed.has('action2')
        let gr = g.vy < 0 ? (hold ? G_HOLD : G_RELEASE) : G_FALL
        if (wantFast) {
          gr = G_FAST
          if (!g.fastFall && g.y < GROUND_Y - 30) g.fastFall = true
        }
        g.vy = Math.min(1250, g.vy + gr * dt)
        g.y += g.vy * dt
        g.spin += dt * (g.vy < 0 ? 15 : 11)
        if (g.y >= GROUND_Y && !overPit && g.vy >= 0) {
          const impact = g.vy
          g.y = GROUND_Y
          g.vy = 0
          g.grounded = true
          g.air2 = true
          const k = Math.min(1, impact / 900)
          g.sx = 1 + 0.5 * k
          g.sy = 1 - 0.42 * k
          juice.burst(PCX, GROUND_Y - 1, ['#e9c48e', '#d9a96a', '#f3d9ae'], { count: 4 + Math.round(k * 9), speed: 90 + k * 80, angle: -Math.PI / 2, arc: 2.6, life: 0.45, size: 4, gravity: 120 })
          if (impact > 350) sfx.land()
          if (g.fastFall) {
            juice.shake(0.28)
            juice.burst(PCX, GROUND_Y - 2, ['#f3d9ae', '#ffffff'], { count: 10, speed: 190, angle: -Math.PI / 2, arc: 3.1, life: 0.4, size: 4, gravity: 80 })
            tone({ freq: 140, to: 55, dur: 0.14, vol: 0.06, type: 'triangle' })
            noise({ dur: 0.12, vol: 0.05, freq: 500 })
          }
          g.fastFall = false
          if (g.jumpBuf > 0) doJump(g, false)
        }
        if (overPit && g.y > GROUND_Y + 46) {
          if (g.shield) {
            g.shield = false
            g.invuln = 1.3
            g.vy = -880
            g.air2 = true
            g.streak = 0
            juice.text(PCX, GROUND_Y - 60, 'ESCUDO', '#4cc9f0', 9, 0.9)
            juice.burst(PCX, GROUND_Y, ['#4cc9f0', '#ffffff'], { count: 16, speed: 200, life: 0.5, size: 4 })
            juice.shake(0.3)
            sfx.hurt()
          } else {
            die(g, null, true)
            return
          }
        }
      } else {
        // polvo al correr
        g.dustT -= dt
        if (g.dustT <= 0) {
          g.dustT = g.ducking ? 0.03 : 0.07
          juice.burst(PX + 6, GROUND_Y - 1, ['#e9c48e', '#d9a96a'], { count: g.ducking ? 2 : 1, speed: 50, angle: Math.PI + 0.45, arc: 0.7, life: 0.35, size: 3, gravity: -10 })
        }
      }

      // ---- obstáculos ----
      if (g.dist >= g.nextSpawn) spawnEvent(g)
      const pb = getPlayerBox(g)
      for (const o of g.obstacles) {
        o.x -= (g.speed + o.vx) * dt
        o.t += dt
        if (o.kind === 'vulture-low' || o.kind === 'vulture-high') o.y = o.baseY + Math.sin(o.t * 3.3 + o.seed) * 5
        else if (o.kind === 'tumble') o.y = o.baseY - Math.abs(Math.sin(o.t * 3.4 + o.seed)) * 34
        if (o.kind === 'pit' || o.dead) continue

        const horiz = pb.x < o.x + o.w + 2 && pb.x + pb.w > o.x - 2
        if (horiz) {
          const bottom = pb.y + pb.h
          const gapV = bottom <= o.y ? o.y - bottom : pb.y >= o.y + o.h ? pb.y - (o.y + o.h) : 999
          if (gapV < o.minGap) o.minGap = gapV
        } else if (!o.passed && o.x + o.w < pb.x - 2) {
          o.passed = true
          if (o.minGap < 14) nearMiss(g, o)
        }

        if (g.invuln <= 0 && aabb(pb.x, pb.y, pb.w, pb.h, o.x, o.y, o.w, o.h)) {
          if (g.shield) {
            g.shield = false
            g.invuln = 1.3
            o.dead = true
            g.streak = 0
            juice.freeze(70)
            juice.shake(0.45)
            juice.flash('#4cc9f0', 0.3)
            juice.burst(o.x + o.w / 2, o.y + o.h / 2, ['#4cc9f0', '#ffffff', '#3e9b4f'], { count: 20, speed: 220, life: 0.55, size: 5, gravity: 300 })
            juice.text(PCX, g.y - 64, 'ESCUDO ROTO', '#4cc9f0', 9, 1)
            sfx.hurt()
          } else {
            die(g, o, false)
            return
          }
        }
      }
      g.obstacles = g.obstacles.filter((o) => !o.dead && o.x > -110)

      // ---- objetos recogibles ----
      const pick0 = g.ducking ? { x: PX, y: g.y - 20, w: 44, h: 20 } : { x: PX - 2, y: g.y - 40, w: 46, h: 40 }
      const cx = PCX
      const cy = g.y - 18
      for (const it of g.items) {
        it.x -= g.speed * dt
        it.t += dt
        const isCoin = it.kind === 'coin' || it.kind === 'gem'
        if (isCoin && g.magnetT > 0) {
          const dx = cx - it.x
          const dy = cy - it.y
          const d = Math.hypot(dx, dy)
          if (d < MAG_R && d > 1) {
            const sp = 380 + (MAG_R - d) * 5
            it.x += (dx / d) * sp * dt
            it.y += (dy / d) * sp * dt
          }
        }
        const r = it.kind === 'coin' ? 9 : it.kind === 'gem' ? 11 : 14
        if (aabb(pick0.x, pick0.y, pick0.w, pick0.h, it.x - r, it.y - r, r * 2, r * 2)) {
          const px0 = it.x
          it.x = -999
          if (it.kind === 'coin') {
            g.coins++
            addStreak(g, 1)
            g.bonus += 10 * g.mult
            juice.burst(px0, it.y, ['#ffd23d', '#fff6c2'], { count: 4, speed: 70, life: 0.3, size: 3 })
            tone({ freq: 880 + Math.min(10, g.streak) * 48, dur: 0.07, vol: 0.04, type: 'square' })
            tone({ freq: 1320 + Math.min(10, g.streak) * 48, dur: 0.09, vol: 0.035, delay: 0.05, type: 'square' })
          } else if (it.kind === 'gem') {
            g.coins += 5
            addStreak(g, 4)
            g.bonus += 50 * g.mult
            juice.text(cx + 10, g.y - 54, `+${50 * g.mult}`, '#9bf6ff', 10, 0.9)
            juice.burst(cx, cy - 10, ['#9bf6ff', '#ffffff', '#a78bfa'], { count: 14, speed: 150, life: 0.5, size: 4 })
            sfx.golden()
          } else {
            if (it.kind === 'shield') g.shield = true
            else if (it.kind === 'magnet') g.magnetT = 9
            else g.bootsT = 9
            const label = it.kind === 'shield' ? 'ESCUDO' : it.kind === 'magnet' ? 'IMAN' : 'BOTAS'
            juice.text(cx, g.y - 64, label, PU_COLOR[it.kind], 10, 1)
            juice.burst(cx, cy, [PU_COLOR[it.kind], '#ffffff'], { count: 16, speed: 170, life: 0.5, size: 4 })
            juice.flash(PU_COLOR[it.kind], 0.15)
            sfx.power()
            sfx.potion()
          }
        }
      }
      g.items = g.items.filter((it) => it.x > -40)

      // ---- HUD (limitado) ----
      hudT += dt
      if (hudT > 0.09) {
        hudT = 0
        const sc = scoreOf(g)
        if (sc !== scoreRef.current) {
          scoreRef.current = sc
          setScore(sc)
        }
      }
    }

    // ------------------------------ dibujo ------------------------------
    const txt = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') => {
      ctx.font = `${size}px ${PIX}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillText(s, x + 1.2, y + 1.2)
      ctx.fillStyle = color
      ctx.fillText(s, x, y)
    }

    const ridge = (scroll: number, baseY: number, a1: number, w1: number, a2: number, w2: number, color: string, flat = 0) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = x + scroll
        let h = Math.sin(wx / w1) * a1 + Math.sin(wx / w2 + 1.7) * a2
        if (flat > 0) h = Math.min(h, flat)
        ctx.lineTo(x, baseY - h)
      }
      ctx.lineTo(W + 8, H)
      ctx.closePath()
      ctx.fill()
    }

    const cactusShape = (cx: number, h: number, shade: boolean) => {
      const tw = Math.max(9, h * 0.25)
      const base = GROUND_Y + 2
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.beginPath()
      ctx.ellipse(cx, GROUND_Y + 3, tw + 7, 3.2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = shade ? '#256d37' : '#2f8a45'
      rr(ctx, cx - tw / 2, base - h, tw, h, tw / 2)
      ctx.fill()
      const ah = h * 0.3
      const ay1 = base - h * 0.55
      const ay2 = base - h * 0.4
      rr(ctx, cx - tw / 2 - 9, ay1, 11, 5.5, 2.7)
      ctx.fill()
      rr(ctx, cx - tw / 2 - 9, ay1 - ah + 5.5, 5.5, ah, 2.7)
      ctx.fill()
      rr(ctx, cx + tw / 2 - 2, ay2, 11, 5.5, 2.7)
      ctx.fill()
      rr(ctx, cx + tw / 2 + 3.5, ay2 - ah * 0.8 + 5.5, 5.5, ah * 0.8, 2.7)
      ctx.fill()
      ctx.fillStyle = shade ? '#3c9b53' : '#58c673'
      rr(ctx, cx - tw / 2 + tw * 0.2, base - h + 5, tw * 0.24, h - 11, 2)
      ctx.fill()
      ctx.fillStyle = '#ff8a7a'
      ctx.beginPath()
      ctx.arc(cx, base - h + 1, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawObstacle = (o: Obstacle, g: Game) => {
      const cx = o.x + o.w / 2
      switch (o.kind) {
        case 'cactus-s':
          cactusShape(cx, 42, false)
          break
        case 'cactus-b':
          cactusShape(cx, 58, false)
          break
        case 'cactus-2':
          cactusShape(o.x + 14, 46, true)
          cactusShape(o.x + o.w - 14, 36, false)
          break
        case 'cactus-3':
          cactusShape(o.x + 13, 38, false)
          cactusShape(o.x + o.w / 2, 52, true)
          cactusShape(o.x + o.w - 13, 42, false)
          break
        case 'rock': {
          ctx.fillStyle = 'rgba(0,0,0,0.16)'
          ctx.beginPath()
          ctx.ellipse(cx, GROUND_Y + 3, o.w / 2 + 4, 3.2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#9a6330'
          ctx.beginPath()
          ctx.moveTo(o.x - 2, GROUND_Y + 2)
          ctx.quadraticCurveTo(o.x + 2, o.y - 2, o.x + o.w * 0.42, o.y - 3)
          ctx.quadraticCurveTo(o.x + o.w * 0.9, o.y - 1, o.x + o.w + 3, GROUND_Y + 2)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#c28a4e'
          ctx.beginPath()
          ctx.ellipse(cx - 5, o.y + 6, o.w * 0.26, 5, -0.3, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'boulder': {
          const r = o.w / 2 + 2
          ctx.fillStyle = 'rgba(0,0,0,0.16)'
          ctx.beginPath()
          ctx.ellipse(cx, GROUND_Y + 3, r, 3.2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.save()
          ctx.translate(cx, o.y + o.h / 2)
          ctx.rotate(-o.t * 7)
          ctx.fillStyle = '#8a5a30'
          ctx.beginPath()
          ctx.arc(0, 0, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#6e4623'
          ctx.beginPath()
          ctx.arc(-5, -4, 4, 0, Math.PI * 2)
          ctx.arc(6, 3, 3, 0, Math.PI * 2)
          ctx.arc(-2, 8, 2.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#b98550'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, r - 2, 3.6, 5)
          ctx.stroke()
          ctx.restore()
          // estela de velocidad
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 2
          for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            ctx.moveTo(cx + r + 6 + i * 3, o.y + 6 + i * 8)
            ctx.lineTo(cx + r + 20 + i * 3, o.y + 6 + i * 8)
            ctx.stroke()
          }
          break
        }
        case 'tumble': {
          const sh = (GROUND_Y - (o.y + o.h)) / 40
          ctx.fillStyle = `rgba(0,0,0,${0.16 - sh * 0.07})`
          ctx.beginPath()
          ctx.ellipse(cx, GROUND_Y + 3, 13 - sh * 3, 3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.save()
          ctx.translate(cx, o.y + o.h / 2)
          ctx.rotate(-o.t * 6)
          ctx.strokeStyle = '#a4743a'
          ctx.lineWidth = 1.6
          for (let i = 0; i < 7; i++) {
            ctx.beginPath()
            ctx.ellipse(0, 0, 12, 6 + (i % 3) * 2, (i * Math.PI) / 7, 0, Math.PI * 1.6)
            ctx.stroke()
          }
          ctx.restore()
          break
        }
        case 'vulture-low':
        case 'vulture-high': {
          const x = o.x + o.w / 2
          const y = o.y + o.h / 2
          const flap = Math.sin(o.t * 9 + o.seed)
          ctx.fillStyle = 'rgba(0,0,0,0.13)'
          ctx.beginPath()
          ctx.ellipse(x, GROUND_Y + 3, 16, 3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#6b4a8c'
          ctx.beginPath()
          ctx.ellipse(x, y + 1, 13, 7.5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#85609f'
          ctx.beginPath()
          ctx.moveTo(x + 2, y - 2)
          ctx.quadraticCurveTo(x + 12, y - 4 - flap * 16, x + 24, y - 8 - flap * 12)
          ctx.quadraticCurveTo(x + 14, y + 2, x + 4, y + 3)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x - 2, y - 2)
          ctx.quadraticCurveTo(x - 12, y - 4 - flap * 16, x - 24, y - 8 - flap * 12)
          ctx.quadraticCurveTo(x - 14, y + 2, x - 4, y + 3)
          ctx.fill()
          // cabeza hacia la izquierda (viene hacia ti)
          ctx.fillStyle = '#e86a5c'
          ctx.beginPath()
          ctx.arc(x - 14, y - 2, 5.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffd23d'
          ctx.beginPath()
          ctx.moveTo(x - 18, y - 3)
          ctx.lineTo(x - 26, y)
          ctx.lineTo(x - 18, y + 1.5)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(x - 15, y - 3.6, 1.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#1b1020'
          ctx.fillRect(x - 15.6, y - 4, 1.3, 1.3)
          break
        }
        case 'pit':
          break
      }
      if (g.hitObs === o && Math.floor(g.deathT * 12) % 2 === 0) {
        ctx.strokeStyle = '#ff3d3d'
        ctx.lineWidth = 2
        ctx.strokeRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4)
      }
    }

    const drawPit = (o: Obstacle) => {
      const hole = ctx.createLinearGradient(0, GROUND_Y, 0, H)
      hole.addColorStop(0, '#1a0f10')
      hole.addColorStop(1, '#050304')
      ctx.fillStyle = hole
      ctx.fillRect(o.x, GROUND_Y, o.w, H - GROUND_Y)
      // bordes con dientes
      ctx.fillStyle = css(pal.groundDark)
      ctx.beginPath()
      ctx.moveTo(o.x - 4, GROUND_Y)
      ctx.lineTo(o.x, GROUND_Y + 14)
      ctx.lineTo(o.x + 4, GROUND_Y)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(o.x + o.w + 4, GROUND_Y)
      ctx.lineTo(o.x + o.w, GROUND_Y + 14)
      ctx.lineTo(o.x + o.w - 4, GROUND_Y)
      ctx.closePath()
      ctx.fill()
      // ojos brillantes en la oscuridad
      const blink = Math.sin(performance.now() / 260 + o.seed) > 0.85 ? 0 : 1
      if (blink) {
        ctx.fillStyle = 'rgba(255,60,60,0.8)'
        ctx.fillRect(o.x + o.w / 2 - 7, GROUND_Y + 40, 3, 3)
        ctx.fillRect(o.x + o.w / 2 + 4, GROUND_Y + 40, 3, 3)
      }
    }

    const drawCoin = (it: Item) => {
      const bob = Math.sin(it.t * 4) * 2
      if (it.kind === 'coin') {
        const sw = Math.abs(Math.cos(it.t * 5)) * 0.75 + 0.25
        ctx.fillStyle = '#c9901b'
        ctx.beginPath()
        ctx.ellipse(it.x, it.y + bob, 8.5 * sw + 0.5, 9, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffd23d'
        ctx.beginPath()
        ctx.ellipse(it.x, it.y + bob, 6.6 * sw + 0.4, 7.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff3b0'
        ctx.fillRect(it.x - 1.2 * sw - 0.3, it.y + bob - 4, 2.2 * sw + 0.6, 5)
      } else if (it.kind === 'gem') {
        const s = 1 + Math.sin(it.t * 6) * 0.08
        ctx.save()
        ctx.translate(it.x, it.y + bob)
        ctx.scale(s, s)
        ctx.fillStyle = '#6d5bd0'
        ctx.beginPath()
        ctx.moveTo(0, -11)
        ctx.lineTo(9, -3)
        ctx.lineTo(0, 11)
        ctx.lineTo(-9, -3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#9bf6ff'
        ctx.beginPath()
        ctx.moveTo(0, -11)
        ctx.lineTo(9, -3)
        ctx.lineTo(0, -3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillRect(-4, -6, 2, 2)
        ctx.restore()
      } else {
        const c = PU_COLOR[it.kind]
        const y = it.y + bob * 1.5
        ctx.globalAlpha = 0.35 + Math.sin(it.t * 5) * 0.12
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(it.x, y, 19, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = '#1b1530'
        ctx.beginPath()
        ctx.arc(it.x, y, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = c
        ctx.lineWidth = 2.5
        ctx.stroke()
        icon(it.kind, it.x, y, 1)
      }
    }

    const icon = (kind: 'shield' | 'magnet' | 'boots' | ItemKind, x: number, y: number, s: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(s, s)
      if (kind === 'shield') {
        ctx.fillStyle = '#4cc9f0'
        ctx.beginPath()
        ctx.moveTo(0, -8)
        ctx.lineTo(7, -5)
        ctx.lineTo(6, 2)
        ctx.quadraticCurveTo(4, 7, 0, 9)
        ctx.quadraticCurveTo(-4, 7, -6, 2)
        ctx.lineTo(-7, -5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#d7f6ff'
        ctx.fillRect(-1, -5, 2, 11)
      } else if (kind === 'magnet') {
        ctx.strokeStyle = '#ef476f'
        ctx.lineWidth = 4
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.arc(0, -1, 6, Math.PI, 0)
        ctx.lineTo(6, 6)
        ctx.moveTo(-6, -1)
        ctx.lineTo(-6, 6)
        ctx.stroke()
        ctx.fillStyle = '#f1f1f1'
        ctx.fillRect(-8, 4, 4, 4)
        ctx.fillRect(4, 4, 4, 4)
      } else if (kind === 'boots') {
        ctx.strokeStyle = '#ffd166'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(-6, 1)
        ctx.lineTo(0, -5)
        ctx.lineTo(6, 1)
        ctx.moveTo(-6, 7)
        ctx.lineTo(0, 1)
        ctx.lineTo(6, 7)
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawArmadillo = (g: Game) => {
      const cx = PCX
      const fy = g.y
      const alpha = g.invuln > 0 && !g.dead && Math.floor(g.time * 16) % 2 === 0 ? 0.45 : 1
      ctx.globalAlpha = alpha

      // sombra
      if (!g.deathPit) {
        const h = Math.max(0, GROUND_Y - g.y)
        const k = Math.max(0.35, 1 - h / 190)
        ctx.fillStyle = `rgba(0,0,0,${0.2 * k})`
        ctx.beginPath()
        ctx.ellipse(cx, GROUND_Y + 3, 20 * k, 3.4 * k, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.save()
      ctx.translate(cx, fy)
      ctx.scale(1.16, 1.16)
      const ball = !g.grounded || g.dead
      if (ball) {
        ctx.translate(0, -16)
        ctx.scale(g.sx, g.sy)
        ctx.rotate(g.dead ? g.rot : g.spin)
        // caparazón en bola
        ctx.fillStyle = '#b45e2c'
        ctx.beginPath()
        ctx.arc(0, 0, 15.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#8a4520'
        ctx.lineWidth = 2
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.arc(i * 8, 0, 14, -1.1, 1.1)
          ctx.stroke()
        }
        ctx.fillStyle = '#d98241'
        ctx.beginPath()
        ctx.arc(-4, -6, 6.5, 0, Math.PI * 2)
        ctx.fill()
        // carita asomando
        ctx.fillStyle = '#f2c48d'
        ctx.beginPath()
        ctx.arc(11, 4, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2b1b10'
        ctx.fillRect(12, 2.4, 2.4, 2.4)
      } else {
        const duck = g.ducking
        ctx.scale(g.sx * (duck ? 1.25 : 1), g.sy * (duck ? 0.62 : 1))
        const bob = Math.sin(g.legT * 2) * 0.9
        // patas
        ctx.strokeStyle = '#8a4b2a'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        const a1 = Math.sin(g.legT) * 8
        const a2 = Math.sin(g.legT + Math.PI) * 8
        ctx.beginPath()
        ctx.moveTo(-10, -7)
        ctx.lineTo(-10 + a1, -0.5)
        ctx.moveTo(11, -7)
        ctx.lineTo(11 + a2, -0.5)
        ctx.stroke()
        ctx.strokeStyle = '#6e3a1f'
        ctx.beginPath()
        ctx.moveTo(-3, -7)
        ctx.lineTo(-3 + a2, -0.5)
        ctx.moveTo(18, -7)
        ctx.lineTo(18 + a1, -0.5)
        ctx.stroke()
        // cola
        ctx.strokeStyle = '#c96f3b'
        ctx.lineWidth = 4.5
        ctx.beginPath()
        ctx.moveTo(-16, -15 + bob)
        ctx.quadraticCurveTo(-27, -18 + bob + Math.sin(g.legT) * 2, -29, -9 + bob)
        ctx.stroke()
        // caparazón
        ctx.fillStyle = '#b45e2c'
        ctx.beginPath()
        ctx.ellipse(-2, -17 + bob, 19, 13.5, 0, Math.PI, 0)
        ctx.lineTo(17, -9 + bob)
        ctx.lineTo(-21, -9 + bob)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#8a4520'
        ctx.lineWidth = 1.8
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath()
          ctx.moveTo(-2 + i * 7.5, -9 + bob)
          ctx.quadraticCurveTo(-2 + i * 7, -22 + bob, -2 + i * 5.2, -29 + bob)
          ctx.stroke()
        }
        ctx.fillStyle = '#d98241'
        ctx.beginPath()
        ctx.ellipse(-6, -23 + bob, 8, 3.4, -0.25, 0, Math.PI * 2)
        ctx.fill()
        // panza
        ctx.fillStyle = '#f2c48d'
        rr(ctx, -14, -12 + bob, 30, 7, 3.5)
        ctx.fill()
        // cabeza
        ctx.fillStyle = '#e89a5d'
        ctx.beginPath()
        ctx.ellipse(18, -14 + bob, 8.5, 7.5, 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#d98241'
        ctx.beginPath()
        ctx.moveTo(12, -19 + bob)
        ctx.lineTo(10, -27 + bob)
        ctx.lineTo(17, -21 + bob)
        ctx.closePath()
        ctx.fill()
        // hocico
        ctx.fillStyle = '#f2c48d'
        ctx.beginPath()
        ctx.moveTo(22, -17 + bob)
        ctx.lineTo(33, -11 + bob)
        ctx.lineTo(22, -9 + bob)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#5c3317'
        ctx.beginPath()
        ctx.arc(32, -11.5 + bob, 1.8, 0, Math.PI * 2)
        ctx.fill()
        // ojo
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(20, -17 + bob, 3.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2b1b10'
        ctx.beginPath()
        ctx.arc(21.2, -17 + bob, 1.8, 0, Math.PI * 2)
        ctx.fill()
        // botas doradas
        if (g.bootsT > 0) {
          ctx.fillStyle = '#ffd166'
          ctx.fillRect(-14 + a1, -3, 8, 4)
          ctx.fillRect(7 + a2, -3, 8, 4)
        }
      }
      ctx.restore()
      ctx.globalAlpha = 1

      // escudo
      if (g.shield && !g.dead) {
        const cy = fy - 17
        const p = 1 + Math.sin(g.time * 7) * 0.05
        ctx.fillStyle = 'rgba(76,201,240,0.16)'
        ctx.beginPath()
        ctx.arc(cx, cy, 29 * p, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(160,230,255,0.85)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, 24 * p, 3.6, 4.5)
        ctx.stroke()
      }
      // campo del imán
      if (g.magnetT > 0 && !g.dead) {
        ctx.save()
        ctx.strokeStyle = `rgba(239,71,111,${g.magnetT < 2 ? 0.2 + 0.2 * Math.sin(g.time * 18) : 0.3})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 8])
        ctx.lineDashOffset = -g.time * 40
        ctx.beginPath()
        ctx.arc(cx, fy - 18, MAG_R, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    const drawWorld = (g: Game) => {
      // ciclo día / noche
      const m = meters(g)
      const phaseP = (0.12 + m / 1800) % 1
      palAt(phaseP, pal)

      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, css(pal.skyTop))
      sky.addColorStop(1, css(pal.skyBot))
      ctx.fillStyle = sky
      ctx.fillRect(-20, -20, W + 40, GROUND_Y + 20)

      // estrellas
      if (pal.stars > 0.02) {
        ctx.fillStyle = '#ffffff'
        for (const s of g.stars) {
          ctx.globalAlpha = pal.stars * (0.45 + 0.55 * Math.sin(g.time * 2 + s.ph))
          ctx.fillRect(s.x, s.y, s.s, s.s)
        }
        ctx.globalAlpha = 1
      }

      // sol y luna
      const a = phaseP * Math.PI * 2
      const sunX = W / 2 - Math.cos(a) * W * 0.46
      const sunY = 222 - Math.sin(a) * 178
      if (sunY < GROUND_Y - 30) {
        const warm = phaseP > 0.34 && phaseP < 0.56
        ctx.fillStyle = warm ? 'rgba(255,120,60,0.28)' : 'rgba(255,214,120,0.3)'
        ctx.beginPath()
        ctx.arc(sunX, sunY, 44, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = warm ? '#ff8a4c' : '#ffd27a'
        ctx.beginPath()
        ctx.arc(sunX, sunY, 28, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = warm ? '#ffb070' : '#fff0b0'
        ctx.beginPath()
        ctx.arc(sunX - 4, sunY - 4, 18, 0, Math.PI * 2)
        ctx.fill()
      }
      const moonX = W / 2 + Math.cos(a) * W * 0.46
      const moonY = 222 + Math.sin(a) * 178
      if (moonY < GROUND_Y - 30) {
        ctx.fillStyle = 'rgba(200,210,255,0.15)'
        ctx.beginPath()
        ctx.arc(moonX, moonY, 34, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e8ecff'
        ctx.beginPath()
        ctx.arc(moonX, moonY, 21, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#c6cdf0'
        ctx.beginPath()
        ctx.arc(moonX - 6, moonY - 4, 4, 0, Math.PI * 2)
        ctx.arc(moonX + 7, moonY + 5, 3, 0, Math.PI * 2)
        ctx.arc(moonX + 4, moonY - 8, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // nubes
      ctx.fillStyle = css(pal.cloud)
      ctx.globalAlpha = 0.85 - pal.stars * 0.5
      for (const c of g.clouds) {
        rr(ctx, c.x, c.y, 56 * c.s, 11 * c.s, 5.5 * c.s)
        ctx.fill()
        rr(ctx, c.x + 12 * c.s, c.y - 7 * c.s, 30 * c.s, 11 * c.s, 5.5 * c.s)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // parallax: mesetas lejanas, dunas medias y cercanas
      ridge(g.bg * 0.06, GROUND_Y - 78, 46, 90, 14, 37, css(pal.far), 30)
      ridge(g.bg * 0.16 + 300, GROUND_Y - 40, 24, 70, 9, 31, css(pal.mid))
      ridge(g.bg * 0.36 + 90, GROUND_Y - 14, 13, 55, 5, 23, css(pal.near))
      // saguaros de silueta en la capa cercana
      ctx.save()
      ctx.globalAlpha = 0.55
      const sc = g.bg * 0.36
      for (let i = 0; i < 4; i++) {
        const sx2 = ((((i * 190 - sc) % 760) + 760) % 760) - 60
        if (sx2 < -30 || sx2 > W + 30) continue
        const h = 26 + (i % 3) * 8
        ctx.fillStyle = css(pal.far)
        rr(ctx, sx2, GROUND_Y - 12 - h, 6, h, 3)
        ctx.fill()
        rr(ctx, sx2 - 6, GROUND_Y - 12 - h * 0.62, 6, 4, 2)
        ctx.fill()
        rr(ctx, sx2 - 6, GROUND_Y - 12 - h * 0.62 - 10, 4, 12, 2)
        ctx.fill()
        rr(ctx, sx2 + 6, GROUND_Y - 12 - h * 0.45, 6, 4, 2)
        ctx.fill()
        rr(ctx, sx2 + 8, GROUND_Y - 12 - h * 0.45 - 9, 4, 11, 2)
        ctx.fill()
      }
      ctx.restore()

      // suelo (con huecos para los pozos)
      ctx.fillStyle = css(pal.ground)
      ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20)
      ctx.fillStyle = css(pal.groundDark)
      ctx.fillRect(-20, GROUND_Y, W + 40, 4)
      ctx.globalAlpha = 0.5
      ctx.fillRect(-20, GROUND_Y + 26, W + 40, 2)
      ctx.fillRect(-20, GROUND_Y + 52, W + 40, 2)
      ctx.globalAlpha = 1
      for (const o of g.obstacles) if (o.kind === 'pit') drawPit(o)
      // piedrecillas y matas al ras
      ctx.fillStyle = css(pal.groundDark)
      ctx.globalAlpha = 0.6
      const off = g.bg
      for (let i = 0; i < 14; i++) {
        const px2 = ((((i * 47 - off) % 700) + 700) % 700) - 30
        if (px2 > W + 10) continue
        ctx.beginPath()
        ctx.arc(px2, GROUND_Y + 12 + ((i * 17) % 60), 1.8 + (i % 3) * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      // líneas de velocidad
      if (g.started && g.speed > 430) {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let i = 0; i < 7; i++) {
          const yy = GROUND_Y + 14 + ((i * 29) % 64)
          const xx = ((((i * 131 - g.bg * 1.6) % 520) + 520) % 520) - 40
          ctx.moveTo(xx, yy)
          ctx.lineTo(xx + 26 + (g.speed - 430) * 0.12, yy)
        }
        ctx.stroke()
      }

      // objetos y obstáculos
      for (const it of g.items) {
        if (it.x > -30 && it.x < W + 30) drawCoin(it)
      }
      for (const o of g.obstacles) if (o.kind !== 'pit') drawObstacle(o, g)

      drawArmadillo(g)

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, PIX)
    }

    const drawUi = (g: Game) => {
      // distancia
      txt(`${Math.floor(meters(g))} M`, W - 12, 18, 11, '#ffffff', 'right')

      // combo
      if (g.started && !g.dead) {
        if (g.streak > 0 && g.mult >= 1) {
          const frac = Math.max(0, g.comboT / 2.6)
          const bw = 64
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          rr(ctx, 12, 12, 92, 24, 7)
          ctx.fill()
          txt(`x${g.mult}`, 20, 24.5, 11, g.mult > 1 ? '#ffd23d' : '#ffffff')
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.fillRect(52, 21, bw * 0.6, 6)
          ctx.fillStyle = frac < 0.3 ? '#ff6b6b' : '#ffd23d'
          ctx.fillRect(52, 21, bw * 0.6 * frac, 6)
        }
        // chips de poderes
        let cxp = 20
        const chip = (kind: 'shield' | 'magnet' | 'boots', frac: number) => {
          ctx.fillStyle = 'rgba(15,10,30,0.6)'
          ctx.beginPath()
          ctx.arc(cxp, 52, 13, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = PU_COLOR[kind]
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(cxp, 52, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
          ctx.stroke()
          icon(kind, cxp, 52, 0.85)
          cxp += 32
        }
        if (g.shield) chip('shield', 1)
        if (g.magnetT > 0) chip('magnet', g.magnetT / 9)
        if (g.bootsT > 0) chip('boots', g.bootsT / 9)
      }

      // banner de hito
      if (g.banner) {
        const k = g.banner.t / 1.7
        const pop = k > 0.9 ? 1 + (k - 0.9) * 5 : 1
        ctx.globalAlpha = Math.min(1, k * 2.4)
        ctx.save()
        ctx.translate(W / 2, 96)
        ctx.scale(pop, pop)
        txt(g.banner.text, 0, 0, 24, '#ffd23d', 'center')
        txt('¡SIGUE ASI!', 0, 26, 8, '#ffffff', 'center')
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // pista inicial
      if (g.hintT > 0 && !g.dead) {
        ctx.globalAlpha = Math.min(1, g.hintT)
        txt('MANTEN PARA SALTAR MAS ALTO', W / 2, 150, 8, '#ffffff', 'center')
        ctx.globalAlpha = 1
      }

      // pausa
      if (g.paused) {
        ctx.fillStyle = 'rgba(14,8,4,0.62)'
        ctx.fillRect(0, 0, W, H)
        txt('PAUSA', W / 2, H / 2 - 10, 24, '#ffe9b8', 'center')
        txt('PULSA P PARA SEGUIR', W / 2, H / 2 + 24, 8, '#ffffff', 'center')
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      const g = G.current
      ctx.save()
      juice.applyShake(ctx)
      drawWorld(g)
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      drawUi(g)
    }

    // ------------------------------ bucle ------------------------------
    const loop = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000)
      last = now
      step(real)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const autoPause = () => {
      const g = G.current
      if (g.started && !g.dead && !g.paused) g.paused = true
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
  }, [begin, juice, justPressedRef, pressedRef, phaseRef])

  // ---- toque en pantalla: saltar (mantener = más alto); deslizar abajo = agacharse ----
  const onPtrDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (ptr.current) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // sin captura
    }
    ptr.current = { id: e.pointerId, y0: e.clientY, ducking: false }
    virtualPress('action')
  }
  const onPtrMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = ptr.current
    if (!p || p.id !== e.pointerId) return
    const dy = e.clientY - p.y0
    if (!p.ducking && dy > 38) {
      p.ducking = true
      virtualPress('down')
    } else if (p.ducking && dy < 16) {
      p.ducking = false
      virtualRelease('down')
    }
  }
  const onPtrEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = ptr.current
    if (!p || p.id !== e.pointerId) return
    virtualRelease('action')
    if (p.ducking) virtualRelease('down')
    ptr.current = null
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border border-[#e8a94f]/40 bg-[#1c1308] shadow-[0_8px_30px_rgba(232,169,79,0.25)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PUNTOS {score.toLocaleString('es-MX')}</span>
            {mult > 1 && <span className="text-[#ffd23d]">x{mult}</span>}
            <span className="text-white/60">RECORD {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrEnd}
          onPointerCancel={onPtrEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full object-contain touch-none select-none"
            aria-label="Juego Corredor del Desierto"
          />
          {phase === 'start' && (
            <StartOverlay
              title="CORREDOR DEL DESIERTO"
              accent={ACCENT}
              subtitle="Corre, salta y esquiva todo lo que encuentres en el camino."
              hint="Pulsa ESPACIO para correr"
              touchHint="Toca la pantalla para correr"
              onStart={begin}
            >
              <Tips />
            </StartOverlay>
          )}
          {phase === 'over' && (
            <GameOverOverlay
              title="¡TE ALCANZARON!"
              accent={ACCENT}
              score={score}
              best={best}
              newBest={newBest}
              stats={[
                { label: 'Distancia', value: `${stats.m} m` },
                { label: 'Monedas', value: stats.coins },
                { label: 'Raspones', value: stats.nm },
                { label: 'Mejor combo', value: `x${stats.mult}` },
              ]}
              onRestart={begin}
            />
          )}
        </div>
      </GameScreen>

      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Saltar"
        actionGlyph="A"
        showAction2
        action2Label="Agachar"
        action2Glyph="B"
      />
    </div>
  )
}
