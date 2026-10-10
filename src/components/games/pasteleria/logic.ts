/**
 * Lógica de "Pastelería en Pareja" (sin dibujo ni React). Cada jugador tiene
 * una mano y su mitad de la cocina; el mostrador y los clientes son compartidos.
 * Las acciones que producen efectos (texto, partículas, sonido) se encolan en
 * `g.fx` y el componente las reproduce.
 */
import {
  ANIMALS,
  RECIPES,
  SHELVES,
  sameSet,
  type Animal,
  type LevelCfg,
  type Side,
} from './data'

export type PiecePhase = 'masa' | 'horno' | 'listo' | 'quemado' | 'decor' | 'caja'

export interface Piece {
  rid: string
  phase: PiecePhase
  /** Segundos que faltan en el horno. */
  left: number
  /** Segundos desde que quedó listo (si pasan BURN_AFTER se quema). */
  burnT: number
  /** Toppings ya aplicados en la tabla de decorar. */
  deco: string[]
}

export type Item = { k: 'i'; id: string } | { k: 'p'; p: Piece }

export interface Cust {
  id: number
  animal: Animal
  rid: string
  /** Paciencia restante (s). */
  t: number
  max: number
  state: 'wait' | 'ok' | 'bye'
  /** Tiempo desde que se fue o fue atendido (para la animación de salida). */
  age: number
}

export type SpotKind = 'shelf' | 'bowl' | 'oven' | 'deco' | 'box' | 'counter' | 'cust'

export interface Spot {
  kind: SpotKind
  /** Lado dueño del puesto; -1 = compartido (mostrador y clientes). */
  side: Side | -1
  x: number
  y: number
  w: number
  h: number
  /** Ingrediente del estante. */
  ing?: string
  /** Índice en el mostrador o en la fila de clientes. */
  i?: number
}

export type Fx =
  | { k: 'text'; x: number; y: number; text: string; color: string }
  | { k: 'burst'; x: number; y: number; color: string[]; n: number }
  | { k: 'sfx'; name: string }

export interface Game {
  cfg: LevelCfg
  /** Un solo jugador: una mano y todos los puestos disponibles. */
  solo: boolean
  spots: Spot[]
  /** Segundos restantes. */
  t: number
  phase: 'play' | 'end'
  coins: number
  served: number
  missed: number
  bowl: [string[], string[]]
  oven: [Piece | null, Piece | null]
  deco: [Piece | null, Piece | null]
  counter: (Item | null)[]
  hands: [Item | null, Item | null]
  custs: (Cust | null)[]
  spawnT: number
  nextId: number
  /** Puesto que señala el teclado de cada jugador (índice en `spots`). */
  cur: [number, number]
  fx: Fx[]
}

export const BURN_AFTER = 6
const MAX_BOWL = 4

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/** Puestos en coordenadas lógicas del mundo W x H. El orden no cambia entre tamaños. */
export function buildSpots(W: number, H: number): Spot[] {
  const COL = [0.17, 0.39, 0.61, 0.83]
  const SHELF_X = [0.1, 0.3, 0.5, 0.7, 0.9]
  const KINDS: SpotKind[] = ['bowl', 'oven', 'deco', 'box']
  const shelves = (side: Side): Spot[] =>
    SHELF_X.map((fx, i) => ({
      kind: 'shelf',
      side,
      x: W * fx,
      y: H * (side === 1 ? 0.22 : 0.86),
      w: W * 0.17,
      h: H * 0.1,
      ing: SHELVES[side][i],
    }))
  const stations = (side: Side): Spot[] =>
    KINDS.map((kind, j) => ({
      kind,
      side,
      x: W * COL[j],
      y: H * (side === 1 ? 0.36 : 0.66),
      w: W * 0.2,
      h: H * 0.12,
    }))
  const custs: Spot[] = [0.2, 0.5, 0.8].map((fx, i) => ({
    kind: 'cust',
    side: -1,
    x: W * fx,
    y: H * 0.09,
    w: W * 0.28,
    h: H * 0.15,
    i,
  }))
  const counter: Spot[] = COL.map((fx, i) => ({
    kind: 'counter',
    side: -1,
    x: W * fx,
    y: H * 0.5,
    w: W * 0.2,
    h: H * 0.12,
    i,
  }))
  return [...custs, ...shelves(1), ...stations(1), ...counter, ...stations(0), ...shelves(0)]
}

