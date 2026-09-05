'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, drawMatrix, aabb } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 480
const H = 520

const SQUID = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '..X..X..',
  '.X.XX.X.',
  'X.X..X.X',
]
const SQUID_B = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '.X.XX.X.',
  'X......X',
  '.X....X.',
]
const CRAB = [
  '..X.....X..',
  '...X...X...',
  '..XXXXXXX..',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'X.XXXXXXX.X',
  'X.X.....X.X',
  '...XX.XX...',
]
const CRAB_B = [
  '..X.....X..',
  'X..X...X..X',
  'X.XXXXXXX.X',
  'XXX.XXX.XXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..X.....X..',
  '.X.......X.',
]
const SHIP = [
  '....X....',
  '....X....',
  '...XXX...',
  '..XXXXX..',
  '.XXXXXXX.',
  'XX.XXX.XX',
]

const COLS = 9
const ROWS = 4
const INV_W = 11 * 3
const INV_H = 8 * 3
const GAP_X = 42
const GAP_Y = 38
const FORM_X = (W - COLS * GAP_X) / 2 + 8
const FORM_TOP = 84

interface Bullet {
  x: number
  y: number
  vy: number
  enemy?: boolean
}
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface SpaceState {
  shipX: number
  shipY: number
  invuln: number
  alive: boolean[][]
  formX: number
  formY: number
  dirSign: number
  speed: number
  frameT: number
  frame: number
  bullets: Bullet[]
  cooldown: number
  enemyFireT: number
  particles: Particle[]
  stars: { x: number; y: number; s: number; layer: number }[]
  wave: number
  lives: number
  started: boolean
  dead: boolean
  hitFlash: number
}

function makeStars() {
  const stars: SpaceState['stars'] = []
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 1 + Math.random() * 2,
      layer: Math.floor(Math.random() * 3),
    })
  }
  return stars
}

function initial(): SpaceState {
  return {
    shipX: W / 2,
    shipY: H - 74,
    invuln: 0,
    alive: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => true)),
    formX: FORM_X,
    formY: FORM_TOP,
    dirSign: 1,
    speed: 26,
    frameT: 0,
    frame: 0,
    bullets: [],
    cooldown: 0,
    enemyFireT: 1,
    particles: [],
    stars: makeStars(),
    wave: 1,
    lives: 3,
    started: false,
    dead: false,
    hitFlash: 0,
  }
}

function rowMat(i: number) {
  return i < 2 ? SQUID : CRAB
}
function rowColor(i: number) {
  return i < 2 ? '#ff71ce' : '#5fe8de'
}
function rowPoints(i: number) {
  return i < 2 ? 30 : 20
}

