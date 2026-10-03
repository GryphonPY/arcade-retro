/** Las tres naves seleccionables y su armamento. */
import type { Game } from './game'
import { missileSprite, needle, shapeSprite, tintFrom, type ShapeDef, type Sprite } from './sprites'
import { TAU } from './util'

export interface ShipDef {
  id: number
  name: string
  role: string
  color: string
  accent: string
  speed: number
  focusSpeed: number
  bombs: number
  desc: string
  /** Barras de la pantalla de selección (1..5). */
  stats: { label: string; v: number }[]
  shape: ShapeDef
  /** Texto corto del disparo concentrado. */
  focusDesc: string
}

export const SHIPS: ShipDef[] = [
  {
    id: 0,
    name: 'ARCO',
    role: 'Interceptor',
    color: '#22d3ee',
    accent: '#cffafe',
    speed: 205,
    focusSpeed: 92,
    bombs: 3,
    desc: 'Rápida y ágil. Abanico de disparos muy amplio que barre la pantalla.',
    focusDesc: 'Concentrado: el abanico se cierra en una ráfaga frontal.',
    stats: [
      { label: 'VEL', v: 5 },
      { label: 'PODER', v: 2 },
      { label: 'ALCANCE', v: 5 },
    ],
    shape: {
      w: 34,
      h: 32,
      layers: [
        { pts: [3, -2, 15, 6, 16, 11, 11, 10, 4, 7], fill: 'body', stroke: true, pair: true },
        { pts: [13, 4, 16, 6, 17, 13, 14, 11], fill: 'main', pair: true },
        { pts: [0, -16, 3, -10, 5, -2, 5, 9, 3, 13, 0, 12], fill: 'body', stroke: true },
        { pts: [0, -12, 1.5, -6, 1.5, 6, 0, 8], fill: 'dark' },
        { pts: [0, -10, 2, -6, 2, -1, 0, 1], fill: 'glass' },
      ],
      lights: [9, 7, 1.1],
    },
  },
  {
    id: 1,
    name: 'TITAN',
    role: 'Acorazado',
    color: '#f472b6',
    accent: '#fce7f3',
    speed: 158,
    focusSpeed: 74,
    bombs: 2,
    desc: 'Pesada y brutal. Disparo concentrado de alto daño y bombas más largas.',
    focusDesc: 'Concentrado: dispara un LASER continuo que perfora el blindaje.',
    stats: [
      { label: 'VEL', v: 2 },
      { label: 'PODER', v: 5 },
      { label: 'ALCANCE', v: 2 },
    ],
    shape: {
      w: 32,
      h: 34,
      layers: [
        { pts: [8, -17, 10.5, -17, 10.5, -9, 8, -9], fill: 'main', pair: true },
        { pts: [6, -10, 11, -12, 13, -4, 13, 12, 8, 14, 6, 4], fill: 'body', stroke: true, pair: true },
        { pts: [0, -14, 4, -10, 6, -2, 6, 10, 4, 15, 0, 14], fill: 'body', stroke: true },
        { pts: [0, -6, 3, -3, 3, 6, 0, 8], fill: 'dark' },
        { pts: [0, -11, 2.2, -8, 2.2, -3, 0, -1], fill: 'glass' },
      ],
      lights: [9.5, 9, 1.3],
    },
  },
  {
    id: 2,
    name: 'VEGA',
    role: 'Cazadora',
    color: '#a78bfa',
    accent: '#ede9fe',
    speed: 180,
    focusSpeed: 84,
    bombs: 3,
    desc: 'Equilibrada. Disparo en tres vías y misiles teledirigidos que buscan objetivos.',
    focusDesc: 'Concentrado: chorro frontal y los misiles salen al doble de ritmo.',
    stats: [
      { label: 'VEL', v: 4 },
      { label: 'PODER', v: 3 },
      { label: 'ALCANCE', v: 4 },
    ],
    shape: {
      w: 32,
      h: 32,
      layers: [
        { pts: [0, -15, 4, -6, 13, 8, 13, 12, 4, 10, 0, 12], fill: 'body', stroke: true },
        { pts: [11, 2, 13, -3, 14.5, 4, 14.5, 12, 12, 12], fill: 'main', pair: true },
        { pts: [0, -11, 2, -4, 2, 7, 0, 9], fill: 'dark' },
        { pts: [5, 0, 7.5, 0, 7.5, 7, 5, 7], fill: 'accent', pair: true },
        { pts: [0, -10, 2, -6, 2, -2, 0, 0], fill: 'glass' },
      ],
      lights: [8, 9, 1.2],
    },
  },
]

