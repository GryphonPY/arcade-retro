'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, renderScale } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { Hud, StartOverlay, GameOverOverlay, type OverlayStat } from './overlay'
import { Juice } from './juice'
import { sfx, tone, noise } from './sfx'

const ID = 'asteroid-drift'
const ACCENT = '#38bdf8'
const W0 = 420
const H0 = 520
// Espacio lógico: se ajusta a la pantalla al abrir el juego (ver layout). Da la vuelta en los bordes.
let W = W0
let H = H0

/** Ajusta el espacio de juego al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

// ---------- Tipos ----------
type PType = 'shield' | 'triple' | 'rapid'
type Mode = 'title' | 'play' | 'dying' | 'over'

interface Pt {
  x: number
  y: number
}
interface Rock {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  tier: 1 | 2 | 3
  a: number
  va: number
  pts: Pt[]
  craters: { x: number; y: number; r: number }[]
  color: string
  cargo: boolean
  flash: number
  nm: boolean
}
interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}
interface Ufo {
  x: number
  y: number
  vx: number
  vy: number
  small: boolean
  r: number
  fireT: number
  turnT: number
  t: number
  sndT: number
}
interface PowerUp {
  x: number
  y: number
  vx: number
  vy: number
  type: PType
  life: number
  t: number
}
interface Shard {
  x: number
  y: number
  vx: number
  vy: number
  a: number
  va: number
  len: number
  life: number
  maxLife: number
  color: string
}
interface Star {
  x: number
  y: number
  s: number
  layer: number
}
interface Banner {
  title: string
  sub: string
  t: number
  dur: number
  color: string
}

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
    a: number
    av: number
    alive: boolean
    invuln: number
    respawn: number
    respawnWait: number
    shield: number
    triple: number
    rapid: number
    cool: number
    thrusting: boolean
    thrustSnd: number
    hyperOut: number
    hyperCool: number
    hyperRecent: number
    hyperRecentT: number
  }
  rocks: Rock[]
  bullets: Bullet[]
  ebullets: Bullet[]
  ufo: Ufo | null
  ufoT: number
  pups: PowerUp[]
  shards: Shard[]
  score: number
  lives: number
  wave: number
  waveT: number
  clearT: number
  banner: Banner | null
  combo: number
  comboT: number
  bestCombo: number
  mult: number
  multPop: number
  rocksDestroyed: number
  ufosKilled: number
  nextLife: number
  nmCool: number
  newBest: boolean
  cause: string
}

const ROCK_COLORS = ['#cfe3ff', '#bfdbfe', '#c7d2fe', '#d9e4f5', '#bae6fd']
const PUP_INFO: Record<PType, { label: string; color: string; name: string }> = {
  shield: { label: 'E', color: '#8aa8ff', name: 'ESCUDO' },
  triple: { label: '3', color: '#ff9f43', name: 'DISPARO TRIPLE' },
  rapid: { label: 'R', color: '#ffe23d', name: 'DISPARO RAPIDO' },
}
const TIER_R = { 1: 11, 2: 20, 3: 34 } as const
const TIER_PTS = { 1: 100, 2: 50, 3: 20 } as const

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const wrapPos = (v: number, size: number) => ((v % size) + size) % size
const wd = (a: number, b: number, size: number) => {
  let d = a - b
  if (d > size / 2) d -= size
  else if (d < -size / 2) d += size
  return d
}

function makeStars(): Star[] {
  const st: Star[] = []
  for (let i = 0; i < 90; i++) st.push({ x: Math.random() * W, y: Math.random() * H, s: 0.8 + Math.random() * 1.4, layer: i % 3 })
  return st
}

function makeRockShape(r: number): { pts: Pt[]; craters: Rock['craters'] } {
  const n = r > 30 ? 13 : r > 15 ? 11 : 9
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const v = 0.72 + Math.random() * 0.42
    pts.push({ x: Math.cos(a) * r * v, y: Math.sin(a) * r * v })
  }
  const craters: Rock['craters'] = []
  const cn = r > 30 ? 3 : r > 15 ? 2 : 0
  for (let i = 0; i < cn; i++) {
    const a = Math.random() * Math.PI * 2
    const d = Math.random() * r * 0.45
    craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: r * (0.1 + Math.random() * 0.1) })
  }
  return { pts, craters }
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
      x: W / 2, y: H / 2, vx: 0, vy: 0, a: 0, av: 0, alive: true, invuln: 0, respawn: 0, respawnWait: 0,
      shield: 0, triple: 0, rapid: 0, cool: 0, thrusting: false, thrustSnd: 0,
      hyperOut: 0, hyperCool: 0, hyperRecent: 0, hyperRecentT: 0,
    },
    rocks: [],
    bullets: [],
    ebullets: [],
    ufo: null,
    ufoT: 16,
    pups: [],
    shards: [],
    score: 0,
    lives: 3,
    wave: 1,
    waveT: 0,
    clearT: -1,
    banner: null,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    mult: 1,
    multPop: 0,
    rocksDestroyed: 0,
    ufosKilled: 0,
    nextLife: 10000,
    nmCool: 0,
    newBest: false,
    cause: '',
  }
}

export default function AsteroidDrift() {
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
    bestCombo: 0,
    rocks: 0,
    ufos: 0,
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
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const fam = getComputedStyle(canvas).getPropertyValue('--font-pixel').trim()
    const FONT = fam ? `${fam}, monospace` : '"Press Start 2P", monospace'
    const g = stateRef.current
    const juice = new Juice(9)
    const coarse = window.matchMedia('(pointer: coarse)').matches

    const bg = document.createElement('canvas')
    bg.width = W
    bg.height = H
    const bgc = bg.getContext('2d')
    if (bgc) {
      bgc.fillStyle = '#040611'
      bgc.fillRect(0, 0, W, H)
      const blob = (x: number, y: number, r: number, col: string) => {
        const gr = bgc.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, col)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        bgc.fillStyle = gr
        bgc.fillRect(0, 0, W, H)
      }
      blob(110, 120, 230, 'rgba(56,120,220,0.16)')
      blob(330, 400, 250, 'rgba(120,60,200,0.12)')
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let uiKey = ''

    const syncUi = () => {
      const mode = g.mode === 'title' ? 'title' : g.mode === 'over' ? 'over' : 'play'
      const key = `${mode}|${g.score}|${g.wave}|${g.lives}|${g.newBest}|${g.bestCombo}|${g.rocksDestroyed}|${g.ufosKilled}`
      if (key === uiKey) return
      uiKey = key
      setUi({ mode, score: g.score, wave: g.wave, lives: g.lives, newBest: g.newBest, bestCombo: g.bestCombo, rocks: g.rocksDestroyed, ufos: g.ufosKilled })
    }

    const text = (x: number, y: number, t: string, color = '#fff', size = 9, life = 0.9) => juice.text(x, y, t, color, size, life)

    // ---------- helpers ----------
    const addScore = (pts: number, x: number, y: number, color = '#ffffff', useMult = true) => {
      const v = Math.round(pts * (useMult ? g.mult : 1))
      g.score += v
      text(x, y, `+${v}`, color, v >= 200 ? 11 : 9)
      if (g.score >= g.nextLife) {
        g.nextLife += 15000
        if (g.lives < 6) {
          g.lives++
          text(g.ship.x, g.ship.y - 34, '+1 VIDA', '#7cff6b', 10, 1.4)
          sfx.levelUp()
        }
      }
    }

    const bumpCombo = () => {
      g.combo++
      g.comboT = 2.3
      g.bestCombo = Math.max(g.bestCombo, g.combo)
      const m = Math.min(5, 1 + Math.floor(g.combo / 4))
      if (m > g.mult) {
        g.mult = m
        g.multPop = 1
        text(g.ship.x, g.ship.y - 38, `COMBO x${m}`, '#ffe23d', 9, 1.1)
        tone({ freq: 480 + m * 90, to: 880 + m * 110, dur: 0.14, vol: 0.04, type: 'triangle' })
      }
    }
    const endCombo = () => {
      if (g.combo >= 6) text(g.ship.x, g.ship.y - 34, 'COMBO PERDIDO', '#ff8a8a', 8, 1)
      g.combo = 0
      g.mult = 1
    }

    const shards = (x: number, y: number, n: number, color: string, speed: number, len: number) => {
      for (let i = 0; i < n; i++) {
        const an = Math.random() * Math.PI * 2
        const sp = speed * (0.4 + Math.random() * 0.8)
        const life = 0.6 + Math.random() * 0.6
        g.shards.push({
          x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, a: Math.random() * 6.28,
          va: (Math.random() - 0.5) * 10, len: len * (0.6 + Math.random() * 0.8), life, maxLife: life, color,
        })
      }
    }

    const newRock = (x: number, y: number, tier: 1 | 2 | 3, vx: number, vy: number, cargo = false): Rock => {
      const r = TIER_R[tier] * (0.92 + Math.random() * 0.16)
      const sh = makeRockShape(r)
      return {
        x, y, vx, vy, r, tier, a: Math.random() * 6.28, va: (Math.random() - 0.5) * (tier === 1 ? 4 : tier === 2 ? 2.4 : 1.2),
        pts: sh.pts, craters: sh.craters, color: cargo ? '#5eead4' : ROCK_COLORS[(Math.random() * ROCK_COLORS.length) | 0],
        cargo, flash: 0, nm: false,
      }
    }
    const rockSpeed = (tier: number) => {
      const base = 24 + Math.min(g.wave, 12) * 3.5
      const k = tier === 3 ? 1 : tier === 2 ? 1.45 : 1.9
      return base * k * (0.6 + Math.random() * 0.8)
    }

    const spawnWave = (n: number) => {
      g.wave = n
      g.waveT = 0
      g.clearT = -1
      g.rocks = []
      g.ebullets = []
      g.ufo = null
      g.ufoT = Math.max(8, 18 - n * 0.7) + Math.random() * 6
      const count = Math.min(3 + n, 9)
      let cargoLeft = n >= 2 ? 1 : 0
      for (let i = 0; i < count; i++) {
        let x = 0
        let y = 0
        for (let tries = 0; tries < 12; tries++) {
          x = Math.random() * W
          y = Math.random() * H
          if (Math.hypot(wd(x, g.ship.x, W), wd(y, g.ship.y, H)) > 150) break
        }
        const an = Math.random() * Math.PI * 2
        const sp = rockSpeed(3)
        const cargo = cargoLeft > 0 && Math.random() < 0.5
        if (cargo) cargoLeft--
        g.rocks.push(newRock(x, y, 3, Math.cos(an) * sp, Math.sin(an) * sp, cargo))
      }
      const subs = ['A LA DERIVA', 'CUIDADO CON LOS OVNIS', 'CAMPO DENSO', 'NO TE QUEDES QUIETO']
      g.banner = { title: `OLEADA ${n}`, sub: n === 1 ? 'DESTRUYE TODO' : subs[n % subs.length], t: 0, dur: 2.1, color: ACCENT }
      if (n > 1) sfx.levelUp()
    }

    const spawnPowerUp = (x: number, y: number, type?: PType) => {
      const types: PType[] = ['shield', 'triple', 'rapid']
      const an = Math.random() * Math.PI * 2
      g.pups.push({ x, y, vx: Math.cos(an) * 22, vy: Math.sin(an) * 22, type: type ?? types[(Math.random() * 3) | 0], life: 12, t: 0 })
    }

    const boom = (tier: number, big = false) => {
      if (big || tier === 3) {
        noise({ dur: 0.4, vol: 0.1, freq: 700 })
        tone({ freq: 120, to: 40, dur: 0.32, vol: 0.06, type: 'triangle' })
      } else if (tier === 2) {
        noise({ dur: 0.25, vol: 0.08, freq: 1100 })
        tone({ freq: 170, to: 70, dur: 0.18, vol: 0.04, type: 'triangle' })
      } else {
        noise({ dur: 0.14, vol: 0.06, freq: 1900 })
      }
    }

    // destruye un asteroide (con división)
    const breakRock = (rock: Rock, dirx: number, diry: number, byShip = false) => {
      const i = g.rocks.indexOf(rock)
      if (i >= 0) g.rocks.splice(i, 1)
      g.rocksDestroyed++
      bumpCombo()
      addScore(TIER_PTS[rock.tier], rock.x, rock.y - rock.r * 0.4, '#ffffff')
      const t = rock.tier
      juice.burst(rock.x, rock.y, [rock.color, '#ffffff', '#7dd3fc'], { count: t === 3 ? 24 : t === 2 ? 15 : 9, speed: t === 3 ? 170 : 130, life: 0.6, size: t === 3 ? 3.6 : 2.8, drag: 2.2 })
      shards(rock.x, rock.y, t === 3 ? 6 : t === 2 ? 4 : 2, rock.color, 110, t === 3 ? 10 : 6)
      juice.shake(t === 3 ? 0.32 : t === 2 ? 0.18 : 0.09)
      juice.freeze(t === 3 ? 45 : t === 2 ? 25 : 8)
      boom(t)
      if (rock.cargo) {
        spawnPowerUp(rock.x, rock.y)
        juice.flash('#5eead4', 0.15)
      }
      if (t > 1) {
        const nt = (t - 1) as 1 | 2
        const nChildren = t === 3 && g.wave >= 5 && Math.random() < 0.35 ? 3 : 2
        const base = Math.atan2(diry, dirx)
        for (let k = 0; k < nChildren; k++) {
          const spread = nChildren === 2 ? (k === 0 ? -1 : 1) * (0.7 + Math.random() * 0.5) : (k - 1) * 1.1
          const an = (byShip ? Math.random() * 6.28 : base) + spread + Math.PI * 0.0
          const sp = rockSpeed(nt) + 20
          const ch = newRock(rock.x + Math.cos(an) * 6, rock.y + Math.sin(an) * 6, nt, rock.vx * 0.5 + Math.cos(an) * sp, rock.vy * 0.5 + Math.sin(an) * sp)
          g.rocks.push(ch)
        }
      }
    }

    const killUfo = (u: Ufo) => {
      g.ufo = null
      g.ufosKilled++
      bumpCombo()
      bumpCombo()
      addScore(u.small ? 1000 : 200, u.x, u.y - 14, '#ff9fb2')
      juice.burst(u.x, u.y, ['#ff6b6b', '#ffe23d', '#ffffff'], { count: 30, speed: 200, life: 0.7, size: 3.6 })
      shards(u.x, u.y, 8, '#ff6b6b', 150, 9)
      juice.shake(0.4)
      juice.freeze(70)
      juice.flash('#ff6b6b', 0.16)
      boom(3, true)
      sfx.golden()
      spawnPowerUp(u.x, u.y)
    }

    const killShip = (cause: string) => {
      const s = g.ship
      if (!s.alive) return
      s.alive = false
      s.thrusting = false
      g.lives--
      endCombo()
      s.triple = 0
      s.rapid = 0
      s.shield = 0
      juice.burst(s.x, s.y, ['#ffffff', '#38bdf8', '#ffe23d', '#ff8a3d'], { count: 30, speed: 230, life: 0.8, size: 4 })
      shards(s.x, s.y, 9, '#e0f2fe', 120, 12)
      juice.shake(0.85)
      juice.freeze(120)
      juice.flash('#ff4040', 0.4)
      sfx.crash()
      if (g.lives <= 0) {
        g.lives = 0
        g.cause = cause
        g.mode = 'dying'
        g.dyingT = 0
      } else {
        s.respawn = 1.5
        s.respawnWait = 0
      }
    }

    const restoreShip = () => {
      const s = g.ship
      s.alive = true
      s.x = W / 2
      s.y = H / 2
      s.vx = 0
      s.vy = 0
      s.a = 0
      s.av = 0
      s.invuln = 3
      s.hyperOut = 0
      juice.burst(s.x, s.y, [ACCENT, '#ffffff'], { count: 18, speed: 120, life: 0.5, size: 3 })
    }

    const startGame = () => {
      const stars = g.stars
      Object.assign(g, initial())
      g.stars = stars
      g.mode = 'play'
      juice.reset()
      g.ship.invuln = 2
      spawnWave(1)
      sfx.start()
      uiKey = ''
    }

    const setupTitle = () => {
      for (let i = 0; i < 6; i++) {
        const an = Math.random() * Math.PI * 2
        const tier = (i < 3 ? 3 : i < 5 ? 2 : 1) as 1 | 2 | 3
        g.rocks.push(newRock(Math.random() * W, Math.random() * H, tier, Math.cos(an) * 28, Math.sin(an) * 28))
      }
      g.ship.y = H * 0.72
    }
    setupTitle()

    const doHyper = () => {
      const s = g.ship
      if (!s.alive || s.hyperOut > 0 || s.hyperCool > 0 || g.mode !== 'play') return
      s.hyperRecent += 1
      s.hyperRecentT = 7
      s.hyperCool = 3.2
      s.hyperOut = 0.35
      juice.burst(s.x, s.y, [ACCENT, '#ffffff'], { count: 20, speed: 180, life: 0.4, size: 3 })
      sfx.warp()
    }
    const hyperRisk = () => Math.min(0.55, 0.07 + 0.1 * g.ship.hyperRecent)

    const fire = () => {
      const s = g.ship
      const hx = Math.sin(s.a)
      const hy = -Math.cos(s.a)
      const mk = (off: number) => {
        const an = s.a + off + (s.rapid > 0 ? (Math.random() - 0.5) * 0.05 : 0)
        const dx = Math.sin(an)
        const dy = -Math.cos(an)
        g.bullets.push({ x: s.x + hx * 13, y: s.y + hy * 13, vx: dx * 500 + s.vx * 0.4, vy: dy * 500 + s.vy * 0.4, life: 1.0 })
      }
      if (s.triple > 0) {
        mk(0)
        mk(-0.2)
        mk(0.2)
      } else mk(0)
      s.cool = s.rapid > 0 ? 0.085 : 0.2
      tone({ freq: 1500, to: 380, dur: 0.07, vol: 0.022, type: 'sawtooth' })
      juice.burst(s.x + hx * 14, s.y + hy * 14, '#e0f2fe', { count: 2, speed: 50, life: 0.12, size: 2.4 })
    }

    const spawnUfo = () => {
      const small = g.wave >= 2 && Math.random() < Math.min(0.7, 0.15 + g.wave * 0.08)
      const fromLeft = Math.random() < 0.5
      const r = small ? 10 : 16
      g.ufo = {
        x: fromLeft ? -r : W + r, y: 60 + Math.random() * (H - 120), vx: (fromLeft ? 1 : -1) * (small ? 95 : 65),
        vy: 0, small, r, fireT: 1.2, turnT: 1, t: 0, sndT: 0,
      }
    }

    // ---------- actualización ----------
    const moveRocks = (dt: number) => {
      for (const r of g.rocks) {
        r.x = wrapPos(r.x + r.vx * dt, W)
        r.y = wrapPos(r.y + r.vy * dt, H)
        r.a += r.va * dt
        if (r.flash > 0) r.flash -= dt
      }
    }

    const updatePlay = (dt: number) => {
      const s = g.ship
      const pressed = pressedRef.current
      const jp = justPressedRef.current
      g.waveT += dt
      if (g.banner) {
        g.banner.t += dt
        if (g.banner.t > g.banner.dur) g.banner = null
      }
      if (g.multPop > 0) g.multPop = Math.max(0, g.multPop - dt * 3)
      if (g.nmCool > 0) g.nmCool -= dt
      if (g.comboT > 0) {
        g.comboT -= dt
        if (g.comboT <= 0) endCombo()
      }

      // ----- nave -----
      if (s.alive) {
        if (s.invuln > 0) s.invuln -= dt
        if (s.shield > 0) s.shield -= dt
        if (s.triple > 0) s.triple -= dt
        if (s.rapid > 0) s.rapid -= dt
        if (s.hyperCool > 0) s.hyperCool -= dt
        if (s.hyperRecentT > 0) {
          s.hyperRecentT -= dt
          if (s.hyperRecentT <= 0) {
            s.hyperRecent = Math.max(0, s.hyperRecent - 1)
            s.hyperRecentT = s.hyperRecent > 0 ? 5 : 0
          }
        }
        if (s.hyperOut > 0) {
          s.hyperOut -= dt
          if (s.hyperOut <= 0) {
            // reaparece en un punto aleatorio (mejor de dos tiradas)
            let bx = 0
            let by = 0
            let bd = -1
            for (let t = 0; t < 2; t++) {
              const x = 30 + Math.random() * (W - 60)
              const y = 30 + Math.random() * (H - 60)
              let md = 9999
              for (const r of g.rocks) md = Math.min(md, Math.hypot(wd(x, r.x, W), wd(y, r.y, H)) - r.r)
              if (md > bd) {
                bd = md
                bx = x
                by = y
              }
            }
            s.x = bx
            s.y = by
            s.vx *= 0.3
            s.vy *= 0.3
            juice.burst(bx, by, [ACCENT, '#ffffff'], { count: 20, speed: 160, life: 0.45, size: 3 })
            sfx.warp()
            if (Math.random() < hyperRisk()) {
              text(bx, by - 20, 'FALLO DE SALTO', '#ff6b6b', 8, 1.2)
              killShip('Hiperespacio')
              return
            }
            s.invuln = Math.max(s.invuln, 0.4)
            text(bx, by - 20, 'HIPERESPACIO', ACCENT, 8, 0.9)
          }
        }
        if (s.hyperOut <= 0) {
          // giro suave
          const dir = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0)
          s.av += (dir * 4.6 - s.av) * Math.min(1, 13 * dt)
          s.a += s.av * dt
          // empuje
          s.thrusting = pressed.has('up')
          const hx = Math.sin(s.a)
          const hy = -Math.cos(s.a)
          if (s.thrusting) {
            s.vx += hx * 270 * dt
            s.vy += hy * 270 * dt
            s.thrustSnd -= dt
            if (s.thrustSnd <= 0) {
              s.thrustSnd = 0.1
              noise({ dur: 0.1, vol: 0.02, freq: 380 })
            }
            juice.burst(s.x - hx * 9 + (Math.random() - 0.5) * 3, s.y - hy * 9, ['#ffb347', '#ff6a3d', '#ffe23d'], {
              count: 1, speed: 130, angle: Math.atan2(-hy, -hx), arc: 0.45, life: 0.3, size: 2.8, drag: 3,
            })
          }
          // fricción ligera + velocidad máxima
          const fr = Math.max(0, 1 - 0.3 * dt)
          s.vx *= fr
          s.vy *= fr
          const sp = Math.hypot(s.vx, s.vy)
          if (sp > 310) {
            s.vx *= 310 / sp
            s.vy *= 310 / sp
          }
          s.x = wrapPos(s.x + s.vx * dt, W)
          s.y = wrapPos(s.y + s.vy * dt, H)
          // disparo (autofire)
          s.cool -= dt
          if (pressed.has('action') && s.cool <= 0) fire()
          // hiperespacio
          if (jp.has('action2') || (!coarse && jp.has('down'))) doHyper()
        }
      } else if (g.mode === 'play') {
        s.respawn -= dt
        if (s.respawn <= 0) {
          s.respawnWait += dt
          let clear = true
          for (const r of g.rocks) if (Math.hypot(wd(r.x, W / 2, W), wd(r.y, H / 2, H)) < r.r + 70) clear = false
          if (g.ufo) clear = false
          if (clear || s.respawnWait > 2.5) restoreShip()
        }
      }

      // ----- balas -----
      for (const b of g.bullets) {
        b.x = wrapPos(b.x + b.vx * dt, W)
        b.y = wrapPos(b.y + b.vy * dt, H)
        b.life -= dt
      }
      for (const b of g.ebullets) {
        b.x = wrapPos(b.x + b.vx * dt, W)
        b.y = wrapPos(b.y + b.vy * dt, H)
        b.life -= dt
      }

      moveRocks(dt)

      // ----- OVNI -----
      g.ufoT -= dt
      if (g.ufoT <= 0 && !g.ufo && g.waveT > 4 && g.rocks.length > 0 && g.clearT < 0) {
        spawnUfo()
        g.ufoT = Math.max(7, 20 - g.wave * 0.9) + Math.random() * 8
      }
      const u = g.ufo
      if (u) {
        u.t += dt
        u.x += u.vx * dt
        u.y += u.vy * dt
        u.turnT -= dt
        if (u.turnT <= 0) {
          u.turnT = 0.8 + Math.random() * 1.2
          u.vy = [-55, 0, 55][(Math.random() * 3) | 0]
        }
        if (u.y < 30) u.vy = Math.abs(u.vy)
        if (u.y > H - 30) u.vy = -Math.abs(u.vy)
        u.sndT -= dt
        if (u.sndT <= 0) {
          u.sndT = u.small ? 0.22 : 0.36
          tone({ freq: u.small ? 1000 : 700, to: u.small ? 1250 : 900, dur: 0.1, vol: 0.022, type: 'sine' })
        }
        u.fireT -= dt
        if (u.fireT <= 0 && s.alive) {
          u.fireT = u.small ? 1.1 : 1.7
          let an: number
          if (u.small) {
            const err = Math.max(0.04, 0.38 - g.wave * 0.035)
            an = Math.atan2(wd(s.y, u.y, H), wd(s.x, u.x, W)) + (Math.random() - 0.5) * err * 2
          } else an = Math.random() * Math.PI * 2
          g.ebullets.push({ x: u.x, y: u.y, vx: Math.cos(an) * 185, vy: Math.sin(an) * 185, life: 2.4 })
          tone({ freq: 600, to: 300, dur: 0.1, vol: 0.025, type: 'square' })
        }
        if ((u.vx > 0 && u.x > W + u.r + 4) || (u.vx < 0 && u.x < -u.r - 4)) g.ufo = null
      }

      // ----- colisiones: balas del jugador -----
      for (const b of g.bullets) {
        if (b.life <= 0) continue
        let hit = false
        for (const r of g.rocks) {
          const rr2 = r.r * 0.9 + 2
          const d1 = Math.hypot(wd(b.x, r.x, W), wd(b.y, r.y, H))
          const d2 = Math.hypot(wd(b.x - b.vx * dt * 0.5, r.x, W), wd(b.y - b.vy * dt * 0.5, r.y, H))
          if (Math.min(d1, d2) < rr2) {
            b.life = 0
            r.flash = 0.08
            breakRock(r, b.vx, b.vy)
            hit = true
            break
          }
        }
        if (hit) continue
        const uf = g.ufo
        if (uf && Math.hypot(wd(b.x, uf.x, W), wd(b.y, uf.y, H)) < uf.r + 3) {
          b.life = 0
          killUfo(uf)
        }
      }

      // ----- colisiones: nave -----
      if (s.alive && s.hyperOut <= 0) {
        const vuln = s.invuln <= 0
        for (const r of g.rocks.slice()) {
          const d = Math.hypot(wd(s.x, r.x, W), wd(s.y, r.y, H))
          const hitR = r.r * 0.85 + 7
          if (d < hitR) {
            if (s.shield > 0) {
              // el escudo embiste el asteroide
              const nx = wd(s.x, r.x, W) / (d || 1)
              const ny = wd(s.y, r.y, H) / (d || 1)
              s.vx += nx * 80
              s.vy += ny * 80
              s.shield = Math.max(0, s.shield - 1.5)
              juice.burst(s.x, s.y, ['#8aa8ff', '#ffffff'], { count: 10, speed: 130, life: 0.3, size: 2.6 })
              breakRock(r, -nx, -ny, true)
              sfx.hit()
            } else if (vuln) {
              killShip('Colisión')
              break
            }
          } else if (vuln && !r.nm && g.nmCool <= 0 && d < hitR + 11 && s.shield <= 0) {
            r.nm = true
            g.nmCool = 0.7
            g.comboT = Math.max(g.comboT, 1.4)
            addScore(15, s.x, s.y - 26, '#7dd3fc')
            text(s.x, s.y - 38, 'RASANTE', '#7dd3fc', 7, 0.7)
            tone({ freq: 520, to: 800, dur: 0.1, vol: 0.03, type: 'sine' })
          }
        }
        if (s.alive && g.ufo) {
          const uf = g.ufo
          if (Math.hypot(wd(s.x, uf.x, W), wd(s.y, uf.y, H)) < uf.r + 8) {
            if (s.shield > 0) {
              s.shield = Math.max(0, s.shield - 2)
              killUfo(uf)
            } else if (vuln) {
              killUfo(uf)
              killShip('Embestida de OVNI')
            }
          }
        }
        if (s.alive && vuln) {
          for (const b of g.ebullets) {
            if (b.life > 0 && Math.hypot(wd(s.x, b.x, W), wd(s.y, b.y, H)) < 9) {
              b.life = 0
              if (s.shield > 0) {
                s.shield = Math.max(0, s.shield - 2)
                juice.burst(b.x, b.y, ['#8aa8ff', '#ffffff'], { count: 8, speed: 110, life: 0.3, size: 2.4 })
                juice.shake(0.2)
                sfx.hit()
              } else {
                killShip('Disparo de OVNI')
              }
              break
            }
          }
        }
      }
      // balas de ovni contra asteroides (efecto de caos)
      for (const b of g.ebullets) {
        if (b.life <= 0) continue
        for (const r of g.rocks) {
          if (Math.hypot(wd(b.x, r.x, W), wd(b.y, r.y, H)) < r.r * 0.8) {
            b.life = 0
            juice.burst(b.x, b.y, '#ffb4b4', { count: 5, speed: 80, life: 0.25, size: 2.2 })
            break
          }
        }
      }
      g.bullets = g.bullets.filter((b) => b.life > 0)
      g.ebullets = g.ebullets.filter((b) => b.life > 0)

      // ----- power-ups -----
      for (const p of g.pups) {
        p.t += dt
        p.life -= dt
        p.x = wrapPos(p.x + p.vx * dt, W)
        p.y = wrapPos(p.y + p.vy * dt, H)
        if (s.alive && s.hyperOut <= 0 && Math.hypot(wd(s.x, p.x, W), wd(s.y, p.y, H)) < 20) {
          p.life = 0
          const info = PUP_INFO[p.type]
          if (p.type === 'shield') s.shield = 9
          else if (p.type === 'triple') s.triple = 12
          else s.rapid = 12
          g.score += 50
          text(s.x, s.y - 30, info.name, info.color, 8, 1.2)
          juice.burst(p.x, p.y, [info.color, '#ffffff'], { count: 14, speed: 140, life: 0.4, size: 3 })
          juice.flash(info.color, 0.15)
          sfx.power()
        }
      }
      g.pups = g.pups.filter((p) => p.life > 0)

      // ----- fin de oleada -----
      if (g.mode === 'play' && g.rocks.length === 0 && g.clearT < 0 && !g.ufo) {
        g.clearT = 2.2
        g.ebullets = []
        const par = 22 + g.wave * 6
        const rapid = Math.max(0, Math.round((par - g.waveT) * 10 / 10) * 10)
        const base = 100 + g.wave * 30
        g.score += base + rapid
        g.banner = {
          title: `OLEADA ${g.wave} LIMPIA`,
          sub: rapid > 0 ? `+${base}  RAPIDEZ +${rapid}` : `+${base}`,
          t: 0, dur: 2.2, color: '#ffe23d',
        }
        juice.flash('#ffffff', 0.16)
        sfx.levelUp()
      }
      if (g.clearT >= 0) {
        g.clearT -= dt
        if (g.clearT <= 0) spawnWave(g.wave + 1)
      }
    }

    const update = (dtReal: number) => {
      // estrellas con paralaje: se desplazan al revés que la nave
      const s = g.ship
      const par = [0.04, 0.09, 0.16]
      for (const st of g.stars) {
        st.x = wrapPos(st.x - s.vx * par[st.layer] * dtReal + 2 * (st.layer + 1) * dtReal * 0.3, W)
        st.y = wrapPos(st.y - s.vy * par[st.layer] * dtReal, H)
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

      // fragmentos
      for (const sh of g.shards) {
        sh.life -= dtReal
        sh.x = wrapPos(sh.x + sh.vx * dtReal, W)
        sh.y = wrapPos(sh.y + sh.vy * dtReal, H)
        sh.a += sh.va * dtReal
      }
      g.shards = g.shards.filter((sh) => sh.life > 0)

      if (g.mode === 'title') {
        moveRocks(dtReal)
        if (g.wantStart || jp.has('action')) startGame()
        g.wantStart = false
        return
      }
      if (g.mode === 'over') {
        g.overT += dtReal
        moveRocks(dtReal * 0.4)
        if (g.wantStart || (jp.has('action') && g.overT > 0.5)) startGame()
        g.wantStart = false
        return
      }
      g.wantStart = false
      if (g.mode === 'dying') {
        g.dyingT += dtReal
        moveRocks(dtReal * 0.5)
        if (g.dyingT > 1.3) {
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

    const wrapDraw = (x: number, y: number, r: number, fn: (x: number, y: number) => void) => {
      fn(x, y)
      const ox = x < r ? W : x > W - r ? -W : 0
      const oy = y < r ? H : y > H - r ? -H : 0
      if (ox) fn(x + ox, y)
      if (oy) fn(x, y + oy)
      if (ox && oy) fn(x + ox, y + oy)
    }

    const glowStroke = (color: string, w: number) => {
      ctx.globalAlpha = 0.22
      ctx.lineWidth = w + 4
      ctx.strokeStyle = color
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineWidth = w
      ctx.stroke()
    }

    const drawRock = (r: Rock) => {
      wrapDraw(r.x, r.y, r.r + 4, (x, y) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(r.a)
        ctx.beginPath()
        ctx.moveTo(r.pts[0].x, r.pts[0].y)
        for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i].x, r.pts[i].y)
        ctx.closePath()
        ctx.fillStyle = r.flash > 0 ? 'rgba(255,255,255,0.55)' : r.cargo ? 'rgba(20,70,70,0.7)' : 'rgba(12,16,32,0.88)'
        ctx.fill()
        ctx.strokeStyle = r.flash > 0 ? '#ffffff' : r.color
        glowStroke(r.flash > 0 ? '#ffffff' : r.color, r.tier === 3 ? 2 : 1.7)
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.45
        for (const c of r.craters) {
          ctx.beginPath()
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.restore()
        if (r.cargo) {
          ctx.strokeStyle = `rgba(94,234,212,${0.35 + 0.3 * Math.sin(g.time * 6)})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(x, y, r.r + 5 + Math.sin(g.time * 6) * 1.5, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
    }

    const drawShip = () => {
      const s = g.ship
      const blink = s.invuln > 0 && Math.floor(g.time * 14) % 2 === 0
      if (blink) return
      wrapDraw(s.x, s.y, 20, (x, y) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(s.a)
        if (s.thrusting) {
          const fl = 9 + Math.random() * 8
          ctx.beginPath()
          ctx.moveTo(-4.5, 7)
          ctx.lineTo(0, 7 + fl)
          ctx.lineTo(4.5, 7)
          ctx.closePath()
          ctx.fillStyle = '#ff8a3d'
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-2.5, 7)
          ctx.lineTo(0, 7 + fl * 0.6)
          ctx.lineTo(2.5, 7)
          ctx.closePath()
          ctx.fillStyle = '#fff2a8'
          ctx.fill()
        }
        ctx.beginPath()
        ctx.moveTo(0, -14)
        ctx.lineTo(-9.5, 11)
        ctx.lineTo(0, 6)
        ctx.lineTo(9.5, 11)
        ctx.closePath()
        ctx.fillStyle = 'rgba(8,24,44,0.9)'
        ctx.fill()
        ctx.strokeStyle = '#e0f2fe'
        glowStroke(ACCENT, 2)
        ctx.restore()
        if (s.shield > 0 && (s.shield > 2.5 || Math.floor(g.time * 10) % 2 === 0)) {
          ctx.fillStyle = 'rgba(138,168,255,0.13)'
          ctx.strokeStyle = `rgba(150,180,255,${0.7 + 0.3 * Math.sin(g.time * 9)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, 21, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      })
    }

    const drawUfo = (u: Ufo) => {
      const col = u.small ? '#ff4d8d' : '#ff8a5c'
      wrapDraw(u.x, u.y, u.r + 4, (x, y) => {
        const k = u.r / 16
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(k, k)
        ctx.beginPath()
        ctx.moveTo(-16, 3)
        ctx.lineTo(-8, -3)
        ctx.lineTo(8, -3)
        ctx.lineTo(16, 3)
        ctx.lineTo(8, 9)
        ctx.lineTo(-8, 9)
        ctx.closePath()
        ctx.moveTo(-8, -3)
        ctx.lineTo(-5, -10)
        ctx.lineTo(5, -10)
        ctx.lineTo(8, -3)
        ctx.moveTo(-16, 3)
        ctx.lineTo(16, 3)
        ctx.fillStyle = 'rgba(30,8,16,0.85)'
        ctx.fill()
        ctx.strokeStyle = col
        glowStroke(col, 1.8 / k)
        ctx.restore()
        const on = Math.floor(g.time * 8) % 2
        ctx.fillStyle = on ? '#ffe23d' : '#ffffff'
        ctx.fillRect(x - 7 * k, y + 5 * k, 2, 2)
        ctx.fillRect(x - 1, y + 5 * k, 2, 2)
        ctx.fillRect(x + 5 * k, y + 5 * k, 2, 2)
      })
    }

    const draw = () => {
      ctx.drawImage(bg, 0, 0, W, H)
      for (const st of g.stars) {
        const a = [0.3, 0.55, 0.9][st.layer]
        ctx.fillStyle = `rgba(210,230,255,${a})`
        ctx.fillRect(st.x, st.y, st.s, st.s)
      }

      ctx.save()
      juice.applyShake(ctx)

      for (const r of g.rocks) drawRock(r)

      // power-ups
      for (const p of g.pups) {
        if (p.life < 3 && Math.floor(g.time * 10) % 2 === 0) continue
        const info = PUP_INFO[p.type]
        const bob = Math.sin(p.t * 5) * 1.5
        wrapDraw(p.x, p.y, 20, (x, y) => {
          ctx.globalAlpha = 0.22 + 0.12 * Math.sin(p.t * 8)
          ctx.fillStyle = info.color
          ctx.beginPath()
          ctx.arc(x, y + bob, 16, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.save()
          ctx.translate(x, y + bob)
          ctx.rotate(p.t * 1.5)
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const an = (i / 6) * Math.PI * 2
            ctx.lineTo(Math.cos(an) * 12, Math.sin(an) * 12)
          }
          ctx.closePath()
          ctx.fillStyle = '#0a0f1e'
          ctx.fill()
          ctx.strokeStyle = info.color
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.restore()
          drawText(info.label, x, y + 1 + bob, 9, info.color)
        })
      }

      if (g.ufo) drawUfo(g.ufo)

      // balas enemigas
      for (const b of g.ebullets) {
        wrapDraw(b.x, b.y, 8, (x, y) => {
          ctx.fillStyle = 'rgba(255,120,80,0.3)'
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ff7a50'
          ctx.beginPath()
          ctx.arc(x, y, 3.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillRect(x - 1, y - 1, 2, 2)
        })
      }

      // balas del jugador
      const bcol = g.ship.triple > 0 ? '#ffb86b' : g.ship.rapid > 0 ? '#fff08a' : '#bff3ff'
      for (const b of g.bullets) {
        const sp = Math.hypot(b.vx, b.vy) || 1
        const tx = (b.vx / sp) * 9
        const ty = (b.vy / sp) * 9
        wrapDraw(b.x, b.y, 12, (x, y) => {
          ctx.strokeStyle = bcol
          ctx.globalAlpha = 0.3
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.moveTo(x - tx, y - ty)
          ctx.lineTo(x, y)
          ctx.stroke()
          ctx.globalAlpha = 1
          ctx.lineWidth = 2.4
          ctx.beginPath()
          ctx.moveTo(x - tx, y - ty)
          ctx.lineTo(x, y)
          ctx.stroke()
        })
      }

      // fragmentos
      for (const sh of g.shards) {
        ctx.globalAlpha = Math.max(0, sh.life / sh.maxLife)
        ctx.strokeStyle = sh.color
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(sh.x - Math.cos(sh.a) * sh.len * 0.5, sh.y - Math.sin(sh.a) * sh.len * 0.5)
        ctx.lineTo(sh.x + Math.cos(sh.a) * sh.len * 0.5, sh.y + Math.sin(sh.a) * sh.len * 0.5)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      if (g.ship.alive && g.ship.hyperOut <= 0 && (g.mode === 'play' || g.mode === 'title')) drawShip()

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, FONT)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      // ----- HUD en canvas -----
      const s = g.ship
      if (g.mode === 'play' || g.mode === 'dying') {
        if (g.combo > 0) {
          const pop = 1 + g.multPop * 0.5
          drawText(`x${g.mult}`, 10, 18, Math.round(14 * pop), g.mult > 1 ? '#ffe23d' : '#ffffffaa', 'left')
          drawText(`COMBO ${g.combo}`, 10, 36, 7, '#ffffffbb', 'left')
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(10, 44, 56, 4)
          ctx.fillStyle = g.comboT < 0.7 ? '#ff6b6b' : '#ffe23d'
          ctx.fillRect(10, 44, 56 * clamp(g.comboT / 2.3, 0, 1), 4)
        }
        // temporizadores
        let ix = 8
        const chip = (label: string, color: string, frac: number) => {
          drawText(label, ix, H - 22, 7, color, 'left')
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(ix, H - 16, 26, 3)
          ctx.fillStyle = color
          ctx.fillRect(ix, H - 16, 26 * clamp(frac, 0, 1), 3)
          ix += 38
        }
        if (s.shield > 0) chip('ESC', '#8aa8ff', s.shield / 9)
        if (s.triple > 0) chip('3X', '#ff9f43', s.triple / 12)
        if (s.rapid > 0) chip('RAP', '#ffe23d', s.rapid / 12)
        // hiperespacio: recarga y riesgo
        const ready = s.hyperCool <= 0
        const hx = W - 8
        drawText(ready ? `HIPER ${Math.round(hyperRisk() * 100)}%` : 'HIPER', hx, H - 22, 7, ready ? ACCENT : '#ffffff77', 'right')
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(hx - 56, H - 16, 56, 3)
        ctx.fillStyle = ready ? ACCENT : '#ffffff66'
        ctx.fillRect(hx - 56, H - 16, 56 * (ready ? 1 : 1 - clamp(s.hyperCool / 3.2, 0, 1)), 3)
      }

      if (g.banner && g.mode === 'play') {
        const bn = g.banner
        const a = Math.min(1, bn.t / 0.2, (bn.dur - bn.t) / 0.4)
        if (a > 0) {
          ctx.globalAlpha = Math.max(0, a)
          const pop = 1 + Math.max(0, 0.25 - bn.t) * 1.6
          const size = Math.min(22, Math.floor(340 / bn.title.length)) * pop
          drawText(bn.title, W / 2, H * 0.3, size, bn.color)
          drawText(bn.sub, W / 2, H * 0.3 + 26, Math.min(9, Math.floor(340 / Math.max(1, bn.sub.length))), '#ffffff')
          ctx.globalAlpha = 1
        }
      }

      if (g.paused) {
        ctx.fillStyle = 'rgba(4,6,17,0.78)'
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
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.mode === 'title' || g.mode === 'over') requestRemount()
      }
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
    { label: 'Asteroides', value: ui.rocks },
    { label: 'OVNIs', value: ui.ufos },
    { label: 'Mejor combo', value: ui.bestCombo },
  ]

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#1d3a5c] bg-[#040611] shadow-[0_0_40px_rgba(56,189,248,0.18)]"
        hud={
          <Hud>
            <span className="text-[#7cff6b] drop-shadow-[0_0_6px_rgba(124,255,107,0.8)]">PTS {ui.score}</span>
            <span className="flex items-center gap-2">
              <span className="text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">OLEADA {ui.wave}</span>
              <span className="text-[#e0f2fe]" title="Vidas">
                {'▲'.repeat(Math.max(0, ui.lives))}
              </span>
            </span>
            <span className="text-[#ffe23d] drop-shadow-[0_0_6px_rgba(255,226,61,0.8)]">HI {Math.max(best, ui.score)}</span>
          </Hud>
        }
      >
        <canvas ref={canvasRef} className="block h-full w-full touch-none select-none object-contain" aria-label="Juego Asteroid Drift" />
        {ui.mode === 'title' && (
          <StartOverlay
            title="ASTEROID DRIFT"
            accent={ACCENT}
            subtitle="Gira con izquierda y derecha, empuja con arriba y dispara con A (mantén para ráfaga). Encadena destrucciones para subir el combo."
            hint="ESPACIO dispara · X o Flecha abajo: hiperespacio"
            touchHint="Toca A para empezar · B es hiperespacio"
            onStart={requestStart}
          />
        )}
        {ui.mode === 'over' && (
          <GameOverOverlay
            title="NAVE DESTRUIDA"
            accent={ACCENT}
            score={ui.score}
            best={best}
            newBest={ui.newBest}
            stats={stats}
            onRestart={requestStart}
          />
        )}
      </GameScreen>
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Fuego"
        showAction2
        action2Label="Hiper"
        action2Glyph="B"
      />
    </div>
  )
}
