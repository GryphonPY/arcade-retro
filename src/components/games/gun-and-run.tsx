'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, aabb } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 640
const H = 360
const GROUND = 308
const GRAV = 1050
const CELL = 2
const PW = 22 // ancho del soldado en píxeles de pantalla
const PH = 32

// Torso pixel-art (11x8) mirando a la derecha. H casco · S piel · E ojo · B uniforme · G arma
const UPPER = [
  '...HHHHH...',
  '..HHHHHHH..',
  '..HSSESS...',
  '...SSSS....',
  '..BBBBBBB..',
  '.SBBBBBBB..',
  '.SBBBBBBGGG',
  '..BBBB.....',
]

// Drone (9x4). R rojo · M metal · L luz
const DRONE = [
  '..RRRRR..',
  '.MMMMMMM.',
  'RRRRLRRRR',
  '..M...M..',
]

interface Palette {
  H: string
  S: string
  E: string
  B: string
  G: string
  D: string
}

const PAL_PLAYER: Palette = { H: '#2E6B4A', S: '#E8B27D', E: '#101010', B: '#3E8E5A', G: '#1A1A1A', D: '#23282E' }
const PAL_ENEMY: Palette = { H: '#4A4A3A', S: '#D9A66C', E: '#FF4040', B: '#6B6B58', G: '#222222', D: '#2A2418' }

function drawMatrixPal(
  ctx: CanvasRenderingContext2D,
  matrix: string[],
  x: number,
  y: number,
  pal: Palette,
) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const ch = matrix[r][c]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch as keyof Palette]
      ctx.fillRect(x + c * CELL, y + r * CELL, CELL, CELL)
    }
  }
}

/** Refleja horizontalmente dentro del ancho w antes de dibujar. */
function withFlip(ctx: CanvasRenderingContext2D, x: number, w: number, facing: number, draw: () => void) {
  ctx.save()
  if (facing < 0) {
    ctx.translate(2 * x + w, 0)
    ctx.scale(-1, 1)
  }
  draw()
  ctx.restore()
}

function drawLegs(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette, frame: 'runA' | 'runB' | 'jump' | 'idle') {
  ctx.fillStyle = pal.D
  if (frame === 'runA') {
    ctx.fillRect(x + 4, y + 16, 4, 12)
    ctx.fillRect(x + 13, y + 16, 4, 14)
    ctx.fillRect(x + 2, y + 28, 6, 4)
    ctx.fillRect(x + 13, y + 30, 6, 2)
  } else if (frame === 'runB') {
    ctx.fillRect(x + 5, y + 16, 4, 14)
    ctx.fillRect(x + 12, y + 16, 4, 12)
    ctx.fillRect(x + 3, y + 30, 6, 2)
    ctx.fillRect(x + 12, y + 28, 6, 4)
  } else if (frame === 'jump') {
    ctx.fillRect(x + 4, y + 16, 4, 9)
    ctx.fillRect(x + 13, y + 16, 4, 11)
    ctx.fillRect(x + 3, y + 25, 6, 3)
    ctx.fillRect(x + 13, y + 27, 6, 3)
  } else {
    ctx.fillRect(x + 4, y + 16, 4, 15)
    ctx.fillRect(x + 13, y + 16, 4, 15)
    ctx.fillRect(x + 3, y + 30, 6, 3)
    ctx.fillRect(x + 12, y + 30, 6, 3)
  }
}

function drawTrooper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  pal: Palette,
  frame: 'runA' | 'runB' | 'jump' | 'idle',
) {
  withFlip(ctx, x, PW, facing, () => {
    drawMatrixPal(ctx, UPPER, x, y, pal)
    drawLegs(ctx, x, y, pal, frame)
  })
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

interface Soldier {
  x: number
  y: number
  hp: number
  shootT: number
  hitT: number
}
interface Drone {
  x: number
  y: number
  baseY: number
  t: number
  amp: number
  dropT: number
  hp: number
  hitT: number
}
interface Turret {
  x: number
  y: number
  hp: number
  shootT: number
  hitT: number
}
interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  bomb: boolean
}
interface Part {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  grav: number
}
interface Plat {
  x: number
  y: number
  w: number
}
interface Pup {
  x: number
  y: number
  vy: number
  kind: 'V' | 'med'
  t: number
}

