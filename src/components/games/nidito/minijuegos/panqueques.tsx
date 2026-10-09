'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Heart, Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
import type { MinijuegoProps } from '../types'
import { noise, tone } from '../../sfx'

/* ------------------------------------------------------------------ */
/* Constantes y tipos                                                 */
/* ------------------------------------------------------------------ */

const DURACION = 60
const VIDAS_MAX = 3
const PILA_MAX = 12
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif'
const OJO = '#5b3a52'
const CREMA = '#fff7ee'
const BORDE_GATO = '#f2b8cf'

type Topping = 'fresa' | 'platano' | 'miel' | 'chispas' | 'crema'
const TOPPINGS: Topping[] = ['fresa', 'platano', 'miel', 'chispas', 'crema']
type Estado = 'crudo' | 'dorado' | 'quemado'
type Fase = 'inicio' | 'jugando' | 'pausa' | 'fin'
type Cara = 'normal' | 'feliz' | 'triste' | 'sorpresa'

const COLORES: Record<Estado, { top: string; side: string }> = {
  crudo: { top: '#ffe6b3', side: '#f0be72' },
  dorado: { top: '#ffb35a', side: '#e08a34' },
  quemado: { top: '#9b6b45', side: '#5e3b26' },
}

interface Caida {
  tipo: 'panqueque' | Topping
  x: number // fracción del ancho
  y: number // fracción del alto (centro)
  vy: number // fracción del alto por segundo
  estado: Estado
  volteo: number // -1 si no se ha volteado; si no, segundos desde el volteo
  ritmo: number
}
interface Lamina {
  estado: Estado
}
interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  vida: number
  max: number
  color: string
  tam: number
  forma: 'circulo' | 'corazon' | 'destello'
}
interface Texto {
  x: number
  y: number
  texto: string
  color: string
  vida: number
  max: number
  tam: number
}
interface Resumen {
  puntos: number
  atrapados: number
  mejorRacha: number
  platos: number
  monedas: number
}
interface Juego {
  fase: Fase
  W: number
  H: number
  reloj: number // tiempo visual (siempre avanza)
  t: number // tiempo jugado (se detiene en pausa)
  plato: number // posición actual del plato (fracción del ancho)
  platoObj: number // destino del plato
  sway: number // velocidad del plato (fracción por segundo), para el bamboleo de la pila
  pila: Lamina[]
  decor: Topping[]
  caidas: Caida[]
  particulas: Particula[]
  textos: Texto[]
  vidas: number
  combo: number
  mejorCombo: number
  puntos: number
  atrapados: number
  platos: number
  spawn: number
  rebote: number
  cara: Cara
  caraT: number
  sacudida: number
  puntero: { activo: boolean; id: number; x0: number; y0: number; t0: number; movido: boolean }
  teclas: { izq: boolean; der: boolean }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const monedasDe = (puntos: number) => Math.floor(puntos / 3)
/** Multiplicador de puntos según la racha: x2 a partir de 5 atrapadas seguidas, máximo x4. */
const multiplicador = (racha: number) => 1 + Math.min(3, Math.floor(racha / 5))

/** Medidas del mundo en píxeles CSS, derivadas del tamaño de la pantalla. */
function medidas(W: number, H: number) {
  const u = Math.min(W * 0.92, H * 0.7)
  const ph = Math.max(14, u * 0.045)
  const plY = H * 0.84
  return {
    u,
    pw: u * 0.36,
    ph,
    plW: u * 0.46,
    plY,
    baseY: plY - ph * 0.2,
    catY: plY + u * 0.13,
    rc: u * 0.1,
    centro: H * 0.4,
    perfecto: H * 0.055,
  }
}
type Medidas = ReturnType<typeof medidas>

function crearJuego(W: number, H: number): Juego {
  return {
    fase: 'inicio',
    W,
    H,
    reloj: 0,
    t: 0,
    plato: 0.5,
    platoObj: 0.5,
    sway: 0,
    pila: [],
    decor: [],
    caidas: [],
    particulas: [],
    textos: [],
    vidas: VIDAS_MAX,
    combo: 0,
    mejorCombo: 0,
    puntos: 0,
    atrapados: 0,
    platos: 0,
    spawn: 0.6,
    rebote: 0,
    cara: 'normal',
    caraT: 0,
    sacudida: 0,
    puntero: { activo: false, id: -1, x0: 0, y0: 0, t0: 0, movido: false },
    teclas: { izq: false, der: false },
  }
}

function reiniciar(g: Juego) {
  const nuevo = crearJuego(g.W, g.H)
  nuevo.fase = 'jugando'
  Object.assign(g, nuevo)
}

/* ------------------------------------------------------------------ */
/* Sonidos y vibración                                                */
/* ------------------------------------------------------------------ */

const sCatch = (racha: number) => {
  const f = 520 + Math.min(racha, 12) * 40
  tone({ freq: f, to: f * 1.5, dur: 0.1, vol: 0.05, type: 'triangle' })
}
const sDorado = () => [784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.05, delay: i * 0.05, type: 'triangle' }))
const sTopping = () => tone({ freq: 880, to: 1320, dur: 0.14, vol: 0.05, type: 'sine' })
const sVoltear = () => tone({ freq: 600, to: 900, dur: 0.1, vol: 0.04, type: 'sine' })
const sQuemar = () => {
  tone({ freq: 240, to: 110, dur: 0.25, vol: 0.05, type: 'triangle' })
  noise({ dur: 0.18, vol: 0.05, freq: 900 })
}
const sRacha = () => [660, 880, 1100].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.04, delay: i * 0.06, type: 'square' }))
const sFallo = () => {
  tone({ freq: 330, to: 90, dur: 0.45, vol: 0.06, type: 'sawtooth' })
  noise({ dur: 0.3, vol: 0.06, freq: 700 })
}
const sPlato = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.07, type: 'square' }))
const sInicio = () => [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.04, delay: i * 0.06, type: 'square' }))
const sFin = () => [659, 523, 392, 330].forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.05, delay: i * 0.14, type: 'triangle' }))

