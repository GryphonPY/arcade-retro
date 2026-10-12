/**
 * Arte de Torre Espiral (estilo Helix Jump): torre central con pisos en anillo
 * vistos en pseudo-3D, pelota que rebota, manchas de pintura, trozos que salen
 * volando, bola de fuego, temas de color por nivel y aspectos de pelota.
 *
 * Geometría: cada piso es un anillo de SEGS segmentos entre R_IN y R_OUT. Un
 * punto del piso en el ángulo de pantalla `a` y radio `r` se proyecta en
 *   (cx + cos(a)·r, y + sin(a)·r·TILT)
 * así sin(a) > 0 es la mitad delantera (cerca de la cámara). El ángulo de
 * pantalla es el ángulo propio del segmento + la rotación de la torre.
 * La pelota siempre está al frente: ángulo de pantalla π/2, radio R_MID.
 *
 * Orden de dibujo recomendado (de abajo hacia arriba en la pantalla):
 *   drawBackground → para cada piso: drawPlatform(..., 'back')
 *   → drawPole → para cada piso: drawPlatform(..., 'front')
 *   → drawBall → drawShard (trozos) → interfaz
 */

export const SEGS = 12
export const SEG_ANGLE = (Math.PI * 2) / SEGS
export const R_IN = 22
export const R_OUT = 118
export const R_MID = (R_IN + R_OUT) / 2
export const TILT = 0.34
export const THICK = 14
export const BALL_R = 11
/** Distancia vertical entre la línea del piso y el punto donde se apoya la pelota (centro). */
export const BALL_REST_DY = R_MID * TILT - BALL_R + 2

/**
 * 'safe' = piso normal, 'danger' = rojo (pierdes), 'gap' = hueco,
 * 'metal' = piso irrompible: se rebota en él como en uno normal, pero la bola
 * de fuego no lo atraviesa, 'finish' = meta.
 */
export type SegKind = 'safe' | 'danger' | 'gap' | 'metal' | 'finish'

export interface Splat {
  /** Ángulo propio (de torre) donde cayó la pelota. */
  a: number
  seed: number
  /** 0..1, crece rápido al aparecer. */
  grow: number
}

export interface PlatformView {
  /** y de pantalla de la cara superior del piso (en el eje de la torre). */
  y: number
  segs: SegKind[]
  splats: Splat[]
  /** Rotación propia extra (pisos que giran al revés en niveles altos). */
  spin: number
  /** 0..1 destello blanco al rebotar en él. */
  flash: number
}

export interface Theme {
  name: string
  bgTop: string
  bgBot: string
  pole: string
  poleDark: string
  safe: string
  safeSide: string
  danger: string
  dangerSide: string
  splat: string
  particle: string
}

