/** Datos de Sunset Run: coches, rivales, copas, pistas, temas, mejoras y radio. */
import type { RGB } from './util'

export const GAME_ID = 'sunset-run'
export const ACCENT = '#f97316'

// ===================== Temas de pista =====================

export type ThemeId = 'costa' | 'desierto' | 'ciudad' | 'nieve' | 'selva' | 'canon'
export type SpriteKind =
  | 'palm'
  | 'palm2'
  | 'umbrella'
  | 'hut'
  | 'lighthouse'
  | 'rock'
  | 'cactus'
  | 'cactus2'
  | 'boulder'
  | 'mesa'
  | 'deadtree'
  | 'bldgA'
  | 'bldgB'
  | 'bldgC'
  | 'lamp'
  | 'neon'
  | 'pine'
  | 'pine2'
  | 'snowrock'
  | 'cabin'
  | 'snowman'
  | 'jtree'
  | 'fern'
  | 'banana'
  | 'ruin'
  | 'hoodoo'
  | 'billboard'
  | 'billboard2'
  | 'billboard3'
  | 'chevL'
  | 'chevR'
  | 'gantry'
  | 'tower'

export interface DecorRule {
  kind: SpriteKind
  weight: number
  /** Rango de distancia lateral (en anchos de media carretera). */
  min: number
  max: number
}

export interface Theme {
  id: ThemeId
  name: string
  ground: [string, string]
  road: [string, string]
  rumble: [string, string]
  lane: string
  /** Franja entre el bordillo y el terreno (arena en la costa, banqueta en ciudad). */
  shoulder?: [string, string]
  water: [string, string]
  tunnelWall: [string, string]
  decor: DecorRule[]
  density: number
  weather: 'none' | 'snow' | 'dust' | 'fireflies' | 'leaves'
}

