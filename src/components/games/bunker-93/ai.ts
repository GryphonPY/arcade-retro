/**
 * IA de enemigos y jefes: persiguen por el campo de flujo, rodean, se
 * separan, buscan línea de visión y telegrafían sus ataques.
 */
import type { Enemy } from './entities'
import type { Game } from './game'
import { EYE, PLAYER_R } from './consts'
import { rand } from './util'

const tmp = { x: 0, z: 0 }

function steer(g: Game, e: Enemy, wx: number, wz: number, speed: number, dt: number) {
  // separación respecto a otros enemigos
  let sx = 0
  let sz = 0
  const r0 = e.def.radius
  for (const o of g.enemies) {
    if (o === e || o.state === 'dead') continue
    const dx = e.x - o.x
    const dz = e.z - o.z
    const rr = r0 + o.def.radius + 0.12
    const d2 = dx * dx + dz * dz
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2)
      const k = (rr - d) / rr
      sx += (dx / d) * k * 2.2
      sz += (dz / d) * k * 2.2
    }
  }
  let mx = wx + sx
  let mz = wz + sz
  const ml = Math.hypot(mx, mz)
  if (ml > 1) {
    mx /= ml
    mz /= ml
  }
  const a = Math.min(1, dt * 7)
  e.dx += (mx - e.dx) * a
  e.dz += (mz - e.dz) * a
  // no atravesar al jugador
  const ox = e.x
  const oz = e.z
  g.level.move(e, e.dx * speed * dt, e.dz * speed * dt, Math.min(0.42, r0))
  const pdx = e.x - g.px
  const pdz = e.z - g.pz
  const pd = Math.hypot(pdx, pdz)
  const minD = r0 + PLAYER_R
  if (pd < minD && pd > 0.001) {
    const push = minD - pd
    g.level.move(e, (pdx / pd) * push, (pdz / pd) * push, Math.min(0.42, r0))
  }
  e.moving = Math.hypot(e.x - ox, e.z - oz) / Math.max(0.0001, dt)
  e.anim += dt * Math.min(e.moving, speed) * (e.kind === 'swarm' ? 4 : 2)
}

/** Dirección hacia el jugador: directa si hay visión, si no, por el campo de flujo. */
function chaseDir(g: Game, e: Enemy, out: { x: number; z: number }) {
  const dx = g.px - e.x
  const dz = g.pz - e.z
  const d = Math.hypot(dx, dz) || 1
  if (e.los || d < 1.5) {
    out.x = dx / d
    out.z = dz / d
    return
  }
  if (!g.level.flowDir(e.x, e.z, out)) {
    out.x = dx / d
    out.z = dz / d
  }
}

function aimShot(g: Game, e: Enemy, kind: 'bullet' | 'orb' | 'missile', speed: number, y: number, spread: number, dmg: number, homing = 0, a0?: number) {
  const a = (a0 ?? Math.atan2(g.pz - e.z, g.px - e.x)) + rand(-spread, spread)
  const ox = e.x + Math.cos(a) * (e.def.radius + 0.1)
  const oz = e.z + Math.sin(a) * (e.def.radius + 0.1)
  const vy = ((EYE - 0.15 - y) / Math.max(1, Math.hypot(g.px - ox, g.pz - oz))) * speed
  g.spawnProj(kind, ox, y, oz, Math.cos(a) * speed, kind === 'orb' ? 0 : vy, Math.sin(a) * speed, false, dmg, {
    homing,
    life: kind === 'missile' ? 6 : 4,
    r: kind === 'missile' ? 0.18 : kind === 'orb' ? 0.2 : 0.1,
    splash: kind === 'missile' ? dmg : 0,
    splashR: kind === 'missile' ? 1.4 : 0,
  })
}

