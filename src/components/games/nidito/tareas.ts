// Tareas del día de Nidito: 4 tareas variadas que se renuevan cada día (fecha local).
// Lógica pura (sin React). Cada acción del juego llama a `aplicarAccion` con su clave;
// cuando una tarea llega a su meta, da monedas y corazones una sola vez.

import type { DiaTareas, Partida } from './types'
import { hoyISO, nivelDeCorazones } from './guardado'

export interface Tarea {
  id: string
  texto: (nombres: [string, string]) => string
  clave: string // contador que avanza (ver aplicarAccion)
  modo: 'suma' | 'maximo' // suma (acciones) o récord (puntos)
  meta: number
  monedas: number
  corazones: number
  requiereMascota?: boolean
}

/** Reserva de tareas. Los ids son estables: se guardan en la partida. */
export const TAREAS: Tarea[] = [
  { id: 'cocina', texto: () => 'Compra algo para la cocina', clave: 'comprar:cocina', modo: 'suma', meta: 1, monedas: 40, corazones: 3 },
  { id: 'cita', texto: () => 'Hagan una cita', clave: 'cita', modo: 'suma', meta: 1, monedas: 50, corazones: 4 },
  { id: 'panqueques', texto: () => 'Saca 40 en Panqueques', clave: 'panqueques', modo: 'maximo', meta: 40, monedas: 35, corazones: 3 },
  { id: 'atuendo-0', texto: (n) => `Cambia el atuendo de ${n[0]}`, clave: 'atuendo:0', modo: 'suma', meta: 1, monedas: 30, corazones: 2 },
  { id: 'atuendo-1', texto: (n) => `Cambia el atuendo de ${n[1]}`, clave: 'atuendo:1', modo: 'suma', meta: 1, monedas: 30, corazones: 2 },
  { id: 'mascota', texto: () => 'Acaricia a la mascota', clave: 'mascota', modo: 'suma', meta: 2, monedas: 25, corazones: 2, requiereMascota: true },
  { id: 'colocar', texto: () => 'Coloca 2 muebles nuevos', clave: 'colocar', modo: 'suma', meta: 2, monedas: 40, corazones: 3 },
  { id: 'foto', texto: () => 'Tómate una foto en el cuarto', clave: 'foto', modo: 'suma', meta: 1, monedas: 30, corazones: 3 },
  { id: 'tocar', texto: () => 'Dale cariño a tu pareja 3 veces', clave: 'tocar', modo: 'suma', meta: 3, monedas: 20, corazones: 2 },
]

const TAREA_POR_ID = new Map(TAREAS.map((t) => [t.id, t] as const))

export function buscarTarea(id: string): Tarea | undefined {
  return TAREA_POR_ID.get(id)
}

/** Número pseudoaleatorio reproducible a partir de una semilla (mulberry32). */
function generador(semilla: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Elige 4 tareas distintas para la fecha. Sin mascota no salen las de mascota. */
export function elegirTareas(fecha: string, conMascota: boolean): string[] {
  const rnd = generador(`nidito-${fecha}`)
  const pool = TAREAS.filter((t) => !t.requiereMascota || conMascota)
  const mezcla = [...pool]
  for (let i = mezcla.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]]
  }
  // Nunca dos tareas de atuendo el mismo día: se ven repetidas.
  const elegidas: string[] = []
  let atuendo = false
  for (const t of mezcla) {
    if (elegidas.length === 4) break
    const esAtuendo = t.id.startsWith('atuendo')
    if (esAtuendo && atuendo) continue
    if (esAtuendo) atuendo = true
    elegidas.push(t.id)
  }
  return elegidas
}

function diaNuevo(fecha: string, conMascota: boolean): DiaTareas {
  return { fecha, lista: elegirTareas(fecha, conMascota), cuentas: {}, hechas: [] }
}

/** Devuelve la partida con el día de hoy listo (si cambió la fecha, se renuevan las tareas). */
export function asegurarDia(p: Partida): Partida {
  const hoy = hoyISO()
  if (p.dia?.fecha === hoy) return p
  return { ...p, dia: diaNuevo(hoy, p.mascotas.length > 0) }
}

/**
 * Registra una acción del juego y reparte la recompensa de las tareas que se completen.
 * `suma`: suma `valor` al contador. `maximo`: guarda el mejor valor (puntos).
 */
export function aplicarAccion(p: Partida, clave: string, valor: number, modo: 'suma' | 'maximo' = 'suma'): Partida {
  const base = asegurarDia(p)
  const dia = base.dia as DiaTareas
  const cuentas = { ...dia.cuentas }
  cuentas[clave] = modo === 'maximo' ? Math.max(cuentas[clave] ?? 0, valor) : (cuentas[clave] ?? 0) + valor

  let monedas = base.monedas
  let corazones = base.corazones
  const hechas = [...dia.hechas]
  for (const id of dia.lista) {
    const t = TAREA_POR_ID.get(id)
    if (!t || hechas.includes(id)) continue
    if ((cuentas[t.clave] ?? 0) >= t.meta) {
      hechas.push(id)
      monedas += t.monedas
      corazones += t.corazones
    }
  }
  return {
    ...base,
    dia: { ...dia, cuentas, hechas },
    monedas,
    corazones,
    nivelAmor: nivelDeCorazones(corazones),
  }
}
