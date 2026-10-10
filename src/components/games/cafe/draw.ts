/** Arte del Café Michi. */
import { INK, rr, face, mix } from '../pasteleria/draw'
import type { CatDef, HatId, ItemId, StationId } from './content'

export { INK, rr }

/** Michi de cuerpo entero (patitas en x,y). `walk` anima el paso; `work` mueve las patitas. */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  c: CatDef,
  hat: HatId | null,
  x: number,
  y: number,
  s: number,
  t: number,
  o: { walk?: boolean; work?: boolean; sleep?: boolean; boost?: boolean; face?: -1 | 1 } = {},
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s * (o.face ?? 1), s)
  const bob = o.walk ? Math.abs(Math.sin(t * 12)) * 3 : o.work ? Math.sin(t * 14) * 1 : Math.sin(t * 2) * 0.6
  ctx.lineWidth = 2.2
  ctx.strokeStyle = INK
  // sombra
  ctx.fillStyle = 'rgba(91,42,58,0.18)'
  ctx.beginPath()
  ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  // cola
  ctx.strokeStyle = INK
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(10, -10)
  ctx.quadraticCurveTo(26, -14 + Math.sin(t * 3) * 4, 22, -30 + Math.sin(t * 3) * 3)
  ctx.stroke()
  ctx.strokeStyle = c.fur
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.2
  // cuerpo
  ctx.fillStyle = c.fur
  ctx.beginPath()
  ctx.ellipse(0, -15 - bob * 0.5, 16, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // patitas
  const step = o.walk ? Math.sin(t * 12) * 3 : 0
  ctx.fillStyle = c.pattern === 'calcetines' ? c.spot : c.fur
  for (const [dx, k] of [
    [-7, 1],
    [7, -1],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(dx + step * k, -2, 5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  // bracitos al trabajar
  if (o.work) {
    ctx.fillStyle = c.pattern === 'calcetines' ? c.spot : c.fur
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(dx * 12, -20 + Math.sin(t * 14 + dx) * 3, 4.5, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  // cabeza
  const hy = -40 - bob
  ctx.fillStyle = c.fur
  for (const dx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(dx * 18, hy - 4)
    ctx.lineTo(dx * 14, hy - 24)
    ctx.lineTo(dx * 3, hy - 14)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fbcfe8'
    ctx.beginPath()
    ctx.moveTo(dx * 15, hy - 8)
    ctx.lineTo(dx * 13, hy - 19)
    ctx.lineTo(dx * 7, hy - 13)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = c.fur
  }
  ctx.beginPath()
  ctx.ellipse(0, hy, 21, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // patrón
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, hy, 20, 17, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = c.spot
  if (c.pattern === 'manchas') {
    ctx.beginPath()
    ctx.ellipse(-10, hy - 9, 9, 7, 0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (c.pattern === 'rayas') {
    for (const dx of [-6, 0, 6]) ctx.fillRect(dx - 1.5, hy - 18, 3, 7)
  }
  ctx.restore()
  // carita
  ctx.save()
  ctx.translate(0, hy + 2)
  ctx.scale(0.62, 0.62)
  face(ctx, 0, 0, 1, o.sleep ? 'happy' : o.boost ? 'love' : 'calm', t, c.speed * 10)
  ctx.restore()
  ctx.fillStyle = '#f472b6'
  ctx.beginPath()
  ctx.moveTo(-1.6, hy + 4)
  ctx.lineTo(1.6, hy + 4)
  ctx.lineTo(0, hy + 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(91,42,58,0.5)'
  ctx.lineWidth = 1
  for (const dx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(dx * 9, hy + 5)
    ctx.lineTo(dx * 22, hy + 3)
    ctx.moveTo(dx * 9, hy + 7)
    ctx.lineTo(dx * 21, hy + 9)
    ctx.stroke()
  }
  if (hat) drawHat(ctx, hat, 0, hy, t)
  ctx.restore()
  if (o.sleep) {
    ctx.fillStyle = INK
    ctx.font = `bold ${12 * s}px sans-serif`
    ctx.textAlign = 'center'
    const k = (t * 0.8) % 1
    ctx.globalAlpha = 1 - k
    ctx.fillText('z', x + 18 * s + k * 8, y - 60 * s - k * 14)
    ctx.globalAlpha = 1
  }
}

export function drawHat(ctx: CanvasRenderingContext2D, h: HatId, x: number, y: number, t: number) {
  ctx.save()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  switch (h) {
    case 'mono':
      ctx.fillStyle = '#f472b6'
      for (const dx of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(x + 9, y - 14)
        ctx.lineTo(x + 9 + dx * 9, y - 20)
        ctx.lineTo(x + 9 + dx * 9, y - 8)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(x + 9, y - 14, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    case 'chef':
      ctx.fillStyle = '#ffffff'
      rr(ctx, x - 11, y - 22, 22, 8, 3)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x - 7, y - 27, 7, 0, Math.PI * 2)
      ctx.arc(x + 7, y - 27, 7, 0, Math.PI * 2)
      ctx.arc(x, y - 32, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    case 'boina':
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.ellipse(x - 2, y - 16, 17, 7, -0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillRect(x - 3, y - 26, 3, 5)
      break
    case 'corona':
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.moveTo(x - 11, y - 14)
      ctx.lineTo(x - 11, y - 28)
      ctx.lineTo(x - 5, y - 21)
      ctx.lineTo(x, y - 30)
      ctx.lineTo(x + 5, y - 21)
      ctx.lineTo(x + 11, y - 28)
      ctx.lineTo(x + 11, y - 14)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f472b6'
      ctx.beginPath()
      ctx.arc(x, y - 18, 2.2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'flor':
      ctx.fillStyle = '#fde047'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.5
        ctx.beginPath()
        ctx.arc(x - 12 + Math.cos(a) * 4, y - 14 + Math.sin(a) * 4, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#fb923c'
      ctx.beginPath()
      ctx.arc(x - 12, y - 14, 2.4, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'lentes':
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x - 6, y + 1, 5, 0, Math.PI * 2)
      ctx.moveTo(x + 11, y + 1)
      ctx.arc(x + 6, y + 1, 5, 0, Math.PI * 2)
      ctx.moveTo(x - 1, y + 1)
      ctx.lineTo(x + 1, y + 1)
      ctx.stroke()
      break
    case 'bufanda':
      ctx.fillStyle = '#60a5fa'
      rr(ctx, x - 15, y + 13, 30, 7, 3)
      ctx.fill()
      ctx.stroke()
      rr(ctx, x + 6, y + 15, 7, 14, 3)
      ctx.fill()
      ctx.stroke()
      break
    case 'orejas':
      ctx.fillStyle = '#ffffff'
      for (const dx of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(x + dx * 6, y - 30, 4.5, 12, dx * 0.15, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      break
  }
  ctx.restore()
}

/** Bebida o postre (centro x,y). */
export function drawItem(ctx: CanvasRenderingContext2D, id: ItemId, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 1.8
  ctx.strokeStyle = INK
  const cup = (body: string, top: string) => {
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(-9, -6)
    ctx.lineTo(9, -6)
    ctx.lineTo(7, 8)
    ctx.quadraticCurveTo(0, 11, -7, 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(11, 0, 4, -1.4, 1.4)
    ctx.stroke()
    ctx.fillStyle = top
    ctx.beginPath()
    ctx.ellipse(0, -6, 9, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const tall = (body: string, cream: string) => {
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(-7, -8)
    ctx.lineTo(7, -8)
    ctx.lineTo(5, 12)
    ctx.lineTo(-5, 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = cream
    ctx.beginPath()
    ctx.arc(-3, -9, 4, 0, Math.PI * 2)
    ctx.arc(3, -9, 4, 0, Math.PI * 2)
    ctx.arc(0, -13, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#f472b6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(2, -14)
    ctx.lineTo(7, -22)
    ctx.stroke()
  }
  const slice = (cake: string, top: string) => {
    ctx.fillStyle = cake
    ctx.beginPath()
    ctx.moveTo(-11, 6)
    ctx.lineTo(11, 6)
    ctx.lineTo(4, -8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = top
    ctx.beginPath()
    ctx.moveTo(-11, 6)
    ctx.lineTo(4, -8)
    ctx.lineTo(1, -10)
    ctx.lineTo(-13, 3)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  switch (id) {
    case 'cafe':
      cup('#ffffff', '#6b3a22')
      break
    case 'latte':
      cup('#ffd6e4', '#c89f7a')
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(-1.5, -6.5, 1.6, 0, Math.PI * 2)
      ctx.arc(1.5, -6.5, 1.6, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'capuchino':
      cup('#e0f2fe', '#f5ede4')
      ctx.fillStyle = '#8a5634'
      for (const [a, b] of [[-3, -6], [2, -7], [4, -5]]) ctx.fillRect(a, b, 1.5, 1.5)
      break
    case 'te':
      cup('#fef3c7', '#f9c26b')
      ctx.fillStyle = '#f472b6'
      ctx.beginPath()
      ctx.arc(0, -6, 2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'matcha':
      cup('#ffffff', '#86c57a')
      break
    case 'frappe':
      tall('#c89f7a', '#ffffff')
      break
    case 'smoothie':
      tall('#a78bfa', '#fbcfe8')
      break
    case 'galleta':
      ctx.fillStyle = '#d9a066'
      for (const [a, b] of [[-5, 2], [5, 0], [0, -5]]) {
        ctx.beginPath()
        ctx.arc(a, b, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#5b3420'
      for (const [a, b] of [[-6, 2], [5, -1], [1, -6], [-3, 4]]) ctx.fillRect(a, b, 2, 2)
      break
    case 'panque':
      ctx.fillStyle = '#f472b6'
      ctx.beginPath()
      ctx.moveTo(-8, 0)
      ctx.lineTo(8, 0)
      ctx.lineTo(6, 10)
      ctx.lineTo(-6, 10)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#d9a066'
      ctx.beginPath()
      ctx.arc(0, 0, 9, Math.PI, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'pay':
      slice('#f2c66d', '#ef4444')
      break
    case 'pastel':
      slice('#fff3c4', '#f9a8d4')
      ctx.fillStyle = '#dc2626'
      ctx.beginPath()
      ctx.arc(2, -10, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    case 'tarta':
      slice('#fff6c9', '#f2c66d')
      break
  }
  ctx.restore()
}

/** Estación con carita (máquina, horno...). Centro abajo en (x,y). */
export function drawStation(ctx: CanvasRenderingContext2D, id: StationId, color: string, x: number, y: number, t: number, busy: boolean, progress: number) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  ctx.fillStyle = color
  rr(ctx, x - 34, y - 62, 68, 62, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  rr(ctx, x - 28, y - 56, 14, 26, 6)
  ctx.fill()
  // detalle por estación
  ctx.fillStyle = mix(color, '#5b2a3a', 0.25)
  if (id === 'cafetera') {
    rr(ctx, x - 14, y - 76, 28, 16, 5)
    ctx.fill()
    ctx.stroke()
  } else if (id === 'horno') {
    ctx.fillStyle = busy ? '#fb923c' : '#7c2d12'
    rr(ctx, x - 22, y - 50, 44, 26, 6)
    ctx.fill()
    ctx.stroke()
  } else if (id === 'tetera') {
    ctx.beginPath()
    ctx.arc(x, y - 66, 10, Math.PI, 0)
    ctx.fill()
    ctx.stroke()
  } else if (id === 'licuadora') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    rr(ctx, x - 12, y - 92, 24, 32, 6)
    ctx.fill()
    ctx.stroke()
    if (busy) {
      ctx.fillStyle = '#c4b5fd'
      rr(ctx, x - 10, y - 80 + Math.sin(t * 30) * 2, 20, 18, 5)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = 'rgba(224,242,254,0.85)'
    rr(ctx, x - 26, y - 92, 52, 32, 8)
    ctx.fill()
    ctx.stroke()
  }
  // carita
  ctx.save()
  ctx.translate(x, y - 20)
  ctx.scale(0.7, 0.7)
  face(ctx, 0, 0, 1, busy ? 'wow' : 'happy', t, x)
  ctx.restore()
  // vapor al trabajar
  if (busy) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    for (const dx of [-8, 8]) {
      ctx.beginPath()
      for (let k = 0; k < 8; k++) ctx.lineTo(x + dx + Math.sin(t * 4 + k * 0.8 + dx) * 3, y - 64 - k * 3)
      ctx.stroke()
    }
  }
  // barra de progreso
  if (progress > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    rr(ctx, x - 26, y + 4, 52, 8, 4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#4ade80'
    rr(ctx, x - 25, y + 5, 50 * Math.min(1, progress), 6, 3)
    ctx.fill()
  }
  ctx.restore()
}

export function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number, outdoor: boolean) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  if (outdoor) {
    // sombrilla a un lado, para no tapar al cliente
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 50, y - 64, 3, 70)
    ctx.strokeRect(x + 50, y - 64, 3, 70)
  }
  ctx.fillStyle = 'rgba(91,42,58,0.15)'
  ctx.beginPath()
  ctx.ellipse(x + 3, y + 22, 40, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = outdoor ? '#ffffff' : '#e8b98a'
  ctx.beginPath()
  ctx.ellipse(x, y, 40, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = outdoor ? '#e5e7eb' : '#d39a68'
  rr(ctx, x - 5, y + 12, 10, 14, 3)
  ctx.fill()
  ctx.stroke()
  if (outdoor) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f472b6'
      ctx.beginPath()
      ctx.moveTo(x + 51, y - 64)
      ctx.arc(x + 51, y - 60, 30, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

export function drawCoins(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, t: number) {
  const k = Math.min(5, Math.max(1, Math.ceil(n / 15)))
  for (let i = 0; i < k; i++) {
    const cx = x - (k - 1) * 5 + i * 10
    const cy = y - 4 - Math.abs(Math.sin(t * 4 + i)) * 3
    ctx.fillStyle = '#facc15'
    ctx.strokeStyle = '#a16207'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff7ad'
    ctx.fillRect(cx - 1, cy - 3, 2, 4)
  }
}
