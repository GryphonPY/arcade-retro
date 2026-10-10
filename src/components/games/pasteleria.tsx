'use client'

import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { publishLogical } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

/*
 * Pastelería en Pareja, a lo Good Pizza Great Pizza: cada animalito pide algo
 * vago y gracioso ("¡uno bien rosita!", "sin fruta, soy alérgico") y ustedes
 * arman el pastel con total libertad: sabor, pisos, crema y adornos que se
 * arrastran a donde quieran (dos dedos a la vez: se juega en pareja). El
 * cliente paga según qué tan bien entendieron su pedido y qué tan lindo quedó.
 */

const W = 360
const H = 640
const ACCENT = '#f472b6'
const INK = '#5b2a3a'
const SAVE_KEY = 'arcade-pasteleria-v1'
const PER_DAY = 6

// ---------- ingredientes ----------
type Flavor = 'vainilla' | 'chocolate' | 'fresa'
const FLAVORS: { id: Flavor; color: string; name: string }[] = [
  { id: 'vainilla', color: '#fde68a', name: 'Vainilla' },
  { id: 'chocolate', color: '#a0673f', name: 'Choco' },
  { id: 'fresa', color: '#f9a8d4', name: 'Fresa' },
]
type Frost = 'blanca' | 'rosa' | 'lila' | 'menta' | 'choco' | 'limon'
const FROSTS: { id: Frost; color: string }[] = [
  { id: 'blanca', color: '#ffffff' },
  { id: 'rosa', color: '#f9a8d4' },
  { id: 'lila', color: '#c4b5fd' },
  { id: 'menta', color: '#a7f3d0' },
  { id: 'choco', color: '#7c4a2d' },
  { id: 'limon', color: '#fef08a' },
]
type Kind = 'fresa' | 'cereza' | 'arandano' | 'corazon' | 'estrella' | 'bombon' | 'vela' | 'flor' | 'chispas'
const KINDS: Kind[] = ['fresa', 'cereza', 'arandano', 'corazon', 'estrella', 'bombon', 'vela', 'flor', 'chispas']
const KIND_COLOR: Record<Kind, string> = {
  fresa: 'rojo',
  cereza: 'rojo',
  arandano: 'azul',
  corazon: 'rosa',
  estrella: 'amarillo',
  bombon: 'cafe',
  vela: 'blanco',
  flor: 'lila',
  chispas: 'colores',
}
const FRUIT: Kind[] = ['fresa', 'cereza', 'arandano']

interface Top {
  id: number
  kind: Kind
  x: number
  y: number
  pop: number
}
interface Cake {
  flavor: Flavor
  tiers: number
  frost: Frost | null
  drip: boolean
  tops: Top[]
}

