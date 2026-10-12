/**
 * Arte de Corta Frutas: frutas caricaturescas con contorno, mitades con la pulpa
 * a la vista, bomba, manchas de jugo, tabla de madera y la estela de la espada.
 * Todo se dibuja con Canvas 2D en coordenadas lógicas del juego.
 */

export type FruitKind = 'sandia' | 'naranja' | 'manzana' | 'limon' | 'fresa' | 'coco' | 'dorada'

export interface FruitDef {
  /** Radio de la fruta entera (también es la hitbox). */
  r: number
  /** Color del jugo (manchas y partículas). */
  juice: string
  /** Puntos al cortarla. */
  points: number
}

export const FRUITS: Record<FruitKind, FruitDef> = {
  sandia: { r: 30, juice: '#ef3b4f', points: 1 },
  naranja: { r: 22, juice: '#ff9a1f', points: 1 },
  manzana: { r: 21, juice: '#f4f1c0', points: 1 },
  limon: { r: 19, juice: '#f2e93a', points: 1 },
  fresa: { r: 17, juice: '#ff3355', points: 1 },
  coco: { r: 22, juice: '#ffffff', points: 1 },
  /** Carambola dorada: rara y vale mucho. */
  dorada: { r: 20, juice: '#ffd23f', points: 10 },
}

/** Frutas comunes (para sortear el lanzamiento); la dorada se sortea aparte. */
export const COMMON_FRUITS: FruitKind[] = ['sandia', 'naranja', 'manzana', 'limon', 'fresa', 'coco']

export const BOMB_R = 22

const OUTLINE = '#2a1610'
const TAU = Math.PI * 2

interface Look {
  rind: string
  rindDark: string
  shine: string
  flesh: string
  fleshEdge: string
  seed?: string
}

const LOOKS: Record<FruitKind, Look> = {
  sandia: { rind: '#3fae3a', rindDark: '#1f6e2a', shine: '#9be38a', flesh: '#ff4d5e', fleshEdge: '#fff2c4', seed: '#2a1610' },
  naranja: { rind: '#ff9a1f', rindDark: '#d96a00', shine: '#ffd08a', flesh: '#ffb347', fleshEdge: '#fff0c8' },
  manzana: { rind: '#e8323c', rindDark: '#a8121e', shine: '#ff9aa0', flesh: '#fbf6d6', fleshEdge: '#fffbea', seed: '#5a3416' },
  limon: { rind: '#f5e63a', rindDark: '#c9b414', shine: '#fff7a6', flesh: '#fbf27a', fleshEdge: '#fffde0' },
  fresa: { rind: '#ff3355', rindDark: '#c2133a', shine: '#ff9bb0', flesh: '#ff7a92', fleshEdge: '#ffd6de', seed: '#ffe27a' },
  coco: { rind: '#8a5a32', rindDark: '#5a3418', shine: '#b88a5c', flesh: '#ffffff', fleshEdge: '#f1ece2' },
  dorada: { rind: '#ffcc2a', rindDark: '#d99400', shine: '#fff3a6', flesh: '#ffe57a', fleshEdge: '#fff8d6' },
}

// ---------- utilidades ----------
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
}

/** Estrella de 5 puntas centrada en (0,0). */
function starPath(ctx: CanvasRenderingContext2D, rOut: number, rIn: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? rIn : rOut
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
}

/** Silueta de la fruta (sin relleno) en el origen. */
function bodyPath(ctx: CanvasRenderingContext2D, kind: FruitKind, r: number) {
  if (kind === 'sandia') {
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.86, 0, 0, TAU)
  } else if (kind === 'limon') {
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.12, r * 0.86, 0, 0, TAU)
  } else if (kind === 'fresa') {
    ctx.beginPath()
    ctx.moveTo(0, r * 1.15)
    ctx.bezierCurveTo(-r * 1.25, r * 0.2, -r * 1.05, -r * 0.95, 0, -r * 0.75)
    ctx.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.25, r * 0.2, 0, r * 1.15)
    ctx.closePath()
  } else if (kind === 'manzana') {
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.62)
    ctx.bezierCurveTo(-r * 0.6, -r * 1.05, -r * 1.2, -r * 0.4, -r * 0.95, r * 0.35)
    ctx.bezierCurveTo(-r * 0.75, r * 1.0, -r * 0.2, r * 1.05, 0, r * 0.88)
    ctx.bezierCurveTo(r * 0.2, r * 1.05, r * 0.75, r * 1.0, r * 0.95, r * 0.35)
    ctx.bezierCurveTo(r * 1.2, -r * 0.4, r * 0.6, -r * 1.05, 0, -r * 0.62)
    ctx.closePath()
  } else if (kind === 'dorada') {
    starPath(ctx, r * 1.15, r * 0.62)
  } else {
    circle(ctx, 0, 0, r)
  }
}