interface GState {
  px: number
  py: number
  vx: number
  vy: number
  onGround: boolean
  facing: number
  cd: number
  invuln: number
  lives: number
  tripleT: number
  cam: number
  bonus: number
  zone: number
  soldiers: Soldier[]
  drones: Drone[]
  turrets: Turret[]
  pB: Bullet[]
  eB: Bullet[]
  parts: Part[]
  plats: Plat[]
  pups: Pup[]
  spawnT: number
  genX: number
  shake: number
  bannerT: number
  bannerText: string
  t: number
  started: boolean
  dead: boolean
}

const V_PIX = ['G.....G', 'G.....G', 'G.....G', '.G...G.', '..G.G..', '...G...']

function initial(): GState {
  return {
    px: 120,
    py: GROUND - PH,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    cd: 0,
    invuln: 0,
    lives: 3,
    tripleT: 0,
    cam: 0,
    bonus: 0,
    zone: 1,
    soldiers: [],
    drones: [],
    turrets: [],
    pB: [],
    eB: [],
    parts: [],
    plats: [],
    pups: [],
    spawnT: 1.4,
    genX: 300,
    shake: 0,
    bannerT: 0,
    bannerText: '',
    t: 0,
    started: false,
    dead: false,
  }
}

function burst(s: GState, x: number, y: number, colors: string[], n = 16, spread = 170) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 40 + Math.random() * spread
    const life = 0.25 + Math.random() * 0.45
    s.parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life,
      max: life,
      size: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      grav: 320,
    })
  }
}

const SPARK_SOLDIER = ['#FFD23D', '#FF8A3D', '#C8B8A0']
const SPARK_DRONE = ['#7DD8FF', '#FFD23D', '#B8B8C8']
const SPARK_TURRET = ['#FF8A3D', '#8888A0', '#FFD23D']

