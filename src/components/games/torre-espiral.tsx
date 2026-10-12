'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'
import {
  BALL_REST_DY,
  R_IN,
  R_MID,
  R_OUT,
  SEG_ANGLE,
  SEGS,
  SKINS,
  TILT,
  drawBackground,
  drawBall,
  drawBigText,
  drawPlatform,
  drawPole,
  drawProgress,
  drawShard,
  drawSkinPreview,
  segmentUnderBall,
  themeFor,
  type PlatformView,
  type Skin,
  type SegKind,
  type SkinId,
  type Splat,
  type Theme,
} from './torre-espiral/art'

const GAME_ID = 'torre-espiral'
const ACCENT = '#8a63ff'

const W0 = 360
const H0 = 560
// Mundo lógico: se ajusta a la pantalla (ver layout). El eje de la torre siempre va al centro.
let W = W0
let H = H0

/** Ajusta el mundo lógico al área de la pantalla; la torre conserva su tamaño. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

const TAU = Math.PI * 2
/** Altura del primer piso en el mundo (el eje y crece hacia abajo). */
const BASE_Y = 120
const SPACING = 112

// Física
const GRAVITY = 1900
const BOUNCE_V = -560
const TERMINAL = 1100
/** Altura del rebote (px), para la animación del menú. */
const BOUNCE_H = (BOUNCE_V * BOUNCE_V) / (2 * GRAVITY)

// Cámara: sigue a la pelota solo hacia abajo
const CAM_AHEAD = 0.38
const CAM_EASE = 7

// Giro: arrastrar mueve la superficie 1:1 con el dedo (a la altura de R_MID)
const DRAG_K = 1 / R_MID
const KEY_SPIN = 3.4
const MENU_SPIN = 0.3
/** Inercia tras soltar: la velocidad angular se multiplica por 0.9 cada 1/60 s. */
const INERTIA = 0.9

const DEATH_T = 0.9
const CLEAR_T = 1.2
const SHARD_GRAVITY = 1400
const MAX_SHARDS = 160

const LEVEL_KEY = 'torre-espiral-level'
const SKIN_KEY = 'torre-espiral-skin'

type Phase = 'menu' | 'playing' | 'clear' | 'dying' | 'over'

interface Plat extends PlatformView {
  broken: boolean
  /** Velocidad de giro propia (rad/s); 0 = piso fijo. */
  rate: number
}

interface Shard {
  /** Desplazamiento horizontal desde el eje (así sobrevive a un reacomodo). */
  dx: number
  /** y del mundo: la cámara sube y los trozos se quedan en su sitio. */
  wy: number
  vx: number
  vy: number
  rot: number
  rv: number
  life: number
  color: string
  side: string
}

interface Note {
  text: string
  sub: string
  color: string
  t: number
}

interface Game {
  phase: Phase
  paused: boolean
  t: number
  level: number
  plats: Plat[]
  /** Índice del piso pendiente: la pelota cae hacia él. */
  idx: number
  rot: number
  omega: number
  dragging: boolean
  rotPrev: number
  ballY: number
  vy: number
  squash: number
  fire: boolean
  fireAmt: number
  /** Pisos atravesados seguidos desde el último rebote (el "combo"). */
  fall: number
  maxFall: number
  broken: number
  score: number
  camY: number
  shards: Shard[]
  praise: Note | null
  banner: Note | null
  deadT: number
  clearT: number
  overT: number
}

interface Result {
  score: number
  newBest: boolean
  level: number
  broken: number
  maxFall: number
}

