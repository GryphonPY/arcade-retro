// Catálogo de personajes y vestuario de Nidito: tonos, peinados, ojos y prendas.
// Los ids son estables (se guardan en localStorage): no los renombres.
// Los ids de prendas son únicos en todo el catálogo porque `ropaComprada` guarda ids sueltos.

import type { Genero, Look, SlotRopa } from './types'

/** Género de cada prenda: 'ambos' se usa en cualquiera de los dos personajes. */
export type GeneroPrenda = Genero | 'ambos'

export type Patron = 'lunares' | 'rayas' | 'cuadros' | 'corazones' | 'estrellas'

export interface Opcion {
  id: string
  nombre: string
  hex: string
}

export type EstiloPeinado =
  | 'corto' | 'bob' | 'largo' | 'coletas' | 'chongo' | 'rizos' | 'trenza' | 'pixie' | 'cola' | 'ondas'
  // cortes de chico: sin mechones largos
  | 'despeinado' | 'raya' | 'rizado'

export interface Peinado {
  id: string
  nombre: string
  estilo: EstiloPeinado
}

export type FormaOjos = 'redondos' | 'almendra' | 'felinos' | 'corazon' | 'estrella' | 'felices'

export interface Ojos {
  id: string
  nombre: string
  forma: FormaOjos
}

export type EstiloPrenda =
  // arriba
  | 'playera' | 'sudadera' | 'blusa' | 'suter' | 'hoodie' | 'vestido' | 'overol' | 'camisa'
  // abajo
  | 'falda' | 'short' | 'pantalon' | 'tul'
  // zapatos
  | 'tenis' | 'botitas' | 'mary' | 'sandalias' | 'botas' | 'pantuflas'
  // accesorio
  | 'moño' | 'diadema' | 'lentes' | 'collar' | 'gorro' | 'bufanda' | 'flor' | 'orejas' | 'corona' | 'sombrero' | 'audifonos'
  // pijama
  | 'pijama'

export interface Prenda {
  id: string
  nombre: string
  slot: SlotRopa
  precio: number // 0 = gratis
  color: string // color principal (hex)
  acento: string // color secundario (hex)
  estilo: EstiloPrenda
  patron?: Patron
  manga?: 'corta' | 'larga' // solo arriba
  cubre?: 'cuerpo' // vestido y overol tapan también la parte de abajo
  zona?: 'cabeza' | 'cuello' // solo accesorio
  genero?: GeneroPrenda // el Armario muestra primero la del género del personaje
}

/** Tonos de piel (cálidos y variados). */
export const TONOS_PIEL: Opcion[] = [
  { id: 'marfil', nombre: 'Marfil', hex: '#FFE8D6' },
  { id: 'durazno', nombre: 'Durazno', hex: '#FFD2B3' },
  { id: 'miel', nombre: 'Miel', hex: '#F5BE98' },
  { id: 'canela', nombre: 'Canela', hex: '#E5A77E' },
  { id: 'cafe-claro', nombre: 'Café claro', hex: '#C98A5E' },
  { id: 'cafe', nombre: 'Café', hex: '#A8683F' },
  { id: 'chocolate', nombre: 'Chocolate', hex: '#7C4A2D' },
  { id: 'ebano', nombre: 'Ébano', hex: '#4F2F20' },
]

export const PEINADOS: Peinado[] = [
  { id: 'corto', nombre: 'Corto con flequillo', estilo: 'corto' },
  { id: 'corto-despeinado', nombre: 'Corto despeinado', estilo: 'despeinado' },
  { id: 'corte-raya', nombre: 'Corte con raya', estilo: 'raya' },
  { id: 'rizado-corto', nombre: 'Rizado corto', estilo: 'rizado' },
  { id: 'bob', nombre: 'Bob', estilo: 'bob' },
  { id: 'largo', nombre: 'Melena larga', estilo: 'largo' },
  { id: 'coletas', nombre: 'Coletas', estilo: 'coletas' },
  { id: 'chongo', nombre: 'Chongo', estilo: 'chongo' },
  { id: 'rizos', nombre: 'Rizos esponjados', estilo: 'rizos' },
  { id: 'trenza', nombre: 'Trenza', estilo: 'trenza' },
  { id: 'pixie', nombre: 'Pixie', estilo: 'pixie' },
  { id: 'cola', nombre: 'Cola de lado', estilo: 'cola' },
  { id: 'ondas', nombre: 'Ondas', estilo: 'ondas' },
]