export const THEMES: Record<ThemeId, Theme> = {
  costa: {
    id: 'costa',
    name: 'Costa',
    ground: ['#e9c98f', '#dfbb7d'],
    road: ['#6e6c78', '#676572'],
    rumble: ['#f4f1ea', '#d7352f'],
    lane: '#f7f3e8',
    shoulder: ['#f3dcaa', '#ead09a'],
    water: ['#1f6fb2', '#1b64a3'],
    tunnelWall: ['#7a5a46', '#6b4e3d'],
    decor: [
      { kind: 'palm', weight: 6, min: 1.25, max: 2.6 },
      { kind: 'palm2', weight: 5, min: 1.25, max: 2.8 },
      { kind: 'umbrella', weight: 2, min: 1.6, max: 3.2 },
      { kind: 'hut', weight: 1, min: 2.0, max: 3.4 },
      { kind: 'rock', weight: 1.5, min: 1.3, max: 3.0 },
      { kind: 'lighthouse', weight: 0.25, min: 3.0, max: 4.5 },
    ],
    density: 0.42,
    weather: 'none',
  },
  desierto: {
    id: 'desierto',
    name: 'Desierto',
    ground: ['#eaa65c', '#de9a51'],
    road: ['#7a6f68', '#736861'],
    rumble: ['#fffaf0', '#c2412d'],
    lane: '#fff1c8',
    water: ['#2f8fb0', '#2a83a2'],
    tunnelWall: ['#a0643a', '#8e5732'],
    decor: [
      { kind: 'cactus', weight: 5, min: 1.25, max: 3.2 },
      { kind: 'cactus2', weight: 4, min: 1.25, max: 3.2 },
      { kind: 'boulder', weight: 3, min: 1.3, max: 3.0 },
      { kind: 'deadtree', weight: 1.5, min: 1.4, max: 3.0 },
      { kind: 'mesa', weight: 0.6, min: 3.2, max: 5.0 },
    ],
    density: 0.3,
    weather: 'dust',
  },
  ciudad: {
    id: 'ciudad',
    name: 'Ciudad',
    ground: ['#4a4a5a', '#434352'],
    road: ['#33333f', '#2e2e39'],
    rumble: ['#e8e8ee', '#f2b705'],
    lane: '#f2c94c',
    shoulder: ['#6b6b7c', '#636373'],
    water: ['#16365c', '#132f51'],
    tunnelWall: ['#55556a', '#4a4a5d'],
    decor: [
      { kind: 'bldgA', weight: 4, min: 1.7, max: 2.6 },
      { kind: 'bldgB', weight: 4, min: 1.7, max: 2.8 },
      { kind: 'bldgC', weight: 3, min: 1.9, max: 3.0 },
      { kind: 'neon', weight: 1.4, min: 1.35, max: 1.6 },
      { kind: 'palm', weight: 1.4, min: 1.3, max: 1.5 },
    ],
    density: 0.55,
    weather: 'none',
  },
  nieve: {
    id: 'nieve',
    name: 'Montaña nevada',
    ground: ['#f2f6fc', '#e2e9f4'],
    road: ['#5f6472', '#585d6b'],
    rumble: ['#ffffff', '#2f6fd6'],
    lane: '#ffffff',
    water: ['#5f9fd6', '#5793c8'],
    tunnelWall: ['#6b7280', '#5d6370'],
    decor: [
      { kind: 'pine', weight: 6, min: 1.25, max: 3.4 },
      { kind: 'pine2', weight: 5, min: 1.25, max: 3.4 },
      { kind: 'snowrock', weight: 2, min: 1.3, max: 3.0 },
      { kind: 'cabin', weight: 0.6, min: 2.2, max: 3.6 },
      { kind: 'snowman', weight: 0.5, min: 1.4, max: 2.4 },
    ],
    density: 0.5,
    weather: 'snow',
  },
  selva: {
    id: 'selva',
    name: 'Selva',
    ground: ['#2f8a3a', '#287c33'],
    road: ['#6c6158', '#655a52'],
    rumble: ['#f4d03f', '#2a2a2a'],
    lane: '#f6f0d2',
    water: ['#1e7f78', '#1a726b'],
    tunnelWall: ['#5d6b3a', '#505d31'],
    decor: [
      { kind: 'jtree', weight: 5, min: 1.3, max: 3.0 },
      { kind: 'banana', weight: 4, min: 1.25, max: 2.8 },
      { kind: 'fern', weight: 5, min: 1.15, max: 2.4 },
      { kind: 'palm2', weight: 2, min: 1.3, max: 2.6 },
      { kind: 'ruin', weight: 0.7, min: 1.6, max: 3.0 },
    ],
    density: 0.62,
    weather: 'leaves',
  },
  canon: {
    id: 'canon',
    name: 'Cañón',
    ground: ['#c75b33', '#b9522d'],
    road: ['#6f5c54', '#68554d'],
    rumble: ['#ffffff', '#7a2e8f'],
    lane: '#ffe3b4',
    water: ['#2b7aa0', '#266f93'],
    tunnelWall: ['#8e3f26', '#7d3621'],
    decor: [
      { kind: 'hoodoo', weight: 4, min: 1.4, max: 3.4 },
      { kind: 'boulder', weight: 4, min: 1.3, max: 3.0 },
      { kind: 'cactus', weight: 2, min: 1.3, max: 3.0 },
      { kind: 'deadtree', weight: 1.5, min: 1.4, max: 3.0 },
      { kind: 'mesa', weight: 0.8, min: 3.2, max: 5.0 },
    ],
    density: 0.36,
    weather: 'dust',
  },
}

// ===================== Hora del día =====================

export type TodId = 'atardecer' | 'tarde' | 'noche' | 'amanecer' | 'crepusculo'
export interface Tod {
  id: TodId
  name: string
  /** Degradado del cielo: arriba → horizonte. */
  sky: [string, string, string, string]
  fog: string
  light: RGB
  night: boolean
  sun: { kind: 'sun' | 'moon'; y: number; r: number; c1: string; c2: string; stripes: boolean; glow: string }
  /** Color de las siluetas lejanas. */
  far: string
  mid: string
  near: string
}

