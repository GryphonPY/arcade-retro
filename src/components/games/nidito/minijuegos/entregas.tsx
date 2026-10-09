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
const PILA_MAX = 7
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif'
const OJO = '#5b3a52'
const PIEL = '#ffe2d6'
const BORDE = '#f2b8cf'
const PELO = '#8f5c4c'
const VESTIDO = '#b9a4ff'
const CAJA_COLORES = ['#f7c48c', '#ffb3cf', '#b8f2e6', '#d9c8ff']
const CASA_COLORES = ['#ffd1e3', '#c9f0e0', '#d9c8ff', '#ffe9a8']
const CASA_TECHOS = ['#f49ac0', '#8fd9bd', '#b7a0f5', '#f5c94a']

interface Obj {
  tipo: 'caja' | 'casa' | 'bache'
  x: number // fracción del ancho (centro)
  hecho: boolean
  variante: number
}
interface Hoja {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  color: string
  vida: number
}
interface Escombro {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  color: string
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
type EstadoViento = 'espera' | 'aviso' | 'sopla'
type Fase = 'inicio' | 'jugando' | 'pausa' | 'fin'
type Cara = 'normal' | 'feliz' | 'triste'
interface Resumen {
  puntos: number
  entregas: number
  mejorRacha: number
  cajas: number
  monedas: number
}
interface Juego {
  fase: Fase
  W: number
  H: number
  reloj: number
  t: number // tiempo jugado (se detiene en pausa)
  dist: number // distancia recorrida por la calle (px)
  espera: number // distancia hasta el siguiente objeto (px)
  objs: Obj[]
  pila: number[] // color de cada caja en la torre
  L: number // inclinación de la torre
  V: number // velocidad de la inclinación
  T: number // inclinación de la bandeja (la sigue el dedo)
  gracia: number // segundos sin riesgo tras una caída
  viento: { estado: EstadoViento; t: number; dir: 1 | -1 }
  hojas: Hoja[]
  escombros: Escombro[]
  particulas: Particula[]
  textos: Texto[]
  vidas: number
  puntos: number
  entregas: number
  racha: number
  mejorRacha: number
  cajas: number
  rebote: number // rebote del repartidor
  cara: Cara
  caraT: number
  sacudida: number
  puntero: { activo: boolean; id: number; x0: number; y0: number; x: number; y: number; d: number }
  teclas: { izq: boolean; der: boolean }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const monedasDe = (puntos: number) => Math.floor(puntos / 4)

/** Medidas del mundo en píxeles CSS, derivadas del tamaño de la pantalla. */
function medidas(W: number, H: number) {
  const u = Math.min(W * 0.92, H * 0.7)
  const sueloY = H * 0.8
  const rc = u * 0.11
  return {
    u,
    sueloY,
    cx: W * 0.3,
    rc,
    cabezaY: sueloY - u * 0.36,
    cajaW: u * 0.13,
    cajaH: u * 0.085,
    bandejaW: u * 0.34,
    bandejaH: u * 0.03,
    casaW: u * 0.46,
    casaH: u * 0.4,
    meterY: sueloY + (H - sueloY) * 0.45,
    meterW: u * 0.55,
  }
}
type Medidas = ReturnType<typeof medidas>

/** Punto de apoyo de la bandeja: encima de la cabeza, sigue la inclinación del repartidor. */
function pivote(g: Juego, m: Medidas) {
  const h = g.T * 0.25
  const d = m.rc * 1.25
  return { x: m.cx + d * Math.sin(h), y: m.cabezaY - d * Math.cos(h) }
}

function crearJuego(W: number, H: number): Juego {
  return {
    fase: 'inicio',
    W,
    H,
    reloj: 0,
    t: 0,
    dist: 0,
    espera: 0,
    objs: [],
    pila: [],
    L: 0,
    V: 0,
    T: 0,
    gracia: 0,
    viento: { estado: 'espera', t: 2.5, dir: 1 },
    hojas: [],
    escombros: [],
    particulas: [],
    textos: [],
    vidas: VIDAS_MAX,
    puntos: 0,
    entregas: 0,
    racha: 0,
    mejorRacha: 0,
    cajas: 0,
    rebote: 0,
    cara: 'normal',
    caraT: 0,
    sacudida: 0,
    puntero: { activo: false, id: -1, x0: 0, y0: 0, x: 0, y: 0, d: 0 },
    teclas: { izq: false, der: false },
  }
}

function reiniciar(g: Juego) {
  const nuevo = crearJuego(g.W, g.H)
  nuevo.fase = 'jugando'
  nuevo.espera = medidas(g.W, g.H).u * 0.8
  Object.assign(g, nuevo)
}

/* ------------------------------------------------------------------ */
/* Sonidos y vibración                                                */
/* ------------------------------------------------------------------ */

const sCaja = () => tone({ freq: 740, to: 1100, dur: 0.1, vol: 0.05, type: 'triangle' })
const sEntrega = () => [660, 880, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.05, delay: i * 0.06, type: 'sine' }))
const sBache = () => {
  tone({ freq: 160, to: 70, dur: 0.18, vol: 0.06, type: 'triangle' })
  noise({ dur: 0.12, vol: 0.05, freq: 500 })
}
const sCaida = () => {
  tone({ freq: 330, to: 90, dur: 0.5, vol: 0.06, type: 'sawtooth' })
  noise({ dur: 0.35, vol: 0.07, freq: 800 })
}
const sViento = () => noise({ dur: 0.5, vol: 0.04, freq: 1500 })
const sSinCajas = () => tone({ freq: 300, to: 220, dur: 0.14, vol: 0.04, type: 'sine' })
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
/* Utilidades de dibujo y efectos                                     */
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

