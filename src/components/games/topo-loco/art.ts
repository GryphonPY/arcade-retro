/**
 * Arte de Topo Loco: jardín soleado, hoyos de tierra, topos (normal, con casco
 * y dorado), el gatito que NO hay que golpear, el mazo y efectos de golpe.
 *
 * Cada hoyo se dibuja en tres capas para que el bicho salga "de adentro":
 *   drawHoleBack(...)  →  drawCritter(...)  →  drawHoleFront(...)
 * (x, y) es el centro de la boca del hoyo y `s` la escala (1 = hoyo de ~84 px).
 */

export type CritterKind = 'topo' | 'casco' | 'casco-roto' | 'dorado' | 'gatito'
/** 'up' = asomado, 'hit' = recibió el golpe, 'tease' = se burla antes de esconderse. */
export type CritterState = 'up' | 'hit' | 'tease'

const OUTLINE = '#2b1a12'
const TAU = Math.PI * 2

/** Ancho de la boca del hoyo a escala 1. */
export const HOLE_W = 84
/** Alto que asoma un bicho completamente fuera (escala 1): úsalo para la hitbox. */
export const CRITTER_H = 74

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

// ---------- fondo ----------

/** Jardín: cielo, sol, nubes, colinas, cerca y pasto a franjas con flores. `top` = y donde empieza el pasto. */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, top: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, top)
  sky.addColorStop(0, '#5ec8ff')
  sky.addColorStop(1, '#c9f0ff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, top + 2)

  // sol con rayos que giran despacio
  const sx = w - 58
  const sy = Math.min(56, top * 0.42)
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(t * 0.25)
  ctx.fillStyle = 'rgba(255,230,120,0.55)'
  for (let i = 0; i < 10; i++) {
    ctx.rotate(TAU / 10)
    ctx.beginPath()
    ctx.moveTo(-5, -30)
    ctx.lineTo(0, -44)
    ctx.lineTo(5, -30)
    ctx.fill()
  }
  ctx.restore()
  ell(ctx, sx, sy, 24, 24)
  fillStroke(ctx, '#ffd84a', 2.5)
  // carita del sol
  ctx.fillStyle = OUTLINE
  ell(ctx, sx - 8, sy - 3, 2.4, 3.2)
  ctx.fill()
  ell(ctx, sx + 8, sy - 3, 2.4, 3.2)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = OUTLINE
  ctx.beginPath()
  ctx.arc(sx, sy + 3, 7, 0.2, Math.PI - 0.2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,120,120,0.6)'
  ell(ctx, sx - 13, sy + 5, 4, 2.5)
  ctx.fill()
  ell(ctx, sx + 13, sy + 5, 4, 2.5)
  ctx.fill()

  // nubes que pasan
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 3; i++) {
    const cx = ((hash(i + 2) * w + t * (6 + i * 3)) % (w + 120)) - 60
    const cy = 22 + i * 26
    if (cy > top - 30) continue
    ell(ctx, cx, cy, 26, 11)
    ctx.fill()
    ell(ctx, cx - 14, cy + 2, 14, 9)
    ctx.fill()
    ell(ctx, cx + 12, cy - 5, 15, 11)
    ctx.fill()
  }

  // colinas lejanas
  ctx.fillStyle = '#8fd96a'
  ctx.beginPath()
  ctx.moveTo(0, top)
  for (let x = 0; x <= w; x += 10) ctx.lineTo(x, top - 26 - Math.sin(x * 0.018) * 12 - Math.sin(x * 0.041 + 1) * 6)
  ctx.lineTo(w, top)
  ctx.fill()

  // cerca de madera
  const fy = top - 22
  ctx.fillStyle = '#f3e0bd'
  ctx.strokeStyle = '#8a6440'
  ctx.lineWidth = 2
  ctx.fillRect(0, fy + 6, w, 5)
  ctx.strokeRect(-2, fy + 6, w + 4, 5)
  ctx.fillRect(0, fy + 15, w, 5)
  ctx.strokeRect(-2, fy + 15, w + 4, 5)
  for (let x = 6; x < w; x += 26) {
    ctx.beginPath()
    ctx.moveTo(x, fy + 24)
    ctx.lineTo(x, fy + 2)
    ctx.lineTo(x + 5, fy - 3)
    ctx.lineTo(x + 10, fy + 2)
    ctx.lineTo(x + 10, fy + 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // pasto a franjas
  const stripe = 34
  for (let y = top, k = 0; y < h; y += stripe, k++) {
    ctx.fillStyle = k % 2 ? '#5cc451' : '#6ad05c'
    ctx.fillRect(0, y, w, stripe)
  }
  ctx.fillStyle = '#4aa843'
  ctx.fillRect(0, top, w, 3)

  // matitas y flores
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3 + 1) * w
    const y = top + 10 + hash(i * 3 + 2) * (h - top - 16)
    if (hash(i * 5) > 0.55) {
      const col = ['#ff6b9a', '#ffffff', '#ffd84a', '#b48cff'][i % 4]
      ctx.fillStyle = col
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU
        ell(ctx, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 2.8, 2.8)
        ctx.fill()
      }
      ctx.fillStyle = '#ffb02e'
      ell(ctx, x, y, 2.2, 2.2)
      ctx.fill()
    } else {
      ctx.strokeStyle = '#3e9a3a'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x - 4, y + 4)
      ctx.lineTo(x - 2, y - 2)
      ctx.moveTo(x, y + 4)
      ctx.lineTo(x + 1, y - 4)
      ctx.moveTo(x + 4, y + 4)
      ctx.lineTo(x + 5, y - 1)
      ctx.stroke()
    }
  }
}

