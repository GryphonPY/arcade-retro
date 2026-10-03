'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'defensa-final'
const ACCENT = '#fb7185'

const W = 360
const H = 560
const GY = 522 // línea del suelo
const AMMO = 10
const PM_SPEED = 430
const EXTRA_CITY_EVERY = 10000

type Phase = 'menu' | 'intro' | 'fight' | 'bonus' | 'dying' | 'over'
type EKind = 'norm' | 'mirv' | 'smart' | 'child'

interface Bld {
  dx: number
  w: number
  h: number
  seed: number
}
interface City {
  x: number
  alive: boolean
  bld: Bld[]
  smoke: number
  born: number
}
interface Batt {
  x: number
  alive: boolean
  ammo: number
  smoke: number
  recoil: number
}
interface Root {
  max: number
}
interface Enemy {
  kind: EKind
  x: number
  y: number
  sx: number
  sy: number
  tx: number
  ty: number
  vx: number
  vy: number
  speed: number
  splitY: number
  path: number[]
}
interface PMissile {
  x: number
  y: number
  sx: number
  sy: number
  tx: number
  ty: number
}
interface Boom {
  x: number
  y: number
  r: number
  maxR: number
  t: number
  dur: number
  chain: number
  kind: 'p' | 'c' | 'g'
  root: Root | null
}
interface Plane {
  x: number
  y: number
  dir: 1 | -1
  speed: number
  drops: number
  dropT: number
}
interface Fade {
  pts: number[]
  life: number
  color: string
}
interface Bonus {
  stage: number
  timer: number
  ammoTotal: number
  ammoCnt: number
  ammoPts: number
  cityTotal: number
  cityCnt: number
  cityPts: number
  mult: number
  wave: number
}
interface Game {
  phase: Phase
  paused: boolean
  t: number
  score: number
  wave: number
  cities: City[]
  batts: Batt[]
  enemies: Enemy[]
  pms: PMissile[]
  booms: Boom[]
  planes: Plane[]
  fades: Fade[]
  toSpawn: number
  spawnT: number
  planesLeft: number
  planeT: number
  introT: number
  endT: number
  bonus: Bonus | null
  reserve: number
  nextExtra: number
  kills: number
  bestChain: number
  chainBanner: { n: number; t: number } | null
  cityBanner: number
  aimX: number
  aimY: number
  showAim: boolean
  moveHold: number
  dyingT: number
  overT: number
  hintT: number
  targetMarks: number
}
interface Result {
  score: number
  wave: number
  kills: number
  bestChain: number
  newBest: boolean
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const mulFor = (wave: number) => Math.min(6, 1 + Math.floor((wave - 1) / 2))

interface Pal {
  top: string
  bot: string
  mtn: string
  gnd: string
  gndTop: string
  star: string
}
const PALS: Pal[] = [
  { top: '#070b24', bot: '#1d2f73', mtn: '#141a3d', gnd: '#10142e', gndTop: '#3b4a96', star: '#dbeafe' },
  { top: '#14072a', bot: '#5b2380', mtn: '#2a1245', gnd: '#1a0c30', gndTop: '#8b4cc0', star: '#f5d0fe' },
  { top: '#031a22', bot: '#0f6470', mtn: '#0a3540', gnd: '#08222a', gndTop: '#2fa1ae', star: '#ccfbf1' },
  { top: '#240810', bot: '#8a2c1c', mtn: '#4a1414', gnd: '#2a0c0c', gndTop: '#d9663f', star: '#fed7aa' },
  { top: '#06220f', bot: '#1f7040', mtn: '#0f3a22', gnd: '#0a2616', gndTop: '#45b673', star: '#d9f99d' },
  { top: '#250a28', bot: '#82206a', mtn: '#461443', gnd: '#2a0c2b', gndTop: '#d049b0', star: '#fbcfe8' },
]

// ---------- sonidos locales ----------
let lastBoomSnd = 0
const sLaunch = () => {
  tone({ freq: 420, to: 1500, dur: 0.14, type: 'triangle', vol: 0.05 })
  noise({ dur: 0.08, vol: 0.03, freq: 2400 })
}
const sBoom = (big = false) => {
  const now = performance.now()
  if (now - lastBoomSnd < 45) return
  lastBoomSnd = now
  noise({ dur: big ? 0.45 : 0.3, vol: big ? 0.09 : 0.065, freq: big ? 700 : 1100 })
  tone({ freq: big ? 150 : 210, to: 50, dur: 0.26, type: 'sine', vol: 0.07 })
}
const sChain = (n: number) => {
  const f = 330 * Math.pow(2, Math.min(n, 10) / 6)
  tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.05 })
  tone({ freq: f * 2, dur: 0.16, type: 'sine', vol: 0.03, delay: 0.04 })
}
const sCityDown = () => {
  noise({ dur: 0.8, vol: 0.13, freq: 500 })
  tone({ freq: 110, to: 35, dur: 0.7, type: 'sawtooth', vol: 0.08 })
}
const sAlarm = () => {
  for (let i = 0; i < 4; i++) tone({ freq: i % 2 ? 560 : 780, dur: 0.17, type: 'square', vol: 0.035, delay: i * 0.18 })
}
const sTic = (k: number) => tone({ freq: 900 + k * 18, dur: 0.035, type: 'square', vol: 0.03 })
const sTicCity = (k: number) => {
  tone({ freq: 520 + k * 90, dur: 0.1, type: 'square', vol: 0.045 })
  tone({ freq: 780 + k * 90, dur: 0.1, type: 'triangle', vol: 0.035, delay: 0.04 })
}
const sEmpty = () => tone({ freq: 150, dur: 0.09, type: 'square', vol: 0.04 })
const sExtra = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.07, type: 'square' }))
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })
const sStart = () => [392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.04, delay: i * 0.06, type: 'square' }))
const sSplit = () => tone({ freq: 900, to: 400, dur: 0.12, type: 'sawtooth', vol: 0.03 })
const sOver = () => [440, 330, 247, 165].forEach((f, i) => tone({ freq: f, dur: 0.22, vol: 0.06, delay: i * 0.18, type: 'sawtooth' }))

// ---------- construcción ----------
function seeded(n: number) {
  const s = Math.sin(n * 91.7 + 13.3) * 43758.5453
  return s - Math.floor(s)
}