/** Detalles de la cáscara (rayas, hojas, poros...) dentro de la silueta. */
function rindDetails(ctx: CanvasRenderingContext2D, kind: FruitKind, r: number, L: Look) {
  if (kind === 'sandia') {
    ctx.strokeStyle = L.rindDark
    ctx.lineWidth = r * 0.16
    ctx.lineCap = 'round'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      const x = i * r * 0.42
      ctx.moveTo(x, -r * 0.82)
      ctx.quadraticCurveTo(x + r * 0.18 * Math.sign(i || 1), 0, x, r * 0.82)
      ctx.stroke()
    }
  } else if (kind === 'naranja' || kind === 'limon') {
    ctx.fillStyle = L.rindDark
    for (let i = 0; i < 9; i++) {
      const a = hash(i + (kind === 'limon' ? 20 : 0)) * TAU
      const d = (0.25 + hash(i + 7) * 0.6) * r
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d * 0.85, 1.6, 1.6)
    }
  } else if (kind === 'fresa') {
    ctx.fillStyle = L.seed!
    for (let row = 0; row < 4; row++)
      for (let c = -row; c <= row; c += 2) {
        const x = c * r * 0.22
        const y = -r * 0.25 + row * r * 0.3
        ctx.beginPath()
        ctx.ellipse(x, y, 1.6, 2.2, 0, 0, TAU)
        ctx.fill()
      }
  } else if (kind === 'coco') {
    ctx.strokeStyle = L.rindDark
    ctx.lineWidth = 1.4
    for (let i = 0; i < 10; i++) {
      const a = hash(i + 40) * TAU
      const d = hash(i + 50) * r * 0.75
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d)
      ctx.lineTo(Math.cos(a) * d + 4, Math.sin(a) * d + 2)
      ctx.stroke()
    }
    // los tres "ojitos" del coco
    ctx.fillStyle = '#3a2210'
    circle(ctx, -r * 0.3, -r * 0.35, r * 0.11)
    ctx.fill()
    circle(ctx, r * 0.05, -r * 0.5, r * 0.11)
    ctx.fill()
    circle(ctx, r * 0.22, -r * 0.18, r * 0.11)
    ctx.fill()
  } else if (kind === 'dorada') {
    ctx.strokeStyle = L.rindDark
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95)
      ctx.stroke()
    }
  }
}

/** Tallo, hojas o corona encima de la fruta. */
function topper(ctx: CanvasRenderingContext2D, kind: FruitKind, r: number) {
  ctx.lineWidth = 2.5
  ctx.strokeStyle = OUTLINE
  if (kind === 'manzana') {
    ctx.strokeStyle = '#5a3416'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.6)
    ctx.quadraticCurveTo(r * 0.05, -r * 0.95, r * 0.15, -r * 1.1)
    ctx.stroke()
    ctx.fillStyle = '#4cc24a'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(r * 0.42, -r * 0.92, r * 0.32, r * 0.15, -0.5, 0, TAU)
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'naranja' || kind === 'limon') {
    ctx.fillStyle = '#4cc24a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(r * 0.25, -r * 0.92, r * 0.3, r * 0.13, -0.4, 0, TAU)
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'fresa') {
    ctx.fillStyle = '#3fae3a'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i * Math.PI) / 4
      ctx.lineTo(Math.cos(a) * r * 0.75, -r * 0.72 + Math.sin(a) * r * 0.35)
      ctx.lineTo(Math.cos(a + Math.PI / 8) * r * 0.25, -r * 0.72 + Math.sin(a + Math.PI / 8) * r * 0.12)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/** Brillo caricaturesco arriba a la izquierda. */
function shine(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.fillStyle = color
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.ellipse(-r * 0.4, -r * 0.38, r * 0.24, r * 0.13, -0.7, 0, TAU)
  ctx.fill()
  circle(ctx, -r * 0.62, -r * 0.08, r * 0.07)
  ctx.fill()
  ctx.globalAlpha = 1
}

