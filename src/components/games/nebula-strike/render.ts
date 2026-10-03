/** Dibujo del mundo, la nave, efectos y HUD de Nebula Strike. */
import type { Game } from './game'
import { SHIPS, laserStats, shipSprite } from './ships'
import { BCOL, NCOL, baseTransform, bulletSprite, cached, drawAt, drawRot, drawSprite, flashOf, glow, origin, type Sprite } from './sprites'
import { drawBuild, drawPause, drawTally, drawTitle, drawUpgrade, ptext, utext } from './screens'
import { ACCENT, H, RS, TAU, W, clamp, easeOut, fmt, mix, pixelFont, rgba } from './util'
import { rr } from '../game-utils'

// ===================== Sprites auxiliares =====================

function laserStrip(col: string): Sprite {
  // sección transversal del haz (horizontal), se estira en vertical
  return cached('lstrip|' + col, 32, 4, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 32, 0)
    g.addColorStop(0, rgba(col, 0))
    g.addColorStop(0.25, rgba(col, 0.55))
    g.addColorStop(0.42, mix(col, '#ffffff', 0.6))
    g.addColorStop(0.5, '#ffffff')
    g.addColorStop(0.58, mix(col, '#ffffff', 0.6))
    g.addColorStop(0.75, rgba(col, 0.55))
    g.addColorStop(1, rgba(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 4)
  })
}
function beamStrip(col: string): Sprite {
  // a lo largo de x; ancho en y
  return cached('bstrip|' + col, 4, 32, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 32)
    g.addColorStop(0, rgba(col, 0))
    g.addColorStop(0.3, rgba(col, 0.6))
    g.addColorStop(0.45, mix(col, '#ffffff', 0.7))
    g.addColorStop(0.5, '#ffffff')
    g.addColorStop(0.55, mix(col, '#ffffff', 0.7))
    g.addColorStop(0.7, rgba(col, 0.6))
    g.addColorStop(1, rgba(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 32)
  })
}
function capsule(letter: string, col: string): Sprite {
  return cached('cap|' + letter + col, 26, 22, (ctx) => {
    const g = ctx.createRadialGradient(13, 11, 2, 13, 11, 13)
    g.addColorStop(0, rgba(col, 0.55))
    g.addColorStop(1, rgba(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 26, 22)
    rr(ctx, 4, 4, 18, 14, 5)
    ctx.fillStyle = mix(col, '#0a0a1a', 0.55)
    ctx.fill()
    ctx.strokeStyle = col
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, 13, 11.5)
  })
}
function medalSprite(): Sprite {
  return cached('medal', 18, 18, (ctx) => {
    const g = ctx.createRadialGradient(7, 7, 1, 9, 9, 8)
    g.addColorStop(0, '#fffbeb')
    g.addColorStop(0.4, '#fbbf24')
    g.addColorStop(1, '#92400e')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(9, 9, 7, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#fffbeb'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 1.6 : 4
      if (i === 0) ctx.moveTo(9 + Math.cos(a) * r, 9 + Math.sin(a) * r)
      else ctx.lineTo(9 + Math.cos(a) * r, 9 + Math.sin(a) * r)
    }
    ctx.fill()
  })
}
function gunPod(col: string): Sprite {
  return cached('pod|' + col, 8, 14, (ctx) => {
    ctx.fillStyle = mix(col, '#101028', 0.5)
    ctx.strokeStyle = col
    ctx.lineWidth = 1
    ctx.fillRect(1.5, 2, 5, 10)
    ctx.strokeRect(1.5, 2, 5, 10)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(3, 0.5, 2, 3)
  })
}
function droneSprite(): Sprite {
  return cached('drone', 18, 18, (ctx) => {
    const g = ctx.createRadialGradient(9, 9, 0, 9, 9, 9)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, '#a5f3fc')
    g.addColorStop(0.6, 'rgba(34,211,238,0.35)')
    g.addColorStop(1, 'rgba(34,211,238,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 18, 18)
    ctx.strokeStyle = '#e0f2fe'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(9, 9, 5.5, 0.3, 2.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(9, 9, 5.5, 3.4, 5.8)
    ctx.stroke()
  })
}

// ===================== Mundo =====================

function drawBullets(ctx: CanvasRenderingContext2D, g: Game) {
  for (let i = 0; i < g.nb; i++) {
    const b = g.bullets[i]
    const s = bulletSprite(b.spr)
    if (b.delay > 0) {
      const gs = glow(BCOL[b.spr % NCOL], 8)
      const k = 1 - Math.min(1, b.delay / 0.4)
      ctx.globalAlpha = 0.3 + k * 0.5
      ctx.drawImage(gs.c, b.x - 4 - k * 3, b.y - 4 - k * 3, 8 + k * 6, 8 + k * 6)
      ctx.globalAlpha = 1
      continue
    }
    if (b.rot) drawAt(ctx, s, b.x, b.y, Math.atan2(b.vy, b.vx))
    else ctx.drawImage(s.c, b.x - s.w / 2, b.y - s.h / 2, s.w, s.h)
  }
}

function drawShots(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.globalAlpha = g.ns > 90 ? 0.6 : 0.75
  for (let i = 0; i < g.ns; i++) {
    const s = g.shots[i]
    if (s.kind === 1) drawAt(ctx, s.spr, s.x, s.y, s.ang)
    else if (Math.abs(s.vx) > 30) drawAt(ctx, s.spr, s.x, s.y, Math.atan2(s.vy, s.vx) + Math.PI / 2)
    else ctx.drawImage(s.spr.c, s.x - s.spr.w / 2, s.y - s.spr.h / 2, s.spr.w, s.spr.h)
  }
  ctx.globalAlpha = 1
}

function drawEnemies(ctx: CanvasRenderingContext2D, g: Game) {
  const b = g.boss
  if (b) {
    const body = b.def.sprite(g, b)
    const dying = b.state === 'dying'
    const entering = b.state === 'enter'
    if (entering) ctx.globalAlpha = clamp(b.stateT / 1.2, 0.2, 1)
    if (!dying || Math.sin(b.deathT * 50) > -0.6) {
      drawSprite(ctx, body, b.x, b.y)
      const hitBlink = b.core.flash > 0 && Math.floor(g.time * 24) % 3 === 0
      if (hitBlink || b.state === 'trans' || dying) {
        ctx.globalAlpha = dying ? 0.5 + Math.sin(b.deathT * 30) * 0.3 : b.state === 'trans' ? 0.35 + Math.sin(b.stateT * 30) * 0.25 : 0.22
        drawSprite(ctx, flashOf(body), b.x, b.y)
      }
    }
    ctx.globalAlpha = 1
    b.def.overlay?.(ctx, g, b)
  }
  for (const e of g.enemies) {
    if (!e.alive || e.def.id === 'bosscore') continue
    const s = e.def.sprite(g, e)
    const spr = e.flash > 0 && (e.def.size === 0 || Math.floor(g.time * 24) % 3 === 0) ? flashOf(s) : s
    if (e.def.rotates) drawAt(ctx, spr, e.x, e.y, e.ang - Math.PI / 2)
    else ctx.drawImage(spr.c, e.x - spr.w / 2, e.y - spr.h / 2, spr.w, spr.h)
    if (e.def.id === 'sniper' && e.t > 0.9 && e.t < 1.7) {
      // mira láser de aviso
      ctx.strokeStyle = `rgba(255,59,92,${0.35 + Math.sin(e.t * 40) * 0.25})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(e.x, e.y)
      ctx.lineTo(e.x + Math.cos(e.a) * 600, e.y + Math.sin(e.a) * 600)
      ctx.stroke()
    }
    if (e.def.id === 'bosspart' && e.boss && e.hp < e.maxHp * 0.35 && Math.random() < 0.15) g.puff(e.x + (Math.random() - 0.5) * 10, e.y, '#9ca3af', 10, 0.5, 0, -20, 0.5)
  }
}

function drawItems(ctx: CanvasRenderingContext2D, g: Game) {
  const ms = medalSprite()
  for (const it of g.items) {
    if (!it.alive) continue
    if (it.kind === 'M') {
      const sx = Math.abs(Math.cos(it.t * 7)) * 0.85 + 0.15
      ctx.drawImage(ms.c, it.x - (ms.w * sx) / 2, it.y - ms.h / 2, ms.w * sx, ms.h)
    } else {
      const s = capsule(it.kind === 'P' ? 'P' : it.kind === 'B' ? 'B' : '1', it.kind === 'P' ? '#38bdf8' : it.kind === 'B' ? '#f472b6' : '#4ade80')
      const blink = Math.sin(it.t * 10) > 0 ? 1 : 0.8
      ctx.globalAlpha = blink
      drawSprite(ctx, s, it.x, it.y)
      ctx.globalAlpha = 1
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, g: Game) {
  // capa aditiva: brillos y anillos
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < g.np; i++) {
    const p = g.parts[i]
    const k = p.life / p.max
    if (p.kind === 1 && p.spr) {
      const sc = p.size * (p.kind === 1 ? 1 : 1)
      const w = p.spr.w * sc
      ctx.globalAlpha = k
      ctx.drawImage(p.spr.c, p.x - w / 2, p.y - w / 2, w, w)
    } else if (p.kind === 3) {
      ctx.globalAlpha = k * 0.9
      ctx.strokeStyle = p.color
      ctx.lineWidth = Math.max(0.5, p.drag * k)
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, TAU)
      ctx.stroke()
    } else if (p.kind === 2) {
      ctx.globalAlpha = k
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.size
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
      ctx.stroke()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < g.np; i++) {
    const p = g.parts[i]
    if (p.kind !== 0 && p.kind !== 4) continue
    ctx.globalAlpha = p.life / p.max
    ctx.fillStyle = p.color
    if (p.kind === 4) {
      const c = Math.cos(p.rot)
      const s = Math.sin(p.rot)
      ctx.setTransform(RS * c, RS * s, -RS * s, RS * c, RS * (p.x + origin.x), RS * (p.y + origin.y))
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  baseTransform(ctx)
  ctx.globalAlpha = 1
}

function drawBeams(ctx: CanvasRenderingContext2D, g: Game) {
  for (const b of g.beams) {
    const col = BCOL[b.color]
    if (b.t < b.warn) {
      const k = b.t / b.warn
      ctx.strokeStyle = rgba(col, 0.25 + 0.4 * (Math.sin(b.t * 30) * 0.5 + 0.5))
      ctx.lineWidth = 1 + k * 2
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x + Math.cos(b.ang) * 800, b.y + Math.sin(b.ang) * 800)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      const left = b.warn + b.dur - b.t
      const grow = Math.min(1, (b.t - b.warn) / 0.08) * Math.min(1, left / 0.15)
      const s = beamStrip(col)
      const c = Math.cos(b.ang)
      const sn = Math.sin(b.ang)
      ctx.globalCompositeOperation = 'lighter'
      ctx.setTransform(RS * c, RS * sn, -RS * sn, RS * c, RS * (b.x + origin.x), RS * (b.y + origin.y))
      const wv = b.w * grow * (1 + Math.sin(g.time * 50) * 0.08)
      ctx.drawImage(s.c, 0, -wv, 800, wv * 2)
      baseTransform(ctx)
      ctx.globalCompositeOperation = 'source-over'
      drawSprite(ctx, glow(col, 20, 0.2), b.x, b.y, grow * 1.4)
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  if (!p.alive) return
  const s = SHIPS[g.shipId]
  const t = g.time
  if (p.inv > 0 && g.mode !== 'title' && Math.floor(t * 16) % 2 === 0 && g.bombT <= 0) return

  // estela
  const trail = g.up('speed')
  if (trail > 0 || p.focus) {
    const gs = glow(trail > 0 ? '#34d399' : s.color, 8)
    ctx.globalCompositeOperation = 'lighter'
    const n = p.trailX.length
    for (let i = 1; i < n; i++) {
      const idx = (p.trailI - i + n) % n
      const k = 1 - i / n
      ctx.globalAlpha = k * (trail > 0 ? 0.55 : 0.25)
      const sz = 6 + k * (trail > 0 ? 10 : 5)
      ctx.drawImage(gs.c, p.trailX[idx] - sz / 2, p.trailY[idx] + 10 - sz / 2, sz, sz)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // motor
  const flick = 0.8 + Math.sin(t * 60) * 0.2
  const fl = glow(s.color, 12, 0.25)
  ctx.globalCompositeOperation = 'lighter'
  const len = (p.focus ? 10 : 16) * flick
  ctx.drawImage(fl.c, p.x - 5, p.y + 8, 10, len)
  if (g.shipId === 1)
    for (const dx of [-9.5, 9.5]) ctx.drawImage(fl.c, p.x + dx - 3.5, p.y + 11, 7, len * 0.7)
  ctx.globalCompositeOperation = 'source-over'

  // cañones extra según nivel
  const L = g.power
  const pod = gunPod(g.up('fury') && g.mult >= 8 ? '#fde047' : s.color)
  const sx = 1 - Math.abs(p.bank) * 0.22
  if (L >= 3) for (const d of [-1, 1]) drawSprite(ctx, pod, p.x + d * 13 * sx, p.y + 1)
  if (L >= 5) for (const d of [-1, 1]) drawSprite(ctx, pod, p.x + d * 18 * sx, p.y + 6)
  if (L >= 7) for (const d of [-1, 1]) drawSprite(ctx, pod, p.x + d * 7 * sx, p.y - 11)
  if (g.up('missiles')) {
    ctx.fillStyle = '#fb923c'
    for (const d of [-1, 1]) ctx.fillRect(p.x + d * 9 * sx - 2, p.y + 4, 4, 7)
  }
  if (g.up('rear')) {
    ctx.fillStyle = s.color
    for (const d of [-1, 1]) ctx.fillRect(p.x + d * 5 - 1.5, p.y + 11, 3, 5)
  }

  // nave con alabeo
  drawRot(ctx, shipSprite(g.shipId), p.x, p.y, 0, 1, sx)

  // escudo
  if (p.shield > 0 && g.mode !== 'title') {
    const pulse = 0.5 + Math.sin(t * 4) * 0.2
    ctx.strokeStyle = rgba('#60a5fa', pulse)
    ctx.lineWidth = 1.5 + (p.shield - 1)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 20, 0, TAU)
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.25
    drawSprite(ctx, glow('#60a5fa', 24), p.x, p.y)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawDrones(ctx: CanvasRenderingContext2D, g: Game) {
  if (!g.player.alive) return
  const ds = droneSprite()
  for (const d of g.drones) drawSprite(ctx, ds, d.x, d.y)
}

function drawLaser(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  if (!p.laser || !p.alive) return
  const ls = laserStats(g.power)
  const col = g.up('fury') && g.mult >= 8 ? '#fde047' : SHIPS[1].color
  const s = laserStrip(col)
  const top = Math.max(-10, p.laserTop)
  const y0 = p.y - 14
  const wv = ls.w * (0.95 + Math.sin(g.time * 70) * 0.1)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(s.c, p.x - wv, top, wv * 2, y0 - top)
  ctx.globalAlpha = 0.6
  ctx.drawImage(s.c, p.x - wv * 0.45, top, wv * 0.9, y0 - top)
  ctx.globalAlpha = 1
  drawSprite(ctx, glow(col, 16, 0.25), p.x, y0, 1 + Math.sin(g.time * 40) * 0.1)
  if (g.laserHitting) drawSprite(ctx, glow('#ffffff', 16, 0.3), p.x, top + 4, 1.2 + Math.random() * 0.4)
  ctx.globalCompositeOperation = 'source-over'
}

function drawHitbox(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  if (!p.alive || g.mode === 'title' || p.entering > 0) return
  const col = SHIPS[g.shipId].color
  if (p.focus) {
    ctx.strokeStyle = rgba(col, 0.55)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(p.x, p.y, 9, g.time * 4, g.time * 4 + 4.4)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'lighter'
  drawSprite(ctx, glow(col, 8, 0.3), p.x, p.y, p.focus ? 1.2 : 0.9)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.arc(p.x, p.y, 3.3, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(p.x, p.y, 2.2, 0, TAU)
  ctx.fill()
}

// ===================== HUD =====================

function drawHud(ctx: CanvasRenderingContext2D, g: Game, best: number) {
  const s = SHIPS[g.shipId]
  // franja superior
  const grd = ctx.createLinearGradient(0, 0, 0, 30)
  grd.addColorStop(0, 'rgba(2,3,10,0.7)')
  grd.addColorStop(1, 'rgba(2,3,10,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, W, 30)
  ptext(ctx, fmt(g.scoreShown), 8, 11, 10, '#ffffff', 'left')
  ptext(ctx, `HI ${fmt(Math.max(best, g.score))}`, W - 8, 10, 7, 'rgba(255,255,255,0.6)', 'right')
  ptext(ctx, `S${g.sectorLabel}`, W - 8, 22, 7, rgba(ACCENT, 0.85), 'right')
  // cadena
  if (g.mult > 1 || g.chain > 0) {
    const col = g.mult >= 8 ? '#fde047' : g.mult >= 4 ? '#fb923c' : '#67e8f9'
    ptext(ctx, `x${g.mult}`, 8, 25, 8, col, 'left')
    const cm = 1.7 * (1 + g.up('chain') * 0.4)
    const w = 52 * clamp(g.chainT / cm, 0, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(38, 23, 52, 3)
    ctx.fillStyle = col
    ctx.fillRect(38, 23, w, 3)
    utext(ctx, `${g.chain}`, 95, 25, 9, 'rgba(255,255,255,0.55)', 'left', 700)
  }
  // medalla
  const mv = g.medalValue()
  if (g.medalIdx > 0) {
    drawSprite(ctx, medalSprite(), W - 96, 22, 0.6)
    ptext(ctx, fmt(mv), W - 88, 22, 6, '#fde68a', 'left')
  }

  // jefe / mid-boss
  const b = g.boss
  if (b) {
    const y = 36
    const k = b.state === 'enter' ? easeOut(clamp(b.stateT / 1, 0, 1)) : 1
    ctx.globalAlpha = k
    ptext(ctx, b.def.name, 10, y, 7, '#fca5a5', 'left')
    const bx = 64
    const bw = W - bx - 10
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(bx - 1, y - 4, bw + 2, 8)
    const frac = clamp(b.hpShown, 0, 1)
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    hg.addColorStop(0, '#f43f5e')
    hg.addColorStop(1, '#fb923c')
    ctx.fillStyle = hg
    ctx.fillRect(bx, y - 3, bw * frac, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillRect(bx, y - 3, bw * frac, 1)
    for (const ph of b.def.phases) if (ph.until > 0) ctx.fillRect(bx + bw * ph.until - 0.5, y - 5, 1, 10)
    ctx.globalAlpha = 1
  } else if (g.midboss && g.midboss.alive) {
    const m = g.midboss
    const y = 36
    ptext(ctx, 'MID', 10, y, 6, '#fdba74', 'left')
    const bx = 40
    const bw = 120
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(bx - 1, y - 3, bw + 2, 6)
    ctx.fillStyle = '#fb923c'
    ctx.fillRect(bx, y - 2, bw * clamp(m.hp / m.maxHp, 0, 1), 4)
  }

  // inferior izquierda: vidas y bombas
  const ss = shipSprite(g.shipId)
  for (let i = 0; i < Math.min(g.lives, 6); i++) drawSprite(ctx, ss, 12 + i * 13, H - 26, 0.42)
  if (g.lives > 6) ptext(ctx, `+${g.lives - 6}`, 12 + 6 * 13, H - 26, 6, '#ffffff', 'left')
  for (let i = 0; i < g.bombMax; i++) {
    const has = i < g.bombs
    ctx.fillStyle = has ? '#f472b6' : 'rgba(244,114,182,0.2)'
    ctx.beginPath()
    ctx.arc(12 + i * 13, H - 11, 4.5, 0, TAU)
    ctx.fill()
    if (has) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(11 + i * 13, H - 17, 2, 3)
    }
  }
  // inferior derecha: build
  drawBuild(ctx, g, W - 6, H - 11, 'right', 0.85)
  if (g.player.shield > 0) ptext(ctx, 'ESC', W - 8, H - 26, 6, '#93c5fd', 'right')
  void s
}

function drawBanner(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.bannerT <= 0 || !g.banner) return
  const t = g.bannerT
  const a = Math.min(1, t / 0.4, 1)
  const y = g.mode === 'boss' ? 210 : 200
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(2,3,12,0.5)'
  ctx.fillRect(0, y - 26, W, 54)
  ctx.fillStyle = rgba(ACCENT, 0.7)
  const lw = W * Math.min(1, (3.2 - t) * 2)
  ctx.fillRect(W / 2 - lw / 2, y - 26, lw, 1)
  ctx.fillRect(W / 2 - lw / 2, y + 27, lw, 1)
  // revelado letra a letra
  const full = g.banner
  const n = Math.min(full.length, Math.floor((3.4 - t) * 22))
  ptext(ctx, full.slice(0, Math.max(0, n)), W / 2, y - 6, g.mode === 'boss' ? 18 : 16, g.mode === 'boss' ? '#fca5a5' : '#ffffff')
  ptext(ctx, g.bannerSub, W / 2, y + 15, 8, g.mode === 'boss' ? '#fdba74' : ACCENT)
  ctx.globalAlpha = 1
}

function drawWarning(ctx: CanvasRenderingContext2D, g: Game) {
  const t = g.modeT
  const a = Math.min(1, t / 0.3) * Math.min(1, (3.4 - t) / 0.4)
  if (a <= 0) return
  const pulse = 0.5 + Math.sin(t * 8) * 0.5
  ctx.globalAlpha = a * (0.18 + pulse * 0.16)
  ctx.fillStyle = '#ff1e3c'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = a
  for (const y of [190, 270]) {
    ctx.fillStyle = 'rgba(30,0,6,0.85)'
    ctx.fillRect(0, y, W, 20)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, y, W, 20)
    ctx.clip()
    ctx.fillStyle = '#ff1e3c'
    const off = ((t * 60 * (y === 190 ? 1 : -1)) % 28) - 28
    for (let x = off; x < W + 28; x += 28) {
      ctx.beginPath()
      ctx.moveTo(x, y + 20)
      ctx.lineTo(x + 10, y)
      ctx.lineTo(x + 20, y)
      ctx.lineTo(x + 10, y + 20)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
  if (Math.sin(t * 9) > -0.4) ptext(ctx, 'WARNING', W / 2, 240, 26, '#ff4d6d')
  ptext(ctx, 'SE ACERCA UNA NAVE COLOSAL', W / 2, 300, 7, '#fecdd3')
  ctx.globalAlpha = 1
}

function drawControls(ctx: CanvasRenderingContext2D, g: Game, touch: boolean) {
  const a = Math.min(1, (g.modeT - 0.6) / 0.4, (4 - g.modeT) / 0.4)
  if (a <= 0) return
  ctx.globalAlpha = a
  const rows = touch
    ? [
        ['ARRASTRA', 'mover (en cualquier parte)'],
        ['2 DEDOS', 'modo concentrado'],
        ['BOMBA', 'botón de abajo'],
      ]
    : [
        ['FLECHAS', 'mover  (o clic y arrastrar)'],
        ['ESPACIO', 'mantener: modo concentrado'],
        ['SHIFT / X', 'bomba'],
      ]
  const y0 = 300
  rr(ctx, 40, y0 - 14, W - 80, 86, 10)
  ctx.fillStyle = 'rgba(3,5,16,0.7)'
  ctx.fill()
  ctx.strokeStyle = rgba(ACCENT, 0.35)
  ctx.lineWidth = 1
  ctx.stroke()
  for (let i = 0; i < rows.length; i++) {
    ptext(ctx, rows[i][0], 54, y0 + 4 + i * 20, 7, ACCENT, 'left')
    utext(ctx, rows[i][1], 140, y0 + 4 + i * 20, 11, 'rgba(255,255,255,0.8)', 'left')
  }
  utext(ctx, 'El disparo es automático', W / 2, y0 + 64, 10, 'rgba(255,255,255,0.5)')
  ctx.globalAlpha = 1
}

// ===================== Frame =====================

export function renderFrame(ctx: CanvasRenderingContext2D, g: Game, best: number, touch: boolean) {
  origin.x = 0
  origin.y = 0
  baseTransform(ctx)
  g.bg.draw(ctx, g.time)

  // temblor de cámara
  const tr = g.juice.trauma
  if (tr > 0) {
    const s = tr * tr * 9
    origin.x = Math.sin(g.time * 102) * s
    origin.y = Math.cos(g.time * 138) * s
  }
  baseTransform(ctx)

  if (g.mode === 'title') {
    ctx.save()
    ctx.beginPath()
    ctx.rect(24, 138, W - 48, 166)
    ctx.clip()
    drawShots(ctx, g)
    drawLaser(ctx, g)
    drawDrones(ctx, g)
    drawPlayer(ctx, g)
    ctx.restore()
    drawParticles(ctx, g)
    origin.x = origin.y = 0
    baseTransform(ctx)
    drawTitle(ctx, g, best, touch)
    return
  }

  drawItems(ctx, g)
  drawEnemies(ctx, g)
  drawShots(ctx, g)
  drawLaser(ctx, g)
  drawPlayer(ctx, g)
  drawDrones(ctx, g)
  drawParticles(ctx, g)
  drawBeams(ctx, g)
  drawBullets(ctx, g)
  drawHitbox(ctx, g)
  g.juice.drawTexts(ctx, pixelFont())

  // bomba: tinte de pantalla
  if (g.bombT > 0) {
    const k = g.bombT / g.bombDur
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.12 * k
    ctx.fillStyle = SHIPS[g.shipId].color
    ctx.fillRect(-20, -20, W + 40, H + 40)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  origin.x = origin.y = 0
  baseTransform(ctx)
  if (g.mode !== 'over') drawHud(ctx, g, best)
  if (g.mode === 'warning') drawWarning(ctx, g)
  drawBanner(ctx, g)
  if (g.mode === 'intro' && g.sectorsCleared === 0) drawControls(ctx, g, touch)
  if (g.mode === 'clear') drawTally(ctx, g)
  if (g.mode === 'upgrade') drawUpgrade(ctx, g, touch)
  if (g.mode === 'warp' && g.modeT > 0.4 && g.modeT < 2.2 && g.bannerT > 0 && g.loop > 0 && g.sector === 0) {
    // aviso de nuevo ciclo (ya se muestra en el banner)
  }
  if (g.mode === 'over') {
    ctx.fillStyle = 'rgba(2,3,10,0.35)'
    ctx.fillRect(0, 0, W, H)
  }
  g.juice.drawFlash(ctx, W, H)
  if (g.paused) drawPause(ctx, touch, g.time)
}

