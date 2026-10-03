/**
 * Armas en primera persona (sprites 2D para el overlay), pintadas con el
 * mismo pintor de pixel art. Cada arma tiene fotogramas de reposo, disparo y,
 * si aplica, de recarga (corredera de la escopeta).
 */
import { Img } from './paint'
import type { WeaponId } from './defs'
import { shade } from './util'

export interface WeaponFrames {
  idle: HTMLCanvasElement[]
  fire: HTMLCanvasElement[]
  pump: HTMLCanvasElement[]
  flash: HTMLCanvasElement
  /** desplazamiento vertical del destello respecto a la parte superior del arma */
  flashY: number
}

const GLOVE = 0x2e2a22
const SLEEVE = 0x4a5634

function hand(g: Img, x: number, y: number, w: number, h: number, skin: number) {
  g.bevel(x, y, w, h, GLOVE, 0.35)
  for (let i = 1; i < 4; i++) g.rect(x + (w * i) / 4, y + 1, 1, h - 3, shade(GLOVE, 0.6))
  g.rect(x + 1, y + h - 2, w - 2, 2, skin)
}

function arm(g: Img, x0: number, y0: number, x1: number, y1: number) {
  g.limb(x0, y0, x1, y1, 7, SLEEVE, 0.3)
}

function flashImg(r: number, inner: number, outer: number, rays = 8): HTMLCanvasElement {
  const s = r * 2 + 2
  const g = new Img(s, s)
  const c = s / 2
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.3
    const len = r * (i % 2 ? 0.7 : 1)
    g.limb(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len * 0.8, 1.6, outer, 0)
  }
  g.disc(c, c, r * 0.55, outer)
  g.disc(c, c, r * 0.35, inner)
  g.disc(c, c, r * 0.18, 0xffffff)
  return g.toCanvas()
}

function pistol(skin: number, kick: number): HTMLCanvasElement {
  const g = new Img(64, 76)
  const y = 20 + kick
  arm(g, 40, 76, 34, y + 34)
  // corredera vista desde atrás
  g.bevel(22, y, 20, 14, 0x3a3c42, 0.35)
  g.rect(24, y + 2, 16, 3, 0x26282c)
  g.rect(30, y - 3, 4, 4, 0x2a2c30)
  g.rect(31, y - 3, 2, 1, 0xe8e8e8)
  g.rect(23, y - 2, 3, 3, 0x2a2c30)
  g.rect(38, y - 2, 3, 3, 0x2a2c30)
  // armazón y empuñadura
  g.bevel(24, y + 14, 16, 10, 0x2a2c30, 0.3)
  g.bevel(25, y + 24, 14, 22, 0x1e1f22, 0.3)
  for (let i = 0; i < 6; i++) g.rect(27, y + 27 + i * 3, 10, 1, 0x141416)
  hand(g, 20, y + 22, 24, 18, skin)
  g.outline(0x050505)
  return g.toCanvas()
}

function shotgun(skin: number, pump: number, kick: number): HTMLCanvasElement {
  const g = new Img(112, 96)
  const y = 12 + kick
  const cx = 56
  // cañón y tubo de cargador en perspectiva (dos trapecios)
  g.poly([cx - 11, y, cx + 11, y, cx + 24, y + 66, cx - 24, y + 66], 0x26282e)
  g.poly([cx - 10, y, cx - 1, y, cx - 2, y + 66, cx - 22, y + 66], 0x3e424c)
  g.poly([cx - 8, y, cx - 5, y, cx - 12, y + 66, cx - 16, y + 66], 0x6a707c)
  g.poly([cx + 1, y, cx + 10, y, cx + 22, y + 66, cx + 2, y + 66], 0x30333a)
  g.poly([cx + 3, y, cx + 5, y, cx + 8, y + 66, cx + 5, y + 66], 0x50555f)
  g.rect(cx - 1, y, 2, 66, 0x101114)
  g.disc(cx - 5, y + 3, 3.4, 0x070707)
  g.disc(cx + 5, y + 3, 3.4, 0x0c0c0c)
  g.rect(cx - 2, y - 4, 4, 4, 0x1a1a1c)
  g.px(cx, y - 4, 0xe0e0e0)
  // guardamanos (corredera)
  const py = y + 30 + pump * 9
  g.poly([cx - 20, py, cx + 20, py, cx + 26, py + 22, cx - 26, py + 22], 0x6a4424)
  g.poly([cx - 20, py, cx - 8, py, cx - 10, py + 22, cx - 26, py + 22], 0x80542e)
  for (let i = 0; i < 6; i++) g.rect(cx - 20 - i * 0.9, py + 3 + i * 3.4, 40 + i * 1.8, 1, 0x3a2410)
  // mano izquierda en la corredera
  arm(g, 14, 96, cx - 20, py + 18)
  hand(g, cx - 32, py + 6, 20, 16, skin)
  // culata y mano derecha
  g.bevel(cx - 24, y + 66, 48, 26, 0x6a4424, 0.3)
  g.rect(cx - 22, y + 70, 44, 2, 0x4a2c14)
  arm(g, 100, 96, cx + 20, y + 80)
  hand(g, cx + 10, y + 68, 22, 18, skin)
  g.outline(0x050505)
  return g.toCanvas()
}

