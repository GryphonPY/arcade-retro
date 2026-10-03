/**
 * Núcleo de Búnker 93: estado de la partida, jugador, armas, combate,
 * oleadas, progresión con mejoras, entrada y bucle principal.
 */
import { Audio93 } from './audio'
import { ARENAS } from './arenas'
import {
  AMMO_BASE,
  AMMO_PICK,
  ENEMIES,
  SOLDIERS,
  UPGRADES,
  WEAPONS,
  WEAPON_BY_ID,
  baseStats,
  rollUpgrades,
  type AmmoId,
  type EnemyKind,
  type PlayerState,
  type SoldierDef,
  type Stats,
  type Upgrade,
  type WeaponId,
} from './defs'
import type { Barrel, Decal, Enemy, Floater, Fx, Particle, Pickup, PickupKind, Proj, ProjKind } from './entities'
import { buildWeaponArt, type WeaponFrames } from './fpweapons'
import { Hud93 } from './hud'
import { Renderer93 } from './render'
import { buildSpriteAtlas, type SpriteAtlas } from './sprites'
import { buildWorldAtlas } from './textures'
import { angDiff, clamp, pick, rand } from './util'
import { Level } from './world'
import { updateEnemies } from './ai'
import { drawOverlay, renderWorld } from './view'
import { loadBest, saveBest } from '../game-utils'

import { EYE, GAME_ID, PLAYER_R } from './consts'

export { EYE, GAME_ID, PLAYER_R }

export type Screen = 'title' | 'playing' | 'paused' | 'upgrade' | 'gameover'

export interface ChoiceCard {
  id: string
  name: string
  desc: string
  rarity: number
  icon: string
  level: number
}

export interface Choice {
  title: string
  subtitle: string
  legendary: boolean
  cards: ChoiceCard[]
}

export interface RunResult {
  score: number
  wave: number
  kills: number
  accuracy: number
  favorite: string
  time: number
  newBest: boolean
  best: number
}

export interface GameCallbacks {
  screen: (s: Screen) => void
  choice: (c: Choice | null) => void
  over: (r: RunResult) => void
  lock: (locked: boolean) => void
}

type WavePhase = 'intro' | 'fight' | 'bossdeath' | 'cleared' | 'respite' | 'transition'

interface Banner {
  text: string
  sub: string
  color: string
  t: number
  dur: number
}

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(window.location.search).get('touch') === '1')

export class Game {
  readonly r: Renderer93
  readonly hud: Hud93
  readonly audio = new Audio93()
  readonly atlas: SpriteAtlas
  art: Record<WeaponId, WeaponFrames>
  private artSkin = -1
  level: Level
  arena = 0
  cycle = 0
  screen: Screen = 'title'
  readonly touch = isTouchDevice()

  // ---------------- jugador
  soldier: SoldierDef = SOLDIERS[0]
  p: PlayerState = {
    hp: 100,
    maxHp: 100,
    armor: 0,
    maxArmor: 100,
    ammo: { bullets: 0, shells: 0, rockets: 0, cells: 0 },
    owned: { pistol: true, shotgun: true, chaingun: false, rocket: false, plasma: false },
  }
  stats: Stats = baseStats()
  taken: Record<string, number> = {}
  px = 0
  pz = 0
  yaw = 0
  pvx = 0
  pvz = 0
  bob = 0
  bobAmt = 0
  eyeY = EYE
  roll = 0
  dead = false
  deathT = 0
  regenT = 0
  shockCd = 0
  frenzyT = 0
  invuln = 0
  faceT = 0
  faceMode: 'pain' | 'grin' | null = null
  faceLook = 0
  faceLookT = 0
  angryT = 0
  stepT = 0
  private posTmp = { x: 0, z: 0 }

  // ---------------- armas
  cur: WeaponId = 'shotgun'
  wNext: WeaponId | null = null
  wLower = 0
  fireCd = 0
  fireAnim = 9
  flashT = 0
  kick = 0
  spin = 0
  heat = 0
  lastAlt = false

  // ---------------- mundo
  enemies: Enemy[] = []
  projs: Proj[] = []
  pickups: Pickup[] = []
  barrels: Barrel[] = []
  particles: Particle[] = []
  decals: Decal[] = []
  fx: Fx[] = []
  floaters: Floater[] = []
  pendingBlasts: { x: number; z: number; t: number; dmg: number }[] = []
  nextId = 1

  // ---------------- oleadas
  wave = 0
  phase: WavePhase = 'intro'
  phaseT = 0
  queue: EnemyKind[] = []
  spawnT = 0
  maxAlive = 10
  tookDamage = false
  boss: Enemy | null = null
  bossName = ''
  pendingChoice: { legendary: boolean } | null = null
  choiceCards: Upgrade[] = []
  fade = 0
  respiteN = -1

  // ---------------- puntuación
  score = 0
  best = 0
  chain = 0
  chainT = 0
  kills = 0
  shots = 0
  hits = 0
  killsBy: Record<WeaponId, number> = { pistol: 0, shotgun: 0, chaingun: 0, rocket: 0, plasma: 0 }
  time = 0

  // ---------------- juice
  trauma = 0
  hurtFlash = 0
  pickFlash = 0
  whiteFlash = 0
  hitstop = 0
  hitMark = 0
  killMark = 0
  dmgDirs: { a: number; t: number }[] = []
  banner: Banner | null = null
  msg: { text: string; t: number } | null = null
  alarm = 0
  flicker = 1
  flickT = 0

  // ---------------- entrada
  keys = new Set<string>()
  mouseDown = false
  altDown = false
  turnAcc = 0
  moveX = 0
  moveY = 0
  touchFire = false
  touchAlt = false
  locked = false
  private expectUnlock = false
  private unlockAt = 0
  private raf = 0
  private last = 0
  private disposed = false
  private slowFrames = 0
  quality = 1
  viewW = 320
  viewH = 200
  private cssW = 0
  private cssH = 0
  private ro: ResizeObserver | null = null
  private cleanup: (() => void)[] = []

  constructor(
    readonly glCanvas: HTMLCanvasElement,
    readonly uiCanvas: HTMLCanvasElement,
    readonly host: HTMLElement,
    readonly cb: GameCallbacks,
  ) {
    this.atlas = buildSpriteAtlas()
    this.r = new Renderer93(glCanvas, buildWorldAtlas(), this.atlas.img, this.atlas.frames)
    this.hud = new Hud93(uiCanvas)
    this.art = buildWeaponArt(this.soldier.skin)
    this.artSkin = this.soldier.skin
    this.level = new Level(0)
    this.r.buildArena(this.level)
    this.placePlayer()
    this.best = loadBest(GAME_ID)
    this.bindInput()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    if (new URLSearchParams(window.location.search).has('b93dbg')) (window as unknown as { __b93: Game }).__b93 = this
  }