export const THEMES: Theme[] = [
  { name: 'Chicle', bgTop: '#ffd6e8', bgBot: '#ffb3d1', pole: '#fff5fa', poleDark: '#f3c6dc', safe: '#8a63ff', safeSide: '#6040d6', danger: '#ff3b3b', dangerSide: '#b81d1d', splat: '#ff4f9a', particle: '#ffffff' },
  { name: 'Menta', bgTop: '#d4fff1', bgBot: '#9df0d5', pole: '#f4fffb', poleDark: '#bfe9da', safe: '#2fd1a0', safeSide: '#17997a', danger: '#ff4b4b', dangerSide: '#b52222', splat: '#1aa984', particle: '#ffffff' },
  { name: 'Uva', bgTop: '#e6dcff', bgBot: '#b9a2ff', pole: '#faf7ff', poleDark: '#d6cbf3', safe: '#8c6cff', safeSide: '#6347d6', danger: '#ff4057', dangerSide: '#b51d33', splat: '#7a52ff', particle: '#ffffff' },
  { name: 'Mango', bgTop: '#fff2c4', bgBot: '#ffd27a', pole: '#fffbef', poleDark: '#f0dcae', safe: '#ffaa2b', safeSide: '#d97f06', danger: '#e8303a', dangerSide: '#a3141c', splat: '#ff8a00', particle: '#ffffff' },
  { name: 'Cielo', bgTop: '#d6f1ff', bgBot: '#8fd3ff', pole: '#f7fcff', poleDark: '#c4e2f3', safe: '#3aa8ff', safeSide: '#1c7ad1', danger: '#ff4545', dangerSide: '#b51f1f', splat: '#1f8cff', particle: '#ffffff' },
  { name: 'Noche', bgTop: '#1b1640', bgBot: '#3a2a78', pole: '#e8e4ff', poleDark: '#9c93d6', safe: '#ffd23f', safeSide: '#d6a500', danger: '#ff3b6b', dangerSide: '#b0123d', splat: '#ffcf1f', particle: '#fff7c2' },
  { name: 'Lima', bgTop: '#efffd1', bgBot: '#c5f27a', pole: '#fbfff1', poleDark: '#dbeaba', safe: '#7bcf1f', safeSide: '#559a0c', danger: '#ff4040', dangerSide: '#b21c1c', splat: '#5fb80b', particle: '#ffffff' },
  { name: 'Coral', bgTop: '#ffe1d6', bgBot: '#ffb19a', pole: '#fff8f5', poleDark: '#f2cdbf', safe: '#ff6f4f', safeSide: '#d6482b', danger: '#8a1fd1', dangerSide: '#5c0f91', splat: '#ff5530', particle: '#ffffff' },
]

export const themeFor = (level: number) => THEMES[(Math.max(1, level) - 1) % THEMES.length]

// ---------- aspectos de pelota ----------

export type SkinId = 'clasica' | 'fresa' | 'balon' | 'pollito' | 'planeta' | 'gatito' | 'sandia' | 'disco' | 'oro'

export interface Skin {
  id: SkinId
  name: string
  /** Nivel en el que se desbloquea (1 = desde el inicio). */
  unlock: number
}

export const SKINS: Skin[] = [
  { id: 'clasica', name: 'Clásica', unlock: 1 },
  { id: 'fresa', name: 'Fresa', unlock: 3 },
  { id: 'balon', name: 'Balón', unlock: 5 },
  { id: 'pollito', name: 'Pollito', unlock: 8 },
  { id: 'sandia', name: 'Sandía', unlock: 11 },
  { id: 'gatito', name: 'Gatito', unlock: 15 },
  { id: 'planeta', name: 'Planeta', unlock: 20 },
  { id: 'disco', name: 'Disco', unlock: 25 },
  { id: 'oro', name: 'Oro', unlock: 30 },
]

