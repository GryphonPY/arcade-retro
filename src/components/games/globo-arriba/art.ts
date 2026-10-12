/**
 * Arte de Globo Arriba: un gatito en su canasta sube colgado de globos. El cielo
 * cambia con la altura (día → atardecer → noche → espacio). Obstáculos: pájaros,
 * nubes de tormenta, avionetas y meteoritos. Premios: estrellas y globos extra.
 */

const OUTLINE = '#22172a'
const TAU = Math.PI * 2

/** Colores de los globos del jugador, en el orden en que se pierden (el último es el rojo). */
export const BALLOON_COLORS = ['#ff4d6d', '#ffd23f', '#4dc3ff']

/** Hitbox del jugador relativa a (x, y) = centro de la canasta. */
export const PLAYER_HIT = { balloons: { dx: 0, dy: -66, r: 22 }, basket: { dx: 0, dy: 0, r: 14 } }

/** Radios de colisión de los objetos (mitad de ancho/alto para la tormenta y la avioneta). */
export const HIT = {
  bird: 13,
  meteor: 1, // multiplica el radio propio del meteorito
  star: 14,
  balloon: 15,
  plane: { hw: 30, hh: 10 },
  /** La tormenta hace daño en una elipse de w/2 × 22. */
  stormHH: 22,
}

/** Altura (m) donde empieza cada zona del cielo. */
export const ZONES = { sunset: 250, night: 550, space: 900 }

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}
function fillStroke(ctx: CanvasRenderingContext2D, fill: string, lw = 2.5) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = lw
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
}
type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const smooth = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}

// Paradas de color del cielo: [altura, arriba, abajo]
const SKY: [number, RGB, RGB][] = [
  [0, [92, 196, 255], [200, 240, 255]],
  [ZONES.sunset, [120, 92, 200], [255, 170, 110]],
  [ZONES.night, [16, 22, 70], [60, 54, 130]],
  [ZONES.space, [4, 4, 18], [14, 10, 40]],
]

function skyAt(alt: number): { top: RGB; bot: RGB } {
  for (let i = SKY.length - 1; i >= 0; i--) {
    if (alt >= SKY[i][0]) {
      const a = SKY[i]
      const b = SKY[i + 1]
      if (!b) return { top: a[1], bot: a[2] }
      // transición en los últimos 120 m antes de la siguiente zona
      const k = smooth((alt - (b[0] - 120)) / 120)
      return { top: mix(a[1], b[1], k), bot: mix(a[2], b[2], k) }
    }
  }
  return { top: SKY[0][1], bot: SKY[0][2] }
}

/** Cuánto de "noche" hay a esta altura (0..1): estrellas y tonos fríos. */
export function nightness(alt: number) {
  return smooth((alt - (ZONES.night - 160)) / 200)
}

/**
 * Fondo: degradado según la altura, estrellas con parallax (noche/espacio),
 * planetas al llegar al espacio. `scroll` = metros recorridos en px para el parallax.
 */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, alt: number, scroll: number, t: number) {
  const { top, bot } = skyAt(alt)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, css(top))
  g.addColorStop(1, css(bot))
  ctx.fillStyle = g
  ctx.fillRect(-20, -20, w + 40, h + 40)

  const n = nightness(alt)
  if (n > 0) {
    for (let i = 0; i < 70; i++) {
      const layer = 0.05 + hash(i * 7) * 0.15
      const x = hash(i * 3 + 1) * w
      const y = (((hash(i * 3 + 2) * h + scroll * layer) % h) + h) % h
      ctx.globalAlpha = n * (0.4 + 0.6 * Math.abs(Math.sin(t * (1 + hash(i)) + i)))
      ctx.fillStyle = '#ffffff'
      const sz = hash(i + 99) > 0.85 ? 2.5 : 1.5
      ctx.fillRect(x, y, sz, sz)
    }
    ctx.globalAlpha = 1
  }

  // atardecer: un solazo bajando
  const sunK = smooth((alt - 80) / 200) * (1 - smooth((alt - ZONES.night + 60) / 140))
  if (sunK > 0) {
    const sy = h * 0.25 + sunK * h * 0.35
    ctx.globalAlpha = sunK
    const sg = ctx.createRadialGradient(w * 0.75, sy, 10, w * 0.75, sy, 90)
    sg.addColorStop(0, 'rgba(255,220,140,0.9)')
    sg.addColorStop(1, 'rgba(255,160,90,0)')
    ctx.fillStyle = sg
    ctx.fillRect(w * 0.75 - 90, sy - 90, 180, 180)
    ell(ctx, w * 0.75, sy, 30, 30)
    ctx.fillStyle = '#ffd36b'
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // espacio: planeta con anillo y una luna
  const sp = smooth((alt - ZONES.space + 80) / 160)
  if (sp > 0) {
    const py = h * 0.22 + ((scroll * 0.03) % (h * 1.6))
    ctx.globalAlpha = sp
    ell(ctx, w * 0.24, py, 34, 34)
    fillStroke(ctx, '#b48cff', 3)
    ctx.fillStyle = '#9466e6'
    ell(ctx, w * 0.24 + 8, py + 6, 20, 14, 0.3)
    ctx.fill()
    ctx.strokeStyle = '#ffd36b'
    ctx.lineWidth = 4
    ell(ctx, w * 0.24, py, 56, 12, -0.3)
    ctx.stroke()
    ell(ctx, w * 0.82, py + 140, 12, 12)
    fillStroke(ctx, '#e8eeff', 2.5)
    ctx.globalAlpha = 1
  }
}