function lob(g: Game, e: Enemy, kind: 'acid' | 'rock', y: number, dmg: number, tx: number, tz: number, hSpeed: number) {
  const dx = tx - e.x
  const dz = tz - e.z
  const d = Math.hypot(dx, dz) || 1
  const T = d / hSpeed
  const grav = 9
  const vy = (0.3 - y) / T + 0.5 * grav * T
  g.spawnProj(kind, e.x + (dx / d) * 0.4, y, e.z + (dz / d) * 0.4, (dx / d) * hSpeed, vy, (dz / d) * hSpeed, false, dmg, {
    gravity: grav,
    life: T + 1.5,
    r: 0.2,
    splash: kind === 'acid' ? dmg : 0,
    splashR: kind === 'acid' ? 1.1 : 0,
  })
}

export function updateEnemies(g: Game, dt: number) {
  if (dt <= 0) return
  for (const e of g.enemies) {
    e.flash -= dt
    if (e.kx || e.kz) {
      g.level.move(e, e.kx * dt, e.kz * dt, Math.min(0.42, e.def.radius))
      const f = Math.exp(-dt * 7)
      e.kx *= f
      e.kz *= f
      if (Math.abs(e.kx) + Math.abs(e.kz) < 0.02) e.kx = e.kz = 0
    }
    if (e.state === 'dead') {
      e.deathT += dt
      continue
    }
    e.t -= dt
    e.atkCd -= dt
    e.losT -= dt
    e.growlT -= dt
    if (e.state === 'warp') {
      if (e.t <= 0) {
        e.state = 'move'
        if (e.def.boss) g.audio.bossRoar(e.kind)
      }
      continue
    }
    if (e.losT <= 0) {
      e.los = g.level.los(e.x, e.z, g.px, g.pz)
      e.losT = 0.18 + Math.random() * 0.15
    }
    if (e.growlT <= 0) {
      e.growlT = rand(3, 8)
      const d = Math.hypot(g.px - e.x, g.pz - e.z)
      if (d < 16) g.audio.growl(e.kind, g.pan(e.x, e.z), Math.max(0.15, 1 - d / 16))
    }
    if (g.dead) {
      // celebran: se quedan quietos
      e.anim += dt
      continue
    }
    if (e.def.boss) {
      updateBoss(g, e, dt)
      continue
    }
    if (e.state === 'pain' || e.state === 'stun') {
      if (e.t <= 0) e.state = 'move'
      continue
    }
    switch (e.kind) {
      case 'mutant':
        mutant(g, e, dt)
        break
      case 'soldier':
        shooter(g, e, dt, false)
        break
      case 'spitter':
        shooter(g, e, dt, true)
        break
      case 'tank':
        tank(g, e, dt)
        break
      case 'swarm':
        swarm(g, e, dt)
        break
    }
  }
  // limitar cadáveres
  let corpses = 0
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i]
    if (e.state !== 'dead') continue
    corpses++
    if (corpses > 40 || (e.gibbed && e.deathT > 1) || (e.def.boss && e.deathT > 3.2)) g.enemies.splice(i, 1)
  }
}

function distTo(g: Game, e: Enemy) {
  return Math.hypot(g.px - e.x, g.pz - e.z)
}

function mutant(g: Game, e: Enemy, dt: number) {
  const d = distTo(g, e)
  const sp = e.def.speed * e.speedMul
  if (e.state === 'windup') {
    if (e.t <= 0) {
      e.state = 'attack'
      e.t = 0.25
      if (d < 1.35 + e.def.radius) g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.z)
    }
    steer(g, e, 0, 0, sp, dt)
    return
  }
  if (e.state === 'attack') {
    if (e.t <= 0) e.state = 'move'
    return
  }
  if (d < 1.0 + e.def.radius && e.atkCd <= 0) {
    e.state = 'windup'
    e.t = 0.26
    e.atkCd = 0.85
    g.audio.swing(g.pan(e.x, e.z))
    return
  }
  chaseDir(g, e, tmp)
  // zigzag al acercarse: más difícil de acertar
  if (d > 2.5 && e.los) {
    const z = Math.sin(g.time * 4 + e.id) * 0.7
    const px = -tmp.z
    const pz = tmp.x
    tmp.x += px * z
    tmp.z += pz * z
  }
  const lunge = e.los && d > 2 && d < 5.5 ? 1.45 : 1
  steer(g, e, tmp.x, tmp.z, sp * lunge, dt)
}