// ---------- frutas ----------

/** Fruta entera centrada en (x, y) y girada `rot` radianes. `t` anima el brillo de la dorada. */
export function drawFruit(ctx: CanvasRenderingContext2D, kind: FruitKind, x: number, y: number, rot: number, t = 0) {
  const r = FRUITS[kind].r
  const L = LOOKS[kind]
  ctx.save()
  ctx.translate(x, y)
  if (kind === 'dorada') {
    // aura que late
    const pulse = 0.5 + 0.5 * Math.sin(t * 6)
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.1)
    g.addColorStop(0, `rgba(255,220,90,${0.45 + pulse * 0.25})`)
    g.addColorStop(1, 'rgba(255,220,90,0)')
    ctx.fillStyle = g
    circle(ctx, 0, 0, r * 2.1)
    ctx.fill()
  }
  ctx.rotate(rot)
  // sombra interna: relleno base oscuro y encima el color principal desplazado
  bodyPath(ctx, kind, r)
  ctx.fillStyle = L.rindDark
  ctx.fill()
  ctx.save()
  bodyPath(ctx, kind, r)
  ctx.clip()
  ctx.fillStyle = L.rind
  circle(ctx, -r * 0.12, -r * 0.14, r * 0.98)
  ctx.fill()
  rindDetails(ctx, kind, r, L)
  ctx.restore()
  bodyPath(ctx, kind, r)
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  topper(ctx, kind, r)
  shine(ctx, r, L.shine)
  if (kind === 'dorada') {
    const tw = (Math.sin(t * 9) + 1) / 2
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = tw
    ctx.save()
    ctx.translate(r * 0.55, -r * 0.55)
    starPath(ctx, 5, 1.6)
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/**
 * Media fruta. El corte es la recta local y = 0 (en el marco ya girado por `rot`):
 * `side = -1` es la mitad de arriba y `side = 1` la de abajo. Se ve la pulpa en el
 * borde del corte, como si la mitad estuviera un poco inclinada hacia la cámara.
 */
export function drawHalf(ctx: CanvasRenderingContext2D, kind: FruitKind, x: number, y: number, rot: number, side: -1 | 1) {
  const r = FRUITS[kind].r
  const L = LOOKS[kind]
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  // mitad de cáscara
  ctx.save()
  ctx.beginPath()
  ctx.rect(-r * 1.6, side < 0 ? -r * 1.6 : 0, r * 3.2, r * 1.6)
  ctx.clip()
  bodyPath(ctx, kind, r)
  ctx.fillStyle = L.rindDark
  ctx.fill()
  ctx.save()
  bodyPath(ctx, kind, r)
  ctx.clip()
  ctx.fillStyle = L.rind
  circle(ctx, -r * 0.12, -r * 0.14, r * 0.98)
  ctx.fill()
  rindDetails(ctx, kind, r, L)
  ctx.restore()
  bodyPath(ctx, kind, r)
  ctx.lineWidth = 3
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  if (side < 0) topper(ctx, kind, r)
  ctx.restore()

  // cara del corte: elipse de pulpa sobre la línea
  const fw = kind === 'limon' ? r * 1.08 : kind === 'dorada' ? r * 1.0 : r * 0.96
  const fh = r * 0.36
  ctx.beginPath()
  ctx.ellipse(0, 0, fw, fh, 0, 0, TAU)
  ctx.fillStyle = L.fleshEdge
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 0, fw * 0.84, fh * 0.72, 0, 0, TAU)
  ctx.fillStyle = L.flesh
  ctx.fill()
  if (kind === 'naranja' || kind === 'limon') {
    // gajos
    ctx.strokeStyle = L.fleshEdge
    ctx.lineWidth = 1.5
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * fw * 0.84, Math.sin(a) * fh * 0.72)
      ctx.stroke()
    }
  } else if (kind === 'coco') {
    ctx.fillStyle = '#dfe9ff'
    ctx.beginPath()
    ctx.ellipse(0, 0, fw * 0.55, fh * 0.42, 0, 0, TAU)
    ctx.fill()
  } else if (L.seed) {
    ctx.fillStyle = L.seed
    const n = kind === 'sandia' ? 7 : kind === 'fresa' ? 0 : 3
    for (let i = 0; i < n; i++) {
      const px = (i / Math.max(1, n - 1) - 0.5) * fw * 1.2
      const py = (hash(i + 3) - 0.5) * fh * 0.6
      ctx.beginPath()
      ctx.ellipse(px, py, 1.6, 2.6, 0.3, 0, TAU)
      ctx.fill()
    }
    if (kind === 'fresa') {
      ctx.fillStyle = '#ffd6de'
      ctx.beginPath()
      ctx.ellipse(0, 0, fw * 0.4, fh * 0.35, 0, 0, TAU)
      ctx.fill()
    }
  }
  // brillo húmedo de la pulpa
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-fw * 0.35, -fh * 0.25, fw * 0.18, fh * 0.14, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// ---------- bomba ----------

