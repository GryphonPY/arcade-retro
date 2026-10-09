/**
 * Pantallas dibujadas en el canvas: título con selección de nave, mejoras
 * entre sectores, resumen de sector y pausa. Incluye el hit-testing para
 * ratón y toque.
 */
import type { Game } from './game'
import { fx } from './audio'
import { SHIPS, shipSprite } from './ships'
import { RARITY_COLOR, RARITY_NAME, UP_BY_ID, type UpgradeDef } from './upgrades'
import { cached, drawSprite, type Sprite } from './sprites'
import { ACCENT, H, TAU, UI_FONT, W, clamp, easeOut, fmt, pixelFont, rgba } from './util'
import { rr } from '../game-utils'

// ===================== Layout =====================

export const CARD_Y = 318
export const CARD_H = 112
export const CARD_W = 106
export const cardX = (i: number) => 9 + i * (CARD_W + 10)
export const BTN = {
  get x() {
    return W / 2 - 96
  },
  get y() {
    return H - 54
  },
  w: 192,
  h: 34,
}
export const UP_Y = (i: number) => 112 + i * 106
export const UP_H = 96

const inRect = (x: number, y: number, rx: number, ry: number, rw: number, rh: number) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh

/** Procesa toques/clics en la pantalla de título. Devuelve true si hay que despegar. */
export function titleTap(g: Game, x: number, y: number): boolean {
  for (let i = 0; i < 3; i++) {
    if (inRect(x, y, cardX(i), CARD_Y, CARD_W, CARD_H)) {
      if (g.titleSel !== i) {
        g.titleSel = i
        fx.menu()
      }
      return false
    }
  }
  if (inRect(x, y, BTN.x - 10, BTN.y - 8, BTN.w + 20, BTN.h + 16)) return true
  // tocar la zona de vista previa también despega
  return y > 140 && y < 300
}

/** Toque en la pantalla de mejoras. */
export function upgradeTap(g: Game, x: number, y: number, mouse: boolean) {
  if (g.menuLock > 0) return
  for (let i = 0; i < g.choices.length; i++) {
    if (inRect(x, y, 16, UP_Y(i), W - 32, UP_H)) {
      if (g.sel === i || mouse) g.chooseUpgrade(i)
      else {
        g.sel = i
        fx.menu()
      }
      return
    }
  }
}

export function upgradeHover(g: Game, x: number, y: number) {
  for (let i = 0; i < g.choices.length; i++) {
    if (inRect(x, y, 16, UP_Y(i), W - 32, UP_H) && g.sel !== i) {
      g.sel = i
      fx.menu()
    }
  }
}

// ===================== Texto =====================

export function ptext(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', shadow = true) {
  ctx.font = `${size}px ${pixelFont()}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillText(s, x + 1, y + 1)
  }
  ctx.fillStyle = color
  ctx.fillText(s, x, y)
}

export function utext(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 500) {
  ctx.font = `${weight} ${size}px ${UI_FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(s, x, y)
}

/** Texto con ajuste de línea (fuente normal). */
export function wrap(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lh: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.font = `400 ${size}px ${UI_FONT}`
  const words = s.split(' ')
  let line = ''
  let yy = y
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy)
      line = w
      yy += lh
    } else line = test
  }
  if (line) ctx.fillText(line, x, yy)
}

// ===================== Logo =====================

function logoSprite(): Sprite {
  return cached('logo', 340, 100, (ctx) => {
    const f = pixelFont()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `34px ${f}`
    const g = ctx.createLinearGradient(40, 0, 300, 0)
    g.addColorStop(0, '#67e8f9')
    g.addColorStop(0.5, '#e0f2fe')
    g.addColorStop(1, '#f0abfc')
    ctx.save()
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 18
    ctx.fillStyle = '#0e7490'
    ctx.fillText('NEBULA', 172, 36)
    ctx.restore()
    ctx.fillStyle = g
    ctx.fillText('NEBULA', 170, 34)
    ctx.font = `22px ${f}`
    ctx.save()
    ctx.shadowColor = '#e879f9'
    ctx.shadowBlur = 16
    ctx.fillStyle = '#86198f'
    ctx.fillText('STRIKE', 172, 78)
    ctx.restore()
    const g2 = ctx.createLinearGradient(80, 0, 260, 0)
    g2.addColorStop(0, '#f0abfc')
    g2.addColorStop(1, '#c4b5fd')
    ctx.fillStyle = g2
    ctx.fillText('STRIKE', 170, 76)
    // destellos
    ctx.fillStyle = '#ffffff'
    for (const [x, y] of [
      [52, 18],
      [292, 52],
      [238, 90],
    ]) {
      ctx.fillRect(x - 6, y, 13, 1)
      ctx.fillRect(x, y - 6, 1, 13)
    }
  })
}