function shooter(g: Game, e: Enemy, dt: number, spitter: boolean) {
  const d = distTo(g, e)
  const sp = e.def.speed * e.speedMul
  if (e.state === 'windup') {
    steer(g, e, 0, 0, sp, dt)
    if (e.t <= 0) {
      e.state = 'attack'
      e.subT = 0
      e.move = spitter ? 1 : 3
      e.t = spitter ? 0.35 : 0.5
    }
    return
  }
  if (e.state === 'attack') {
    steer(g, e, 0, 0, sp, dt)
    e.subT -= dt
    if (e.move > 0 && e.subT <= 0) {
      e.move--
      e.subT = 0.13
      if (spitter) {
        lob(g, e, 'acid', 0.7, e.def.dmg * e.dmgMul, g.px + g.pvx * 0.4, g.pz + g.pvz * 0.4, 7)
        g.audio.spit(g.pan(e.x, e.z))
      } else {
        aimShot(g, e, 'bullet', e.elite ? 17 : 14, 0.78, 0.06, e.def.dmg * e.dmgMul)
        g.audio.enemyShot(g.pan(e.x, e.z), Math.max(0.2, 1 - d / 20))
      }
    }
    if (e.t <= 0) {
      e.state = 'move'
      e.atkCd = spitter ? rand(2.2, 3.2) : rand(1.4, 2.4)
    }
    return
  }
  e.strafeT -= dt
  if (e.strafeT <= 0) {
    e.strafeT = rand(1.2, 3)
    e.strafe = -e.strafe
  }
  const lo = spitter ? 4 : 4.5
  const hi = spitter ? 10 : 9
  if (e.los && d < 14) {
    if (e.atkCd <= 0 && d < 16) {
      e.state = 'windup'
      e.t = spitter ? 0.55 : 0.45
      return
    }
    const ux = (g.px - e.x) / (d || 1)
    const uz = (g.pz - e.z) / (d || 1)
    let radial = d > hi ? 1 : d < lo ? -1 : 0
    radial *= 0.9
    // rodear al jugador
    tmp.x = ux * radial + -uz * e.strafe * 0.85
    tmp.z = uz * radial + ux * e.strafe * 0.85
    const before = e.x + e.z
    steer(g, e, tmp.x, tmp.z, sp, dt)
    if (Math.abs(e.x + e.z - before) < 0.0005) e.strafe = -e.strafe
  } else {
    chaseDir(g, e, tmp)
    steer(g, e, tmp.x, tmp.z, sp, dt)
  }
}

