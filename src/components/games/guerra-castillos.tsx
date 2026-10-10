'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas, rr } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'guerra-castillos'
const ACCENT = '#fbbf24'
const GOLD = '#fbbf24'
const TEAM = ['#60a5fa', '#f87171'] // 0 = azul (abajo), 1 = rojo (arriba)

const W0 = 360
const H0 = 640
// Campo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0

const BAR_H = 66 // barra de cartas (nombres y costo) + marcador de oro/daño de cada lado
const PAD = 150 // espacio para castillos y barras, a cada extremo
const TOWER_S = 110 // distancia de cada torre a su castillo
const CASTLE_HP = 1000
const TOWER_HP = 260
const TOWER_RANGE = 120
const TOWER_DMG = 14
const TOWER_CD = 1
const DURATION = 180 // segundos de partida
const OVERTIME = 30 // tiempo extra corto si hay empate de daño al final
const LAST_MIN = 120 // desde aquí (último minuto) el oro sale doble
const START_GOLD = 120

/** Ajusta el campo lógico al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}
const FT = () => PAD // y del borde superior del campo
const FB = () => H - PAD // y del borde inferior del campo
const SPAN = () => FB() - FT()
/** X del carril (0 izquierda, 1 centro, 2 derecha). */
const laneX = (l: number) => (W * (l + 1)) / 4

// ---------- unidades ----------
type UnitId = 'soldado' | 'arquero' | 'caballero' | 'catapulta' | 'mago' | 'ladron'
type Owner = 0 | 1 // 0 = abajo (azul), 1 = arriba (rojo)
type Target = 'tower' | 'castle'

interface UnitDef {
  id: UnitId
  name: string
  cost: number
  hp: number
  dmg: number
  range: number // px lógicos
  speed: number // px por segundo
  cd: number // segundos entre golpes
  color: string
  /** Multiplicador de daño contra cada tipo (piedra-papel-tijera). Por omisión 1. */
  vs: Partial<Record<UnitId | Target, number>>
  splash?: number // radio de daño en área (px)
  thief?: number // oro robado por golpe
  siege?: boolean
}

const UNITS: Record<UnitId, UnitDef> = {
  soldado: {
    id: 'soldado', name: 'SOLDADO', cost: 40, hp: 60, dmg: 12, range: 18, speed: 46, cd: 0.8, color: '#94a3b8',
    vs: { caballero: 0.6, arquero: 1.3, ladron: 1.2, tower: 0.5, castle: 0.4 },
  },
  arquero: {
    id: 'arquero', name: 'ARQUERO', cost: 60, hp: 34, dmg: 10, range: 110, speed: 42, cd: 1.1, color: '#4ade80',
    vs: { soldado: 0.8, caballero: 0.5, ladron: 1.4, mago: 1.1, tower: 0.5, castle: 0.4 },
  },
  caballero: {
    id: 'caballero', name: 'CABALLERO', cost: 110, hp: 170, dmg: 16, range: 20, speed: 36, cd: 1.0, color: '#3b82f6',
    vs: { soldado: 1.3, mago: 1.4, arquero: 1.2, ladron: 0.9, tower: 0.8, castle: 0.7 },
  },
  catapulta: {
    id: 'catapulta', name: 'CATAPULTA', cost: 130, hp: 40, dmg: 26, range: 150, speed: 24, cd: 2.2, color: '#fb923c',
    vs: { caballero: 1.4, soldado: 0.8, ladron: 0.7, tower: 2.5, castle: 2.0 }, siege: true,
  },
  mago: {
    id: 'mago', name: 'MAGO', cost: 110, hp: 46, dmg: 14, range: 95, speed: 34, cd: 1.6, color: '#c084fc',
    vs: { soldado: 1.2, arquero: 1.3, catapulta: 1.3, caballero: 0.7, ladron: 0.8, tower: 0.6, castle: 0.5 }, splash: 46,
  },
  ladron: {
    id: 'ladron', name: 'LADRON', cost: 70, hp: 30, dmg: 9, range: 16, speed: 92, cd: 0.7, color: '#facc15',
    vs: { mago: 1.6, catapulta: 1.4, arquero: 0.9, soldado: 0.8, tower: 0.4, castle: 0.3 }, thief: 6,
  },
}
const UNIT_ORDER: UnitId[] = ['soldado', 'arquero', 'caballero', 'catapulta', 'mago', 'ladron']

interface Shot {
  x0: number
  y0: number
  x1: number
  y1: number
  t: number // tiempo restante (s)
  kind: 'arrow' | 'rock' | 'orb'
}
interface Unit {
  id: number
  def: UnitDef
  owner: Owner
  lane: number
  s: number // distancia desde la base inferior del campo (0 = castillo azul, SPAN = castillo rojo)
  hp: number
  cd: number
  hitT: number
  atkT: number
  shot: Shot | null
  dead: boolean
}
interface Tower {
  lane: number
  hp: number
  cd: number
  hitT: number
}
interface Castle {
  hp: number
  hitT: number
}
interface Side {
  gold: number
  dmg: number
  castle: Castle
  towers: Tower[]
}
interface Game {
  phase: 'menu' | 'playing' | 'over'
  paused: boolean
  mode: 1 | 2
  level: number
  t: number
  endT: number // segundo en que se acaba el tiempo (sube si hay tiempo extra)
  sides: [Side, Side]
  units: Unit[]
  nextId: number
  winner: Owner | null
  draw: boolean
  reason: 'castle' | 'time' | null
  overT: number
  drag: { owner: Owner; unit: UnitId; x: number; y: number; pid: number } | null
  selected: { owner: Owner; unit: UnitId } | null
  cursor: [number, number] // carril elegido con teclado por cada lado
  cpuT: number
}

