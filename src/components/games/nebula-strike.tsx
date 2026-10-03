'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { GameScreen } from './game-screen'
import { GameOverOverlay, useIsTouch } from './overlay'
import { loadBest, saveBest } from './game-utils'
import { Game, type Input, type Mode, type RunResult } from './nebula-strike/game'
import { renderFrame } from './nebula-strike/render'
import { PointerControl } from './nebula-strike/input'
import { titleTap, upgradeHover, upgradeTap } from './nebula-strike/screens'
import { closeAudio, fx } from './nebula-strike/audio'
import { duckMusic, stopSoundtrack } from './nebula-strike/soundtrack'
import { ACCENT, GAME_ID, H, RS, W } from './nebula-strike/util'

interface OverState extends RunResult {
  newBest: boolean
}

const PLAY_MODES: Mode[] = ['intro', 'play', 'warning', 'boss', 'bossdeath', 'clear', 'upgrade', 'warp']

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
  const [bombs, setBombs] = useState(0)

  useEffect(() => {
    touchRef.current = touch
  }, [touch])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    canvas.width = W * RS
    canvas.height = H * RS
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true

    const g = new Game()
    gameRef.current = g
    const ptr = new PointerControl(root, canvas)
    let overT = 0

    g.onModeChange = (m) => setMode(m)
    g.onOver = (r) => {
      const nb = saveBest(GAME_ID, r.score)
      if (nb) {
        bestRef.current = r.score
        setBest(r.score)
      }
      overT = 0
      setOver({ ...r, newBest: nb })
    }
    g.toTitle()
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __ns?: Game }).__ns = g

    const inp: Input = { mx: 0, my: 0, dx: 0, dy: 0, follow: false, fx: 0, fy: 0, focus: false, bomb: false, confirm: false, back: false, left: false, right: false, up: false, down: false, taps: [] }

    const start = () => {
      fx.select()
      setOver(null)
      g.startRun(g.titleSel)
    }

    let raf = 0
    let last = performance.now()
    let hudT = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const jp = justPressedRef.current
      const pr = pressedRef.current

      // pausa
      const musicLevel = () => (g.mode === 'warning' || g.mode === 'warp' ? 0 : 1)
      if (jp.has('pause') && PLAY_MODES.includes(g.mode)) {
        g.paused = !g.paused
        fx.pause()
        duckMusic(g.paused ? 0.3 * musicLevel() : musicLevel())
      }
      if (g.paused && ptr.taps.length) {
        g.paused = false
        duckMusic(musicLevel())
        ptr.taps.length = 0
      }

      inp.mx = (pr.has('right') ? 1 : 0) - (pr.has('left') ? 1 : 0)
      inp.my = (pr.has('down') ? 1 : 0) - (pr.has('up') ? 1 : 0)
      inp.dx = ptr.dx
      inp.dy = ptr.dy
      inp.follow = ptr.follow
      inp.fx = ptr.fx
      inp.fy = ptr.fy
      inp.focus = pr.has('action') || ptr.focus
      inp.bomb = jp.has('action2') || bombReq.current
      inp.confirm = jp.has('action')
      inp.left = jp.has('left')
      inp.right = jp.has('right')
      inp.up = jp.has('up')
      inp.down = jp.has('down')

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
          style={{ aspectRatio: `${W} / ${H}` }}
          aria-label="Juego Nebula Strike"
        />
        {over && (
          <>
            <GameOverOverlay
              accent={ACCENT}
              score={over.score}
              best={best}
              newBest={over.newBest}
              stats={[
                { label: 'Sector', value: over.sector },
                { label: 'Nave', value: over.ship },
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
            Arrastra en cualquier parte para mover.
            <br />
            Segundo dedo: modo concentrado.
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