function tank(g: Game, e: Enemy, dt: number) {
  const d = distTo(g, e)
  const sp = e.def.speed * e.speedMul
  switch (e.state) {
    case 'windup':
      steer(g, e, 0, 0, sp, dt)
      if (e.t <= 0) {
        e.state = 'attack'
        e.t = 0.35
        g.audio.stomp()
        if (d < 1.9 + e.def.radius * 0.5) {
          g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.z)
          const ux = (g.px - e.x) / (d || 1)
          const uz = (g.pz - e.z) / (d || 1)
          g.pvx += ux * 9
          g.pvz += uz * 9
        }
        g.trauma = Math.min(1, g.trauma + 0.25)
      }
      return
    case 'attack':
      if (e.t <= 0) e.state = 'move'
      return
    case 'roar':
      steer(g, e, 0, 0, sp, dt)
      if (e.t <= 0) {
        e.state = 'charge'
        e.t = 1.3
        const a = Math.atan2(g.pz - e.z, g.px - e.x)
        e.chargeX = Math.cos(a)
        e.chargeZ = Math.sin(a)
      }
      return
    case 'charge': {
      const ox = e.x
      const oz = e.z
      g.level.move(e, e.chargeX * 8.5 * dt, e.chargeZ * 8.5 * dt, 0.42)
      e.anim += dt * 12
      if (d < e.def.radius + PLAYER_R + 0.25) {
        g.hurtPlayer(e.def.dmg * 1.3 * e.dmgMul, e.x, e.z)
        g.pvx += e.chargeX * 12
        g.pvz += e.chargeZ * 12
        e.state = 'attack'
        e.t = 0.5
        return
      }
      if (Math.hypot(e.x - ox, e.z - oz) < 8.5 * dt * 0.3) {
        // chocó contra un muro: aturdido
        e.state = 'stun'
        e.t = 1.1
        g.audio.stomp()
        g.trauma = Math.min(1, g.trauma + 0.2)
        return
      }
      if (e.t <= 0) e.state = 'move'
      return
    }
  }
  if (d < 1.5 + e.def.radius * 0.5 && e.atkCd <= 0) {
    e.state = 'windup'
    e.t = 0.5
    e.atkCd = 1.4
    g.audio.growl('tank', g.pan(e.x, e.z), 0.9)
    return
  }
  if (e.los && d > 3.5 && d < 10 && e.atkCd <= 0 && Math.random() < dt * 0.6) {
    e.state = 'roar'
    e.t = 0.6
    e.atkCd = 4
    g.audio.growl('tank', g.pan(e.x, e.z), 1)
    return
  }
  chaseDir(g, e, tmp)
  steer(g, e, tmp.x, tmp.z, sp, dt)
}

function swarm(g: Game, e: Enemy, dt: number) {
  const d = distTo(g, e)
  const sp = e.def.speed * e.speedMul
  if (e.state === 'attack') {
    if (e.t <= 0) e.state = 'move'
  }
  if (d < 0.55 + e.def.radius && e.atkCd <= 0) {
    g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.z)
    e.atkCd = 0.75
    e.state = 'attack'
    e.t = 0.2
  }
  chaseDir(g, e, tmp)
  const j = Math.sin(g.time * 9 + e.id * 1.7) * 0.8
  tmp.x += -tmp.z * j
  tmp.z += tmp.x * j
  steer(g, e, tmp.x, tmp.z, sp, dt)
  e.y = Math.abs(Math.sin(e.anim * 1.6)) * 0.12
}

// ===========================================================================
// Jefes
// ===========================================================================

function updateBoss(g: Game, e: Enemy, dt: number) {
  const frac = e.hp / e.maxHp
  e.patT -= dt
  e.subT -= dt
  switch (e.kind) {
    case 'boss1':
      colossus(g, e, dt, frac)
      break
    case 'boss2':
      mecha(g, e, dt, frac)
      break
    case 'boss3':
      brain(g, e, dt, frac)
      break
  }
}

