'use client'

import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { setupCanvas, rr } from './game-utils'
import { noise, tone } from './sfx'

const ACCENT = '#a3e635'
const BLUE = '#60a5fa'
const PINK = '#f472b6'
const SKIN = '#fde2c4'

const W0 = 400
const H0 = 480
// Cancha lógica: se ajusta a la pantalla (ver layout). El suelo queda al fondo.
let W = W0
let H = H0
let GY = H0 - 58

const GD = 26 // grosor de la pared donde está la portería
const GH = 150 // alto del hueco de la portería
const SMALL = 0.55 // factor de la portería pequeña
const BR = 13 // radio de la pelota
const HR = 24 // radio de la cabeza
const BODY_R = 18 // radio del cuerpo (empuja, no patea)
const MATCH_S = 90
const BGRAV = 900
const PGRAV = 1500
const JUMP_V = 560
const MSPD = 200
const ACCEL = 1600
const KICK_S = 0.26 // duración de la patada
const KICK_V = 470
const POWER_S: Record<PowerKind, number> = { fuego: 8, cabeza: 6, congela: 2, porteria: 6 }
const POWER_LABEL: Record<PowerKind, string> = {
  fuego: 'FUEGO',
  cabeza: 'CABEZA GIGANTE',
  congela: 'CONGELADO',
  porteria: 'MI PORTERIA CHICA',
}
const POWER_COLOR: Record<PowerKind, string> = {
  fuego: '#fb923c',
  cabeza: '#facc15',
  congela: '#67e8f9',
  porteria: '#c084fc',
}
const POWER_KINDS: PowerKind[] = ['fuego', 'cabeza', 'congela', 'porteria']

// Dificultad de la CPU: reacción, velocidad, error al apuntar y ganas de saltar.
const CPU: Record<Diff, { react: number; speed: number; err: number; jump: number }> = {
  facil: { react: 0.38, speed: 0.7, err: 70, jump: 0.2 },
  medio: { react: 0.22, speed: 0.85, err: 34, jump: 0.5 },
  dificil: { react: 0.12, speed: 1, err: 10, jump: 0.85 },
}

/** Ajusta la cancha al área de la pantalla. */
function layout() {
  const f = fitStage(W0, H0, 1.9, 1.08)
  W = f.w
  H = f.h
  GY = H - 58
  publishLogical(f)
}

type Mode = 1 | 2
type Diff = 'facil' | 'medio' | 'dificil'
type Phase = 'menu' | 'kick' | 'play' | 'goal' | 'over'
type Side = 0 | 1 // 0 = azul (izquierda), 1 = rosa (derecha)
type PowerKind = 'fuego' | 'cabeza' | 'congela' | 'porteria'

interface Player {
  side: Side
  x: number
  y: number // altura de los pies (GY cuando está en el suelo)
  vx: number
  vy: number
  dir: number // intención de movimiento: -1, 0 o 1
  kickT: number // tiempo desde que empezó la patada (-1 si no patea)
  kickDone: boolean // ya golpeó la pelota en esta patada
  kickCd: number
  headCd: number
  fire: boolean // próxima patada con fuerza de fuego
  giantT: number
  frozenT: number
  squash: number
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  hot: number // tiempo de estela de fuego
}

interface Orb {
  x: number
  y: number
  kind: PowerKind
  life: number
  ph: number
}

interface Ctrl {
  dir: number
  jumpQ: boolean
  kickQ: boolean
}

interface Game {
  phase: Phase
  paused: boolean
  mode: Mode
  diff: Diff
  time: number // segundos restantes (en muerte súbita sube)
  overtime: boolean
  t: number
  phaseT: number
  players: [Player, Player]
  ball: Ball
  orbs: Orb[]
  orbT: number
  lastOrb: PowerKind | null
  goals: [number, number]
  taken: [number, number]
  shrinkT: [number, number] // portería pequeña activa: índice = lado que la defiende
  winner: Side | null
  lastScorer: Side | null
  ctrl: [Ctrl, Ctrl]
  cpuReact: number
  cpuTarget: number
  introT: number // tiempo que se muestran las pistas de control
}

interface Ui {
  phase: Phase
  mode: Mode
  diff: Diff
  goals: [number, number]
  time: number
  overtime: boolean
  winner: Side | null
  taken: [number, number]
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Choque círculo contra caja: devuelve la posición corregida y la normal, o null. */
function circleBox(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number) {
  const nx0 = clamp(cx, x0, x1)
  const ny0 = clamp(cy, y0, y1)
  const dx = cx - nx0
  const dy = cy - ny0
  const d2 = dx * dx + dy * dy
  if (d2 >= r * r) return null
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2)
    return { x: cx + (dx / d) * (r - d), y: cy + (dy / d) * (r - d), nx: dx / d, ny: dy / d }
  }
  // el centro quedó dentro de la caja: sale por el lado más cercano
  const dl = cx - x0
  const dr = x1 - cx
  const dt = cy - y0
  const db = y1 - cy
  const m = Math.min(dl, dr, dt, db)
  if (m === dl) return { x: x0 - r, y: cy, nx: -1, ny: 0 }
  if (m === dr) return { x: x1 + r, y: cy, nx: 1, ny: 0 }
  if (m === dt) return { x: cx, y: y0 - r, nx: 0, ny: -1 }
  return { x: cx, y: y1 + r, nx: 0, ny: 1 }
}

/** Altura del hueco de la portería que defiende `side`. */
const gapOf = (g: Game, side: Side) => GH * (g.shrinkT[side] > 0 ? SMALL : 1)
const headRadius = (p: Player) => HR * (p.giantT > 0 ? 1.7 : 1)
const headY = (p: Player) => p.y - 58
/** Hacia dónde patea y avanza quien está en `side`: al arco contrario. */
const forward = (side: Side) => (side === 0 ? 1 : -1)

function newPlayer(side: Side): Player {
  return {
    side,
    x: 0,
    y: GY,
    vx: 0,
    vy: 0,
    dir: 0,
    kickT: -1,
    kickDone: false,
    kickCd: 0,
    headCd: 0,
    fire: false,
    giantT: 0,
    frozenT: 0,
    squash: 0,
  }
}

