'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 420
const H = 520
const ROAD_L = 64
const ROAD_R = 396
const CAR_W = 24
const CAR_H = 36
const LANES_X = [106, 189, 272, 355]

// Matriz pixel-art de coche (8x12). X carrocería · L faros · G cristal · T pilotos
const CAR_PIX = [
  '..XXXX..',
  '.XXXXXX.',
  '.XLLLLX.',
  '.XGGGGX.',
  '.XXXXXX.',
  'XXXXXXXX',
  '.XXXXXX.',
  '.XGGGGX.',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XTXXTX.',
  '.TTXXTT.',
]

interface Palette {
  X: string
  L: string
  G: string
  T: string
}
const PAL_PLAYER: Palette = { X: '#E84C4C', L: '#FFF0A8', G: '#20304A', T: '#FF8A7A' }
const PAL_TAXI: Palette = { X: '#FFC531', L: '#FFF0A8', G: '#20304A', T: '#E86A5C' }
const PAL_COP: Palette = { X: '#F2F2F2', L: '#FFF0A8', G: '#20304A', T: '#E86A5C' }

function drawCarPix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pal: Palette,
) {
  const cell = 3
  for (let r = 0; r < CAR_PIX.length; r++) {
    for (let c = 0; c < CAR_PIX[r].length; c++) {
      const ch = CAR_PIX[r][c]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch as keyof Palette]
      ctx.fillRect(x + c * cell, y + r * cell, cell, cell)
    }
  }
}

interface Vehicle {
  x: number
  y: number
  kind: 'taxi' | 'cop'
  speed: number
  sway: number
  lightT: number
}
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
}
interface Building {
  y: number
  h: number
  color: string
  side: 'L' | 'R'
  seed: number
}

interface RunState {
  px: number
  py: number
  scroll: number
  dist: number
  bonus: number
  taxis: Vehicle[]
  cops: Vehicle[]
  parts: Particle[]
  buildings: Building[]
  taxiT: number
  copT: number
  wanted: number
  heatT: number
  armor: number
  invuln: number
  shake: number
  lightT: number
  started: boolean
  dead: boolean
  boosting: boolean
}

const BUILDING_COLORS = ['#1B1B30', '#22223A', '#191927', '#26263E', '#1E1E34']

function makeBuildings(): Building[] {
  const list: Building[] = []
  let y = -60
  let seed = 1
  while (y < H + 120) {
    const h = 54 + ((seed * 37) % 60)
    list.push({ y, h, color: BUILDING_COLORS[seed % BUILDING_COLORS.length], side: 'L', seed })
    list.push({ y, h, color: BUILDING_COLORS[(seed + 2) % BUILDING_COLORS.length], side: 'R', seed: seed + 5 })
    y += h + 8
    seed++
  }
  return list
}

function initial(): RunState {
  return {
    px: 210,
    py: H - 110,
    scroll: 250,
    dist: 0,
    bonus: 0,
    taxis: [],
    cops: [],
    parts: [],
    buildings: makeBuildings(),
    taxiT: 1.2,
    copT: 3,
    wanted: 0,
    heatT: 0,
    armor: 3,
    invuln: 0,
    shake: 0,
    lightT: 0,
    started: false,
    dead: false,
    boosting: false,
  }
}