function vibrar(p: number | number[]) {
  try {
    navigator.vibrate?.(p)
  } catch {
    // sin vibración
  }
}

/* ------------------------------------------------------------------ */
/* Efectos y dibujo base                                              */
/* ------------------------------------------------------------------ */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function corazon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.35)
  ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.5, y - s * 0.6, x, y - s * 0.25)
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.6, x + s * 0.6, y - s * 0.1, x, y + s * 0.35)
  ctx.closePath()
}

function destello(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.quadraticCurveTo(x, y, x + s, y)
  ctx.quadraticCurveTo(x, y, x, y + s)
  ctx.quadraticCurveTo(x, y, x - s, y)
  ctx.quadraticCurveTo(x, y, x, y - s)
  ctx.closePath()
}

function estallar(
  g: Juego,
  x: number,
  y: number,
  colores: string[],
  n: number,
  vel: number,
  forma: Particula['forma'] = 'circulo',
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = vel * (0.4 + Math.random() * 0.8)
    const vida = 0.5 + Math.random() * 0.5
    g.particulas.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - vel * 0.4,
      vida,
      max: vida,
      color: colores[(Math.random() * colores.length) | 0],
      tam: 3 + Math.random() * 4,
      forma,
    })
  }
  if (g.particulas.length > 220) g.particulas.splice(0, g.particulas.length - 220)
}

function texto(g: Juego, x: number, y: number, t: string, color: string, tam: number, vida = 0.9) {
  g.textos.push({ x, y, texto: t, color, vida, max: vida, tam })
  if (g.textos.length > 12) g.textos.shift()
}

function animarEfectos(g: Juego, dt: number, m: Medidas) {
  for (const p of g.particulas) {
    p.vida -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 520 * dt
    p.vx *= Math.max(0, 1 - 2.2 * dt)
  }
  g.particulas = g.particulas.filter((p) => p.vida > 0)
  for (const t of g.textos) {
    t.vida -= dt
    t.y -= m.u * 0.35 * dt
  }
  g.textos = g.textos.filter((t) => t.vida > 0)
}

/* ------------------------------------------------------------------ */
/* Lógica del juego                                                   */
/* ------------------------------------------------------------------ */

function spawnear(g: Juego) {
  const esTopping = Math.random() < 0.14
  g.caidas.push({
    tipo: esTopping ? TOPPINGS[(Math.random() * TOPPINGS.length) | 0] : 'panqueque',
    x: 0.12 + Math.random() * 0.76,
    y: -0.06,
    vy: lerp(0.24, 0.4, g.t / DURACION) * (0.9 + Math.random() * 0.2),
    estado: 'crudo',
    volteo: -1,
    ritmo: Math.random() * 6,
  })
}

/** Suma a la racha y avisa cuando sube el multiplicador. */
function sumarRacha(g: Juego, m: Medidas, x: number, y: number) {
  g.combo++
  g.mejorCombo = Math.max(g.mejorCombo, g.combo)
  if (g.combo % 5 === 0 && g.combo <= 15) {
    texto(g, x, y - m.u * 0.1, `¡Racha x${multiplicador(g.combo)}!`, '#e0557f', m.u * 0.06, 1.2)
    sRacha()
  }
}

function servir(g: Juego, m: Medidas) {
  const bono = 10 * multiplicador(g.combo)
  g.puntos += bono
  g.platos++
  const x = g.plato * g.W
  const y = m.baseY - g.pila.length * m.ph
  texto(g, x, y - m.u * 0.12, `¡Plato completo! +${bono}`, '#d9822b', m.u * 0.06, 1.5)
  estallar(g, x, y, ['#ff8fb8', '#ffd166', '#8fe3c8', '#b9a4ff', '#ffffff'], 36, m.u * 1.1, 'destello')
  g.pila = []
  g.decor = []
  g.cara = 'sorpresa'
  g.caraT = 1.2
  sPlato()
}

