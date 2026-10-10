/**
 * El café en vivo: clientes que llegan, estaciones atendidas por michis, meseros que
 * llevan los pedidos y monedas que se recogen. Multitáctil: los dos juegan a la vez.
 */
import { Juice } from '../juice'
import { setupCanvas } from '../game-utils'
import { tone, noise } from '../sfx'
import { drawAnimal, ANIMALS, FURS, type Animal, type Mood } from '../pasteleria/draw'
import { CATS, DECOR, EXPANSIONS, STATIONS, catSpeed, priceAt, recipeOf, stationSpeed, type CatDef, type ItemId, type StationId } from './content'
import { menu, type CafeSave, type StaffSave } from './save'
import { INK, rr, drawCat, drawCoins, drawItem, drawStation, drawTable } from './draw'

export const CW = 800
export const CH = 560

const STATION_X = [92, 196, 300, 404, 508]
const STATION_Y = 206
const SHELF = { x: 600, y: 150, w: 192, h: 58 }
const shelfPos = (i: number) => ({ x: 624 + (i % 4) * 44, y: i < 4 ? 168 : 196 })
const TABLES = [
  { x: 92, y: 352 },
  { x: 236, y: 352 },
  { x: 380, y: 352 },
  { x: 92, y: 480 },
  { x: 236, y: 480 },
  { x: 380, y: 480 },
  { x: 572, y: 372 },
  { x: 712, y: 372 },
  { x: 572, y: 500 },
  { x: 712, y: 500 },
]
const DOOR = { x: -40, y: 420 }

interface Cust {
  id: number
  animal: Animal
  fur: string
  table: number
  want: ItemId[]
  got: ItemId[]
  phase: 'in' | 'wait' | 'eat' | 'out'
  t: number
  x: number
  y: number
  pat: number
  patMax: number
  vip: boolean
  hand: boolean
}
interface Ticket {
  id: number
  item: ItemId
  cust: number
  phase: 'queue' | 'ready' | 'carry'
  prog: number
  slot: number
  carrier: Worker | null
}
interface Worker {
  def: CatDef
  sv: StaffSave
  x: number
  y: number
  boost: number
  carry: Ticket | null
  goal: 'shelf' | 'table' | null
  dir: -1 | 1
}
interface Pile {
  table: number
  coins: number
  hearts: number
  t: number
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

function sfx(n: string) {
  switch (n) {
    case 'coin':
      tone({ freq: 1319, dur: 0.06, type: 'square', vol: 0.03 })
      tone({ freq: 1760, dur: 0.08, type: 'square', vol: 0.03, delay: 0.05 })
      break
    case 'bell':
      ;[1568, 1319].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.04, delay: i * 0.1 }))
      break
    case 'ding':
      tone({ freq: 1047, dur: 0.12, type: 'sine', vol: 0.04 })
      break
    case 'pop':
      tone({ freq: 600, to: 1000, dur: 0.06, type: 'sine', vol: 0.05 })
      break
    case 'purr':
      noise({ dur: 0.25, vol: 0.03, freq: 160 })
      tone({ freq: 880, to: 1320, dur: 0.1, type: 'triangle', vol: 0.03, delay: 0.05 })
      break
    case 'yum':
      ;[659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.04, delay: i * 0.07 }))
      break
    case 'grab':
      tone({ freq: 700, dur: 0.035, type: 'triangle', vol: 0.03 })
      break
  }
}