/**
 * En 1 jugador hay más tiempo, más paciencia y menos pedidos a la vez: una sola
 * mano no da abasto con los de 2 jugadores (ver REFERENCIAS: Overcooked).
 */
export function soloCfg(c: LevelCfg): LevelCfg {
  return {
    ...c,
    dur: Math.round(c.dur * 1.3),
    maxCust: Math.min(c.maxCust, 2),
    spawn: [c.spawn[0] * 1.4, c.spawn[1] * 1.4],
    patience: [c.patience[0] * 1.3, c.patience[1] * 1.3],
  }
}

export function newGame(base: LevelCfg, solo: boolean, W: number, H: number): Game {
  const cfg = solo ? soloCfg(base) : base
  const spots = buildSpots(W, H)
  const own = (side: number) => spots.findIndex((s) => s.kind === 'bowl' && s.side === side)
  return {
    cfg,
    solo,
    spots,
    t: cfg.dur,
    phase: 'play',
    coins: 0,
    served: 0,
    missed: 0,
    bowl: [[], []],
    oven: [null, null],
    deco: [null, null],
    counter: [null, null, null, null],
    hands: [null, null],
    custs: [null, null, null],
    spawnT: 1.5,
    nextId: 1,
    cur: [own(0), own(1)],
    fx: [],
  }
}

/** Reubica los puestos al cambiar el tamaño; los índices (cursores) siguen válidos. */
export function relayout(g: Game, W: number, H: number) {
  g.spots = buildSpots(W, H)
}

export function spotOf(g: Game, kind: SpotKind, side: Side | -1): Spot | undefined {
  return g.spots.find((s) => s.kind === kind && s.side === side)
}

/** Puesto bajo un punto (coordenadas lógicas), o undefined. */
export function spotAt(g: Game, x: number, y: number): Spot | undefined {
  let best: Spot | undefined
  let bd = Infinity
  for (const sp of g.spots) {
    const dx = Math.abs(x - sp.x)
    const dy = Math.abs(y - sp.y)
    if (dx <= sp.w / 2 && dy <= sp.h / 2 && dx + dy < bd) {
      bd = dx + dy
      best = sp
    }
  }
  return best
}

/**
 * Mano que usa un toque: la del dueño del puesto. En puestos compartidos (mostrador,
 * clientes) usa la mano que lleva algo; si ambas llevan o ninguna, la del lado del dedo.
 */
export function handFor(g: Game, sp: Spot, y: number, H: number): 0 | 1 {
  if (g.solo) return 0
  if (sp.side !== -1) return sp.side
  const h0 = g.hands[0] !== null
  const h1 = g.hands[1] !== null
  if (h0 !== h1) return h0 ? 0 : 1
  return y < H / 2 ? 1 : 0
}

function fx(g: Game, f: Fx) {
  g.fx.push(f)
}
function text(g: Game, x: number, y: number, t: string, color: string) {
  fx(g, { k: 'text', x, y, text: t, color })
}
function sound(g: Game, name: string) {
  fx(g, { k: 'sfx', name })
}
function burst(g: Game, x: number, y: number, color: string[], n = 12) {
  fx(g, { k: 'burst', x, y, color, n })
}
function nope(g: Game, sp: Spot, msg: string): false {
  text(g, sp.x, sp.y - 34, msg, '#fca5a5')
  sound(g, 'tap')
  return false
}

/**
 * Acción principal de una mano sobre un puesto (tocar o pulsar E/Enter).
 * Devuelve true si tomó algo de un puesto: así un arrastre puede soltarlo luego.
 */
