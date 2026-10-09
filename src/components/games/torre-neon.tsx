'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, tone } from './sfx'

const GAME_ID = 'torre-neon'
const ACCENT = '#f472b6'

const W0 = 360
const H0 = 560
// Mundo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0

// Geometría del mundo (unidades) y proyección isométrica
const BASE = 100 // tamaño inicial del bloque
const BH = 16 // altura de cada bloque
const RANGE = 118 // recorrido del bloque a cada lado del centro de la torre
const TOL = 5 // tolerancia de "encaje perfecto"
const S = 0.88 // escala unidades -> px
const KX = 0.866 * S
const KY = 0.5 * S
const KZ = S
let ANCHOR_Y = Math.round(H0 * 0.553) // y en pantalla de la cara superior de la torre

/** Ajusta el mundo lógico al área de la pantalla; la torre se mantiene a la misma altura relativa. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  ANCHOR_Y = Math.round(H * 0.553)
  publishLogical(f)
}

type Phase = 'menu' | 'playing' | 'dead' | 'over'
type Axis = 'x' | 'z'

interface Tint {
  top: string
  left: string
  right: string
  edge: string
  glow: string
}
interface Block extends Tint {
  x: number
  z: number
  w: number
  d: number
  flash: number
}
interface Cur {
  axis: Axis
  pos: number
  dir: 1 | -1
  w: number
  d: number
  tint: Tint
}
interface Piece extends Tint {
  x: number
  y: number
  z: number
  w: number
  d: number
  vy: number
  vx: number
  vz: number
  rot: number
  vr: number
}
interface Ring {
  x: number
  y: number
  z: number
  w: number
  d: number
  t: number
  delay: number
  big: boolean
}
interface Game {
  phase: Phase
  paused: boolean
  t: number
  blocks: Block[]
  cur: Cur
  pieces: Piece[]
  rings: Ring[]
  score: number
  combo: number
  bestCombo: number
  perfects: number
  camY: number
  zoom: number
  anchor: number
  zoomTarget: number
  anchorTarget: number
  camTarget: number
  bgHue: number
  deadT: number
  overT: number
  banner: { text: string; t: number } | null
}
interface Result {
  score: number
  levels: number
  perfects: number
  bestCombo: number
  newBest: boolean
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const norm = (h: number) => Math.round(((h % 360) + 360) % 360)
const hueFor = (level: number) => 330 - level * 5

function tintFor(level: number): Tint {
  const h = norm(hueFor(level))
  return {
    top: `hsl(${h} 95% 68%)`,
    left: `hsl(${h} 85% 52%)`,
    right: `hsl(${h} 85% 36%)`,
    edge: `hsl(${h} 100% 84%)`,
    glow: `hsl(${h} 100% 62%)`,
  }
}

// Escala pentatónica para el tono de los perfectos encadenados
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]
const sPerfect = (combo: number) => {
  const semi = LADDER[Math.min(combo - 1, LADDER.length - 1)]
  const f = 330 * Math.pow(2, semi / 12)
  tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.06 })
  tone({ freq: f * 2, dur: 0.22, type: 'sine', vol: 0.04, delay: 0.05 })
  tone({ freq: f * 3, dur: 0.14, type: 'sine', vol: 0.02, delay: 0.1 })
}
const sPlace = () => {
  tone({ freq: 190, to: 110, dur: 0.1, type: 'triangle', vol: 0.06 })
  noise({ dur: 0.05, vol: 0.03, freq: 700 })
}
const sCut = () => noise({ dur: 0.18, vol: 0.05, freq: 1400 })
const sFail = () => {
  tone({ freq: 330, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.06 })
  noise({ dur: 0.4, vol: 0.09, freq: 800 })
}
const sMilestone = () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.09, vol: 0.04, delay: i * 0.07, type: 'square' }))
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })
const sStart = () => [392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.04, delay: i * 0.06, type: 'square' }))

function makeBlock(x: number, z: number, w: number, d: number, level: number): Block {
  return { x, z, w, d, flash: 0, ...tintFor(level) }
}

function newGame(): Game {
  const base = makeBlock(0, 0, BASE, BASE, 0)
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    blocks: [base],
    cur: { axis: 'x', pos: -RANGE, dir: 1, w: BASE, d: BASE, tint: tintFor(1) },
    pieces: [],
    rings: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    camY: BH,
    zoom: 1,
    anchor: ANCHOR_Y,
    zoomTarget: 1,
    anchorTarget: ANCHOR_Y,
    camTarget: BH,
    bgHue: 330,
    deadT: 0,
    overT: 0,
    banner: null,
  }
}

export default function TorreNeon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<Phase>('menu')
  const [score, setScore] = useState(0)
  const [levels, setLevels] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, levels: 0, perfects: 0, bestCombo: 0, newBest: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(7)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    // Las motas de fondo dependen del tamaño: se vuelven a generar al reacomodar.
    const makeDots = () =>
      Array.from({ length: 46 }, (_, i) => {
        const r = (n: number) => {
          const s = Math.sin(n * 91.7 + 13.3) * 43758.5453
          return s - Math.floor(s)
        }
        return { x: r(i * 3 + 1) * W, y: r(i * 3 + 2) * H, s: 1 + r(i * 3 + 3) * 2, k: 0.05 + r(i * 7 + 5) * 0.25 }
      })
    let dots = makeDots()

    let pointerDrop = false

    const levelCount = () => g.blocks.length - 1
    const topBlock = () => g.blocks[g.blocks.length - 1]
    const speedFor = (n: number) => Math.min(262, 118 + n * 3.0)

    const spawnCur = () => {
      const top = topBlock()
      const n = g.blocks.length
      const axis: Axis = n % 2 === 1 ? 'x' : 'z'
      const fromStart = n % 4 < 2
      g.cur = {
        axis,
        pos: fromStart ? -RANGE : RANGE,
        dir: fromStart ? 1 : -1,
        w: top.w,
        d: top.d,
        tint: tintFor(n),
      }
    }

    const curWorld = () => {
      const top = topBlock()
      return g.cur.axis === 'x' ? { x: top.x + g.cur.pos, z: top.z } : { x: top.x, z: top.z + g.cur.pos }
    }

    // ---------- proyección ----------
    const sxOf = (x: number, z: number) => W / 2 + (x - z) * KX * g.zoom
    const syOf = (x: number, y: number, z: number) => g.anchor + ((x + z) * KY - (y - g.camY) * KZ) * g.zoom

    const poly = (pts: number[], fill: string) => {
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
    }

    const drawBox = (
      x: number,
      y0: number,
      z: number,
      w: number,
      d: number,
      h: number,
      t: Tint,
      o: { flash?: number; glow?: boolean; alpha?: number; soft?: boolean } = {},
    ) => {
      const x0 = x - w / 2
      const x1 = x + w / 2
      const z0 = z - d / 2
      const z1 = z + d / 2
      const yt = y0 + h
      const tTx = sxOf(x0, z0)
      const tTy = syOf(x0, yt, z0)
      const tRx = sxOf(x1, z0)
      const tRy = syOf(x1, yt, z0)
      const tBx = sxOf(x1, z1)
      const tBy = syOf(x1, yt, z1)
      const tLx = sxOf(x0, z1)
      const tLy = syOf(x0, yt, z1)
      const dy = h * KZ * g.zoom
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
      // cara izquierda (z = z1) y derecha (x = x1)
      poly([tLx, tLy, tBx, tBy, tBx, tBy + dy, tLx, tLy + dy], t.left)
      poly([tBx, tBy, tRx, tRy, tRx, tRy + dy, tBx, tBy + dy], t.right)
      if (o.glow) {
        ctx.shadowColor = t.glow
        ctx.shadowBlur = 16
      }
      poly([tTx, tTy, tRx, tRy, tBx, tBy, tLx, tLy], t.top)
      ctx.shadowBlur = 0
      if (o.flash && o.flash > 0) {
        ctx.globalAlpha = (o.alpha ?? 1) * clamp(o.flash, 0, 1) * 0.75
        poly([tTx, tTy, tRx, tRy, tBx, tBy, tLx, tLy], '#ffffff')
        ctx.globalAlpha = o.alpha ?? 1
      }
      // aristas de neón
      ctx.strokeStyle = t.edge
      ctx.globalAlpha = o.soft ? 0.5 : (o.alpha ?? 1)
      ctx.lineWidth = o.soft ? 1 : 1.2
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(tLx, tLy)
      ctx.lineTo(tTx, tTy)
      ctx.lineTo(tRx, tRy)
      ctx.lineTo(tBx, tBy)
      ctx.closePath()
      ctx.moveTo(tBx, tBy)
      ctx.lineTo(tBx, tBy + dy)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // ---------- lógica ----------
    const startGame = () => {
      Object.assign(g, newGame())
      g.phase = 'playing'
      g.camY = BH
      juice.reset()
      pointerDrop = false
      setScore(0)
      setLevels(0)
      setUi('playing')
      sStart()
    }
    startRef.current = startGame

    const finish = () => {
      g.phase = 'dead'
      g.deadT = 0
      const lv = levelCount()
      // zoom out para ver la torre entera
      const topY = g.blocks.length * BH
      const need = (topY + 40) * KZ + 190 * KY * 2
      g.zoomTarget = clamp(430 / need, 0.14, 1)
      g.camTarget = topY / 2
      g.anchorTarget = ANCHOR_Y - 10
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, levels: lv, perfects: g.perfects, bestCombo: g.bestCombo, newBest: nb })
    }

    const drop = () => {
      const top = topBlock()
      const cur = g.cur
      const w = cur.w
      const d = cur.d
      const size = cur.axis === 'x' ? w : d
      const delta = cur.pos
      const over = size - Math.abs(delta)
      const wc = curWorld()
      const level = g.blocks.length
      const y0 = level * BH
      if (over <= 0.6) {
        // fallo total: cae el bloque entero
        g.pieces.push({
          ...cur.tint,
          x: wc.x,
          y: y0,
          z: wc.z,
          w,
          d,
          vy: 0,
          vx: cur.axis === 'x' ? Math.sign(delta || 1) * 40 : 0,
          vz: cur.axis === 'z' ? Math.sign(delta || 1) * 40 : 0,
          rot: 0,
          vr: Math.sign(delta || 1) * 2.4,
        })
        juice.shake(0.7)
        juice.flash('#ffffff', 0.35)
        juice.freeze(70)
        sFail()
        finish()
        return
      }
      let nb: Block
      if (Math.abs(delta) <= TOL) {
        // encaje perfecto
        g.combo++
        g.perfects++
        g.bestCombo = Math.max(g.bestCombo, g.combo)
        let nw = w
        let nd = d
        if (g.combo >= 3) {
          nw = Math.min(BASE, w + 2.5)
          nd = Math.min(BASE, d + 2.5)
        }
        nb = makeBlock(top.x, top.z, nw, nd, level)
        nb.flash = 1
        const pts = Math.min(g.combo + 1, 6)
        g.score += pts
        sPerfect(g.combo)
        const cx = sxOf(nb.x, nb.z)
        const cy = syOf(nb.x, y0 + BH, nb.z)
        g.rings.push({ x: nb.x, y: y0 + BH, z: nb.z, w: nb.w, d: nb.d, t: 0, delay: 0, big: g.combo >= 3 })
        if (g.combo >= 2) g.rings.push({ x: nb.x, y: y0 + BH, z: nb.z, w: nb.w, d: nb.d, t: 0, delay: 0.12, big: true })
        juice.burst(cx, cy, ['#ffffff', nb.edge, nb.glow], { count: 14 + g.combo * 2, speed: 150, life: 0.55, size: 3, drag: 2.5 })
        juice.burst(cx, cy, ['#ffffff', nb.edge], { count: 8, speed: 120, angle: -Math.PI / 2, arc: 2.2, life: 0.7, size: 3, gravity: 120 })
        juice.text(cx, cy - 34, g.combo >= 2 ? `PERFECTO x${g.combo}` : 'PERFECTO', '#ffffff', g.combo >= 2 ? 12 : 11, 0.95)
        juice.shake(0.18 + Math.min(g.combo, 6) * 0.03)
        juice.freeze(35)
        juice.flash(nb.glow, 0.1 + Math.min(g.combo, 6) * 0.02)
      } else {
        g.combo = 0
        const sign = Math.sign(delta)
        let nx = top.x
        let nz = top.z
        let nw = w
        let nd = d
        const pieceCommon = { ...cur.tint, y: y0, vy: 0, vr: sign * (2 + Math.random() * 1.5), rot: 0 }
        if (cur.axis === 'x') {
          nw = over
          nx = top.x + delta / 2
          const cutW = Math.abs(delta)
          const cutX = (top.x + wc.x) / 2 + (sign * w) / 2
          g.pieces.push({ ...pieceCommon, x: cutX, z: wc.z, w: cutW, d, vx: sign * 36, vz: 0 })
        } else {
          nd = over
          nz = top.z + delta / 2
          const cutD = Math.abs(delta)
          const cutZ = (top.z + wc.z) / 2 + (sign * d) / 2
          g.pieces.push({ ...pieceCommon, x: wc.x, z: cutZ, w, d: cutD, vx: 0, vz: sign * 36 })
        }
        nb = makeBlock(nx, nz, nw, nd, level)
        g.score += 1
        sPlace()
        sCut()
        const cx = sxOf(nb.x, nb.z)
        const cy = syOf(nb.x, y0 + BH, nb.z)
        juice.burst(cx, cy, [cur.tint.top, cur.tint.edge], { count: 7, speed: 80, life: 0.35, size: 3, gravity: 200 })
        juice.shake(0.12)
      }
      g.blocks.push(nb)
      setScore(g.score)
      setLevels(levelCount())
      const lv = levelCount()
      if (lv > 0 && lv % 10 === 0) {
        g.banner = { text: `ALTURA ${lv}`, t: 1.6 }
        sMilestone()
      }
      g.camTarget = g.blocks.length * BH
      spawnCur()
    }

    const togglePause = () => {
      if (g.phase !== 'playing') return
      g.paused = !g.paused
      sPause()
    }
    const onBlur = () => {
      if (g.phase === 'playing') g.paused = true
    }
    const onVis = () => {
      if (document.hidden) onBlur()
    }
    const onPointer = (e: PointerEvent) => {
      e.preventDefault()
      pointerDrop = true
    }
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    const moveCur = (dt: number, speed: number) => {
      const c = g.cur
      c.pos += c.dir * speed * dt
      if (c.pos > RANGE) {
        c.pos = RANGE - (c.pos - RANGE)
        c.dir = -1
      } else if (c.pos < -RANGE) {
        c.pos = -RANGE + (-RANGE - c.pos)
        c.dir = 1
      }
    }

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const want = jp.has('action') || jp.has('up') || jp.has('left') || pointerDrop
      const wantPause = jp.has('pause')
      pointerDrop = false
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (g.phase === 'playing' && wantPause) togglePause()
      if (g.paused) {
        if (want) {
          g.paused = false
          sPause()
        }
        return
      }

      // cámara suave
      const k = Math.min(1, rawDt * (g.phase === 'dead' || g.phase === 'over' ? 3 : 6))
      g.camY += (g.camTarget - g.camY) * k
      g.zoom += (g.zoomTarget - g.zoom) * Math.min(1, rawDt * 3)
      g.anchor += (g.anchorTarget - g.anchor) * Math.min(1, rawDt * 3)
      const hueTarget = hueFor(g.blocks.length)
      g.bgHue += (hueTarget - g.bgHue) * Math.min(1, rawDt * 1.5)
      for (const b of g.blocks) if (b.flash > 0) b.flash = Math.max(0, b.flash - rawDt * 2.2)
      for (const r of g.rings) {
        if (r.delay > 0) r.delay -= rawDt
        else r.t += rawDt / 0.75
      }
      g.rings = g.rings.filter((r) => r.t < 1)
      if (g.banner) {
        g.banner.t -= rawDt
        if (g.banner.t <= 0) g.banner = null
      }

      // piezas que caen
      for (const p of g.pieces) {
        p.vy -= 950 * rawDt
        p.y += p.vy * rawDt
        p.x += p.vx * rawDt
        p.z += p.vz * rawDt
        p.rot += p.vr * rawDt
      }
      g.pieces = g.pieces.filter((p) => p.y > g.camY - 1100)

      if (g.phase === 'menu') {
        if (want) {
          startGame()
          return
        }
        moveCur(dt, 120)
        return
      }

      if (g.phase === 'dead') {
        g.deadT += rawDt
        if (g.deadT > 0.7 && want) {
          startGame()
          return
        }
        if (g.deadT > 1.9) {
          g.phase = 'over'
          g.overT = 0
          setUi('over')
        }
        return
      }
      if (g.phase === 'over') {
        g.overT += rawDt
        if (want && g.overT > 0.3) startGame()
        return
      }

      // ---- jugando ----
      if (dt === 0) return
      moveCur(dt, speedFor(levelCount()))
      if (want) drop()
    }

    // ---------- dibujo ----------
    const drawGrid = () => {
      const gy = -BH
      const y0 = syOf(0, gy, 0)
      if (y0 < -400 || y0 > H + 600) return
      ctx.lineWidth = 1
      const hue = norm(g.bgHue)
      ctx.strokeStyle = `hsla(${hue} 90% 62% / 0.2)`
      ctx.beginPath()
      const R = 360
      for (let k = -R; k <= R; k += 40) {
        ctx.moveTo(sxOf(-R, k), syOf(-R, gy, k))
        ctx.lineTo(sxOf(R, k), syOf(R, gy, k))
        ctx.moveTo(sxOf(k, -R), syOf(k, gy, -R))
        ctx.lineTo(sxOf(k, R), syOf(k, gy, R))
      }
      ctx.stroke()
      // pedestal
      drawBox(0, gy, 0, BASE * 1.7, BASE * 1.7, BH, {
        top: `hsl(${hue} 40% 16%)`,
        left: `hsl(${hue} 45% 12%)`,
        right: `hsl(${hue} 45% 8%)`,
        edge: `hsl(${hue} 90% 62%)`,
        glow: `hsl(${hue} 90% 50%)`,
      })
    }

    const drawRing = (r: Ring) => {
      if (r.delay > 0) return
      const e = 1 - Math.pow(1 - r.t, 2)
      const sc = 1 + e * (r.big ? 1.1 : 0.7)
      const x0 = r.x - (r.w / 2) * sc
      const x1 = r.x + (r.w / 2) * sc
      const z0 = r.z - (r.d / 2) * sc
      const z1 = r.z + (r.d / 2) * sc
      ctx.globalAlpha = Math.pow(1 - r.t, 1.4)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(sxOf(x0, z0), syOf(x0, r.y, z0))
      ctx.lineTo(sxOf(x1, z0), syOf(x1, r.y, z0))
      ctx.lineTo(sxOf(x1, z1), syOf(x1, r.y, z1))
      ctx.lineTo(sxOf(x0, z1), syOf(x0, r.y, z1))
      ctx.closePath()
      ctx.strokeStyle = `hsl(${norm(g.bgHue)} 100% 70%)`
      ctx.lineWidth = 6 * (1 - r.t) + 1
      ctx.globalAlpha *= 0.45
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5 * (1 - r.t) + 0.5
      ctx.globalAlpha = Math.pow(1 - r.t, 1.4)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const draw = () => {
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      const hue = norm(g.bgHue)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, `hsl(${hue} 55% 6%)`)
      bg.addColorStop(1, `hsl(${norm(g.bgHue + 28)} 60% 15%)`)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      // resplandor detrás de la torre
      const rg = ctx.createRadialGradient(W / 2, g.anchor, 10, W / 2, g.anchor, 260)
      rg.addColorStop(0, `hsla(${hue} 95% 60% / 0.22)`)
      rg.addColorStop(1, `hsla(${hue} 95% 60% / 0)`)
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
      // puntitos con parallax
      ctx.fillStyle = `hsl(${norm(g.bgHue + 20)} 100% 85%)`
      for (const d of dots) {
        const y = (((d.y + g.camY * d.k * g.zoom) % H) + H) % H
        ctx.globalAlpha = 0.25 + 0.35 * Math.sin(g.t * 1.5 + d.x)
        ctx.fillRect(d.x, y, d.s, d.s)
      }
      ctx.globalAlpha = 1

      juice.applyShake(ctx)

      drawGrid()

      // torre (solo bloques visibles)
      for (let i = 0; i < g.blocks.length; i++) {
        const b = g.blocks[i]
        const sy = syOf(b.x, i * BH, b.z)
        if (sy < -60 || sy > H + 90) continue
        drawBox(b.x, i * BH, b.z, b.w, b.d, BH, b, { flash: b.flash, soft: i < g.blocks.length - 2 })
      }

      // anillos de onda expansiva
      for (const r of g.rings) drawRing(r)

      // piezas cortadas
      for (const p of g.pieces) {
        const cx = sxOf(p.x, p.z)
        const cy = syOf(p.x, p.y + BH / 2, p.z)
        if (cy > H + 200) continue
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(p.rot)
        ctx.translate(-cx, -cy)
        drawBox(p.x, p.y, p.z, p.w, p.d, BH, p, { alpha: clamp(1 - (cy - H * 0.7) / 200, 0.15, 1) })
        ctx.restore()
      }
      ctx.globalAlpha = 1

      // bloque en movimiento
      if (g.phase === 'menu' || g.phase === 'playing') {
        const wc = curWorld()
        drawBox(wc.x, g.blocks.length * BH, wc.z, g.cur.w, g.cur.d, BH, g.cur.tint, { glow: true })
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      // marcador y avisos
      if (g.phase === 'playing' || g.phase === 'dead') {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `26px ${pf}`
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#12081a'
        ctx.strokeText(String(g.score), W / 2, 56)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(g.score), W / 2, 56)
        if (g.combo >= 2 && g.phase === 'playing') {
          ctx.font = `10px ${pf}`
          ctx.fillStyle = ACCENT
          const pulse = 1 + Math.sin(g.t * 10) * 0.06
          ctx.save()
          ctx.translate(W / 2, 90)
          ctx.scale(pulse, pulse)
          ctx.strokeText(`COMBO x${g.combo}`, 0, 0)
          ctx.fillText(`COMBO x${g.combo}`, 0, 0)
          ctx.restore()
        }
        if (g.banner) {
          ctx.globalAlpha = clamp(g.banner.t * 2, 0, 1)
          ctx.font = `13px ${pf}`
          ctx.fillStyle = '#fde68a'
          ctx.strokeText(g.banner.text, W / 2, 128)
          ctx.fillText(g.banner.text, W / 2, 128)
          ctx.globalAlpha = 1
        }
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()
      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(10,4,16,0.66)'
        ctx.fillRect(0, 0, W, H)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `24px ${pf}`
        ctx.fillStyle = ACCENT
        ctx.fillText('PAUSA', W / 2, H / 2 - 12)
        ctx.font = `9px ${pf}`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillText('Toca o pulsa P para seguir', W / 2, H / 2 + 24)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    // ---------- reacomodo al girar la pantalla durante la partida ----------
    /** La torre se centra sola en el ancho (sxOf); aquí se corre la altura del ancla y los efectos sueltos. */
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      const oldAnchor = ANCHOR_Y
      layout()
      if (W === oldW && H === oldH) return
      const dx = (W - oldW) / 2
      const dA = ANCHOR_Y - oldAnchor
      setupCanvas(canvas, W, H)
      dots = makeDots()
      g.anchor += dA
      g.anchorTarget += dA
      for (const pt of juice.particles) {
        pt.x += dx
        pt.y += dA
      }
      for (const t of juice.texts) {
        t.x += dx
        t.y += dA
      }
      if (g.phase === 'playing') g.paused = true
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const loop = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05)
      last = now
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.phase === 'menu' || g.phase === 'over') requestRemount()
        else relayoutLive()
      }
      update(dt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#f472b6]/40 bg-[#12081a] shadow-[0_0_30px_rgba(244,114,182,0.2)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>ALTURA {levels}</span>
            <span className="text-white/60">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Torre Neón"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="TORRE NEON"
            accent={ACCENT}
            subtitle="Suelta cada bloque justo encima del anterior. Lo que sobresale se corta. Los encajes perfectos encadenados hacen crecer el bloque."
            hint="Pulsa ESPACIO para soltar bloques"
            touchHint="Toca la pantalla para soltar"
            onStart={() => startRef.current()}
          />
        )}
        {ui === 'over' && (
          <GameOverOverlay
            title="TORRE CAIDA"
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Altura', value: result.levels },
              { label: 'Perfectos', value: result.perfects },
              { label: 'Mejor combo', value: `x${result.bestCombo}` },
            ]}
            onRestart={() => startRef.current()}
          />
        )}
      </GameScreen>
    </div>
  )
}