function colossus(g: Game, e: Enemy, dt: number, frac: number) {
  const d = distTo(g, e)
  if (e.phase === 0 && frac < 0.5) {
    e.phase = 1
    e.state = 'roar'
    e.t = 1.4
    g.audio.bossRoar('boss1')
    g.trauma = 0.8
    g.showBanner('COLOSO ENFURECIDO', '', '#ff3a20', 1.6)
    for (let i = 0; i < 5; i++) {
      const s = g.level.freeSpotNear(e.x, e.z, 3)
      g.spawnEnemy('swarm', s.x, s.z, false, true)
    }
    return
  }
  const rage = e.phase === 1
  const sp = e.def.speed * (rage ? 1.45 : 1)
  switch (e.state) {
    case 'roar':
    case 'stun':
      if (e.t <= 0) e.state = 'move'
      return
    case 'windup':
      if (e.t <= 0) {
        e.state = 'attack'
        e.t = e.move === 2 ? 0.5 : 0.4
        if (e.move === 0) {
          // golpe sísmico: anillo de rocas rasantes
          g.audio.stomp()
          g.audio.explosion(1.2, g.pan(e.x, e.z), 1)
          g.trauma = Math.min(1, g.trauma + 0.6)
          if (d < 3.6) g.hurtPlayer(e.def.dmg, e.x, e.z)
          const n = rage ? 16 : 12
          const off = Math.random()
          for (let i = 0; i < n; i++) {
            const a = ((i + off) / n) * Math.PI * 2
            g.spawnProj('rock', e.x + Math.cos(a) * 1.2, 0.35, e.z + Math.sin(a) * 1.2, Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5, false, 14, {
              life: 3,
              r: 0.22,
            })
          }
          g.addFx('ring', e.x, 0.05, e.z, 5)
        } else if (e.move === 2) {
          // lanza rocas en abanico
          const n = rage ? 5 : 3
          const base = Math.atan2(g.pz - e.z, g.px - e.x)
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22
            const tx = e.x + Math.cos(a) * d
            const tz = e.z + Math.sin(a) * d
            lob(g, e, 'rock', 2.4, 18, tx + g.pvx * 0.3, tz + g.pvz * 0.3, 9)
          }
          g.audio.swing(g.pan(e.x, e.z))
        }
      }
      steer(g, e, 0, 0, sp, dt)
      return
    case 'attack':
      if (e.t <= 0) e.state = 'move'
      return
    case 'charge': {
      const ox = e.x
      const oz = e.z
      g.level.move(e, e.chargeX * 10 * dt, e.chargeZ * 10 * dt, 0.42)
      e.anim += dt * 10
      if (d < e.def.radius + PLAYER_R + 0.3 && e.subT <= 0) {
        g.hurtPlayer(35, e.x, e.z)
        g.pvx += e.chargeX * 14
        g.pvz += e.chargeZ * 14
        e.subT = 0.8
      }
      if (Math.hypot(e.x - ox, e.z - oz) < 10 * dt * 0.3) {
        e.state = 'stun'
        e.t = 1.6
        g.audio.stomp()
        g.audio.explosion(0.8, g.pan(e.x, e.z), 0.8)
        g.trauma = Math.min(1, g.trauma + 0.5)
        return
      }
      if (e.t <= 0) e.state = 'move'
      return
    }
  }
  // decidir ataque
  if (e.patT <= 0) {
    if (d < 3.4) {
      e.state = 'windup'
      e.move = 0
      e.t = rage ? 0.55 : 0.75
      e.patT = rage ? 1.4 : 2
      g.audio.growl('tank', g.pan(e.x, e.z), 1)
      return
    }
    if (rage && e.los && d > 4 && Math.random() < 0.45) {
      e.state = 'charge'
      e.t = 1.6
      const a = Math.atan2(g.pz - e.z, g.px - e.x)
      e.chargeX = Math.cos(a)
      e.chargeZ = Math.sin(a)
      e.patT = 2.5
      g.audio.bossRoar('boss1')
      return
    }
    if (e.los && d > 4.5) {
      e.state = 'windup'
      e.move = 2
      e.t = 0.65
      e.patT = rage ? 2 : 3
      return
    }
    e.patT = 0.4
  }
  if (rage && e.subT <= -10) {
    e.subT = 0
    for (let i = 0; i < 4; i++) {
      const s = g.level.freeSpotNear(e.x, e.z, 3)
      g.spawnEnemy('swarm', s.x, s.z, false, true)
    }
  }
  chaseDir(g, e, tmp)
  steer(g, e, tmp.x, tmp.z, sp, dt)
  if (e.moving > 0.5 && Math.floor(e.anim) !== Math.floor(e.anim - dt * 3)) {
    g.audio.stomp()
    g.trauma = Math.min(1, g.trauma + 0.12 * Math.max(0, 1 - d / 14))
  }
}