// ---------- utilidades ----------

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Generador pseudoaleatorio determinista (mulberry32): mismo nivel, mismo diseño. */
function rng(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Distancia mínima entre dos centros de hueco, en segmentos (el anillo da la vuelta). */
function circDist(a: number, b: number) {
  const d = Math.abs(a - b) % SEGS
  return Math.min(d, SEGS - d)
}

function kindColors(kind: SegKind, th: Theme): [string, string] {
  if (kind === 'danger') return [th.danger, th.dangerSide]
  if (kind === 'metal') return ['#5b5f6e', '#34374a']
  if (kind === 'finish') return ['#ffffff', '#d9d9e6']
  return [th.safe, th.safeSide]
}

/**
 * Genera los pisos de un nivel. Cada piso tiene un hueco de 2–3 segmentos; los
 * peligros (rojo) crecen con el nivel, los pisos de metal aparecen desde el 6 y
 * algunos giran solos desde el 8. El último piso es la meta.
 */
function buildLevel(level: number, baseY: number): Plat[] {
  const rnd = rng(level * 9973)
  const count = 8 + Math.min(14, Math.floor(level * 1.2))
  const plats: Plat[] = []
  let prevC = -99
  for (let i = 0; i < count; i++) {
    const segs: SegKind[] = Array.from({ length: SEGS }, (): SegKind => 'safe')

    // hueco: contiguo, de 2 o 3 segmentos, desplazado al menos 2 segmentos del anterior
    const gapLen = i === 0 && level === 1 ? 3 : level <= 2 ? 2 : rnd() < 0.35 ? 3 : 2
    let start = 0
    for (let k = 0; k < 40; k++) {
      start = Math.floor(rnd() * SEGS)
      if (prevC < -50 || circDist(start + (gapLen - 1) / 2, prevC) >= 2) break
    }
    for (let k = 0; k < gapLen; k++) segs[(start + k) % SEGS] = 'gap'
    prevC = start + (gapLen - 1) / 2
    const left = (start - 1 + SEGS) % SEGS
    const right = (start + gapLen) % SEGS

    // peligros: nunca en los dos primeros pisos ni en los dos bordes del hueco a la vez
    if (i >= 2) {
      const [lo, hi] = level <= 2 ? [0, 1] : level <= 5 ? [1, 2] : level <= 9 ? [1, 3] : [2, 4]
      const want = lo + Math.floor(rnd() * (hi - lo + 1))
      let placed = 0
      for (let k = 0; k < 60 && placed < want; k++) {
        const j = Math.floor(rnd() * SEGS)
        if (segs[j] !== 'safe') continue
        if (j === left && segs[right] === 'danger') continue
        if (j === right && segs[left] === 'danger') continue
        segs[j] = 'danger'
        placed++
      }
    }

    // metal: bloques de 2–3 segmentos que cambian a algunos seguros (siempre quedan 5 seguros)
    if (level >= 6 && i >= 2 && rnd() < 0.45) {
      const len = rnd() < 0.5 ? 2 : 3
      const safeCount = segs.filter((s) => s === 'safe').length
      if (safeCount - len >= 5) {
        for (let k = 0; k < 20; k++) {
          const s0 = Math.floor(rnd() * SEGS)
          let ok = true
          for (let q = 0; q < len; q++) if (segs[(s0 + q) % SEGS] !== 'safe') ok = false
          if (!ok) continue
          for (let q = 0; q < len; q++) segs[(s0 + q) % SEGS] = 'metal'
          break
        }
      }
    }

    // giro propio: algunos pisos rotan solos desde el nivel 8
    const rate = level >= 8 && i >= 2 && rnd() < 0.25 ? (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5) : 0

    plats.push({ y: baseY + i * SPACING, segs, splats: [], spin: 0, flash: 0, broken: false, rate })
  }
  const fin: SegKind[] = Array.from({ length: SEGS }, (): SegKind => 'finish')
  plats.push({ y: baseY + count * SPACING, segs: fin, splats: [], spin: 0, flash: 0, broken: false, rate: 0 })
  return plats
}

function newGame(level: number): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    level,
    plats: buildLevel(level, BASE_Y),
    idx: 0,
    rot: 0,
    omega: 0,
    dragging: false,
    rotPrev: 0,
    ballY: BASE_Y + BALL_REST_DY,
    vy: 0,
    squash: 0,
    fire: false,
    fireAmt: 0,
    fall: 0,
    maxFall: 0,
    broken: 0,
    score: 0,
    camY: 0,
    shards: [],
    praise: null,
    banner: null,
    deadT: 0,
    clearT: 0,
    overT: 0,
  }
}

