'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { Hud, useIsTouch } from './overlay'
import { Juice } from './juice'
import { rr, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const ACCENT = '#f9a8d4'
const SAVE_KEY = 'arcade-cafe-michi'
const DIA_T = 120 // duración de un día, en segundos
const COLA_MAX = 2 // gatitos esperando de pie junto a la puerta
const PACIENCIA = 60 // segundos de paciencia por gatito (generosa: irse solo cuesta la propina)
const BANDEJA_CAP = 3

const W0 = 360
const H0 = 560
const SC = 1.4 // escala de los gatitos sobre sus dibujos base
// Mundo lógico: se ajusta a la pantalla (ver layout). Todo se dibuja en proporción a W y H.
let W = W0
let H = H0

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}
interface Geo {
  asientos: { x: number; y: number }[]
  cola: { x: number; y: number }[]
  estacion: Record<Item, Rect>
  ranuras: Rect[]
  basura: Rect
  pisoT: number
  pisoB: number
  bandejaT: number
  bandejaB: number
}

/** Zonas de la cafetería según el mundo lógico actual. */
function buildGeo(): Geo {
  const pisoT = H * 0.22
  const pisoB = H * 0.6
  const fila = (pisoB - pisoT) / 3
  // seis asientos: dos columnas, tres filas (la mesa N se activa al comprar mesas)
  const asientos = [0, 1, 2].flatMap((r) => [0.3, 0.7].map((fx) => ({ x: W * fx, y: pisoT + fila * (r + 0.5) + 6 })))
  const cola = [0, 1].map((i) => ({ x: 34, y: pisoB - 40 - i * 48 }))
  const estacion = {} as Record<Item, Rect>
  BEB_ORDEN.forEach((id, i) => {
    estacion[id] = { x0: (W * i) / 4, y0: H * 0.6, x1: (W * (i + 1)) / 4, y1: H * 0.715 }
  })
  POS_ORDEN.forEach((id, i) => {
    estacion[id] = { x0: (W * i) / 3, y0: H * 0.725, x1: (W * (i + 1)) / 3, y1: H * 0.8 }
  })
  const bandejaT = H * 0.84
  const bandejaB = H * 0.97
  const ancho = (W * 0.74) / BANDEJA_CAP
  const ranuras = Array.from({ length: BANDEJA_CAP }, (_, i) => ({
    x0: W * 0.04 + i * ancho + 4,
    y0: bandejaT + 8,
    x1: W * 0.04 + (i + 1) * ancho - 4,
    y1: bandejaB - 8,
  }))
  const basura = { x0: W * 0.8, y0: bandejaT + 8, x1: W * 0.96, y1: bandejaB - 8 }
  return { asientos, cola, estacion, ranuras, basura, pisoT, pisoB, bandejaT, bandejaB }
}

let G: Geo

/** Ajusta el mundo lógico a la pantalla y recalcula las zonas. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
  G = buildGeo()
}

// ---------- tipos y catálogo ----------
type Bebida = 'cafe' | 'chocolate' | 'matcha' | 'espuma'
type Postre = 'pastel' | 'galleta' | 'donita'
type Item = Bebida | Postre
type Deco = 'cojines' | 'plantitas' | 'luces' | 'cuadro'
type Esp = 'mochi' | 'pelusa' | 'lunita' | 'bigotes'
type CatSt = 'cola' | 'entra' | 'espera' | 'feliz' | 'sale' | 'triste'
type Fase = 'menu' | 'dia' | 'resumen' | 'tienda'

const BEB_ORDEN: Bebida[] = ['cafe', 'chocolate', 'matcha', 'espuma']
const POS_ORDEN: Postre[] = ['pastel', 'galleta', 'donita']
const ITEMS: Item[] = [...BEB_ORDEN, ...POS_ORDEN]
const DECO_IDS: Deco[] = ['cojines', 'plantitas', 'luces', 'cuadro']
const ESP_IDS: Esp[] = ['mochi', 'pelusa', 'lunita', 'bigotes']

const esBebida = (id: Item): id is Bebida => (BEB_ORDEN as Item[]).includes(id)

interface Info {
  etiqueta: string // canvas: mayúsculas, sin acentos
  nombre: string // HTML
  precio: number
  tiempo: number // segundos para preparar sin mejoras
  maquina: string
  color: string
}
const INFO: Record<Item, Info> = {
  cafe: { etiqueta: 'CAFE', nombre: 'Café', precio: 10, tiempo: 2.4, maquina: '#e6c3a8', color: '#7a4a2e' },
  chocolate: { etiqueta: 'CHOCOLATE', nombre: 'Chocolate', precio: 12, tiempo: 2.8, maquina: '#f0b9ad', color: '#6b3a2a' },
  matcha: { etiqueta: 'MATCHA', nombre: 'Matcha', precio: 14, tiempo: 3, maquina: '#c9eabb', color: '#8fcf7a' },
  espuma: { etiqueta: 'ESPUMA', nombre: 'Leche con espuma', precio: 16, tiempo: 3.4, maquina: '#f9cfe0', color: '#fbe9f2' },
  pastel: { etiqueta: 'PASTEL', nombre: 'Pastelito', precio: 8, tiempo: 1, maquina: '#fff7ef', color: '#f9a8d4' },
  galleta: { etiqueta: 'GALLETA', nombre: 'Galleta', precio: 6, tiempo: 0.9, maquina: '#fff7ef', color: '#e0b079' },
  donita: { etiqueta: 'DONITA', nombre: 'Donita', precio: 7, tiempo: 1.1, maquina: '#fff7ef', color: '#f9b4c8' },
}

interface Look {
  cuerpo: string
  panza: string
  oreja: string
  rayas?: boolean
  parche?: string // mancha de otro color (gatitos manchados)
}
const LOOKS: Look[] = [
  { cuerpo: '#f7c27a', panza: '#fff4df', oreja: '#f8a9a0' },
  { cuerpo: '#c9c4d0', panza: '#f4f1f7', oreja: '#f3b5c0', parche: '#a9a3b5' },
  { cuerpo: '#fbf6ef', panza: '#ffffff', oreja: '#f6b8c6', parche: '#f7a8bb' },
  { cuerpo: '#d9a87f', panza: '#f7e6d4', oreja: '#eea7a0', rayas: true },
  { cuerpo: '#aebde8', panza: '#e9eefc', oreja: '#f3b5d4' },
]
const ESPECIALES: Record<Esp, { nombre: string; deco: Deco; look: Look; acento: string }> = {
  mochi: { nombre: 'MOCHI', deco: 'cojines', look: { cuerpo: '#f9b8c8', panza: '#fff0f5', oreja: '#f47aa0' }, acento: '#f472b6' },
  pelusa: { nombre: 'PELUSA', deco: 'plantitas', look: { cuerpo: '#8fd6b0', panza: '#e9fbf1', oreja: '#f5a8c0' }, acento: '#86efac' },
  lunita: { nombre: 'LUNITA', deco: 'luces', look: { cuerpo: '#fbf1c2', panza: '#fffdf2', oreja: '#f7b7a8' }, acento: '#fde047' },
  bigotes: { nombre: 'BIGOTES', deco: 'cuadro', look: { cuerpo: '#b9a5e6', panza: '#f1ebff', oreja: '#e7a8e0' }, acento: '#c4b5fd' },
}

// ---------- progreso guardado ----------
interface Save {
  dia: number // próximo día a abrir
  monedas: number
  mesas: number // 2..6
  rapidez: number // 0..3
  bebidas: Bebida[]
  postres: Postre[]
  deco: Deco[]
}

const nuevoSave = (): Save => ({
  dia: 1,
  monedas: 0,
  mesas: 2,
  rapidez: 0,
  bebidas: ['cafe', 'chocolate'],
  postres: ['pastel'],
  deco: [],
})

function listaValida<T extends string>(v: unknown, ok: readonly T[]): T[] {
  return Array.isArray(v) ? ok.filter((x) => v.includes(x)) : []
}
function sinRepetir<T>(arr: T[]): T[] {
  return arr.filter((x, i) => arr.indexOf(x) === i)
}

function leerSave(): Save {
  const base = nuevoSave()
  if (typeof window === 'undefined') return base
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return base
    const p = JSON.parse(raw) as Record<string, unknown>
    const num = (v: unknown, a: number, b: number, d: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d
    return {
      dia: num(p.dia, 1, 9999, 1),
      monedas: num(p.monedas, 0, 1e9, 0),
      mesas: num(p.mesas, 2, 6, 2),
      rapidez: num(p.rapidez, 0, 3, 0),
      bebidas: sinRepetir<Bebida>(['cafe', 'chocolate', ...listaValida<Bebida>(p.bebidas, BEB_ORDEN)]),
      postres: sinRepetir<Postre>(['pastel', ...listaValida<Postre>(p.postres, POS_ORDEN)]),
      deco: sinRepetir<Deco>(listaValida<Deco>(p.deco, DECO_IDS)),
    }
  } catch {
    return base
  }
}

function writeSave(s: Save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // sin acceso a localStorage: el progreso dura lo que la pestaña
  }
}

const desbloqueado = (sv: Save, id: Item) => sv.bebidas.includes(id as Bebida) || sv.postres.includes(id as Postre)
const tiempoPreparar = (sv: Save, id: Item) => INFO[id].tiempo * (1 - 0.15 * sv.rapidez)
/** Segundos entre llegadas: más mesas y más días, más gatitos. */
const intervalo = (sv: Save, dia: number) => Math.max(3.2, 7.5 - (sv.mesas - 2) * 0.9 - Math.min(1.5, (dia - 1) * 0.15))

// ---------- tienda ----------
interface Opcion {
  id: string
  grupo: string
  titulo: string
  detalle: string
  costo: number | null
  aplicar: ((s: Save) => Save) | null
  aviso?: string
}
const COSTO_RAPIDEZ = [45, 90, 160]
const COSTO_MESA = [50, 110, 190, 300]