const OUTLINE = 'rgba(30,20,40,0.85)'
const TAU = Math.PI * 2

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
function shade(hex: string, k: number) {
  // k > 0 aclara, k < 0 oscurece
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  if (k > 0) {
    r += (255 - r) * k
    g += (255 - g) * k
    b += (255 - b) * k
  } else {
    r *= 1 + k
    g *= 1 + k
    b *= 1 + k
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`
}
const P = (cx: number, y: number, a: number, r: number): [number, number] => [cx + Math.cos(a) * r, y + Math.sin(a) * r * TILT]

// ---------- fondo ----------

/** Degradado del tema y burbujas suaves que suben (parallax con `scroll`). */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme, t: number, scroll: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, theme.bgTop)
  g.addColorStop(1, theme.bgBot)
  ctx.fillStyle = g
  ctx.fillRect(-20, -20, w + 40, h + 40)
  ctx.fillStyle = theme.particle
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3 + 1) * w
    const sp = 0.15 + hash(i * 3 + 2) * 0.35
    const y = ((((hash(i * 3 + 3) * h - scroll * sp - t * 12 * sp) % (h + 40)) + h + 40) % (h + 40)) - 20
    const r = 2 + hash(i + 50) * 5
    ctx.globalAlpha = 0.18 + hash(i + 70) * 0.25
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ---------- torre ----------

/** Columna central desde `top` hasta `bottom` (pantalla). Las franjas giran con `rot`. */
export function drawPole(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number, theme: Theme, rot: number) {
  const g = ctx.createLinearGradient(cx - R_IN, 0, cx + R_IN, 0)
  g.addColorStop(0, theme.poleDark)
  g.addColorStop(0.35, theme.pole)
  g.addColorStop(0.6, theme.pole)
  g.addColorStop(1, theme.poleDark)
  ctx.fillStyle = g
  ctx.fillRect(cx - R_IN, top, R_IN * 2, bottom - top)
  // franjas verticales que dan la sensación de giro
  ctx.fillStyle = theme.poleDark
  ctx.globalAlpha = 0.45
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6
    if (Math.sin(a) <= 0.05) continue
    const x = cx + Math.cos(a) * R_IN
    const w = Math.max(1, Math.sin(a) * 5)
    ctx.fillRect(x - w / 2, top, w, bottom - top)
  }
  ctx.globalAlpha = 1
}

function segColors(kind: SegKind, theme: Theme): [string, string] {
  if (kind === 'danger') return [theme.danger, theme.dangerSide]
  if (kind === 'metal') return ['#5b5f6e', '#34374a']
  if (kind === 'finish') return ['#ffffff', '#d9d9e6']
  return [theme.safe, theme.safeSide]
}

/**
 * Dibuja la mitad trasera ('back') o delantera ('front') de un piso. `rot` es la
 * rotación de la torre; `t` anima el brillo de los segmentos rojos y la meta.
 */
export function drawPlatform(ctx: CanvasRenderingContext2D, cx: number, p: PlatformView, rot: number, theme: Theme, half: 'back' | 'front', t: number) {
  const R = rot + p.spin
  const steps = 6
  for (let i = 0; i < SEGS; i++) {
    const kind = p.segs[i]
    if (kind === 'gap') continue
    const a0 = R + i * SEG_ANGLE
    const a1 = a0 + SEG_ANGLE
    const mid = (a0 + a1) / 2
    const front = Math.sin(mid) > 0
    if ((half === 'front') !== front) continue
    const [top, side] = segColors(kind, theme)

    // cara lateral (sólo visible en la mitad delantera)
    if (front) {
      ctx.beginPath()
      for (let k = 0; k <= steps; k++) {
        const [x, y] = P(cx, p.y, a0 + ((a1 - a0) * k) / steps, R_OUT)
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      for (let k = steps; k >= 0; k--) {
        const [x, y] = P(cx, p.y, a0 + ((a1 - a0) * k) / steps, R_OUT)
        ctx.lineTo(x, y + THICK)
      }
      ctx.closePath()
      ctx.fillStyle = side
      ctx.fill()
      // bordes de los extremos si el vecino es un hueco: tapa lateral recta
      for (const [edgeA, nb] of [
        [a0, p.segs[(i + SEGS - 1) % SEGS]],
        [a1, p.segs[(i + 1) % SEGS]],
      ] as const) {
        if (nb !== 'gap') continue
        const [x1, y1] = P(cx, p.y, edgeA, R_IN)
        const [x2, y2] = P(cx, p.y, edgeA, R_OUT)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x2, y2 + THICK)
        ctx.lineTo(x1, y1 + THICK)
        ctx.closePath()
        ctx.fillStyle = shade(side, -0.18)
        ctx.fill()
      }
    }

    // cara superior
    ctx.beginPath()
    for (let k = 0; k <= steps; k++) {
      const [x, y] = P(cx, p.y, a0 + ((a1 - a0) * k) / steps, R_OUT)
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let k = steps; k >= 0; k--) {
      const [x, y] = P(cx, p.y, a0 + ((a1 - a0) * k) / steps, R_IN)
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    // más claro al frente, más oscuro atrás: da volumen
    const light = Math.sin(mid) * 0.12 + (kind === 'danger' ? 0.06 * Math.sin(t * 8) : 0)
    ctx.fillStyle = shade(top, light)
    ctx.fill()
    if (p.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${p.flash * 0.7})`
      ctx.fill()
    }

    if (kind === 'danger') {
      // franjas de advertencia en la cara superior
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx.lineWidth = 5
      const [mx, my] = P(cx, p.y, mid, R_MID)
      for (let s = -4; s <= 4; s++) {
        ctx.beginPath()
        ctx.moveTo(mx + s * 14 - 20, my - 20)
        ctx.lineTo(mx + s * 14 + 20, my + 20)
        ctx.stroke()
      }
      ctx.restore()
    } else if (kind === 'metal') {
      // remaches
      ctx.fillStyle = '#8d92a6'
      for (const r of [R_IN + 18, R_OUT - 16]) {
        const [x, y] = P(cx, p.y, mid, r)
        ctx.beginPath()
        ctx.ellipse(x, y, 3, 3 * TILT * 2, 0, 0, TAU)
        ctx.fill()
      }
    } else if (kind === 'finish') {
      // tablero de ajedrez de meta
      ctx.save()
      ctx.clip()
      for (let k = 0; k < 4; k++) {
        const aa = a0 + (k + 0.5) * (SEG_ANGLE / 4)
        const [x, y] = P(cx, p.y, aa, R_OUT - 14)
        ctx.fillStyle = (k + i) % 2 ? '#22223a' : '#ffd23f'
        ctx.fillRect(x - 6, y - 3, 12, 6)
      }
      ctx.restore()
    }

    // contorno fino delantero
    if (front) {
      ctx.beginPath()
      for (let k = 0; k <= steps; k++) {
        const [x, y] = P(cx, p.y, a0 + ((a1 - a0) * k) / steps, R_OUT)
        if (k === 0) ctx.moveTo(x, y + THICK)
        else ctx.lineTo(x, y + THICK)
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  // manchas de pintura sobre los segmentos de esta mitad
  for (const s of p.splats) {
    const a = R + s.a
    if ((half === 'front') !== Math.sin(a) > 0) continue
    const [x, y] = P(cx, p.y, a, R_MID)
    const sz = 13 * Math.min(1, s.grow)
    ctx.fillStyle = theme.splat
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    for (let k = 0; k <= 10; k++) {
      const b = (k / 10) * TAU
      const rr = sz * (0.75 + hash(s.seed + k) * 0.45)
      ctx.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr * TILT * 1.6)
    }
    ctx.closePath()
    ctx.fill()
    for (let k = 0; k < 4; k++) {
      const b = hash(s.seed * 3 + k) * TAU
      const d = sz * (1.25 + hash(s.seed * 7 + k) * 0.6)
      ctx.beginPath()
      ctx.ellipse(x + Math.cos(b) * d, y + Math.sin(b) * d * TILT * 1.6, 2.4, 1.6, 0, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/** Indica si un ángulo de pantalla está en la mitad delantera (útil para colocar efectos). */
export const isFront = (screenAngle: number) => Math.sin(screenAngle) > 0

/** Ángulo propio del segmento que está justo debajo de la pelota (al frente). */
export function segmentUnderBall(rot: number, spin = 0): number {
  const a = Math.PI / 2 - rot - spin
  const n = ((a % TAU) + TAU) % TAU
  return Math.floor(n / SEG_ANGLE) % SEGS
}

// ---------- trozos que salen volando ----------

export interface ShardView {
  x: number
  y: number
  rot: number
  /** Escala 0..1 (se encoge al desvanecerse). */
  s: number
  color: string
  side: string
}

/** Trozo de piso roto: un sector pequeño con su canto. */
export function drawShard(ctx: CanvasRenderingContext2D, sh: ShardView) {
  ctx.save()
  ctx.translate(sh.x, sh.y)
  ctx.rotate(sh.rot)
  ctx.scale(sh.s, sh.s)
  ctx.fillStyle = sh.side
  ctx.beginPath()
  ctx.moveTo(-16, -2)
  ctx.lineTo(16, -6)
  ctx.lineTo(14, 8)
  ctx.lineTo(-14, 10)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = sh.color
  ctx.beginPath()
  ctx.moveTo(-16, -8)
  ctx.lineTo(16, -12)
  ctx.lineTo(16, -6)
  ctx.lineTo(-16, -2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ---------- pelota ----------

/**
 * Pelota en (x, y). `squash` > 0 la aplasta al rebotar (0..1). `fire` 0..1
 * la convierte en bola de fuego con estela. `vy` sirve para estirarla al caer.
 */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, skin: SkinId, squash: number, fire: number, vy: number, t: number) {
  const r = BALL_R
  // estela de fuego
  if (fire > 0) {
    for (let i = 6; i >= 1; i--) {
      const k = i / 6
      ctx.globalAlpha = fire * (1 - k) * 0.85
      ctx.fillStyle = i > 3 ? '#ff6a00' : '#ffd23f'
      ctx.beginPath()
      ctx.arc(x + Math.sin(t * 30 + i) * 2.5, y - i * 7, r * (1 - k * 0.55), 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  // sombra suave hacia adelante
  ctx.save()
  ctx.translate(x, y)
  const stretch = Math.min(0.25, Math.abs(vy) / 2400)
  const sx = 1 + squash * 0.35 - stretch * 0.5
  const sy = 1 - squash * 0.35 + stretch
  ctx.scale(sx, sy)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.save()
  ctx.clip()
  paintSkin(ctx, skin, r, t)
  if (fire > 0) {
    ctx.globalAlpha = fire * 0.75
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, r)
    g.addColorStop(0, '#fff7c2')
    g.addColorStop(0.5, '#ffb000')
    g.addColorStop(1, '#ff3d00')
    ctx.fillStyle = g
    ctx.fillRect(-r, -r, r * 2, r * 2)
    ctx.globalAlpha = 1
  }
  // sombreado esférico
  const sh = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.05)
  sh.addColorStop(0, 'rgba(255,255,255,0.55)')
  sh.addColorStop(0.35, 'rgba(255,255,255,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = sh
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()
  ctx.lineWidth = 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.restore()
}

/** Pinta el aspecto dentro de un círculo de radio r ya recortado. */
function paintSkin(ctx: CanvasRenderingContext2D, skin: SkinId, r: number, t: number) {
  const fill = (c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(-r, -r, r * 2, r * 2)
  }
  const dot = (x: number, y: number, rr: number, c: string) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(x, y, rr, 0, TAU)
    ctx.fill()
  }
  switch (skin) {
    case 'clasica':
      fill('#ff3d7f')
      break
    case 'fresa':
      fill('#ff3355')
      for (let i = 0; i < 7; i++) dot(-6 + (i % 3) * 6 + (i > 2 ? 3 : 0), -2 + Math.floor(i / 3) * 5, 1.1, '#ffe27a')
      ctx.fillStyle = '#3fae3a'
      ctx.fillRect(-r, -r, r * 2, 5)
      break
    case 'balon':
      fill('#ffffff')
      ctx.fillStyle = '#22222e'
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5
        ctx.lineTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5)
      }
      ctx.fill()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5
        dot(Math.cos(a) * 11, Math.sin(a) * 11, 3.4, '#22222e')
      }
      break
    case 'pollito':
      fill('#ffd23f')
      dot(-3.5, -2, 1.8, '#22222e')
      dot(3.5, -2, 1.8, '#22222e')
      ctx.fillStyle = '#ff8a00'
      ctx.beginPath()
      ctx.moveTo(-2.5, 1)
      ctx.lineTo(2.5, 1)
      ctx.lineTo(0, 4.5)
      ctx.fill()
      dot(-6.5, 2.5, 1.6, 'rgba(255,110,140,0.7)')
      dot(6.5, 2.5, 1.6, 'rgba(255,110,140,0.7)')
      break
    case 'sandia':
      fill('#ff4d5e')
      ctx.fillStyle = '#3fae3a'
      ctx.fillRect(-r, r - 4, r * 2, 4)
      ctx.fillStyle = '#fff2c4'
      ctx.fillRect(-r, r - 6, r * 2, 2)
      for (let i = 0; i < 5; i++) dot(-6 + i * 3, -2 + (i % 2) * 4, 0.9, '#2a1610')
      break
    case 'gatito':
      fill('#ff9f43')
      ctx.fillStyle = '#d9731a'
      ctx.fillRect(-2, -r, 1.6, 5)
      ctx.fillRect(1, -r, 1.6, 4)
      dot(-3.5, -1, 1.7, '#22222e')
      dot(3.5, -1, 1.7, '#22222e')
      dot(0, 2.5, 1, '#ff7aa2')
      break
    case 'planeta':
      fill('#7a5cff')
      dot(-3, -3, 3, '#9b84ff')
      dot(4, 3, 2, '#5b3fd6')
      ctx.strokeStyle = '#ffd23f'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, r + 2, 3, -0.35, 0, TAU)
      ctx.stroke()
      break
    case 'disco': {
      fill('#c9d2e6')
      for (let gx = -r; gx < r; gx += 4)
        for (let gy = -r; gy < r; gy += 4) {
          const k = (Math.sin(t * 6 + gx * 0.7 + gy * 0.5) + 1) / 2
          ctx.fillStyle = k > 0.8 ? '#ffffff' : k > 0.5 ? '#9fb0d6' : '#7d8db3'
          ctx.fillRect(gx, gy, 3.4, 3.4)
        }
      break
    }
    case 'oro':
      fill('#ffcc2a')
      ctx.fillStyle = '#fff3a6'
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 7)
      ctx.fillRect(-r, -2, r * 2, 2)
      ctx.globalAlpha = 1
      break
  }
}

/** Muestra del aspecto para el selector (bolita estática sin efectos). */
export function drawSkinPreview(ctx: CanvasRenderingContext2D, x: number, y: number, skin: SkinId, locked: boolean, t: number) {
  if (locked) {
    ctx.save()
    ctx.globalAlpha = 0.35
    drawBall(ctx, x, y, skin, 0, 0, 0, t)
    ctx.restore()
    // candado
    ctx.fillStyle = '#22222e'
    ctx.fillRect(x - 5, y - 1, 10, 8)
    ctx.strokeStyle = '#22222e'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y - 2, 3.5, Math.PI, 0)
    ctx.stroke()
    return
  }
  drawBall(ctx, x, y, skin, 0, 0, 0, t)
}

// ---------- interfaz ----------

/**
 * Barra de progreso del nivel: círculo con el nivel actual, barra y círculo con el
 * siguiente. `frac` 0..1 = pisos superados / pisos del nivel.
 */
export function drawProgress(ctx: CanvasRenderingContext2D, w: number, y: number, level: number, frac: number, theme: Theme, font: string) {
  const bw = Math.min(200, w - 120)
  const x0 = w / 2 - bw / 2
  const circle = (cx: number, n: number, on: boolean) => {
    ctx.beginPath()
    ctx.arc(cx, y, 15, 0, TAU)
    ctx.fillStyle = on ? theme.safe : 'rgba(255,255,255,0.85)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = on ? theme.safeSide : 'rgba(0,0,0,0.15)'
    ctx.stroke()
    ctx.fillStyle = on ? '#ffffff' : '#555'
    ctx.font = `10px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), cx, y + 1)
  }
  ctx.beginPath()
  ctx.roundRect(x0, y - 6, bw, 12, 6)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fill()
  if (frac > 0) {
    ctx.beginPath()
    ctx.roundRect(x0, y - 6, Math.max(12, bw * Math.min(1, frac)), 12, 6)
    ctx.fillStyle = theme.safe
    ctx.fill()
  }
  circle(x0 - 4, level, true)
  circle(x0 + bw + 4, level + 1, frac >= 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** Texto grande con contorno (marcador, "¡PERFECTO!", "+3"...). */
export function drawBigText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, font: string, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${size}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(4, size * 0.28)
  ctx.strokeStyle = 'rgba(40,20,50,0.85)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}
