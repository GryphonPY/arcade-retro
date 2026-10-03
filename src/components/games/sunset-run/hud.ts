/** HUD retro: posición, vuelta, tiempo, velocímetro, nitro, minimapa, semáforo, carteles y podio. */
import { KMH, type Race } from './race'
import type { Renderer } from './render'
import { CAR_H, CAR_W, type CarFrames } from './sprites'
import { SEG_LEN, type Track } from './track'
import { clamp, easeOut, fmtTime, makeCanvas } from './util'

export interface Banner {
  text: string
  sub: string
  color: string
  t: number
  dur: number
}
export interface HudState {
  banner: Banner | null
  radio: { name: string; freq: string; color: string; t: number } | null
  touch: boolean
  font: string
}

const SHADOW = 'rgba(0,0,0,0.75)'

function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, font: string, align: CanvasTextAlign = 'left', shadow = true) {
  c.font = `${size}px ${font}`
  c.textAlign = align
  if (shadow) {
    c.fillStyle = SHADOW
    c.fillText(s, x + Math.max(1, size * 0.12), y + Math.max(1, size * 0.12))
  }
  c.fillStyle = col
  c.fillText(s, x, y)
}

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6, a = 0.42) {
  c.fillStyle = `rgba(8,6,16,${a})`
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
  c.fill()
}