export function act(g: Game, s: 0 | 1, sp: Spot): boolean {
  const h = g.hands[s]
  if (!g.solo && sp.side !== -1 && sp.side !== s) return nope(g, sp, 'ES DE TU COMPA')
  // lado del puesto (en un jugador, la mano 0 usa los dos lados)
  const k: Side = sp.side === -1 ? s : sp.side

  switch (sp.kind) {
    case 'shelf': {
      if (!h) {
        g.hands[s] = { k: 'i', id: sp.ing! }
        sound(g, 'pick')
        return true
      }
      if (h.k === 'i') {
        g.hands[s] = null
        sound(g, 'drop')
        return false
      }
      return nope(g, sp, 'NO AQUI')
    }

    case 'bowl': {
      const b = g.bowl[k]
      if (h?.k === 'i') {
        if (b.length >= MAX_BOWL) return nope(g, sp, 'LLENO')
        b.push(h.id)
        g.hands[s] = null
        sound(g, 'drop')
        return false
      }
      if (!h) {
        if (b.length === 0) return false
        const rid = g.cfg.recipes.find((r) => sameSet(RECIPES[r].mix, b))
        if (!rid) {
          b.length = 0
          text(g, sp.x, sp.y - 34, 'UPS', '#fca5a5')
          sound(g, 'oops')
          return false
        }
        b.length = 0
        g.hands[s] = { k: 'p', p: { rid, phase: 'masa', left: 0, burnT: 0, deco: [] } }
        burst(g, sp.x, sp.y, ['#fef3c7', '#fde68a', '#ffffff'], 10)
        sound(g, 'mix')
        return true
      }
      return nope(g, sp, 'NO AQUI')
    }

    case 'oven': {
      const o = g.oven[k]
      if (h?.k === 'p' && !o) {
        if (h.p.phase === 'masa') {
          h.p.phase = 'horno'
          h.p.left = RECIPES[h.p.rid].bake
          g.oven[k] = h.p
          g.hands[s] = null
          sound(g, 'drop')
          return false
        }
        if (h.p.phase === 'quemado') {
          // se tira: un puf gracioso y listo
          g.hands[s] = null
          burst(g, sp.x, sp.y, ['#9ca3af', '#e5e7eb'], 10)
          text(g, sp.x, sp.y - 34, 'PUF', '#d1d5db')
          sound(g, 'puff')
          return false
        }
        return nope(g, sp, 'AUN NO')
      }
      if (!h && o) {
        if (o.phase === 'horno') return nope(g, sp, 'AUN NO')
        g.oven[k] = null
        g.hands[s] = { k: 'p', p: o }
        sound(g, 'drop')
        return true
      }
      return nope(g, sp, 'NO AQUI')
    }

    case 'deco': {
      const d = g.deco[k]
      if (h?.k === 'p' && !d) {
        if (h.p.phase === 'listo' || h.p.phase === 'decor') {
          g.deco[k] = h.p
          g.hands[s] = null
          sound(g, 'drop')
          return false
        }
        return nope(g, sp, 'AUN NO')
      }
      if (!h && d) {
        g.deco[k] = null
        g.hands[s] = { k: 'p', p: d }
        sound(g, 'drop')
        return true
      }
      if (h?.k === 'i' && d) {
        const R = RECIPES[d.rid]
        if (d.phase === 'listo' && R.deco.includes(h.id) && !d.deco.includes(h.id)) {
          d.deco.push(h.id)
          g.hands[s] = null
          if (d.deco.length === R.deco.length) d.phase = 'decor'
          burst(g, sp.x, sp.y, ['#fbcfe8', '#fde047', '#ffffff'], 14)
          sound(g, 'deco')
          return false
        }
        return nope(g, sp, 'NO VA AQUI')
      }
      return nope(g, sp, 'NO AQUI')
    }

    case 'box': {
      if (h?.k === 'p' && h.p.phase === 'decor') {
        h.p.phase = 'caja'
        burst(g, sp.x, sp.y, ['#fda4af', '#fde68a'], 12)
        text(g, sp.x, sp.y - 34, 'LISTO', '#86efac')
        sound(g, 'box')
        return false
      }
      return nope(g, sp, 'AUN NO')
    }

    case 'counter': {
      const i = sp.i!
      const c = g.counter[i]
      if (h && !c) {
        g.counter[i] = h
        g.hands[s] = null
        sound(g, 'drop')
        return false
      }
      if (!h && c) {
        g.counter[i] = null
        g.hands[s] = c
        sound(g, 'pick')
        return true
      }
      return nope(g, sp, 'OCUPADO')
    }

    case 'cust': {
      const cu = g.custs[sp.i!]
      if (!cu || cu.state !== 'wait' || !h) return false
      if (h.k === 'p' && h.p.phase === 'caja') {
        if (h.p.rid !== cu.rid) return nope(g, sp, 'ESE NO')
        const R = RECIPES[cu.rid]
        const tip = Math.round((20 * Math.max(0, cu.t)) / cu.max)
        g.coins += R.price + tip
        g.served++
        cu.state = 'ok'
        cu.age = 0
        g.hands[s] = null
        text(g, sp.x, sp.y - 30, `+${R.price + tip}`, '#fde047')
        burst(g, sp.x, sp.y, ['#f472b6', '#fde68a', '#ffffff'], 18)
        sound(g, 'happy')
        return false
      }
      return nope(g, sp, 'ESE NO')
    }
  }
  return false
}