function mecha(g: Game, e: Enemy, dt: number, frac: number) {
  const d = distTo(g, e)
  if (e.phase === 0 && frac < 0.6) {
    e.phase = 1
    g.showBanner('CENTINELA: MISILES ACTIVOS', '', '#ff3a20', 1.6)
    g.audio.bossRoar('boss2')
  }
  if (e.phase === 1 && frac < 0.25) {
    e.phase = 2
    g.showBanner('SOBRECARGA', 'ACABALO YA', '#ff40ff', 1.6)
    g.audio.bossRoar('boss2')
    g.trauma = 0.7
  }
  const over = e.phase === 2
  const sp = e.def.speed * (over ? 1.5 : 1)
  if (e.state === 'attack') {
    e.subT -= dt
    if (e.move === 1 && e.subT <= 0 && e.t > 0) {
      // ráfaga de ametralladora alternando brazos
      e.subT = over ? 0.07 : 0.1
      e.spin = -e.spin || 1
      const side = e.spin
      const a = Math.atan2(g.pz - e.z, g.px - e.x)
      const ox = e.x + Math.cos(a + (Math.PI / 2) * side) * 0.9
      const oz = e.z + Math.sin(a + (Math.PI / 2) * side) * 0.9
      const aa = Math.atan2(g.pz + g.pvz * 0.25 - oz, g.px + g.pvx * 0.25 - ox) + rand(-0.07, 0.07)
      g.spawnProj('bullet', ox, 1.2, oz, Math.cos(aa) * 16, ((EYE - 1.2) / Math.max(1, d)) * 16, Math.sin(aa) * 16, false, 6, { life: 3 })
      g.audio.enemyShot(g.pan(e.x, e.z), 0.9)
    }
    steer(g, e, -e.chargeZ * e.strafe, e.chargeX * e.strafe, sp * 0.4, dt)
    if (e.t <= 0) e.state = 'move'
    return
  }
  if (e.state === 'windup') {
    steer(g, e, 0, 0, sp, dt)
    if (e.t <= 0) {
      if (e.move === 2) {
        // salva de misiles teledirigidos
        for (let i = 0; i < (over ? 6 : 4); i++) {
          const a = Math.atan2(g.pz - e.z, g.px - e.x) + (i - 1.5) * 0.5
          g.spawnProj('missile', e.x + Math.cos(a) * 0.8, 2.1, e.z + Math.sin(a) * 0.8, Math.cos(a) * 6, 0.6, Math.sin(a) * 6, false, 18, {
            homing: over ? 2.2 : 1.6,
            life: 5,
            r: 0.2,
            splash: 18,
            splashR: 1.4,
          })
        }
        g.audio.rocketLaunch()
        e.state = 'attack'
        e.t = 0.4
        e.move = 2
      } else {
        e.state = 'attack'
        e.t = over ? 2 : 1.5
        e.move = 1
        e.subT = 0
        const a = Math.atan2(g.pz - e.z, g.px - e.x)
        e.chargeX = Math.cos(a)
        e.chargeZ = Math.sin(a)
      }
    }
    return
  }
  if (e.patT <= 0 && e.los) {
    const useMissiles = e.phase >= 1 && Math.random() < 0.4
    e.state = 'windup'
    e.move = useMissiles ? 2 : 1
    e.t = useMissiles ? 0.8 : 0.6
    e.patT = over ? rand(1.4, 2.2) : rand(2.2, 3.2)
    if (useMissiles) g.audio.laserCharge()
    return
  }
  // refuerzos
  if (e.phase >= 1 && e.subT <= -12) {
    e.subT = 0
    for (let i = 0; i < 2; i++) {
      const s = g.level.spawns[Math.floor(Math.random() * g.level.spawns.length)]
      g.spawnEnemy('soldier', s.x, s.z, Math.random() < 0.3, true)
    }
  }
  e.strafeT -= dt
  if (e.strafeT <= 0) {
    e.strafeT = rand(1.5, 3)
    e.strafe = -e.strafe
  }
  if (e.los) {
    const ux = (g.px - e.x) / (d || 1)
    const uz = (g.pz - e.z) / (d || 1)
    const radial = d > 9 ? 1 : d < 5 ? -0.8 : 0
    steer(g, e, ux * radial - uz * e.strafe * 0.8, uz * radial + ux * e.strafe * 0.8, sp, dt)
  } else {
    chaseDir(g, e, tmp)
    steer(g, e, tmp.x, tmp.z, sp, dt)
  }
  if (e.moving > 0.4 && Math.floor(e.anim) !== Math.floor(e.anim - dt * 2)) {
    g.audio.stomp()
    g.trauma = Math.min(1, g.trauma + 0.08 * Math.max(0, 1 - d / 14))
  }
}