// ---------- hoyos ----------

/** Montículo de tierra y la boca oscura (detrás del bicho). */
export function drawHoleBack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const rx = (HOLE_W / 2) * s
  // sombra en el pasto
  ctx.fillStyle = 'rgba(30,80,20,0.25)'
  ell(ctx, x, y + 9 * s, rx * 1.28, 17 * s)
  ctx.fill()
  // montículo
  ell(ctx, x, y + 3 * s, rx * 1.18, 18 * s)
  fillStroke(ctx, '#a8693a', 2.5)
  ctx.fillStyle = '#c4834d'
  ell(ctx, x - rx * 0.3, y - 2 * s, rx * 0.55, 6 * s)
  ctx.fill()
  // boca
  ell(ctx, x, y, rx * 0.86, 11 * s)
  ctx.fillStyle = '#2a140a'
  ctx.fill()
  ell(ctx, x, y + 2 * s, rx * 0.7, 7 * s)
  ctx.fillStyle = '#170a04'
  ctx.fill()
}

/** Borde delantero de tierra que tapa la base del bicho (va encima de él). */
export function drawHoleFront(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const rx = (HOLE_W / 2) * s * 0.86
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - rx * 1.5, y, rx * 3, 30 * s)
  ctx.clip()
  ell(ctx, x, y + 1 * s, rx + 5 * s, 13 * s)
  ctx.fillStyle = '#a8693a'
  ctx.fill()
  ell(ctx, x, y, rx, 11 * s)
  ctx.fillStyle = '#2a140a'
  ctx.fill()
  ctx.restore()
  // labio de tierra con terrones
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x, y, rx + 3 * s, 12 * s, 0, 0.05, Math.PI - 0.05)
  ctx.lineWidth = 6 * s
  ctx.strokeStyle = '#c4834d'
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = OUTLINE
  ctx.beginPath()
  ctx.ellipse(x, y, rx + 6 * s, 15 * s, 0, 0.02, Math.PI - 0.02)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = '#8a5228'
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + i * 0.75
    ell(ctx, x + Math.cos(a) * (rx + 4 * s), y + Math.sin(a) * 14 * s, 3 * s, 2.2 * s)
    ctx.fill()
  }
}

// ---------- bichos ----------

interface CritterLook {
  fur: string
  furDark: string
  belly: string
}

const LOOKS: Record<Exclude<CritterKind, 'gatito'>, CritterLook> = {
  topo: { fur: '#8a5a3c', furDark: '#5e3a24', belly: '#e8c9a2' },
  casco: { fur: '#8a5a3c', furDark: '#5e3a24', belly: '#e8c9a2' },
  'casco-roto': { fur: '#8a5a3c', furDark: '#5e3a24', belly: '#e8c9a2' },
  dorado: { fur: '#f2b72a', furDark: '#c47f0a', belly: '#fff0b0' },
}

