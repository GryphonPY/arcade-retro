/**
 * Motor de Nebula Strike: estado de la partida, pools de entidades,
 * colisiones, puntuación, progresión y flujo de sectores.
 *
 * Dos jugadores (`coop`): las naves son `player` (J1) y `p2` (J2). Son del
 * equipo: vidas, bombas, mejoras, puntuación y cadena. Por nave: nivel de
 * arma, estado de vida y los drones que eligió (ver `Drone`).
 */
import { Juice } from '../juice'
import { fx, laserHum } from './audio'
import { playSong, duckMusic } from './soundtrack'
import { Background } from './background'
import { SECTORS, sectorFor } from './sectors'
import { bossUpdate, spawnBoss, bossPartDestroyed } from './bosses'
import { SHIPS, fireWeapons, laserStats, shipColorOf, updateDrones } from './ships'
import { rollUpgrades, UP_BY_ID, type UpId, type UpgradeDef } from './upgrades'
import { BCOL, SHAPE_R, SHAPE_ROT, NCOL, glow, type Sprite } from './sprites'
import type { Beam, Boss, Bullet, Drop, Enemy, EnemyDef, Item, Particle, Shot } from './types'
import { H, TAU, W, angDiff, clamp, rand } from './util'

export type Mode = 'title' | 'intro' | 'play' | 'warning' | 'boss' | 'bossdeath' | 'clear' | 'upgrade' | 'warp' | 'dead' | 'over'

/** Controles de un jugador en un frame. */
export interface Pad {
  /** Dirección por teclado (-1..1). */
  mx: number
  my: number
  /** Desplazamiento relativo acumulado (táctil), en px lógicos. */
  dx: number
  dy: number
  /** Objetivo absoluto (ratón con clic mantenido). */
  follow: boolean
  fx: number
  fy: number
  /** Modo concentrado (mantenido). */
  focus: boolean
  /** Bomba pedida en este frame. */
  bomb: boolean
  /** Pulsaciones de menú en este frame. */
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  confirm: boolean
}

export function emptyPad(): Pad {
  return { mx: 0, my: 0, dx: 0, dy: 0, follow: false, fx: 0, fy: 0, focus: false, bomb: false, left: false, right: false, up: false, down: false, confirm: false }
}

export interface Input {
  /** Controles de J1 (0) y J2 (1; solo en cooperativo). */
  pads: [Pad, Pad]
  /** Alguna acción de menú (para avanzar en resúmenes). */
  confirm: boolean
  back: boolean
  /** Toques/clics en coordenadas lógicas (menús). */
  taps: { x: number; y: number }[]
}

export interface Player {
  /** 0 = J1, 1 = J2. */
  idx: number
  shipId: number
  /** Nivel de arma de esta nave. */
  power: number
  x: number
  y: number
  vx: number
  bank: number
  alive: boolean
  inv: number
  respawnT: number
  /** Sin vidas para revivir (solo cooperativo): fuera del resto del run. */
  out: boolean
  focus: boolean
  fireT: number
  missileT: number
  droneT: number
  rearT: number
  laser: boolean
  laserTop: number
  /** Golpea un enemigo con el láser en este frame. */
  hitting: boolean
  droneAng: number
  shield: number
  trailX: Float32Array
  trailY: Float32Array
  trailI: number
  entering: number
}

/** Dron de apoyo. `owner` es quien lo eligió; `host`, quien lo sostiene ahora. */
export interface Drone {
  x: number
  y: number
  owner: number
  host: number
}

export interface Diff {
  lvl: number
  bs: number
  dens: number
  hp: number
  rate: number
  revenge: boolean
}

export interface BulletOpts {
  acc?: number
  turn?: number
  minV?: number
  maxV?: number
  delay?: number
  split?: number
  splitN?: number
  splitSpr?: number
  splitV?: number
}

export interface RunResult {
  score: number
  sector: string
  kills: number
  graze: number
  /** Nombre de la nave, o "ARCO + TITAN" en cooperativo. */
  ship: string
  maxChain: number
  /** Partida de 2 jugadores: no se guarda como récord ni va al ranking. */
  coop: boolean
}

const MAX_BULLETS = 1600
const MAX_SHOTS = 420
const MAX_ENEMIES = 128
const MAX_ITEMS = 80
const MAX_PARTS = 1100
const MEDAL_VALUES = [100, 200, 300, 500, 800, 1000, 2000, 3000, 5000, 8000, 10000]
const EXTENDS = [1_000_000, 3_000_000, 6_000_000, 10_000_000]
const HIT_R = 2.2

/** Cooperativo: vidas compartidas, revivir a los 3 s, enemigos y jefes +40% de vida. */
export const COOP_LIVES = 4
const COOP_RESPAWN = 3
const COOP_HP = 1.4

function newBullet(): Bullet {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 2, spr: 0, rot: false, acc: 0, turn: 0, minV: 0, maxV: 0, life: 0, delay: 0, grazed: false, split: 0, splitN: 0, splitSpr: 0, splitV: 0 }
}
function newShot(): Shot {
  return { x: 0, y: 0, vx: 0, vy: 0, dmg: 1, r: 4, spr: null as unknown as Sprite, kind: 0, target: null, life: 0, pierce: 0, ang: 0 }
}
function newPart(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, kind: 0, color: '#fff', spr: null, drag: 0, grow: 0, rot: 0 }
}
function newPlayer(idx: number): Player {
  return {
    idx,
    shipId: idx,
    power: 1,
    x: W / 2,
    y: H - 70,
    vx: 0,
    bank: 0,
    alive: idx === 0,
    inv: 0,
    respawnT: 0,
    out: false,
    focus: false,
    fireT: 0,
    missileT: 0,
    droneT: 0,
    rearT: 0,
    laser: false,
    laserTop: 0,
    hitting: false,
    droneAng: 0,
    shield: 0,
    trailX: new Float32Array(14),
    trailY: new Float32Array(14),
    trailI: 0,
    entering: 0,
  }
}
const NULL_DEF: EnemyDef = {
  id: 'none',
  hp: 1,
  r: 1,
  score: 0,
  size: 0,
  sprite: () => glow('#ffffff', 4),
  update: () => {},
}
function newEnemy(): Enemy {
  return { alive: false, def: NULL_DEF, x: 0, y: 0, vx: 0, vy: 0, t: 0, hp: 1, maxHp: 1, r: 8, flash: 0, score: 0, drop: null, fireT: 0, fireN: 0, a: 0, b: 0, c: 0, d: 0, ang: 0, armor: 1, boss: null, partIndex: -1, seen: false, seed: 0 }
}

export function makeDiff(sector: number, loop: number): Diff {
  const l = sector + loop * 6
  return {
    lvl: l,
    bs: Math.min(1.7, 0.84 + 0.07 * l),
    dens: Math.min(2.4, 0.8 + 0.13 * l),
    hp: 1 + 0.34 * l,
    rate: Math.min(2.1, 0.82 + 0.09 * l),
    revenge: loop > 0,
  }
}

export class Game {
  juice = new Juice(9)
  bg = new Background()

  mode: Mode = 'title'
  modeT = 0
  paused = false
  time = 0

  /** Partida o pantalla de título en modo de 2 jugadores. */
  coop = false
  /** Modo elegido en el título: 1 o 2 jugadores. */
  titleMode: 1 | 2 = 1
  /** Modo táctil del título en 2 jugadores: qué jugador elige con el siguiente toque. */
  titlePick = 0
  titleSel = 0
  titleSel2 = 1
  sector = 0
  loop = 0
  diff: Diff = makeDiff(0, 0)

