'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys } from './use-keys'
import { loadBest, saveBest, setupCanvas, aabb } from './game-utils'
import { TouchPad } from './touch-pad'
import { sfx } from './sfx'

const W = 480
const H = 480
const TILE = 32

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

interface Enemy {
  id: number
  type: 'slime' | 'skeleton' | 'bat'
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  dir: number
  flashT: number
}

interface Item {
  type: 'coin' | 'gem' | 'potion' | 'key'
  x: number
  y: number
}

interface SlashEffect {
  x: number
  y: number
  angle: number
  life: number
}

interface DungeonState {
  player: {
    x: number
    y: number
    vx: number
    vy: number
    hp: number
    maxHp: number
    potions: number
    facing: 'up' | 'down' | 'left' | 'right'
    slashCooldown: number
    invulnTimer: number
    hasKey: boolean
  }
  exit: { x: number; y: number }
  enemies: Enemy[]
  items: Item[]
  slashes: SlashEffect[]
  particles: Particle[]
  floatTexts: FloatText[]
  floor: number
  score: number
  combo: number
  comboTimer: number
  started: boolean
  dead: boolean
  shakeT: number
  paused: boolean
}

let enemyIdCounter = 1

function createFloorEnemies(floor: number): Enemy[] {
  const list: Enemy[] = []
  const count = 6 + floor * 3

  for (let i = 0; i < count; i++) {
    // Generar aleatoriamente lejos del centro de aparición (64, 64)
    let ex = 64 + Math.random() * (W - 128)
    let ey = 64 + Math.random() * (H - 128)
    while (Math.hypot(ex - 64, ey - 64) < 100) {
      ex = 64 + Math.random() * (W - 128)
      ey = 64 + Math.random() * (H - 128)
    }

    const roll = Math.random()
    if (roll < 0.45) {
      // Slime
      list.push({
        id: enemyIdCounter++,
        type: 'slime',
        x: ex,
        y: ey,
        hp: 1,
        maxHp: 1,
        speed: 45 + floor * 4,
        dir: Math.random() * Math.PI * 2,
        flashT: 0,
      })
    } else if (roll < 0.8) {
      // Skeleton
      list.push({
        id: enemyIdCounter++,
        type: 'skeleton',
        x: ex,
        y: ey,
        hp: 2,
        maxHp: 2,
        speed: 60 + floor * 5,
        dir: Math.random() * Math.PI * 2,
        flashT: 0,
      })
    } else {
      // Bat
      list.push({
        id: enemyIdCounter++,
        type: 'bat',
        x: ex,
        y: ey,
        hp: 1,
        maxHp: 1,
        speed: 95 + floor * 6,
        dir: Math.random() * Math.PI * 2,
        flashT: 0,
      })
    }
  }

  return list
}

function initial(floor = 1): DungeonState {
  const items: Item[] = [
    { type: 'key', x: W - 70, y: H - 70 },
    { type: 'coin', x: W / 2, y: 100 },
    { type: 'gem', x: 100, y: H / 2 },
    { type: 'potion', x: W - 100, y: 120 },
  ]

  return {
    player: {
      x: 64,
      y: 64,
      vx: 0,
      vy: 0,
      hp: 3,
      maxHp: 3,
      potions: 1,
      facing: 'down',
      slashCooldown: 0,
      invulnTimer: 1.0,
      hasKey: false,
    },
    exit: { x: W - 56, y: 56 },
    enemies: createFloorEnemies(floor),
    items,
    slashes: [],
    particles: [],
    floatTexts: [],
    floor,
    score: 0,
    combo: 0,
    comboTimer: 0,
    started: false,
    dead: false,
    shakeT: 0,
    paused: false,
  }
}