// ---------- progreso y aspecto (localStorage, con respaldo si no hay acceso) ----------

/** Nivel más alto alcanzado; desde ahí empiezan las partidas nuevas. */
function loadLevel(): number {
  if (typeof window === 'undefined') return 1
  try {
    const n = parseInt(window.localStorage.getItem(LEVEL_KEY) ?? '1', 10)
    return Number.isFinite(n) && n >= 1 ? n : 1
  } catch {
    return 1
  }
}

function saveLevel(n: number) {
  if (typeof window === 'undefined') return
  try {
    if (n > loadLevel()) window.localStorage.setItem(LEVEL_KEY, String(n))
  } catch {
    // sin almacenamiento: el progreso dura lo que la pestaña
  }
}

/** Aspecto guardado, solo si ya está desbloqueado por el nivel alcanzado. */
function loadSkin(reached: number): SkinId {
  if (typeof window === 'undefined') return 'clasica'
  try {
    const v = window.localStorage.getItem(SKIN_KEY)
    const s = SKINS.find((x) => x.id === v)
    if (s && s.unlock <= reached) return s.id
  } catch {
    // sin almacenamiento
  }
  return 'clasica'
}

function saveSkin(id: SkinId) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SKIN_KEY, id)
  } catch {
    // sin almacenamiento
  }
}

// ---------- sonidos locales ----------
const sBoing = () => tone({ freq: 300, to: 540, dur: 0.12, type: 'triangle', vol: 0.05 })
const sWhoosh = (n: number) => {
  noise({ dur: 0.14, vol: 0.035, freq: 900 + n * 260 })
  tone({ freq: 240 + n * 70, to: 460 + n * 90, dur: 0.16, type: 'triangle', vol: 0.03 })
}
const sFire = () => {
  tone({ freq: 180, to: 880, dur: 0.32, type: 'sawtooth', vol: 0.03 })
  noise({ dur: 0.3, vol: 0.05, freq: 2200 })
}
const sSmash = () => {
  noise({ dur: 0.22, vol: 0.12, freq: 1000 })
  tone({ freq: 170, to: 50, dur: 0.26, type: 'triangle', vol: 0.08 })
}
const sCrash = () => {
  noise({ dur: 0.5, vol: 0.12, freq: 800 })
  tone({ freq: 120, to: 35, dur: 0.45, type: 'sawtooth', vol: 0.06 })
}
const sFanfare = () => {
  ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14, vol: 0.05, delay: i * 0.09, type: 'square' }))
  tone({ freq: 1319, dur: 0.4, vol: 0.04, delay: 0.4, type: 'triangle' })
}
const sPraise = () => {
  tone({ freq: 880, dur: 0.08, vol: 0.04, type: 'square' })
  tone({ freq: 1175, dur: 0.12, vol: 0.04, delay: 0.07, type: 'square' })
}
const sStart = () => {
  tone({ freq: 523, dur: 0.08, vol: 0.045, type: 'square' })
  tone({ freq: 784, dur: 0.12, vol: 0.045, delay: 0.08, type: 'square' })
}
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })

/** Vibración háptica corta, si el dispositivo la soporta. */
const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p)
  } catch {
    /* sin vibración */
  }
}

// ---------- selector de aspecto (en la pantalla de inicio) ----------