  score = 0
  scoreShown = 0
  hi = 0
  /** Vidas del equipo. */
  lives = 3
  /** Bombas del equipo. */
  bombs = 3
  bombMax = 3
  powerCap = 4
  chain = 0
  chainT = 0
  maxChain = 0
  mult = 1
  grazeCount = 0
  grazeStreak = 0
  grazeStreakT = 0
  grazeBank = 0
  kills = 0
  medalIdx = 0
  extendIdx = 0
  sectorHit = false
  sectorKills = 0
  sectorGraze = 0
  sectorsCleared = 0
  bossTime = 0
  /** Mejoras del equipo (el efecto es compartido). */
  build: Record<string, number> = {}
  buildOrder: UpId[] = []

  /** J1. */
  player: Player = newPlayer(0)
  /** J2 (solo en cooperativo). */
  p2: Player = newPlayer(1)
  private solo: Player[] = []
  private pair: Player[] = []
  drones: Drone[] = []

  bullets: Bullet[] = Array.from({ length: MAX_BULLETS }, newBullet)
  nb = 0
  shots: Shot[] = Array.from({ length: MAX_SHOTS }, newShot)
  ns = 0
  enemies: Enemy[] = Array.from({ length: MAX_ENEMIES }, newEnemy)
  items: Item[] = Array.from({ length: MAX_ITEMS }, () => ({ alive: false, kind: 'P' as const, x: 0, y: 0, vx: 0, vy: 0, t: 0, pull: false }))
  parts: Particle[] = Array.from({ length: MAX_PARTS }, newPart)
  np = 0
  beams: Beam[] = []

  boss: Boss | null = null
  midboss: Enemy | null = null
  scriptIdx = 0
  scriptT = 0
  hold: Enemy | null = null
  holdT = 0
  pending: { t: number; fn: () => void }[] = []

  bombT = 0
  bombDur = 0
  bombX = 0
  bombY = 0

  slowT = 0
  slowK = 1

  choices: UpgradeDef[] = []
  sel = 0
  /** Jugador que elige en la pantalla de mejoras (0 = J1, 1 = J2). */
  chooser = 0
  menuLock = 0
  tally: { label: string; value: number }[] = []
  bannerT = 0
  banner = ''
  bannerSub = ''
  laserHitY = 0
  laserHitting = false

  onOver: ((r: RunResult) => void) | null = null
  onModeChange: ((m: Mode) => void) | null = null

  constructor() {
    this.solo = [this.player]
    this.pair = [this.player, this.p2]
    this.bg.setSector(0, 0)
  }

  // ===================== Naves =====================

  /** Naves en juego: una, o dos en cooperativo. */
  get ships(): Player[] {
    return this.coop ? this.pair : this.solo
  }

  /** Nave de J1 (compatibilidad con el código de un jugador). */
  get shipId(): number {
    return this.player.shipId
  }

  firstAlive(): Player | null {
    for (const s of this.ships) if (s.alive) return s
    return null
  }

