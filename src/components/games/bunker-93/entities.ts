/** Tipos de las entidades de la partida. */
import type { EnemyDef, EnemyKind, WeaponId } from './defs'

export type EnemyState = 'warp' | 'move' | 'windup' | 'attack' | 'pain' | 'charge' | 'stun' | 'roar' | 'dead'

export interface Enemy {
  id: number
  def: EnemyDef
  kind: EnemyKind
  x: number
  z: number
  y: number
  /** velocidad de empuje (retroceso) */
  kx: number
  kz: number
  /** dirección de movimiento suavizada */
  dx: number
  dz: number
  hp: number
  maxHp: number
  elite: boolean
  speedMul: number
  dmgMul: number
  state: EnemyState
  t: number
  anim: number
  atkCd: number
  /** sentido de rodeo (+1/-1) */
  strafe: number
  strafeT: number
  los: boolean
  losT: number
  deathT: number
  gibbed: boolean
  flash: number
  /** ataque en curso (para jefes con varios) */
  move: number
  /** fase del jefe */
  phase: number
  patT: number
  subT: number
  spin: number
  shield: boolean
  chargeX: number
  chargeZ: number
  lastHitBy: WeaponId | null
  moving: number
  growlT: number
}

export type ProjKind = 'rocket' | 'plasma' | 'bullet' | 'acid' | 'rock' | 'missile' | 'orb' | 'mini'

export interface Proj {
  kind: ProjKind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  fromPlayer: boolean
  dmg: number
  splash: number
  splashR: number
  life: number
  bounces: number
  homing: number
  r: number
  trailT: number
  gravity: number
  weapon: WeaponId | null
  counted: boolean
}

export type PickupKind = 'medkit' | 'stim' | 'shard' | 'vest' | 'bullets' | 'shells' | 'rockets' | 'cells'

export interface Pickup {
  kind: PickupKind
  x: number
  z: number
  y: number
  vy: number
  t: number
}

export interface Barrel {
  x: number
  z: number
  hp: number
  alive: boolean
  fuse: number
  flash: number
}

export interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  frame: number
  size: number
  r: number
  g: number
  b: number
  full: number
  grav: number
  /** deja mancha de sangre al tocar el suelo */
  stain: boolean
}

export interface Decal {
  x: number
  z: number
  frame: number
  size: number
  full: number
  life: number
}

export interface Fx {
  x: number
  y: number
  z: number
  frames: number[]
  t: number
  dur: number
  size: number
  full: boolean
  light: number
}

export interface Floater {
  x: number
  y: number
  z: number
  text: string
  color: string
  t: number
  big: boolean
}
