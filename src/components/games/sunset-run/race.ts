/** Simulación de carrera: física del jugador, IA de rivales, choques, rebufo, derrape y pickups. */
import { RIVALS, type BodyStyle, type CarColors, type CarModel, type Personality, type Upgrades } from './data'
import { findSeg, RAIL_X, ROAD_W, SEG_LEN, START_SEG, WALL_X, type Seg, type Track } from './track'
import { approach, clamp, rng, type Rng } from './util'

export const MAX_SPEED = 11000
export const KMH = 238 / MAX_SPEED
export const CAR_HALF = 0.19
export const CAR_LEN = 280
const START_Z = START_SEG * SEG_LEN

export interface Stats {
  top: number
  accel: number
  brake: number
  decel: number
  offLimit: number
  offDecel: number
  centrifugal: number
  steer: number
  nitroCap: number
  nitroMul: number
  crashKeep: number
  rebufo: number
  shieldBonus: number
}

export function computeStats(m: CarModel, up: Upgrades): Stats {
  const top = MAX_SPEED * m.top * (1 + 0.036 * up.motor)
  return {
    top,
    accel: (top / 4.4) * m.accel * (1 + 0.06 * up.motor),
    brake: top * 1.15,
    decel: top / 5.5,
    offLimit: top * (0.34 + 0.05 * up.llantas),
    offDecel: top * (0.95 - 0.09 * up.llantas),
    centrifugal: (0.27 / m.grip) * (1 - 0.075 * up.llantas),
    steer: 1.8 * (0.94 + m.grip * 0.06),
    nitroCap: 3.2 * m.nitro * (1 + 0.2 * up.turbo),
    nitroMul: 1.22 + 0.025 * up.turbo,
    crashKeep: 0.3 + 0.08 * up.carroceria,
    rebufo: 1 + 0.35 * up.rebufo,
    shieldBonus: up.carroceria * 0.6,
  }
}

export interface Car {
  idx: number
  name: string
  player: boolean
  body: BodyStyle
  colors: CarColors
  pers: Personality | 'player'
  d: number
  z: number
  x: number
  speed: number
  top: number
  accel: number
  targetX: number
  lane: number
  steerVis: number
  spin: number
  brakeVis: number
  finished: boolean
  finishT: number
  pos: number
  thinkT: number
  mistakeT: number
  nitroT: number
  usedNitro: boolean
  startDelay: number
  // proyección del último frame (para efectos)
  sx: number
  sy: number
  sw: number
  onScreen: boolean
}

export interface PlayerState {
  steer: number
  nitro: number
  nitroOn: boolean
  drift: boolean
  driftDir: number
  driftT: number
  driftLoose: number
  accelOff: number
  brakeHeld: boolean
  brakeTap: number
  slip: number
  shieldT: number
  magnetT: number
  boostT: number
  offroad: boolean
  scrape: boolean
  crashCD: number
  hitCD: number
  bounceV: number
  camX: number
  upHeld: number
  lastPos: number
  braking: boolean
  hardTurn: number
}

export type RacePhase = 'countdown' | 'racing' | 'finished' | 'done'

export interface Race {
  track: Track
  model: CarModel
  stats: Stats
  up: Upgrades
  cars: Car[]
  pl: PlayerState
  phase: RacePhase
  count: number
  t: number
  laps: number
  lap: number
  lapStart: number
  lapTimes: number[]
  overtakes: number
  coins: number
  driftPts: number
  driftCount: number
  nitroPicks: number
  outroT: number
  sky: number
  auto: boolean
  rnd: Rng
  finishPos: number
  hits: number
  ovTextT: number
}

export type SoundId =
  | 'beep'
  | 'go'
  | 'crash'
  | 'bump'
  | 'scrape'
  | 'coin'
  | 'nitroPick'
  | 'shield'
  | 'magnet'
  | 'shieldHit'
  | 'lap'
  | 'finalLap'
  | 'finish'
  | 'overtake'
  | 'driftStart'
  | 'driftBoost'
  | 'nitroOn'
  | 'perfect'
  | 'nitroEmpty'