export interface UiState {
  phase: 'menu' | 'playing' | 'over'
  mode: 1 | 2
  winner: Owner | null
  draw: boolean
  reason: 'castle' | 'time' | null
  dmg0: number
  dmg1: number
  best: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Niveles de la CPU: tiempo entre cartas, precisión y oro. */
const CPU_LEVELS = [
  { name: 'Fácil', think: [2.8, 4.2], gold: 0.85, aim: 0.35 },
  { name: 'Medio', think: [1.8, 2.9], gold: 1.0, aim: 0.7 },
  { name: 'Difícil', think: [0.9, 1.7], gold: 1.15, aim: 0.95 },
]

const newSide = (): Side => ({
  gold: START_GOLD,
  dmg: 0,
  castle: { hp: CASTLE_HP, hitT: 0 },
  towers: [0, 2].map((lane) => ({ lane, hp: TOWER_HP, cd: 0.5, hitT: 0 })),
})

function newGame(mode: 1 | 2, level: number): Game {
  return {
    phase: 'menu',
    paused: false,
    mode,
    level,
    t: 0,
    endT: DURATION,
    sides: [newSide(), newSide()],
    units: [],
    nextId: 1,
    winner: null,
    draw: false,
    reason: null,
    overT: 0,
    drag: null,
    selected: null,
    cursor: [1, 1],
    cpuT: 2,
  }
}

/** Oro por segundo: el último minuto sale doble. */
const goldRate = (t: number) => (t >= LAST_MIN ? 10 : 5)
/** Posición (s) de la torre de un bando. */
const towerS = (o: Owner) => (o === 0 ? TOWER_S : SPAN() - TOWER_S)
/** Posición (s) del castillo de un bando. */
const castleS = (o: Owner) => (o === 0 ? 0 : SPAN())
/** Coordenada Y de pantalla para una posición s. */
const screenY = (s: number) => FB() - s

export default function GuerraCastillos() {
  const { justPressedRef } = useKeys()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(m: 1 | 2, level: number) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const restartRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<UiState>({
    phase: 'menu', mode: 1, winner: null, draw: false, reason: null, dmg0: 0, dmg1: 0, best: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(10)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let g = newGame(1, 1)
    let lastMode: 1 | 2 = 1
    let lastLevel = 1
    let best = loadBest(GAME_ID)
    let newBest = false
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()

    // ---------- sincronía con React ----------
    const sync = () => {
      setUi({
        phase: g.phase,
        mode: g.mode,
        winner: g.winner,
        draw: g.draw,
        reason: g.reason,
        dmg0: Math.round(g.sides[0].dmg),
        dmg1: Math.round(g.sides[1].dmg),
        best: best,
      })
    }

    // ---------- sonido ----------
    const sfxDeploy = () => tone({ freq: 520, to: 780, dur: 0.07, type: 'square', vol: 0.04 })
    const sfxHit = () => tone({ freq: 240, to: 110, dur: 0.06, type: 'triangle', vol: 0.035 })
    const sfxBoom = () => {
      noise({ dur: 0.3, vol: 0.09, freq: 900 })
      tone({ freq: 120, to: 40, dur: 0.25, vol: 0.06, type: 'triangle' })
    }
    const sfxGold = () => tone({ freq: 1175, dur: 0.05, vol: 0.025, type: 'triangle' })
    const sfxWin = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.06, delay: i * 0.11 }))
    const sfxLose = () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.05, delay: i * 0.14 }))

    // ---------- control de partida ----------
    startRef.current = (m, level) => {
      lastMode = m
      lastLevel = level
      newBest = false
      juice.reset()
      g = newGame(m, level)
      g.phase = 'playing'
      sync()
    }
    menuRef.current = () => {
      g = newGame(lastMode, lastLevel)
      juice.reset()
      sync()
    }
    // revancha con la misma modalidad y dificultad
    restartRef.current = () => startRef.current(lastMode, lastLevel)

    /** Termina la partida: destruir el castillo gana; si se acaba el tiempo, gana quien hizo más daño. */
    const finish = (winner: Owner | null, reason: 'castle' | 'time') => {
      g.phase = 'over'
      g.winner = winner
      g.draw = winner === null
      g.reason = reason
      g.overT = 0
      g.drag = null
      g.selected = null
      if (g.mode === 1) {
        // en 1J la marca es el daño del jugador azul
        const score = Math.round(g.sides[0].dmg)
        newBest = saveBest(GAME_ID, score)
        if (newBest) best = score
      }
      if (winner === 0 || g.mode === 2) sfxWin()
      else sfxLose()
      sync()
    }

    /** Coloca una unidad del bando `owner` en el carril `lane`, si alcanza el oro. */
    const deploy = (owner: Owner, unit: UnitId, lane: number): boolean => {
      if (g.phase !== 'playing') return false
      const side = g.sides[owner]
      const def = UNITS[unit]
      if (side.gold < def.cost) return false
      side.gold -= def.cost
      const s = owner === 0 ? 8 : SPAN() - 8
      g.units.push({ id: g.nextId++, def, owner, lane, s, hp: def.hp, cd: 0.25, hitT: 0, atkT: 0, shot: null, dead: false })
      sfxDeploy()
      juice.burst(laneX(lane), screenY(s), def.color, { count: 8, speed: 60, life: 0.4, size: 3 })
      return true
    }

    /** Daño a un objetivo; cuenta lo realmente quitado para el marcador. Devuelve lo aplicado. */
    const damage = (src: Owner, target: { hp: number; hitT: number }, amount: number): number => {
      const dealt = Math.min(amount, Math.max(0, target.hp))
      target.hp -= dealt
      target.hitT = 0.15
      g.sides[src].dmg += dealt
      return dealt
    }

    const killUnit = (u: Unit, by: Owner) => {
      u.dead = true
      const reward = Math.round(u.def.cost * 0.3)
      g.sides[by].gold += reward
      juice.burst(laneX(u.lane), screenY(u.s), u.def.color, { count: 12, speed: 110, life: 0.5, size: 3 })
      juice.text(laneX(u.lane), screenY(u.s) + (u.owner === 0 ? -20 : 20), `+${reward}`, GOLD, 9, 0.8)
      sfxBoom()
    }

    /** Lógica de unidades: buscan enemigo en su carril, atacan o avanzan. */
    const updateUnits = (dt: number) => {
      for (const u of g.units) {
        if (u.dead) continue
        u.hitT = Math.max(0, u.hitT - dt)
        u.atkT = Math.max(0, u.atkT - dt)
        u.cd = Math.max(0, u.cd - dt)
        if (u.shot) {
          u.shot.t -= dt
          if (u.shot.t <= 0) u.shot = null
        }
        const enemy = (1 - u.owner) as Owner
        const dir = u.owner === 0 ? 1 : -1

        // 1) unidad enemiga más cercana en el carril
        let foe: Unit | null = null
        let fd = Infinity
        for (const o of g.units) {
          if (o.dead || o.owner === u.owner || o.lane !== u.lane) continue
          const d = Math.abs(o.s - u.s)
          if (d < fd) {
            fd = d
            foe = o
          }
        }
        const inRange = (d: number) => d <= u.def.range + 6
        // 2) torre enemiga del carril y castillo enemigo
        const tower = g.sides[enemy].towers.find((t) => t.lane === u.lane && t.hp > 0) ?? null
        const towerD = tower ? Math.abs(towerS(enemy) - u.s) : Infinity
        const castleD = Math.abs(castleS(enemy) - u.s)

        if (foe && inRange(fd)) {
          attackUnit(u, foe, enemy)
          continue
        }
        if (tower && inRange(towerD)) {
          if (u.cd <= 0) {
            u.cd = u.def.cd
            u.atkT = 0.25
            const amt = u.def.dmg * (u.def.vs.tower ?? 0.5)
            damage(u.owner, tower, amt)
            if (u.def.range > 40) u.shot = shotTo(u, laneX(u.lane), screenY(towerS(enemy)), u.def.id === 'catapulta' ? 'rock' : 'arrow')
            sfxHit()
            if (tower.hp <= 0) {
              g.sides[u.owner].gold += 60
              juice.shake(0.5)
              juice.flash(GOLD, 0.2)
              juice.text(laneX(tower.lane), screenY(towerS(enemy)), 'DERRIBADA', '#fca5a5', 8, 1)
              sfxBoom()
            }
          }
          continue
        }
        if (inRange(castleD)) {
          if (u.cd <= 0) {
            u.cd = u.def.cd
            u.atkT = 0.25
            const amt = u.def.dmg * (u.def.vs.castle ?? 0.4)
            damage(u.owner, g.sides[enemy].castle, amt)
            if (u.def.range > 40) u.shot = shotTo(u, W / 2, screenY(castleS(enemy)), u.def.id === 'catapulta' ? 'rock' : 'arrow')
            sfxHit()
            if (g.sides[enemy].castle.hp <= 0) {
              juice.shake(1)
              finish(u.owner, 'castle')
              return
            }
          }
          continue
        }
        // 3) avanza si no hay un aliado justo delante
        let blocked = false
        for (const o of g.units) {
          if (o.dead || o.owner !== u.owner || o.lane !== u.lane || o === u) continue
          const ahead = (o.s - u.s) * dir
          if (ahead > 0 && ahead < 16) {
            blocked = true
            break
          }
        }
        if (!blocked) u.s = clamp(u.s + dir * u.def.speed * dt, 0, SPAN())
      }
      g.units = g.units.filter((u) => !u.dead)
    }

    /** Crea el disparo visual de un atacante a distancia. */
    const shotTo = (u: Unit, x1: number, y1: number, kind: Shot['kind']): Shot => ({
      x0: laneX(u.lane),
      y0: screenY(u.s),
      x1,
      y1,
      t: 0.3,
      kind,
    })

    /** Golpe a otra unidad: aplica la ventaja del tipo y el área del mago. */
    const attackUnit = (u: Unit, foe: Unit, enemy: Owner) => {
      if (u.cd > 0) return
      u.cd = u.def.cd
      u.atkT = 0.25
      const mult = u.def.vs[foe.def.id] ?? 1
      const dmg = u.def.dmg * mult
      foe.hitT = 0.15
      foe.hp -= dmg
      g.sides[u.owner].dmg += Math.max(0, Math.min(dmg, foe.hp + dmg))
      if (u.def.range > 40) u.shot = shotTo(u, laneX(u.lane), screenY(foe.s), u.def.id === 'mago' ? 'orb' : u.def.id === 'catapulta' ? 'rock' : 'arrow')
      if (u.def.splash) {
        for (const o of g.units) {
          if (o.dead || o.owner !== enemy || o === foe || o.lane !== u.lane) continue
          if (Math.abs(o.s - foe.s) <= u.def.splash) {
            o.hitT = 0.15
            o.hp -= dmg * 0.6
            g.sides[u.owner].dmg += dmg * 0.6
            if (o.hp <= 0) {
              killUnit(o, u.owner)
              o.dead = true
            }
          }
        }
      }
      if (u.def.thief && foe.hp > 0) {
        const stolen = Math.min(u.def.thief, g.sides[enemy].gold)
        g.sides[enemy].gold -= stolen
        g.sides[u.owner].gold += stolen
        if (stolen > 0) sfxGold()
      }
      sfxHit()
      if (foe.hp <= 0) {
        killUnit(foe, u.owner)
        foe.dead = true
      }
    }

    /** Las torres disparan al enemigo más cercano de su carril. */
    const updateTowers = (dt: number) => {
      for (const side of [0, 1] as Owner[]) {
        const enemy = (1 - side) as Owner
        for (const t of g.sides[side].towers) {
          if (t.hp <= 0) continue
          t.hitT = Math.max(0, t.hitT - dt)
          t.cd = Math.max(0, t.cd - dt)
          if (t.cd > 0) continue
          let foe: Unit | null = null
          let fd = Infinity
          for (const o of g.units) {
            if (o.dead || o.owner !== enemy || o.lane !== t.lane) continue
            const d = Math.abs(o.s - towerS(side))
            if (d <= TOWER_RANGE && d < fd) {
              fd = d
              foe = o
            }
          }
          if (!foe) continue
          t.cd = TOWER_CD
          foe.hitT = 0.15
          foe.hp -= TOWER_DMG
          g.sides[side].dmg += TOWER_DMG
          if (foe.hp <= 0) {
            killUnit(foe, side)
            foe.dead = true
          }
        }
      }
    }

    /** CPU: elige carta según lo que le viene encima y el carril con más presión. */
    const updateCpu = (dt: number) => {
      const lv = CPU_LEVELS[g.level]
      g.cpuT -= dt
      if (g.cpuT > 0) return
      g.cpuT = lerp(lv.think[0], lv.think[1], Math.random())
      const side = g.sides[1]
      const affordable = UNIT_ORDER.filter((u) => UNITS[u].cost <= side.gold)
      if (affordable.length === 0) return
      // carril con más unidades azules, con precisión según el nivel
      const count = [0, 0, 0]
      for (const u of g.units) if (u.owner === 0 && !u.dead) count[u.lane]++
      const lane = Math.random() < lv.aim ? count.indexOf(Math.max(...count)) : Math.floor(Math.random() * 3)
      // carta: a veces la contraria a lo que más hay del otro lado
      const pick = affordable[Math.floor(Math.random() * affordable.length)]
      deploy(1, pick, lane)
    }

    /** Oro por tiempo para cada lado (la CPU con su multiplicador). */
    const updateGold = (dt: number) => {
      const r = goldRate(g.t)
      g.sides[0].gold += r * dt
      g.sides[1].gold += r * dt * (g.mode === 1 ? CPU_LEVELS[g.level].gold : 1)
    }

    const update = (dt: number) => {
      if (g.phase === 'menu') return
      if (g.phase === 'over') {
        g.overT += dt
        return
      }
      g.t += dt
      updateGold(dt)
      if (g.mode === 1) updateCpu(dt)
      updateUnits(dt)
      if (g.phase !== 'playing') return
      updateTowers(dt)
      // castillo destruido en torres/unidades ya llama finish; aquí solo el tiempo
      if (g.phase === 'playing' && g.t >= g.endT) {
        const d0 = g.sides[0].dmg
        const d1 = g.sides[1].dmg
        if (d0 === d1 && g.endT === DURATION) {
          // empate de daño: tiempo extra corto antes de decidir
          g.endT = DURATION + OVERTIME
          juice.flash(GOLD, 0.25)
          juice.text(W / 2, H / 2 - 30, 'TIEMPO EXTRA', GOLD, 9, 1.4)
          sfxBoom()
        } else if (d0 === d1) finish(null, 'time')
        else finish(d0 > d1 ? 0 : 1, 'time')
      }
    }

    // ---------- entrada ----------
    const toXY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    }
    /** Carta bajo el punto: la barra de abajo es del jugador azul, la de arriba del rojo (2J). */
    const cardAt = (x: number, y: number): { owner: Owner; unit: UnitId } | null => {
      const cw = W / UNIT_ORDER.length
      if (y >= H - BAR_H) {
        const i = clamp(Math.floor(x / cw), 0, UNIT_ORDER.length - 1)
        return { owner: 0, unit: UNIT_ORDER[i] }
      }
      if (y <= BAR_H && g.mode === 2) {
        const i = clamp(Math.floor((W - x) / cw), 0, UNIT_ORDER.length - 1)
        return { owner: 1, unit: UNIT_ORDER[i] }
      }
      return null
    }
    /** Carril más cercano a la x del toque. */
    const laneAt = (x: number) => {
      let best = 0
      let d = Infinity
      for (let i = 0; i < 3; i++) {
        const dd = Math.abs(x - laneX(i))
        if (dd < d) {
          d = dd
          best = i
        }
      }
      return best
    }
    const inField = (y: number) => y > FT() - 24 && y < FB() + 24

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase !== 'playing') return
      const { x, y } = toXY(e)
      const card = cardAt(x, y)
      if (card) {
        if (card.owner === 0 || g.mode === 2) {
          g.drag = { owner: card.owner, unit: card.unit, x, y, pid: e.pointerId }
          g.selected = { owner: card.owner, unit: card.unit }
          try {
            canvas.setPointerCapture(e.pointerId)
          } catch {
            // sin captura
          }
        }
        return
      }
      // toque en el campo: despliega la carta elegida en ese carril
      const sel = g.selected
      if (sel && inField(y)) {
        if (deploy(sel.owner, sel.unit, laneAt(x))) g.selected = null
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      const d = g.drag
      if (!d || d.pid !== e.pointerId) return
      e.preventDefault()
      const { x, y } = toXY(e)
      d.x = x
      d.y = y
    }
    const onPointerUp = (e: PointerEvent) => {
      const d = g.drag
      if (!d || d.pid !== e.pointerId) return
      const { x, y } = toXY(e)
      // soltar sobre el campo: despliega en el carril más cercano
      if (inField(y)) {
        if (deploy(d.owner, d.unit, laneAt(x))) g.selected = null
      }
      g.drag = null
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    // teclado: 1-6 cartas azules, flechas carril y Enter/Espacio; 2J: Q-Y cartas rojas, A/D carril y F
    const BLUE_KEYS: Record<string, UnitId> = {}
    UNIT_ORDER.forEach((u, i) => {
      BLUE_KEYS[`Digit${i + 1}`] = u
      BLUE_KEYS[`Numpad${i + 1}`] = u
    })
    const RED_KEYS: Record<string, UnitId> = {}
    ;['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'].forEach((code, i) => {
      RED_KEYS[code] = UNIT_ORDER[i]
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (g.phase !== 'playing' || g.paused || e.repeat) return
      const blue = BLUE_KEYS[e.code]
      const red = g.mode === 2 ? RED_KEYS[e.code] : undefined
      if (blue) {
        g.selected = { owner: 0, unit: blue }
        e.preventDefault()
      } else if (red) {
        g.selected = { owner: 1, unit: red }
        e.preventDefault()
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        g.cursor[0] = clamp(g.cursor[0] + (e.code === 'ArrowLeft' ? -1 : 1), 0, 2)
        e.preventDefault()
      } else if (g.mode === 2 && (e.code === 'KeyA' || e.code === 'KeyD')) {
        g.cursor[1] = clamp(g.cursor[1] + (e.code === 'KeyA' ? -1 : 1), 0, 2)
        e.preventDefault()
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') {
        const sel = g.selected
        if (!sel) return
        const lane = sel.owner === 0 ? g.cursor[0] : g.cursor[1]
        if (deploy(sel.owner, sel.unit, lane)) g.selected = null
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    const pauseIfPlaying = () => {
      if (g.phase === 'playing') g.paused = true
      g.drag = null
    }
    const onVis = () => {
      if (document.hidden) pauseIfPlaying()
    }
    window.addEventListener('blur', pauseIfPlaying)
    document.addEventListener('visibilitychange', onVis)

    // ---------- dibujo ----------
    const INK = '#2a1b3d' // contorno cacao, nunca negro puro
    /**
     * Personajito chibi redondo (pies en x,y; ~26 px de alto a escala 1).
     * El cuerpo lleva el color del EQUIPO; el sombrero y el arma dicen QUÉ unidad es.
     */
    const drawFigure = (def: UnitDef, x: number, y: number, scale: number, walk: number, flash: boolean, team = def.color) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale, scale)
      ctx.lineWidth = 1.4
      ctx.strokeStyle = INK
      const blob = (cx: number, cy: number, rx: number, ry: number, fill: string) => {
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      // sombra con aro del equipo
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      // arma detrás (lado derecho)
      if (def.id === 'soldado') {
        ctx.fillStyle = '#a16207'
        ctx.fillRect(7, -24, 2, 22)
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.moveTo(8, -30)
        ctx.lineTo(11, -23)
        ctx.lineTo(5, -23)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else if (def.id === 'mago') {
        ctx.fillStyle = '#92400e'
        ctx.fillRect(7, -24, 2, 22)
        const glow = 0.6 + 0.4 * Math.sin(g.t * 6)
        ctx.fillStyle = `rgba(216,180,254,${glow})`
        ctx.beginPath()
        ctx.arc(8, -26, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      // patitas
      const st = walk ? 1.5 : 0
      blob(-3.5, -1.5 - st, 2.6, 1.8, INK)
      blob(3.5, -1.5 + st - 1.5 * (walk ? 1 : 0), 2.6, 1.8, INK)
      // cuerpo frijolito del color del equipo
      blob(0, -8, 7, 6.5, flash ? '#ffffff' : team)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(-2.5, -10, 2.2, 1.5, -0.5, 0, Math.PI * 2)
      ctx.fill()
      // cabeza grande
      blob(0, -18, 7.5, 7, flash ? '#ffffff' : '#fde2c8')
      // ojitos y cachetes
      ctx.fillStyle = INK
      if (def.id === 'ladron') {
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(-7, -20, 14, 4) // antifaz
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(-4, -19, 2, 2)
        ctx.fillRect(2, -19, 2, 2)
      } else {
        ctx.beginPath()
        ctx.arc(-2.8, -17.5, 1.3, 0, Math.PI * 2)
        ctx.arc(2.8, -17.5, 1.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(-3.3, -18.5, 0.9, 0.9)
        ctx.fillRect(2.3, -18.5, 0.9, 0.9)
      }
      ctx.fillStyle = 'rgba(244,114,182,0.55)'
      ctx.beginPath()
      ctx.arc(-4.6, -15, 1.4, 0, Math.PI * 2)
      ctx.arc(4.6, -15, 1.4, 0, Math.PI * 2)
      ctx.fill()
      // sombrero según la unidad
      if (def.id === 'soldado') {
        ctx.fillStyle = '#cbd5e1' // casquito de metal
        ctx.beginPath()
        ctx.arc(0, -20, 7.8, Math.PI, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillRect(-8.5, -20.5, 17, 2)
      } else if (def.id === 'arquero') {
        ctx.fillStyle = '#22c55e' // capucha con punta
        ctx.beginPath()
        ctx.moveTo(-8, -18)
        ctx.quadraticCurveTo(-8, -27, 0, -27)
        ctx.lineTo(6, -31)
        ctx.lineTo(5, -26)
        ctx.quadraticCurveTo(8, -24, 8, -18)
        ctx.quadraticCurveTo(0, -23, -8, -18)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        // arco a la izquierda
        ctx.strokeStyle = '#a16207'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(-8, -9, 7, -1.3, 1.3)
        ctx.stroke()
        ctx.strokeStyle = '#f1f5f9'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(-6.1, -15.7)
        ctx.lineTo(-6.1, -2.3)
        ctx.stroke()
      } else if (def.id === 'caballero') {
        ctx.fillStyle = '#94a3b8' // yelmo completo con visera y pluma
        ctx.beginPath()
        ctx.arc(0, -18.5, 8, Math.PI * 0.95, Math.PI * 2.05)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = INK
        ctx.fillRect(-5, -19, 10, 1.6)
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.ellipse(0, -28, 2.5, 4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // escudo grande del equipo
        ctx.fillStyle = team
        ctx.beginPath()
        ctx.moveTo(-14, -14)
        ctx.lineTo(-5, -14)
        ctx.lineTo(-5, -7)
        ctx.quadraticCurveTo(-9.5, -1, -9.5, -1)
        ctx.quadraticCurveTo(-14, -5, -14, -7)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fde047'
        ctx.fillRect(-10.3, -12.5, 1.6, 8)
        ctx.fillRect(-12.5, -10, 6, 1.6)
      } else if (def.id === 'mago') {
        ctx.fillStyle = '#8b5cf6' // sombrero puntiagudo con estrella
        ctx.beginPath()
        ctx.moveTo(-9, -21)
        ctx.lineTo(9, -21)
        ctx.lineTo(2, -35)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fde047'
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 ? 1.2 : 2.6
          ctx.lineTo(1 + Math.cos(a) * r, -26 + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
      } else if (def.id === 'ladron') {
        ctx.fillStyle = '#334155' // gorrito
        ctx.beginPath()
        ctx.arc(0, -21, 7, Math.PI, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        // costal de monedas
        blob(-9, -7, 4, 4.5, '#d97706')
        ctx.fillStyle = '#fde047'
        ctx.font = 'bold 5px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('$', -9, -6.5)
      }
      ctx.restore()
    }

    /** Catapulta redondita: carro de madera con franja del equipo, ruedas y brazo con roca. */
    const drawCatapult = (x: number, y: number, scale: number, swing: number, team = '#fb923c') => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale, scale)
      ctx.lineWidth = 1.4
      ctx.strokeStyle = INK
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(0, 0, 15, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
      // brazo detrás del carro
      ctx.save()
      ctx.translate(0, -12)
      ctx.rotate(-0.7 + swing * 1.1)
      ctx.fillStyle = '#b45309'
      rr(ctx, -2, -22, 4, 22, 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#a8a29e'
      ctx.beginPath()
      ctx.arc(0, -24, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      // carro
      ctx.fillStyle = '#d97706'
      rr(ctx, -14, -15, 28, 11, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = team
      ctx.fillRect(-13, -11, 26, 3)
      // ruedas
      for (const wx of [-9, 9]) {
        ctx.fillStyle = '#78350f'
        ctx.beginPath()
        ctx.arc(wx, -3.5, 4.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fde68a'
        ctx.beginPath()
        ctx.arc(wx, -3.5, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    /** Castillo de piedra, dibujado en coordenadas locales (centro en 0,0). */
    const drawCastle = (color: string, c: Castle) => {
      ctx.fillStyle = '#4b5563'
      rr(ctx, -66, -28, 132, 56, 3)
      ctx.fill()
      ctx.fillStyle = '#6b7280'
      for (let i = 0; i < 4; i++) ctx.fillRect(-60 + i * 30, -14, 28, 3) // hiladas de piedra
      for (let i = 0; i < 5; i++) ctx.fillRect(-64 + i * 28, -36, 10, 9) // almenas
      ctx.fillStyle = '#374151'
      rr(ctx, -74, -34, 22, 62, 2)
      ctx.fill()
      rr(ctx, 52, -34, 22, 62, 2)
      ctx.fill()
      // techitos cónicos del color del bando y ventanitas
      for (const tx of [-63, 63]) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(tx - 14, -34)
        ctx.lineTo(tx + 14, -34)
        ctx.lineTo(tx, -56)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#fde68a'
        rr(ctx, tx - 3, -22, 6, 9, 3)
        ctx.fill()
      }
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-12, 6, 24, 22) // puerta
      ctx.beginPath()
      ctx.arc(0, 6, 12, Math.PI, 0)
      ctx.fill()
      // bandera del color del bando
      ctx.fillStyle = color
      ctx.fillRect(-1, -52, 2, 18)
      ctx.beginPath()
      ctx.moveTo(1, -52)
      ctx.lineTo(14, -47)
      ctx.lineTo(1, -42)
      ctx.closePath()
      ctx.fill()
      if (c.hitT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        rr(ctx, -66, -28, 132, 56, 3)
        ctx.fill()
      }
      // barra de vida arriba (en local)
      const k = clamp(c.hp / CASTLE_HP, 0, 1)
      barHp(-60, -48, 120, 5, k, color)
    }

    /** Torre pequeña, en coordenadas locales. */
    const drawTower = (color: string, t: Tower) => {
      ctx.fillStyle = '#4b5563'
      rr(ctx, -10, -18, 20, 34, 2)
      ctx.fill()
      ctx.fillStyle = '#6b7280'
      ctx.fillRect(-12, -22, 6, 5)
      ctx.fillRect(-2, -22, 4, 5)
      ctx.fillRect(6, -22, 6, 5)
      ctx.fillStyle = color
      ctx.fillRect(-2, -28, 4, 6)
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-4, 4, 8, 12)
      if (t.hitT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        rr(ctx, -10, -18, 20, 34, 2)
        ctx.fill()
      }
      barHp(-14, -32, 28, 3, clamp(t.hp / TOWER_HP, 0, 1), color)
    }

    /** Barra de vida pixelada: fondo oscuro, relleno según fracción. */
    const barHp = (x: number, y: number, w: number, h: number, frac: number, color: string) => {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
      ctx.fillStyle = frac > 0.35 ? '#4ade80' : '#f87171'
      ctx.fillRect(x, y, w * frac, h)
      ctx.fillStyle = color
      ctx.fillRect(x, y, w * frac, 1)
    }

    /** Proyectil de disparo a distancia (flecha, roca o orbe). */
    const drawShot = (s: Shot) => {
      const p = 1 - s.t / 0.3
      const x = lerp(s.x0, s.x1, p)
      const y = lerp(s.y0, s.y1, p)
      if (s.kind === 'arrow') {
        ctx.strokeStyle = '#fde68a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y - 4)
        ctx.lineTo(x, y + 4)
        ctx.stroke()
      } else if (s.kind === 'rock') {
        const arc = Math.sin(p * Math.PI) * 26
        ctx.fillStyle = '#9ca3af'
        ctx.beginPath()
        ctx.arc(x + arc * 0.2, y - arc, 4, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.save()
        ctx.shadowColor = '#c084fc'
        ctx.shadowBlur = 10
        ctx.fillStyle = '#e9d5ff'
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    /** Barra de cartas (local: origen arriba a la izquierda). */
    const drawBar = (owner: Owner, side: Side, playerName: string) => {
      const cw = W / UNIT_ORDER.length
      const bw = W
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, bw, BAR_H)
      ctx.fillStyle = TEAM[owner]
      ctx.fillRect(0, 0, bw, 2)
      UNIT_ORDER.forEach((id, i) => {
        const def = UNITS[id]
        const cx = i * cw
        // en 1 jugador las cartas rojas son de la CPU: se ven apagadas, no jugables
        const can = g.phase === 'playing' && side.gold >= def.cost && (owner === 0 || g.mode === 2)
        const sel = g.selected && g.selected.owner === owner && g.selected.unit === id
        ctx.save()
        ctx.globalAlpha = can ? 1 : 0.42
        ctx.fillStyle = sel ? '#334155' : '#1e293b'
        rr(ctx, cx + 2, 4, cw - 4, 36, 4)
        ctx.fill()
        ctx.strokeStyle = sel ? '#ffffff' : def.color
        ctx.lineWidth = sel ? 2 : 1
        ctx.stroke()
        if (id === 'catapulta') drawCatapult(cx + cw / 2, 31, 0.72, 0, TEAM[owner])
        else drawFigure(def, cx + cw / 2, 33, 0.82, 0, false, TEAM[owner])
        ctx.restore()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `5px ${pf}`
        ctx.fillStyle = can ? '#ffffff' : '#64748b'
        ctx.fillText(def.name, cx + cw / 2, 46)
        ctx.font = `6px ${pf}`
        ctx.fillStyle = GOLD
        ctx.fillText(String(def.cost), cx + cw - 9, 13)
      })
      // marcador: oro y daño
      ctx.textAlign = 'left'
      ctx.font = `7px ${pf}`
      ctx.fillStyle = GOLD
      ctx.fillText(`ORO ${Math.floor(side.gold)}`, 8, BAR_H - 6)
      ctx.textAlign = 'right'
      ctx.fillStyle = TEAM[owner]
      ctx.fillText(`${playerName} ${Math.round(side.dmg)}`, bw - 8, BAR_H - 6)
      ctx.textAlign = 'left'
    }

    /** Pinta el campo: fondo de hierba, carriles y camino de piedra. */
    const drawField = () => {
      const top = FT()
      const bot = FB()
      ctx.fillStyle = '#14301f'
      ctx.fillRect(-12, top - 8, W + 24, bot - top + 16)
      for (let i = 0; i < 3; i++) {
        const cx = laneX(i)
        ctx.fillStyle = i === 1 ? 'rgba(120,113,108,0.35)' : 'rgba(120,113,108,0.22)'
        ctx.fillRect(cx - 30, top, 60, bot - top)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.setLineDash([6, 8])
        ctx.beginPath()
        ctx.moveTo(cx - 30, top)
        ctx.lineTo(cx - 30, bot)
        ctx.moveTo(cx + 30, top)
        ctx.lineTo(cx + 30, bot)
        ctx.stroke()
        ctx.setLineDash([])
      }
      // piedras del camino
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      for (let y = top; y < bot; y += 22) {
        for (let i = 0; i < 3; i++) ctx.fillRect(laneX(i) - 18 + ((y / 22) % 2) * 6, y, 16, 3)
      }
      // carril elegido con teclado (si hay carta seleccionada)
      const sel = g.selected
      if (sel) {
        const lane = sel.owner === 0 ? g.cursor[0] : g.cursor[1]
        ctx.strokeStyle = TEAM[sel.owner]
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(laneX(lane) - 28, top + 2, 56, bot - top - 4)
        ctx.setLineDash([])
      }
      // líneas de torres
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (const o of [0, 1] as Owner[]) ctx.fillRect(0, screenY(towerS(o)), W, 1)
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      ctx.fillStyle = '#0b0f1a'
      ctx.fillRect(-12, -12, W + 24, H + 24)
      drawField()

      // castillos y torres: el bando de arriba se dibuja girado 180°
      for (const o of [0, 1] as Owner[]) {
        const sideObj = g.sides[o]
        const cy = o === 0 ? FB() + 30 : FT() - 30
        ctx.save()
        ctx.translate(W / 2, cy)
        if (o === 1) ctx.rotate(Math.PI)
        drawCastle(TEAM[o], sideObj.castle)
        ctx.restore()
        for (const t of sideObj.towers) {
          if (t.hp <= 0) continue
          const tx = laneX(t.lane)
          const ty = screenY(towerS(o))
          ctx.save()
          ctx.translate(tx, ty)
          if (o === 1) ctx.rotate(Math.PI)
          drawTower(TEAM[o], t)
          ctx.restore()
        }
      }

      // unidades
      const walk = Math.floor(g.t * 6) % 2 === 1
      for (const u of g.units) {
        const x = laneX(u.lane)
        const y = screenY(u.s)
        // al atacar, la figura da un pequeño paso hacia el enemigo
        const lunge = u.atkT > 0 && u.def.range <= 40 ? Math.sin(((0.25 - u.atkT) / 0.25) * Math.PI) * 4 * (u.owner === 0 ? -1 : 1) : 0
        ctx.save()
        if (u.owner === 1) {
          ctx.translate(x, y)
          ctx.rotate(Math.PI)
          ctx.translate(-x, -y)
        }
        if (u.def.id === 'catapulta') {
          drawCatapult(x, y, 1, u.atkT > 0 ? 1 - u.atkT / 0.25 : 0, TEAM[u.owner])
        } else {
          drawFigure(u.def, x, y + lunge, 1.05, walk ? 1 : 0, u.hitT > 0, TEAM[u.owner])
          if (u.atkT > 0 && u.def.range <= 40) {
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(x + 10, y - 12, 7, -1.2, 1.2)
            ctx.stroke()
          }
        }
        ctx.restore()
        // barra de vida corta
        barHp(x - 12, y + 4 + (u.owner === 0 ? 4 : -2), 24, 2, clamp(u.hp / u.def.hp, 0, 1), TEAM[u.owner])
        if (u.shot) drawShot(u.shot)
      }

      // carta arrastrada
      const d = g.drag
      if (d) {
        ctx.save()
        ctx.globalAlpha = 0.85
        if (d.owner === 1) {
          ctx.translate(d.x, d.y)
          ctx.rotate(Math.PI)
          ctx.translate(-d.x, -d.y)
        }
        drawFigure(UNITS[d.unit], d.x, d.y + 4, 1, 0, false, TEAM[d.owner])
        ctx.restore()
      }

      // barras de cartas
      ctx.save()
      ctx.translate(0, H - BAR_H)
      drawBar(0, g.sides[0], 'AZUL')
      ctx.restore()
      ctx.save()
      ctx.translate(W, BAR_H)
      ctx.rotate(Math.PI)
      drawBar(1, g.sides[1], g.mode === 1 ? 'CPU' : 'ROJO')
      ctx.restore()

      // tiempo al centro
      if (g.phase === 'playing') {
        const left = Math.max(0, g.endT - g.t)
        const mm = Math.floor(left / 60)
        const ss = Math.floor(left % 60).toString().padStart(2, '0')
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `10px ${pf}`
        ctx.fillStyle = left <= 60 ? '#fde047' : 'rgba(255,255,255,0.7)'
        ctx.fillText(`${mm}:${ss}`, W / 2, H / 2)
        if (g.t >= DURATION) {
          ctx.font = `6px ${pf}`
          ctx.fillStyle = GOLD
          ctx.fillText('TIEMPO EXTRA', W / 2, H / 2 + 16)
        } else if (left <= 60) {
          ctx.font = `6px ${pf}`
          ctx.fillStyle = '#fde047'
          ctx.fillText('ORO DOBLE', W / 2, H / 2 + 16)
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(4,6,14,0.72)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `20px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `7px ${pf}`
        ctx.fillText('P O TOCA PARA SEGUIR', W / 2, H / 2 + 22)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- reacomodo al girar la pantalla ----------
    /** Las posiciones se calculan desde el tamaño actual; basta con cambiar el canvas y pausar. */
    const relayoutLive = () => {
      layout()
      setupCanvas(canvas, W, H)
      if (g.phase === 'playing') g.paused = true
    }

    // ---------- bucle ----------
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      const jp = justPressedRef.current
      if (jp.has('pause') && g.phase === 'playing') g.paused = !g.paused
      if (jp.has('action')) {
        if (g.phase === 'menu') startRef.current(lastMode, lastLevel)
        else if (g.phase === 'over' && g.overT > 0.5) startRef.current(lastMode, lastLevel)
        else if (g.paused) g.paused = false
      }
      jp.clear()
      if (!g.paused) {
        const dtGame = juice.update(dt)
        if (dtGame > 0) update(dtGame)
      }
      draw()
    }
    raf = requestAnimationFrame((t) => {
      sync()
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', pauseIfPlaying)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef])

  const titleWin =
    ui.draw ? 'EMPATE' : ui.mode === 2 ? (ui.winner === 0 ? 'GANA AZUL' : 'GANA ROJO') : ui.winner === 0 ? 'VICTORIA' : 'DERROTA'
  const accent = ui.draw ? ACCENT : ui.winner === 0 || ui.mode === 2 ? TEAM[ui.winner ?? 0] : TEAM[1]

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen width={W0} height={H0} className="rounded-xl border border-amber-400/30 bg-[#0b0f1a]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Guerra de Castillos"
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="GUERRA DE CASTILLOS"
            accent={ACCENT}
            subtitle="Destruye el castillo enemigo. Si se acaba el tiempo, gana quien haga más daño (con tiempo extra si empatan)."
            hint="Elige un modo o pulsa ESPACIO"
            touchHint="Elige un modo"
          >
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-white/60">1 jugador contra la CPU</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CPU_LEVELS.map((lv, i) => (
                  <button
                    key={lv.name}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      startRef.current(1, i)
                    }}
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition active:scale-95"
                    style={{ background: `${TEAM[0]}33` }}
                  >
                    {lv.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  startRef.current(2, 1)
                }}
                className="mt-1 rounded-full px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95"
                style={{ background: ACCENT, boxShadow: `0 0 24px ${ACCENT}66` }}
              >
                2 jugadores
              </button>
            </div>
            <p className="max-w-[18rem] text-[11px] leading-relaxed text-white/60">
              Toca una carta y luego el carril, o arrastrala al carril. Piedra, papel y tijera: el arquero vence al ladrón, el caballero al mago.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <>
            <GameOverOverlay
              title={titleWin}
              accent={accent}
              score={ui.mode === 2 ? Math.max(ui.dmg0, ui.dmg1) : ui.dmg0}
              best={ui.mode === 1 ? ui.best : 0}
              newBest={false}
              stats={[
                { label: 'Azul', value: ui.dmg0 },
                { label: ui.mode === 1 ? 'CPU' : 'Rojo', value: ui.dmg1 },
                { label: 'Fin', value: ui.reason === 'castle' ? 'Castillo' : 'Tiempo' },
              ]}
              onRestart={() => restartRef.current()}
              touchHint="Toca el botón para seguir"
              ranked={false}
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                menuRef.current()
              }}
              className="absolute left-1/2 top-[76%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs text-white/70 transition active:scale-95"
            >
              Cambiar modo
            </button>
          </>
        )}
      </GameScreen>
    </div>
  )
}
