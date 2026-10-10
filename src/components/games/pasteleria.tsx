'use client'

import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { publishLogical } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

/*
 * Pastelería en Pareja, estilo Cooking Mama: cada pastel pasa por cuatro retos
 * cortos con gestos (batir en círculos, sacar del horno a tiempo, decorar con
 * crema trazando y poner frutas tocando). En pareja se turnan los pasos.
 */

const W = 360
const H = 640
const ACCENT = '#f472b6'
const INK = '#5b2a3a'
const P_COLOR = ['#f472b6', '#60a5fa']
const CAKES = 3
const SAVE_KEY = 'arcade-pasteleria-v1'

type Step = 'batir' | 'hornear' | 'crema' | 'decorar'
const STEPS: Step[] = ['batir', 'hornear', 'crema', 'decorar']
const STEP_NAME: Record<Step, string> = { batir: '¡BATE!', hornear: '¡AL HORNO!', crema: '¡CREMA!', decorar: '¡DECORA!' }
const STEP_HELP: Record<Step, string> = {
  batir: 'Gira el dedo en círculos dentro del tazón',
  hornear: 'Toca cuando la aguja esté en lo verde',
  crema: 'Pasa el dedo por los puntitos',
  decorar: 'Toca los brillitos antes de que se apaguen',
}
const STEP_DUR: Record<Step, number> = { batir: 6, hornear: 6, crema: 6.5, decorar: 6 }

type Animal = 'gato' | 'conejo' | 'oso'
type Topping = 'fresa' | 'cereza' | 'chispas' | 'corazon'
interface Order {
  animal: Animal
  fur: string
  sponge: string
  frost: string
  top: Topping
}

const FURS = ['#fbcfe8', '#fde68a', '#c4b5fd', '#fed7aa', '#e5e7eb']
const SPONGES = ['#fde68a', '#b77b4b', '#f9a8d4']
const FROSTS = ['#ffffff', '#f9a8d4', '#c4b5fd', '#a7f3d0', '#fde68a']
const TOPS: Topping[] = ['fresa', 'cereza', 'chispas', 'corazon']
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

interface Dot {
  x: number
  y: number
  hit: boolean
}
interface Spark {
  x: number
  y: number
  age: number
  life: number
}

interface G {
  phase: 'menu' | 'intro' | 'step' | 'result' | 'over'
  duo: boolean
  cake: number
  step: number
  t: number // tiempo restante del paso o de la pantalla actual
  order: Order
  scores: number[] // del pastel en curso
  cakeScores: number[]
  coins: number
  // batir
  mix: number
  ang: number | null
  swirl: number
  // hornear
  needle: number
  nDir: number
  zone: number
  tapped: number | null
  // crema
  dots: Dot[]
  blobs: { x: number; y: number }[]
  // decorar
  sparks: Spark[]
  spawnT: number
  placed: { x: number; y: number }[]
  hits: number
  misses: number
  // puntero
  down: boolean
  px: number
  py: number
  lastKey: string
  paused: boolean
  grade: string
}

function newOrder(): Order {
  return { animal: pick(['gato', 'conejo', 'oso']), fur: pick(FURS), sponge: pick(SPONGES), frost: pick(FROSTS), top: pick(TOPS) }
}

function freshGame(duo: boolean): G {
  return {
    phase: 'intro',
    duo,
    cake: 0,
    step: 0,
    t: 1.4,
    order: newOrder(),
    scores: [],
    cakeScores: [],
    coins: 0,
    mix: 0,
    ang: null,
    swirl: 0,
    needle: 0,
    nDir: 1,
    zone: 0.65,
    tapped: null,
    dots: [],
    blobs: [],
    sparks: [],
    spawnT: 0,
    placed: [],
    hits: 0,
    misses: 0,
    down: false,
    px: 0,
    py: 0,
    lastKey: '',
    paused: false,
    grade: '',
  }
}

// Geometría compartida
const CAKE_X = W / 2
const CAKE_Y = 430 // base del pastel
const CAKE_W = 220
const CAKE_H = 96
const TOP_Y = CAKE_Y - CAKE_H // borde superior
const BOWL = { x: W / 2, y: 390, r: 115 }

function loadBest(): number {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as { best?: unknown } | null
    return v && typeof v.best === 'number' ? v.best : 0
  } catch {
    return 0
  }
}
function saveBest(best: number) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ best }))
  } catch {
    // sin almacenamiento
  }
}