function brain(g: Game, e: Enemy, dt: number, frac: number) {
  e.anim += dt * 2
  if (e.phase === 0 && frac < 0.66) {
    e.phase = 1
    e.shield = true
    e.t = 6
    g.showBanner('ESCUDO PSIONICO', 'ACABA CON SUS CRIAS', '#60e0ff', 2)
    g.audio.bossRoar('boss3')
  }
  if (e.phase === 1 && frac < 0.33) {
    e.phase = 2
    e.shield = false
    g.showBanner('NUCLEO INESTABLE', '', '#ff40e0', 1.6)
    g.audio.bossRoar('boss3')
    g.trauma = 0.8
  }
  const cx = e.x
  const cz = e.z
  const y = e.y + 1.1
  e.spin += dt * (e.phase === 2 ? 1.6 : 1.0)
  if (e.phase === 1) {
    // alterna escudo (invocando) y vulnerable (ráfagas radiales)
    if (e.shield) {
      if (e.subT <= 0) {
        e.subT = 2.2
        const kinds = ['spitter', 'mutant', 'mutant', 'swarm', 'swarm'] as const
        const k = kinds[Math.floor(Math.random() * kinds.length)]
        const s = g.level.spawns[Math.floor(Math.random() * g.level.spawns.length)]
        const n = k === 'swarm' ? 4 : 1
        for (let i = 0; i < n; i++) {
          const p = g.level.freeSpotNear(s.x, s.z, 1)
          g.spawnEnemy(k, p.x, p.z, Math.random() < 0.25, true)
        }
      }
      if (e.t <= 0) {
        e.shield = false
        e.t = 7
        g.audio.zap(0)
      }
    } else {
      if (e.subT <= 0) {
        e.subT = 1.15
        const n = 16
        const off = Math.random()
        for (let i = 0; i < n; i++) {
          const a = ((i + off) / n) * Math.PI * 2
          g.spawnProj('orb', cx + Math.cos(a) * 1.6, y, cz + Math.sin(a) * 1.6, Math.cos(a) * 5, 0, Math.sin(a) * 5, false, 10, { life: 5, r: 0.22 })
        }
        g.audio.plasma()
      }
      if (e.t <= 0) {
        e.shield = true
        e.t = 6
      }
    }
    e.t -= dt
    return
  }
  // espiral
  const firing = e.phase === 2 || Math.sin(g.time * 0.9) > -0.35
  if (firing && e.subT <= 0) {
    e.subT = e.phase === 2 ? 0.11 : 0.17
    const arms = e.phase === 2 ? 4 : 3
    for (let k = 0; k < arms; k++) {
      const a = e.spin + (k / arms) * Math.PI * 2
      g.spawnProj('orb', cx + Math.cos(a) * 1.6, y, cz + Math.sin(a) * 1.6, Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2, false, 9, { life: 5, r: 0.22 })
    }
  }
  if (e.phase === 2) {
    if (e.patT <= 0) {
      e.patT = 2.2
      const a = Math.atan2(g.pz - cz, g.px - cx)
      for (let i = -1; i <= 1; i++)
        aimShot(g, e, 'orb', 6.5, y, 0, 12, 1.2, a + i * 0.25)
      g.audio.laserCharge()
      if (Math.random() < 0.5) {
        const s = g.level.spawns[Math.floor(Math.random() * g.level.spawns.length)]
        for (let i = 0; i < 4; i++) {
          const p = g.level.freeSpotNear(s.x, s.z, 1)
          g.spawnEnemy('swarm', p.x, p.z, false, true)
        }
      }
    }
  } else if (e.patT <= 0) {
    e.patT = 3
    aimShot(g, e, 'orb', 7, y, 0.05, 12, 0.6)
  }
}