function eyes(ctx: CanvasRenderingContext2D, y: number, state: CritterState, t: number, sad = false) {
  if (state === 'hit') {
    // ojos en X
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2.6
    for (const ex of [-9, 9]) {
      ctx.beginPath()
      ctx.moveTo(ex - 4, y - 4)
      ctx.lineTo(ex + 4, y + 4)
      ctx.moveTo(ex + 4, y - 4)
      ctx.lineTo(ex - 4, y + 4)
      ctx.stroke()
    }
    if (sad) {
      ctx.fillStyle = '#7fd2ff'
      ell(ctx, -12, y + 9 + ((t * 30) % 8), 2.2, 3.2)
      ctx.fill()
      ell(ctx, 12, y + 9 + ((t * 30 + 4) % 8), 2.2, 3.2)
      ctx.fill()
    }
    return
  }
  const blink = Math.sin(t * 2.3) > 0.97
  for (const ex of [-9, 9]) {
    if (blink) {
      ctx.fillStyle = OUTLINE
      ctx.fillRect(ex - 4, y, 8, 2)
      continue
    }
    ell(ctx, ex, y, 4.6, 5.4)
    ctx.fillStyle = OUTLINE
    ctx.fill()
    ell(ctx, ex - 1.4, y - 1.8, 1.7, 1.9)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
}

function cheeks(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = 'rgba(255,110,140,0.55)'
  ell(ctx, -17, y, 5, 3)
  ctx.fill()
  ell(ctx, 17, y, 5, 3)
  ctx.fill()
}

/** Topo (normal, con casco o dorado) en el origen; la base del cuerpo queda en y = 0. */
function drawMole(ctx: CanvasRenderingContext2D, kind: Exclude<CritterKind, 'gatito'>, state: CritterState, t: number) {
  const L = LOOKS[kind]
  // cuerpo
  ctx.beginPath()
  ctx.moveTo(-27, 10)
  ctx.lineTo(-27, -40)
  ctx.bezierCurveTo(-27, -78, 27, -78, 27, -40)
  ctx.lineTo(27, 10)
  ctx.closePath()
  fillStroke(ctx, L.fur, 3)
  ctx.fillStyle = L.belly
  ell(ctx, 0, -12, 16, 20)
  ctx.fill()
  // orejitas
  ell(ctx, -22, -58, 5, 5)
  fillStroke(ctx, L.furDark, 2)
  ell(ctx, 22, -58, 5, 5)
  fillStroke(ctx, L.furDark, 2)
  eyes(ctx, -44, state, t)
  cheeks(ctx, -33)
  // hocico, nariz y dientes
  ell(ctx, 0, -32, 9, 6.5)
  fillStroke(ctx, L.belly, 2)
  ell(ctx, 0, -36, 5.5, 4)
  fillStroke(ctx, '#ff7aa2', 2)
  if (state === 'tease') {
    // saca la lengua
    ell(ctx, 3, -22, 5, 6)
    fillStroke(ctx, '#ff5a7a', 2)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-4, -27, 8, 6)
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.6
    ctx.strokeRect(-4, -27, 8, 6)
    ctx.beginPath()
    ctx.moveTo(0, -27)
    ctx.lineTo(0, -21)
    ctx.stroke()
  }
  // bigotes
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.2
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * 9, -33)
    ctx.lineTo(sx * 22, -37)
    ctx.moveTo(sx * 9, -31)
    ctx.lineTo(sx * 22, -29)
    ctx.stroke()
  }
  // patitas apoyadas en el borde
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 21, -4, 8, 6)
    fillStroke(ctx, '#ffb7c8', 2)
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(sx * 18, -8)
    ctx.lineTo(sx * 18, -3)
    ctx.moveTo(sx * 23, -8)
    ctx.lineTo(sx * 23, -3)
    ctx.stroke()
  }

  if (kind === 'casco' || kind === 'casco-roto') {
    // casco de obra
    ctx.beginPath()
    ctx.moveTo(-27, -52)
    ctx.bezierCurveTo(-27, -82, 27, -82, 27, -52)
    ctx.closePath()
    fillStroke(ctx, '#ffcf1f', 3)
    ctx.fillStyle = '#ffe680'
    ell(ctx, -10, -68, 7, 4, -0.4)
    ctx.fill()
    ctx.fillStyle = '#ffcf1f'
    ctx.fillRect(-33, -55, 66, 6)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = OUTLINE
    ctx.strokeRect(-33, -55, 66, 6)
    ctx.fillStyle = '#e8a700'
    ctx.fillRect(-3, -78, 6, 22)
    if (kind === 'casco-roto') {
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-8, -76)
      ctx.lineTo(-2, -68)
      ctx.lineTo(-9, -62)
      ctx.lineTo(-3, -56)
      ctx.moveTo(12, -74)
      ctx.lineTo(8, -66)
      ctx.lineTo(14, -60)
      ctx.stroke()
    }
  }

  if (kind === 'dorado') {
    // coronita y destellos
    ctx.beginPath()
    ctx.moveTo(-13, -64)
    ctx.lineTo(-15, -80)
    ctx.lineTo(-7, -72)
    ctx.lineTo(0, -84)
    ctx.lineTo(7, -72)
    ctx.lineTo(15, -80)
    ctx.lineTo(13, -64)
    ctx.closePath()
    fillStroke(ctx, '#ffe14a', 2.2)
    ctx.fillStyle = '#ff4d6d'
    ell(ctx, 0, -70, 2.5, 2.5)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.6 + i / 3) % 1
      const a = i * 2.1
      const px = Math.cos(a) * 36
      const py = -44 + Math.sin(a) * 30
      const sz = Math.sin(k * Math.PI) * 5
      ctx.fillRect(px - sz / 2, py - 0.8, sz, 1.6)
      ctx.fillRect(px - 0.8, py - sz / 2, 1.6, sz)
    }
  }
}