/** Bomba con mecha encendida. ¡No se corta! `t` anima la chispa. */
export function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, t: number) {
  const r = BOMB_R
  ctx.save()
  ctx.translate(x, y)
  // halo rojo de advertencia
  const pulse = 0.5 + 0.5 * Math.sin(t * 10)
  ctx.fillStyle = `rgba(255,60,60,${0.18 + pulse * 0.18})`
  circle(ctx, 0, 0, r * 1.55)
  ctx.fill()
  ctx.rotate(rot)
  // cuerpo
  circle(ctx, 0, 0, r)
  ctx.fillStyle = '#23232e'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#0b0b10'
  ctx.stroke()
  ctx.fillStyle = '#4a4a5c'
  ctx.beginPath()
  ctx.ellipse(-r * 0.38, -r * 0.4, r * 0.28, r * 0.15, -0.7, 0, TAU)
  ctx.fill()
  // calavera simple para que se lea "peligro"
  ctx.fillStyle = '#f4f4f4'
  circle(ctx, 0, r * 0.05, r * 0.42)
  ctx.fill()
  ctx.fillRect(-r * 0.22, r * 0.3, r * 0.44, r * 0.22)
  ctx.fillStyle = '#23232e'
  circle(ctx, -r * 0.16, 0, r * 0.12)
  ctx.fill()
  circle(ctx, r * 0.16, 0, r * 0.12)
  ctx.fill()
  ctx.fillRect(-r * 0.04, r * 0.32, r * 0.08, r * 0.2)
  // boquilla y mecha
  ctx.fillStyle = '#6b6b80'
  ctx.fillRect(-r * 0.25, -r * 1.12, r * 0.5, r * 0.3)
  ctx.strokeStyle = '#0b0b10'
  ctx.lineWidth = 2
  ctx.strokeRect(-r * 0.25, -r * 1.12, r * 0.5, r * 0.3)
  ctx.strokeStyle = '#c9a26a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.12)
  ctx.quadraticCurveTo(r * 0.35, -r * 1.55, r * 0.55, -r * 1.45)
  ctx.stroke()
  // chispa
  const sx = r * 0.55
  const sy = -r * 1.45
  ctx.fillStyle = '#fff7a6'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 12
    const len = 5 + 4 * Math.abs(Math.sin(t * 20 + i))
    ctx.fillRect(sx + Math.cos(a) * len - 1, sy + Math.sin(a) * len - 1, 2.4, 2.4)
  }
  ctx.fillStyle = '#ff9a1f'
  circle(ctx, sx, sy, 3.5)
  ctx.fill()
  ctx.restore()
}

// ---------- manchas, fondo, espada, interfaz ----------

/** Mancha de jugo sobre la tabla. `seed` fija la forma; `alpha` permite desvanecerla. */
export function drawSplat(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number, seed: number, alpha: number) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha * 0.75
  ctx.fillStyle = color
  ctx.beginPath()
  const n = 12
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU
    const rr = size * (0.7 + hash(seed + i) * 0.45)
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 6; i++) {
    const a = hash(seed * 3 + i) * TAU
    const d = size * (1.1 + hash(seed * 5 + i) * 0.9)
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.08 + hash(seed * 7 + i) * 0.14))
    ctx.fill()
  }
  ctx.restore()
}