  /** Nave viva más cercana a un punto, o null si no hay ninguna. */
  nearestAlive(x: number, y: number): Player | null {
    let best: Player | null = null
    let bd = Infinity
    for (const s of this.ships) {
      if (!s.alive) continue
      const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    return best
  }

  /** Nave más cercana a un punto (J1 si no hay ninguna viva). */
  nearest(x: number, y: number): Player {
    return this.nearestAlive(x, y) ?? this.player
  }

  /** Índice de la nave que recibe un toque en (x, y), para el control táctil. */
  pickShip(x: number, y: number): number {
    if (!this.coop) return 0
    return this.nearestAlive(x, y)?.idx ?? 0
  }

  /** Multiplicador de vida de enemigos y jefes. */
  hpK(): number {
    return this.coop ? COOP_HP : 1
  }

  // ===================== Utilidades =====================

  up(id: UpId): number {
    return this.build[id] ?? 0
  }

  setMode(m: Mode) {
    this.mode = m
    this.modeT = 0
    this.onModeChange?.(m)
  }

  get sectorLabel(): string {
    return this.loop > 0 ? `${this.loop + 1}-${this.sector + 1}` : `${this.sector + 1}`
  }

  /** Escala un conteo de balas con la densidad del sector. */
  n(base: number, min = 1): number {
    return Math.max(min, Math.round(base * this.diff.dens))
  }

  aim(x: number, y: number): number {
    const p = this.nearest(x, y)
    return Math.atan2(p.y - y, p.x - x)
  }

  later(t: number, fn: () => void) {
    this.pending.push({ t, fn })
  }

  // ===================== Arranque =====================

  toTitle() {
    this.clearWorld()
    this.coop = this.titleMode === 2
    const p = this.player
    p.shipId = this.titleSel
    p.x = W / 2 - (this.coop ? 62 : 0)
    p.y = 300
    p.alive = true
    p.out = false
    p.power = 2
    const q = this.p2
    q.shipId = this.titleSel2
    q.x = W / 2 + 62
    q.y = 300
    q.alive = this.coop
    q.out = false
    q.power = 2
    this.build = {}
    this.drones = []
    this.bg.setSector(0, 0)
    this.setMode('title')
    playSong('title')
  }

  clearWorld() {
    this.nb = 0
    this.ns = 0
    this.np = 0
    for (const e of this.enemies) e.alive = false
    for (const it of this.items) it.alive = false
    this.beams.length = 0
    this.pending.length = 0
    this.boss = null
    this.midboss = null
    this.hold = null
    this.bombT = 0
    this.slowT = 0
    this.juice.reset()
    laserHum(false)
  }

  private initShip(p: Player, shipId: number, x: number, alive: boolean) {
    p.shipId = shipId
    p.power = 1
    p.alive = alive
    p.out = false
    p.x = x
    p.y = H + 30
    p.inv = 0
    p.shield = 0
    p.fireT = p.missileT = p.droneT = p.rearT = 0
    p.laser = false
    p.hitting = false
    p.focus = false
    p.respawnT = 0
    p.entering = 1.2
    for (let i = 0; i < p.trailX.length; i++) {
      p.trailX[i] = p.x
      p.trailY[i] = p.y
    }
  }

  startRun(ship: number) {
    this.clearWorld()
    this.coop = this.titleMode === 2
    this.titleSel = ship
    const s = SHIPS[ship]
    const s2 = SHIPS[this.titleSel2]
    this.score = 0
    this.scoreShown = 0
    this.lives = this.coop ? COOP_LIVES : 3
    this.bombMax = this.coop ? Math.max(s.bombs, s2.bombs) + 1 : s.bombs
    this.bombs = this.bombMax
    this.powerCap = 4
    this.chain = 0
    this.chainT = 0
    this.maxChain = 0
    this.mult = 1
    this.grazeCount = 0
    this.grazeBank = 0
    this.kills = 0
    this.medalIdx = 0
    this.extendIdx = 0
    this.build = {}
    this.buildOrder = []
    this.drones = []
    this.sector = 0
    this.loop = 0
    this.sectorsCleared = 0
    this.chooser = 0
    this.initShip(this.player, ship, this.coop ? W / 2 - 40 : W / 2, true)
    this.initShip(this.p2, this.titleSel2, W / 2 + 40, this.coop)
    fx.launch()
    this.startSector()
  }

  startSector() {
    this.diff = makeDiff(this.sector, this.loop)
    this.bg.setSector(this.sector, this.loop)
    this.scriptIdx = 0
    this.scriptT = this.sectorsCleared === 0 ? 4.2 : 2.6
    this.hold = null
    this.sectorHit = false
    this.sectorKills = 0
    this.sectorGraze = 0
    for (const s of this.ships) s.shield = this.up('shield')
    const def = SECTORS[this.sector]
    this.showBanner(`SECTOR ${this.sectorLabel}`, def.name, 3)
    this.setMode('intro')
    playSong(def.song, this.loop > 0 ? 1.06 : 1)
  }

  showBanner(t: string, sub: string, dur: number) {
    this.banner = t
    this.bannerSub = sub
    this.bannerT = dur
  }

  // ===================== Spawns =====================

  spawn(def: EnemyDef, x: number, y: number, init?: Partial<Enemy>): Enemy | null {
    let e: Enemy | null = null
    for (const c of this.enemies)
      if (!c.alive) {
        e = c
        break
      }
    if (!e) return null
    e.alive = true
    e.def = def
    e.x = x
    e.y = y
    e.vx = 0
    e.vy = 0
    e.t = 0
    e.maxHp = e.hp = def.hp * this.diff.hp * this.hpK()
    e.r = def.r
    e.flash = 0
    e.score = def.score
    e.drop = null
    e.fireT = 0
    e.fireN = 0
    e.a = e.b = e.c = e.d = 0
    e.ang = Math.PI / 2
    e.armor = 1
    e.boss = null
    e.partIndex = -1
    e.seen = false
    e.seed = Math.random()
    if (init) Object.assign(e, init)
    if (init?.hp !== undefined) e.maxHp = e.hp
    return e
  }

  bullet(x: number, y: number, ang: number, spd: number, spr: number, o?: BulletOpts): Bullet | null {
    if (this.nb >= MAX_BULLETS || this.mode === 'bossdeath' || this.mode === 'clear') return null
    const b = this.bullets[this.nb++]
    const v = spd * this.diff.bs
    b.x = x
    b.y = y
    b.vx = Math.cos(ang) * v
    b.vy = Math.sin(ang) * v
    const shape = Math.floor(spr / NCOL)
    b.r = SHAPE_R[shape]
    b.rot = SHAPE_ROT[shape]
    b.spr = spr
    b.acc = o?.acc ?? 0
    b.turn = o?.turn ?? 0
    b.minV = (o?.minV ?? 0) * this.diff.bs
    b.maxV = (o?.maxV ?? 9999) * this.diff.bs
    b.life = 0
    b.delay = o?.delay ?? 0
    b.grazed = false
    b.split = o?.split ?? 0
    b.splitN = o?.splitN ?? 0
    b.splitSpr = o?.splitSpr ?? spr
    b.splitV = o?.splitV ?? 90
    return b
  }

  ring(x: number, y: number, n: number, spd: number, off: number, spr: number, o?: BulletOpts) {
    for (let i = 0; i < n; i++) this.bullet(x, y, off + (i * TAU) / n, spd, spr, o)
  }

  fan(x: number, y: number, n: number, spread: number, spd: number, ang: number, spr: number, o?: BulletOpts) {
    if (n === 1) {
      this.bullet(x, y, ang, spd, spr, o)
      return
    }
    for (let i = 0; i < n; i++) this.bullet(x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, spr, o)
  }

  shot(x: number, y: number, ang: number, spd: number, dmg: number, spr: Sprite, kind: number): Shot | null {
    if (this.ns >= MAX_SHOTS) return null
    const s = this.shots[this.ns++]
    s.x = x
    s.y = y
    s.vx = Math.cos(ang) * spd
    s.vy = Math.sin(ang) * spd
    s.ang = ang
    s.dmg = dmg
    s.spr = spr
    s.kind = kind
    s.r = kind === 1 ? 5 : 4
    s.target = null
    s.life = 0
    s.pierce = this.up('pierce') && kind === 0 ? 1 : 0
    return s
  }

  beam(x: number, y: number, ang: number, w: number, warn: number, dur: number, color: number, owner: Enemy | null = null, spin = 0): Beam {
    const b: Beam = { x, y, ang, w, warn, dur, t: 0, color, owner, ox: owner ? x - owner.x : 0, oy: owner ? y - owner.y : 0, spin }
    this.beams.push(b)
    return b
  }

  item(kind: Item['kind'], x: number, y: number) {
    for (const it of this.items) {
      if (it.alive) continue
      it.alive = true
      it.kind = kind
      it.x = clamp(x, 12, W - 12)
      it.y = y
      it.vx = rand(-30, 30)
      it.vy = kind === 'M' ? -80 : -60
      it.t = 0
      it.pull = false
      return
    }
  }

  dropItems(d: Drop, x: number, y: number) {
    if (d === 'P') this.item('P', x, y)
    else if (d === 'B') this.item('B', x, y)
    else if (d === 'M') this.item('M', x, y)
    else if (d === 'M3') {
      this.item('M', x - 10, y)
      this.item('M', x + 10, y)
      this.item('M', x, y - 10)
    }
  }

  // ===================== Partículas =====================

  part(): Particle {
    if (this.np < MAX_PARTS) return this.parts[this.np++]
    return this.parts[(Math.random() * MAX_PARTS) | 0]
  }

  sparks(x: number, y: number, color: string, n: number, spd: number, life = 0.35, ang = 0, arc = TAU) {
    for (let i = 0; i < n; i++) {
      const p = this.part()
      const a = ang + (Math.random() - 0.5) * arc
      const v = spd * (0.4 + Math.random() * 0.8)
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * v
      p.vy = Math.sin(a) * v
      p.life = p.max = life * (0.6 + Math.random() * 0.7)
      p.size = 1.2 + Math.random() * 1.2
      p.kind = 2
      p.color = color
      p.spr = null
      p.drag = 3
      p.grow = 0
    }
  }

  puff(x: number, y: number, color: string, r: number, life: number, vx = 0, vy = 0, grow = 0) {
    const p = this.part()
    p.x = x
    p.y = y
    p.vx = vx
    p.vy = vy
    p.life = p.max = life
    p.size = 1
    p.kind = 1
    p.color = color
    p.spr = glow(color, Math.max(4, Math.round(r / 4) * 4), 0.15)
    p.drag = 2
    p.grow = grow
  }

  shock(x: number, y: number, color: string, r0: number, grow: number, life: number, width = 3) {
    const p = this.part()
    p.x = x
    p.y = y
    p.vx = 0
    p.vy = 0
    p.life = p.max = life
    p.size = r0
    p.kind = 3
    p.color = color
    p.spr = null
    p.drag = width
    p.grow = grow
  }

  debris(x: number, y: number, color: string, n: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const p = this.part()
      const a = Math.random() * TAU
      const v = spd * (0.3 + Math.random())
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * v
      p.vy = Math.sin(a) * v
      p.life = p.max = 0.6 + Math.random() * 0.8
      p.size = 2 + Math.random() * 3
      p.kind = 4
      p.color = color
      p.spr = null
      p.drag = 1.2
      p.grow = (Math.random() - 0.5) * 14
      p.rot = Math.random() * TAU
    }
  }