// ===================== Título =====================

export function drawTitle(ctx: CanvasRenderingContext2D, g: Game, best: number, touch: boolean) {
  const t = g.time
  const logo = logoSprite()
  const ly = 62 + Math.sin(t * 1.4) * 3
  drawSprite(ctx, logo, W / 2, ly)
  ptext(ctx, `RECORD ${fmt(best)}`, W / 2, 124, 8, '#fde68a')

  // marco de la vista previa
  ctx.strokeStyle = rgba(ACCENT, 0.22)
  ctx.lineWidth = 1
  const fy = 138
  const fh = 166
  for (const [x, y, dx, dy] of [
    [24, fy, 1, 1],
    [W - 24, fy, -1, 1],
    [24, fy + fh, 1, -1],
    [W - 24, fy + fh, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x, y + dy * 14)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * 14, y)
    ctx.stroke()
  }
  const s = SHIPS[g.titleSel]
  ptext(ctx, s.name, W / 2, fy + 12, 10, s.color)
  utext(ctx, g.player.focus ? 'MODO CONCENTRADO' : 'DISPARO NORMAL', W / 2, fy + fh - 10, 9, 'rgba(255,255,255,0.45)', 'center', 600)

  // tarjetas
  for (let i = 0; i < 3; i++) {
    const sh = SHIPS[i]
    const x = cardX(i)
    const sel = g.titleSel === i
    const y = CARD_Y - (sel ? 4 : 0)
    ctx.save()
    rr(ctx, x, y, CARD_W, CARD_H, 10)
    ctx.fillStyle = sel ? rgba(sh.color, 0.16) : 'rgba(10,12,28,0.72)'
    ctx.fill()
    if (sel) {
      ctx.shadowColor = sh.color
      ctx.shadowBlur = 14
    }
    ctx.strokeStyle = sel ? sh.color : 'rgba(255,255,255,0.14)'
    ctx.lineWidth = sel ? 2 : 1
    ctx.stroke()
    ctx.restore()
    const bob = sel ? Math.sin(t * 4) * 2 : 0
    drawSprite(ctx, shipSprite(i), x + CARD_W / 2, y + 28 + bob, sel ? 1.15 : 1)
    ptext(ctx, sh.name, x + CARD_W / 2, y + 56, 9, sel ? '#ffffff' : 'rgba(255,255,255,0.75)')
    utext(ctx, sh.role, x + CARD_W / 2, y + 68, 10, sel ? sh.color : 'rgba(255,255,255,0.5)', 'center', 600)
    for (let k = 0; k < sh.stats.length; k++) {
      const st = sh.stats[k]
      const yy = y + 81 + k * 10
      utext(ctx, st.label, x + 8, yy, 7.5, 'rgba(255,255,255,0.55)', 'left', 700)
      for (let p = 0; p < 5; p++) {
        ctx.fillStyle = p < st.v ? (sel ? sh.color : rgba(sh.color, 0.6)) : 'rgba(255,255,255,0.12)'
        ctx.fillRect(x + 52 + p * 9, yy - 2.5, 7, 5)
      }
    }
  }

  // descripción
  wrap(ctx, s.desc, W / 2, 443, W - 36, 14, 11.5, 'rgba(255,255,255,0.85)', 'center')
  wrap(ctx, s.focusDesc, W / 2, 472, W - 36, 13, 10, rgba(s.color, 0.9), 'center')

  // botón despegar
  const pulse = 0.5 + Math.sin(t * 4) * 0.5
  ctx.save()
  rr(ctx, BTN.x, BTN.y, BTN.w, BTN.h, 17)
  ctx.shadowColor = s.color
  ctx.shadowBlur = 10 + pulse * 10
  ctx.fillStyle = s.color
  ctx.fill()
  ctx.restore()
  ptext(ctx, 'DESPEGAR', W / 2, BTN.y + BTN.h / 2 + 1, 11, '#05060f', 'center', false)
  utext(ctx, touch ? 'Toca una nave y luego DESPEGAR' : '← → elegir nave  ·  ESPACIO despegar', W / 2, 532, 10, 'rgba(255,255,255,0.5)')
}

