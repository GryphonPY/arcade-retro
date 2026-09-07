'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb, rr } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 380
const H = 520
const ROAD_X = 40
const ROAD_W = 300
const LANES = 4
const LANE_W = ROAD_W / LANES

const PLAYER_W = 42
const PLAYER_H = 72

interface Car {
  x: number
  y: number
  w: number
  h: number
  speed: number
  color: string
  passed: boolean
}
interface Puff {
  x: number
  y: number
  r: number
  life: number
}

interface RaceState {
  playerX: number
  playerY: number
  speed: number
  dist: number
  cars: Car[]
  spawnT: number
  laneDash: number
  puffs: Puff[]
  started: boolean
  dead: boolean
  shakeT: number
}

const CAR_COLORS = ['#4C8DE8', '#58C27D', '#E8B54C', '#B06CE8', '#E87A4C', '#7DC4E8', '#C4C9D4']

function laneCenter(lane: number) {
  return ROAD_X + lane * LANE_W + LANE_W / 2
}

function initial(): RaceState {
  return {
    playerX: laneCenter(1) + LANE_W / 2,
    playerY: H - 110,
    speed: 330,
    dist: 0,
    cars: [],
    spawnT: 0.9,
    laneDash: 0,
    puffs: [],
    started: false,
    dead: false,
    shakeT: 0,
  }
}

