/** Arte de la Pastelería: animalitos, adornos y el pastel visto desde arriba. */
import { FROSTS, flavorOf, type TopId } from './content'
import { GRID, type Cake } from './cake'

export const INK = '#5b2a3a'

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const hexToRgb = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function mix(a: string, b: string, k: number) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, k))))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

// ---------- caritas y animalitos ----------
export type Mood = 'happy' | 'wow' | 'calm' | 'sad' | 'love' | 'grumpy'

export function face(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mood: Mood, t: number, seed = 0) {
  const blink = Math.sin(t * 1.7 + seed * 3.1) > 0.985
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.lineWidth = 2 * s
  ctx.lineCap = 'round'
  for (const dx of [-1, 1]) {
    const ex = x + dx * 9 * s
    if (mood === 'love') {
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.moveTo(ex, y + 4 * s)
      ctx.bezierCurveTo(ex - 7 * s, y - 1 * s, ex - 4 * s, y - 7 * s, ex, y - 3 * s)
      ctx.bezierCurveTo(ex + 4 * s, y - 7 * s, ex + 7 * s, y - 1 * s, ex, y + 4 * s)
      ctx.fill()
      ctx.fillStyle = INK
    } else if (mood === 'happy' || blink) {
      ctx.beginPath()
      ctx.arc(ex, y + 1 * s, 4 * s, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else if (mood === 'grumpy') {
      ctx.beginPath()
      ctx.moveTo(ex - 4 * s, y - 2 * s - dx * 2 * s)
      ctx.lineTo(ex + 4 * s, y - 2 * s + dx * 2 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(ex, y + 2 * s, 2.6 * s, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(ex, y, (mood === 'wow' ? 4.2 : 3.4) * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex + 1.2 * s, y - 1.2 * s, 1.3 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
    }
  }
  ctx.beginPath()
  if (mood === 'wow') {
    ctx.ellipse(x, y + 8 * s, 3.5 * s, 4.5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (mood === 'sad' || mood === 'grumpy') {
    ctx.arc(x, y + 11 * s, 4 * s, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  } else {
    ctx.arc(x, y + 5 * s, (mood === 'love' ? 6 : 4.5) * s, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  if (mood !== 'grumpy') {
    ctx.fillStyle = 'rgba(244,114,182,0.5)'
    ctx.beginPath()
    ctx.ellipse(x - 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
    ctx.ellipse(x + 16 * s, y + 6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export type Animal = 'gato' | 'conejo' | 'oso' | 'pollito' | 'rana' | 'pato' | 'buho' | 'zorro' | 'raton'
export const ANIMALS: Animal[] = ['gato', 'conejo', 'oso', 'pollito', 'rana', 'pato', 'buho', 'zorro', 'raton']
export const FURS: Record<Animal, string[]> = {
  gato: ['#fbcfe8', '#fed7aa', '#e5e7eb', '#d6c4b0'],
  conejo: ['#ffffff', '#fde2e4', '#e9d5ff'],
  oso: ['#d9a77a', '#fde68a', '#c4b5fd'],
  pollito: ['#fde047'],
  rana: ['#86efac'],
  pato: ['#fffbea', '#fef3c7'],
  buho: ['#c8a27a', '#d6c4b0'],
  zorro: ['#fdba74'],
  raton: ['#d1d5db', '#f5d0fe'],
}

/** Animalito de busto (cabeza grande), centro (x,y), escala s (radio de cabeza ~38·s). */
export function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal, fur: string, x: number, y: number, s: number, mood: Mood, t: number, seed = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  ctx.fillStyle = fur
  const ear = (fn: () => void) => {
    ctx.beginPath()
    fn()
    ctx.fill()
    ctx.stroke()
  }
  // hombritos
  ctx.fillStyle = mix(fur, '#ffffff', 0.2)
  rr(ctx, -30, 26, 60, 30, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = fur
  if (a === 'conejo') {
    for (const dx of [-1, 1]) {
      ear(() => ctx.ellipse(dx * 14, -44, 9, 26, dx * 0.15, 0, Math.PI * 2))
      ctx.fillStyle = '#fbcfe8'
      ctx.beginPath()
      ctx.ellipse(dx * 14, -44, 4, 17, dx * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = fur
    }
  } else if (a === 'gato' || a === 'zorro') {
    for (const dx of [-1, 1]) {
      ear(() => {
        ctx.moveTo(dx * 32, -8)
        ctx.lineTo(dx * 26, -44)
        ctx.lineTo(dx * 6, -28)
        ctx.closePath()
      })
    }
  } else if (a === 'oso' || a === 'raton') {
    const r = a === 'raton' ? 17 : 12
    for (const dx of [-1, 1]) ear(() => ctx.arc(dx * (a === 'raton' ? 30 : 26), -26, r, 0, Math.PI * 2))
  } else if (a === 'buho') {
    for (const dx of [-1, 1]) {
      ear(() => {
        ctx.moveTo(dx * 30, -18)
        ctx.lineTo(dx * 30, -42)
        ctx.lineTo(dx * 12, -30)
        ctx.closePath()
      })
    }
  } else if (a === 'pollito' || a === 'pato') {
    ctx.fillStyle = a === 'pollito' ? '#fde047' : '#fde68a'
    ear(() => ctx.ellipse(0, -38, 6, 9, 0, 0, Math.PI * 2))
    ctx.fillStyle = fur
  }
  // cabeza
  ctx.beginPath()
  if (a === 'rana') ctx.ellipse(0, 0, 42, 31, 0, 0, Math.PI * 2)
  else ctx.ellipse(0, 0, 38, 34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (a === 'rana') {
    for (const dx of [-1, 1]) ear(() => ctx.arc(dx * 18, -26, 12, 0, Math.PI * 2))
  }
  if (a === 'zorro') {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(0, 14, 22, 15, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (a === 'buho') {
    ctx.fillStyle = '#fff7ed'
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(dx * 13, -4, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  const eyeY = a === 'rana' ? -24 : -4
  face(ctx, 0, eyeY, 1, mood, t, seed)
  if (a === 'pollito' || a === 'pato' || a === 'buho') {
    ctx.fillStyle = '#fb923c'
    ctx.beginPath()
    if (a === 'pato') ctx.ellipse(0, 9, 11, 5, 0, 0, Math.PI * 2)
    else {
      ctx.moveTo(-5, 5)
      ctx.lineTo(5, 5)
      ctx.lineTo(0, 12)
      ctx.closePath()
    }
    ctx.fill()
    ctx.stroke()
  }
  if (a === 'gato' || a === 'raton') {
    ctx.strokeStyle = 'rgba(91,42,58,0.6)'
    ctx.lineWidth = 1.2
    for (const dx of [-1, 1]) {
      for (const dy of [-2, 3]) {
        ctx.beginPath()
        ctx.moveTo(dx * 20, 8 + dy)
        ctx.lineTo(dx * 36, 6 + dy * 2)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

// ---------- adornos ----------
export function drawTopping(ctx: CanvasRenderingContext2D, k: TopId, x: number, y: number, s: number, rot: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(s, s)
  ctx.lineWidth = 1.6
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  const blob = (fill: string, r: number, ox = 0, oy = 0) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(ox, oy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const shine = (ox: number, oy: number, r: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(ox, oy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  switch (k) {
    case 'fresa':
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(-8, -4)
      ctx.quadraticCurveTo(-8, 9, 0, 11)
      ctx.quadraticCurveTo(8, 9, 8, -4)
      ctx.quadraticCurveTo(0, -9, -8, -4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#22c55e'
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55
        ctx.ellipse(Math.cos(a) * 3, -6 + Math.sin(a) * 1, 3.2, 1.6, a, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.fillStyle = '#fde68a'
      for (const [a, b] of [[-3, 0], [2, 3], [-1, 6], [3, -2]]) ctx.fillRect(a, b, 1.6, 1.6)
      break
    case 'cereza':
      ctx.strokeStyle = '#65a30d'
      ctx.beginPath()
      ctx.moveTo(0, -4)
      ctx.quadraticCurveTo(2, -14, 7, -16)
      ctx.stroke()
      ctx.strokeStyle = INK
      blob('#dc2626', 7)
      shine(-2.5, -2.5, 2)
      break
    case 'arandano':
      blob('#4f6bd8', 6)
      ctx.strokeStyle = '#c7d2fe'
      ctx.beginPath()
      ctx.moveTo(-2, -2)
      ctx.lineTo(2, 2)
      ctx.moveTo(2, -2)
      ctx.lineTo(-2, 2)
      ctx.stroke()
      break
    case 'corazon':
      ctx.fillStyle = '#fb7185'
      ctx.beginPath()
      ctx.moveTo(0, 8)
      ctx.bezierCurveTo(-12, -2, -6, -11, 0, -4)
      ctx.bezierCurveTo(6, -11, 12, -2, 0, 8)
      ctx.fill()
      ctx.stroke()
      shine(-4, -3, 1.8)
      break
    case 'estrella':
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 ? 4 : 9.5
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'bombon':
      blob('#6b3a22', 7.5)
      ctx.strokeStyle = '#d6a77a'
      ctx.beginPath()
      ctx.arc(0, 0, 3.5, 0.3, Math.PI * 1.6)
      ctx.stroke()
      break
    case 'vela': {
      // vista desde arriba: velita con flama
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#f472b6'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(0, 0, 2.6, 0, Math.PI * 1.3)
      ctx.stroke()
      const fl = 1 + Math.sin(t * 14 + x) * 0.18
      ctx.fillStyle = 'rgba(251,146,60,0.9)'
      ctx.beginPath()
      ctx.ellipse(0, -7, 3 * fl, 5 * fl, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.ellipse(0, -6.5, 1.5, 2.8, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'flor':
      ctx.fillStyle = '#d8b4fe'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 4.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      blob('#fde047', 3.2)
      break
    case 'kiwi':
      blob('#84cc16', 8.5)
      ctx.fillStyle = '#ecfccb'
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.fillRect(Math.cos(a) * 5 - 0.7, Math.sin(a) * 5 - 0.7, 1.4, 1.4)
      }
      break
    case 'galleta':
      blob('#d9a066', 9)
      ctx.fillStyle = '#5b3420'
      for (const [a, b] of [[-3, -3], [3, -1], [-1, 4], [4, 4], [-5, 2]]) {
        ctx.beginPath()
        ctx.arc(a, b, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'macaron':
      ctx.fillStyle = '#f9a8d4'
      rr(ctx, -9, -6, 18, 12, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fff7fb'
      ctx.fillRect(-9, -1.2, 18, 2.4)
      shine(-4, -3, 1.6)
      break
    case 'chispas': {
      const cols = ['#f472b6', '#60a5fa', '#facc15', '#4ade80', '#c084fc', '#fb923c']
      for (let i = 0; i < 4; i++) {
        const a = rot * 13 + i * 1.7
        ctx.save()
        ctx.translate(Math.cos(a) * 4, Math.sin(a * 1.3) * 3)
        ctx.rotate(a)
        ctx.fillStyle = cols[(i + Math.round(rot * 10)) % cols.length]
        rr(ctx, -4, -1.3, 8, 2.6, 1.3)
        ctx.fill()
        ctx.restore()
      }
      break
    }
  }
  ctx.restore()
}

// ---------- pastel ----------
const frostCache = new Map<number, { ver: number; can: HTMLCanvasElement }>()

function frostCanvas(c: Cake) {
  let e = frostCache.get(c.id)
  if (e && e.ver === c.frostVer) return e.can
  if (!e) {
    const can = document.createElement('canvas')
    can.width = GRID
    can.height = GRID
    e = { ver: -1, can }
    frostCache.set(c.id, e)
    if (frostCache.size > 40) frostCache.delete(frostCache.keys().next().value as number)
  }
  const x = e.can.getContext('2d')!
  const img = x.createImageData(GRID, GRID)
  for (let k = 0; k < GRID * GRID; k++) {
    const v = c.frost[k]
    if (v < 0) continue
    const n = parseInt(FROSTS[v].color.slice(1), 16)
    img.data[k * 4] = (n >> 16) & 255
    img.data[k * 4 + 1] = (n >> 8) & 255
    img.data[k * 4 + 2] = n & 255
    img.data[k * 4 + 3] = 255
  }
  x.putImageData(img, 0, 0)
  e.ver = c.frostVer
  return e.can
}

export function cakeColor(c: Cake) {
  const f = flavorOf(c.flavor)
  if (c.bake <= 1) return mix(f.raw, f.baked, c.bake)
  return mix(f.baked, '#3b2214', (c.bake - 1) / 0.7)
}

/** Pastel visto desde arriba con centro (x,y) y radio R. */
export function drawCake(ctx: CanvasRenderingContext2D, c: Cake, x: number, y: number, R: number, t: number, opts: { guide?: boolean } = {}) {
  const inPan = c.bake < 0.6
  ctx.save()
  // derrame
  if (c.spill > 0) {
    ctx.fillStyle = flavorOf(c.flavor).raw
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + c.id
      const d = R * (1.02 + Math.min(0.25, c.spill) * 0.6)
      ctx.beginPath()
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.12 + Math.min(0.2, c.spill * 0.5)), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  if (inPan) {
    // molde de metal
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.2, x, y, R * 1.1)
    g.addColorStop(0, '#f1f5f9')
    g.addColorStop(1, '#94a3b8')
    ctx.fillStyle = g
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x, y, R * 1.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#cbd5e1'
    ctx.beginPath()
    ctx.arc(x, y, R * 0.98, 0, Math.PI * 2)
    ctx.fill()
  }
  if (c.fill > 0) {
    const rr2 = R * Math.min(1, Math.sqrt(c.fill)) * (inPan ? 0.98 : 1)
    const col = cakeColor(c)
    const g = ctx.createRadialGradient(x - rr2 * 0.3, y - rr2 * 0.35, rr2 * 0.1, x, y, rr2)
    g.addColorStop(0, mix(col, '#ffffff', 0.25))
    g.addColorStop(0.7, col)
    g.addColorStop(1, c.bake > 0.6 ? mix(col, '#5b3420', 0.3) : col)
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(x, y, rr2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = g
    ctx.globalAlpha = 0.55
    ctx.fill()
    ctx.globalAlpha = 1
    if (!inPan) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
    // masa cruda brillosa
    if (c.bake < 0.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(x - rr2 * 0.3, y - rr2 * 0.35, rr2 * 0.32, rr2 * 0.14, -0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    // horneado: grietitas doradas
    if (c.bake > 0.7 && c.bake < 1.5) {
      ctx.strokeStyle = 'rgba(91,42,58,0.18)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + c.id
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * rr2 * 0.4, y + Math.sin(a) * rr2 * 0.4, rr2 * 0.18, a, a + 1.6)
        ctx.stroke()
      }
    }
  }
  // crema
  if (c.frostVer > 0 && !inPan) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, R * 0.995, 0, Math.PI * 2)
    ctx.clip()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(frostCanvas(c), x - R, y - R, R * 2, R * 2)
    // brillo y textura de remolinos
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = R * 0.03
    ctx.beginPath()
    ctx.arc(x, y, R * 0.55, -2.4, -1.2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, R * 0.3, 0.6, 1.8)
    ctx.stroke()
    ctx.restore()
  }
  // cortes
  if (c.cuts.length) {
    ctx.save()
    ctx.lineCap = 'round'
    for (const a of c.cuts) {
      const dx = Math.cos(a) * R * 0.98
      const dy = Math.sin(a) * R * 0.98
      ctx.strokeStyle = 'rgba(91,42,58,0.55)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - dx, y - dy)
      ctx.lineTo(x + dx, y + dy)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - dx + 1, y - dy + 1)
      ctx.lineTo(x + dx + 1, y + dy + 1)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (opts.guide && c.bake >= 0.6) {
    ctx.save()
    ctx.setLineDash([4, 6])
    ctx.strokeStyle = 'rgba(91,42,58,0.25)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      ctx.beginPath()
      ctx.moveTo(x - Math.cos(a) * R, y - Math.sin(a) * R)
      ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R)
      ctx.stroke()
    }
    ctx.restore()
  }
  // adornos
  const ps = R / 86
  for (const p of c.pieces) {
    const k = ps * 1.25 * (1 + p.pop * 0.6)
    ctx.save()
    ctx.globalAlpha = 1 - p.pop * 0.3
    ctx.fillStyle = 'rgba(91,42,58,0.15)'
    ctx.beginPath()
    ctx.ellipse(x + p.x * R + 1.5, y + p.y * R + 2.5, 7 * k, 4 * k, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawTopping(ctx, p.top, x + p.x * R, y + p.y * R - p.pop * 14, k, p.rot, t)
  }
  ctx.restore()
}

/** Plato redondo con borde de puntitos. */
export function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, glow: string | null) {
  ctx.save()
  ctx.fillStyle = 'rgba(91,42,58,0.12)'
  ctx.beginPath()
  ctx.ellipse(x + 4, y + 8, R, R * 0.96, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(x, y, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fce7f3'
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * R * 0.91, y + Math.sin(a) * R * 0.91, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  if (glow) {
    ctx.strokeStyle = glow
    ctx.lineWidth = 4
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.arc(x, y, R + 6, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** Tazón de masa visto desde arriba. */
export function drawBowl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, batter: string) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  ctx.fillStyle = '#bfdbfe'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = batter
  ctx.beginPath()
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(91,42,58,0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, r * 0.4, 0.4, 2.6)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.2, r * 0.1, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Bote de crema con espátula. */
export function drawPot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const rr3 = r * (0.72 + (i % 2) * 0.08)
    ctx.lineTo(x + Math.cos(a) * rr3, y + Math.sin(a) * rr3)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawSpatula(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.7)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.fillStyle = '#e2e8f0'
  rr(ctx, -9, -4, 18, 26, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  rr(ctx, -8, -4, 16, 12, 6)
  ctx.fill()
  ctx.fillStyle = '#f472b6'
  rr(ctx, -3, 20, 6, 26, 3)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function drawKnife(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.fillStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(-4, -26)
  ctx.quadraticCurveTo(6, -18, 5, 4)
  ctx.lineTo(-4, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f472b6'
  rr(ctx, -5, 4, 10, 20, 4)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