function atrapar(g: Juego, c: Caida, m: Medidas) {
  const x = g.plato * g.W
  const y = m.baseY - g.pila.length * m.ph - m.ph
  g.rebote = 0.25
  g.cara = 'feliz'
  g.caraT = 0.9

  if (c.tipo !== 'panqueque') {
    // Topping: suma puntos y decora la pila.
    const pts = 4 * multiplicador(g.combo)
    g.puntos += pts
    g.decor.push(c.tipo)
    if (g.decor.length > 8) g.decor.shift()
    texto(g, x, y, `+${pts}`, '#e0557f', m.u * 0.05)
    estallar(g, x, y, ['#ff8fb8', '#ffd1e3', '#ffffff'], 14, m.u * 0.9, 'corazon')
    sTopping()
    sumarRacha(g, m, x, y)
    vibrar(12)
    return
  }

  g.atrapados++
  if (c.estado === 'quemado') {
    g.pila.push({ estado: 'quemado' })
    texto(g, x, y, 'ups', '#7a4a6a', m.u * 0.045)
    tone({ freq: 200, to: 140, dur: 0.12, vol: 0.03, type: 'triangle' })
  } else {
    const pts = (c.estado === 'dorado' ? 3 : 1) * multiplicador(g.combo)
    g.puntos += pts
    g.pila.push({ estado: c.estado })
    texto(g, x, y, `+${pts}`, c.estado === 'dorado' ? '#d9822b' : '#c2668a', m.u * 0.05)
    if (c.estado === 'dorado') {
      sDorado()
      estallar(g, x, y, ['#ffd166', '#ffb35a', '#ffffff'], 16, m.u * 0.7, 'destello')
    } else {
      sCatch(g.combo)
      estallar(g, x, y, ['#ffe6b3', '#ffb3cf'], 8, m.u * 0.4)
    }
    sumarRacha(g, m, x, y)
  }
  vibrar(10)
  if (g.pila.length >= PILA_MAX) servir(g, m)
}

function fallar(g: Juego, m: Medidas) {
  g.vidas--
  g.combo = 0
  g.cara = 'triste'
  g.caraT = 1
  g.sacudida = 0.6
  texto(g, g.plato * g.W, m.plY - m.u * 0.12, '¡Ay!', '#e0557f', m.u * 0.07, 1)
  sFallo()
  vibrar([30, 40, 30])
}

/** Volteo a tiempo (dorado) o fuera de tiempo (quemado). */
function voltearCaida(g: Juego, c: Caida, m: Medidas) {
  c.volteo = 0
  const x = c.x * g.W
  const y = c.y * g.H - m.u * 0.08
  const dy = Math.abs(c.y * g.H - m.centro)
  sVoltear()
  if (dy <= m.perfecto) {
    c.estado = 'dorado'
    texto(g, x, y, '¡Perfecto!', '#d9822b', m.u * 0.06, 1)
    estallar(g, x, c.y * g.H, ['#ffd166', '#ffffff', '#ffb35a'], 14, m.u * 0.6, 'destello')
  } else {
    c.estado = 'quemado'
    texto(g, x, y, '¡Se quemó!', '#7a4a6a', m.u * 0.05, 0.9)
    sQuemar()
  }
}

/** Voltea el panqueque en el aire más cercano al punto tocado. */
function tocar(g: Juego, px: number, py: number): void {
  const m = medidas(g.W, g.H)
  let mejor: Caida | null = null
  let mejorD = Infinity
  for (const c of g.caidas) {
    if (c.tipo !== 'panqueque' || c.volteo >= 0) continue
    const d = Math.hypot(c.x * g.W - px, c.y * g.H - py)
    if (d < m.pw * 0.6 && d < mejorD) {
      mejor = c
      mejorD = d
    }
  }
  if (mejor) voltearCaida(g, mejor, m)
}

/** Barra espaciadora: voltea el panqueque que esté más cerca de la línea de volteo. */
function voltearCentro(g: Juego) {
  const m = medidas(g.W, g.H)
  let mejor: Caida | null = null
  let mejorD = Infinity
  for (const c of g.caidas) {
    if (c.tipo !== 'panqueque' || c.volteo >= 0) continue
    const d = Math.abs(c.y * g.H - m.centro)
    if (d < g.H * 0.25 && d < mejorD) {
      mejor = c
      mejorD = d
    }
  }
  if (mejor) voltearCaida(g, mejor, m)
}