/* ------------------------------------------------------------------ */
/* Lógica del juego                                                   */
/* ------------------------------------------------------------------ */

function spawnear(g: Juego) {
  const r = Math.random()
  // Si la torre está vacía, aparecen más cajas para poder seguir repartiendo.
  const sinCajas = g.pila.length === 0
  let tipo: Obj['tipo']
  if (sinCajas && r < 0.7) tipo = 'caja'
  else if (r < 0.42) tipo = 'caja'
  else if (r < 0.74) tipo = 'casa'
  else if (r < 0.9) tipo = 'bache'
  else return
  g.objs.push({ tipo, x: 1.08, hecho: false, variante: (Math.random() * 4) | 0 })
}

function recoger(g: Juego, m: Medidas) {
  if (g.pila.length >= PILA_MAX) {
    texto(g, m.cx, m.sueloY - m.u * 0.5, '¡Llena!', '#7a4a6a', m.u * 0.05)
    return
  }
  g.pila.push((Math.random() * CAJA_COLORES.length) | 0)
  g.puntos += 1
  g.cajas++
  texto(g, m.cx, m.cabezaY - m.u * 0.35, '+1', '#d9822b', m.u * 0.05)
  estallar(g, m.cx, m.sueloY - m.u * 0.1, ['#ffe6b3', '#ffb3cf', '#ffffff'], 10, m.u * 0.4, 'destello')
  g.cara = 'feliz'
  g.caraT = 0.7
  sCaja()
}

function entregar(g: Juego, m: Medidas) {
  const x = m.cx
  if (g.pila.length === 0) {
    texto(g, x, m.sueloY - m.u * 0.6, '¡Sin cajas!', '#7a4a6a', m.u * 0.05)
    sSinCajas()
    return
  }
  g.pila.pop()
  g.entregas++
  g.racha++
  g.mejorRacha = Math.max(g.mejorRacha, g.racha)
  const pts = 10 + 2 * Math.min(g.racha - 1, 5)
  g.puntos += pts
  texto(g, x, m.sueloY - m.u * 0.6, `¡Entregado! +${pts}`, '#e0557f', m.u * 0.06, 1.2)
  const mx = x
  const my = m.sueloY - m.u * 0.22
  estallar(g, mx, my, ['#ff8fb8', '#ffd1e3', '#ffffff'], 16, m.u * 0.7, 'corazon')
  g.rebote = 0.25
  g.cara = 'feliz'
  g.caraT = 1
  sEntrega()
  vibrar(14)
}

function bache(g: Juego, m: Medidas) {
  const dir = Math.random() < 0.5 ? -1 : 1
  if (g.pila.length > 0) g.V += dir * 1.2
  g.sacudida = 0.35
  g.rebote = 0.3
  texto(g, m.cx, m.cabezaY - m.u * 0.2, '¡Bache!', '#7a4a6a', m.u * 0.05)
  sBache()
}

