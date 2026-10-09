'use client'

import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { fitStage, publishLogical, requestRemount, stageVersion } from './stage'
import { GameOverOverlay, Hud, StartOverlay } from './overlay'
import { Juice } from './juice'
import { setupCanvas } from './game-utils'
import { noise, tone } from './sfx'
import { LEVELS, W0, H0, loadProgress, saveResult, starsFor, type Progress } from './pasteleria/data'
import {
  act,
  handFor,
  keyAct,
  moveCursor,
  newGame,
  relayout,
  release,
  spotAt,
  tick,
  type Game,
  type Spot,
} from './pasteleria/logic'
import {
  drawCounterBand,
  drawCursor,
  drawFloor,
  drawHand,
  drawItem,
  drawKitchen,
  PLAYER_COLOR,
} from './pasteleria/draw'

const ACCENT = '#f472b6'

/** Teclas: J1 (abajo) con WASD + E; J2 (arriba) con flechas + Enter. */
const KEYS: Record<string, { s: 0 | 1; move?: [number, number]; act?: true }> = {
  KeyW: { s: 0, move: [0, -1] },
  KeyS: { s: 0, move: [0, 1] },
  KeyA: { s: 0, move: [-1, 0] },
  KeyD: { s: 0, move: [1, 0] },
  KeyE: { s: 0, act: true },
  ArrowUp: { s: 1, move: [0, -1] },
  ArrowDown: { s: 1, move: [0, 1] },
  ArrowLeft: { s: 1, move: [-1, 0] },
  ArrowRight: { s: 1, move: [1, 0] },
  Enter: { s: 1, act: true },
}

// Mundo lógico: se ajusta a la pantalla (ver layout).
let W = W0
let H = H0

function layout() {
  const f = fitStage(W0, H0)
  W = f.w
  H = f.h
  publishLogical(f)
}

interface Ptr {
  spot: Spot
  s: 0 | 1
  pick: boolean
  x0: number
  y0: number
  x: number
  y: number
  moved: boolean
}

interface Ui {
  phase: 'menu' | 'play' | 'over'
  /** Índice del nivel (0-based). */
  lv: number
  solo: boolean
  coins: number
  served: number
  missed: number
  timeLeft: number
  stars: number
  progress: Progress
}

const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Sonidos del juego: suaves y graciosos, nada de castigos feos. */
function sfxPlay(name: string) {
  switch (name) {
    case 'pick':
      tone({ freq: 660, to: 880, dur: 0.07, type: 'triangle', vol: 0.05 })
      break
    case 'drop':
      tone({ freq: 420, to: 300, dur: 0.06, type: 'sine', vol: 0.05 })
      break
    case 'tap':
      tone({ freq: 300, dur: 0.03, type: 'triangle', vol: 0.03 })
      break
    case 'oops':
      tone({ freq: 330, to: 180, dur: 0.22, type: 'triangle', vol: 0.05 })
      break
    case 'mix':
      ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.08, type: 'sine', vol: 0.05, delay: i * 0.05 }))
      break
    case 'ding':
      tone({ freq: 1319, dur: 0.25, type: 'triangle', vol: 0.05 })
      tone({ freq: 1760, dur: 0.3, type: 'triangle', vol: 0.04, delay: 0.08 })
      break
    case 'puff':
      // humito: un "boing" hacia abajo con un poco de aire
      tone({ freq: 600, to: 120, dur: 0.35, type: 'sine', vol: 0.05 })
      noise({ dur: 0.2, vol: 0.03, freq: 500 })
      break
    case 'deco':
      tone({ freq: 988, dur: 0.06, type: 'square', vol: 0.03 })
      tone({ freq: 1319, dur: 0.1, type: 'square', vol: 0.03, delay: 0.05 })
      break
    case 'box':
      tone({ freq: 523, dur: 0.08, type: 'triangle', vol: 0.05 })
      break
    case 'happy':
      ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.07 }))
      break
    case 'bye':
      tone({ freq: 440, to: 260, dur: 0.3, type: 'sine', vol: 0.04 })
      break
    case 'bell':
      tone({ freq: 1568, dur: 0.2, type: 'sine', vol: 0.04 })
      tone({ freq: 2093, dur: 0.3, type: 'sine', vol: 0.03, delay: 0.1 })
      break
    case 'pause':
      tone({ freq: 520, to: 440, dur: 0.09, type: 'triangle', vol: 0.04 })
      break
    case 'start':
      ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.09, vol: 0.05, delay: i * 0.09 }))
      break
    case 'win':
      ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.05, delay: i * 0.11 }))
      break
    case 'over':
      ;[392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.05, delay: i * 0.14, type: 'triangle' }))
      break
  }
}