function burst(s: RunState, x: number, y: number, extra: boolean) {
  const colors = ['#FFD23D', '#FF8A3D', '#E84C4C', '#8888A0']
  for (let i = 0; i < (extra ? 26 : 18); i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 50 + Math.random() * 180
    const life = 0.35 + Math.random() * 0.5
    s.parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      size: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export default function HitAndRun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [wanted, setWanted] = useState(0)
  const [armor, setArmor] = useState(3)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<RunState>(initial())
  const scoreRef = useRef(0)
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('hit-and-run'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    scoreRef.current = 0
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
    setWanted(0)
    setArmor(3)
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
    let boostWasPressed = false

    const gameOver = () => {
      overRef.current = true
      stateRef.current.dead = true
      setOver(true)
      setRunning(false)
      if (saveBest('hit-and-run', scoreRef.current)) setNewBest(true)
      setBest((b) => Math.max(b, scoreRef.current))
      sfx.gameOver()
    }

    const recalc = () => {
      const s = stateRef.current
      const total = Math.floor(s.dist / 14) + s.bonus
      if (total !== scoreRef.current) {
        scoreRef.current = total
        setScore(total)
      }
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current
      s.lightT += dt

      if (overRef.current) {
        if (jp.has('action')) restart()
        if (s.shake > 0) s.shake -= dt
        return
      }
      if (!s.started) {
        if (jp.has('up') || jp.has('down') || jp.has('left') || jp.has('right') || jp.has('action')) {
          s.started = true
          setRunning(true)
          sfx.start()
        }
        return
      }

      // ===== velocidad de crucero =====
      const base = Math.min(540, 250 + s.dist * 0.007 + s.wanted * 16)
      s.boosting = pressed.has('up')
      if (s.boosting && !boostWasPressed) sfx.boost()
      boostWasPressed = s.boosting
      const target = pressed.has('down') ? Math.max(150, base * 0.5) : base + (s.boosting ? 150 : 0)
      s.scroll += (target - s.scroll) * Math.min(1, dt * 2.2)
      s.dist += s.scroll * dt
      recalc()

      // ===== jugador =====
      const pvx = 290
      const pvy = 210
      if (pressed.has('left')) s.px -= pvx * dt
      if (pressed.has('right')) s.px += pvx * dt
      if (pressed.has('up')) s.py -= pvy * 0.4 * dt
      if (pressed.has('down')) s.py += pvy * 0.4 * dt
      s.px = Math.max(ROAD_L + 4, Math.min(ROAD_R - CAR_W - 4, s.px))
      s.py = Math.max(H - 250, Math.min(H - 60 - CAR_H, s.py))

      if (s.invuln > 0) s.invuln -= dt
      if (s.shake > 0) s.shake -= dt

      // ===== enfriamiento del nivel de búsqueda =====
      if (s.wanted > 0) {
        s.heatT += dt
        if (s.heatT > 9) {
          s.heatT = 0
          s.wanted -= 1
          setWanted(s.wanted)
        }
      }

      // ===== aparición de taxis =====
      s.taxiT -= dt
      if (s.taxiT <= 0) {
        s.taxiT = 1.4 + Math.random() * 1.5
        const lane = LANES_X[Math.floor(Math.random() * LANES_X.length)]
        const tooClose = s.taxis.some((t) => Math.abs(t.x - lane) < 40 && t.y < 170)
        if (!tooClose) {
          s.taxis.push({ x: lane - CAR_W / 2, y: -CAR_H - 10, kind: 'taxi', speed: 0.62, sway: Math.random() * Math.PI * 2, lightT: 0 })
        }
      }

      // ===== aparición de patrullas =====
      if (s.wanted >= 1) {
        s.copT -= dt
        if (s.copT <= 0) {
          s.copT = Math.max(1.25, 3.8 - s.wanted * 0.55) * (0.75 + Math.random() * 0.5)
          const lane = LANES_X[Math.floor(Math.random() * LANES_X.length)]
          const copSpeed = s.scroll * (1.14 + s.wanted * 0.035)
          s.cops.push({ x: lane - CAR_W / 2, y: -CAR_H - 10, kind: 'cop', speed: copSpeed, sway: 0, lightT: 0 })
          sfx.siren()
        }
      }

      // ===== taxis =====
      s.taxis = s.taxis.filter((t) => {
        t.y += s.scroll * t.speed * dt
        t.x += Math.sin(s.lightT * 1.4 + t.sway) * 12 * dt
        t.x = Math.max(ROAD_L + 4, Math.min(ROAD_R - CAR_W - 4, t.x))
        if (t.y > H + 60) return false
        // embestida del jugador
        if (aabb(s.px + 3, s.py + 3, CAR_W - 6, CAR_H - 6, t.x + 3, t.y + 3, CAR_W - 6, CAR_H - 6)) {
          burst(s, t.x + CAR_W / 2, t.y + CAR_H / 2, true)
          s.bonus += 150
          recalc()
          s.wanted = Math.min(5, s.wanted + 1)
          setWanted(s.wanted)
          s.heatT = 0
          s.shake = 0.3
          sfx.explode()
          return false
        }
        return true
      })

      // ===== patrullas =====
      s.cops = s.cops.filter((c) => {
        // velocidad relativa: si aceleras, se quedan atrás (hacia arriba)
        c.y += (c.speed - s.scroll) * dt
        // persecución lateral
        const dx = s.px - c.x
        c.x += Math.sign(dx) * Math.min(Math.abs(dx), (85 + s.wanted * 16) * dt)
        c.x = Math.max(ROAD_L + 4, Math.min(ROAD_R - CAR_W - 4, c.x))
        c.lightT += dt

        if (c.y < -CAR_H - 30) {
          // escapaste de la patrulla: bonificación
          s.bonus += 100
          recalc()
          sfx.coin()
          return false
        }
        if (c.y > H + 60) return false

        if (s.invuln <= 0 && aabb(s.px + 3, s.py + 3, CAR_W - 6, CAR_H - 6, c.x + 3, c.y + 3, CAR_W - 6, CAR_H - 6)) {
          burst(s, c.x + CAR_W / 2, c.y + CAR_H / 2, true)
          s.armor -= 1
          setArmor(s.armor)
          s.wanted = Math.min(5, s.wanted + 1)
          setWanted(s.wanted)
          s.invuln = 1.7
          s.shake = 0.45
          sfx.crash()
          if (s.armor <= 0) {
            gameOver()
            return false
          }
          return false
        }
        return true
      })

      // ===== partículas =====
      s.parts = s.parts.filter((p) => {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 1 - 2.2 * dt
        p.vy *= 1 - 2.2 * dt
        p.y += s.scroll * 0.4 * dt
        return p.life > 0
      })
    }

    const drawBuildings = (s: RunState) => {
      // las ventanas se generan de forma determinista por edificio
      for (const b of s.buildings) {
        const bx = b.side === 'L' ? 2 : W - 60
        ctx.fillStyle = b.color
        ctx.fillRect(bx, b.y, 58, b.h)
        ctx.fillStyle = '#0B0B16'
        ctx.fillRect(bx, b.y, 58, 3)
        for (let wy = b.y + 8; wy < b.y + b.h - 6; wy += 12) {
          for (let wx = bx + 6; wx < bx + 52; wx += 12) {
            const h = (wx * 13 + wy * 7 + b.seed * 31) % 17
            if (h < 6) {
              ctx.fillStyle = h < 2 ? '#FFE9A0' : '#C8A85C'
              ctx.fillRect(wx, wy, 4, 6)
            } else {
              ctx.fillStyle = '#12121F'
              ctx.fillRect(wx, wy, 4, 6)
            }
          }
        }
      }
    }

    const draw = () => {
      const s = stateRef.current
      ctx.save()
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * 9 * s.shake, (Math.random() - 0.5) * 9 * s.shake)
      }

      // cielo nocturno base
      ctx.fillStyle = '#0B0B16'
      ctx.fillRect(-10, -10, W + 20, H + 20)

      drawBuildings(s)

      // aceras
      ctx.fillStyle = '#2E2E42'
      ctx.fillRect(58, 0, 10, H)
      ctx.fillRect(W - 68, 0, 10, H)
      ctx.fillStyle = '#4A4A62'
      for (let y = (s.dist * 0.5) % 24 - 24; y < H; y += 24) {
        ctx.fillRect(58, y, 10, 2)
        ctx.fillRect(W - 68, y, 10, 2)
      }

      // asfalto
      ctx.fillStyle = '#161622'
      ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H)
      // charcos de luz de farolas
      const lampY = (s.dist * 0.85) % 170
      for (let y = lampY - 170; y < H + 170; y += 170) {
        const g = ctx.createRadialGradient(W / 2, y, 4, W / 2, y, 90)
        g.addColorStop(0, 'rgba(255,220,140,0.10)')
        g.addColorStop(1, 'rgba(255,220,140,0)')
        ctx.fillStyle = g
        ctx.fillRect(ROAD_L, y - 90, ROAD_R - ROAD_L, 180)
      }
      // líneas de carril
      ctx.fillStyle = '#B8B8CC'
      for (const lx of [ROAD_L + (ROAD_R - ROAD_L) / 3, ROAD_L + (2 * (ROAD_R - ROAD_L)) / 3]) {
        for (let y = (s.dist * 1) % 46 - 46; y < H; y += 46) {
          ctx.fillRect(lx - 2, y, 4, 22)
        }
      }
      // bordes
      ctx.fillStyle = '#E8E8D8'
      ctx.fillRect(ROAD_L, 0, 3, H)
      ctx.fillRect(ROAD_R - 3, 0, 3, H)

      // taxis (con rótulo)
      for (const t of s.taxis) {
        drawCarPix(ctx, t.x, t.y, PAL_TAXI)
        ctx.fillStyle = '#111'
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 0) ctx.fillRect(t.x + 4 + i * 4, t.y + 16, 4, 4)
        }
      }

      // patrullas (barra de luces alternante)
      for (const c of s.cops) {
        drawCarPix(ctx, c.x, c.y, PAL_COP)
        const on = Math.floor(c.lightT * 6) % 2 === 0
        ctx.fillStyle = on ? '#FF3B3B' : '#3B6BFF'
        ctx.fillRect(c.x + 4, c.y + 15, 7, 5)
        ctx.fillStyle = on ? '#3B6BFF' : '#FF3B3B'
        ctx.fillRect(c.x + 13, c.y + 15, 7, 5)
      }

      // jugador (parpadea si invulnerable)
      const blink = s.invuln > 0 && Math.floor(s.invuln * 9) % 2 === 0
      if (!blink) {
        // faros
        const head = ctx.createLinearGradient(0, s.py - 56, 0, s.py)
        head.addColorStop(0, 'rgba(255,240,180,0)')
        head.addColorStop(1, 'rgba(255,240,180,0.20)')
        ctx.fillStyle = head
        ctx.fillRect(s.px + 3, s.py - 56, CAR_W - 6, 56)
        drawCarPix(ctx, s.px, s.py, PAL_PLAYER)
        // llamas del escape al acelerar
        if (s.boosting && s.started) {
          ctx.fillStyle = Math.random() < 0.5 ? '#FFD23D' : '#FF8A3D'
          ctx.fillRect(s.px + 6, s.py + CAR_H, 4, 5 + Math.random() * 6)
          ctx.fillRect(s.px + CAR_W - 10, s.py + CAR_H, 4, 5 + Math.random() * 6)
        }
      }

      // partículas chunky
      for (const p of s.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1

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
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-between w-full max-w-[420px] px-1"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        <span className="text-[9px] text-[#FFC531]">PTS {score}</span>
        <span className="text-[9px] text-[#FF5D5D]" title="Nivel de búsqueda">
          {'★'.repeat(wanted)}
          {'☆'.repeat(5 - wanted)}
        </span>
        <span className="text-[9px] text-[#7DD8B7]">{armor > 0 ? '♦'.repeat(armor) : '—'}</span>
        <span className="text-[9px] text-white/60">HI {Math.max(best, score)}</span>
      </div>

      <div className="relative rounded-xl border-2 border-[#2E2E42] shadow-[0_0_40px_rgba(255,197,49,0.15)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block touch-none select-none bg-[#0B0B16]"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}`, imageRendering: 'pixelated' }}
          aria-label="Juego Hit and Run"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0B0B16]/85 text-center px-8">
            <p
              className="text-[#FFC531] text-base drop-shadow-[0_0_12px_rgba(255,197,49,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              HIT &amp; RUN
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              Embiste los <b className="text-[#FFC531]">taxis amarillos</b> para sumar puntos…
              pero cada golpe sube tu nivel de búsqueda y llegará la <b className="text-[#6B9BFF]">policía</b>.
            </p>
            <p className="text-white/50 text-[11px]">
              Muévete con ↑ ↓ ← → / WASD · mantén <b>↑</b> para el turbo y escapar
            </p>
            <p className="text-white/35 text-[10px]">Pulsa una dirección para arrancar</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0B0B16]/90 text-center px-8">
            <p
              className="text-[#FF5D5D] text-sm drop-shadow-[0_0_10px_rgba(255,93,93,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              TE ATRAPARON
            </p>
            {newBest && (
              <p className="text-[#FFC531] text-[10px] animate-pulse" style={{ fontFamily: 'var(--font-pixel)' }}>
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
              className="text-[10px] px-4 py-2 rounded bg-[#FFC531]/15 border border-[#FFC531]/60 text-[#FFC531] hover:bg-[#FFC531]/30 transition-colors"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              OTRO GOLPE
            </button>
            <p className="text-white/40 text-[10px]">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="hidden sm:block text-white/40 text-xs text-center">
        Taxi embestido +150 · patrulla escapada +100 · sin chocar 9 s baja tu nivel de búsqueda.
      </p>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Acción" />
    </div>
  )
}