export function makeMinimap(t: Track, size: number): HTMLCanvasElement {
  const k = 2
  const [cv, c] = makeCanvas(size * k, size * k)
  c.scale(k, k)
  const pad = 6
  const s = size - pad * 2
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const path = () => {
    c.beginPath()
    for (let i = 0; i <= t.N; i += 4) {
      const x = size / 2 + t.mapX[i] * s
      const y = size / 2 + t.mapY[i] * s
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
  }
  path()
  c.strokeStyle = 'rgba(0,0,0,0.7)'
  c.lineWidth = 5
  c.stroke()
  path()
  c.strokeStyle = 'rgba(255,255,255,0.85)'
  c.lineWidth = 2
  c.stroke()
  // meta
  const sx = size / 2 + t.mapX[34] * s
  const sy = size / 2 + t.mapY[34] * s
  c.fillStyle = '#f97316'
  c.fillRect(sx - 2, sy - 2, 4, 4)
  return cv
}

export function drawHud(c: CanvasRenderingContext2D, W: number, H: number, race: Race, map: HTMLCanvasElement | null, hs: HudState, time: number) {
  const f = hs.font
  const P = race.cars[0]
  const pl = race.pl
  c.textBaseline = 'alphabetic'

  // ----- posición, vuelta y tiempo -----
  panel(c, 6, 6, 104, 58)
  txt(c, 'POS', 13, 18, 7, '#fdba74', f)
  const pos = String(P.pos)
  txt(c, pos, 13, 45, 26, P.pos === 1 ? '#facc15' : '#ffffff', f)
  txt(c, '/8', 14 + pos.length * 26, 45, 10, '#ffffff', f)
  txt(c, `VUELTA ${Math.min(race.lap, race.laps)}/${race.laps}`, 13, 58, 7, '#ffffff', f)
  panel(c, 114, 6, 92, 26)
  txt(c, 'TIEMPO', 120, 16, 6, '#fdba74', f)
  txt(c, fmtTime(race.phase === 'countdown' ? 0 : race.t), 120, 28, 8, '#ffffff', f)

  // ----- minimapa -----
  if (map) {
    const ms = 70
    const mx = W - ms - 6
    const my = 6
    panel(c, mx, my, ms, ms)
    c.drawImage(map, mx, my, ms, ms)
    const t = race.track
    const s = ms - 12
    for (let i = race.cars.length - 1; i >= 0; i--) {
      const car = race.cars[i]
      const n = Math.floor(car.z / SEG_LEN) % t.N
      const x = mx + ms / 2 + t.mapX[n] * s
      const y = my + ms / 2 + t.mapY[n] * s
      if (car.player) {
        c.fillStyle = '#000'
        c.fillRect(x - 3, y - 3, 6, 6)
        c.fillStyle = Math.floor(time * 6) % 2 ? '#f97316' : '#fde68a'
        c.fillRect(x - 2, y - 2, 4, 4)
      } else {
        c.fillStyle = car.colors.body
        c.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
    }
  }

  // ----- velocímetro y nitro -----
  const kmh = Math.round(P.speed * KMH)
  const nitroK = clamp(pl.nitro / race.stats.nitroCap, 0, 1)
  if (hs.touch) {
    const cx = W / 2
    if (race.phase !== 'countdown') {
      panel(c, cx - 64, 6, 128, 34)
      txt(c, String(kmh), cx + 6, 24, 14, pl.nitroOn ? '#93c5fd' : '#ffffff', f, 'right')
      txt(c, 'KM/H', cx + 10, 24, 6, '#fdba74', f, 'left')
      nitroBar(c, cx - 56, 29, 112, 6, nitroK, pl.nitroOn, time)
      powerIcons(c, cx + 70, 10, race, f, time)
    }
  } else {
    const cx = W - 58
    const cy = H - 22
    const R = 42
    panel(c, cx - R - 12, cy - R - 10, R * 2 + 24, R + 28, 10)
    // arco
    c.lineWidth = 5
    c.strokeStyle = 'rgba(255,255,255,0.15)'
    c.beginPath()
    c.arc(cx, cy, R - 4, Math.PI * 1.05, Math.PI * 1.95)
    c.stroke()
    const k = clamp(P.speed / (race.stats.top * 1.35), 0, 1)
    const g = c.createLinearGradient(cx - R, 0, cx + R, 0)
    g.addColorStop(0, '#fde68a')
    g.addColorStop(0.6, '#f97316')
    g.addColorStop(1, '#ef4444')
    c.strokeStyle = g
    c.beginPath()
    c.arc(cx, cy, R - 4, Math.PI * 1.05, Math.PI * (1.05 + 0.9 * k))
    c.stroke()
    // marcas
    c.strokeStyle = 'rgba(255,255,255,0.6)'
    c.lineWidth = 1
    c.beginPath()
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (1.05 + 0.09 * i)
      c.moveTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1))
      c.lineTo(cx + Math.cos(a) * (R + (i % 5 === 0 ? 6 : 3)), cy + Math.sin(a) * (R + (i % 5 === 0 ? 6 : 3)))
    }
    c.stroke()
    // aguja
    const a = Math.PI * (1.05 + 0.9 * k) + (Math.random() - 0.5) * 0.02 * k
    c.strokeStyle = '#ffffff'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(cx, cy)
    c.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10))
    c.stroke()
    c.fillStyle = '#f97316'
    c.fillRect(cx - 2, cy - 2, 4, 4)
    txt(c, String(kmh), cx, cy - 10, 12, pl.nitroOn ? '#93c5fd' : '#ffffff', f, 'center')
    txt(c, 'KM/H', cx, cy + 1, 5, '#fdba74', f, 'center')
    nitroBar(c, cx - R - 4, cy + 6, R * 2 + 8, 6, nitroK, pl.nitroOn, time)
    powerIcons(c, cx - R - 10, cy - R - 2, race, f, time)
  }

  // rebufo
  if (pl.slip > 0.5 && race.phase === 'racing') {
    const a = 0.6 + Math.sin(time * 14) * 0.4
    c.globalAlpha = a
    if (hs.touch) txt(c, 'REBUFO', W / 2, 52, 7, '#7dd3fc', f, 'center')
    else txt(c, 'REBUFO', W - 58, H - 78, 7, '#7dd3fc', f, 'center')
    c.globalAlpha = 1
  }

  // ----- radio -----
  if (hs.radio && hs.radio.t > 0) {
    const r = hs.radio
    const a = clamp(r.t, 0, 1)
    c.globalAlpha = a
    const label = `${r.freq} ${r.name}`
    const x = hs.touch ? W / 2 : 10
    const y = hs.touch ? 60 : H - 12
    const w = label.length * 7 + 26
    panel(c, hs.touch ? x - w / 2 : x - 4, y - 11, w, 16, 5, 0.55)
    const nx = hs.touch ? x - w / 2 + 8 : x + 2
    noteIcon(c, nx, y - 8, r.color)
    txt(c, label, nx + 12, y + 1, 7, '#ffffff', f, 'left')
    c.globalAlpha = 1
  }

  // ----- semáforo -----
  if (race.phase === 'countdown' || (race.phase === 'racing' && race.t < 1.2)) {
    const cx = W / 2
    const y = 22
    const alpha = race.phase === 'racing' ? clamp((1.2 - race.t) / 0.4, 0, 1) : 1
    c.globalAlpha = alpha
    panel(c, cx - 56, y - 14, 112, 30, 8, 0.7)
    const lit = race.phase === 'racing' ? 4 : race.count > 3 ? 0 : race.count > 2 ? 1 : race.count > 1 ? 2 : 3
    for (let i = 0; i < 4; i++) {
      const lx = cx - 39 + i * 26
      const on = lit === 4 ? true : i < lit
      const col = lit === 4 ? '#22c55e' : i < 3 ? '#ef4444' : '#22c55e'
      c.fillStyle = '#16161c'
      c.beginPath()
      c.arc(lx, y + 1, 9, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = on && (lit === 4 || i < 3) ? col : 'rgba(255,255,255,0.08)'
      c.beginPath()
      c.arc(lx, y + 1, 7, 0, Math.PI * 2)
      c.fill()
      if (on && (lit === 4 || i < 3)) {
        c.globalAlpha = alpha * 0.35
        c.beginPath()
        c.arc(lx, y + 1, 12, 0, Math.PI * 2)
        c.fill()
        c.globalAlpha = alpha
      }
    }
    c.globalAlpha = 1
    // número grande
    let big = ''
    let k = 0
    let col = '#ffffff'
    if (race.phase === 'countdown' && race.count <= 3) {
      big = String(Math.ceil(race.count))
      k = race.count - Math.floor(race.count)
      col = '#ffffff'
    } else if (race.phase === 'racing' && race.t < 0.9) {
      big = 'GO!'
      k = 1 - race.t / 0.9
      col = '#4ade80'
    }
    if (big) {
      const sc = 1 + Math.max(0, k - 0.7) * 2.2
      c.globalAlpha = big === 'GO!' ? clamp(k * 2, 0, 1) : clamp(k * 3, 0, 1)
      txt(c, big, W / 2, H * 0.42, Math.round(40 * sc), col, f, 'center')
      c.globalAlpha = 1
    }
  }

  // ----- cartel central -----
  const b = hs.banner
  if (b && b.t < b.dur) {
    const k = b.t
    const sc = k < 0.18 ? 1 + (0.18 - k) * 3 : 1
    const a = clamp((b.dur - k) / 0.35, 0, 1)
    c.globalAlpha = a
    const y = H * 0.32
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.fillRect(0, y - 26, W, b.sub ? 44 : 34)
    c.fillStyle = b.color
    c.fillRect(0, y - 26, W, 1)
    c.fillRect(0, y + (b.sub ? 17 : 7), W, 1)
    txt(c, b.text, W / 2, y, Math.round(22 * sc), b.color, f, 'center')
    if (b.sub) txt(c, b.sub, W / 2, y + 13, 8, '#ffffff', f, 'center')
    c.globalAlpha = 1
  }
  c.textAlign = 'left'
}

function nitroBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, on: boolean, time: number) {
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(x - 1, y - 1, w + 2, h + 2)
  const segs = 12
  const sw = w / segs
  for (let i = 0; i < segs; i++) {
    const filled = (i + 1) / segs <= k + 0.001
    const partial = !filled && i / segs < k
    c.fillStyle = filled ? (on ? (Math.floor(time * 20) % 2 ? '#bfdbfe' : '#3b82f6') : k >= 0.999 ? '#60a5fa' : '#2563eb') : partial ? '#1e3a8a' : 'rgba(255,255,255,0.08)'
    c.fillRect(x + i * sw + 0.5, y, sw - 1, h)
  }
}

function powerIcons(c: CanvasRenderingContext2D, x: number, y: number, race: Race, f: string, time: number) {
  const pl = race.pl
  let yy = y
  const icon = (col: string, label: string, t: number) => {
    if (t < 2 && Math.floor(time * 8) % 2) return
    c.fillStyle = col
    c.fillRect(x, yy, 8, 8)
    c.fillStyle = '#ffffff'
    c.fillRect(x + 2, yy + 2, 4, 4)
    txt(c, `${label}${Math.ceil(t)}`, x + 11, yy + 8, 6, col, f, 'left')
    yy += 11
  }
  if (pl.shieldT > 0) icon('#22d3ee', 'E', pl.shieldT)
  if (pl.magnetT > 0) icon('#f87171', 'I', pl.magnetT)
}