export const COLORES_PELO: Opcion[] = [
  { id: 'negro', nombre: 'Negro', hex: '#2E2330' },
  { id: 'castano', nombre: 'Castaño', hex: '#6B4A3A' },
  { id: 'miel', nombre: 'Miel', hex: '#9A6A43' },
  { id: 'rubio', nombre: 'Rubio', hex: '#F2D27A' },
  { id: 'pelirrojo', nombre: 'Pelirrojo', hex: '#E0744A' },
  { id: 'rosa', nombre: 'Rosa', hex: '#FF8DB8' },
  { id: 'lila', nombre: 'Lila', hex: '#B39DDB' },
  { id: 'azul', nombre: 'Azul', hex: '#7FB7FF' },
  { id: 'menta', nombre: 'Menta', hex: '#7ED9B5' },
  { id: 'blanco', nombre: 'Plateado', hex: '#F4EFF6' },
]

export const COLORES_OJOS: Opcion[] = [
  { id: 'cafe', nombre: 'Café', hex: '#6B4226' },
  { id: 'miel', nombre: 'Miel', hex: '#D9953B' },
  { id: 'verde', nombre: 'Verde', hex: '#4FA66B' },
  { id: 'azul', nombre: 'Azul', hex: '#3F8FD9' },
  { id: 'violeta', nombre: 'Violeta', hex: '#8E63C9' },
  { id: 'gris', nombre: 'Gris', hex: '#7D8A9A' },
  { id: 'rosa', nombre: 'Rosa', hex: '#E0679A' },
]

export const OJOS: Ojos[] = [
  { id: 'redondos', nombre: 'Redondos', forma: 'redondos' },
  { id: 'almendra', nombre: 'Almendrados', forma: 'almendra' },
  { id: 'felinos', nombre: 'Felinos', forma: 'felinos' },
  { id: 'corazon', nombre: 'Corazón', forma: 'corazon' },
  { id: 'estrella', nombre: 'Estrellita', forma: 'estrella' },
  { id: 'felices', nombre: 'Cerraditos felices', forma: 'felices' },
]

