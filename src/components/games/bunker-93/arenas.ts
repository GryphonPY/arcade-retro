/**
 * Las tres arenas diseñadas a mano. Leyenda de la rejilla:
 *  #  muro principal        =  muro secundario (decorado)
 *  D  compuerta blindada    o  columna técnica
 *  V  tanque de cultivo     c  caja baja (no tapa la vista)
 *  O  borde del reactor (bajo, brilla)
 *  .  suelo   ,  suelo decorado   ~  suelo tóxico (brilla)
 *  S  punto de aparición    P  inicio del jugador   B  jefe
 *  b  barril explosivo      L  lámpara de techo     R  luz de alarma
 */
import { T } from './textures'

export type ArenaId = 'hangar' | 'lab' | 'reactor'

export interface ArenaDef {
  id: ArenaId
  name: string
  /** Nombre en mayúsculas sin acentos para la fuente pixel. */
  label: string
  map: string[]
  ceil: number
  wall: number
  wall2: number
  floor: number
  floor2: number
  ceilTile: number
  ambient: [number, number, number]
  lamp: [number, number, number]
  fog: number
  fogDensity: number
  bossName: string
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'hangar',
    name: 'Hangar',
    label: 'SECTOR 1: HANGAR',
    ceil: 3.2,
    wall: T.METAL,
    wall2: T.METAL_STRIPE,
    floor: T.HANGAR_FLOOR,
    floor2: T.FLOOR_LINE,
    ceilTile: T.CEIL_PANEL,
    ambient: [0.4, 0.4, 0.46],
    lamp: [1.0, 0.92, 0.75],
    fog: 0x07080c,
    fogDensity: 0.042,
    bossName: 'COLOSO',
    map: [
      '##############################',
      '#S.......#####DD#####.......S#',
      '#..b.....=..........=.....b..#',
      '#....cc..=....L.....=..cc....#',
      '#....cc.......,,.........L...#',
      '#..L..........,,.............#',
      '###=....o.....,,.....o....=###',
      '#S......................b...S#',
      '#....,,,,,,,,,,,,,,,,,,,,....#',
      '#..c.....R....B.....R....c...#',
      '#..c....o...........o....c...#',
      '#............................#',
      'D......b.....L........b......D',
      '#............................#',
      '#..c....o....,,.....o....c...#',
      '#..c.....R...,,.....R....c...#',
      '#....,,,,,,,,,,,,,,,,,,,,....#',
      '#S......b..............b....S#',
      '###=....o.....P.....o....=####',
      '#..L.........................#',
      '#....cc..=..........=..cc..L.#',
      '#..b.....=..........=.....b..#',
      '#S.......#####DD#####.......S#',
      '##############################',
    ],
  },
  {
    id: 'lab',
    name: 'Laboratorio',
    label: 'SECTOR 2: LABORATORIO',
    ceil: 2.8,
    wall: T.LAB_WALL,
    wall2: T.LAB_WALL2,
    floor: T.LAB_FLOOR,
    floor2: T.GRATE,
    ceilTile: T.LAB_CEIL,
    ambient: [0.36, 0.42, 0.4],
    lamp: [0.8, 1.0, 0.9],
    fog: 0x050a08,
    fogDensity: 0.045,
    bossName: 'CENTINELA',
    map: [
      '##############################',
      '#S...=====....DD...=====...S.#',
      '#....=V..=.........=..V=.....#',
      '#.b..=...=..L...L..=...=..b..#',
      '#....==.==.........==.==.....#',
      '#..........,,,,,,,,..........#',
      '#=====.......~~..........====#',
      '#....=..V...~~~~~~...V...=...#',
      '#.L..=......~~~~~~.......=.L.#',
      '#....=........B..........=...#',
      '#S........o.........o.......S#',
      'D....=...................=...D',
      '#.b..=......cc..cc.......=.b.#',
      '#....=...................=...#',
      '#=====....V........V.....====#',
      '#..........,,,,,,,,..........#',
      '#..L..===....P.....===...L...#',
      '#.....=V=....c..c..=V=.......#',
      '#....................b.......#',
      '#S...b...L.........L......S..#',
      '##############################',
    ],
  },
  {
    id: 'reactor',
    name: 'Reactor',
    label: 'SECTOR 3: REACTOR',
    ceil: 3.6,
    wall: T.REACTOR_WALL,
    wall2: T.REACTOR_WALL2,
    floor: T.REACTOR_FLOOR,
    floor2: T.GRATE,
    ceilTile: T.CEIL_PANEL,
    ambient: [0.44, 0.32, 0.28],
    lamp: [1.0, 0.75, 0.5],
    fog: 0x0c0504,
    fogDensity: 0.04,
    bossName: 'NUCLEO',
    map: [
      '##############################',
      '######......#DD#......########',
      '####S.........,.........S#####',
      '###.....L...........L.......##',
      '##..b......o......o......b...#',
      '#.......,,,,,,,,,,,,,,.......#',
      '#....o..,............,..o....#',
      '#.......,....OOOO....,.......#',
      '#S......,...OOOOOO...,......S#',
      'D...R...,...OOOOOO...,...R...D',
      '#.......,...OOOOOO...,.......#',
      '#.......,....OOOO....,.......#',
      '#....o..,............,..o....#',
      '#.......,,,,,,,,,,,,,,.......#',
      '##..b......o......o......b..##',
      '###.....L.....P.....L.....####',
      '####S...................S#####',
      '######......#DD#......########',
      '##############################',
    ],
  },
]

/** Celdas que bloquean el movimiento. */
export function isSolidChar(ch: string): boolean {
  return ch === '#' || ch === '=' || ch === 'D' || ch === 'o' || ch === 'V' || ch === 'c' || ch === 'O' || ch === ' '
}

/** Celdas que tapan la línea de visión y las balas (muros completos). */
export function isOpaqueChar(ch: string): boolean {
  return ch === '#' || ch === '=' || ch === 'D' || ch === 'o' || ch === 'V' || ch === ' '
}