function SkinButton({
  skin,
  locked,
  active,
  onPick,
}: {
  skin: Skin
  locked: boolean
  active: boolean
  onPick: (id: SkinId) => void
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const c = setupCanvas(cv, 28, 28)
    c.clearRect(0, 0, 28, 28)
    drawSkinPreview(c, 14, 14, skin.id, locked, 0)
  }, [skin, locked])
  return (
    <button
      type="button"
      disabled={locked}
      title={locked ? `🔒 Nivel ${skin.unlock}` : skin.name}
      aria-label={locked ? `${skin.name}, bloqueado hasta el nivel ${skin.unlock}` : `Aspecto ${skin.name}`}
      aria-pressed={active}
      onClick={(e) => {
        e.currentTarget.blur()
        onPick(skin.id)
      }}
      className={`rounded-full p-1 transition ${active ? 'bg-white/25 ring-2 ring-white' : 'bg-white/5 ring-1 ring-white/20'} ${
        locked ? 'cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'
      }`}
    >
      <canvas ref={ref} className="block size-7" aria-hidden />
    </button>
  )
}

function SkinPicker({ selected, reached, onPick }: { selected: SkinId; reached: number; onPick: (id: SkinId) => void }) {
  const name = SKINS.find((s) => s.id === selected)?.name ?? ''
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex max-w-xs flex-wrap justify-center gap-1.5">
        {SKINS.map((s) => (
          <SkinButton key={s.id} skin={s} locked={s.unlock > reached} active={s.id === selected} onPick={onPick} />
        ))}
      </div>
      <p className="text-[11px] text-white/60">Aspecto: {name}</p>
    </div>
  )
}

// ---------- componente ----------

