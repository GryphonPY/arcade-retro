/**
 * La cocina (un día de trabajo). Todo es táctil y multitáctil: cada dedo arrastra lo
 * suyo, así los dos juegan a la vez en el mismo iPad.
 */
import { Juice } from '../juice'
import { setupCanvas } from '../game-utils'
import { noise, tone } from '../sfx'
import { FLAVORS, FROSTS, TOPS, DECOR, flavorOf, type DecorSlot, type FlavorId, type FrostId, type TopId } from './content'
import { addCut, newCake, sprinkle, spread, type Cake, type Piece } from './cake'
import { judge, clearText, type Order } from './orders'
import {
  INK,
  rr,
  mix,
  drawAnimal,
  drawBowl,
  drawCake,
  drawKnife,
  drawPlate,
  drawPot,
  drawSpatula,
  drawTopping,
  type Animal,
  type Mood,
} from './draw'

export const KW = 800
export const KH = 560

export interface CustSpec {
  name: string
  animal: Animal
  fur: string
  order: Order
  /** Lo que dice al llegar antes del pedido (personajes con historia). */
  intro?: string
  love?: string
  ok?: string
  bad?: string
  storyId?: string
}
export interface DayCfg {
  day: number
  duo: boolean
  owned: Set<string>
  decor: Partial<Record<DecorSlot, string>>
  customers: CustSpec[]
}
export interface CakeResult {
  spec: CustSpec
  score: number
  pay: number
  declined: boolean
  cake: Cake | null
}
export interface KitchenCb {
  onHud: (h: { served: number; total: number; earned: number }) => void
  onDeliver?: (cake: Cake, r: CakeResult) => void
  onEnd: (results: CakeResult[]) => void
}

// ---------- geometría ----------
const R = 84
const PLATE = 104
const TABLES = [
  { x: 172, y: 284 },
  { x: 418, y: 284 },
]
const RACKS = [
  { x: 695, y: 112 },
  { x: 695, y: 278 },
]
const RACK_R = 50
const ROW1 = 460
const ROW2 = 526
const KNIFE = { x: 706, y: ROW1 }
const TRASH = { x: 766, y: ROW1 }
const handful: Record<TopId, number> = {
  chispas: 5,
  arandano: 3,
  fresa: 2,
  cereza: 2,
  bombon: 2,
  corazon: 2,
  estrella: 2,
  kiwi: 1,
  flor: 1,
  galleta: 1,
  macaron: 1,
  vela: 1,
}

type Drag =
  | { k: 'bowl'; flavor: FlavorId; x: number; y: number }
  | { k: 'pot'; frost: FrostId; x: number; y: number; lx: number; ly: number }
  | { k: 'top'; top: TopId; x: number; y: number }
  | { k: 'piece'; cake: Cake; piece: Piece; x: number; y: number }
  | { k: 'cake'; cake: Cake; from: { t: 'table' | 'rack'; i: number }; x: number; y: number }
  | { k: 'knife'; x: number; y: number; pts: { x: number; y: number }[] }

interface Cust {
  spec: CustSpec
  phase: 'in' | 'wait' | 'react' | 'out'
  t: number
  off: number
  say: string
  mood: Mood
  asked: boolean
  seed: number
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 5) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, maxLines)
  const y0 = y - ((shown.length - 1) * lh) / 2
  shown.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh))
}

function sfx(name: string) {
  switch (name) {
    case 'pour':
      noise({ dur: 0.06, vol: 0.012, freq: 500 })
      break
    case 'swish':
      noise({ dur: 0.05, vol: 0.015, freq: 2600 })
      break
    case 'pop':
      tone({ freq: 520 + Math.random() * 200, to: 980, dur: 0.06, type: 'sine', vol: 0.05 })
      break
    case 'grab':
      tone({ freq: 700, dur: 0.035, type: 'triangle', vol: 0.03 })
      break
    case 'drop':
      tone({ freq: 380, to: 260, dur: 0.07, type: 'triangle', vol: 0.04 })
      break
    case 'poof':
      noise({ dur: 0.1, vol: 0.03, freq: 1800 })
      break
    case 'chop':
      noise({ dur: 0.06, vol: 0.05, freq: 3200 })
      tone({ freq: 900, to: 500, dur: 0.05, type: 'square', vol: 0.02 })
      break
    case 'oven':
      tone({ freq: 220, to: 160, dur: 0.15, type: 'sine', vol: 0.05 })
      break
    case 'ding':
      ;[1568, 2093].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'sine', vol: 0.05, delay: i * 0.12 }))
      break
    case 'burn':
      noise({ dur: 0.3, vol: 0.04, freq: 700 })
      break
    case 'bell':
      ;[1319, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.05, delay: i * 0.12 }))
      break
    case 'love':
      ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'square', vol: 0.04, delay: i * 0.07 }))
      break
    case 'ok':
      ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.08 }))
      break
    case 'meh':
      ;[440, 392, 330].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.05, delay: i * 0.1 }))
      break
  }
}