function noteIcon(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  c.fillStyle = col
  c.fillRect(x + 1, y + 6, 4, 3)
  c.fillRect(x + 4, y, 1, 8)
  c.fillRect(x + 4, y, 4, 1)
  c.fillRect(x + 7, y, 1, 3)
}

export function drawPause(c: CanvasRenderingContext2D, W: number, H: number, font: string) {
  c.fillStyle = 'rgba(6,4,14,0.55)'
  c.fillRect(0, 0, W, H)
  txt(c, 'PAUSA', W / 2, H * 0.4, 22, '#f97316', font, 'center')
  c.textAlign = 'left'
}

// ===================== Podio =====================

export interface PodiumState {
  t: number
  confetti: { x: number; y: number; vx: number; vy: number; r: number; vr: number; col: string; s: number }[]
  sparks: { x: number; y: number; vx: number; vy: number; life: number; col: string }[]
  nextFw: number
}
export const newPodium = (): PodiumState => ({ t: 0, confetti: [], sparks: [], nextFw: 0.6 })

const CONF = ['#f97316', '#facc15', '#22d3ee', '#ec4899', '#a3e635', '#ffffff']

export function drawPodium(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  r: Renderer,
  ps: PodiumState,
  top3: { frames: CarFrames; name: string; player: boolean }[],
  dt: number,
  font: string,
  cupColor: string,
) {
  ps.t += dt
  const t = ps.t
  r.drawBackdrop(t)
  const ground = H * 0.78
  // plataformas
  const bw = Math.min(96, W * 0.16)
  const order = [1, 0, 2]
  const heights = [74, 54, 38]
  const cols = ['#facc15', '#d1d5db', '#d97706']
  order.forEach((rank, slot) => {
    const x = W / 2 + (slot - 1) * (bw + 4) - bw / 2
    const rise = easeOut(0, 1, clamp((t - 0.1 - slot * 0.12) / 0.7, 0, 1))
    const h = heights[rank] * rise
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.fillRect(x + 4, ground - h + 4, bw, h)
    c.fillStyle = '#1f1b2e'
    c.fillRect(x, ground - h, bw, h)
    c.fillStyle = cols[rank]
    c.fillRect(x, ground - h, bw, 5)
    if (h > 20) txt(c, String(rank + 1), x + bw / 2, ground - h + 26, 16, cols[rank], font, 'center')
    // coche
    const e = top3[rank]
    if (!e) return
    const dropT = clamp((t - 0.9 - (2 - rank) * 0.35) / 0.55, 0, 1)
    if (dropT <= 0) return
    const bounce = dropT < 1 ? (1 - easeOut(0, 1, dropT)) * -120 : Math.abs(Math.sin((t - 2) * 3)) * (rank === 0 ? 3 : 0)
    const cw = bw * 1.05
    const ch = (cw * CAR_H) / CAR_W
    const cx = x + bw / 2
    const cy = ground - h + bounce
    c.fillStyle = 'rgba(0,0,0,0.4)'
    c.beginPath()
    c.ellipse(cx, ground - h, cw * 0.45, 3, 0, 0, Math.PI * 2)
    c.fill()
    c.drawImage(e.frames.frames[0][0], 0, 0, CAR_W, CAR_H, cx - cw / 2, cy - ch, cw, ch)
    if (dropT >= 1) {
      txt(c, e.name, cx, ground + 14, 8, e.player ? '#f97316' : '#ffffff', font, 'center')
      if (e.player) txt(c, 'TU', cx, cy - ch - 6, 8, '#f97316', font, 'center')
    }
  })
  // trofeo sobre el campeón
  if (t > 2.2) {
    const k = clamp((t - 2.2) / 0.4, 0, 1)
    const cx = W / 2
    const carH = (bw * 1.05 * CAR_H) / CAR_W
    const cy = ground - heights[0] - carH - 34 - Math.sin(t * 2) * 3
    c.globalAlpha = k
    trophy(c, cx, cy, cupColor)
    c.globalAlpha = 1
  }
  // fuegos artificiales
  if (t > 1.5) {
    ps.nextFw -= dt
    if (ps.nextFw <= 0) {
      ps.nextFw = 0.45 + Math.random() * 0.5
      const fx = W * (0.15 + Math.random() * 0.7)
      const fy = H * (0.12 + Math.random() * 0.25)
      const col = CONF[Math.floor(Math.random() * CONF.length)]
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2
        const s = 60 + Math.random() * 50
        ps.sparks.push({ x: fx, y: fy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.1, col })
      }
    }
  }
  c.globalCompositeOperation = 'lighter'
  for (const p of ps.sparks) {
    p.life -= dt
    p.vy += 60 * dt
    p.vx *= 1 - dt * 1.2
    p.x += p.vx * dt
    p.y += p.vy * dt
    c.globalAlpha = clamp(p.life, 0, 1)
    c.fillStyle = p.col
    c.fillRect(p.x, p.y, 2, 2)
  }
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
  ps.sparks = ps.sparks.filter((p) => p.life > 0)
  // confeti
  if (t > 1 && ps.confetti.length < 140) {
    for (let i = 0; i < 3; i++)
      ps.confetti.push({
        x: Math.random() * W,
        y: -8,
        vx: (Math.random() - 0.5) * 30,
        vy: 30 + Math.random() * 40,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
        col: CONF[Math.floor(Math.random() * CONF.length)],
        s: 2 + Math.random() * 2,
      })
  }
  for (const p of ps.confetti) {
    p.x += (p.vx + Math.sin(p.y * 0.05) * 20) * dt
    p.y += p.vy * dt
    p.r += p.vr * dt
    c.fillStyle = p.col
    const w = p.s * Math.abs(Math.cos(p.r))
    c.fillRect(p.x - w / 2, p.y, Math.max(0.6, w), p.s * 1.4)
  }
  ps.confetti = ps.confetti.filter((p) => p.y < H + 10)
}

export function trophy(c: CanvasRenderingContext2D, cx: number, cy: number, col: string) {
  c.fillStyle = 'rgba(250,204,21,0.25)'
  c.beginPath()
  c.arc(cx, cy, 30, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#b45309'
  c.fillRect(cx - 14, cy + 18, 28, 6)
  c.fillStyle = '#facc15'
  c.fillRect(cx - 10, cy + 14, 20, 5)
  c.fillRect(cx - 3, cy + 4, 6, 10)
  c.fillRect(cx - 14, cy - 18, 28, 6)
  c.fillRect(cx - 12, cy - 12, 24, 8)
  c.fillRect(cx - 9, cy - 4, 18, 6)
  c.fillRect(cx - 20, cy - 16, 6, 3)
  c.fillRect(cx - 20, cy - 16, 3, 10)
  c.fillRect(cx + 14, cy - 16, 6, 3)
  c.fillRect(cx + 17, cy - 16, 3, 10)
  c.fillStyle = '#fef08a'
  c.fillRect(cx - 10, cy - 16, 4, 12)
  c.fillStyle = col
  c.fillRect(cx - 4, cy - 12, 8, 5)
}
