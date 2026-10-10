/** Contenido del Café Michi: estaciones, recetas, michis, ropa, decoración y ampliaciones. */

export type StationId = 'cafetera' | 'horno' | 'tetera' | 'licuadora' | 'vitrina'
export interface StationDef {
  id: StationId
  name: string
  cost: number
  /** Ampliación necesaria (índice en EXPANSIONS). */
  needExp: number
  color: string
}
export const STATIONS: StationDef[] = [
  { id: 'cafetera', name: 'Cafetera', cost: 0, needExp: 0, color: '#f4a6b8' },
  { id: 'horno', name: 'Horno', cost: 180, needExp: 2, color: '#fbbf7c' },
  { id: 'tetera', name: 'Tetera', cost: 420, needExp: 3, color: '#a7e3c4' },
  { id: 'licuadora', name: 'Licuadora', cost: 650, needExp: 3, color: '#b9c8ff' },
  { id: 'vitrina', name: 'Vitrina de pasteles', cost: 1200, needExp: 4, color: '#f9d27a' },
]

export type ItemId =
  | 'cafe'
  | 'latte'
  | 'capuchino'
  | 'galleta'
  | 'panque'
  | 'pay'
  | 'te'
  | 'matcha'
  | 'frappe'
  | 'smoothie'
  | 'pastel'
  | 'tarta'
export interface Recipe {
  id: ItemId
  name: string
  station: StationId
  price: number
  /** Segundos de preparación a velocidad 1. */
  time: number
  cost: number
}
export const RECIPES: Recipe[] = [
  { id: 'cafe', name: 'Café', station: 'cafetera', price: 6, time: 4, cost: 0 },
  { id: 'latte', name: 'Latte', station: 'cafetera', price: 10, time: 5.5, cost: 90 },
  { id: 'capuchino', name: 'Capuchino', station: 'cafetera', price: 15, time: 7, cost: 260 },
  { id: 'galleta', name: 'Galletas', station: 'horno', price: 9, time: 5, cost: 0 },
  { id: 'panque', name: 'Panqué', station: 'horno', price: 14, time: 7, cost: 200 },
  { id: 'pay', name: 'Pay de fresa', station: 'horno', price: 20, time: 9, cost: 480 },
  { id: 'te', name: 'Té de flores', station: 'tetera', price: 9, time: 4.5, cost: 0 },
  { id: 'matcha', name: 'Matcha latte', station: 'tetera', price: 17, time: 7, cost: 380 },
  { id: 'frappe', name: 'Frappé', station: 'licuadora', price: 14, time: 6, cost: 0 },
  { id: 'smoothie', name: 'Smoothie de mora', station: 'licuadora', price: 19, time: 7.5, cost: 450 },
  { id: 'pastel', name: 'Rebanada de pastel', station: 'vitrina', price: 24, time: 8, cost: 0 },
  { id: 'tarta', name: 'Tarta de queso', station: 'vitrina', price: 32, time: 10, cost: 900 },
]
export const recipeOf = (id: ItemId) => RECIPES.find((r) => r.id === id)!
export const stationOf = (id: StationId) => STATIONS.find((s) => s.id === id)!

/** Precio de una receta según su nivel (1–5). */
export const priceAt = (r: Recipe, lvl: number) => Math.round(r.price * (1 + 0.3 * (lvl - 1)))
export const recipeUpCost = (r: Recipe, lvl: number) => Math.round((r.price * 8 + 20) * Math.pow(1.8, lvl - 1))
/** Velocidad de una estación según su nivel (1–10). */
export const stationSpeed = (lvl: number) => 1 + 0.14 * (lvl - 1)
export const stationUpCost = (s: StationDef, lvl: number) => Math.round((40 + s.cost * 0.25) * Math.pow(1.55, lvl - 1))

export interface CatDef {
  id: string
  name: string
  fur: string
  /** Manchas o rayas. */
  pattern: 'liso' | 'manchas' | 'rayas' | 'calcetines'
  spot: string
  /** Velocidad base. */
  speed: number
  bio: string
  cost: number
}
export const CATS: CatDef[] = [
  { id: 'mochi', name: 'Mochi', fur: '#fff7ef', pattern: 'manchas', spot: '#f2b48a', speed: 1, bio: 'Le gusta oler el café recién hecho', cost: 0 },
  { id: 'canela', name: 'Canela', fur: '#f2b48a', pattern: 'rayas', spot: '#d98a5a', speed: 1.05, bio: 'Camina rápido, siempre con prisa', cost: 60 },
  { id: 'nube', name: 'Nube', fur: '#e8edf5', pattern: 'liso', spot: '#cbd5e1', speed: 1.1, bio: 'Tranquila, nunca se le cae nada', cost: 160 },
  { id: 'tofu', name: 'Tofu', fur: '#fffbea', pattern: 'calcetines', spot: '#9ca3af', speed: 1.1, bio: 'Hornea con mucho cariño', cost: 280 },
  { id: 'pimienta', name: 'Pimienta', fur: '#4b4453', pattern: 'calcetines', spot: '#ffffff', speed: 1.2, bio: 'Misteriosa y muy eficiente', cost: 450 },
  { id: 'miso', name: 'Miso', fur: '#f6d28b', pattern: 'manchas', spot: '#ffffff', speed: 1.2, bio: 'Tararea mientras trabaja', cost: 650 },
  { id: 'luna', name: 'Luna', fur: '#c9b6e4', pattern: 'liso', spot: '#ffffff', speed: 1.3, bio: 'Gatita mágica, sus tés brillan', cost: 900 },
  { id: 'bombon', name: 'Bombón', fur: '#8a5a44', pattern: 'manchas', spot: '#f2b48a', speed: 1.35, bio: 'El más dormilón, pero cuando trabaja...', cost: 1300 },
]
export const catTrainCost = (c: CatDef, lvl: number) => Math.round((50 + c.cost * 0.3) * Math.pow(1.6, lvl - 1))
export const catSpeed = (c: CatDef, lvl: number) => c.speed * (1 + 0.1 * (lvl - 1))

