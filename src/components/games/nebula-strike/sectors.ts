/**
 * Los seis sectores de la campaña: paleta, decorado, música, guion de
 * oleadas (con mid-boss) y jefe. Tras el sexto se repite con más dificultad.
 */
import type { Game } from './game'
import type { BossDef, EnemyDef } from './types'
import type { SongId } from './soundtrack'
import { tintFrom, type Tint } from './sprites'
import { blade, carrier, dart, frigate, gunship, itemShip, mine, sentinel, sniper, turret, weaver, zako } from './enemies'
import { HELIOS, HIDRA, LEVIATAN, MANTIS, NEXO, VIGIA } from './bosses'
import { W, rand } from './util'

export interface Palette {
  base: string
  neb: string[]
  star: string
  decor: 'planet' | 'rocks' | 'giant' | 'wrecks' | 'sun' | 'void'
}

type Wave = (g: Game) => void
export type Script = [number, Wave][]

export interface SectorDef {
  name: string
  pal: Palette
  tint: Tint
  song: SongId
  boss: BossDef
  script: Script
}

// ===================== Plantillas de oleada =====================

/** Probabilidad de que un enemigo mediano suelte un potenciador (sube por sector). */
const pChance = (g: Game, base: number) => base * (1 + g.sector * 0.3 + g.loop * 0.2)

const column = (x: number, n = 6, mode = 0): Wave => (g) => {
  for (let i = 0; i < n; i++) g.later(i * 0.3, () => g.spawn(zako, x, -14, { a: mode, d: x, c: i * 0.7 }))
}
const swoop = (side: number, n = 6): Wave => (g) => {
  const x = side < 0 ? 46 : W - 46
  for (let i = 0; i < n; i++) g.later(i * 0.22, () => g.spawn(zako, x, -14, { a: 1, b: side < 0 ? 1 : -1, ang: Math.PI / 2 }))
}
const vee = (n = 5): Wave => (g) => {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 26
    g.later(Math.abs(off) / 200, () => g.spawn(dart, W / 2 + off, -14))
  }
}
const rain = (n = 8): Wave => (g) => {
  for (let i = 0; i < n; i++) g.later(i * 0.32, () => g.spawn(dart, rand(30, W - 30), -14))
}
const dives = (n = 6): Wave => (g) => {
  for (let i = 0; i < n; i++) g.later(i * 0.35, () => g.spawn(zako, rand(40, W - 40), -14, { a: 2 }))
}
const guns = (xs: number[], y = 110): Wave => (g) => {
  xs.forEach((x, i) =>
    g.later(i * 0.4, () => {
      const r = Math.random()
      g.spawn(gunship, x, -30, { c: -30, d: y + (i % 2) * 20, drop: r < pChance(g, 0.12) ? 'P' : r < 0.6 ? 'M' : null })
    }),
  )
}
const turrets = (xs: number[]): Wave => (g) => {
  xs.forEach((x, i) => g.later(i * 0.5, () => g.spawn(turret, x, -20, { drop: Math.random() < pChance(g, 0.1) ? 'P' : 'M' })))
}
const carrierW = (x = W / 2): Wave => (g) => {
  g.spawn(carrier, x, -50, { drop: 'P' })
}
const mines = (n = 6): Wave => (g) => {
  for (let i = 0; i < n; i++) g.later(i * 0.45, () => g.spawn(mine, rand(30, W - 30), -14))
}
const snipers = (n = 2): Wave => (g) => {
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1
    g.later(i * 0.7, () =>
      g.spawn(sniper, side < 0 ? -16 : W + 16, rand(40, 90), { b: side, d: side < 0 ? rand(40, 140) : rand(220, 320), c: rand(60, 150) }),
    )
  }
}
const weavers = (x: number, n = 8): Wave => (g) => {
  for (let i = 0; i < n; i++) g.later(i * 0.16, () => g.spawn(weaver, x, -14, { d: x, c: i }))
}
const supply = (side: number, y = 120): Wave => (g) => {
  g.spawn(itemShip, side < 0 ? -18 : W + 18, y, { b: side < 0 ? 1 : -1, d: y, drop: Math.random() < 0.22 ? 'B' : 'P' })
}
const midboss = (def: EnemyDef): Wave => (g) => {
  g.spawnMidboss(def, W / 2)
}
const both = (...ws: Wave[]): Wave => (g) => ws.forEach((w) => w(g))