/** Gatito naranja que se asoma con un corazón: ¡no hay que golpearlo! */
function drawKitten(ctx: CanvasRenderingContext2D, state: CritterState, t: number) {
  const fur = '#ff9f43'
  // cuerpo/cabeza
  ctx.beginPath()
  ctx.moveTo(-27, 10)
  ctx.lineTo(-27, -36)
  ctx.bezierCurveTo(-27, -68, 27, -68, 27, -36)
  ctx.lineTo(27, 10)
  ctx.closePath()
  fillStroke(ctx, fur, 3)
  // orejas
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * 25, -48)
    ctx.lineTo(sx * 23, -74)
    ctx.lineTo(sx * 8, -60)
    ctx.closePath()
    fillStroke(ctx, fur, 2.5)
    ctx.beginPath()
    ctx.moveTo(sx * 21, -52)
    ctx.lineTo(sx * 21, -67)
    ctx.lineTo(sx * 12, -59)
    ctx.closePath()
    ctx.fillStyle = '#ffc2d1'
    ctx.fill()
  }
  // rayitas
  ctx.strokeStyle = '#d9731a'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const dx of [-7, 0, 7]) {
    ctx.beginPath()
    ctx.moveTo(dx, -61)
    ctx.lineTo(dx, -53)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  ctx.fillStyle = '#fff3e0'
  ell(ctx, 0, -12, 15, 19)
  ctx.fill()
  eyes(ctx, -40, state, t, true)
  cheeks(ctx, -30)
  // nariz y boca "w"
  ctx.fillStyle = '#ff7aa2'
  ctx.beginPath()
  ctx.moveTo(-3.5, -33)
  ctx.lineTo(3.5, -33)
  ctx.lineTo(0, -29)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.8
  ctx.beginPath()
  if (state === 'hit') {
    ctx.arc(0, -20, 5, Math.PI + 0.3, -0.3)
  } else {
    ctx.arc(-3.5, -28, 3.5, 0.1, Math.PI - 0.1)
    ctx.moveTo(7, -28)
    ctx.arc(3.5, -28, 3.5, 0.1, Math.PI - 0.1)
  }
  ctx.stroke()
  // bigotes
  ctx.lineWidth = 1.2
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * 10, -31)
    ctx.lineTo(sx * 25, -34)
    ctx.moveTo(sx * 10, -28)
    ctx.lineTo(sx * 25, -26)
    ctx.stroke()
  }
  // patitas
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 20, -4, 8, 6)
    fillStroke(ctx, '#fff3e0', 2)
  }
  // corazón flotando
  if (state !== 'hit') {
    const hy = -84 + Math.sin(t * 4) * 3
    ctx.save()
    ctx.translate(20, hy)
    ctx.scale(0.9, 0.9)
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.bezierCurveTo(-12, -3, -6, -12, 0, -5)
    ctx.bezierCurveTo(6, -12, 12, -3, 0, 6)
    fillStroke(ctx, '#ff4d6d', 2)
    ctx.restore()
  }
}