  // =====================================================================
  // Ciclo de vida
  // =====================================================================

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    for (const f of this.cleanup) f()
    if (document.pointerLockElement === this.glCanvas) document.exitPointerLock()
    this.audio.dispose()
    this.r.dispose()
  }

  private resize() {
    const rect = this.host.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    this.cssW = w
    this.cssH = h
    const aspect = w / h
    const base = this.touch ? 216 : 264
    let H = Math.round(base * this.quality)
    let W = Math.round(H * aspect)
    if (W < 320) {
      W = 320
      H = Math.round(320 / aspect)
    }
    W = Math.min(W, Math.round(H * 2.6))
    this.viewW = W
    this.viewH = H
    const bar = this.hud.barH
    // La vista 3D ocupa todo el canvas, pero el centro óptico se desplaza hacia
    // arriba para que el horizonte quede centrado sobre la barra del HUD:
    // imagen virtual de alto H+bar de la que mostramos la parte inferior.
    const fullH = H + bar
    const hfov = (95 * Math.PI) / 180
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / (W / fullH))
    const fovDeg = clamp((vfov * 180) / Math.PI, 50, 92)
    this.r.resize(W, H)
    const cam = this.r.camera
    cam.aspect = W / fullH
    cam.fov = fovDeg
    cam.setViewOffset(W, fullH, 0, bar, W, H)
    cam.updateProjectionMatrix()
    this.hud.resize(W, H)
  }

  // =====================================================================
  // Entrada
  // =====================================================================

  private bindInput() {
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(t, f as EventListener, opts)
      this.cleanup.push(() => window.removeEventListener(t, f as EventListener, opts))
    }
    on(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          const recent = performance.now() - this.unlockAt < 400
          if (this.screen === 'playing' || this.screen === 'upgrade' || recent) {
            e.stopImmediatePropagation()
            e.preventDefault()
            if (this.screen === 'playing') this.pause()
          }
        }
      },
      { capture: true },
    )
    on('keydown', (e) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.code === 'KeyP') {
        e.preventDefault()
        if (this.screen === 'playing') this.pause()
        else if (this.screen === 'paused') this.resume()
        return
      }
      if (this.screen !== 'playing') return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
      this.keys.add(e.code)
      if (e.repeat) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 5) this.selectWeapon(WEAPONS[n - 1].id)
      if (e.code === 'KeyQ') this.cycleWeapon(-1)
      if (e.code === 'Tab') this.cycleWeapon(1)
    })
    on('keyup', (e) => {
      this.keys.delete(e.code)
    })
    on('blur', () => {
      this.keys.clear()
      this.mouseDown = false
      this.altDown = false
      if (this.screen === 'playing') this.pause()
    })
    const vis = () => {
      if (document.hidden && this.screen === 'playing') this.pause()
    }
    document.addEventListener('visibilitychange', vis)
    this.cleanup.push(() => document.removeEventListener('visibilitychange', vis))
    const plc = () => {
      const locked = document.pointerLockElement === this.glCanvas
      if (this.locked && !locked) this.unlockAt = performance.now()
      this.locked = locked
      this.cb.lock(locked)
      if (!locked && this.screen === 'playing' && !this.expectUnlock) this.pause()
      this.expectUnlock = false
    }
    document.addEventListener('pointerlockchange', plc)
    this.cleanup.push(() => document.removeEventListener('pointerlockchange', plc))
    on('mousemove', (e) => {
      if (this.screen !== 'playing') return
      if (this.locked) this.turnAcc += e.movementX * 0.0024
    })
    const md = (e: MouseEvent) => {
      if (this.screen !== 'playing' || this.touch) return
      if (e.button === 0) this.mouseDown = true
      if (e.button === 2) this.altDown = true
      if (!this.locked) this.requestLock()
    }
    const mu = (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false
      if (e.button === 2) this.altDown = false
    }
    this.host.addEventListener('mousedown', md)
    this.cleanup.push(() => this.host.removeEventListener('mousedown', md))
    on('mouseup', mu)
    const ctx = (e: Event) => e.preventDefault()
    this.host.addEventListener('contextmenu', ctx)
    this.cleanup.push(() => this.host.removeEventListener('contextmenu', ctx))
    const wheel = (e: WheelEvent) => {
      if (this.screen !== 'playing') return
      e.preventDefault()
      this.cycleWeapon(e.deltaY > 0 ? 1 : -1)
    }
    this.host.addEventListener('wheel', wheel, { passive: false })
    this.cleanup.push(() => this.host.removeEventListener('wheel', wheel))
  }

  requestLock() {
    if (this.touch || this.locked) return
    try {
      const r = this.glCanvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (r && typeof r.catch === 'function') r.catch(() => {})
    } catch {
      // sin pointer lock: se juega igual con teclado
    }
  }

  private releaseLock() {
    if (document.pointerLockElement === this.glCanvas) {
      this.expectUnlock = true
      document.exitPointerLock()
    }
  }

  // API táctil
  setMove(x: number, y: number) {
    this.moveX = x
    this.moveY = y
  }
  addTurn(rad: number) {
    if (this.screen === 'playing') this.turnAcc += rad
  }
  setFire(v: boolean) {
    this.touchFire = v
  }
  setAlt(v: boolean) {
    this.touchAlt = v
  }

  // =====================================================================
  // Pantallas
  // =====================================================================

  private setScreen(s: Screen) {
    this.screen = s
    this.cb.screen(s)
  }

  pause() {
    if (this.screen !== 'playing') return
    this.keys.clear()
    this.mouseDown = false
    this.altDown = false
    this.touchFire = false
    this.audio.setDuck(0.35)
    this.releaseLock()
    this.setScreen('paused')
  }

  resume() {
    if (this.screen !== 'paused') return
    this.audio.unlock()
    this.audio.setDuck(1)
    this.last = performance.now()
    this.setScreen('playing')
    this.requestLock()
  }

  start(soldierIdx: number) {
    this.audio.unlock()
    this.audio.setDuck(1)
    this.soldier = SOLDIERS[soldierIdx] ?? SOLDIERS[0]
    if (this.artSkin !== this.soldier.skin) {
      this.art = buildWeaponArt(this.soldier.skin)
      this.artSkin = this.soldier.skin
    }
    const s = this.soldier
    this.stats = baseStats()
    this.stats.speed = s.speed
    this.taken = {}
    this.p = {
      hp: s.hp,
      maxHp: s.hp,
      armor: s.armor,
      maxArmor: 100,
      ammo: { bullets: 60, shells: s.shells, rockets: 0, cells: 0 },
      owned: { pistol: true, shotgun: true, chaingun: false, rocket: false, plasma: false },
    }
    this.cur = 'shotgun'
    this.wNext = null
    this.wLower = 1
    this.fireCd = 0.3
    this.dead = false
    this.deathT = 0
    this.eyeY = EYE
    this.roll = 0
    this.regenT = 0
    this.shockCd = 0
    this.frenzyT = 0
    this.faceT = 0
    this.faceMode = null
    this.score = 0
    this.chain = 0
    this.chainT = 0
    this.kills = 0
    this.shots = 0
    this.hits = 0
    this.killsBy = { pistol: 0, shotgun: 0, chaingun: 0, rocket: 0, plasma: 0 }
    this.time = 0
    this.cycle = 0
    this.trauma = 0
    this.hurtFlash = 0
    this.dmgDirs = []
    this.banner = null
    this.msg = null
    this.boss = null
    this.pendingChoice = null
    this.best = loadBest(GAME_ID)
    this.loadArena(0)
    this.cb.choice(null)
    this.setScreen('playing')
    this.requestLock()
    this.startWave(1)
  }

  private loadArena(i: number) {
    this.arena = i
    if (this.level.def.id !== ARENAS[i].id) {
      this.level = new Level(i)
      this.r.buildArena(this.level)
    }
    this.enemies = []
    this.projs = []
    this.pickups = []
    this.particles = []
    this.decals = []
    this.fx = []
    this.floaters = []
    this.pendingBlasts = []
    this.barrels = this.level.barrels.map((b) => ({ x: b.x, z: b.z, hp: 25, alive: true, fuse: 0, flash: 0 }))
    this.placePlayer()
  }

  private placePlayer() {
    const L = this.level
    this.px = L.start.x
    this.pz = L.start.z
    this.yaw = Math.atan2(L.h / 2 - this.pz, L.w / 2 - this.px)
    this.pvx = 0
    this.pvz = 0
    this.level.updateFlow(this.px, this.pz, true)
  }

  // =====================================================================
  // Oleadas
  // =====================================================================

  /** Dificultad efectiva (crece con la oleada y con cada ciclo de arenas). */
  diff() {
    return this.wave + this.cycle * 3
  }

  private startWave(n: number) {
    this.wave = n
    const local = ((n - 1) % 5) + 1
    const isBoss = local === 5
    this.tookDamage = false
    this.phase = 'intro'
    this.phaseT = isBoss ? 3 : 2.2
    this.queue = isBoss ? this.bossMinions() : this.composeWave()
    const d = this.diff()
    this.maxAlive = Math.min(26, 7 + Math.floor(d * 1.3))
    this.spawnT = 0.5
    this.boss = null
    // barriles nuevos
    for (const b of this.barrels) {
      if (!b.alive) {
        b.alive = true
        b.hp = 25
        this.addFx('warp', b.x, 0, b.z, 1.2)
      }
    }
    if (isBoss) {
      const name = ARENAS[this.arena].bossName
      this.bossName = name
      this.showBanner('ALERTA', `JEFE: ${name}`, '#ff3a20', 3)
      this.audio.setTrack('boss')
      this.audio.bossRoar(`boss${this.arena + 1}`)
      this.trauma = Math.min(1, this.trauma + 0.4)
    } else {
      this.showBanner(`OLEADA ${n}`, n === 1 ? 'ACABA CON TODOS' : this.cycle > 0 ? `CICLO ${this.cycle + 1}` : 'SOBREVIVE', '#ff4a3a', 2.2)
      this.audio.setTrack('combat')
      this.audio.waveStart()
    }
    // armas nuevas durante la partida
    if (n >= 3 && !this.p.owned.chaingun) this.grantWeapon('chaingun')
    if (n >= 6 && !this.p.owned.rocket) this.grantWeapon('rocket')
    if (n >= 6 && !this.p.owned.plasma) this.grantWeapon('plasma')
  }

  private composeWave(): EnemyKind[] {
    const d = this.diff()
    const q: EnemyKind[] = []
    if (this.wave === 1 && this.cycle === 0) {
      q.push('mutant', 'mutant', 'mutant', 'swarm', 'swarm', 'swarm', 'swarm', 'mutant', 'mutant', 'mutant')
      return q
    }
    if (this.wave === 2 && this.cycle === 0) {
      q.push('mutant', 'mutant', 'soldier', 'mutant', 'soldier', 'mutant', 'mutant', 'soldier', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm')
      return q
    }
    let budget = 8 + d * 4.4
    const opts: { k: EnemyKind; cost: number; min: number; w: number }[] = [
      { k: 'mutant', cost: 2, min: 1, w: 5 },
      { k: 'swarm', cost: 3, min: 1, w: 2 },
      { k: 'soldier', cost: 3, min: 2, w: 4 },
      { k: 'spitter', cost: 4, min: 3, w: 3 },
      { k: 'tank', cost: 9, min: 4, w: 1 + d * 0.08 },
    ]
    let tanks = 0
    const maxTanks = 1 + Math.floor(d / 5)
    let guard = 0
    while (budget > 1.5 && guard++ < 200) {
      const av = opts.filter((o) => o.min <= d && o.cost <= budget + 1 && (o.k !== 'tank' || tanks < maxTanks))
      if (!av.length) break
      const tot = av.reduce((a, o) => a + o.w, 0)
      let r = Math.random() * tot
      let o = av[0]
      for (const x of av) {
        r -= x.w
        if (r <= 0) {
          o = x
          break
        }
      }
      budget -= o.cost
      if (o.k === 'swarm') {
        const n = 4 + Math.floor(d / 3)
        for (let i = 0; i < n; i++) q.push('swarm')
      } else q.push(o.k)
      if (o.k === 'tank') tanks++
    }
    return q
  }

  private bossMinions(): EnemyKind[] {
    if (this.arena === 0) return ['mutant', 'mutant', 'mutant', 'mutant']
    if (this.arena === 1) return ['soldier', 'soldier', 'mutant', 'mutant']
    return []
  }

  private eliteChance() {
    const d = this.diff()
    return d >= 4 ? Math.min(0.35, 0.05 + (d - 4) * 0.025) : 0
  }

  private updateWave(dt: number) {
    this.phaseT -= dt
    switch (this.phase) {
      case 'intro':
        if (this.phaseT <= 0) {
          this.phase = 'fight'
          if (((this.wave - 1) % 5) + 1 === 5) this.spawnBoss()
        }
        break
      case 'fight': {
        this.spawnT -= dt
        const alive = this.enemies.reduce((a, e) => a + (e.state !== 'dead' ? 1 : 0), 0)
        if (this.queue.length && this.spawnT <= 0 && alive < this.maxAlive) {
          const k = this.queue.shift() as EnemyKind
          this.spawnFromPoint(k)
          const d = this.diff()
          this.spawnT = k === 'swarm' ? 0.12 : Math.max(0.3, 1.25 - d * 0.05) * rand(0.6, 1.2)
        }
        if (!this.queue.length && alive === 0 && !this.boss) this.waveCleared()
        break
      }
      case 'bossdeath':
        if (this.boss && this.phaseT > 0.6 && Math.random() < dt * 14) {
          const b = this.boss
          this.explode(b.x + rand(-1, 1), rand(0.3, b.def.height), b.z + rand(-1, 1), 0, 1.6, true, null, true)
        }
        if (this.phaseT <= 0) {
          this.boss = null
          this.waveCleared()
        }
        break
      case 'cleared':
        if (this.phaseT <= 0 && this.pendingChoice) this.openChoice(this.pendingChoice.legendary)
        break
      case 'respite': {
        const n = Math.ceil(this.phaseT)
        if (n !== this.respiteN && n > 0 && n <= 3) {
          this.respiteN = n
          this.audio.select()
          this.showBanner(String(n), 'PREPARATE', '#ffd040', 0.9)
        }
        if (this.phaseT <= 0) {
          const local = ((this.wave - 1) % 5) + 1
          if (local === 5) {
            this.phase = 'transition'
            this.phaseT = 2.4
          } else this.startWave(this.wave + 1)
        }
        break
      }
      case 'transition': {
        // fundido a negro, cambio de arena y vuelta
        const t = 2.4 - this.phaseT
        this.fade = t < 0.9 ? t / 0.9 : t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) / 0.9)
        if (t >= 0.9 && this.arena === Math.floor((this.wave - 1) / 5) % 3) {
          const next = (this.arena + 1) % 3
          if (next === 0) this.cycle++
          this.loadArena(next)
          this.showBanner(ARENAS[next].label, this.cycle > 0 ? `CICLO ${this.cycle + 1}: MAS DUROS` : 'DESCIENDE MAS', '#ffffff', 2.4)
        }
        if (this.phaseT <= 0) {
          this.fade = 0
          this.startWave(this.wave + 1)
        }
        break
      }
    }
  }

  private waveCleared() {
    const bonus = 250 * this.wave
    let sub = `+${bonus.toLocaleString('en-US')}`
    this.score += bonus
    if (!this.tookDamage) {
      const nb = 750 * this.wave
      this.score += nb
      sub += `  IMPECABLE +${nb.toLocaleString('en-US')}`
    }
    const wasBoss = ((this.wave - 1) % 5) + 1 === 5
    this.showBanner(wasBoss ? 'JEFE DERROTADO' : 'OLEADA SUPERADA', sub, wasBoss ? '#ffc020' : '#40e070', 2.2)
    this.audio.waveClear()
    this.audio.setTrack('calm')
    this.phase = 'cleared'
    this.phaseT = 1.8
    this.pendingChoice = { legendary: wasBoss }
    // suministros de respiro
    const n = wasBoss ? 6 : 3
    for (let i = 0; i < n; i++) {
      const spot = this.level.freeSpotNear(this.px, this.pz, 5)
      this.dropPickup(spot.x, spot.z, true)
    }
    if (this.p.hp < this.p.maxHp * 0.5) {
      const spot = this.level.freeSpotNear(this.px, this.pz, 3)
      this.spawnPickup('medkit', spot.x, spot.z)
    }
    // las calcomanías y cadáveres se mantienen; limpiamos proyectiles enemigos
    this.projs = this.projs.filter((p) => p.fromPlayer)
  }

  private openChoice(legendary: boolean) {
    this.pendingChoice = null
    const cards = rollUpgrades({ s: this.stats, p: this.p }, this.taken, this.diff(), legendary)
    if (!cards.length) {
      this.afterChoice()
      return
    }
    this.choiceCards = cards
    this.keys.clear()
    this.mouseDown = false
    this.altDown = false
    this.touchFire = false
    this.releaseLock()
    this.audio.pickup('upgrade')
    this.cb.choice({
      title: legendary ? 'RECOMPENSA LEGENDARIA' : 'ELIGE UNA MEJORA',
      subtitle: legendary ? 'El jefe soltó tecnología prohibida.' : `Oleada ${this.wave} superada. Te vuelves más fuerte.`,
      legendary,
      cards: cards.map((u) => ({ id: u.id, name: u.name, desc: u.desc, rarity: u.rarity, icon: u.icon, level: (this.taken[u.id] ?? 0) + 1 })),
    })
    this.setScreen('upgrade')
  }

  choose(i: number) {
    if (this.screen !== 'upgrade') return
    const u = this.choiceCards[i]
    if (!u) return
    u.apply({ s: this.stats, p: this.p })
    this.taken[u.id] = (this.taken[u.id] ?? 0) + 1
    this.clampAmmo()
    this.audio.pickup('upgrade')
    this.pickFlash = 0.4
    this.faceMode = 'grin'
    this.faceT = 1.4
    this.msg = { text: u.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(), t: 2.5 }
    this.cb.choice(null)
    this.last = performance.now()
    this.setScreen('playing')
    this.requestLock()
    this.afterChoice()
  }

  private afterChoice() {
    this.phase = 'respite'
    this.phaseT = 4
    this.respiteN = -1
  }

  private spawnFromPoint(k: EnemyKind) {
    const L = this.level
    let best = L.spawns[0]
    let bestScore = -Infinity
    for (const s of L.spawns) {
      const d = Math.hypot(s.x - this.px, s.z - this.pz)
      const score = (d > 6 ? 10 : -20) + Math.random() * 12 - Math.abs(d - 12) * 0.3
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
    const spot = L.freeSpotNear(best.x, best.z, k === 'swarm' ? 1.2 : 0.6)
    const elite = k !== 'swarm' && Math.random() < this.eliteChance()
    this.spawnEnemy(k, spot.x, spot.z, elite, true)
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number, elite = false, warp = true): Enemy {
    const def = ENEMIES[kind]
    const w = this.wave
    const c = this.cycle
    let hpMul = (1 + 0.07 * (w - 1)) * (1 + c * 0.6)
    let dmgMul = (1 + 0.035 * (w - 1)) * (1 + c * 0.35)
    let speedMul = 1 + Math.min(0.25, c * 0.1)
    if (def.boss) hpMul = 1 + c * 0.8
    if (elite) {
      hpMul *= 2.2
      dmgMul *= 1.3
      speedMul *= 1.2
    }
    const hp = Math.round(def.hp * hpMul)
    const e: Enemy = {
      id: this.nextId++,
      def,
      kind,
      x,
      z,
      y: def.fly ?? 0,
      kx: 0,
      kz: 0,
      dx: 0,
      dz: 0,
      hp,
      maxHp: hp,
      elite,
      speedMul,
      dmgMul,
      state: warp ? 'warp' : 'move',
      t: warp ? (def.boss ? 1.6 : 0.65) : 0,
      anim: Math.random() * 4,
      atkCd: rand(0.8, 2),
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: rand(1, 3),
      los: false,
      losT: Math.random() * 0.2,
      deathT: 0,
      gibbed: false,
      flash: 0,
      move: 0,
      phase: 0,
      patT: 2,
      subT: 0,
      spin: 0,
      shield: false,
      chargeX: 0,
      chargeZ: 0,
      lastHitBy: null,
      moving: 0,
      growlT: rand(1, 5),
    }
    if (warp) {
      this.addFx('warp', x, 0, z, def.boss ? 4 : Math.max(1, def.height * 1.1))
      this.audio.spawn(this.pan(x, z))
    }
    this.enemies.push(e)
    return e
  }

  private spawnBoss() {
    const L = this.level
    const kind = (['boss1', 'boss2', 'boss3'] as EnemyKind[])[this.arena]
    const e = this.spawnEnemy(kind, L.boss.x, L.boss.z, false, true)
    this.boss = e
    this.trauma = 0.7
  }

  // =====================================================================
  // Armas
  // =====================================================================

  grantWeapon(w: WeaponId) {
    this.p.owned[w] = true
    const gift: Partial<Record<AmmoId, number>> = { bullets: 120, rockets: 12, cells: 150 }
    const def = WEAPON_BY_ID[w]
    if (def.ammo && gift[def.ammo]) this.p.ammo[def.ammo] += gift[def.ammo] as number
    this.clampAmmo()
    this.selectWeapon(w)
    this.faceMode = 'grin'
    this.faceT = 2
    this.audio.pickup('weapon')
    this.pickFlash = 0.5
    this.msg = { text: `NUEVA ARMA: ${def.label} (${def.slot})`, t: 3.5 }
  }

  maxAmmo(a: AmmoId) {
    return Math.round(AMMO_BASE[a] * this.stats.ammoMax)
  }

  private clampAmmo() {
    for (const k of Object.keys(this.p.ammo) as AmmoId[]) this.p.ammo[k] = Math.min(this.p.ammo[k], this.maxAmmo(k))
    this.p.hp = Math.min(this.p.hp, this.p.maxHp)
    this.p.armor = Math.min(this.p.armor, this.p.maxArmor)
  }

  hasAmmo(w: WeaponId, n = 1) {
    const d = WEAPON_BY_ID[w]
    if (!d.ammo) return true
    if (this.stats.infiniteBullets && d.ammo === 'bullets') return true
    return this.p.ammo[d.ammo] >= n
  }

  selectWeapon(w: WeaponId) {
    if (!this.p.owned[w] || (w === this.cur && !this.wNext)) return
    if (w === this.wNext) return
    this.wNext = w
    this.audio.weaponSwitch()
  }

  cycleWeapon(dir: number) {
    const ids = WEAPONS.map((w) => w.id).filter((id) => this.p.owned[id])
    const base = this.wNext ?? this.cur
    let i = ids.indexOf(base)
    for (let k = 0; k < ids.length; k++) {
      i = (i + dir + ids.length) % ids.length
      if (this.hasAmmo(ids[i])) break
    }
    this.selectWeapon(ids[i])
  }

  private autoSwitch() {
    const order: WeaponId[] = ['plasma', 'chaingun', 'shotgun', 'rocket', 'pistol']
    for (const w of order) if (this.p.owned[w] && this.hasAmmo(w) && w !== this.cur) return this.selectWeapon(w)
  }

  private updateWeapon(dt: number) {
    this.fireCd -= dt
    this.fireAnim += dt
    this.flashT -= dt
    this.kick = Math.max(0, this.kick - dt * 90)
    this.heat = Math.max(0, this.heat - dt * 1.5)
    if (this.wNext) {
      this.wLower = Math.min(1, this.wLower + dt * 7)
      if (this.wLower >= 1) {
        this.cur = this.wNext
        this.wNext = null
        this.fireAnim = 9
      }
    } else if (this.wLower > 0) this.wLower = Math.max(0, this.wLower - dt * 6)
    if (this.dead) return
    const firing = this.mouseDown || this.touchFire || this.keys.has('Space') || this.keys.has('ControlLeft')
    const alt = this.altDown || this.touchAlt || this.keys.has('KeyE')
    if (this.cur === 'chaingun' && firing) this.spin += dt * 30
    if (firing || alt) {
      this.angryT += dt
      if (this.wLower < 0.2 && !this.wNext && this.fireCd <= 0) this.fire(alt)
    } else this.angryT = 0
  }

  private fire(alt: boolean) {
    const def = WEAPON_BY_ID[this.cur]
    const s = this.stats
    let pellets = def.pellets
    let spread = def.spread
    let cost = 1
    let rate = def.rate
    let double = false
    if (this.cur === 'shotgun') pellets += s.extraPellets
    if (alt && this.cur === 'shotgun' && s.doubleBarrel && this.hasAmmo('shotgun', 2)) {
      double = true
      pellets *= 2
      spread *= 1.45
      cost = 2
      rate *= 1.45
    }
    if (this.cur === 'chaingun') spread += this.heat * 0.03
    if (!this.hasAmmo(this.cur, cost)) {
      this.audio.click()
      this.fireCd = 0.3
      this.autoSwitch()
      return
    }
    if (def.ammo) {
      const free = (s.infiniteBullets && def.ammo === 'bullets') || Math.random() < s.saver
      if (!free) this.p.ammo[def.ammo] -= cost
    }
    const rateMul = s.rate * (this.frenzyT > 0 ? 1.4 : 1)
    this.fireCd = rate / rateMul
    this.fireAnim = 0
    this.flashT = 0.07
    this.kick = def.kick * (double ? 1.5 : 1)
    this.shots++
    this.trauma = Math.min(1, this.trauma + def.shake * (double ? 1.6 : 1))
    if (this.cur === 'chaingun') this.heat = Math.min(1, this.heat + 0.08)
    switch (this.cur) {
      case 'pistol':
        this.audio.pistol()
        break
      case 'shotgun':
        this.audio.shotgun(double)
        break
      case 'chaingun':
        this.audio.chaingun()
        break
      case 'rocket':
        this.audio.rocketLaunch()
        break
      case 'plasma':
        this.audio.plasma()
        break
    }
    // empuje del retroceso
    if (double) {
      this.pvx -= Math.cos(this.yaw) * 2.5
      this.pvz -= Math.sin(this.yaw) * 2.5
    }
    if (def.projectile) {
      const kind: ProjKind = this.cur === 'rocket' ? 'rocket' : 'plasma'
      const a = this.yaw + (Math.random() - 0.5) * 2 * spread
      const dmgMul = s.dmg[this.cur] * s.allDmg
      const ox = this.px + Math.cos(this.yaw) * 0.35 + Math.cos(this.yaw + Math.PI / 2) * 0.08
      const oz = this.pz + Math.sin(this.yaw) * 0.35 + Math.sin(this.yaw + Math.PI / 2) * 0.08
      this.spawnProj(kind, ox, EYE - 0.12, oz, Math.cos(a) * def.speed, 0, Math.sin(a) * def.speed, true, def.dmg * dmgMul, {
        splash: def.splash * dmgMul,
        splashR: def.splashR * (1 + (s.dmg.rocket - 1) * 0.3),
        bounces: kind === 'plasma' ? s.bounce : 0,
        weapon: this.cur,
        life: 3,
        r: kind === 'rocket' ? 0.14 : 0.1,
      })
    } else {
      this.hitscan(def.id, pellets, spread, def.dmg, def.knock)
    }
    if (def.ammo && !this.hasAmmo(this.cur)) this.autoSwitch()
  }

  private hitscan(w: WeaponId, pellets: number, spread: number, dmg: number, knock: number) {
    const s = this.stats
    const L = this.level
    let anyHit = false
    const pierce = w === 'pistol' || w === 'chaingun' ? s.pierce : 0
    const assist = this.touch ? 0.16 : 0.04
    const normal = { nx: 0, nz: 0 }
    const hitsTmp: { t: number; e: Enemy | null; b: Barrel | null }[] = []
    for (let i = 0; i < pellets; i++) {
      const a = this.yaw + (pellets > 1 ? (Math.random() - 0.5) * 2 * spread : (Math.random() - 0.5) * 2 * spread)
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      const wallD = L.rayWall(this.px, this.pz, dx, dz, 48, normal)
      hitsTmp.length = 0
      for (const e of this.enemies) {
        if (e.state === 'dead') continue
        const t = rayCircle(this.px, this.pz, dx, dz, e.x, e.z, e.def.radius + assist)
        if (t > 0 && t < wallD) hitsTmp.push({ t, e, b: null })
      }
      for (const b of this.barrels) {
        if (!b.alive) continue
        const t = rayCircle(this.px, this.pz, dx, dz, b.x, b.z, 0.32)
        if (t > 0 && t < wallD) hitsTmp.push({ t, e: null, b })
      }
      hitsTmp.sort((p, q) => p.t - q.t)
      let left = 1 + pierce
      let stopped = false
      for (const h of hitsTmp) {
        if (left <= 0) break
        const hx = this.px + dx * h.t
        const hz = this.pz + dz * h.t
        if (h.b) {
          h.b.hp -= dmg
          h.b.flash = 0.08
          if (h.b.hp <= 0 && h.b.fuse <= 0) h.b.fuse = 0.08
          this.addFx('puff', hx, 0.4, hz, 0.3)
          stopped = true
          break
        }
        const e = h.e as Enemy
        let d = dmg * s.dmg[w] * s.allDmg
        if (w === 'shotgun' && s.berserk && h.t < 3) d *= 2
        const crit = s.crit > 0 && Math.random() < s.crit
        if (crit) d *= 2.5
        const hy = e.y + e.def.height * rand(0.35, 0.8)
        this.damageEnemy(e, d, w, dx * knock, dz * knock, false)
        this.bleed(hx - dx * 0.1, hy, hz - dz * 0.1, e, crit ? 6 : 2, dx, dz)
        if (crit) this.floaters.push({ x: hx, y: hy + 0.3, z: hz, text: 'CRITICO', color: '#ffd040', t: 0.8, big: false })
        anyHit = true
        left--
        if (left <= 0) stopped = true
      }
      if (!stopped) {
        // impacto en el muro
        const wx = this.px + dx * (wallD - 0.04)
        const wz = this.pz + dz * (wallD - 0.04)
        const wy = EYE + (Math.random() - 0.5) * 0.25
        this.addFx('puff', wx, wy - 0.15, wz, 0.28)
        if (Math.random() < 0.5) this.sparks(wx, wy, wz, normal.nx, normal.nz, 3, 0xffd080)
        if (i === 0 && Math.random() < 0.3) this.audio.ricochet(this.pan(wx, wz))
      }
    }
    if (anyHit) {
      this.hits++
      this.hitMark = 0.12
    }
  }

  // =====================================================================
  // Proyectiles
  // =====================================================================

  spawnProj(
    kind: ProjKind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    fromPlayer: boolean,
    dmg: number,
    o: Partial<Pick<Proj, 'splash' | 'splashR' | 'bounces' | 'homing' | 'gravity' | 'life' | 'r' | 'weapon'>> = {},
  ) {
    if (this.projs.length > 260) return
    this.projs.push({
      kind,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      fromPlayer,
      dmg,
      splash: o.splash ?? 0,
      splashR: o.splashR ?? 0,
      life: o.life ?? 5,
      bounces: o.bounces ?? 0,
      homing: o.homing ?? 0,
      r: o.r ?? 0.12,
      trailT: 0,
      gravity: o.gravity ?? 0,
      weapon: o.weapon ?? null,
      counted: false,
    })
  }

  private updateProjs(dt: number) {
    const L = this.level
    const ceil = L.def.ceil
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]
      p.life -= dt
      if (p.life <= 0) {
        if (p.splash > 0) this.impact(p, null)
        this.projs.splice(i, 1)
        continue
      }
      if (p.homing > 0) {
        let tx = this.px
        let tz = this.pz
        if (p.fromPlayer) {
          const t = this.nearestEnemy(p.x, p.z, 8)
          if (t) {
            tx = t.x
            tz = t.z
          }
        }
        const sp = Math.hypot(p.vx, p.vz)
        const cur = Math.atan2(p.vz, p.vx)
        const want = Math.atan2(tz - p.z, tx - p.x)
        const na = cur + clamp(angDiff(cur, want), -p.homing * dt, p.homing * dt)
        p.vx = Math.cos(na) * sp
        p.vz = Math.sin(na) * sp
      }
      p.vy -= p.gravity * dt
      const nx = p.x + p.vx * dt
      const ny = p.y + p.vy * dt
      const nz = p.z + p.vz * dt
      // muros
      const cx = Math.floor(nx)
      const cz = Math.floor(nz)
      const ch = L.chars[cz]?.[cx] ?? '#'
      const lowH = ch === 'c' ? 0.8 : ch === 'O' ? 0.45 : 0
      if (L.isOpaque(cx, cz) || (lowH > 0 && ny < lowH)) {
        if (p.bounces > 0) {
          p.bounces--
          const ox = Math.floor(p.x)
          const oz = Math.floor(p.z)
          if (cx !== ox) p.vx = -p.vx
          if (cz !== oz) p.vz = -p.vz
          if (cx === ox && cz === oz) p.vy = -p.vy
          this.addFx('zap', p.x, p.y, p.z, 0.3)
          continue
        }
        this.impact(p, null)
        this.projs.splice(i, 1)
        continue
      }
      if (ny <= 0.03 || ny >= ceil - 0.05) {
        p.y = clamp(ny, 0.04, ceil - 0.06)
        p.x = nx
        p.z = nz
        this.impact(p, null)
        this.projs.splice(i, 1)
        continue
      }
      p.x = nx
      p.y = ny
      p.z = nz
      // estelas
      p.trailT -= dt
      if (p.trailT <= 0) {
        if (p.kind === 'rocket' || p.kind === 'missile' || p.kind === 'mini') {
          p.trailT = 0.025
          this.particle(p.x, p.y, p.z, rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3), 0.5, 0.09, 0x6a6a6a, 0, -0.5)
          this.particle(p.x, p.y, p.z, 0, 0, 0, 0.12, 0.08, 0xffa030, 1, 0)
        } else if (p.kind === 'plasma' || p.kind === 'orb') {
          p.trailT = 0.04
          this.particle(p.x, p.y, p.z, 0, 0, 0, 0.18, 0.06, p.kind === 'orb' ? 0xff40e0 : 0x60d0ff, 1, 0)
        } else if (p.kind === 'acid') {
          p.trailT = 0.06
          this.particle(p.x, p.y, p.z, 0, -0.5, 0, 0.3, 0.05, 0x80ff40, 1, 4)
        }
      }
      // colisiones con entidades
      if (p.fromPlayer) {
        let hit: Enemy | null = null
        for (const e of this.enemies) {
          if (e.state === 'dead') continue
          const rr = e.def.radius + p.r
          const dx = e.x - p.x
          const dz = e.z - p.z
          if (dx * dx + dz * dz < rr * rr && p.y > e.y - 0.1 && p.y < e.y + e.def.height + 0.1) {
            hit = e
            break
          }
        }
        if (hit) {
          this.impact(p, hit)
          this.projs.splice(i, 1)
          continue
        }
        let hb = false
        for (const b of this.barrels) {
          if (!b.alive) continue
          if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < (0.32 + p.r) ** 2 && p.y < 0.9) {
            b.hp -= p.dmg
            if (b.hp <= 0 && b.fuse <= 0) b.fuse = 0.05
            hb = true
            break
          }
        }
        if (hb) {
          this.impact(p, null)
          this.projs.splice(i, 1)
          continue
        }
      } else {
        const dx = this.px - p.x
        const dz = this.pz - p.z
        const rr = PLAYER_R + p.r
        if (!this.dead && dx * dx + dz * dz < rr * rr && p.y < 1.3) {
          if (p.splash <= 0) this.hurtPlayer(p.dmg, p.x - p.vx, p.z - p.vz)
          this.impact(p, null)
          this.projs.splice(i, 1)
          continue
        }
      }
    }
  }

  private impact(p: Proj, target: Enemy | null) {
    const s = this.stats
    if (p.fromPlayer && !p.counted && p.weapon) {
      p.counted = true
    }
    if (target && p.fromPlayer) {
      this.damageEnemy(target, p.dmg, p.weapon, p.vx * 0.04, p.vz * 0.04, false)
      if (p.weapon) {
        this.hits++
        this.hitMark = 0.12
      }
      if (p.kind === 'plasma') this.bleed(p.x, p.y, p.z, target, 1, p.vx / 30, p.vz / 30)
      // tormenta de plasma
      if (p.kind === 'plasma' && s.chain > 0) {
        let from = target
        const done = new Set<Enemy>([target])
        for (let k = 0; k < s.chain; k++) {
          let best: Enemy | null = null
          let bd = 25
          for (const e of this.enemies) {
            if (e.state === 'dead' || done.has(e)) continue
            const d = (e.x - from.x) ** 2 + (e.z - from.z) ** 2
            if (d < bd) {
              bd = d
              best = e
            }
          }
          if (!best) break
          done.add(best)
          this.lightning(from.x, from.y + from.def.height * 0.6, from.z, best.x, best.y + best.def.height * 0.6, best.z)
          this.damageEnemy(best, p.dmg * 0.6, 'plasma', 0, 0, false)
          from = best
        }
        this.audio.zap(this.pan(target.x, target.z))
      }
    }
    if (p.splash > 0) {
      this.explode(p.x, p.y, p.z, p.splash, p.splashR, p.fromPlayer, p.weapon, false, p.kind === 'acid' ? 'acid' : undefined)
      if (p.kind === 'rocket' && p.fromPlayer && s.split > 0) {
        for (let k = 0; k < s.split; k++) {
          const a = (k / s.split) * Math.PI * 2 + Math.random()
          this.spawnProj('mini', p.x - p.vx * 0.01, Math.max(0.3, p.y), p.z - p.vz * 0.01, Math.cos(a) * 4, 4, Math.sin(a) * 4, true, 0, {
            splash: 45 * s.allDmg * s.dmg.rocket,
            splashR: 1.6,
            gravity: 12,
            life: 1.6,
            r: 0.08,
            weapon: 'rocket',
          })
        }
      }
      return
    }
    switch (p.kind) {
      case 'plasma':
      case 'orb':
        this.addFx('zap', p.x, p.y - 0.15, p.z, 0.4)
        this.sparks(p.x, p.y, p.z, 0, 0, 4, p.kind === 'orb' ? 0xff60e0 : 0x80e0ff)
        break
      case 'bullet':
        this.addFx('puff', p.x, p.y - 0.1, p.z, 0.25)
        break
      case 'rock':
        for (let i = 0; i < 4; i++) this.particle(p.x, p.y, p.z, rand(-2, 2), rand(1, 3), rand(-2, 2), 0.8, 0.07, 0x6a5a4a, 0, 9)
        this.audio.stomp()
        break
    }
  }

  explode(
    x: number,
    y: number,
    z: number,
    dmg: number,
    radius: number,
    fromPlayer: boolean,
    weapon: WeaponId | null,
    visualOnly = false,
    style?: 'acid',
  ) {
    const acid = style === 'acid'
    if (acid) {
      this.addFx('acid', x, Math.max(0, y - 0.3), z, radius * 0.9)
      this.decal('d_acid', x, z, radius * 1.4, 1, 8)
      for (let i = 0; i < 10; i++) this.particle(x, y + 0.1, z, rand(-2, 2), rand(1, 3.5), rand(-2, 2), 0.6, 0.06, 0x80ff40, 1, 9)
      this.audio.splat(this.pan(x, z))
    } else {
      this.addFx('expl', x, Math.max(0, y - radius * 0.45), z, radius * 1.15, 6)
      this.decal('d_scorch', x, z, radius * 1.3, 0, 30)
      for (let i = 0; i < 14; i++)
        this.particle(x, y, z, rand(-5, 5), rand(1, 6), rand(-5, 5), rand(0.3, 0.8), rand(0.04, 0.08), Math.random() < 0.5 ? 0xffc040 : 0xff6010, 1, 12)
      for (let i = 0; i < 6; i++) this.particle(x, y, z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.8, 1.4), rand(0.15, 0.3), 0x4a4440, 0, -0.6)
      const d = Math.hypot(x - this.px, z - this.pz)
      const vol = clamp(1.3 - d / 18, 0.15, 1.3)
      this.audio.explosion(radius / 2.5, this.pan(x, z), vol)
      this.trauma = Math.min(1, this.trauma + Math.max(0, 0.7 - d / (radius * 5)))
      if (d < radius * 2.5) this.whiteFlash = Math.max(this.whiteFlash, 0.25)
    }
    if (visualOnly) return
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const dx = e.x - x
      const dz = e.z - z
      const d = Math.sqrt(dx * dx + dz * dz)
      const R = radius + e.def.radius
      if (d >= R) continue
      if (!fromPlayer) continue
      const f = 1 - (d / R) * 0.6
      const k = 5 * f
      const nd = d || 1
      this.damageEnemy(e, dmg * f, weapon, (dx / nd) * k, (dz / nd) * k, true)
    }
    for (const b of this.barrels) {
      if (!b.alive) continue
      const d = Math.hypot(b.x - x, b.z - z)
      if (d < radius + 0.3) {
        b.hp -= dmg
        if (b.hp <= 0 && b.fuse <= 0) b.fuse = 0.12 + Math.random() * 0.1
      }
    }
    const dp = Math.hypot(this.px - x, this.pz - z)
    if (dp < radius + PLAYER_R && Math.abs(y - EYE) < radius + 0.8) {
      const f = 1 - (dp / (radius + PLAYER_R)) * 0.6
      const pd = fromPlayer ? dmg * f * 0.3 : dmg * f
      if (pd > 0.5) this.hurtPlayer(pd, x, z)
      const nd = dp || 1
      this.pvx += ((this.px - x) / nd) * 5 * f
      this.pvz += ((this.pz - z) / nd) * 5 * f
    }
  }

  private lightning(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const j = i > 0 && i < n ? 0.15 : 0
      this.particle(
        x0 + (x1 - x0) * t + rand(-j, j),
        y0 + (y1 - y0) * t + rand(-j, j),
        z0 + (z1 - z0) * t + rand(-j, j),
        0,
        0,
        0,
        0.15,
        0.07,
        0xa0f0ff,
        1,
        0,
      )
    }
  }

  // =====================================================================
  // Daño
  // =====================================================================

  pan(x: number, z: number) {
    const dx = x - this.px
    const dz = z - this.pz
    const d = Math.hypot(dx, dz) || 1
    return ((dx / d) * -Math.sin(this.yaw) + (dz / d) * Math.cos(this.yaw)) * 0.8
  }

  damageEnemy(e: Enemy, dmg: number, weapon: WeaponId | null, kx: number, kz: number, explosive: boolean) {
    if (e.state === 'dead') return
    if (e.shield) {
      this.addFx('zap', e.x, e.y + e.def.height * 0.5, e.z, 0.6)
      this.audio.metalHit(this.pan(e.x, e.z))
      return
    }
    e.hp -= dmg
    e.flash = 0.07
    e.lastHitBy = weapon
    if (weapon && this.stats.lifesteal > 0 && !this.dead) this.p.hp = Math.min(this.p.maxHp, this.p.hp + dmg * this.stats.lifesteal)
    const m = e.def.mass
    e.kx += kx / m
    e.kz += kz / m
    if (e.hp <= 0) {
      this.killEnemy(e, -e.hp, explosive)
      return
    }
    if (e.def.boss) {
      if (e.kind === 'boss2' && Math.random() < 0.3) this.sparks(e.x, e.y + 1.4, e.z, 0, 0, 2, 0xffe080)
      if (Math.random() < 0.25) this.audio.metalHit(this.pan(e.x, e.z))
      return
    }
    const ch = e.def.pain * Math.min(1, dmg / (e.maxHp * 0.3) + 0.25)
    if (e.state !== 'charge' && e.state !== 'warp' && Math.random() < ch) {
      e.state = 'pain'
      e.t = e.kind === 'tank' ? 0.3 : 0.2
      this.audio.enemyPain(e.kind, this.pan(e.x, e.z))
    } else if (Math.random() < 0.3) this.audio.fleshHit(this.pan(e.x, e.z))
  }

  private killEnemy(e: Enemy, overkill: number, explosive: boolean) {
    e.state = 'dead'
    e.deathT = 0
    e.kx *= 0.5
    e.kz *= 0.5
    const boss = !!e.def.boss
    const gib = !boss && (e.kind === 'swarm' || (explosive && overkill > 8) || (overkill > e.maxHp * 0.7 && e.kind !== 'tank'))
    e.gibbed = gib
    const by = e.lastHitBy
    if (by) this.killsBy[by]++
    this.kills++
    // puntuación con racha
    this.chain++
    this.chainT = 3
    const mult = this.mult()
    const pts = Math.round(e.def.score * (e.elite ? 2.5 : 1) * (1 + this.cycle * 0.5)) * mult
    this.score += pts
    this.floaters.push({
      x: e.x,
      y: e.y + e.def.height + 0.15,
      z: e.z,
      text: mult > 1 ? `+${pts} X${mult}` : `+${pts}`,
      color: e.elite ? '#ff8a40' : mult >= 4 ? '#ffd040' : '#ffffff',
      t: 1.1,
      big: boss,
    })
    if (this.chain > 0 && this.chain % 5 === 0 && mult > 1) {
      this.msg = { text: `RACHA X${mult}`, t: 1.6 }
      this.audio.select()
    }
    this.killMark = 0.25
    this.audio.enemyDeath(e.kind, this.pan(e.x, e.z), gib)
    if (gib) {
      const n = e.kind === 'swarm' ? 3 : 9
      for (let i = 0; i < n; i++) {
        const f = this.atlas.named['gib' + (i % 4)]
        this.particles.push({
          x: e.x,
          y: e.y + e.def.height * 0.5,
          z: e.z,
          vx: rand(-3.5, 3.5) + e.kx * 0.3,
          vy: rand(2, 6),
          vz: rand(-3.5, 3.5) + e.kz * 0.3,
          life: rand(4, 7),
          max: 7,
          frame: f,
          size: rand(0.14, 0.24),
          r: 1,
          g: 1,
          b: 1,
          full: 0,
          grav: 14,
          stain: true,
        })
      }
      this.bleed(e.x, e.y + e.def.height * 0.5, e.z, e, 14, 0, 0)
      this.decal('d_blood', e.x, e.z, e.kind === 'swarm' ? 0.6 : 1.4, 0, 60)
    } else if (!boss) {
      this.decal('d_blood', e.x, e.z, e.def.radius * 3, 0, 60)
    }
    // botín
    if (!boss) {
      const chance = { mutant: 0.2, soldier: 0.42, spitter: 0.32, tank: 1, swarm: 0.04, boss1: 1, boss2: 1, boss3: 1 }[e.kind]
      const n = e.kind === 'tank' ? 2 : 1
      for (let i = 0; i < n; i++)
        if (e.elite || Math.random() < chance * (this.stats.magnet ? 1.25 : 1)) this.dropPickup(e.x + rand(-0.3, 0.3), e.z + rand(-0.3, 0.3), false)
    }
    // mejoras al matar
    const s = this.stats
    if (s.frenzy) this.frenzyT = 3
    if (s.armorOnKill) this.p.armor = Math.min(this.p.maxArmor, this.p.armor + s.armorOnKill)
    if (!boss && s.killBlast > 0 && Math.random() < s.killBlast)
      this.pendingBlasts.push({ x: e.x, z: e.z, t: 0.12, dmg: 55 * s.allDmg })
    if (this.chain >= 3 && Math.random() < 0.3) {
      this.faceMode = 'grin'
      this.faceT = 0.8
    }
    if (boss) {
      this.hitstop = 0.18
      this.trauma = 1
      this.phase = 'bossdeath'
      this.phaseT = 3
      this.score += 0
      this.whiteFlash = 0.6
      this.audio.bossRoar(e.kind)
      // recompensas grandes
      for (let i = 0; i < 4; i++) {
        const sp = this.level.freeSpotNear(e.x, e.z, 2.5)
        this.spawnPickup(i % 2 ? 'medkit' : 'vest', sp.x, sp.z)
      }
      // matar a los esbirros que queden
      for (const o of this.enemies) if (o !== e && o.state !== 'dead') this.killEnemy(o, 99, true)
      this.queue = []
      if (e.kind === 'boss1' && !this.p.owned.plasma) this.grantWeapon('plasma')
    } else if (by === 'shotgun' && gib) {
      this.hitstop = Math.max(this.hitstop, 0.035)
    }
  }

  mult() {
    return Math.min(8, 1 + Math.floor(this.chain / 5))
  }

  hurtPlayer(dmg: number, sx: number, sz: number) {
    if (this.dead || this.invuln > 0 || this.screen !== 'playing') return
    let d = dmg
    if (this.p.armor > 0) {
      const ab = Math.min(this.p.armor, d * 0.45)
      this.p.armor -= ab
      d -= ab
    }
    this.p.hp -= d
    this.tookDamage = true
    this.regenT = 0
    this.hurtFlash = Math.min(0.75, this.hurtFlash + 0.18 + dmg / 45)
    this.trauma = Math.min(1, this.trauma + 0.18 + dmg / 70)
    this.dmgDirs.push({ a: Math.atan2(sz - this.pz, sx - this.px), t: 1 })
    if (this.dmgDirs.length > 6) this.dmgDirs.shift()
    this.faceMode = 'pain'
    this.faceT = 0.5
    const rel = angDiff(this.yaw, Math.atan2(sz - this.pz, sx - this.px))
    this.faceLook = Math.abs(rel) < 0.5 ? 0 : rel > 0 ? 1 : -1
    this.faceLookT = 0.8
    this.audio.hurt()
    this.chain = Math.max(0, this.chain - 5)
    this.invuln = 0.05
    if (this.stats.shock && this.p.hp < this.p.maxHp * 0.3 && this.shockCd <= 0) this.shockwave()
    if (this.p.hp <= 0) {
      if (this.stats.revive > 0) {
        this.stats.revive--
        this.p.hp = this.p.maxHp * 0.6
        this.shockwave()
        this.showBanner('SEGUNDA OPORTUNIDAD', 'DE PIE, SOLDADO', '#ffc020', 2)
        this.invuln = 1.5
        return
      }
      this.die()
    }
  }

  private shockwave() {
    this.shockCd = 20
    this.audio.shockwave()
    this.addFx('ring', this.px, 0.05, this.pz, 6)
    this.whiteFlash = 0.5
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const dx = e.x - this.px
      const dz = e.z - this.pz
      const d = Math.hypot(dx, dz)
      if (d < 4.5) {
        const f = 1 - d / 4.5
        this.damageEnemy(e, 150 * f + 30, null, (dx / (d || 1)) * 14 * f, (dz / (d || 1)) * 14 * f, true)
      }
    }
    for (const p of this.projs) if (!p.fromPlayer && Math.hypot(p.x - this.px, p.z - this.pz) < 5) p.life = 0
  }

  private die() {
    this.dead = true
    this.deathT = 0
    this.p.hp = 0
    this.audio.playerDeath()
    this.audio.setTrack(null)
    this.trauma = 0.8
    this.hurtFlash = 0.8
    this.mouseDown = false
    this.touchFire = false
  }

  private finishRun() {
    const newBest = saveBest(GAME_ID, this.score)
    this.best = Math.max(this.best, this.score)
    let fav: WeaponId = 'pistol'
    for (const w of WEAPONS) if (this.killsBy[w.id] > this.killsBy[fav]) fav = w.id
    this.releaseLock()
    this.audio.setTrack('calm')
    this.audio.setDuck(0.6)
    this.cb.over({
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      accuracy: this.shots ? Math.round((this.hits / this.shots) * 100) : 0,
      favorite: this.kills ? WEAPON_BY_ID[fav].name : '—',
      time: this.time,
      newBest,
      best: this.best,
    })
    this.setScreen('gameover')
  }

  heal(n: number) {
    this.p.hp = Math.min(this.p.maxHp, this.p.hp + n)
  }

  // =====================================================================
  // Objetos
  // =====================================================================

  private dropPickup(x: number, z: number, supply: boolean) {
    const p = this.p
    const opts: [PickupKind, number][] = [
      ['shells', p.ammo.shells < this.maxAmmo('shells') * 0.5 ? 4 : 2],
      ['stim', p.hp < p.maxHp * 0.6 ? 4 : 1],
      ['medkit', p.hp < p.maxHp * 0.4 ? 3 : supply ? 1 : 0.4],
      ['shard', 1.5],
      ['vest', supply ? 0.6 : 0.15],
    ]
    if (p.owned.chaingun) opts.push(['bullets', p.ammo.bullets < this.maxAmmo('bullets') * 0.5 ? 4 : 2])
    else opts.push(['bullets', 0.6])
    if (p.owned.rocket) opts.push(['rockets', p.ammo.rockets < 6 ? 3 : 1.2])
    if (p.owned.plasma) opts.push(['cells', p.ammo.cells < 80 ? 3 : 1.4])
    const tot = opts.reduce((a, o) => a + o[1], 0)
    let r = Math.random() * tot
    for (const [k, w] of opts) {
      r -= w
      if (r <= 0) return this.spawnPickup(k, x, z)
    }
    this.spawnPickup('shells', x, z)
  }

  spawnPickup(kind: PickupKind, x: number, z: number) {
    if (this.level.isSolid(x, z)) {
      const s = this.level.freeSpotNear(x, z, 1.5)
      x = s.x
      z = s.z
    }
    this.pickups.push({ kind, x, z, y: 0.5, vy: 2.5, t: 0 })
  }

  private updatePickups(dt: number) {
    const s = this.stats
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i]
      it.t += dt
      if (it.y > 0 || it.vy > 0) {
        it.vy -= 12 * dt
        it.y = Math.max(0, it.y + it.vy * dt)
        if (it.y === 0) it.vy = 0
      }
      const dx = this.px - it.x
      const dz = this.pz - it.z
      const d = Math.hypot(dx, dz)
      if (s.magnet && d < 4.5 && d > 0.1 && this.wants(it.kind)) {
        it.x += (dx / d) * dt * 9
        it.z += (dz / d) * dt * 9
      }
      if (d < 0.7 && !this.dead && this.collect(it)) this.pickups.splice(i, 1)
    }
    if (this.pickups.length > 40) this.pickups.splice(0, this.pickups.length - 40)
  }

  private wants(k: PickupKind): boolean {
    const p = this.p
    switch (k) {
      case 'medkit':
      case 'stim':
        return p.hp < p.maxHp
      case 'shard':
      case 'vest':
        return p.armor < p.maxArmor
      default:
        return p.ammo[k] < this.maxAmmo(k)
    }
  }

  private collect(it: Pickup): boolean {
    if (!this.wants(it.kind)) return false
    const p = this.p
    let text = ''
    let snd: 'health' | 'armor' | 'ammo' = 'ammo'
    switch (it.kind) {
      case 'medkit':
        this.heal(25)
        text = 'BOTIQUIN +25'
        snd = 'health'
        break
      case 'stim':
        this.heal(10)
        text = 'ESTIMULANTE +10'
        snd = 'health'
        break
      case 'shard':
        p.armor = Math.min(p.maxArmor, p.armor + 10)
        text = 'BLINDAJE +10'
        snd = 'armor'
        break
      case 'vest':
        p.armor = Math.min(p.maxArmor, p.armor + 50)
        text = 'CHALECO +50'
        snd = 'armor'
        break
      default: {
        const n = AMMO_PICK[it.kind]
        p.ammo[it.kind] = Math.min(this.maxAmmo(it.kind), p.ammo[it.kind] + n)
        const names: Record<AmmoId, string> = { bullets: 'BALAS', shells: 'CARTUCHOS', rockets: 'COHETES', cells: 'CELDAS' }
        text = `${names[it.kind]} +${n}`
      }
    }
    this.msg = { text, t: 1.6 }
    this.pickFlash = Math.max(this.pickFlash, 0.22)
    this.audio.pickup(snd)
    return true
  }

  // =====================================================================
  // Partículas y efectos
  // =====================================================================

  particle(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, full: number, grav: number, stain = false) {
    if (this.particles.length > 700) return
    this.particles.push({
      x,
      y,
      z,
      vx,
      vy,
      vz,
      life,
      max: life,
      frame: full ? this.atlas.named.glow : this.atlas.named.solid,
      size,
      r: ((color >> 16) & 255) / 255,
      g: ((color >> 8) & 255) / 255,
      b: (color & 255) / 255,
      full,
      grav,
      stain,
    })
  }

  bleed(x: number, y: number, z: number, e: Enemy, n: number, dx: number, dz: number) {
    const robot = e.kind === 'boss2'
    const col = robot ? 0xffd060 : e.kind === 'spitter' ? 0x8a9a20 : e.kind === 'swarm' ? 0x6a2a8a : 0xa01010
    this.addFx(robot ? 'puff' : 'blood', x, y - 0.12, z, 0.32)
    for (let i = 0; i < n; i++)
      this.particle(
        x,
        y,
        z,
        dx * rand(1, 3) + rand(-1.4, 1.4),
        rand(0.5, 3),
        dz * rand(1, 3) + rand(-1.4, 1.4),
        rand(0.4, 0.9),
        rand(0.04, 0.07),
        col,
        robot ? 1 : 0,
        12,
        !robot,
      )
  }

  sparks(x: number, y: number, z: number, nx: number, nz: number, n: number, color: number) {
    for (let i = 0; i < n; i++)
      this.particle(x, y, z, nx * rand(1, 3) + rand(-1.5, 1.5), rand(0, 2.5), nz * rand(1, 3) + rand(-1.5, 1.5), rand(0.15, 0.35), 0.035, color, 1, 9)
  }

  addFx(kind: 'expl' | 'puff' | 'blood' | 'zap' | 'acid' | 'warp' | 'ring', x: number, y: number, z: number, size: number, light = 0) {
    const N = this.atlas.named
    let frames: number[]
    let dur = 0.24
    let full = true
    switch (kind) {
      case 'expl':
        frames = [0, 1, 2, 3, 4].map((i) => N['expl' + i])
        dur = 0.5
        break
      case 'warp':
        frames = [0, 1, 2, 3, 2, 1, 0].map((i) => N['warp' + i])
        dur = 0.7
        break
      case 'ring':
        frames = [N.d_ring]
        dur = 0.35
        break
      default:
        frames = [0, 1, 2].map((i) => N[kind + i])
        dur = 0.22
        full = kind !== 'blood'
    }
    if (this.fx.length > 120) this.fx.shift()
    this.fx.push({ x, y, z, frames, t: 0, dur, size, full, light })
  }

  decal(name: string, x: number, z: number, size: number, full: number, life: number) {
    this.decals.push({ x, z, frame: this.atlas.named[name], size, full, life })
    if (this.decals.length > 90) this.decals.shift()
  }

  private updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.vy -= p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.grav > 0 && p.y < 0.02) {
        p.y = 0.02
        if (p.stain && p.frame !== this.atlas.named.solid) {
          // vísceras: rebotan y se quedan
          p.vy = Math.abs(p.vy) > 1.5 ? -p.vy * 0.3 : 0
          p.vx *= 0.6
          p.vz *= 0.6
        } else {
          if (p.stain && Math.random() < 0.35) this.decal('d_blood', p.x, p.z, rand(0.2, 0.4), 0, 40)
          p.life = 0
        }
      }
      if (p.grav > 0 && this.level.isSolid(p.x, p.z) && p.y < 0.9) {
        p.vx = -p.vx * 0.3
        p.vz = -p.vz * 0.3
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].t += dt
      if (this.fx[i].t >= this.fx[i].dur) this.fx.splice(i, 1)
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].life -= dt
      if (this.decals[i].life <= 0) this.decals.splice(i, 1)
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.t -= dt
      f.y += dt * 0.5
      if (f.t <= 0) this.floaters.splice(i, 1)
    }
    for (let i = this.pendingBlasts.length - 1; i >= 0; i--) {
      const b = this.pendingBlasts[i]
      b.t -= dt
      if (b.t <= 0) {
        this.pendingBlasts.splice(i, 1)
        this.explode(b.x, 0.5, b.z, b.dmg, 2, true, null)
      }
    }
    // barriles con mecha
    for (const b of this.barrels) {
      b.flash -= dt
      if (b.alive && b.fuse > 0) {
        b.fuse -= dt
        if (b.fuse <= 0) {
          b.alive = false
          this.explode(b.x, 0.45, b.z, 130, 2.8, true, null)
        }
      }
    }
  }

  nearestEnemy(x: number, z: number, maxD: number): Enemy | null {
    let best: Enemy | null = null
    let bd = maxD * maxD
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const d = (e.x - x) ** 2 + (e.z - z) ** 2
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }

  showBanner(text: string, sub: string, color: string, dur: number) {
    this.banner = { text, sub, color, t: 0, dur }
  }

  // =====================================================================
  // Jugador
  // =====================================================================

  private updatePlayer(dt: number) {
    const L = this.level
    this.invuln -= dt
    this.shockCd -= dt
    this.frenzyT -= dt
    this.faceT -= dt
    if (this.faceT <= 0) this.faceMode = null
    this.faceLookT -= dt
    if (this.faceLookT <= 0) {
      this.faceLookT = rand(1, 2.5)
      this.faceLook = Math.random() < 0.6 ? 0 : pick([-1, 1])
    }
    if (this.dead) {
      this.deathT += dt
      this.eyeY = Math.max(0.14, EYE - this.deathT * 0.9)
      this.roll = Math.min(0.5, this.deathT * 0.7)
      if (this.deathT > 2.2 && this.screen === 'playing') this.finishRun()
      return
    }
    // giro
    let turn = this.turnAcc
    this.turnAcc = 0
    const k = this.keys
    if (k.has('ArrowLeft')) turn -= 2.6 * dt
    if (k.has('ArrowRight')) turn += 2.6 * dt
    this.yaw += turn
    // asistencia de apuntado en táctil
    if (this.touch) this.aimAssist(dt)
    // movimiento
    let fwd = 0
    let side = 0
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1
    if (k.has('KeyA')) side -= 1
    if (k.has('KeyD')) side += 1
    fwd += -this.moveY
    side += this.moveX
    const len = Math.hypot(fwd, side)
    if (len > 1) {
      fwd /= len
      side /= len
    }
    const sp = 6.2 * this.stats.speed
    const ca = Math.cos(this.yaw)
    const sa = Math.sin(this.yaw)
    const wx = (ca * fwd - sa * side) * sp
    const wz = (sa * fwd + ca * side) * sp
    const acc = Math.min(1, dt * 14)
    this.pvx += (wx - this.pvx) * acc
    this.pvz += (wz - this.pvz) * acc
    const pos = this.posTmp
    pos.x = this.px
    pos.z = this.pz
    L.move(pos, this.pvx * dt, this.pvz * dt, PLAYER_R)
    this.px = pos.x
    this.pz = pos.z
    const speed = Math.hypot(this.pvx, this.pvz)
    this.bobAmt += (Math.min(1, speed / 6) - this.bobAmt) * Math.min(1, dt * 10)
    this.bob += dt * speed * 1.55
    this.stepT -= dt * speed
    if (this.stepT <= 0 && speed > 1) {
      this.stepT = 2.2
      this.audio.step(0.8)
    }
    L.updateFlow(this.px, this.pz)
    // regeneración
    this.regenT += dt
    if (this.stats.regen > 0 && this.regenT > 3 && this.p.hp < this.p.maxHp) this.heal(this.stats.regen * dt)
  }

  private aimAssist(dt: number) {
    let best: Enemy | null = null
    let bestA = 0.16
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'warp') continue
      const dx = e.x - this.px
      const dz = e.z - this.pz
      const d = Math.hypot(dx, dz)
      if (d > 22) continue
      const a = Math.abs(angDiff(this.yaw, Math.atan2(dz, dx)))
      const lim = 0.16 + e.def.radius / Math.max(1, d)
      if (a < lim && a < bestA + e.def.radius / Math.max(1, d) && e.los) {
        bestA = a
        best = e
      }
    }
    if (best) {
      const diff = angDiff(this.yaw, Math.atan2(best.z - this.pz, best.x - this.px))
      const firing = this.touchFire
      this.yaw += diff * Math.min(1, dt * (firing ? 6 : 2.5))
    }
  }

  // =====================================================================
  // Bucle
  // =====================================================================

  private frame = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const raw = (now - this.last) / 1000
    this.last = now
    const dt = Math.min(0.05, Math.max(0, raw))
    // resolución dinámica: si vamos lentos bajamos la resolución interna
    if (this.screen === 'playing') {
      if (raw > 1 / 42) this.slowFrames++
      else this.slowFrames = Math.max(0, this.slowFrames - 0.5)
      if (this.slowFrames > 90 && this.quality > 0.7) {
        this.quality = Math.max(0.7, this.quality - 0.1)
        this.slowFrames = 0
        this.resize()
      }
    }
    this.ambient(dt)
    if (this.screen === 'playing') this.update(dt)
    else if (this.screen === 'title') this.attract(dt)
    else if (this.screen === 'gameover') {
      this.updateFx(dt)
      this.trauma = Math.max(0, this.trauma - dt)
    }
    renderWorld(this)
    drawOverlay(this, dt)
  }

  private ambient(dt: number) {
    const bossWave = ((this.wave - 1) % 5) + 1 === 5 && this.screen !== 'title'
    const t = performance.now() / 1000
    this.alarm = (bossWave ? 0.75 : 0.45) * (0.5 + 0.5 * Math.sin(t * (bossWave ? 5 : 3.2)))
    this.flickT -= dt
    if (this.flickT <= 0) {
      this.flickT = Math.random() < 0.15 ? rand(0.03, 0.09) : rand(0.4, 2.5)
      this.flicker = this.flicker < 1 ? 1 : Math.random() < 0.18 ? rand(0.55, 0.8) : 1
    }
  }

  private attract(dt: number) {
    this.yaw += dt * 0.12
    this.bob += dt * 0.6
    this.updateFx(dt)
  }

  private update(rawDt: number) {
    let dt = rawDt
    if (this.hitstop > 0) {
      this.hitstop -= rawDt
      dt = 0
    }
    this.time += dt
    this.updatePlayer(dt)
    this.updateWeapon(dt)
    this.updateWave(dt)
    updateEnemies(this, dt)
    this.updateProjs(dt)
    this.updatePickups(dt)
    this.updateFx(dt)
    // racha
    if (this.chainT > 0) {
      this.chainT -= dt
      if (this.chainT <= 0) this.chain = 0
    }
    // decaimiento del juice
    this.trauma = Math.max(0, this.trauma - rawDt * 1.6)
    this.hurtFlash = Math.max(0, this.hurtFlash - rawDt * 1.4)
    this.pickFlash = Math.max(0, this.pickFlash - rawDt * 1.6)
    this.whiteFlash = Math.max(0, this.whiteFlash - rawDt * 2.5)
    this.hitMark -= rawDt
    this.killMark -= rawDt
    for (const d of this.dmgDirs) d.t -= rawDt * 1.2
    this.dmgDirs = this.dmgDirs.filter((d) => d.t > 0)
    if (this.banner) {
      this.banner.t += rawDt
      if (this.banner.t > this.banner.dur) this.banner = null
    }
    if (this.msg) {
      this.msg.t -= rawDt
      if (this.msg.t <= 0) this.msg = null
    }
  }

  /** Depuración: atlas de sprites como imagen. */
  debugAtlas(): string {
    return this.atlas.img.toCanvas().toDataURL()
  }

  /** Depuración: salta a una oleada concreta. */
  debugWave(n: number) {
    const arena = Math.floor((n - 1) / 5) % 3
    this.cycle = Math.floor((n - 1) / 15)
    this.loadArena(arena)
    for (const w of WEAPONS) this.p.owned[w.id] = true
    this.p.ammo = { bullets: 200, shells: 50, rockets: 30, cells: 300 }
    this.startWave(n)
  }

  /** Alto en px CSS de la barra del HUD (para colocar los botones táctiles). */
  barCss() {
    return (this.hud.barH / this.viewH) * this.cssH
  }

  /** Lista de mejoras adquiridas (para la pausa). */
  takenList(): { name: string; n: number; rarity: number }[] {
    return Object.entries(this.taken).map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id)
      return { name: u?.name ?? id, n, rarity: u?.rarity ?? 0 }
    })
  }
}

/** Distancia a lo largo del rayo hasta un círculo (o -1). */
export function rayCircle(ox: number, oz: number, dx: number, dz: number, cx: number, cz: number, r: number): number {
  const fx = cx - ox
  const fz = cz - oz
  const t = fx * dx + fz * dz
  if (t < 0) return -1
  const px = fx - dx * t
  const pz = fz - dz * t
  const d2 = px * px + pz * pz
  if (d2 > r * r) return -1
  return t - Math.sqrt(r * r - d2)
}