export interface Fx {
  sound(id: SoundId): void
  shake(a: number): void
  flash(color: string, a: number): void
  freeze(ms: number): void
  /** Texto flotante sobre el coche del jugador. */
  text(text: string, color: string, size?: number): void
  banner(text: string, sub: string, color: string, dur: number): void
  /** Partículas en el coche del jugador. */
  burst(kind: 'spark' | 'debris' | 'shield' | 'coin' | 'nitro' | 'boost', side?: number): void
  /** Partículas sobre un rival (coordenadas de pantalla del último frame). */
  carBurst(c: Car, kind: 'spark' | 'shield'): void
}

export interface Input {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  nitro: boolean
  /** Dirección analógica (-1..1) del giroscopio; null si no se usa. */
  steer: number | null
  auto: boolean
}

const DRIVERS: { name: string; pers: Personality; body: BodyStyle; colors: CarColors; skill: number }[] = RIVALS

export interface Grid {
  /** idx de coche por casilla de salida (0 = pole). Coche 0 = jugador. */
  order: number[]
}

export function newRace(track: Track, model: CarModel, up: Upgrades, grid: number[], auto = false): Race {
  const rnd = rng(track.meta.seed * 17 + track.cup * 101 + track.race * 7 + Math.floor(Math.random() * 1000))
  const stats = computeStats(model, up)
  const cars: Car[] = []
  const cup = track.cup
  const base = (c: Partial<Car> & { idx: number; name: string; player: boolean; body: BodyStyle; colors: CarColors; pers: Car['pers'] }): Car => ({
    d: 0,
    z: 0,
    x: 0,
    speed: 0,
    top: 0,
    accel: 0,
    targetX: 0,
    lane: 0,
    steerVis: 0,
    spin: 0,
    brakeVis: 0,
    finished: false,
    finishT: 0,
    pos: 0,
    thinkT: 0,
    mistakeT: 0,
    nitroT: 0,
    usedNitro: false,
    startDelay: 0,
    sx: 0,
    sy: 0,
    sw: 0,
    onScreen: false,
    ...c,
  })
  cars.push(base({ idx: 0, name: 'TÚ', player: true, body: model.body, colors: model.colors, pers: 'player' }))
  DRIVERS.forEach((r, i) => {
    const persBonus = r.pers === 'agresivo' ? 0.012 : r.pers === 'erratico' ? 0.004 : 0
    const skill = 0.87 + cup * 0.075 + track.race * 0.015 + r.skill + persBonus + (rnd() - 0.5) * 0.02
    const top = MAX_SPEED * skill
    cars.push(
      base({
        idx: i + 1,
        name: r.name,
        player: false,
        body: r.body,
        colors: r.colors,
        pers: r.pers,
        top,
        accel: top / (5.2 - cup * 0.4),
        lane: (rnd() - 0.5) * 1.2,
        startDelay: 0.05 + rnd() * (r.pers === 'erratico' ? 0.6 : 0.3),
      }),
    )
  })
  grid.forEach((ci, slot) => {
    const c = cars[ci]
    const row = Math.floor(slot / 2)
    c.d = -(row * 5 + 3 + (slot % 2) * 2) * SEG_LEN
    c.x = slot % 2 ? 0.5 : -0.5
    c.targetX = c.x
    c.z = posZ(track, c.d)
  })
  const pl: PlayerState = {
    steer: 0,
    nitro: stats.nitroCap * 0.5,
    nitroOn: false,
    drift: false,
    driftDir: 0,
    driftT: 0,
    driftLoose: 0,
    accelOff: 1,
    brakeHeld: false,
    brakeTap: 0,
    slip: 0,
    shieldT: 0,
    magnetT: 0,
    boostT: 0,
    offroad: false,
    scrape: false,
    crashCD: 0,
    hitCD: 0,
    bounceV: 0,
    camX: cars[0].x,
    upHeld: 0,
    lastPos: 8,
    braking: false,
    hardTurn: 0,
  }
  const race: Race = {
    track,
    model,
    stats,
    up,
    cars,
    pl,
    phase: 'countdown',
    count: 4.2,
    t: 0,
    laps: track.meta.laps,
    lap: 1,
    lapStart: 0,
    lapTimes: [],
    overtakes: 0,
    coins: 0,
    driftPts: 0,
    driftCount: 0,
    nitroPicks: 0,
    outroT: 0,
    sky: 0,
    auto,
    rnd,
    finishPos: 0,
    hits: 0,
    ovTextT: -9,
  }
  rankCars(race)
  pl.lastPos = cars[0].pos
  updateCarBuckets(race)
  for (const s of track.segs) if (s.pickups) for (const p of s.pickups) {
    p.takenLap = -1
    p.dx = 0
  }
  return race
}