/** Se cae la torre: pierde una vida y las cajas salen volando. */
function caer(g: Juego, m: Medidas) {
  const p = pivote(g, m)
  const a = g.L * 0.35
  g.pila.forEach((color, i) => {
    const d = (i + 0.5) * m.cajaH
    g.escombros.push({
      x: p.x + d * Math.sin(a),
      y: p.y - d * Math.cos(a),
      vx: (Math.random() - 0.5) * m.u * 0.8 + Math.sign(g.L || 1) * m.u * 0.3,
      vy: -m.u * (0.2 + Math.random() * 0.4),
      rot: a,
      vr: (Math.random() - 0.5) * 6,
      color: CAJA_COLORES[color],
    })
  })
  g.pila = []
  g.L = 0
  g.V = 0
  g.vidas--
  g.racha = 0
  g.gracia = 1.5
  g.cara = 'triste'
  g.caraT = 1.2
  g.sacudida = 0.6
  texto(g, m.cx, m.cabezaY - m.u * 0.5, '¡Ay no!', '#e0557f', m.u * 0.07, 1.1)
  sCaida()
  vibrar([40, 60, 40])
}

function actualizarViento(g: Juego, dt: number, m: Medidas) {
  const v = g.viento
  v.t -= dt
  if (v.t <= 0) {
    if (v.estado === 'espera') {
      v.estado = 'aviso'
      v.t = 0.9
      v.dir = Math.random() < 0.5 ? -1 : 1
      texto(g, g.W / 2, m.u * 0.25, v.dir > 0 ? '¡Viento →!' : '¡Viento ←!', '#4f8fb8', m.u * 0.06, 1.2)
    } else if (v.estado === 'aviso') {
      v.estado = 'sopla'
      v.t = 1.1
      sViento()
    } else {
      v.estado = 'espera'
      v.t = 2.4 + Math.random() * 1.8
    }
  }
  if (v.estado !== 'espera' && Math.random() < dt * 9) {
    const desdeIzq = v.dir > 0
    g.hojas.push({
      x: desdeIzq ? -0.05 * g.W : 1.05 * g.W,
      y: m.sueloY * (0.25 + Math.random() * 0.5),
      vx: v.dir * m.u * (0.9 + Math.random() * 0.6),
      vy: (Math.random() - 0.5) * m.u * 0.1,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 8,
      color: Math.random() < 0.5 ? '#ffb3cf' : '#9fe6c2',
      vida: 3,
    })
  }
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
  const vel = m.u * (0.55 + 0.005 * g.t)
  g.dist += vel * dt
  for (const o of g.objs) o.x -= (vel * dt) / g.W
  g.objs = g.objs.filter((o) => o.x > -0.3)

  g.espera -= vel * dt
  if (g.espera <= 0) {
    spawnear(g)
    g.espera = m.u * (0.9 + Math.random() * 0.5)
  }

  // La bandeja sigue el dedo (o las flechas); sin dedo vuelve al centro.
  const meta = g.puntero.activo ? g.puntero.d : clamp((g.teclas.der ? 1 : 0) - (g.teclas.izq ? 1 : 0), -1, 1)
  g.T += (meta - g.T) * Math.min(1, dt * 6)

  actualizarViento(g, dt, m)

  if (g.gracia > 0) g.gracia -= dt

  // Física de la torre: un péndulo invertido que la bandeja arrastra.
  const n = g.pila.length
  if (n === 0) {
    g.L = 0
    g.V = 0
  } else {
    const G = 0.5 + n * 0.8
    const F =
      g.viento.estado === 'sopla'
        ? g.viento.dir * (1.6 + n * 0.2) * Math.sin(Math.PI * clamp(1 - g.viento.t / 1.1, 0, 1))
        : 0
    const acc = 9 * (g.T - g.L) + G * g.L - 2.6 * g.V + F
    g.V += acc * dt
    g.L += g.V * dt
    if (g.gracia <= 0 && Math.abs(g.L) > 1) caer(g, m)
  }

  // Cajas en el piso, baches y casas que pasan junto al repartidor.
  for (const o of g.objs) {
    if (o.hecho) continue
    const xp = o.x * g.W
    if (o.tipo === 'caja' && xp <= m.cx) {
      o.hecho = true
      recoger(g, m)
    } else if (o.tipo === 'bache' && xp <= m.cx) {
      o.hecho = true
      bache(g, m)
    } else if (o.tipo === 'casa' && xp + m.u * 0.27 <= m.cx) {
      o.hecho = true
      entregar(g, m)
    }
  }
}