export function startKitchen(canvas: HTMLCanvasElement, cfg: DayCfg, cb: KitchenCb, pf: string) {
  const ctx = setupCanvas(canvas, KW, KH)
  const juice = new Juice()
  const has = (id: string) => cfg.owned.has(id)
  const flavors = FLAVORS.filter((f) => has(f.id))
  const frosts = FROSTS.filter((f) => has(f.id))
  const tops = TOPS.filter((t) => has(t.id))
  const bowlPos = (i: number) => ({ x: 40 + i * 58, y: ROW1 })
  const potPos = (i: number) => ({ x: 340 + i * 49, y: ROW1 })
  const topPos = (i: number) => ({ x: 40 + i * 62, y: ROW2 })
  const racksOpen = has('rejilla2') ? 2 : 1
  const bakeRate = (1 / 7) * (has('turbo1') ? 1.3 : 1) * (has('turbo2') ? 1.35 : 1)
  const spreadR = has('espatula') ? 0.26 : 0.18
  const tipBonus = Object.values(cfg.decor).reduce((a, id) => a + (DECOR.find((d) => d.id === id)?.tip ?? 0), 0)

  const tables: (Cake | null)[] = [null, null]
  const racks: (Cake | null)[] = [null, null]
  const spotX = cfg.duo ? [150, 446] : [298]
  const spots: { c: Cust | null; wait: number }[] = spotX.map((_, i) => ({ c: null, wait: 0.6 + i * 2.2 }))
  const queue = [...cfg.customers]
  const total = queue.length
  const results: CakeResult[] = []
  let earned = 0
  let ended = false
  let endT = 0
  let paused = false
  let t = 0
  let pourSnd = 0
  let swishSnd = 0
  const drags = new Map<number, Drag>()

  const hud = () => cb.onHud({ served: results.length, total, earned })
  hud()

  const spotRect = (i: number) => ({ x: spotX[i] - 146, y: 8, w: 292, h: 146 })
  const inRect = (x: number, y: number, b: { x: number; y: number; w: number; h: number }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  const askBtn = (i: number) => ({ x: spotX[i] - 30, y: 124, w: 76, h: 24 })
  const noBtn = (i: number) => ({ x: spotX[i] + 52, y: 124, w: 84, h: 24 })

  const tableAt = (x: number, y: number, r: number) => TABLES.findIndex((p) => dist(p.x, p.y, x, y) < r)
  const rackAt = (x: number, y: number) => RACKS.findIndex((p, i) => i < racksOpen && dist(p.x, p.y, x, y) < RACK_R + 14)

  // ---------- clientes ----------
  const leave = (i: number) => {
    const c = spots[i].c
    if (!c) return
    c.phase = 'out'
    c.t = 0
  }

  const deliver = (i: number, cake: Cake) => {
    const c = spots[i].c
    if (!c || c.phase !== 'wait') return false
    const v = judge(cake, c.spec.order)
    const base = flavorOf(cake.flavor).price
    let pay = Math.round((base + (v.score / 100) * 30) * (1 + tipBonus))
    if (v.score < 35) pay = Math.round(base * 0.4)
    earned += pay
    const r: CakeResult = { spec: c.spec, score: v.score, pay, declined: false, cake }
    results.push(r)
    const hint = v.hints[0]
    if (v.score >= 90) {
      c.say = c.spec.love ?? pick(['¡ES PERFECTO!', '¡Lo amo! ¡Gracias!', '¡Justo lo que soñé!', '¡Qué obra de arte!'])
      c.mood = 'love'
      sfx('love')
      juice.burst(spotX[i], 80, ['#f472b6', '#fde68a', '#a7f3d0', '#c4b5fd', '#ffffff'], { count: 60, speed: 280, life: 1.2, size: 6 })
      juice.flash('#ffffff', 0.3)
      juice.shake(0.25)
    } else if (v.score >= 70) {
      c.say = c.spec.ok ?? (hint ? `¡Qué rico! Aunque... ${hint.toLowerCase()}` : '¡Qué rico, gracias!')
      c.mood = 'happy'
      sfx('ok')
      juice.burst(spotX[i], 80, ['#f472b6', '#fde68a', '#ffffff'], { count: 30, speed: 200, life: 0.9, size: 5 })
    } else if (v.score >= 45) {
      c.say = `${hint ?? 'Mmm'}... pero gracias`
      c.mood = 'calm'
      sfx('ok')
    } else {
      c.say = c.spec.bad ?? `${hint ?? 'No era lo que pedí'}...`
      c.mood = 'sad'
      sfx('meh')
    }
    juice.text(spotX[i], 40, `+${pay}`, '#d97706', 16, 1.4)
    c.phase = 'react'
    c.t = 0
    cb.onDeliver?.(cake, r)
    hud()
    return true
  }

  const decline = (i: number) => {
    const c = spots[i].c
    if (!c || c.phase !== 'wait') return
    results.push({ spec: c.spec, score: 0, pay: 0, declined: true, cake: null })
    c.say = pick(['Ay, ni modo... otro día', 'Oh, bueno. ¡Suerte!', 'Está bien, regreso luego'])
    c.mood = 'calm'
    c.phase = 'react'
    c.t = 0
    sfx('drop')
    hud()
  }

  // ---------- entrada ----------
  const toLocal = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * KW, y: ((e.clientY - r.top) / r.height) * KH }
  }

  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    if (paused) {
      paused = false
      return
    }
    if (ended) return
    const { x, y } = toLocal(e)
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // sin captura
    }
    // botones de los clientes
    for (let i = 0; i < spots.length; i++) {
      const c = spots[i].c
      if (!c || c.phase !== 'wait') continue
      if (inRect(x, y, askBtn(i))) {
        c.say = `Es decir: ${clearText(c.spec.order)}`
        c.asked = true
        sfx('grab')
        return
      }
      if (inRect(x, y, noBtn(i))) {
        decline(i)
        return
      }
    }
    // charola
    if (Math.abs(y - ROW1) < 30) {
      const bi = flavors.findIndex((_, i) => dist(bowlPos(i).x, bowlPos(i).y, x, y) < 27)
      if (bi >= 0) {
        drags.set(e.pointerId, { k: 'bowl', flavor: flavors[bi].id, x, y })
        sfx('grab')
        return
      }
      const pi = frosts.findIndex((_, i) => dist(potPos(i).x, potPos(i).y, x, y) < 24)
      if (pi >= 0) {
        drags.set(e.pointerId, { k: 'pot', frost: frosts[pi].id, x, y, lx: x, ly: y })
        sfx('grab')
        return
      }
      if (dist(KNIFE.x, KNIFE.y, x, y) < 28) {
        drags.set(e.pointerId, { k: 'knife', x, y, pts: [] })
        sfx('grab')
        return
      }
    }
    if (Math.abs(y - ROW2) < 30) {
      const ti = tops.findIndex((_, i) => dist(topPos(i).x, topPos(i).y, x, y) < 28)
      if (ti >= 0) {
        drags.set(e.pointerId, { k: 'top', top: tops[ti].id, x, y })
        sfx('grab')
        return
      }
    }
    // horno
    const ri = rackAt(x, y)
    if (ri >= 0 && racks[ri] && !isDragged(racks[ri]!)) {
      drags.set(e.pointerId, { k: 'cake', cake: racks[ri]!, from: { t: 'rack', i: ri }, x, y })
      sfx('grab')
      return
    }
    // mesas: un adorno o el pastel entero
    const ti = tableAt(x, y, PLATE + 6)
    if (ti >= 0) {
      const cake = tables[ti]
      if (!cake || isDragged(cake)) return
      const T = TABLES[ti]
      for (let k = cake.pieces.length - 1; k >= 0; k--) {
        const p = cake.pieces[k]
        if (dist(T.x + p.x * R, T.y + p.y * R, x, y) < 15) {
          cake.pieces.splice(k, 1)
          drags.set(e.pointerId, { k: 'piece', cake, piece: p, x, y })
          sfx('grab')
          return
        }
      }
      drags.set(e.pointerId, { k: 'cake', cake, from: { t: 'table', i: ti }, x, y })
      sfx('grab')
    }
  }

  const isDragged = (c: Cake) => {
    for (const d of drags.values()) if (d.k === 'cake' && d.cake === c) return true
    return false
  }

  const smear = (d: Extract<Drag, { k: 'pot' }>, x: number, y: number) => {
    const ti = tableAt(x, y, R)
    if (ti < 0) return
    const cake = tables[ti]
    if (!cake || cake.bake < 0.6 || isDragged(cake)) return
    const T = TABLES[ti]
    const steps = Math.max(1, Math.ceil(dist(d.lx, d.ly, x, y) / 4))
    let n = 0
    for (let s = 1; s <= steps; s++) {
      const px = d.lx + ((x - d.lx) * s) / steps
      const py = d.ly + ((y - d.ly) * s) / steps
      n += spread(cake, (px - T.x) / R, (py - T.y) / R, spreadR, d.frost)
    }
    if (n > 0 && t - swishSnd > 0.08) {
      swishSnd = t
      sfx('swish')
    }
  }

  const onMove = (e: PointerEvent) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    const { x, y } = toLocal(e)
    if (d.k === 'pot') {
      smear(d, x, y)
      d.lx = x
      d.ly = y
    }
    if (d.k === 'knife') d.pts.push({ x, y })
    d.x = x
    d.y = y
  }

  const onUp = (e: PointerEvent) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    drags.delete(e.pointerId)
    const { x, y } = d
    if (d.k === 'top') {
      const ti = tableAt(x, y, R)
      const cake = ti >= 0 ? tables[ti] : null
      if (cake && cake.fill > 0) {
        const T = TABLES[ti]
        const lost = sprinkle(cake, d.top, (x - T.x) / R, (y - T.y) / R, handful[d.top])
        sfx('pop')
        if (lost) juice.text(x, y - 20, 'plop', '#a26a86', 9, 0.6)
      } else sfx('poof')
    } else if (d.k === 'piece') {
      const ti = tableAt(x, y, R * 0.95)
      if (ti >= 0 && tables[ti] === d.cake) {
        const T = TABLES[ti]
        d.piece.x = (x - T.x) / R
        d.piece.y = (y - T.y) / R
        d.piece.pop = 0.4
        d.cake.pieces.push(d.piece)
        sfx('pop')
      } else {
        sfx('poof')
        juice.burst(x, y, ['#ffffff', '#fbcfe8'], { count: 5, speed: 60, life: 0.3, size: 3 })
      }
    } else if (d.k === 'cake') {
      dropCake(d, x, y)
    } else if (d.k === 'knife') {
      for (let i = 0; i < 2; i++) {
        const cake = tables[i]
        if (!cake || cake.bake < 0.6 || isDragged(cake)) continue
        const T = TABLES[i]
        const inside = d.pts.filter((p) => dist(p.x, p.y, T.x, T.y) < R)
        if (inside.length < 2) continue
        const a = inside[0]
        const b = inside[inside.length - 1]
        if (dist(a.x, a.y, b.x, b.y) < R * 0.9) continue
        if (addCut(cake, Math.atan2(b.y - a.y, b.x - a.x))) {
          sfx('chop')
          juice.burst((a.x + b.x) / 2, (a.y + b.y) / 2, [mix(flavorOf(cake.flavor).baked, '#ffffff', 0.3)], { count: 8, speed: 80, life: 0.4, size: 3 })
        }
      }
    }
  }

  const dropCake = (d: Extract<Drag, { k: 'cake' }>, x: number, y: number) => {
    const from = d.from
    const clearFrom = () => {
      if (from.t === 'table') tables[from.i] = null
      else racks[from.i] = null
    }
    // entregar
    for (let i = 0; i < spots.length; i++) {
      if (inRect(x, y, spotRect(i)) && spots[i].c?.phase === 'wait') {
        if (deliver(i, d.cake)) {
          clearFrom()
          return
        }
      }
    }
    if (dist(TRASH.x, TRASH.y, x, y) < 36) {
      clearFrom()
      sfx('poof')
      juice.burst(TRASH.x, TRASH.y, ['#ffffff', '#fbcfe8', '#fde68a'], { count: 12, speed: 120, life: 0.5, size: 4 })
      return
    }
    const ri = rackAt(x, y)
    if (ri >= 0 && (!racks[ri] || racks[ri] === d.cake)) {
      clearFrom()
      racks[ri] = d.cake
      if (from.t !== 'rack' || from.i !== ri) sfx('oven')
      return
    }
    const ti = tableAt(x, y, PLATE)
    if (ti >= 0 && (!tables[ti] || tables[ti] === d.cake)) {
      clearFrom()
      tables[ti] = d.cake
      sfx('drop')
      return
    }
    sfx('drop') // regresa a su lugar
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyP') paused = !paused
  }
  const pauseNow = () => {
    if (!ended) paused = true
    drags.clear()
  }
  const onVis = () => {
    if (document.hidden) pauseNow()
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', pauseNow)
  document.addEventListener('visibilitychange', onVis)

  // ---------- bucle ----------
  const update = (dt: number) => {
    for (const c of [...tables, ...racks]) if (c) for (const p of c.pieces) p.pop = Math.max(0, p.pop - dt * 4)
    if (paused) return
    // verter masa
    for (const d of drags.values()) {
      if (d.k !== 'bowl') continue
      const ti = tableAt(d.x, d.y, R * 1.05)
      if (ti < 0) continue
      if (!tables[ti]) tables[ti] = newCake(d.flavor)
      const cake = tables[ti]!
      if (cake.flavor !== d.flavor || cake.bake > 0 || isDragged(cake)) continue
      cake.fill += dt * 0.5
      if (cake.fill > 1.08) cake.spill += dt * 0.4
      if (t - pourSnd > 0.07) {
        pourSnd = t
        sfx('pour')
      }
    }
    // horno
    racks.forEach((c, i) => {
      if (!c || isDragged(c)) return
      const before = c.bake
      c.bake += dt * bakeRate
      if (has('campana') && before < 0.95 && c.bake >= 0.95) {
        sfx('ding')
        juice.text(RACKS[i].x, RACKS[i].y - 56, '¡LISTO!', '#16a34a', 11, 1.2)
      }
      if (before < 1.4 && c.bake >= 1.4) {
        sfx('burn')
        juice.text(RACKS[i].x, RACKS[i].y - 56, '¡SE QUEMA!', '#dc2626', 11, 1.2)
      }
      if (c.bake > 1.4 && Math.random() < dt * 6) juice.burst(RACKS[i].x + (Math.random() - 0.5) * 60, RACKS[i].y - 30, ['#9ca3af', '#d1d5db'], { count: 1, speed: 30, life: 0.8, size: 5 })
    })
    // clientes
    spots.forEach((s, i) => {
      const c = s.c
      if (!c) {
        if (queue.length === 0) return
        s.wait -= dt
        if (s.wait <= 0) {
          const spec = queue.shift()!
          s.c = { spec, phase: 'in', t: 0, off: 260, say: spec.intro ? `${spec.intro} ${spec.order.text}` : spec.order.text, mood: 'calm', asked: false, seed: Math.random() * 10 }
          sfx('bell')
        }
        return
      }
      c.t += dt
      if (c.phase === 'in') {
        c.off += (0 - c.off) * Math.min(1, dt * 7)
        if (c.off < 2) {
          c.off = 0
          c.phase = 'wait'
        }
      } else if (c.phase === 'react' && c.t > 2.8) leave(i)
      else if (c.phase === 'out') {
        c.off -= dt * 600
        if (c.off < -320) {
          s.c = null
          s.wait = 1
        }
      }
    })
    if (!ended && queue.length === 0 && spots.every((s) => !s.c) && results.length >= total) {
      endT += dt
      if (endT > 0.8) {
        ended = true
        cb.onEnd(results)
      }
    }
  }

  // ---------- dibujo ----------
  const decorColor = (slot: DecorSlot, def: string) => DECOR.find((d) => d.id === cfg.decor[slot])?.color ?? def

  const drawRoom = () => {
    // pared
    const wall = decorColor('pared', '#ffe4ef')
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, KW, KH)
    ctx.fillStyle = mix(wall, '#ffffff', 0.45)
    for (let x = 0; x < KW; x += 36) ctx.fillRect(x, 0, 18, 160)
    // piso de la cocina
    const floor = decorColor('piso', '#f6dcc7')
    ctx.fillStyle = floor
    ctx.fillRect(0, 158, 594, 250)
    if (cfg.decor.piso === 'piso-ajedrez') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (let y = 158; y < 408; y += 32) for (let x = (Math.floor((y - 158) / 32) % 2) * 32; x < 594; x += 64) ctx.fillRect(x, y, 32, 32)
    } else {
      ctx.strokeStyle = 'rgba(91,42,58,0.08)'
      ctx.lineWidth = 2
      for (let y = 158; y < 408; y += 26) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(594, y)
        ctx.stroke()
      }
    }
    // mesa de trabajo
    ctx.fillStyle = '#f3d3ab'
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    rr(ctx, 14, 168, 566, 236, 26)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    rr(ctx, 26, 176, 542, 10, 5)
    ctx.fill()
    // plantas y lámparas
    if (cfg.decor.planta) {
      const col = decorColor('planta', '#5fbf7f')
      for (const px of [36, 556]) {
        ctx.fillStyle = '#e8a87c'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        rr(ctx, px - 12, 372, 24, 26, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = col
        for (let k = 0; k < 4; k++) {
          ctx.beginPath()
          ctx.ellipse(px + (k - 1.5) * 7, 362 - (k % 2) * 8, 8, 13, (k - 1.5) * 0.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }
    // ventanilla de clientes
    ctx.fillStyle = '#bae6fd'
    rr(ctx, 8, 6, 586, 150, 22)
    ctx.fill()
    ctx.save()
    rr(ctx, 8, 6, 586, 150, 22)
    ctx.clip()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 0.37 + t * 0.006) % 1.2) * 600
      ctx.beginPath()
      ctx.arc(cx, 46 + i * 14, 13, 0, Math.PI * 2)
      ctx.arc(cx + 15, 40 + i * 14, 16, 0, Math.PI * 2)
      ctx.arc(cx + 30, 46 + i * 14, 12, 0, Math.PI * 2)
      ctx.fill()
    }
    // mostrador de la ventanilla
    ctx.fillStyle = '#e8b98a'
    ctx.fillRect(8, 140, 586, 16)
    spots.forEach((s, i) => s.c && drawCustomer(i, s.c))
    ctx.restore()
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    rr(ctx, 8, 6, 586, 150, 22)
    ctx.stroke()
    // toldo
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f472b6'
      const x = 8 + (i * 586) / 13
      const w = 586 / 13
      ctx.beginPath()
      ctx.moveTo(x, 6)
      ctx.lineTo(x + w, 6)
      ctx.lineTo(x + w, 16)
      ctx.arc(x + w / 2, 16, w / 2, 0, Math.PI)
      ctx.closePath()
      ctx.fill()
    }
    if (cfg.decor.letrero) {
      ctx.save()
      ctx.font = `10px ${pf}`
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ff7ab6'
      ctx.shadowBlur = 10 + Math.sin(t * 3) * 3
      ctx.fillStyle = '#ffe4f1'
      ctx.fillText('PASTELERÍA', 300, 34)
      ctx.restore()
    }
    if (cfg.decor.lampara) {
      for (const T of TABLES) {
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(T.x, 156)
        ctx.lineTo(T.x, 166)
        ctx.stroke()
        ctx.fillStyle = '#fff2b3'
        ctx.beginPath()
        ctx.arc(T.x, 172, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  const drawCustomer = (i: number, c: Cust) => {
    const sx = spotX[i] + c.off
    const hop = c.phase === 'react' && c.mood !== 'sad' ? -Math.abs(Math.sin(c.t * 9)) * 8 : Math.sin(t * 2 + c.seed) * 1.5
    drawAnimal(ctx, c.spec.animal, c.spec.fur, sx - 92, 92 + hop, 0.95, c.mood, t, c.seed)
    // nombre
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = INK
    ctx.fillText(c.spec.name, sx - 92, 152)
    // globo
    if (c.phase === 'in') return
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.5
    rr(ctx, sx - 40, 24, 180, 96, 16)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(sx - 38, 70)
    ctx.lineTo(sx - 52, 80)
    ctx.lineTo(sx - 38, 84)
    ctx.fill()
    ctx.fillStyle = c.phase === 'react' ? (c.mood === 'sad' ? '#7c3aed' : '#db2777') : INK
    ctx.font = `bold ${c.say.length > 70 ? 11 : 12}px sans-serif`
    wrap(ctx, c.say, sx + 50, 72, 166, c.say.length > 70 ? 13 : 15, 6)
    if (c.phase === 'wait') {
      for (const [b, label, fill] of [
        [askBtn(i), '¿Cómo?', '#fde68a'],
        [noBtn(i), 'No puedo', '#fbcfe8'],
      ] as const) {
        ctx.fillStyle = fill
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        rr(ctx, b.x + c.off, b.y, b.w, b.h, 12)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = INK
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText(label, b.x + c.off + b.w / 2, b.y + 16)
      }
    }
  }

  const drawOven = () => {
    ctx.fillStyle = '#fca5a5'
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    rr(ctx, 604, 14, 184, 384, 26)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = mix('#fca5a5', '#ffffff', 0.4)
    rr(ctx, 614, 22, 164, 14, 7)
    ctx.fill()
    for (let i = 0; i < 2; i++) {
      const P = RACKS[i]
      const c = racks[i]
      const open = i < racksOpen
      ctx.fillStyle = open ? '#7c2d12' : '#9ca3af'
      ctx.strokeStyle = INK
      rr(ctx, P.x - 70, P.y - 66, 140, 132, 20)
      ctx.fill()
      ctx.stroke()
      if (!open) {
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('🔒 Segunda rejilla', P.x, P.y - 4)
        ctx.fillText('en la tienda', P.x, P.y + 14)
        continue
      }
      const heat = c ? 0.55 + Math.sin(t * 5) * 0.1 : 0.2
      const g = ctx.createRadialGradient(P.x, P.y, 6, P.x, P.y, 80)
      g.addColorStop(0, `rgba(251,146,60,${heat})`)
      g.addColorStop(1, 'rgba(251,146,60,0)')
      ctx.fillStyle = g
      ctx.fillRect(P.x - 70, P.y - 66, 140, 132)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 2
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath()
        ctx.moveTo(P.x - 60, P.y + k * 22)
        ctx.lineTo(P.x + 60, P.y + k * 22)
        ctx.stroke()
      }
      if (c && !isDragged(c)) {
        drawCake(ctx, c, P.x, P.y, RACK_R, t)
        // medidor de horneado
        const bx = P.x - 56
        const by = P.y + 52
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        rr(ctx, bx, by, 112, 9, 4)
        ctx.fill()
        if (has('campana')) {
          ctx.fillStyle = '#86efac'
          ctx.fillRect(bx + (0.95 / 1.6) * 112, by + 1, ((1.15 - 0.95) / 1.6) * 112, 7)
        }
        ctx.fillStyle = c.bake > 1.4 ? '#dc2626' : c.bake > 0.95 ? '#f59e0b' : '#fb923c'
        ctx.fillRect(bx + 1, by + 1, Math.min(110, (c.bake / 1.6) * 110), 7)
      }
    }
    // perillas con carita
    ctx.fillStyle = '#fde68a'
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    for (const dx of [-40, 0, 40]) {
      ctx.beginPath()
      ctx.arc(695 + dx, 372, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  const drawTray = () => {
    ctx.fillStyle = '#e8b98a'
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    rr(ctx, 6, 414, 788, 142, 20)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#d39a68'
    ctx.fillRect(16, 492, 768, 4)
    ctx.textAlign = 'center'
    flavors.forEach((f, i) => {
      const p = bowlPos(i)
      drawBowl(ctx, p.x, p.y, 23, f.raw)
      ctx.fillStyle = INK
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText(f.name, p.x, p.y + 33)
    })
    frosts.forEach((f, i) => {
      const p = potPos(i)
      drawPot(ctx, p.x, p.y, 20, f.color)
    })
    drawKnife(ctx, KNIFE.x, KNIFE.y + 2, 0.6)
    // basura
    ctx.fillStyle = '#c4b5fd'
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    rr(ctx, TRASH.x - 18, TRASH.y - 16, 36, 36, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#a78bfa'
    rr(ctx, TRASH.x - 21, TRASH.y - 22, 42, 8, 4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = 'bold 9px sans-serif'
    ctx.fillText('basura', TRASH.x, TRASH.y + 32)
    ctx.fillText('cuchillo', KNIFE.x, KNIFE.y + 32)
    tops.forEach((tp, i) => {
      const p = topPos(i)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(91,42,58,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 25, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // el bote se ve lleno de piezas
      for (let k = 0; k < 3; k++) drawTopping(ctx, tp.id, p.x + (k - 1) * 9, p.y + (k % 2) * 5 - 2, 0.85, k * 0.7, t)
    })
  }

  const drawDrags = () => {
    for (const d of drags.values()) {
      if (d.k === 'bowl') {
        const ti = tableAt(d.x, d.y, R * 1.05)
        if (ti >= 0) {
          // chorrito de masa
          ctx.strokeStyle = flavorOf(d.flavor).raw
          ctx.lineWidth = 7
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(d.x + 12, d.y - 8)
          ctx.quadraticCurveTo(d.x + 20, d.y + 10, d.x + 14 + Math.sin(t * 20) * 2, d.y + 24)
          ctx.stroke()
        }
        ctx.save()
        ctx.translate(d.x, d.y - 26)
        ctx.rotate(ti >= 0 ? 0.6 : 0)
        drawBowl(ctx, 0, 0, 28, flavorOf(d.flavor).raw)
        ctx.restore()
      } else if (d.k === 'pot') {
        drawSpatula(ctx, d.x + 6, d.y - 6, FROSTS.find((f) => f.id === d.frost)!.color)
      } else if (d.k === 'top') {
        const n = handful[d.top]
        for (let k = 0; k < n; k++) drawTopping(ctx, d.top, d.x + Math.cos(k * 2.4) * 8 * Math.min(1, k), d.y - 18 + Math.sin(k * 2.4) * 6 * Math.min(1, k), 1.3, k, t)
      } else if (d.k === 'piece') {
        drawTopping(ctx, d.piece.top, d.x, d.y - 14, 1.5, d.piece.rot, t)
      } else if (d.k === 'cake') {
        drawPlate(ctx, d.x, d.y, PLATE * 0.8, null)
        drawCake(ctx, d.cake, d.x, d.y, R * 0.8, t)
      } else {
        if (d.pts.length > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.beginPath()
          const tail = d.pts.slice(-14)
          tail.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
          ctx.stroke()
        }
        drawKnife(ctx, d.x, d.y - 10, 0.2)
      }
    }
  }

  const draw = () => {
    ctx.save()
    juice.applyShake(ctx)
    drawRoom()
    // mesas
    const draggingCake = [...drags.values()].some((d) => d.k === 'cake')
    TABLES.forEach((T, i) => {
      const cake = tables[i]
      drawPlate(ctx, T.x, T.y, PLATE, draggingCake && !cake ? '#f472b6' : null)
      if (cake && !isDragged(cake)) drawCake(ctx, cake, T.x, T.y, R, t, { guide: has('guia') && [...drags.values()].some((d) => d.k === 'knife') })
      if (!cake) {
        ctx.fillStyle = 'rgba(91,42,58,0.35)'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('arrastra un tazón aquí', T.x, T.y + 4)
      }
    })
    drawOven()
    drawTray()
    drawDrags()
    juice.drawParticles(ctx)
    juice.drawTexts(ctx, pf)
    ctx.restore()
    juice.drawFlash(ctx, KW, KH)
    // contador de clientes
    ctx.fillStyle = INK
    ctx.font = `8px ${pf}`
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.min(results.length, total)}/${total}`, 586, 30)
    if (paused) {
      ctx.fillStyle = 'rgba(91,42,58,0.55)'
      ctx.fillRect(0, 0, KW, KH)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = `16px ${pf}`
      ctx.fillText('PAUSA', KW / 2, KH / 2)
      ctx.font = `8px ${pf}`
      ctx.fillText('TOCA PARA SEGUIR', KW / 2, KH / 2 + 28)
    }
  }

  let raf = 0
  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    update(juice.update(dt))
    draw()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    destroy() {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', pauseNow)
      document.removeEventListener('visibilitychange', onVis)
    },
    pause() {
      paused = true
    },
  }
}
