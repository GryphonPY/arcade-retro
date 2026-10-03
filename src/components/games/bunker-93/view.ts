/**
 * Presentación: arma la escena (cámara, luces dinámicas, sprites) y dibuja el
 * overlay 2D (arma en primera persona, HUD, avisos, efectos de pantalla).
 */
import * as THREE from 'three'
import type { Game } from './game'
import { EYE } from './consts'
import type { Enemy } from './entities'
import { WEAPON_BY_ID, WEAPONS, type AmmoId } from './defs'
import { angDiff, clamp } from './util'

const L = [0, 0, 0, 0]
const v3 = new THREE.Vector3()

function enemyFrame(g: Game, e: Enemy): number {
  const A = g.atlas.anims[e.kind]
  const walk = () => A.walk[Math.floor(e.anim) % A.walk.length]
  if (e.state === 'dead') {
    if (e.def.boss) {
      if (e.deathT < 2.4) return A.pain
      const k = Math.floor((e.deathT - 2.4) / 0.15)
      return k < 3 ? A.death[k] : A.corpse
    }
    const k = Math.floor(e.deathT / 0.12)
    return k < 3 ? A.death[k] : A.corpse
  }
  switch (e.kind) {
    case 'boss1': {
      const rage = e.phase === 1
      if (e.state === 'stun') return A.pain
      if (e.state === 'roar') return A.extra[0]
      if (e.state === 'windup') return e.move === 2 ? A.attack[2] : A.attack[0]
      if (e.state === 'attack') return e.move === 2 ? A.walk[0] : A.attack[1]
      if (rage) return A.extra[Math.floor(e.anim) % 2]
      return walk()
    }
    case 'boss2': {
      const over = e.phase === 2
      if (e.state === 'attack' && e.move === 1) return Math.floor(e.subT * 40) % 2 ? (over ? A.extra[1] : A.attack[0]) : A.walk[0]
      if (e.state === 'windup' || (e.state === 'attack' && e.move === 2)) return e.move === 2 ? A.attack[1] : A.attack[0]
      if (e.flash > 0.03 && Math.random() < 0.3) return A.pain
      if (over) return A.extra[0]
      return walk()
    }
    case 'boss3':
      if (e.shield) return A.extra[Math.floor(e.anim) % 2]
      if (e.flash > 0.04) return A.pain
      if (e.subT > 0.05 && e.subT < 0.12) return A.attack[0]
      return A.walk[Math.floor(e.anim) % A.walk.length]
  }
  switch (e.state) {
    case 'warp':
      return A.walk[0]
    case 'pain':
    case 'stun':
      return A.pain
    case 'windup':
    case 'roar':
      return A.attack[0]
    case 'attack':
      if (e.kind === 'soldier') return e.subT > 0.06 ? A.attack[1] : A.attack[0]
      return A.attack[Math.min(1, A.attack.length - 1)]
    default:
      return walk()
  }
}

