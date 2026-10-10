/**
 * Datos de "Pastelería en Pareja": recetas, clientes, niveles y progreso.
 * Todo lo que es tabla de valores vive aquí; la lógica está en logic.ts.
 */

export type Side = 0 | 1 // 0 = abajo (jugador 1), 1 = arriba (jugador 2)

export const W0 = 360
export const H0 = 640

export const ING_LABEL: Record<string, string> = {
  harina: 'HARINA',
  huevo: 'HUEVO',
  azucar: 'AZUCAR',
  leche: 'LECHE',
  mantequilla: 'MANTEQ',
  chocolate: 'CHOCO',
  crema: 'CREMA',
  fresa: 'FRESA',
  glase: 'GLASE',
  chispas: 'CHISPAS',
}

/** Estantes de cada lado: los ingredientes se reparten para obligar a pasarse cosas. */
export const SHELVES: string[][] = [
  ['harina', 'huevo', 'azucar', 'leche', 'mantequilla'], // abajo
  ['chocolate', 'crema', 'fresa', 'glase', 'chispas'], // arriba
]

export interface Recipe {
  id: string
  name: string
  /** Ingredientes que se mezclan en el tazón (sin importar el orden). */
  mix: string[]
  /** Segundos en el horno. */
  bake: number
  /** Toppings que se aplican en la tabla de decorar. */
  deco: string[]
  price: number
  color: string
}

export const RECIPES: Record<string, Recipe> = {
  galleta: {
    id: 'galleta',
    name: 'Galleta',
    mix: ['harina', 'mantequilla', 'azucar'],
    bake: 5,
    deco: ['chispas'],
    price: 20,
    color: '#f5c28a',
  },
  cupcake: {
    id: 'cupcake',
    name: 'Cupcake',
    mix: ['harina', 'huevo', 'azucar'],
    bake: 6,
    deco: ['crema'],
    price: 25,
    color: '#fbcfe8',
  },
  dona: {
    id: 'dona',
    name: 'Dona',
    mix: ['harina', 'huevo', 'leche'],
    bake: 4,
    deco: ['glase'],
    price: 30,
    color: '#fde68a',
  },
  macaron: {
    id: 'macaron',
    name: 'Macarón',
    mix: ['azucar', 'huevo', 'chocolate'],
    bake: 3,
    deco: ['crema'],
    price: 35,
    color: '#c4b5fd',
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel de fresa',
    mix: ['harina', 'huevo', 'leche', 'azucar'],
    bake: 8,
    deco: ['crema', 'fresa'],
    price: 50,
    color: '#fda4af',
  },
}

export type Animal = 'gato' | 'conejo' | 'oso' | 'cerdo'

export const ANIMALS: { id: Animal; name: string; color: string }[] = [
  { id: 'gato', name: 'Gatito', color: '#fdba74' },
  { id: 'conejo', name: 'Conejo', color: '#e5e7eb' },
  { id: 'oso', name: 'Osito', color: '#c08457' },
  { id: 'cerdo', name: 'Cerdito', color: '#f9a8d4' },
]

export interface LevelCfg {
  n: number
  /** Duración en segundos. */
  dur: number
  recipes: string[]
  maxCust: number
  /** Segundos entre clientes [mín, máx]. */
  spawn: [number, number]
  /** Paciencia en segundos [mín, máx]. */
  patience: [number, number]
  /** Monedas para 1 estrella; 2 estrellas = 1.5x y 3 = 2x. */
  target: number
}

const ALL = Object.keys(RECIPES)

export const LEVELS: LevelCfg[] = [
  { n: 1, dur: 120, recipes: ['galleta', 'cupcake'], maxCust: 2, spawn: [9, 12], patience: [55, 65], target: 150 },
  { n: 2, dur: 130, recipes: ['galleta', 'cupcake', 'dona'], maxCust: 2, spawn: [8, 11], patience: [50, 58], target: 260 },
  { n: 3, dur: 150, recipes: ['cupcake', 'dona', 'macaron'], maxCust: 3, spawn: [7, 10], patience: [38, 46], target: 380 },
  { n: 4, dur: 160, recipes: ['galleta', 'dona', 'macaron', 'pastel'], maxCust: 3, spawn: [6, 9], patience: [36, 44], target: 520 },
  { n: 5, dur: 170, recipes: ALL, maxCust: 3, spawn: [5, 8], patience: [34, 42], target: 680 },
  { n: 6, dur: 180, recipes: ALL, maxCust: 3, spawn: [4, 7], patience: [32, 40], target: 850 },
]

export function starsFor(coins: number, target: number): number {
  if (coins >= target * 2) return 3
  if (coins >= target * 1.5) return 2
  if (coins >= target) return 1
  return 0
}

export function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export interface Progress {
  /** Nivel más alto desbloqueado (1-based). */
  unlocked: number
  /** Mejores estrellas por nivel. */
  stars: number[]
}

const KEY = 'arcade-pasteleria-v1'

function fresh(): Progress {
  return { unlocked: 1, stars: LEVELS.map(() => 0) }
}

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return fresh()
    const p = JSON.parse(raw) as Partial<Progress>
    const unlocked = Math.min(LEVELS.length, Math.max(1, Number(p.unlocked) || 1))
    const stars = LEVELS.map((_, i) => Math.min(3, Math.max(0, Number(p.stars?.[i]) || 0)))
    return { unlocked, stars }
  } catch {
    return fresh()
  }
}

/** Guarda el resultado de un nivel (1-based) y desbloquea el siguiente si se ganó alguna estrella. */
export function saveResult(n: number, stars: number): Progress {
  const p = loadProgress()
  const i = n - 1
  p.stars[i] = Math.max(p.stars[i], stars)
  if (stars > 0) p.unlocked = Math.max(p.unlocked, Math.min(LEVELS.length, n + 1))
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // sin localStorage: el progreso dura lo que la pestaña
  }
  return p
}
