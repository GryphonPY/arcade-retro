'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { noise, sfx, tone } from './sfx'
import {
  CRITTER_H,
  HOLE_W,
  drawBackground,
  drawCritter,
  drawDizzy,
  drawHoleBack,
  drawHoleFront,
  drawImpact,
  drawMallet,
  drawTimerBar,
  type CritterKind,
  type CritterState,
} from './topo-loco/art'

const GAME_ID = 'topo-loco'
const ACCENT = '#a3e635'

const W0 = 360
const H0 = 560
const ROUND = 45 // segundos por partida
const RISE_T = 0.18 // tiempo para salir del hoyo
const HIDE_T = 0.18 // tiempo para esconderse
const HIT_T = 0.45 // tiempo que se queda aplastado tras un golpe
const MENU_HOLE = 4 // hoyo central: aquí se mece el topo del menú
// Columnas del 3x3 como fracción del ancho
const COL_FRAC = [0.2, 0.5, 0.8]

// Mundo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0
let TOP = 150
let HS = 1
interface Pt {
  x: number
  y: number
}
let HOLES: Pt[] = []

/** Ajusta el mundo lógico, el pasto y los 9 hoyos (3x3) al tamaño de la pantalla. */
function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  TOP = Math.max(150, H * 0.3)
  const y0 = TOP + 70
  const y1 = H - 60
  const rowGap = (y1 - y0) / 2
  HS = Math.max(0.8, Math.min(1, W / W0) * Math.min(1, rowGap / 150))
  HOLES = []
  for (let r = 0; r < 3; r++) for (const fx of COL_FRAC) HOLES.push({ x: W * fx, y: y0 + r * rowGap })
  publishLogical(f)
}

// Teclas que corresponden a cada hoyo (filas de arriba a abajo, de izquierda a derecha)
const HOLE_KEYS: Partial<Record<string, number>> = {
  KeyQ: 0,
  KeyW: 1,
  KeyE: 2,
  KeyA: 3,
  KeyS: 4,
  KeyD: 5,
  KeyZ: 6,
  KeyX: 7,
  KeyC: 8,
  Numpad7: 0,
  Numpad8: 1,
  Numpad9: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad1: 6,
  Numpad2: 7,
  Numpad3: 8,
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type Phase = 'menu' | 'playing' | 'ending' | 'over'
type Stage = 'rise' | 'up' | 'hit' | 'hide'

interface Critter {
  kind: CritterKind
  hole: number
  stage: Stage
  /** Tiempo dentro de la etapa actual. */
  t: number
  /** Cuánto tiempo se queda asomado. */
  stay: number
  /** 0..1: cuánto ha salido del hoyo. */
  rise: number
  hideFrom: number
  hitT: number
  afterHit: 'hide' | 'up'
  dizzy: boolean
}
interface Impact {
  x: number
  y: number
  t: number
  color: string
}
interface Game {
  phase: Phase
  paused: boolean
  t: number
  timeLeft: number
  lastSec: number
  endT: number
  overT: number
  score: number
  hits: number
  streak: number
  bestStreak: number
  saved: number
  spawnCd: number
  critters: Critter[]
  impacts: Impact[]
  mallet: { x: number; y: number; t: number } | null
}

function newGame(): Game {
  return {
    phase: 'menu',
    paused: false,
    t: 0,
    timeLeft: ROUND,
    lastSec: ROUND,
    endT: 0,
    overT: 0,
    score: 0,
    hits: 0,
    streak: 0,
    bestStreak: 0,
    saved: 0,
    spawnCd: 0.6,
    critters: [],
    impacts: [],
    mallet: null,
  }
}

// ---------- sonidos locales ----------
const sBonk = () => {
  tone({ freq: 600, to: 200, dur: 0.12, type: 'square', vol: 0.05 })
  noise({ dur: 0.08, vol: 0.07, freq: 900 })
}
const sClank = () => {
  tone({ freq: 1400, to: 900, dur: 0.18, type: 'square', vol: 0.05 })
  tone({ freq: 2100, dur: 0.22, type: 'triangle', vol: 0.03, delay: 0.02 })
  noise({ dur: 0.05, vol: 0.04, freq: 4000 })
}
const sGold = () => [988, 1319, 1568, 1976].forEach((f, i) => tone({ freq: f, dur: 0.09, vol: 0.045, delay: i * 0.05, type: 'triangle' }))
const sWhoosh = () => noise({ dur: 0.15, vol: 0.04, freq: 600 })
const sMiau = () => {
  tone({ freq: 700, to: 500, dur: 0.22, type: 'triangle', vol: 0.05 })
  tone({ freq: 520, to: 330, dur: 0.3, type: 'triangle', vol: 0.05, delay: 0.22 })
}
const sTick = () => tone({ freq: 880, dur: 0.05, vol: 0.04, type: 'square' })
const sRacha = () => [784, 988, 1175].forEach((f, i) => tone({ freq: f, dur: 0.08, vol: 0.04, delay: i * 0.06 }))
const sTimeUp = () => tone({ freq: 880, to: 330, dur: 0.5, type: 'triangle', vol: 0.06 })
const sPause = () => tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })

