'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys, type Dir } from './use-keys'
import { loadBest, saveBest } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '#......#...#......#',
  '#.####.#####.####.#',
  '#......#...#......#',
  '####.###.#.###.####',
  '#....#.......#....#',
  '#.##.#.#####.#.##.#',
  '#o.......P.......o#',
  '###################',
]
const ROWS = MAZE.length
const COLS = MAZE[0].length
const T = 26
const W = COLS * T
const H = ROWS * T

const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

interface Tile {
  c: number
  r: number
}
interface Ghost {
  tile: Tile
  target: Tile | null
  dir: Dir
  px: number
  py: number
  color: string
  home: Tile
}

interface MazeState {
  walls: boolean[][]
  pellets: boolean[][]
  power: boolean[][]
  pelletCount: number
  totalPellets: number
  player: { tile: Tile; target: Tile | null; dir: Dir; want: Dir | null; px: number; py: number }
  ghosts: Ghost[]
  lives: number
  level: number
  score: number
  pauseT: number
  levelFlash: number
  mouthT: number
  started: boolean
  dead: boolean
}

function isWall(state: MazeState, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true
  return state.walls[r][c]
}

function centerOf(t: Tile) {
  return { x: t.c * T + T / 2, y: t.r * T + T / 2 }
}

function buildMaze(): MazeState {
  const walls: boolean[][] = []
  const pellets: boolean[][] = []
  const power: boolean[][] = []
  let pelletCount = 0
  let playerTile: Tile = { c: 9, r: 13 }
  for (let r = 0; r < ROWS; r++) {
    walls[r] = []
    pellets[r] = []
    power[r] = []
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE[r][c]
      walls[r][c] = ch === '#'
      pellets[r][c] = ch === '.'
      power[r][c] = ch === 'o'
      if (ch === '.' || ch === 'o') pelletCount++
      if (ch === 'P') playerTile = { c, r }
    }
  }
  const state: MazeState = {
    walls,
    pellets,
    power,
    pelletCount,
    totalPellets: pelletCount,
    player: { tile: playerTile, target: null, dir: 'left', want: null, px: 0, py: 0 },
    ghosts: [],
    lives: 3,
    level: 1,
    score: 0,
    pauseT: 0,
    levelFlash: 0,
    mouthT: 0,
    started: false,
    dead: false,
  }
  const pc = centerOf(playerTile)
  state.player.px = pc.x
  state.player.py = pc.y
  const ghostHomes: { t: Tile; color: string }[] = [
    { t: { c: 8, r: 9 }, color: '#FF5D5D' },
    { t: { c: 9, r: 9 }, color: '#FFB44C' },
    { t: { c: 10, r: 9 }, color: '#57E0C8' },
  ]
  for (const g of ghostHomes) {
    const gc = centerOf(g.t)
    state.ghosts.push({
      tile: g.t,
      target: null,
      dir: 'up',
      px: gc.x,
      py: gc.y,
      color: g.color,
      home: g.t,
    })
  }
  return state
}