export default function Pasteleria() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef<(lv: number, solo: boolean) => void>(() => {})
  const menuRef = useRef<() => void>(() => {})
  const [sel, setSel] = useState(0)
  const [mode, setMode] = useState<'duo' | 'solo'>('duo')
  const [ui, setUi] = useState<Ui>(() => ({
    phase: 'menu',
    lv: 0,
    solo: false,
    coins: 0,
    served: 0,
    missed: 0,
    timeLeft: LEVELS[0].dur,
    stars: 0,
    progress: { unlocked: 1, stars: LEVELS.map(() => 0) },
  }))
  // espejo de la selección para los atajos de teclado (que no se re-suscriben)
  const selRef = useRef(0)
  const modeRef = useRef<'duo' | 'solo'>('duo')

  const pickLevel = (i: number) => {
    selRef.current = i
    setSel(i)
  }
  const pickMode = (m: 'duo' | 'solo') => {
    modeRef.current = m
    setMode(m)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    layout()
    const ctx = setupCanvas(canvas, W, H)
    const juice = new Juice(6)
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    let g: Game = newGame(LEVELS[0], false, W, H)
    let running = false
    let paused = false
    let phaseNow: Ui['phase'] = 'menu'
    let lv = 0
    let solo = false
    let lastStars = 0
    let overT = 0
    let t = 0
    let lastSync = 0
    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    const active = new Map<number, Ptr>()

    setUi((u) => ({ ...u, progress: loadProgress() }))

    const sync = (phase: Ui['phase']) => {
      phaseNow = phase
      setUi((u) => ({
        ...u,
        phase,
        lv,
        solo,
        coins: g.coins,
        served: g.served,
        missed: g.missed,
        timeLeft: Math.ceil(g.t),
      }))
    }

    const showMenu = () => {
      running = false
      paused = false
      active.clear()
      juice.reset()
      g = newGame(LEVELS[lv], solo, W, H)
      sync('menu')
    }

    startRef.current = (n: number, s: boolean) => {
      lv = n
      solo = s
      g = newGame(LEVELS[lv], solo, W, H)
      running = true
      paused = false
      overT = 0
      active.clear()
      juice.reset()
      sfxPlay('start')
      sync('play')
    }
    menuRef.current = showMenu

    const finish = () => {
      running = false
      const stars = starsFor(g.coins, LEVELS[lv].target)
      lastStars = stars
      overT = 0
      const progress = saveResult(LEVELS[lv].n, stars)
      sfxPlay(stars > 0 ? 'win' : 'over')
      phaseNow = 'over'
      setUi((u) => ({
        ...u,
        phase: 'over',
        lv,
        solo,
        coins: g.coins,
        served: g.served,
        missed: g.missed,
        timeLeft: 0,
        stars,
        progress,
      }))
    }

    /** Coordenadas lógicas de un puntero. */
    const toLogical = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
    }

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      if (!running || g.phase !== 'play') return
      if (paused) {
        paused = false
        return
      }
      const p = toLogical(e)
      const sp = spotAt(g, p.x, p.y)
      if (!sp) return
      const s = handFor(g, sp, p.y, H)
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // sin captura
      }
      const pick = act(g, s, sp)
      active.set(e.pointerId, { spot: sp, s, pick, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false })
    }

    const onMove = (e: PointerEvent) => {
      const ptr = active.get(e.pointerId)
      if (!ptr) return
      e.preventDefault()
      const p = toLogical(e)
      ptr.x = p.x
      ptr.y = p.y
      if (Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 8) ptr.moved = true
    }

    const onUp = (e: PointerEvent) => {
      const ptr = active.get(e.pointerId)
      if (!ptr) return
      active.delete(e.pointerId)
      // arrastrar algo tomado de un puesto y soltarlo en otro (mostrador, cliente...)
      if (running && ptr.pick && ptr.moved) {
        const p = toLogical(e)
        release(g, ptr.s, ptr.spot, spotAt(g, p.x, p.y))
      }
    }

    const onCancel = (e: PointerEvent) => {
      active.delete(e.pointerId)
    }

    const pauseNow = () => {
      if (running && g.phase === 'play') paused = true
      active.clear()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (!running) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          if (phaseNow === 'menu') startRef.current(selRef.current, modeRef.current === 'solo')
          else if (phaseNow === 'over' && overT > 0.6) {
            startRef.current(lastStars > 0 && lv < LEVELS.length - 1 ? lv + 1 : lv, solo)
          }
        }
        return
      }
      if (e.code === 'KeyP') {
        if (g.phase === 'play') {
          paused = !paused
          sfxPlay('pause')
        }
        return
      }
      const k = KEYS[e.code]
      if (!k) return
      e.preventDefault()
      const s: 0 | 1 = solo ? 0 : k.s
      if (paused) {
        paused = false
        return
      }
      if (g.phase !== 'play') return
      if (k.move) moveCursor(g, s, k.move[0], k.move[1])
      else if (k.act) keyAct(g, s)
    }

    const onVis = () => {
      if (document.hidden) pauseNow()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', pauseNow)
    document.addEventListener('visibilitychange', onVis)

    const drawPause = () => {
      ctx.fillStyle = 'rgba(255,241,247,0.82)'
      ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = ACCENT
      ctx.font = `24px ${pf}`
      ctx.fillText('PAUSA', W / 2, H / 2 - 12)
      ctx.fillStyle = '#5b3a4a'
      ctx.font = `9px ${pf}`
      ctx.fillText('P O TOCA PARA SEGUIR', W / 2, H / 2 + 22)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const draw = () => {
      ctx.save()
      juice.applyShake(ctx)
      drawFloor(ctx, W, H, t)
      drawCounterBand(ctx, W, H)
      drawKitchen(ctx, g, t, pf)
      if (running) {
        drawCursor(ctx, g.spots[g.cur[0]], PLAYER_COLOR[0], t)
        if (!solo) drawCursor(ctx, g.spots[g.cur[1]], PLAYER_COLOR[1], t)
      }
      // mientras se arrastra, el ingrediente o pastel va con el dedo
      const drags = Array.from(active.values()).filter((p) => p.pick && p.moved)
      const hidden = drags.map((p) => p.s)
      for (const s of [0, 1] as const) {
        if (s === 1 && solo) continue
        drawHand(ctx, W, H, s, hidden.includes(s) ? null : g.hands[s], pf)
      }
      for (const d of drags) {
        const it = g.hands[d.s]
        if (it) drawItem(ctx, it, d.x, d.y, 1)
      }
      juice.drawParticles(ctx)
      juice.drawTexts(ctx, pf)
      ctx.restore()
      juice.drawFlash(ctx, W, H)
      if (paused) drawPause()
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt

      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (!running || g.phase === 'end') {
          requestRemount()
        } else {
          layout()
          setupCanvas(canvas, W, H)
          relayout(g, W, H)
          paused = true
          active.clear()
        }
      }

      juice.update(dt)
      if (running) {
        if (!paused) tick(g, dt)
        for (const f of g.fx) {
          if (f.k === 'text') juice.text(f.x, f.y, f.text, f.color, 11, 0.9)
          else if (f.k === 'burst') juice.burst(f.x, f.y, f.color, { count: f.n, speed: 110, life: 0.5, size: 4 })
          else sfxPlay(f.name)
        }
        g.fx.length = 0
        if (g.phase === 'end') finish()
        else if (t - lastSync > 0.2) {
          lastSync = t
          sync('play')
        }
      } else if (phaseNow === 'over') {
        overT += dt
      }
      draw()
    }
    raf = requestAnimationFrame(frame)

    showMenu()

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', pauseNow)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const hud = (
    <Hud>
      <span style={{ color: ACCENT }}>NV {ui.lv + 1}</span>
      <span className="text-white/80 tabular-nums">{fmt(ui.timeLeft)}</span>
      <span style={{ color: '#fde047' }}>MONEDAS {ui.coins}</span>
    </Hud>
  )

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen
        width={W0}
        height={H0}
        className="rounded-2xl border-2 border-pink-300/50 bg-[#fff1f7] shadow-[0_0_30px_rgba(244,114,182,0.25)]"
        hud={ui.phase === 'menu' ? undefined : hud}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none object-contain"
          style={{ touchAction: 'none' }}
          aria-label="Juego Pastelería en Pareja"
        />
        {ui.phase === 'menu' && (
          <StartOverlay
            title="PASTELERÍA EN PAREJA"
            accent={ACCENT}
            subtitle="Pedidos de animalitos golosos. Cada quien en su cocina: pásense cosas por el mostrador."
            hint="Elige nivel y pulsa ESPACIO"
            touchHint="Elige nivel y toca Jugar"
            onStart={() => startRef.current(sel, mode === 'solo')}
          >
            <div className="flex gap-2">
              {(['duo', 'solo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    pickMode(m)
                  }}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-black transition active:scale-95"
                  style={{ background: mode === m ? ACCENT : '#fbcfe8' }}
                >
                  {m === 'duo' ? '2 jugadores' : '1 jugador'}
                </button>
              ))}
            </div>
            <div className="grid w-full max-w-[17rem] grid-cols-3 gap-2">
              {LEVELS.map((L, i) => {
                const open = i < ui.progress.unlocked
                return (
                  <button
                    key={L.n}
                    type="button"
                    disabled={!open}
                    onClick={(e) => {
                      e.currentTarget.blur()
                      pickLevel(i)
                    }}
                    className="rounded-xl border px-1 py-2 text-center transition active:scale-95 disabled:opacity-40"
                    style={{
                      borderColor: sel === i ? ACCENT : 'rgba(255,255,255,0.2)',
                      background: sel === i ? `${ACCENT}33` : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <span className="block text-xs font-semibold text-white">Nivel {L.n}</span>
                    <span className="block text-[10px] text-amber-300">
                      {open ? starText(ui.progress.stars[i]) : 'Bloqueado'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="max-w-[18rem] text-[11px] leading-relaxed text-white/60">
              Jugador 1 (abajo): WASD y E. Jugador 2 (arriba): flechas y Enter. En el celular, toca un puesto para
              tomarlo y arrástralo al mostrador o a un cliente.
            </p>
          </StartOverlay>
        )}
        {ui.phase === 'over' && (
          <>
            <GameOverOverlay
              title={ui.stars > 0 ? '¡NIVEL LISTO!' : 'SIGUE INTENTANDO'}
              accent={ACCENT}
              score={ui.coins}
              best={0}
              ranked={false}
              stats={[
                { label: 'Pedidos', value: ui.served },
                { label: 'Perdidos', value: ui.missed },
                { label: 'Estrellas', value: <span className="text-amber-300">{starText(ui.stars)}</span> },
              ]}
              onRestart={() => startRef.current(ui.lv, ui.solo)}
              touchHint="o toca Jugar otra vez"
            />
            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
              {ui.stars > 0 && ui.lv < LEVELS.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    startRef.current(ui.lv + 1, ui.solo)
                  }}
                  className="rounded-full bg-pink-400 px-4 py-1.5 text-xs font-semibold text-black transition active:scale-95"
                >
                  Siguiente nivel
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  menuRef.current()
                }}
                className="rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-xs text-white/70 transition active:scale-95"
              >
                Niveles
              </button>
            </div>
          </>
        )}
      </GameScreen>
    </div>
  )
}
