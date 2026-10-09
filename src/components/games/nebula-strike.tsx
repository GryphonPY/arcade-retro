'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { GameOverOverlay, useIsTouch } from './overlay'
import { loadBest, saveBest } from './game-utils'
import { Game, emptyPad, type Input, type Mode, type Pad, type RunResult } from './nebula-strike/game'
import { renderFrame } from './nebula-strike/render'
import { PointerControl, type ShipTouch } from './nebula-strike/input'
import { titleTap, upgradeHover, upgradeTap } from './nebula-strike/screens'
import { closeAudio, fx } from './nebula-strike/audio'
import { duckMusic, stopSoundtrack } from './nebula-strike/soundtrack'
import { ACCENT, GAME_ID, H, RS, W, clamp, layoutWorld } from './nebula-strike/util'
import { requestRemount, stageVersion } from './stage'

interface OverState extends RunResult {
  newBest: boolean
}

const PLAY_MODES: Mode[] = ['intro', 'play', 'warning', 'boss', 'bossdeath', 'clear', 'upgrade', 'warp']

/**
 * Teclas de cada jugador en cooperativo. J1: flechas, ESPACIO o Z concentran,
 * SHIFT o X bomba. J2: WASD, J concentra, K bomba. Como useKeys mezcla WASD con
 * las flechas, el cooperativo lee sus propias teclas (ver el efecto principal).
 */
interface KeySet {
  left: string
  right: string
  up: string
  down: string
  focus: string[]
  bomb: string[]
  confirm: string[]
}
const P1_KEYS: KeySet = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', focus: ['Space', 'KeyZ'], bomb: ['ShiftLeft', 'ShiftRight', 'KeyX'], confirm: ['Space', 'Enter', 'KeyZ'] }
const P2_KEYS: KeySet = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', focus: ['KeyJ'], bomb: ['KeyK'], confirm: ['KeyJ'] }

function fillCoopPad(pad: Pad, k: KeySet, down: Set<string>, just: Set<string>, touch: ShipTouch, touchFocus: boolean, touchBomb: boolean) {
  const any = (set: Set<string>, codes: string[]) => codes.some((c) => set.has(c))
  pad.mx = (down.has(k.right) ? 1 : 0) - (down.has(k.left) ? 1 : 0)
  pad.my = (down.has(k.down) ? 1 : 0) - (down.has(k.up) ? 1 : 0)
  pad.dx = touch.dx
  pad.dy = touch.dy
  pad.follow = touch.follow
  pad.fx = touch.fx
  pad.fy = touch.fy
  pad.focus = any(down, k.focus) || touchFocus
  pad.bomb = any(just, k.bomb) || touchBomb
  pad.left = just.has(k.left)
  pad.right = just.has(k.right)
  pad.up = just.has(k.up)
  pad.down = just.has(k.down)
  pad.confirm = any(just, k.confirm)
}