function animarEfectos(g: Juego, dt: number, m: Medidas) {
  for (const p of g.particulas) {
    p.vida -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += m.u * 2.2 * dt
    p.vx *= Math.max(0, 1 - 2.2 * dt)
  }
  g.particulas = g.particulas.filter((p) => p.vida > 0)
  for (const t of g.textos) {
    t.vida -= dt
    t.y -= m.u * 0.35 * dt
  }
  g.textos = g.textos.filter((t) => t.vida > 0)
  for (const e of g.escombros) {
    e.vy += m.u * 2.4 * dt
    e.x += e.vx * dt
    e.y += e.vy * dt
    e.rot += e.vr * dt
  }
  g.escombros = g.escombros.filter((e) => e.y < g.H + m.u * 0.2)
  for (const h of g.hojas) {
    h.x += h.vx * dt
    h.y += h.vy * dt + Math.sin(g.reloj * 3 + h.rot) * m.u * 0.02 * dt
    h.rot += h.vr * dt
    h.vida -= dt
  }
  g.hojas = g.hojas.filter((h) => h.vida > 0 && h.x > -0.1 * g.W && h.x < 1.1 * g.W)
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                             */
/* ------------------------------------------------------------------ */

function dibujarCielo(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const { W, H } = g
  const cielo = ctx.createLinearGradient(0, 0, 0, m.sueloY)
  cielo.addColorStop(0, '#cfeaff')
  cielo.addColorStop(0.7, '#ffe6f2')
  cielo.addColorStop(1, '#ffe9e2')
  ctx.fillStyle = cielo
  ctx.fillRect(0, 0, W, H)

  // Sol
  const sol = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, m.u * 0.45)
  sol.addColorStop(0, 'rgba(255,250,220,0.95)')
  sol.addColorStop(1, 'rgba(255,250,220,0)')
  ctx.fillStyle = sol
  ctx.fillRect(0, 0, W, H)

  // Nubes con paralaje
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 4; i++) {
    const base = ((i * 0.31 - g.dist * 0.00006 + 1.5) % 1.4) - 0.2
    const x = base * W
    const y = H * (0.08 + (i % 2) * 0.12)
    const s = m.u * (0.08 + (i % 3) * 0.03)
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.arc(x + s * 1.1, y - s * 0.4, s * 1.2, 0, Math.PI * 2)
    ctx.arc(x + s * 2.3, y, s * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }

  // Colinas suaves
  ctx.fillStyle = '#c9f0d9'
  ctx.beginPath()
  ctx.moveTo(0, m.sueloY)
  for (let x = 0; x <= W + m.u * 0.6; x += m.u * 0.6) {
    const k = ((x + g.dist * 0.3) % (m.u * 1.8)) / (m.u * 1.8)
    ctx.lineTo(x, m.sueloY - m.u * 0.2 - Math.sin(k * Math.PI * 2) * m.u * 0.08)
  }
  ctx.lineTo(W, m.sueloY)
  ctx.closePath()
  ctx.fill()
}

function dibujarCalle(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  ctx.fillStyle = '#ffe2bf'
  ctx.fillRect(0, m.sueloY, g.W, g.H - m.sueloY)
  ctx.fillStyle = '#ffcf9f'
  ctx.fillRect(0, m.sueloY, g.W, Math.max(3, m.u * 0.008))

  // Adoquines que pasan: dan sensación de velocidad.
  ctx.fillStyle = 'rgba(214,160,110,0.25)'
  const sep = m.u * 0.26
  const off = g.dist % sep
  for (let x = -off; x < g.W + sep; x += sep) {
    rr(ctx, x, m.sueloY + m.u * 0.05, m.u * 0.14, m.u * 0.03, m.u * 0.015)
    ctx.fill()
    rr(ctx, x + sep * 0.5, m.sueloY + m.u * 0.15, m.u * 0.14, m.u * 0.03, m.u * 0.015)
    ctx.fill()
  }
}