export default function TrafficRacer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<RaceState>(initial())
  const scoreRef = useRef(0)
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('traffic-racer'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    scoreRef.current = 0
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
    setSpeedKmh(0)
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

    const drawCar = (x: number, y: number, w: number, h: number, color: string, isPlayer: boolean) => {
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      rr(ctx, x + 3, y + 5, w, h, 10)
      ctx.fill()
      // carrocería
      const grad = ctx.createLinearGradient(x, 0, x + w, 0)
      grad.addColorStop(0, color)
      grad.addColorStop(0.5, lighten(color, 22))
      grad.addColorStop(1, color)
      ctx.fillStyle = grad
      rr(ctx, x, y, w, h, 10)
      ctx.fill()
      // techo / cristales
      ctx.fillStyle = 'rgba(20,26,36,0.85)'
      rr(ctx, x + 5, y + h * 0.3, w - 10, h * 0.26, 5)
      ctx.fill()
      ctx.fillStyle = 'rgba(20,26,36,0.65)'
      rr(ctx, x + 6, y + h * 0.68, w - 12, h * 0.14, 4)
      ctx.fill()
      // faros
      ctx.fillStyle = '#FFEFA8'
      rr(ctx, x + 5, y + (isPlayer ? 1 : h - 6), 9, 5, 2)
      ctx.fill()
      rr(ctx, x + w - 14, y + (isPlayer ? 1 : h - 6), 9, 5, 2)
      ctx.fill()
      // pilotos
      ctx.fillStyle = isPlayer ? '#FF5D5D' : '#E8D24C'
      rr(ctx, x + 5, y + (isPlayer ? h - 6 : 1), 9, 5, 2)
      ctx.fill()
      rr(ctx, x + w - 14, y + (isPlayer ? h - 6 : 1), 9, 5, 2)
      ctx.fill()
    }

    function lighten(hex: string, amt: number) {
      const n = parseInt(hex.slice(1), 16)
      const r = Math.min(255, ((n >> 16) & 255) + amt)
      const g = Math.min(255, ((n >> 8) & 255) + amt)
      const b = Math.min(255, (n & 255) + amt)
      return `rgb(${r},${g},${b})`
    }

    const spawnCar = (s: RaceState) => {
      // elegir carril evitando bloquear todos los carriles
      const lane = Math.floor(Math.random() * LANES)
      const occupied = s.cars.filter((c) => c.y < 130).length
      if (occupied >= LANES - 1) return
      // no apilar dos coches muy cerca en el mismo carril
      const cx = laneCenter(lane)
      const tooClose = s.cars.some((c) => Math.abs(c.x - cx) < LANE_W * 0.7 && c.y < 220)
      if (tooClose) return
      const w = 40 + Math.random() * 8
      const h = w * 1.7
      s.cars.push({
        x: cx - w / 2,
        y: -h - 20,
        w,
        h,
        speed: 110 + Math.random() * 130,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        passed: false,
      })
    }

    const crash = () => {
      const s = stateRef.current
      s.dead = true
      overRef.current = true
      s.shakeT = 0.5
      setOver(true)
      setRunning(false)
      if (saveBest('traffic-racer', scoreRef.current)) setNewBest(true)
      setBest((b) => Math.max(b, scoreRef.current))
      sfx.crash()
      sfx.gameOver()
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current

      // líneas de carril siempre animadas
      s.laneDash = (s.laneDash + s.speed * dt) % 64

      if (overRef.current) {
        if (jp.has('action')) restart()
        if (s.shakeT > 0) s.shakeT -= dt
        return
      }
      if (!s.started) {
        if (pressed.has('left') || pressed.has('right') || jp.has('up') || jp.has('action')) {
          s.started = true
          setRunning(true)
          sfx.start()
        }
        return
      }

      // aceleración progresiva + boost/freno
      const boosting = pressed.has('up')
      const braking = pressed.has('down')
      const target = Math.min(640, 330 + s.dist * 0.012) + (boosting ? 110 : 0) - (braking ? 150 : 0)
      s.speed += (target - s.speed) * Math.min(1, dt * 1.8)
      s.speed = Math.max(160, s.speed)
      s.dist += s.speed * dt
      const meters = Math.floor(s.dist / 8)
      if (meters !== scoreRef.current) {
        scoreRef.current = meters
        setScore(meters)
        setSpeedKmh(Math.round(s.speed * 0.42))
      }

      // movimiento lateral suave
      const vx = 300
      if (pressed.has('left')) s.playerX -= vx * dt
      if (pressed.has('right')) s.playerX += vx * dt
      s.playerX = Math.max(ROAD_X + 6, Math.min(ROAD_X + ROAD_W - PLAYER_W - 6, s.playerX))

      // humo del escape
      if (Math.random() < 0.5) {
        s.puffs.push({ x: s.playerX + PLAYER_W / 2 + (Math.random() * 16 - 8), y: s.playerY + PLAYER_H, r: 2 + Math.random() * 3, life: 0.5 })
      }
      s.puffs = s.puffs.filter((p) => {
        p.life -= dt
        p.y += 40 * dt
        p.r += 8 * dt
        return p.life > 0
      })

      // tráfico
      s.spawnT -= dt
      if (s.spawnT <= 0) {
        spawnCar(s)
        s.spawnT = Math.max(0.42, 1.35 - s.dist * 0.00012) * (0.7 + Math.random() * 0.6)
      }
      s.cars = s.cars.filter((c) => {
        const rel = s.speed - c.speed
        c.y += rel * dt
        return c.y < H + 120
      })

      // colisión
      for (const c of s.cars) {
        if (aabb(s.playerX + 4, s.playerY + 4, PLAYER_W - 8, PLAYER_H - 8, c.x + 4, c.y + 4, c.w - 8, c.h - 8)) {
          crash()
          return
        }
      }
    }

    const draw = () => {
      const s = stateRef.current
      ctx.save()
      if (s.shakeT > 0) {
        ctx.translate((Math.random() - 0.5) * 8 * s.shakeT, (Math.random() - 0.5) * 8 * s.shakeT)
      }

      // arcén / terreno crepuscular
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#2B2436')
      bg.addColorStop(1, '#1D1A26')
      ctx.fillStyle = bg
      ctx.fillRect(-10, -10, W + 20, H + 20)

      // asfalto
      const road = ctx.createLinearGradient(ROAD_X, 0, ROAD_X + ROAD_W, 0)
      road.addColorStop(0, '#3A3D44')
      road.addColorStop(0.5, '#44484F')
      road.addColorStop(1, '#3A3D44')
      ctx.fillStyle = road
      ctx.fillRect(ROAD_X, 0, ROAD_W, H)

      // textura del asfalto (motas)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      const scroll = (s.dist * 0.9) % 22
      for (let i = 0; i < 60; i++) {
        const gx = ROAD_X + ((i * 53) % ROAD_W)
        const gy = ((i * 97 + scroll) % H)
        ctx.fillRect(gx, gy, 2, 2)
      }

      // bordes con franjas rojas/blancas
      const stripeH = 26
      const off = (s.dist * 1.0) % (stripeH * 2)
      for (let y = -stripeH * 2 + off; y < H + stripeH * 2; y += stripeH * 2) {
        ctx.fillStyle = '#E84C4C'
        ctx.fillRect(ROAD_X - 7, y, 7, stripeH)
        ctx.fillStyle = '#F2F2EC'
        ctx.fillRect(ROAD_X - 7, y + stripeH, 7, stripeH)
        ctx.fillStyle = '#E84C4C'
        ctx.fillRect(ROAD_X + ROAD_W, y, 7, stripeH)
        ctx.fillStyle = '#F2F2EC'
        ctx.fillRect(ROAD_X + ROAD_W, y + stripeH, 7, stripeH)
      }

      // líneas discontinuas de carril
      ctx.fillStyle = 'rgba(242,242,236,0.85)'
      for (let l = 1; l < LANES; l++) {
        const x = ROAD_X + l * LANE_W - 2.5
        for (let y = -64 + s.laneDash; y < H; y += 64) {
          ctx.fillRect(x, y, 5, 34)
        }
      }

      // tráfico
      for (const c of s.cars) {
        // cono de luz frontal hacia abajo (van en tu misma dirección, de frente los ves por detrás)
        if (c.speed < s.speed) {
          const gl = ctx.createLinearGradient(0, c.y + c.h, 0, c.y + c.h + 60)
          gl.addColorStop(0, 'rgba(255,240,180,0.16)')
          gl.addColorStop(1, 'rgba(255,240,180,0)')
          ctx.fillStyle = gl
          ctx.fillRect(c.x + 4, c.y + c.h, c.w - 8, 60)
        }
        drawCar(c.x, c.y, c.w, c.h, c.color, false)
      }

      // humo
      for (const p of s.puffs) {
        ctx.globalAlpha = Math.max(0, p.life) * 0.6
        ctx.fillStyle = '#9AA0AC'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // jugador con faros
      const head = ctx.createLinearGradient(0, s.playerY - 70, 0, s.playerY)
      head.addColorStop(0, 'rgba(255,240,180,0)')
      head.addColorStop(1, 'rgba(255,240,180,0.22)')
      ctx.fillStyle = head
      ctx.fillRect(s.playerX + 4, s.playerY - 70, PLAYER_W - 8, 70)
      drawCar(s.playerX, s.playerY, PLAYER_W, PLAYER_H, '#E83A3A', true)

      // líneas de velocidad
      if (s.started && s.speed > 460) {
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const x = 14 + (i * 61) % (W - 28)
          const y = ((s.dist * 2.2 + i * 137) % (H + 80)) - 40
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + 34)
        }
        ctx.stroke()
      }

      // velocímetro
      ctx.fillStyle = 'rgba(10,10,16,0.55)'
      rr(ctx, W - 116, 12, 104, 34, 8)
      ctx.fill()
      ctx.fillStyle = '#E85D5D'
      ctx.font = 'bold 16px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(s.speed * 0.42)} km/h`, W - 64, 34)

      ctx.restore()
      ctx.textAlign = 'left'
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
      <div className="flex items-center justify-between w-full max-w-[380px] px-1">
        <span className="text-sm font-bold text-[#E85D5D]" style={{ fontFamily: 'ui-monospace, monospace' }}>
          {score} m
        </span>
        <span className="text-sm font-bold text-white/60" style={{ fontFamily: 'ui-monospace, monospace' }}>
          Récord: {Math.max(best, score)} m
        </span>
      </div>

      <div className="relative rounded-2xl border-2 border-[#4A4E58] shadow-[0_14px_40px_rgba(0,0,0,0.5)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block touch-none select-none bg-[#1D1A26]"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}` }}
          aria-label="Juego Carrera de Tráfico"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#14121C]/85 text-center px-8">
            <p className="text-2xl font-extrabold text-[#E85D5D] tracking-wide" style={{ fontFamily: 'ui-monospace, monospace' }}>
              TRÁFICO NOCTURNO
            </p>
            <p className="text-white/70 text-sm">
              ← → / A D para cambiar de carril
            </p>
            <p className="text-white/50 text-xs">
              ↑ / W acelera · ↓ / S frena
            </p>
            <p className="text-white/40 text-[11px]">Pulsa una dirección para arrancar</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#14121C]/90 text-center px-8">
            <p className="text-2xl font-extrabold text-[#E85D5D]">💥 Choque</p>
            {newBest && <p className="text-[#FFD23D] font-bold animate-pulse">¡Nuevo récord!</p>}
            <p className="text-white/80 text-sm">Recorriste {score} m a {speedKmh} km/h</p>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                restart()
              }}
              className="px-5 py-2.5 rounded-lg bg-[#E85D5D] text-white font-bold shadow-lg hover:bg-[#D44A4A] transition-colors"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              OTRA CARRERA
            </button>
            <p className="text-white/40 text-xs">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="hidden sm:block text-white/40 text-xs text-center">
        El acelerón suma metros más rápido… si tienes reflejos. Los frenazos también salvan.
      </p>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Acción" />
    </div>
  )
}
