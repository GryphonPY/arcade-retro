/**
 * Dibujo kawaii de "Pastelería en Pareja" sobre canvas 2D. Recibe el estado de
 * logic.ts y no cambia nada. Los textos del canvas van en mayúsculas y sin acentos.
 */
import { rr } from '../game-utils'
import { ANIMALS, ING_LABEL, RECIPES, type Animal, type Side } from './data'
import type { Cust, Game, Item, Piece, Spot } from './logic'

const INK = '#5b3a4a'
const CREAM = '#fff7ed'
const WOOD = '#e0a86e'
const WOOD_DK = '#b06b3c'
const SKIN = '#fcd9b6'
export const PLAYER_COLOR: [string, string] = ['#f472b6', '#38bdf8']

function card(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string, r = 10) {
  rr(ctx, cx - w / 2, cy - h / 2, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
}

/** Tablilla de madera con el nombre del puesto. */
function plank(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, s: string, pf: string) {
  rr(ctx, cx - w / 2, cy - 6, w, 12, 4)
  ctx.fillStyle = WOOD
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = INK
  ctx.stroke()
  label(ctx, s, cx, cy, pf, 5.5)
}

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, pf: string, size = 7, color = INK) {
  ctx.font = `${size}px ${pf}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.4)
  ctx.bezierCurveTo(x - s * 0.7, y - s * 0.1, x - s * 0.55, y - s * 0.75, x, y - s * 0.3)
  ctx.bezierCurveTo(x + s * 0.55, y - s * 0.75, x + s * 0.7, y - s * 0.1, x, y + s * 0.4)
  ctx.closePath()
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  heartPath(ctx, x, y, s)
  ctx.fillStyle = color
  ctx.fill()
}

/** Corazón que se vacía de abajo hacia arriba según `frac` (0..1). */
function drainHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frac: number) {
  ctx.save()
  heartPath(ctx, x, y, s)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.clip()
  const top = y + s * 0.4 - frac * s * 1.1
  ctx.fillStyle = frac < 0.3 ? '#fb923c' : '#f472b6'
  ctx.fillRect(x - s, top, s * 2, s * 1.4)
  ctx.restore()
  heartPath(ctx, x, y, s)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = INK
  ctx.stroke()
}

/** Ingrediente como icono pequeño centrado en (x, y); `s` escala (1 = ~16 px de radio). */
export function ingIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  switch (id) {
    case 'harina': // costal de tela con moño
      ctx.beginPath()
      ctx.moveTo(-8, -7)
      ctx.quadraticCurveTo(-13, 2, -11, 12)
      ctx.lineTo(11, 12)
      ctx.quadraticCurveTo(13, 2, 8, -7)
      ctx.closePath()
      ctx.fillStyle = '#fef3c7'
      ctx.fill()
      ctx.stroke()
      rr(ctx, -6, -11, 12, 6, 3)
      ctx.fillStyle = '#c4b5fd'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 2, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#fb7185'
      ctx.fill()
      break
    case 'huevo': // canasta con tres huevos
      for (const [ex, ey] of [[-6, -6], [6, -6], [0, -10]]) {
        ctx.beginPath()
        ctx.ellipse(ex, ey, 5.5, 7, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(0, 1, 13, 0, Math.PI)
      ctx.closePath()
      ctx.fillStyle = WOOD_DK
      ctx.fill()
      ctx.stroke()
      break
    case 'azucar': // frasco de vidrio con cubitos
      rr(ctx, -9, -8, 18, 20, 5)
      ctx.fillStyle = '#e0f2fe'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      for (const [dx, dy] of [[-4, -2], [3, -3], [0, 4], [4, 5]]) ctx.fillRect(dx - 2.5, dy - 2.5, 5, 5)
      rr(ctx, -10, -13, 20, 6, 2)
      ctx.fillStyle = '#fb7185'
      ctx.fill()
      ctx.stroke()
      break
    case 'leche': // cartón de leche
      ctx.beginPath()
      ctx.moveTo(-9, -7)
      ctx.lineTo(-9, 12)
      ctx.lineTo(9, 12)
      ctx.lineTo(9, -7)
      ctx.lineTo(4, -12)
      ctx.lineTo(-4, -12)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#93c5fd'
      ctx.fillRect(-9, -1, 18, 7)
      break
    case 'mantequilla': // barra amarilla con envoltura
      rr(ctx, -12, -7, 24, 14, 4)
      ctx.fillStyle = '#fde047'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fef9c3'
      ctx.fillRect(-12, -2, 24, 2)
      break
    case 'chocolate': // tableta
      rr(ctx, -10, -11, 20, 22, 3)
      ctx.fillStyle = '#92400e'
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#fde8c8'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-10, 0)
      ctx.lineTo(10, 0)
      ctx.moveTo(0, -11)
      ctx.lineTo(0, 11)
      ctx.stroke()
      break
    case 'crema': // manga pastelera con betún
      ctx.beginPath()
      ctx.moveTo(-8, -10)
      ctx.lineTo(8, -10)
      ctx.lineTo(2, 12)
      ctx.lineTo(-2, 12)
      ctx.closePath()
      ctx.fillStyle = '#fbcfe8'
      ctx.fill()
      ctx.stroke()
      rr(ctx, -9, -14, 18, 6, 3)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      break
    case 'fresa': // fresa con hoja
      ctx.beginPath()
      ctx.moveTo(0, 12)
      ctx.quadraticCurveTo(-12, 0, -8, -6)
      ctx.quadraticCurveTo(0, -8, 8, -6)
      ctx.quadraticCurveTo(12, 0, 0, 12)
      ctx.fillStyle = '#f43f5e'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(-7, -9, 14, 4)
      break
    case 'glase': // frasco de glaseado rosa
      rr(ctx, -7, -7, 14, 18, 4)
      ctx.fillStyle = '#f9a8d4'
      ctx.fill()
      ctx.stroke()
      rr(ctx, -8, -11, 16, 5, 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      break
    case 'chispas': // frasquito de chispas
      rr(ctx, -8, -8, 16, 18, 5)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      for (const [dx, dy, c] of [
        [-4, -3, '#f472b6'],
        [3, -4, '#38bdf8'],
        [0, 2, '#fde047'],
        [-3, 5, '#4ade80'],
        [4, 4, '#c4b5fd'],
      ] as [number, number, string][]) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(dx, dy, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
      break
  }
  ctx.restore()
}

/** Pastel (o pieza en proceso) centrado en (x, y); `s` escala. */
export function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, x: number, y: number, s: number) {
  const R = RECIPES[p.rid]
  const ph = p.phase
  const base =
    ph === 'masa' ? '#fef9c3' : ph === 'quemado' ? '#78350f' : ph === 'horno' || ph === 'listo' ? '#f5b041' : R.color
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.fillStyle = base
  switch (p.rid) {
    case 'galleta':
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (ph !== 'masa') {
        ctx.fillStyle = '#b45309'
        for (const [dx, dy] of [[-6, -4], [5, -5], [0, 5], [6, 4]]) ctx.fillRect(dx - 1.5, dy - 1.5, 3, 3)
      }
      break
    case 'cupcake':
      ctx.fillStyle = '#d97706'
      ctx.beginPath()
      ctx.moveTo(-14, 2)
      ctx.lineTo(14, 2)
      ctx.lineTo(9, 16)
      ctx.lineTo(-9, 16)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = base
      ctx.beginPath()
      ctx.ellipse(0, 0, 16, 11, 0, Math.PI, 0)
      ctx.fill()
      ctx.stroke()
      break
    case 'dona':
      ctx.beginPath()
      ctx.arc(0, 0, 17, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = CREAM
      ctx.beginPath()
      ctx.arc(0, 0, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    case 'macaron':
      ctx.fillStyle = base
      ctx.beginPath()
      ctx.ellipse(0, -6, 15, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(0, 7, 15, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fff7ed'
      ctx.fillRect(-10, -1, 20, 6)
      break
    case 'pastel':
      rr(ctx, -16, -6, 32, 20, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = ph === 'masa' ? '#fef9c3' : '#fecdd3'
      rr(ctx, -16, -12, 32, 8, 4)
      ctx.fill()
      ctx.stroke()
      break
  }
  // cobertura según lo aplicado en la tabla de decorar
  if (ph !== 'masa' && ph !== 'quemado') {
    if (p.deco.includes('glase')) {
      ctx.fillStyle = '#f9a8d4'
      ctx.beginPath()
      ctx.ellipse(0, -2, 15, 9, 0, Math.PI, 0)
      ctx.fill()
    }
    if (p.deco.includes('crema')) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(-6, -8, 4, 0, Math.PI * 2)
      ctx.arc(4, -10, 4.5, 0, Math.PI * 2)
      ctx.arc(0, -4, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    if (p.deco.includes('fresa')) {
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(-3, -14, 3.5, 0, Math.PI * 2)
      ctx.arc(5, -15, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (p.deco.includes('chispas')) {
      const cols = ['#f472b6', '#38bdf8', '#fde047', '#4ade80']
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i % 4]
        ctx.fillRect(-10 + ((i * 7) % 20) - 2, -6 + ((i * 5) % 10) - 1, 3, 3)
      }
    }
  }
  if (ph === 'caja') {
    // moño rosa de la caja
    ctx.fillStyle = '#fb7185'
    ctx.beginPath()
    ctx.moveTo(0, -2)
    ctx.lineTo(-8, -8)
    ctx.lineTo(-8, 4)
    ctx.closePath()
    ctx.moveTo(0, -2)
    ctx.lineTo(8, -8)
    ctx.lineTo(8, 4)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawItem(ctx: CanvasRenderingContext2D, it: Item, x: number, y: number, s: number) {
  if (it.k === 'i') ingIcon(ctx, it.id, x, y, s)
  else drawPiece(ctx, it.p, x, y, s)
}

function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal, cx: number, cy: number, r: number, happy: boolean) {
  const color = ANIMALS.find((x) => x.id === a)!.color
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  // orejas
  ctx.fillStyle = color
  if (a === 'conejo') {
    for (const dx of [-r * 0.45, r * 0.45]) {
      ctx.beginPath()
      ctx.ellipse(cx + dx, cy - r * 1.05, r * 0.3, r * 0.75, dx < 0 ? -0.15 : 0.15, 0, Math.PI * 2)
      ctx.fillStyle = dx < 0 ? color : '#fbcfe8'
      ctx.fill()
      ctx.stroke()
    }
  } else if (a === 'gato') {
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx * r * 0.2, cy - r * 0.5)
      ctx.lineTo(cx + dx * r * 0.85, cy - r * 1.2)
      ctx.lineTo(cx + dx * r * 0.9, cy - r * 0.2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else {
    const ro = a === 'oso' ? 0.42 : 0.36
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx + dx * r * 0.75, cy - r * 0.7, r * ro, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  // cabeza
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (a === 'cerdo') {
    ctx.fillStyle = '#fbcfe8'
    ctx.beginPath()
    ctx.ellipse(cx, cy + r * 0.25, r * 0.36, r * 0.27, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  if (a === 'gato') {
    // bigotes
    ctx.lineWidth = 1.2
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx * r * 0.6, cy + r * 0.3)
      ctx.lineTo(cx + dx * r * 1.0, cy + r * 0.2)
      ctx.moveTo(cx + dx * r * 0.6, cy + r * 0.42)
      ctx.lineTo(cx + dx * r * 1.0, cy + r * 0.5)
      ctx.stroke()
    }
    ctx.lineWidth = 2
  }
  // mejillas y ojos
  ctx.fillStyle = 'rgba(244,114,182,0.7)'
  for (const dx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(cx + dx * r * 0.5, cy + r * 0.2, r * 0.17, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  for (const dx of [-1, 1]) {
    const ex = cx + dx * r * 0.32
    const ey = cy - r * 0.1
    if (happy) {
      ctx.beginPath()
      ctx.arc(ex, ey + 2, r * 0.13, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(ex, ey, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // boquita
  ctx.beginPath()
  if (happy) ctx.arc(cx, cy + r * 0.3, r * 0.2, 0.1, Math.PI - 0.1)
  else ctx.arc(cx, cy + r * 0.55, r * 0.14, Math.PI + 0.3, Math.PI * 2 - 0.3)
  ctx.stroke()
}

/** Ventanilla con el animalito asomado, su globo de pedido y el corazón de paciencia. */
function drawCust(ctx: CanvasRenderingContext2D, cu: Cust, sp: Spot, t: number) {
  const fade = cu.state === 'wait' ? 1 : Math.max(0, 1 - cu.age / 1.1)
  const dxLeave = cu.state === 'bye' ? cu.age * 60 : 0
  const bounce = cu.state === 'ok' ? Math.abs(Math.sin(cu.age * 9)) * -8 : Math.sin(t * 3 + cu.id) * 1.5
  const top = sp.y - sp.h / 2
  const sill = sp.y + sp.h / 2 - 12
  ctx.save()
  ctx.globalAlpha = fade
  // el animalito solo se ve arriba de la repisa de la ventanilla
  ctx.beginPath()
  ctx.rect(sp.x - sp.w / 2, top, sp.w, sill - top)
  ctx.clip()
  drawAnimal(ctx, cu.animal, sp.x - 8 + dxLeave, sp.y + 6 + bounce, 22, cu.state !== 'bye' && cu.t > cu.max * 0.3)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = fade
  // repisa de madera
  rr(ctx, sp.x - sp.w / 2 + 2, sill, sp.w - 4, 12, 4)
  ctx.fillStyle = WOOD
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
  // globo con el pastelito que quiere
  const bx = sp.x + 24
  const by = sp.y - 22
  if (cu.state === 'wait') {
    ctx.beginPath()
    ctx.moveTo(bx - 8, by + 14)
    ctx.lineTo(bx - 14, by + 22)
    ctx.lineTo(bx - 2, by + 16)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.stroke()
    rr(ctx, bx - 18, by - 16, 36, 32, 12)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.stroke()
    const R = RECIPES[cu.rid]
    const piece: Piece = { rid: cu.rid, phase: 'decor', left: 0, burnT: 0, deco: [...R.deco] }
    drawPiece(ctx, piece, bx, by, 0.6)
    drainHeart(ctx, sp.x + 26, sp.y + 14, 12, Math.max(0, cu.t) / cu.max)
  } else if (cu.state === 'ok') {
    for (let i = 0; i < 3; i++) {
      const k = cu.age * 40 + i * 12
      ctx.globalAlpha = fade * 0.9
      heart(ctx, sp.x - 14 + i * 16, sp.y - 20 - k, 10, '#f472b6')
    }
  }
  ctx.restore()
}

/** Plato del mostrador: el pedido en curso o un plato vacío. */
function drawCounterSlot(ctx: CanvasRenderingContext2D, sp: Spot, it: Item | null) {
  ctx.beginPath()
  ctx.ellipse(sp.x, sp.y + 2, 23, 11, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(91,58,74,0.5)'
  ctx.stroke()
  if (it) drawItem(ctx, it, sp.x, sp.y - 2, 0.95)
}

/** Repisa de madera con el frasco o costal del ingrediente. */
function drawShelf(ctx: CanvasRenderingContext2D, sp: Spot, pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 4, sp.h - 2, '#fff7ed', 10)
  // estante de madera debajo del ingrediente
  rr(ctx, sp.x - sp.w / 2 + 3, sp.y + 4, sp.w - 10, 8, 3)
  ctx.fillStyle = WOOD
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = INK
  ctx.stroke()
  ingIcon(ctx, sp.ing!, sp.x, sp.y - 6, 1)
  plank(ctx, sp.x, sp.y + sp.h / 2 - 12, sp.w - 14, ING_LABEL[sp.ing!], pf)
}

/** Tazón de mezclar con batidor. Los ingredientes se ven dentro. */
function drawBowl(ctx: CanvasRenderingContext2D, sp: Spot, items: string[], pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 4, sp.h - 2, '#e0f2fe', 10)
  const y = sp.y - 8
  // batidor
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.beginPath()
  ctx.moveTo(sp.x + 16, y - 20)
  ctx.lineTo(sp.x + 22, y + 4)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(sp.x + 22, y - 6, 3, 8, 0.25, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()
  // tazón: mitad inferior de metal
  ctx.beginPath()
  ctx.arc(sp.x, y, 22, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#cbd5e1'
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(sp.x, y, 22, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = items.length ? '#fef3c7' : '#f8fafc'
  ctx.fill()
  ctx.stroke()
  items.forEach((id, i) => ingIcon(ctx, id, sp.x - 12 + (i % 4) * 8, y - 1, 0.36))
  plank(ctx, sp.x, sp.y + sp.h / 2 - 12, sp.w - 14, 'MEZCLA', pf)
}

/** Horno con ventanita, luz y temporizador. */
function drawOven(ctx: CanvasRenderingContext2D, sp: Spot, p: Piece | null, t: number, pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 4, sp.h - 2, '#fecdd3', 10)
  const hot = p?.phase === 'horno'
  const burnt = p?.phase === 'quemado'
  // perilla y temporizador
  ctx.fillStyle = '#ffffff'
  for (const dx of [-14, 14]) {
    ctx.beginPath()
    ctx.arc(sp.x + dx, sp.y - 26, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(sp.x, sp.y - 26, 5.5, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()
  if (hot && p) {
    const frac = 1 - p.left / RECIPES[p.rid].bake
    ctx.beginPath()
    ctx.moveTo(sp.x, sp.y - 26)
    ctx.arc(sp.x, sp.y - 26, 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = '#fb7185'
    ctx.fill()
  }
  // ventanita con luz
  rr(ctx, sp.x - 16, sp.y - 18, 32, 24, 6)
  ctx.fillStyle = hot ? `rgba(251,146,60,${0.7 + 0.3 * Math.sin(t * 6)})` : burnt ? '#78350f' : '#7c2d12'
  ctx.fill()
  ctx.stroke()
  if (p) drawPiece(ctx, p, sp.x, sp.y - 6, 0.5)
  if (hot && p) {
    const frac = 1 - p.left / RECIPES[p.rid].bake
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sp.x - 14, sp.y + 9, 28, 3)
    ctx.fillStyle = '#fb923c'
    ctx.fillRect(sp.x - 14, sp.y + 9, 28 * frac, 3)
  }
  if (burnt) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 30 + i * 13) % 34
      ctx.globalAlpha = Math.max(0, 1 - k / 34) * 0.7
      ctx.fillStyle = '#e5e7eb'
      ctx.beginPath()
      ctx.arc(sp.x - 8 + i * 8, sp.y - 24 - k, 4 + (i % 2), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  plank(ctx, sp.x, sp.y + sp.h / 2 - 12, sp.w - 14, 'HORNO', pf)
}

/** Mesa de decorar: plato giratorio y mangas de betún. */
function drawDeco(ctx: CanvasRenderingContext2D, sp: Spot, p: Piece | null, pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 4, sp.h - 2, '#d1fae5', 10)
  ctx.beginPath()
  ctx.ellipse(sp.x - 2, sp.y + 4, 21, 7, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()
  if (p) drawPiece(ctx, p, sp.x - 2, sp.y - 4, 0.62)
  // mangas de betún
  for (const [dx, col] of [[18, '#f472b6'], [26, '#38bdf8']] as [number, string][]) {
    ctx.beginPath()
    ctx.moveTo(sp.x + dx - 5, sp.y - 16)
    ctx.lineTo(sp.x + dx + 5, sp.y - 16)
    ctx.lineTo(sp.x + dx, sp.y + 6)
    ctx.closePath()
    ctx.fillStyle = col
    ctx.fill()
    ctx.stroke()
  }
  plank(ctx, sp.x, sp.y + sp.h / 2 - 12, sp.w - 14, 'DECORAR', pf)
}

/** Caja de regalo con moño. */
function drawBox(ctx: CanvasRenderingContext2D, sp: Spot, pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 4, sp.h - 2, '#fce7f3', 10)
  rr(ctx, sp.x - 16, sp.y - 4, 32, 22, 3)
  ctx.fillStyle = '#fda4af'
  ctx.fill()
  ctx.stroke()
  rr(ctx, sp.x - 19, sp.y - 11, 38, 9, 3)
  ctx.fillStyle = '#fb7185'
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(sp.x - 2.5, sp.y - 11, 5, 29)
  for (const dx of [-7, 7]) {
    ctx.beginPath()
    ctx.ellipse(sp.x + dx, sp.y - 16, 6, 4, dx < 0 ? -0.4 : 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#fb7185'
    ctx.fill()
    ctx.stroke()
  }
  plank(ctx, sp.x, sp.y + sp.h / 2 - 12, sp.w - 14, 'CAJA', pf)
}

/** Estantes, estaciones, mostrador y clientes. */
export function drawKitchen(ctx: CanvasRenderingContext2D, g: Game, t: number, pf: string) {
  for (const sp of g.spots) {
    const side = sp.side === -1 ? 0 : sp.side
    switch (sp.kind) {
      case 'shelf':
        drawShelf(ctx, sp, pf)
        break
      case 'bowl':
        drawBowl(ctx, sp, g.bowl[side as Side], pf)
        break
      case 'oven':
        drawOven(ctx, sp, g.oven[side as Side], t, pf)
        break
      case 'deco':
        drawDeco(ctx, sp, g.deco[side as Side], pf)
        break
      case 'box':
        drawBox(ctx, sp, pf)
        break
      case 'counter':
        drawCounterSlot(ctx, sp, g.counter[sp.i!])
        break
      case 'cust': {
        const cu = g.custs[sp.i!]
        card(ctx, sp.x, sp.y, sp.w - 6, sp.h - 2, cu ? '#e0f2fe' : 'rgba(255,255,255,0.45)', 16)
        if (cu) drawCust(ctx, cu, sp, t)
        else {
          // ventanilla vacía con su repisa
          rr(ctx, sp.x - sp.w / 2 + 2, sp.y + sp.h / 2 - 12, sp.w - 4, 12, 4)
          ctx.fillStyle = WOOD
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = INK
          ctx.stroke()
        }
        break
      }
    }
  }
}

/** Mostrador central de madera con mantel de cuadritos y festón. */
export function drawCounterBand(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const h = H * 0.13
  const y = H * 0.5 - h / 2
  rr(ctx, 2, y, W - 4, h, 12)
  ctx.fillStyle = WOOD
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
  // vetas de la madera
  ctx.strokeStyle = 'rgba(176,107,60,0.45)'
  ctx.lineWidth = 1
  for (let yy = y + 5; yy < y + h; yy += 7) {
    ctx.beginPath()
    ctx.moveTo(8, yy)
    ctx.lineTo(W - 8, yy + 1)
    ctx.stroke()
  }
  // mantel rosa con cuadritos
  ctx.save()
  rr(ctx, 8, y + 7, W - 16, h - 14, 6)
  ctx.clip()
  ctx.fillStyle = '#fff1f7'
  ctx.fillRect(8, y + 7, W - 16, h - 14)
  ctx.fillStyle = 'rgba(244,114,182,0.28)'
  for (let x = 8; x < W - 8; x += 14) ctx.fillRect(x, y + 7, 6, h - 14)
  for (let yy = y + 7; yy < y + h - 7; yy += 14) ctx.fillRect(8, yy, W - 16, 6)
  ctx.restore()
  // festones del mantel
  ctx.fillStyle = '#fff1f7'
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.2
  for (let x = 16; x < W - 10; x += 18) {
    ctx.beginPath()
    ctx.arc(x, y + h - 6, 8, 0, Math.PI)
    ctx.fill()
    ctx.stroke()
  }
}

/** Piso de azulejos pastel, pared empapelada y guirnalda. */
export function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#fdf2f8')
  g.addColorStop(1, '#e8f7ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // azulejos: cuadros alternados
  const T = 40
  for (let y = 0; y < H; y += T) {
    for (let x = (Math.floor(y / T) % 2) * T * 0.5 - T; x < W; x += T) {
      ctx.fillStyle = (Math.floor(x / T) + Math.floor(y / T)) % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(186,230,253,0.22)'
      rr(ctx, x + 2, y + 2, T - 4, T - 4, 6)
      ctx.fill()
    }
  }
  // pared de papel tapiz con puntitos y festón
  const wallH = H * 0.075
  ctx.fillStyle = '#ffe4ef'
  ctx.fillRect(0, 0, W, wallH)
  ctx.fillStyle = '#fbcfe8'
  for (let x = 10; x < W; x += 22) {
    for (let y = 10; y < wallH - 4; y += 22) {
      ctx.beginPath()
      ctx.arc(x + ((y / 22) % 2) * 11, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#f9a8d4'
  for (let x = 0; x < W + 20; x += 20) {
    ctx.beginPath()
    ctx.arc(x, wallH, 10, 0, Math.PI)
    ctx.fill()
  }
  // guirnalda de banderines
  const cols = ['#f472b6', '#38bdf8', '#fde047', '#4ade80', '#c4b5fd']
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 2)
  ctx.quadraticCurveTo(W / 2, 22, W, 2)
  ctx.stroke()
  const n = 9
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const x = W * u
    const yy = 2 + 40 * u * (1 - u)
    ctx.beginPath()
    ctx.moveTo(x - 6, yy)
    ctx.lineTo(x + 6, yy)
    ctx.lineTo(x, yy + 11)
    ctx.closePath()
    ctx.fillStyle = cols[i % cols.length]
    ctx.fill()
  }
  // corazoncitos flotando
  for (let i = 0; i < 6; i++) {
    const x = ((i * 97.3 + t * 12) % (W + 40)) - 20
    const y = H * (0.3 + ((i * 0.37) % 0.6))
    ctx.globalAlpha = 0.14
    heart(ctx, x, y, 10, '#f472b6')
  }
  ctx.globalAlpha = 1
}

/** Cursor de teclado (contorno pulsante) sobre el puesto señalado. */
export function drawCursor(ctx: CanvasRenderingContext2D, sp: Spot, color: string, t: number) {
  ctx.save()
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 6)
  rr(ctx, sp.x - sp.w / 2 - 3, sp.y - sp.h / 2 - 3, sp.w + 6, sp.h + 6, 14)
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.restore()
}

/** Cocinerito chibi: gorro de chef, delantal y brazos. Pies en (0, 0); mira a la derecha. */
function drawChef(ctx: CanvasRenderingContext2D, apron: string, t: number, moving: boolean) {
  const step = moving ? Math.sin(t * 18) * 2 : 0
  ctx.lineWidth = 1.6
  ctx.strokeStyle = INK
  // sombra
  ctx.globalAlpha = 0.18
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(0, 1, 13, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // piernas y zapatitos
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(-4 + step, -1, 4, 2.4, 0, 0, Math.PI * 2)
  ctx.ellipse(4 - step, -1, 4, 2.4, 0, 0, Math.PI * 2)
  ctx.fill()
  // camisa blanca y delantal
  ctx.fillStyle = '#ffffff'
  rr(ctx, -10, -26, 20, 24, 7)
  ctx.fill()
  ctx.stroke()
  rr(ctx, -8, -19, 16, 17, 5)
  ctx.fillStyle = apron
  ctx.fill()
  ctx.stroke()
  // bolsillito del delantal
  rr(ctx, -4, -13, 8, 5, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fill()
  // brazos
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.ellipse(-12, -15 - step * 0.5, 3.6, 6, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // cabeza
  ctx.beginPath()
  ctx.arc(0, -34, 11.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // gorro de chef: pompón y banda
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(-6.5, -47, 6, 0, Math.PI * 2)
  ctx.arc(0, -51, 7, 0, Math.PI * 2)
  ctx.arc(6.5, -47, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  rr(ctx, -9.5, -46, 19, 9, 3)
  ctx.fill()
  ctx.stroke()
  // carita
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(-4.2, -33, 1.7, 0, Math.PI * 2)
  ctx.arc(4.2, -33, 1.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -29.5, 2.2, 0.2, Math.PI - 0.2)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.lineWidth = 1.6
  ctx.fillStyle = 'rgba(244,114,182,0.6)'
  for (const dx of [-7.5, 7.5]) {
    ctx.beginPath()
    ctx.arc(dx, -30, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  // brazo de enfrente (el que sostiene)
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.ellipse(12, -16 + step * 0.5, 3.6, 6, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

/**
 * Cocineritos de cada jugador: se deslizan hacia el puesto que señalan (teclado o
 * último toque) y llevan en la mano lo que sostienen.
 */
export class Chefs {
  private px: [number, number] = [0, 0]
  private py: [number, number] = [0, 0]
  private face: [number, number] = [1, 1]
  private moving: [boolean, boolean] = [false, false]
  private ready = false

  update(dt: number, g: Game, W: number, H: number, focus: [number, number]) {
    for (const s of [0, 1] as const) {
      const sp = g.spots[focus[s]]
      let tx = W * 0.5
      let ty = s === 0 ? H * 0.74 : H * 0.26
      if (sp) {
        tx = sp.x
        ty = chefFeetY(sp, H)
      }
      if (!this.ready) {
        this.px[s] = tx
        this.py[s] = ty
      }
      const k = Math.min(1, dt * 7)
      const dx = tx - this.px[s]
      const dy = ty - this.py[s]
      this.moving[s] = Math.hypot(dx, dy) > 2
      if (Math.abs(dx) > 1) this.face[s] = dx > 0 ? 1 : -1
      this.px[s] += dx * k
      this.py[s] += dy * k
    }
    this.ready = true
  }

  draw(ctx: CanvasRenderingContext2D, s: 0 | 1, it: Item | null, t: number) {
    const x = this.px[s]
    const y = this.py[s] + Math.sin(t * 3 + s) * (this.moving[s] ? 0 : 0.8)
    const f = this.face[s]
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(f * CHEF_K, CHEF_K)
    drawChef(ctx, PLAYER_COLOR[s], t, this.moving[s])
    ctx.restore()
    if (it) {
      ctx.save()
      drawItem(ctx, it, x + f * 24, y - 22, 0.85)
      ctx.restore()
    }
  }
}

/** Escala del cocinerito y su altura total (de los pies a la punta del gorro). */
const CHEF_K = 0.92
const CHEF_H = 58 * CHEF_K

/**
 * Dónde se paran los pies del cocinerito al señalar un puesto. Siempre va en el hueco
 * entre filas (debajo del puesto), así no tapa tablillas, etiquetas ni ingredientes.
 * El mostrador se señala desde el hueco de abajo, que es la pasarela compartida.
 */
function chefFeetY(sp: Spot, H: number): number {
  // grande y al frente del puesto (lo tapa un poco, como en Overcooked)
  if (sp.kind === 'counter') return H * 0.565 + CHEF_H * 0.75
  return sp.y + sp.h / 2 + CHEF_H * 0.82
}