export type HatId = 'mono' | 'chef' | 'boina' | 'corona' | 'flor' | 'lentes' | 'bufanda' | 'orejas'
export const HATS: { id: HatId; name: string; cost: number }[] = [
  { id: 'mono', name: 'Moño rosa', cost: 40 },
  { id: 'chef', name: 'Gorro de chef', cost: 80 },
  { id: 'flor', name: 'Florecita', cost: 60 },
  { id: 'boina', name: 'Boina', cost: 120 },
  { id: 'lentes', name: 'Lentes redondos', cost: 150 },
  { id: 'bufanda', name: 'Bufanda', cost: 170 },
  { id: 'orejas', name: 'Orejitas de conejo', cost: 220 },
  { id: 'corona', name: 'Corona', cost: 500 },
]

export interface Expansion {
  name: string
  desc: string
  cost: number
  tables: number
}
/** Ampliaciones en orden. `tables` = mesas totales disponibles. */
export const EXPANSIONS: Expansion[] = [
  { name: 'Cafecito', desc: 'Tu primer local', cost: 0, tables: 2 },
  { name: 'Más mesitas', desc: '4 mesas en el salón', cost: 120, tables: 4 },
  { name: 'Cocina', desc: 'Permite el horno y 6 mesas', cost: 320, tables: 6 },
  { name: 'Terraza', desc: '3 mesas al aire libre + tetera y licuadora', cost: 900, tables: 9 },
  { name: 'Jardín michi', desc: 'Una mesa más, vitrina de pasteles y el patio más bonito', cost: 2200, tables: 10 },
]

export type DecorSlot = 'planta1' | 'planta2' | 'lampara' | 'cuadro' | 'tapete' | 'tema'
export interface Decor {
  id: string
  slot: DecorSlot
  name: string
  cost: number
  rep: number
  color: string
  /** Para temas: color de pared y piso. */
  wall?: string
  floor?: string
}
export const DECOR: Decor[] = [
  { id: 'planta-helecho', slot: 'planta1', name: 'Helecho colgante', cost: 60, rep: 1, color: '#5fbf7f' },
  { id: 'planta-cactus', slot: 'planta2', name: 'Cactus con flor', cost: 80, rep: 1, color: '#7cc576' },
  { id: 'planta-sakura', slot: 'planta2', name: 'Arbolito de cerezo', cost: 260, rep: 3, color: '#f9a8d4' },
  { id: 'lampara-globos', slot: 'lampara', name: 'Lámparas de globo', cost: 150, rep: 2, color: '#fff2b3' },
  { id: 'lampara-estrellas', slot: 'lampara', name: 'Guirnalda de estrellas', cost: 220, rep: 2, color: '#fde047' },
  { id: 'cuadro-pez', slot: 'cuadro', name: 'Cuadro de pescadito', cost: 100, rep: 1, color: '#93c5fd' },
  { id: 'cuadro-retrato', slot: 'cuadro', name: 'Retrato de Mochi', cost: 240, rep: 2, color: '#f9a8d4' },
  { id: 'tapete-huella', slot: 'tapete', name: 'Tapete de huellita', cost: 140, rep: 2, color: '#fbcfe8' },
  { id: 'tapete-nube', slot: 'tapete', name: 'Tapete nube', cost: 200, rep: 2, color: '#e0f2fe' },
  { id: 'tema-menta', slot: 'tema', name: 'Tema menta', cost: 350, rep: 3, color: '#a7f3d0', wall: '#dff7ec', floor: '#f3e5d0' },
  { id: 'tema-lavanda', slot: 'tema', name: 'Tema lavanda', cost: 350, rep: 3, color: '#ddd6fe', wall: '#efe9ff', floor: '#f6e9df' },
  { id: 'tema-noche', slot: 'tema', name: 'Tema noche estrellada', cost: 600, rep: 4, color: '#3b3570', wall: '#3b3570', floor: '#c9b48f' },
]