export function renderWorld(g: Game) {
  const r = g.r
  const lv = g.level
  const now = performance.now() / 1000
  const playing = g.screen !== 'title'
  // ---- cámara con temblor y balanceo
  const tr = g.trauma * g.trauma
  const sx = (Math.sin(now * 47.3) + Math.sin(now * 31.1)) * 0.5 * tr * 0.09
  const sz = (Math.sin(now * 41.7 + 1) + Math.sin(now * 27.9)) * 0.5 * tr * 0.09
  const sy = Math.sin(now * 53.1 + 2) * tr * 0.06
  const bob = playing ? Math.sin(g.bob * 2) * 0.035 * g.bobAmt : 0
  const yawJ = Math.sin(now * 37.7) * tr * 0.035
  r.setCamera(g.px + sx, g.eyeY + bob + sy, g.pz + sz, g.yaw + yawJ, g.roll + Math.sin(now * 29) * tr * 0.02)
  r.setAmbientFx(g.alarm, g.flicker)

  // ---- luces dinámicas
  r.clearLights()
  const ca = Math.cos(g.yaw)
  const sa = Math.sin(g.yaw)
  if (g.flashT > 0 && playing) {
    const k = g.flashT / 0.07
    const plasma = g.cur === 'plasma'
    const big = g.cur === 'shotgun' || g.cur === 'rocket' ? 1.3 : 1
    r.addLight(g.px + ca * 0.8, EYE, g.pz + sa * 0.8, 7 * big, plasma ? 0.4 * k : 1.3 * k, plasma ? 1.1 * k : 0.95 * k, plasma ? 1.5 * k : 0.55 * k)
  }
  for (const f of g.fx) {
    if (!f.light) continue
    const k = 1 - f.t / f.dur
    r.addLight(f.x, f.y + 0.5, f.z, f.light * (0.6 + k * 0.6), 1.8 * k, 1.0 * k, 0.4 * k)
  }
  if (g.boss && g.boss.kind === 'boss3' && g.boss.state !== 'dead') {
    const b = g.boss
    const pulse = 0.7 + Math.sin(now * 4) * 0.3
    r.addLight(b.x, 1.6, b.z, 9, (b.shield ? 0.2 : 1.1) * pulse, (b.shield ? 0.8 : 0.2) * pulse, 1.2 * pulse)
  }
  // proyectiles más cercanos
  const projs = g.projs
  if (projs.length) {
    const lit = projs
      .filter((p) => p.kind !== 'bullet' && p.kind !== 'rock')
      .map((p) => ({ p, d: (p.x - g.px) ** 2 + (p.z - g.pz) ** 2 }))
      .sort((a, b) => a.d - b.d)
    for (const { p } of lit) {
      switch (p.kind) {
        case 'rocket':
        case 'missile':
        case 'mini':
          r.addLight(p.x, p.y, p.z, p.kind === 'mini' ? 2 : 3.6, 1.4, 0.7, 0.25)
          break
        case 'plasma':
          r.addLight(p.x, p.y, p.z, 2.6, 0.3, 0.8, 1.4)
          break
        case 'orb':
          r.addLight(p.x, p.y, p.z, 2.4, 1.0, 0.25, 1.0)
          break
        case 'acid':
          r.addLight(p.x, p.y, p.z, 2, 0.4, 1.0, 0.2)
          break
      }
    }
  }

  // ---- sprites
  r.beginSprites()
  const N = g.atlas.named
  const F = g.atlas.frames
  const al = g.alarm
  const fl = g.flicker
  const camX = g.px
  const camZ = g.pz
  const visible = (x: number, z: number, rad = 1) => {
    const dx = x - camX
    const dz = z - camZ
    if (dx * dx + dz * dz > 34 * 34) return false
    return dx * ca + dz * sa > -rad - 0.5
  }
  const light = (x: number, z: number) => {
    lv.cellLight(x, z, L)
    L[0] = (L[0] + L[3] * al) * fl
    L[1] = (L[1] + L[3] * al * 0.12) * fl
    L[2] = (L[2] + L[3] * al * 0.06) * fl
  }
  // calcomanías
  for (let i = 0; i < g.decals.length; i++) {
    const d = g.decals[i]
    if (!visible(d.x, d.z, d.size)) continue
    const fade = Math.min(1, d.life / 2)
    if (d.full) r.sprite(d.frame, d.x, 0.012 + i * 0.0002, d.z, d.size, d.size, 0.9 * fade + 0.1, 0.9 * fade + 0.1, 0.9 * fade + 0.1, 0, false, 1, 1)
    else {
      light(d.x, d.z)
      r.sprite(d.frame, d.x, 0.012 + i * 0.0002, d.z, d.size, d.size, L[0], L[1], L[2], 0, i % 2 === 0, 1, 0)
    }
  }
  // enemigos
  for (const e of g.enemies) {
    if (!visible(e.x, e.z, e.def.radius * 2)) continue
    if (e.state === 'dead' && e.gibbed) continue
    if (e.state === 'warp' && e.t > 0.35) continue
    const fid = enemyFrame(g, e)
    const f = F[fid]
    const A = g.atlas.anims[e.kind]
    const k = e.def.height / F[A.walk[0]].h
    light(e.x, e.z)
    let flash = e.flash > 0 ? 0.85 : 0
    if (e.state === 'warp') flash = Math.max(flash, e.t / 0.35)
    if (e.elite && e.state !== 'dead') {
      L[0] *= 1.15
      L[1] *= 0.85
      L[2] *= 0.85
    }
    const rx = -sa
    const rz = ca
    const lateral = e.dx * rx + e.dz * rz
    const flip = e.state === 'dead' ? e.id % 2 === 0 : e.def.boss ? false : lateral < -0.15
    let y = e.y
    if (e.state === 'dead' && e.def.boss && e.deathT < 2.4) y += Math.sin(e.deathT * 60) * 0.03
    if (e.def.boss && e.kind === 'boss3') y += Math.sin(now * 1.5) * 0.12
    if (e.state !== 'dead' && !e.def.fly) {
      r.sprite(N.d_shadow, e.x, 0.015, e.z, e.def.radius * 2.6, e.def.radius * 2.6, 1, 1, 1, 0, false, 1, 0)
      if (e.elite) {
        const pu = 0.75 + Math.sin(now * 6 + e.id) * 0.25
        r.sprite(N.d_aura, e.x, 0.02, e.z, e.def.radius * 3.6, e.def.radius * 3.6, pu, 0.35 * pu, 0.25 * pu, 0, false, 1, 1)
      }
    }
    r.sprite(fid, e.x, y, e.z, f.w * k, f.h * k, L[0], L[1], L[2], flash, flip, 0, 0)
  }
  // barriles
  for (const b of g.barrels) {
    if (!b.alive || !visible(b.x, b.z)) continue
    light(b.x, b.z)
    r.sprite(b.hp < 15 ? N.barrel_dmg : N.barrel, b.x, 0, b.z, 0.62, 0.95, L[0], L[1], L[2], b.flash > 0 ? 0.8 : 0)
    r.sprite(N.d_shadow, b.x, 0.015, b.z, 0.7, 0.7, 1, 1, 1, 0, false, 1, 0)
  }
  // objetos
  for (const it of g.pickups) {
    if (!visible(it.x, it.z)) continue
    light(it.x, it.z)
    const pulse = 1.15 + Math.sin(now * 5 + it.x) * 0.2
    const y = it.y + 0.03 + Math.abs(Math.sin(now * 2.5 + it.z)) * 0.06
    r.sprite(N['i_' + it.kind], it.x, y, it.z, 0.46, 0.42, L[0] * pulse + 0.15, L[1] * pulse + 0.15, L[2] * pulse + 0.15)
  }
  // proyectiles
  for (const p of projs) {
    if (!visible(p.x, p.z)) continue
    const name = p.kind === 'mini' ? 'p_rocket' : 'p_' + p.kind
    const s = { rocket: 0.36, plasma: 0.3, bullet: 0.2, acid: 0.32, rock: 0.42, missile: 0.42, orb: 0.46, mini: 0.22 }[p.kind]
    if (p.kind === 'rock') {
      light(p.x, p.z)
      r.sprite(N[name], p.x, p.y - s / 2, p.z, s, s, L[0], L[1], L[2])
    } else r.sprite(N[name], p.x, p.y - s / 2, p.z, s, s, 1, 1, 1, 0, false, 0, 1)
  }
  // partículas
  for (const p of g.particles) {
    if (!visible(p.x, p.z)) continue
    const fade = p.full ? Math.min(1, (p.life / p.max) * 2) : 1
    if (p.full) r.sprite(p.frame, p.x, p.y - p.size / 2, p.z, p.size, p.size, p.r * fade, p.g * fade, p.b * fade, 0, false, 0, 1)
    else {
      light(p.x, p.z)
      r.sprite(p.frame, p.x, p.y - p.size / 2, p.z, p.size, p.size, p.r * L[0] * 1.3, p.g * L[1] * 1.3, p.b * L[2] * 1.3)
    }
  }
  // efectos animados
  for (const f of g.fx) {
    if (!visible(f.x, f.z)) continue
    const i = Math.min(f.frames.length - 1, Math.floor((f.t / f.dur) * f.frames.length))
    const fr = F[f.frames[i]]
    if (f.frames.length === 1 && f.frames[0] === N.d_ring) {
      const s = f.size * (0.3 + (f.t / f.dur) * 0.9)
      r.sprite(f.frames[0], f.x, 0.03, f.z, s, s, 1, 0.9, 0.6, 0, false, 1, 1)
      continue
    }
    const h = f.size * (fr.h / fr.w)
    if (f.full) r.sprite(f.frames[i], f.x, f.y, f.z, f.size, h, 1, 1, 1, 0, false, 0, 1)
    else {
      light(f.x, f.z)
      r.sprite(f.frames[i], f.x, f.y, f.z, f.size, h, L[0] * 1.4, L[1] * 1.4, L[2] * 1.4)
    }
  }
  r.endSprites()
  r.render()
}

