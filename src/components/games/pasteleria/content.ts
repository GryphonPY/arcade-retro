/** Contenido de la Pastelería: ingredientes, equipo, decoración y recetas con nombre. */

export type FlavorId = 'vainilla' | 'chocolate' | 'pan-fresa' | 'redvelvet' | 'matcha'
export type FrostId = 'blanca' | 'rosa' | 'choco' | 'lila' | 'menta' | 'limon' | 'cielo'
export type TopId =
  | 'fresa'
  | 'chispas'
  | 'vela'
  | 'cereza'
  | 'arandano'
  | 'bombon'
  | 'corazon'
  | 'estrella'
  | 'flor'
  | 'kiwi'
  | 'galleta'
  | 'macaron'

export interface Flavor {
  id: FlavorId
  name: string
  /** Color de la masa cruda y del bizcocho horneado. */
  raw: string
  baked: string
  price: number
  cost: number
}
export const FLAVORS: Flavor[] = [
  { id: 'vainilla', name: 'Vainilla', raw: '#fff3c4', baked: '#f2c66d', price: 20, cost: 0 },
  { id: 'chocolate', name: 'Chocolate', raw: '#a8714a', baked: '#7a4a2b', price: 22, cost: 0 },
  { id: 'pan-fresa', name: 'Fresa', raw: '#ffc8dc', baked: '#f39bb8', price: 24, cost: 80 },
  { id: 'redvelvet', name: 'Red velvet', raw: '#e0707a', baked: '#b8323f', price: 30, cost: 220 },
  { id: 'matcha', name: 'Matcha', raw: '#cfe8a8', baked: '#94bf5e', price: 30, cost: 260 },
]

export interface Frost {
  id: FrostId
  name: string
  color: string
  cost: number
}
export const FROSTS: Frost[] = [
  { id: 'blanca', name: 'blanca', color: '#fffaf3', cost: 0 },
  { id: 'rosa', name: 'rosa', color: '#ffb3cf', cost: 0 },
  { id: 'choco', name: 'de chocolate', color: '#8a5634', cost: 70 },
  { id: 'lila', name: 'lila', color: '#cdb8ff', cost: 90 },
  { id: 'menta', name: 'de menta', color: '#a8ecc9', cost: 90 },
  { id: 'limon', name: 'de limón', color: '#fff08a', cost: 110 },
  { id: 'cielo', name: 'azul cielo', color: '#a9d8ff', cost: 140 },
]

export interface Topping {
  id: TopId
  name: string
  plural: string
  cost: number
  fruit: boolean
  /** Color dominante, para pedidos de "colores". */
  tone: string
}
export const TOPS: Topping[] = [
  { id: 'fresa', name: 'fresa', plural: 'fresas', cost: 0, fruit: true, tone: 'rojo' },
  { id: 'chispas', name: 'chispas', plural: 'chispas', cost: 0, fruit: false, tone: 'arcoiris' },
  { id: 'vela', name: 'vela', plural: 'velas', cost: 0, fruit: false, tone: 'blanco' },
  { id: 'cereza', name: 'cereza', plural: 'cerezas', cost: 50, fruit: true, tone: 'rojo' },
  { id: 'arandano', name: 'arándano', plural: 'arándanos', cost: 70, fruit: true, tone: 'azul' },
  { id: 'bombon', name: 'bombón', plural: 'bombones', cost: 80, fruit: false, tone: 'cafe' },
  { id: 'corazon', name: 'corazón', plural: 'corazones', cost: 90, fruit: false, tone: 'rosa' },
  { id: 'estrella', name: 'estrella', plural: 'estrellas', cost: 110, fruit: false, tone: 'amarillo' },
  { id: 'kiwi', name: 'kiwi', plural: 'kiwis', cost: 120, fruit: true, tone: 'verde' },
  { id: 'flor', name: 'flor', plural: 'flores', cost: 140, fruit: false, tone: 'lila' },
  { id: 'galleta', name: 'galleta', plural: 'galletas', cost: 170, fruit: false, tone: 'cafe' },
  { id: 'macaron', name: 'macarón', plural: 'macarones', cost: 220, fruit: false, tone: 'rosa' },
]