const PRENDAS_LISTA: Prenda[] = [
  // ARRIBA (10)
  { id: 'arriba-playera-rosa', nombre: 'Playerita rosa', slot: 'arriba', precio: 0, color: '#F7A8C4', acento: '#FFFFFF', estilo: 'playera', manga: 'corta' },
  { id: 'arriba-playera-menta', nombre: 'Playera menta', slot: 'arriba', precio: 30, color: '#A8E6CF', acento: '#FFFFFF', estilo: 'playera', manga: 'corta' },
  { id: 'arriba-blusa-mono', nombre: 'Blusa con moñito', slot: 'arriba', precio: 60, color: '#FFF4F7', acento: '#F48FB1', estilo: 'blusa', manga: 'corta' },
  { id: 'arriba-marinera', nombre: 'Marinera a rayas', slot: 'arriba', color: '#FFFFFF', acento: '#3F6FB5', estilo: 'playera', manga: 'corta', patron: 'rayas', precio: 0 },
  { id: 'arriba-cuadros-pasto', nombre: 'Camisa de cuadros', slot: 'arriba', precio: 50, color: '#B5E48C', acento: '#5E9E3A', estilo: 'camisa', manga: 'larga', patron: 'cuadros' },
  { id: 'arriba-sudadera-lila', nombre: 'Sudadera lila', slot: 'arriba', precio: 80, color: '#C9B1F0', acento: '#8E6CC9', estilo: 'sudadera', manga: 'larga' },
  { id: 'arriba-suter-cielo', nombre: 'Suéter cielo', slot: 'arriba', precio: 90, color: '#A9D6FF', acento: '#FFFFFF', estilo: 'suter', manga: 'larga' },
  { id: 'arriba-hoodie-orejas', nombre: 'Hoodie con orejitas', slot: 'arriba', precio: 120, color: '#FFD6A5', acento: '#F4A261', estilo: 'hoodie', manga: 'larga' },
  { id: 'arriba-vestido-fresa', nombre: 'Vestido de fresas', slot: 'arriba', precio: 150, color: '#FF8FAB', acento: '#FFFFFF', estilo: 'vestido', manga: 'corta', patron: 'lunares', cubre: 'cuerpo' },
  { id: 'arriba-vestido-cielo', nombre: 'Vestido de corazones', slot: 'arriba', precio: 180, color: '#9AD0FF', acento: '#FFFFFF', estilo: 'vestido', manga: 'corta', patron: 'corazones', cubre: 'cuerpo' },
  { id: 'arriba-vestido-margarita', nombre: 'Vestidito de margaritas', slot: 'arriba', precio: 0, color: '#FFF1F6', acento: '#FFB3C6', estilo: 'vestido', manga: 'corta', patron: 'lunares', cubre: 'cuerpo' },
  { id: 'arriba-overol', nombre: 'Overol de mezclilla', slot: 'arriba', precio: 140, color: '#7FB8E8', acento: '#4A74A8', estilo: 'overol', manga: 'corta', cubre: 'cuerpo' },

  // ABAJO (9)
  { id: 'abajo-falda-plisada', nombre: 'Falda plisada', slot: 'abajo', precio: 0, color: '#FFC2D1', acento: '#F48FB1', estilo: 'falda' },
  { id: 'abajo-shorts-mezclilla', nombre: 'Shorts de mezclilla', slot: 'abajo', precio: 0, color: '#7AA6D6', acento: '#5A86B6', estilo: 'short' },
  { id: 'abajo-pantalon-cafe', nombre: 'Pantalón café', slot: 'abajo', precio: 0, color: '#B08968', acento: '#8C6A4D', estilo: 'pantalon' },
  { id: 'abajo-jogger-lila', nombre: 'Pantalón jogger lila', slot: 'abajo', precio: 60, color: '#BDB2FF', acento: '#9B8FE0', estilo: 'pantalon' },
  { id: 'abajo-jeans', nombre: 'Jeans', slot: 'abajo', precio: 40, color: '#4A6FA5', acento: '#3A5A8A', estilo: 'pantalon' },
  { id: 'abajo-ciclista', nombre: 'Shorts ciclistas', slot: 'abajo', precio: 40, color: '#3D405B', acento: '#5C5F80', estilo: 'short' },
  { id: 'abajo-tul', nombre: 'Falda de tul', slot: 'abajo', precio: 90, color: '#FFE5EC', acento: '#FFB3C6', estilo: 'tul' },
  { id: 'abajo-falda-cuadros', nombre: 'Falda de cuadros', slot: 'abajo', precio: 80, color: '#F4A7B9', acento: '#E06C8C', estilo: 'falda', patron: 'cuadros' },
  { id: 'abajo-minifalda-lunares', nombre: 'Minifalda de lunares', slot: 'abajo', precio: 120, color: '#FFAFCC', acento: '#FFFFFF', estilo: 'falda', patron: 'lunares' },

  // ZAPATOS (9)
  { id: 'zapatos-botitas-cafe', nombre: 'Botitas cafés', slot: 'zapatos', precio: 0, color: '#B07D52', acento: '#8C5E3A', estilo: 'botitas' },
  { id: 'zapatos-tenis-blancos', nombre: 'Tenis blancos', slot: 'zapatos', precio: 0, color: '#FFFFFF', acento: '#C9B1F0', estilo: 'tenis' },
  { id: 'zapatos-mary-rosa', nombre: 'Mary Jane rosas', slot: 'zapatos', precio: 60, color: '#FF9EC0', acento: '#FFFFFF', estilo: 'mary' },
  { id: 'zapatos-tenis-menta', nombre: 'Tenis menta', slot: 'zapatos', precio: 80, color: '#A8E6CF', acento: '#FFFFFF', estilo: 'tenis' },
  { id: 'zapatos-botas-lluvia', nombre: 'Botas de lluvia amarillas', slot: 'zapatos', precio: 70, color: '#FFD65C', acento: '#F4B400', estilo: 'botas' },
  { id: 'zapatos-sandalias-cielo', nombre: 'Sandalitas cielo', slot: 'zapatos', precio: 50, color: '#9AD0FF', acento: '#5AA9E6', estilo: 'sandalias' },
  { id: 'zapatos-pantuflas-osito', nombre: 'Pantuflas de osito', slot: 'zapatos', precio: 90, color: '#F5E6D3', acento: '#C9A27E', estilo: 'pantuflas' },
  { id: 'zapatos-tenis-negros', nombre: 'Tenis negros', slot: 'zapatos', precio: 100, color: '#2B2D42', acento: '#FFFFFF', estilo: 'tenis' },
  { id: 'zapatos-botas-vino', nombre: 'Botas vino', slot: 'zapatos', precio: 150, color: '#8E2D52', acento: '#5E1A35', estilo: 'botas' },

  // ACCESORIOS (11)
  { id: 'accesorio-mono-rosa', nombre: 'Moño rosa', slot: 'accesorio', precio: 0, color: '#FF8FB1', acento: '#FFFFFF', estilo: 'moño', zona: 'cabeza' },
  { id: 'accesorio-gorro-lana', nombre: 'Gorro de lana', slot: 'accesorio', precio: 0, color: '#A8D8EA', acento: '#FFFFFF', estilo: 'gorro', zona: 'cabeza' },
  { id: 'accesorio-flor-margarita', nombre: 'Flor margarita', slot: 'accesorio', precio: 30, color: '#FFFFFF', acento: '#FFD65C', estilo: 'flor', zona: 'cabeza' },
  { id: 'accesorio-lentes-redondos', nombre: 'Lentitos redondos', slot: 'accesorio', precio: 40, color: '#7A5C6B', acento: '#FFFFFF', estilo: 'lentes', zona: 'cabeza' },
  { id: 'accesorio-audifonos-pastel', nombre: 'Audífonos pastel', slot: 'accesorio', precio: 50, color: '#C9B1F0', acento: '#FFFFFF', estilo: 'audifonos', zona: 'cabeza' },
  { id: 'accesorio-diadema-estrellas', nombre: 'Diadema de estrellas', slot: 'accesorio', precio: 60, color: '#FFD65C', acento: '#FFFFFF', estilo: 'diadema', zona: 'cabeza' },
  { id: 'accesorio-bufanda-rayas', nombre: 'Bufanda de rayas', slot: 'accesorio', precio: 70, color: '#FFB3C6', acento: '#FFFFFF', estilo: 'bufanda', zona: 'cuello', patron: 'rayas' },
  { id: 'accesorio-collar-perlas', nombre: 'Collar de perlas', slot: 'accesorio', precio: 80, color: '#FFFFFF', acento: '#E6DDF0', estilo: 'collar', zona: 'cuello' },
  { id: 'accesorio-sombrero-paja', nombre: 'Sombrerito de paja', slot: 'accesorio', precio: 90, color: '#F3D9A4', acento: '#E0B872', estilo: 'sombrero', zona: 'cabeza' },
  { id: 'accesorio-orejas-gato', nombre: 'Orejitas de gato', slot: 'accesorio', precio: 120, color: '#FFD6A5', acento: '#F7A8C4', estilo: 'orejas', zona: 'cabeza' },
  { id: 'accesorio-corona-corazon', nombre: 'Corona de corazones', slot: 'accesorio', precio: 250, color: '#FFD65C', acento: '#FF6B9A', estilo: 'corona', zona: 'cabeza' },

  // PIJAMAS (5): se ponen para dormir (anim 'dormido')
  { id: 'pijama-osito', nombre: 'Pijama de osito', slot: 'pijama', precio: 0, color: '#FDE2E4', acento: '#F4A7B9', estilo: 'pijama' },
  { id: 'pijama-nubes', nombre: 'Pijama de nubes', slot: 'pijama', precio: 70, color: '#CDB4DB', acento: '#E7D8F0', estilo: 'pijama', patron: 'lunares' },
  { id: 'pijama-fresas', nombre: 'Pijama de fresas', slot: 'pijama', precio: 90, color: '#FFB3C6', acento: '#FFFFFF', estilo: 'pijama', patron: 'corazones' },
  { id: 'pijama-estrellas', nombre: 'Pijama de estrellas', slot: 'pijama', precio: 110, color: '#2B2D42', acento: '#3D405B', estilo: 'pijama', patron: 'estrellas' },
  { id: 'pijama-gatito', nombre: 'Pijama de gatito', slot: 'pijama', precio: 130, color: '#BDE0FE', acento: '#A2D2FF', estilo: 'pijama', patron: 'rayas' },
]

