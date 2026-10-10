// Vida del cuarto: caminar, sentarse, abrazarse, mascotas que van a comer y la luz
// según la hora. Lógica pura (sin React) para que la vista solo lea posiciones.
// Las posiciones son fracciones del cuarto: x (0..1 de ancho), y (0..1 de alto, pies).

import type { MuebleColocado } from './types'
import { buscarMueble } from './muebles-data'

export type Estado = 'camina' | 'quieta' | 'sentado' | 'espera' | 'abrazo' | 'comiendo' | 'duerme'
export type Meta = 'libre' | 'asiento' | 'abrazo' | 'comida'

export interface Actor {
  x: number
  y: number
  tx: number
  ty: number
  vel: number // fracción del cuarto por segundo
  estado: Estado
  meta: Meta
  espera: number // segundos que faltan en la pausa actual
  dir: 1 | -1
  silla: number // índice del asiento reservado u ocupado; -1 si ninguno
  amigo?: Actor // la pareja: para no encimarse al caminar
}

export interface Obstaculo {
  x: number
  y: number
  ancho: number
  alto: number // altura en fracción del cuarto
}

export interface Asiento {
  x: number
  y: number
  z: number // capa de dibujo mientras la persona está sentada (sobre el mueble)
}

export interface Mundo {
  obstaculos: Obstaculo[]
  asientos: Asiento[]
  ocupados: boolean[]
  comida: { x: number; y: number }
  sep: number // separación mínima en x entre la pareja (fracción del ancho del cuarto)
}

/** Zona del piso donde pueden caminar (la pared ocupa la parte de arriba). */
export const SUELO = { x0: 0.13, x1: 0.87, y0: 0.6, y1: 0.96 }
/** Dónde está el plato de las mascotas. */
export const COMIDA = { x: 0.9, y: 0.93 }
/** Separación por defecto: se ajusta según el tamaño del personaje en pantalla. */
const SEP_DEFECTO = 0.16

export function crearActor(x: number, y: number, vel: number): Actor {
  return { x, y, tx: x, ty: y, vel, estado: 'quieta', meta: 'libre', espera: 1 + Math.random() * 3, dir: 1, silla: -1 }
}

/**
 * Construye el mundo a partir de los muebles colocados. `ratio` es ancho / alto del
 * cuarto: sirve para pasar las medidas (en unidades del ancho) a fracciones de alto.
 */
export function construirMundo(colocados: MuebleColocado[], ratio: number): Mundo {
  const obstaculos: Obstaculo[] = []
  const asientos: Asiento[] = []
  for (const c of colocados) {
    const m = buscarMueble(c.id)
    if (!m) continue
    // Los tapetes y alfombras son planos: se puede pasar por encima.
    if (!m.colgado && m.alto > 0.08) obstaculos.push({ x: c.x, y: c.y, ancho: m.ancho, alto: m.alto * ratio })
    if (m.asiento !== undefined) {
      const y = c.y - m.asiento * ratio
      const z = Math.round(c.y * 1000) + 5
      if (m.ancho >= 0.25) {
        asientos.push({ x: c.x - m.ancho * 0.22, y, z }, { x: c.x + m.ancho * 0.22, y, z })
      } else {
        asientos.push({ x: c.x, y, z })
      }
    }
  }
  return { obstaculos, asientos, ocupados: asientos.map(() => false), comida: COMIDA, sep: SEP_DEFECTO }
}

/**
 * Un punto del piso donde se puede estar: fuera de los muebles y de la franja justo
 * delante de ellos (ahí taparía el mueble), y lejos de la pareja si se pasa `amigo`.
 */
export function puntoLibre(m: Mundo, rnd: () => number, amigo?: Actor): { x: number; y: number } {
  for (let i = 0; i < 60; i++) {
    const x = SUELO.x0 + rnd() * (SUELO.x1 - SUELO.x0)
    const y = SUELO.y0 + rnd() * (SUELO.y1 - SUELO.y0)
    const dentro = m.obstaculos.some(
      (o) =>
        // Margen de medio personaje a cada lado: no se pone encima de los brazos del sofá.
        x > o.x - o.ancho / 2 - 0.09 &&
        x < o.x + o.ancho / 2 + 0.09 &&
        // Ni delante ni detrás del mueble: ahí el personaje quedaría tapado.
        y > o.y - o.alto - 0.12 &&
        y < o.y + 0.1,
    )
    if (dentro) continue
    if (amigo && !separados(x, y, amigo.x, amigo.y, m.sep)) continue
    return { x, y }
  }
  return { x: 0.5, y: SUELO.y1 }
}

