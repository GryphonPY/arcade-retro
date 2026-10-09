'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { rr, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const ACCENT = '#f9a8d4'
const SAVE_KEY = 'arcade-cafe-michi'
const DIA_T = 120 // duración de un día, en segundos
const COLA_MAX = 2 // gatitos esperando de pie junto a la puerta
const PACIENCIA = 38 // segundos de paciencia por gatito
const BANDEJA_CAP = 3

const W0 = 360
const H0 = 560
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
  const pisoT = H * 0.14
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
}
const LOOKS: Look[] = [
  { cuerpo: '#f7c27a', panza: '#fff4df', oreja: '#f8a9a0' },
  { cuerpo: '#c9c4d0', panza: '#f4f1f7', oreja: '#f3b5c0' },
  { cuerpo: '#fbf6ef', panza: '#ffffff', oreja: '#f6b8c6' },
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

/** Icono de bebida o postre centrado en (x, y); `s` es el radio aproximado. */
function icono(ctx: CanvasRenderingContext2D, x: number, y: number, id: Item, s: number) {
  const info = INFO[id]
  if (esBebida(id)) {
    ctx.fillStyle = id === 'espuma' ? '#ffffff' : '#fff8f2'
    ctx.beginPath()
    ctx.moveTo(x - s * 0.7, y - s * 0.4)
    ctx.lineTo(x + s * 0.7, y - s * 0.4)
    ctx.lineTo(x + s * 0.45, y + s * 0.7)
    ctx.lineTo(x - s * 0.45, y + s * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#fff8f2'
    ctx.lineWidth = Math.max(1, s * 0.22)
    ctx.beginPath()
    ctx.arc(x + s * 0.7, y + s * 0.15, s * 0.3, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.fillStyle = info.color
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.4, s * 0.7, s * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    if (id === 'espuma') corazon(ctx, x, y - s * 0.45, s * 0.35, '#f472b6')
  } else if (id === 'pastel') {
    rr(ctx, x - s * 0.7, y - s * 0.2, s * 1.4, s * 0.8, s * 0.2)
    ctx.fillStyle = info.color
    ctx.fill()
    rr(ctx, x - s * 0.7, y - s * 0.45, s * 1.4, s * 0.3, s * 0.15)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(x, y - s * 0.6, s * 0.14, 0, Math.PI * 2)
    ctx.fill()
  } else if (id === 'galleta') {
    ctx.fillStyle = info.color
    ctx.beginPath()
    ctx.arc(x, y, s * 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#7a4a2a'
    for (const [dx, dy] of [
      [-0.3, -0.2],
      [0.25, -0.3],
      [0.05, 0.3],
    ]) {
      ctx.beginPath()
      ctx.arc(x + dx * s, y + dy * s, s * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = info.color
    ctx.beginPath()
    ctx.arc(x, y, s * 0.75, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff8f2'
    ctx.beginPath()
    ctx.arc(x, y, s * 0.25, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Gatito de frente a los pies (x, y). Cola, orejas, cachetes y accesorios de los especiales. */
function dibujarGato(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, esp: Esp | null, st: CatSt, t: number) {
  const salto = st === 'entra' || st === 'sale' || st === 'triste' ? Math.abs(Math.sin(t * 10)) * 3 : st === 'feliz' ? Math.abs(Math.sin(t * 14)) * 6 : 0
  const respira = st === 'espera' ? Math.sin(t * 2.6) * 0.8 : 0
  const escala = st === 'feliz' ? 1 + Math.sin(t * 22) * 0.04 : 1
  const cola = st === 'feliz' ? Math.sin(t * 18) * 6 : st === 'espera' ? Math.sin(t * 4) * 3 : 0
  const parpadea = st === 'espera' && t % 3.4 < 0.14
  const acento = esp ? ESPECIALES[esp].acento : '#f472b6'

  ctx.save()
  ctx.translate(x, y - salto + respira)
  ctx.scale(escala, escala)
  ctx.lineCap = 'round'

  // cola
  ctx.strokeStyle = look.cuerpo
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(8, -7)
  ctx.quadraticCurveTo(22, -7, 18 + cola * 0.3, -22)
  ctx.stroke()

  // cuerpo, panza y patitas
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.ellipse(0, -11, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-5, -1.5, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.ellipse(5, -1.5, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.panza
  ctx.beginPath()
  ctx.ellipse(0, -9, 6.5, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // orejas
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.moveTo(-10, -31)
  ctx.lineTo(-11, -41)
  ctx.lineTo(-2, -35)
  ctx.moveTo(10, -31)
  ctx.lineTo(11, -41)
  ctx.lineTo(2, -35)
  ctx.fill()
  ctx.fillStyle = look.oreja
  ctx.beginPath()
  ctx.moveTo(-8.5, -33)
  ctx.lineTo(-9.5, -38)
  ctx.lineTo(-4.5, -34.5)
  ctx.moveTo(8.5, -33)
  ctx.lineTo(9.5, -38)
  ctx.lineTo(4.5, -34.5)
  ctx.fill()

  // cabeza
  ctx.fillStyle = look.cuerpo
  ctx.beginPath()
  ctx.arc(0, -27, 10.5, 0, Math.PI * 2)
  ctx.fill()
  if (look.rayas) {
    ctx.strokeStyle = 'rgba(120,70,40,0.5)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-2, -37)
    ctx.lineTo(-1, -33.5)
    ctx.moveTo(2, -37)
    ctx.lineTo(3, -33.5)
    ctx.moveTo(-5.5, -36)
    ctx.lineTo(-5, -32.5)
    ctx.stroke()
  }

  // ojos
  ctx.strokeStyle = '#3b2a3a'
  ctx.fillStyle = '#3b2a3a'
  ctx.lineWidth = 1.2
  for (const ex of [-4, 4]) {
    if (st === 'feliz') {
      ctx.beginPath()
      ctx.arc(ex, -26, 2, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else if (st === 'triste') {
      ctx.beginPath()
      ctx.arc(ex, -26.5, 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(ex - 2.5, -31)
      ctx.lineTo(ex + 2.5, -29.8)
      ctx.stroke()
    } else if (parpadea) {
      ctx.beginPath()
      ctx.moveTo(ex - 2, -26.5)
      ctx.lineTo(ex + 2, -26.5)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(ex, -26.5, 1.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // nariz, cachetes y bigotes
  ctx.fillStyle = '#f472b6'
  ctx.beginPath()
  ctx.moveTo(0, -24.5)
  ctx.lineTo(-1.5, -25.8)
  ctx.lineTo(1.5, -25.8)
  ctx.fill()
  ctx.fillStyle = 'rgba(244,114,182,0.45)'
  ctx.beginPath()
  ctx.arc(-6.5, -23, 2.2, 0, Math.PI * 2)
  ctx.arc(6.5, -23, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(60,40,60,0.35)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 7, -24.5)
    ctx.lineTo(s * 13, -25.5)
    ctx.moveTo(s * 7, -23)
    ctx.lineTo(s * 13, -22.5)
  }
  ctx.stroke()

  // accesorios de los gatitos especiales
  if (esp === 'mochi') {
    ctx.fillStyle = acento
    ctx.beginPath()
    ctx.moveTo(8, -37)
    ctx.lineTo(2, -41)
    ctx.lineTo(2, -33)
    ctx.moveTo(8, -37)
    ctx.lineTo(14, -41)
    ctx.lineTo(14, -33)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(8, -37, 1.6, 0, Math.PI * 2)
    ctx.fill()
  } else if (esp === 'pelusa') {
    ctx.fillStyle = '#fde68a'
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(-7 + Math.cos(a) * 2, -36 + Math.sin(a) * 2, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (esp === 'lunita') {
    ctx.fillStyle = acento
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 4.5 : 2
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2
      ctx.lineTo(Math.cos(a) * r, -47 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  } else if (esp === 'bigotes') {
    ctx.strokeStyle = '#4b5563'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(-4, -27, 3, 0, Math.PI * 2)
    ctx.arc(4, -27, 3, 0, Math.PI * 2)
    ctx.moveTo(-1, -27)
    ctx.lineTo(1, -27)
    ctx.stroke()
  }
  ctx.restore()
}

/** Burbuja del pedido con paciencia (barra) sobre el gatito sentado. */
function dibujarBurbuja(ctx: CanvasRenderingContext2D, c: Cat, pf: string) {
  const x = c.x
  const y = c.y - 46
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

function mesa(ctx: CanvasRenderingContext2D, x: number, y: number, activa: boolean) {
  ctx.beginPath()
  ctx.ellipse(x, y, 30, 10, 0, 0, Math.PI * 2)
  if (activa) {
    ctx.fillStyle = '#fff3e6'
    ctx.fill()
    ctx.strokeStyle = '#e4b696'
    ctx.lineWidth = 2
    ctx.stroke()
  } else {
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(160,110,80,0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function cojin(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#f9a8d4'
  ctx.beginPath()
  ctx.ellipse(x, y, 18, 6, 0, 0, Math.PI * 2)
  ctx.fill()
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
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2)
    ctx.fill()
  }
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
    ctx.arc(x, yy, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(x, yy, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function cuadroGatito(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#c9a27e'
  rr(ctx, x - 24, y, 48, 36, 4)
  ctx.fill()
  ctx.fillStyle = '#fff1e6'
  rr(ctx, x - 20, y + 4, 40, 28, 3)
  ctx.fill()
  ctx.fillStyle = '#f7c27a'
  ctx.beginPath()
  ctx.ellipse(x, y + 26, 8, 5, 0, 0, Math.PI * 2)
  ctx.arc(x, y + 17, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 5, y + 13)
  ctx.lineTo(x - 6, y + 8)
  ctx.lineTo(x - 2, y + 11.5)
  ctx.moveTo(x + 5, y + 13)
  ctx.lineTo(x + 6, y + 8)
  ctx.lineTo(x + 2, y + 11.5)
  ctx.fill()
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
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      style={{ background: `radial-gradient(circle at 50% 20%, ${ACCENT}33, transparent 70%), rgba(40,22,32,0.9)` }}
    >
      <div className="mx-auto flex min-h-full max-w-sm flex-col gap-3 px-5 py-4">
        <p className="pt-2 text-center text-sm" style={{ ...pixel, color: ACCENT, textShadow: '2px 2px 0 #000' }}>
          TIENDA
        </p>
        <p className="text-center text-xs text-white/70">
          Monedas: <span className="font-semibold text-amber-200">{save.monedas}</span>
        </p>
        {aviso && <p className="rounded-xl bg-pink-200/15 px-3 py-2 text-center text-xs text-pink-100">{aviso}</p>}
        {grupos.map((grupo) => (
          <section key={grupo} className="flex flex-col gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/50">{grupo}</h3>
            {ops
              .filter((o) => o.grupo === grupo)
              .map((o) => {
                const puede = o.aplicar !== null && o.costo !== null && save.monedas >= o.costo
                return (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{o.titulo}</p>
                      <p className="text-[11px] leading-snug text-white/60">{o.detalle}</p>
                    </div>
                    {o.costo === null ? (
                      <span className="shrink-0 text-xs text-white/40">Listo</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!puede}
                        onClick={(e) => {
                          e.currentTarget.blur()
                          onComprar(o)
                        }}
                        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-black transition enabled:active:scale-95 disabled:bg-white/15 disabled:text-white/40"
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
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
            style={{ background: ACCENT, boxShadow: `0 0 24px ${ACCENT}66` }}
          >
            Abrir el día {save.dia}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur()
              onVolver()
            }}
            className="text-xs text-white/60 underline-offset-4 hover:underline"
          >
            Volver
          </button>
        </div>
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
      ctx.save()
      ctx.globalAlpha = abierta ? 1 : 0.6
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (esBebida(id)) {
        const vx = cx - 12
        const vy = R.y0 + 14
        rr(ctx, R.x0 + 8, R.y0 + 2, ancho - 16, 38, 8)
        ctx.fillStyle = abierta ? info.maquina : '#d9d0cc'
        ctx.fill()
        ctx.strokeStyle = '#9a6a5a'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#7a4a3a'
        ctx.font = `6px ${pf}`
        ctx.fillText(abierta ? info.etiqueta : 'TIENDA', cx, R.y0 + 8)
        rr(ctx, vx, vy, 24, 18, 4)
        ctx.fillStyle = '#fff8f2'
        ctx.fill()
        const nivel = e.ocupado ? 1 - e.t / tiempoPreparar(saveRef.current, id) : e.listo ? 1 : 0
        if (nivel > 0) {
          ctx.save()
          rr(ctx, vx, vy, 24, 18, 4)
          ctx.clip()
          ctx.fillStyle = info.color
          ctx.fillRect(vx, vy + 18 * (1 - nivel), 24, 18 * nivel)
          ctx.restore()
        }
        if (e.ocupado || e.listo) icono(ctx, cx, R.y0 + 50, id, 9)
        if (e.listo) {
          ctx.globalAlpha = pulso
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, R.y0 + 50, 13, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else {
        const ped = { x: R.x0 + 10, y: R.y0 + 2, w: ancho - 20, h: R.y1 - R.y0 - 16 }
        rr(ctx, ped.x, ped.y, ped.w, ped.h, 8)
        ctx.fillStyle = abierta ? '#fff7ef' : '#d9d0cc'
        ctx.fill()
        ctx.strokeStyle = '#c99a7c'
        ctx.lineWidth = 2
        ctx.stroke()
        if (abierta) {
          ctx.globalAlpha = e.ocupado ? 0.45 : 1
          icono(ctx, cx, ped.y + ped.h / 2, id, 11)
          ctx.globalAlpha = 1
        }
        if (e.ocupado) {
          ctx.fillStyle = info.color
          ctx.fillRect(ped.x + 6, ped.y + ped.h - 6, (ped.w - 12) * clamp(1 - e.t / tiempoPreparar(sv, id), 0, 1), 3)
        }
        if (e.listo) {
          ctx.globalAlpha = pulso
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, ped.y + ped.h / 2, 15, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = abierta ? 1 : 0.6
        ctx.fillStyle = '#7a4a3a'
        ctx.font = `6px ${pf}`
        ctx.fillText(abierta ? info.etiqueta : 'TIENDA', cx, R.y1 - 6)
      }
      ctx.restore()
    }

    const dibujar = () => {
      const sv = saveRef.current
      const tiene = (d: Deco) => sv.deco.includes(d)
      ctx.save()
      juice.applyShake(ctx)

      // pared y piso
      ctx.fillStyle = '#fde4cf'
      ctx.fillRect(-20, -20, W + 40, G.pisoT + 20)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      for (let x = 0; x < W; x += 36) ctx.fillRect(x, 0, 12, G.pisoT - 6)
      ctx.fillStyle = '#f6c3ad'
      ctx.fillRect(-20, G.pisoT - 6, W + 40, 6)
      ctx.fillStyle = '#f7d7ad'
      ctx.fillRect(-20, G.pisoT, W + 40, G.pisoB - G.pisoT + 20)
      ctx.strokeStyle = 'rgba(180,120,70,0.16)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let y = G.pisoT + 18; y < G.pisoB; y += 18) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(W, y + 0.5)
      }
      ctx.stroke()

      // decoración de pared y macetas
      if (tiene('luces')) lucesDeHadas(ctx, G.pisoT * 0.3, g.t)
      if (tiene('cuadro')) cuadroGatito(ctx, W * 0.5 - 24, G.pisoT * 0.42)
      if (tiene('plantitas')) {
        planta(ctx, 20, G.pisoT + 34)
        planta(ctx, W - 20, G.pisoT + 34)
        planta(ctx, W - 20, G.pisoB - 8)
      }

      // mesas (las bloqueadas se ven como contorno punteado)
      for (let i = 0; i < G.asientos.length; i++) {
        const a = G.asientos[i]
        const activa = i < sv.mesas
        mesa(ctx, a.x, a.y + 10, activa)
        if (activa && tiene('cojines')) cojin(ctx, a.x, a.y + 6)
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

      // barra con máquinas
      ctx.fillStyle = '#f2b7a0'
      ctx.fillRect(-20, H * 0.6, W + 40, H * 0.2 + 40)
      ctx.fillStyle = '#fbd3c2'
      ctx.fillRect(-20, H * 0.6, W + 40, 5)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(-20, H * 0.72, W + 40, 2)
      for (const id of ITEMS) dibujarEstacion(id, sv)

      // bandeja y bote de basura
      rr(ctx, 6, G.bandejaT, W - 12, G.bandejaB - G.bandejaT, 12)
      ctx.fillStyle = '#e9b98f'
      ctx.fill()
      ctx.strokeStyle = '#c4905f'
      ctx.lineWidth = 2
      ctx.stroke()
      G.ranuras.forEach((r, i) => {
        rr(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 8)
        ctx.fillStyle = '#fff4e9'
        ctx.fill()
        if (g.sel === i) {
          ctx.strokeStyle = '#fde047'
          ctx.lineWidth = 3
          ctx.stroke()
        }
        if (i < g.bandeja.length) {
          const bob = g.sel === i ? Math.sin(g.t * 8) * 2 : 0
          icono(ctx, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + bob, g.bandeja[i], 13)
        }
      })
      const b = G.basura
      rr(ctx, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 8)
      ctx.fillStyle = '#cbd5e1'
      ctx.fill()
      ctx.fillStyle = '#475569'
      ctx.font = `6px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TIRAR', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)

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
          <StartOverlay
            title="CAFE MICHI"
            accent={ACCENT}
            subtitle="Prepara cafés, chocolates y postres para los gatitos. Toca una máquina y luego al gatito con su pedido."
            hint="Pulsa ESPACIO para abrir el día"
            touchHint="Toca Jugar para abrir el día"
            onStart={() => actionsRef.current.iniciarDia()}
          >
            <p className="text-xs text-white/70">
              Día {ui.save.dia} · {ui.save.monedas} monedas
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                actionsRef.current.abrirTienda()
              }}
              className="rounded-full border border-white/25 px-5 py-2 text-xs text-white/85 transition active:scale-95"
            >
              Tienda
            </button>
            <p className="max-w-[17rem] text-[11px] leading-relaxed text-white/60">
              Los gatitos se van tristes si esperan mucho. Con teclado: 1-7 máquinas, A S D elige en la bandeja, Q W E R T Y entrega a cada mesa.
            </p>
          </StartOverlay>
        )}
        {ui.fase === 'resumen' && (
          <GameOverOverlay
            title={`DIA ${ui.dia} LISTO`}
            accent={ACCENT}
            score={ui.ganado}
            best={0}
            newBest={false}
            ranked={false}
            stats={[
              { label: 'Clientes', value: ui.servidos },
              { label: 'Propinas', value: ui.propinas },
              { label: 'Se fueron', value: ui.perdidos },
            ]}
            onRestart={() => {
              setUi((u) => ({ ...u, aviso: null }))
              actionsRef.current.abrirTienda()
            }}
          />
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