// ===========================================================================
// Overlay 2D
// ===========================================================================

let vignette: HTMLCanvasElement | null = null
let vignetteKey = ''

function getVignette(W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`
  if (vignette && vignetteKey === key) return vignette
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')
  if (c) {
    const gr = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7)
    gr.addColorStop(0, 'rgba(0,0,0,0)')
    gr.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.fillStyle = gr
    c.fillRect(0, 0, W, H)
  }
  vignette = cv
  vignetteKey = key
  return cv
}

const AMMO_LABEL: Record<AmmoId, string> = { bullets: 'BAL', shells: 'CAR', rockets: 'COH', cells: 'CEL' }

export function drawOverlay(g: Game, _dt: number) {
  const h = g.hud
  const c = h.ctx
  const W = h.W
  const H = h.H
  const vh = H - h.barH
  c.clearRect(0, 0, W, H)
  if (g.screen === 'title') {
    c.drawImage(getVignette(W, H), 0, 0)
    return
  }
  const now = performance.now() / 1000

  // ---- arma en primera persona
  if (!g.dead || g.deathT < 0.6) {
    const art = g.art[g.cur]
    let img = art.idle[0]
    const fa = g.fireAnim
    if (fa < 0.12) img = art.fire[Math.min(art.fire.length - 1, Math.floor(fa / 0.06))]
    else if (art.pump.length && fa < 0.12 + 0.5) img = art.pump[Math.min(art.pump.length - 1, Math.floor(((fa - 0.12) / 0.5) * art.pump.length))]
    else if (g.cur === 'chaingun') img = art.idle[Math.floor(g.spin) % 2]
    else if (g.cur === 'plasma') img = art.idle[Math.floor(now * 8) % art.idle.length]
    const swayX = Math.cos(g.bob) * 9 * g.bobAmt
    const swayY = Math.abs(Math.sin(g.bob)) * 7 * g.bobAmt
    const drop = g.dead ? g.deathT * 200 : 0
    const x = Math.round(W / 2 - img.width / 2 + swayX + (g.cur === 'pistol' ? 6 : 0))
    const y = Math.round(vh - img.height + 8 + swayY + g.wLower * img.height * 0.9 + g.kick * 0.6 + drop)
    c.drawImage(img, x, y)
    // el arma se oscurece según la luz de la sala
    g.level.cellLight(g.px, g.pz, L)
    const lum = clamp((L[0] + L[1] + L[2]) / 3 + L[3] * g.alarm * 0.3, 0.25, 1) * g.flicker
    if (lum < 0.98) {
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = `rgba(0,0,0,${(1 - lum) * 0.75})`
      c.fillRect(0, 0, W, vh)
      if (L[3] * g.alarm > 0.1) {
        c.fillStyle = `rgba(255,30,10,${Math.min(0.25, L[3] * g.alarm * 0.25)})`
        c.fillRect(0, 0, W, vh)
      }
      c.globalCompositeOperation = 'source-over'
    }
    if (g.flashT > 0) {
      const f = art.flash
      c.drawImage(f, Math.round(W / 2 - f.width / 2 + swayX + (g.cur === 'pistol' ? 6 : 0)), Math.round(y - f.height / 2 + art.flashY))
    }
  }

  // ---- mira
  const cx = Math.floor(W / 2)
  const cy = Math.floor(vh / 2)
  if (!g.dead) {
    const col = g.killMark > 0 ? '#ff3020' : g.hitMark > 0 ? '#ffd040' : 'rgba(255,255,255,0.75)'
    c.fillStyle = col
    const gap = g.killMark > 0 ? 3 : 2
    c.fillRect(cx - gap - 2, cy, 2, 1)
    c.fillRect(cx + gap + 1, cy, 2, 1)
    c.fillRect(cx, cy - gap - 2, 1, 2)
    c.fillRect(cx, cy + gap + 1, 1, 2)
    if (g.killMark > 0) {
      for (let i = 2; i < 5; i++) {
        c.fillRect(cx - i, cy - i, 1, 1)
        c.fillRect(cx + i, cy - i, 1, 1)
        c.fillRect(cx - i, cy + i, 1, 1)
        c.fillRect(cx + i, cy + i, 1, 1)
      }
    }
  }

  // ---- textos flotantes en el mundo
  const cam = g.r.camera
  for (const f of g.floaters) {
    v3.set(f.x, f.y, f.z).project(cam)
    if (v3.z > 1 || v3.z < -1) continue
    const sx = (v3.x * 0.5 + 0.5) * W
    const sy = (-v3.y * 0.5 + 0.5) * H
    if (sx < -40 || sx > W + 40 || sy < 0 || sy > vh) continue
    h.text(f.text, sx, sy, f.color, f.big ? 2 : 1, 'center')
  }

  // ---- indicadores de daño
  for (const d of g.dmgDirs) {
    const rel = angDiff(g.yaw, d.a)
    const px = cx + Math.sin(rel) * Math.min(W, vh) * 0.38
    const py = cy - Math.cos(rel) * vh * 0.36
    c.fillStyle = `rgba(255,30,20,${Math.min(0.9, d.t)})`
    c.save()
    c.translate(px, py)
    c.rotate(rel)
    c.fillRect(-7, -2, 14, 3)
    c.fillRect(-4, -4, 8, 2)
    c.restore()
  }

  // ---- tintes de pantalla
  c.drawImage(getVignette(W, H), 0, 0)
  const lowHp = !g.dead && g.p.hp < g.p.maxHp * 0.3
  if (lowHp) {
    const a = (0.12 + Math.sin(now * 6) * 0.08) * (1 - g.p.hp / (g.p.maxHp * 0.3))
    c.fillStyle = `rgba(160,0,0,${a + 0.05})`
    c.fillRect(0, 0, W, vh)
  }
  if (g.hurtFlash > 0) {
    c.fillStyle = `rgba(255,0,0,${g.hurtFlash * 0.45})`
    c.fillRect(0, 0, W, vh)
  }
  if (g.pickFlash > 0) {
    c.fillStyle = `rgba(255,220,90,${g.pickFlash * 0.35})`
    c.fillRect(0, 0, W, vh)
  }
  if (g.whiteFlash > 0) {
    c.fillStyle = `rgba(255,240,220,${g.whiteFlash * 0.5})`
    c.fillRect(0, 0, W, vh)
  }
  if (g.dead) {
    c.fillStyle = `rgba(120,0,0,${Math.min(0.55, g.deathT * 0.4)})`
    c.fillRect(0, 0, W, vh)
  }

  // ---- barra del HUD
  const p = g.p
  const cur = WEAPON_BY_ID[g.cur]
  const faceMode = g.dead
    ? 'dead'
    : g.faceMode === 'pain'
      ? 'pain'
      : g.faceMode === 'grin'
        ? 'grin'
        : g.angryT > 1
          ? 'angry'
          : 'normal'
  const frac = p.hp / p.maxHp
  h.drawBar({
    hp: p.hp,
    maxHp: p.maxHp,
    armor: p.armor,
    ammo: cur.ammo ? p.ammo[cur.ammo] : 0,
    ammoInfinite: !cur.ammo || (g.stats.infiniteBullets && cur.ammo === 'bullets'),
    ammoTable: (['bullets', 'shells', 'rockets', 'cells'] as AmmoId[]).map((a) => [AMMO_LABEL[a], p.ammo[a], g.maxAmmo(a)] as [string, number, number]),
    owned: WEAPONS.map((w) => p.owned[w.id]),
    current: cur.slot - 1,
    faceTier: frac > 0.8 ? 0 : frac > 0.6 ? 1 : frac > 0.4 ? 2 : frac > 0.2 ? 3 : 4,
    faceLook: g.faceLook,
    faceMode,
    skin: g.soldier.skin,
    hair: g.soldier.hair,
  })

  // ---- información superior
  h.text('PUNTOS', 4, 4, '#b8a890', 1)
  h.text(g.score.toLocaleString('en-US'), 4, 13, '#ffffff', 2, 'left', true)
  const mult = g.mult()
  if (mult > 1 || g.chain > 0) {
    const mx = 4 + h.measure(g.score.toLocaleString('en-US'), 2) + 8
    if (mult > 1) h.text(`X${mult}`, mx, 13, mult >= 6 ? '#ff4020' : mult >= 4 ? '#ffa020' : '#ffd040', 2, 'left', true)
    const bw = 40
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.fillRect(4, 30, bw, 3)
    c.fillStyle = '#ffd040'
    c.fillRect(4, 30, Math.round(bw * clamp(g.chainT / 3, 0, 1)), 3)
    h.text(`RACHA ${g.chain}`, 4 + bw + 4, 28, '#ffd040', 1)
  }
  const local = ((g.wave - 1) % 5) + 1
  const bossWave = local === 5
  h.text(bossWave ? 'JEFE' : `OLEADA ${g.wave}`, W - 4, 4, bossWave ? '#ff4030' : '#ff6a50', 1, 'right')
  const left = g.enemies.reduce((a, e) => a + (e.state !== 'dead' ? 1 : 0), 0) + g.queue.length
  if (g.phase === 'fight' && !bossWave) h.text(`ENEMIGOS ${left}`, W - 4, 13, '#e8d8c0', 1, 'right')
  if (g.cycle > 0) h.text(`CICLO ${g.cycle + 1}`, W - 4, 22, '#c080ff', 1, 'right')
  if (g.frenzyT > 0) h.text('FRENESI', W - 4, 31, '#ff8040', 1, 'right')

  // ---- barra del jefe
  if (g.boss && g.boss.state !== 'dead' && g.boss.state !== 'warp') {
    const b = g.boss
    const bw = Math.min(200, Math.round(W * 0.42))
    const bx = Math.round(W / 2 - bw / 2)
    const by = 26
    h.text(g.bossName, W / 2, by - 10, b.shield ? '#60e0ff' : '#ff4030', 1, 'center')
    c.fillStyle = '#000000'
    c.fillRect(bx - 2, by - 1, bw + 4, 8)
    c.fillStyle = '#3a0808'
    c.fillRect(bx, by + 1, bw, 4)
    const f = clamp(b.hp / b.maxHp, 0, 1)
    c.fillStyle = b.shield ? '#40c0ff' : b.phase >= 1 ? '#ff3020' : '#e02a1a'
    c.fillRect(bx, by + 1, Math.round(bw * f), 4)
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.fillRect(bx, by + 1, Math.round(bw * f), 1)
    // marcas de fase
    c.fillStyle = '#000000'
    const marks = b.kind === 'boss1' ? [0.5] : b.kind === 'boss2' ? [0.6, 0.25] : [0.66, 0.33]
    for (const m of marks) c.fillRect(bx + Math.round(bw * m), by, 1, 6)
  }

  // ---- mensajes
  if (g.msg) {
    const a = Math.min(1, g.msg.t * 3)
    if (a > 0.2) h.text(g.msg.text, W / 2, vh - 18, '#ffe080', 1, 'center')
  }
  if (!g.dead && cur.ammo && !g.hasAmmo(g.cur) && Math.floor(now * 3) % 2 === 0) h.text('SIN MUNICION', W / 2, cy + 14, '#ff4030', 1, 'center')

  // ---- cartel central
  if (g.banner && g.screen === 'playing') {
    const b = g.banner
    const pop = b.t < 0.12 ? 1 + (0.12 - b.t) * 4 : 1
    const vis = b.t < b.dur - 0.25 || Math.floor(now * 12) % 2 === 0
    if (vis) {
      const scale = h.measure(b.text, 3) < W - 16 ? 3 : 2
      const s = Math.max(1, Math.round(scale * pop))
      h.text(b.text, W / 2, cy - 30 - s * 4, b.color, s, 'center', true)
      if (b.sub) h.text(b.sub, W / 2, cy - 30 + s * 5, '#ffffff', 1, 'center', true)
    }
  }

  // ---- fundido de transición
  if (g.fade > 0) {
    c.fillStyle = `rgba(0,0,0,${g.fade})`
    c.fillRect(0, 0, W, H)
    if (g.fade > 0.95 && g.banner) {
      const b = g.banner
      h.text(b.text, W / 2, H / 2 - 12, b.color, 2, 'center')
      if (b.sub) h.text(b.sub, W / 2, H / 2 + 8, '#c0b0a0', 1, 'center')
    }
  }
}