// ===================== Sectores =====================

export const SECTORS: SectorDef[] = [
  {
    name: 'NEBULOSA CIAN',
    pal: { base: '#030a18', neb: ['#0ea5e9', '#22d3ee', '#6366f1'], star: '#a5f3fc', decor: 'planet' },
    tint: tintFrom('#f472b6', '#fde68a'),
    song: 's1',
    boss: VIGIA,
    script: [
      [0, column(90, 5)],
      [2.6, column(270, 5)],
      [3, swoop(-1, 6)],
      [3, swoop(1, 6)],
      [3.5, supply(-1, 120)],
      [2.5, guns([110, 250])],
      [5, vee(5)],
      [2.5, column(W / 2, 7)],
      [3.5, dives(6)],
      [3, guns([180], 100)],
      [2.5, swoop(-1, 6)],
      [2, swoop(1, 6)],
      [4, midboss(frigate)],
      [2, supply(1, 140)],
      [2.5, weavers(120, 8)],
      [3, weavers(240, 8)],
      [3.5, guns([90, 180, 270])],
      [4, dives(8)],
      [3, turrets([100, 260])],
      [3.5, both(swoop(-1, 7), swoop(1, 7))],
      [4, carrierW()],
      [6, vee(7)],
      [2.5, rain(8)],
    ],
  },
  {
    name: 'CINTURON MAGENTA',
    pal: { base: '#10041a', neb: ['#c026d3', '#db2777', '#7c3aed'], star: '#f5d0fe', decor: 'rocks' },
    tint: tintFrom('#38bdf8', '#fef08a'),
    song: 's2',
    boss: MANTIS,
    script: [
      [0, both(column(70, 6), column(290, 6))],
      [3.5, mines(6)],
      [3, swoop(-1, 7)],
      [2.2, swoop(1, 7)],
      [3, supply(1, 110)],
      [2.5, snipers(2)],
      [3, guns([90, 270])],
      [3.5, rain(10)],
      [3, both(dives(6), mines(4))],
      [4, turrets([80, 180, 280])],
      [3, midboss(sentinel)],
      [2, supply(-1, 130)],
      [2.5, weavers(110, 9)],
      [2.5, weavers(250, 9)],
      [3, snipers(3)],
      [3, guns([120, 240], 100)],
      [3, both(swoop(-1, 7), swoop(1, 7))],
      [4, carrierW(140)],
      [5, mines(8)],
      [3, vee(7)],
      [2.5, both(dives(8), snipers(2))],
    ],
  },
  {
    name: 'MAR DE PLASMA',
    pal: { base: '#0e0616', neb: ['#7c3aed', '#f97316', '#be185d'], star: '#fed7aa', decor: 'giant' },
    tint: tintFrom('#22d3ee', '#f0abfc'),
    song: 's3',
    boss: HIDRA,
    script: [
      [0, weavers(W / 2, 10)],
      [3, both(swoop(-1, 7), swoop(1, 7))],
      [3.5, turrets([90, 270])],
      [2.5, supply(-1, 110)],
      [2.5, guns([80, 180, 280])],
      [4, both(weavers(100, 8), weavers(260, 8))],
      [4, snipers(3)],
      [3, carrierW()],
      [5, rain(12)],
      [3, midboss(blade)],
      [2, supply(1, 120)],
      [2.5, both(column(80, 6), column(280, 6))],
      [3, turrets([70, 180, 290])],
      [3.5, mines(8)],
      [3, guns([120, 240])],
      [3, both(dives(8), weavers(W / 2, 8))],
      [4, both(snipers(2), vee(7))],
      [3.5, carrierW(110)],
      [5, both(swoop(-1, 8), swoop(1, 8))],
    ],
  },
  {
    name: 'ASTILLERO FANTASMA',
    pal: { base: '#03100e', neb: ['#14b8a6', '#059669', '#0e7490'], star: '#99f6e4', decor: 'wrecks' },
    tint: tintFrom('#fb7185', '#fde047'),
    song: 's4',
    boss: LEVIATAN,
    script: [
      [0, guns([100, 260])],
      [3, both(column(60, 7), column(300, 7))],
      [3.5, turrets([120, 240])],
      [2.5, supply(-1, 100)],
      [2, snipers(4)],
      [3.5, carrierW(120)],
      [2.5, carrierW(240)],
      [5, both(mines(6), rain(8))],
      [4, midboss(frigate)],
      [2, supply(1, 130)],
      [2.5, both(weavers(90, 9), weavers(270, 9))],
      [4, guns([70, 150, 210, 290])],
      [4, both(swoop(-1, 8), swoop(1, 8))],
      [3.5, turrets([60, 180, 300])],
      [3, both(snipers(3), dives(8))],
      [4, supply(-1, 120)],
      [2, carrierW()],
      [5, both(vee(9), mines(6))],
    ],
  },
  {
    name: 'TORMENTA SOLAR',
    pal: { base: '#140604', neb: ['#ea580c', '#dc2626', '#f59e0b'], star: '#fde68a', decor: 'sun' },
    tint: tintFrom('#a78bfa', '#67e8f9'),
    song: 's5',
    boss: HELIOS,
    script: [
      [0, both(swoop(-1, 8), swoop(1, 8))],
      [3, rain(12)],
      [3, guns([90, 180, 270])],
      [3, supply(1, 110)],
      [2.5, both(turrets([80, 280]), mines(6))],
      [4, both(weavers(120, 10), weavers(240, 10))],
      [4, snipers(4)],
      [3, carrierW()],
      [4.5, midboss(sentinel)],
      [2, supply(-1, 120)],
      [2.5, both(dives(10), vee(7))],
      [4, guns([70, 140, 220, 290])],
      [4, turrets([60, 180, 300])],
      [3, both(column(70, 8), column(290, 8), snipers(2))],
      [4.5, carrierW(110)],
      [2, carrierW(250)],
      [4, supply(1, 120)],
      [2, both(swoop(-1, 9), swoop(1, 9), mines(6))],
    ],
  },
  {
    name: 'CORAZON DEL VACIO',
    pal: { base: '#07030f', neb: ['#6d28d9', '#a21caf', '#312e81'], star: '#e9d5ff', decor: 'void' },
    tint: tintFrom('#f0abfc', '#fef08a'),
    song: 's6',
    boss: NEXO,
    script: [
      [0, both(column(60, 8), column(300, 8))],
      [3, both(snipers(2), mines(6))],
      [3.5, guns([90, 180, 270])],
      [3, supply(-1, 110)],
      [2, both(weavers(100, 10), weavers(260, 10))],
      [4, both(turrets([70, 290]), rain(10))],
      [4, carrierW()],
      [4, both(swoop(-1, 9), swoop(1, 9))],
      [4, midboss(blade)],
      [2, supply(1, 120)],
      [2.5, both(snipers(4), dives(8))],
      [4, guns([60, 130, 230, 300])],
      [4, both(turrets([60, 180, 300]), mines(8))],
      [4.5, both(carrierW(110), carrierW(250))],
      [5, supply(-1, 120)],
      [2, both(vee(9), rain(10), snipers(2))],
    ],
  },
]

export function sectorFor(i: number): SectorDef {
  return SECTORS[((i % SECTORS.length) + SECTORS.length) % SECTORS.length]
}