export function shipSprite(id: number): Sprite {
  const s = SHIPS[id]
  return shapeSprite('ship' + id, s.shape, tintFrom(s.color, s.accent, '#101028'))
}

/** Velocidad base de los disparos principales. */
const SHOT_V = 640

/** Ángulos (grados) del abanico de ARCO por nivel. */
const ARCO_FAN = [[], [8], [8, 17], [8, 17, 26], [4, 8, 17, 26, 34], [4, 8, 17, 26, 34, 42], [4, 8, 13, 17, 26, 34, 42], [4, 8, 13, 17, 22, 26, 34, 42, 50]]
/** Ángulos de VEGA por nivel. */
const VEGA_FAN = [[10], [10], [6, 14], [6, 14], [5, 11, 18], [5, 11, 18], [4, 9, 15, 22], [4, 9, 15, 22, 30]]

export interface LaserStats {
  dps: number
  w: number
}
export function laserStats(level: number): LaserStats {
  return { dps: 58 + level * 21, w: 7 + level * 1.4 }
}

function dmgMul(g: Game): number {
  let m = 1 + g.up('pierce') * 0.15
  if (g.up('fury') && g.mult >= 8) m *= 1.3
  return m
}
function rateMul(g: Game): number {
  return 1 + g.up('overdrive') * 0.2
}

/**
 * Dispara las armas del jugador (principal, misiles, drones y trasero).
 * `focus` = modo concentrado.
 */