export const posZ = (t: Track, d: number) => {
  const L = t.length
  return (((START_Z + d) % L) + L) % L
}

function rankCars(race: Race) {
  const sorted = [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishT - b.finishT
    if (a.finished) return -1
    if (b.finished) return 1
    return b.d - a.d
  })
  sorted.forEach((c, i) => (c.pos = i + 1))
}

function lookCurve(t: Track, s: Seg, from: number, to: number): number {
  let m = 0
  let signed = 0
  for (let k = from; k <= to; k += 3) {
    const c = t.segs[(s.i + k) % t.N].curve
    if (Math.abs(c) > Math.abs(m)) m = c
    signed += c
  }
  return Math.abs(m) * Math.sign(signed || m)
}

/** Piloto automático (modo demostración y vuelta de honor). */
export function autoInput(race: Race, c: Car): Input {
  const t = race.track
  const s = findSeg(t, c.z)
  const ahead = lookCurve(t, s, 2, 26)
  const line = clamp(Math.sign(ahead) * Math.min(0.55, Math.abs(ahead) * 0.12), -0.6, 0.6)
  let target = line
  for (const o of race.cars) {
    if (o === c) continue
    const dz = o.d - c.d
    if (dz > 0 && dz < SEG_LEN * 10 && Math.abs(o.x - c.x) < 0.45 && o.speed < c.speed) target = o.x > 0 ? o.x - 0.6 : o.x + 0.6
  }
  const desired = clamp((target - c.x) * 3 + s.curve * 0.22, -1, 1)
  const sp = c.speed / race.stats.top
  const tooFast = Math.abs(ahead) * race.stats.centrifugal * sp > 0.95
  return { up: !tooFast || sp < 0.6, down: false, left: desired < -0.15, right: desired > 0.15, nitro: false, steer: desired, auto: false }
}