  explode(x: number, y: number, size: number, color: string) {
    if (size === 0) {
      this.puff(x, y, color, 22, 0.3, 0, 0, 1.5)
      this.puff(x, y, '#ffffff', 10, 0.12)
      this.sparks(x, y, color, 8, 160)
      this.sparks(x, y, '#ffffff', 3, 120)
      fx.pop()
    } else if (size === 1) {
      this.puff(x, y, '#ffffff', 26, 0.18)
      this.puff(x, y, color, 44, 0.45, 0, 0, 1.2)
      for (let i = 0; i < 4; i++) this.puff(x + rand(-12, 12), y + rand(-12, 12), '#fb923c', 24, 0.5, rand(-30, 30), rand(-30, 30), 0.8)
      this.sparks(x, y, color, 16, 240, 0.5)
      this.sparks(x, y, '#fde68a', 8, 200, 0.4)
      this.debris(x, y, color, 6, 140)
      this.shock(x, y, color, 6, 160, 0.35, 2.5)
      this.juice.shake(0.18)
      fx.boom()
    } else {
      this.puff(x, y, '#ffffff', 60, 0.25)
      this.puff(x, y, color, 90, 0.7, 0, 0, 1)
      for (let i = 0; i < 9; i++) this.puff(x + rand(-30, 30), y + rand(-24, 24), i % 2 ? '#fb923c' : '#fde047', 40, 0.8, rand(-50, 50), rand(-50, 50), 0.8)
      this.sparks(x, y, color, 30, 340, 0.7)
      this.sparks(x, y, '#ffffff', 12, 300, 0.5)
      this.debris(x, y, color, 14, 200)
      this.shock(x, y, '#ffffff', 10, 320, 0.5, 4)
      this.shock(x, y, color, 6, 220, 0.7, 3)
      this.juice.shake(0.45)
      this.juice.freeze(60)
      fx.boom()
    }
  }

  // ===================== Puntuación =====================

  addScore(n: number) {
    const before = this.score
    this.score += Math.round(n)
    if (this.extendIdx < EXTENDS.length && before < EXTENDS[this.extendIdx] && this.score >= EXTENDS[this.extendIdx]) {
      this.extendIdx++
      this.lives++
      fx.oneUp()
      this.juice.text(this.player.x, this.player.y - 30, 'VIDA EXTRA', '#4ade80', 11, 1.4)
    }
  }

  /** Cancela las balas enemigas (en un radio alrededor de `from`, si se indica) convirtiéndolas en puntos. */
  cancelBullets(points = true, radius = 0, from: Player = this.player) {
    const p = from
    let n = 0
    for (let i = this.nb - 1; i >= 0; i--) {
      const b = this.bullets[i]
      if (radius > 0) {
        const dx = b.x - p.x
        const dy = b.y - p.y
        if (dx * dx + dy * dy > radius * radius) continue
      }
      if (n < 140 || (n & 3) === 0) this.puff(b.x, b.y, BCOL[b.spr % NCOL], 8, 0.35, 0, -40)
      n++
      this.bullets[i] = this.bullets[this.nb - 1]
      this.bullets[this.nb - 1] = b
      this.nb--
    }
    if (points && n > 0) {
      const v = n * 20 * (1 + this.diff.lvl * 0.25)
      this.addScore(v)
      if (n > 12) this.juice.text(W / 2, 120, `+${Math.round(v)}`, '#fde047', 10, 1)
    }
    if (n > 0) fx.cancel()
  }

  // ===================== Daño =====================

  damage(e: Enemy, dmg: number) {
    if (!e.alive || e.armor <= 0) {
      if (e.alive) fx.hitArmor()
      return
    }
    e.hp -= dmg * e.armor
    e.flash = 0.06
    if (e.hp <= 0) this.kill(e)
  }

  kill(e: Enemy) {
    e.alive = false
    const d = e.def
    const col = this.sectorDef().tint.main
    this.explode(e.x, e.y, d.size, col)
    if (e.boss) {
      bossPartDestroyed(this, e)
      return
    }
    if (!d.noChain) {
      this.kills++
      this.sectorKills++
      this.chain++
      if (this.chain > this.maxChain) this.maxChain = this.chain
      this.chainT = 1.7 * (1 + this.up('chain') * 0.4)
      const prev = this.mult
      this.mult = Math.min(32, 1 + Math.floor(this.chain / 5))
      if (this.mult > prev && this.mult % 4 === 0) {
        fx.chain(this.mult / 4)
        this.juice.text(this.player.x, this.player.y - 26, `x${this.mult}`, '#fde047', 12, 0.8)
      }
    }
    const pts = e.score * this.mult * (1 + this.loop * 0.5)
    this.addScore(pts)
    if (d.size >= 1) this.juice.text(e.x, e.y - 6, `${Math.round(pts)}`, d.size >= 2 ? '#fde047' : '#ffffff', d.size >= 2 ? 11 : 8, 0.8)
    this.dropItems(e.drop, e.x, e.y)
    if (this.diff.revenge && d.size === 0 && this.firstAlive()) {
      const a = this.aim(e.x, e.y)
      this.fan(e.x, e.y, 3, 0.3, 90, a, 0 * NCOL + 7)
    }
    d.onDeath?.(this, e)
    if (e === this.midboss) this.midboss = null
  }

  /** Impacto contra una nave: escudo, bomba de emergencia o muerte. */
  hitPlayer(p: Player) {
    if (!p.alive || p.inv > 0 || this.bombT > 0 || this.mode === 'title') return
    if (p.shield > 0) {
      p.shield--
      p.inv = 1.6
      this.cancelBullets(false, 90, p)
      this.shock(p.x, p.y, '#60a5fa', 10, 260, 0.5, 4)
      this.juice.flash('#60a5fa', 0.3)
      this.juice.shake(0.3)
      fx.shield()
      this.juice.text(p.x, p.y - 24, 'ESCUDO', '#93c5fd', 9, 0.9)
      return
    }
    if (this.up('autobomb') && this.bombs > 0) {
      this.juice.text(p.x, p.y - 24, 'EMERGENCIA', '#fca5a5', 9, 0.9)
      this.useBomb(p)
      return
    }
    // muerte
    this.sectorHit = true
    p.alive = false
    p.respawnT = this.coop ? COOP_RESPAWN : 1.4
    p.laser = false
    p.hitting = false
    if (!this.coop) laserHum(false)
    const col = shipColorOf(this, p)
    this.explode(p.x, p.y, 2, col)
    this.debris(p.x, p.y, '#ffffff', 10, 260)
    this.shock(p.x, p.y, col, 4, 420, 0.8, 5)
    this.juice.flash('#ffffff', 0.6)
    this.juice.shake(0.8)
    this.juice.freeze(140)
    fx.die()
    this.chain = 0
    this.chainT = 0
    this.mult = 1
    this.cancelBullets(false)
    for (const b of this.beams) b.dur = Math.min(b.dur, b.t)
    if (p.power > 1) {
      p.power--
      this.item('P', p.x, p.y)
    }
    // En cooperativo las vidas se gastan al revivir (ver tryRevive).
    if (this.coop) return
    this.lives--
    if (this.lives < 0) {
      this.lives = 0
      this.endRun()
    }
  }

  /** Fin de la partida: se lleva a la pantalla de resultados. */
  private endRun() {
    this.slowT = 2.2
    this.slowK = 0.35
    this.setMode('dead')
    duckMusic(0)
    fx.gameOver()
  }

  /** Revive una nave caída. En cooperativo cuesta una vida del equipo; sin vidas queda fuera. */
  private tryRevive(p: Player) {
    if (this.coop) {
      if (this.lives <= 0) {
        p.out = true
        if (this.ships.every((s) => !s.alive && s.out)) this.endRun()
        return
      }
      this.lives--
    }
    p.alive = true
    p.x = this.coop ? W / 2 + (p.idx ? 40 : -40) : W / 2
    p.y = H + 24
    p.entering = 0.9
    p.inv = 3.2
    if (!this.coop) this.bombs = Math.max(this.bombs, this.bombMax)
  }