/** Dos personajes están separados si no se encimen: en x basta con `sep`; en y deben estar en filas distintas. */
export function separados(x1: number, y1: number, x2: number, y2: number, sep: number): boolean {
  return Math.abs(x1 - x2) >= sep || Math.abs(y1 - y2) > 0.1
}

/** Avanza hacia el destino. Devuelve true cuando llega. */
export function paso(a: Actor, dt: number): boolean {
  const dx = a.tx - a.x
  const dy = a.ty - a.y
  const d = Math.hypot(dx, dy)
  const s = a.vel * dt
  if (d <= s || d < 0.0005) {
    a.x = a.tx
    a.y = a.ty
    return true
  }
  a.x += (dx / d) * s
  a.y += (dy / d) * s
  if (Math.abs(dx) > 0.002) a.dir = dx > 0 ? 1 : -1
  return false
}

function liberar(a: Actor, m: Mundo): void {
  if (a.silla >= 0 && a.silla < m.ocupados.length) m.ocupados[a.silla] = false
  a.silla = -1
}

/** Manda al actor a un punto (sin sentarse). */
export function irA(a: Actor, m: Mundo, x: number, y: number, meta: Meta = 'libre'): void {
  liberar(a, m)
  a.tx = x
  a.ty = y
  a.meta = meta
  a.estado = 'camina'
}

/** Manda a la mascota a comer al plato. */
export function irAComer(a: Actor, m: Mundo): void {
  irA(a, m, m.comida.x, m.comida.y, 'comida')
}

/** Empieza a abrazarse: el actor camina y luego espera a su pareja. */
export function irAAbrazo(a: Actor, m: Mundo, x: number, y: number): void {
  irA(a, m, x, y, 'abrazo')
}

/** Abrazo confirmado por las dos partes. */
export function iniciarAbrazo(a: Actor, m: Mundo): void {
  liberar(a, m)
  a.estado = 'abrazo'
  a.meta = 'libre'
  a.espera = 2.8
}

/** Se acuesta en un punto fijo (la cama de noche). No camina hasta que se despierta. */
export function dormir(a: Actor, m: Mundo, x: number, y: number): void {
  liberar(a, m)
  a.x = x
  a.y = y
  a.tx = x
  a.ty = y
  a.meta = 'libre'
  a.estado = 'duerme'
}

/** Se despierta y camina a un punto libre del cuarto. */
export function despertar(a: Actor, m: Mundo): void {
  const p = puntoLibre(m, Math.random)
  irA(a, m, p.x, p.y)
}

/** Elige qué hacer después de una pausa. */
function elegir(a: Actor, m: Mundo, rnd: () => number): void {
  const r = rnd()
  const libres: number[] = []
  m.asientos.forEach((s, i) => {
    if (m.ocupados[i]) return
    // Un asiento junto a la pareja (en la misma fila y encimado) no sirve.
    if (a.amigo && !separados(s.x, s.y, a.amigo.x, a.amigo.y, m.sep) && a.amigo.silla !== i) return
    libres.push(i)
  })
  a.meta = 'libre'
  if (r < 0.25 && libres.length > 0) {
    const i = libres[Math.floor(rnd() * libres.length)]
    m.ocupados[i] = true
    a.silla = i
    a.meta = 'asiento'
    a.tx = m.asientos[i].x
    a.ty = m.asientos[i].y
    a.estado = 'camina'
  } else if (r < 0.36) {
    a.estado = 'quieta'
    a.espera = 2 + rnd() * 3
  } else {
    const p = puntoLibre(m, rnd, a.amigo)
    a.tx = p.x
    a.ty = p.y
    a.estado = 'camina'
  }
}

/**
 * Avanza la mente del actor un paso de tiempo. Devuelve true si cambió de estado
 * (para que la vista se actualice). Las pausas y los paseos son aleatorios.
 */
