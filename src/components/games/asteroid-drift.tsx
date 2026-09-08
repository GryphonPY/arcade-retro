'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, setupCanvas } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 480
const H = 480

interface Point {
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

interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  fromEnemy?: boolean
}

interface Asteroid {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  tier: number // 3 = Grande, 2 = Mediano, 1 = Pequeño
  angle: number
  vRot: number
  points: Point[]
}

interface PowerUp {
  x: number
  y: number
  type: 'shield' | 'triple' | 'bomb'
  life: number
}

interface UFO {
  x: number
  y: number
  vx: number
  shootTimer: number
}

interface AsteroidState {
  ship: {
    x: number
    y: number
    vx: number
    vy: number
    angle: number
    thrusting: boolean
    shield: boolean
    tripleTimer: number
    invulnTimer: number
  }
  bullets: Bullet[]
  asteroids: Asteroid[]
  particles: Particle[]
  floatTexts: FloatText[]
  powerUps: PowerUp[]
  ufo: UFO | null
  ufoSpawnTimer: number
  score: number
  lives: number
  wave: number
  started: boolean
  dead: boolean
  shakeT: number
  paused: boolean
}

function generateAsteroidVertices(radius: number, count = 10): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const variance = 0.7 + Math.random() * 0.6
    const r = radius * variance
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return pts
}

function spawnAsteroid(x?: number, y?: number, tier = 3): Asteroid {
  let ax = x ?? Math.random() * W
  let ay = y ?? Math.random() * H
  if (x === undefined && y === undefined) {
    // Evitar que aparezca encima de la nave en el centro
    const dist = Math.hypot(ax - W / 2, ay - H / 2)
    if (dist < 100) ax = (ax + 200) % W
  }
  const speed = (4 - tier) * 35 + Math.random() * 25
  const moveAngle = Math.random() * Math.PI * 2
  const r = tier === 3 ? 32 : tier === 2 ? 20 : 12

  return {
    x: ax,
    y: ay,
    vx: Math.cos(moveAngle) * speed,
    vy: Math.sin(moveAngle) * speed,
    radius: r,
    tier,
    angle: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 2,
    points: generateAsteroidVertices(r, tier === 3 ? 12 : tier === 2 ? 10 : 8),
  }
}

function initial(wave = 1): AsteroidState {
  const count = 3 + wave
  const asteroids: Asteroid[] = []
  for (let i = 0; i < count; i++) {
    asteroids.push(spawnAsteroid())
  }

  return {
    ship: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      thrusting: false,
      shield: false,
      tripleTimer: 0,
      invulnTimer: 1.5,
    },
    bullets: [],
    asteroids,
    particles: [],
    floatTexts: [],
    powerUps: [],
    ufo: null,
    ufoSpawnTimer: 12 + Math.random() * 10,
    score: 0,
    lives: 3,
    wave,
    started: false,
    dead: false,
    shakeT: 0,
    paused: false,
  }
}

function wrap(obj: { x: number; y: number }, padding = 16) {
  if (obj.x < -padding) obj.x = W + padding
  else if (obj.x > W + padding) obj.x = -padding
  if (obj.y < -padding) obj.y = H + padding
  else if (obj.y > H + padding) obj.y = -padding
}

