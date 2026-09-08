'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb, rr } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 520
const H = 300
const GROUND_Y = 238

type ObstacleKind = 'cactus-s' | 'cactus-b' | 'rock' | 'vulture'

interface Obstacle {
  x: number
  kind: ObstacleKind
  w: number
  h: number
  bob: number
}
interface Cloud {
  x: number
  y: number
  s: number
}
interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

interface ScoreFloat {
  x: number
  y: number
  text: string
  life: number
}

interface RunnerState {
  y: number
  vy: number
  onGround: boolean
  ducking: boolean
  legT: number
  dist: number
  speed: number
  spawnT: number
  obstacles: Obstacle[]
  clouds: Cloud[]
  dust: Dust[]
  started: boolean
  dead: boolean
  lastMilestone: number
  scoreFloats: ScoreFloat[]
  paused: boolean
}

function initial(): RunnerState {
  const clouds: Cloud[] = []
  for (let i = 0; i < 4; i++) {
    clouds.push({ x: Math.random() * W, y: 30 + Math.random() * 70, s: 0.7 + Math.random() * 0.7 })
  }
  return {
    y: GROUND_Y,
    vy: 0,
    onGround: true,
    ducking: false,
    legT: 0,
    dist: 0,
    speed: 270,
    spawnT: 1.4,
    obstacles: [],
    clouds,
    dust: [],
    started: false,
    dead: false,
    lastMilestone: 0,
    scoreFloats: [],
    paused: false,
  }
}