export function latir(a: Actor, dt: number, m: Mundo, rnd: () => number = Math.random): boolean {
  if (a.estado === 'duerme') return false
  if (a.estado === 'camina') {
    const b = a.amigo
    if (b && a.meta !== 'abrazo' && b.meta !== 'abrazo' && (b.estado === 'quieta' || b.estado === 'camina') && !separados(a.x, a.y, b.x, b.y, m.sep) && a.meta !== 'asiento') {
      // Cruza a la pareja: espera un instante y luego elige otro destino.
      a.estado = 'quieta'
      a.espera = 0.6 + rnd() * 0.6
      return true
    }
    if (!paso(a, dt)) return false
    if (a.meta === 'asiento' && a.silla >= 0) {
      const s = m.asientos[a.silla]
      a.x = s.x
      a.y = s.y
      a.estado = 'sentado'
      a.espera = 7 + rnd() * 8
    } else if (a.meta === 'abrazo') {
      a.estado = 'espera'
    } else if (a.meta === 'comida') {
      a.estado = 'comiendo'
      a.espera = 3.5
    } else {
      a.estado = 'quieta'
      a.espera = 1 + rnd() * 3
    }
    return true
  }
  // Esperando a la pareja: lo decide quien coordina los abrazos.
  if (a.estado === 'espera') return false
  a.espera -= dt
  if (a.espera > 0) return false
  if (a.estado === 'sentado') liberar(a, m)
  elegir(a, m, rnd)
  return true
}

/** Luz ambiental del cuarto según la hora. */
export interface Luz {
  color: string
  fuerzaLamparas: number // 0..1: qué tanto brillan las lámparas
  momento: 'amanecer' | 'dia' | 'atardecer' | 'noche'
}

// hora, r, g, b, alfa de la capa de color del cuarto. De día no hay velo; de noche, un
// tinte azul muy ligero (alfa máximo 0.08).
const CLAVES: Array<[number, number, number, number, number]> = [
  [0, 70, 90, 170, 0.08],
  [5, 70, 90, 170, 0.08],
  [6.5, 255, 190, 150, 0.04],
  [8, 255, 240, 200, 0],
  [16.5, 255, 240, 200, 0],
  [17.8, 255, 170, 120, 0.05],
  [19.5, 90, 80, 170, 0.08],
  [21, 70, 90, 170, 0.08],
  [24, 70, 90, 170, 0.08],
]

/** Qué tanto brillan las lámparas según la hora: encendidas de noche, ya al caer la tarde. */
function fuerzaLamparasPara(h: number): number {
  if (h >= 19.5 || h < 5) return 1
  if (h >= 17 && h < 19.5) return (h - 17) / 2.5
  if (h >= 5 && h < 6.5) return 1 - (h - 5) / 1.5
  return 0
}

/** Color de la luz ambiental según la hora local (interpolado entre claves). */
export function luzPara(fecha: Date): Luz {
  const h = fecha.getHours() + fecha.getMinutes() / 60
  let i = 0
  while (i < CLAVES.length - 2 && h > CLAVES[i + 1][0]) i++
  const [h0, r0, g0, b0, a0] = CLAVES[i]
  const [h1, r1, g1, b1, a1] = CLAVES[i + 1]
  const t = h1 === h0 ? 0 : Math.min(1, Math.max(0, (h - h0) / (h1 - h0)))
  const mezcla = (u: number, v: number) => Math.round(u + (v - u) * t)
  const alfa = a0 + (a1 - a0) * t
  const momento: Luz['momento'] = h < 5 || h >= 19.5 ? 'noche' : h < 8 ? 'amanecer' : h < 17 ? 'dia' : 'atardecer'
  return {
    color: `rgba(${mezcla(r0, r1)},${mezcla(g0, g1)},${mezcla(b0, b1)},${alfa.toFixed(3)})`,
    fuerzaLamparas: fuerzaLamparasPara(h),
    momento,
  }
}

export function saludoPara(momento: Luz['momento']): string {
  switch (momento) {
    case 'amanecer':
      return 'Buenos días'
    case 'dia':
      return 'Buen día'
    case 'atardecer':
      return 'Buen atardecer'
    default:
      return 'Buenas noches'
  }
}