function unica(
  id: string,
  grupo: string,
  titulo: string,
  costo: number,
  detalle: string,
  tiene: boolean,
  aplicar: (x: Save) => Save,
  aviso?: string,
): Opcion {
  return tiene
    ? { id, grupo, titulo, detalle: 'Ya lo tienes.', costo: null, aplicar: null }
    : { id, grupo, titulo, detalle, costo, aplicar, aviso }
}

function opciones(s: Save): Opcion[] {
  return [
    {
      id: 'rapidez',
      grupo: 'Máquinas',
      titulo: 'Máquinas más rápidas',
      detalle: s.rapidez < 3 ? `Nivel ${s.rapidez} de 3. Preparan 15% más rápido.` : 'Al máximo: preparan 45% más rápido.',
      costo: s.rapidez < 3 ? COSTO_RAPIDEZ[s.rapidez] : null,
      aplicar: s.rapidez < 3 ? (x) => ({ ...x, rapidez: x.rapidez + 1 }) : null,
    },
    {
      id: 'mesas',
      grupo: 'Mesas',
      titulo: 'Mesa extra',
      detalle: s.mesas < 6 ? `Ahora tienes ${s.mesas} mesas. Máximo 6.` : 'Ya tienes las 6 mesas.',
      costo: s.mesas < 6 ? COSTO_MESA[s.mesas - 2] : null,
      aplicar: s.mesas < 6 ? (x) => ({ ...x, mesas: x.mesas + 1 }) : null,
    },
    unica('matcha', 'Bebidas', 'Matcha', 80, 'Bebida verde, suave y dulce.', s.bebidas.includes('matcha'), (x) => ({
      ...x,
      bebidas: [...x.bebidas, 'matcha'],
    })),
    unica('espuma', 'Bebidas', 'Leche con espuma', 120, 'Con arte de corazón en la espuma.', s.bebidas.includes('espuma'), (x) => ({
      ...x,
      bebidas: [...x.bebidas, 'espuma'],
    })),
    unica('galleta', 'Postres', 'Galleta', 40, 'Galleta de mantequilla recién horneada.', s.postres.includes('galleta'), (x) => ({
      ...x,
      postres: [...x.postres, 'galleta'],
    })),
    unica('donita', 'Postres', 'Donita', 70, 'Donita rosa con glaseado.', s.postres.includes('donita'), (x) => ({
      ...x,
      postres: [...x.postres, 'donita'],
    })),
    unica(
      'cojines',
      'Decoración',
      'Cojines',
      60,
      'Cojines bonitos en cada silla. Llega Mochi, con moño y propina extra.',
      s.deco.includes('cojines'),
      (x) => ({ ...x, deco: [...x.deco, 'cojines'] }),
      `¡Llegó ${ESPECIALES.mochi.nombre.toLowerCase()}! Ya viene a visitarte.`,
    ),
    unica(
      'plantitas',
      'Decoración',
      'Plantitas',
      50,
      'Macetas verdes en la entrada. Llega Pelusa, la gatita más mimosa.',
      s.deco.includes('plantitas'),
      (x) => ({ ...x, deco: [...x.deco, 'plantitas'] }),
      '¡Llegó Pelusa! Ya viene a visitarte.',
    ),
    unica(
      'luces',
      'Decoración',
      'Luces de hadas',
      70,
      'Luces colgadas en la pared. Llega Lunita, la gatita estrella.',
      s.deco.includes('luces'),
      (x) => ({ ...x, deco: [...x.deco, 'luces'] }),
      '¡Llegó Lunita! Ya viene a visitarte.',
    ),
    unica(
      'cuadro',
      'Decoración',
      'Cuadro de gatitos',
      90,
      'Un cuadro con un gatito artista. Llega Bigotes, con sus lentecitos.',
      s.deco.includes('cuadro'),
      (x) => ({ ...x, deco: [...x.deco, 'cuadro'] }),
      '¡Llegó Bigotes! Ya viene a visitarte.',
    ),
  ]
}

// ---------- estado de partida ----------
interface Estacion {
  t: number
  ocupado: boolean
  listo: boolean
}
interface Cat {
  id: number
  esp: Esp | null
  look: Look
  seat: number // -1 si no tiene mesa (cola o saliendo)
  st: CatSt
  t: number
  x: number
  y: number
  pat: number
  patMax: number
  bebida: Bebida
  postre: Postre
  hechoB: boolean
  hechoP: boolean
  precio: number
}
interface Corazon {
  x: number
  y: number
  t: number
  vida: number
  s: number
}
interface Juego {
  fase: Fase
  paused: boolean
  t: number
  dia: number
  quedan: number
  llega: number
  cats: Cat[]
  nextId: number
  est: Record<Item, Estacion>
  bandeja: Item[]
  sel: number
  corazones: Corazon[]
  servidos: number
  propinas: number
  perdidos: number
  ganado: number
  overT: number
  avisoUltimo: boolean
}
interface Ui {
  fase: Fase
  segundos: number
  save: Save
  dia: number
  servidos: number
  propinas: number
  perdidos: number
  ganado: number
  aviso: string | null
}

function juegoBase(dia: number): Juego {
  const est = {} as Record<Item, Estacion>
  for (const id of ITEMS) est[id] = { t: 0, ocupado: false, listo: false }
  return {
    fase: 'menu',
    paused: false,
    t: 0,
    dia,
    quedan: DIA_T,
    llega: 0.8,
    cats: [],
    nextId: 1,
    est,
    bandeja: [],
    sel: -1,
    corazones: [],
    servidos: 0,
    propinas: 0,
    perdidos: 0,
    ganado: 0,
    overT: 0,
    avisoUltimo: false,
  }
}

type Golpe = { k: 'gato'; c: Cat } | { k: 'estacion'; id: Item } | { k: 'ranura'; i: number } | { k: 'basura' }

const TECLA_ITEM: Record<string, Item> = {
  Digit1: 'cafe',
  Digit2: 'chocolate',
  Digit3: 'matcha',
  Digit4: 'espuma',
  Digit5: 'pastel',
  Digit6: 'galleta',
  Digit7: 'donita',
}
const TECLA_RANURA: Record<string, number> = { KeyA: 0, KeyS: 1, KeyD: 2 }
const TECLA_ASIENTO: Record<string, number> = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3, KeyT: 4, KeyY: 5 }

// ---------- sonidos ----------
const sArranca = () => tone({ freq: 520, to: 660, dur: 0.08, type: 'triangle', vol: 0.05 })
const sListo = () => {
  tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.035 })
  tone({ freq: 1319, dur: 0.1, type: 'square', vol: 0.035, delay: 0.06 })
}
const sRecoge = () => tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.05 })
const sMiau = () => {
  tone({ freq: 700, to: 1100, dur: 0.14, type: 'triangle', vol: 0.05 })
  tone({ freq: 1300, dur: 0.12, type: 'sine', vol: 0.04, delay: 0.1 })
}
const sPropina = () => [880, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'square', vol: 0.04, delay: i * 0.07 }))
const sMal = () => tone({ freq: 220, to: 120, dur: 0.14, type: 'sawtooth', vol: 0.04 })
const sTriste = () => tone({ freq: 392, to: 262, dur: 0.35, type: 'triangle', vol: 0.05 })
const sTirar = () => noise({ dur: 0.12, vol: 0.05, freq: 900 })
const sPausa = () => tone({ freq: 520, to: 440, dur: 0.09, type: 'triangle', vol: 0.04 })
const sCierre = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.05, delay: i * 0.1 }))

// ---------- dibujo (funciones puras) ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0]
}

function corazon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.35)
  ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.5, y - s * 1.05, x, y - s * 0.4)
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.05, x + s, y - s * 0.35, x, y + s * 0.35)
  ctx.fill()
}

const PI2 = Math.PI * 2

/** Taza o vaso de bebida centrado en (x, y); `s` es el radio aproximado. */
function taza(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, id: Bebida) {
  const vaso = id === 'espuma' ? '#fde3ef' : id === 'chocolate' ? '#fbd6cc' : id === 'matcha' ? '#eaf7dc' : '#fffaf5'
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(x, y + s * 0.78, s * 0.98, s * 0.2, 0, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = vaso
  ctx.lineWidth = Math.max(1.2, s * 0.22)
  ctx.beginPath()
  ctx.arc(x + s * 0.7, y + s * 0.12, s * 0.3, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
  ctx.fillStyle = vaso
  ctx.beginPath()
  ctx.moveTo(x - s * 0.72, y - s * 0.45)
  ctx.lineTo(x + s * 0.72, y - s * 0.45)
  ctx.lineTo(x + s * 0.5, y + s * 0.68)
  ctx.lineTo(x - s * 0.5, y + s * 0.68)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INFO[id].color
  ctx.beginPath()
  ctx.ellipse(x, y - s * 0.45, s * 0.72, s * 0.2, 0, 0, PI2)
  ctx.fill()
  if (id === 'chocolate') {
    // crema batida encima
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y - s * 0.72, s * 0.3, 0, PI2)
    ctx.fill()
    ctx.fillStyle = '#f472b6'
    ctx.beginPath()
    ctx.arc(x, y - s * 1.0, s * 0.11, 0, PI2)
    ctx.fill()
  } else if (id === 'espuma') {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.5, s * 0.66, s * 0.22, 0, 0, PI2)
    ctx.fill()
    corazon(ctx, x, y - s * 0.5, s * 0.3, '#f472b6')
  } else {
    // vapor de bebida caliente
    ctx.strokeStyle = 'rgba(244,114,182,0.75)'
    ctx.lineWidth = Math.max(0.8, s * 0.1)
    ctx.beginPath()
    ctx.moveTo(x - s * 0.2, y - s * 0.9)
    ctx.quadraticCurveTo(x - s * 0.5, y - s * 1.2, x - s * 0.2, y - s * 1.5)
    ctx.moveTo(x + s * 0.25, y - s * 0.9)
    ctx.quadraticCurveTo(x + s * 0.55, y - s * 1.2, x + s * 0.25, y - s * 1.5)
    ctx.stroke()
  }
}