export default function NebulaStrike() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Game | null>(null)
  const bombReq = useRef(false)
  const { pressedRef, justPressedRef, keyQueueRef } = useKeys()
  const touch = useIsTouch()
  const touchRef = useRef(touch)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const bestRef = useRef(best)
  const [over, setOver] = useState<OverState | null>(null)
  const [mode, setMode] = useState<Mode>('title')
  const [coop, setCoop] = useState(false)
  const [bombs, setBombs] = useState(0)

  useEffect(() => {
    touchRef.current = touch
  }, [touch])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    layoutWorld()
    canvas.width = W * RS
    canvas.height = H * RS
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true

    const g = new Game()
    gameRef.current = g
    const ptr = new PointerControl(root, canvas)
    // en cooperativo, cada toque nuevo va a la nave más cercana
    ptr.pick = (x, y) => g.pickShip(x, y)
    // teclado propio del cooperativo (códigos físicos, sin mezclar WASD con flechas)
    const codes = new Set<string>()
    const justCodes = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.repeat) return
      if (!codes.has(e.code)) justCodes.add(e.code)
      codes.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => codes.delete(e.code)
    const onKeysBlur = () => {
      codes.clear()
      justCodes.clear()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onKeysBlur)
    let overT = 0

    g.onModeChange = (m) => {
      setMode(m)
      setCoop(g.coop)
    }
    g.onOver = (r) => {
      // las partidas de 2 jugadores no se guardan como récord
      const nb = r.coop ? false : saveBest(GAME_ID, r.score)
      if (nb) {
        bestRef.current = r.score
        setBest(r.score)
      }
      overT = 0
      setOver({ ...r, newBest: nb })
    }
    g.toTitle()
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __ns?: Game }).__ns = g

    const inp: Input = { pads: [emptyPad(), emptyPad()], confirm: false, back: false, taps: [] }

    const start = () => {
      fx.select()
      setOver(null)
      g.startRun(g.titleSel)
    }

    // Cambio de tamaño en partida. Lo centrado a lo ancho se corre dx (la mitad
    // del cambio de ancho); lo anclado abajo, dy. Lo que está fuera de pantalla
    // conserva su distancia al borde de origen o final. Se pausa salvo en la
    // selección de mejoras, que ya detiene la partida.
    const relayoutLive = () => {
      const oldW = W
      const oldH = H
      layoutWorld()
      const dx = (W - oldW) / 2
      const dy = H - oldH
      const mx = (x: number) => (x < 0 ? x : x > oldW ? x + 2 * dx : x + dx)
      const my = (y: number) => (y < 0 ? y : y + dy)

      for (const p of g.ships) {
        p.x = clamp(mx(p.x), 10, W - 10)
        p.y = p.entering > 0 ? my(p.y) : clamp(my(p.y), 26, H - 16)
        for (let i = 0; i < p.trailX.length; i++) {
          p.trailX[i] = mx(p.trailX[i])
          p.trailY[i] = my(p.trailY[i])
        }
      }
      for (const d of g.drones) {
        d.x = mx(d.x)
        d.y = my(d.y)
      }
      for (const arr of [g.bullets, g.shots, g.enemies, g.items, g.parts, g.beams]) {
        for (const o of arr) {
          o.x = mx(o.x)
          o.y = my(o.y)
        }
      }
      if (g.boss) {
        const b = g.boss
        b.x = mx(b.x)
        b.y = my(b.y)
        b.tx = mx(b.tx)
        b.ty = my(b.ty)
      }
      g.bombX = mx(g.bombX)
      g.bombY = my(g.bombY)
      g.laserHitY = my(g.laserHitY)
      g.bg.resize(oldW, oldH)

      canvas.width = W * RS
      canvas.height = H * RS
      ctx.imageSmoothingEnabled = true
      if (g.mode !== 'upgrade' && !g.paused) {
        g.paused = true
        duckMusic(g.mode === 'warning' || g.mode === 'warp' ? 0 : 0.3)
      }
    }

    let raf = 0
    let last = performance.now()
    let seenStage = stageVersion()
    let hudT = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (stageVersion() !== seenStage) {
        seenStage = stageVersion()
        if (g.mode === 'title' || g.mode === 'over') requestRemount()
        else relayoutLive()
      }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const jp = justPressedRef.current
      const pr = pressedRef.current

      // pausa
      const musicLevel = () => (g.mode === 'warning' || g.mode === 'warp' ? 0 : 1)
      if (jp.has('pause') && (g.paused || PLAY_MODES.includes(g.mode))) {
        g.paused = !g.paused
        fx.pause()
        duckMusic(g.paused ? 0.3 * musicLevel() : musicLevel())
      }
      if (g.paused && ptr.taps.length) {
        g.paused = false
        duckMusic(musicLevel())
        ptr.taps.length = 0
      }

      inp.confirm = jp.has('action')
      if (g.coop) {
        fillCoopPad(inp.pads[0], P1_KEYS, codes, justCodes, ptr.ships[0], ptr.focusOf(0), bombReq.current)
        fillCoopPad(inp.pads[1], P2_KEYS, codes, justCodes, ptr.ships[1], ptr.focusOf(1), false)
      } else {
        const p1 = inp.pads[0]
        const t0 = ptr.ships[0]
        p1.mx = (pr.has('right') ? 1 : 0) - (pr.has('left') ? 1 : 0)
        p1.my = (pr.has('down') ? 1 : 0) - (pr.has('up') ? 1 : 0)
        p1.dx = t0.dx
        p1.dy = t0.dy
        p1.follow = t0.follow
        p1.fx = t0.fx
        p1.fy = t0.fy
        p1.focus = pr.has('action') || ptr.focusOf(0)
        p1.bomb = jp.has('action2') || bombReq.current
        p1.confirm = jp.has('action')
        p1.left = jp.has('left')
        p1.right = jp.has('right')
        p1.up = jp.has('up')
        p1.down = jp.has('down')
        Object.assign(inp.pads[1], emptyPad())
      }

      if (!g.paused) {
        if (g.mode === 'title') {
          let go = jp.has('action')
          for (const t of ptr.taps) if (titleTap(g, t.x, t.y)) go = true
          if (go) start()
        } else if (g.mode === 'upgrade') {
          if (ptr.hoverMoved) upgradeHover(g, ptr.hoverX, ptr.hoverY)
          for (const t of ptr.taps) upgradeTap(g, t.x, t.y, t.mouse)
        } else if (g.mode === 'over') {
          overT += dt
          if (overT > 0.9) {
            if (jp.has('action')) start()
            else if (jp.has('action2')) {
              setOver(null)
              g.toTitle()
            }
          }
        }
      }

      g.update(dt, inp)
      renderFrame(ctx, g, bestRef.current, touchRef.current || ptr.touched)

      jp.clear()
      justCodes.clear()
      keyQueueRef.current.length = 0
      ptr.consume()
      bombReq.current = false

      hudT -= dt
      if (hudT <= 0) {
        hudT = 0.15
        setBombs(g.bombs)
      }
    }
    raf = requestAnimationFrame(loop)

    const autoPause = () => {
      if (PLAY_MODES.includes(g.mode) && !g.paused) {
        g.paused = true
        duckMusic(g.mode === 'warning' || g.mode === 'warp' ? 0 : 0.3)
      }
    }
    const onVis = () => {
      if (document.hidden) autoPause()
    }
    window.addEventListener('blur', autoPause)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ptr.destroy()
      window.removeEventListener('blur', autoPause)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onKeysBlur)
      g.onOver = null
      g.onModeChange = null
      gameRef.current = null
      stopSoundtrack()
      closeAudio()
    }
  }, [justPressedRef, pressedRef, keyQueueRef])

  const inRun = PLAY_MODES.includes(mode) || mode === 'dead'

  return (
    <div ref={rootRef} className="flex h-full w-full touch-none select-none flex-col items-center overflow-hidden">
      <GameScreen width={W} height={H} className="rounded-xl border border-cyan-400/30 bg-[#04060f] shadow-[0_0_40px_rgba(34,211,238,0.18)]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          aria-label="Juego Nebula Strike"
        />
        {over && (
          <>
            <GameOverOverlay
              accent={ACCENT}
              score={over.score}
              best={best}
              newBest={over.newBest}
              ranked={!over.coop}
              stats={[
                { label: 'Sector', value: over.sector },
                { label: over.coop ? 'Naves' : 'Nave', value: over.ship },
                { label: 'Bajas', value: over.kills.toLocaleString('es-MX') },
                { label: 'Roces', value: over.graze.toLocaleString('es-MX') },
                { label: 'Cadena máx.', value: over.maxChain },
              ]}
              onRestart={() => {
                const g = gameRef.current
                if (!g) return
                fx.select()
                setOver(null)
                g.startRun(g.shipId)
              }}
              hint="ESPACIO: otra vez  ·  X: cambiar nave"
              touchHint="o cambia de nave arriba a la derecha"
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                setOver(null)
                gameRef.current?.toTitle()
              }}
              className="absolute right-2 top-2 z-20 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur transition hover:bg-white/10 active:scale-95"
            >
              Cambiar nave
            </button>
          </>
        )}
      </GameScreen>
      {touch && (
        <div className="flex h-[84px] w-full max-w-[440px] shrink-0 items-center justify-between gap-3 px-4 pb-[max(8px,env(safe-area-inset-bottom))]">
          <p className="text-[11px] leading-snug text-white/45">
            {coop ? 'Cada dedo mueve la nave más cercana.' : 'Arrastra en cualquier parte para mover.'}
            <br />
            {coop ? 'Dos dedos sobre una nave: concentrado.' : 'Segundo dedo: modo concentrado.'}
          </p>
          <button
            type="button"
            data-no-drag
            aria-label="Bomba"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              bombReq.current = true
              try {
                navigator.vibrate?.(15)
              } catch {
                // sin vibración
              }
            }}
            className="relative flex size-[66px] shrink-0 flex-col items-center justify-center rounded-full border-2 text-[10px] font-bold tracking-wider transition active:scale-90"
            style={{
              visibility: inRun ? 'visible' : 'hidden',
              borderColor: bombs > 0 ? 'rgba(244,114,182,0.85)' : 'rgba(255,255,255,0.15)',
              background: bombs > 0 ? 'radial-gradient(circle at 50% 40%, rgba(244,114,182,0.45), rgba(80,10,50,0.55))' : 'rgba(20,20,30,0.5)',
              color: bombs > 0 ? '#fff' : 'rgba(255,255,255,0.35)',
              boxShadow: bombs > 0 ? '0 0 22px rgba(244,114,182,0.45)' : 'none',
              fontFamily: 'var(--font-pixel)',
            }}
          >
            <span>BOMBA</span>
            <span className="mt-1 text-[12px]">{bombs}</span>
          </button>
        </div>
      )}
    </div>
  )
}