/** Género de las prendas que no son "ambos". Lo que no aparece aquí es para los dos. */
const GENERO_DE: Record<string, GeneroPrenda> = {
  'arriba-blusa-mono': 'chica', 'arriba-vestido-fresa': 'chica', 'arriba-vestido-cielo': 'chica', 'arriba-vestido-margarita': 'chica',
  'abajo-falda-plisada': 'chica', 'abajo-tul': 'chica', 'abajo-falda-cuadros': 'chica', 'abajo-minifalda-lunares': 'chica',
  'zapatos-botitas-cafe': 'chica', 'zapatos-mary-rosa': 'chica', 'zapatos-sandalias-cielo': 'chica',
  'accesorio-mono-rosa': 'chica', 'accesorio-flor-margarita': 'chica', 'accesorio-corona-corazon': 'chica',
  'accesorio-diadema-estrellas': 'chica', 'accesorio-collar-perlas': 'chica',
  'abajo-pantalon-cafe': 'chico', 'abajo-jeans': 'chico', 'abajo-ciclista': 'chico',
  'zapatos-tenis-negros': 'chico', 'zapatos-botas-vino': 'chico',
}

/** Catálogo final: cada prenda trae su género (por defecto 'ambos'). */
export const PRENDAS: Prenda[] = PRENDAS_LISTA.map((p) => ({ ...p, genero: GENERO_DE[p.id] ?? 'ambos' }))