/** Nube decorativa (sin daño). `alpha` baja de noche. */
export function drawDecoCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#ffffff'
  ell(ctx, x, y, 34 * s, 14 * s)
  ctx.fill()
  ell(ctx, x - 18 * s, y + 2 * s, 18 * s, 11 * s)
  ctx.fill()
  ell(ctx, x + 14 * s, y - 7 * s, 20 * s, 14 * s)
  ctx.fill()
  ell(ctx, x - 4 * s, y - 10 * s, 14 * s, 11 * s)
  ctx.fill()
  ctx.restore()
}

/** Suelo de salida: parque con casitas. `gy` = y del pasto (sale de la pantalla al subir). */
export function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, gy: number) {
  if (gy > h + 10) return
  // casitas al fondo
  for (let i = 0; i < 6; i++) {
    const bw = 44 + hash(i) * 20
    const bx = (i / 6) * w + hash(i + 5) * 14 - 8
    const bh = 34 + hash(i + 2) * 30
    const col = ['#ffb4a2', '#a0e7ff', '#ffe08a', '#c7b5ff', '#b7f0a8', '#ffc4e1'][i]
    ctx.beginPath()
    ctx.rect(bx, gy - bh, bw, bh)
    fillStroke(ctx, col, 2)
    ctx.beginPath()
    ctx.moveTo(bx - 4, gy - bh)
    ctx.lineTo(bx + bw / 2, gy - bh - 20)
    ctx.lineTo(bx + bw + 4, gy - bh)
    ctx.closePath()
    fillStroke(ctx, '#e0574a', 2)
    ctx.fillStyle = '#fff7d6'
    ctx.fillRect(bx + 8, gy - bh + 10, 9, 9)
    ctx.fillRect(bx + bw - 17, gy - bh + 10, 9, 9)
  }
  ctx.fillStyle = '#6ad05c'
  ctx.fillRect(-20, gy, w + 40, h - gy + 40)
  ctx.fillStyle = '#4aa843'
  ctx.fillRect(-20, gy, w + 40, 4)
  ctx.fillStyle = '#5cc451'
  for (let x = 0; x < w; x += 22) ctx.fillRect(x, gy + 14 + (x % 44 ? 8 : 0), 10, 4)
}

// ---------- jugador ----------