/** Rebanada de pastel de fresa con cereza. */
function pastelito(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#fde2c4'
  rr(ctx, x - s * 0.72, y - s * 0.12, s * 1.44, s * 0.72, s * 0.14)
  ctx.fill()
  ctx.fillStyle = '#fff7fb'
  ctx.fillRect(x - s * 0.7, y + s * 0.2, s * 1.4, s * 0.14)
  ctx.fillStyle = '#f9a8d4'
  rr(ctx, x - s * 0.8, y - s * 0.5, s * 1.6, s * 0.42, s * 0.18)
  ctx.fill()
  for (const dx of [-0.5, 0, 0.5]) {
    ctx.beginPath()
    ctx.arc(x + dx * s, y - s * 0.1, s * 0.13, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(x, y - s * 0.66, s * 0.18, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x - s * 0.06, y - s * 0.7, s * 0.05, 0, PI2)
  ctx.fill()
}

/** Galleta de mantequilla con chispas de chocolate. */
function galleta(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#d9a46a'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.74, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#ecc28c'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.62, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#5b3420'
  for (const [dx, dy] of [
    [-0.3, -0.22],
    [0.26, -0.3],
    [0.04, 0.12],
    [0.34, 0.2],
    [-0.28, 0.28],
  ]) {
    ctx.beginPath()
    ctx.ellipse(x + dx * s, y + dy * s, s * 0.11, s * 0.08, 0.5, 0, PI2)
    ctx.fill()
  }
}

/** Donita rosa con glaseado y chispitas. */
function donita(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#e8ae68'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.8, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#f9a8d4'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.64, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#fff4e9'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.24, 0, PI2)
  ctx.fill()
  const colores = ['#60a5fa', '#fde047', '#86efac', '#c4b5fd', '#ffffff']
  colores.forEach((c, k) => {
    const a = 0.4 + k * 1.25
    ctx.strokeStyle = c
    ctx.lineWidth = Math.max(1, s * 0.13)
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36)
    ctx.lineTo(x + Math.cos(a) * s * 0.54, y + Math.sin(a) * s * 0.54)
    ctx.stroke()
  })
}

/** Icono de bebida o postre centrado en (x, y); `s` es el radio aproximado. */
function icono(ctx: CanvasRenderingContext2D, x: number, y: number, id: Item, s: number) {
  if (esBebida(id)) taza(ctx, x, y, s, id)
  else if (id === 'pastel') pastelito(ctx, x, y, s)
  else if (id === 'galleta') galleta(ctx, x, y, s)
  else donita(ctx, x, y, s)
}

/** Candadito de las cosas que aún no se compran. */
function candado(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color
  rr(ctx, x - s * 0.5, y - s * 0.05, s, s * 0.8, s * 0.18)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, s * 0.16)
  ctx.beginPath()
  ctx.arc(x, y - s * 0.05, s * 0.32, Math.PI, 0)
  ctx.stroke()
}