export default function DesertRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<RunnerState>(initial())
  const scoreRef = useRef(0)
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('desert-runner'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    scoreRef.current = 0
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
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

    const addDust = (x: number, y: number, n: number) => {
      const s = stateRef.current
      for (let i = 0; i < n; i++) {
        s.dust.push({
          x,
          y,
          vx: -60 - Math.random() * 80,
          vy: -20 - Math.random() * 40,
          life: 0.35 + Math.random() * 0.3,
        })
      }
    }

    const spawnObstacle = () => {
      const s = stateRef.current
      const roll = Math.random()
      let kind: ObstacleKind
      if (roll < 0.34) kind = 'cactus-s'
      else if (roll < 0.58) kind = 'cactus-b'
      else if (roll < 0.8) kind = 'rock'
      else kind = 'vulture'
      const dims: Record<ObstacleKind, { w: number; h: number }> = {
        'cactus-s': { w: 22, h: 42 },
        'cactus-b': { w: 34, h: 58 },
        rock: { w: 38, h: 26 },
        vulture: { w: 40, h: 26 },
      }
      const d = dims[kind]
      const y = kind === 'vulture' ? GROUND_Y - 86 : GROUND_Y - d.h
      s.obstacles.push({ x: W + 30, kind, w: d.w, h: d.h, bob: Math.random() * Math.PI * 2 })
    }

    const gameOver = () => {
      overRef.current = true
      stateRef.current.dead = true
      setOver(true)
      setRunning(false)
      if (saveBest('desert-runner', scoreRef.current)) setNewBest(true)
      setBest((b) => Math.max(b, scoreRef.current))
      sfx.crash()
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current

      // Pausa toggle
      if (s.started && !overRef.current && jp.has('pause')) {
        s.paused = !s.paused
        sfx.pause()
        return
      }
      if (s.paused) return

      // nubes siempre a la deriva
      for (const c of s.clouds) {
        c.x -= (12 + s.speed * 0.06) * c.s * dt
        if (c.x < -80) {
          c.x = W + 60
          c.y = 26 + Math.random() * 76
        }
      }

      if (overRef.current) {
        if (jp.has('action')) restart()
        return
      }
      if (!s.started) {
        if (jp.has('up') || jp.has('action')) {
          s.started = true
          setRunning(true)
          sfx.start()
          // Salto inmediato reactivo
          s.vy = -720
          s.onGround = false
          addDust(120, GROUND_Y, 6)
          sfx.jump()
        }
        return
      }

      // velocidad progresiva
      s.speed = Math.min(580, 270 + s.dist * 0.028)
      s.dist += s.speed * dt
      const sc = Math.floor(s.dist / 12)
      if (sc !== scoreRef.current) {
        scoreRef.current = sc
        setScore(sc)

        // Hito cada 100m con sonido festivo y popup
        if (sc >= s.lastMilestone + 100) {
          s.lastMilestone = Math.floor(sc / 100) * 100
          sfx.golden()
          s.scoreFloats.push({
            x: 130,
            y: GROUND_Y - 50,
            text: `¡${s.lastMilestone} m! ⭐`,
            life: 1.5,
          })
        }
      }

      // salto y agacharse
      s.ducking = s.onGround && (pressed.has('down') || pressed.has('action2'))
      if ((jp.has('up') || jp.has('action')) && s.onGround) {
        s.vy = -720
        s.onGround = false
        addDust(120, GROUND_Y, 6)
        sfx.jump()
      }
      // Salto variable: soltar corta el ascenso
      if (!s.onGround && s.vy < -260 && !pressed.has('up') && !pressed.has('action')) {
        s.vy = -260
      }
      if (!s.onGround) {
        s.vy += 2200 * dt
        s.y += s.vy * dt
        if (s.y >= GROUND_Y) {
          s.y = GROUND_Y
          s.vy = 0
          s.onGround = true
          addDust(120, GROUND_Y, 8)
          sfx.land()
        }
      }
      s.legT += dt * (s.onGround ? s.speed * 0.06 : 4)

      // polvo al correr
      if (s.onGround && Math.random() < 0.3) addDust(108, GROUND_Y - 2, 1)
      s.dust = s.dust.filter((d) => {
        d.life -= dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.vy += 120 * dt
        return d.life > 0
      })

      // flotantes de hito
      s.scoreFloats = s.scoreFloats.filter((f) => {
        f.y -= 36 * dt
        f.life -= dt
        return f.life > 0
      })

      // obstáculos
      s.spawnT -= dt
      if (s.spawnT <= 0) {
        spawnObstacle()
        const minGap = 0.55 + 130 / s.speed
        s.spawnT = minGap + Math.random() * 1.1
      }
      s.obstacles = s.obstacles.filter((o) => {
        o.x -= s.speed * dt
        o.bob += dt * 9
        return o.x > -70
      })

      // colisiones (hitbox reducida para juego justo)
      const px = 108
      const pw = s.ducking ? 52 : 40
      const ph = s.ducking ? 22 : 38
      const py = s.y - ph
      for (const o of s.obstacles) {
        const oy = o.kind === 'vulture' ? GROUND_Y - 86 + Math.sin(o.bob) * 5 : GROUND_Y - o.h
        if (aabb(px + 5, py + 4, pw - 10, ph - 6, o.x + 3, oy + 2, o.w - 6, o.h - 3)) {
          gameOver()
          return
        }
      }
    }

    const drawCactus = (x: number, groundY: number, big: boolean) => {
      const h = big ? 58 : 42
      const w = big ? 12 : 10
      ctx.fillStyle = '#3E9B4F'
      rr(ctx, x, groundY - h, w, h, 5)
      ctx.fill()
      // brazos
      ctx.fillStyle = '#3E9B4F'
      const armH = big ? 20 : 14
      rr(ctx, x - 9, groundY - h + (big ? 16 : 12), 9, 6, 3)
      ctx.fill()
      rr(ctx, x - 9, groundY - h + (big ? 16 : 12) - armH + 6, 6, armH, 3)
      ctx.fill()
      rr(ctx, x + w, groundY - h + (big ? 24 : 18), 9, 6, 3)
      ctx.fill()
      rr(ctx, x + w + 3, groundY - h + (big ? 24 : 18) - armH + 6, 6, armH, 3)
      ctx.fill()
      // flores
      ctx.fillStyle = '#FF8A7A'
      ctx.beginPath()
      ctx.arc(x + w / 2, groundY - h, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = () => {
      const s = stateRef.current
      // cielo cálido
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, '#FFE9B8')
      sky.addColorStop(1, '#FFCE7A')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND_Y)

      // sol
      ctx.fillStyle = 'rgba(255,166,77,0.5)'
      ctx.beginPath()
      ctx.arc(438, 62, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFB25C'
      ctx.beginPath()
      ctx.arc(438, 62, 26, 0, Math.PI * 2)
      ctx.fill()

      // nubes planas
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const c of s.clouds) {
        rr(ctx, c.x, c.y, 56 * c.s, 12 * c.s, 6 * c.s)
        ctx.fill()
        rr(ctx, c.x + 12 * c.s, c.y - 8 * c.s, 30 * c.s, 12 * c.s, 6 * c.s)
        ctx.fill()
      }

      // dunas de fondo
      ctx.fillStyle = '#F5B961'
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y - 26)
      ctx.quadraticCurveTo(90, GROUND_Y - 78, 190, GROUND_Y - 30)
      ctx.quadraticCurveTo(260, GROUND_Y - 6, 330, GROUND_Y - 40)
      ctx.quadraticCurveTo(430, GROUND_Y - 84, 520, GROUND_Y - 28)
      ctx.lineTo(W, GROUND_Y)
      ctx.lineTo(0, GROUND_Y)
      ctx.fill()

      // suelo
      ctx.fillStyle = '#E8A94F'
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
      ctx.fillStyle = '#D98F3E'
      ctx.fillRect(0, GROUND_Y, W, 5)
      // piedrecillas que se desplazan
      ctx.fillStyle = 'rgba(197,124,50,0.55)'
      const off = (s.dist * 0.9) % 60
      for (let i = 0; i < 10; i++) {
        const px2 = ((i * 60 - off) % (W + 60) + W + 60) % (W + 60) - 30
        ctx.beginPath()
        ctx.arc(px2, GROUND_Y + 14 + ((i * 13) % 26), 2.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // obstáculos
      for (const o of s.obstacles) {
        if (o.kind === 'cactus-s') drawCactus(o.x, GROUND_Y, false)
        else if (o.kind === 'cactus-b') drawCactus(o.x, GROUND_Y, true)
        else if (o.kind === 'rock') {
          ctx.fillStyle = '#B4763B'
          ctx.beginPath()
          ctx.ellipse(o.x + o.w / 2, GROUND_Y - o.h / 2 + 4, o.w / 2, o.h / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#C98A4B'
          ctx.beginPath()
          ctx.ellipse(o.x + o.w / 2 - 4, GROUND_Y - o.h / 2, o.w / 3.2, o.h / 3.4, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // buitre volador
          const oy = GROUND_Y - 86 + Math.sin(o.bob) * 5
          const flap = Math.sin(o.bob * 1.6)
          ctx.fillStyle = '#6B4A8C'
          ctx.beginPath()
          ctx.ellipse(o.x + 20, oy + 13, 13, 8, 0, 0, Math.PI * 2)
          ctx.fill()
          // alas
          ctx.beginPath()
          ctx.moveTo(o.x + 16, oy + 12)
          ctx.quadraticCurveTo(o.x + 4, oy + 12 - flap * 14, o.x - 4, oy + 6 - flap * 10)
          ctx.quadraticCurveTo(o.x + 8, oy + 14, o.x + 18, oy + 16)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(o.x + 24, oy + 12)
          ctx.quadraticCurveTo(o.x + 36, oy + 12 - flap * 14, o.x + 44, oy + 6 - flap * 10)
          ctx.quadraticCurveTo(o.x + 32, oy + 14, o.x + 22, oy + 16)
          ctx.fill()
          // cabeza
          ctx.fillStyle = '#E86A5C'
          ctx.beginPath()
          ctx.arc(o.x + 32, oy + 10, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#FFD23D'
          ctx.beginPath()
          ctx.moveTo(o.x + 36, oy + 9)
          ctx.lineTo(o.x + 43, oy + 11)
          ctx.lineTo(o.x + 36, oy + 13)
          ctx.fill()
        }
      }

      // polvo
      for (const d of s.dust) {
        ctx.globalAlpha = Math.max(0, d.life * 2)
        ctx.fillStyle = '#E8C08A'
        ctx.beginPath()
        ctx.arc(d.x, d.y, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // corredor: armadillo cartoon
      const bx = 108
      const bodyY = s.y
      const duck = s.ducking
      const bodyH = duck ? 22 : 30
      const bodyW = duck ? 52 : 42
      const bob = s.onGround ? Math.sin(s.legT) * 1.6 : 0
      // patas
      ctx.strokeStyle = '#8A4B2A'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      if (s.onGround) {
        const a1 = Math.sin(s.legT) * 7
        const a2 = Math.sin(s.legT + Math.PI) * 7
        ctx.beginPath()
        ctx.moveTo(bx + 12, bodyY - 6)
        ctx.lineTo(bx + 12 + a1, bodyY - 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx + bodyW - 12, bodyY - 6)
        ctx.lineTo(bx + bodyW - 12 + a2, bodyY - 0.5)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(bx + 14, bodyY - 8)
        ctx.lineTo(bx + 10, bodyY - 1)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx + bodyW - 14, bodyY - 8)
        ctx.lineTo(bx + bodyW - 10, bodyY - 1)
        ctx.stroke()
      }
      // cola
      ctx.beginPath()
      ctx.moveTo(bx + 2, bodyY - bodyH + 10 + bob)
      ctx.quadraticCurveTo(bx - 12, bodyY - bodyH + 2 + bob, bx - 14, bodyY - bodyH + 14 + bob)
      ctx.strokeStyle = '#C96F3B'
      ctx.lineWidth = 5
      ctx.stroke()
      // cuerpo
      ctx.fillStyle = '#D98241'
      rr(ctx, bx, bodyY - bodyH + bob, bodyW, bodyH - 2, 12)
      ctx.fill()
      // panza
      ctx.fillStyle = '#F2C48D'
      rr(ctx, bx + 8, bodyY - bodyH * 0.55 + bob, bodyW - 18, bodyH * 0.42, 8)
      ctx.fill()
      // caparazón de placas
      ctx.fillStyle = '#B45E2C'
      rr(ctx, bx + 4, bodyY - bodyH + bob + 2, bodyW - 8, bodyH * 0.5, 10)
      ctx.fill()
      // ojo
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(bx + bodyW - 10, bodyY - bodyH + 10 + bob, 4.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2B1B10'
      ctx.beginPath()
      ctx.arc(bx + bodyW - 8.4, bodyY - bodyH + 10 + bob, 2.2, 0, Math.PI * 2)
      ctx.fill()
      // hocico
      ctx.fillStyle = '#E89A5D'
      ctx.beginPath()
      ctx.arc(bx + bodyW - 2, bodyY - bodyH * 0.62 + bob, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5C3317'
      ctx.beginPath()
      ctx.arc(bx + bodyW + 0.5, bodyY - bodyH * 0.62 + bob, 1.8, 0, Math.PI * 2)
      ctx.fill()

      // marcador dentro del canvas (estilo cartoon)
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif'
      ctx.fillStyle = 'rgba(122,62,20,0.85)'
      ctx.textAlign = 'right'
      ctx.fillText(`${scoreRef.current} m`, W - 14, 28)
      ctx.textAlign = 'left'

      // Textos flotantes de hito
      for (const f of s.scoreFloats) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5))
        ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#8A4B2A'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y)
        ctx.restore()
      }

      // Overlay de pausa
      if (s.paused) {
        ctx.fillStyle = 'rgba(43,27,16,0.55)'
        ctx.fillRect(0, 0, W, H)
        ctx.font = 'bold 26px monospace'
        ctx.fillStyle = '#FFE9B8'
        ctx.textAlign = 'center'
        ctx.fillText('PAUSA (P)', W / 2, H / 2)
        ctx.textAlign = 'left'
      }
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
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[520px] px-1">
        <span className="text-sm font-bold text-[#B45E2C]">
          🏜️ {score} m
        </span>
        <span className="text-sm font-bold text-[#8A4B2A]">
          Récord: {Math.max(best, score)} m
        </span>
      </div>

      <div className="relative rounded-3xl border-4 border-[#D98F3E] shadow-[0_14px_40px_rgba(217,143,62,0.35)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block touch-none select-none"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}` }}
          aria-label="Juego Corredor del Desierto"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#FFE9B8]/80 backdrop-blur-[1px] text-center px-6">
            <p className="text-3xl font-extrabold text-[#8A4B2A]">Armadillo veloz</p>
            <p className="text-[#7A3E14] text-sm">
              Salta con <b>↑ / W</b> y agáchate con <b>↓ / S</b>
            </p>
            <p className="text-[#7A3E14]/70 text-xs">Pulsa salto para comenzar la carrera</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FFE9B8]/88 backdrop-blur-[1px] text-center px-6">
            <p className="text-3xl font-extrabold text-[#B45E2C]">¡Ay, chocaste!</p>
            {newBest && <p className="text-[#3E9B4F] font-bold animate-pulse">¡Nuevo récord! 🏆</p>}
            <p className="text-[#7A3E14] text-sm">Recorriste {score} metros por el desierto</p>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                restart()
              }}
              className="px-5 py-2.5 rounded-full bg-[#3E9B4F] text-white font-bold shadow-lg hover:bg-[#358543] transition-colors"
            >
              Correr otra vez
            </button>
            <p className="text-[#7A3E14]/60 text-xs">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="hidden sm:block text-white/40 text-xs text-center">
        Los cactus y rocas se saltan; los buitres se esquivan agachándose. La velocidad no perdona.
      </p>

      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Saltar"
        actionGlyph="A"
        showAction2
        action2Label="Agachar"
        action2Glyph="B"
      />
    </div>
  )
}