// ===================== Mejoras =====================

function upgradeIcon(ctx: CanvasRenderingContext2D, u: UpgradeDef, x: number, y: number, r: number, t: number) {
  const col = u.color
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, rgba(col, 0.45))
  gr.addColorStop(1, rgba(col, 0.05))
  ctx.fillStyle = gr
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = col
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 2
  const k = r / 22
  ctx.scale(k, k)
  switch (u.id) {
    case 'core':
      for (const dx of [-8, 0, 8]) ctx.fillRect(dx - 2, -12, 4, 18)
      ctx.fillRect(-12, 6, 24, 5)
      break
    case 'drone':
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, 12, t * 2, t * 2 + 4.5)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(Math.cos(t * 2) * 12, Math.sin(t * 2) * 12, 3, 0, TAU)
      ctx.fill()
      break
    case 'missiles':
      for (const dx of [-6, 6]) {
        ctx.beginPath()
        ctx.moveTo(dx, -13)
        ctx.lineTo(dx + 3, -7)
        ctx.lineTo(dx + 3, 9)
        ctx.lineTo(dx - 3, 9)
        ctx.lineTo(dx - 3, -7)
        ctx.closePath()
        ctx.fill()
      }
      break
    case 'rear':
      ctx.beginPath()
      ctx.moveTo(0, -10)
      ctx.lineTo(0, 4)
      ctx.moveTo(-10, 12)
      ctx.lineTo(0, 2)
      ctx.lineTo(10, 12)
      ctx.stroke()
      break
    case 'bombs':
      ctx.beginPath()
      ctx.arc(0, 3, 9, 0, TAU)
      ctx.fill()
      ctx.fillRect(-2, -10, 4, 6)
      break
    case 'shield':
      ctx.beginPath()
      ctx.moveTo(0, -13)
      ctx.lineTo(11, -7)
      ctx.lineTo(9, 6)
      ctx.lineTo(0, 13)
      ctx.lineTo(-9, 6)
      ctx.lineTo(-11, -7)
      ctx.closePath()
      ctx.stroke()
      break
    case 'magnet':
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(0, 0, 9, Math.PI, 0)
      ctx.moveTo(-9, 0)
      ctx.lineTo(-9, 10)
      ctx.moveTo(9, 0)
      ctx.lineTo(9, 10)
      ctx.stroke()
      break
    case 'speed':
      for (const dy of [-8, 0, 8]) {
        ctx.beginPath()
        ctx.moveTo(-12, dy)
        ctx.lineTo(6, dy)
        ctx.lineTo(12, dy + (dy === 0 ? 0 : 0))
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(4, -12)
      ctx.lineTo(13, 0)
      ctx.lineTo(4, 12)
      ctx.stroke()
      break
    case 'chain':
      ctx.lineWidth = 2.5
      for (const dx of [-6, 6]) {
        ctx.beginPath()
        ctx.ellipse(dx, 0, 7, 5, 0, 0, TAU)
        ctx.stroke()
      }
      break
    case 'graze':
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, TAU)
      ctx.fill()
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(0, 0, 11, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      break
    case 'overdrive':
      ctx.beginPath()
      ctx.moveTo(3, -14)
      ctx.lineTo(-7, 2)
      ctx.lineTo(0, 2)
      ctx.lineTo(-3, 14)
      ctx.lineTo(8, -3)
      ctx.lineTo(1, -3)
      ctx.closePath()
      ctx.fill()
      break
    case 'pierce':
      ctx.beginPath()
      ctx.moveTo(-14, 0)
      ctx.lineTo(10, 0)
      ctx.moveTo(4, -6)
      ctx.lineTo(12, 0)
      ctx.lineTo(4, 6)
      ctx.stroke()
      ctx.strokeRect(-4, -9, 6, 18)
      break
    case 'life':
      ctx.beginPath()
      ctx.moveTo(0, 12)
      ctx.bezierCurveTo(-16, 0, -8, -14, 0, -5)
      ctx.bezierCurveTo(8, -14, 16, 0, 0, 12)
      ctx.fill()
      break
    case 'autobomb':
      ctx.beginPath()
      ctx.arc(0, 2, 9, 0, TAU)
      ctx.stroke()
      ctx.fillRect(-1.5, -4, 3, 7)
      ctx.fillRect(-1.5, 5, 3, 3)
      break
    case 'nova':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4)
        ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13)
        ctx.stroke()
      }
      break
    case 'fury':
      ctx.beginPath()
      ctx.moveTo(0, -14)
      ctx.lineTo(4, -4)
      ctx.lineTo(14, -4)
      ctx.lineTo(6, 3)
      ctx.lineTo(9, 13)
      ctx.lineTo(0, 7)
      ctx.lineTo(-9, 13)
      ctx.lineTo(-6, 3)
      ctx.lineTo(-14, -4)
      ctx.lineTo(-4, -4)
      ctx.closePath()
      ctx.fill()
      break
  }
  ctx.restore()
}