export function stepRace(race: Race, input: Input, dt: number, fx: Fx) {
  const t = race.track
  const P = race.cars[0]
  const pl = race.pl
  const st = race.stats

  if (race.phase === 'countdown') {
    const before = Math.ceil(race.count)
    race.count -= dt
    const after = Math.ceil(race.count)
    if (input.up) pl.upHeld += dt
    else pl.upHeld = 0
    if (after !== before && after >= 1 && after <= 3) fx.sound('beep')
    if (race.count <= 0) {
      race.phase = 'racing'
      race.t = 0
      race.lapStart = 0
      fx.sound('go')
      if (input.up && pl.upHeld > 0 && pl.upHeld < 0.7 && !input.auto) {
        P.speed = st.top * 0.45
        pl.boostT = 1.2
        fx.text('SALIDA PERFECTA', '#4ade80', 11)
        fx.sound('perfect')
        fx.burst('boost')
      }
    }
    // revoluciones en la parrilla (solo visual)
    for (const c of race.cars) c.z = posZ(t, c.d)
    updateCarBuckets(race)
    return
  }

  race.t += dt
  if (race.phase === 'finished') {
    race.outroT += dt
    if (race.outroT > 4.2) race.phase = 'done'
  }

  // ---------- jugador ----------
  const control = race.phase === 'racing' && !race.auto
  const inp = control ? input : autoInput(race, P)
  if (race.phase !== 'racing' && !race.auto) {
    // vuelta de honor: frena suave
    inp.up = race.outroT < 1.2
  }
  const seg = findSeg(t, P.z)
  const sp = P.speed / st.top
  const spc = Math.min(1, sp)

  const steerIn = inp.steer !== null && control ? clamp(inp.steer, -1, 1) : (inp.right ? 1 : 0) - (inp.left ? 1 : 0)
  const growing = Math.abs(steerIn) > Math.abs(pl.steer) && Math.sign(steerIn) === Math.sign(pl.steer || steerIn)
  pl.steer = approach(pl.steer, steerIn, dt * (growing ? 6.5 : 10))
  const accel = inp.up || (inp.auto && !inp.down)
  const brake = inp.down
  pl.braking = brake

  // derrape
  if (brake && !pl.brakeHeld) pl.brakeTap = 0.32
  pl.brakeHeld = brake
  pl.brakeTap = Math.max(0, pl.brakeTap - dt)
  if (accel) pl.accelOff = 0
  else pl.accelOff += dt
  if (!pl.drift) {
    const wants = pl.brakeTap > 0 || (pl.accelOff > 0 && pl.accelOff < 0.4 && !inp.auto)
    if (spc > 0.55 && Math.abs(pl.steer) > 0.55 && Math.abs(seg.curve) >= 1.2 && !pl.offroad && wants && control) {
      pl.drift = true
      pl.driftDir = Math.sign(pl.steer)
      pl.driftT = 0
      pl.driftLoose = 0
      fx.sound('driftStart')
    }
  } else {
    pl.driftT += dt
    const counter = Math.sign(pl.steer) !== pl.driftDir && Math.abs(pl.steer) > 0.4
    if (Math.abs(pl.steer) < 0.2) pl.driftLoose += dt
    else pl.driftLoose = 0
    if (counter || pl.driftLoose > 0.22 || spc < 0.4 || pl.offroad || !control) {
      endDrift(race, fx)
    } else {
      pl.nitro = Math.min(st.nitroCap, pl.nitro + dt * 0.22 * spc * st.rebufo)
    }
  }

  // giro y fuerza centrífuga
  const authority = Math.min(1, spc * 1.8)
  P.x += pl.steer * dt * st.steer * authority * (pl.drift ? 1.3 : 1)
  const cent = st.centrifugal * (pl.drift ? 0.42 : 1)
  P.x -= dt * 2 * sp * sp * seg.curve * cent
  pl.hardTurn = Math.abs(pl.steer) * spc * (Math.abs(seg.curve) > 2 ? 1 : 0.4)
  if (pl.bounceV !== 0) {
    P.x += pl.bounceV * dt
    pl.bounceV = approach(pl.bounceV, 0, dt * 4)
  }

  // nitro
  const wantNitro = inp.nitro && race.phase === 'racing'
  if (wantNitro && pl.nitro > 0.02) {
    if (!pl.nitroOn) fx.sound('nitroOn')
    pl.nitroOn = true
    pl.nitro = Math.max(0, pl.nitro - dt)
  } else {
    if (pl.nitroOn && pl.nitro <= 0.02) fx.sound('nitroEmpty')
    pl.nitroOn = false
  }
  pl.boostT = Math.max(0, pl.boostT - dt)

  // velocidad
  const slipOn = pl.slip > 0.5
  let top = st.top * (pl.nitroOn ? st.nitroMul : 1) * (slipOn ? 1.04 + 0.01 * race.up.rebufo : 1) * (pl.boostT > 0 ? 1.08 : 1)
  if (pl.shieldT > 0) top *= 1.02
  if (accel) P.speed += st.accel * dt * (1.2 - 0.7 * spc)
  else if (!brake) P.speed -= st.decel * dt
  if (brake) P.speed -= st.brake * dt
  if (pl.nitroOn) P.speed += st.accel * 0.9 * dt
  if (pl.boostT > 0) P.speed += st.accel * 0.6 * dt
  if (pl.drift) P.speed -= st.top * 0.035 * dt
  P.speed -= ((seg.wy2 - seg.wy1) / SEG_LEN) * st.top * 0.16 * dt
  const edge = Math.abs(P.x)
  pl.offroad = edge > 1 + CAR_HALF * 0.4 && !seg.tunnel && !seg.bridge
  if (pl.offroad && P.speed > st.offLimit) P.speed = Math.max(st.offLimit, P.speed - st.offDecel * dt)
  if (P.speed > top) P.speed = Math.max(top, P.speed - st.top * 0.55 * dt)
  P.speed = clamp(P.speed, 0, st.top * 1.6)

  // paredes de túnel y barandales de puente
  pl.scrape = false
  const wall = seg.tunnel ? WALL_X - CAR_HALF - 0.04 : seg.bridge ? RAIL_X - CAR_HALF - 0.02 : 3.4
  if (Math.abs(P.x) > wall) {
    const side = Math.sign(P.x)
    P.x = side * wall
    if (wall < 3) {
      pl.scrape = true
      P.speed *= 1 - 0.9 * dt
      pl.bounceV = -side * 0.5
      if (pl.crashCD <= 0) {
        fx.sound('scrape')
        fx.shake(0.18)
        pl.crashCD = 0.18
      }
      fx.burst('spark', side)
      if (pl.drift) endDrift(race, fx)
    }
  }
  pl.crashCD = Math.max(0, pl.crashCD - dt)
  pl.hitCD = Math.max(0, pl.hitCD - dt)

  // choques con objetos de la orilla
  if (Math.abs(P.x) > 1 && pl.crashCD <= 0) {
    for (const s of [seg, t.segs[(seg.i + 1) % t.N]]) {
      if (!s.sprites) continue
      for (const sp2 of s.sprites) {
        const def = SPRITE_W[sp2.kind]
        if (!def || def.hit <= 0) continue
        const wN = def.w / ROAD_W
        const cx = sp2.x === 0 ? 0 : sp2.x + (sp2.x < 0 ? -wN / 2 : wN / 2)
        const hw = (wN * def.hit) / 2
        if (Math.abs(P.x - cx) < hw + CAR_HALF * 0.75) {
          crash(race, fx, cx)
          break
        }
      }
      if (pl.crashCD > 0) break
    }
  }

  pl.shieldT = Math.max(0, pl.shieldT - dt)
  pl.magnetT = Math.max(0, pl.magnetT - dt)

  // avance
  const oldZ = P.z
  const oldD = P.d
  P.d += P.speed * dt
  P.z = posZ(t, P.d)
  race.sky += seg.curve * spc * dt

  // ---------- rivales ----------
  for (let i = 1; i < race.cars.length; i++) aiStep(race, race.cars[i], dt)

  // ---------- choques entre coches ----------
  carCollisions(race, fx)

  // ---------- rebufo ----------
  let slipping = false
  if (spc > 0.5 && race.phase === 'racing') {
    for (let i = 1; i < race.cars.length; i++) {
      const c = race.cars[i]
      const dz = c.d - P.d
      if (dz > CAR_LEN && dz < SEG_LEN * 14 && Math.abs(c.x - P.x) < 0.34) {
        slipping = true
        break
      }
    }
  }
  pl.slip = slipping ? Math.min(1, pl.slip + dt * 1.3) : Math.max(0, pl.slip - dt * 2.5)
  if (pl.slip > 0.5) pl.nitro = Math.min(st.nitroCap, pl.nitro + dt * 0.12 * st.rebufo)

  // ---------- pickups ----------
  if (race.phase === 'racing') collectPickups(race, oldZ, fx)

  // ---------- vueltas ----------
  if (race.phase === 'racing') {
    const L = t.length
    const lapNow = Math.floor(P.d / L) + 1
    if (oldD >= 0 && Math.floor(oldD / L) + 1 < lapNow) {
      race.lapTimes.push(race.t - race.lapStart)
      race.lapStart = race.t
      for (const s of t.segs) if (s.pickups) for (const p of s.pickups) p.dx = 0
      if (lapNow > race.laps) {
        finishPlayer(race, fx)
      } else {
        race.lap = lapNow
        if (lapNow === race.laps) {
          fx.banner('FINAL LAP', 'ULTIMA VUELTA', '#facc15', 2.4)
          fx.sound('finalLap')
        } else {
          fx.banner(`VUELTA ${lapNow}`, `${race.lapTimes.length ? 'TIEMPO ' + fmtLap(race.lapTimes[race.lapTimes.length - 1]) : ''}`, '#ffffff', 1.6)
          fx.sound('lap')
        }
      }
    }
  }

  rankCars(race)
  if (race.phase === 'racing') {
    if (P.pos < pl.lastPos) {
      race.overtakes += pl.lastPos - P.pos
      if (race.t - race.ovTextT > 0.8 || P.pos === 1) fx.text(P.pos === 1 ? '¡PRIMER LUGAR!' : `REBASE  ${P.pos}º`, P.pos === 1 ? '#facc15' : '#ffffff', P.pos === 1 ? 12 : 10)
      if (race.t - race.ovTextT > 0.8 || P.pos === 1) race.ovTextT = race.t
      fx.sound('overtake')
    }
    pl.lastPos = P.pos
  }

  // cámara lateral con leve retraso
  pl.camX = approach(pl.camX, P.x, dt * (0.6 + Math.abs(P.x - pl.camX) * 6))
  updateCarBuckets(race)
}