/** Avanza la simulación. Los efectos siempre avanzan; la partida solo mientras se juega. */
function paso(g: Juego, dt: number) {
  const m = medidas(g.W, g.H)
  g.reloj += dt
  g.rebote = Math.max(0, g.rebote - dt)
  g.sacudida = Math.max(0, g.sacudida - dt * 2)
  if (g.caraT > 0) {
    g.caraT -= dt
    if (g.caraT <= 0) g.cara = 'normal'
  }
  animarEfectos(g, dt, m)
  if (g.fase !== 'jugando') return

  g.t += dt

  // Plato: sigue el dedo (o las flechas) con suavidad.
  const desp = 0.9 * dt
  if (g.teclas.izq) g.platoObj -= desp
  if (g.teclas.der) g.platoObj += desp
  const mitad = m.plW / 2 / g.W
  g.platoObj = clamp(g.platoObj, mitad, 1 - mitad)
  const previo = g.plato
  g.plato += (g.platoObj - g.plato) * Math.min(1, dt * 14)
  g.sway = dt > 0 ? (g.plato - previo) / dt : 0

  // Aparecen panqueques y toppings; cada vez más rápido.
  g.spawn -= dt
  if (g.spawn <= 0) {
    spawnear(g)
    g.spawn = lerp(1.1, 0.5, g.t / DURACION) * (0.85 + Math.random() * 0.3)
  }

  for (const c of g.caidas) {
    c.y += c.vy * dt
    if (c.volteo >= 0) c.volteo += dt
  }

  // Atrapar o perder.
  const quedan: Caida[] = []
  for (const c of g.caidas) {
    const xp = c.x * g.W
    const yp = c.y * g.H
    const topY = m.baseY - g.pila.length * m.ph
    const dx = Math.abs(xp - g.plato * g.W)
    if (yp + m.ph * 0.7 >= topY && dx <= m.plW * 0.5) {
      atrapar(g, c, m)
      continue
    }
    if (yp > m.plY + m.ph * 1.8) {
      if (c.tipo === 'panqueque') fallar(g, m)
      continue
    }
    quedan.push(c)
  }
  g.caidas = quedan
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                             */
/* ------------------------------------------------------------------ */

function dibujarPanqueque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pw: number,
  ph: number,
  estado: Estado,
  volteo: number,
  cara: boolean,
) {
  let sx = 1
  let e: Estado = estado
  if (volteo >= 0) {
    const p = Math.min(1, volteo / 0.45)
    sx = Math.max(0.12, Math.abs(Math.cos(p * Math.PI)))
    if (p < 0.5) e = 'crudo'
  }
  const c = COLORES[e]
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, 1)
  rr(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2)
  ctx.fillStyle = c.side
  ctx.fill()
  rr(ctx, -pw / 2 + pw * 0.03, -ph / 2 + ph * 0.06, pw * 0.94, ph * 0.56, ph * 0.28)
  ctx.fillStyle = c.top
  ctx.fill()
  rr(ctx, -pw * 0.32, -ph * 0.34, pw * 0.22, ph * 0.12, ph * 0.06)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()
  if (e === 'dorado') {
    ctx.fillStyle = '#ffffff'
    destello(ctx, pw * 0.2, -ph * 0.12, ph * 0.16)
    ctx.fill()
    destello(ctx, -pw * 0.22, ph * 0.05, ph * 0.1)
    ctx.fill()
  }
  if (e === 'quemado') {
    ctx.fillStyle = 'rgba(60,30,15,0.55)'
    for (const [dx, dy] of [
      [0.2, -0.1],
      [-0.12, 0.05],
      [0.02, 0.12],
    ]) {
      ctx.beginPath()
      ctx.arc(pw * dx, ph * dy, ph * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (cara) {
    const r = Math.max(1.6, ph * 0.11)
    ctx.fillStyle = OJO
    ctx.beginPath()
    ctx.arc(-pw * 0.16, -ph * 0.08, r, 0, Math.PI * 2)
    ctx.arc(pw * 0.16, -ph * 0.08, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,120,160,0.6)'
    ctx.beginPath()
    ctx.ellipse(-pw * 0.3, -ph * 0.02, ph * 0.14, ph * 0.09, 0, 0, Math.PI * 2)
    ctx.ellipse(pw * 0.3, -ph * 0.02, ph * 0.14, ph * 0.09, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function dibujarTopping(ctx: CanvasRenderingContext2D, tipo: Topping, x: number, y: number, s: number) {
  ctx.save()
  switch (tipo) {
    case 'fresa': {
      ctx.fillStyle = '#ff5d7a'
      ctx.beginPath()
      ctx.ellipse(x, y, s * 0.42, s * 0.38, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3fbf7f'
      ctx.beginPath()
      ctx.ellipse(x - s * 0.2, y - s * 0.36, s * 0.2, s * 0.1, -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const [dx, dy] of [
        [-0.15, 0],
        [0.15, 0.1],
        [0, 0.22],
      ]) {
        ctx.beginPath()
        ctx.arc(x + s * dx, y + s * dy, s * 0.04, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'platano': {
      ctx.strokeStyle = '#ffd84d'
      ctx.lineCap = 'round'
      ctx.lineWidth = s * 0.36
      ctx.beginPath()
      ctx.arc(x, y - s * 0.25, s * 0.42, 0.25 * Math.PI, 0.95 * Math.PI)
      ctx.stroke()
      ctx.strokeStyle = '#f0b429'
      ctx.lineWidth = s * 0.05
      ctx.beginPath()
      ctx.arc(x, y - s * 0.25, s * 0.42 + s * 0.16, 0.3 * Math.PI, 0.9 * Math.PI)
      ctx.stroke()
      break
    }
    case 'miel': {
      ctx.fillStyle = '#ffb12e'
      ctx.beginPath()
      ctx.ellipse(x, y, s * 0.4, s * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x - s * 0.18, y + s * 0.24, s * 0.08, s * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.ellipse(x - s * 0.12, y - s * 0.1, s * 0.1, s * 0.05, -0.3, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'chispas': {
      const cols = ['#ff8fb8', '#ffd166', '#8fe3c8', '#b9a4ff', '#8ec5ff']
      for (let i = 0; i < cols.length; i++) {
        const a = (i / cols.length) * Math.PI * 2 + 0.3
        ctx.fillStyle = cols[i]
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.22, s * 0.11, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'crema': {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#ffd1e3'
      ctx.lineWidth = Math.max(1, s * 0.05)
      for (const [dx, dy] of [
        [-0.2, 0.02],
        [0.2, 0.02],
        [0, -0.14],
      ]) {
        ctx.beginPath()
        ctx.arc(x + s * dx, y + s * dy, s * 0.24, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      break
    }
  }
  ctx.restore()
}

function dibujarFondo(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const { W, H } = g
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#fff0f7')
  grad.addColorStop(0.6, '#ffe6f1')
  grad.addColorStop(1, '#ffdcea')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const luz = ctx.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, m.u * 0.6)
  luz.addColorStop(0, 'rgba(255,255,255,0.9)')
  luz.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = luz
  ctx.fillRect(0, 0, W, H)

  // Burbujitas que suben despacio.
  const tintes = ['rgba(255,255,255,0.5)', 'rgba(255,209,227,0.6)', 'rgba(217,200,255,0.5)', 'rgba(200,245,228,0.6)']
  for (let i = 0; i < 14; i++) {
    const bx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * W
    const vel = 0.02 + (i % 5) * 0.006
    const by = H - (((g.reloj * vel + i * 0.173) % 1) * H * 1.1)
    ctx.fillStyle = tintes[i % tintes.length]
    ctx.beginPath()
    ctx.arc(bx, by, m.u * (0.012 + (i % 4) * 0.008), 0, Math.PI * 2)
    ctx.fill()
  }
}

function dibujarLineaVolteo(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,143,184,0.5)'
  ctx.lineWidth = 2
  ctx.setLineDash([m.u * 0.03, m.u * 0.04])
  ctx.beginPath()
  ctx.moveTo(g.W * 0.05, m.centro)
  ctx.lineTo(g.W * 0.95, m.centro)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(255,143,184,0.7)'
  corazon(ctx, g.W * 0.05, m.centro, m.u * 0.05)
  ctx.fill()
  corazon(ctx, g.W * 0.95, m.centro, m.u * 0.05)
  ctx.fill()
  ctx.restore()
}

function dibujarPila(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const plX = g.plato * g.W
  const off = clamp(g.sway * g.W * 0.004, -10, 10)
  const n = g.pila.length
  for (let i = 0; i < n; i++) {
    const k = Math.min(1, (i + 1) / 6)
    const x = plX + off * k
    const yc = m.baseY - m.ph / 2 - i * m.ph
    const w = m.pw * (0.94 + ((i * 37) % 7) / 100)
    dibujarPanqueque(ctx, x, yc, w, m.ph, g.pila[i].estado, -1, false)
  }
  if (g.decor.length > 0) {
    const topY = m.baseY - n * m.ph
    const xTop = plX + off
    const s = Math.max(9, m.ph * 1.1)
    const separa = Math.min(s * 1.1, (m.pw * 0.85) / g.decor.length)
    g.decor.forEach((tp, k) => {
      const dx = (k - (g.decor.length - 1) / 2) * separa
      dibujarTopping(ctx, tp, xTop + dx, topY - s * 0.15, s)
    })
  }
}

/** Gatito chef: la cabeza va detrás del plato; las patitas, delante. */
function dibujarGato(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas, parte: 'cabeza' | 'patas') {
  const x = g.plato * g.W
  const y = m.catY
  const r = m.rc
  if (parte === 'patas') {
    ctx.fillStyle = CREMA
    ctx.strokeStyle = BORDE_GATO
    ctx.lineWidth = Math.max(1.5, r * 0.05)
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + s * m.plW * 0.46, m.plY + r * 0.1, r * 0.34, r * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    return
  }

  ctx.save()
  // Orejas
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(x + s * r * 0.62, y - r * 0.78)
    ctx.rotate(s * 0.35)
    ctx.fillStyle = CREMA
    ctx.strokeStyle = BORDE_GATO
    ctx.lineWidth = Math.max(1.5, r * 0.05)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.3, r * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffc2d6'
    ctx.beginPath()
    ctx.ellipse(0, r * 0.04, r * 0.14, r * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Cabeza
  ctx.fillStyle = CREMA
  ctx.strokeStyle = BORDE_GATO
  ctx.lineWidth = Math.max(1.5, r * 0.05)
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Moñito
  ctx.fillStyle = '#ff8fb8'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + r * 0.5 + s * r * 0.16, y - r * 0.82, r * 0.16, r * 0.1, s * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#f0649a'
  ctx.beginPath()
  ctx.arc(x + r * 0.5, y - r * 0.82, r * 0.06, 0, Math.PI * 2)
  ctx.fill()

  // Mejillas
  ctx.fillStyle = 'rgba(255,128,170,0.45)'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + s * r * 0.6, y + r * 0.2, r * 0.17, r * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ojos según el ánimo
  const ojoY = y - r * 0.06
  ctx.strokeStyle = OJO
  ctx.fillStyle = OJO
  ctx.lineCap = 'round'
  for (const s of [-1, 1]) {
    const ex = x + s * r * 0.38
    if (g.cara === 'feliz') {
      ctx.lineWidth = r * 0.09
      ctx.beginPath()
      ctx.arc(ex, ojoY + r * 0.05, r * 0.14, Math.PI, Math.PI * 2)
      ctx.stroke()
    } else if (g.cara === 'triste') {
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.arc(ex, ojoY, r * 0.13, 0, Math.PI)
      ctx.stroke()
    } else if (g.cara === 'sorpresa') {
      ctx.beginPath()
      ctx.ellipse(ex, ojoY, r * 0.13, r * 0.16, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex + r * 0.04, ojoY - r * 0.06, r * 0.045, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = OJO
    } else if (g.reloj % 3.3 < 0.12) {
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(ex - r * 0.12, ojoY)
      ctx.lineTo(ex + r * 0.12, ojoY)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(ex, ojoY, r * 0.1, r * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex + r * 0.035, ojoY - r * 0.05, r * 0.04, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = OJO
    }
  }

  // Boca
  ctx.lineWidth = r * 0.07
  ctx.beginPath()
  if (g.cara === 'feliz') {
    ctx.arc(x, y + r * 0.26, r * 0.2, 0.05 * Math.PI, 0.95 * Math.PI)
    ctx.stroke()
  } else if (g.cara === 'triste') {
    ctx.arc(x, y + r * 0.5, r * 0.14, 1.2 * Math.PI, 1.8 * Math.PI)
    ctx.stroke()
  } else if (g.cara === 'sorpresa') {
    ctx.ellipse(x, y + r * 0.36, r * 0.07, r * 0.09, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.arc(x, y + r * 0.26, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.stroke()
  }

  // Bigotes
  ctx.strokeStyle = '#e9b0c6'
  ctx.lineWidth = Math.max(1, r * 0.02)
  for (const s of [-1, 1]) {
    for (const dy of [0, 0.14]) {
      ctx.beginPath()
      ctx.moveTo(x + s * r * 0.7, y + r * (0.18 + dy))
      ctx.lineTo(x + s * r * 1.05, y + r * (0.12 + dy * 1.6))
      ctx.stroke()
    }
  }
  ctx.restore()
}

function dibujarPlato(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const x = g.plato * g.W
  const k = g.rebote > 0 ? 1 + Math.sin((g.rebote / 0.25) * Math.PI) * 0.06 : 1
  ctx.save()
  ctx.translate(x, m.plY)
  ctx.scale(k, k)
  ctx.translate(-x, -m.plY)

  ctx.fillStyle = 'rgba(150,70,110,0.16)'
  ctx.beginPath()
  ctx.ellipse(x, m.plY + m.ph * 0.9, m.plW * 0.52, m.plW * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffb3cf'
  ctx.beginPath()
  ctx.ellipse(x, m.plY, m.plW * 0.5, m.plW * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffd1e3'
  ctx.beginPath()
  ctx.ellipse(x, m.plY - m.ph * 0.1, m.plW * 0.5, m.plW * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()

  // Superficie: aquí se apila.
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffc2d9'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(x, m.baseY, m.plW * 0.42, m.plW * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Decoración del borde (lunares)
  ctx.fillStyle = '#ff8fb8'
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.15 + i * 0.14)
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * m.plW * 0.42, m.plY + Math.sin(a) * m.plW * 0.11, m.u * 0.008, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function dibujarMesa(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const y0 = g.H * 0.93
  const grad = ctx.createLinearGradient(0, y0, 0, g.H)
  grad.addColorStop(0, '#ffc2d9')
  grad.addColorStop(1, '#f59ec0')
  ctx.fillStyle = grad
  ctx.fillRect(0, y0, g.W, g.H - y0)
  ctx.fillStyle = '#ffe7f1'
  ctx.fillRect(0, y0, g.W, Math.max(3, m.u * 0.008))
}

function dibujar(ctx: CanvasRenderingContext2D, g: Juego) {
  const m = medidas(g.W, g.H)
  ctx.save()
  ctx.clearRect(0, 0, g.W, g.H)
  if (g.sacudida > 0) {
    const s = g.sacudida * g.sacudida * m.u * 0.03
    ctx.translate(Math.sin(g.reloj * 60) * s, Math.cos(g.reloj * 47) * s)
  }
  dibujarFondo(ctx, g, m)
  dibujarLineaVolteo(ctx, g, m)

  for (const c of g.caidas) {
    if (c.tipo === 'panqueque') {
      dibujarPanqueque(ctx, c.x * g.W, c.y * g.H, m.pw, m.ph * 1.4, c.estado, c.volteo, true)
    } else {
      const bob = Math.sin(g.reloj * 4 + c.ritmo) * m.u * 0.01
      dibujarTopping(ctx, c.tipo, c.x * g.W, c.y * g.H + bob, m.u * 0.12)
    }
  }

  dibujarPila(ctx, g, m)
  dibujarGato(ctx, g, m, 'cabeza')
  dibujarPlato(ctx, g, m)
  dibujarGato(ctx, g, m, 'patas')
  dibujarMesa(ctx, g, m)

  for (const p of g.particulas) {
    ctx.globalAlpha = clamp(p.vida / p.max, 0, 1)
    ctx.fillStyle = p.color
    ctx.beginPath()
    if (p.forma === 'corazon') {
      corazon(ctx, p.x, p.y, p.tam * 2)
      ctx.fill()
    } else if (p.forma === 'destello') {
      destello(ctx, p.x, p.y, p.tam * 1.2)
      ctx.fill()
    } else {
      ctx.arc(p.x, p.y, p.tam * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const t of g.textos) {
    const k = t.vida / t.max
    ctx.globalAlpha = Math.min(1, k * 2.5)
    ctx.font = `800 ${Math.round(t.tam)}px ${FONT}`
    ctx.lineWidth = Math.max(3, t.tam * 0.3)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.strokeText(t.texto, t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(t.texto, t.x, t.y)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* Componente                                                         */
/* ------------------------------------------------------------------ */

const BTN_BASE =
  'flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-extrabold transition active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffb3cf]'
const BTN_PRIMARIO = `${BTN_BASE} bg-[#ff7fae] text-white shadow-[0_6px_0_#e05c93] active:shadow-[0_3px_0_#e05c93]`
const BTN_SECUNDARIO = `${BTN_BASE} bg-[#fff0f6] text-[#c2497e] shadow-[0_4px_0_#ffc9de] active:shadow-[0_2px_0_#ffc9de]`
const BTN_ICONO =
  'pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[#f0649a] shadow-md transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffb3cf]'

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#ffe3ef]/60 p-4 backdrop-blur-[2px]">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white/95 p-6 text-center text-[#7a4a6a] shadow-[0_18px_50px_rgba(240,100,154,0.25)]">
        {children}
      </div>
    </div>
  )
}

export default function Panqueques({ onFinish, onSalir }: MinijuegoProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gRef = useRef<Juego | null>(null)
  const [fase, setFase] = useState<Fase>('inicio')
  const [seg, setSeg] = useState(DURACION)
  const [puntos, setPuntos] = useState(0)
  const [vidas, setVidas] = useState(VIDAS_MAX)
  const [racha, setRacha] = useState(0)
  const [resumen, setResumen] = useState<Resumen | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const g = crearJuego(1, 1)
    gRef.current = g

    const ajustar = () => {
      const r = wrap.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.W = w
      g.H = h
    }
    ajustar()
    const ro = new ResizeObserver(() => ajustar())
    ro.observe(wrap)

    const pausar = () => {
      if (g.fase === 'jugando') {
        g.fase = 'pausa'
        setFase('pausa')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        g.teclas.izq = true
        e.preventDefault()
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        g.teclas.der = true
        e.preventDefault()
      } else if (e.key === ' ') {
        e.preventDefault()
        if (g.fase === 'jugando' && !e.repeat) voltearCentro(g)
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (g.fase === 'jugando') pausar()
        else if (g.fase === 'pausa') {
          g.fase = 'jugando'
          setFase('jugando')
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') g.teclas.izq = false
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') g.teclas.der = false
    }
    const onVis = () => {
      if (document.hidden) pausar()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', pausar)
    document.addEventListener('visibilitychange', onVis)

    const ultimo = { seg: -1, puntos: -1, vidas: -1, racha: -1 }
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      paso(g, dt)
      if (g.fase === 'jugando' && (g.vidas <= 0 || g.t >= DURACION)) {
        g.fase = 'fin'
        g.teclas.izq = false
        g.teclas.der = false
        const monedas = monedasDe(g.puntos)
        setResumen({
          puntos: g.puntos,
          atrapados: g.atrapados,
          mejorRacha: g.mejorCombo,
          platos: g.platos,
          monedas,
        })
        setFase('fin')
        sFin()
      }
      dibujar(ctx, g)

      const s = Math.max(0, Math.ceil(DURACION - g.t))
      if (s !== ultimo.seg) {
        ultimo.seg = s
        setSeg(s)
      }
      if (g.puntos !== ultimo.puntos) {
        ultimo.puntos = g.puntos
        setPuntos(g.puntos)
      }
      if (g.vidas !== ultimo.vidas) {
        ultimo.vidas = g.vidas
        setVidas(g.vidas)
      }
      if (g.combo !== ultimo.racha) {
        ultimo.racha = g.combo
        setRacha(g.combo)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pausar)
      document.removeEventListener('visibilitychange', onVis)
      gRef.current = null
    }
  }, [])

  const iniciar = () => {
    const g = gRef.current
    if (!g) return
    reiniciar(g)
    setResumen(null)
    setSeg(DURACION)
    setPuntos(0)
    setVidas(VIDAS_MAX)
    setRacha(0)
    setFase('jugando')
    sInicio()
  }
  const reanudar = () => {
    const g = gRef.current
    if (!g) return
    g.fase = 'jugando'
    setFase('jugando')
  }
  const pausar = () => {
    const g = gRef.current
    if (!g || g.fase !== 'jugando') return
    g.fase = 'pausa'
    setFase('pausa')
  }

  const coords = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || g.fase !== 'jugando') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = coords(e)
    g.puntero = { activo: true, id: e.pointerId, x0: x, y0: y, t0: performance.now(), movido: false }
    g.platoObj = x / g.W
  }
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || !g.puntero.activo || e.pointerId !== g.puntero.id) return
    const { x, y } = coords(e)
    if (Math.hypot(x - g.puntero.x0, y - g.puntero.y0) > 10) g.puntero.movido = true
    g.platoObj = x / g.W
  }
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || !g.puntero.activo || e.pointerId !== g.puntero.id) return
    g.puntero.activo = false
    const { x, y } = coords(e)
    const rapido = performance.now() - g.puntero.t0 < 350
    if (!g.puntero.movido && rapido && g.fase === 'jugando') tocar(g, x, y)
  }

  const mult = multiplicador(racha)

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#ffeef6]" style={{ fontFamily: FONT }}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          aria-label="Escena de panqueques: arrastra para mover el plato y toca un panqueque en el aire para voltearlo"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      {(fase === 'jugando' || fase === 'pausa') && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 px-3 py-1.5 text-base font-extrabold tabular-nums text-[#7a4a6a] shadow-md">
                <Timer size={18} className="text-[#f0649a]" aria-hidden="true" />
                <span aria-label={`Tiempo restante: ${seg} segundos`}>
                  {Math.floor(seg / 60)}:{String(seg % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-2xl bg-white/90 px-3 py-2 shadow-md" aria-label={`Vidas: ${vidas}`}>
                {Array.from({ length: VIDAS_MAX }, (_, i) => (
                  <Heart
                    key={i}
                    size={18}
                    aria-hidden="true"
                    className={i < vidas ? 'fill-[#ff6f9f] text-[#ff6f9f]' : 'text-[#ff6f9f]/25'}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 px-4 py-1.5 text-xl font-black tabular-nums text-[#f0649a] shadow-md">
              {puntos} pts
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              {fase === 'jugando' ? (
                <button type="button" onClick={pausar} aria-label="Pausar" className={BTN_ICONO}>
                  <Pause size={20} />
                </button>
              ) : null}
              <button type="button" onClick={onSalir} aria-label="Salir del juego" className={BTN_ICONO}>
                <X size={20} />
              </button>
            </div>
          </div>

          {mult > 1 && fase === 'jugando' && (
            <div className="self-center rounded-full bg-[#ffb85c] px-4 py-1 text-sm font-black text-white shadow-md">
              ¡Racha x{mult}!
            </div>
          )}
        </div>
      )}

      {fase === 'inicio' && (
        <Panel>
          <svg viewBox="0 0 120 90" className="h-24 w-32 animate-bounce" aria-hidden="true">
            <ellipse cx="60" cy="82" rx="54" ry="6" fill="#ffb3cf" />
            <rect x="14" y="60" width="92" height="16" rx="8" fill="#f0be72" />
            <rect x="16" y="50" width="88" height="16" rx="8" fill="#f0be72" />
            <rect x="18" y="40" width="84" height="16" rx="8" fill="#f0be72" />
            <rect x="20" y="30" width="80" height="16" rx="8" fill="#ffb35a" />
            <rect x="24" y="31" width="72" height="6" rx="3" fill="#ffe6b3" />
            <circle cx="46" cy="16" r="3" fill="#5b3a52" />
            <circle cx="74" cy="16" r="3" fill="#5b3a52" />
            <path d="M52 22 Q60 28 68 22" stroke="#5b3a52" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <ellipse cx="38" cy="22" rx="5" ry="3" fill="#ff8fb8" opacity="0.7" />
            <ellipse cx="82" cy="22" rx="5" ry="3" fill="#ff8fb8" opacity="0.7" />
          </svg>
          <h2 className="text-3xl font-black text-[#f0649a]">Panqueques</h2>
          <ul className="flex flex-col gap-2 text-left text-base leading-snug">
            <li>Arrastra el plato para atrapar los panqueques que caen.</li>
            <li>Toca un panqueque en el aire cuando pase por la línea rosa: quedará dorado y vale triple.</li>
            <li>Los toppings suman puntos y decoran la pila. Un plato de {PILA_MAX} da bono.</li>
          </ul>
          <button type="button" onClick={iniciar} className={BTN_PRIMARIO}>
            ¡A cocinar!
          </button>
          <button type="button" onClick={onSalir} className="text-sm font-bold text-[#c2497e] underline">
            Volver
          </button>
        </Panel>
      )}

      {fase === 'pausa' && (
        <Panel>
          <h2 className="text-3xl font-black text-[#f0649a]">Pausa</h2>
          <p className="text-base">El tiempo se detuvo. Cuando quieras, seguimos.</p>
          <button type="button" onClick={reanudar} className={BTN_PRIMARIO}>
            <Play size={22} aria-hidden="true" />
            Seguir
          </button>
          <button type="button" onClick={onSalir} className={BTN_SECUNDARIO}>
            Salir
          </button>
        </Panel>
      )}

      {fase === 'fin' && resumen && (
        <Panel>
          <h2 className="text-3xl font-black text-[#f0649a]">¡Se acabó el turno!</h2>
          <div className="grid w-full grid-cols-2 gap-2">
            <Stat etiqueta="Puntos" valor={resumen.puntos} />
            <Stat etiqueta="Atrapados" valor={resumen.atrapados} />
            <Stat etiqueta="Mejor racha" valor={`x${multiplicador(resumen.mejorRacha)}`} />
            <Stat etiqueta="Platos completos" valor={resumen.platos} />
          </div>
          <div className="w-full rounded-2xl bg-[#fff3c4] px-4 py-3 text-lg font-extrabold text-[#9a6200]">
            Ganaste {resumen.monedas} monedas
          </div>
          <button
            type="button"
            onClick={() => onFinish({ monedas: resumen.monedas, puntos: resumen.puntos })}
            className={BTN_PRIMARIO}
          >
            ¡Cobrar monedas!
          </button>
          <button type="button" onClick={iniciar} className={BTN_SECUNDARIO}>
            <RotateCcw size={20} aria-hidden="true" />
            Otra vez
          </button>
        </Panel>
      )}
    </div>
  )
}

function Stat({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-[#fff0f6] px-2 py-2">
      <span className="text-xl font-black tabular-nums text-[#c2497e]">{valor}</span>
      <span className="text-xs font-bold text-[#7a4a6a]">{etiqueta}</span>
    </div>
  )
}