export const TODS: Record<TodId, Tod> = {
  atardecer: {
    id: 'atardecer',
    name: 'Atardecer',
    sky: ['#24124a', '#7c2a6d', '#e4515a', '#ffb35a'],
    fog: '#f59a6b',
    light: [255, 214, 186],
    night: false,
    sun: { kind: 'sun', y: -18, r: 66, c1: '#fff27a', c2: '#ff4f6a', stripes: true, glow: '#ff9a5a' },
    far: '#a2486f',
    mid: '#6e2a5e',
    near: '#3e1a45',
  },
  tarde: {
    id: 'tarde',
    name: 'Tarde dorada',
    sky: ['#2a62b8', '#5d93d4', '#b7cfe0', '#f8d49a'],
    fog: '#efd2a2',
    light: [255, 244, 226],
    night: false,
    sun: { kind: 'sun', y: -112, r: 24, c1: '#fffbe6', c2: '#ffd36b', stripes: false, glow: '#fff1b0' },
    far: '#8aa3c4',
    mid: '#6d7fa3',
    near: '#4f5f7f',
  },
  noche: {
    id: 'noche',
    name: 'Noche',
    sky: ['#03030c', '#090a24', '#1a1846', '#3b2b62'],
    fog: '#22204a',
    light: [118, 122, 178],
    night: true,
    sun: { kind: 'moon', y: -120, r: 20, c1: '#f4f1de', c2: '#c9c6b4', stripes: false, glow: '#8f8fd0' },
    far: '#262457',
    mid: '#1a1840',
    near: '#100f2a',
  },
  amanecer: {
    id: 'amanecer',
    name: 'Amanecer',
    sky: ['#1b2756', '#5c4a8e', '#e591b2', '#ffdca3'],
    fog: '#f0b8c2',
    light: [240, 220, 236],
    night: false,
    sun: { kind: 'sun', y: -6, r: 48, c1: '#fff7d6', c2: '#ff9fb0', stripes: false, glow: '#ffc2c2' },
    far: '#9a7fb0',
    mid: '#6f5a92',
    near: '#4a3c6e',
  },
  crepusculo: {
    id: 'crepusculo',
    name: 'Crepúsculo',
    sky: ['#0c0626', '#3b1262', '#a12b7c', '#ff6a5a'],
    fog: '#8a3a7c',
    light: [196, 156, 206],
    night: false,
    sun: { kind: 'sun', y: -24, r: 78, c1: '#ffe66b', c2: '#ff2fa0', stripes: true, glow: '#ff5fa0' },
    far: '#6a2470',
    mid: '#46185a',
    near: '#2a0f3c',
  },
}

// ===================== Copas y pistas =====================

export interface TrackMeta {
  name: string
  theme: ThemeId
  tod: TodId
  laps: number
  /** Longitud aproximada de la vuelta en segmentos. */
  length: number
  seed: number
  curvy: number
  hilly: number
  tunnels: number
  bridges: number
}

export interface Cup {
  name: string
  color: string
  tracks: TrackMeta[]
}

export const CUPS: Cup[] = [
  {
    name: 'Copa Atardecer',
    color: '#f97316',
    tracks: [
      { name: 'Bahía Dorada', theme: 'costa', tod: 'atardecer', laps: 3, length: 1250, seed: 11, curvy: 0.35, hilly: 0.35, tunnels: 0, bridges: 1 },
      { name: 'Dunas de Fuego', theme: 'desierto', tod: 'tarde', laps: 3, length: 1350, seed: 23, curvy: 0.45, hilly: 0.6, tunnels: 1, bridges: 0 },
      { name: 'Neón Boulevard', theme: 'ciudad', tod: 'noche', laps: 3, length: 1400, seed: 37, curvy: 0.5, hilly: 0.3, tunnels: 2, bridges: 1 },
      { name: 'Pico Nevado', theme: 'nieve', tod: 'amanecer', laps: 3, length: 1450, seed: 41, curvy: 0.55, hilly: 0.8, tunnels: 1, bridges: 1 },
    ],
  },
  {
    name: 'Copa Tropical',
    color: '#22c55e',
    tracks: [
      { name: 'Selva Esmeralda', theme: 'selva', tod: 'tarde', laps: 3, length: 1500, seed: 53, curvy: 0.6, hilly: 0.5, tunnels: 1, bridges: 2 },
      { name: 'Cañón Carmesí', theme: 'canon', tod: 'crepusculo', laps: 3, length: 1550, seed: 67, curvy: 0.65, hilly: 0.75, tunnels: 2, bridges: 1 },
      { name: 'Costa de Luna', theme: 'costa', tod: 'noche', laps: 3, length: 1600, seed: 71, curvy: 0.62, hilly: 0.5, tunnels: 1, bridges: 2 },
      { name: 'Paso Glaciar', theme: 'nieve', tod: 'crepusculo', laps: 3, length: 1650, seed: 83, curvy: 0.72, hilly: 0.9, tunnels: 2, bridges: 1 },
    ],
  },
  {
    name: 'Copa Leyenda',
    color: '#e879f9',
    tracks: [
      { name: 'Metrópolis 86', theme: 'ciudad', tod: 'atardecer', laps: 3, length: 1700, seed: 97, curvy: 0.72, hilly: 0.45, tunnels: 3, bridges: 2 },
      { name: 'Templo Perdido', theme: 'selva', tod: 'noche', laps: 3, length: 1700, seed: 101, curvy: 0.78, hilly: 0.75, tunnels: 2, bridges: 2 },
      { name: 'Oasis Espejismo', theme: 'desierto', tod: 'noche', laps: 3, length: 1750, seed: 113, curvy: 0.8, hilly: 0.85, tunnels: 1, bridges: 1 },
      { name: 'Sunset Highway', theme: 'costa', tod: 'crepusculo', laps: 3, length: 1850, seed: 127, curvy: 0.85, hilly: 0.75, tunnels: 2, bridges: 2 },
    ],
  },
]