export function startScene(canvas: HTMLCanvasElement, save: CafeSave, cb: { onChange: () => void }, pf: string) {
  const ctx = setupCanvas(canvas, CW, CH)
  const juice = new Juice()
  let t = 0
  let nextId = 1
  let spawnT = 2
  const custs: Cust[] = []
  const tickets: Ticket[] = []
  const piles: Pile[] = []
  let workers: Worker[] = []
  const drags = new Map<number, { tk: Ticket; x: number; y: number }>()

  const stationsOwned = () => STATIONS.filter((s) => save.stations[s.id])
  const stationX = (id: StationId) => STATION_X[STATIONS.findIndex((s) => s.id === id)]
  const tablesOpen = () => EXPANSIONS[save.exp].tables
  const rep = () => save.decor.filter((id) => Object.values(save.placed).includes(id)).reduce((a, id) => a + (DECOR.find((d) => d.id === id)?.rep ?? 0), 0) + Math.min(6, save.hearts / 60)

  const homeOf = (sv: StaffSave, i: number) => {
    if (sv.job === 'mesero') return { x: 640 + (i % 4) * 36, y: 262 }
    if (sv.job) return { x: stationX(sv.job), y: 262 }
    return { x: 30 + (i % 3) * 30, y: 290 }
  }

  const rebuild = () => {
    const prev = new Map(workers.map((w) => [w.def.id, w]))
    workers = save.staff.map((sv, i) => {
      const old = prev.get(sv.id)
      const h = homeOf(sv, i)
      const def = CATS.find((c) => c.id === sv.id)!
      if (old) {
        old.sv = sv
        if (sv.job !== 'mesero' && old.carry) {
          old.carry.phase = 'ready'
          old.carry.carrier = null
          old.carry.slot = freeSlot()
          old.carry = null
        }
        return old
      }
      return { def, sv, x: h.x, y: h.y, boost: 0, carry: null, goal: null, dir: 1 }
    })
  }
  const freeSlot = () => {
    for (let i = 0; i < 8; i++) if (!tickets.some((k) => k.phase === 'ready' && k.slot === i)) return i
    return -1
  }
  rebuild()

  // ---------- clientes ----------
  const spawn = () => {
    const items = menu(save)
    if (!items.length) return
    const busy = new Set(custs.map((c) => c.table))
    const free = Array.from({ length: tablesOpen() }, (_, i) => i).filter((i) => !busy.has(i))
    if (!free.length) return
    const table = pick(free)
    const vip = save.served >= 6 && Math.random() < 0.09
    const n = vip ? 2 : Math.random() < 0.18 && items.length > 1 ? 2 : 1
    const want: ItemId[] = []
    for (let i = 0; i < n; i++) want.push(pick(items))
    const a = pick(ANIMALS)
    const patMax = vip ? 95 : 75
    custs.push({ id: nextId++, animal: a, fur: pick(FURS[a]), table, want, got: [], phase: 'in', t: 0, x: DOOR.x, y: DOOR.y, pat: patMax, patMax, vip, hand: false })
    sfx('bell')
  }

  const placeOrder = (c: Cust) => {
    for (const item of c.want) {
      const free = tickets.find((k) => k.cust === -1 && k.item === item && k.phase === 'ready')
      if (free) free.cust = c.id
      else tickets.push({ id: nextId++, item, cust: c.id, phase: 'queue', prog: 0, slot: -1, carrier: null })
    }
  }

  const needs = (c: Cust, item: ItemId) => c.phase === 'wait' && c.want.filter((x) => x === item).length > c.got.filter((x) => x === item).length

  const deliver = (tk: Ticket, c: Cust, hand: boolean) => {
    c.got.push(tk.item)
    if (hand) c.hand = true
    tickets.splice(tickets.indexOf(tk), 1)
    const T = TABLES[c.table]
    juice.burst(T.x, T.y - 30, ['#f472b6', '#fde68a', '#ffffff'], { count: 10, speed: 90, life: 0.5, size: 3 })
    sfx('yum')
    if (c.got.length >= c.want.length) {
      c.phase = 'eat'
      c.t = 0
    }
  }

  const leave = (c: Cust, paid: boolean) => {
    if (paid) {
      const base = c.want.reduce((a, id) => a + priceAt(recipeOf(id), save.recipes[id] ?? 1), 0)
      const coins = Math.round(base * (c.vip ? 3 : 1) * (1 + (c.hand ? 0.25 : 0)) * (0.8 + 0.2 * (c.pat / c.patMax)))
      piles.push({ table: c.table, coins, hearts: c.vip ? 3 : 1, t: 0 })
      save.served++
    } else {
      // lo que ya estaba listo queda libre para otro cliente
      for (let i = tickets.length - 1; i >= 0; i--) {
        const k = tickets[i]
        if (k.cust !== c.id) continue
        if (k.phase === 'queue') tickets.splice(i, 1)
        else k.cust = -1
      }
      juice.text(TABLES[c.table].x, TABLES[c.table].y - 60, 'ya me voy...', '#a78bfa', 9, 1)
    }
    c.phase = 'out'
    c.t = 0
  }

  const collect = (p: Pile, bonus: boolean) => {
    const coins = Math.round(p.coins * (bonus ? 1.1 : 1))
    save.coins += coins
    save.hearts += p.hearts
    piles.splice(piles.indexOf(p), 1)
    const T = TABLES[p.table]
    juice.text(T.x, T.y - 30, `+${coins}`, '#d97706', 13, 1)
    juice.burst(T.x, T.y - 10, ['#facc15', '#fde68a', '#f472b6'], { count: 12, speed: 120, life: 0.6, size: 4 })
    sfx('coin')
    cb.onChange()
  }

  // ---------- entrada ----------
  const toLocal = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH }
  }
  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    const { x, y } = toLocal(e)
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // sin captura
    }
    // monedas
    for (const p of piles) {
      const T = TABLES[p.table]
      if (dist(T.x, T.y - 8, x, y) < 40) {
        collect(p, true)
        return
      }
    }
    // pedido listo en la barra: se lleva a mano
    for (const k of tickets) {
      if (k.phase !== 'ready' || k.slot < 0) continue
      const P = shelfPos(k.slot)
      if (dist(P.x, P.y, x, y) < 22) {
        k.phase = 'carry'
        k.slot = -1
        drags.set(e.pointerId, { tk: k, x, y })
        sfx('grab')
        return
      }
    }
    // apapachar a un michi
    for (const w of workers) {
      if (dist(w.x, w.y - 30, x, y) < 30) {
        w.boost = 6
        sfx('purr')
        juice.burst(w.x, w.y - 50, ['#f472b6', '#fb7185'], { count: 6, speed: 60, life: 0.7, size: 4 })
        juice.text(w.x, w.y - 74, '♥', '#ec4899', 14, 0.8)
        return
      }
    }
    // tocar una estación ayuda a preparar
    for (const s of stationsOwned()) {
      const sx = stationX(s.id)
      if (Math.abs(x - sx) < 36 && y > STATION_Y - 70 && y < STATION_Y + 10) {
        const k = tickets.find((q) => q.phase === 'queue' && recipeOf(q.item).station === s.id)
        if (k) {
          k.prog += 0.6 / recipeOf(k.item).time
          juice.burst(sx, STATION_Y - 40, ['#ffffff', '#fde68a'], { count: 4, speed: 60, life: 0.3, size: 3 })
          sfx('pop')
        }
        return
      }
    }
  }
  const onMove = (e: PointerEvent) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    const p = toLocal(e)
    d.x = p.x
    d.y = p.y
  }
  const onUp = (e: PointerEvent) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    drags.delete(e.pointerId)
    // cualquier cliente que lo quiera, cerca de donde se soltó
    let best: Cust | null = null
    let bd = 80
    for (const c of custs) {
      if (!needs(c, d.tk.item)) continue
      const T = TABLES[c.table]
      const dd = dist(T.x, T.y - 30, d.x, d.y)
      if (dd < bd) {
        bd = dd
        best = c
      }
    }
    if (best) {
      if (d.tk.cust !== best.id) {
        // si era de otro cliente, ese recibirá el siguiente
        const owner = custs.find((c) => c.id === d.tk.cust)
        if (owner && owner.phase === 'wait') tickets.push({ id: nextId++, item: d.tk.item, cust: owner.id, phase: 'queue', prog: 0, slot: -1, carrier: null })
        const mine = tickets.find((k) => k.cust === best!.id && k.item === d.tk.item && k.phase === 'queue')
        if (mine) tickets.splice(tickets.indexOf(mine), 1)
      }
      deliver(d.tk, best, true)
    } else {
      d.tk.phase = 'ready'
      d.tk.slot = freeSlot()
    }
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  // ---------- simulación ----------
  const moveTo = (o: { x: number; y: number }, tx: number, ty: number, sp: number, dt: number) => {
    const d = dist(o.x, o.y, tx, ty)
    if (d < 2) return true
    const k = Math.min(1, (sp * dt) / d)
    o.x += (tx - o.x) * k
    o.y += (ty - o.y) * k
    return d < 4
  }

  const update = (dt: number) => {
    spawnT -= dt
    if (spawnT <= 0) {
      spawn()
      spawnT = Math.max(2.4, 9 - 0.35 * rep() - 0.5 * save.exp) * (0.7 + Math.random() * 0.6)
    }
    // estaciones: cada michi asignado trabaja un pedido
    for (const s of stationsOwned()) {
      const staff = workers.filter((w) => w.sv.job === s.id)
      const queue = tickets.filter((k) => k.phase === 'queue' && recipeOf(k.item).station === s.id)
      staff.forEach((w, i) => {
        const k = queue[i]
        if (!k) return
        k.prog += (dt * stationSpeed(save.stations[s.id] ?? 1) * catSpeed(w.def, w.sv.lvl) * (w.boost > 0 ? 2 : 1)) / recipeOf(k.item).time
      })
      for (const k of queue) {
        if (k.prog < 1) continue
        const slot = freeSlot()
        if (slot < 0) {
          k.prog = 1
          continue
        }
        k.phase = 'ready'
        k.slot = slot
        sfx('ding')
        const P = shelfPos(slot)
        juice.burst(P.x, P.y, ['#ffffff', '#fde68a'], { count: 6, speed: 60, life: 0.4, size: 3 })
      }
    }
    // meseros
    workers.forEach((w, i) => {
      w.boost = Math.max(0, w.boost - dt)
      const home = homeOf(w.sv, i)
      if (w.sv.job !== 'mesero') {
        moveTo(w, home.x, home.y, 160, dt)
        return
      }
      const sp = 130 * catSpeed(w.def, w.sv.lvl) * (w.boost > 0 ? 1.6 : 1)
      if (!w.carry) {
        const k = tickets.find((q) => q.phase === 'ready' && !q.carrier && q.slot >= 0 && custs.some((c) => (q.cust === c.id || q.cust === -1) && needs(c, q.item)))
        if (k) {
          k.carrier = w
          w.carry = k
          w.goal = 'shelf'
        } else {
          moveTo(w, home.x, home.y, sp, dt)
          return
        }
      }
      const k = w.carry!
      if (w.goal === 'shelf') {
        const P = shelfPos(Math.max(0, k.slot))
        if (moveTo(w, P.x, P.y + 66, sp, dt)) {
          k.phase = 'carry'
          k.slot = -1
          w.goal = 'table'
        }
      } else {
        let c = custs.find((q) => q.id === k.cust && needs(q, k.item))
        if (!c) c = custs.find((q) => needs(q, k.item))
        if (!c) {
          // nadie lo quiere ya: de vuelta a la barra
          k.phase = 'ready'
          k.carrier = null
          k.cust = -1
          k.slot = freeSlot()
          w.carry = null
          w.goal = null
          return
        }
        k.cust = c.id
        const T = TABLES[c.table]
        w.dir = T.x < w.x ? -1 : 1
        if (moveTo(w, T.x + 46, T.y + 24, sp, dt)) {
          deliver(k, c, false)
          w.carry = null
          w.goal = null
        }
      }
    })
    // clientes
    for (let i = custs.length - 1; i >= 0; i--) {
      const c = custs[i]
      c.t += dt
      const T = TABLES[c.table]
      if (c.phase === 'in') {
        if (moveTo(c, T.x, T.y - 40, 170, dt)) {
          c.phase = 'wait'
          placeOrder(c)
        }
      } else if (c.phase === 'wait') {
        c.pat -= dt
        if (c.pat <= 0) leave(c, false)
      } else if (c.phase === 'eat') {
        if (c.t > 3) leave(c, true)
      } else if (moveTo(c, DOOR.x, DOOR.y, 200, dt)) custs.splice(i, 1)
    }
    // monedas que se recogen solas
    for (let i = piles.length - 1; i >= 0; i--) {
      piles[i].t += dt
      if (piles[i].t > 14) collect(piles[i], false)
    }
  }

  // ---------- dibujo ----------
  const theme = () => DECOR.find((d) => d.id === save.placed.tema)
  const placed = (slot: string) => DECOR.find((d) => d.id === save.placed[slot as keyof typeof save.placed])

  const drawRoom = () => {
    const th = theme()
    const wall = th?.wall ?? '#ffe4ef'
    const floor = th?.floor ?? '#f6dcc7'
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, CW, 150)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (let x = 0; x < CW; x += 40) ctx.fillRect(x, 0, 20, 150)
    // ventanas
    for (const wx of [70, 260, 450]) {
      ctx.fillStyle = th?.id === 'tema-noche' ? '#1e1b4b' : '#bae6fd'
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      rr(ctx, wx, 18, 120, 70, 14)
      ctx.fill()
      ctx.stroke()
      if (th?.id === 'tema-noche') {
        ctx.fillStyle = '#fde047'
        for (let k = 0; k < 4; k++) ctx.fillRect(wx + 15 + k * 27, 30 + (k % 2) * 20, 3, 3)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        const cx = wx + 20 + ((t * 6 + wx) % 90)
        ctx.beginPath()
        ctx.arc(cx, 46, 9, 0, Math.PI * 2)
        ctx.arc(cx + 11, 42, 11, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = INK
      ctx.fillRect(wx + 59, 18, 3, 70)
    }
    // cuadro
    const cu = placed('cuadro')
    if (cu) {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.5
      rr(ctx, 640, 24, 54, 64, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = cu.color
      rr(ctx, 647, 31, 40, 50, 4)
      ctx.fill()
      if (cu.id === 'cuadro-retrato') drawCat(ctx, CATS[0], 'corona', 667, 82, 0.45, t)
      else {
        ctx.fillStyle = '#fb923c'
        ctx.beginPath()
        ctx.ellipse(667, 56, 12, 7, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // lámparas
    const la = placed('lampara')
    if (la) {
      for (let k = 0; k < 9; k++) {
        const lx = 30 + k * 90
        ctx.strokeStyle = INK
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(lx, 0)
        ctx.lineTo(lx, 10 + (k % 2) * 6)
        ctx.stroke()
        ctx.fillStyle = la.color
        ctx.beginPath()
        if (la.id === 'lampara-estrellas') {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2
            const r = i % 2 ? 3 : 7
            ctx.lineTo(lx + Math.cos(a) * r, 16 + (k % 2) * 6 + Math.sin(a) * r)
          }
          ctx.closePath()
        } else ctx.arc(lx, 16 + (k % 2) * 6, 7, 0, Math.PI * 2)
        ctx.globalAlpha = 0.7 + Math.sin(t * 2 + k) * 0.3
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    // planta colgante
    const p1 = placed('planta1')
    if (p1) {
      ctx.fillStyle = p1.color
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      for (let k = 0; k < 6; k++) {
        ctx.beginPath()
        ctx.ellipse(28 + (k % 3) * 8, 40 + k * 9, 7, 11, (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
    // piso del salón
    ctx.fillStyle = floor
    ctx.fillRect(0, 214, 520, CH - 214)
    ctx.strokeStyle = 'rgba(91,42,58,0.08)'
    ctx.lineWidth = 2
    for (let y = 214; y < CH; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(520, y)
      ctx.stroke()
    }
    const tp = placed('tapete')
    if (tp) {
      ctx.fillStyle = tp.color
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(236, 420, 190, 80, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (tp.id === 'tapete-huella') {
        ctx.fillStyle = 'rgba(244,114,182,0.5)'
        ctx.beginPath()
        ctx.arc(236, 428, 16, 0, Math.PI * 2)
        for (const [a, b] of [[-18, -20], [-6, -28], [8, -28], [20, -20]]) ctx.arc(236 + a, 428 + b, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // terraza o en obras
    if (save.exp >= 3) {
      ctx.fillStyle = '#c7e9b0'
      ctx.fillRect(520, 214, 280, CH - 214)
      ctx.fillStyle = '#efe6d8'
      for (let y = 234; y < CH; y += 46) for (let x = 530 + ((y / 46) % 2) * 23; x < CW; x += 46) {
        ctx.beginPath()
        ctx.ellipse(x, y, 17, 10, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      if (save.exp >= 4) {
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = ['#f9a8d4', '#fde047', '#c4b5fd'][k % 3]
          ctx.beginPath()
          ctx.arc(530 + k * 36, CH - 10, 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else {
      ctx.fillStyle = '#e7dccf'
      ctx.fillRect(520, 214, 280, CH - 214)
      ctx.strokeStyle = 'rgba(91,42,58,0.25)'
      ctx.setLineDash([8, 8])
      ctx.lineWidth = 3
      rr(ctx, 540, 250, 240, 290, 20)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(91,42,58,0.45)'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🚧 Terraza', 660, 390)
      ctx.font = '11px sans-serif'
      ctx.fillText('Se abre en Local', 660, 408)
    }
    // planta de piso
    const p2 = placed('planta2')
    if (p2) {
      ctx.fillStyle = '#e8a87c'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      rr(ctx, 488, 268, 26, 24, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = p2.color
      if (p2.id === 'planta-sakura') {
        ctx.fillStyle = '#8a5a44'
        ctx.fillRect(499, 232, 4, 38)
        ctx.fillStyle = p2.color
        for (let k = 0; k < 6; k++) {
          ctx.beginPath()
          ctx.arc(490 + (k % 3) * 11, 226 + Math.floor(k / 3) * 10, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      } else {
        rr(ctx, 493, 236, 16, 34, 8)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#f472b6'
        ctx.beginPath()
        ctx.arc(501, 236, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // barra
    ctx.fillStyle = '#e8b98a'
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    rr(ctx, 30, 196, 760, 26, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#d39a68'
    ctx.fillRect(34, 214, 752, 4)
  }

  const drawShelf = () => {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.5
    rr(ctx, SHELF.x, SHELF.y, SHELF.w, SHELF.h, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('PARA LLEVAR A LA MESA', SHELF.x + SHELF.w / 2, SHELF.y - 4)
    for (const k of tickets) {
      if (k.phase !== 'ready' || k.slot < 0) continue
      const P = shelfPos(k.slot)
      ctx.fillStyle = '#fff1f7'
      ctx.beginPath()
      ctx.ellipse(P.x, P.y + 9, 16, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      drawItem(ctx, k.item, P.x, P.y, 1.05 + Math.sin(t * 4 + k.id) * 0.05)
    }
  }

  const drawCust = (c: Cust) => {
    const mood: Mood = c.phase === 'eat' ? 'love' : c.phase === 'wait' && c.pat < c.patMax * 0.25 ? 'sad' : c.phase === 'out' && c.got.length < c.want.length ? 'sad' : 'calm'
    const bob = c.phase === 'in' || c.phase === 'out' ? -Math.abs(Math.sin(c.t * 10)) * 4 : Math.sin(t * 2 + c.id) * 1
    drawAnimal(ctx, c.animal, c.fur, c.x, c.y + bob, 0.62, mood, t, c.id)
    if (c.vip) {
      ctx.fillStyle = '#facc15'
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const x = c.x
      const y = c.y - 38 + bob
      ctx.moveTo(x - 9, y)
      ctx.lineTo(x - 9, y - 10)
      ctx.lineTo(x - 4, y - 5)
      ctx.lineTo(x, y - 12)
      ctx.lineTo(x + 4, y - 5)
      ctx.lineTo(x + 9, y - 10)
      ctx.lineTo(x + 9, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  const drawBubble = (c: Cust) => {
    if (c.phase !== 'wait') return
    const left: ItemId[] = [...c.want]
    for (const g of c.got) left.splice(left.indexOf(g), 1)
    const w = 18 + left.length * 28
    const x = c.x + 26
    const y = c.y - 70
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    rr(ctx, x, y, w, 32, 12)
    ctx.fill()
    ctx.stroke()
    left.forEach((id, i) => drawItem(ctx, id, x + 23 + i * 28, y + 16, 0.85))
    // paciencia
    const f = c.pat / c.patMax
    ctx.strokeStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x + w - 2, y + 2, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f)
    ctx.stroke()
  }

  const draw = () => {
    ctx.save()
    juice.applyShake(ctx)
    drawRoom()
    // estaciones
    for (const s of STATIONS) {
      const sx = stationX(s.id)
      if (!save.stations[s.id]) {
        ctx.strokeStyle = 'rgba(91,42,58,0.25)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2
        rr(ctx, sx - 34, STATION_Y - 62, 68, 62, 14)
        ctx.stroke()
        ctx.setLineDash([])
        continue
      }
      const queue = tickets.filter((k) => k.phase === 'queue' && recipeOf(k.item).station === s.id)
      const busy = queue.length > 0 && workers.some((w) => w.sv.job === s.id)
      drawStation(ctx, s.id, s.color, sx, STATION_Y, t, busy, queue[0]?.prog ?? 0)
      if (queue.length > 1) {
        ctx.fillStyle = '#ec4899'
        ctx.beginPath()
        ctx.arc(sx + 30, STATION_Y - 60, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(queue.length), sx + 30, STATION_Y - 56)
      }
    }
    drawShelf()
    // mesas, clientes y michis ordenados por profundidad
    const things: { y: number; fn: () => void }[] = []
    for (let i = 0; i < tablesOpen(); i++) {
      const T = TABLES[i]
      things.push({ y: T.y, fn: () => drawTable(ctx, T.x, T.y, i >= 6) })
    }
    for (const c of custs) things.push({ y: c.phase === 'wait' || c.phase === 'eat' ? TABLES[c.table].y - 1 : c.y + 40, fn: () => drawCust(c) })
    workers.forEach((w) => {
      const queue = w.sv.job && w.sv.job !== 'mesero' ? tickets.some((k) => k.phase === 'queue' && recipeOf(k.item).station === w.sv.job) : false
      const moving = w.sv.job === 'mesero' && !!w.goal
      const sleeping = !w.sv.job || (w.sv.job !== 'mesero' && !queue) || (w.sv.job === 'mesero' && !w.goal && Math.sin(t * 0.2 + w.def.speed * 9) > 0.6)
      things.push({
        y: w.y,
        fn: () => {
          drawCat(ctx, w.def, w.sv.hat, w.x, w.y, 1, t, { walk: moving, work: queue, sleep: sleeping && w.boost <= 0, boost: w.boost > 0, face: w.dir })
          if (w.carry && w.goal === 'table') drawItem(ctx, w.carry.item, w.x, w.y - 74, 1)
        },
      })
    })
    things.sort((a, b) => a.y - b.y).forEach((k) => k.fn())
    // monedas y globos encima
    for (const p of piles) {
      const T = TABLES[p.table]
      drawCoins(ctx, T.x, T.y - 6, p.coins, t)
    }
    for (const c of custs) drawBubble(c)
    for (const d of drags.values()) drawItem(ctx, d.tk.item, d.x, d.y - 16, 1.5)
    // pistas para empezar
    if (save.served < 4) {
      const ready = tickets.some((k) => k.phase === 'ready')
      const hasWaiter = workers.some((w) => w.sv.job === 'mesero')
      const tip = piles.length
        ? '¡Toca las monedas de la mesa para recogerlas!'
        : ready && !hasWaiter
          ? 'Arrastra el café de la barra a la mesa del cliente'
          : custs.some((c) => c.phase === 'wait')
            ? 'Mochi prepara el pedido. Tócala para apapacharla y que vaya al doble'
            : 'Esperando clientes... ¡ya vienen!'
      ctx.font = 'bold 14px sans-serif'
      const w = ctx.measureText(tip).width + 32
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      rr(ctx, 260 - w / 2, 520, w, 30, 15)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = INK
      ctx.textAlign = 'center'
      ctx.fillText(tip, 260, 540)
    }
    juice.drawParticles(ctx)
    juice.drawTexts(ctx, pf)
    ctx.restore()
    juice.drawFlash(ctx, CW, CH)
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
    },
    /** Llamar cuando cambie el guardado desde los paneles (michis, estaciones...). */
    refresh: rebuild,
  }
}
