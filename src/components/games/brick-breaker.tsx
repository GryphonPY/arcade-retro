'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb, rr } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 480
const H = 400
const BRICK_COLS = 8
const BRICK_ROWS = 5
const BRICK_W = 52
const BRICK_H = 18
const BRICK_GAP = 5
const BRICK_TOP = 54
const PADDLE_W = 84
const PADDLE_H = 12
const PADDLE_Y = H - 34

const ROW_COLORS = ['#F8A8C0', '#FFC98A', '#FFE787', '#A8E0C0', '#CDB4E8']
const ROW_POINTS = [50, 40, 30, 20, 10]

interface Brick {
  x: number
  y: number
  row: number
  alive: boolean
}
interface Trail {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
  maxLife: number
  size: number
}

interface BrickState {
  paddleX: number
  ball: { x: number; y: number; vx: number; vy: number; stuck: boolean }
  bricks: Brick[]
  trail: Trail[]
  particles: Particle[]
  lives: number
  level: number
  score: number
  speedMul: number
  started: boolean
  dead: boolean
  winT: number
  shakeT: number
  paused: boolean
}

function buildBricks(): Brick[] {
  const bricks: Brick[] = []
  const gridW = BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP
  const offsetX = (W - gridW) / 2
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: offsetX + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        row: r,
        alive: true,
      })
    }
  }
  return bricks
}

function initial(): BrickState {
  return {
    paddleX: (W - PADDLE_W) / 2,
    ball: { x: W / 2, y: PADDLE_Y - 12, vx: 0, vy: 0, stuck: true },
    bricks: buildBricks(),
    trail: [],
    particles: [],
    lives: 3,
    level: 1,
    score: 0,
    speedMul: 1,
    started: false,
    dead: false,
    winT: 0,
    shakeT: 0,
    paused: false,
  }
}

function launch(s: BrickState) {
  const angle = (-65 + Math.random() * 50) * (Math.PI / 180)
  const speed = 300 * s.speedMul
  s.ball.vx = Math.sin(angle) * speed
  s.ball.vy = -Math.abs(Math.cos(angle) * speed)
  s.ball.stuck = false
}