function dibujarCasa(ctx: CanvasRenderingContext2D, g: Juego, o: Obj, m: Medidas) {
  const cx = o.x * g.W
  const hw = m.casaW
  const hh = m.casaH
  const y0 = m.sueloY
  const color = CASA_COLORES[o.variante]
  const techo = CASA_TECHOS[o.variante]

  rr(ctx, cx - hw / 2, y0 - hh, hw, hh, m.u * 0.03)
  ctx.fillStyle = color
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx - hw / 2 - m.u * 0.03, y0 - hh)
  ctx.lineTo(cx, y0 - hh - m.u * 0.2)
  ctx.lineTo(cx + hw / 2 + m.u * 0.03, y0 - hh)
  ctx.closePath()
  ctx.fillStyle = techo
  ctx.fill()

  // Ventana con luz y puerta redondeada
  ctx.fillStyle = '#fff8d6'
  rr(ctx, cx - hw * 0.34, y0 - hh * 0.72, hw * 0.26, hw * 0.24, m.u * 0.012)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx - hw * 0.34 + hw * 0.13, y0 - hh * 0.72 + hw * 0.12, m.u * 0.018, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e0a8c0'
  ctx.beginPath()
  ctx.moveTo(cx - hw * 0.06, y0)
  ctx.lineTo(cx - hw * 0.06, y0 - hh * 0.4)
  ctx.arc(cx - hw * 0.06 + hw * 0.12, y0 - hh * 0.4, hw * 0.12, Math.PI, 0)
  ctx.lineTo(cx + hw * 0.06, y0)
  ctx.closePath()
  ctx.fill()

  // Buzón (a la derecha de la casa): ahí se entrega.
  const bx = cx + hw / 2 + m.u * 0.04
  ctx.fillStyle = '#8f7a9e'
  ctx.fillRect(bx - m.u * 0.008, y0 - m.u * 0.12, m.u * 0.016, m.u * 0.12)
  ctx.fillStyle = '#ff8fb8'
  rr(ctx, bx - m.u * 0.05, y0 - m.u * 0.22, m.u * 0.1, m.u * 0.12, m.u * 0.04)
  ctx.fill()
  ctx.fillStyle = '#e0557f'
  ctx.fillRect(bx + m.u * 0.05, y0 - m.u * 0.2, m.u * 0.012, m.u * 0.1)
}

