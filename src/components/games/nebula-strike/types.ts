/** Tipos de entidades de Nebula Strike (pools sin asignaciones por frame). */
import type { Sprite } from './sprites'
import type { Game } from './game'

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  /** Radio de colisión. */
  r: number
  /** Índice de sprite (forma * NCOL + color). */
  spr: number
  rot: boolean
  /** Aceleración a lo largo de la dirección (px/s²). */
  acc: number
  /** Giro (rad/s). */
  turn: number
  /** Límites de rapidez cuando hay aceleración. */
  minV: number
  maxV: number
  life: number
  /** Espera antes de moverse (aparece con destello). */
  delay: number
  grazed: boolean
  /** >0: segundos hasta dividirse en anillo. */
  split: number
  splitN: number
  splitSpr: number
  splitV: number
}

export interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  r: number
  spr: Sprite
  /** 0 normal, 1 misil, 2 dron, 3 trasero. */
  kind: number
  target: Enemy | null
  life: number
  pierce: number
  ang: number
}

export type Drop = 'P' | 'B' | 'M' | 'M3' | null

export interface EnemyDef {
  id: string
  hp: number
  r: number
  score: number
  /** Tamaño de la explosión: 0 chica, 1 media, 2 grande. */
  size: number
  sprite(g: Game, e: Enemy): Sprite
  update(g: Game, e: Enemy, dt: number): void
  onDeath?(g: Game, e: Enemy): void
  /** Rota el sprite con e.ang. */
  rotates?: boolean
  /** No cuenta para la cadena ni da puntos de muerte (piezas de jefe muertas aparte). */
  noChain?: boolean
}

export interface Enemy {
  alive: boolean
  def: EnemyDef
  x: number
  y: number
  vx: number
  vy: number
  t: number
  hp: number
  maxHp: number
  r: number
  flash: number
  score: number
  drop: Drop
  fireT: number
  fireN: number
  /** Parámetros libres de comportamiento. */
  a: number
  b: number
  c: number
  d: number
  ang: number
  /** Multiplicador de daño recibido (0 = invulnerable). */
  armor: number
  /** Jefe al que pertenece (núcleo o pieza). */
  boss: Boss | null
  partIndex: number
  /** Ya entró en pantalla (para no matarlo al salir antes de entrar). */
  seen: boolean
  /** Semilla visual. */
  seed: number
}

export interface Item {
  alive: boolean
  kind: 'P' | 'B' | 'M' | '1UP'
  x: number
  y: number
  vx: number
  vy: number
  t: number
  /** Atraído hacia el jugador. */
  pull: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  /** 0 cuadro, 1 brillo (sprite aditivo), 2 chispa (línea), 3 anillo, 4 escombro rotando. */
  kind: number
  color: string
  spr: Sprite | null
  drag: number
  grow: number
  rot: number
}

export interface Beam {
  x: number
  y: number
  ang: number
  w: number
  /** Tiempo de aviso (línea fina) antes de activarse. */
  warn: number
  /** Duración activa. */
  dur: number
  t: number
  color: number
  /** Sigue al dueño (x relativo). */
  owner: Enemy | null
  ox: number
  oy: number
  /** Velocidad angular. */
  spin: number
}

export interface BossPhase {
  /** Fracción de vida del núcleo a la que termina esta fase. */
  until: number
  update(g: Game, b: Boss, dt: number): void
}

export interface BossPartDef {
  ox: number
  oy: number
  r: number
  hp: number
  sprite(g: Game, b: Boss): Sprite
  /** Se destruye al cambiar a esta fase (o nunca). */
  score: number
}

export interface BossDef {
  name: string
  title: string
  hp: number
  r: number
  /** Desplazamiento del área de impacto del núcleo respecto al centro. */
  coreY: number
  sprite(g: Game, b: Boss): Sprite
  parts: BossPartDef[]
  phases: BossPhase[]
  /** Dibujo extra (brillos animados) sobre el cuerpo. */
  overlay?(ctx: CanvasRenderingContext2D, g: Game, b: Boss): void
  enterY: number
}

export interface Boss {
  def: BossDef
  x: number
  y: number
  t: number
  phase: number
  phaseT: number
  core: Enemy
  parts: Enemy[]
  timers: number[]
  state: 'enter' | 'fight' | 'trans' | 'dying'
  stateT: number
  tx: number
  ty: number
  /** Variable de patrón libre (ángulo de espiral, etc.). */
  spin: number
  spin2: number
  mid: boolean
  hpShown: number
  deathT: number
  count: number
}