/** Tabla de picar de madera de pared a pared, con vetas y nudos. */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const plank = 64
  for (let i = 0; i * plank < w + plank; i++) {
    const x = i * plank
    const tone = hash(i + 1)
    ctx.fillStyle = `rgb(${150 + tone * 22 | 0},${98 + tone * 16 | 0},${58 + tone * 10 | 0})`
    ctx.fillRect(x, 0, plank, h)
    // vetas
    ctx.strokeStyle = 'rgba(90,52,24,0.28)'
    ctx.lineWidth = 1.5
    for (let k = 0; k < 4; k++) {
      const vx = x + 10 + k * 13 + hash(i * 7 + k) * 6
      ctx.beginPath()
      ctx.moveTo(vx, 0)
      for (let y = 0; y <= h; y += 40) ctx.lineTo(vx + Math.sin(y * 0.02 + i + k) * 3, y)
      ctx.stroke()
    }
    // nudo
    const ky = hash(i * 13 + 3) * h
    ctx.strokeStyle = 'rgba(90,52,24,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x + plank / 2, ky, 6, 11, 0, 0, TAU)
    ctx.stroke()
    // junta entre tablas
    ctx.fillStyle = 'rgba(50,26,10,0.55)'
    ctx.fillRect(x, 0, 2, h)
    ctx.fillStyle = 'rgba(255,220,170,0.12)'
    ctx.fillRect(x + 2, 0, 2, h)
  }
  // viñeta para que las frutas resalten
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(20,8,0,0.5)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export interface BladePoint {
  x: number
  y: number
  /** Segundos desde que se registró el punto. */
  age: number
}

/** Vida de la estela en segundos: los puntos más viejos ya no se dibujan. */
export const BLADE_LIFE = 0.16

/**
 * Estela de la espada: cinta que se afina hacia la cola con un núcleo blanco y
 * un brillo de color. `points` va del más viejo al más nuevo.
 */
export function drawBlade(ctx: CanvasRenderingContext2D, points: BladePoint[], color = '#7fe8ff') {
  const pts = points.filter((p) => p.age < BLADE_LIFE)
  if (pts.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const pass of [
    { w: 14, c: color, a: 0.35 },
    { w: 7, c: color, a: 0.8 },
    { w: 3, c: '#ffffff', a: 1 },
  ]) {
    ctx.strokeStyle = pass.c
    for (let i = 1; i < pts.length; i++) {
      const k = 1 - pts[i].age / BLADE_LIFE
      ctx.globalAlpha = pass.a * k
      ctx.lineWidth = pass.w * (0.25 + 0.75 * (i / (pts.length - 1)))
      ctx.beginPath()
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y)
      ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/**
 * Las tres cruces de vidas arriba a la derecha (alineadas a la derecha en `right`).
 * `missed` = frutas que se cayeron sin cortar (0..3); las perdidas se pintan rojas.
 * `pulse` (0..1) agranda la última cruz perdida.
 */
export function drawLives(ctx: CanvasRenderingContext2D, right: number, y: number, missed: number, pulse = 0) {
  for (let i = 0; i < 3; i++) {
    const x = right - (2 - i) * 30 - 12
    const lost = i < missed
    const s = (i === missed - 1 ? 1 + pulse * 0.6 : 1) * (lost ? 11 : 8)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = OUTLINE
    ctx.fillRect(-s - 2, -4.5, s * 2 + 4, 9)
    ctx.fillRect(-4.5, -s - 2, 9, s * 2 + 4)
    ctx.fillStyle = lost ? '#ff3b3b' : 'rgba(255,255,255,0.35)'
    ctx.fillRect(-s, -2.5, s * 2, 5)
    ctx.fillRect(-2.5, -s, 5, s * 2)
    ctx.restore()
  }
}

/** Marca roja en el borde inferior donde se cayó una fruta sin cortar. */
export function drawMissMark(ctx: CanvasRenderingContext2D, x: number, bottom: number, alpha: number) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, bottom - 22)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = '#ff3b3b'
  ctx.fillRect(-12, -3, 24, 6)
  ctx.fillRect(-3, -12, 6, 24)
  ctx.restore()
}

/** Destello blanco de la explosión de la bomba (radio creciente con `k` 0..1). */
export function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  const r = 30 + k * 420
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - k)
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.35, '#fff3b0')
  g.addColorStop(0.7, 'rgba(255,140,40,0.6)')
  g.addColorStop(1, 'rgba(255,80,20,0)')
  ctx.fillStyle = g
  circle(ctx, x, y, r)
  ctx.fill()
  // rayos
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2)
    ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9)
    ctx.stroke()
  }
  ctx.restore()
}