/** Prenda base que se dibuja si a un espacio no le toca nada (no se vende). */
export const PRENDAS_BASE: Record<Exclude<SlotRopa, 'pijama'>, Prenda> = {
  arriba: { id: 'base-arriba', nombre: 'Camiseta básica', slot: 'arriba', precio: 0, color: '#FFFFFF', acento: '#CFE8FF', estilo: 'playera', manga: 'corta' },
  abajo: { id: 'base-abajo', nombre: 'Short básico', slot: 'abajo', precio: 0, color: '#CFE8FF', acento: '#A9D0F5', estilo: 'short' },
  zapatos: { id: 'base-zapatos', nombre: 'Zapatos básicos', slot: 'zapatos', precio: 0, color: '#B07D52', acento: '#8C5E3A', estilo: 'botitas' },
  accesorio: { id: 'base-accesorio', nombre: 'Sin accesorio', slot: 'accesorio', precio: 0, color: '#FFFFFF', acento: '#FFFFFF', estilo: 'moño', zona: 'cabeza' },
}

/** Look de inicio de cada género: ropa gratis, peinado y ojos propios. */
export const LOOK_POR_GENERO: Record<Genero, Look> = {
  chica: {
    piel: TONOS_PIEL[1].hex,
    pelo: 'bob',
    colorPelo: COLORES_PELO[1].hex,
    ojos: 'almendra', // pestañas largas
    colorOjos: COLORES_OJOS[0].hex,
    rubor: true,
    genero: 'chica',
    ropa: { arriba: 'arriba-vestido-margarita', zapatos: 'zapatos-botitas-cafe' }, // vestido de inicio (cubre el cuerpo)
  },
  chico: {
    piel: TONOS_PIEL[2].hex,
    pelo: 'corto-despeinado',
    colorPelo: COLORES_PELO[0].hex,
    ojos: 'redondos', // sin pestañas largas
    colorOjos: COLORES_OJOS[3].hex,
    rubor: false,
    genero: 'chico',
    ropa: { arriba: 'arriba-marinera', abajo: 'abajo-pantalon-cafe', zapatos: 'zapatos-tenis-blancos' },
  },
}

/** Look de inicio de la chica (compatibilidad con código que usa LOOK_BASE). */
export const LOOK_BASE: Look = LOOK_POR_GENERO.chica