export default function GhostMaze() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { justPressedRef, pressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<MazeState>(buildMaze())
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('ghost-maze'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = buildMaze()
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
      if (saveBest('ghost-maze', stateRef.current.score)) setNewBest(true)
      setBest((b) => Math.max(b, stateRef.current.score))
      sfx.gameOver()
    }

    const resetPositions = (s: MazeState) => {
      const p = s.player
      // recolocar jugador en su casilla de inicio
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (MAZE[r][c] === 'P') {
            p.tile = { c, r }
            p.target = null
            p.dir = 'left'
            p.want = null
            const pc = centerOf(p.tile)
            p.px = pc.x
            p.py = pc.y
          }
        }
      }
      for (const g of s.ghosts) {
        g.tile = { ...g.home }
        g.target = null
        g.dir = 'up'
        const gc = centerOf(g.tile)
        g.px = gc.x
        g.py = gc.y
      }
      s.pauseT = 1
    }

    const stepEntity = (
      pos: { px: number; py: number },
      e: { tile: Tile; target: Tile | null; dir: Dir },
      speed: number,
      dt: number,
    ): boolean => {
      // devuelve true si llegó a una casilla en este frame
      if (!e.target) return false
      const tc = centerOf(e.target)
      const dx = tc.x - pos.px
      const dy = tc.y - pos.py
      const dist = Math.hypot(dx, dy)
      const step = speed * T * dt
      if (step >= dist) {
        pos.px = tc.x
        pos.py = tc.y
        e.tile = e.target
        e.target = null
        return true
      }
      pos.px += (dx / dist) * step
      pos.py += (dy / dist) * step
      return false
    }

    const update = (dt: number) => {
      const s = stateRef.current
      s.mouthT += dt
      const jp = justPressedRef.current

      if (overRef.current) {
        if (jp.has('action')) restart()
        return
      }

      // dirección deseada
      const dirs: Dir[] = ['up', 'down', 'left', 'right']
      for (const d of dirs) {
        if (jp.has(d)) s.player.want = d
      }

      if (!s.started) {
        if (s.player.want) {
          s.started = true
          setRunning(true)
          sfx.start()
        }
        return
      }

      if (s.pauseT > 0) {
        s.pauseT -= dt
        return
      }
      if (s.levelFlash > 0) {
        s.levelFlash -= dt
        if (s.levelFlash <= 0) {
          // subir de nivel: reconstruir bolitas y recolocar
          s.level += 1
          setLevel(s.level)
          const fresh = buildMaze()
          s.walls = fresh.walls
          s.pellets = fresh.pellets
          s.power = fresh.power
          s.pelletCount = fresh.totalPellets
          resetPositions(s)
        }
        return
      }

      const p = s.player
      const pSpeed = 4.5

      // inversión inmediata
      if (p.target && p.want && p.want === OPPOSITE[p.dir]) {
        const tmp = p.target
        p.target = p.tile
        p.tile = tmp
        p.dir = p.want
      }
      // si está parado, intentar arrancar
      if (!p.target && p.want) {
        const v = DIR_VEC[p.want]
        const nc = p.tile.c + v.x
        const nr = p.tile.r + v.y
        if (!isWall(s, nc, nr)) {
          p.dir = p.want
          p.target = { c: nc, r: nr }
        }
      }
      const arrived = stepEntity(p, p, pSpeed, dt)
      if (arrived && !p.target) {
        // comer bolita
        if (s.pellets[p.tile.r][p.tile.c]) {
          s.pellets[p.tile.r][p.tile.c] = false
          s.pelletCount--
          s.score += 10
          setScore(s.score)
          sfx.pellet()
        } else if (s.power[p.tile.r][p.tile.c]) {
          s.power[p.tile.r][p.tile.c] = false
          s.pelletCount--
          s.score += 50
          setScore(s.score)
          sfx.power()
        }
        if (s.pelletCount <= 0) {
          s.score += 200
          setScore(s.score)
          s.levelFlash = 1.4
          sfx.levelUp()
          return
        }
        // decidir siguiente tramo
        if (p.want) {
          const v = DIR_VEC[p.want]
          const nc = p.tile.c + v.x
          const nr = p.tile.r + v.y
          if (!isWall(s, nc, nr)) {
            p.dir = p.want
            p.target = { c: nc, r: nr }
          }
        }
        if (!p.target) {
          const v = DIR_VEC[p.dir]
          const nc = p.tile.c + v.x
          const nr = p.tile.r + v.y
          if (!isWall(s, nc, nr)) p.target = { c: nc, r: nr }
        }
      }

      // fantasmas
      const gSpeed = Math.min(4.15, 3.35 + (s.level - 1) * 0.28)
      for (const g of s.ghosts) {
        if (!g.target) {
          // elegir dirección en intersección
          const options: Tile[] = []
          const all: Dir[] = ['up', 'down', 'left', 'right']
          for (const d of all) {
            if (d === OPPOSITE[g.dir]) continue
            const v = DIR_VEC[d]
            const nc = g.tile.c + v.x
            const nr = g.tile.r + v.y
            if (!isWall(s, nc, nr)) options.push({ c: nc, r: nr })
          }
          if (options.length === 0) {
            const v = DIR_VEC[OPPOSITE[g.dir]]
            options.push({ c: g.tile.c + v.x, r: g.tile.r + v.y })
          }
          let choice: Tile
          if (Math.random() < 0.25) {
            choice = options[Math.floor(Math.random() * options.length)]
          } else {
            let bestD = Infinity
            choice = options[0]
            for (const o of options) {
              const d = Math.hypot(o.c - p.tile.c, o.r - p.tile.r)
              if (d < bestD) {
                bestD = d
                choice = o
              }
            }
          }
          g.dir =
            choice.c > g.tile.c ? 'right' : choice.c < g.tile.c ? 'left' : choice.r > g.tile.r ? 'down' : 'up'
          g.target = choice
        }
        stepEntity(g, g, gSpeed, dt)

        // colisión con jugador
        if (Math.hypot(g.px - p.px, g.py - p.py) < T * 0.58) {
          s.lives -= 1
          setLives(s.lives)
          sfx.hurt()
          if (s.lives <= 0) {
            gameOver()
            return
          }
          resetPositions(s)
          return
        }
      }
    }

    const drawWalls = (s: MazeState) => {
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#4D63FF'
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!s.walls[r][c]) continue
          const x = c * T
          const y = r * T
          ctx.fillStyle = '#141A52'
          ctx.fillRect(x, y, T, T)
          ctx.beginPath()
          if (r + 1 < ROWS && !s.walls[r + 1][c]) {
            ctx.moveTo(x, y + T - 1.5)
            ctx.lineTo(x + T, y + T - 1.5)
          }
          if (r - 1 >= 0 && !s.walls[r - 1][c]) {
            ctx.moveTo(x, y + 1.5)
            ctx.lineTo(x + T, y + 1.5)
          }
          if (c + 1 < COLS && !s.walls[r][c + 1]) {
            ctx.moveTo(x + T - 1.5, y)
            ctx.lineTo(x + T - 1.5, y + T)
          }
          if (c - 1 >= 0 && !s.walls[r][c - 1]) {
            ctx.moveTo(x + 1.5, y)
            ctx.lineTo(x + 1.5, y + T)
          }
          ctx.stroke()
        }
      }
    }

    const draw = () => {
      const s = stateRef.current
      ctx.fillStyle = '#04040E'
      ctx.fillRect(0, 0, W, H)
      drawWalls(s)

      // bolitas
      const pulse = 0.5 + 0.5 * Math.sin(s.mouthT * 6)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * T + T / 2
          const y = r * T + T / 2
          if (s.pellets[r][c]) {
            ctx.fillStyle = '#FFD9A0'
            ctx.beginPath()
            ctx.arc(x, y, 2.6, 0, Math.PI * 2)
            ctx.fill()
          } else if (s.power[r][c]) {
            ctx.fillStyle = '#FFC85C'
            ctx.save()
            ctx.shadowColor = '#FFC85C'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.arc(x, y, 4.5 + pulse * 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        }
      }

      // jugador: orbe amarillo con boca
      const p = s.player
      const mouth = s.pauseT > 0 || s.levelFlash > 0 ? 0.05 : 0.12 + 0.28 * Math.abs(Math.sin(s.mouthT * 9))
      const baseAng =
        p.dir === 'right' ? 0 : p.dir === 'down' ? Math.PI / 2 : p.dir === 'left' ? Math.PI : -Math.PI / 2
      ctx.save()
      ctx.shadowColor = '#FFE23D'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#FFE23D'
      ctx.beginPath()
      ctx.moveTo(p.px, p.py)
      ctx.arc(p.px, p.py, 9.5, baseAng + mouth * Math.PI, baseAng - mouth * Math.PI)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // fantasmas
      for (const g of s.ghosts) {
        const gx = g.px
        const gy = g.py
        ctx.fillStyle = g.color
        ctx.beginPath()
        ctx.arc(gx, gy - 2, 9, Math.PI, 0)
        ctx.lineTo(gx + 9, gy + 6)
        // faldón ondulado
        const wob = Math.sin(s.mouthT * 10) * 1.4
        ctx.lineTo(gx + 6, gy + 3.4 + wob)
        ctx.lineTo(gx + 3, gy + 6 - wob)
        ctx.lineTo(gx, gy + 3.4 + wob)
        ctx.lineTo(gx - 3, gy + 6 - wob)
        ctx.lineTo(gx - 6, gy + 3.4 + wob)
        ctx.lineTo(gx - 9, gy + 6)
        ctx.closePath()
        ctx.fill()
        // ojos
        const dv = DIR_VEC[g.dir]
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.ellipse(gx - 3.4 + dv.x, gy - 3 + dv.y, 2.8, 3.4, 0, 0, Math.PI * 2)
        ctx.ellipse(gx + 3.4 + dv.x, gy - 3 + dv.y, 2.8, 3.4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2A2AB8'
        ctx.beginPath()
        ctx.arc(gx - 3.4 + dv.x * 1.7, gy - 3 + dv.y * 1.9, 1.5, 0, Math.PI * 2)
        ctx.arc(gx + 3.4 + dv.x * 1.7, gy - 3 + dv.y * 1.9, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // mensajes de estado dentro del canvas
      ctx.textAlign = 'center'
      if (s.levelFlash > 0) {
        ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#FFE23D'
        ctx.fillText('¡NIVEL SUPERADO!', W / 2, H / 2 - 6)
        ctx.font = '13px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#FFD9A0'
        ctx.fillText(`Nivel ${s.level + 1}: los fantasmas se aceleran…`, W / 2, H / 2 + 16)
      } else if (s.pauseT > 0 && !s.dead) {
        ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif'
        ctx.fillStyle = '#FF5D5D'
        ctx.fillText('¡Atrapado! Preparando…', W / 2, H / 2)
      }
      ctx.textAlign = 'left'
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      update(dt)
      justPressedRef.current.clear()
      void pressedRef
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [justPressedRef, restart])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-between w-full max-w-[494px] px-1"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        <span className="text-[9px] text-[#FFE23D]">PTS {score}</span>
        <span className="text-[9px] text-[#FFD9A0]">NIVEL {level}</span>
        <span className="text-[9px] text-[#FF5D5D]">
          VIDAS {'●'.repeat(Math.max(0, lives))}
        </span>
        <span className="text-[9px] text-[#57E0C8]">HI {Math.max(best, score)}</span>
      </div>

      <div className="relative rounded-xl border-2 border-[#232B7E] shadow-[0_0_36px_rgba(77,99,255,0.25)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block bg-[#04040E]"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}` }}
          aria-label="Juego Laberinto Fantasma"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#04040E]/85 text-center px-6">
            <p
              className="text-[#FFE23D] text-sm drop-shadow-[0_0_10px_rgba(255,226,61,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              LABERINTO FANTASMA
            </p>
            <p className="text-white/70 text-xs">
              Come todas las bolitas y evita los fantasmas
            </p>
            <p className="text-white/40 text-[11px]">
              Muévete con ↑ ↓ ← → o WASD para empezar
            </p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#04040E]/90 text-center px-6">
            <p
              className="text-[#FF5D5D] text-sm drop-shadow-[0_0_10px_rgba(255,93,93,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              TE ATRAPARON
            </p>
            {newBest && (
              <p className="text-[#FFE23D] text-[10px] animate-pulse" style={{ fontFamily: 'var(--font-pixel)' }}>
                ¡NUEVO RÉCORD!
              </p>
            )}
            <p className="text-white/80 text-xs">Puntuación: {score} · Nivel {level}</p>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                restart()
              }}
              className="text-[10px] px-4 py-2 rounded bg-[#FFE23D]/15 border border-[#FFE23D]/60 text-[#FFE23D] hover:bg-[#FFE23D]/30 transition-colors"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              JUGAR OTRA VEZ
            </button>
            <p className="text-white/40 text-[10px]">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="text-white/40 text-xs text-center">
        Las bolitas grandes (doradas) valen 50. Cada nivel, los fantasmas persiguen más rápido.
      </p>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} />
    </div>
  )
}