function sfx(name: string) {
  switch (name) {
    case 'swish':
      noise({ dur: 0.05, vol: 0.02, freq: 2400 })
      break
    case 'go':
      ;[659, 880].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.05, delay: i * 0.08 }))
      break
    case 'pop':
      tone({ freq: 520, to: 980, dur: 0.07, type: 'sine', vol: 0.06 })
      break
    case 'miss':
      tone({ freq: 300, to: 200, dur: 0.1, type: 'triangle', vol: 0.04 })
      break
    case 'ding':
      ;[1047, 1319, 1568].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.05, delay: i * 0.06 }))
      break
    case 'perfect':
      ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', vol: 0.04, delay: i * 0.07 }))
      break
    case 'meh':
      ;[440, 392, 330].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.05, delay: i * 0.1 }))
      break
  }
}

// ---------- dibujo ----------
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function face(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mood: 'happy' | 'wow' | 'calm' | 'sad', t: number) {
  const blink = Math.sin(t * 1.7 + x) > 0.985
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.lineWidth = 2 * s
  for (const dx of [-1, 1]) {
    if (mood === 'happy' || blink) {
      ctx.beginPath()
      ctx.arc(x + dx * 9 * s, y, 4 * s, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x + dx * 9 * s, y, (mood === 'wow' ? 4.2 : 3.4) * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x + dx * 9 * s + 1.2 * s, y - 1.2 * s, 1.3 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
    }
  }
  ctx.beginPath()
  if (mood === 'wow') ctx.ellipse(x, y + 8 * s, 3.5 * s, 4.5 * s, 0, 0, Math.PI * 2)
  else if (mood === 'sad') ctx.arc(x, y + 11 * s, 4 * s, Math.PI * 1.15, Math.PI * 1.85)
  else ctx.arc(x, y + 5 * s, 4.5 * s, 0.15 * Math.PI, 0.85 * Math.PI)
  if (mood === 'wow') ctx.fill()
  else ctx.stroke()
  ctx.fillStyle = 'rgba(244,114,182,0.5)'
  ctx.beginPath()
  ctx.ellipse(x - 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawAnimal(ctx: CanvasRenderingContext2D, o: Order, x: number, y: number, s: number, mood: 'happy' | 'wow' | 'calm' | 'sad', t: number) {
  ctx.save()
  ctx.lineWidth = 2.5 * s
  ctx.strokeStyle = INK
  ctx.fillStyle = o.fur
  if (o.animal === 'conejo') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + dx * 14 * s, y - 42 * s, 9 * s, 26 * s, dx * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  } else if (o.animal === 'gato') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + dx * 32 * s, y - 8 * s)
      ctx.lineTo(x + dx * 26 * s, y - 42 * s)
      ctx.lineTo(x + dx * 6 * s, y - 28 * s)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + dx * 26 * s, y - 26 * s, 12 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.beginPath()
  ctx.ellipse(x, y, 38 * s, 34 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  face(ctx, x, y - 2 * s, s, mood, t)
  ctx.restore()
}

function drawTopping(ctx: CanvasRenderingContext2D, top: Topping, x: number, y: number, s: number, seed: number) {
  ctx.save()
  ctx.lineWidth = 1.5 * s
  ctx.strokeStyle = INK
  if (top === 'fresa') {
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(x - 8 * s, y - 4 * s)
    ctx.quadraticCurveTo(x - 8 * s, y + 9 * s, x, y + 11 * s)
    ctx.quadraticCurveTo(x + 8 * s, y + 9 * s, x + 8 * s, y - 4 * s)
    ctx.quadraticCurveTo(x, y - 9 * s, x - 8 * s, y - 4 * s)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.ellipse(x, y - 6 * s, 6 * s, 2.5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fde68a'
    ctx.fillRect(x - 3 * s, y, 1.5 * s, 1.5 * s)
    ctx.fillRect(x + 2 * s, y + 3 * s, 1.5 * s, 1.5 * s)
  } else if (top === 'cereza') {
    ctx.strokeStyle = '#65a30d'
    ctx.beginPath()
    ctx.moveTo(x, y - 4 * s)
    ctx.quadraticCurveTo(x + 2 * s, y - 14 * s, x + 7 * s, y - 16 * s)
    ctx.stroke()
    ctx.strokeStyle = INK
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.arc(x, y, 7 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(x - 2.5 * s, y - 2.5 * s, 2 * s, 0, Math.PI * 2)
    ctx.fill()
  } else if (top === 'chispas') {
    const cols = ['#f472b6', '#60a5fa', '#facc15', '#4ade80', '#c084fc']
    for (let i = 0; i < 6; i++) {
      const a = seed * 7 + i * 1.7
      ctx.save()
      ctx.translate(x + Math.cos(a) * 9 * s, y + Math.sin(a * 1.3) * 6 * s)
      ctx.rotate(a)
      ctx.fillStyle = cols[i % cols.length]
      rr(ctx, -4 * s, -1.3 * s, 8 * s, 2.6 * s, 1.3 * s)
      ctx.fill()
      ctx.restore()
    }
  } else {
    ctx.fillStyle = '#fb7185'
    ctx.beginPath()
    ctx.moveTo(x, y + 8 * s)
    ctx.bezierCurveTo(x - 12 * s, y - 2 * s, x - 6 * s, y - 11 * s, x, y - 4 * s)
    ctx.bezierCurveTo(x + 6 * s, y - 11 * s, x + 12 * s, y - 2 * s, x, y + 8 * s)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Pastel: base, bizcocho, crema (lo que se haya puesto) y adornos. */
function drawCake(ctx: CanvasRenderingContext2D, g: G, rise: number, frostAll: boolean) {
  const o = g.order
  const h = CAKE_H * rise
  // plato
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(CAKE_X, CAKE_Y + 6, CAKE_W / 2 + 26, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // bizcocho con dos capas
  ctx.fillStyle = o.sponge
  rr(ctx, CAKE_X - CAKE_W / 2, CAKE_Y - h, CAKE_W, h, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = o.frost
  ctx.fillRect(CAKE_X - CAKE_W / 2 + 2, CAKE_Y - h * 0.52, CAKE_W - 4, 8)
  // carita del pastel
  face(ctx, CAKE_X, CAKE_Y - h * 0.28, 1.1, g.phase === 'result' ? 'happy' : 'calm', performance.now() / 1000)
  // crema: completa o por gotas
  if (frostAll) {
    ctx.fillStyle = o.frost
    ctx.beginPath()
    ctx.moveTo(CAKE_X - CAKE_W / 2, CAKE_Y - h + 8)
    for (let i = 0; i <= 10; i++) {
      const x = CAKE_X - CAKE_W / 2 + (CAKE_W * i) / 10
      ctx.quadraticCurveTo(x - CAKE_W / 20, CAKE_Y - h + 26 + (i % 2) * 6, x, CAKE_Y - h + 12)
    }
    ctx.lineTo(CAKE_X + CAKE_W / 2, CAKE_Y - h - 6)
    ctx.lineTo(CAKE_X - CAKE_W / 2, CAKE_Y - h - 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  for (const b of g.blobs) {
    ctx.fillStyle = o.frost
    ctx.beginPath()
    ctx.arc(b.x, b.y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(b.x - 3, b.y - 4, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  g.placed.forEach((p, i) => drawTopping(ctx, o.top, p.x, p.y, 1.3, i))
}

function drawKitchen(ctx: CanvasRenderingContext2D, t: number) {
  // pared rosa con azulejos
  ctx.fillStyle = '#ffe4ef'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(244,114,182,0.18)'
  ctx.lineWidth = 1
  for (let y = 160; y < 520; y += 28) {
    for (let x = (y / 28) % 2 ? 0 : -14; x < W; x += 28) {
      ctx.strokeRect(x + 0.5, y + 0.5, 28, 28)
    }
  }
  // ventanita del cliente
  ctx.fillStyle = '#bae6fd'
  rr(ctx, 14, 14, W - 28, 132, 22)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 2; i++) {
    const cx = ((i * 0.55 + t * 0.01) % 1.2) * W
    ctx.beginPath()
    ctx.arc(cx, 40 + i * 18, 12, 0, Math.PI * 2)
    ctx.arc(cx + 14, 34 + i * 18, 15, 0, Math.PI * 2)
    ctx.arc(cx + 28, 40 + i * 18, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  // toldo de rayas
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#f472b6'
    ctx.beginPath()
    const x = 14 + (i * (W - 28)) / 9
    const w = (W - 28) / 9
    ctx.moveTo(x, 14)
    ctx.lineTo(x + w, 14)
    ctx.lineTo(x + w, 26)
    ctx.arc(x + w / 2, 26, w / 2, 0, Math.PI)
    ctx.closePath()
    ctx.fill()
  }
  // mostrador de madera
  ctx.fillStyle = '#e8b98a'
  ctx.fillRect(0, 520, W, H - 520)
  ctx.fillStyle = '#d39a68'
  ctx.fillRect(0, 520, W, 10)
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 520)
  ctx.lineTo(W, 520)
  ctx.stroke()
}

function bubble(ctx: CanvasRenderingContext2D, g: G, x: number, y: number) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  rr(ctx, x, y, 150, 92, 18)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 4, y + 50)
  ctx.lineTo(x - 14, y + 62)
  ctx.lineTo(x + 6, y + 64)
  ctx.fill()
  // mini pastel del pedido
  const cx = x + 75
  const by = y + 70
  ctx.fillStyle = g.order.sponge
  rr(ctx, cx - 40, by - 34, 80, 34, 9)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = g.order.frost
  rr(ctx, cx - 42, by - 42, 84, 16, 8)
  ctx.fill()
  ctx.stroke()
  for (let i = 0; i < 3; i++) drawTopping(ctx, g.order.top, cx - 24 + i * 24, by - 46, 0.75, i)
}

// ---------- componente ----------
interface Ui {
  phase: G['phase']
  cake: number
  coins: number
  best: number
  stars: number
  avg: number
}

export default function Pasteleria() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<(duo: boolean) => void>(() => {})
  const [duo, setDuo] = useState(true)
  const [ui, setUi] = useState<Ui>({ phase: 'menu', cake: 0, coins: 0, best: 0, stars: 0, avg: 0 })

  useEffect(() => {
    publishLogical({ w: W, h: H })
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, W, H)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    const juice = new Juice()
    let g: G = freshGame(true)
    g.phase = 'menu'
    let best = loadBest()
    setUi((u) => ({ ...u, best }))
    let raf = 0
    let last = performance.now()
    let t = 0

    const sync = () => setUi({ phase: g.phase, cake: g.cake, coins: g.coins, best, stars: 0, avg: 0 })

    const stepNow = (): Step => STEPS[g.step]
    const player = () => (g.duo ? g.step % 2 : 0)

    const beginStep = () => {
      const s = stepNow()
      g.phase = 'step'
      g.t = STEP_DUR[s] - Math.min(1.2, g.cake * 0.4)
      if (s === 'batir') {
        g.mix = 0
        g.ang = null
      } else if (s === 'hornear') {
        g.needle = 0
        g.nDir = 1
        g.zone = 0.55 + Math.random() * 0.25
        g.tapped = null
      } else if (s === 'crema') {
        g.dots = []
        const n = 13
        for (let i = 0; i < n; i++) {
          const x = CAKE_X - CAKE_W / 2 + 14 + ((CAKE_W - 28) * i) / (n - 1)
          g.dots.push({ x, y: TOP_Y + 4 + Math.sin(i * 0.9 + g.cake) * 12, hit: false })
        }
        g.blobs = []
      } else {
        g.sparks = []
        g.spawnT = 0.2
        g.placed = []
        g.hits = 0
        g.misses = 0
      }
      sfx('go')
    }

    const endStep = (score: number) => {
      score = Math.round(clamp(score, 0, 100))
      g.scores.push(score)
      const msg = score >= 90 ? '¡PERFECTO!' : score >= 70 ? '¡MUY BIEN!' : score >= 45 ? '¡BIEN!' : 'UPS...'
      const col = score >= 90 ? '#facc15' : score >= 70 ? '#f472b6' : score >= 45 ? '#60a5fa' : '#a78bfa'
      juice.text(W / 2, 250, msg, col, 18, 1.1)
      if (score >= 90) {
        juice.burst(W / 2, 300, ['#facc15', '#f472b6', '#ffffff', '#60a5fa'], { count: 30, speed: 220, life: 0.8, size: 5 })
        juice.shake(0.25)
        sfx('ding')
      } else if (score < 45) sfx('meh')
      else sfx('pop')
      if (g.step < STEPS.length - 1) {
        g.step++
        g.phase = 'intro'
        g.t = 1.3
      } else {
        const avg = g.scores.reduce((a, b) => a + b, 0) / g.scores.length
        g.cakeScores.push(avg)
        const earn = Math.round(avg / 2) + (avg >= 90 ? 30 : 0)
        g.coins += earn
        g.grade = avg >= 90 ? '¡PASTEL PERFECTO!' : avg >= 70 ? '¡QUÉ RICO!' : avg >= 45 ? '¡ESTÁ BONITO!' : 'SE VE... ÚNICO'
        g.phase = 'result'
        g.t = 2.6
        juice.text(W / 2, 200, `+${earn}`, '#facc15', 16, 1.4)
        juice.burst(W / 2, 330, ['#f472b6', '#fde68a', '#a7f3d0', '#c4b5fd', '#ffffff'], { count: 50, speed: 260, life: 1.1, size: 6 })
        juice.flash('#ffffff', 0.4)
        sfx(avg >= 70 ? 'perfect' : 'pop')
      }
      sync()
    }

    const nextCakeOrOver = () => {
      g.cake++
      if (g.cake >= CAKES) {
        g.phase = 'over'
        const avg = g.cakeScores.reduce((a, b) => a + b, 0) / g.cakeScores.length
        const stars = avg >= 85 ? 3 : avg >= 65 ? 2 : avg >= 40 ? 1 : 0
        if (g.coins > best) {
          best = g.coins
          saveBest(best)
        }
        setUi({ phase: 'over', cake: g.cake, coins: g.coins, best, stars, avg: Math.round(avg) })
        return
      }
      g.order = newOrder()
      g.step = 0
      g.scores = []
      g.blobs = []
      g.placed = []
      g.phase = 'intro'
      g.t = 1.4
      sync()
    }

    startRef.current = (d: boolean) => {
      g = freshGame(d)
      juice.reset()
      sync()
    }

    // ---- entrada ----
    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    }

    const addMix = (rad: number) => {
      const before = Math.floor(g.mix * 10)
      g.mix += rad / (Math.PI * 2 * (7 + g.cake))
      g.swirl += rad
      if (Math.floor(g.mix * 10) > before) sfx('swish')
      if (g.mix >= 1) {
        g.mix = 1
        endStep(65 + 35 * clamp(g.t / 3, 0, 1))
      }
    }

    const tapAt = (x: number, y: number) => {
      if (g.phase !== 'step') return
      const s = stepNow()
      if (s === 'hornear' && g.tapped === null) {
        g.tapped = g.needle
        const d = Math.abs(g.needle - g.zone)
        const score = d < 0.08 ? 100 - (d / 0.08) * 25 : Math.max(5, 70 - (d - 0.08) * 400)
        juice.burst(W / 2, 330, ['#fde68a', '#fb923c'], { count: 16, speed: 140, life: 0.5, size: 4 })
        endStep(score)
      } else if (s === 'decorar') {
        let hit = false
        for (const sp of g.sparks) {
          if (Math.hypot(sp.x - x, sp.y - y) < 30) {
            sp.age = sp.life + 1
            g.placed.push({ x: sp.x, y: sp.y })
            g.hits++
            hit = true
            juice.burst(sp.x, sp.y, ['#fde047', '#ffffff', '#f472b6'], { count: 10, speed: 110, life: 0.4, size: 3 })
            sfx('pop')
            break
          }
        }
        if (!hit) {
          g.misses++
          sfx('miss')
        }
      }
    }

    const moveAt = (x: number, y: number) => {
      if (g.phase !== 'step') return
      const s = stepNow()
      if (s === 'batir') {
        const a = Math.atan2(y - (BOWL.y - 30), x - BOWL.x)
        if (g.ang !== null && Math.hypot(x - BOWL.x, y - (BOWL.y - 30)) > 18) {
          let d = a - g.ang
          if (d > Math.PI) d -= Math.PI * 2
          if (d < -Math.PI) d += Math.PI * 2
          addMix(Math.abs(d))
        }
        g.ang = a
      } else if (s === 'crema') {
        for (const d of g.dots) {
          if (!d.hit && Math.hypot(d.x - x, d.y - y) < 24) {
            d.hit = true
            g.blobs.push({ x: d.x, y: d.y })
            sfx('swish')
          }
        }
        if (g.dots.length > 0 && g.dots.every((d) => d.hit)) endStep(70 + 30 * clamp(g.t / 3, 0, 1))
      }
    }

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      const p = toLocal(e)
      g.down = true
      g.px = p.x
      g.py = p.y
      g.ang = null
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      tapAt(p.x, p.y)
      moveAt(p.x, p.y)
    }
    const onMove = (e: PointerEvent) => {
      if (!g.down) return
      const p = toLocal(e)
      g.px = p.x
      g.py = p.y
      moveAt(p.x, p.y)
    }
    const onUp = () => {
      g.down = false
      g.ang = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (g.phase === 'menu' || g.phase === 'over') return
      if (e.code === 'KeyP') {
        g.paused = !g.paused
        return
      }
      if (g.phase !== 'step') return
      const s = stepNow()
      if (s === 'batir' && e.code.startsWith('Arrow') && e.code !== g.lastKey) {
        g.lastKey = e.code
        addMix(1.1)
        e.preventDefault()
      } else if (e.code === 'Space') {
        e.preventDefault()
        if (s === 'hornear') tapAt(0, 0)
        else if (s === 'decorar') {
          const sp = g.sparks.find((q) => q.age < q.life)
          if (sp) tapAt(sp.x, sp.y)
        } else if (s === 'crema') {
          const d = g.dots.find((q) => !q.hit)
          if (d) moveAt(d.x, d.y)
        }
      }
    }
    const pauseNow = () => {
      if (g.phase !== 'menu' && g.phase !== 'over') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) pauseNow()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', pauseNow)
    document.addEventListener('visibilitychange', onVis)

    // ---- bucle ----
    const update = (dt: number) => {
      if (g.paused || g.phase === 'menu' || g.phase === 'over') return
      g.t -= dt
      if (g.phase === 'intro') {
        if (g.t <= 0) beginStep()
        return
      }
      if (g.phase === 'result') {
        if (g.t <= 0) nextCakeOrOver()
        return
      }
      const s = stepNow()
      if (s === 'hornear' && g.tapped === null) {
        const speed = 0.55 + g.cake * 0.18
        g.needle += g.nDir * speed * dt
        if (g.needle > 1) {
          g.needle = 1
          g.nDir = -1
        } else if (g.needle < 0) {
          g.needle = 0
          g.nDir = 1
        }
      }
      if (s === 'decorar') {
        g.spawnT -= dt
        if (g.spawnT <= 0) {
          g.spawnT = 0.5 - g.cake * 0.06
          g.sparks.push({
            x: CAKE_X - CAKE_W / 2 + 24 + Math.random() * (CAKE_W - 48),
            y: TOP_Y - 4 + Math.random() * 44,
            age: 0,
            life: 1.3 - g.cake * 0.15,
          })
        }
        for (const sp of g.sparks) {
          sp.age += dt
          if (sp.age > sp.life && sp.age < sp.life + 0.5) {
            sp.age = sp.life + 1
            g.misses++
          }
        }
        g.sparks = g.sparks.filter((sp) => sp.age <= sp.life)
      }
      if (g.phase === 'step' && g.t <= 0) {
        g.t = 0
        if (s === 'batir') endStep(g.mix * 60)
        else if (s === 'hornear') endStep(10)
        else if (s === 'crema') endStep((g.dots.filter((d) => d.hit).length / g.dots.length) * 75)
        else endStep(g.hits === 0 ? 0 : (g.hits / (g.hits + g.misses)) * 100 * Math.min(1, g.hits / 6))
      }
    }

    const meter = (frac: number, col: string) => {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.5
      rr(ctx, 40, 540, W - 80, 22, 11)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = col
      rr(ctx, 43, 543, Math.max(1, (W - 86) * clamp(frac, 0, 1)), 16, 8)
      ctx.fill()
    }

    const drawStep = () => {
      const s = stepNow()
      if (s === 'batir') {
        // tazón kawaii con masa que gira
        ctx.save()
        ctx.lineWidth = 3
        ctx.strokeStyle = INK
        ctx.fillStyle = '#bfdbfe'
        ctx.beginPath()
        ctx.arc(BOWL.x, BOWL.y - 30, BOWL.r, 0, Math.PI)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = g.mix < 0.5 ? '#fef3c7' : g.order.sponge
        ctx.beginPath()
        ctx.ellipse(BOWL.x, BOWL.y - 30, BOWL.r - 8, 34, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = 'rgba(91,42,58,0.35)'
        ctx.lineWidth = 3
        for (let k = 0; k < 3; k++) {
          ctx.beginPath()
          ctx.ellipse(BOWL.x, BOWL.y - 30, 25 + k * 25, 8 + k * 8, 0, g.swirl + k, g.swirl + k + 2.2)
          ctx.stroke()
        }
        face(ctx, BOWL.x, BOWL.y + 30, 1.4, g.mix > 0.7 ? 'happy' : 'wow', t)
        if (g.phase === 'step') {
          ctx.setLineDash([6, 8])
          ctx.strokeStyle = 'rgba(244,114,182,0.6)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.ellipse(BOWL.x, BOWL.y - 30, 85, 30, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
          const a = t * 4
          ctx.fillStyle = '#f472b6'
          ctx.beginPath()
          ctx.arc(BOWL.x + Math.cos(a) * 85, BOWL.y - 30 + Math.sin(a) * 30, 7, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
        meter(g.mix, '#f472b6')
      } else if (s === 'hornear') {
        // horno con ventanita donde sube el pastel
        ctx.save()
        ctx.lineWidth = 3
        ctx.strokeStyle = INK
        ctx.fillStyle = '#fca5a5'
        rr(ctx, 50, 190, W - 100, 300, 26)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#7c2d12'
        rr(ctx, 80, 250, W - 160, 170, 18)
        ctx.fill()
        ctx.stroke()
        const glow = ctx.createRadialGradient(W / 2, 400, 10, W / 2, 400, 140)
        glow.addColorStop(0, `rgba(251,146,60,${0.4 + g.needle * 0.5})`)
        glow.addColorStop(1, 'rgba(251,146,60,0)')
        ctx.fillStyle = glow
        ctx.fillRect(80, 250, W - 160, 170)
        const rise = 0.35 + g.needle * 0.65
        ctx.fillStyle = g.needle > g.zone + 0.12 ? '#78350f' : g.order.sponge
        rr(ctx, W / 2 - 60, 405 - 70 * rise, 120, 70 * rise, 14)
        ctx.fill()
        ctx.stroke()
        for (const dx of [-60, 0, 60]) {
          ctx.fillStyle = '#fde68a'
          ctx.beginPath()
          ctx.arc(W / 2 + dx, 220, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
        face(ctx, W / 2, 455, 1.2, Math.abs(g.needle - g.zone) < 0.1 ? 'wow' : 'calm', t)
        ctx.restore()
        // termómetro
        const bx = 40
        const bw = W - 80
        const by = 540
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2.5
        rr(ctx, bx, by, bw, 26, 13)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#4ade80'
        rr(ctx, bx + bw * (g.zone - 0.08), by + 3, bw * 0.16, 20, 8)
        ctx.fill()
        ctx.fillStyle = '#facc15'
        ctx.fillRect(bx + bw * g.zone - 2, by + 3, 4, 20)
        const nx = bx + bw * g.needle
        ctx.fillStyle = INK
        ctx.beginPath()
        ctx.moveTo(nx, by - 2)
        ctx.lineTo(nx - 9, by - 16)
        ctx.lineTo(nx + 9, by - 16)
        ctx.closePath()
        ctx.fill()
      } else {
        drawCake(ctx, g, 1, s === 'decorar')
        if (s === 'crema' && g.phase === 'step') {
          const next = g.dots.find((d) => !d.hit)
          for (const d of g.dots) {
            if (d.hit) continue
            ctx.fillStyle = d === next ? '#f472b6' : 'rgba(244,114,182,0.45)'
            ctx.beginPath()
            ctx.arc(d.x, d.y, d === next ? 7 + Math.sin(t * 8) * 1.5 : 5, 0, Math.PI * 2)
            ctx.fill()
          }
          if (g.down) {
            // manga pastelera que sigue al dedo
            ctx.save()
            ctx.translate(g.px, g.py)
            ctx.rotate(-0.5)
            ctx.fillStyle = g.order.frost
            ctx.strokeStyle = INK
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(-16, -44)
            ctx.lineTo(16, -44)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            ctx.restore()
          }
          meter(g.dots.filter((d) => d.hit).length / Math.max(1, g.dots.length), '#a78bfa')
        }
        if (s === 'decorar' && g.phase === 'step') {
          for (const sp of g.sparks) {
            const k = 1 - sp.age / sp.life
            ctx.save()
            ctx.globalAlpha = 0.4 + k * 0.6
            ctx.strokeStyle = '#facc15'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(sp.x, sp.y, 10 + 14 * k, 0, Math.PI * 2)
            ctx.stroke()
            ctx.fillStyle = '#fef08a'
            ctx.beginPath()
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2 + t * 3
              const r = i % 2 ? 4 : 10
              ctx.lineTo(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r)
            }
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
          meter(Math.min(1, g.hits / 8), '#facc15')
        }
      }
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      drawKitchen(ctx, t)
      const lastScore = g.cakeScores[g.cakeScores.length - 1] ?? 0
      const mood = g.phase === 'result' ? (lastScore >= 45 ? 'happy' : 'sad') : g.phase === 'step' && g.t < 2 ? 'wow' : 'calm'
      const hop = g.phase === 'result' ? -Math.abs(Math.sin(t * 9)) * 10 : Math.sin(t * 2) * 2
      drawAnimal(ctx, g.order, 82, 96 + hop, 1, mood, t)
      bubble(ctx, g, 170, 34)
      if (g.phase === 'result') drawCake(ctx, g, 1, true)
      else if (g.phase !== 'menu') drawStep()
      // reloj del paso
      if (g.phase === 'step') {
        const dur = STEP_DUR[stepNow()]
        ctx.fillStyle = 'rgba(91,42,58,0.15)'
        ctx.fillRect(0, 156, W, 6)
        ctx.fillStyle = g.t < 2 ? '#f87171' : '#4ade80'
        ctx.fillRect(0, 156, W * clamp(g.t / dur, 0, 1), 6)
      }
      // pasos del pastel
      for (let i = 0; i < STEPS.length; i++) {
        const x = W / 2 - 54 + i * 36
        const done = i < g.scores.length
        const cur = i === g.step && g.phase !== 'result'
        ctx.fillStyle = done ? (g.scores[i] >= 90 ? '#facc15' : '#f472b6') : cur ? '#ffffff' : 'rgba(255,255,255,0.5)'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, 600, cur ? 11 : 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      // cartel del paso
      if (g.phase === 'intro') {
        const s = stepNow()
        const k = clamp((1.3 - g.t) * 5, 0, 1)
        ctx.save()
        ctx.translate(W / 2, 300)
        ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k)
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = INK
        ctx.lineWidth = 3
        rr(ctx, -150, -60, 300, 120, 24)
        ctx.fill()
        ctx.stroke()
        ctx.font = `20px ${pf}`
        ctx.fillStyle = '#ec4899'
        ctx.fillText(STEP_NAME[s], 0, -14)
        ctx.font = 'bold 13px sans-serif'
        ctx.fillStyle = INK
        ctx.fillText(STEP_HELP[s], 0, 14)
        if (g.duo) {
          const p = player()
          ctx.fillStyle = P_COLOR[p]
          rr(ctx, -60, 28, 120, 22, 11)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.font = `8px ${pf}`
          ctx.fillText(`TURNO J${p + 1}`, 0, 43)
        }
        ctx.restore()
      }
      if (g.phase === 'step' && g.duo) {
        const p = player()
        ctx.fillStyle = P_COLOR[p]
        rr(ctx, W - 76, 612, 64, 20, 10)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `7px ${pf}`
        ctx.fillText(`J${p + 1}`, W - 44, 626)
      }
      if (g.phase === 'result') {
        ctx.font = `15px ${pf}`
        ctx.lineWidth = 5
        ctx.strokeStyle = '#ffffff'
        ctx.strokeText(g.grade, W / 2, 500)
        ctx.fillStyle = '#ec4899'
        ctx.fillText(g.grade, W / 2, 500)
      }
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      if (g.paused) {
        ctx.fillStyle = 'rgba(91,42,58,0.55)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.font = `14px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2)
        ctx.font = `7px ${pf}`
        ctx.fillText('TOCA PARA SEGUIR', W / 2, H / 2 + 24)
      }
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      update(juice.update(dt))
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', pauseNow)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const hud = (
    <Hud>
      <span style={{ color: ACCENT }}>
        PASTEL {Math.min(ui.cake + 1, CAKES)}/{CAKES}
      </span>
      <span style={{ color: '#fde047' }}>MONEDAS {ui.coins}</span>
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-2xl border-2 border-pink-300/50 bg-[#ffe4ef] shadow-[0_0_30px_rgba(244,114,182,0.25)]"
        hud={hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Pastelería en Pareja"
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="PASTELERÍA EN PAREJA"
            accent={ACCENT}
            hint="Pulsa ESPACIO para empezar"
            touchHint="Toca Jugar"
            onStart={() => startRef.current(duo)}
          >
            <p className="max-w-xs text-sm leading-relaxed text-white/80">
              Tres pasteles para animalitos golosos: batir, hornear, poner crema y decorar. En pareja se turnan los
              pasos.
            </p>
            <div className="flex gap-2">
              {[true, false].map((d) => (
                <button
                  key={String(d)}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    setDuo(d)
                  }}
                  className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-black transition active:scale-95"
                  style={{ background: duo === d ? ACCENT : '#fbcfe8' }}
                >
                  {d ? '2 jugadores' : '1 jugador'}
                </button>
              ))}
            </div>
            {ui.best > 0 && <p className="text-xs text-amber-300">Récord: {ui.best} monedas</p>}
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <GameOverOverlay
            title={ui.stars >= 2 ? '¡PASTELEROS ESTRELLA!' : ui.stars === 1 ? '¡BUEN TRABAJO!' : '¡A PRACTICAR!'}
            accent={ACCENT}
            score={ui.coins}
            best={ui.best}
            ranked={false}
            stats={[
              { label: 'Calidad', value: `${ui.avg}%` },
              { label: 'Estrellas', value: <span className="text-amber-300">{'★'.repeat(ui.stars) + '☆'.repeat(3 - ui.stars)}</span> },
            ]}
            onRestart={() => startRef.current(duo)}
            touchHint="o toca Jugar otra vez"
          />
        )}
      </GameScreen>
    </div>
  )
}