export type EquipId = 'turbo1' | 'turbo2' | 'campana' | 'espatula' | 'guia' | 'rejilla2'
export interface Equip {
  id: EquipId
  name: string
  desc: string
  cost: number
  needs?: EquipId
}
export const EQUIP: Equip[] = [
  { id: 'rejilla2', name: 'Segunda rejilla', desc: 'Hornea dos pasteles a la vez', cost: 120 },
  { id: 'campana', name: 'Campanita del horno', desc: 'Suena y marca cuando el pastel está en su punto', cost: 90 },
  { id: 'turbo1', name: 'Horno turbo', desc: 'Hornea 30 % más rápido', cost: 150 },
  { id: 'turbo2', name: 'Horno súper turbo', desc: 'Todavía más rápido', cost: 320, needs: 'turbo1' },
  { id: 'espatula', name: 'Espátula grande', desc: 'Unta la crema más rápido', cost: 110 },
  { id: 'guia', name: 'Guía de corte', desc: 'Marca dónde cortar rebanadas parejas', cost: 100 },
]

export type DecorSlot = 'pared' | 'piso' | 'planta' | 'cuadro' | 'letrero' | 'lampara'
export interface Decor {
  id: string
  slot: DecorSlot
  name: string
  cost: number
  /** Bono de propinas (0.05 = +5 %). */
  tip: number
  color: string
}
export const DECOR: Decor[] = [
  { id: 'pared-fresa', slot: 'pared', name: 'Papel tapiz de fresitas', cost: 120, tip: 0.04, color: '#ffd6e4' },
  { id: 'pared-menta', slot: 'pared', name: 'Papel tapiz menta a rayas', cost: 120, tip: 0.04, color: '#d3f5e4' },
  { id: 'pared-cielo', slot: 'pared', name: 'Papel tapiz de nubes', cost: 160, tip: 0.05, color: '#dcecff' },
  { id: 'piso-ajedrez', slot: 'piso', name: 'Piso de cuadritos', cost: 140, tip: 0.04, color: '#f7c6d9' },
  { id: 'piso-madera', slot: 'piso', name: 'Piso de madera clarita', cost: 140, tip: 0.04, color: '#f1cf9f' },
  { id: 'planta-monstera', slot: 'planta', name: 'Plantita monstera', cost: 90, tip: 0.03, color: '#5fbf7f' },
  { id: 'planta-girasol', slot: 'planta', name: 'Macetas de girasol', cost: 110, tip: 0.03, color: '#ffd23f' },
  { id: 'cuadro-gato', slot: 'cuadro', name: 'Cuadro de gatito', cost: 100, tip: 0.03, color: '#ffb3cf' },
  { id: 'cuadro-pastel', slot: 'cuadro', name: 'Cuadro de pastel', cost: 100, tip: 0.03, color: '#ffe08a' },
  { id: 'letrero-neon', slot: 'letrero', name: 'Letrero de neón', cost: 200, tip: 0.06, color: '#ff7ab6' },
  { id: 'lampara-globos', slot: 'lampara', name: 'Lámparas de globo', cost: 150, tip: 0.04, color: '#fff2b3' },
]

export const START_OWNED = ['vainilla', 'chocolate', 'blanca', 'rosa', 'fresa', 'chispas', 'vela']

export type ItemKind = 'flavor' | 'frost' | 'top' | 'equip' | 'decor'
export interface ShopItem {
  kind: ItemKind
  id: string
  name: string
  desc: string
  cost: number
  needs?: string
  slot?: DecorSlot
}
export function shopItems(): ShopItem[] {
  return [
    ...FLAVORS.filter((f) => f.cost > 0).map((f) => ({ kind: 'flavor' as const, id: f.id, name: `Masa de ${f.name.toLowerCase()}`, desc: `Pasteles de ${f.name.toLowerCase()} (se venden a ${f.price})`, cost: f.cost })),
    ...FROSTS.filter((f) => f.cost > 0).map((f) => ({ kind: 'frost' as const, id: f.id, name: `Crema ${f.name}`, desc: 'Nuevos pedidos con este color', cost: f.cost })),
    ...TOPS.filter((t) => t.cost > 0).map((t) => ({ kind: 'top' as const, id: t.id, name: t.plural[0].toUpperCase() + t.plural.slice(1), desc: 'Nuevo adorno y pedidos que lo usan', cost: t.cost })),
    ...EQUIP.map((e) => ({ kind: 'equip' as const, id: e.id, name: e.name, desc: e.desc, cost: e.cost, needs: e.needs })),
    ...DECOR.map((d) => ({ kind: 'decor' as const, id: d.id, name: d.name, desc: `+${Math.round(d.tip * 100)} % propinas`, cost: d.cost, slot: d.slot })),
  ]
}

export const flavorOf = (id: FlavorId) => FLAVORS.find((f) => f.id === id)!
export const frostIndex = (id: FrostId) => FROSTS.findIndex((f) => f.id === id)
export const topOf = (id: TopId) => TOPS.find((t) => t.id === id)!
