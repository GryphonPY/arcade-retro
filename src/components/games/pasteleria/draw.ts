/**
 * Dibujo kawaii de "Pastelería en Pareja" sobre canvas 2D. Recibe el estado de
 * logic.ts y no cambia nada. Los textos del canvas van en mayúsculas y sin acentos.
 */
import { rr } from '../game-utils'
import { ANIMALS, ING_LABEL, RECIPES, type Animal, type Side } from './data'
import type { Cust, Game, Item, Piece, Spot } from './logic'

const INK = '#5b3a4a'
const CREAM = '#fff7ed'
export const PLAYER_COLOR: [string, string] = ['#f472b6', '#38bdf8']

function card(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string, r = 10) {
  rr(ctx, cx - w / 2, cy - h / 2, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
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
    case 'harina': // costal con moño
      rr(ctx, -11, -8, 22, 22, 6)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#c4b5fd'
      ctx.fillRect(-4, -12, 8, 5)
      break
    case 'huevo': // huevo con brillo
      ctx.beginPath()
      ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.arc(0, 1, 2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'azucar': // cristales
      ctx.fillStyle = '#ffffff'
      for (const [dx, dy] of [[-6, -4], [4, -6], [0, 4], [6, 5]]) {
        ctx.fillRect(dx - 4, dy - 4, 8, 8)
        ctx.strokeRect(dx - 4, dy - 4, 8, 8)
      }
      break
    case 'leche': // cartón
      rr(ctx, -9, -8, 18, 20, 3)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#93c5fd'
      ctx.fillRect(-9, -2, 18, 6)
      break
    case 'mantequilla': // barra amarilla
      rr(ctx, -12, -7, 24, 14, 4)
      ctx.fillStyle = '#fde047'
      ctx.fill()
      ctx.stroke()
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
    case 'crema': // manga de crema
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(-5, 3, 6, 0, Math.PI * 2)
      ctx.arc(5, 3, 6, 0, Math.PI * 2)
      ctx.arc(0, -4, 7, 0, Math.PI * 2)
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
    case 'glase': // frasco rosa
      rr(ctx, -6, -6, 12, 16, 3)
      ctx.fillStyle = '#f9a8d4'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-6, -10, 12, 5)
      break
    case 'chispas': // chispas de colores
      for (const [dx, dy, c] of [
        [-6, -4, '#f472b6'],
        [4, -6, '#38bdf8'],
        [0, 3, '#fde047'],
        [-5, 6, '#4ade80'],
        [6, 5, '#c4b5fd'],
      ] as [number, number, string][]) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(dx, dy, 2.6, 0, Math.PI * 2)
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

function drawCust(ctx: CanvasRenderingContext2D, cu: Cust, sp: Spot, t: number) {
  const fade = cu.state === 'wait' ? 1 : Math.max(0, 1 - cu.age / 1.1)
  const dxLeave = cu.state === 'bye' ? cu.age * 40 : 0
  const bounce = cu.state === 'ok' ? Math.abs(Math.sin(cu.age * 9)) * -8 : Math.sin(t * 3 + cu.id) * 1.5
  const ax = sp.x - 16 + dxLeave
  const ay = sp.y + 8 + bounce
  ctx.save()
  ctx.globalAlpha = fade
  drawAnimal(ctx, cu.animal, ax, ay, 15, cu.state !== 'bye' && cu.t > cu.max * 0.3)
  // globo con el pastelito que quiere
  const bx = sp.x + 22
  const by = sp.y - 14
  ctx.beginPath()
  ctx.fillStyle = '#ffffff'
  rr(ctx, bx - 17, by - 15, 34, 30, 10)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
  if (cu.state === 'wait') {
    const R = RECIPES[cu.rid]
    const piece: Piece = { rid: cu.rid, phase: 'decor', left: 0, burnT: 0, deco: [...R.deco] }
    drawPiece(ctx, piece, bx, by, 0.55)
    drainHeart(ctx, sp.x + 24, sp.y + 26, 12, Math.max(0, cu.t) / cu.max)
  } else if (cu.state === 'ok') {
    for (let i = 0; i < 3; i++) {
      const k = cu.age * 40 + i * 12
      ctx.globalAlpha = fade * 0.9
      heart(ctx, sp.x - 10 + i * 14, sp.y - 22 - k, 9, '#f472b6')
    }
  }
  ctx.restore()
}

function drawCounterSlot(ctx: CanvasRenderingContext2D, sp: Spot, it: Item | null) {
  ctx.beginPath()
  ctx.ellipse(sp.x, sp.y, 22, 12, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(91,58,74,0.5)'
  ctx.stroke()
  if (it) drawItem(ctx, it, sp.x, sp.y - 2, 0.9)
}

function drawShelf(ctx: CanvasRenderingContext2D, sp: Spot, pf: string) {
  card(ctx, sp.x, sp.y, sp.w - 6, sp.h - 4, '#ffffff', 10)
  ingIcon(ctx, sp.ing!, sp.x, sp.y - 6, 0.85)
  label(ctx, ING_LABEL[sp.ing!], sp.x, sp.y + sp.h / 2 - 9, pf, 6)
}

function drawBowl(ctx: CanvasRenderingContext2D, sp: Spot, items: string[], pf: string) {
  ctx.beginPath()
  ctx.arc(sp.x, sp.y - 6, 22, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#e0f2fe'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(sp.x, sp.y - 6, 22, 5, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#fef3c7'
  ctx.fill()
  ctx.stroke()
  items.forEach((id, i) => ingIcon(ctx, id, sp.x - 12 + (i % 4) * 8, sp.y - 6, 0.36))
  label(ctx, 'TAZON', sp.x, sp.y + 20, pf, 6)
}

function drawOven(ctx: CanvasRenderingContext2D, sp: Spot, p: Piece | null, t: number, pf: string) {
  card(ctx, sp.x, sp.y, 50, 46, '#fde2e4', 10)
  const hot = p?.phase === 'horno'
  const burnt = p?.phase === 'quemado'
  // ventanita
  rr(ctx, sp.x - 15, sp.y - 16, 30, 20, 6)
  ctx.fillStyle = hot ? `rgba(251,146,60,${0.7 + 0.3 * Math.sin(t * 6)})` : burnt ? '#78350f' : '#7c2d12'
  ctx.fill()
  ctx.stroke()
  if (p) drawPiece(ctx, p, sp.x, sp.y - 6, 0.5)
  // barra de cocción
  if (hot && p) {
    const frac = 1 - p.left / RECIPES[p.rid].bake
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sp.x - 14, sp.y + 7, 28, 4)
    ctx.fillStyle = '#fb923c'
    ctx.fillRect(sp.x - 14, sp.y + 7, 28 * frac, 4)
  }
  if (burnt) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 30 + i * 13) % 34
      ctx.globalAlpha = Math.max(0, 1 - k / 34) * 0.7
      ctx.fillStyle = '#e5e7eb'
      ctx.beginPath()
      ctx.arc(sp.x - 8 + i * 8, sp.y - 20 - k, 4 + (i % 2), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  // carita del horno
  const happy = hot || (p?.phase === 'listo')
  ctx.fillStyle = INK
  for (const dx of [-8, 8]) {
    if (burnt) {
      ctx.fillRect(sp.x + dx - 2, sp.y + 13, 4, 1.5)
    } else {
      ctx.beginPath()
      ctx.arc(sp.x + dx, sp.y + 13, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (happy) {
    ctx.beginPath()
    ctx.arc(sp.x, sp.y + 15, 3, 0.1, Math.PI - 0.1)
    ctx.strokeStyle = INK
    ctx.stroke()
  }
  label(ctx, 'HORNO', sp.x, sp.y + sp.h / 2 + 3, pf, 6)
}

function drawDeco(ctx: CanvasRenderingContext2D, sp: Spot, p: Piece | null, pf: string) {
  card(ctx, sp.x, sp.y, 50, 46, '#d1fae5', 10)
  ctx.fillStyle = '#ffffff'
  for (const [dx, dy] of [[-14, -10], [12, -12], [-10, 8], [14, 6]]) ctx.fillRect(sp.x + dx, sp.y + dy, 3, 3)
  if (p) drawPiece(ctx, p, sp.x, sp.y - 2, 0.72)
  label(ctx, 'DECORAR', sp.x, sp.y + sp.h / 2 + 3, pf, 6)
}

function drawBox(ctx: CanvasRenderingContext2D, sp: Spot, pf: string) {
  card(ctx, sp.x, sp.y, 50, 46, '#fce7f3', 10)
  rr(ctx, sp.x - 14, sp.y - 8, 28, 20, 3)
  ctx.fillStyle = '#fda4af'
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fb7185'
  ctx.fillRect(sp.x - 2, sp.y - 8, 4, 20)
  label(ctx, 'CAJA', sp.x, sp.y + sp.h / 2 + 3, pf, 6)
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
        card(ctx, sp.x, sp.y, sp.w - 8, sp.h - 4, cu ? '#ffffff' : 'rgba(255,255,255,0.35)', 14)
        if (cu) drawCust(ctx, cu, sp, t)
        break
      }
    }
  }
}

/** Mostrador central con franja de rayas. */
export function drawCounterBand(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const h = H * 0.13
  const y = H * 0.5 - h / 2
  rr(ctx, 4, y, W - 8, h, 14)
  ctx.fillStyle = '#fbcfe8'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  for (let x = 16; x < W - 16; x += 26) ctx.fillRect(x, y + 6, 10, h - 12)
}

/** Fondo de baldosas y corazoncitos flotando. */
export function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#fff1f7')
  g.addColorStop(1, '#eaf8ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(244,114,182,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= W; x += 36) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
  }
  for (let y = 0; y <= H; y += 36) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
  }
  ctx.stroke()
  for (let i = 0; i < 7; i++) {
    const x = ((i * 97.3 + t * 12) % (W + 40)) - 20
    const y = H * (0.1 + ((i * 0.37) % 0.8))
    ctx.globalAlpha = 0.1
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

/** Mano de cada jugador: el ingrediente o pastelito que lleva en ese momento. */
export function drawHand(ctx: CanvasRenderingContext2D, W: number, H: number, side: 0 | 1, it: Item | null, pf: string) {
  const x = W * 0.5
  const y = side === 0 ? H * 0.59 : H * 0.41
  ctx.beginPath()
  ctx.arc(x, y, 20, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = PLAYER_COLOR[side]
  ctx.stroke()
  if (it) drawItem(ctx, it, x, y, 0.85)
  else label(ctx, 'MANO', x, y, pf, 5, PLAYER_COLOR[side])
}