  /** Bomba desde una nave (las bombas son del equipo). */
  useBomb(p: Player = this.player) {
    if (this.bombs <= 0 || this.bombT > 0 || !p.alive) return
    this.bombs--
    const nova = this.up('nova') > 0
    this.bombDur = (p.shipId === 1 ? 2.5 : 2.0) * (nova ? 1.6 : 1)
    this.bombT = this.bombDur
    this.bombX = p.x
    this.bombY = p.y
    p.inv = Math.max(p.inv, this.bombDur + 0.4)
    this.cancelBullets(true)
    for (const b of this.beams) b.dur = Math.min(b.dur, b.t)
    const col = shipColorOf(this, p)
    this.shock(p.x, p.y, '#ffffff', 10, 700, 0.6, 6)
    this.shock(p.x, p.y, col, 10, 500, 0.9, 8)
    this.shock(p.x, p.y, '#f0abfc', 10, 320, 1.1, 5)
    this.juice.flash(col, 0.55)
    this.juice.shake(0.6)
    this.juice.freeze(70)
    fx.bomb()
  }

  sectorDef() {
    return sectorFor(this.sector)
  }

  sfxShot(shipId: number) {
    fx.shot(shipId)
  }
  sfxMissile() {
    fx.missile()
  }

  // ===================== Mejoras =====================

  applyUpgrade(u: UpgradeDef, who = 0) {
    const id = u.id
    this.build[id] = (this.build[id] ?? 0) + 1
    if (!this.buildOrder.includes(id)) this.buildOrder.push(id)
    switch (id) {
      case 'core':
        this.powerCap = Math.min(8, this.powerCap + 1)
        for (const s of this.ships) s.power = Math.min(this.powerCap, s.power + 1)
        break
      case 'drone': {
        const s = this.ships[who] ?? this.player
        this.drones.push({ x: s.x, y: s.y + 20, owner: who, host: who })
        break
      }
      case 'bombs':
        this.bombMax++
        this.bombs = this.bombMax
        break
      case 'life':
        this.lives++
        break
      default:
        break
    }
  }

  // ===================== Bucle =====================

  update(dtReal: number, inp: Input) {
    this.time += dtReal
    if (this.paused) return
    let dt = this.juice.update(dtReal)
    if (this.slowT > 0) {
      this.slowT -= dtReal
      dt *= this.slowK
    }
    this.modeT += dtReal
    this.bannerT = Math.max(0, this.bannerT - dtReal)
    this.menuLock = Math.max(0, this.menuLock - dtReal)
    this.scoreShown += (this.score - this.scoreShown) * Math.min(1, dtReal * 10)
    if (Math.abs(this.score - this.scoreShown) < 1) this.scoreShown = this.score

    const warp = this.mode === 'warp' ? Math.sin(Math.min(1, this.modeT / 2.2) * Math.PI) : 0
    this.bg.update(dt, warp)

    if (this.mode === 'title') {
      this.updateTitle(dt, inp)
      this.updateShots(dt)
      this.updateParts(dt)
      return
    }
    if (this.mode === 'upgrade') {
      this.updateUpgradeMenu(inp)
      this.updateParts(dt)
      updateDrones(this, dt)
      return
    }

    // pendientes (oleadas en curso)
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const pe = this.pending[i]
      pe.t -= dt
      if (pe.t <= 0) {
        this.pending.splice(i, 1)
        pe.fn()
      }
    }

    this.updatePlayers(dt, inp)
    updateDrones(this, dt)
    this.updateFlow(dt, inp)
    this.updateEnemies(dt)
    if (this.boss) bossUpdate(this, this.boss, dt)
    this.updateBullets(dt)
    this.updateShots(dt)
    this.updateLaser(dt)
    this.updateBeams(dt)
    this.updateItems(dt)
    this.updateParts(dt)