/**
 * Gatito en canasta con `balloons` globos (0..3). (x, y) = centro de la canasta.
 * `tilt` inclina la canasta al moverse (-1..1). `hurt` > 0 hace parpadear al gatito.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, balloons: number, tilt: number, t: number, hurt = 0) {
  if (hurt > 0 && Math.sin(hurt * 40) > 0) ctx.globalAlpha = 0.45
  const sway = Math.sin(t * 2.2) * 0.06 + tilt * 0.18
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(sway)

  // globos (detrás del todo) con hilos hasta la canasta
  const spots = [
    { dx: -16, dy: -70, r: 16 },
    { dx: 16, dy: -72, r: 16 },
    { dx: 0, dy: -88, r: 17 },
  ]
  const shown = Math.max(0, Math.min(3, balloons))
  for (let i = 0; i < shown; i++) {
    const b = spots[i]
    const bx = b.dx + Math.sin(t * 2 + i * 1.7) * 2
    const by = b.dy + Math.cos(t * 2.4 + i) * 2
    ctx.strokeStyle = 'rgba(40,30,50,0.8)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(i === 0 ? -8 : i === 1 ? 8 : 0, -14)
    ctx.quadraticCurveTo(bx * 0.6 + Math.sin(t * 3 + i) * 3, (by + b.r) * 0.5, bx, by + b.r + 4)
    ctx.stroke()
    ell(ctx, bx, by, b.r * 0.9, b.r)
    fillStroke(ctx, BALLOON_COLORS[i], 2.5)
    // nudito
    ctx.beginPath()
    ctx.moveTo(bx - 3, by + b.r + 4)
    ctx.lineTo(bx + 3, by + b.r + 4)
    ctx.lineTo(bx, by + b.r - 1)
    ctx.closePath()
    fillStroke(ctx, BALLOON_COLORS[i], 1.5)
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ell(ctx, bx - b.r * 0.35, by - b.r * 0.4, b.r * 0.22, b.r * 0.32, 0.5)
    ctx.fill()
  }

  // gatito asomado en la canasta
  const fur = '#ff9f43'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * 13, -16)
    ctx.lineTo(sx * 12, -31)
    ctx.lineTo(sx * 3, -22)
    ctx.closePath()
    fillStroke(ctx, fur, 2)
  }
  ell(ctx, 0, -12, 14, 12)
  fillStroke(ctx, fur, 2.5)
  ctx.fillStyle = OUTLINE
  if (hurt > 0) {
    ctx.lineWidth = 2
    ctx.strokeStyle = OUTLINE
    for (const ex of [-5, 5]) {
      ctx.beginPath()
      ctx.moveTo(ex - 2.5, -16)
      ctx.lineTo(ex + 2.5, -11)
      ctx.moveTo(ex + 2.5, -16)
      ctx.lineTo(ex - 2.5, -11)
      ctx.stroke()
    }
  } else {
    ell(ctx, -5, -13, 2.4, 3)
    ctx.fill()
    ell(ctx, 5, -13, 2.4, 3)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-6, -15, 1.4, 1.4)
    ctx.fillRect(4, -15, 1.4, 1.4)
  }
  ctx.fillStyle = 'rgba(255,110,140,0.6)'
  ell(ctx, -9, -8, 3, 2)
  ctx.fill()
  ell(ctx, 9, -8, 3, 2)
  ctx.fill()
  ctx.fillStyle = '#ff7aa2'
  ctx.beginPath()
  ctx.moveTo(-2, -9)
  ctx.lineTo(2, -9)
  ctx.lineTo(0, -7)
  ctx.closePath()
  ctx.fill()
  // patitas en el borde
  ell(ctx, -9, -3, 4, 3)
  fillStroke(ctx, '#fff3e0', 1.5)
  ell(ctx, 9, -3, 4, 3)
  fillStroke(ctx, '#fff3e0', 1.5)

  // canasta de mimbre
  ctx.beginPath()
  ctx.moveTo(-17, -2)
  ctx.lineTo(17, -2)
  ctx.lineTo(13, 15)
  ctx.lineTo(-13, 15)
  ctx.closePath()
  fillStroke(ctx, '#d99a55', 2.5)
  ctx.strokeStyle = '#a8692e'
  ctx.lineWidth = 1.5
  for (let k = 0; k < 3; k++) {
    ctx.beginPath()
    ctx.moveTo(-16 + k, 3 + k * 4)
    ctx.lineTo(16 - k, 3 + k * 4)
    ctx.stroke()
  }
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath()
    ctx.moveTo(k * 6, -2)
    ctx.lineTo(k * 5, 15)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.roundRect(-19, -5, 38, 5, 2.5)
  fillStroke(ctx, '#b97c45', 2)
  ctx.restore()
  ctx.globalAlpha = 1
}

// ---------- obstáculos ----------

/** Pájaro gordito que aletea. `dir` 1 = mira a la derecha. */
export function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(dir, 1)
  const flap = Math.sin(t * 16)
  // ala de atrás
  ctx.beginPath()
  ctx.moveTo(-2, -2)
  ctx.quadraticCurveTo(-8, -14 - flap * 8, -16, -8 - flap * 10)
  ctx.quadraticCurveTo(-10, -2, -2, 2)
  fillStroke(ctx, '#5b6bd6', 2)
  ell(ctx, 0, 0, 14, 11)
  fillStroke(ctx, '#7b8cff', 2.5)
  ctx.fillStyle = '#e8ecff'
  ell(ctx, 2, 4, 8, 5)
  ctx.fill()
  // cola
  ctx.beginPath()
  ctx.moveTo(-13, -2)
  ctx.lineTo(-21, -6)
  ctx.lineTo(-20, 3)
  ctx.closePath()
  fillStroke(ctx, '#5b6bd6', 2)
  // pico y ojo enojado
  ctx.beginPath()
  ctx.moveTo(12, -2)
  ctx.lineTo(21, 1)
  ctx.lineTo(12, 4)
  ctx.closePath()
  fillStroke(ctx, '#ffb02e', 2)
  ell(ctx, 6, -4, 3, 3.4)
  fillStroke(ctx, '#ffffff', 1.5)
  ctx.fillStyle = OUTLINE
  ell(ctx, 7, -3.6, 1.6, 1.8)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(2, -9)
  ctx.lineTo(9, -7)
  ctx.stroke()
  // ala de adelante
  ctx.beginPath()
  ctx.moveTo(-4, 0)
  ctx.quadraticCurveTo(-6, -12 - flap * 10, -1, -10 - flap * 12)
  ctx.quadraticCurveTo(4, -4, 2, 2)
  fillStroke(ctx, '#9aa8ff', 2)
  ctx.restore()
}