/**
 * Bicho asomándose del hoyo con centro de boca (x, y). `rise` 0..1 = cuánto ha
 * salido; lo que queda bajo la boca no se ve. En 'hit' se aplasta un poco.
 */
export function drawCritter(
  ctx: CanvasRenderingContext2D,
  kind: CritterKind,
  x: number,
  y: number,
  s: number,
  rise: number,
  state: CritterState,
  t: number,
) {
  if (rise <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - HOLE_W * s, y - 140 * s, HOLE_W * 2 * s, 140 * s + 2 * s)
  ctx.clip()
  const by = y + (1 - rise) * (CRITTER_H + 14) * s + 4 * s
  ctx.translate(x, by)
  const squash = state === 'hit' ? 0.82 : 1
  const wob = state === 'tease' ? Math.sin(t * 18) * 0.06 : 0
  ctx.scale(s * (2 - squash), s * squash)
  ctx.rotate(wob)
  if (kind === 'gatito') drawKitten(ctx, state, t)
  else drawMole(ctx, kind, state, t)
  ctx.restore()
}

/** Estrellitas de mareo girando sobre la cabeza (encima de todo). */
export function drawDizzy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + (i * TAU) / 3
    const px = x + Math.cos(a) * 22 * s
    const py = y + Math.sin(a) * 7 * s
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(a)
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = (k % 2 ? 2.4 : 6) * s
      const b = -Math.PI / 2 + (k * Math.PI) / 5
      ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r)
    }
    ctx.closePath()
    ctx.fillStyle = '#ffe14a'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.restore()
  }
}

/** Golpe de cómic: estrella blanca con contorno que crece y se desvanece (k 0..1). */
export function drawImpact(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, color = '#ffffff') {
  if (k >= 1) return
  const r = (26 + k * 22) * s
  ctx.save()
  ctx.globalAlpha = 1 - k * k
  ctx.translate(x, y)
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 ? r * 0.5 : r
    const a = (i / 16) * TAU
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.restore()
}

/**
 * Mazo de madera con cabeza roja. (x, y) es el punto donde pega. `swing` 0 = en
 * alto (inclinado hacia atrás), 1 = golpeando.
 */
export function drawMallet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, swing: number) {
  ctx.save()
  ctx.translate(x + 36 * s, y + 13 * s)
  ctx.rotate(1.1 - swing * 0.75)
  ctx.scale(s, s)
  // mango (sale hacia abajo a la derecha)
  ctx.beginPath()
  ctx.roundRect(-34, -4, 70, 8, 4)
  fillStroke(ctx, '#d9a066', 2.5)
  ctx.fillStyle = '#b97c45'
  ctx.fillRect(18, -4, 6, 8)
  // cabeza
  ctx.beginPath()
  ctx.roundRect(-52, -20, 28, 40, 7)
  fillStroke(ctx, '#ff4d5e', 3)
  ctx.fillStyle = '#ff8a95'
  ctx.fillRect(-48, -16, 6, 32)
  ctx.fillStyle = '#c2133a'
  ctx.fillRect(-52, -20, 5, 40)
  ctx.lineWidth = 3
  ctx.strokeStyle = OUTLINE
  ctx.beginPath()
  ctx.roundRect(-52, -20, 28, 40, 7)
  ctx.stroke()
  ctx.restore()
}

/** Barra de tiempo redondeada: verde → amarilla → roja; parpadea al final. */
export function drawTimerBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, t: number) {
  const h = 14
  const f = Math.max(0, Math.min(1, frac))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()
  const col = f > 0.5 ? '#5ad65a' : f > 0.22 ? '#ffd23f' : '#ff4d5e'
  if (f > 0) {
    ctx.beginPath()
    ctx.roundRect(x + 2, y + 2, Math.max(h - 4, (w - 4) * f), h - 4, (h - 4) / 2)
    ctx.fillStyle = f <= 0.22 && Math.sin(t * 14) > 0 ? '#ffffff' : col
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(x + 6, y + 4, Math.max(0, (w - 12) * f), 2)
  }
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  // relojito a la izquierda
  ell(ctx, x - 12, y + h / 2, 9, 9)
  fillStroke(ctx, '#ffffff', 2.5)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 12, y + h / 2)
  ctx.lineTo(x - 12, y + h / 2 - 6)
  ctx.moveTo(x - 12, y + h / 2)
  ctx.lineTo(x - 12 + 4, y + h / 2 + 2)
  ctx.stroke()
}