export default function SpaceInvasion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<SpaceState>(initial())
  const scoreRef = useRef(0)
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('space-invasion'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    scoreRef.current = 0
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
    setLives(3)
    setWave(1)
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

    const burst = (x: number, y: number, color: string, count = 12) => {
      const s = stateRef.current
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 40 + Math.random() * 140
        s.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.4 + Math.random() * 0.4,
          color,
        })
      }
    }

    const gameOver = () => {
      overRef.current = true
      stateRef.current.dead = true
      setOver(true)
      setRunning(false)
      if (saveBest('space-invasion', scoreRef.current)) setNewBest(true)
      setBest((b) => Math.max(b, scoreRef.current))
      sfx.gameOver()
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current

      // estrellas siempre en movimiento
      const layerSpeed = [14, 34, 70]
      for (const st of s.stars) {
        st.y += layerSpeed[st.layer] * dt
        if (st.y > H) {
          st.y = -2
          st.x = Math.random() * W
        }
      }
      s.frameT += dt
      if (s.frameT > 0.42) {
        s.frameT = 0
        s.frame = 1 - s.frame
      }
      // partículas
      s.particles = s.particles.filter((p) => {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        return p.life > 0
      })
      if (s.hitFlash > 0) s.hitFlash -= dt
      if (s.invuln > 0) s.invuln -= dt

      if (overRef.current || !s.started) {
        if (overRef.current && jp.has('action')) restart()
        if (!s.started &&
          (jp.has('up') || jp.has('down') || jp.has('left') || jp.has('right') || jp.has('action'))
        ) {
          s.started = true
          setRunning(true)
          sfx.start()
        }
        return
      }

      // movimiento nave
      const spd = 240
      let dx = 0
      let dy = 0
      if (pressed.has('left')) dx -= 1
      if (pressed.has('right')) dx += 1
      if (pressed.has('up')) dy -= 1
      if (pressed.has('down')) dy += 1
      s.shipX = Math.max(24, Math.min(W - 24, s.shipX + dx * spd * dt))
      s.shipY = Math.max(H - 190, Math.min(H - 40, s.shipY + dy * spd * dt))

      // disparo
      s.cooldown -= dt
      if (pressed.has('action') && s.cooldown <= 0) {
        s.cooldown = 0.26
        s.bullets.push({ x: s.shipX, y: s.shipY - 16, vy: -540 })
        sfx.shoot()
      }

      // formación invasores
      let anyAlive = false
      let leftEdge = Infinity
      let rightEdge = -Infinity
      let bottomEdge = -Infinity
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!s.alive[r][c]) continue
          anyAlive = true
          const x = s.formX + c * GAP_X
          const y = s.formY + r * GAP_Y
          leftEdge = Math.min(leftEdge, x)
          rightEdge = Math.max(rightEdge, x + INV_W)
          bottomEdge = Math.max(bottomEdge, y + INV_H)
        }
      }
      if (!anyAlive) {
        // oleada superada
        s.wave += 1
        setWave(s.wave)
        scoreRef.current += 100
        setScore(scoreRef.current)
        sfx.levelUp()
        s.alive = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => true))
        s.formY = FORM_TOP
        s.dirSign = 1
        s.speed = 26 + (s.wave - 1) * 9
        s.bullets = s.bullets.filter((b) => !b.enemy)
        return
      }

      s.formX += s.dirSign * s.speed * dt
      if (rightEdge > W - 8 && s.dirSign > 0) {
        s.dirSign = -1
        s.formY += 18
      } else if (leftEdge < 8 && s.dirSign < 0) {
        s.dirSign = 1
        s.formY += 18
      }
      if (bottomEdge >= s.shipY - 14) {
        gameOver()
        return
      }

      // fuego enemigo
      s.enemyFireT -= dt
      if (s.enemyFireT <= 0) {
        s.enemyFireT = Math.max(0.35, 1.15 - s.wave * 0.12) * (0.6 + Math.random() * 0.8)
        const colsAlive: number[] = []
        for (let c = 0; c < COLS; c++) {
          for (let r = ROWS - 1; r >= 0; r--) {
            if (s.alive[r][c]) {
              colsAlive.push(c)
              break
            }
          }
        }
        if (colsAlive.length > 0) {
          const c = colsAlive[Math.floor(Math.random() * colsAlive.length)]
          let r = 0
          for (let rr2 = ROWS - 1; rr2 >= 0; rr2--) {
            if (s.alive[rr2][c]) {
              r = rr2
              break
            }
          }
          s.bullets.push({
            x: s.formX + c * GAP_X + INV_W / 2,
            y: s.formY + r * GAP_Y + INV_H,
            vy: 190 + s.wave * 18,
            enemy: true,
          })
        }
      }

      // balas
      s.bullets = s.bullets.filter((b) => {
        b.y += b.vy * dt
        if (b.y < -10 || b.y > H + 10) return false
        if (b.enemy) {
          if (
            s.invuln <= 0 &&
            aabb(b.x - 2, b.y - 5, 4, 10, s.shipX - 14, s.shipY - 12, 28, 26)
          ) {
            burst(s.shipX, s.shipY, '#ffd23d', 18)
            s.lives -= 1
            setLives(s.lives)
            s.invuln = 1.6
            s.hitFlash = 0.25
            sfx.explode()
            if (s.lives <= 0) gameOver()
            return false
          }
          return true
        }
        // bala del jugador vs invasores
        for (let r = ROWS - 1; r >= 0; r--) {
          for (let c = 0; c < COLS; c++) {
            if (!s.alive[r][c]) continue
            const ix = s.formX + c * GAP_X
            const iy = s.formY + r * GAP_Y
            if (aabb(b.x - 2, b.y - 6, 4, 12, ix, iy, INV_W, INV_H)) {
              s.alive[r][c] = false
              burst(ix + INV_W / 2, iy + INV_H / 2, rowColor(r))
              scoreRef.current += rowPoints(r)
              setScore(scoreRef.current)
              sfx.pop()
              return false
            }
          }
        }
        return true
      })
    }

    const draw = () => {
      const s = stateRef.current
      // fondo espacial
      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, W, H)
      for (const st of s.stars) {
        const alpha = [0.35, 0.6, 0.95][st.layer]
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fillRect(st.x, st.y, st.s, st.s)
      }

      // invasores
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!s.alive[r][c]) continue
          const m = r < 2 ? (s.frame ? SQUID_B : SQUID) : s.frame ? CRAB_B : CRAB
          drawMatrix(ctx, m, s.formX + c * GAP_X, s.formY + r * GAP_Y, 3, rowColor(r))
        }
      }

      // balas
      for (const b of s.bullets) {
        if (b.enemy) {
          ctx.fillStyle = '#ff5d5d'
          ctx.fillRect(b.x - 2, b.y, 4, 9)
        } else {
          ctx.fillStyle = '#ffe23d'
          ctx.fillRect(b.x - 2, b.y - 8, 4, 12)
        }
      }

      // nave (parpadea si invulnerable)
      const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0
      if (!s.dead && !blink) {
        drawMatrix(ctx, SHIP, s.shipX - 18, s.shipY - 12, 4, '#7cff6b')
        // propulsor
        ctx.fillStyle = s.frame ? '#ffd23d' : '#ff8a3d'
        ctx.fillRect(s.shipX - 4, s.shipY + 12, 8, 4 + Math.random() * 4)
      }

      // partículas
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life * 2)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      }
      ctx.globalAlpha = 1

      if (s.hitFlash > 0) {
        ctx.fillStyle = `rgba(255,60,60,${s.hitFlash})`
        ctx.fillRect(0, 0, W, H)
      }

      // vidas como naves mini
      for (let i = 0; i < s.lives; i++) {
        drawMatrix(ctx, SHIP, 14 + i * 34, H - 26, 3, '#7cff6b')
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
      <div
        className="flex items-center justify-between w-full max-w-[480px] px-1"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        <span className="text-[9px] text-[#7cff6b] drop-shadow-[0_0_6px_rgba(124,255,107,0.8)]">
          PTS {score}
        </span>
        <span className="text-[9px] text-[#ff71ce] drop-shadow-[0_0_6px_rgba(255,113,206,0.8)]">
          OLEADA {wave}
        </span>
        <span className="text-[9px] text-[#ffe23d] drop-shadow-[0_0_6px_rgba(255,226,61,0.8)]">
          HI {Math.max(best, score)}
        </span>
      </div>

      <div className="relative rounded-lg border-2 border-[#2a2a55] shadow-[0_0_40px_rgba(95,232,222,0.18)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block bg-[#050510]"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}` }}
          aria-label="Juego Invasión Espacial"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#050510]/85 text-center px-6">
            <p
              className="text-[#5fe8de] text-sm drop-shadow-[0_0_10px_rgba(95,232,222,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              INVASIÓN ESPACIAL
            </p>
            <p className="text-white/70 text-xs">
              Muévete con ↑ ↓ ← → / WASD y dispara con ESPACIO
            </p>
            <p className="text-white/40 text-[11px]">Pulsa cualquier dirección para despegar</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#050510]/90 text-center px-6">
            <p
              className="text-[#ff5d5d] text-sm drop-shadow-[0_0_10px_rgba(255,93,93,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              FIN DE LA MISIÓN
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
              className="text-[10px] px-4 py-2 rounded bg-[#5fe8de]/15 border border-[#5fe8de]/60 text-[#5fe8de] hover:bg-[#5fe8de]/30 transition-colors"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              REINTENTAR
            </button>
            <p className="text-white/40 text-[10px]">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="text-white/40 text-xs text-center">
        Vida extra: esquiva los disparos rojos. Limpiar una oleada suma 100 puntos.
      </p>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction />
    </div>
  )
}