interface Result {
  score: number
  newBest: boolean
  hits: number
  streak: number
  saved: number
}

export default function TopoLoco() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef } = useKeys()
  const startRef = useRef<() => void>(() => {})
  const [ui, setUi] = useState<'menu' | 'playing' | 'over'>('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [result, setResult] = useState<Result>({ score: 0, newBest: false, hits: 0, streak: 0, saved: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(8)
    const g = newGame()
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    // Entradas pendientes; se procesan en el siguiente frame de juego
    const taps: Pt[] = []
    const holeKeys: number[] = []

    const addScore = (n: number) => {
      g.score += n
      setScore(g.score)
    }

    const headOf = (c: Critter): Pt => {
      const h = HOLES[c.hole]
      return { x: h.x, y: h.y - CRITTER_H * HS * 0.7 * c.rise }
    }

    // ---------- lógica ----------
    const rollKind = (elapsed: number): CritterKind => {
      const r = Math.random()
      if (r < 0.7) return 'topo'
      if (r < 0.82) return elapsed >= 10 ? 'casco' : 'topo'
      if (r < 0.88) return 'dorado'
      return 'gatito'
    }

    const spawn = () => {
      const elapsed = ROUND - g.timeLeft
      const p = clamp(elapsed / ROUND, 0, 1)
      const used = new Set(g.critters.map((c) => c.hole))
      const free = Array.from({ length: HOLES.length }, (_, i) => i).filter((i) => !used.has(i))
      if (free.length === 0) return
      const hole = free[Math.floor(Math.random() * free.length)]
      const kind = rollKind(elapsed)
      const stay = lerp(1.3, 0.75, p) * (kind === 'dorado' ? 0.7 : 1)
      g.critters.push({
        kind,
        hole,
        stage: 'rise',
        t: 0,
        stay,
        rise: 0,
        hideFrom: 0,
        hitT: HIT_T,
        afterHit: 'hide',
        dizzy: false,
      })
    }

    /** Avanza un bicho. Devuelve false cuando ya se escondió del todo. */
    const stepCritter = (c: Critter, dt: number): boolean => {
      c.t += dt
      switch (c.stage) {
        case 'rise': {
          const p = Math.min(1, c.t / RISE_T)
          c.rise = 1 - (1 - p) ** 3
          if (p >= 1) {
            c.stage = 'up'
            c.t = 0
            c.rise = 1
          }
          break
        }
        case 'up':
          if (c.t >= c.stay) {
            // se escapó sin golpe: si era el gatito, cuenta como salvado
            if (c.kind === 'gatito') g.saved++
            c.stage = 'hide'
            c.t = 0
            c.hideFrom = c.rise
          }
          break
        case 'hit':
          if (c.t >= c.hitT) {
            if (c.afterHit === 'up') {
              // casco recién roto: se queda un poco más
              c.stage = 'up'
              c.t = 0
              c.stay = 1.2
              c.rise = 1
            } else {
              c.stage = 'hide'
              c.t = 0
              c.hideFrom = c.rise
            }
          }
          break
        case 'hide': {
          const p = Math.min(1, c.t / HIDE_T)
          c.rise = c.hideFrom * (1 - p)
          if (p >= 1) return false
          break
        }
      }
      return true
    }

    const stepCritters = (dt: number) => {
      g.critters = g.critters.filter((c) => stepCritter(c, dt))
    }

    const stateOf = (c: Critter): CritterState => {
      if (c.stage === 'hit') return 'hit'
      if (c.stage === 'up' && c.stay - c.t < 0.3) return 'tease'
      return 'up'
    }

    const canHit = (c: Critter) => (c.stage === 'rise' || c.stage === 'up') && c.rise > 0.35

    const hitCritter = (c: Critter) => {
      const h = HOLES[c.hole]
      const hd = headOf(c)

      if (c.kind === 'gatito') {
        // ¡no al gatito!
        c.stage = 'hit'
        c.t = 0
        c.hitT = HIT_T
        c.afterHit = 'hide'
        c.dizzy = false
        g.timeLeft = Math.max(0, g.timeLeft - 3)
        g.streak = 0
        sMiau()
        juice.flash('#ef4444', 0.35)
        juice.shake(0.25)
        juice.text(h.x, hd.y - 12, '-3s', '#ef4444', 16, 1)
        juice.burst(hd.x, hd.y, ['#ef4444', '#fca5a5'], { count: 10, speed: 120, life: 0.5, size: 4, gravity: 200 })
        g.impacts.push({ x: hd.x, y: hd.y, t: 0, color: '#ef4444' })
        return
      }

      if (c.kind === 'casco') {
        // primer golpe al casco: suena a metal y se rompe, sin puntos todavía
        c.kind = 'casco-roto'
        c.stage = 'hit'
        c.t = 0
        c.hitT = 0.3
        c.afterHit = 'up'
        c.dizzy = false
        sClank()
        juice.shake(0.2)
        juice.burst(hd.x, hd.y, ['#e2e8f0', '#94a3b8'], { count: 8, speed: 110, life: 0.4, size: 3, gravity: 300 })
        g.impacts.push({ x: hd.x, y: hd.y, t: 0, color: '#e2e8f0' })
        return
      }

      // topo, casco roto (segundo golpe) o dorado
      c.stage = 'hit'
      c.t = 0
      c.hitT = HIT_T
      c.afterHit = 'hide'
      c.dizzy = true
      g.hits++
      g.streak++
      g.bestStreak = Math.max(g.bestStreak, g.streak)
      const dorado = c.kind === 'dorado'
      const pts = dorado ? 5 : c.kind === 'casco-roto' ? 3 : 1
      if (dorado) {
        g.timeLeft += 3
        sGold()
        juice.text(hd.x, hd.y - 34, '+3s', '#fde047', 14, 0.9)
        juice.burst(hd.x, hd.y, ['#fde047', '#fff7ae', '#ffffff'], { count: 18, speed: 170, life: 0.6, size: 4, gravity: 250 })
      } else {
        sBonk()
        juice.burst(hd.x, hd.y, ['#8b5a2b', '#c4834d', '#fde68a'], { count: 12, speed: 150, life: 0.5, size: 4, gravity: 400 })
      }
      addScore(pts)
      juice.text(hd.x, hd.y - 12, `+${pts}`, dorado ? '#fde047' : '#ffffff', 16, 0.8)
      g.impacts.push({ x: hd.x, y: hd.y, t: 0, color: '#ffffff' })
      juice.shake(0.2)
      if (g.streak % 5 === 0) {
        addScore(2)
        juice.text(W / 2, TOP - 40, `¡RACHA x${g.streak}!`, '#fde047', 14, 1.2)
        sRacha()
      }
    }

    /** Golpe con el mazo en (px, py): si hay un bicho asomado ahí, le pega; si no, falla. */
    const swingAt = (px: number, py: number) => {
      g.mallet = { x: px, y: py, t: 0 }
      let best: Critter | null = null
      let bestD = Infinity
      for (const c of g.critters) {
        if (!canHit(c)) continue
        const h = HOLES[c.hole]
        const top = h.y - CRITTER_H * HS * c.rise - 10
        const bottom = h.y + 14 * HS
        if (Math.abs(px - h.x) > HOLE_W * HS * 0.45 || py < top || py > bottom) continue
        const d = Math.hypot(px - h.x, py - (h.y - (CRITTER_H * HS * c.rise) / 2))
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      if (best) {
        hitCritter(best)
        return
      }
      // golpe al aire: si cae sobre un hoyo, se rompe la racha
      sWhoosh()
      const nearHole = HOLES.some((h) => Math.abs(px - h.x) < HOLE_W * HS * 0.6 && Math.abs(py - h.y) < 50 * HS)
      if (nearHole) g.streak = 0
    }

    const startGame = () => {
      Object.assign(g, newGame())
      g.phase = 'playing'
      juice.reset()
      taps.length = 0
      holeKeys.length = 0
      setScore(0)
      setUi('playing')
      sfx.start()
    }
    startRef.current = startGame

    const endRound = () => {
      g.phase = 'ending'
      g.endT = 0
      g.timeLeft = 0
      juice.flash('#ffffff', 0.5)
      juice.shake(0.5)
      sTimeUp()
    }

    const finishRound = () => {
      g.phase = 'over'
      g.overT = 0
      g.critters = []
      g.mallet = null
      const nb = saveBest(GAME_ID, g.score)
      setBest(Math.max(loadBest(GAME_ID), g.score))
      setResult({ score: g.score, newBest: nb, hits: g.hits, streak: g.bestStreak, saved: g.saved })
      setUi('over')
      sfx.gameOver()
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
      const rect = canvas.getBoundingClientRect()
      taps.push({
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      // al escribir (p. ej. el apodo para la tabla en línea) las teclas no son del juego
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const hole = HOLE_KEYS[e.code]
      if (hole === undefined) return
      e.preventDefault()
      holeKeys.push(hole)
    }
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)

    const update = (rawDt: number) => {
      const jp = justPressedRef.current
      const wantStart = jp.has('action')
      const wantPause = jp.has('pause')
      const pts = taps.splice(0)
      const keys = holeKeys.splice(0)
      keyQueueRef.current.length = 0

      const dt = juice.update(rawDt)
      g.t += rawDt

      if (wantPause) togglePause()
      if (g.paused) {
        // tocar o pulsar algo reanuda la partida
        if (pts.length > 0 || wantStart) {
          g.paused = false
          sPause()
        }
        return
      }

      if (g.phase === 'menu') {
        if (wantStart) startGame()
        return
      }
      if (g.phase === 'over') {
        g.overT += rawDt
        if (wantStart && g.overT > 0.3) startGame()
        return
      }

      if (g.mallet) {
        g.mallet.t += dt
        if (g.mallet.t >= 0.35) g.mallet = null
      }
      for (const im of g.impacts) im.t += dt
      g.impacts = g.impacts.filter((im) => im.t < 0.25)

      if (g.phase === 'playing') {
        for (const p of pts) swingAt(p.x, p.y)
        for (const i of keys) swingAt(HOLES[i].x, HOLES[i].y)

        // la dificultad sube con el tiempo transcurrido
        const p = clamp((ROUND - g.timeLeft) / ROUND, 0, 1)
        g.spawnCd -= dt
        if (g.spawnCd <= 0) {
          g.spawnCd = lerp(0.9, 0.45, p)
          if (g.critters.length < Math.round(lerp(3, 5, p))) spawn()
        }
        stepCritters(dt)

        g.timeLeft = Math.max(0, g.timeLeft - dt)
        const sec = Math.ceil(g.timeLeft)
        if (sec !== g.lastSec) {
          g.lastSec = sec
          if (sec > 0 && sec <= 5) sTick()
        }
        if (g.timeLeft <= 0) endRound()
      } else if (g.phase === 'ending') {
        // breve pausa con el aviso: no aparecen más topos
        stepCritters(dt)
        g.endT += dt
        if (g.endT >= 0.8) finishRound()
      }
    }

    // ---------- dibujo ----------
    const draw = () => {
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      juice.applyShake(ctx)
      drawBackground(ctx, W, H, TOP, g.t)

      // filas de arriba a abajo; cada hoyo: atrás → bicho → delante
      for (let i = 0; i < HOLES.length; i++) {
        const h = HOLES[i]
        const c = g.critters.find((k) => k.hole === i)
        drawHoleBack(ctx, h.x, h.y, HS)
        if (c) {
          drawCritter(ctx, c.kind, h.x, h.y, HS, c.rise, stateOf(c), g.t)
        } else if (g.phase === 'menu' && i === MENU_HOLE) {
          // topo del menú meciéndose en el hoyo central
          drawCritter(ctx, 'topo', h.x, h.y, HS, 0.5 + 0.5 * Math.sin(g.t * 2.6), 'up', g.t)
        }
        drawHoleFront(ctx, h.x, h.y, HS)
        if (c && c.stage === 'hit' && c.dizzy) drawDizzy(ctx, h.x, h.y - CRITTER_H * HS - 6, HS, g.t)
      }

      for (const im of g.impacts) drawImpact(ctx, im.x, im.y, HS, im.t / 0.25, im.color)
      if (g.mallet) {
        const mt = g.mallet.t
        const swing = mt < 0.06 ? mt / 0.06 : Math.max(0, 1 - (mt - 0.06) / 0.18)
        drawMallet(ctx, g.mallet.x, g.mallet.y, HS, swing)
      }

      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)

      // marcador: tiempo sobre el cielo y puntuación grande a la derecha
      drawTimerBar(ctx, 40, 20, W - 120, g.timeLeft / ROUND, g.t)
      ctx.font = `20px ${pf}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 6
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1b1b1b'
      ctx.strokeText(String(g.score), W - 14, 27)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(g.score), W - 14, 27)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      if (g.phase === 'ending') {
        ctx.font = `26px ${pf}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 8
        ctx.strokeStyle = '#1b1b1b'
        ctx.strokeText('TIEMPO!', W / 2, H * 0.42)
        ctx.fillStyle = '#fbbf24'
        ctx.fillText('TIEMPO!', W / 2, H * 0.42)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()

      juice.drawFlash(ctx, W, H)

      if (g.paused) {
        ctx.fillStyle = 'rgba(12,20,6,0.62)'
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
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layout()
      if (W === oldW && H === oldH) return
      setupCanvas(canvas, W, H)
      // pausa del propio juego (la misma que al perder el foco)
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
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [justPressedRef, keyQueueRef])

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W}
        height={H}
        className="rounded-xl border-2 border-[#a3e635]/40 bg-[#0b1020] shadow-[0_0_30px_rgba(163,230,53,0.18)]"
        hud={
          <Hud>
            <span style={{ color: ACCENT }}>PUNTOS {score}</span>
            <span className="text-white/60">RECORD {Math.max(best, score)}</span>
          </Hud>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          aria-label="Juego Topo Loco"
        />
        {ui === 'menu' && (
          <StartOverlay
            title="TOPO LOCO"
            accent={ACCENT}
            subtitle="¡Golpea a los topos con el mazo! Pero no al gatito: él es tu amigo."
            hint="Clic en los topos (o teclas Q W E / A S D / Z X C)"
            touchHint="Toca los topos para golpearlos"
            onStart={() => startRef.current()}
          />
        )}
        {ui === 'over' && (
          <GameOverOverlay
            title="¡SE ACABÓ EL TIEMPO!"
            accent={ACCENT}
            score={result.score}
            best={best}
            newBest={result.newBest}
            stats={[
              { label: 'Topos golpeados', value: result.hits },
              { label: 'Mejor racha', value: result.streak },
              { label: 'Gatitos salvados', value: result.saved },
            ]}
            onRestart={() => startRef.current()}
            touchHint='o toca "Jugar otra vez"'
          />
        )}
      </GameScreen>
    </div>
  )
}