export default function TorreEspiral() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const skinRef = useRef<SkinId>('clasica')
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(() => loadLevel())
  const [reached, setReached] = useState(() => loadLevel())
  const [skin, setSkin] = useState<SkinId>(() => loadSkin(loadLevel()))
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, newBest: false, level: 1, broken: 0, maxFall: 0 })

  useEffect(() => {
    skinRef.current = skin
  }, [skin])

  const pickSkin = (id: SkinId) => {
    setSkin(id)
    saveSkin(id)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const g = newGame(loadLevel())
    g.camY = g.ballY - H * CAM_AHEAD
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    // vista reutilizable de un piso (drawPlatform espera la y de pantalla)
    const view: PlatformView = { y: 0, segs: [], splats: [], spin: 0, flash: 0 }
    let lastX = 0

    const ballSY = () => g.ballY - g.camY

    /** Copia el piso a `view` si está en pantalla y no está roto. */
    const placeView = (pl: Plat) => {
      if (pl.broken) return false
      const sy = pl.y - g.camY
      if (sy < -80 || sy > H + 80) return false
      view.y = sy
      view.segs = pl.segs
      view.splats = pl.splats
      view.spin = pl.spin
      view.flash = pl.flash
      return true
    }

    // ---------- trozos y partículas ----------
    const spawnShards = (pl: Plat, n: number) => {
      const th0 = themeFor(g.level)
      const R = g.rot + pl.spin
      for (let k = 0; k < n; k++) {
        // trozos de la mitad delantera (visible)
        const th = Math.PI * 0.06 + Math.random() * Math.PI * 0.88
        const r = R_IN + Math.random() * (R_OUT - R_IN)
        const ang = (((th - R) % TAU) + TAU) % TAU
        const [color, side] = kindColors(pl.segs[Math.floor(ang / SEG_ANGLE) % SEGS], th0)
        g.shards.push({
          dx: Math.cos(th) * r,
          wy: pl.y + Math.sin(th) * r * TILT,
          vx: Math.cos(th) * (70 + Math.random() * 90) + (Math.random() - 0.5) * 60,
          vy: -(90 + Math.random() * 150),
          rot: Math.random() * TAU,
          rv: (Math.random() - 0.5) * 9,
          life: 0.8,
          color,
          side,
        })
      }
      if (g.shards.length > MAX_SHARDS) g.shards.splice(0, g.shards.length - MAX_SHARDS)
    }

    const breakPlat = (pl: Plat, n: number) => {
      if (pl.broken) return
      pl.broken = true
      g.broken += 1
      spawnShards(pl, n)
    }

    const showPraise = (text: string, color: string) => {
      g.praise = { text, sub: '', color, t: 1 }
      sPraise()
    }

    // ---------- reglas de la caída ----------
    const togglePause = () => {
      if (g.phase !== 'playing') return
      g.paused = !g.paused
      g.dragging = false
      sPause()
    }

    const startRun = (lv: number) => {
      Object.assign(g, newGame(lv))
      g.phase = 'playing'
      g.vy = BOUNCE_V
      g.squash = 1
      g.camY = g.ballY - H * CAM_AHEAD
      juice.reset()
      sStart()
      saveLevel(lv)
      setReached(loadLevel())
      setLevel(lv)
      setScore(0)
      setUi('playing')
    }
    startRef.current = () => startRun(g.level)

    /** Rebote: la pelota vuelve a saltar desde el piso. */
    const bounce = (pl: Plat, line: number) => {
      g.ballY = line
      g.vy = BOUNCE_V
      g.squash = 1
      g.fall = 0
      g.fire = false
      pl.flash = 1
      const s: Splat = {
        a: Math.PI / 2 - g.rot - pl.spin + (Math.random() - 0.5) * SEG_ANGLE * 0.4,
        seed: Math.floor(Math.random() * 100000),
        grow: 0,
      }
      pl.splats.push(s)
      if (pl.splats.length > 6) pl.splats.shift()
      juice.burst(W / 2, ballSY(), themeFor(g.level).splat, { count: 6, speed: 90, life: 0.35, size: 3, gravity: 400 })
      sBoing()
    }

    /** Atraviesa un hueco: el piso se rompe y la pelota sigue cayendo. */
    const passPlat = (pl: Plat) => {
      breakPlat(pl, 10 + Math.floor(Math.random() * 5))
      g.fall += 1
      const pts = 1 + g.fall
      g.score += pts
      g.maxFall = Math.max(g.maxFall, g.fall)
      juice.text(W / 2 + 30, ballSY() - 16, `+${pts}`, g.fall >= 3 ? '#fde047' : '#ffffff', 14, 0.7)
      if (g.fall >= 3 && !g.fire) {
        g.fire = true
        sFire()
        juice.flash('#ff8a00', 0.18)
      }
      if (g.fall === 3) showPraise('¡GENIAL!', '#fde047')
      if (g.fall === 5) showPraise('¡INCREÍBLE!', '#ff6ad5')
      sWhoosh(g.fall)
      buzz(8)
      setScore(g.score)
    }

    /** Bola de fuego: rompe el piso sin rebotar. */
    const smashPlat = (pl: Plat) => {
      breakPlat(pl, 14)
      g.score += 2
      g.fire = false
      juice.shake(0.4)
      juice.freeze(50)
      juice.flash('#ff8a00', 0.25)
      juice.burst(W / 2, ballSY(), [themeFor(g.level).safe, '#ffd23f', '#ffffff'], {
        count: 18,
        speed: 240,
        life: 0.6,
        size: 4,
        gravity: 500,
      })
      juice.text(W / 2 + 30, ballSY() - 16, '+2', '#ffd23f', 14, 0.7)
      sSmash()
      buzz(20)
      setScore(g.score)
    }

    const die = () => {
      g.phase = 'dying'
      g.deadT = 0
      g.fire = false
      g.dragging = false
      g.praise = null
      const sy = ballSY()
      juice.flash('#ff3b3b', 0.5)
      juice.shake(0.8)
      juice.freeze(90)
      juice.burst(W / 2, sy, ['#ff3b3b', '#ffffff', '#ffd23f', themeFor(g.level).safe], {
        count: 24,
        speed: 230,
        life: 0.8,
        size: 4,
        gravity: 700,
      })
      sCrash()
      buzz([60, 40, 120])
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, newBest: nb, level: g.level, broken: g.broken, maxFall: g.maxFall })
      setScore(g.score)
    }

    /** Llegó a la meta: confeti, fanfarria y paso al siguiente nivel tras una pausa. */
    const landFinish = (line: number) => {
      g.phase = 'clear'
      g.clearT = 0
      g.ballY = line
      g.vy = BOUNCE_V
      g.squash = 1
      g.fire = false
      g.fall = 0
      g.score += 10
      const th = themeFor(g.level)
      juice.burst(W / 2, ballSY(), [th.safe, th.danger, th.splat, '#ffd23f', '#ffffff'], {
        count: 48,
        speed: 300,
        life: 1.3,
        size: 5,
        gravity: 380,
      })
      juice.flash('#ffffff', 0.45)
      juice.freeze(70)
      juice.shake(0.3)
      g.banner = { text: `¡NIVEL ${g.level}!`, sub: '¡SUPERADO!', color: '#ffd23f', t: CLEAR_T }
      sFanfare()
      buzz([30, 30, 30, 30, 80])
      setScore(g.score)
    }

    /** Siguiente nivel: la torre nueva empieza justo donde está la pelota. */
    const nextLevel = () => {
      g.level += 1
      saveLevel(g.level)
      setReached(loadLevel())
      setLevel(g.level)
      const base = g.ballY - BALL_REST_DY
      g.plats = buildLevel(g.level, base)
      g.idx = 0
      g.ballY = base + BALL_REST_DY
      g.vy = BOUNCE_V
      g.squash = 1
      g.fall = 0
      g.fire = false
      g.shards = []
      g.banner = null
      g.phase = 'playing'
    }

    /** Física de la caída y resolución de cada piso que cruza la pelota. */
    const physics = (dt: number) => {
      for (const pl of g.plats) {
        if (pl.rate !== 0) pl.spin = (pl.spin + pl.rate * dt) % TAU
      }
      g.vy = Math.min(g.vy + GRAVITY * dt, TERMINAL)
      g.ballY += g.vy * dt
      while (g.vy > 0 && g.idx < g.plats.length && g.phase === 'playing') {
        const pl = g.plats[g.idx]
        const line = pl.y + BALL_REST_DY
        if (g.ballY < line) break
        const kind: SegKind = pl.broken ? 'gap' : pl.segs[segmentUnderBall(g.rot, pl.spin)]
        if (kind === 'finish') {
          landFinish(line)
          return
        }
        if (kind === 'gap') {
          passPlat(pl)
          g.idx++
          continue
        }
        if (g.fire) {
          if (kind === 'metal') {
            bounce(pl, line)
            return
          }
          smashPlat(pl)
          g.idx++
          continue
        }
        if (kind === 'danger') {
          die()
          return
        }
        bounce(pl, line)
        return
      }
    }

    // ---------- control: arrastre, teclas e inercia ----------
    const spinInput = (dt: number) => {
      const pressed = pressedRef.current
      const k = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0)
      if (g.dragging) {
        g.omega = clamp((g.rot - g.rotPrev) / Math.max(dt, 0.001), -14, 14)
      } else if (k !== 0) {
        // → mueve los pisos hacia la derecha, igual que arrastrar a la derecha
        g.rot -= k * KEY_SPIN * dt
        g.omega = 0
      } else {
        g.rot += g.omega * dt
        g.omega *= Math.pow(INERTIA, dt * 60)
        if (Math.abs(g.omega) < 0.02) g.omega = 0
      }
      g.rotPrev = g.rot
    }

    /** Cámara: sigue a la pelota solo hacia abajo y empuja los efectos con ella. */
    const camera = (dt: number) => {
      const target = g.ballY - H * CAM_AHEAD
      if (target <= g.camY) return
      const prev = g.camY
      g.camY += (target - g.camY) * (1 - Math.exp(-dt * CAM_EASE))
      const d = g.camY - prev
      for (const p of juice.particles) p.y -= d
      for (const t of juice.texts) t.y -= d
    }

    /** Animaciones que no dependen de la física (se siguen moviendo en pausas breves). */
    const stepVisuals = (dt: number) => {
      for (const pl of g.plats) {
        if (pl.flash > 0) pl.flash = Math.max(0, pl.flash - dt * 4)
        for (const s of pl.splats) if (s.grow < 1) s.grow = Math.min(1, s.grow + dt * 8.3)
      }
      g.squash = Math.max(0, g.squash - dt * 6.7)
      g.fireAmt += ((g.fire ? 1 : 0) - g.fireAmt) * Math.min(1, dt * 10)
      for (const sh of g.shards) {
        sh.life -= dt
        sh.dx += sh.vx * dt
        sh.wy += sh.vy * dt
        sh.vy += SHARD_GRAVITY * dt
        sh.rot += sh.rv * dt
        sh.vx *= Math.max(0, 1 - dt * 1.2)
      }
      if (g.shards.some((s) => s.life <= 0)) g.shards = g.shards.filter((s) => s.life > 0)
      if (g.praise) {
        g.praise.t -= dt
        if (g.praise.t <= 0) g.praise = null
      }
    }

    // ---------- bucle lógico ----------
    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const wantAct = jp.has('action')
      const wantPause = jp.has('pause')
      keyQueueRef.current.length = 0

      if (g.phase === 'playing' && wantPause) togglePause()
      if (g.paused) {
        if (wantAct) {
          g.paused = false
          sPause()
        }
        return
      }

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (g.phase === 'menu') {
        // demostración: la pelota rebota sola sobre el primer piso
        g.rot += MENU_SPIN * rawDt
        const ph = (g.t * 1.3) % 1
        g.ballY = BASE_Y + BALL_REST_DY - 4 * ph * (1 - ph) * BOUNCE_H
        g.squash = Math.max(0, 1 - Math.min(ph, 1 - ph) / 0.08)
        if (wantAct) startRun(g.level)
        else stepVisuals(rawDt)
        return
      }

      if (g.phase === 'over') {
        g.overT += rawDt
        if (wantAct && g.overT > 0.3) startRun(g.level)
        stepVisuals(rawDt)
        return
      }

      if (g.phase === 'dying') {
        g.deadT += rawDt
        spinInput(rawDt)
        stepVisuals(rawDt)
        if (g.deadT >= DEATH_T) {
          g.phase = 'over'
          g.overT = 0
          setUi('over')
        }
        return
      }

      if (g.phase === 'clear') {
        g.clearT += rawDt
        spinInput(rawDt)
        if (dt > 0) {
          // la pelota sigue botando sobre la meta mientras dura el festejo
          g.vy = Math.min(g.vy + GRAVITY * dt, TERMINAL)
          g.ballY += g.vy * dt
          const finLine = g.plats[g.plats.length - 1].y + BALL_REST_DY
          if (g.ballY >= finLine) {
            g.ballY = finLine
            g.vy = BOUNCE_V
            g.squash = 1
          }
        }
        camera(rawDt)
        stepVisuals(rawDt)
        if (g.clearT >= CLEAR_T) nextLevel()
        return
      }

      // jugando
      spinInput(rawDt)
      if (dt > 0) physics(dt)
      if (g.phase === 'playing' && g.fireAmt > 0.3 && Math.random() < 0.85) {
        juice.burst(W / 2 + (Math.random() - 0.5) * 12, ballSY() + 6, ['#ffd23f', '#ff8a00', '#ff3d00'], {
          count: 1,
          speed: 60,
          spread: 0.5,
          angle: -Math.PI / 2,
          arc: 1.2,
          life: 0.35,
          size: 4,
          gravity: -40,
        })
      }
      camera(rawDt)
      stepVisuals(rawDt)
    }

    // ---------- dibujo ----------
    const draw = () => {
      const theme = themeFor(g.level)
      const cx = W / 2
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      juice.applyShake(ctx)
      drawBackground(ctx, W, H, theme, g.t, g.camY)

      // mitades traseras (de la más baja a la más alta) y luego el eje
      for (let i = g.plats.length - 1; i >= 0; i--) {
        if (placeView(g.plats[i])) drawPlatform(ctx, cx, view, g.rot, theme, 'back', g.t)
      }
      drawPole(ctx, cx, -10, H + 10, theme, g.rot)
      for (let i = g.plats.length - 1; i >= 0; i--) {
        if (placeView(g.plats[i])) drawPlatform(ctx, cx, view, g.rot, theme, 'front', g.t)
      }

      for (const sh of g.shards) {
        drawShard(ctx, {
          x: cx + sh.dx,
          y: sh.wy - g.camY,
          rot: sh.rot,
          s: Math.min(1, sh.life / 0.4),
          color: sh.color,
          side: sh.side,
        })
      }

      if (g.phase !== 'dying' && g.phase !== 'over') {
        drawBall(ctx, cx, ballSY(), skinRef.current, g.squash, g.fireAmt, g.vy, g.t)
      }
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      if (g.praise) {
        drawBigText(ctx, g.praise.text, cx, H * 0.34, 22, g.praise.color, pf, Math.min(1, g.praise.t / 0.8))
      }
      ctx.restore()

      // interfaz (sin temblor)
      if (g.phase === 'playing' || g.phase === 'clear' || g.phase === 'dying') {
        const frac = Math.min(1, g.idx / Math.max(1, g.plats.length - 1))
        drawProgress(ctx, W, 26, g.level, frac, theme, pf)
        drawBigText(ctx, String(g.score), cx, 70, 26, '#ffffff', pf)
      }
      if (g.banner) {
        const a = Math.min(1, g.banner.t * 2)
        drawBigText(ctx, g.banner.text, cx, H * 0.46, 22, g.banner.color, pf, a)
        drawBigText(ctx, g.banner.sub, cx, H * 0.46 + 30, 11, '#ffffff', pf, a)
      }

      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(12,8,24,0.62)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `24px ${pf}`
        ctx.fillStyle = ACCENT
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.font = `9px ${pf}`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillText('Toca o pulsa P para seguir', W / 2, H / 2 + 24)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- entrada ----------
    const toLogicalDx = (dxPx: number) => {
      const canvasRect = canvas.getBoundingClientRect()
      return canvasRect.width > 0 ? (dxPx / canvasRect.width) * W : 0
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        sPause()
        return
      }
      if (g.phase !== 'playing' && g.phase !== 'clear' && g.phase !== 'dying') return
      canvas.setPointerCapture(e.pointerId)
      g.dragging = true
      lastX = e.clientX
      g.rotPrev = g.rot
      g.omega = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!g.dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      // la superficie sigue al dedo: arrastrar a la derecha mueve los pisos a la derecha
      g.rot -= toLogicalDx(dx) * DRAG_K
    }
    const onUp = (e: PointerEvent) => {
      g.dragging = false
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onBlur = () => {
      g.dragging = false
      if (g.phase === 'playing') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** La torre conserva su tamaño; solo cambia el ancho y el alto del mundo. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layout()
      if (W === oldW && H === oldH) return
      setupCanvas(canvas, W, H)
      g.dragging = false
      // pausa del propio juego (la misma que al perder el foco)
      if (g.phase === 'playing') g.paused = true
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const rawDt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      update(rawDt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef, pressedRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#8a63ff]/40 bg-[#0c0818] shadow-[0_0_30px_rgba(138,99,255,0.22)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>NIVEL {level}</span>
            <span className="text-white/60">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Torre Espiral"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="TORRE ESPIRAL"
            accent={ACCENT}
            subtitle={`Nivel ${level}. Gira la torre para que la pelotita caiga por los huecos. ¡No toques lo rojo!`}
            hint="Arrastra o usa ← → para girar · Espacio para empezar"
            touchHint="Arrastra el dedo para girar la torre"
            onStart={() => startRef.current()}
          >
            <SkinPicker selected={skin} reached={reached} onPick={pickSkin} />
          </StartOverlay>
        )}
        {ui === 'over' && (
          <GameOverOverlay
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Nivel', value: result.level },
              { label: 'Pisos rotos', value: result.broken },
              { label: 'Mejor caída', value: result.maxFall },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
    </div>
  )
}