export default function AsteroidDrift() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1)
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<AsteroidState>(initial(1))
  const overRef = useRef(false)
  const shootCooldown = useRef(0)

  useEffect(() => {
    setBest(loadBest('asteroid-drift'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial(1)
    stateRef.current.started = true
    overRef.current = false
    setScore(0)
    setLives(3)
    setWave(1)
    setRunning(true)
    setOver(false)
    setNewBest(false)
    sfx.start()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D
    try {
      ctx = setupCanvas(canvas, W, H)
    } catch {
      return
    }

    let raf: number
    let lastT = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(0.06, (now - lastT) / 1000)
      lastT = now
      const s = stateRef.current

      // Manejo de Pausa
      if (justPressedRef.current.has('pause')) {
        justPressedRef.current.delete('pause')
        s.paused = !s.paused
        sfx.pause()
      }

      if (!s.paused) {
        if (!s.started) {
          if (
            justPressedRef.current.has('action') ||
            justPressedRef.current.has('action2') ||
            justPressedRef.current.has('up')
          ) {
            justPressedRef.current.clear()
            s.started = true
            setRunning(true)
            sfx.start()
          }
        } else if (s.dead) {
          if (justPressedRef.current.has('action') || justPressedRef.current.has('action2')) {
            justPressedRef.current.clear()
            restart()
          }
        } else {
          // Controles de vuelo
          const ROT_SPEED = 4.2
          if (pressedRef.current.has('left')) s.ship.angle -= ROT_SPEED * dt
          if (pressedRef.current.has('right')) s.ship.angle += ROT_SPEED * dt

          // Propulsión
          s.ship.thrusting = pressedRef.current.has('up')
          if (s.ship.thrusting) {
            const THRUST = 280
            s.ship.vx += Math.cos(s.ship.angle) * THRUST * dt
            s.ship.vy += Math.sin(s.ship.angle) * THRUST * dt

            // Partículas de estela de motor
            const backX = s.ship.x - Math.cos(s.ship.angle) * 14
            const backY = s.ship.y - Math.sin(s.ship.angle) * 14
            for (let i = 0; i < 2; i++) {
              const spread = (Math.random() - 0.5) * 0.6
              const flameAngle = s.ship.angle + Math.PI + spread
              const fSpeed = 90 + Math.random() * 80
              s.particles.push({
                x: backX + (Math.random() - 0.5) * 4,
                y: backY + (Math.random() - 0.5) * 4,
                vx: Math.cos(flameAngle) * fSpeed + s.ship.vx * 0.3,
                vy: Math.sin(flameAngle) * fSpeed + s.ship.vy * 0.3,
                color: Math.random() > 0.4 ? '#38bdf8' : '#f59e0b',
                life: 0.25,
                maxLife: 0.25,
                size: 2 + Math.random() * 2,
              })
            }
          }

          // Fricción / Inercia espacial
          s.ship.vx *= Math.pow(0.985, dt * 60)
          s.ship.vy *= Math.pow(0.985, dt * 60)
          s.ship.x += s.ship.vx * dt
          s.ship.y += s.ship.vy * dt
          wrap(s.ship)

          // Disparo
          shootCooldown.current -= dt
          const isShooting = pressedRef.current.has('action') || justPressedRef.current.has('action')
          if (isShooting && shootCooldown.current <= 0) {
            shootCooldown.current = 0.16
            sfx.laser()
            const noseX = s.ship.x + Math.cos(s.ship.angle) * 14
            const noseY = s.ship.y + Math.sin(s.ship.angle) * 14
            const B_SPEED = 460

            if (s.ship.tripleTimer > 0) {
              ;[-0.2, 0, 0.2].forEach((offset) => {
                const a = s.ship.angle + offset
                s.bullets.push({
                  x: noseX,
                  y: noseY,
                  vx: Math.cos(a) * B_SPEED + s.ship.vx * 0.5,
                  vy: Math.sin(a) * B_SPEED + s.ship.vy * 0.5,
                  life: 1.1,
                })
              })
            } else {
              s.bullets.push({
                x: noseX,
                y: noseY,
                vx: Math.cos(s.ship.angle) * B_SPEED + s.ship.vx * 0.5,
                vy: Math.sin(s.ship.angle) * B_SPEED + s.ship.vy * 0.5,
                life: 1.1,
              })
            }
          }

          // Salto Hiperespacial (Warp / Down key / action2)
          if (justPressedRef.current.has('action2') || justPressedRef.current.has('down')) {
            justPressedRef.current.delete('action2')
            justPressedRef.current.delete('down')
            sfx.warp()
            for (let i = 0; i < 24; i++) {
              const a = Math.random() * Math.PI * 2
              const spd = 60 + Math.random() * 120
              s.particles.push({
                x: s.ship.x,
                y: s.ship.y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                color: '#a855f7',
                life: 0.4,
                maxLife: 0.4,
                size: 2.5,
              })
            }
            s.ship.x = Math.random() * (W - 80) + 40
            s.ship.y = Math.random() * (H - 80) + 40
            s.ship.vx = 0
            s.ship.vy = 0
            s.ship.invulnTimer = 1.0
            s.floatTexts.push({ x: s.ship.x, y: s.ship.y - 20, text: 'WARP!', color: '#c084fc', life: 0.8 })
          }

          // Timers de la nave
          if (s.ship.invulnTimer > 0) s.ship.invulnTimer -= dt
          if (s.ship.tripleTimer > 0) s.ship.tripleTimer -= dt

          // Actualizar balas
          for (let i = s.bullets.length - 1; i >= 0; i--) {
            const b = s.bullets[i]
            b.x += b.vx * dt
            b.y += b.vy * dt
            b.life -= dt
            wrap(b)
            if (b.life <= 0) {
              s.bullets.splice(i, 1)
              continue
            }

            // Si es bala enemiga del OVNI golpeando a la nave
            if (b.fromEnemy && s.ship.invulnTimer <= 0) {
              const dist = Math.hypot(b.x - s.ship.x, b.y - s.ship.y)
              if (dist < 14) {
                s.bullets.splice(i, 1)
                hitShip(s)
                continue
              }
            }
          }

          // Actualizar asteroides y colisiones con balas
          for (let i = s.asteroids.length - 1; i >= 0; i--) {
            const a = s.asteroids[i]
            a.x += a.vx * dt
            a.y += a.vy * dt
            a.angle += a.vRot * dt
            wrap(a)

            // Colisión con balas del jugador
            let hit = false
            for (let j = s.bullets.length - 1; j >= 0; j--) {
              const b = s.bullets[j]
              if (b.fromEnemy) continue
              const dist = Math.hypot(b.x - a.x, b.y - a.y)
              if (dist < a.radius) {
                hit = true
                s.bullets.splice(j, 1)
                break
              }
            }

            if (hit) {
              s.shakeT = 0.12
              const ptsAwarded = a.tier === 3 ? 50 : a.tier === 2 ? 100 : 200
              s.score += ptsAwarded
              setScore(s.score)
              s.floatTexts.push({ x: a.x, y: a.y, text: `+${ptsAwarded}`, color: '#38bdf8', life: 0.7 })

              // Partículas de fragmentación
              const sparkCount = a.tier === 3 ? 16 : a.tier === 2 ? 12 : 8
              for (let p = 0; p < sparkCount; p++) {
                const ang = Math.random() * Math.PI * 2
                const spd = 40 + Math.random() * 120
                s.particles.push({
                  x: a.x,
                  y: a.y,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: '#e2e8f0',
                  life: 0.35 + Math.random() * 0.25,
                  maxLife: 0.6,
                  size: 2,
                })
              }

              if (a.tier > 1) {
                sfx.pop()
                // Divide en dos más pequeños
                s.asteroids.push(spawnAsteroid(a.x, a.y, a.tier - 1))
                s.asteroids.push(spawnAsteroid(a.x, a.y, a.tier - 1))
              } else {
                sfx.explode()
                // Posibilidad de soltar PowerUp
                if (Math.random() < 0.22) {
                  const types: ('shield' | 'triple' | 'bomb')[] = ['shield', 'triple', 'bomb']
                  const pick = types[Math.floor(Math.random() * types.length)]
                  s.powerUps.push({ x: a.x, y: a.y, type: pick, life: 10 })
                }
              }

              s.asteroids.splice(i, 1)
              continue
            }

            // Colisión asteroide con la nave
            if (s.ship.invulnTimer <= 0) {
              const dist = Math.hypot(s.ship.x - a.x, s.ship.y - a.y)
              if (dist < a.radius + 10) {
                hitShip(s)
              }
            }
          }

          // OVNI alienígena
          s.ufoSpawnTimer -= dt
          if (!s.ufo && s.ufoSpawnTimer <= 0) {
            s.ufoSpawnTimer = 18 + Math.random() * 12
            const fromLeft = Math.random() > 0.5
            s.ufo = {
              x: fromLeft ? -20 : W + 20,
              y: 50 + Math.random() * (H - 120),
              vx: fromLeft ? 80 : -80,
              shootTimer: 1.8,
            }
            sfx.ufo()
          }

          if (s.ufo) {
            s.ufo.x += s.ufo.vx * dt
            s.ufo.shootTimer -= dt
            if (s.ufo.shootTimer <= 0) {
              s.ufo.shootTimer = 2.0
              sfx.shoot()
              const toPlayer = Math.atan2(s.ship.y - s.ufo.y, s.ship.x - s.ufo.x)
              s.bullets.push({
                x: s.ufo.x,
                y: s.ufo.y,
                vx: Math.cos(toPlayer) * 220,
                vy: Math.sin(toPlayer) * 220,
                life: 2.2,
                fromEnemy: true,
              })
            }

            // Impacto de bala de jugador en OVNI
            for (let j = s.bullets.length - 1; j >= 0; j--) {
              const b = s.bullets[j]
              if (b.fromEnemy) continue
              if (Math.hypot(b.x - s.ufo.x, b.y - s.ufo.y) < 18) {
                s.bullets.splice(j, 1)
                s.score += 500
                setScore(s.score)
                sfx.explode()
                s.shakeT = 0.2
                s.floatTexts.push({ x: s.ufo.x, y: s.ufo.y, text: '+500 UFO!', color: '#facc15', life: 1.0 })
                for (let p = 0; p < 20; p++) {
                  const ang = Math.random() * Math.PI * 2
                  s.particles.push({
                    x: s.ufo.x,
                    y: s.ufo.y,
                    vx: Math.cos(ang) * (60 + Math.random() * 120),
                    vy: Math.sin(ang) * (60 + Math.random() * 120),
                    color: '#facc15',
                    life: 0.5,
                    maxLife: 0.5,
                    size: 2.5,
                  })
                }
                s.ufo = null
                break
              }
            }

            if (s.ufo && (s.ufo.x < -40 || s.ufo.x > W + 40)) {
              s.ufo = null
            }
          }

          // PowerUps
          for (let i = s.powerUps.length - 1; i >= 0; i--) {
            const p = s.powerUps[i]
            p.life -= dt
            if (p.life <= 0) {
              s.powerUps.splice(i, 1)
              continue
            }
            if (Math.hypot(s.ship.x - p.x, s.ship.y - p.y) < 22) {
              sfx.golden()
              if (p.type === 'shield') {
                s.ship.shield = true
                s.floatTexts.push({ x: p.x, y: p.y, text: 'ESCUDO', color: '#38bdf8', life: 0.9 })
              } else if (p.type === 'triple') {
                s.ship.tripleTimer = 10
                s.floatTexts.push({ x: p.x, y: p.y, text: 'TRIPLE LÁSER', color: '#facc15', life: 0.9 })
              } else if (p.type === 'bomb') {
                sfx.bomb()
                s.shakeT = 0.35
                s.floatTexts.push({ x: W / 2, y: H / 2, text: '¡BOMBA TOTAL!', color: '#ef4444', life: 1.2 })
                s.asteroids.forEach((ast) => {
                  s.score += 50
                  for (let k = 0; k < 6; k++) {
                    const ang = Math.random() * Math.PI * 2
                    s.particles.push({
                      x: ast.x,
                      y: ast.y,
                      vx: Math.cos(ang) * 90,
                      vy: Math.sin(ang) * 90,
                      color: '#ef4444',
                      life: 0.4,
                      maxLife: 0.4,
                      size: 2,
                    })
                  }
                })
                s.asteroids = []
              }
              s.powerUps.splice(i, 1)
            }
          }

          // Siguiente Oleada si se destruyen todos los asteroides
          if (s.asteroids.length === 0) {
            s.wave++
            setWave(s.wave)
            sfx.levelUp()
            s.ship.invulnTimer = 2.0
            s.floatTexts.push({
              x: W / 2,
              y: H / 2 - 40,
              text: `¡OLEADA ${s.wave}!`,
              color: '#4ade80',
              life: 1.5,
            })
            const count = 3 + s.wave
            for (let k = 0; k < count; k++) {
              s.asteroids.push(spawnAsteroid())
            }
          }
        }

        // Partículas y textos flotantes
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i]
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.life -= dt
          if (p.life <= 0) s.particles.splice(i, 1)
        }

        for (let i = s.floatTexts.length - 1; i >= 0; i--) {
          const ft = s.floatTexts[i]
          ft.y -= 30 * dt
          ft.life -= dt
          if (ft.life <= 0) s.floatTexts.splice(i, 1)
        }
      }

      // ================= DIBUJADO EN CANVAS =================
      ctx.save()
      ctx.fillStyle = '#050710'
      ctx.fillRect(0, 0, W, H)

      // Screen Shake
      if (s.shakeT > 0) {
        s.shakeT -= dt
        const mag = s.shakeT * 18
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
      }

      // Estrellas de fondo vectoriales
      ctx.fillStyle = '#ffffff25'
      for (let i = 0; i < 35; i++) {
        const sx = ((i * 137.5) % W)
        const sy = ((i * 269.3) % H)
        ctx.fillRect(sx, sy, 1.5, 1.5)
      }

      // Rejilla sutil vector estilo arcade 1980
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < W; x += 48) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      for (let y = 0; y < H; y += 48) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()

      // Dibujar PowerUps
      s.powerUps.forEach((p) => {
        ctx.save()
        ctx.translate(p.x, p.y)
        const pulse = 1 + Math.sin(now * 0.008) * 0.15
        ctx.scale(pulse, pulse)
        ctx.lineWidth = 2
        if (p.type === 'shield') {
          ctx.strokeStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(0, 0, 11, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#38bdf8'
          ctx.font = 'bold 9px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('S', 0, 0)
        } else if (p.type === 'triple') {
          ctx.strokeStyle = '#facc15'
          ctx.strokeRect(-9, -9, 18, 18)
          ctx.fillStyle = '#facc15'
          ctx.font = 'bold 9px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('3X', 0, 0)
        } else {
          ctx.strokeStyle = '#ef4444'
          ctx.beginPath()
          ctx.arc(0, 0, 10, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#ef4444'
          ctx.font = 'bold 9px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('B', 0, 0)
        }
        ctx.restore()
      })

      // Dibujar Asteroides
      s.asteroids.forEach((ast) => {
        ctx.save()
        ctx.translate(ast.x, ast.y)
        ctx.rotate(ast.angle)
        ctx.strokeStyle = ast.tier === 3 ? '#94a3b8' : ast.tier === 2 ? '#67e8f9' : '#a7f3d0'
        ctx.lineWidth = 2
        ctx.shadowColor = ctx.strokeStyle
        ctx.shadowBlur = 6
        ctx.beginPath()
        ast.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        })
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      })

      // Dibujar OVNI
      if (s.ufo) {
        ctx.save()
        ctx.translate(s.ufo.x, s.ufo.y)
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 2
        ctx.shadowColor = '#f43f5e'
        ctx.shadowBlur = 8
        ctx.beginPath()
        // Cúpula
        ctx.arc(0, -4, 6, Math.PI, 0)
        // Cuerpo platillo
        ctx.moveTo(-16, 2)
        ctx.lineTo(-8, -4)
        ctx.lineTo(8, -4)
        ctx.lineTo(16, 2)
        ctx.lineTo(8, 6)
        ctx.lineTo(-8, 6)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      }

      // Dibujar Balas
      s.bullets.forEach((b) => {
        ctx.save()
        ctx.fillStyle = b.fromEnemy ? '#f43f5e' : '#38bdf8'
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.fromEnemy ? 3 : 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Dibujar Nave
      if (!s.dead) {
        const blink = s.ship.invulnTimer > 0 && Math.floor(now / 80) % 2 === 0
        if (!blink) {
          ctx.save()
          ctx.translate(s.ship.x, s.ship.y)
          ctx.rotate(s.ship.angle)
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 2.2
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 10

          // Chasis de la nave (flecha vector clásica)
          ctx.beginPath()
          ctx.moveTo(14, 0) // Punta delantera
          ctx.lineTo(-11, -9) // Ala izquierda
          ctx.lineTo(-6, 0) // Cola interna
          ctx.lineTo(-11, 9) // Ala derecha
          ctx.closePath()
          ctx.stroke()

          // Escudo de energía
          if (s.ship.shield) {
            ctx.strokeStyle = '#22d3ee'
            ctx.shadowColor = '#22d3ee'
            ctx.shadowBlur = 12
            ctx.beginPath()
            ctx.arc(0, 0, 18, 0, Math.PI * 2)
            ctx.stroke()
          }

          ctx.restore()
        }
      }

      // Dibujar Partículas
      s.particles.forEach((p) => {
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Textos flotantes
      s.floatTexts.forEach((ft) => {
        ctx.save()
        ctx.globalAlpha = Math.min(1, ft.life * 1.5)
        ctx.fillStyle = ft.color
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.shadowColor = ft.color
        ctx.shadowBlur = 8
        ctx.fillText(ft.text, ft.x, ft.y)
        ctx.restore()
      })

      ctx.restore()
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [justPressedRef, pressedRef, restart])

  function hitShip(s: AsteroidState) {
    if (s.ship.shield) {
      s.ship.shield = false
      s.ship.invulnTimer = 1.2
      sfx.hurt()
      s.shakeT = 0.2
      s.floatTexts.push({ x: s.ship.x, y: s.ship.y - 15, text: '¡ESCUDO ROTO!', color: '#f87171', life: 0.9 })
      return
    }

    s.lives--
    setLives(s.lives)
    s.shakeT = 0.35
    sfx.explode()

    for (let p = 0; p < 25; p++) {
      const a = Math.random() * Math.PI * 2
      const spd = 40 + Math.random() * 160
      s.particles.push({
        x: s.ship.x,
        y: s.ship.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color: '#38bdf8',
        life: 0.5,
        maxLife: 0.5,
        size: 2.5,
      })
    }

    if (s.lives <= 0) {
      s.dead = true
      overRef.current = true
      setOver(true)
      setRunning(false)
      const isNew = saveBest('asteroid-drift', s.score)
      if (isNew) setNewBest(true)
      sfx.gameOver()
    } else {
      s.ship.x = W / 2
      s.ship.y = H / 2
      s.ship.vx = 0
      s.ship.vy = 0
      s.ship.invulnTimer = 2.0
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[480px]">
      {/* Marcador superior estilo cabina arcade */}
      <div className="flex items-center justify-between w-full px-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
            SCORE {String(score).padStart(6, '0')}
          </span>
          <span className="text-emerald-400 font-bold">WAVE {wave}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1" title="Vidas">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <span key={i} className="text-cyan-400 text-sm">▲</span>
            ))}
          </div>
          <span className="text-zinc-400">HI {String(Math.max(best, score)).padStart(6, '0')}</span>
        </div>
      </div>

      {/* Pantalla Canvas */}
      <div className="relative rounded-2xl border-2 border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.25),inset_0_0_20px_rgba(0,0,0,0.8)] overflow-hidden w-full aspect-square bg-[#050710]">
        <canvas
          ref={canvasRef}
          className="block w-full h-full touch-none select-none cursor-crosshair"
          aria-label="Juego Asteroid Drift 360"
        />

        {/* Pantalla de inicio */}
        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 text-center px-6 backdrop-blur-sm">
            <h3 className="text-xl sm:text-2xl font-black text-cyan-300 tracking-wider font-mono drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]">
              ASTEROID DRIFT 360°
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xs leading-relaxed font-mono">
              Física vectorial inercial: gira con <b>← →</b>, propulsa con <b>↑</b> y dispara con <b>ESPACIO</b>.
            </p>
            <p className="text-cyan-400/80 text-[11px] font-mono">
              Salto hiperespacial de emergencia: <b>↓</b> o <b>BOMBA / B</b>
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 px-6 py-2 rounded-full border border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold font-mono text-sm hover:bg-cyan-500/30 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)]"
            >
              INSERT COIN / INICIAR
            </button>
          </div>
        )}

        {/* Pantalla de Game Over */}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6 backdrop-blur-md">
            <p className="text-2xl font-black text-rose-500 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">
              GAME OVER
            </p>
            {newBest && (
              <p className="text-amber-400 text-xs font-bold font-mono animate-bounce drop-shadow">
                ★ ¡NUEVO RÉCORD ARCADE! ★
              </p>
            )}
            <p className="text-zinc-300 text-sm font-mono">
              PUNTUACIÓN: <b className="text-cyan-400">{score}</b> PTS
            </p>
            <p className="text-zinc-500 text-xs font-mono">Oleadas superadas: {wave}</p>
            <button
              type="button"
              onClick={restart}
              className="mt-3 px-6 py-2.5 rounded-xl border border-cyan-400 bg-cyan-500 text-black font-extrabold font-mono text-sm hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(34,211,238,0.6)]"
            >
              REINTENTAR PARTIDA
            </button>
          </div>
        )}
      </div>

      {/* Controles táctiles */}
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Fuego"
        actionGlyph="A"
        showAction2
        action2Label="Warp"
        action2Glyph="B"
      />
    </div>
  )
}