    if (this.chainT > 0) {
      this.chainT -= dt
      if (this.chainT <= 0) {
        this.chain = 0
        this.mult = 1
      }
    }
    if (this.grazeStreakT > 0) {
      this.grazeStreakT -= dt
      if (this.grazeStreakT <= 0) this.grazeStreak = 0
    }
    if (this.bombT > 0) this.updateBomb(dt)
  }

  /** Pantalla de título: modo (1 o 2 jugadores), naves y vista previa. */
  updateTitle(dt: number, inp: Input) {
    const [a, b] = inp.pads
    if (a.up || a.down || b.up || b.down) {
      this.titleMode = this.titleMode === 1 ? 2 : 1
      fx.menu()
    }
    this.coop = this.titleMode === 2
    this.p2.alive = this.coop
    if (a.left) {
      this.titleSel = (this.titleSel + 2) % 3
      fx.menu()
    }
    if (a.right) {
      this.titleSel = (this.titleSel + 1) % 3
      fx.menu()
    }
    if (this.coop) {
      if (b.left) {
        this.titleSel2 = (this.titleSel2 + 2) % 3
        fx.menu()
      }
      if (b.right) {
        this.titleSel2 = (this.titleSel2 + 1) % 3
        fx.menu()
      }
    }
    const p = this.player
    const q = this.p2
    if (p.shipId !== this.titleSel) {
      p.shipId = this.titleSel
      this.ns = 0
    }
    if (q.shipId !== this.titleSel2) {
      q.shipId = this.titleSel2
      this.ns = 0
    }
    const t = this.time
    const sway = this.coop ? 30 : 46
    p.x = (this.coop ? W / 2 - 62 : W / 2) + Math.sin(t * 0.9) * sway
    p.y = 262 + Math.sin(t * 1.7) * 6
    p.bank = Math.cos(t * 0.9) * 0.6
    p.focus = Math.sin(t * 0.5) > 0.55
    p.power = 3 + Math.floor((t * 0.25) % 3)
    if (this.coop) {
      q.x = W / 2 + 62 + Math.sin(t * 0.9 + 2) * sway
      q.y = 262 + Math.sin(t * 1.7 + 1) * 6
      q.bank = Math.cos(t * 0.9 + 2) * 0.6
      q.focus = Math.sin(t * 0.5 + 1.5) > 0.55
      q.power = 3 + Math.floor((t * 0.25 + 1) % 3)
    }
    if (this.drones.length !== 0) this.drones = []
    for (const s of this.ships) {
      fireWeapons(this, s, dt)
      s.laser = s.shipId === 1 && s.focus
      s.laserTop = 150
    }
    // los disparos del menú no deben pasar de la zona de vista previa
    for (let i = this.ns - 1; i >= 0; i--) {
      const s = this.shots[i]
      if (s.y < 152 || s.x < 30 || s.x > W - 30) this.removeShot(i)
      else if (s.kind === 1) {
        s.vy -= 600 * dt
      }
    }
  }

  /** Movimiento, disparo y bombas de las naves vivas. */
  private updatePlayers(dt: number, inp: Input) {
    const canAct = this.mode !== 'clear' && this.mode !== 'warp'
    if (canAct) {
      if (inp.pads[0].bomb) {
        const o = this.firstAlive()
        if (o) this.useBomb(o)
      }
      if (this.coop && inp.pads[1].bomb && this.p2.alive) this.useBomb(this.p2)
    }
    let laserPower = 0
    for (const p of this.ships) {
      this.updatePlayer(p, dt, inp.pads[p.idx], canAct)
      if (p.alive && p.laser && p.power > laserPower) laserPower = p.power
    }
    laserHum(laserPower > 0, Math.max(1, laserPower))
  }

  private updatePlayer(p: Player, dt: number, pad: Pad, canAct: boolean) {
    const s = SHIPS[p.shipId]
    if (p.inv > 0) p.inv -= dt
    if (!p.alive) {
      if (this.mode === 'dead' || this.mode === 'over' || p.out) return
      p.respawnT -= dt
      if (p.respawnT <= 0) this.tryRevive(p)
      return
    }
    p.focus = pad.focus && canAct
    const spd = (p.focus ? s.focusSpeed : s.speed) * (1 + this.up('speed') * 0.14)
    const ox = p.x
    if (p.entering > 0) {
      p.entering -= dt
      p.y += (H - 80 - p.y) * Math.min(1, dt * 5)
    } else if (this.mode === 'warp') {
      p.x += (W / 2 - p.x) * Math.min(1, dt * 2.5)
      p.y += (H - 110 - p.y) * Math.min(1, dt * 2.5)
    } else {
      let mx = pad.mx
      let my = pad.my
      const len = Math.hypot(mx, my)
      if (len > 1) {
        mx /= len
        my /= len
      }
      p.x += mx * spd * dt
      p.y += my * spd * dt
      if (pad.dx || pad.dy) {
        // táctil relativo: más fino en modo concentrado
        const k = p.focus ? 0.75 : 1.25
        p.x += pad.dx * k
        p.y += pad.dy * k
      }
      if (pad.follow) {
        const dx = pad.fx - p.x
        const dy = pad.fy - p.y
        const dl = Math.hypot(dx, dy)
        const max = spd * 1.9 * dt
        if (dl > 0.5) {
          const k = Math.min(1, max / dl)
          p.x += dx * k
          p.y += dy * k
        }
      }
    }
    p.x = clamp(p.x, 10, W - 10)
    if (p.entering <= 0) p.y = clamp(p.y, 26, H - 16)
    p.vx = dt > 0 ? (p.x - ox) / dt : 0
    p.bank += (clamp(p.vx / 160, -1, 1) - p.bank) * Math.min(1, dt * 10)
    p.trailI = (p.trailI + 1) % p.trailX.length
    p.trailX[p.trailI] = p.x
    p.trailY[p.trailI] = p.y

    const firing = canAct && this.mode !== 'dead' && p.entering <= 0
    if (firing) fireWeapons(this, p, dt)
    else p.laser = false
  }

  updateFlow(dt: number, inp: Input) {
    const m = this.mode
    if (m === 'intro') {
      if (this.modeT > (this.sectorsCleared === 0 ? 4 : 2.4)) this.setMode('play')
    }
    if (m === 'intro' || m === 'play') this.updateScript(dt)
    if (m === 'warning') {
      if (Math.floor(this.modeT / 0.8) !== Math.floor((this.modeT - dt) / 0.8) && this.modeT < 3) fx.warning()
      if (this.modeT > 3.4) {
        this.boss = spawnBoss(this, this.sectorDef().boss, false)
        this.bossTime = 0
        this.setMode('boss')
        playSong('boss', this.loop > 0 ? 1.05 : 1)
      }
    }
    if (m === 'boss') this.bossTime += dt
    if (m === 'clear') {
      if (inp.confirm && this.modeT > 1.2) this.modeT = Math.max(this.modeT, 4.6)
      if (this.modeT > 5) this.openUpgrades()
    }
    if (m === 'warp') {
      if (this.modeT > 1.1 && this.bg.sector !== this.sector) this.bg.setSector(this.sector, this.loop)
      if (this.modeT > 2.3) this.startSector()
    }
    if (m === 'dead') {
      if (this.modeT > 2.4) {
        this.setMode('over')
        const names = this.coop ? `${SHIPS[this.player.shipId].name} + ${SHIPS[this.p2.shipId].name}` : SHIPS[this.player.shipId].name
        this.onOver?.({
          score: this.score,
          sector: this.sectorLabel,
          kills: this.kills,
          graze: this.grazeCount,
          ship: names,
          maxChain: this.maxChain,
          coop: this.coop,
        })
      }
    }
  }

  updateScript(dt: number) {
    const script = this.sectorDef().script
    if (this.hold) {
      if (this.hold.alive) {
        this.holdT += dt
        if (this.holdT < 28) return
      }
      this.hold = null
    }
    this.scriptT -= dt
    if (this.scriptT > 0) return
    if (this.scriptIdx < script.length) {
      const [, fn] = script[this.scriptIdx]
      fn(this)
      this.scriptIdx++
      const next = script[this.scriptIdx]
      const pace = Math.max(0.7, 1 - this.diff.lvl * 0.035)
      this.scriptT = next ? next[0] * pace : 3
      return
    }
    // fin del guion: espera a que se vacíe la pantalla y llama al jefe
    let alive = 0
    for (const e of this.enemies) if (e.alive) alive++
    if (alive === 0 || this.scriptT < -7) {
      this.setMode('warning')
      duckMusic(0)
    }
  }

  holdOn(e: Enemy | null) {
    this.hold = e
    this.holdT = 0
  }

  updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      e.t += dt
      if (e.flash > 0) e.flash -= dt
      e.def.update(this, e, dt)
      if (!e.alive) continue
      if (!e.seen && e.y > -e.r * 0.4 && e.y < H && e.x > -e.r && e.x < W + e.r) e.seen = true
      if (!e.boss && (e.t > 40 || (e.seen && (e.y > H + 50 || e.y < -70 || e.x < -60 || e.x > W + 60)))) {
        e.alive = false
        if (e === this.midboss) this.midboss = null
      }
      // choque con las naves
      for (const p of this.ships) {
        if (p.alive && p.inv <= 0 && e.seen && e.armor > 0) {
          const dx = e.x - p.x
          const dy = e.y - p.y
          const rr = e.r * 0.7 + HIT_R
          if (dx * dx + dy * dy < rr * rr) this.hitPlayer(p)
        }
      }
    }
  }

  updateBullets(dt: number) {
    const grazeR = 15 + this.up('graze') * 9
    const ships = this.ships
    for (let i = this.nb - 1; i >= 0; i--) {
      const b = this.bullets[i]
      if (b.delay > 0) {
        b.delay -= dt
        continue
      }
      b.life += dt
      if (b.turn !== 0) {
        const c = Math.cos(b.turn * dt)
        const s = Math.sin(b.turn * dt)
        const vx = b.vx * c - b.vy * s
        b.vy = b.vx * s + b.vy * c
        b.vx = vx
      }
      if (b.acc !== 0) {
        const v = Math.hypot(b.vx, b.vy) || 1
        const nv = clamp(v + b.acc * dt, b.minV, b.maxV)
        b.vx *= nv / v
        b.vy *= nv / v
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.split > 0) {
        b.split -= dt
        if (b.split <= 0) {
          // copiar antes de liberar: el hueco del pool se reutiliza al instante
          const bx = b.x
          const by = b.y
          const sn = b.splitN
          const sv = b.splitV / this.diff.bs
          const ss = b.splitSpr
          const col = BCOL[b.spr % NCOL]
          this.removeBullet(i)
          const off = Math.random() * TAU
          for (let k = 0; k < sn; k++) this.bullet(bx, by, off + (k * TAU) / sn, sv, ss)
          this.puff(bx, by, col, 18, 0.25)
          continue
        }
      }
      if (b.x < -24 || b.x > W + 24 || b.y > H + 24 || (b.y < -40 && b.life > 0.5)) {
        this.removeBullet(i)
        continue
      }
      for (const p of ships) {
        if (!p.alive || p.entering > 0 || this.mode === 'dead') continue
        const dx = b.x - p.x
        const dy = b.y - p.y
        const d2 = dx * dx + dy * dy
        const hr = b.r * 0.82 + HIT_R
        if (d2 < hr * hr) {
          if (p.inv <= 0 && this.bombT <= 0) {
            // el impacto puede cancelar balas (escudo/bomba): no seguir iterando
            this.hitPlayer(p)
            return
          }
        } else if (!b.grazed) {
          const gr = b.r + grazeR
          if (d2 < gr * gr) {
            b.grazed = true
            this.graze(b, p)
          }
        }
      }
    }
  }

  removeBullet(i: number) {
    const b = this.bullets[i]
    this.bullets[i] = this.bullets[this.nb - 1]
    this.bullets[this.nb - 1] = b
    this.nb--
  }

  removeShot(i: number) {
    const s = this.shots[i]
    this.shots[i] = this.shots[this.ns - 1]
    this.shots[this.ns - 1] = s
    this.ns--
  }

  graze(b: Bullet, p: Player) {
    this.grazeCount++
    this.sectorGraze++
    this.grazeStreak++
    this.grazeStreakT = 0.9
    this.addScore(30 + this.diff.lvl * 15)
    if (this.chainT > 0) this.chainT = Math.min(this.chainT + 0.12, 1.7 * (1 + this.up('chain') * 0.4))
    const a = Math.atan2(b.y - p.y, b.x - p.x)
    this.sparks(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, '#e0f2fe', 2, 120, 0.25, a, 1)
    fx.graze(this.grazeStreak)
    if (this.grazeStreak % 10 === 0) this.juice.text(p.x + 22, p.y - 12, `ROCE x${this.grazeStreak}`, '#a5f3fc', 7, 0.7)
    if (this.up('graze')) {
      this.grazeBank++
      if (this.grazeBank >= 60) {
        this.grazeBank = 0
        if (this.bombs < this.bombMax) {
          this.bombs++
          fx.item()
          this.juice.text(p.x, p.y - 24, '+BOMBA', '#f472b6', 9, 0.9)
        }
      }
    }
  }

  findTarget(x: number, y: number): Enemy | null {
    let best: Enemy | null = null
    let bd = 1e9
    for (const e of this.enemies) {
      if (!e.alive || !e.seen || e.armor <= 0 || e.y < 4) continue
      const dx = e.x - x
      const dy = e.y - y
      const d = dx * dx + dy * dy * 0.6 - (e.boss ? 0 : 2000)
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }

  updateShots(dt: number) {
    const title = this.mode === 'title'
    for (let i = this.ns - 1; i >= 0; i--) {
      const s = this.shots[i]
      s.life += dt
      if (s.kind === 1) {
        // misil teledirigido
        if (s.life > 0.12 && !title) {
          if (!s.target || !s.target.alive) s.target = this.findTarget(s.x, s.y)
          const tg = s.target
          const v = Math.min(520, Math.hypot(s.vx, s.vy) + 900 * dt)
          let a = Math.atan2(s.vy, s.vx)
          if (tg) a += clamp(angDiff(a, Math.atan2(tg.y - s.y, tg.x - s.x)), -7 * dt, 7 * dt)
          else a += clamp(angDiff(a, -Math.PI / 2), -4 * dt, 4 * dt)
          s.vx = Math.cos(a) * v
          s.vy = Math.sin(a) * v
          s.ang = a
          if ((this.np & 1) === 0) this.puff(s.x - Math.cos(a) * 6, s.y - Math.sin(a) * 6, '#fb923c', 6, 0.18)
        } else s.ang = Math.atan2(s.vy, s.vx)
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (s.y < -20 || s.y > H + 20 || s.x < -20 || s.x > W + 20 || s.life > 3) {
        this.removeShot(i)
        continue
      }
      if (title) continue
      for (const e of this.enemies) {
        if (!e.alive || e.y < -e.r * 0.4) continue
        const dx = e.x - s.x
        const dy = e.y - s.y
        const rr = e.r + s.r
        if (dx * dx + dy * dy < rr * rr) {
          const weak = e.maxHp < 14 * this.diff.hp * this.hpK()
          this.damage(e, s.dmg)
          if (e.armor > 0) {
            if ((i & 3) === 0) this.sparks(s.x, s.y + 2, s.kind === 1 ? '#fdba74' : '#ffffff', 1, 120, 0.15, Math.PI / 2, 1.8)
            fx.hit()
          }
          if (s.kind === 1) this.puff(s.x, s.y, '#fb923c', 14, 0.25)
          if (s.pierce > 0 && !e.alive && weak) {
            s.pierce--
            continue
          }
          this.removeShot(i)
          break
        }
      }
    }
  }

  updateLaser(dt: number) {
    this.laserHitting = false
    for (const p of this.ships) {
      p.hitting = false
      if (!p.laser || !p.alive) continue
      const ls = laserStats(p.power)
      const half = ls.w / 2
      let best: Enemy | null = null
      let by = -20
      for (const e of this.enemies) {
        if (!e.alive || e.y > p.y || e.y < -e.r * 0.4) continue
        if (Math.abs(e.x - p.x) > e.r + half) continue
        const hitY = e.y + e.r * 0.6
        if (hitY > by) {
          by = hitY
          best = e
        }
      }
      p.laserTop = by
      this.laserHitY = by
      if (best) {
        p.hitting = true
        this.laserHitting = true
        let m = 1 + this.up('pierce') * 0.15
        if (this.up('fury') && this.mult >= 8) m *= 1.3
        this.damage(best, ls.dps * dt * m)
        if (Math.random() < 0.5) this.sparks(p.x + rand(-half, half), by, '#fbcfe8', 1, 200, 0.25, -Math.PI / 2, 2.2)
        if (Math.random() < 0.15) fx.hit()
      }
    }
  }

  updateBeams(dt: number) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]
      b.t += dt
      if (b.owner) {
        if (!b.owner.alive) {
          this.beams.splice(i, 1)
          continue
        }
        b.x = b.owner.x + b.ox
        b.y = b.owner.y + b.oy
      }
      b.ang += b.spin * dt
      if (b.t > b.warn + b.dur) {
        this.beams.splice(i, 1)
        continue
      }
      if (b.t > b.warn + 0.06) {
        for (const p of this.ships) {
          if (!p.alive || p.inv > 0) continue
          const dx = p.x - b.x
          const dy = p.y - b.y
          const along = dx * Math.cos(b.ang) + dy * Math.sin(b.ang)
          const perp = Math.abs(-dx * Math.sin(b.ang) + dy * Math.cos(b.ang))
          if (along > 0 && perp < b.w * 0.38) this.hitPlayer(p)
        }
      }
    }
  }

  updateItems(dt: number) {
    const mag = this.up('magnet')
    const pullR = mag >= 2 ? 9999 : mag === 1 ? 130 : 40
    for (const it of this.items) {
      if (!it.alive) continue
      it.t += dt
      const t = this.nearestAlive(it.x, it.y)
      const dx = t ? t.x - it.x : 0
      const dy = t ? t.y - it.y : 0
      const d = Math.hypot(dx, dy)
      if (t && (d < pullR || t.y < 130 || this.mode === 'bossdeath' || this.mode === 'clear')) it.pull = true
      if (it.pull && t) {
        const v = 420 + it.t * 60
        it.x += (dx / (d || 1)) * v * dt
        it.y += (dy / (d || 1)) * v * dt
      } else {
        if (it.kind === 'M') {
          it.vy = Math.min(110, it.vy + 260 * dt)
          it.vx *= 1 - dt * 2
        } else {
          it.vy = Math.min(55, it.vy + 120 * dt)
          it.vx = Math.sin(it.t * 2.2) * 40
        }
        it.x += it.vx * dt
        it.y += it.vy * dt
        it.x = clamp(it.x, 8, W - 8)
      }
      let taken: Player | null = null
      for (const p of this.ships) {
        if (p.alive && Math.hypot(p.x - it.x, p.y - it.y) < 16) {
          taken = p
          break
        }
      }
      if (taken) {
        it.alive = false
        this.collect(it, taken)
      } else if (it.y > H + 16) {
        it.alive = false
        if (it.kind === 'M' && this.medalIdx > 0) {
          this.medalIdx = 0
          fx.medalLost()
          this.juice.text(clamp(it.x, 40, W - 40), H - 30, 'MEDALLA PERDIDA', '#fca5a5', 7, 1)
        }
      }
    }
  }

  /** Recoge un objeto con la nave `p`. */
  collect(it: Item, p: Player) {
    if (it.kind === 'P') {
      if (p.power < this.powerCap) {
        p.power++
        fx.power()
        this.juice.text(p.x, p.y - 26, p.power === this.powerCap ? 'NIVEL MAX' : 'NIVEL UP', '#67e8f9', 9, 0.9)
        this.shock(p.x, p.y, '#67e8f9', 8, 140, 0.4, 2)
      } else {
        const v = 10000 * (1 + this.sector)
        this.addScore(v)
        fx.item()
        this.juice.text(p.x, p.y - 26, `${v}`, '#67e8f9', 9, 0.9)
      }
    } else if (it.kind === 'B') {
      if (this.bombs < this.bombMax) {
        this.bombs++
        this.juice.text(p.x, p.y - 26, '+BOMBA', '#f472b6', 9, 0.9)
      } else {
        this.addScore(20000)
        this.juice.text(p.x, p.y - 26, '20000', '#f472b6', 9, 0.9)
      }
      fx.item()
    } else if (it.kind === 'M') {
      const v = MEDAL_VALUES[this.medalIdx]
      this.addScore(v)
      fx.medal(this.medalIdx)
      this.juice.text(it.x, it.y - 10, `${v}`, '#fde047', 7, 0.6)
      this.medalIdx = Math.min(MEDAL_VALUES.length - 1, this.medalIdx + 1)
    } else {
      this.lives++
      fx.oneUp()
    }
  }

  medalValue(): number {
    return MEDAL_VALUES[this.medalIdx]
  }

  updateParts(dt: number) {
    for (let i = this.np - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.life -= dt
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.np - 1]
        this.parts[this.np - 1] = p
        this.np--
        continue
      }
      const k = Math.max(0, 1 - p.drag * dt)
      if (p.kind !== 3) {
        p.vx *= k
        p.vy *= k
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 3) p.size += p.grow * dt
      else if (p.kind === 1) p.size += p.grow * dt
      else if (p.kind === 4) p.rot += p.grow * dt
    }
  }

  updateBomb(dt: number) {
    this.bombT -= dt
    this.cancelBullets(true)
    const nova = this.up('nova') > 0
    const dps = 70 * (1 + this.diff.lvl * 0.3) * (nova ? 3 : 1)
    for (const e of this.enemies) {
      if (!e.alive || !e.seen) continue
      this.damage(e, dps * dt * (e.boss || e === this.midboss ? 0.45 : 1))
    }
    const t = this.bombDur - this.bombT
    if (Math.floor(t / 0.18) !== Math.floor((t - dt) / 0.18)) {
      const col = shipColorOf(this, this.player)
      this.puff(rand(30, W - 30), rand(40, H - 60), col, 70, 0.6, 0, 0, 0.6)
      this.shock(this.bombX, this.bombY, col, 20, 380, 0.6, 3)
    }
  }

  // ===================== Jefes y flujo de sector =====================

  bossDefeated(b: Boss) {
    const sb = 200000 * (this.sector + 1) * (1 + this.loop)
    const timeBonus = Math.max(0, Math.round((90 - this.bossTime) * 2000 * (1 + this.sector * 0.5)))
    this.addScore(sb)
    this.tally = [
      { label: 'JEFE', value: sb },
      { label: 'TIEMPO', value: timeBonus },
      { label: 'SIN DANO', value: this.sectorHit ? 0 : 100000 * (this.sector + 1) * (1 + this.loop) },
      { label: 'ROCES', value: this.sectorGraze * 100 },
    ]
    this.addScore(timeBonus + this.tally[2].value + this.tally[3].value)
    this.boss = null
    this.later(1.8, () => this.startTally())
    void b
  }

  startTally() {
    this.setMode('clear')
    for (const s of this.ships) s.inv = Math.max(s.inv, 1)
    for (const it of this.items) if (it.alive) it.pull = true
    fx.clear()
  }

  openUpgrades() {
    this.sectorsCleared++
    const topPower = Math.max(...this.ships.map((s) => s.power))
    this.choices = rollUpgrades(this.sector + this.loop * 6, this.build, topPower, this.powerCap)
    if (this.choices.length === 0) {
      // todo al máximo: bonificación y directo al siguiente sector
      this.addScore(500000)
      this.juice.text(W / 2, 200, 'NAVE AL MAXIMO +500000', '#fde047', 9, 2)
      this.nextSector()
      return
    }
    this.sel = 0
    this.chooser = 0
    this.menuLock = 0.6
    this.setMode('upgrade')
    laserHum(false)
    playSong('title', 1.0)
  }

  updateUpgradeMenu(inp: Input) {
    if (this.menuLock > 0) return
    const pad = inp.pads[this.chooser]
    const n = this.choices.length
    if (pad.up || pad.left) {
      this.sel = (this.sel + n - 1) % n
      fx.menu()
    }
    if (pad.down || pad.right) {
      this.sel = (this.sel + 1) % n
      fx.menu()
    }
    if (pad.confirm) this.chooseUpgrade(this.sel)
  }

  /** El jugador `chooser` elige la mejora i. En cooperativo, J2 elige después entre las que quedan. */
  chooseUpgrade(i: number) {
    const u = this.choices[i]
    if (!u) return
    const who = this.chooser
    this.applyUpgrade(u, who)
    fx.upgrade()
    const p = this.ships[who] ?? this.player
    this.shock(p.x, p.y, UP_BY_ID[u.id].color, 8, 260, 0.6, 3)
    this.juice.flash(UP_BY_ID[u.id].color, 0.25)
    if (this.coop && who === 0) {
      this.choices = this.choices.filter((_, k) => k !== i)
      if (this.choices.length > 0) {
        this.chooser = 1
        this.sel = 0
        this.menuLock = 0.6
        return
      }
    }
    this.choices = []
    this.chooser = 0
    this.nextSector()
  }

  nextSector() {
    this.sector++
    if (this.sector >= SECTORS.length) {
      this.sector = 0
      this.loop++
      this.addScore(1_000_000 * this.loop)
      this.showBanner('CICLO ' + (this.loop + 1), 'La nebulosa se oscurece...', 2.4)
    }
    this.setMode('warp')
    fx.launch()
    playSong(null)
  }

  spawnMidboss(def: EnemyDef, x: number) {
    const e = this.spawn(def, x, -40)
    if (e) {
      this.midboss = e
      this.holdOn(e)
      this.showBanner('', '', 0)
    }
    return e
  }
}