export default function CyberDungeon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [hp, setHp] = useState(3)
  const [potions, setPotions] = useState(1)
  const [hasKey, setHasKey] = useState(false)
  const [floor, setFloor] = useState(1)
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const [newBest, setNewBest] = useState(false)

  const stateRef = useRef<DungeonState>(initial(1))
  const overRef = useRef(false)

  useEffect(() => {
    setBest(loadBest('cyber-dungeon'))
  }, [])

  const restart = useCallback(() => {
    stateRef.current = initial(1)
    stateRef.current.started = true
    overRef.current = false
    setScore(0)
    setHp(3)
    setPotions(1)
    setHasKey(false)
    setFloor(1)
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

      // Pausa
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
            justPressedRef.current.has('up') ||
            justPressedRef.current.has('down')
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
          // Movimiento del jugador
          const P_SPEED = 160
          let dx = 0
          let dy = 0
          if (pressedRef.current.has('left')) {
            dx -= 1
            s.player.facing = 'left'
          }
          if (pressedRef.current.has('right')) {
            dx += 1
            s.player.facing = 'right'
          }
          if (pressedRef.current.has('up')) {
            dy -= 1
            s.player.facing = 'up'
          }
          if (pressedRef.current.has('down')) {
            dy += 1
            s.player.facing = 'down'
          }

          if (dx !== 0 && dy !== 0) {
            dx *= 0.707
            dy *= 0.707
          }

          s.player.x = Math.max(36, Math.min(W - 36, s.player.x + dx * P_SPEED * dt))
          s.player.y = Math.max(36, Math.min(H - 36, s.player.y + dy * P_SPEED * dt))

          // Ataque con espada (Space / action)
          s.player.slashCooldown -= dt
          if (
            (justPressedRef.current.has('action') || pressedRef.current.has('action')) &&
            s.player.slashCooldown <= 0
          ) {
            s.player.slashCooldown = 0.22
            justPressedRef.current.delete('action')
            sfx.slash()

            // Dirección del tajo
            let slashAngle = 0
            let slashX = s.player.x
            let slashY = s.player.y
            if (s.player.facing === 'up') {
              slashAngle = -Math.PI / 2
              slashY -= 20
            } else if (s.player.facing === 'down') {
              slashAngle = Math.PI / 2
              slashY += 20
            } else if (s.player.facing === 'left') {
              slashAngle = Math.PI
              slashX -= 20
            } else {
              slashAngle = 0
              slashX += 20
            }

            s.slashes.push({
              x: slashX,
              y: slashY,
              angle: slashAngle,
              life: 0.15,
            })

            // Comprobar enemigos golpeados por el tajo
            const HIT_RANGE = 42
            s.enemies.forEach((en) => {
              const dist = Math.hypot(en.x - slashX, en.y - slashY)
              if (dist < HIT_RANGE) {
                en.hp--
                en.flashT = 0.15
                sfx.hit()
                s.shakeT = 0.1

                // Empuje
                en.x += Math.cos(slashAngle) * 20
                en.y += Math.sin(slashAngle) * 20

                // Chispas
                for (let p = 0; p < 8; p++) {
                  const a = Math.random() * Math.PI * 2
                  s.particles.push({
                    x: en.x,
                    y: en.y,
                    vx: Math.cos(a) * (50 + Math.random() * 80),
                    vy: Math.sin(a) * (50 + Math.random() * 80),
                    color: '#facc15',
                    life: 0.25,
                    maxLife: 0.25,
                    size: 2,
                  })
                }
              }
            })
          }

          // Uso de poción (action2 o tecla Shift / B)
          if (justPressedRef.current.has('action2')) {
            justPressedRef.current.delete('action2')
            if (s.player.potions > 0 && s.player.hp < s.player.maxHp) {
              s.player.potions--
              s.player.hp = Math.min(s.player.maxHp, s.player.hp + 1)
              setHp(s.player.hp)
              setPotions(s.player.potions)
              sfx.potion()
              s.floatTexts.push({ x: s.player.x, y: s.player.y - 20, text: '+1 VIDA', color: '#4ade80', life: 0.9 })
            }
          }

          // Timers
          if (s.player.invulnTimer > 0) s.player.invulnTimer -= dt
          if (s.comboTimer > 0) {
            s.comboTimer -= dt
            if (s.comboTimer <= 0) s.combo = 0
          }

          // Tajos activos
          for (let i = s.slashes.length - 1; i >= 0; i--) {
            s.slashes[i].life -= dt
            if (s.slashes[i].life <= 0) s.slashes.splice(i, 1)
          }

          // Actualizar enemigos
          for (let i = s.enemies.length - 1; i >= 0; i--) {
            const en = s.enemies[i]
            if (en.flashT > 0) en.flashT -= dt

            // Si muere
            if (en.hp <= 0) {
              s.combo++
              s.comboTimer = 2.5
              const mult = Math.min(4, s.combo)
              const basePoints = en.type === 'skeleton' ? 100 : en.type === 'bat' ? 60 : 40
              const points = basePoints * mult
              s.score += points
              setScore(s.score)

              const comboText = mult > 1 ? `+${points} x${mult}!` : `+${points}`
              s.floatTexts.push({ x: en.x, y: en.y, text: comboText, color: '#fbbf24', life: 0.8 })

              // Caída de botín (35% probabilidad)
              if (Math.random() < 0.35) {
                const dropTypes: ('coin' | 'gem' | 'potion')[] = ['coin', 'coin', 'gem', 'potion']
                s.items.push({
                  type: dropTypes[Math.floor(Math.random() * dropTypes.length)],
                  x: en.x,
                  y: en.y,
                })
              }

              // Partículas de muerte
              for (let p = 0; p < 12; p++) {
                const a = Math.random() * Math.PI * 2
                s.particles.push({
                  x: en.x,
                  y: en.y,
                  vx: Math.cos(a) * 90,
                  vy: Math.sin(a) * 90,
                  color: en.type === 'slime' ? '#22c55e' : en.type === 'skeleton' ? '#e2e8f0' : '#a855f7',
                  life: 0.35,
                  maxLife: 0.35,
                  size: 2.5,
                })
              }

              s.enemies.splice(i, 1)
              continue
            }

            // IA enemiga: perseguir al jugador
            const angleToPlayer = Math.atan2(s.player.y - en.y, s.player.x - en.x)
            en.x += Math.cos(angleToPlayer) * en.speed * dt
            en.y += Math.sin(angleToPlayer) * en.speed * dt

            // Daño al jugador si colisionan
            if (s.player.invulnTimer <= 0) {
              if (Math.hypot(s.player.x - en.x, s.player.y - en.y) < 18) {
                s.player.hp--
                setHp(s.player.hp)
                s.player.invulnTimer = 1.4
                s.shakeT = 0.25
                sfx.hurt()

                if (s.player.hp <= 0) {
                  s.dead = true
                  overRef.current = true
                  setOver(true)
                  setRunning(false)
                  const isNew = saveBest('cyber-dungeon', s.score)
                  if (isNew) setNewBest(true)
                  sfx.gameOver()
                }
              }
            }
          }

          // Recolección de items
          for (let i = s.items.length - 1; i >= 0; i--) {
            const it = s.items[i]
            if (Math.hypot(s.player.x - it.x, s.player.y - it.y) < 22) {
              if (it.type === 'key') {
                s.player.hasKey = true
                setHasKey(true)
                sfx.key()
                s.floatTexts.push({ x: it.x, y: it.y - 15, text: '¡LLAVE OBTENIDA!', color: '#facc15', life: 1.2 })
              } else if (it.type === 'coin') {
                s.score += 50
                setScore(s.score)
                sfx.eat()
                s.floatTexts.push({ x: it.x, y: it.y - 10, text: '+50 ORO', color: '#facc15', life: 0.6 })
              } else if (it.type === 'gem') {
                s.score += 200
                setScore(s.score)
                sfx.golden()
                s.floatTexts.push({ x: it.x, y: it.y - 10, text: '+200 GEMA', color: '#38bdf8', life: 0.7 })
              } else if (it.type === 'potion') {
                s.player.potions = Math.min(3, s.player.potions + 1)
                setPotions(s.player.potions)
                sfx.power()
                s.floatTexts.push({ x: it.x, y: it.y - 10, text: '+1 POCIÓN', color: '#ef4444', life: 0.8 })
              }
              s.items.splice(i, 1)
            }
          }

          // Portal de salida al siguiente piso
          if (s.player.hasKey) {
            if (Math.hypot(s.player.x - s.exit.x, s.player.y - s.exit.y) < 26) {
              s.floor++
              setFloor(s.floor)
              s.score += 500
              setScore(s.score)
              sfx.levelUp()

              // Reiniciar posición y nuevo piso
              s.player.x = 64
              s.player.y = 64
              s.player.hasKey = false
              setHasKey(false)
              s.enemies = createFloorEnemies(s.floor)
              s.items = [
                { type: 'key', x: W - 70, y: H - 70 },
                { type: 'gem', x: W / 2, y: H / 2 },
                { type: 'potion', x: 120, y: H - 100 },
              ]
              s.floatTexts.push({
                x: W / 2,
                y: H / 2,
                text: `¡MAZMORRA - PISO ${s.floor}!`,
                color: '#4ade80',
                life: 1.8,
              })
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
          ft.y -= 25 * dt
          ft.life -= dt
          if (ft.life <= 0) s.floatTexts.splice(i, 1)
        }
      }

      // ================= DIBUJADO =================
      ctx.save()

      // Screen Shake
      if (s.shakeT > 0) {
        s.shakeT -= dt
        const mag = s.shakeT * 15
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
      }

      // Suelo de piedra de mazmorra
      ctx.fillStyle = '#1c1917'
      ctx.fillRect(0, 0, W, H)

      // Rejilla de baldosas
      ctx.strokeStyle = '#292524'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += TILE) {
        for (let y = 0; y < H; y += TILE) {
          ctx.strokeRect(x, y, TILE, TILE)
        }
      }

      // Muros perimetrales de piedra con remate
      ctx.fillStyle = '#0c0a09'
      ctx.fillRect(0, 0, W, 24)
      ctx.fillRect(0, H - 24, W, 24)
      ctx.fillRect(0, 0, 24, H)
      ctx.fillRect(W - 24, 0, 24, H)

      ctx.strokeStyle = '#78716c'
      ctx.lineWidth = 2
      ctx.strokeRect(24, 24, W - 48, H - 48)

      // Antorchas con resplandor en las esquinas
      ;[
        { x: 36, y: 36 },
        { x: W - 36, y: 36 },
        { x: 36, y: H - 36 },
        { x: W - 36, y: H - 36 },
      ].forEach((torch) => {
        const flicker = 12 + Math.sin(now * 0.01 + torch.x) * 3
        const grad = ctx.createRadialGradient(torch.x, torch.y, 2, torch.x, torch.y, flicker)
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.5)')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(torch.x, torch.y, flicker, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#f59e0b'
        ctx.fillRect(torch.x - 2, torch.y - 2, 4, 4)
      })

      // Trampilla / Portal de salida
      ctx.save()
      ctx.translate(s.exit.x, s.exit.y)
      ctx.fillStyle = s.player.hasKey ? '#10b981' : '#475569'
      ctx.fillRect(-14, -14, 28, 28)
      ctx.strokeStyle = s.player.hasKey ? '#6ee7b7' : '#94a3b8'
      ctx.lineWidth = 2
      ctx.strokeRect(-14, -14, 28, 28)

      // Escalera de bajada
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      for (let l = -8; l <= 8; l += 5) {
        ctx.beginPath()
        ctx.moveTo(-10, l)
        ctx.lineTo(10, l)
        ctx.stroke()
      }
      ctx.restore()

      // Items en el suelo
      s.items.forEach((it) => {
        ctx.save()
        ctx.translate(it.x, it.y)
        const bounce = Math.sin(now * 0.006 + it.x) * 3
        ctx.translate(0, bounce)

        if (it.type === 'key') {
          ctx.fillStyle = '#facc15'
          ctx.shadowColor = '#facc15'
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.arc(0, -4, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(-1.5, -4, 3, 10)
          ctx.fillRect(1, 0, 3, 2)
          ctx.fillRect(1, 4, 3, 2)
        } else if (it.type === 'coin') {
          ctx.fillStyle = '#f59e0b'
          ctx.beginPath()
          ctx.arc(0, 0, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fef08a'
          ctx.fillRect(-1.5, -3, 3, 6)
        } else if (it.type === 'gem') {
          ctx.fillStyle = '#06b6d4'
          ctx.beginPath()
          ctx.moveTo(0, -6)
          ctx.lineTo(6, 0)
          ctx.lineTo(0, 6)
          ctx.lineTo(-6, 0)
          ctx.closePath()
          ctx.fill()
        } else if (it.type === 'potion') {
          ctx.fillStyle = '#ef4444'
          ctx.fillRect(-4, -2, 8, 8)
          ctx.fillStyle = '#cbd5e1'
          ctx.fillRect(-2, -6, 4, 4)
        }
        ctx.restore()
      })

      // Enemigos
      s.enemies.forEach((en) => {
        ctx.save()
        ctx.translate(en.x, en.y)

        if (en.flashT > 0) {
          ctx.fillStyle = '#ffffff'
        } else if (en.type === 'slime') {
          ctx.fillStyle = '#22c55e'
        } else if (en.type === 'skeleton') {
          ctx.fillStyle = '#e2e8f0'
        } else {
          ctx.fillStyle = '#c084fc'
        }

        if (en.type === 'slime') {
          // Slime saltarín
          const squish = Math.sin(now * 0.008 + en.id) * 2
          ctx.beginPath()
          ctx.ellipse(0, 0, 9 + squish, 7 - squish, 0, 0, Math.PI * 2)
          ctx.fill()
          // Ojos
          ctx.fillStyle = '#000000'
          ctx.fillRect(-4, -2, 2, 2)
          ctx.fillRect(2, -2, 2, 2)
        } else if (en.type === 'skeleton') {
          // Esqueleto
          ctx.fillRect(-6, -8, 12, 16)
          // Ojos rojos
          ctx.fillStyle = '#ef4444'
          ctx.fillRect(-3, -6, 2, 2)
          ctx.fillRect(2, -6, 2, 2)
        } else {
          // Murciélago
          const flap = Math.sin(now * 0.018 + en.id) * 6
          ctx.beginPath()
          ctx.moveTo(-10, flap)
          ctx.lineTo(0, -3)
          ctx.lineTo(10, flap)
          ctx.lineTo(0, 4)
          ctx.closePath()
          ctx.fill()
        }

        ctx.restore()
      })

      // Tajos de espada
      s.slashes.forEach((sl) => {
        ctx.save()
        ctx.translate(sl.x, sl.y)
        ctx.rotate(sl.angle)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 3
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(0, 0, 22, -Math.PI / 3, Math.PI / 3)
        ctx.stroke()
        ctx.restore()
      })

      // Jugador (Héroe guerrero pixelado)
      if (!s.dead) {
        const blink = s.player.invulnTimer > 0 && Math.floor(now / 70) % 2 === 0
        if (!blink) {
          ctx.save()
          ctx.translate(s.player.x, s.player.y)

          // Cuerpo armadura azul
          ctx.fillStyle = '#2563eb'
          ctx.fillRect(-7, -8, 14, 16)

          // Casco / Cabeza
          ctx.fillStyle = '#94a3b8'
          ctx.fillRect(-6, -12, 12, 6)

          // Visera dorada
          ctx.fillStyle = '#facc15'
          ctx.fillRect(-4, -9, 8, 2)

          // Espada enfundada o apuntando
          ctx.fillStyle = '#cbd5e1'
          if (s.player.facing === 'right') {
            ctx.fillRect(7, -2, 8, 3)
          } else if (s.player.facing === 'left') {
            ctx.fillRect(-15, -2, 8, 3)
          } else if (s.player.facing === 'up') {
            ctx.fillRect(4, -14, 3, 8)
          } else {
            ctx.fillRect(4, 6, 3, 8)
          }

          ctx.restore()
        }
      }

      // Partículas
      s.particles.forEach((p) => {
        ctx.save()
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Textos flotantes
      s.floatTexts.forEach((ft) => {
        ctx.save()
        ctx.fillStyle = ft.color
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.shadowColor = ft.color
        ctx.shadowBlur = 6
        ctx.fillText(ft.text, ft.x, ft.y)
        ctx.restore()
      })

      ctx.restore()
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [justPressedRef, pressedRef, restart])

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[480px]">
      {/* Marcador superior estilo RPG arcade */}
      <div className="flex items-center justify-between w-full px-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex gap-1" title="Corazones de Vida">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={i < hp ? 'text-red-500 text-sm' : 'text-zinc-700 text-sm'}>
                ♥
              </span>
            ))}
          </div>
          <span className="text-amber-400 font-bold">PISO {floor}</span>
          <span className="text-emerald-400">POCIONES: {potions}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasKey && <span className="text-amber-300 font-bold animate-pulse">🔑 LLAVE</span>}
          <span className="font-bold text-cyan-400">SCORE {String(score).padStart(6, '0')}</span>
        </div>
      </div>

      {/* Pantalla Canvas */}
      <div className="relative rounded-2xl border-2 border-amber-600/40 shadow-[0_0_30px_rgba(217,119,6,0.2),inset_0_0_20px_rgba(0,0,0,0.9)] overflow-hidden w-full aspect-square bg-[#1c1917]">
        <canvas
          ref={canvasRef}
          className="block w-full h-full touch-none select-none cursor-pointer"
          aria-label="Juego Cyber Dungeon Slayer"
        />

        {/* Pantalla de inicio */}
        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 text-center px-6 backdrop-blur-sm">
            <h3 className="text-xl sm:text-2xl font-black text-amber-400 tracking-wider font-mono drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]">
              CYBER DUNGEON SLAYER
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xs leading-relaxed font-mono">
              Explora la mazmorra con <b>flechas / WASD</b> y corta enemigos con <b>ESPACIO / A</b>.
            </p>
            <p className="text-amber-400/80 text-[11px] font-mono">
              Recoge la <b>Llave Dorada</b> para desbloquear la trampilla y beber poción con <b>B / Poción</b>.
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 px-6 py-2 rounded-full border border-amber-400 bg-amber-500/20 text-amber-300 font-bold font-mono text-sm hover:bg-amber-500/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]"
            >
              INSERT COIN / ENTRAR
            </button>
          </div>
        )}

        {/* Pantalla de Game Over */}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6 backdrop-blur-md">
            <p className="text-2xl font-black text-rose-500 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">
              HAS CAÍDO EN COMBATE
            </p>
            {newBest && (
              <p className="text-amber-400 text-xs font-bold font-mono animate-bounce drop-shadow">
                ★ ¡NUEVO RÉCORD DE MAZMORRA! ★
              </p>
            )}
            <p className="text-zinc-300 text-sm font-mono">
              PUNTUACIÓN: <b className="text-amber-400">{score}</b> PTS
            </p>
            <p className="text-zinc-500 text-xs font-mono">Piso alcanzado: {floor}</p>
            <button
              type="button"
              onClick={restart}
              className="mt-3 px-6 py-2.5 rounded-xl border border-amber-400 bg-amber-500 text-black font-extrabold font-mono text-sm hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.6)]"
            >
              REINTENTAR MAZMORRA
            </button>
          </div>
        )}
      </div>

      {/* Controles táctiles */}
      <TouchPad
        onPress={virtualPress}
        onRelease={virtualRelease}
        showAction
        actionLabel="Espada"
        actionGlyph="A"
        showAction2
        action2Label="Poción"
        action2Glyph="B"
      />
    </div>
  )
}