export function drawUpgrade(ctx: CanvasRenderingContext2D, g: Game, touch: boolean) {
  const t = g.time
  const k = easeOut(clamp(g.modeT / 0.4, 0, 1))
  ctx.fillStyle = `rgba(3,3,14,${0.78 * k})`
  ctx.fillRect(0, 0, W, H)
  ptext(ctx, 'ELIGE UNA MEJORA', W / 2, 62 - (1 - k) * 20, 13, ACCENT)
  utext(ctx, `Sector ${g.sectorLabel} despejado. Tu nave evoluciona.`, W / 2, 86, 12, 'rgba(255,255,255,0.7)')
  for (let i = 0; i < g.choices.length; i++) {
    const u = g.choices[i]
    const sel = g.sel === i
    const appear = easeOut(clamp((g.modeT - 0.12 - i * 0.1) / 0.35, 0, 1))
    const x = 16 + (1 - appear) * (i % 2 ? 60 : -60)
    const y = UP_Y(i)
    const rc = RARITY_COLOR[u.rarity]
    ctx.globalAlpha = appear
    ctx.save()
    rr(ctx, x, y, W - 32, UP_H, 12)
    const bg = ctx.createLinearGradient(x, y, x + W, y)
    bg.addColorStop(0, sel ? rgba(rc, 0.22) : 'rgba(14,16,34,0.92)')
    bg.addColorStop(1, 'rgba(8,8,20,0.92)')
    ctx.fillStyle = bg
    ctx.fill()
    if (sel) {
      ctx.shadowColor = rc
      ctx.shadowBlur = 16 + Math.sin(t * 5) * 5
    }
    ctx.strokeStyle = sel ? rc : rgba(rc, 0.35)
    ctx.lineWidth = sel ? 2 : 1
    ctx.stroke()
    ctx.restore()
    upgradeIcon(ctx, u, x + 40, y + UP_H / 2, 24, t)
    const lv = g.build[u.id] ?? 0
    ptext(ctx, RARITY_NAME[u.rarity], x + 76, y + 16, 7, rc, 'left')
    ptext(ctx, lv > 0 ? `NV ${lv} > ${lv + 1}` : 'NUEVA', x + W - 44, y + 16, 7, lv > 0 ? '#e5e7eb' : '#86efac', 'right')
    utext(ctx, u.name, x + 76, y + 36, 15, '#ffffff', 'left', 700)
    wrap(ctx, u.desc, x + 76, y + 56, W - 32 - 90, 14, 11.5, 'rgba(255,255,255,0.72)')
    if (sel && touch) utext(ctx, 'Toca otra vez para elegir', x + W - 44, y + UP_H - 10, 9.5, rgba(rc, 0.95), 'right', 600)
    ctx.globalAlpha = 1
  }
  // build actual
  const by = 448
  ptext(ctx, 'TU NAVE', W / 2, by, 8, 'rgba(255,255,255,0.6)')
  drawBuild(ctx, g, W / 2, by + 20, 'center')
  utext(ctx, touch ? 'Toca una mejora para seleccionarla' : '↑ ↓ elegir  ·  ESPACIO confirmar  ·  clic directo', W / 2, 520, 10, 'rgba(255,255,255,0.5)')
}