function fmtLap(t: number) {
  const s = Math.floor(t)
  const cs = Math.floor((t * 100) % 100)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function endDrift(race: Race, fx: Fx) {
  const pl = race.pl
  if (!pl.drift) return
  pl.drift = false
  if (pl.driftT > 0.9) {
    const pts = Math.round(pl.driftT * 60) * 5
    race.driftPts += pts
    race.driftCount++
    pl.boostT = Math.min(1.4, 0.5 + pl.driftT * 0.3)
    fx.text(`DERRAPE +${pts}`, pl.driftT > 2 ? '#f97316' : '#60a5fa', 10)
    fx.sound('driftBoost')
    fx.burst('boost')
  }
  pl.driftT = 0
}

function crash(race: Race, fx: Fx, objX: number) {
  const P = race.cars[0]
  const pl = race.pl
  const st = race.stats
  const impact = Math.min(1, P.speed / st.top)
  pl.crashCD = 0.6
  endDrift(race, fx)
  race.hits++
  if (pl.shieldT > 0) {
    P.speed *= 0.82
    fx.sound('shieldHit')
    fx.burst('shield')
    fx.shake(0.25)
  } else {
    P.speed *= st.crashKeep
    fx.sound('crash')
    fx.shake(0.35 + impact * 0.45)
    fx.freeze(40 + impact * 50)
    fx.flash('#ffffff', 0.25 * impact)
    fx.burst('debris')
    fx.text('¡CHOQUE!', '#ef4444', 11)
  }
  pl.bounceV = (P.x > objX ? 1 : -1) * (0.8 + impact * 1.2) * (Math.abs(P.x) > 1 ? 1 : 0.5)
  if (Math.sign(pl.bounceV) === Math.sign(P.x)) pl.bounceV = -Math.sign(P.x) * Math.abs(pl.bounceV)
}

function finishPlayer(race: Race, fx: Fx) {
  const P = race.cars[0]
  P.finished = true
  P.finishT = race.t
  race.phase = 'finished'
  race.outroT = 0
  race.pl.nitroOn = false
  race.pl.drift = false
  rankCars(race)
  race.finishPos = P.pos
  fx.sound('finish')
  const pos = P.pos
  fx.banner('META', pos === 1 ? '¡GANASTE!' : `LLEGASTE ${pos}º`, pos <= 3 ? '#facc15' : '#ffffff', 3.6)
}

function aiStep(race: Race, c: Car, dt: number) {
  const t = race.track
  const P = race.cars[0]
  const s = findSeg(t, c.z)
  if (race.t < c.startDelay) {
    c.z = posZ(t, c.d)
    return
  }
  const ahead = lookCurve(t, s, 3, 21)
  const absC = Math.abs(ahead)
  const curveF = absC < 0.01 ? 1 : Math.min(1, 1.25 / (absC * 0.3))
  let target = c.top * curveF
  const rb = race.phase === 'racing' ? 0.6 + t.cup * 0.25 : 0
  const gap = (c.d - P.d) / SEG_LEN
  if (gap > 45) target *= 1 - Math.min(0.07, (gap - 45) / 1500) * rb
  if (gap < -45) target *= 1 + Math.min(0.09 + t.cup * 0.02, (-gap - 45) / 1100) * rb
  if (c.pers === 'erratico') {
    c.mistakeT -= dt
    if (c.mistakeT < -4 - race.rnd() * 6) c.mistakeT = 0.6 + race.rnd() * 0.8
    if (c.mistakeT > 0) target *= 0.84
  }
  // nitro de los rivales en la última vuelta
  const lastLap = c.d > (race.laps - 1) * t.length
  if (!c.usedNitro && lastLap && absC < 1 && race.rnd() < dt * (0.25 + t.cup * 0.25) && c.pers !== 'erratico') {
    c.usedNitro = true
    c.nitroT = 1.6 + t.cup * 0.5
  }
  if (c.nitroT > 0) {
    c.nitroT -= dt
    target *= 1.14
  }
  if (c.spin > 0) {
    c.spin -= dt
    target = c.top * 0.22
  }
  const off = Math.abs(c.x) > 1.05
  if (off) target = Math.min(target, c.top * 0.45)
  // los erráticos a veces se comen la orilla y trompean
  if (off && c.pers === 'erratico' && c.spin <= 0 && race.rnd() < dt * 0.6) c.spin = 1.1
  const prev = c.speed
  c.speed = approach(c.speed, target, (c.speed < target ? c.accel : c.top * 0.9) * dt)
  c.brakeVis = prev - c.speed > c.top * 0.25 * dt ? 0.25 : Math.max(0, c.brakeVis - dt)

  // decidir carril
  c.thinkT -= dt
  if (c.thinkT <= 0) {
    c.thinkT = 0.4 + race.rnd() * 0.6
    const line = clamp(Math.sign(ahead) * Math.min(0.5, absC * 0.11), -0.55, 0.55)
    if (c.pers === 'consistente') c.targetX = line * 0.9 + c.lane * 0.2
    else if (c.pers === 'erratico') {
      if (race.rnd() < 0.35) c.targetX = (race.rnd() - 0.5) * 1.7
      if (c.mistakeT > 0 && absC > 3) c.targetX = -Math.sign(ahead) * 1.05
    } else c.targetX = line * 0.6 + c.lane * 0.4
  }
  // agresivo: bloquea y empuja al jugador
  const dzP = c.d - P.d
  if (c.pers === 'agresivo' && race.phase === 'racing' && P.speed > 0) {
    const aggr = 0.55 + t.cup * 0.2
    if (dzP > 0 && dzP < SEG_LEN * (6 + t.cup * 3) && Math.abs(P.x - c.x) < 0.9) c.targetX = approach(c.targetX, P.x, dt * 2 * aggr)
    else if (Math.abs(dzP) < CAR_LEN * 1.4 && Math.abs(P.x - c.x) < 0.7) c.targetX = P.x
  }
  // evitar coches lentos delante
  for (const o of race.cars) {
    if (o === c) continue
    const dz = o.d - c.d
    if (dz > 0 && dz < SEG_LEN * 8 && Math.abs(o.x - c.x) < 0.42 && o.speed < c.speed - 150) {
      if (!(c.pers === 'agresivo' && o.player)) c.targetX = o.x > 0 ? o.x - 0.6 : o.x + 0.6
      if (dz < CAR_LEN * 1.2) c.speed = Math.min(c.speed, o.speed * 0.99)
    }
  }
  c.targetX = clamp(c.targetX, -0.85, 0.85)
  if (s.tunnel || s.bridge) c.targetX = clamp(c.targetX, -0.75, 0.75)
  const steerRate = c.pers === 'agresivo' ? 1.5 : c.pers === 'erratico' ? 1.2 : 0.95
  const prevX = c.x
  c.x = approach(c.x, c.targetX, dt * steerRate)
  const lat = (c.x - prevX) / Math.max(dt, 1e-3)
  c.steerVis = approach(c.steerVis, clamp(lat * 1.4 + s.curve * 0.12, -1, 1), dt * 5)
  c.d += c.speed * dt
  c.z = posZ(t, c.d)
  if (!c.finished && c.d >= race.laps * t.length) {
    c.finished = true
    c.finishT = race.t
  }
}

function carCollisions(race: Race, fx: Fx) {
  const P = race.cars[0]
  const pl = race.pl
  if (race.phase === 'done') return
  for (let i = 1; i < race.cars.length; i++) {
    const c = race.cars[i]
    const dz = c.d - P.d
    const dx = c.x - P.x
    if (Math.abs(dz) > CAR_LEN || Math.abs(dx) > CAR_HALF * 1.7) continue
    if (pl.shieldT > 0) {
      if (c.spin <= 0) {
        c.spin = 1.4
        c.speed *= 0.55
        c.x += Math.sign(dx || 1) * 0.35
        fx.sound('shieldHit')
        fx.carBurst(c, 'shield')
        fx.shake(0.2)
        fx.text('¡FUERA!', '#67e8f9', 10)
      }
      continue
    }
    if (pl.hitCD > 0) continue
    pl.hitCD = 0.3
    race.hits++
    const side = Math.abs(dz) < CAR_LEN * 0.55
    if (side) {
      const dir = Math.sign(-dx) || 1
      pl.bounceV = dir * 1.3
      c.x -= dir * 0.14
      c.targetX = c.x
      P.speed *= 0.96
      fx.sound('bump')
      fx.shake(0.22)
      fx.burst('spark', -dir)
    } else if (dz > 0 && P.speed > c.speed) {
      const keep = 0.86 + race.up.carroceria * 0.02
      P.speed = c.speed * keep
      P.d = c.d - CAR_LEN
      c.speed = Math.min(c.top * 1.05, c.speed + 400)
      pl.bounceV = (Math.sign(-dx) || 1) * 0.7
      if (pl.drift) endDrift(race, fx)
      fx.sound('bump')
      fx.shake(0.3)
      fx.burst('spark', 0)
    } else if (dz < 0 && c.speed > P.speed) {
      c.speed = P.speed * 0.9
      c.d = P.d - CAR_LEN
      P.speed += 500
      fx.sound('bump')
      fx.shake(0.25)
    }
  }
}

function collectPickups(race: Race, oldZ: number, fx: Fx) {
  const t = race.track
  const P = race.cars[0]
  const pl = race.pl
  const cup = t.cup
  const n0 = Math.floor(oldZ / SEG_LEN)
  let n1 = Math.floor(P.z / SEG_LEN)
  if (n1 < n0) n1 += t.N
  const lapId = Math.floor(P.d / t.length)
  // imán: atrae monedas cercanas
  if (pl.magnetT > 0) {
    for (let k = 0; k < 16; k++) {
      const s = t.segs[(n1 + k) % t.N]
      if (!s.pickups) continue
      for (const p of s.pickups) {
        if (p.kind !== 'coin' || p.takenLap === lapId) continue
        p.dx = approach(p.dx, P.x - p.x, 0.12)
      }
    }
  }
  for (let n = n0; n <= n1 + 1; n++) {
    const s = t.segs[n % t.N]
    if (!s.pickups) continue
    for (const p of s.pickups) {
      if (p.takenLap === lapId) continue
      const reach = p.kind === 'coin' ? (pl.magnetT > 0 ? 0.6 : 0.3) : 0.32
      if (Math.abs(p.x + p.dx - P.x) > reach) continue
      if (n === n1 + 1 && s.i * SEG_LEN - P.z > SEG_LEN * 0.5) continue
      p.takenLap = lapId
      if (p.kind === 'coin') {
        race.coins++
        fx.sound('coin')
        fx.burst('coin')
      } else if (p.kind === 'nitro') {
        race.nitroPicks++
        pl.nitro = Math.min(race.stats.nitroCap, pl.nitro + race.stats.nitroCap * (0.35 + cup * 0.1))
        fx.sound('nitroPick')
        fx.text('+NITRO', '#60a5fa', 10)
        fx.burst('nitro')
      } else if (p.kind === 'shield') {
        pl.shieldT = 5 + cup * 1.2 + race.stats.shieldBonus
        fx.sound('shield')
        fx.text('ESCUDO', '#67e8f9', 10)
        fx.burst('shield')
      } else {
        pl.magnetT = 7 + cup * 2
        fx.sound('magnet')
        fx.text('IMAN', '#f87171', 10)
      }
    }
  }
}

const touched: Seg[] = []
function updateCarBuckets(race: Race) {
  for (const s of touched) s.cars.length = 0
  touched.length = 0
  for (const c of race.cars) {
    if (c.player) continue
    const s = findSeg(race.track, c.z)
    if (s.cars.length === 0) touched.push(s)
    s.cars.push(c.idx)
  }
}

/** Tiempos finales: los rivales que no han llegado se estiman por su ritmo. */
export function finalOrder(race: Race): Car[] {
  const L = race.track.length * race.laps
  for (const c of race.cars) {
    if (!c.finished) {
      const rem = Math.max(0, L - c.d)
      c.finishT = race.t + rem / Math.max(c.speed, c.top * 0.75, 1)
      c.finished = true
    }
  }
  return [...race.cars].sort((a, b) => a.finishT - b.finishT)
}

/** Anchos de sprite en mundo para colisiones (lo llena el renderizador). */
export const SPRITE_W: Partial<Record<string, { w: number; hit: number }>> = {}
