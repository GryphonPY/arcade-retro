// Álbum de colección de Nidito: muebles, ropa y superficies obtenidas, con % por categoría.
// Lo obtenido se deduce de la partida: lo comprado está en el inventario, colocado en un
// cuarto o en el armario, y lo gratis siempre cuenta.

import { CUARTOS, MUEBLES, PAREDES, PISOS } from './muebles-data'
import { PRENDAS } from './wardrobe-data'
import type { CuartoId, Partida } from './types'

export interface ItemColeccion {
  id: string
  nombre: string
  obtenido: boolean
  svg?: string // dibujo del mueble
  color?: string // muestra de color (ropa y superficies)
}

export interface CategoriaColeccion {
  id: string
  nombre: string
  emoji: string
  items: ItemColeccion[]
}

export function progreso(c: CategoriaColeccion): number {
  if (c.items.length === 0) return 0
  return Math.round((c.items.filter((i) => i.obtenido).length / c.items.length) * 100)
}

export function coleccion(p: Partida): CategoriaColeccion[] {
  // Muebles: el inventario (sin paredes ni pisos) y los colocados en cualquier cuarto.
  const muebles = new Set<string>(Object.keys(p.inventario).filter((id) => !id.includes(':')))
  for (const c of p.cuartos) for (const m of c.muebles) muebles.add(m.id)

  const categorias: CategoriaColeccion[] = (Object.keys(CUARTOS) as CuartoId[]).map((id) => ({
    id,
    nombre: CUARTOS[id].nombre,
    emoji: CUARTOS[id].emoji,
    items: MUEBLES.filter((m) => m.cuarto === id).map((m) => ({
      id: m.id,
      nombre: m.nombre,
      obtenido: muebles.has(m.id),
      svg: m.svg,
    })),
  }))

  // Ropa: gratis, comprada o puesta en algún personaje.
  const ropa = new Set<string>(p.ropaComprada)
  for (const per of p.pareja) for (const id of Object.values(per.look.ropa)) if (id) ropa.add(id)
  categorias.push({
    id: 'ropa',
    nombre: 'Ropa y accesorios',
    emoji: '👗',
    items: PRENDAS.map((pr) => ({
      id: pr.id,
      nombre: pr.nombre,
      obtenido: pr.precio === 0 || ropa.has(pr.id),
      color: pr.color,
    })),
  })

  // Paredes y pisos: gratis, comprados o ya puestos en un cuarto.
  const usados = new Set<string>()
  for (const c of p.cuartos) {
    usados.add(c.pared)
    usados.add(c.piso)
  }
  const superficies = [
    ...PAREDES.map((s) => ({ s, clave: `pared:${s.id}`, tipo: 'Pared' })),
    ...PISOS.map((s) => ({ s, clave: `piso:${s.id}`, tipo: 'Piso' })),
  ]
  categorias.push({
    id: 'superficies',
    nombre: 'Paredes y pisos',
    emoji: '🎨',
    items: superficies.map(({ s, clave, tipo }) => ({
      id: s.id,
      nombre: `${s.nombre} (${tipo.toLowerCase()})`,
      obtenido: s.precio === 0 || (p.inventario[clave] ?? 0) > 0 || usados.has(s.id),
      color: s.fondo.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#ffd0e0',
    })),
  })
  return categorias
}
