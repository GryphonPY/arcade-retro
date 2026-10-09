'use client'

import type { CuartoId, Cuarto, Partida, Personaje } from './types'
import { CUARTOS } from './muebles-data'

/** Clave de localStorage de la partida. Cambiar el sufijo implica migrar. */
export const CLAVE_PARTIDA = 'nidito-partida-v1'

/** Fecha local YYYY-MM-DD (sirve para el regalo diario). */
export function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Identificador corto y único para cada mueble colocado (sin depender de crypto.randomUUID). */
export function nuevoUid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Cambio de la partida: recibe la partida actual y devuelve la nueva (seguro con cambios seguidos). */
export type Actualizar = (fn: (p: Partida) => Partida) => void

/** Nivel de amor a partir de los corazones acumulados: sube cada 20 corazones. */
export function nivelDeCorazones(corazones: number): number {
  return 1 + Math.floor(Math.max(0, corazones) / 20)
}

function cuartoInicial(id: CuartoId, muebles: Cuarto['muebles']): Cuarto {
  const base = CUARTOS[id]
  return { id, pared: base.paredInicial, piso: base.pisoInicial, muebles }
}

/** Partida nueva: 300 monedas, sala y recámara desbloqueadas con pocos muebles. */
export function nuevaPartida(pareja: [Personaje, Personaje]): Partida {
  return {
    version: 1,
    creada: Date.now(),
    pareja,
    monedas: 300,
    corazones: 0,
    nivelAmor: 1,
    cuartos: [
      cuartoInicial('sala', [
        { uid: nuevoUid(), id: 'alfombra-redonda', x: 0.5, y: 0.9, flip: false },
        { uid: nuevoUid(), id: 'sofa-rosa', x: 0.3, y: 0.8, flip: false },
        { uid: nuevoUid(), id: 'planta-grande', x: 0.9, y: 0.82, flip: false },
        { uid: nuevoUid(), id: 'cuadro-corazon', x: 0.6, y: 0.48, flip: false },
      ]),
      cuartoInicial('recamara', [
        { uid: nuevoUid(), id: 'cama-doble', x: 0.5, y: 0.84, flip: false },
        { uid: nuevoUid(), id: 'lampara-buro', x: 0.82, y: 0.7, flip: false },
      ]),
    ],
    inventario: {},
    ropaComprada: [],
    mascotas: [],
    citasHechas: {},
    ultimoRegalo: '',
    mejores: {},
  }
}

/** Lee la partida guardada. Devuelve null si no hay o si está dañada. */
export function cargarPartida(): Partida | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_PARTIDA)
    if (!crudo) return null
    const p = JSON.parse(crudo) as Partida
    if (p?.version !== 1 || !Array.isArray(p.pareja) || p.pareja.length !== 2) return null
    if (!Array.isArray(p.cuartos)) return null
    // Rellenos defensivos por si la partida viene de una versión anterior.
    return {
      ...p,
      inventario: p.inventario ?? {},
      ropaComprada: p.ropaComprada ?? [],
      mascotas: p.mascotas ?? [],
      citasHechas: p.citasHechas ?? {},
      mejores: p.mejores ?? {},
      ultimoRegalo: p.ultimoRegalo ?? '',
      nivelAmor: p.nivelAmor ?? nivelDeCorazones(p.corazones ?? 0),
    }
  } catch {
    return null
  }
}

/** Suma (o resta) unidades de un mueble en el inventario; quita la clave si llega a cero. */
export function sumarInventario(inv: Record<string, number>, id: string, delta: number): Record<string, number> {
  const copia = { ...inv }
  const n = (copia[id] ?? 0) + delta
  if (n > 0) copia[id] = n
  else delete copia[id]
  return copia
}

/** Guarda la partida. Si el navegador bloquea el almacenamiento, el juego sigue sin guardar. */
export function guardarPartida(p: Partida): void {
  try {
    window.localStorage.setItem(CLAVE_PARTIDA, JSON.stringify(p))
  } catch {
    // almacenamiento lleno o bloqueado: no interrumpimos el juego
  }
}