export const GENEROS: Array<{ id: Genero; nombre: string }> = [
  { id: 'chica', nombre: 'Chica' },
  { id: 'chico', nombre: 'Chico' },
]

/** ¿La prenda sirve para este género? Las "ambos" sirven para cualquiera. */
export function prendaParaGenero(p: Prenda, genero: Genero): boolean {
  return (p.genero ?? 'ambos') === 'ambos' || p.genero === genero
}

/**
 * Cambia el género de un personaje. Lo que no corresponde se reemplaza por el
 * atuendo y peinado por defecto del nuevo género; lo demás (colores, ojos, rubor) se conserva.
 */
export function cambiarGenero(look: Look, nuevo: Genero): Look {
  const anterior: Genero = look.genero ?? (nuevo === 'chica' ? 'chico' : 'chica')
  if (look.genero === nuevo) return look
  const base = LOOK_POR_GENERO[nuevo]
  const ropa: Partial<Record<SlotRopa, string>> = { ...look.ropa }
  for (const slot of Object.keys(base.ropa) as Array<Exclude<SlotRopa, 'pijama' | 'accesorio'>>) {
    const id = ropa[slot]
    const pr = buscarPrenda(id)
    if (!pr || !prendaParaGenero(pr, nuevo)) ropa[slot] = base.ropa[slot]
  }
  if (look.pelo === LOOK_POR_GENERO[anterior].pelo) {
    return { ...look, genero: nuevo, pelo: base.pelo, ojos: look.ojos, ropa }
  }
  return { ...look, genero: nuevo, ropa }
}

/**
 * Partidas guardadas sin género: el primer personaje es chica y el segundo chico.
 * Al segundo, si trae el atuendo de inicio de la chica, se le pone el del chico
 * (no se toca la ropa que compró o eligió).
 */
export function completarGenero(look: Look, indice: 0 | 1): Look {
  if (look.genero) return look
  if (indice === 0) return { ...look, genero: 'chica' }
  // Partidas viejas traían la playera y la falda de inicio de la chica.
  const inicioChica = LOOK_POR_GENERO.chica.ropa
  const ropaDeInicio =
    look.ropa.zapatos === inicioChica.zapatos &&
    (look.ropa.arriba === inicioChica.arriba || look.ropa.arriba === 'arriba-playera-rosa') &&
    (look.ropa.abajo === undefined || look.ropa.abajo === 'abajo-falda-plisada')
  return ropaDeInicio
    ? { ...look, genero: 'chico', ropa: { ...look.ropa, ...LOOK_POR_GENERO.chico.ropa } }
    : { ...look, genero: 'chico' }
}

export const PRENDAS_POR_SLOT: Record<SlotRopa, Prenda[]> = {
  arriba: PRENDAS.filter((p) => p.slot === 'arriba'),
  abajo: PRENDAS.filter((p) => p.slot === 'abajo'),
  zapatos: PRENDAS.filter((p) => p.slot === 'zapatos'),
  accesorio: PRENDAS.filter((p) => p.slot === 'accesorio'),
  pijama: PRENDAS.filter((p) => p.slot === 'pijama'),
}

const POR_ID = new Map<string, Prenda>(PRENDAS.map((p) => [p.id, p]))

/** Busca una prenda por id; devuelve undefined si no existe (dato viejo o desconocido). */
export function buscarPrenda(id: string | undefined): Prenda | undefined {
  return id ? POR_ID.get(id) : undefined
}

export function buscarPeinado(id: string): Peinado {
  return PEINADOS.find((p) => p.id === id) ?? PEINADOS[0]
}

export function buscarOjos(id: string): Ojos {
  return OJOS.find((o) => o.id === id) ?? OJOS[0]
}

export function buscarOpcion(lista: Opcion[], id: string): Opcion {
  return lista.find((o) => o.id === id) ?? lista[0]
}

/** Etiqueta en español para cada espacio de ropa. */
export const NOMBRE_SLOT: Record<SlotRopa, string> = {
  arriba: 'Arriba',
  abajo: 'Abajo',
  zapatos: 'Zapatos',
  accesorio: 'Accesorios',
  pijama: 'Pijama',
}