// ===================== Coches =====================

export type BodyStyle = 'gt' | 'wedge' | 'coupe' | 'muscle'
export interface CarColors {
  body: string
  dark: string
  light: string
  trim: string
  stripe?: string
}
export interface CarModel {
  id: string
  name: string
  tag: string
  body: BodyStyle
  colors: CarColors
  /** Estadísticas visibles (1 a 5). */
  stats: { vel: number; acc: number; man: number; nit: number }
  top: number
  accel: number
  grip: number
  nitro: number
}

export const CARS: CarModel[] = [
  {
    id: 'brisa',
    name: 'Brisa GT',
    tag: 'Convertible equilibrado. Perfecto para empezar.',
    body: 'gt',
    colors: { body: '#e3262f', dark: '#8f1119', light: '#ff7a6b', trim: '#1a1a1f' },
    stats: { vel: 3, acc: 3, man: 4, nit: 3 },
    top: 1.0,
    accel: 1.0,
    grip: 1.06,
    nitro: 1.0,
  },
  {
    id: 'rayo',
    name: 'Rayo V12',
    tag: 'Cuña italiana: punta brutal, pero cuesta domarla.',
    body: 'wedge',
    colors: { body: '#f6c519', dark: '#a87c05', light: '#fff2a0', trim: '#18181c' },
    stats: { vel: 5, acc: 3, man: 2, nit: 3 },
    top: 1.07,
    accel: 0.95,
    grip: 0.88,
    nitro: 1.0,
  },
  {
    id: 'kumo',
    name: 'Kumo RS',
    tag: 'Coupé japonés ligero: el rey del derrape.',
    body: 'coupe',
    colors: { body: '#f2f4f7', dark: '#9aa3b1', light: '#ffffff', trim: '#16161b', stripe: '#2563eb' },
    stats: { vel: 2, acc: 4, man: 5, nit: 2 },
    top: 0.96,
    accel: 1.14,
    grip: 1.22,
    nitro: 0.9,
  },
  {
    id: 'bestia',
    name: 'Bestia 77',
    tag: 'Muscle car con compresor: vive del nitro.',
    body: 'muscle',
    colors: { body: '#1d1b22', dark: '#0b0a0e', light: '#4a4656', trim: '#c7c9d1', stripe: '#f97316' },
    stats: { vel: 4, acc: 4, man: 2, nit: 5 },
    top: 1.02,
    accel: 1.06,
    grip: 0.9,
    nitro: 1.4,
  },
]

export type Personality = 'agresivo' | 'consistente' | 'erratico'
export interface RivalDef {
  name: string
  pers: Personality
  body: BodyStyle
  colors: CarColors
  /** Bonus de habilidad base (aprox. -0.03..+0.03). */
  skill: number
}