function dibujarCaja(ctx: CanvasRenderingContext2D, x: number, yBase: number, w: number, h: number, color: string) {
  rr(ctx, x - w / 2, yBase - h, w, h, h * 0.18)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = Math.max(1, h * 0.08)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillRect(x - w * 0.06, yBase - h, w * 0.12, h)
  ctx.beginPath()
  ctx.ellipse(x - w * 0.12, yBase - h * 1.05, w * 0.1, h * 0.22, -0.4, 0, Math.PI * 2)
  ctx.ellipse(x + w * 0.12, yBase - h * 1.05, w * 0.1, h * 0.22, 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function dibujarBache(ctx: CanvasRenderingContext2D, x: number, sueloY: number, u: number) {
  ctx.fillStyle = '#e0bd96'
  ctx.beginPath()
  ctx.ellipse(x, sueloY + u * 0.02, u * 0.15, u * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#c79a6e'
  ctx.lineWidth = Math.max(1.5, u * 0.008)
  ctx.beginPath()
  ctx.moveTo(x - u * 0.09, sueloY + u * 0.01)
  ctx.lineTo(x - u * 0.03, sueloY + u * 0.03)
  ctx.lineTo(x + u * 0.04, sueloY + u * 0.0)
  ctx.stroke()
}

function dibujarRepartidor(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const { cx, sueloY, u, rc } = m
  const salto = g.rebote > 0 ? Math.sin((g.rebote / 0.3) * Math.PI) * u * 0.02 : 0
  const baseY = sueloY - salto
  const paso = Math.sin(g.reloj * 9) * u * 0.02

  // Zapatitos
  ctx.fillStyle = '#c2497e'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(cx + s * u * 0.05 + paso * s, baseY - u * 0.01, u * 0.055, u * 0.03, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Vestido
  rr(ctx, cx - u * 0.1, baseY - u * 0.33, u * 0.2, u * 0.24, u * 0.08)
  ctx.fillStyle = VESTIDO
  ctx.fill()
  ctx.strokeStyle = '#9a86e0'
  ctx.lineWidth = Math.max(1.5, u * 0.006)
  ctx.stroke()
  // Moño de la cintura
  ctx.fillStyle = '#ff8fb8'
  ctx.beginPath()
  ctx.ellipse(cx - u * 0.04, baseY - u * 0.2, u * 0.03, u * 0.02, -0.3, 0, Math.PI * 2)
  ctx.ellipse(cx + u * 0.04, baseY - u * 0.2, u * 0.03, u * 0.02, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Brazos hacia las puntas de la bandeja
  const p = pivote(g, m)
  const a = g.T * 0.45
  const ex = (u * 0.34) / 2
  const puntas = [
    { x: p.x - ex * Math.cos(a), y: p.y - ex * Math.sin(a) },
    { x: p.x + ex * Math.cos(a), y: p.y + ex * Math.sin(a) },
  ]
  ctx.strokeStyle = PIEL
  ctx.lineCap = 'round'
  ctx.lineWidth = u * 0.04
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1
    ctx.beginPath()
    ctx.moveTo(cx + s * u * 0.085, baseY - u * 0.3)
    ctx.quadraticCurveTo(cx + s * u * 0.18, baseY - u * 0.3, puntas[i].x, puntas[i].y + u * 0.01)
    ctx.stroke()
  }

  // Cabeza (se inclina con la bandeja)
  ctx.save()
  ctx.translate(cx, m.cabezaY)
  ctx.rotate(g.T * 0.25)
  // Pelo (atrás)
  ctx.fillStyle = PELO
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(s * rc * 0.95, -rc * 0.1, rc * 0.36, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.ellipse(0, -rc * 0.12, rc * 1.06, rc * 0.98, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  // Cara
  ctx.fillStyle = PIEL
  ctx.strokeStyle = BORDE
  ctx.lineWidth = Math.max(1.5, rc * 0.05)
  ctx.beginPath()
  ctx.ellipse(0, 0, rc, rc * 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // Flequillo
  ctx.fillStyle = PELO
  ctx.beginPath()
  ctx.ellipse(-rc * 0.35, -rc * 0.5, rc * 0.5, rc * 0.28, -0.2, 0, Math.PI * 2)
  ctx.ellipse(rc * 0.25, -rc * 0.6, rc * 0.45, rc * 0.25, 0.3, 0, Math.PI * 2)
  ctx.fill()
  // Moñito rosa
  ctx.fillStyle = '#ff8fb8'
  ctx.beginPath()
  ctx.ellipse(rc * 0.55 + rc * 0.14, -rc * 0.78, rc * 0.2, rc * 0.13, 0.4, 0, Math.PI * 2)
  ctx.ellipse(rc * 0.55 - rc * 0.14, -rc * 0.78, rc * 0.2, rc * 0.13, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // Ojos
  ctx.strokeStyle = OJO
  ctx.fillStyle = OJO
  ctx.lineCap = 'round'
  for (const s of [-1, 1]) {
    const ex2 = s * rc * 0.38
    const ey = rc * 0.02
    if (g.cara === 'feliz') {
      ctx.lineWidth = rc * 0.1
      ctx.beginPath()
      ctx.arc(ex2, ey + rc * 0.05, rc * 0.13, Math.PI, Math.PI * 2)
      ctx.stroke()
    } else if (g.cara === 'triste') {
      ctx.lineWidth = rc * 0.09
      ctx.beginPath()
      ctx.arc(ex2, ey, rc * 0.12, 0, Math.PI)
      ctx.stroke()
    } else if (g.reloj % 3.6 < 0.12) {
      ctx.lineWidth = rc * 0.08
      ctx.beginPath()
      ctx.moveTo(ex2 - rc * 0.12, ey)
      ctx.lineTo(ex2 + rc * 0.12, ey)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(ex2, ey, rc * 0.1, rc * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex2 + rc * 0.035, ey - rc * 0.05, rc * 0.04, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = OJO
    }
  }
  // Mejillas y boca
  ctx.fillStyle = 'rgba(255,128,170,0.45)'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * rc * 0.6, rc * 0.36, rc * 0.17, rc * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = OJO
  ctx.lineWidth = rc * 0.07
  ctx.beginPath()
  if (g.cara === 'triste') {
    ctx.arc(0, rc * 0.7, rc * 0.14, 1.2 * Math.PI, 1.8 * Math.PI)
  } else if (g.cara === 'feliz') {
    ctx.arc(0, rc * 0.4, rc * 0.2, 0.05 * Math.PI, 0.95 * Math.PI)
  } else {
    ctx.arc(0, rc * 0.4, rc * 0.1, 0.1 * Math.PI, 0.9 * Math.PI)
  }
  ctx.stroke()
  ctx.restore()

  // Bandeja (gira con el dedo) y torre de cajas
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(g.T * 0.45)
  rr(ctx, -m.bandejaW / 2, 0, m.bandejaW, m.bandejaH, m.bandejaH / 2)
  ctx.fillStyle = '#ffcf9f'
  ctx.fill()
  ctx.strokeStyle = '#f0a86c'
  ctx.lineWidth = Math.max(1, u * 0.004)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(g.L * 0.35)
  g.pila.forEach((color, i) => {
    dibujarCaja(ctx, 0, -i * m.cajaH, m.cajaW, m.cajaH, CAJA_COLORES[color])
  })
  ctx.restore()
}

function dibujarEscombros(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  for (const e of g.escombros) {
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(e.rot)
    dibujarCaja(ctx, 0, m.cajaH / 2, m.cajaW, m.cajaH, e.color)
    ctx.restore()
  }
}

function dibujarMedidor(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas) {
  const w = m.meterW
  const h = m.u * 0.05
  const x = g.W / 2
  const y = m.meterY
  rr(ctx, x - w / 2, y - h / 2, w, h, h / 2)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fill()
  // Zona de peligro en los extremos
  ctx.fillStyle = 'rgba(255,143,184,0.35)'
  ctx.fillRect(x - w / 2, y - h / 2, w * 0.15, h)
  ctx.fillRect(x + w / 2 - w * 0.15, y - h / 2, w * 0.15, h)
  ctx.fillStyle = '#c2497e'
  ctx.fillRect(x - 1, y - h * 0.45, 2, h * 0.9)

  const k = clamp(g.L, -1, 1)
  const kx = x + k * (w / 2 - h * 0.5)
  const fuerte = Math.abs(g.L) > 0.6
  ctx.beginPath()
  ctx.arc(kx, y, h * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = fuerte ? '#ff6f9f' : '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#ff8fb8'
  ctx.lineWidth = Math.max(2, h * 0.14)
  ctx.stroke()
}

function dibujarHojas(ctx: CanvasRenderingContext2D, g: Juego, m: Medidas, delante: boolean) {
  for (const h of g.hojas) {
    if ((h.y > m.sueloY) !== delante) continue
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(h.rot)
    ctx.fillStyle = h.color
    ctx.beginPath()
    ctx.ellipse(0, 0, m.u * 0.035, m.u * 0.018, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function dibujar(ctx: CanvasRenderingContext2D, g: Juego) {
  const m = medidas(g.W, g.H)
  ctx.save()
  ctx.clearRect(0, 0, g.W, g.H)
  if (g.sacudida > 0) {
    const s = g.sacudida * g.sacudida * m.u * 0.03
    ctx.translate(Math.sin(g.reloj * 60) * s, Math.cos(g.reloj * 47) * s)
  }
  dibujarCielo(ctx, g, m)
  dibujarCalle(ctx, g, m)

  for (const o of g.objs) {
    if (o.tipo === 'casa') dibujarCasa(ctx, g, o, m)
    else if (o.tipo === 'caja' && !o.hecho) {
      dibujarCaja(ctx, o.x * g.W, m.sueloY + m.u * 0.03, m.cajaW, m.cajaH, CAJA_COLORES[o.variante])
    } else if (o.tipo === 'bache') dibujarBache(ctx, o.x * g.W, m.sueloY, m.u)
  }

  dibujarHojas(ctx, g, m, false)
  dibujarRepartidor(ctx, g, m)
  dibujarEscombros(ctx, g, m)
  dibujarHojas(ctx, g, m, true)

  if (g.fase === 'jugando' || g.fase === 'pausa') dibujarMedidor(ctx, g, m)

  // Guía del dedo: anillo donde empezó y punto donde está ahora.
  const pz = g.puntero
  if (pz.activo && g.fase === 'jugando') {
    ctx.strokeStyle = 'rgba(255,143,184,0.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(pz.x0, pz.y0, m.u * 0.1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([m.u * 0.02, m.u * 0.03])
    ctx.beginPath()
    ctx.moveTo(pz.x0, pz.y0)
    ctx.lineTo(pz.x, pz.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ff8fb8'
    ctx.beginPath()
    ctx.arc(pz.x, pz.y, m.u * 0.035, 0, Math.PI * 2)
    ctx.fill()
  }

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
  'flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-extrabold transition active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9dcff]'
const BTN_PRIMARIO = `${BTN_BASE} bg-[#7fb9ff] text-white shadow-[0_6px_0_#5c9ae0] active:shadow-[0_3px_0_#5c9ae0]`
const BTN_SECUNDARIO = `${BTN_BASE} bg-[#eef6ff] text-[#3d7bc2] shadow-[0_4px_0_#c9e2ff] active:shadow-[0_2px_0_#c9e2ff]`
const BTN_ICONO =
  'pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[#3d7bc2] shadow-md transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9dcff]'

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#eef7ff]/60 p-4 backdrop-blur-[2px]">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white/95 p-6 text-center text-[#2f5a80] shadow-[0_18px_50px_rgba(90,150,220,0.25)]">
        {children}
      </div>
    </div>
  )
}

function Stat({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-[#eef6ff] px-2 py-2">
      <span className="text-xl font-black tabular-nums text-[#3d7bc2]">{valor}</span>
      <span className="text-xs font-bold text-[#2f5a80]">{etiqueta}</span>
    </div>
  )
}

export default function Entregas({ onFinish, onSalir }: MinijuegoProps) {
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
        g.puntero.activo = false
        g.puntero.d = 0
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
        g.puntero.activo = false
        g.teclas.izq = false
        g.teclas.der = false
        setResumen({
          puntos: g.puntos,
          entregas: g.entregas,
          mejorRacha: g.mejorRacha,
          cajas: g.cajas,
          monedas: monedasDe(g.puntos),
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
      if (g.racha !== ultimo.racha) {
        ultimo.racha = g.racha
        setRacha(g.racha)
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
    g.puntero.activo = false
    g.puntero.d = 0
    setFase('pausa')
  }

  const coords = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const actualizarDedo = (g: Juego, x: number, y: number) => {
    const m = medidas(g.W, g.H)
    g.puntero.x = x
    g.puntero.y = y
    g.puntero.d = clamp((x - g.puntero.x0) / (m.u * 0.25), -1, 1)
  }
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || g.fase !== 'jugando') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = coords(e)
    g.puntero = { activo: true, id: e.pointerId, x0: x, y0: y, x, y, d: 0 }
  }
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || !g.puntero.activo || e.pointerId !== g.puntero.id) return
    const { x, y } = coords(e)
    actualizarDedo(g, x, y)
  }
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current
    if (!g || !g.puntero.activo || e.pointerId !== g.puntero.id) return
    g.puntero.activo = false
    g.puntero.d = 0
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#eef7ff]" style={{ fontFamily: FONT }}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          aria-label="Escena de entregas: arrastra para inclinar la bandeja y mantener la torre de cajas en equilibrio"
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
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 px-3 py-1.5 text-base font-extrabold tabular-nums text-[#2f5a80] shadow-md">
                <Timer size={18} className="text-[#3d7bc2]" aria-hidden="true" />
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

            <div className="rounded-2xl bg-white/90 px-4 py-1.5 text-xl font-black tabular-nums text-[#3d7bc2] shadow-md">
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

          {racha >= 3 && fase === 'jugando' && (
            <div className="self-center rounded-full bg-[#ffb85c] px-4 py-1 text-sm font-black text-white shadow-md">
              ¡Racha de {racha} entregas!
            </div>
          )}
        </div>
      )}

      {fase === 'inicio' && (
        <Panel>
          <svg viewBox="0 0 120 90" className="h-24 w-32" aria-hidden="true">
            <rect x="40" y="48" width="40" height="34" rx="6" fill="#ffb3cf" />
            <rect x="34" y="34" width="52" height="16" rx="6" fill="#f7c48c" />
            <rect x="30" y="22" width="60" height="14" rx="6" fill="#b8f2e6" />
            <rect x="56" y="22" width="8" height="14" fill="rgba(255,255,255,0.8)" />
            <circle cx="60" cy="18" r="5" fill="#ff8fb8" />
            <rect x="4" y="82" width="112" height="6" rx="3" fill="#ffd9a8" />
          </svg>
          <h2 className="text-3xl font-black text-[#3d7bc2]">Entregas</h2>
          <ul className="flex flex-col gap-2 text-left text-base leading-snug">
            <li>Arrastra el dedo para inclinar la bandeja. Si la torre se va hacia un lado, inclina hacia el otro.</li>
            <li>Pasa sobre las cajitas del piso para recogerlas.</li>
            <li>Llega a una casa para entregar la caja de arriba. Cuidado con los baches y el viento.</li>
          </ul>
          <p className="text-sm text-[#5a7d9c]">También puedes usar las flechas del teclado.</p>
          <button type="button" onClick={iniciar} className={BTN_PRIMARIO}>
            ¡A repartir!
          </button>
          <button type="button" onClick={onSalir} className="text-sm font-bold text-[#3d7bc2] underline">
            Volver
          </button>
        </Panel>
      )}

      {fase === 'pausa' && (
        <Panel>
          <h2 className="text-3xl font-black text-[#3d7bc2]">Pausa</h2>
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
          <h2 className="text-3xl font-black text-[#3d7bc2]">¡Entregas listas!</h2>
          <div className="grid w-full grid-cols-2 gap-2">
            <Stat etiqueta="Puntos" valor={resumen.puntos} />
            <Stat etiqueta="Entregas" valor={resumen.entregas} />
            <Stat etiqueta="Mejor racha" valor={resumen.mejorRacha} />
            <Stat etiqueta="Cajas recogidas" valor={resumen.cajas} />
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