export function fireWeapons(g: Game, dt: number) {
  const p = g.player
  const s = SHIPS[g.shipId]
  const L = g.power
  const focus = p.focus
  const rate = rateMul(g)
  const dm = dmgMul(g)
  const gold = g.up('fury') > 0 && g.mult >= 8
  const col = gold ? '#fde047' : s.color

  p.fireT -= dt * rate
  p.laser = false
  if (g.shipId === 1 && focus) {
    // TITAN: láser continuo
    p.laser = true
    p.fireT = Math.min(p.fireT, 0.05)
  } else if (p.fireT <= 0) {
    if (g.shipId === 0) {
      p.fireT += 0.07
      const spr = needle(col, 4, 15)
      const k = focus ? 0.22 : 1
      const v = focus ? SHOT_V * 1.12 : SHOT_V
      const d = 1.35 * dm
      g.shot(p.x - 4, p.y - 10, -Math.PI / 2, v, d, spr, 0)
      g.shot(p.x + 4, p.y - 10, -Math.PI / 2, v, d, spr, 0)
      for (const deg of ARCO_FAN[L - 1]) {
        const a = (deg * k * Math.PI) / 180
        g.shot(p.x - 6, p.y - 6, -Math.PI / 2 - a, v, d, spr, 0)
        g.shot(p.x + 6, p.y - 6, -Math.PI / 2 + a, v, d, spr, 0)
      }
    } else if (g.shipId === 1) {
      p.fireT += 0.085
      const n = L <= 2 ? 2 : L <= 4 ? 3 : L <= 6 ? 4 : 5
      const spr = needle(col, 7, 20)
      const d = (2.4 + L * 0.28) * dm
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 7
        g.shot(p.x + off, p.y - 12, -Math.PI / 2 + off * 0.004, SHOT_V * 0.95, d, spr, 0)
      }
    } else {
      p.fireT += 0.08
      const spr = needle(col, 4, 13)
      const d = 1.25 * dm
      const k = focus ? 0.12 : 1
      g.shot(p.x, p.y - 12, -Math.PI / 2, SHOT_V, d, spr, 0)
      if (L >= 2) {
        g.shot(p.x - 4, p.y - 10, -Math.PI / 2, SHOT_V, d, spr, 0)
        g.shot(p.x + 4, p.y - 10, -Math.PI / 2, SHOT_V, d, spr, 0)
      }
      for (const deg of VEGA_FAN[L - 1]) {
        const a = (deg * k * Math.PI) / 180
        g.shot(p.x - 5, p.y - 6, -Math.PI / 2 - a, SHOT_V, d, spr, 0)
        g.shot(p.x + 5, p.y - 6, -Math.PI / 2 + a, SHOT_V, d, spr, 0)
      }
    }
    g.sfxShot()
  }

  // Misiles (VEGA de serie + mejora "Lanzamisiles" para todas)
  const mUp = g.up('missiles')
  const vegaM = g.shipId === 2
  if (vegaM || mUp > 0) {
    p.missileT -= dt * rate
    if (p.missileT <= 0) {
      const base = vegaM ? 0.42 - L * 0.018 : 0.7
      p.missileT += (focus && vegaM ? base * 0.5 : base) / (1 + mUp * 0.25)
      const n = (vegaM ? 1 + Math.floor(L / 3) : 0) + mUp
      const spr = missileSprite(gold ? '#fde047' : vegaM ? '#c4b5fd' : '#fb923c')
      for (let i = 0; i < n; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const a = -Math.PI / 2 + side * (0.9 + (i >> 1) * 0.35)
        const sh = g.shot(p.x + side * 8, p.y + 2, a, 260, 3.4 * dm, spr, 1)
        if (sh) sh.life = -0.1 * (i >> 1)
      }
      g.sfxMissile()
    }
  }

  // Drones
  const nd = g.drones.length
  if (nd > 0) {
    p.droneT -= dt * rate
    if (p.droneT <= 0) {
      p.droneT += 0.11
      const spr = needle(gold ? '#fde047' : '#e0f2fe', 3, 11)
      for (const dr of g.drones) {
        let ang = -Math.PI / 2
        if (focus) ang += (p.x - dr.x) * 0.006
        g.shot(dr.x, dr.y - 4, ang, SHOT_V * 0.95, 1.05 * dm, spr, 2)
      }
    }
  }

  // Cañón trasero
  const rear = g.up('rear')
  if (rear > 0) {
    p.rearT -= dt * rate
    if (p.rearT <= 0) {
      p.rearT += 0.15
      const spr = needle(col, 4, 12)
      const angs = rear === 1 ? [0.35] : [0.3, 0.6]
      for (const a of angs) {
        g.shot(p.x - 5, p.y + 8, Math.PI / 2 + a, 520, 1.3 * dm, spr, 3)
        g.shot(p.x + 5, p.y + 8, Math.PI / 2 - a, 520, 1.3 * dm, spr, 3)
      }
    }
  }
}

/** Posiciones de los drones: orbitan o se alinean en modo concentrado. */
export function updateDrones(g: Game, dt: number) {
  const p = g.player
  const n = g.drones.length
  p.droneAng += dt * 2.6
  for (let i = 0; i < n; i++) {
    const d = g.drones[i]
    let tx: number
    let ty: number
    if (p.focus) {
      const slot = [-16, 16, -30, 30][i]
      tx = p.x + slot
      ty = p.y + 8 + Math.abs(slot) * 0.25
    } else {
      const a = p.droneAng + (i * TAU) / n
      tx = p.x + Math.cos(a) * 28
      ty = p.y + Math.sin(a) * 22 + 2
    }
    const k = Math.min(1, dt * 14)
    d.x += (tx - d.x) * k
    d.y += (ty - d.y) * k
  }
}