/** Moneda y precio (en mayúsculas de la fuente pixel ya fijada en ctx.font). */
function precio(ctx: CanvasRenderingContext2D, x: number, y: number, costo: number) {
  ctx.fillStyle = '#fde047'
  ctx.beginPath()
  ctx.arc(x - 7, y, 4, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.fillStyle = '#7a4a3a'
  ctx.textAlign = 'left'
  ctx.fillText(String(costo), x - 2, y)
  ctx.textAlign = 'center'
}

/** Máquina de bebidas de frente, dibujada según cuál es. Bloqueada: gris y tenue. */
function maquina(ctx: CanvasRenderingContext2D, id: Bebida, bx: number, by: number, bw: number, bh: number, abierta: boolean) {
  const cx = bx + bw / 2
  const cuerpo = abierta ? INFO[id].maquina : '#dcd3d6'
  ctx.fillStyle = cuerpo
  ctx.strokeStyle = '#9a6a5a'
  ctx.lineWidth = 1.6
  if (id === 'chocolate') {
    // olla de chocolate con tapa de bolita y asas
    ctx.beginPath()
    ctx.arc(bx + bw * 0.1, by + bh * 0.62, bh * 0.14, Math.PI / 2, (Math.PI * 3) / 2)
    ctx.arc(bx + bw * 0.9, by + bh * 0.62, bh * 0.14, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    rr(ctx, bx + bw * 0.1, by + bh * 0.46, bw * 0.8, bh * 0.54, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cx, by + bh * 0.46, bw * 0.42, bh * 0.12, 0, 0, PI2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#6b3a2a'
    ctx.beginPath()
    ctx.ellipse(cx, by + bh * 0.46, bw * 0.34, bh * 0.08, 0, 0, PI2)
    ctx.fill()
    ctx.fillStyle = '#6b3a2a'
    ctx.beginPath()
    ctx.arc(cx - bw * 0.2, by + bh * 0.6, 1.6, 0, PI2)
    ctx.arc(cx + bw * 0.16, by + bh * 0.66, 1.3, 0, PI2)
    ctx.fill()
    return
  }
  rr(ctx, bx, by + 2, bw, bh - 2, 8)
  ctx.fill()
  ctx.stroke()
  if (id === 'cafe') {
    // cafetera espresso: manómetro, botón y cabezal
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(bx + bw * 0.22, by + bh * 0.56, 4.6, 0, PI2)
    ctx.fill()
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx + bw * 0.22, by + bh * 0.56)
    ctx.lineTo(bx + bw * 0.22 + 3, by + bh * 0.56 - 2.5)
    ctx.stroke()
    ctx.fillStyle = '#f472b6'
    ctx.beginPath()
    ctx.arc(bx + bw * 0.8, by + bh * 0.56, 2.4, 0, PI2)
    ctx.fill()
    ctx.fillStyle = '#8a5a4a'
    rr(ctx, cx - 7, by + bh * 0.7, 14, 5, 2)
    ctx.fill()
    rr(ctx, cx - 2.2, by + bh * 0.7 + 5, 4.4, 3.5, 1.2)
    ctx.fill()
  } else if (id === 'matcha') {
    // batidora de matcha: cuenco verde y chasen (batidor de bambú)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cx, by + bh * 0.74, bw * 0.34, bh * 0.14, 0, 0, PI2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#5a9e4b'
    ctx.beginPath()
    ctx.ellipse(cx, by + bh * 0.72, bw * 0.3, bh * 0.08, 0, 0, PI2)
    ctx.fill()
    ctx.strokeStyle = '#b8895a'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(cx, by + bh * 0.26)
    ctx.lineTo(cx, by + bh * 0.6)
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(cx, by + bh * 0.46, 3, 5, 0, 0, PI2)
    ctx.stroke()
  } else {
    // espumador de leche: jarra con corazón y vapor
    ctx.fillStyle = '#ffffff'
    rr(ctx, cx - bw * 0.22, by + bh * 0.42, bw * 0.44, bh * 0.44, 5)
    ctx.fill()
    ctx.stroke()
    corazon(ctx, cx, by + bh * 0.7, 3.2, '#f472b6')
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(bx + bw * 0.78, by + bh * 0.26)
    ctx.lineTo(bx + bw * 0.9, by + bh * 0.72)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.arc(bx + bw * 0.3, by + bh * 0.3, 2.4, 0, PI2)
    ctx.arc(bx + bw * 0.4, by + bh * 0.2, 1.6, 0, PI2)
    ctx.fill()
  }
}

/** Gatito sentado de frente, a escala SC. (x, y) son sus patas. Cola, cachetes y accesorios de los especiales. */
function dibujarGato(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, esp: Esp | null, st: CatSt, t: number) {
  const salto = st === 'entra' || st === 'sale' || st === 'triste' ? Math.abs(Math.sin(t * 10)) * 3 : st === 'feliz' ? Math.abs(Math.sin(t * 14)) * 6 : 0
  const respira = st === 'espera' ? Math.sin(t * 2.6) * 0.8 : 0
  const escala = st === 'feliz' ? 1 + Math.sin(t * 22) * 0.04 : 1
  const cola = st === 'feliz' ? Math.sin(t * 18) * 6 : st === 'espera' ? Math.sin(t * 4) * 3 : 0
  const parpadea = st === 'espera' && t % 3.4 < 0.14
  const acento = esp ? ESPECIALES[esp].acento : '#f472b6'

  ctx.save()
  ctx.translate(x, y - salto + respira)
  ctx.scale(escala * SC, escala * SC)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // cola, que se mueve al ronronear
  ctx.strokeStyle = look.cuerpo
  ctx.lineWidth = 3.4
  ctx.beginPath()
  ctx.moveTo(7, -5)
  ctx.bezierCurveTo(19, -4, 18 + cola * 0.2, -14, 14 + cola * 0.3, -22)
  ctx.stroke()

  // cuerpo chiquito, panza y patitas
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.ellipse(0, -10, 10, 9, 0, 0, PI2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-4.5, -1.6, 3.6, 2.2, 0, 0, PI2)
  ctx.ellipse(4.5, -1.6, 3.6, 2.2, 0, 0, PI2)
  ctx.fill()
  ctx.fillStyle = look.panza
  ctx.beginPath()
  ctx.ellipse(0, -8.5, 5.5, 5, 0, 0, PI2)
  ctx.fill()
  if (look.parche) {
    ctx.fillStyle = look.parche
    ctx.beginPath()
    ctx.ellipse(4.5, -13, 3.6, 3.2, 0.3, 0, PI2)
    ctx.fill()
  }

  // orejas: exterior, interior y luego la cabeza encima
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.moveTo(-10, -33)
  ctx.lineTo(-11.5, -44)
  ctx.lineTo(-2.5, -37.5)
  ctx.moveTo(10, -33)
  ctx.lineTo(11.5, -44)
  ctx.lineTo(2.5, -37.5)
  ctx.fill()
  ctx.fillStyle = look.oreja
  ctx.beginPath()
  ctx.moveTo(-8.2, -35.5)
  ctx.lineTo(-9.4, -40.6)
  ctx.lineTo(-4.6, -37.2)
  ctx.moveTo(8.2, -35.5)
  ctx.lineTo(9.4, -40.6)
  ctx.lineTo(4.6, -37.2)
  ctx.fill()

  // cabeza grande y redonda
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.arc(0, -28, 12.5, 0, PI2)
  ctx.fill()
  if (look.parche) {
    ctx.fillStyle = look.parche
    ctx.beginPath()
    ctx.ellipse(-6.5, -33, 4.2, 3.6, -0.4, 0, PI2)
    ctx.fill()
  }
  if (look.rayas) {
    ctx.strokeStyle = 'rgba(120,70,40,0.5)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-3, -39)
    ctx.lineTo(-2.2, -35.5)
    ctx.moveTo(0, -40)
    ctx.lineTo(0, -36)
    ctx.moveTo(3, -39)
    ctx.lineTo(2.2, -35.5)
    ctx.stroke()
  }

  // ojos grandes con brillo
  ctx.strokeStyle = '#3b2a3a'
  ctx.fillStyle = '#3b2a3a'
  ctx.lineWidth = 1.5
  for (const ex of [-4.6, 4.6]) {
    if (st === 'feliz') {
      ctx.beginPath()
      ctx.arc(ex, -28, 2.3, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else if (st === 'triste') {
      ctx.beginPath()
      ctx.arc(ex, -27.5, 1.8, 0, PI2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(ex - 2.8, -32.5)
      ctx.lineTo(ex + 2.8, -31.2)
      ctx.stroke()
    } else if (parpadea) {
      ctx.beginPath()
      ctx.moveTo(ex - 2.4, -27.5)
      ctx.lineTo(ex + 2.4, -27.5)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(ex, -27.5, 2.2, 2.7, 0, 0, PI2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex + 0.7, -28.6, 0.85, 0, PI2)
      ctx.fill()
      ctx.fillStyle = '#3b2a3a'
    }
  }

  // nariz, cachetes, boquita y bigotes
  ctx.fillStyle = '#f472b6'
  ctx.beginPath()
  ctx.moveTo(0, -24.6)
  ctx.lineTo(-1.2, -25.8)
  ctx.lineTo(1.2, -25.8)
  ctx.fill()
  ctx.fillStyle = 'rgba(244,114,182,0.5)'
  ctx.beginPath()
  ctx.ellipse(-7.5, -23, 2.6, 1.6, 0, 0, PI2)
  ctx.ellipse(7.5, -23, 2.6, 1.6, 0, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = '#3b2a3a'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.arc(-1.5, -23.2, 1.5, 0, Math.PI)
  ctx.arc(1.5, -23.2, 1.5, 0, Math.PI)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(60,40,60,0.35)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 8, -24.5)
    ctx.lineTo(s * 15, -25.8)
    ctx.moveTo(s * 8, -22.8)
    ctx.lineTo(s * 15, -22.2)
  }
  ctx.stroke()

  // accesorios de los gatitos especiales
  if (esp === 'mochi') {
    // moñito rosa
    ctx.fillStyle = acento
    ctx.beginPath()
    ctx.moveTo(9, -41)
    ctx.lineTo(3, -45)
    ctx.lineTo(3, -37)
    ctx.moveTo(9, -41)
    ctx.lineTo(15, -45)
    ctx.lineTo(15, -37)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(9, -41, 2, 0, PI2)
    ctx.fill()
  } else if (esp === 'pelusa') {
    // corona de florecitas
    ctx.fillStyle = '#fde68a'
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 4.5, -43 + Math.sin(a) * 2, 2, 0, PI2)
      ctx.fill()
    }
    ctx.fillStyle = '#fb7185'
    ctx.beginPath()
    ctx.arc(0, -43, 1.6, 0, PI2)
    ctx.fill()
  } else if (esp === 'lunita') {
    // estrellita sobre la cabeza
    ctx.fillStyle = acento
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 4.6 : 2
      const a = -Math.PI / 2 + (k / 10) * PI2
      ctx.lineTo(Math.cos(a) * r, -54 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  } else if (esp === 'bigotes') {
    // monoclito
    ctx.strokeStyle = '#4b5563'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(-4.6, -27.5, 3.8, 0, PI2)
    ctx.arc(4.6, -27.5, 3.8, 0, PI2)
    ctx.moveTo(-0.8, -27.5)
    ctx.lineTo(0.8, -27.5)
    ctx.stroke()
  }
  ctx.restore()
}

/** Burbuja del pedido con paciencia (barra) sobre el gatito sentado. */
function dibujarBurbuja(ctx: CanvasRenderingContext2D, c: Cat, pf: string) {
  const x = c.x
  const y = c.y - 84
  rr(ctx, x - 29, y - 13, 58, 26, 9)
  ctx.fillStyle = '#fffaf5'
  ctx.fill()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fffaf5'
  ctx.beginPath()
  ctx.moveTo(x - 4, y + 12)
  ctx.lineTo(x + 4, y + 12)
  ctx.lineTo(x, y + 18)
  ctx.closePath()
  ctx.fill()

  ctx.save()
  ctx.globalAlpha = c.hechoB ? 0.3 : 1
  icono(ctx, x - 14, y - 2, c.bebida, 8)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = c.hechoP ? 0.3 : 1
  icono(ctx, x + 14, y - 2, c.postre, 8)
  ctx.restore()

  const r = clamp(c.pat / c.patMax, 0, 1)
  ctx.fillStyle = '#fde7ef'
  ctx.fillRect(x - 23, y + 7, 46, 4)
  ctx.fillStyle = r > 0.5 ? '#86efac' : r > 0.25 ? '#fde047' : '#f87171'
  ctx.fillRect(x - 23, y + 7, 46 * r, 4)

  if (c.esp) {
    ctx.font = `6px ${pf}`
    ctx.fillStyle = ESPECIALES[c.esp].acento
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ESPECIALES[c.esp].nombre, x, c.y + 22)
  }
}

/** Silla con respaldo rosa; el gatito queda sentado delante del respaldo. */
function silla(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#f7a6c1'
  rr(ctx, x - 15, y - 44, 30, 34, 12)
  ctx.fill()
  ctx.fillStyle = '#fbc9da'
  rr(ctx, x - 10, y - 38, 20, 22, 9)
  ctx.fill()
  ctx.fillStyle = '#f7a6c1'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, 17, 5.5, 0, 0, PI2)
  ctx.fill()
}

/** Cojín en el asiento. */
function cojin(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#fde2ef'
  ctx.beginPath()
  ctx.ellipse(x, y, 14, 4.2, 0, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#f9a8d4'
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath()
    ctx.arc(x + dx, y, 1, 0, PI2)
    ctx.fill()
  }
}

/** Mesa redonda con mantel; las bloqueadas son un círculo punteado. */
function mesa(ctx: CanvasRenderingContext2D, x: number, y: number, activa: boolean) {
  if (!activa) {
    ctx.beginPath()
    ctx.ellipse(x, y, 24, 8, 0, 0, PI2)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(160,110,80,0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
    return
  }
  ctx.fillStyle = '#e4b696'
  ctx.fillRect(x - 2.5, y, 5, 9)
  ctx.beginPath()
  ctx.ellipse(x, y + 9, 9, 2.8, 0, 0, PI2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x, y, 25, 9, 0, 0, PI2)
  ctx.fillStyle = '#fff3e6'
  ctx.fill()
  ctx.strokeStyle = '#f0b3c6'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x, y, 18.5, 6, 0, 0, PI2)
  ctx.strokeStyle = 'rgba(249,168,212,0.55)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function planta(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#f0a58a'
  ctx.beginPath()
  ctx.moveTo(x - 8, y - 2)
  ctx.lineTo(x + 8, y - 2)
  ctx.lineTo(x + 6, y + 12)
  ctx.lineTo(x - 6, y + 12)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#86d6a0'
  for (const [dx, dy, r] of [
    [-7, -12, 7],
    [0, -18, 8],
    [7, -11, 6],
  ]) {
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, r, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = '#f9a8d4'
  ctx.beginPath()
  ctx.arc(x + 2, y - 22, 2.6, 0, PI2)
  ctx.fill()
}

function lucesDeHadas(ctx: CanvasRenderingContext2D, y: number, t: number) {
  ctx.strokeStyle = 'rgba(120,90,80,0.35)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let x = 0; x <= W; x += 4) {
    const yy = y + Math.sin((x / W) * Math.PI) * 10
    if (x === 0) ctx.moveTo(x, yy)
    else ctx.lineTo(x, yy)
  }
  ctx.stroke()
  const cols = ['#fda4af', '#fde68a', '#a7f3d0', '#c4b5fd']
  const n = Math.max(6, Math.round(W / 40))
  for (let i = 0; i <= n; i++) {
    const x = (W * i) / n
    const yy = y + Math.sin((x / W) * Math.PI) * 10 + 3
    ctx.globalAlpha = 0.25 * (0.55 + 0.45 * Math.sin(t * 3 + i))
    ctx.fillStyle = cols[i % cols.length]
    ctx.beginPath()
    ctx.arc(x, yy, 8, 0, PI2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(x, yy, 3.2, 0, PI2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Cuadrito en la pared: un gatito si ya se compró; si no, un corazón. */
function cuadroGatito(ctx: CanvasRenderingContext2D, x: number, y: number, conGatito: boolean) {
  ctx.fillStyle = '#c9a27e'
  rr(ctx, x, y, 30, 22, 4)
  ctx.fill()
  ctx.fillStyle = '#fff1e6'
  rr(ctx, x + 3, y + 3, 24, 16, 3)
  ctx.fill()
  if (conGatito) {
    ctx.fillStyle = '#f7c27a'
    ctx.beginPath()
    ctx.arc(x + 15, y + 12, 5.5, 0, PI2)
    ctx.moveTo(x + 10, y + 8)
    ctx.lineTo(x + 9.5, y + 3.5)
    ctx.lineTo(x + 13, y + 6.5)
    ctx.moveTo(x + 20, y + 8)
    ctx.lineTo(x + 20.5, y + 3.5)
    ctx.lineTo(x + 17, y + 6.5)
    ctx.fill()
  } else {
    corazon(ctx, x + 15, y + 12, 5, '#f9a8d4')
  }
}

/** Ventana con cielo rosa, nube que pasa y cortinas. */
function ventana(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillStyle = '#ffffff'
  rr(ctx, x - 4, y - 4, w + 8, h + 8, 8)
  ctx.fill()
  const cielo = ctx.createLinearGradient(0, y, 0, y + h)
  cielo.addColorStop(0, '#bfe3ff')
  cielo.addColorStop(1, '#ffd6e8')
  ctx.fillStyle = cielo
  rr(ctx, x, y, w, h, 5)
  ctx.fill()
  ctx.save()
  rr(ctx, x, y, w, h, 5)
  ctx.clip()
  const nx = x - 20 + ((t * 7) % (w + 40))
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.arc(nx, y + h * 0.62, h * 0.12, 0, PI2)
  ctx.arc(nx + h * 0.14, y + h * 0.52, h * 0.16, 0, PI2)
  ctx.arc(nx + h * 0.3, y + h * 0.62, h * 0.12, 0, PI2)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + w / 2 - 1.5, y, 3, h)
  ctx.fillRect(x, y + h / 2 - 1.5, w, 3)
  ctx.fillStyle = 'rgba(249,168,212,0.92)'
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 8)
  ctx.lineTo(x + w * 0.22, y - 8)
  ctx.lineTo(x + w * 0.14, y + h * 0.85)
  ctx.lineTo(x - 6, y + h * 0.7)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + w + 6, y - 8)
  ctx.lineTo(x + w * 0.78, y - 8)
  ctx.lineTo(x + w * 0.86, y + h * 0.85)
  ctx.lineTo(x + w + 6, y + h * 0.7)
  ctx.closePath()
  ctx.fill()
}

/** Pizarrón con el menú a mano. */
function pizarra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pf: string) {
  ctx.fillStyle = '#c9956e'
  rr(ctx, x - 4, y - 4, w + 8, h + 8, 6)
  ctx.fill()
  ctx.fillStyle = '#3f4f4c'
  rr(ctx, x, y, w, h, 4)
  ctx.fill()
  ctx.fillStyle = '#f9f1e7'
  ctx.font = `7px ${pf}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MENU', x + w / 2, y + h * 0.2)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1.2
  for (let k = 0; k < 3; k++) {
    const yy = y + h * (0.46 + k * 0.18)
    ctx.beginPath()
    ctx.moveTo(x + w * 0.14, yy)
    ctx.lineTo(x + w * (0.66 - k * 0.08), yy)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + w * 0.8, yy, 1.8, 0, PI2)
    ctx.fillStyle = k === 1 ? '#f9a8d4' : '#fde047'
    ctx.fill()
  }
  corazon(ctx, x + w * 0.84, y + h * 0.2, 3, '#f9a8d4')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** Lámpara colgante con brillo cálido. */
function lampara(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.strokeStyle = 'rgba(120,90,80,0.5)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, 14)
  ctx.stroke()
  const glow = ctx.createRadialGradient(x, 26, 2, x, 26, 46)
  glow.addColorStop(0, `rgba(255,236,160,${0.35 + 0.05 * Math.sin(t * 2)})`)
  glow.addColorStop(1, 'rgba(255,236,160,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, 26, 46, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#f9a8d4'
  ctx.beginPath()
  ctx.moveTo(x - 13, 26)
  ctx.quadraticCurveTo(x, 4, x + 13, 26)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff7ad'
  ctx.beginPath()
  ctx.arc(x, 26, 3, 0, PI2)
  ctx.fill()
}

/** Tapete ovalado en el piso. */
function alfombra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#f8cfe0'
  rr(ctx, x, y, w, h, h * 0.5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  rr(ctx, x + 6, y + 6, w - 12, h - 12, h * 0.42)
  ctx.stroke()
  ctx.setLineDash([])
}

// ---------- tienda (HTML) ----------
const pixel = { fontFamily: 'var(--font-pixel)' }

function Tienda({
  save,
  aviso,
  onComprar,
  onVolver,
  onAbrir,
}: {
  save: Save
  aviso: string | null
  onComprar: (op: Opcion) => void
  onVolver: () => void
  onAbrir: () => void
}) {
  const ops = opciones(save)
  const grupos = ['Máquinas', 'Mesas', 'Bebidas', 'Postres', 'Decoración']
  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain bg-[#fde4cf]/95 text-[#5b2350]"
      style={{ background: 'radial-gradient(circle at 50% 0%, #fbcfe8 0%, transparent 65%), #fff4ea' }}
    >
      <div className="mx-auto flex min-h-full max-w-sm flex-col gap-3 px-5 py-4">
        <p className="pt-2 text-center text-sm" style={{ ...pixel, color: '#db2777', textShadow: '2px 2px 0 #ffffff' }}>
          TIENDA
        </p>
        <p className="text-center text-xs text-[#7c2d5e]">
          Monedas: <span className="font-semibold text-amber-600">{save.monedas}</span>
        </p>
        {aviso && (
          <p className="rounded-xl border border-pink-200 bg-white/80 px-3 py-2 text-center text-xs font-medium text-[#be185d]">
            {aviso}
          </p>
        )}
        {grupos.map((grupo) => (
          <section key={grupo} className="flex flex-col gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#b0628a]">{grupo}</h3>
            {ops
              .filter((o) => o.grupo === grupo)
              .map((o) => {
                const puede = o.aplicar !== null && o.costo !== null && save.monedas >= o.costo
                return (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-2xl border-2 border-white bg-white/85 px-3 py-2 shadow-[0_3px_10px_rgba(190,80,140,0.12)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#5b2350]">{o.titulo}</p>
                      <p className="text-[11px] leading-snug text-[#7c2d5e]/75">{o.detalle}</p>
                    </div>
                    {o.costo === null ? (
                      <span className="shrink-0 text-xs text-[#a78bb0]">Listo</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!puede}
                        onClick={(e) => {
                          e.currentTarget.blur()
                          onComprar(o)
                        }}
                        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-[#5b2350] shadow-[0_2px_0_rgba(190,80,140,0.35)] transition enabled:active:translate-y-0.5 disabled:bg-[#eadbe6] disabled:text-[#a78bb0] disabled:shadow-none"
                        style={puede ? { background: ACCENT } : undefined}
                      >
                        {o.costo}
                      </button>
                    )}
                  </div>
                )
              })}
          </section>
        ))}
        <div className="mt-2 flex flex-col items-center gap-2 pb-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur()
              onAbrir()
            }}
            className="rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95"
          >
            Abrir el día {save.dia}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur()
              onVolver()
            }}
            className="rounded-full px-4 py-1.5 text-xs text-[#7c2d5e] underline underline-offset-4 transition active:scale-95"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- menú de inicio (pastel, como el resto de pantallas) ----------
function MenuInicio({ save, onJugar, onTienda }: { save: Save; onJugar: () => void; onTienda: () => void }) {
  const touch = useIsTouch()
  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain bg-[#fde4cf]/95 text-[#5b2350]"
      style={{ background: 'radial-gradient(circle at 50% 35%, #fbcfe8 0%, transparent 65%), #fff4ea' }}
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-5 py-4 text-center">
        <p className="text-base leading-relaxed sm:text-xl" style={{ ...pixel, color: '#db2777', textShadow: '2px 2px 0 #ffffff' }}>
          CAFE MICHI
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-[#7c2d5e]">
          Prepara cafés, chocolates y postres para los gatitos. Toca una máquina y luego al gatito con su pedido.
        </p>
        <p className="text-xs text-[#7c2d5e]/80">
          Día {save.dia} · {save.monedas} monedas
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur()
            onJugar()
          }}
          className="mt-1 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95"
        >
          Jugar
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur()
            onTienda()
          }}
          className="rounded-full border border-[#7c2d5e]/30 bg-white/80 px-5 py-2 text-xs transition active:scale-95"
          style={{ color: '#7c2d5e' }}
        >
          Tienda
        </button>
        <p className="max-w-[17rem] text-[11px] leading-relaxed text-[#7c2d5e]/75">
          Los gatitos se van tristes si esperan mucho. Con teclado: 1-7 máquinas, A S D elige en la bandeja, Q W E R T Y entrega a cada mesa.
        </p>
        <p className="blink text-[10px] text-[#be185d]" style={pixel}>
          {touch ? 'Toca Jugar para abrir el día' : 'Pulsa ESPACIO para abrir el día'}
        </p>
      </div>
    </div>
  )
}

// ---------- componente ----------
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export default function CafeMichi() {
  const { justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const saveRef = useRef<Save>(nuevoSave())
  const actionsRef = useRef({
    iniciarDia: () => {},
    abrirTienda: () => {},
    irMenu: () => {},
  })
  const [ui, setUi] = useState<Ui>(() => ({
    fase: 'menu',
    segundos: DIA_T,
    save: nuevoSave(),
    dia: 1,
    servidos: 0,
    propinas: 0,
    perdidos: 0,
    ganado: 0,
    aviso: null,
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(6)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    saveRef.current = leerSave()

    let g = juegoBase(saveRef.current.dia)
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()

    // ---------- sincronía con React ----------
    const sync = () => {
      setUi((u) => ({
        ...u,
        fase: g.fase,
        segundos: Math.ceil(g.quedan),
        save: { ...saveRef.current },
        dia: g.dia,
        servidos: g.servidos,
        propinas: g.propinas,
        perdidos: g.perdidos,
        ganado: g.ganado,
      }))
    }

    // ---------- control de fases ----------
    const iniciarDia = () => {
      g = juegoBase(saveRef.current.dia)
      g.fase = 'dia'
      juice.reset()
      sArranca()
      sync()
    }
    const abrirTienda = () => {
      g.fase = 'tienda'
      g.paused = false
      sync()
    }
    const irMenu = () => {
      g.fase = 'menu'
      g.paused = false
      sync()
    }
    actionsRef.current = { iniciarDia, abrirTienda, irMenu }

    const terminarDia = () => {
      g.fase = 'resumen'
      g.overT = 0
      g.corazones = []
      const sv = { ...saveRef.current, dia: saveRef.current.dia + 1 }
      saveRef.current = sv
      writeSave(sv)
      juice.flash('#fde047', 0.25)
      sCierre()
      sync()
    }

    // ---------- clientes ----------
    const colaOrdenada = () => g.cats.filter((c) => c.st === 'cola').sort((a, b) => a.id - b.id)
    const asientoLibre = () => {
      for (let s = 0; s < saveRef.current.mesas; s++) {
        if (!g.cats.some((c) => c.seat === s)) return s
      }
      return -1
    }
    /** Sienta al primero de la cola si hay mesa libre. */
    const promoverCola = () => {
      let libre = asientoLibre()
      while (libre >= 0) {
        const primero = colaOrdenada()[0]
        if (!primero) break
        primero.st = 'entra'
        primero.seat = libre
        primero.t = 0
        libre = asientoLibre()
      }
    }

    const emitir = (c: Cat, n: number) => {
      for (let k = 0; k < n; k++) {
        g.corazones.push({
          x: c.x + (Math.random() * 20 - 10),
          y: c.y - 40 + Math.random() * 8,
          t: 0,
          vida: 1.1 + Math.random() * 0.5,
          s: 4 + Math.random() * 3,
        })
      }
    }

    const spawnCat = () => {
      const sv = saveRef.current
      const libre = asientoLibre()
      if (libre < 0 && colaOrdenada().length >= COLA_MAX) {
        g.perdidos++
        sync()
        return
      }
      const esps = ESP_IDS.filter((e) => sv.deco.includes(ESPECIALES[e].deco))
      const esp = esps.length > 0 && Math.random() < 0.3 ? pick(esps) : null
      const bebida = pick(sv.bebidas)
      const postre = pick(sv.postres)
      const patMax = esp ? PACIENCIA * 1.15 : PACIENCIA
      const inicioY = libre >= 0 ? G.asientos[libre].y : G.cola[0].y
      g.cats.push({
        id: g.nextId++,
        esp,
        look: esp ? ESPECIALES[esp].look : pick(LOOKS),
        seat: libre,
        st: libre >= 0 ? 'entra' : 'cola',
        t: 0,
        x: -34,
        y: inicioY,
        pat: patMax,
        patMax,
        bebida,
        postre,
        hechoB: false,
        hechoP: false,
        precio: INFO[bebida].precio + INFO[postre].precio,
      })
    }

    const irseTriste = (c: Cat) => {
      c.st = 'triste'
      c.t = 0
      c.seat = -1
      g.perdidos++
      juice.text(c.x, c.y - 60, 'SE FUE', '#94a3b8', 8, 1)
      sTriste()
      promoverCola()
      sync()
    }

    const encaja = (c: Cat, it: Item | undefined) =>
      it !== undefined && ((it === c.bebida && !c.hechoB) || (it === c.postre && !c.hechoP))

    const fallo = (c: Cat, msg: string) => {
      juice.shake(0.12)
      sMal()
      juice.text(c.x, c.y - 60, msg, '#f87171', 7, 0.9)
    }

    /** Entrega el elemento seleccionado (o el primero que encaje) al gatito sentado. */
    const tocarGato = (c: Cat) => {
      const idx = g.sel >= 0 ? g.sel : g.bandeja.findIndex((it) => encaja(c, it))
      if (idx < 0 || !encaja(c, g.bandeja[idx])) {
        fallo(c, g.sel >= 0 ? 'NO ES SU PEDIDO' : 'FALTA ALGO')
        return
      }
      const it = g.bandeja[idx]
      g.bandeja.splice(idx, 1)
      g.sel = -1
      if (it === c.bebida && !c.hechoB) c.hechoB = true
      else c.hechoP = true
      sMiau()
      if (c.hechoB && c.hechoP) {
        const ratio = clamp(c.pat / c.patMax, 0, 1)
        const propina = Math.round(c.precio * 0.6 * ratio * (c.esp ? 1.5 : 1))
        const total = c.precio + propina
        g.servidos++
        g.propinas += propina
        g.ganado += total
        saveRef.current.monedas += total
        writeSave(saveRef.current) // que las monedas del día sobrevivan a una recarga
        c.st = 'feliz'
        c.t = 0
        c.seat = -1
        juice.freeze(60)
        juice.shake(0.15)
        juice.text(c.x, c.y - 66, `+${total}`, '#fde047', 12, 1.1)
        if (propina > 0) juice.text(c.x, c.y - 50, `PROPINA ${propina}`, ACCENT, 7, 1.1)
        emitir(c, 6)
        sPropina()
        promoverCola()
        sync()
      } else {
        juice.text(c.x, c.y - 60, 'BIEN', '#fde047', 8, 0.8)
        emitir(c, 2)
      }
    }

    const updateCats = (dt: number) => {
      const cola = colaOrdenada()
      for (const c of g.cats) {
        c.t += dt
        let tx = c.x
        let ty = c.y
        if (c.st === 'cola') {
          c.pat -= dt
          const q = G.cola[Math.min(Math.max(0, cola.indexOf(c)), G.cola.length - 1)]
          tx = q.x
          ty = q.y
          if (c.pat <= 0) {
            irseTriste(c)
            continue
          }
        } else if (c.st === 'entra' || c.st === 'espera') {
          const a = G.asientos[c.seat]
          tx = a.x
          ty = a.y
          if (c.st === 'espera') {
            c.pat -= dt
            if (c.pat <= 0) {
              irseTriste(c)
              continue
            }
          } else if (c.t > 0.3 && Math.abs(c.x - tx) < 4) {
            c.st = 'espera'
            c.t = 0
          }
        } else if (c.st === 'feliz') {
          tx = c.x
          ty = c.y
          if (c.t > 0.8) {
            c.st = 'sale'
            c.t = 0
          }
        } else if (c.st === 'sale') {
          tx = W + 80
        } else if (c.st === 'triste') {
          tx = -80
        }
        const k = 1 - Math.exp(-dt * 4)
        c.x += (tx - c.x) * k
        c.y += (ty - c.y) * k
      }
      g.cats = g.cats.filter((c) => !((c.st === 'sale' || c.st === 'triste') && (c.x < -60 || c.x > W + 60)))
    }

    // ---------- máquinas ----------
    const tocarEstacion = (id: Item) => {
      const r = G.estacion[id]
      const x = (r.x0 + r.x1) / 2
      const y = r.y0 + 20
      if (!desbloqueado(saveRef.current, id)) {
        juice.text(x, y, 'EN LA TIENDA', '#e2e8f0', 6, 0.9)
        return
      }
      const e = g.est[id]
      if (e.listo && g.bandeja.length >= BANDEJA_CAP) {
        juice.text(x, y, 'BANDEJA LLENA', '#fca5a5', 6, 0.9)
        return
      }
      if (e.ocupado || e.listo) return
      e.ocupado = true
      e.t = tiempoPreparar(saveRef.current, id)
      sArranca()
    }

    const avanzarEstacion = (id: Item, dt: number) => {
      const e = g.est[id]
      if (e.ocupado) {
        e.t -= dt
        if (e.t <= 0) {
          e.ocupado = false
          e.listo = true
          sListo()
        }
      }
      if (e.listo && g.bandeja.length < BANDEJA_CAP) {
        e.listo = false
        g.bandeja.push(id)
        const r = G.estacion[id]
        juice.burst((r.x0 + r.x1) / 2, r.y0 + 8, INFO[id].color, {
          count: 6,
          speed: 60,
          life: 0.4,
          size: 3,
          angle: -Math.PI / 2,
          arc: Math.PI * 0.8,
        })
        sRecoge()
      }
    }

    // ---------- bandeja ----------
    const tocarRanura = (i: number) => {
      if (i >= g.bandeja.length) {
        g.sel = -1
        return
      }
      g.sel = g.sel === i ? -1 : i
      sRecoge()
    }
    const tirar = () => {
      if (g.sel < 0) {
        juice.text(W / 2, G.bandejaT - 6, 'ELIGE UNO', '#ffffff', 7, 0.9)
        return
      }
      g.bandeja.splice(g.sel, 1)
      g.sel = -1
      juice.burst(W * 0.88, G.bandejaT + 20, '#94a3b8', { count: 8, speed: 90, life: 0.4, size: 3 })
      juice.text(W * 0.88, G.bandejaT - 6, 'TIRADO', '#e2e8f0', 6, 0.8)
      sTirar()
    }

    // ---------- entrada ----------
    const golpeEn = (x: number, y: number): Golpe | null => {
      for (const c of g.cats) {
        if (c.st === 'espera' && Math.abs(x - c.x) < 26 && y > c.y - 70 && y < c.y + 12) return { k: 'gato', c }
      }
      for (const id of ITEMS) {
        const r = G.estacion[id]
        if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return { k: 'estacion', id }
      }
      for (let i = 0; i < G.ranuras.length; i++) {
        const r = G.ranuras[i]
        if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return { k: 'ranura', i }
      }
      const b = G.basura
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return { k: 'basura' }
      return null
    }

    const tocar = (x: number, y: number) => {
      const h = golpeEn(x, y)
      if (!h) return
      if (h.k === 'gato') tocarGato(h.c)
      else if (h.k === 'estacion') tocarEstacion(h.id)
      else if (h.k === 'ranura') tocarRanura(h.i)
      else tirar()
    }

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.fase !== 'dia') return
      const r = canvas.getBoundingClientRect()
      tocar(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (g.fase !== 'dia' || g.paused || e.repeat || isTyping(e.target)) return
      const it = TECLA_ITEM[e.code] as Item | undefined
      if (it) {
        e.preventDefault()
        tocarEstacion(it)
        return
      }
      const ranura = TECLA_RANURA[e.code] as number | undefined
      if (ranura !== undefined) {
        tocarRanura(ranura)
        return
      }
      const asiento = TECLA_ASIENTO[e.code] as number | undefined
      if (asiento !== undefined) {
        const c = g.cats.find((k) => k.seat === asiento && k.st === 'espera')
        if (c) tocarGato(c)
        return
      }
      if (e.code === 'KeyX') tirar()
    }

    const onBlur = () => {
      if (g.fase === 'dia') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    // ---------- actualización ----------
    const avanzarHorario = (dt: number) => {
      const sv = saveRef.current
      const antes = Math.ceil(g.quedan)
      g.quedan = Math.max(0, g.quedan - dt)
      if (!g.avisoUltimo && g.quedan <= 10 && g.quedan > 0) {
        g.avisoUltimo = true
        juice.text(W / 2, H * 0.45, 'ULTIMOS 10 SEG', '#fde047', 9, 1.6)
      }
      if (Math.ceil(g.quedan) !== antes) sync()
      if (g.quedan > 0) {
        g.llega -= dt
        if (g.llega <= 0) {
          spawnCat()
          g.llega = intervalo(sv, g.dia) * (0.75 + Math.random() * 0.5)
        }
      }
    }

    const updateDia = (dt: number) => {
      avanzarHorario(dt)
      for (const id of ITEMS) avanzarEstacion(id, dt)
      updateCats(dt)
      for (const h of g.corazones) {
        h.t += dt
        h.y -= 30 * dt
        h.x += Math.sin(h.t * 5 + h.s) * 0.4
      }
      g.corazones = g.corazones.filter((h) => h.t < h.vida)
      if (g.quedan <= 0 && g.cats.length === 0) terminarDia()
    }

    // ---------- dibujo ----------
    const dibujarEstacion = (id: Item, sv: Save) => {
      const R = G.estacion[id]
      const info = INFO[id]
      const abierta = desbloqueado(sv, id)
      const e = g.est[id]
      const cx = (R.x0 + R.x1) / 2
      const ancho = R.x1 - R.x0
      const pulso = 0.5 + 0.5 * Math.sin(g.t * 8)
      const costo = abierta ? 0 : (opciones(sv).find((o) => o.id === id)?.costo ?? info.precio)
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (esBebida(id)) {
        // máquina con su nombre en la tapa; el vaso de abajo se llena mientras prepara
        const bx = R.x0 + ancho * 0.16
        const by = R.y0 + 3
        const bw = ancho * 0.68
        const bh = R.y1 - R.y0 - 22
        ctx.globalAlpha = abierta ? 1 : 0.6
        maquina(ctx, id, bx, by, bw, bh, abierta)
        ctx.font = `6px ${pf}`
        ctx.fillStyle = '#7a4a3a'
        if (abierta) ctx.fillText(info.etiqueta, cx, by + 9)
        else precio(ctx, cx, by + 9, costo)
        if (!abierta) candado(ctx, cx, by + bh * 0.7, 7, 'rgba(90,70,80,0.7)')
        const vx = cx - 11
        const vy = R.y1 - 20
        const vw = 22
        const vh = 15
        ctx.globalAlpha = abierta ? 1 : 0.6
        rr(ctx, vx, vy, vw, vh, 5)
        ctx.fillStyle = '#fff8f2'
        ctx.fill()
        const nivel = e.ocupado ? 1 - e.t / tiempoPreparar(sv, id) : e.listo ? 1 : 0
        if (nivel > 0) {
          ctx.save()
          rr(ctx, vx, vy, vw, vh, 5)
          ctx.clip()
          ctx.fillStyle = info.color
          ctx.fillRect(vx, vy + vh * (1 - nivel), vw, vh * nivel)
          ctx.restore()
        }
        rr(ctx, vx, vy, vw, vh, 5)
        ctx.strokeStyle = '#d9a48f'
        ctx.lineWidth = 1.2
        ctx.stroke()
        if (e.listo) {
          icono(ctx, cx, vy + vh / 2 - 1, id, 8)
          ctx.globalAlpha = pulso
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, vy + vh / 2, 13, 0, PI2)
          ctx.stroke()
        }
      } else {
        // postre sobre su platito; bloqueado: tenue, con candadito y precio
        const ped = { x: R.x0 + 8, y: R.y0 + 2, w: ancho - 16, h: R.y1 - R.y0 - 16 }
        rr(ctx, ped.x, ped.y, ped.w, ped.h, 10)
        ctx.fillStyle = abierta ? '#fff7ef' : '#e6dde3'
        ctx.fill()
        ctx.strokeStyle = abierta ? '#f0b8c8' : '#cfc4cc'
        ctx.lineWidth = 2
        ctx.stroke()
        const py = ped.y + ped.h * 0.5
        if (abierta) {
          ctx.globalAlpha = e.ocupado ? 0.45 : 1
          icono(ctx, cx, py, id, 11)
        } else {
          ctx.globalAlpha = 0.3
          icono(ctx, cx, py, id, 11)
          ctx.globalAlpha = 1
          candado(ctx, cx, py, 9, 'rgba(90,70,80,0.7)')
        }
        ctx.globalAlpha = 1
        if (e.ocupado) {
          ctx.fillStyle = info.color
          ctx.fillRect(ped.x + 6, ped.y + ped.h - 5, (ped.w - 12) * clamp(1 - e.t / tiempoPreparar(sv, id), 0, 1), 3)
        }
        if (e.listo) {
          ctx.globalAlpha = pulso
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, py, 16, 0, PI2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        ctx.font = `6px ${pf}`
        ctx.fillStyle = abierta ? '#7a4a3a' : '#8a7a85'
        if (abierta) ctx.fillText(info.etiqueta, cx, R.y1 - 6)
        else precio(ctx, cx, R.y1 - 6, costo)
      }
      ctx.restore()
    }

    const dibujar = () => {
      const sv = saveRef.current
      const tiene = (d: Deco) => sv.deco.includes(d)
      ctx.save()
      juice.applyShake(ctx)

      // pared rosa a franjas con zócalo, y piso de madera clara
      ctx.fillStyle = '#fff0f6'
      ctx.fillRect(-20, -20, W + 40, G.pisoT + 20)
      ctx.fillStyle = '#fbd6e6'
      for (let x = 0; x < W; x += 36) ctx.fillRect(x, 0, 18, G.pisoT - 16)
      if (tiene('luces')) lucesDeHadas(ctx, 6, g.t)
      ctx.fillStyle = '#f5b9d0'
      ctx.fillRect(-20, G.pisoT - 16, W + 40, 10)
      ctx.fillStyle = '#f9a8c4'
      ctx.fillRect(-20, G.pisoT - 6, W + 40, 6)
      ctx.fillStyle = '#fbe0cf'
      ctx.fillRect(-20, G.pisoT, W + 40, G.pisoB - G.pisoT + 20)
      ctx.strokeStyle = 'rgba(200,130,110,0.14)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let y = G.pisoT + 18; y < G.pisoB; y += 18) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(W, y + 0.5)
      }
      ctx.stroke()

      // decoración de pared: ventanas, pizarrón con menú, lámpara y cuadrito
      const yV = G.pisoT * 0.2
      const hV = G.pisoT * 0.6
      ventana(ctx, W * 0.05, yV, W * 0.18, hV, g.t)
      ventana(ctx, W * 0.77, yV, W * 0.18, hV, g.t + 1.3)
      lampara(ctx, W * 0.5, g.t)
      pizarra(ctx, W * 0.3, G.pisoT * 0.27, W * 0.4, G.pisoT * 0.42, pf)
      cuadroGatito(ctx, W * 0.5 - 15, G.pisoT * 0.72, tiene('cuadro'))
      if (tiene('plantitas')) {
        planta(ctx, 20, G.pisoT + 34)
        planta(ctx, W - 20, G.pisoT + 34)
      }
      planta(ctx, W - 20, G.pisoB - 8)

      // alfombra bajo las mesas
      const yA = G.pisoT + (G.pisoB - G.pisoT) * 0.3
      alfombra(ctx, W * 0.14, yA, W * 0.72, (G.pisoB - G.pisoT) * 0.56)

      // mesas redondas con su silla (las bloqueadas son un contorno punteado)
      for (let i = 0; i < G.asientos.length; i++) {
        const a = G.asientos[i]
        const activa = i < sv.mesas
        if (activa) {
          silla(ctx, a.x, a.y)
          if (tiene('cojines')) cojin(ctx, a.x, a.y + 2)
        }
        mesa(ctx, a.x, a.y + 10, activa)
      }

      // gatitos: los de la partida, o unos tranquilos sentados en el menú
      const vistas: { x: number; y: number; look: Look; esp: Esp | null; st: CatSt; t: number }[] =
        g.fase === 'dia' ? [...g.cats] : []
      if (g.fase !== 'dia') {
        for (let i = 0; i < Math.min(sv.mesas, 3); i++) {
          vistas.push({ x: G.asientos[i].x, y: G.asientos[i].y, look: LOOKS[i], esp: null, st: 'espera', t: g.t + i })
        }
      }
      vistas.sort((a, b) => a.y - b.y)
      for (const v of vistas) dibujarGato(ctx, v.x, v.y, v.look, v.esp, v.st, v.t)

      // gatito dormido en su cojincito, en medio de la alfombra
      const bx = W * 0.5
      const by = G.pisoT + (G.pisoB - G.pisoT) * 0.62
      ctx.fillStyle = '#f9a8d4'
      ctx.beginPath()
      ctx.ellipse(bx, by, 22, 7, 0, 0, PI2)
      ctx.fill()
      ctx.fillStyle = '#fde2ef'
      ctx.beginPath()
      ctx.ellipse(bx, by - 2, 17, 5, 0, 0, PI2)
      ctx.fill()
      ctx.save()
      ctx.translate(bx, by - 2)
      ctx.scale(0.9, 0.9)
      ctx.fillStyle = LOOKS[0].cuerpo
      ctx.beginPath()
      ctx.ellipse(0, -6, 14, 6, 0, 0, PI2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(-9, -9, 6.5, 0, PI2)
      ctx.fill()
      ctx.fillStyle = LOOKS[0].oreja
      ctx.beginPath()
      ctx.moveTo(-14, -12)
      ctx.lineTo(-15, -18)
      ctx.lineTo(-10, -15)
      ctx.fill()
      ctx.strokeStyle = '#3b2a3a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-11.5, -9.5)
      ctx.lineTo(-9.5, -9.5)
      ctx.moveTo(-7, -9)
      ctx.lineTo(-5.5, -9.2)
      ctx.stroke()
      ctx.restore()

      // mostrador con su tapa de mármol y la repisa de pasteles
      ctx.fillStyle = '#f5b3c8'
      ctx.fillRect(-20, H * 0.6, W + 40, H * 0.2 + 40)
      ctx.fillStyle = '#fff0f6'
      ctx.fillRect(-20, H * 0.6, W + 40, 6)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(-20, H * 0.8, W + 40, 2)
      for (const id of ITEMS) dibujarEstacion(id, sv)

      // bandeja de madera con sus lugares
      rr(ctx, 6, G.bandejaT, W - 12, G.bandejaB - G.bandejaT, 14)
      ctx.fillStyle = '#e8b48a'
      ctx.fill()
      ctx.strokeStyle = '#c98f63'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(160,100,60,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 1; k < 4; k++) {
        const yy = G.bandejaT + ((G.bandejaB - G.bandejaT) * k) / 4
        ctx.moveTo(10, yy)
        ctx.lineTo(W - 10, yy)
      }
      ctx.stroke()
      G.ranuras.forEach((r, i) => {
        rr(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 12)
        ctx.fillStyle = '#fff9f4'
        ctx.fill()
        ctx.strokeStyle = g.sel === i ? '#fde047' : '#e9c7a8'
        ctx.lineWidth = g.sel === i ? 3 : 1.5
        ctx.stroke()
        if (i < g.bandeja.length) {
          const bob = g.sel === i ? Math.sin(g.t * 8) * 2 : 0
          icono(ctx, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + bob, g.bandeja[i], 14)
        }
      })
      // bote para tirar lo que no sirve
      const b = G.basura
      rr(ctx, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 10)
      ctx.fillStyle = '#d8d0f5'
      ctx.fill()
      ctx.strokeStyle = '#a5a0d6'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = '#7c74b8'
      ctx.font = `6px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TIRAR', (b.x0 + b.x1) / 2, b.y1 - 9)
      ctx.strokeStyle = '#7c74b8'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo((b.x0 + b.x1) / 2 - 8, b.y0 + 12)
      ctx.lineTo((b.x0 + b.x1) / 2 + 8, b.y0 + 12)
      ctx.stroke()

      // burbujas de pedido
      if (g.fase === 'dia') {
        for (const c of g.cats) if (c.st === 'espera') dibujarBurbuja(ctx, c, pf)
      }

      // corazones de ronroneo
      for (const h of g.corazones) {
        ctx.globalAlpha = clamp(1 - h.t / h.vida, 0, 1)
        corazon(ctx, h.x, h.y, h.s, '#f472b6')
      }
      ctx.globalAlpha = 1
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(40,20,30,0.6)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `24px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.font = `9px ${pf}`
        ctx.fillText('P O TOCA PARA SEGUIR', W / 2, H / 2 + 22)
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // ---------- reacomodo al girar la pantalla ----------
    /** Las mesas, bandeja y gatitos se escalan a la nueva pantalla; la partida se pausa. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layout()
      if (W === oldW && H === oldH) return
      setupCanvas(canvas, W, H)
      const sx = W / oldW
      const sy = H / oldH
      for (const c of g.cats) {
        c.x *= sx
        c.y *= sy
      }
      for (const h of g.corazones) {
        h.x *= sx
        h.y *= sy
      }
      for (const p of juice.particles) {
        p.x *= sx
        p.y *= sy
      }
      for (const t of juice.texts) {
        t.x *= sx
        t.y *= sy
      }
      g.paused = true
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.fase === 'dia') relayoutLive()
        else requestRemount()
      }
      const jp = justPressedRef.current
      if (jp.has('pause') && g.fase === 'dia') {
        g.paused = !g.paused
        if (g.paused) sPausa()
      }
      if (jp.has('action')) {
        if (g.fase === 'dia') g.paused = false
        else if (g.fase === 'menu' || g.fase === 'tienda') iniciarDia()
        else if (g.fase === 'resumen' && g.overT > 0.5) abrirTienda()
      }
      jp.clear()
      g.t += dt
      if (g.fase === 'resumen') g.overT += dt
      const dtJuego = juice.update(g.paused ? 0 : dt)
      if (g.fase === 'dia' && !g.paused && dtJuego > 0) updateDia(dtJuego)
      dibujar()
    }
    raf = requestAnimationFrame((t) => {
      sync()
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef])

  // ---------- acciones de React (botones de las pantallas) ----------
  const comprar = (op: Opcion) => {
    const s = saveRef.current
    if (!op.aplicar || op.costo === null || s.monedas < op.costo) return
    const next = { ...op.aplicar(s), monedas: s.monedas - op.costo }
    saveRef.current = next
    writeSave(next)
    setUi((u) => ({ ...u, save: next, aviso: op.aviso ?? null }))
  }

  const enDia = ui.fase === 'dia'
  const hud = (
    <Hud>
      <span style={{ color: ACCENT }}>DIA {enDia ? ui.dia : ui.save.dia}</span>
      <span className="text-white/70">
        {enDia ? `${Math.floor(ui.segundos / 60)}:${String(ui.segundos % 60).padStart(2, '0')}` : '--'}
      </span>
      <span className="text-amber-200">MONEDAS {ui.save.monedas}</span>
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W0}
        height={H0}
        className="rounded-xl border-2 border-[#f9a8d4]/50 bg-[#fde4cf] shadow-[0_0_30px_rgba(249,168,212,0.25)]"
        hud={hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Café Michi"
        />
        {ui.fase === 'menu' && (
          <MenuInicio
            save={ui.save}
            onJugar={() => actionsRef.current.iniciarDia()}
            onTienda={() => actionsRef.current.abrirTienda()}
          />
        )}
        {ui.fase === 'resumen' && (
          <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-[#fde4cf]/95 text-[#5b2350]">
            <div
              className="flex min-h-full flex-col items-center justify-center gap-2.5 px-5 py-4 text-center"
              style={{ background: 'radial-gradient(circle at 50% 30%, #fbcfe8 0%, transparent 65%)' }}
            >
              <div className="flex w-full max-w-xs flex-col items-center gap-2.5 rounded-[2rem] border-2 border-white bg-white/85 px-5 py-5 shadow-[0_10px_30px_rgba(190,80,140,0.25)]">
                <p className="text-base" style={{ ...pixel, color: '#db2777', textShadow: '2px 2px 0 #ffffff' }}>
                  DIA {ui.dia} LISTO
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#7c2d5e]/70">Ganado hoy</p>
                <p className="text-4xl font-semibold tabular-nums" style={{ color: '#db2777' }}>
                  {ui.ganado}
                </p>
                <dl className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="text-[#7c2d5e]/70">Clientes</dt>
                    <dd className="font-medium tabular-nums">{ui.servidos}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-[#7c2d5e]/70">Propinas</dt>
                    <dd className="font-medium tabular-nums">{ui.propinas}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-[#7c2d5e]/70">Se fueron</dt>
                    <dd className="font-medium tabular-nums">{ui.perdidos}</dd>
                  </div>
                </dl>
                <p className="text-xs font-medium text-amber-600">Monedas: {ui.save.monedas}</p>
                <div className="mt-1 flex w-full flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      setUi((u) => ({ ...u, aviso: null }))
                      actionsRef.current.abrirTienda()
                    }}
                    className="rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95"
                  >
                    Ir a la tienda
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      setUi((u) => ({ ...u, aviso: null }))
                      actionsRef.current.iniciarDia()
                    }}
                    className="rounded-full border border-[#7c2d5e]/30 bg-white/80 px-5 py-2 text-xs transition active:scale-95"
                    style={{ color: '#7c2d5e' }}
                  >
                    Siguiente día
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {ui.fase === 'tienda' && (
          <Tienda
            save={ui.save}
            aviso={ui.aviso}
            onComprar={comprar}
            onVolver={() => actionsRef.current.irMenu()}
            onAbrir={() => {
              setUi((u) => ({ ...u, aviso: null }))
              actionsRef.current.iniciarDia()
            }}
          />
        )}
      </GameScreen>
    </div>
  )
}