// ---------- pedidos ----------
type Cond = [ok: boolean, weight: number, hint: string]
interface Request {
  text: string
  check: (c: Cake, n: (k: Kind) => number) => Cond[]
}
const REQUESTS: Request[] = [
  { text: '¡Uno bien rosita, porfa!', check: (c, n) => [[c.frost === 'rosa', 2, 'Le faltó crema rosa'], [n('corazon') + n('fresa') >= 2, 1, 'Más cositas rosas']] },
  { text: 'Quiero muuuchas fresas', check: (c, n) => [[n('fresa') >= 6, 3, '¡Quería MÁS fresas!']] },
  { text: 'Es mi cumple: ¡alto y con velitas!', check: (c, n) => [[c.tiers >= 3, 2, 'Lo quería más alto'], [n('vela') >= 3, 2, 'Faltaron velitas']] },
  { text: 'Sin fruta, soy alérgico', check: (c, n) => [[FRUIT.every((k) => n(k) === 0), 3, '¡Tenía fruta! Achú'], [c.tops.length >= 3, 1, 'Se ve vacío']] },
  {
    text: 'Chocolate, chocolate y más chocolate',
    check: (c, n) => [[c.flavor === 'chocolate', 1, 'El pan no era de chocolate'], [c.frost === 'choco', 2, 'La crema no era de chocolate'], [n('bombon') >= 3, 1, 'Más bombones']],
  },
  { text: 'Algo chiquito y tierno', check: (c, n) => [[c.tiers === 1, 2, 'Muy grandote'], [n('corazon') >= 1, 1, 'Un corazoncito faltó']] },
  {
    text: '¡De todos los colores, como arcoíris!',
    check: (c) => [[new Set(c.tops.map((t) => KIND_COLOR[t.kind])).size >= 4 || c.tops.some((t) => t.kind === 'chispas'), 3, 'Más colores']],
  },
  { text: 'Menta con cerezas, mi favorito', check: (c, n) => [[c.frost === 'menta', 2, 'La crema no era de menta'], [n('cereza') >= 2, 2, 'Faltaron cerezas']] },
  {
    text: 'Para mi boda: blanco y elegante',
    check: (c, n) => [[c.frost === 'blanca', 2, 'Lo quería blanco'], [c.tiers >= 2, 1, 'Muy bajito para boda'], [n('flor') >= 2, 1, 'Unas flores habrían ido bien']],
  },
  { text: 'De vainilla con estrellitas', check: (c, n) => [[c.flavor === 'vainilla', 1, 'No era de vainilla'], [n('estrella') >= 3, 2, 'Más estrellitas']] },
  { text: 'Sorpréndeme', check: (c) => [[new Set(c.tops.map((t) => t.kind)).size >= 3, 2, 'Algo más variado'], [c.tops.length >= 6, 1, 'Le faltó apapacho']] },
  { text: 'Lila con arándanos', check: (c, n) => [[c.frost === 'lila', 2, 'La crema no era lila'], [n('arandano') >= 3, 2, 'Faltaron arándanos']] },
  { text: 'Uno con escurrido de crema', check: (c) => [[c.drip, 2, 'Sin escurrido'], [c.frost !== null, 1, 'Sin crema']] },
  { text: 'De fresa, con fresas, fresísimo', check: (c, n) => [[c.flavor === 'fresa', 2, 'El pan no era de fresa'], [n('fresa') >= 3, 2, 'Más fresas']] },
  { text: 'Uno de limón, sin velas', check: (c, n) => [[c.frost === 'limon', 2, 'No era de limón'], [n('vela') === 0, 2, '¡Dije sin velas!']] },
]

type Animal = 'gato' | 'conejo' | 'oso' | 'pollito'
const ANIMALS: Animal[] = ['gato', 'conejo', 'oso', 'pollito']
const FURS = ['#fbcfe8', '#fde68a', '#c4b5fd', '#fed7aa', '#e5e7eb', '#bfdbfe']
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

// ---------- geometría ----------
const PLATE_Y = 452
const TIER_H = 52
const TIER_W = [210, 156, 108]
const tierTop = (i: number) => PLATE_Y - (i + 1) * TIER_H
function onCake(c: Cake, x: number, y: number) {
  for (let i = 0; i < c.tiers; i++) {
    const w = TIER_W[i]
    if (x > W / 2 - w / 2 - 4 && x < W / 2 + w / 2 + 4 && y > tierTop(i) - 16 && y < tierTop(i) + TIER_H) return true
  }
  return false
}

// botones de la parte de abajo
const TABS = ['PAN', 'CREMA', 'ADORNOS'] as const
type Tab = (typeof TABS)[number]
const TAB_Y = 474
const PANEL_Y = 506
const BTN_LISTO = { x: 238, y: 596, w: 110, h: 36 }
const BTN_TRASH = { x: 186, y: 596, w: 44, h: 36 }
const trayPos = (i: number) => ({ x: 34 + (i % 5) * 73, y: PANEL_Y + 22 + Math.floor(i / 5) * 44 })

// ---------- sonido ----------
function sfx(name: string) {
  switch (name) {
    case 'pop':
      tone({ freq: 520, to: 980, dur: 0.07, type: 'sine', vol: 0.06 })
      break
    case 'grab':
      tone({ freq: 700, dur: 0.04, type: 'triangle', vol: 0.035 })
      break
    case 'splat':
      noise({ dur: 0.12, vol: 0.04, freq: 900 })
      tone({ freq: 300, to: 180, dur: 0.1, type: 'sine', vol: 0.04 })
      break
    case 'poof':
      noise({ dur: 0.1, vol: 0.03, freq: 2400 })
      break
    case 'bell':
      ;[1319, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.05, delay: i * 0.12 }))
      break
    case 'love':
      ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', vol: 0.04, delay: i * 0.07 }))
      break
    case 'ok':
      ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.08 }))
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