/**
 * Nube de tormenta de ancho `w` con lluvia y rayos que destellan. `seed` fija
 * cuándo cae el rayo para que cada nube tenga su ritmo.
 */
export function drawStorm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, seed: number) {
  const hw = w / 2
  // lluvia
  ctx.strokeStyle = 'rgba(150,190,255,0.7)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 9; i++) {
    const rx = x - hw * 0.8 + (i / 8) * hw * 1.6
    const ry = y + 10 + (((t * 160 + i * 23) % 40))
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.lineTo(rx - 3, ry + 8)
    ctx.stroke()
  }
  // rayo
  const ph = (t * 0.9 + hash(seed) * 3) % 1.6
  const zap = ph < 0.16
  if (zap) {
    ctx.fillStyle = 'rgba(255,255,200,0.18)'
    ell(ctx, x, y, hw * 1.5, 50)
    ctx.fill()
    const lx = x + (hash(seed + Math.floor(t * 0.9)) - 0.5) * hw
    ctx.beginPath()
    ctx.moveTo(lx, y + 8)
    ctx.lineTo(lx - 8, y + 26)
    ctx.lineTo(lx + 2, y + 26)
    ctx.lineTo(lx - 6, y + 48)
    ctx.lineTo(lx + 10, y + 22)
    ctx.lineTo(lx, y + 22)
    ctx.lineTo(lx + 6, y + 8)
    ctx.closePath()
    fillStroke(ctx, '#fff27a', 2)
  }
  // cuerpo de la nube
  const body = (fill: string, dy: number) => {
    ctx.beginPath()
    ctx.ellipse(x, y + dy, hw, 18, 0, 0, TAU)
    ctx.moveTo(x - hw * 0.45 + 22, y - 10 + dy)
    ctx.ellipse(x - hw * 0.45, y - 10 + dy, 22, 18, 0, 0, TAU)
    ctx.moveTo(x + hw * 0.1 + 26, y - 16 + dy)
    ctx.ellipse(x + hw * 0.1, y - 16 + dy, 26, 22, 0, 0, TAU)
    ctx.moveTo(x + hw * 0.55 + 18, y - 6 + dy)
    ctx.ellipse(x + hw * 0.55, y - 6 + dy, 18, 15, 0, 0, TAU)
    ctx.fillStyle = fill
    ctx.fill()
  }
  ctx.save()
  ctx.lineWidth = 6
  ctx.strokeStyle = OUTLINE
  body(OUTLINE, 0)
  ctx.restore()
  // contorno: se dibuja la silueta un poco más grande en oscuro y encima el gris
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(0.95, 0.9)
  ctx.translate(-x, -y)
  body(zap ? '#8e8aa8' : '#6e6a88', 0)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ell(ctx, x - hw * 0.3, y - 14, 14, 6)
  ctx.fill()
  // carita enojada
  ctx.fillStyle = OUTLINE
  ell(ctx, x - 9, y - 2, 2.5, 3)
  ctx.fill()
  ell(ctx, x + 9, y - 2, 2.5, 3)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = OUTLINE
  ctx.beginPath()
  ctx.moveTo(x - 14, y - 9)
  ctx.lineTo(x - 5, y - 6)
  ctx.moveTo(x + 14, y - 9)
  ctx.lineTo(x + 5, y - 6)
  ctx.moveTo(x - 6, y + 8)
  ctx.quadraticCurveTo(x, y + 4, x + 6, y + 8)
  ctx.stroke()
}