export default function BrickBreaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => (typeof window !== 'undefined' ? loadBest('brick-breaker') : 0))
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<BrickState>(initial())
  const overRef = useRef(false)

  const restart = useCallback(() => {
    stateRef.current = initial()
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
    setLives(3)
    setLevel(1)
    setNewBest(false)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) throw new Error('Canvas 2D no disponible')
    const ctx = ctx0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let last = performance.now()

    const gameOver = () => {
      overRef.current = true
      stateRef.current.dead = true
      setOver(true)
      setRunning(false)
      if (saveBest('brick-breaker', stateRef.current.score)) setNewBest(true)
      setBest((b) => Math.max(b, stateRef.current.score))
      sfx.gameOver()
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current

      if (s.started && !overRef.current && jp.has('pause')) {
        s.paused = !s.paused
        sfx.pause()
        return
      }
      if (s.paused) return

      if (overRef.current) {
        if (jp.has('action')) restart()
        if (s.shakeT > 0) s.shakeT -= dt
        return
      }
      if (s.winT > 0) {
        s.winT -= dt
        if (s.winT <= 0) {
          s.level += 1
          setLevel(s.level)
          s.bricks = buildBricks()
          s.speedMul = 1 + (s.level - 1) * 0.14
          s.ball = { x: W / 2, y: PADDLE_Y - 12, vx: 0, vy: 0, stuck: true }
          s.paddleX = (W - PADDLE_W) / 2
        }
        return
      }
      if (!s.started) {
        if (jp.has('action') || jp.has('left') || jp.has('right')) {
          s.started = true
          setRunning(true)
          launch(s)
          sfx.start()
          if (pressed.has('left')) s.paddleX -= 420 * dt
          if (pressed.has('right')) s.paddleX += 420 * dt
        }
        return
      }

      // paleta
      const pv = 420
      if (pressed.has('left')) s.paddleX -= pv * dt
      if (pressed.has('right')) s.paddleX += pv * dt
      s.paddleX = Math.max(8, Math.min(W - PADDLE_W - 8, s.paddleX))

      // bola pegada a la paleta
      if (s.ball.stuck) {
        s.ball.x = s.paddleX + PADDLE_W / 2
        s.ball.y = PADDLE_Y - 12
        if (jp.has('action')) launch(s)
        return
      }

      const speed = Math.hypot(s.ball.vx, s.ball.vy)
      const steps = Math.max(1, Math.ceil((speed * dt) / 6))
      const sdt = dt / steps

      for (let step = 0; step < steps; step++) {
        s.ball.x += s.ball.vx * sdt
        s.ball.y += s.ball.vy * sdt

        // paredes
        if (s.ball.x < 10) {
          s.ball.x = 10
          s.ball.vx = Math.abs(s.ball.vx)
        }
        if (s.ball.x > W - 10) {
          s.ball.x = W - 10
          s.ball.vx = -Math.abs(s.ball.vx)
        }
        if (s.ball.y < 10) {
          s.ball.y = 10
          s.ball.vy = Math.abs(s.ball.vy)
          sfx.pellet()
        }

        // paleta
        if (
          s.ball.vy > 0 &&
          aabb(s.ball.x - 7, s.ball.y - 7, 14, 14, s.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H)
        ) {
          const hit = (s.ball.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)
          const angle = hit * 1.05
          const sp = Math.hypot(s.ball.vx, s.ball.vy)
          s.ball.vx = Math.sin(angle) * sp
          s.ball.vy = -Math.abs(Math.cos(angle) * sp)
          if (Math.abs(s.ball.vy) < sp * 0.35) s.ball.vy = -sp * 0.35
          sfx.bounce()
        }

        // ladrillos
        for (const b of s.bricks) {
          if (!b.alive) continue
          if (aabb(s.ball.x - 7, s.ball.y - 7, 14, 14, b.x, b.y, BRICK_W, BRICK_H)) {
            b.alive = false
            s.score += ROW_POINTS[b.row]
            setScore(s.score)
            // rebote según lado de impacto
            const cx = Math.max(b.x, Math.min(s.ball.x, b.x + BRICK_W))
            const cy = Math.max(b.y, Math.min(s.ball.y, b.y + BRICK_H))
            const fromSide = Math.abs(s.ball.x - cx) > Math.abs(s.ball.y - cy)
            if (fromSide) s.ball.vx *= -1
            else s.ball.vy *= -1
            s.shakeT = 0.08
            sfx.brick(b.row)

            // Fragmentos de impacto
            const color = ROW_COLORS[b.row]
            for (let i = 0; i < 8; i++) {
              const angle = Math.random() * Math.PI * 2
              const spd = 60 + Math.random() * 120
              s.particles.push({
                x: b.x + BRICK_W / 2,
                y: b.y + BRICK_H / 2,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7,
                size: 2.5 + Math.random() * 3,
              })
            }
            break
          }
        }

        // caída
        if (s.ball.y > H + 12) {
          s.lives -= 1
          setLives(s.lives)
          sfx.hurt()
          if (s.lives <= 0) {
            gameOver()
            return
          }
          s.ball = { x: W / 2, y: PADDLE_Y - 12, vx: 0, vy: 0, stuck: true }
          break
        }
      }

      // estela suave
      s.trail.push({ x: s.ball.x, y: s.ball.y })
      if (s.trail.length > 9) s.trail.shift()

      // actualizar partículas
      s.particles = s.particles.filter((p) => {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 220 * dt
        p.life -= dt
        return p.life > 0
      })

      // victoria del nivel
      if (s.bricks.every((b) => !b.alive)) {
        s.score += 150
        setScore(s.score)
        s.winT = 1.5
        sfx.levelUp()
      }
    }

    const draw = () => {
      const s = stateRef.current
      ctx.save()
      if (s.shakeT > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4)

      // fondo crema
      ctx.fillStyle = '#FBF3E4'
      ctx.fillRect(-10, -10, W + 20, H + 20)
      // puntitos decorativos suaves
      ctx.fillStyle = 'rgba(210,180,150,0.18)'
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.beginPath()
          ctx.arc(36 + i * 102, 336 + (j % 2) * 16, 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ladrillos redondeados pastel
      for (const b of s.bricks) {
        if (!b.alive) continue
        ctx.fillStyle = ROW_COLORS[b.row]
        rr(ctx, b.x, b.y, BRICK_W, BRICK_H, 7)
        ctx.fill()
        // brillo superior
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        rr(ctx, b.x + 4, b.y + 3, BRICK_W - 8, 5, 3)
        ctx.fill()
      }

      // estela
      s.trail.forEach((t, i) => {
        const a = (i / s.trail.length) * 0.25
        ctx.fillStyle = `rgba(255,138,122,${a})`
        ctx.beginPath()
        ctx.arc(t.x, t.y, 5 + i * 0.3, 0, Math.PI * 2)
        ctx.fill()
      })

      // bola
      ctx.save()
      ctx.shadowColor = 'rgba(255,138,122,0.7)'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#FF8A7A'
      ctx.beginPath()
      ctx.arc(s.ball.x, s.ball.y, 7.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.arc(s.ball.x - 2.2, s.ball.y - 2.4, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // paleta menta
      ctx.fillStyle = '#7DD8B7'
      rr(ctx, s.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 7)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      rr(ctx, s.paddleX + 6, PADDLE_Y + 2.5, PADDLE_W - 12, 3.6, 2)
      ctx.fill()

      // vidas como corazoncitos pastel
      for (let i = 0; i < s.lives; i++) {
        const hx = 20 + i * 20
        const hy = 24
        ctx.fillStyle = '#F8A8C0'
        ctx.beginPath()
        ctx.arc(hx - 3.2, hy - 1.5, 4.2, 0, Math.PI * 2)
        ctx.arc(hx + 3.2, hy - 1.5, 4.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(hx - 7.2, hy + 0.5)
        ctx.quadraticCurveTo(hx, hy + 11, hx + 7.2, hy + 0.5)
        ctx.fill()
      }

      // nivel
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif'
      ctx.fillStyle = '#B8A88F'
      ctx.textAlign = 'right'
      ctx.fillText(`Nivel ${s.level}`, W - 16, 29)
      ctx.textAlign = 'left'

      // mensaje de nivel superado
      if (s.winT > 0) {
        ctx.textAlign = 'center'
        ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#7DD8B7'
        ctx.fillText('¡Nivel superado!', W / 2, H / 2 - 8)
        ctx.font = '14px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#B8A88F'
        ctx.fillText('Preparando ladrillos más rápidos…', W / 2, H / 2 + 18)
        ctx.textAlign = 'left'
      }

      // Partículas de impacto
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1

      // Pausa
      if (s.paused) {
        ctx.fillStyle = 'rgba(251,243,228,0.65)'
        ctx.fillRect(0, 0, W, H)
        ctx.font = 'bold 26px monospace'
        ctx.fillStyle = '#E8899E'
        ctx.textAlign = 'center'
        ctx.fillText('PAUSA (P)', W / 2, H / 2)
        ctx.textAlign = 'left'
      }

      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      update(dt)
      justPressedRef.current.clear()
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [justPressedRef, pressedRef, restart])

  return (
    <div className="w-full h-full flex flex-col items-center justify-between overflow-hidden p-1 sm:p-2">
      {/* Marcador */}
      <div className="flex items-center justify-between w-full max-w-[480px] px-2 shrink-0 py-0.5 text-xs font-mono font-bold">
        <span className="text-[#E8899E]">{score} PTS</span>
        <div className="flex items-center gap-2">
          <span className="text-[#7DD8B7]">NIVEL {level}</span>
          <span className="text-red-400" title="Vidas">
            {'♥'.repeat(Math.max(0, lives))}
          </span>
        </div>
        <span className="text-[#9DB8A8]">
          HI: {Math.max(best, score)}
        </span>
      </div>

      {/* Pantalla del Canvas adaptativa */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center p-1">
        <div className="relative rounded-3xl border-2 border-[#EBDDC8] shadow-[0_14px_40px_rgba(240,180,170,0.35)] overflow-hidden max-h-full max-w-full aspect-[460/400] flex items-center justify-center bg-[#18181b]">
          <canvas
            ref={canvasRef}
            onClick={() => {
              const s = stateRef.current
              if (!s.started) {
                s.started = true
                setRunning(true)
                launch(s)
                sfx.start()
              } else if (s.ball.stuck) {
                launch(s)
                sfx.start()
              }
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const relX = ((e.clientX - rect.left) / rect.width) * W
              stateRef.current.paddleX = Math.max(8, Math.min(W - PADDLE_W - 8, relX - PADDLE_W / 2))
            }}
            className="block max-h-full max-w-full object-contain touch-none select-none cursor-pointer"
            style={{ aspectRatio: `${W} / ${H}` }}
            aria-label="Juego Rompe Ladrillos"
          />

          {!running && !over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FBF3E4]/85 text-center px-4">
              <p className="text-xl sm:text-2xl font-extrabold text-[#E8899E]">Rompe Ladrillos</p>
              <p className="text-[#8D7B62] text-xs sm:text-sm">
                Mueve la paleta con <b>← →</b> o <b>A D</b>
              </p>
              <p className="text-[#8D7B62]/80 text-[11px]">
                Lanza la bola con <b>A / ESPACIO</b> o toca la pantalla
              </p>
            </div>
          )}

          {over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FBF3E4]/90 text-center px-4">
              <p className="text-xl sm:text-2xl font-extrabold text-[#E8899E]">Se acabaron las vidas</p>
              {newBest && <p className="text-[#7DD8B7] font-bold animate-pulse text-xs">¡Nuevo récord!</p>}
              <p className="text-[#8D7B62] text-xs sm:text-sm">Puntuación final: {score} pts · Nivel {level}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur()
                  restart()
                }}
                className="px-5 py-2 rounded-full bg-[#7DD8B7] text-white font-bold shadow-lg hover:bg-[#66C7A5] transition-colors text-xs sm:text-sm"
              >
                Jugar de nuevo
              </button>
              <p className="text-[#8D7B62]/60 text-[10px]">o pulsa ESPACIO / ENTER</p>
            </div>
          )}
        </div>
      </div>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Lanzar" />
    </div>
  )
}