type Mood = 'happy' | 'wow' | 'calm' | 'sad' | 'love'
function face(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mood: Mood, t: number) {
  const blink = Math.sin(t * 1.7 + x) > 0.985
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.lineWidth = 2 * s
  for (const dx of [-1, 1]) {
    const ex = x + dx * 9 * s
    if (mood === 'love') {
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.moveTo(ex, y + 4 * s)
      ctx.bezierCurveTo(ex - 7 * s, y - 1 * s, ex - 4 * s, y - 7 * s, ex, y - 3 * s)
      ctx.bezierCurveTo(ex + 4 * s, y - 7 * s, ex + 7 * s, y - 1 * s, ex, y + 4 * s)
      ctx.fill()
      ctx.fillStyle = INK
    } else if (mood === 'happy' || blink) {
      ctx.beginPath()
      ctx.arc(ex, y, 4 * s, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(ex, y, (mood === 'wow' ? 4.2 : 3.4) * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex + 1.2 * s, y - 1.2 * s, 1.3 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
    }
  }
  ctx.beginPath()
  if (mood === 'wow') {
    ctx.ellipse(x, y + 8 * s, 3.5 * s, 4.5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (mood === 'sad') {
    ctx.arc(x, y + 11 * s, 4 * s, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  } else {
    ctx.arc(x, y + 5 * s, (mood === 'love' ? 6 : 4.5) * s, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(244,114,182,0.5)'
  ctx.beginPath()
  ctx.ellipse(x - 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal, fur: string, x: number, y: number, mood: Mood, t: number) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  ctx.fillStyle = fur
  if (a === 'conejo') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + dx * 14, y - 42, 9, 26, dx * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  } else if (a === 'gato') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + dx * 32, y - 8)
      ctx.lineTo(x + dx * 26, y - 42)
      ctx.lineTo(x + dx * 6, y - 28)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else if (a === 'oso') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + dx * 26, y - 26, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.ellipse(x, y - 36, 6, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = fur
  }
  ctx.beginPath()
  ctx.ellipse(x, y, 38, 34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (a === 'pollito') {
    ctx.fillStyle = '#fb923c'
    ctx.beginPath()
    ctx.moveTo(x - 5, y + 4)
    ctx.lineTo(x + 5, y + 4)
    ctx.lineTo(x, y + 10)
    ctx.closePath()
    ctx.fill()
  }
  face(ctx, x, y - 4, 1, mood, t)
  ctx.restore()
}

function drawTopping(ctx: CanvasRenderingContext2D, k: Kind, x: number, y: number, s: number, seed: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 1.6
  ctx.strokeStyle = INK
  const blob = (fill: string, r: number) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  if (k === 'fresa') {
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(-8, -4)
    ctx.quadraticCurveTo(-8, 9, 0, 11)
    ctx.quadraticCurveTo(8, 9, 8, -4)
    ctx.quadraticCurveTo(0, -9, -8, -4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.ellipse(0, -6, 6, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fde68a'
    ctx.fillRect(-3, 0, 1.6, 1.6)
    ctx.fillRect(2, 3, 1.6, 1.6)
    ctx.fillRect(-1, 5, 1.6, 1.6)
  } else if (k === 'cereza') {
    ctx.strokeStyle = '#65a30d'
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(2, -14, 7, -16)
    ctx.stroke()
    ctx.strokeStyle = INK
    blob('#dc2626', 7)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(-2.5, -2.5, 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (k === 'arandano') {
    blob('#4f6bd8', 6.5)
    ctx.strokeStyle = '#c7d2fe'
    ctx.beginPath()
    ctx.moveTo(-2, -2)
    ctx.lineTo(2, 2)
    ctx.moveTo(2, -2)
    ctx.lineTo(-2, 2)
    ctx.stroke()
  } else if (k === 'corazon') {
    ctx.fillStyle = '#fb7185'
    ctx.beginPath()
    ctx.moveTo(0, 8)
    ctx.bezierCurveTo(-12, -2, -6, -11, 0, -4)
    ctx.bezierCurveTo(6, -11, 12, -2, 0, 8)
    ctx.fill()
    ctx.stroke()
  } else if (k === 'estrella') {
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 ? 4 : 9.5
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (k === 'bombon') {
    blob('#6b3a22', 7.5)
    ctx.strokeStyle = '#d6a77a'
    ctx.beginPath()
    ctx.arc(0, 0, 3.5, 0.3, Math.PI * 1.6)
    ctx.stroke()
  } else if (k === 'vela') {
    ctx.fillStyle = '#ffffff'
    rr(ctx, -3.5, -14, 7, 18, 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#f472b6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-3.5, -9)
    ctx.lineTo(3.5, -12)
    ctx.moveTo(-3.5, -3)
    ctx.lineTo(3.5, -6)
    ctx.stroke()
    const fl = 1 + Math.sin(t * 14 + seed) * 0.15
    ctx.fillStyle = '#fb923c'
    ctx.beginPath()
    ctx.ellipse(0, -19, 3 * fl, 5 * fl, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.ellipse(0, -18, 1.5, 2.8, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (k === 'flor') {
    ctx.fillStyle = '#d8b4fe'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    blob('#fde047', 3.2)
  } else {
    const cols = ['#f472b6', '#60a5fa', '#facc15', '#4ade80', '#c084fc', '#fb923c']
    for (let i = 0; i < 7; i++) {
      const a = seed * 7 + i * 1.7
      ctx.save()
      ctx.translate(Math.cos(a) * 8, Math.sin(a * 1.3) * 6)
      ctx.rotate(a)
      ctx.fillStyle = cols[i % cols.length]
      rr(ctx, -4, -1.3, 8, 2.6, 1.3)
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.restore()
}

function drawCake(ctx: CanvasRenderingContext2D, c: Cake, t: number, mood: Mood) {
  const sponge = FLAVORS.find((f) => f.id === c.flavor)!.color
  const frost = c.frost ? FROSTS.find((f) => f.id === c.frost)!.color : null
  // plato giratorio
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(W / 2, PLATE_Y + 6, 140, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fbcfe8'
  ctx.beginPath()
  ctx.ellipse(W / 2, PLATE_Y + 6, 120, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < c.tiers; i++) {
    const w = TIER_W[i]
    const x = W / 2 - w / 2
    const y = tierTop(i)
    ctx.fillStyle = sponge
    rr(ctx, x, y, w, TIER_H, 14)
    ctx.fill()
    ctx.stroke()
    // relleno
    ctx.fillStyle = frost ?? '#fff7ed'
    ctx.fillRect(x + 2, y + TIER_H * 0.55, w - 4, 6)
    if (frost) {
      ctx.fillStyle = frost
      ctx.beginPath()
      ctx.moveTo(x, y + 10)
      const n = Math.round(w / 22)
      for (let k = 0; k <= n; k++) {
        const px = x + (w * k) / n
        const drop = c.drip && k % 2 === 1 ? 26 + ((k * 7 + i * 3) % 3) * 6 : 14
        ctx.quadraticCurveTo(px - w / n / 2, y + drop + 6, px, y + 10)
      }
      ctx.lineTo(x + w, y - 2)
      ctx.quadraticCurveTo(x + w, y - 6, x + w - 12, y - 6)
      ctx.lineTo(x + 12, y - 6)
      ctx.quadraticCurveTo(x, y - 6, x, y - 2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      rr(ctx, x + 10, y - 2, w * 0.3, 4, 2)
      ctx.fill()
    }
  }
  face(ctx, W / 2, PLATE_Y - TIER_H * 0.32, 1.1, mood, t)
  for (const tp of c.tops) {
    const s = 1.35 * (1 + Math.max(0, tp.pop) * 0.5)
    drawTopping(ctx, tp.kind, tp.x, tp.y, s, tp.id, t)
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  const y0 = y - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh))
}

// ---------- estado ----------
interface G {
  phase: 'menu' | 'arrive' | 'build' | 'judge' | 'over'
  day: number
  served: number
  happy: number
  coins: number
  dayCoins: number
  t: number
  cust: { a: Animal; fur: string; req: Request; x: number }
  cake: Cake
  tab: Tab
  say: string
  mood: Mood
  lastScore: number
  nextId: number
  paused: boolean
}

interface Save {
  day: number
  coins: number
  best: number
}
function load(): Save {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<Save> | null
    return {
      day: typeof v?.day === 'number' ? v.day : 1,
      coins: typeof v?.coins === 'number' ? v.coins : 0,
      best: typeof v?.best === 'number' ? v.best : 0,
    }
  } catch {
    return { day: 1, coins: 0, best: 0 }
  }
}
function store(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // sin almacenamiento
  }
}

const emptyCake = (): Cake => ({ flavor: 'vainilla', tiers: 1, frost: null, drip: false, tops: [] })
const newCust = (prev?: Request) => {
  let req = pick(REQUESTS)
  while (prev && req === prev) req = pick(REQUESTS)
  return { a: pick(ANIMALS), fur: pick(FURS), req, x: W + 60 }
}

interface Ui {
  phase: G['phase']
  day: number
  served: number
  coins: number
  dayCoins: number
  happy: number
  best: number
}

export default function Pasteleria() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Ui>({ phase: 'menu', day: 1, served: 0, coins: 0, dayCoins: 0, happy: 0, best: 0 })

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
    let save = load()
    const g: G = {
      phase: 'menu',
      day: save.day,
      served: 0,
      happy: 0,
      coins: save.coins,
      dayCoins: 0,
      t: 0,
      cust: newCust(),
      cake: emptyCake(),
      tab: 'PAN',
      say: '',
      mood: 'calm',
      lastScore: 0,
      nextId: 1,
      paused: false,
    }
    const sync = () =>
      setUi({ phase: g.phase, day: g.day, served: g.served, coins: g.coins, dayCoins: g.dayCoins, happy: g.happy, best: save.best })
    sync()

    const arrive = () => {
      g.cust = newCust(g.cust.req)
      g.cake = emptyCake()
      g.tab = 'PAN'
      g.phase = 'arrive'
      g.t = 0.7
      g.say = g.cust.req.text
      g.mood = 'calm'
      sfx('bell')
      sync()
    }

    startRef.current = () => {
      g.served = 0
      g.happy = 0
      g.dayCoins = 0
      juice.reset()
      arrive()
    }

    const judge = () => {
      const c = g.cake
      const n = (k: Kind) => c.tops.filter((t) => t.kind === k).length
      const conds = g.cust.req.check(c, n)
      const tw = conds.reduce((a, q) => a + q[1], 0)
      const match = conds.reduce((a, q) => a + (q[0] ? q[1] : 0), 0) / tw
      const types = new Set(c.tops.map((t) => t.kind)).size
      const effort = (c.frost ? 0.3 : 0) + clamp(c.tops.length / 6, 0, 1) * 0.45 + clamp(types / 3, 0, 1) * 0.25
      const score = Math.round(100 * (0.7 * match + 0.3 * effort))
      const miss = conds.find((q) => !q[0])
      const pay = 10 + Math.round(score * 0.5)
      g.lastScore = score
      g.coins += pay
      g.dayCoins += pay
      g.served++
      if (score >= 70) g.happy++
      if (score >= 90) {
        g.say = pick(['¡ES PERFECTO!', '¡Lo amo! ¡Gracias!', '¡Justo lo que soñé!'])
        g.mood = 'love'
        sfx('love')
        juice.burst(W / 2, 330, ['#f472b6', '#fde68a', '#a7f3d0', '#c4b5fd', '#ffffff'], { count: 60, speed: 280, life: 1.2, size: 6 })
        juice.flash('#ffffff', 0.35)
        juice.shake(0.3)
      } else if (score >= 70) {
        g.say = miss ? `¡Me encanta! (${miss[2].toLowerCase()})` : '¡Me encanta!'
        g.mood = 'happy'
        sfx('ok')
        juice.burst(W / 2, 330, ['#f472b6', '#fde68a', '#ffffff'], { count: 30, speed: 200, life: 0.9, size: 5 })
      } else if (score >= 45) {
        g.say = `${miss ? miss[2] : 'Le faltó algo'}... pero está rico`
        g.mood = 'calm'
        sfx('ok')
      } else {
        g.say = `Mmm... ${miss ? miss[2].toLowerCase() : 'no era lo que pedí'}`
        g.mood = 'sad'
        sfx('meh')
      }
      juice.text(W / 2, 200, `+${pay}`, '#facc15', 16, 1.4)
      g.phase = 'judge'
      g.t = 2.8
      sync()
    }

    const endJudge = () => {
      if (g.served >= PER_DAY) {
        g.phase = 'over'
        save = { day: g.day + 1, coins: g.coins, best: Math.max(save.best, g.dayCoins) }
        store(save)
        sync()
        g.day = save.day
        return
      }
      arrive()
    }

    // ---- entrada (multitáctil: cada dedo arrastra su adorno) ----
    const drags = new Map<number, { kind: Kind; x: number; y: number; id: number | null }>()
    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    }
    const inRect = (x: number, y: number, b: { x: number; y: number; w: number; h: number }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    const trimTops = () => {
      const before = g.cake.tops.length
      g.cake.tops = g.cake.tops.filter((tp) => onCake(g.cake, tp.x, tp.y))
      if (g.cake.tops.length < before) sfx('poof')
    }

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase !== 'build') return
      const { x, y } = toLocal(e)
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      // pestañas
      if (y >= TAB_Y && y <= TAB_Y + 26) {
        const i = Math.floor(x / (W / 3))
        g.tab = TABS[clamp(i, 0, 2)]
        sfx('grab')
        return
      }
      if (inRect(x, y, BTN_LISTO)) {
        if (g.cake.frost === null && g.cake.tops.length === 0) {
          juice.text(W / 2, 380, '¡Decóralo primero!', '#ec4899', 11, 1)
          sfx('meh')
          return
        }
        judge()
        return
      }
      if (inRect(x, y, BTN_TRASH)) {
        if (g.cake.tops.length) {
          for (const tp of g.cake.tops) juice.burst(tp.x, tp.y, ['#ffffff', '#fbcfe8'], { count: 4, speed: 80, life: 0.4, size: 3 })
          g.cake.tops = []
          sfx('poof')
        }
        return
      }
      // adorno ya puesto: se toma para moverlo (el de más arriba)
      for (let i = g.cake.tops.length - 1; i >= 0; i--) {
        const tp = g.cake.tops[i]
        if (Math.hypot(tp.x - x, tp.y - y) < 18) {
          g.cake.tops.splice(i, 1)
          drags.set(e.pointerId, { kind: tp.kind, x, y, id: tp.id })
          sfx('grab')
          return
        }
      }
      // panel
      if (y >= PANEL_Y && y < 592) {
        if (g.tab === 'ADORNOS') {
          KINDS.forEach((k, i) => {
            const p = trayPos(i)
            if (Math.hypot(p.x - x, p.y - y) < 24) {
              drags.set(e.pointerId, { kind: k, x, y, id: null })
              sfx('grab')
            }
          })
        } else if (g.tab === 'PAN') {
          FLAVORS.forEach((f, i) => {
            if (Math.hypot(40 + i * 58 - x, PANEL_Y + 34 - y) < 24) {
              g.cake.flavor = f.id
              sfx('splat')
            }
          })
          if (Math.hypot(236 - x, PANEL_Y + 34 - y) < 20 && g.cake.tiers > 1) {
            g.cake.tiers--
            trimTops()
            sfx('pop')
          }
          if (Math.hypot(320 - x, PANEL_Y + 34 - y) < 20 && g.cake.tiers < 3) {
            g.cake.tiers++
            sfx('pop')
            juice.burst(W / 2, tierTop(g.cake.tiers - 1), ['#ffffff', '#fde68a'], { count: 10, speed: 90, life: 0.4, size: 3 })
          }
        } else {
          FROSTS.forEach((f, i) => {
            if (Math.hypot(30 + i * 46 - x, PANEL_Y + 30 - y) < 20) {
              g.cake.frost = f.id
              sfx('splat')
              juice.burst(W / 2, tierTop(g.cake.tiers - 1), [f.color, '#ffffff'], { count: 14, speed: 120, life: 0.5, size: 4 })
            }
          })
          if (inRect(x, y, { x: 20, y: PANEL_Y + 56, w: 150, h: 28 })) {
            g.cake.drip = !g.cake.drip
            sfx('splat')
          }
        }
      }
    }
    const onMove = (e: PointerEvent) => {
      const d = drags.get(e.pointerId)
      if (!d) return
      const p = toLocal(e)
      d.x = p.x
      d.y = p.y - 10 // el adorno se ve un poco arriba del dedo
    }
    const onUp = (e: PointerEvent) => {
      const d = drags.get(e.pointerId)
      if (!d) return
      drags.delete(e.pointerId)
      if (g.phase === 'build' && onCake(g.cake, d.x, d.y)) {
        g.cake.tops.push({ id: d.id ?? g.nextId++, kind: d.kind, x: d.x, y: d.y, pop: 1 })
        sfx('pop')
        juice.burst(d.x, d.y, ['#ffffff', '#fde68a'], { count: 6, speed: 70, life: 0.3, size: 2.5 })
      } else {
        sfx('poof')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' && g.phase !== 'menu' && g.phase !== 'over') g.paused = !g.paused
      if (e.code === 'Enter' && g.phase === 'build') judge()
    }
    const pauseNow = () => {
      if (g.phase !== 'menu' && g.phase !== 'over') g.paused = true
      drags.clear()
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
    let raf = 0
    let last = performance.now()
    let t = 0
    const update = (dt: number) => {
      for (const tp of g.cake.tops) tp.pop = Math.max(0, tp.pop - dt * 5)
      if (g.paused || g.phase === 'menu' || g.phase === 'over') return
      g.cust.x += (90 - g.cust.x) * Math.min(1, dt * 8)
      g.t -= dt
      if (g.phase === 'arrive' && g.t <= 0) g.phase = 'build'
      if (g.phase === 'judge' && g.t <= 0) endJudge()
    }

    const drawPanel = () => {
      // pestañas
      TABS.forEach((tb, i) => {
        const x = (i * W) / 3
        const on = g.tab === tb
        ctx.fillStyle = on ? '#ffffff' : '#f9d6e5'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        rr(ctx, x + 6, TAB_Y, W / 3 - 12, 26, 12)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = on ? '#ec4899' : '#a26a86'
        ctx.font = `8px ${pf}`
        ctx.fillText(tb, x + W / 6, TAB_Y + 17)
      })
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      rr(ctx, 8, PANEL_Y - 2, W - 16, 86, 16)
      ctx.fill()
      if (g.tab === 'PAN') {
        FLAVORS.forEach((f, i) => {
          const x = 40 + i * 58
          ctx.fillStyle = f.color
          ctx.strokeStyle = g.cake.flavor === f.id ? '#ec4899' : INK
          ctx.lineWidth = g.cake.flavor === f.id ? 4 : 2
          rr(ctx, x - 20, PANEL_Y + 14, 40, 36, 10)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = INK
          ctx.font = 'bold 10px sans-serif'
          ctx.fillText(f.name, x, PANEL_Y + 68)
        })
        for (const [x, s] of [
          [236, '−'],
          [320, '+'],
        ] as const) {
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = INK
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, PANEL_Y + 34, 17, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = INK
          ctx.font = 'bold 22px sans-serif'
          ctx.fillText(s, x, PANEL_Y + 42)
        }
        ctx.font = `10px ${pf}`
        ctx.fillText(String(g.cake.tiers), 278, PANEL_Y + 40)
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText('pisos', 278, PANEL_Y + 68)
      } else if (g.tab === 'CREMA') {
        FROSTS.forEach((f, i) => {
          const x = 30 + i * 46
          ctx.fillStyle = f.color
          ctx.strokeStyle = g.cake.frost === f.id ? '#ec4899' : INK
          ctx.lineWidth = g.cake.frost === f.id ? 4 : 2
          ctx.beginPath()
          ctx.arc(x, PANEL_Y + 30, 17, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        })
        ctx.fillStyle = g.cake.drip ? '#f472b6' : '#ffffff'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        rr(ctx, 20, PANEL_Y + 56, 150, 26, 13)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = g.cake.drip ? '#ffffff' : INK
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText(g.cake.drip ? '✓ Escurrido' : 'Escurrido', 95, PANEL_Y + 74)
      } else {
        KINDS.forEach((k, i) => {
          const p = trayPos(i)
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = 'rgba(91,42,58,0.3)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, 19, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          drawTopping(ctx, k, p.x, p.y + (k === 'vela' ? 6 : 0), 1.15, i, t)
        })
      }
      // basura y listo
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      rr(ctx, BTN_TRASH.x, BTN_TRASH.y, BTN_TRASH.w, BTN_TRASH.h, 12)
      ctx.fill()
      ctx.stroke()
      ctx.font = '18px sans-serif'
      ctx.fillText('🧹', BTN_TRASH.x + BTN_TRASH.w / 2, BTN_TRASH.y + 25)
      const ready = g.cake.frost !== null || g.cake.tops.length > 0
      ctx.fillStyle = ready ? '#ec4899' : '#f9a8d4'
      rr(ctx, BTN_LISTO.x, BTN_LISTO.y, BTN_LISTO.w, BTN_LISTO.h, 18)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = `10px ${pf}`
      ctx.fillText('¡LISTO!', BTN_LISTO.x + BTN_LISTO.w / 2, BTN_LISTO.y + 23)
      ctx.textAlign = 'left'
      ctx.fillStyle = INK
      ctx.font = `8px ${pf}`
      ctx.fillText(`CLIENTE ${Math.min(g.served + 1, PER_DAY)}/${PER_DAY}`, 14, 612)
      ctx.fillText(`DÍA ${g.day}`, 14, 628)
      ctx.textAlign = 'center'
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      // cocina
      ctx.fillStyle = '#ffe4ef'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(244,114,182,0.16)'
      ctx.lineWidth = 1
      for (let y = 160; y < 470; y += 28) for (let x = (y / 28) % 2 ? 0 : -14; x < W; x += 28) ctx.strokeRect(x + 0.5, y + 0.5, 28, 28)
      // repisas con frascos
      ctx.fillStyle = '#e8b98a'
      ctx.fillRect(16, 196, 70, 6)
      ctx.fillRect(W - 86, 196, 70, 6)
      const jars = ['#fbcfe8', '#a7f3d0', '#fde68a']
      jars.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.5
        rr(ctx, 22 + i * 22, 176, 16, 20, 4)
        ctx.fill()
        ctx.stroke()
        rr(ctx, W - 80 + i * 22, 176, 16, 20, 4)
        ctx.fill()
        ctx.stroke()
      })
      // ventanilla del cliente con toldo
      ctx.fillStyle = '#bae6fd'
      rr(ctx, 12, 12, W - 24, 140, 22)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.save()
      rr(ctx, 12, 12, W - 24, 140, 22)
      ctx.clip()
      const mood: Mood = g.phase === 'judge' ? g.mood : g.phase === 'build' && g.cake.tops.length > 4 ? 'wow' : 'calm'
      const hop = g.phase === 'judge' && g.lastScore >= 70 ? -Math.abs(Math.sin(t * 9)) * 10 : Math.sin(t * 2) * 2
      if (g.phase !== 'menu') drawAnimal(ctx, g.cust.a, g.cust.fur, g.cust.x, 110 + hop, mood, t)
      ctx.restore()
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#f472b6'
        const x = 12 + (i * (W - 24)) / 9
        const w = (W - 24) / 9
        ctx.beginPath()
        ctx.moveTo(x, 12)
        ctx.lineTo(x + w, 12)
        ctx.lineTo(x + w, 24)
        ctx.arc(x + w / 2, 24, w / 2, 0, Math.PI)
        ctx.closePath()
        ctx.fill()
      }
      // globo de diálogo
      if (g.phase !== 'menu' && g.say) {
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2.5
        rr(ctx, 152, 44, 192, 92, 18)
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(154, 92)
        ctx.lineTo(136, 104)
        ctx.lineTo(156, 106)
        ctx.fill()
        ctx.fillStyle = g.phase === 'judge' ? (g.lastScore >= 70 ? '#db2777' : '#7c3aed') : INK
        ctx.font = 'bold 14px sans-serif'
        wrap(ctx, g.say, 248, 92, 172, 18)
      }
      // pastel
      const cakeMood: Mood = g.phase === 'judge' ? (g.lastScore >= 70 ? 'happy' : 'calm') : g.cake.tops.length > 0 ? 'happy' : 'calm'
      drawCake(ctx, g.cake, t, cakeMood)
      // fantasma de dónde caerá el adorno
      for (const d of drags.values()) {
        const ok = onCake(g.cake, d.x, d.y)
        ctx.save()
        ctx.globalAlpha = ok ? 1 : 0.55
        drawTopping(ctx, d.kind, d.x, d.y, 1.6, 0, t)
        ctx.restore()
      }
      if (g.phase === 'build' || g.phase === 'arrive') drawPanel()
      if (g.phase === 'judge') {
        ctx.font = `13px ${pf}`
        ctx.lineWidth = 5
        ctx.strokeStyle = '#ffffff'
        const label = g.lastScore >= 90 ? '¡PERFECTO!' : g.lastScore >= 70 ? '¡MUY BIEN!' : g.lastScore >= 45 ? 'BIEN' : 'UPS...'
        ctx.strokeText(`${label} ${g.lastScore}%`, W / 2, 530)
        ctx.fillStyle = g.lastScore >= 70 ? '#ec4899' : '#7c3aed'
        ctx.fillText(`${label} ${g.lastScore}%`, W / 2, 530)
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
      <span style={{ color: ACCENT }}>DÍA {ui.day}</span>
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
            hint="Pulsa ESPACIO para abrir"
            touchHint="Toca Jugar para abrir"
            onStart={() => startRef.current()}
          >
            <p className="max-w-xs text-sm leading-relaxed text-white/80">
              Los animalitos piden cosas raras. Ustedes deciden cómo: sabor, pisos, crema y adornos que arrastran a donde
              quieran. Pagan según qué tan bien entendieron el pedido.
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-white/60">
              En pareja: cada quien arrastra adornos con su dedo al mismo tiempo.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <GameOverOverlay
            title={`¡DÍA ${ui.day} CERRADO!`}
            accent={ACCENT}
            score={ui.dayCoins}
            best={ui.best}
            ranked={false}
            stats={[
              { label: 'Clientes felices', value: `${ui.happy}/${PER_DAY}` },
              { label: 'Ahorros', value: ui.coins },
            ]}
            onRestart={() => startRef.current()}
            touchHint="o toca para abrir el siguiente día"
          />
        )}
      </GameScreen>
    </div>
  )
}