function makeCity(x: number, idx: number): City {
  const bld: Bld[] = []
  let dx = -13
  let k = 0
  while (dx < 12) {
    const w = 4 + Math.floor(seeded(idx * 17 + k * 3 + 1) * 3)
    const h = 9 + Math.floor(seeded(idx * 13 + k * 7 + 2) * 14)
    bld.push({ dx, w: Math.min(w, 14 - dx), h, seed: idx * 31 + k })
    dx += w + 1
    k++
  }
  return { x, alive: true, bld, smoke: 0, born: 0 }
}

const CITY_X = [64, 101, 138, 222, 259, 296]
const BATT_X = [26, 180, 334]

function newGame(): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    score: 0,
    wave: 0,
    cities: CITY_X.map((x, i) => makeCity(x, i)),
    batts: BATT_X.map((x) => ({ x, alive: true, ammo: AMMO, smoke: 0, recoil: 0 })),
    enemies: [],
    pms: [],
    booms: [],
    planes: [],
    fades: [],
    toSpawn: 0,
    spawnT: 0,
    planesLeft: 0,
    planeT: 0,
    introT: 0,
    endT: 0,
    bonus: null,
    reserve: 0,
    nextExtra: EXTRA_CITY_EVERY,
    kills: 0,
    bestChain: 0,
    chainBanner: null,
    cityBanner: 0,
    aimX: W / 2,
    aimY: 280,
    showAim: false,
    moveHold: 0,
    dyingT: 0,
    overT: 0,
    hintT: 0,
    targetMarks: 0,
  }
}