export default function GunAndRun() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(3)
  const [zone, setZone] = useState(1)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<GState>(initial())
  const scoreRef = useRef(0)
  const overRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar (sistema externo)
    setBest(loadBest('gun-and-run'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial()
    scoreRef.current = 0
    overRef.current = false
    setScore(0)
    setOver(false)
    setRunning(true)
    setLives(3)
    setZone(1)
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
    ctx.imageSmoothingEnabled = false

    let raf = 0
    let last = performance.now()

    const gameOver = () => {
      overRef.current = true
      stateRef.current.dead = true
      setOver(true)
      setRunning(false)
      if (saveBest('gun-and-run', scoreRef.current)) setNewBest(true)
      setBest((b) => Math.max(b, scoreRef.current))
      sfx.gameOver()
    }

    const recalc = (s: GState) => {
      const total = Math.floor(s.cam / 2) + s.bonus
      if (total !== scoreRef.current) {
        scoreRef.current = total
        setScore(total)
      }
    }

    const hurt = (s: GState) => {
      if (s.invuln > 0 || s.dead) return
      s.lives -= 1
      setLives(s.lives)
      s.invuln = 1.6
      s.shake = 0.45
      burst(s, s.px + PW / 2, s.py + PH / 2, ['#FF5D5D', '#FFD23D'], 14)
      sfx.hurt()
      if (s.lives <= 0) gameOver()
    }

    const killSoldier = (s: GState, e: Soldier) => {
      burst(s, e.x + PW / 2, e.y + PH / 2, SPARK_SOLDIER)
      s.bonus += 100
      recalc(s)
      s.shake = Math.max(s.shake, 0.14)
      sfx.pop()
    }
    const killDrone = (s: GState, d: Drone) => {
      burst(s, d.x + 9, d.y + 4, SPARK_DRONE, 20)
      s.bonus += 150
      recalc(s)
      s.shake = Math.max(s.shake, 0.14)
      sfx.explode()
      const r = Math.random()
      if (r < 0.34) s.pups.push({ x: d.x + 2, y: d.y, vy: 55, kind: 'V', t: 10 })
      else if (r < 0.5) s.pups.push({ x: d.x + 2, y: d.y, vy: 55, kind: 'med', t: 10 })
    }
    const killTurret = (s: GState, t: Turret) => {
      burst(s, t.x + 10, t.y + 8, SPARK_TURRET, 24, 210)
      s.bonus += 250
      recalc(s)
      s.shake = Math.max(s.shake, 0.22)
      sfx.explode()
    }

    const playerBox = (s: GState) => ({ x: s.px + 3, y: s.py + 2, w: PW - 6, h: PH - 4 })

    const fire = (s: GState) => {
      const triple = s.tripleT > 0
      const mx = s.px + (s.facing > 0 ? PW + 1 : -5)
      const my = s.py + 13
      const shots = triple ? [-48, 0, 48] : [0]
      for (const vy of shots) {
        s.pB.push({ x: mx, y: my, vx: s.facing * 440, vy, life: 1.3, bomb: false })
      }
      // fogonazo + casquillo
      s.parts.push({ x: mx + s.facing * 3, y: my, vx: s.facing * 30, vy: -10, life: 0.06, max: 0.06, size: 5, color: '#FFF3B0', grav: 0 })
      s.parts.push({ x: mx - s.facing * 2, y: my + 2, vx: -s.facing * 60, vy: -80, life: 0.5, max: 0.5, size: 2, color: '#E8A94F', grav: 700 })
      s.cd = triple ? 0.16 : 0.24
      s.shake = Math.max(s.shake, 0.03)
      sfx.shoot()
    }

    const update = (dt: number) => {
      const s = stateRef.current
      const pressed = pressedRef.current
      const jp = justPressedRef.current
      s.t += dt

      if (overRef.current) {
        if (jp.has('action')) restart()
        if (s.shake > 0) s.shake -= dt
        s.parts = s.parts.filter((p) => {
          p.life -= dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += p.grav * dt
          return p.life > 0
        })
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

      if (s.bannerT > 0) s.bannerT -= dt
      if (s.shake > 0) s.shake -= dt
      if (s.invuln > 0) s.invuln -= dt
      if (s.tripleT > 0) s.tripleT -= dt
      if (s.cd > 0) s.cd -= dt

      // ===== movimiento del jugador (coordenadas de mundo) =====
      const dir = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0)
      s.vx = dir * 172
      if (dir !== 0) s.facing = dir
      if (jp.has('up') && s.onGround) {
        s.vy = -420
        s.onGround = false
        sfx.jump()
      }
      s.vy += GRAV * dt

      const prevFeet = s.py + PH
      s.px += s.vx * dt
      s.py += s.vy * dt

      // cámara solo avanza
      s.cam = Math.max(s.cam, s.px - W * 0.58)
      if (s.px < s.cam + 4) s.px = s.cam + 4
      if (s.px > s.cam + W - PW - 6) s.px = s.cam + W - PW - 6

      // suelo y plataformas (atravesables desde abajo)
      s.onGround = false
      const feet = s.py + PH
      if (feet >= GROUND) {
        if (prevFeet <= GROUND + 2 && s.vy > 260) sfx.land()
        s.py = GROUND - PH
        s.vy = 0
        s.onGround = true
      } else if (s.vy >= 0) {
        for (const p of s.plats) {
          if (s.px + 4 < p.x + p.w && s.px + PW - 4 > p.x && prevFeet <= p.y + 1 && feet >= p.y) {
            s.py = p.y - PH
            s.vy = 0
            s.onGround = true
            break
          }
        }
      }

      // ===== zona / dificultad =====
      const z = Math.floor(s.cam / 300) + 1
      if (z !== s.zone) {
        s.zone = z
        setZone(z)
        s.bannerT = 1.8
        s.bannerText = `ZONA ${z}`
        sfx.levelUp()
      }
      recalc(s)

      // ===== generación de plataformas =====
      while (s.genX < s.cam + W + 200) {
        if (Math.random() < 0.52) {
          const py = Math.random() < 0.7 ? 224 : 158
          const pw = 64 + Math.random() * 72
          s.plats.push({ x: s.genX, y: py, w: pw })
        }
        s.genX += 170 + Math.random() * 230
      }
      s.plats = s.plats.filter((p) => p.x + p.w > s.cam - 100)

      // ===== aparición de enemigos =====
      s.spawnT -= dt
      if (s.spawnT <= 0) {
        s.spawnT = Math.max(0.7, 1.9 - s.zone * 0.16) * (0.8 + Math.random() * 0.45)
        const r = Math.random()
        const sx = s.cam + W + 30
        if (r < 0.5) {
          s.soldiers.push({ x: sx, y: GROUND - PH, hp: 1, shootT: 1 + Math.random(), hitT: 0 })
        } else if (r < 0.76) {
          s.drones.push({
            x: sx,
            y: 118,
            baseY: 92 + Math.random() * 40,
            t: Math.random() * Math.PI * 2,
            amp: 62 + Math.random() * 24,
            dropT: 1.4 + Math.random(),
            hp: 1,
            hitT: 0,
          })
        } else {
          const plat = s.plats.find((p) => p.x > s.cam + W - 260 && p.x < s.cam + W + 120)
          if (plat && Math.random() < 0.5) {
            s.turrets.push({ x: plat.x + plat.w / 2 - 10, y: plat.y - 16, hp: 3, shootT: 1.2, hitT: 0 })
          } else {
            s.turrets.push({ x: sx, y: GROUND - 16, hp: 3, shootT: 1.2, hitT: 0 })
          }
        }
        if (Math.random() < 0.2) {
          s.soldiers.push({ x: s.cam - 34, y: GROUND - PH, hp: 1, shootT: 1.4 + Math.random(), hitT: 0 })
        }
      }

      const pcx = s.px + PW / 2
      const pcy = s.py + PH / 2
      const pb = playerBox(s)

      // ===== soldados =====
      s.soldiers = s.soldiers.filter((e) => {
        if (e.hitT > 0) e.hitT -= dt
        const dx = pcx - (e.x + PW / 2)
        const f = Math.sign(dx) || 1
        const spd = Math.min(92, 46 + s.zone * 7)
        e.x += f * spd * dt
        e.shootT -= dt
        if (e.shootT <= 0 && Math.abs(dx) < 320) {
          e.shootT = Math.max(1.2, 2.7 - s.zone * 0.16) * (0.8 + Math.random() * 0.5)
          s.eB.push({ x: e.x + PW / 2 + f * 12, y: e.y + 13, vx: f * 190, vy: 0, life: 3, bomb: false })
        }
        if (s.invuln <= 0 && aabb(pb.x, pb.y, pb.w, pb.h, e.x + 2, e.y + 2, PW - 4, PH - 4)) {
          hurt(s)
          return false
        }
        return e.x > s.cam - 140 && e.x < s.cam + W + 260
      })

      // ===== drones =====
      s.drones = s.drones.filter((d) => {
        if (d.hitT > 0) d.hitT -= dt
        d.t += dt
        const dx = pcx - d.x
        d.x += Math.sign(dx) * Math.min(Math.abs(dx), 46 * dt) * (Math.abs(dx) > 24 ? 1 : 0)
        d.y = d.baseY + Math.sin(d.t * 2) * d.amp
        d.dropT -= dt
        if (d.dropT <= 0 && Math.abs(dx) < 16 && d.y < pcy) {
          d.dropT = 1.6 + Math.random()
          s.eB.push({ x: d.x + 8, y: d.y + 10, vx: 0, vy: 60, life: 4, bomb: true })
        }
        if (s.invuln <= 0 && aabb(pb.x, pb.y, pb.w, pb.h, d.x, d.y, 18, 8)) {
          hurt(s)
          burst(s, d.x + 9, d.y + 4, SPARK_DRONE, 14)
          sfx.explode()
          return false
        }
        return d.hp > 0 && d.x > s.cam - 80 && d.x < s.cam + W + 240
      })

      // ===== torretas =====
      s.turrets = s.turrets.filter((t) => {
        if (t.hitT > 0) t.hitT -= dt
        t.shootT -= dt
        if (t.shootT <= 0 && t.x > s.cam - 40 && t.x < s.cam + W + 40) {
          t.shootT = Math.max(1.1, 2 - s.zone * 0.1) * (0.85 + Math.random() * 0.4)
          const bx = t.x + 10
          const by = t.y + 6
          const ddx = pcx - bx
          const ddy = pcy - by
          const dl = Math.max(1, Math.hypot(ddx, ddy))
          s.eB.push({ x: bx, y: by, vx: (ddx / dl) * 178, vy: (ddy / dl) * 178, life: 3.4, bomb: false })
        }
        return t.x > s.cam - 120 && t.x < s.cam + W + 260
      })

      // ===== balas del jugador =====
      s.pB = s.pB.filter((b) => {
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.life -= dt
        if (b.life <= 0 || b.x < s.cam - 20 || b.x > s.cam + W + 20 || b.y < -20 || b.y > H + 20) return false
        for (const e of s.soldiers) {
          if (e.hp <= 0) continue
          if (aabb(b.x, b.y, 4, 4, e.x, e.y, PW, PH)) {
            e.hp -= 1
            if (e.hp <= 0) killSoldier(s, e)
            return false
          }
        }
        for (const d of s.drones) {
          if (d.hp <= 0) continue
          if (aabb(b.x, b.y, 4, 4, d.x, d.y, 18, 8)) {
            d.hp -= 1
            if (d.hp <= 0) killDrone(s, d)
            return false
          }
        }
        for (const t of s.turrets) {
          if (t.hp <= 0) continue
          if (aabb(b.x, b.y, 4, 4, t.x, t.y, 20, 16)) {
            t.hp -= 1
            t.hitT = 0.12
            burst(s, b.x, b.y, SPARK_TURRET, 4, 80)
            if (t.hp <= 0) killTurret(s, t)
            return false
          }
        }
        return true
      })
      s.soldiers = s.soldiers.filter((e) => e.hp > 0)
      s.drones = s.drones.filter((d) => d.hp > 0)
      s.turrets = s.turrets.filter((t) => t.hp > 0)

      // ===== balas enemigas =====
      s.eB = s.eB.filter((b) => {
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (b.bomb) b.vy += 260 * dt
        b.life -= dt
        if (b.life <= 0 || b.x < s.cam - 30 || b.x > s.cam + W + 30) return false
        if (b.bomb && b.y >= GROUND - 4) {
          burst(s, b.x, GROUND - 2, ['#8888A0', '#FF8A3D'], 6, 60)
          return false
        }
        if (s.invuln <= 0 && aabb(b.x, b.y, b.bomb ? 6 : 4, b.bomb ? 8 : 4, pb.x, pb.y, pb.w, pb.h)) {
          hurt(s)
          return false
        }
        return true
      })

      // ===== power-ups =====
      s.pups = s.pups.filter((p) => {
        p.t -= dt
        p.y += p.vy * dt
        if (p.y > GROUND - 16) p.y = GROUND - 16
        if (p.t <= 0) return false
        if (aabb(pb.x, pb.y, pb.w, pb.h, p.x, p.y, 16, 14)) {
          if (p.kind === 'V') {
            s.tripleT = 9
            sfx.power()
          } else {
            s.lives = Math.min(4, s.lives + 1)
            setLives(s.lives)
            s.bonus += 50
            recalc(s)
            sfx.eat()
          }
          burst(s, p.x + 8, p.y + 6, ['#FFD23D', '#7DD8B7'], 10, 90)
          return false
        }
        return true
      })

      // ===== disparo del jugador =====
      if (pressed.has('action') && s.cd <= 0) fire(s)

      // ===== partículas =====
      s.parts = s.parts.filter((p) => {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += p.grav * dt
        return p.life > 0
      })
    }

    // ===== dibujo =====
    const drawBackground = (s: GState) => {
      // cielo atardecer
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
      sky.addColorStop(0, '#1B0F2E')
      sky.addColorStop(0.55, '#6B2440')
      sky.addColorStop(1, '#E8763A')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND)

      // sol retro con bandas
      const sunX = 505
      const sunY = 108
      const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 90)
      glow.addColorStop(0, 'rgba(255,207,138,0.5)')
      glow.addColorStop(1, 'rgba(255,207,138,0)')
      ctx.fillStyle = glow
      ctx.fillRect(sunX - 90, sunY - 90, 180, 180)
      ctx.fillStyle = '#FFCF8A'
      ctx.beginPath()
      ctx.arc(sunX, sunY, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#E8763A'
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(sunX - 36, sunY + 4 + i * 8, 72, 2 + i)
      }

      // nubes finas
      ctx.fillStyle = 'rgba(40,18,50,0.5)'
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 173 - s.cam * 0.12) % (W + 160) + W + 160) % (W + 160) - 80
        ctx.fillRect(cx, 40 + hash01(i) * 70, 70 + hash01(i + 9) * 60, 4)
      }

      // montañas lejanas
      const off1 = s.cam * 0.22
      const i0 = Math.floor(off1 / 160)
      ctx.fillStyle = '#3A2140'
      for (let k = -1; k < 6; k++) {
        const i = i0 + k
        const sx = i * 160 - off1
        const h = 62 + hash01(i) * 74
        ctx.beginPath()
        ctx.moveTo(sx - 95, GROUND)
        ctx.lineTo(sx, GROUND - h)
        ctx.lineTo(sx + 95, GROUND)
        ctx.closePath()
        ctx.fill()
      }

      // jungla media
      const off2 = s.cam * 0.5
      const j0 = Math.floor(off2 / 90)
      for (let k = -1; k < 9; k++) {
        const i = j0 + k
        const sx = i * 90 - off2
        ctx.fillStyle = '#233321'
        ctx.fillRect(sx, GROUND - 24, 66, 24)
        if (i % 3 === 0) {
          ctx.fillStyle = '#3A2A1A'
          ctx.fillRect(sx + 30, GROUND - 40, 6, 20)
          ctx.fillStyle = '#2E4A26'
          ctx.beginPath()
          ctx.moveTo(sx + 8, GROUND - 36)
          ctx.lineTo(sx + 58, GROUND - 36)
          ctx.lineTo(sx + 33, GROUND - 68)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    const drawGround = (s: GState) => {
      ctx.fillStyle = '#4A3524'
      ctx.fillRect(0, GROUND, W, H - GROUND)
      // moteado determinista
      ctx.fillStyle = '#3A2818'
      const c0 = Math.floor(s.cam / 14)
      for (let k = 0; k < W / 14 + 2; k++) {
        const i = c0 + k
        const sx = i * 14 - s.cam
        const h = hash01(i)
        ctx.fillRect(sx, GROUND + 10 + h * 40, 3, 3)
        if (h > 0.6) ctx.fillRect(sx + 5, GROUND + 30 + h * 14, 2, 2)
      }
      // hierba
      ctx.fillStyle = '#4E7A33'
      ctx.fillRect(0, GROUND, W, 6)
      ctx.fillStyle = '#6EA344'
      ctx.fillRect(0, GROUND, W, 2)
      const g0 = Math.floor(s.cam / 22)
      ctx.fillStyle = '#6EA344'
      for (let k = 0; k < W / 22 + 2; k++) {
        const i = g0 + k
        const sx = i * 22 - s.cam
        if (hash01(i + 5) > 0.45) ctx.fillRect(sx, GROUND - 4, 2, 4)
      }
      // cajas / rocas decorativas
      const d0 = Math.floor(s.cam / 260)
      for (let k = 0; k < 3; k++) {
        const i = d0 + k
        const wx = i * 260 + 130 - s.cam
        if (wx < -30 || wx > W + 30) continue
        if (i % 2 === 0) {
          ctx.fillStyle = '#7A5A30'
          ctx.fillRect(wx, GROUND - 18, 18, 18)
          ctx.fillStyle = '#5C431F'
          ctx.fillRect(wx, GROUND - 18, 18, 3)
          ctx.fillRect(wx + 8, GROUND - 18, 2, 18)
        } else {
          ctx.fillStyle = '#6E6E76'
          ctx.fillRect(wx, GROUND - 10, 20, 10)
          ctx.fillStyle = '#8A8A92'
          ctx.fillRect(wx + 3, GROUND - 13, 12, 4)
        }
      }
    }

    const drawPlats = (s: GState) => {
      for (const p of s.plats) {
        const sx = p.x - s.cam
        ctx.fillStyle = '#6B4A2A'
        ctx.fillRect(sx, p.y, p.w, 8)
        ctx.fillStyle = '#8A6238'
        ctx.fillRect(sx, p.y, p.w, 3)
        ctx.fillStyle = '#4E371E'
        for (let x = 6; x < p.w - 4; x += 18) ctx.fillRect(sx + x, p.y + 3, 2, 5)
        ctx.fillStyle = '#3A2A18'
        ctx.fillRect(sx + 4, p.y + 8, 4, 6)
        ctx.fillRect(sx + p.w - 8, p.y + 8, 4, 6)
      }
    }

    const drawTurret = (s: GState, t: Turret) => {
      const sx = t.x - s.cam
      ctx.fillStyle = '#2E2E3A'
      ctx.fillRect(sx, t.y + 10, 20, 6)
      ctx.fillStyle = t.hitT > 0 ? '#FFFFFF' : '#565668'
      ctx.fillRect(sx + 2, t.y + 2, 16, 8)
      ctx.fillStyle = t.hitT > 0 ? '#FFFFFF' : '#6A6A7E'
      ctx.fillRect(sx + 4, t.y, 12, 3)
      // cañón apuntando al jugador
      const pcx = s.px + PW / 2
      const pcy = s.py + PH / 2
      const dx = pcx - (t.x + 10)
      const dy = pcy - (t.y + 6)
      const dl = Math.max(1, Math.hypot(dx, dy))
      ctx.fillStyle = '#1E1E2C'
      for (let i = 1; i <= 3; i++) {
        ctx.fillRect(sx + 10 + (dx / dl) * i * 4 - 2, t.y + 6 + (dy / dl) * i * 4 - 2, 4, 4)
      }
      // vida
      if (t.hp < 3) {
        ctx.fillStyle = '#FF5D5D'
        ctx.fillRect(sx + 2, t.y - 5, (t.hp / 3) * 16, 2)
      }
    }

    const draw = () => {
      const s = stateRef.current
      ctx.save()
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * 8 * s.shake, (Math.random() - 0.5) * 8 * s.shake)
      }

      drawBackground(s)

      // plataformas y suelo
      drawPlats(s)
      drawGround(s)

      // torretas
      for (const t of s.turrets) drawTurret(s, t)

      // soldados
      const moving = Math.floor(s.t * 9) % 2 === 0
      for (const e of s.soldiers) {
        const sx = e.x - s.cam
        const frame = s.dead ? 'idle' : moving ? 'runA' : 'runB'
        if (e.hitT > 0) {
          ctx.save()
          ctx.filter = 'brightness(2)'
          drawTrooper(ctx, sx, e.y, Math.sign(s.px - e.x) || 1, PAL_ENEMY, frame)
          ctx.restore()
        } else {
          drawTrooper(ctx, sx, e.y, Math.sign(s.px - e.x) || 1, PAL_ENEMY, frame)
        }
      }

      // drones
      for (const d of s.drones) {
        const sx = d.x - s.cam
        // hélice
        ctx.fillStyle = '#9A9AA8'
        const rw = Math.floor(s.t * 20) % 2 === 0 ? 16 : 8
        ctx.fillRect(sx + 9 - rw / 2, d.y - 4, rw, 2)
        for (let r = 0; r < DRONE.length; r++) {
          for (let c = 0; c < DRONE[r].length; c++) {
            const ch = DRONE[r][c]
            if (ch === '.') continue
            ctx.fillStyle =
              ch === 'R' ? (d.hitT > 0 ? '#FFFFFF' : '#D84040') : ch === 'M' ? '#8A8A96' : '#FFD23D'
            ctx.fillRect(sx + c * CELL, d.y + r * CELL, CELL, CELL)
          }
        }
      }

      // power-ups
      for (const p of s.pups) {
        if (p.t < 2.2 && Math.floor(p.t * 8) % 2 === 0) continue
        const sx = p.x - s.cam
        if (p.kind === 'V') {
          ctx.fillStyle = '#1A1A24'
          ctx.fillRect(sx - 2, p.y - 1, 18, 16)
          ctx.strokeStyle = '#FFD23D'
          ctx.strokeRect(sx - 1.5, p.y - 0.5, 17, 15)
          for (let r = 0; r < V_PIX.length; r++) {
            for (let c = 0; c < V_PIX[r].length; c++) {
              if (V_PIX[r][c] === 'G') {
                ctx.fillStyle = '#FFD23D'
                ctx.fillRect(sx + 1 + c * 2, p.y + 1 + r * 2, 2, 2)
              }
            }
          }
        } else {
          ctx.fillStyle = '#F2F2F2'
          ctx.fillRect(sx, p.y, 16, 12)
          ctx.fillStyle = '#FF4040'
          ctx.fillRect(sx + 6, p.y + 2, 4, 8)
          ctx.fillRect(sx + 3, p.y + 5, 10, 4)
        }
      }

      // jugador
      const s2 = stateRef.current
      const blink = s2.invuln > 0 && Math.floor(s2.invuln * 10) % 2 === 0
      if (!blink) {
        const sx = s2.px - s2.cam
        let frame: 'runA' | 'runB' | 'jump' | 'idle' = 'idle'
        if (!s2.onGround) frame = 'jump'
        else if (s2.vx !== 0) frame = moving ? 'runA' : 'runB'
        drawTrooper(ctx, sx, s2.py, s2.facing, PAL_PLAYER, frame)
        // indicador de triple disparo
        if (s2.tripleT > 0) {
          ctx.fillStyle = '#FFD23D'
          ctx.fillRect(sx + 8, s2.py - 8, 6, 5)
          ctx.fillStyle = '#1A1A24'
          ctx.fillRect(sx + 9, s2.py - 7, 4, 3)
        }
      }

      // balas
      for (const b of s.pB) {
        ctx.fillStyle = '#FFD23D'
        ctx.fillRect(b.x - s.cam - 2, b.y - 2, 5, 4)
        ctx.fillStyle = 'rgba(255,210,61,0.4)'
        ctx.fillRect(b.x - s.cam - b.vx * 0.012 - 2, b.y - 1, 4, 2)
      }
      for (const b of s.eB) {
        if (b.bomb) {
          ctx.fillStyle = '#5A5A66'
          ctx.fillRect(b.x - s.cam - 3, b.y - 4, 6, 9)
          ctx.fillStyle = '#FF8A3D'
          ctx.fillRect(b.x - s.cam - 2, b.y - 6, 4, 3)
        } else {
          ctx.fillStyle = '#FF5D5D'
          ctx.fillRect(b.x - s.cam - 2, b.y - 2, 5, 4)
        }
      }

      // partículas
      for (const p of s.parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - s.cam - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1

      // cartela de zona
      if (s.bannerT > 0 && s.bannerText) {
        const a = Math.min(1, s.bannerT / 0.4)
        ctx.globalAlpha = a
        ctx.font = 'bold 22px monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#1A0E08'
        ctx.fillText(s.bannerText, W / 2 + 2, 92)
        ctx.fillStyle = '#FFD23D'
        ctx.fillText(s.bannerText, W / 2, 90)
        ctx.textAlign = 'left'
        ctx.globalAlpha = 1
      }

      // indicador V (triple disparo)
      if (s.tripleT > 0) {
        ctx.fillStyle = 'rgba(20,16,8,0.75)'
        ctx.fillRect(W - 66, 10, 56, 16)
        ctx.strokeStyle = '#FFD23D'
        ctx.strokeRect(W - 65.5, 10.5, 55, 15)
        ctx.fillStyle = '#FFD23D'
        ctx.font = 'bold 10px monospace'
        ctx.fillText('V', W - 60, 22)
        ctx.fillRect(W - 50, 19, 44 * (s.tripleT / 9), 4)
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
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-between w-full max-w-[640px] px-1"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        <span className="text-[9px] text-[#FFD23D]">PTS {score}</span>
        <span className="text-[9px] text-[#FF8A3D]">ZONA {zone}</span>
        <span className="text-[9px] text-[#FF5D5D]" title="Vidas">
          {'♥'.repeat(Math.max(0, lives))}
          {'♡'.repeat(Math.max(0, 4 - lives))}
        </span>
        <span className="text-[9px] text-white/60">HI {Math.max(best, score)}</span>
      </div>

      <div className="relative rounded-xl border-2 border-[#3A2A18] shadow-[0_0_40px_rgba(255,138,61,0.2)] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block touch-none select-none bg-[#1B0F2E]"
          style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}`, imageRendering: 'pixelated' }}
          aria-label="Juego Gun and Run"
        />

        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1B0F2E]/85 text-center px-8">
            <p
              className="text-[#FFD23D] text-base drop-shadow-[0_0_12px_rgba(255,138,61,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              GUN &amp; RUN
            </p>
            <p className="text-white/75 text-xs leading-relaxed">
              Corre por la selva al atardecer y <b className="text-[#FFD23D]">dispara</b> a soldados,
              drones y torretas. Recoge la <b className="text-[#FFD23D]">V</b> para el triple
              disparo y los <b className="text-white">botiquines</b> para curarte.
            </p>
            <p className="text-white/50 text-[11px]">
              ← → correr · ↑ saltar · ESPACIO / ENTER disparar
            </p>
            <p className="text-white/35 text-[10px]">Pulsa una tecla para entrar en combate</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1B0F2E]/90 text-center px-8">
            <p
              className="text-[#FF5D5D] text-sm drop-shadow-[0_0_10px_rgba(255,93,93,0.9)]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              CAÍSTE EN COMBATE
            </p>
            {newBest && (
              <p className="text-[#FFD23D] text-[10px] animate-pulse" style={{ fontFamily: 'var(--font-pixel)' }}>
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
              className="text-[10px] px-4 py-2 rounded bg-[#FFD23D]/15 border border-[#FFD23D]/60 text-[#FFD23D] hover:bg-[#FFD23D]/30 transition-colors"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              REINTENTAR
            </button>
            <p className="text-white/40 text-[10px]">o pulsa ESPACIO / ENTER</p>
          </div>
        )}
      </div>

      <p className="hidden sm:block text-white/40 text-xs text-center">
        Soldado +100 · dron +150 · torreta +250 · la V activa el triple disparo · botiquín +1 vida.
      </p>

      <TouchPad onPress={virtualPress} onRelease={virtualRelease} showAction actionLabel="Disparar" />
    </div>
  )
}