function newGame(mode: Mode, diff: Diff): Game {
  return {
    phase: 'menu',
    paused: false,
    mode,
    diff,
    time: MATCH_S,
    overtime: false,
    t: 0,
    phaseT: 0,
    players: [newPlayer(0), newPlayer(1)],
    ball: { x: W / 2, y: GY - BR, vx: 0, vy: 0, rot: 0, hot: 0 },
    orbs: [],
    orbT: 6,
    lastOrb: null,
    goals: [0, 0],
    taken: [0, 0],
    shrinkT: [0, 0],
    winner: null,
    lastScorer: null,
    ctrl: [
      { dir: 0, jumpQ: false, kickQ: false },
      { dir: 0, jumpQ: false, kickQ: false },
    ],
    cpuReact: 0,
    cpuTarget: W / 2,
    introT: 0,
  }
}

const initialUi = (): Ui => ({
  phase: 'menu',
  mode: 2,
  diff: 'medio',
  goals: [0, 0],
  time: MATCH_S,
  overtime: false,
  winner: null,
  taken: [0, 0],
})

/** Coloca a los jugadores y la pelota para un saque desde el centro. */
function kickoffPositions(g: Game) {
  g.players[0].x = W * 0.28
  g.players[1].x = W * 0.72
  for (const p of g.players) {
    p.y = GY
    p.vx = 0
    p.vy = 0
    p.dir = 0
    p.kickT = -1
    p.kickDone = false
    p.fire = false
    p.giantT = 0
    p.frozenT = 0
  }
  g.shrinkT = [0, 0]
  g.ball = { x: W / 2, y: GY - BR, vx: 0, vy: 0, rot: 0, hot: 0 }
  g.cpuTarget = W / 2
}