/** Avioneta de hélice con banderín. `dir` 1 = vuela a la derecha. */
export function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(dir, 1)
  // banderín ondeando detrás
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-30, 0)
  ctx.lineTo(-44, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-44, -7)
  for (let i = 0; i <= 6; i++) ctx.lineTo(-44 - i * 6, -7 + Math.sin(t * 10 + i) * 2)
  for (let i = 6; i >= 0; i--) ctx.lineTo(-44 - i * 6, 7 + Math.sin(t * 10 + i) * 2)
  ctx.closePath()
  fillStroke(ctx, '#fff3a6', 1.5)
  // fuselaje
  ctx.beginPath()
  ctx.moveTo(-30, -3)
  ctx.quadraticCurveTo(-10, -12, 20, -8)
  ctx.quadraticCurveTo(30, -6, 30, 0)
  ctx.quadraticCurveTo(30, 7, 20, 8)
  ctx.lineTo(-24, 6)
  ctx.closePath()
  fillStroke(ctx, '#ff6b4a', 2.5)
  // cola
  ctx.beginPath()
  ctx.moveTo(-22, -4)
  ctx.lineTo(-30, -16)
  ctx.lineTo(-24, -16)
  ctx.lineTo(-12, -6)
  ctx.closePath()
  fillStroke(ctx, '#ff6b4a', 2)
  // ala
  ctx.beginPath()
  ctx.roundRect(-8, -1, 22, 7, 3)
  fillStroke(ctx, '#ffd23f', 2)
  // ventana con piloto
  ell(ctx, 10, -6, 6, 4.5)
  fillStroke(ctx, '#a0e7ff', 2)
  // hélice
  const p = Math.abs(Math.sin(t * 40))
  ctx.fillStyle = OUTLINE
  ctx.fillRect(30, -1.5, 4, 3)
  ctx.fillStyle = 'rgba(40,30,50,0.6)'
  ctx.fillRect(33, -12 * p, 2.5, 24 * p)
  ctx.restore()
}

/** Meteorito de radio `r` cayendo con cola de fuego hacia arriba. */
export function drawMeteor(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  // cola
  const g = ctx.createLinearGradient(x, y - r * 4, x, y)
  g.addColorStop(0, 'rgba(255,90,40,0)')
  g.addColorStop(1, 'rgba(255,190,80,0.9)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x - r * 0.9, y)
  ctx.quadraticCurveTo(x - r * 0.5, y - r * 2.5, x + Math.sin(t * 20) * 3, y - r * 4.2)
  ctx.quadraticCurveTo(x + r * 0.5, y - r * 2.5, x + r * 0.9, y)
  ctx.closePath()
  ctx.fill()
  // roca
  ctx.beginPath()
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + t * 0.8
    const rr = r * (0.85 + hash(i + Math.round(r)) * 0.25)
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  fillStroke(ctx, '#8a6a5a', 2.5)
  ctx.fillStyle = '#6a4e42'
  ell(ctx, x - r * 0.3, y + r * 0.1, r * 0.25, r * 0.2)
  ctx.fill()
  ell(ctx, x + r * 0.3, y - r * 0.3, r * 0.18, r * 0.15)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,200,120,0.5)'
  ell(ctx, x - r * 0.25, y - r * 0.45, r * 0.3, r * 0.15, -0.4)
  ctx.fill()
}

// ---------- premios ----------

/** Estrella amarilla que gira y brilla. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(255,230,120,0.3)'
  ell(ctx, 0, 0, 20, 20)
  ctx.fill()
  ctx.scale(Math.abs(Math.cos(t * 3)) * 0.4 + 0.6, 1)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 6 : 14
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  fillStroke(ctx, '#ffd23f', 2.5)
  ctx.fillStyle = '#fff3a6'
  ell(ctx, -3, -4, 3, 2)
  ctx.fill()
  ctx.restore()
}

/** Globo suelto para recuperar uno (con un "+" encima). */
export function drawBalloonPickup(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  const by = y + Math.sin(t * 3) * 3
  ctx.strokeStyle = 'rgba(40,30,50,0.8)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x, by + 18)
  ctx.quadraticCurveTo(x + Math.sin(t * 4) * 5, by + 28, x, by + 36)
  ctx.stroke()
  ell(ctx, x, by, 13, 15)
  fillStroke(ctx, color, 2.5)
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ell(ctx, x - 4, by - 6, 3, 4.5, 0.5)
  ctx.fill()
  // "+"
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.rect(x - 2, by - 6, 4, 12)
  ctx.rect(x - 6, by - 2, 12, 4)
  ctx.fill()
}

/** Pedacitos de goma cuando un globo revienta: dibújalos como partículas de `juice` con este color. */
export function popColors(i: number) {
  return [BALLOON_COLORS[i] ?? '#ffffff', '#ffffff']
}