export default function DefensaFinal() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, wave: 0, kills: 0, bestChain: 0, newBest: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const stars = Array.from({ length: 70 }, (_, i) => ({
      x: seeded(i * 3 + 1) * W,
      y: seeded(i * 3 + 2) * (GY - 90),
      s: seeded(i * 3 + 3) > 0.85 ? 2 : 1,
      p: seeded(i * 5 + 7) * 6,
    }))
    const mtn: number[] = []
    for (let x = 0; x <= W + 20; x += 20) mtn.push(GY - 8 - seeded(x * 0.3 + 4) * 26 - Math.abs(Math.sin(x * 0.02)) * 10)

    let lastScore = -1
    const pushScore = () => {
      if (g.score !== lastScore) {
        lastScore = g.score
        setScore(g.score)
      }
    }

    // ---------- utilidades de juego ----------
    const aliveCities = () => g.cities.reduce((n, c) => n + (c.alive ? 1 : 0), 0)
    const totalAmmo = () => g.batts.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0)

    const giveCity = () => {
      const dead = g.cities.filter((c) => !c.alive)
      if (dead.length) {
        const c = dead[(Math.random() * dead.length) | 0]
        c.alive = true
        c.born = 1
        juice.text(c.x, GY - 40, 'CIUDAD EXTRA', '#86efac', 9, 1.4)
        juice.burst(c.x, GY - 10, ['#86efac', '#ffffff', '#fde68a'], { count: 16, speed: 90, angle: -Math.PI / 2, arc: 2.4, life: 0.8, size: 3, gravity: 80 })
        g.cityBanner = 1.6
        sExtra()
      } else {
        g.reserve++
        juice.text(W / 2, 200, 'CIUDAD DE RESERVA', '#86efac', 9, 1.4)
        sExtra()
      }
    }

    const addScore = (n: number) => {
      g.score += n
      while (g.score >= g.nextExtra) {
        g.nextExtra += EXTRA_CITY_EVERY
        giveCity()
      }
      pushScore()
    }

    const pickTarget = () => {
      const opts: number[] = []
      g.cities.forEach((c) => c.alive && opts.push(c.x))
      g.batts.forEach((b) => b.alive && opts.push(b.x))
      if (!opts.length) return rand(20, W - 20)
      return opts[(Math.random() * opts.length) | 0] + rand(-6, 6)
    }

    const spawnEnemy = (kind: EKind, x: number, y: number, speed: number) => {
      const tx = pickTarget()
      const ty = GY - 6
      const dx = tx - x
      const dy = ty - y
      const l = Math.hypot(dx, dy) || 1
      g.enemies.push({
        kind,
        x,
        y,
        sx: x,
        sy: y,
        tx,
        ty,
        vx: (dx / l) * speed,
        vy: (dy / l) * speed,
        speed,
        splitY: kind === 'mirv' ? rand(120, 250) : 9999,
        path: kind === 'smart' ? [x, y] : [],
      })
    }

    const trailColor = (k: EKind) => (k === 'mirv' ? '#fb923c' : k === 'smart' ? '#a78bfa' : '#f87171')

    const fadeEnemy = (e: Enemy) => {
      const pts = e.kind === 'smart' ? e.path.concat([e.x, e.y]) : [e.sx, e.sy, e.x, e.y]
      g.fades.push({ pts, life: 0.7, color: trailColor(e.kind) })
      if (g.fades.length > 40) g.fades.shift()
    }

    const addBoom = (x: number, y: number, maxR: number, dur: number, chain: number, kind: Boom['kind'], root: Root | null) => {
      if (g.booms.length > 90) return
      g.booms.push({ x, y, r: 0, maxR, t: 0, dur, chain, kind, root })
    }

    const wave_stats = (n: number) => {
      const missiles = Math.min(34, 7 + Math.floor(n * 2.3))
      const speed = Math.min(105, 30 + n * 5)
      const interval = Math.max(0.3, 1.4 - n * 0.07)
      const planes = n >= 3 ? Math.min(3, 1 + Math.floor((n - 3) / 3)) : 0
      const mirv = n >= 2 ? Math.min(0.3, 0.1 + (n - 2) * 0.03) : 0
      const smart = n >= 5 ? Math.min(0.35, 0.1 + (n - 5) * 0.04) : 0
      return { missiles, speed, interval, planes, mirv, smart }
    }

    const beginWave = () => {
      g.wave++
      const st = wave_stats(g.wave)
      g.toSpawn = st.missiles
      g.spawnT = 2.2
      g.planesLeft = st.planes
      g.planeT = rand(4, 7)
      g.introT = 2.4
      g.phase = 'intro'
      g.bonus = null
      g.batts.forEach((b) => {
        b.alive = true
        b.ammo = AMMO
      })
      setWave(g.wave)
      setUi('intro')
      sAlarm()
    }

    const startGame = () => {
      Object.assign(g, newGame())
      juice.reset()
      lastScore = -1
      g.showAim = !coarse
      g.hintT = 7
      setScore(0)
      setWave(0)
      beginWave()
      sStart()
    }
    startRef.current = startGame

    const finish = () => {
      g.phase = 'over'
      g.overT = 0
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, wave: g.wave, kills: g.kills, bestChain: g.bestChain, newBest: nb })
      setUi('over')
    }

    const destroyCity = (c: City) => {
      c.alive = false
      c.smoke = 0
      juice.burst(c.x, GY - 10, ['#fbbf24', '#f97316', '#ef4444', '#ffffff'], { count: 26, speed: 130, angle: -Math.PI / 2, arc: 2.8, life: 0.9, size: 3.5, gravity: 220 })
      juice.burst(c.x, GY - 6, '#475569', { count: 12, speed: 60, angle: -Math.PI / 2, arc: 2.2, life: 1.2, size: 4, gravity: 120 })
      juice.shake(0.55)
      juice.freeze(90)
      juice.flash('#ff6b6b', 0.28)
      sCityDown()
      if (aliveCities() === 0 && g.phase !== 'dying' && g.phase !== 'over') {
        g.phase = 'dying'
        g.dyingT = 0
        sOver()
      }
    }

    const groundHit = (x: number) => {
      addBoom(x, GY - 2, 22, 0.55, 0, 'g', null)
      juice.burst(x, GY - 2, ['#fed7aa', '#fb923c', '#ef4444'], { count: 12, speed: 100, angle: -Math.PI / 2, arc: 2.6, life: 0.5, size: 3, gravity: 200 })
      juice.shake(0.25)
      sBoom(true)
      for (const c of g.cities) if (c.alive && Math.abs(c.x - x) < 19) destroyCity(c)
      for (const b of g.batts) {
        if (b.alive && Math.abs(b.x - x) < 25) {
          b.alive = false
          b.smoke = 0
          juice.burst(b.x, GY - 10, ['#fbbf24', '#f97316', '#ffffff'], { count: 20, speed: 120, angle: -Math.PI / 2, arc: 2.8, life: 0.8, size: 3, gravity: 220 })
          juice.shake(0.4)
          juice.text(clamp(b.x, 52, W - 52), GY - 44, 'BATERIA PERDIDA', '#fca5a5', 8, 1.2)
        }
      }
    }

    const fire = (x: number, y: number) => {
      if (g.phase !== 'intro' && g.phase !== 'fight') return
      const tx = clamp(x, 4, W - 4)
      const ty = clamp(y, 8, GY - 26)
      let bi = -1
      let bd = 1e9
      g.batts.forEach((b, i) => {
        if (!b.alive || b.ammo <= 0) return
        const d = Math.abs(b.x - tx)
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      if (bi < 0) {
        juice.text(clamp(tx, 50, W - 50), clamp(ty, 40, GY - 40), 'SIN MUNICION', '#fca5a5', 8, 0.9)
        sEmpty()
        return
      }
      const b = g.batts[bi]
      b.ammo--
      b.recoil = 1
      g.pms.push({ x: b.x, y: GY - 22, sx: b.x, sy: GY - 22, tx, ty })
      juice.burst(b.x, GY - 24, ['#ffffff', '#fecdd3'], { count: 4, speed: 50, angle: -Math.PI / 2, arc: 1.2, life: 0.25, size: 2 })
      sLaunch()
    }

    const killEnemy = (e: Enemy, b: Boom) => {
      fadeEnemy(e)
      const c = b.chain + 1
      const mult = mulFor(g.wave)
      const base = e.kind === 'smart' ? 125 : e.kind === 'mirv' ? 50 : 25
      const pts = base * mult * c
      addScore(pts)
      g.kills++
      addBoom(e.x, e.y, 28 + Math.min(c, 5) * 2, 0.8, c, 'c', b.root)
      juice.burst(e.x, e.y, ['#ffffff', '#fde68a', '#fb7185'], { count: 6, speed: 80, life: 0.4, size: 2.5, drag: 3 })
      juice.text(e.x, e.y - 8, `+${pts}`, c >= 2 ? '#fde68a' : '#ffffff', c >= 3 ? 10 : 8, 0.7)
      if (b.root && c > b.root.max) {
        b.root.max = c
        if (c >= 2) {
          sChain(c)
          if (c > g.bestChain) g.bestChain = c
          if (c >= 3) {
            g.chainBanner = { n: c, t: 1.5 }
            juice.shake(0.12 + Math.min(c, 8) * 0.025)
            juice.freeze(30)
          }
        }
      }
      sBoom()
    }

    const killPlane = (p: Plane, b: Boom) => {
      const c = b.chain + 1
      const pts = 100 * mulFor(g.wave) * c
      addScore(pts)
      g.kills++
      addBoom(p.x, p.y, 40, 0.9, c, 'c', b.root)
      juice.burst(p.x, p.y, ['#e2e8f0', '#fbbf24', '#f97316', '#ffffff'], { count: 22, speed: 140, life: 0.8, size: 3.5, gravity: 140 })
      juice.text(p.x, p.y - 12, `+${pts}`, '#fde68a', 11, 1)
      juice.shake(0.3)
      juice.freeze(50)
      if (b.root && c > b.root.max) {
        b.root.max = c
        if (c >= 2 && c > g.bestChain) g.bestChain = c
        if (c >= 3) g.chainBanner = { n: c, t: 1.5 }
      }
      sBoom(true)
    }

    const startBonus = () => {
      const mult = mulFor(g.wave)
      g.phase = 'bonus'
      setUi('bonus')
      g.bonus = {
        stage: 0,
        timer: 0.7,
        ammoTotal: totalAmmo(),
        ammoCnt: 0,
        ammoPts: 0,
        cityTotal: aliveCities(),
        cityCnt: 0,
        cityPts: 0,
        mult,
        wave: g.wave,
      }
    }

    const updateBonus = (dt: number) => {
      const bn = g.bonus
      if (!bn) return
      bn.timer -= dt
      if (bn.timer > 0) return
      if (bn.stage === 0) {
        bn.stage = 1
        bn.timer = 0
      } else if (bn.stage === 1) {
        if (bn.ammoCnt < bn.ammoTotal) {
          bn.ammoCnt++
          bn.ammoPts += 5 * bn.mult
          addScore(5 * bn.mult)
          // vacía los pips de la batería con más munición
          let m: Batt | null = null
          for (const b of g.batts) if (b.alive && b.ammo > 0 && (!m || b.ammo > m.ammo)) m = b
          if (m) m.ammo--
          sTic(bn.ammoCnt)
          bn.timer = 0.055
        } else {
          bn.stage = 2
          bn.timer = bn.ammoTotal > 0 ? 0.45 : 0.15
        }
      } else if (bn.stage === 2) {
        if (bn.cityCnt < bn.cityTotal) {
          const alive = g.cities.filter((c) => c.alive)
          const c = alive[bn.cityCnt]
          bn.cityCnt++
          bn.cityPts += 100 * bn.mult
          addScore(100 * bn.mult)
          if (c) {
            juice.text(c.x, GY - 36, `+${100 * bn.mult}`, '#fde68a', 8, 0.8)
            juice.burst(c.x, GY - 14, ['#fde68a', '#ffffff'], { count: 6, speed: 60, angle: -Math.PI / 2, arc: 1.6, life: 0.5, size: 2.5, gravity: 60 })
            c.born = 0.6
          }
          sTicCity(bn.cityCnt % 6)
          bn.timer = 0.2
        } else {
          bn.stage = 3
          bn.timer = 0.5
        }
      } else if (bn.stage === 3) {
        if (g.reserve > 0 && g.cities.some((c) => !c.alive)) {
          g.reserve--
          giveCity()
          bn.timer = 0.5
        } else {
          bn.stage = 4
          bn.timer = 0.9
        }
      } else {
        beginWave()
      }
    }

    // ---------- entrada ----------
    const toLogical = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const sc = Math.min(r.width / W, r.height / H)
      const ox = (r.width - W * sc) / 2
      const oy = (r.height - H * sc) / 2
      return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc }
    }
    const setAim = (x: number, y: number) => {
      g.aimX = clamp(x, 4, W - 4)
      g.aimY = clamp(y, 8, GY - 24)
    }
    const togglePause = () => {
      if (g.phase === 'menu' || g.phase === 'over') return
      g.paused = !g.paused
      sPause()
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      const p = toLogical(e)
      setAim(p.x, p.y)
      g.showAim = e.pointerType !== 'touch'
      if (g.paused) {
        g.paused = false
        sPause()
        return
      }
      fire(p.x, p.y)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const p = toLogical(e)
      setAim(p.x, p.y)
      g.showAim = true
    }
    const onBlur = () => {
      if (g.phase !== 'menu' && g.phase !== 'over') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    // ---------- simulación ----------
    const simulate = (dt: number, raw: number) => {
      // misiles del jugador
      for (let i = g.pms.length - 1; i >= 0; i--) {
        const m = g.pms[i]
        const dx = m.tx - m.x
        const dy = m.ty - m.y
        const d = Math.hypot(dx, dy)
        const step = PM_SPEED * dt
        if (d <= step) {
          addBoom(m.tx, m.ty, 38, 1.0, 0, 'p', { max: 0 })
          juice.burst(m.tx, m.ty, ['#ffffff', '#fecdd3', ACCENT], { count: 8, speed: 70, life: 0.4, size: 2.5, drag: 3 })
          sBoom()
          g.pms.splice(i, 1)
        } else {
          m.x += (dx / d) * step
          m.y += (dy / d) * step
        }
      }

      // explosiones
      for (let i = g.booms.length - 1; i >= 0; i--) {
        const b = g.booms[i]
        b.t += dt
        if (b.t >= b.dur) {
          g.booms.splice(i, 1)
          continue
        }
        const g1 = b.dur * 0.25
        const h = b.dur * 0.2
        if (b.t < g1) b.r = b.maxR * (1 - Math.pow(1 - b.t / g1, 2))
        else if (b.t < g1 + h) b.r = b.maxR
        else b.r = b.maxR * Math.max(0, 1 - (b.t - g1 - h) / (b.dur - g1 - h))
      }
      const nb = g.booms.length

      // enemigos
      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const e = g.enemies[i]
        if (e.kind === 'smart') {
          let dx = e.tx - e.x
          let dy = e.ty - e.y
          const l = Math.hypot(dx, dy) || 1
          dx /= l
          dy /= l
          for (let j = 0; j < nb; j++) {
            const b = g.booms[j]
            if (b.kind === 'g' || b.r < 4) continue
            const ddx = e.x - b.x
            const ddy = e.y - b.y
            const d = Math.hypot(ddx, ddy) || 1
            const safe = b.r + 38
            if (d < safe) {
              const k = (safe - d) / safe
              dx += (ddx / d) * k * 3
              dy += (ddy / d) * k * 1.2
            }
          }
          if (dy < 0.3) dy = 0.3
          const nl = Math.hypot(dx, dy) || 1
          const k = Math.min(1, dt * 9)
          e.vx += ((dx / nl) * e.speed - e.vx) * k
          e.vy += ((dy / nl) * e.speed - e.vy) * k
        }
        e.x += e.vx * dt
        e.y += e.vy * dt
        if (e.kind === 'smart') {
          const n = e.path.length
          if (Math.hypot(e.x - e.path[n - 2], e.y - e.path[n - 1]) > 7) {
            e.path.push(e.x, e.y)
            if (e.path.length > 160) e.path.splice(0, 2)
          }
        }
        if (e.kind === 'mirv' && e.y >= e.splitY) {
          const n = 2 + (g.wave >= 6 ? 1 : 0) + (Math.random() < 0.4 ? 1 : 0)
          fadeEnemy(e)
          for (let k2 = 0; k2 < n; k2++) spawnEnemy('child', e.x, e.y, e.speed * rand(0.95, 1.15))
          juice.burst(e.x, e.y, ['#ffffff', '#fb923c'], { count: 8, speed: 60, life: 0.3, size: 2.5 })
          sSplit()
          g.enemies.splice(i, 1)
          continue
        }
        // colisión con explosiones
        let hit: Boom | null = null
        for (let j = 0; j < nb; j++) {
          const b = g.booms[j]
          if (b.kind === 'g') continue
          if (Math.hypot(e.x - b.x, e.y - b.y) <= b.r + 1.5) {
            hit = b
            break
          }
        }
        if (hit) {
          g.enemies.splice(i, 1)
          killEnemy(e, hit)
          continue
        }
        if (e.y >= e.ty) {
          g.enemies.splice(i, 1)
          fadeEnemy(e)
          groundHit(e.x)
        }
      }

      // aviones
      for (let i = g.planes.length - 1; i >= 0; i--) {
        const p = g.planes[i]
        p.x += p.dir * p.speed * dt
        p.dropT -= dt
        if (p.dropT <= 0 && p.drops > 0 && p.x > 24 && p.x < W - 24) {
          p.drops--
          p.dropT = rand(0.7, 1.3)
          spawnEnemy('norm', p.x, p.y + 6, wave_stats(g.wave).speed * 1.1)
        }
        let hit: Boom | null = null
        for (let j = 0; j < nb; j++) {
          const b = g.booms[j]
          if (b.kind === 'g') continue
          if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 9) {
            hit = b
            break
          }
        }
        if (hit) {
          g.planes.splice(i, 1)
          killPlane(p, hit)
        } else if (p.x < -40 || p.x > W + 40) {
          g.planes.splice(i, 1)
        }
      }

      // estelas que se desvanecen
      for (let i = g.fades.length - 1; i >= 0; i--) {
        g.fades[i].life -= raw
        if (g.fades[i].life <= 0) g.fades.splice(i, 1)
      }

      // humo de las ruinas
      for (const c of g.cities) {
        if (c.alive) {
          if (c.born > 0) c.born = Math.max(0, c.born - raw)
          continue
        }
        c.smoke -= raw
        if (c.smoke <= 0) {
          c.smoke = rand(0.18, 0.4)
          juice.burst(c.x + rand(-8, 8), GY - 6, '#6b7280', { count: 1, speed: 14, angle: -Math.PI / 2, arc: 0.7, life: 1.5, size: 4, gravity: -16, drag: 0.4 })
        }
      }
      for (const b of g.batts) {
        b.recoil = Math.max(0, b.recoil - raw * 6)
        if (b.alive) continue
        b.smoke -= raw
        if (b.smoke <= 0) {
          b.smoke = rand(0.2, 0.45)
          juice.burst(b.x + rand(-8, 8), GY - 6, '#6b7280', { count: 1, speed: 14, angle: -Math.PI / 2, arc: 0.7, life: 1.4, size: 4, gravity: -16, drag: 0.4 })
        }
      }
    }

    const spawnWaveStuff = (dt: number) => {
      const st = wave_stats(g.wave)
      g.spawnT -= dt
      if (g.toSpawn > 0 && g.spawnT <= 0) {
        let salvo = 1
        if (g.wave >= 4 && Math.random() < 0.35) salvo++
        if (g.wave >= 8 && Math.random() < 0.3) salvo++
        for (let i = 0; i < salvo && g.toSpawn > 0; i++) {
          g.toSpawn--
          const r = Math.random()
          let kind: EKind = 'norm'
          if (r < st.smart) kind = 'smart'
          else if (r < st.smart + st.mirv) kind = 'mirv'
          spawnEnemy(kind, rand(10, W - 10), -4, st.speed * rand(0.9, 1.12) * (kind === 'smart' ? 0.9 : 1))
        }
        g.spawnT = st.interval * rand(0.6, 1.4)
      }
      if (g.planesLeft > 0) {
        g.planeT -= dt
        if (g.planeT <= 0) {
          g.planesLeft--
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
          g.planes.push({
            x: dir > 0 ? -24 : W + 24,
            y: rand(50, 170),
            dir,
            speed: 52 + g.wave * 3,
            drops: 3 + (g.wave >= 6 ? 1 : 0),
            dropT: rand(0.6, 1.2),
          })
          g.planeT = rand(5, 9)
        }
      }
    }

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const want = jp.has('action')
      const wantPause = jp.has('pause')
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (wantPause) togglePause()
      if (g.paused) {
        if (want) {
          g.paused = false
          sPause()
        }
        return
      }

      // retícula con teclado
      const pr = pressedRef.current
      const ax = (pr.has('right') ? 1 : 0) - (pr.has('left') ? 1 : 0)
      const ay = (pr.has('down') ? 1 : 0) - (pr.has('up') ? 1 : 0)
      if (ax || ay) {
        g.showAim = true
        g.moveHold = Math.min(1, g.moveHold + rawDt * 1.6)
        const sp = 190 + g.moveHold * 230
        const n = ax && ay ? 0.7071 : 1
        setAim(g.aimX + ax * sp * n * rawDt, g.aimY + ay * sp * n * rawDt)
      } else g.moveHold = 0

      if (g.phase === 'menu') {
        if (want) startGame()
        return
      }
      if (g.phase === 'over') {
        g.overT += rawDt
        if (want && g.overT > 0.3) startGame()
        simulate(dt, rawDt)
        return
      }

      if (want && (g.phase === 'intro' || g.phase === 'fight')) fire(g.aimX, g.aimY)
      if (g.hintT > 0) g.hintT -= rawDt
      if (g.chainBanner) {
        g.chainBanner.t -= rawDt
        if (g.chainBanner.t <= 0) g.chainBanner = null
      }
      if (g.cityBanner > 0) g.cityBanner -= rawDt

      if (dt === 0) return
      simulate(dt, rawDt)

      if (g.phase === 'intro') {
        g.introT -= dt
        if (g.introT <= 0.9) spawnWaveStuff(dt)
        if (g.introT <= 0) {
          g.phase = 'fight'
          setUi('fight')
        }
      } else if (g.phase === 'fight') {
        spawnWaveStuff(dt)
        const quiet =
          g.toSpawn === 0 && g.planesLeft === 0 && !g.enemies.length && !g.planes.length && !g.pms.length && !g.booms.some((b) => b.kind !== 'g')
        if (quiet) {
          g.endT += dt
          if (g.endT > 0.6) {
            g.endT = 0
            startBonus()
          }
        } else g.endT = 0
      } else if (g.phase === 'bonus') {
        updateBonus(dt)
      } else if (g.phase === 'dying') {
        g.dyingT += rawDt
        if (g.phase === 'dying' && g.dyingT > 2.4) finish()
      }
    }

    // ---------- dibujo ----------
    const label = (text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') => {
      ctx.font = `${size}px ${pf}`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(5,5,15,0.9)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
    }

    const drawCity = (c: City) => {
      const x = Math.round(c.x)
      if (!c.alive) {
        ctx.fillStyle = '#1f2433'
        ctx.fillRect(x - 13, GY - 3, 26, 3)
        ctx.fillStyle = '#2b3245'
        ctx.fillRect(x - 11, GY - 6, 6, 3)
        ctx.fillRect(x - 2, GY - 8, 5, 5)
        ctx.fillRect(x + 6, GY - 5, 6, 2)
        ctx.fillStyle = '#161a27'
        ctx.fillRect(x - 7, GY - 9, 3, 4)
        ctx.fillRect(x + 8, GY - 8, 3, 3)
        const flick = Math.sin(g.t * 9 + c.x) > 0.2
        ctx.fillStyle = flick ? '#f97316' : '#b91c1c'
        ctx.fillRect(x - 4, GY - 4, 2, 2)
        ctx.fillRect(x + 4, GY - 4, 2, 2)
        return
      }
      const pop = c.born > 0 ? 1 + Math.sin(c.born * 20) * 0.04 : 1
      ctx.save()
      ctx.translate(x, GY)
      ctx.scale(1, pop)
      ctx.translate(-x, -GY)
      // resplandor bajo la ciudad
      const gl = ctx.createLinearGradient(0, GY - 30, 0, GY)
      gl.addColorStop(0, 'rgba(253,230,138,0)')
      gl.addColorStop(1, 'rgba(253,230,138,0.10)')
      ctx.fillStyle = gl
      ctx.fillRect(x - 16, GY - 30, 32, 30)
      for (const b of c.bld) {
        const bx = x + b.dx
        const top = GY - b.h
        ctx.fillStyle = '#3b4670'
        ctx.fillRect(bx, top, b.w, b.h)
        ctx.fillStyle = '#5b6aa6'
        ctx.fillRect(bx, top, b.w, 1)
        ctx.fillStyle = '#2a3356'
        ctx.fillRect(bx + b.w - 1, top + 1, 1, b.h - 1)
        if (b.seed % 3 === 0) {
          ctx.fillStyle = '#5b6aa6'
          ctx.fillRect(bx + Math.floor(b.w / 2), top - 3, 1, 3)
        }
        for (let wy = top + 3; wy < GY - 2; wy += 3) {
          for (let wx = bx + 1; wx < bx + b.w - 1; wx += 2) {
            const k = seeded(b.seed * 7 + wy * 0.37 + wx * 1.3)
            const flick = k > 0.93 && Math.sin(g.t * 3 + k * 40) > 0.6
            if (k > 0.35 && !flick) {
              ctx.fillStyle = '#fde68a'
              ctx.fillRect(wx, wy, 1, 2)
            }
          }
        }
      }
      ctx.restore()
    }

    const drawBatt = (b: Batt) => {
      const x = Math.round(b.x)
      if (!b.alive) {
        ctx.fillStyle = '#1b1f2e'
        ctx.beginPath()
        ctx.moveTo(x - 22, GY)
        ctx.lineTo(x - 14, GY - 7)
        ctx.lineTo(x - 4, GY - 4)
        ctx.lineTo(x + 6, GY - 8)
        ctx.lineTo(x + 16, GY - 5)
        ctx.lineTo(x + 22, GY)
        ctx.fill()
        ctx.fillStyle = Math.sin(g.t * 8 + b.x) > 0 ? '#f97316' : '#991b1b'
        ctx.fillRect(x - 3, GY - 3, 2, 2)
        return
      }
      // cañón apuntando a la retícula
      const ang = Math.atan2(g.aimY - (GY - 20), g.aimX - b.x)
      const a = clamp(ang, -Math.PI + 0.35, -0.35)
      ctx.save()
      ctx.translate(x, GY - 20)
      ctx.rotate(a)
      ctx.fillStyle = '#cbd5e1'
      ctx.fillRect(-b.recoil * 3, -2, 16, 4)
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(10 - b.recoil * 3, -3, 6, 6)
      ctx.restore()
      // montículo
      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.moveTo(x - 23, GY)
      ctx.lineTo(x - 15, GY - 22)
      ctx.lineTo(x + 15, GY - 22)
      ctx.lineTo(x + 23, GY)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#64748b'
      ctx.fillRect(x - 15, GY - 22, 30, 2)
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.moveTo(x - 23, GY)
      ctx.lineTo(x - 19, GY - 11)
      ctx.lineTo(x + 19, GY - 11)
      ctx.lineTo(x + 23, GY)
      ctx.closePath()
      ctx.fill()
      // pips de munición en pirámide 4-3-2-1
      let n = 0
      const low = b.ammo <= 3
      for (let row = 0; row < 4; row++) {
        const cnt = 4 - row
        for (let k = 0; k < cnt; k++) {
          n++
          const on = n <= b.ammo
          ctx.fillStyle = on ? (low ? '#f87171' : '#fecdd3') : '#0f172a'
          ctx.fillRect(Math.round(x - (cnt * 5 - 2) / 2 + k * 5), GY - 20 + row * 4.5, 3, 3)
        }
      }
    }

    const drawBloom = (b: Boom) => {
      if (b.r < 1) return
      const r = b.r + Math.sin(g.t * 40 + b.x) * 1.2
      let c1 = 'rgba(254,205,211,0.95)'
      let c2 = 'rgba(251,113,133,0.55)'
      let c3 = 'rgba(251,113,133,0)'
      if (b.kind === 'g') {
        c1 = 'rgba(254,215,170,0.9)'
        c2 = 'rgba(239,68,68,0.5)'
        c3 = 'rgba(239,68,68,0)'
      } else if (b.chain >= 3) {
        c1 = 'rgba(245,208,254,0.95)'
        c2 = 'rgba(217,70,239,0.55)'
        c3 = 'rgba(217,70,239,0)'
      } else if (b.chain >= 1) {
        c1 = 'rgba(253,230,138,0.95)'
        c2 = 'rgba(245,158,11,0.55)'
        c3 = 'rgba(245,158,11,0)'
      }
      const outer = r * 1.45
      const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, outer)
      gr.addColorStop(0, 'rgba(255,255,255,1)')
      gr.addColorStop(0.3, c1)
      gr.addColorStop(0.62, c2)
      gr.addColorStop(1, c3)
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.arc(b.x, b.y, outer, 0, Math.PI * 2)
      ctx.fill()
      // borde del radio real (lo que mata)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    const drawPlane = (p: Plane) => {
      ctx.save()
      ctx.translate(Math.round(p.x), Math.round(p.y))
      ctx.scale(p.dir, 1)
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(-12, -3, 22, 6)
      ctx.beginPath()
      ctx.moveTo(10, -3)
      ctx.lineTo(16, 1)
      ctx.lineTo(10, 3)
      ctx.fill()
      ctx.fillStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.moveTo(-4, -3)
      ctx.lineTo(2, -3)
      ctx.lineTo(-3, -11)
      ctx.lineTo(-7, -11)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-4, 3)
      ctx.lineTo(2, 3)
      ctx.lineTo(-3, 10)
      ctx.lineTo(-7, 10)
      ctx.fill()
      ctx.fillStyle = '#64748b'
      ctx.fillRect(-14, -7, 4, 5)
      ctx.fillStyle = '#7dd3fc'
      ctx.fillRect(5, -2, 4, 2)
      if (Math.sin(g.t * 10) > 0) {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(-13, -8, 2, 2)
      }
      ctx.restore()
    }

    const drawEnemy = (e: Enemy) => {
      const col = trailColor(e.kind)
      ctx.lineWidth = 1.4
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      if (e.kind === 'smart') {
        ctx.moveTo(e.path[0], e.path[1])
        for (let i = 2; i < e.path.length; i += 2) ctx.lineTo(e.path[i], e.path[i + 1])
        ctx.lineTo(e.x, e.y)
      } else {
        ctx.moveTo(e.sx, e.sy)
        ctx.lineTo(e.x, e.y)
      }
      ctx.stroke()
      // tramo reciente más brillante
      const sp = Math.hypot(e.vx, e.vy) || 1
      ctx.globalAlpha = 0.95
      ctx.lineWidth = 2
      ctx.strokeStyle = '#fecaca'
      ctx.beginPath()
      ctx.moveTo(e.x - (e.vx / sp) * 14, e.y - (e.vy / sp) * 14)
      ctx.lineTo(e.x, e.y)
      ctx.stroke()
      ctx.globalAlpha = 1
      if (e.kind === 'smart') {
        ctx.save()
        ctx.translate(e.x, e.y)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = '#ddd6fe'
        ctx.fillRect(-3, -3, 6, 6)
        ctx.restore()
        ctx.strokeStyle = 'rgba(167,139,250,0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(e.x, e.y, 6 + Math.sin(g.t * 12) * 1, 0, Math.PI * 2)
        ctx.stroke()
      } else if (e.kind === 'mirv') {
        ctx.fillStyle = '#fed7aa'
        ctx.fillRect(Math.round(e.x) - 2.5, Math.round(e.y) - 2.5, 5, 5)
        ctx.fillStyle = '#fb923c'
        ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 2, 2)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(e.x) - 1.5, Math.round(e.y) - 1.5, 3, 3)
      }
    }

    const draw = () => {
      const pal = PALS[Math.max(0, g.wave - 1) % PALS.length]
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      const sky = ctx.createLinearGradient(0, 0, 0, GY)
      sky.addColorStop(0, pal.top)
      sky.addColorStop(1, pal.bot)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = pal.star
      for (const s of stars) {
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(g.t * 1.3 + s.p))
        ctx.fillRect(s.x, s.y, s.s, s.s)
      }
      ctx.globalAlpha = 1

      juice.applyShake(ctx)

      // montañas y suelo
      ctx.fillStyle = pal.mtn
      ctx.beginPath()
      ctx.moveTo(-10, GY)
      mtn.forEach((y, i) => ctx.lineTo(i * 20 - 10, y))
      ctx.lineTo(W + 10, GY)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = pal.gnd
      ctx.fillRect(-10, GY, W + 20, H - GY + 10)
      ctx.fillStyle = pal.gndTop
      ctx.fillRect(-10, GY, W + 20, 2)

      for (const c of g.cities) drawCity(c)
      for (const b of g.batts) drawBatt(b)

      // estelas desvanecidas
      for (const f of g.fades) {
        ctx.globalAlpha = Math.max(0, f.life / 0.7) * 0.5
        ctx.strokeStyle = f.color
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.moveTo(f.pts[0], f.pts[1])
        for (let i = 2; i < f.pts.length; i += 2) ctx.lineTo(f.pts[i], f.pts[i + 1])
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      for (const e of g.enemies) drawEnemy(e)
      for (const p of g.planes) drawPlane(p)

      // antimisiles y marcas de objetivo
      for (const m of g.pms) {
        ctx.strokeStyle = 'rgba(254,205,211,0.55)'
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.moveTo(m.sx, m.sy)
        ctx.lineTo(m.x, m.y)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(251,113,133,0.9)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(m.tx - 3, m.ty - 3)
        ctx.lineTo(m.tx + 3, m.ty + 3)
        ctx.moveTo(m.tx + 3, m.ty - 3)
        ctx.lineTo(m.tx - 3, m.ty + 3)
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(m.x) - 1.5, Math.round(m.y) - 1.5, 3, 3)
      }

      // explosiones con bloom
      ctx.globalCompositeOperation = 'lighter'
      for (const b of g.booms) drawBloom(b)
      ctx.globalCompositeOperation = 'source-over'

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      // retícula
      if (g.showAim && (g.phase === 'intro' || g.phase === 'fight')) {
        const ax = g.aimX
        const ay = g.aimY
        ctx.strokeStyle = 'rgba(5,5,15,0.7)'
        ctx.lineWidth = 3
        for (let pass = 0; pass < 2; pass++) {
          if (pass) {
            ctx.strokeStyle = '#fecdd3'
            ctx.lineWidth = 1.3
          }
          ctx.beginPath()
          ctx.arc(ax, ay, 8, 0, Math.PI * 2)
          ctx.moveTo(ax - 14, ay)
          ctx.lineTo(ax - 4, ay)
          ctx.moveTo(ax + 4, ay)
          ctx.lineTo(ax + 14, ay)
          ctx.moveTo(ax, ay - 14)
          ctx.lineTo(ax, ay - 4)
          ctx.moveTo(ax, ay + 4)
          ctx.lineTo(ax, ay + 14)
          ctx.stroke()
        }
        ctx.fillStyle = ACCENT
        ctx.fillRect(ax - 1, ay - 1, 2, 2)
      }

      // avisos en pantalla
      if (g.chainBanner) {
        const cb = g.chainBanner
        const s = 1 + Math.max(0, cb.t - 1.2) * 1.2
        ctx.save()
        ctx.globalAlpha = clamp(cb.t * 2, 0, 1)
        ctx.translate(W / 2, 70)
        ctx.scale(s, s)
        label(`CADENA x${cb.n}`, 0, 0, 15, cb.n >= 5 ? '#f0abfc' : '#fde68a')
        ctx.restore()
        ctx.globalAlpha = 1
      }

      if (g.phase === 'intro') {
        const k = g.introT
        const a = Math.min(1, k * 2.5, (2.4 - k) * 4)
        const pop = 1 + Math.max(0, (2.4 - k) < 0.3 ? 0.3 - (2.4 - k) : 0) * 1.2
        ctx.save()
        ctx.globalAlpha = clamp(a, 0, 1)
        ctx.translate(W / 2, 200)
        ctx.scale(pop, pop)
        label(`OLEADA ${g.wave}`, 0, 0, 24, '#ffffff')
        ctx.restore()
        ctx.globalAlpha = clamp(a, 0, 1)
        const sub =
          g.wave === 1
            ? 'DEFIENDE LAS CIUDADES'
            : g.wave === 2
              ? 'MISILES DIVIDIDOS'
              : g.wave === 3
                ? 'BOMBARDEROS'
                : g.wave === 5
                  ? 'MISILES INTELIGENTES'
                  : g.wave === 8
                    ? 'LLUVIA DE ACERO'
                    : ''
        if (sub) label(sub, W / 2, 232, 10, ACCENT)
        label(`PUNTOS x${mulFor(g.wave)}`, W / 2, sub ? 254 : 232, 8, '#fde68a')
        ctx.globalAlpha = 1
      }

      if (g.hintT > 0 && g.wave === 1 && (g.phase === 'intro' || g.phase === 'fight')) {
        ctx.globalAlpha = clamp(g.hintT, 0, 1) * 0.9
        label(coarse ? 'TOCA PARA DISPARAR' : 'CLIC O ESPACIO PARA DISPARAR', W / 2, 330, 8, '#e2e8f0')
        if (!coarse) label('FLECHAS / RATON PARA APUNTAR', W / 2, 346, 7, '#94a3b8')
        ctx.globalAlpha = 1
      }

      if (g.cityBanner > 0) {
        ctx.globalAlpha = clamp(g.cityBanner, 0, 1)
        label('CIUDAD EXTRA', W / 2, 110, 12, '#86efac')
        ctx.globalAlpha = 1
      }

      if (g.phase === 'bonus' && g.bonus && g.bonus.stage >= 1) {
        const bn = g.bonus
        ctx.fillStyle = 'rgba(6,6,18,0.78)'
        ctx.fillRect(34, 150, W - 68, 168)
        ctx.strokeStyle = ACCENT
        ctx.lineWidth = 2
        ctx.strokeRect(34, 150, W - 68, 168)
        label(`OLEADA ${bn.wave} SUPERADA`, W / 2, 174, 11, '#ffffff')
        label(`PUNTOS x${bn.mult}`, W / 2, 196, 8, '#fde68a')
        label('MUNICION', 52, 232, 9, '#fecdd3', 'left')
        label(`x${bn.ammoCnt}`, 168, 232, 9, '#ffffff', 'left')
        label(`+${bn.ammoPts}`, W - 52, 232, 9, '#fde68a', 'right')
        if (bn.stage >= 2) {
          label('CIUDADES', 52, 262, 9, '#fecdd3', 'left')
          label(`x${bn.cityCnt}`, 168, 262, 9, '#ffffff', 'left')
          label(`+${bn.cityPts}`, W - 52, 262, 9, '#fde68a', 'right')
        }
        if (bn.stage >= 4) label(`TOTAL +${bn.ammoPts + bn.cityPts}`, W / 2, 298, 10, '#86efac')
      }

      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.phase === 'dying' || g.phase === 'over') {
        ctx.fillStyle = `rgba(20,0,0,${g.phase === 'over' ? 0.3 : Math.min(0.3, g.dyingT * 0.2)})`
        ctx.fillRect(0, 0, W, H)
      }

      if (g.paused) {
        ctx.fillStyle = 'rgba(6,6,16,0.68)'
        ctx.fillRect(0, 0, W, H)
        label('PAUSA', W / 2, H / 2 - 12, 24, ACCENT)
        label(coarse ? 'Toca para seguir' : 'Toca o pulsa P para seguir', W / 2, H / 2 + 24, 9, 'rgba(255,255,255,0.8)')
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      update(dt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#fb7185]/40 bg-[#070b24] shadow-[0_0_30px_rgba(251,113,133,0.2)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PTS {score.toLocaleString('es-MX')}</span>
            <span className="text-white/80">OLEADA {wave}</span>
            <span className="text-white/60">RECORD {Math.max(best, score).toLocaleString('es-MX')}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ aspectRatio: `${W} / ${H}`, cursor: 'crosshair' }}
          aria-label="Juego Defensa Final"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="DEFENSA FINAL"
            accent={ACCENT}
            subtitle="Toca para lanzar antimisiles y detener la lluvia de misiles. Haz estallar los enemigos dentro de tus explosiones para crear reacciones en cadena."
            hint="Pulsa ESPACIO para empezar"
            touchHint="Toca Jugar para empezar"
            onStart={() => startRef.current()}
          />
        )}
        {ui === 'over' && (
          <GameOverOverlay
            title="CIUDADES PERDIDAS"
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Oleada', value: result.wave },
              { label: 'Destruidos', value: result.kills },
              { label: 'Mejor cadena', value: `x${result.bestChain}` },
            ]}
            onRestart={() => startRef.current()}
            touchHint="o toca Jugar otra vez"
          />
        )}
      </GameScreen>
    </div>
  )
}
