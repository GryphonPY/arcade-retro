/** Recetario: pasteles con nombre que se descubren al hacer uno que cumpla su receta. */
import { bakeLevel, countOf, frostInfo, fruitCount, slices, variety, type Cake } from './cake'

export interface Recipe {
  id: string
  name: string
  clue: string
  test: (c: Cake) => boolean
}

const frostIs = (c: Cake, id: string, f = 0.7) => (frostInfo(c).by.get(id as never) ?? 0) >= f
const baked = (c: Cake) => ['suave', 'punto', 'dorado'].includes(bakeLevel(c.bake))

export const RECIPES: Recipe[] = [
  { id: 'clasico', name: 'Clásico de la abuela', clue: 'Vainilla, crema blanca y fresas', test: (c) => baked(c) && c.flavor === 'vainilla' && frostIs(c, 'blanca') && countOf(c, 'fresa') >= 4 },
  { id: 'selva', name: 'Selva Negra', clue: 'Chocolate, crema de chocolate y cerezas', test: (c) => baked(c) && c.flavor === 'chocolate' && frostIs(c, 'choco') && countOf(c, 'cereza') >= 4 },
  { id: 'nube', name: 'Nube Rosa', clue: 'Fresa por dentro, rosa por fuera, nada encima', test: (c) => baked(c) && c.flavor === 'pan-fresa' && frostIs(c, 'rosa', 0.85) && c.pieces.length === 0 },
  { id: 'arcoiris', name: 'Arcoíris', clue: 'Seis adornos distintos', test: (c) => baked(c) && variety(c) >= 6 },
  { id: 'cumple', name: 'Cumpleaños feliz', clue: 'Velas, chispas y en 8', test: (c) => baked(c) && countOf(c, 'vela') >= 3 && countOf(c, 'chispas') >= 5 && slices(c) === 8 },
  { id: 'jardin', name: 'Jardín secreto', clue: 'Menta con flores y kiwi', test: (c) => baked(c) && frostIs(c, 'menta') && countOf(c, 'flor') >= 3 && countOf(c, 'kiwi') >= 2 },
  { id: 'terciopelo', name: 'Terciopelo', clue: 'Red velvet con crema blanca', test: (c) => baked(c) && c.flavor === 'redvelvet' && frostIs(c, 'blanca', 0.85) },
  { id: 'zen', name: 'Té de la tarde', clue: 'Matcha, sin crema, entero', test: (c) => baked(c) && c.flavor === 'matcha' && frostInfo(c).cover < 0.05 && slices(c) === 1 },
  { id: 'cielo', name: 'Cielo estrellado', clue: 'Azul cielo con estrellas', test: (c) => baked(c) && frostIs(c, 'cielo') && countOf(c, 'estrella') >= 5 },
  { id: 'paris', name: 'París', clue: 'Lila con macarones', test: (c) => baked(c) && frostIs(c, 'lila') && countOf(c, 'macaron') >= 3 },
  { id: 'frutal', name: 'Huerto frutal', clue: 'Mucha fruta de tres tipos', test: (c) => baked(c) && fruitCount(c) >= 10 && ['fresa', 'cereza', 'arandano', 'kiwi'].filter((k) => countOf(c, k as never) > 0).length >= 3 },
  { id: 'galletero', name: 'Monstruo galletero', clue: 'Chocolate con galletas y bombones', test: (c) => baked(c) && c.flavor === 'chocolate' && countOf(c, 'galleta') >= 3 && countOf(c, 'bombon') >= 3 },
  { id: 'enamorados', name: 'Enamorados', clue: 'Mitad rosa, mitad blanca y corazones', test: (c) => {
    const f = frostInfo(c)
    const pair = [f.left[0], f.right[0]].sort().join()
    return baked(c) && pair === 'blanca,rosa' && countOf(c, 'corazon') >= 4
  } },
  { id: 'limonada', name: 'Limonada', clue: 'Limón, bien dorado', test: (c) => frostIs(c, 'limon') && bakeLevel(c.bake) === 'dorado' },
  { id: 'quemadito', name: 'Carboncito', clue: 'Ups... (quémalo)', test: (c) => bakeLevel(c.bake) === 'quemado' },
]