export const RIVALS: RivalDef[] = [
  { name: 'Vega', pers: 'agresivo', body: 'muscle', colors: { body: '#7c3aed', dark: '#3b1773', light: '#b794ff', trim: '#d4d4dc', stripe: '#facc15' }, skill: 0.02 },
  { name: 'Kenji', pers: 'consistente', body: 'coupe', colors: { body: '#ef4444', dark: '#8b1c1c', light: '#ff9a9a', trim: '#141418', stripe: '#111111' }, skill: 0.03 },
  { name: 'Lola', pers: 'erratico', body: 'gt', colors: { body: '#ec4899', dark: '#8a1f55', light: '#ff9ccc', trim: '#18181c' }, skill: 0.0 },
  { name: 'Duarte', pers: 'agresivo', body: 'wedge', colors: { body: '#16a34a', dark: '#0b5a28', light: '#7ee2a0', trim: '#141418' }, skill: 0.01 },
  { name: 'Mika', pers: 'consistente', body: 'gt', colors: { body: '#0ea5e9', dark: '#0a5a80', light: '#8adcff', trim: '#16161a' }, skill: 0.015 },
  { name: 'Rocco', pers: 'erratico', body: 'muscle', colors: { body: '#f97316', dark: '#8a3a08', light: '#ffc08a', trim: '#cfd2da', stripe: '#111111' }, skill: -0.01 },
  { name: 'Sol', pers: 'consistente', body: 'wedge', colors: { body: '#f5f5f4', dark: '#9b9b98', light: '#ffffff', trim: '#141418', stripe: '#e11d48' }, skill: 0.04 },
]

export const PERS_LABEL: Record<Personality, string> = {
  agresivo: 'Agresivo',
  consistente: 'Constante',
  erratico: 'Errático',
}

// ===================== Puntos, dinero y mejoras =====================

export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1]
export const PRIZE = [1500, 1100, 850, 650, 500, 380, 260, 150]

export type UpgradeId = 'motor' | 'turbo' | 'llantas' | 'carroceria' | 'rebufo'
export interface UpgradeDef {
  id: UpgradeId
  name: string
  desc: string
  costs: number[]
}
export const UPGRADES: UpgradeDef[] = [
  { id: 'motor', name: 'Motor', desc: 'Más velocidad punta y mejor aceleración.', costs: [900, 1500, 2300, 3300, 4600] },
  { id: 'turbo', name: 'Turbo', desc: 'Tanque de nitro más grande y empuje más fuerte.', costs: [700, 1200, 1900, 2800, 3900] },
  { id: 'llantas', name: 'Llantas', desc: 'Más agarre en curvas y menos castigo en la arena.', costs: [700, 1200, 1900, 2800, 3900] },
  { id: 'carroceria', name: 'Carrocería', desc: 'Pierdes menos velocidad en choques; escudos más largos.', costs: [600, 1000, 1600, 2400, 3400] },
  { id: 'rebufo', name: 'Rebufo', desc: 'El rebufo y los derrapes recargan más nitro.', costs: [600, 1000, 1600, 2400, 3400] },
]
export const MAX_LVL = 5
export type Upgrades = Record<UpgradeId, number>
export const noUpgrades = (): Upgrades => ({ motor: 0, turbo: 0, llantas: 0, carroceria: 0, rebufo: 0 })

// ===================== Radio =====================

export interface StationDef {
  id: string
  freq: string
  name: string
  style: string
  color: string
}
export const STATIONS: StationDef[] = [
  { id: 'brisa', freq: '101.5', name: 'BRISA FM', style: 'Synth-pop veraniego', color: '#f97316' },
  { id: 'funk', freq: '94.3', name: 'FUNK TOTAL', style: 'Funk de bajo y metales', color: '#facc15' },
  { id: 'rock', freq: '88.1', name: 'TURBO ROCK', style: 'Rock de guitarras', color: '#ef4444' },
  { id: 'latin', freq: '99.9', name: 'OLA LATINA', style: 'Surf y percusión latina', color: '#22d3ee' },
]

export type PickupKind = 'nitro' | 'shield' | 'magnet' | 'coin'