/** Soltar algo arrastrado sobre otro puesto (mostrador, cliente, estante...). */
export function release(g: Game, s: 0 | 1, origin: Spot, target: Spot | undefined) {
  if (!target || target === origin || !g.hands[s]) return
  act(g, s, target)
}

/** Mueve el cursor de teclado al puesto más cercano en esa dirección. */
export function moveCursor(g: Game, s: 0 | 1, dx: number, dy: number) {
  const from = g.spots[g.cur[s]]
  let best = -1
  let bd = Infinity
  g.spots.forEach((sp, i) => {
    if (i === g.cur[s]) return
    if (!g.solo && sp.side !== -1 && sp.side !== s) return
    const ex = sp.x - from.x
    const ey = sp.y - from.y
    const along = ex * dx + ey * dy
    if (along <= 1) return
    const across = Math.abs(ex * dy) + Math.abs(ey * dx)
    const d = along + across * 2
    if (d < bd) {
      bd = d
      best = i
    }
  })
  if (best >= 0) g.cur[s] = best
}

/** Acción del teclado: E (jugador 1) o Enter (jugador 2) sobre el puesto señalado. */
export function keyAct(g: Game, s: 0 | 1) {
  act(g, s, g.spots[g.cur[s]])
}

function spawn(g: Game) {
  const slot = g.custs.findIndex((c) => c === null)
  const waiting = g.custs.filter((c) => c && c.state === 'wait').length
  if (slot < 0 || waiting >= g.cfg.maxCust) {
    g.spawnT = 1
    return
  }
  const max = rnd(g.cfg.patience[0], g.cfg.patience[1])
  g.custs[slot] = {
    id: g.nextId++,
    animal: pick(ANIMALS).id,
    rid: pick(g.cfg.recipes),
    t: max,
    max,
    state: 'wait',
    age: 0,
  }
  g.spawnT = rnd(g.cfg.spawn[0], g.cfg.spawn[1])
  sound(g, 'bell')
}

/** Avanza el tiempo: clientes, paciencia, hornos. */
export function tick(g: Game, dt: number) {
  if (g.phase !== 'play') return
  g.t -= dt
  if (g.t <= 0) {
    g.t = 0
    g.phase = 'end'
    sound(g, 'over')
    return
  }

  g.spawnT -= dt
  if (g.spawnT <= 0) spawn(g)

  g.custs.forEach((cu, i) => {
    if (!cu) return
    if (cu.state === 'wait') {
      cu.t -= dt
      if (cu.t <= 0) {
        cu.state = 'bye'
        cu.age = 0
        g.missed++
        const sp = g.spots.find((s) => s.kind === 'cust' && s.i === i)
        if (sp) text(g, sp.x, sp.y - 20, 'OTRO DIA', '#c4b5fd')
        sound(g, 'bye')
      }
    } else {
      cu.age += dt
      if (cu.age > 1.1) g.custs[i] = null
    }
  })

  for (const k of [0, 1] as Side[]) {
    const o = g.oven[k]
    if (!o) continue
    if (o.phase === 'horno') {
      o.left -= dt
      if (o.left <= 0) {
        o.left = 0
        o.phase = 'listo'
        o.burnT = 0
        sound(g, 'ding')
      }
    } else if (o.phase === 'listo') {
      o.burnT += dt
      if (o.burnT >= BURN_AFTER) {
        o.phase = 'quemado'
        const sp = spotOf(g, 'oven', k)
        if (sp) {
          text(g, sp.x, sp.y - 34, 'HUMITO', '#d1d5db')
          burst(g, sp.x, sp.y, ['#9ca3af', '#e5e7eb'], 8)
        }
        sound(g, 'puff')
      }
    }
  }
}