export default function FutbolCabezon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(m: Mode, d: Diff) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Ui>(initialUi)
  const [sel, setSel] = useState<{ mode: Mode; diff: Diff }>({ mode: 2, diff: 'medio' })
  // espejo del menú para que la tecla ESPACIO use la última elección
  const selRef = useRef<{ mode: Mode; diff: Diff }>({ mode: 2, diff: 'medio' })

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

    let g = newGame(2, 'medio')
    kickoffPositions(g)
    let lastMode: Mode = 2
    let lastDiff: Diff = 'medio'
    let slowT = 0 // cámara lenta tras un gol (segundos reales)
    let seenStage = stageVersion()
    let lastSec = -1

    // ---------- sincronía con React ----------
    const sync = () => {
      setUi({
        phase: g.phase,
        mode: g.mode,
        diff: g.diff,
        goals: [g.goals[0], g.goals[1]],
        time: Math.ceil(g.time),
        overtime: g.overtime,
        winner: g.winner,
        taken: [g.taken[0], g.taken[1]],
      })
      lastSec = Math.ceil(g.time)
    }

    // ---------- pausa ----------
    const held = new Set<string>()
    const ptrs = new Map<number, { side: Side; x0: number; y0: number; x: number; y: number; t0: number; kick: boolean; jumped: boolean; moved: boolean }>()
    const clearInput = () => {
      held.clear()
      ptrs.clear()
      g.ctrl = [
        { dir: 0, jumpQ: false, kickQ: false },
        { dir: 0, jumpQ: false, kickQ: false },
      ]
    }
    const inMatch = () => g.phase === 'play' || g.phase === 'kick' || g.phase === 'goal'
    const pauseToggle = () => {
      if (!inMatch()) return
      g.paused = !g.paused
      clearInput()
      tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })
    }
    const pauseIfPlaying = () => {
      if (inMatch() && !g.paused) {
        g.paused = true
        clearInput()
      }
    }
    const onVis = () => {
      if (document.hidden) pauseIfPlaying()
    }

    // ---------- teclado ----------
    // J1 (azul): A/D mover, W saltar, S patear. J2 (rosa): ← →, ↑ saltar, ↓ patear.
    // En 1 jugador el azul también usa las flechas.
    const KEYS: Record<string, { side: Side; act: 'J' | 'K' }> = {
      KeyW: { side: 0, act: 'J' },
      KeyS: { side: 0, act: 'K' },
      ArrowUp: { side: 1, act: 'J' },
      ArrowDown: { side: 1, act: 'K' },
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') {
        if (!e.repeat) pauseToggle()
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (e.repeat) return
        if (g.phase === 'menu') startRef.current(selRef.current.mode, selRef.current.diff)
        else if (g.phase === 'over' && g.phaseT > 0.8) startRef.current(lastMode, lastDiff)
        else if (g.paused) g.paused = false
        return
      }
      const isMove = e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight'
      const k = KEYS[e.code]
      if (!isMove && !k) return
      e.preventDefault()
      held.add(e.code)
      g.introT = 99
      if (!k || e.repeat || g.phase !== 'play' || g.paused) return
      const side: Side = g.mode === 1 ? 0 : k.side
      if (k.act === 'J') g.ctrl[side].jumpQ = true
      else g.ctrl[side].kickQ = true
    }
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)

    // ---------- toques: cada mitad es de su jugador ----------
    const toX = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientX - r.left) / r.width) * W
    }
    const toY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return ((e.clientY - r.top) / r.height) * H
    }
    // En 1 jugador todo el campo táctil es del azul.
    const sideAt = (x: number): Side => (g.mode === 1 || x < W / 2 ? 0 : 1)
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      if (g.paused) {
        g.paused = false
        return
      }
      if (g.phase !== 'play') return
      const x = toX(e)
      const y = toY(e)
      const s = sideAt(x)
      // un segundo dedo en la misma mitad patea sin soltar al primero
      let second = false
      for (const p of ptrs.values()) if (p.side === s && !p.kick) second = true
      ptrs.set(e.pointerId, { side: s, x0: x, y0: y, x, y, t0: performance.now(), kick: second, jumped: false, moved: false })
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      if (second) g.ctrl[s].kickQ = true
      g.introT = 99
    }
    const onPointerMove = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      e.preventDefault()
      p.x = toX(e)
      p.y = toY(e)
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) p.moved = true
      // deslizar hacia arriba = saltar (una vez por gesto)
      if (!p.kick && !p.jumped && p.y0 - p.y > 34 && p.y0 - p.y > Math.abs(p.x - p.x0)) {
        p.jumped = true
        g.ctrl[p.side].jumpQ = true
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      ptrs.delete(e.pointerId)
      // toque rápido sin mover = patada
      const quick = performance.now() - p.t0 < 260
      if (e.type === 'pointerup' && !p.kick && !p.jumped && !p.moved && quick && g.phase === 'play') {
        g.ctrl[p.side].kickQ = true
      }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', pauseIfPlaying)
    document.addEventListener('visibilitychange', onVis)

    // ---------- control: teclado, toques y CPU ----------
    const keyDir = (s: Side) => {
      const left = s === 0 ? held.has('KeyA') || (g.mode === 1 && held.has('ArrowLeft')) : held.has('ArrowLeft')
      const right = s === 0 ? held.has('KeyD') || (g.mode === 1 && held.has('ArrowRight')) : held.has('ArrowRight')
      return (right ? 1 : 0) - (left ? 1 : 0)
    }
    // dirección relativa a su muñeco: un dedo a la izquierda lo mueve a la izquierda
    const touchDirOf = (s: Side) => {
      const p = g.players[s]
      for (const pt of ptrs.values()) {
        if (pt.side !== s || pt.kick) continue
        const dx = pt.x - p.x
        if (Math.abs(dx) > 8) return Math.sign(dx)
      }
      return 0
    }
    const cpuThink = (dt: number) => {
      const c = CPU[g.diff]
      const me = g.players[1]
      const b = g.ball
      g.cpuReact -= dt
      if (g.cpuReact <= 0) {
        g.cpuReact = c.react * (0.7 + Math.random() * 0.6)
        // con la pelota en su mitad (o viniendo) la sigue; si no, cuida su portería
        const mine = b.x > W / 2 || b.vx > 40
        const base = mine ? b.x + b.vx * 0.2 : W - GD - 70 + (b.x - W / 2) * 0.2
        g.cpuTarget = clamp(base + (Math.random() * 2 - 1) * c.err, GD + 20, W - GD - 20)
        if (Math.abs(b.x - me.x) < 60 && b.y < me.y - 40 && Math.random() < c.jump) g.ctrl[1].jumpQ = true
        if (Math.abs(b.x - me.x) < 50 && b.y > GY - 110 && me.kickCd <= 0 && me.kickT < 0 && Math.random() < 0.55 + c.jump * 0.3) {
          g.ctrl[1].kickQ = true
        }
      }
      const dx = g.cpuTarget - me.x
      g.ctrl[1].dir = Math.abs(dx) < 6 ? 0 : clamp(dx / 40, -1, 1) * c.speed
    }
    const readControls = (dt: number) => {
      for (const s of [0, 1] as Side[]) {
        if (s === 1 && g.mode === 1) continue
        const k = keyDir(s)
        g.ctrl[s].dir = k !== 0 ? k : touchDirOf(s)
      }
      if (g.mode === 1) cpuThink(dt)
    }

    // ---------- sonidos ----------
    const sfxKick = (strong: boolean) => {
      tone({ freq: 200, to: strong ? 900 : 320, dur: 0.12, vol: 0.06, type: 'square' })
      noise({ dur: 0.06, vol: 0.05, freq: 900 })
    }
    const sfxHead = () => tone({ freq: 520, to: 300, dur: 0.1, vol: 0.06, type: 'triangle' })
    const sfxWall = () => tone({ freq: 190, to: 140, dur: 0.05, vol: 0.05, type: 'triangle' })
    const sfxPower = () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.05, delay: i * 0.05, type: 'square' }))
    const sfxGoal = () => {
      ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.06, type: 'square', delay: i * 0.11 }))
      noise({ dur: 0.5, vol: 0.08, freq: 2000, delay: 0.1 })
    }
    const sfxWin = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.06, delay: i * 0.11 }))
    const sfxTick = (hi: boolean) => tone({ freq: hi ? 880 : 520, dur: 0.07, type: 'square', vol: 0.05 })

    // ---------- partida ----------
    /** Saque desde el centro con cuenta regresiva. */
    const beginKickoff = () => {
      kickoffPositions(g)
      g.phase = 'kick'
      g.phaseT = 0
      g.ctrl = [
        { dir: 0, jumpQ: false, kickQ: false },
        { dir: 0, jumpQ: false, kickQ: false },
      ]
      sync()
    }
    const startMatch = (mode: Mode, diff: Diff) => {
      lastMode = mode
      lastDiff = diff
      slowT = 0
      juice.reset()
      g = newGame(mode, diff)
      beginKickoff()
    }
    startRef.current = startMatch
    menuRef.current = () => {
      slowT = 0
      juice.reset()
      g = newGame(lastMode, lastDiff)
      kickoffPositions(g)
      sync()
    }

    const finish = () => {
      g.phase = 'over'
      g.phaseT = 0
      g.winner = g.goals[0] === g.goals[1] ? null : g.goals[0] > g.goals[1] ? 0 : 1
      sfxWin()
      sync()
    }

    const scoreGoal = (s: Side) => {
      g.phase = 'goal'
      g.phaseT = 0
      g.goals[s]++
      g.lastScorer = s
      slowT = 0.9
      const col = s === 0 ? BLUE : PINK
      juice.shake(0.9)
      juice.flash(col, 0.35)
      juice.freeze(60)
      juice.burst(W / 2, GY - 120, [BLUE, PINK, '#fde047', ACCENT, '#ffffff'], {
        count: 90,
        speed: 320,
        life: 1.8,
        size: 5,
        gravity: 420,
        angle: -Math.PI / 2,
        arc: Math.PI * 1.1,
      })
      juice.text(W / 2, H * 0.4, s === 0 ? 'GOOOL AZUL' : 'GOOOL ROSA', col, 16, 1.6)
      sfxGoal()
      sync()
    }

    const spawnOrb = () => {
      const kinds = POWER_KINDS.filter((k) => k !== g.lastOrb)
      const kind = kinds[(Math.random() * kinds.length) | 0]
      g.lastOrb = kind
      g.orbs.push({
        x: W * 0.25 + Math.random() * W * 0.5,
        y: 110 + Math.random() * Math.max(10, GY - 260),
        kind,
        life: 12,
        ph: Math.random() * 6.28,
      })
    }
    const takeOrb = (p: Player, o: Orb) => {
      o.life = 0
      g.taken[p.side]++
      const rival = g.players[p.side === 0 ? 1 : 0]
      juice.text(o.x, o.y - 22, POWER_LABEL[o.kind], POWER_COLOR[o.kind], 9, 1.4)
      juice.burst(o.x, o.y, [POWER_COLOR[o.kind], '#ffffff'], { count: 22, speed: 170, life: 0.6, size: 4 })
      juice.flash(POWER_COLOR[o.kind], 0.18)
      sfxPower()
      switch (o.kind) {
        case 'fuego':
          // su próxima patada sale con fuerza de fuego
          p.fire = true
          break
        case 'cabeza':
          p.giantT = POWER_S.cabeza
          break
        case 'congela':
          rival.frozenT = POWER_S.congela
          rival.kickT = -1
          break
        case 'porteria':
          // achica la portería que defiende quien lo toma: el rival tendrá más difícil marcar
          g.shrinkT[p.side] = POWER_S.porteria
          break
      }
    }

    // ---------- jugadores ----------
    const jump = (p: Player) => {
      if (p.frozenT > 0 || p.y < GY - 0.5) return
      p.vy = -JUMP_V
      p.squash = 1
    }
    const kick = (p: Player) => {
      if (p.frozenT > 0 || p.kickT >= 0 || p.kickCd > 0) return
      p.kickT = 0
      p.kickDone = false
      p.kickCd = 0.42
    }
    const stepPlayer = (p: Player, dt: number) => {
      p.kickCd = Math.max(0, p.kickCd - dt)
      p.headCd = Math.max(0, p.headCd - dt)
      p.giantT = Math.max(0, p.giantT - dt)
      p.frozenT = Math.max(0, p.frozenT - dt)
      p.squash = Math.max(0, p.squash - dt * 5)
      const c = g.ctrl[p.side]
      if (c.jumpQ) jump(p)
      if (c.kickQ) kick(p)
      c.jumpQ = false
      c.kickQ = false
      const want = p.frozenT > 0 ? 0 : clamp(c.dir, -1, 1) * MSPD
      p.vx += clamp(want - p.vx, -ACCEL * dt, ACCEL * dt)
      p.x = clamp(p.x + p.vx * dt, GD + 16, W - GD - 16)
      p.vy += PGRAV * dt
      p.y += p.vy * dt
      if (p.y >= GY) {
        p.y = GY
        p.vy = 0
      }
      if (p.kickT >= 0) {
        p.kickT += dt
        if (p.kickT >= KICK_S) {
          p.kickT = -1
          p.kickDone = false
        }
      }
    }

    /** Pie de la patada: se estira hacia el arco contrario y vuelve. */
    const footOf = (p: Player) => {
      const k = clamp(p.kickT / KICK_S, 0, 1)
      const reach = 10 + Math.sin(k * Math.PI) * 26
      return { x: p.x + forward(p.side) * reach, y: p.y - 12 }
    }
    const footActive = (p: Player) => p.kickT >= 0.07 && p.kickT <= 0.19 && !p.kickDone

    /** Cabeza (cabecea), pie (patea, si está pateando) o cuerpo (empuja). */
    const contactPlayer = (p: Player) => {
      const b = g.ball
      const hr = headRadius(p)
      const hx = p.x
      const hy = headY(p)
      if (p.headCd <= 0) {
        const dx = b.x - hx
        const dy = b.y - hy
        const d = Math.hypot(dx, dy)
        if (d < hr + BR && d > 0.01) {
          const nx = dx / d
          const ny = dy / d
          const spd = p.giantT > 0 ? 560 : 500
          b.x = hx + nx * (hr + BR)
          b.y = hy + ny * (hr + BR)
          b.vx = nx * spd + p.vx * 0.4
          b.vy = ny * spd - 80 + p.vy * 0.5
          p.headCd = 0.14
          juice.burst(b.x, b.y, ['#ffffff', ACCENT], { count: 6, speed: 90, life: 0.3, size: 3 })
          juice.shake(0.18)
          sfxHead()
          return
        }
      }
      const f = forward(p.side)
      if (footActive(p)) {
        const ft = footOf(p)
        const dx = b.x - ft.x
        const dy = b.y - ft.y
        const d = Math.hypot(dx, dy)
        if (d < 15 + BR && d > 0.01) {
          const nx = dx / d
          const ny = dy / d
          b.x = ft.x + nx * (15 + BR)
          b.y = ft.y + ny * (15 + BR)
          p.kickDone = true
          const strong = p.fire
          p.fire = false
          b.vx = f * KICK_V * (strong ? 1.9 : 1) + p.vx * 0.2
          b.vy = -(230 + Math.random() * 60) * (strong ? 1.2 : 1)
          if (strong) b.hot = 1.4
          juice.burst(b.x, b.y, strong ? ['#fb923c', '#fde047'] : ['#ffffff'], { count: strong ? 16 : 8, speed: 140, life: 0.4, size: 4 })
          juice.shake(strong ? 0.45 : 0.25)
          juice.freeze(strong ? 70 : 35)
          sfxKick(strong)
          return
        }
      }
      // cuerpo: empuja la pelota
      const cy = p.y - 20
      const dx = b.x - p.x
      const dy = b.y - cy
      const d = Math.hypot(dx, dy)
      if (d < BODY_R + BR && d > 0.01) {
        const nx = dx / d
        const ny = dy / d
        b.x = p.x + nx * (BODY_R + BR)
        b.y = cy + ny * (BODY_R + BR)
        b.vx = nx * Math.max(160, Math.abs(b.vx)) + p.vx * 0.3
        b.vy = Math.min(ny * 160, -40)
        sfxWall()
      }
    }

    // ---------- pelota ----------
    const stepBall = (dt: number) => {
      const b = g.ball
      const sp = Math.hypot(b.vx, b.vy)
      const n = Math.max(1, Math.ceil((sp * dt) / 4))
      const h = dt / n
      for (let i = 0; i < n; i++) {
        b.vy += BGRAV * h
        b.x += b.vx * h
        b.y += b.vy * h
        b.vx *= Math.exp(-0.08 * h)
        b.rot += (b.vx * h) / BR
        b.hot = Math.max(0, b.hot - h)
        // techo invisible
        if (b.y < BR) {
          b.y = BR
          if (b.vy < 0) b.vy = -b.vy * 0.6
        }
        // suelo
        if (b.y > GY - BR) {
          b.y = GY - BR
          if (b.vy > 0) b.vy = -b.vy * 0.62
          if (Math.abs(b.vy) < 25) b.vy = 0
          b.vx *= Math.exp(-2.2 * h)
        }
        // paredes con portería: van del techo al travesaño
        const gapL = gapOf(g, 0)
        const gapR = gapOf(g, 1)
        const walls: [number, number, number, number][] = [
          [0, 0, GD, GY - gapL],
          [W - GD, 0, W, GY - gapR],
        ]
        for (const [x0, y0, x1, y1] of walls) {
          const hit = circleBox(b.x, b.y, BR, x0, y0, x1, y1)
          if (!hit) continue
          b.x = hit.x
          b.y = hit.y
          const dot = b.vx * hit.nx + b.vy * hit.ny
          if (dot < 0) {
            b.vx -= 1.7 * dot * hit.nx
            b.vy -= 1.7 * dot * hit.ny
            sfxWall()
          }
        }
        // dentro de la portería: gol
        if (g.phase === 'play') {
          if (b.x < GD * 0.5 && b.y > GY - gapL) {
            scoreGoal(1)
            return
          }
          if (b.x > W - GD * 0.5 && b.y > GY - gapR) {
            scoreGoal(0)
            return
          }
        }
        // tras un gol la pelota rebota dentro de la red
        if (b.x < BR) {
          b.x = BR
          if (b.vx < 0) b.vx = -b.vx * 0.5
        } else if (b.x > W - BR) {
          b.x = W - BR
          if (b.vx > 0) b.vx = -b.vx * 0.5
        }
      }
    }

    // ---------- bucle de partida ----------
    const updateMatch = (dt: number) => {
      const playing = g.phase === 'play'
      if (playing) readControls(dt)
      else
        for (const c of g.ctrl) {
          c.dir = 0
          c.jumpQ = false
          c.kickQ = false
        }
      for (const p of g.players) stepPlayer(p, dt)
      // los dos muñecos no se enciman
      const [a, b] = g.players
      const sep = b.x - a.x
      if (Math.abs(sep) < 30) {
        const push = ((30 - Math.abs(sep)) / 2) * (sep < 0 ? -1 : 1)
        a.x = clamp(a.x - push, GD + 16, W - GD - 16)
        b.x = clamp(b.x + push, GD + 16, W - GD - 16)
      }
      if (g.phase === 'play' || g.phase === 'goal') {
        for (const p of g.players) contactPlayer(p)
        stepBall(dt)
      }
      if (g.phase === 'kick') {
        const before = Math.ceil((1.8 - g.phaseT) / 0.6)
        g.phaseT += dt
        const after = Math.ceil((1.8 - g.phaseT) / 0.6)
        if (after !== before && after > 0) sfxTick(false)
        if (g.phaseT >= 1.8) {
          sfxTick(true)
          g.phase = 'play'
          g.phaseT = 0
          sync()
        }
      } else if (g.phase === 'play') {
        g.time = g.overtime ? g.time + dt : g.time - dt
        if (!g.overtime && g.time <= 0) {
          g.time = 0
          if (g.goals[0] === g.goals[1]) {
            // empate: muerte súbita, gana el siguiente gol
            g.overtime = true
            juice.text(W / 2, H * 0.5, 'MUERTE SUBITA', '#fde047', 14, 1.6)
            juice.flash('#fde047', 0.2)
            beginKickoff()
            return
          }
          finish()
          return
        }
        g.orbT -= dt
        if (g.orbT <= 0) {
          g.orbT = 7 + Math.random() * 5
          if (g.orbs.length < 2) spawnOrb()
        }
        for (const o of g.orbs) {
          o.life -= dt
          o.ph += dt
        }
        for (const p of g.players) {
          const hr = headRadius(p)
          for (const o of g.orbs) {
            if (o.life > 0 && Math.hypot(o.x - p.x, o.y - headY(p)) < hr + 17) takeOrb(p, o)
          }
        }
        g.orbs = g.orbs.filter((o) => o.life > 0)
        if (Math.ceil(g.time) !== lastSec) sync()
      } else if (g.phase === 'goal') {
        g.phaseT += dt
        if (g.phaseT > 2.2) {
          if (g.overtime) finish()
          else beginKickoff()
        }
      }
    }

    // ---------- dibujo ----------
    const INK = '#2a1b3d'
    const drawField = () => {
      // cielo de día con nubes
      const sky = ctx.createLinearGradient(0, 0, 0, GY)
      sky.addColorStop(0, '#7dd3fc')
      sky.addColorStop(1, '#e0f2fe')
      ctx.fillStyle = sky
      ctx.fillRect(-20, -20, W + 40, GY + 20)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 0.31 + g.t * 0.004) % 1.2) * W - 40
        const cy = 30 + (i % 2) * 26
        ctx.beginPath()
        ctx.arc(cx, cy, 14, 0, Math.PI * 2)
        ctx.arc(cx + 16, cy - 6, 17, 0, Math.PI * 2)
        ctx.arc(cx + 34, cy, 13, 0, Math.PI * 2)
        ctx.fill()
      }
      // gradas: tres filas de afición, azul a la izquierda y rosa a la derecha
      const standTop = GY * 0.42
      const standBot = GY - 34
      ctx.fillStyle = '#475569'
      ctx.fillRect(-20, standTop, W + 40, standBot - standTop)
      const rows = 4
      const rowH = (standBot - standTop) / rows
      for (let r = 0; r < rows; r++) {
        const y = standTop + r * rowH
        ctx.fillStyle = r % 2 ? '#64748b' : '#57667b'
        ctx.fillRect(-20, y, W + 40, rowH)
        for (let x = 6 + (r % 2) * 7; x < W; x += 14) {
          const hop = Math.max(0, Math.sin(g.t * 7 + x * 0.3 + r)) * (g.phase === 'goal' ? 6 : 1.5)
          const side = x < W / 2 ? BLUE : PINK
          ctx.fillStyle = (x * 7 + r * 13) % 5 === 0 ? '#f8fafc' : side
          ctx.beginPath()
          ctx.arc(x, y + rowH * 0.62 - hop, 4.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fde2c4'
          ctx.beginPath()
          ctx.arc(x, y + rowH * 0.3 - hop, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // vallas de publicidad
      const adY = standBot
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ['#a3e635', '#f472b6', '#60a5fa', '#facc15', '#fb923c', '#c084fc'][i]
        ctx.fillRect((i * W) / 6, adY, W / 6 + 1, GY - adY)
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect((i * W) / 6 + 8, adY + (GY - adY) / 2 - 2, W / 6 - 16, 4)
      }
      ctx.fillStyle = INK
      ctx.fillRect(-20, adY - 2, W + 40, 2)
      // césped con franjas
      const grass = ctx.createLinearGradient(0, GY, 0, H)
      grass.addColorStop(0, '#4ade80')
      grass.addColorStop(1, '#16a34a')
      ctx.fillStyle = grass
      ctx.fillRect(-20, GY, W + 40, H - GY + 20)
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      for (let i = 0; i < 10; i += 2) ctx.fillRect((i * W) / 10, GY, W / 10, H - GY)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, GY, W, 3)
      ctx.fillRect(W / 2 - 1.5, GY, 3, H - GY)
    }

    /** Portería: postes blancos y red; arriba, la pared del estadio con franja del equipo. */
    const drawGoal = (defender: Side) => {
      const gap = gapOf(g, defender)
      const x0 = defender === 0 ? 0 : W - GD
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(x0, GY - gap, GD, gap)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = x0 + 4; x < x0 + GD; x += 6) {
        ctx.moveTo(x, GY - gap)
        ctx.lineTo(x, GY)
      }
      for (let y = GY - gap + 6; y < GY; y += 6) {
        ctx.moveTo(x0, y)
        ctx.lineTo(x0 + GD, y)
      }
      ctx.stroke()
      ctx.fillStyle = '#334155'
      ctx.fillRect(x0, 0, GD, GY - gap)
      ctx.fillStyle = defender === 0 ? BLUE : PINK
      ctx.fillRect(defender === 0 ? GD - 5 : x0, 0, 5, GY - gap)
      // postes y travesaño con contorno
      const post = defender === 0 ? GD - 4 : x0
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.5
      ctx.fillRect(x0, GY - gap - 6, GD, 6)
      ctx.strokeRect(x0, GY - gap - 6, GD, 6)
      ctx.fillRect(post, GY - gap - 6, 4, gap + 6)
      ctx.strokeRect(post, GY - gap - 6, 4, gap + 6)
    }

    const drawPlayer = (p: Player) => {
      const col = p.side === 0 ? BLUE : PINK
      const f = forward(p.side)
      const hr = headRadius(p)
      const hx = p.x
      const hy = headY(p)
      const look = Math.sign(g.ball.x - p.x) || 1
      const airborne = p.y < GY - 1
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(p.x, GY + 2, 22, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      // piernas: la que patea se estira hacia la pelota
      ctx.lineCap = 'round'
      ctx.lineWidth = 7
      ctx.strokeStyle = '#1e293b'
      ctx.beginPath()
      ctx.moveTo(p.x - 6, p.y - 10)
      ctx.lineTo(p.x - 7, p.y - 2)
      ctx.stroke()
      if (p.kickT >= 0) {
        const ft = footOf(p)
        ctx.beginPath()
        ctx.moveTo(p.x + f * 4, p.y - 10)
        ctx.lineTo(ft.x, ft.y)
        ctx.stroke()
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.arc(ft.x, ft.y, 6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(p.x + 6, p.y - 10)
        ctx.lineTo(p.x + 7, p.y - 2)
        ctx.stroke()
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.arc(p.x - 7, p.y - 1, 5, 0, Math.PI * 2)
        ctx.arc(p.x + 7, p.y - 1, 5, 0, Math.PI * 2)
        ctx.fill()
      }
      // camiseta
      ctx.fillStyle = col
      rr(ctx, p.x - 13, p.y - 40, 26, 30, 9)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillRect(p.x - 13, p.y - 30, 26, 3)
      // brazos: arriba al saltar
      const armY = airborne ? p.y - 48 : p.y - 30
      ctx.fillStyle = SKIN
      ctx.beginPath()
      ctx.arc(p.x - 15, armY, 5, 0, Math.PI * 2)
      ctx.arc(p.x + 15, armY, 5, 0, Math.PI * 2)
      ctx.fill()
      // cabeza grande, gorra del equipo y carita
      if (p.giantT > 0) {
        ctx.strokeStyle = 'rgba(250,204,21,0.6)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(hx, hy, hr + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = SKIN
      ctx.beginPath()
      ctx.arc(hx, hy, hr, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(hx, hy, hr, Math.PI * 1.02, Math.PI * 1.98)
      ctx.closePath()
      ctx.fill()
      // visera de la gorra
      ctx.beginPath()
      ctx.ellipse(hx + look * hr * 0.55, hy - hr * 0.05, hr * 0.5, hr * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(hx, hy, hr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.ellipse(hx - hr * 0.38 + look * 2, hy + hr * 0.12, 3.2, 4.4 * (hr / HR), 0, 0, Math.PI * 2)
      ctx.ellipse(hx + hr * 0.38 + look * 2, hy + hr * 0.12, 3.2, 4.4 * (hr / HR), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(hx - hr * 0.38 + look * 2 + 1, hy - 1, 1.1, 0, Math.PI * 2)
      ctx.arc(hx + hr * 0.38 + look * 2 + 1, hy - 1, 1.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(244,114,182,0.45)'
      ctx.beginPath()
      ctx.arc(hx - hr * 0.62, hy + hr * 0.42, 4, 0, Math.PI * 2)
      ctx.arc(hx + hr * 0.62, hy + hr * 0.42, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#7c2d12'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(hx + look, hy + hr * 0.42, 4, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
      // fuego: su próxima patada
      if (p.fire) {
        const fl = 4 + Math.sin(g.t * 20) * 1.5
        ctx.fillStyle = 'rgba(251,146,60,0.9)'
        ctx.beginPath()
        ctx.arc(p.x + f * 20, p.y - 16, fl, 0, Math.PI * 2)
        ctx.fill()
      }
      // congelado: contorno de hielo
      if (p.frozenT > 0) {
        ctx.strokeStyle = 'rgba(103,232,249,0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(hx, hy, hr + 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(103,232,249,0.25)'
        ctx.fillRect(p.x - 16, p.y - 42, 32, 44)
      }
      ctx.restore()
    }

    const drawBall = () => {
      const b = g.ball
      const height = clamp((GY - BR - b.y) / 220, 0, 1)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(b.x, GY + 1, BR * (1 - height * 0.5), 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
      if (b.hot > 0 && Math.random() < 0.6) {
        juice.burst(b.x, b.y, ['#fb923c', '#fde047'], { count: 2, speed: 40, life: 0.3, size: 4 })
      }
      ctx.save()
      if (b.hot > 0) {
        ctx.shadowColor = '#fb923c'
        ctx.shadowBlur = 16
      }
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ctx.fillStyle = b.hot > 0 ? '#fed7aa' : '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, BR, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = b.hot > 0 ? '#ea580c' : '#1e293b'
      ctx.beginPath()
      ctx.arc(0, 0, BR * 0.36, 0, Math.PI * 2)
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5
        ctx.moveTo(Math.cos(a) * BR * 0.72 + BR * 0.2, Math.sin(a) * BR * 0.72)
        ctx.arc(Math.cos(a) * BR * 0.72, Math.sin(a) * BR * 0.72, BR * 0.2, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.restore()
    }

    /** Poder flotando: icono dentro de un aro de color. Parpadea al final de su vida. */
    const drawOrb = (o: Orb) => {
      if (o.life < 2 && Math.floor(o.life * 8) % 2 === 0) return
      const col = POWER_COLOR[o.kind]
      const x = o.x
      const y = o.y + Math.sin(o.ph * 3) * 4
      ctx.save()
      ctx.shadowColor = col
      ctx.shadowBlur = 18
      ctx.fillStyle = 'rgba(15,23,42,0.85)'
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = col
      ctx.fillStyle = col
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.stroke()
      if (o.kind === 'fuego') {
        ctx.beginPath()
        ctx.moveTo(x, y - 10)
        ctx.quadraticCurveTo(x + 9, y, x + 5, y + 8)
        ctx.quadraticCurveTo(x, y + 4, x - 6, y + 8)
        ctx.quadraticCurveTo(x - 9, y - 2, x, y - 10)
        ctx.fill()
      } else if (o.kind === 'cabeza') {
        ctx.beginPath()
        ctx.arc(x, y - 1, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.arc(x - 2.5, y - 2, 1.1, 0, Math.PI * 2)
        ctx.arc(x + 2.5, y - 2, 1.1, 0, Math.PI * 2)
        ctx.fill()
      } else if (o.kind === 'congela') {
        ctx.beginPath()
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3
          ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8)
          ctx.lineTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8)
        }
        ctx.stroke()
      } else {
        ctx.strokeRect(x - 7, y - 6, 14, 12)
        ctx.beginPath()
        for (let k = -4; k <= 4; k += 4) {
          ctx.moveTo(x + k, y - 6)
          ctx.lineTo(x + k, y + 6)
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    /** Efectos activos de cada jugador, con segundos restantes. */
    const drawBadges = () => {
      ctx.font = `7px ${pf}`
      ctx.textBaseline = 'middle'
      for (const s of [0, 1] as Side[]) {
        const p = g.players[s]
        const items: [string, string][] = []
        if (p.fire) items.push(['FUEGO', POWER_COLOR.fuego])
        if (p.giantT > 0) items.push([`${POWER_LABEL.cabeza} ${Math.ceil(p.giantT)}`, POWER_COLOR.cabeza])
        if (p.frozenT > 0) items.push([`${POWER_LABEL.congela} ${Math.ceil(p.frozenT)}`, POWER_COLOR.congela])
        // la portería pequeña es la propia: aquí se avisa a quien la tomó
        if (g.shrinkT[s] > 0) items.push([`${POWER_LABEL.porteria} ${Math.ceil(g.shrinkT[s])}`, POWER_COLOR.porteria])
        ctx.textAlign = s === 0 ? 'left' : 'right'
        items.forEach(([t, c], i) => {
          ctx.fillStyle = c
          ctx.fillText(t, s === 0 ? GD + 8 : W - GD - 8, 56 + i * 13)
        })
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    /** Pistas al inicio: dónde tocar para moverse, saltar y patear. */
    const drawHints = () => {
      const k = clamp((10 - g.introT) / 2, 0, 1)
      if (k <= 0) return
      ctx.save()
      ctx.globalAlpha = 0.8 * k
      ctx.font = `7px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const sides: Side[] = g.mode === 1 ? [0] : [0, 1]
      for (const s of sides) {
        const cx = g.mode === 1 ? W / 2 : s === 0 ? W * 0.25 : W * 0.75
        ctx.fillStyle = s === 0 ? BLUE : PINK
        ctx.strokeStyle = INK
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText('MANTEN PARA MOVER', cx, 110)
        ctx.fillText('MANTEN PARA MOVER', cx, 110)
        ctx.strokeStyle = INK
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText('DESLIZA: SALTAR', cx, 126)
        ctx.fillText('DESLIZA: SALTAR', cx, 126)
        ctx.strokeStyle = INK
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText('TOCA: PATEAR', cx, 142)
        ctx.fillText('TOCA: PATEAR', cx, 142)
        // flechas junto a su muñeco
        const p = g.players[s]
        ctx.font = `16px ${pf}`
        ctx.globalAlpha = 0.5 * k
        ctx.fillText('<', p.x - 50, p.y - 40)
        ctx.fillText('>', p.x + 50, p.y - 40)
        ctx.font = `7px ${pf}`
        ctx.globalAlpha = 0.8 * k
      }
      ctx.restore()
    }

    const drawCountdown = () => {
      const n = Math.ceil((1.8 - g.phaseT) / 0.6)
      if (n < 1) return
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.font = `36px ${pf}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = INK
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText(String(Math.min(3, n)), W / 2, H * 0.34)
        ctx.fillText(String(Math.min(3, n)), W / 2, H * 0.34)
      ctx.restore()
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      drawField()
      drawGoal(0)
      drawGoal(1)
      for (const o of g.orbs) drawOrb(o)
      drawBall()
      drawPlayer(g.players[0])
      drawPlayer(g.players[1])
      if (inMatch()) drawBadges()
      if (g.phase === 'play' || g.phase === 'kick') drawHints()
      if (g.phase === 'kick') drawCountdown()
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      if (g.paused) {
        ctx.fillStyle = 'rgba(4,8,20,0.72)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ACCENT
        ctx.font = `24px ${pf}`
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `9px ${pf}`
        ctx.fillText('P o toca para seguir', W / 2, H / 2 + 22)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** Los muñecos y la pelota conservan su altura sobre el suelo; la cancha se estira a lo ancho. */
    const relayoutLive = () => {
      const oldW = W
      const oldGY = GY
      layout()
      if (W === oldW && GY === oldGY) return
      setupCanvas(canvas, W, H)
      const sx = W / oldW
      const dy = GY - oldGY
      for (const p of g.players) {
        p.x = clamp(p.x * sx, GD + 16, W - GD - 16)
        p.y += dy
      }
      g.cpuTarget = clamp(g.cpuTarget * sx, GD + 20, W - GD - 20)
      const b = g.ball
      b.x = clamp(b.x * sx, BR, W - BR)
      b.y = clamp(b.y + dy, BR, GY - BR)
      for (const o of g.orbs) {
        o.x *= sx
        o.y = clamp(o.y + dy, 60, GY - 60)
      }
      for (const pt of juice.particles) {
        pt.x *= sx
        pt.y += dy
      }
      for (const t of juice.texts) {
        t.x *= sx
        t.y += dy
      }
      pauseIfPlaying()
    }

    // ---------- bucle ----------
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      if (g.phase === 'over') g.phaseT += dt
      if (!g.paused) {
        g.t += dt
        // cámara lenta tras un gol: la simulación va a 35 %
        const simDt = slowT > 0 ? dt * 0.35 : dt
        slowT = Math.max(0, slowT - dt)
        if (inMatch()) g.introT += dt
        const d = juice.update(simDt)
        if (inMatch() && d > 0) updateMatch(d)
      }
      draw()
    }
    raf = requestAnimationFrame((t) => {
      sync()
      last = t
      frame(t)
    })

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pauseIfPlaying)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const pick = (patch: Partial<{ mode: Mode; diff: Diff }>) => {
    const next = { ...sel, ...patch }
    selRef.current = next
    setSel(next)
  }
  const DIFFS: { id: Diff; label: string }[] = [
    { id: 'facil', label: 'Fácil' },
    { id: 'medio', label: 'Medio' },
    { id: 'dificil', label: 'Difícil' },
  ]
  const mm = Math.floor(ui.time / 60)
  const ss = String(ui.time % 60).padStart(2, '0')
  const hud = (
    <Hud>
      <span style={{ color: BLUE }}>AZUL {ui.goals[0]}</span>
      <span className="text-white/80">{ui.overtime ? 'EXTRA' : `${mm}:${ss}`}</span>
      <span style={{ color: PINK }}>
        {ui.goals[1]} {ui.mode === 1 ? 'CPU' : 'ROSA'}
      </span>
    </Hud>
  )
  const winnerTitle = ui.winner === 0 ? 'GANA AZUL' : 'GANA ROSA'

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W0}
        height={H0}
        className="rounded-xl border border-lime-400/30 bg-[#0b1233]"
        hud={hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Fútbol Cabezón"
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="FUTBOL CABEZON"
            accent={ACCENT}
            subtitle="Cabezazos, patadas y poderes. 90 segundos; si hay empate, muerte súbita."
            hint="Elige modo y pulsa ESPACIO"
            touchHint="Elige modo y toca Jugar"
            onStart={() => startRef.current(sel.mode, sel.diff)}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                {([1, 2] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      pick({ mode: m })
                    }}
                    className="rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95"
                    style={sel.mode === m ? { background: ACCENT, color: '#000' } : { border: `1px solid ${ACCENT}`, color: ACCENT }}
                  >
                    {m === 1 ? '1 jugador' : '2 jugadores'}
                  </button>
                ))}
              </div>
              {sel.mode === 1 && (
                <div className="flex gap-2">
                  {DIFFS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur()
                        pick({ diff: d.id })
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                      style={sel.diff === d.id ? { background: BLUE, color: '#000' } : { border: `1px solid ${BLUE}`, color: BLUE }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="max-w-[18rem] text-[11px] leading-relaxed text-white/60">
              Azul a la izquierda, rosa a la derecha. En el celular cada quien toca su mitad: mantén para moverte,
              desliza arriba para saltar y toca para patear. Teclado: J1 A/D, W, S · J2 ← →, ↑, ↓.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <>
            <GameOverOverlay
              title={ui.winner === null ? 'EMPATE' : ui.mode === 2 ? winnerTitle : ui.winner === 0 ? 'VICTORIA' : 'DERROTA'}
              accent={ui.winner === 1 ? PINK : ui.winner === 0 ? BLUE : ACCENT}
              score={ui.mode === 1 ? ui.goals[0] : ui.goals[0] + ui.goals[1]}
              best={0}
              ranked={false}
              stats={[
                { label: 'Marcador', value: `${ui.goals[0]} - ${ui.goals[1]}` },
                { label: 'Poderes', value: ui.taken[0] + ui.taken[1] },
                ...(ui.overtime ? [{ label: 'Final', value: 'Muerte súbita' }] : []),
              ]}
              onRestart={() => startRef.current(ui.mode, ui.diff)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                menuRef.current()
              }}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs text-white/70 transition active:scale-95"
            >
              Cambiar modo
            </button>
          </>
        )}
      </GameScreen>
    </div>
  )
}