function chaingun(skin: number, spin: number, kick: number): HTMLCanvasElement {
  const g = new Img(104, 84)
  const y = 16 + kick
  const cx = 52
  // carcasa
  g.poly([cx - 18, y + 14, cx + 18, y + 14, cx + 30, y + 62, cx - 30, y + 62], 0x3a3e46)
  g.poly([cx - 16, y + 14, cx - 4, y + 14, cx - 10, y + 62, cx - 27, y + 62], 0x50565f)
  // haz de cañones (vista frontal en perspectiva)
  g.disc(cx, y + 12, 14, 0x24262a)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + spin * (Math.PI / 6)
    const bx = cx + Math.cos(a) * 8
    const by = y + 12 + Math.sin(a) * 7
    g.disc(bx, by, 3.2, i === 0 ? 0x8a909c : 0x5a606a)
    g.disc(bx, by, 1.4, 0x050505)
  }
  g.disc(cx, y + 12, 2.5, 0x1a1a1a)
  // asas
  g.bevel(cx - 40, y + 40, 16, 12, 0x2a2c30, 0.3)
  g.bevel(cx + 24, y + 40, 16, 12, 0x2a2c30, 0.3)
  arm(g, 6, 84, cx - 34, y + 54)
  arm(g, 98, 84, cx + 34, y + 54)
  hand(g, cx - 44, y + 44, 18, 16, skin)
  hand(g, cx + 26, y + 44, 18, 16, skin)
  // cinta de balas
  for (let i = 0; i < 5; i++) g.rect(cx + 18 + i * 3, y + 62 + i, 3, 5, 0xc8a030)
  g.outline(0x050505)
  return g.toCanvas()
}

function rocket(skin: number, kick: number): HTMLCanvasElement {
  const g = new Img(108, 92)
  const y = 12 + kick
  const cx = 54
  g.poly([cx - 14, y, cx + 14, y, cx + 30, y + 72, cx - 30, y + 72], 0x4a5a3a)
  g.poly([cx - 12, y, cx - 4, y, cx - 12, y + 72, cx - 27, y + 72], 0x627650)
  g.rect(cx - 14, y + 20, 28, 3, 0x2e3824)
  g.rect(cx - 18, y + 44, 36, 3, 0x2e3824)
  g.disc(cx, y + 6, 10, 0x1a1e16)
  g.disc(cx, y + 6, 7, 0x080808)
  // ojiva visible dentro
  g.disc(cx, y + 6, 4, 0x8a2010)
  // mira
  g.bevel(cx + 14, y + 16, 8, 14, 0x2a2c30)
  g.rect(cx + 16, y + 18, 4, 3, 0x40c060)
  arm(g, 10, 92, cx - 26, y + 62)
  arm(g, 98, 92, cx + 26, y + 66)
  hand(g, cx - 38, y + 50, 18, 18, skin)
  hand(g, cx + 18, y + 56, 20, 18, skin)
  g.outline(0x050505)
  return g.toCanvas()
}

function plasma(skin: number, glow: number, kick: number): HTMLCanvasElement {
  const g = new Img(104, 88)
  const y = 14 + kick
  const cx = 52
  g.poly([cx - 12, y, cx + 12, y, cx + 26, y + 66, cx - 26, y + 66], 0x3a4250)
  g.poly([cx - 10, y, cx - 3, y, cx - 10, y + 66, cx - 23, y + 66], 0x56607a)
  g.em = true
  for (let i = 0; i < 4; i++) {
    const yy = y + 12 + i * 12
    const w = 12 + i * 3
    g.rect(cx - w, yy, w * 2, 3, i === glow ? 0xd0f8ff : 0x30a0ff)
  }
  g.disc(cx, y + 5, 6, 0x60e0ff)
  g.disc(cx, y + 5, 3, 0xffffff)
  g.em = false
  arm(g, 10, 88, cx - 24, y + 60)
  arm(g, 94, 88, cx + 24, y + 62)
  hand(g, cx - 36, y + 48, 18, 16, skin)
  hand(g, cx + 18, y + 50, 18, 16, skin)
  g.outline(0x050505)
  return g.toCanvas()
}

export function buildWeaponArt(skin: number): Record<WeaponId, WeaponFrames> {
  return {
    pistol: {
      idle: [pistol(skin, 0)],
      fire: [pistol(skin, 4), pistol(skin, 2)],
      pump: [],
      flash: flashImg(12, 0xfff4b0, 0xffa020),
      flashY: 12,
    },
    shotgun: {
      idle: [shotgun(skin, 0, 0)],
      fire: [shotgun(skin, 0, 6), shotgun(skin, 0, 3)],
      pump: [shotgun(skin, 1, 2), shotgun(skin, 2, 2), shotgun(skin, 1, 1)],
      flash: flashImg(20, 0xfff8c0, 0xff8a10, 10),
      flashY: 10,
    },
    chaingun: {
      idle: [chaingun(skin, 0, 0), chaingun(skin, 1, 0)],
      fire: [chaingun(skin, 0, 3), chaingun(skin, 1, 2)],
      pump: [],
      flash: flashImg(16, 0xfff4b0, 0xffa020),
      flashY: 12,
    },
    rocket: {
      idle: [rocket(skin, 0)],
      fire: [rocket(skin, 8), rocket(skin, 4)],
      pump: [],
      flash: flashImg(22, 0xffffd0, 0xff6010, 12),
      flashY: 4,
    },
    plasma: {
      idle: [plasma(skin, 0, 0), plasma(skin, 1, 0), plasma(skin, 2, 0), plasma(skin, 3, 0)],
      fire: [plasma(skin, 3, 3), plasma(skin, 2, 1)],
      pump: [],
      flash: flashImg(14, 0xffffff, 0x40c0ff),
      flashY: 4,
    },
  }
}
