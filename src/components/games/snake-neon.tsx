'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys, type Dir } from './use-keys'
import { loadBest, saveBest, rr, renderScale } from './game-utils'
import { TouchPad } from './touch-pad'
import { GameScreen } from './game-screen'
import { sfx } from './sfx'

const COLS = 22
const ROWS = 22
const CELL = 20
const W = COLS * CELL
const H = ROWS * CELL

type Pt = { x: number; y: number }

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface SnakeState {
  snake: Pt[]
  dir: Dir
  queue: Dir[]
  food: Pt
  goldenFood: (Pt & { life: number; maxLife: number }) | null
  foodEaten: number
  particles: Particle[]
  acc: number
  stepMs: number
  alive: boolean
  pulse: number
  started: boolean
  paused: boolean
}

function spawnFood(snake: Pt[]): Pt {
  let p: Pt
  do {
    p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (snake.some((s) => s.x === p.x && s.y === p.y))
  return p
}

const DIRS: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

function initial(): SnakeState {
  const snake: Pt[] = [
    { x: 8, y: 11 },
    { x: 7, y: 11 },
    { x: 6, y: 11 },
  ]
  return {
    snake,
    dir: 'right',
    queue: [],
    food: spawnFood(snake),
    goldenFood: null,
    foodEaten: 0,
    particles: [],
    acc: 0,
    stepMs: 130,
    alive: true,
    pulse: 0,
    started: false,
    paused: false,
  }
}

export default function SnakeNeon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, keyQueueRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<SnakeState>(initial())
  const overRef = useRef(false)
  const scoreRef = useRef(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('snake-neon'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    overRef.current = false
    scoreRef.current = 0
    setScore(0)
    setOver(false)
    setRunning(true)
    setNewBest(false)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = (() => {
      const dpr = renderScale()
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      const c = canvas.getContext('2d')
      if (!c) throw new Error('Canvas 2D no disponible')
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      return c
    })()

    let raf = 0
    let last = performance.now()

    const step = () => {
      const s = stateRef.current
      // aplicar primer giro válido de la cola
      while (s.queue.length > 0) {
        const d = s.queue.shift() as Dir
        if (d !== OPPOSITE[s.dir] && d !== s.dir) {
          s.dir = d
          break
        }
      }
      const head = s.snake[0]
      const d = DIRS[s.dir]
      const nh: Pt = { x: head.x + d.x, y: head.y + d.y }
      const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS
      const hitSelf = s.snake.some((p, i) => i < s.snake.length - 1 && p.x === nh.x && p.y === nh.y)
      if (hitWall || hitSelf) {
        s.alive = false
        overRef.current = true
        setOver(true)
        setRunning(false)
        if (saveBest('snake-neon', scoreRef.current)) setNewBest(true)
        setBest((b) => Math.max(b, scoreRef.current))
        sfx.gameOver()
        return
      }
      s.snake.unshift(nh)

      // orbe normal
      let grew = false
      if (nh.x === s.food.x && nh.y === s.food.y) {
        s.food = spawnFood(s.snake)
        s.foodEaten += 1
        s.stepMs = Math.max(58, s.stepMs - 2.2)
        scoreRef.current += 10
        setScore(scoreRef.current)
        sfx.eat()
        grew = true
        // Cada 5 orbes estándar, aparece un Súper Orbe Dorado
        if (s.foodEaten % 5 === 0 && !s.goldenFood) {
          s.goldenFood = { ...spawnFood(s.snake), life: 8.0, maxLife: 8.0 }
        }
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2
          const sp = 25 + Math.random() * 65
          s.particles.push({
            x: nh.x * CELL + CELL / 2,
            y: nh.y * CELL + CELL / 2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.35,
            color: '#ff7ae0',
          })
        }
      }

      // orbe dorado
      if (s.goldenFood && nh.x === s.goldenFood.x && nh.y === s.goldenFood.y) {
        scoreRef.current += 50
        setScore(scoreRef.current)
        sfx.golden()
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2
          const sp = 40 + Math.random() * 90
          s.particles.push({
            x: nh.x * CELL + CELL / 2,
            y: nh.y * CELL + CELL / 2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.5,
            color: '#ffe23d',
          })
        }
        s.goldenFood = null
        grew = true
      }

      if (!grew) {
        s.snake.pop()
      }
    }

    const draw = () => {
      const s = stateRef.current
      // fondo synthwave
      ctx.fillStyle = '#070213'
      ctx.fillRect(0, 0, W, H)

      // rejilla de neón
      ctx.strokeStyle = 'rgba(255,0,200,0.10)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i < COLS; i++) {
        ctx.moveTo(i * CELL, 0)
        ctx.lineTo(i * CELL, H)
      }
      for (let j = 1; j < ROWS; j++) {
        ctx.moveTo(0, j * CELL)
        ctx.lineTo(W, j * CELL)
      }
      ctx.stroke()

      // horizonte decorativo
      const grad = ctx.createLinearGradient(0, 0, 0, 6)
      grad.addColorStop(0, 'rgba(255,47,214,0.55)')
      grad.addColorStop(1, 'rgba(255,47,214,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, 6)

      // partículas
      for (const p of s.particles) {
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
      }

      // comida pulsante normal
      s.pulse += 0.08
      const fr = 6 + Math.sin(s.pulse) * 1.6
      ctx.save()
      ctx.shadowColor = '#ff2fd6'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#ff7ae0'
      ctx.beginPath()
      ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, fr, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // orbe dorado especial
      if (s.goldenFood) {
        const gx = s.goldenFood.x * CELL + CELL / 2
        const gy = s.goldenFood.y * CELL + CELL / 2
        const gfr = 7.5 + Math.sin(s.pulse * 2) * 2.2
        ctx.save()
        ctx.shadowColor = '#ffe23d'
        ctx.shadowBlur = 20
        ctx.fillStyle = '#ffe23d'
        ctx.beginPath()
        ctx.arc(gx, gy, gfr, 0, Math.PI * 2)
        ctx.fill()

        // anillo de expiración
        const pct = s.goldenFood.life / s.goldenFood.maxLife
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(gx, gy, gfr + 3.5, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // serpiente con degradado cian → magenta
      const n = s.snake.length
      for (let i = n - 1; i >= 0; i--) {
        const seg = s.snake[i]
        const t = n === 1 ? 0 : i / (n - 1)
        const r = Math.round(34 + t * (176 - 34))
        const g = Math.round(247 + t * (38 - 247))
        const b = Math.round(197 + t * (255 - 197))
        const color = `rgb(${r},${g},${b})`
        const pad = i === 0 ? 1.5 : 2.5
        if (i === 0) {
          ctx.save()
          ctx.shadowColor = '#22f7c5'
          ctx.shadowBlur = 14
        }
        ctx.fillStyle = color
        rr(ctx, seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5)
        ctx.fill()
        if (i === 0) ctx.restore()
      }

      // ojos en la cabeza
      const head = s.snake[0]
      const d = DIRS[s.dir]
      const cx = head.x * CELL + CELL / 2
      const cy = head.y * CELL + CELL / 2
      const ox = d.x * 3.4
      const oy = d.y * 3.4
      const px = d.x === 0 ? 3.2 : 0
      const py = d.y === 0 ? 3.2 : 0
      ctx.fillStyle = '#070213'
      ctx.beginPath()
      ctx.arc(cx + ox + px, cy + oy + py, 1.8, 0, Math.PI * 2)
      ctx.arc(cx + ox - px, cy + oy - py, 1.8, 0, Math.PI * 2)
      ctx.fill()

      // overlay de pausa
      if (s.paused) {
        ctx.fillStyle = 'rgba(7, 2, 19, 0.75)'
        ctx.fillRect(0, 0, W, H)
        ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#22f7c5'
        ctx.textAlign = 'center'
        ctx.fillText('PAUSA', W / 2, H / 2 - 8)
        ctx.font = '12px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText('Pulsa P para continuar', W / 2, H / 2 + 18)
        ctx.textAlign = 'left'
      }
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const jp = justPressedRef.current
      const q = keyQueueRef.current

      if (jp.has('pause')) {
        s.paused = !s.paused
        sfx.pause()
      }

      if (s.paused) {
        jp.clear()
        q.length = 0
        draw()
        raf = requestAnimationFrame(loop)
        return
      }

      // actualizar partículas
      s.particles = s.particles.filter((p) => {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        return p.life > 0
      })

      // expiración de comida dorada
      if (s.goldenFood) {
        s.goldenFood.life -= dt
        if (s.goldenFood.life <= 0) s.goldenFood = null
      }

      if (overRef.current) {
        if (jp.has('action')) restart()
      } else if (!s.started) {
        const startKey = q.find((k) => k === 'up' || k === 'down' || k === 'left' || k === 'right')
        if (startKey) {
          s.started = true
          setRunning(true)
          sfx.start()
          if (startKey !== OPPOSITE[s.dir]) s.dir = startKey as Dir
        }
      } else {
        // vaciar cola cronológica
        while (q.length > 0 && s.queue.length < 3) {
          const k = q.shift()
          if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
            s.queue.push(k as Dir)
          }
        }
        s.acc += dt * 1000
        while (s.acc >= s.stepMs && s.alive) {
          s.acc -= s.stepMs
          step()
        }
      }
      jp.clear()
      q.length = 0
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [justPressedRef, keyQueueRef, restart])

  const hintText = 'Pulsa ↑ ↓ ← → o WASD para empezar'

  return (
    <div className="w-full h-full flex flex-col items-center justify-between overflow-hidden p-1 sm:p-2">
      <GameScreen
        width={W}
        height={H}
        className="rounded-2xl p-[3px] bg-gradient-to-br from-[#22f7c5] via-[#b026ff] to-[#ff2fd6] shadow-[0_0_36px_rgba(176,38,255,0.35)]"
        hud={
          <div
            className="flex items-center justify-between w-full px-2 shrink-0 py-0.5"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            <span className="text-[10px] text-[#22f7c5] drop-shadow-[0_0_6px_rgba(34,247,197,0.8)]">
              PUNTOS {score}
            </span>
            <span className="text-[10px] text-[#ff2fd6] drop-shadow-[0_0_6px_rgba(255,47,214,0.8)]">
              RÉCORD {Math.max(best, score)}
            </span>
          </div>
        }
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full object-contain touch-none select-none rounded-[13px] bg-[#070213]"
          aria-label="Juego Snake Neón"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[13px] bg-[#070213]/85 backdrop-blur-[2px] text-center px-4">
            <p
              className="text-[#22f7c5] text-sm drop-shadow-[0_0_10px_rgba(34,247,197,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              SNAKE NEÓN
            </p>
            <p className="text-white/70 text-xs">{hintText}</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[13px] bg-[#070213]/88 backdrop-blur-[2px] text-center px-4">
            <p
              className="text-[#ff2fd6] text-sm drop-shadow-[0_0_10px_rgba(255,47,214,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              GAME OVER
            </p>
            {newBest && (
              <p className="text-[#ffe23d] text-[10px] animate-pulse" style={{ fontFamily: 'var(--font-pixel)' }}>
                ¡NUEVO RÉCORD!
              </p>
            )}
            <p className="text-white/80 text-xs">Puntuación: {score}</p>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                restart()
              }}
              className="text-[10px] px-4 py-2 rounded-lg bg-[#ff2fd6]/20 border border-[#ff2fd6]/60 text-[#ff9ae8] hover:bg-[#ff2fd6]/35 transition-colors"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              REINICIAR
            </button>
            <p className="text-white/40 text-[10px]">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </GameScreen>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Acción" />
    </div>
  )
}