/** Fila de chips con la build actual (nivel de arma + mejoras). */
export function drawBuild(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, align: 'left' | 'right' | 'center', alpha = 1) {
  const chips: { tag: string; n: number; col: string }[] = [{ tag: 'LV', n: g.power, col: SHIPS[g.shipId].color }]
  for (const id of g.buildOrder) {
    if (id === 'core') continue
    const u = UP_BY_ID[id]
    chips.push({ tag: u.tag, n: g.build[id], col: u.color })
  }
  const cw = 34
  const gap = 3
  const total = chips.length * cw + (chips.length - 1) * gap
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2
  ctx.globalAlpha = alpha
  ctx.font = `6px ${pixelFont()}`
  ctx.textBaseline = 'middle'
  for (const c of chips) {
    rr(ctx, cx, y - 6, cw, 12, 3)
    ctx.fillStyle = 'rgba(5,6,16,0.75)'
    ctx.fill()
    ctx.strokeStyle = rgba(c.col, 0.8)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = c.col
    ctx.fillText(c.tag, cx + 3, y + 0.5)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(c.n), cx + cw - 3, y + 0.5)
    cx += cw + gap
  }
  ctx.globalAlpha = 1
}

// ===================== Resumen de sector =====================

export function drawTally(ctx: CanvasRenderingContext2D, g: Game) {
  const t = g.modeT
  const k = easeOut(clamp(t / 0.5, 0, 1))
  ctx.fillStyle = `rgba(3,3,14,${0.55 * k})`
  ctx.fillRect(0, 140, W, 250)
  ctx.fillStyle = rgba(ACCENT, 0.6 * k)
  ctx.fillRect(0, 140, W, 1)
  ctx.fillRect(0, 389, W, 1)
  ptext(ctx, 'SECTOR DESPEJADO', W / 2 + (1 - k) * 80, 172, 14, '#ffffff')
  let total = 0
  for (let i = 0; i < g.tally.length; i++) {
    const row = g.tally[i]
    const at = 0.6 + i * 0.45
    if (t < at) break
    const p = clamp((t - at) / 0.4, 0, 1)
    const v = Math.round(row.value * p)
    total += v
    if (p < 1) fx.tally()
    const y = 214 + i * 30
    ptext(ctx, row.label, 40, y, 9, 'rgba(255,255,255,0.75)', 'left')
    ptext(ctx, row.value > 0 ? fmt(v) : '---', W - 40, y, 10, row.value > 0 ? '#fde047' : 'rgba(255,255,255,0.35)', 'right')
  }
  if (t > 0.6 + g.tally.length * 0.45) {
    ptext(ctx, 'TOTAL', 40, 352, 10, ACCENT, 'left')
    ptext(ctx, fmt(total), W - 40, 352, 12, '#ffffff', 'right')
  }
}

// ===================== Pausa =====================

export function drawPause(ctx: CanvasRenderingContext2D, touch: boolean, t: number) {
  ctx.fillStyle = 'rgba(2,3,10,0.6)'
  ctx.fillRect(0, 0, W, H)
  ptext(ctx, 'PAUSA', W / 2, H / 2 - 12, 20, '#ffffff')
  if (Math.sin(t * 5) > -0.3) utext(ctx, touch ? 'Toca para continuar' : 'Pulsa P para continuar', W / 2, H / 2 + 22, 12, 'rgba(255,255,255,0.7)')
}
