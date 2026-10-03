/**
 * Atlas de sprites billboard (enemigos, jefes, objetos, efectos) dibujado por
 * código. Las muertes se generan "desplomando" el fotograma de dolor.
 */
import { EMISSIVE_A, Img } from './paint'
import { rng, shade } from './util'

export interface Frame {
  u0: number
  v0: number
  u1: number
  v1: number
  w: number
  h: number
}

export interface Anim {
  walk: number[]
  attack: number[]
  pain: number
  death: number[]
  corpse: number
  extra: number[]
}

export const ATLAS_W = 1024
export const ATLAS_H = 1024

interface Pose {
  walk: number
  atk: number
  pain: boolean
  alt?: number
}

const sin4 = (w: number) => Math.sin((w * Math.PI) / 2)

// ---------------------------------------------------------------------------
// Criaturas
// ---------------------------------------------------------------------------

function drawMutant(g: Img, p: Pose) {
  const skin = 0xc08c7a
  const dark = 0x6a2c2a
  const claw = 0xf0e6cc
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const hipY = 30 - Math.abs(s)
  // piernas
  for (const side of [-1, 1]) {
    const sw = s * side
    const hx = 20 + side * 4
    const kx = hx + side * 2 + sw * 3
    const fx = hx + side * 2 + sw * 5
    const ky = 38 - Math.max(0, sw) * 2
    const c = side < 0 ? shade(skin, 0.82) : skin
    g.limb(hx, hipY, kx, ky, 3, c)
    g.limb(kx, ky, fx, 45, 2.4, c)
    g.rect(fx - 3, 45, 7, 2, shade(c, 0.7))
    g.px(fx - 3, 47, claw)
    g.px(fx + 3, 47, claw)
  }
  // torso encorvado
  g.blob(20, hipY - 9, 10, 11, skin)
  g.blob(20, hipY - 7, 4, 5, dark, 0.2)
  for (let i = 0; i < 4; i++) g.rect(16, hipY - 11 + i * 2, 9, 1, i % 2 ? 0xd8c4a8 : shade(dark, 0.8))
  g.speckle(10, hipY - 20, 20, 22, 0.12, 0.85, 3)
  // cabeza
  const hy = hipY - 21 + (p.pain ? -1 : 0)
  const hx = 20 + (p.pain ? 2 : 0)
  g.blob(hx, hy, 6, 6, shade(skin, 0.95))
  g.rect(hx - 4, hy + 2, 9, 3, 0x2a0606)
  for (let i = 0; i < 4; i++) g.px(hx - 3 + i * 2, hy + 2, claw)
  for (let i = 0; i < 4; i++) g.px(hx - 2 + i * 2, hy + 4, claw)
  if (p.pain) g.rect(hx - 4, hy + 2, 9, 5, 0x3a0808)
  g.em = true
  if (p.pain) {
    g.rect(hx - 4, hy - 2, 3, 1, 0xffe040)
    g.rect(hx + 2, hy - 2, 3, 1, 0xffe040)
  } else {
    g.rect(hx - 4, hy - 2, 2, 2, 0xfff060)
    g.rect(hx + 3, hy - 2, 2, 2, 0xfff060)
  }
  g.em = false
  // brazos
  for (const side of [-1, 1]) {
    const sx = 20 + side * 8
    const sy = hipY - 16
    let hx2: number
    let hy2: number
    if (p.pain) {
      hx2 = 20 + side * 17
      hy2 = hipY - 14
    } else if (p.atk === 1) {
      hx2 = 20 + side * 10
      hy2 = 4
    } else if (p.atk === 2) {
      hx2 = 20 - side * 4
      hy2 = hipY + 6
    } else {
      hx2 = 20 + side * 13 - s * side * 2
      hy2 = hipY + 4 + s * side * 3
    }
    const ex = (sx + hx2) / 2 + side * 3
    const ey = (sy + hy2) / 2 + 1
    const c = side < 0 ? shade(skin, 0.88) : skin
    g.limb(sx, sy, ex, ey, 3, c)
    g.limb(ex, ey, hx2, hy2, 2.6, c)
    // garras
    const dir = p.atk === 1 ? -1 : 1
    for (let k = -1; k <= 1; k++) g.line(hx2 + k * 2, hy2, hx2 + k * 3, hy2 + dir * 5, claw)
  }
  g.outline()
}

function drawSoldier(g: Img, p: Pose) {
  const uni = 0x58613e
  const uniD = 0x3c4428
  const skin = 0x86a07a
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const hipY = 31 - Math.abs(s) * 0.8
  for (const side of [-1, 1]) {
    const sw = s * side
    const hx = 17 + side * 3
    const kx = hx + sw * 2
    const fx = hx + sw * 4
    const c = side < 0 ? uniD : uni
    g.limb(hx, hipY, kx, 41, 3, c)
    g.limb(kx, 41, fx, 48, 2.6, c)
    g.bevel(fx - 3, 48, 7, 4, 0x2a2420)
  }
  // torso + chaleco
  g.bevel(9, hipY - 17, 17, 18, uni, 0.2)
  g.bevel(11, hipY - 15, 13, 10, 0x4a4430, 0.25)
  g.rect(11, hipY - 2, 13, 2, 0x2a2420)
  g.speckle(9, hipY - 17, 17, 18, 0.1, 0.8, 7)
  // mancha de sangre
  g.rect(19, hipY - 12, 3, 4, 0x6a1010)
  // cabeza con casco y máscara
  const hy = hipY - 23 + (p.pain ? 1 : 0)
  const hx = 17 + (p.pain ? -2 : 0)
  g.blob(hx, hy, 5, 5, skin)
  g.blob(hx, hy - 3, 6.5, 4, 0x4c5a34)
  g.rect(hx - 6, hy - 1, 13, 1, 0x2e3620)
  g.bevel(hx - 3, hy + 1, 7, 4, 0x2a2a2a)
  g.px(hx, hy + 5, 0x1a1a1a)
  g.em = true
  if (p.pain) {
    g.rect(hx - 3, hy, 2, 1, 0xff3020)
    g.rect(hx + 2, hy, 2, 1, 0xff3020)
  } else {
    g.rect(hx - 3, hy - 1, 2, 2, 0xff3a20)
    g.rect(hx + 2, hy - 1, 2, 2, 0xff3a20)
  }
  g.em = false
  // brazos + rifle
  if (p.atk) {
    g.limb(9, hipY - 14, 12, hipY - 7, 2.6, uniD)
    g.limb(26, hipY - 14, 22, hipY - 7, 2.6, uni)
    g.bevel(12, hipY - 11, 11, 6, 0x1e1e20)
    g.bevel(15, hipY - 13, 5, 3, 0x2a2a2c)
    g.disc(17.5, hipY - 8, 2, 0x050505)
    if (p.atk === 2) {
      g.em = true
      g.disc(17.5, hipY - 9, 5, 0xffb030)
      g.disc(17.5, hipY - 9, 3, 0xfff4b0)
      g.em = false
    }
  } else if (p.pain) {
    g.limb(9, hipY - 14, 2, hipY - 22, 2.6, uniD)
    g.limb(26, hipY - 14, 32, hipY - 5, 2.6, uni)
    g.limb(29, hipY - 3, 33, hipY - 12, 1.6, 0x1e1e20)
  } else {
    g.limb(9, hipY - 14, 7 - s, hipY - 3, 2.6, uniD)
    g.limb(26, hipY - 14, 25, hipY - 5, 2.6, uni)
    g.limb(6, hipY - 2, 28, hipY - 8, 1.8, 0x1e1e20)
    g.rect(14, hipY - 6, 3, 4, 0x1e1e20)
  }
  g.outline()
}

function drawSpitter(g: Img, p: Pose) {
  const body = 0xa4ac4a
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const puff = p.atk === 1 ? 2 : 0
  const cy = 26 - Math.abs(s)
  for (const side of [-1, 1]) {
    const sw = s * side
    g.limb(22 + side * 7, cy + 8, 22 + side * 9 + sw * 3, 43, 3, shade(body, side < 0 ? 0.7 : 0.85))
    g.rect(22 + side * 9 + sw * 3 - 3, 42, 7, 2, 0x4a4a1a)
  }
  g.blob(22, cy, 16 + puff, 14 + puff, body)
  g.speckle(6, cy - 14, 32, 28, 0.15, 0.8, 11)
  // venas
  g.line(12, cy - 6, 18, cy + 4, shade(body, 0.6))
  g.line(32, cy - 8, 28, cy + 6, shade(body, 0.6))
  // pústulas brillantes
  g.em = true
  const pus: [number, number, number][] = [
    [11, cy - 4, 2.5],
    [33, cy - 2, 2.5],
    [15, cy + 7, 2],
    [30, cy + 8, 2],
    [22, cy - 11, 2],
  ]
  for (const [x, y, r] of pus) {
    g.disc(x, y, r + puff * 0.4, 0x7aff40)
    g.px(x - 1, y - 1, 0xe0ffc0)
  }
  g.em = false
  // boca
  const mo = p.atk ? 6 : p.pain ? 5 : 3
  g.blob(22, cy + 2, 7, mo, 0x2a1008, 0)
  for (let i = 0; i < 5; i++) g.px(17 + i * 2.5, cy + 2 - mo + 1, 0xe8e0b0)
  if (p.atk === 2) {
    g.em = true
    g.disc(22, cy + 2, 4, 0x8aff30)
    g.disc(21, cy + 1, 2, 0xe8ffb0)
    g.em = false
  } else if (!p.pain) {
    g.rect(21, cy + 2 + mo - 1, 2, 4, 0x9adf50)
  }
  // ojillos
  g.em = true
  g.rect(16, cy - 7, 2, 2, p.pain ? 0xff6020 : 0xffe040)
  g.rect(27, cy - 7, 2, 2, p.pain ? 0xff6020 : 0xffe040)
  g.em = false
  // bracitos
  g.limb(7, cy + 2, 3, cy + 10 + s * 2, 2, shade(body, 0.75))
  g.limb(37, cy + 2, 41, cy + 10 - s * 2, 2, shade(body, 0.85))
  g.outline()
}

function drawTank(g: Img, p: Pose) {
  const steel = 0x6e7480
  const flesh = 0x9a6656
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const hipY = 42 - Math.abs(s) * 1.5
  for (const side of [-1, 1]) {
    const sw = s * side
    const hx = 30 + side * 8
    g.limb(hx, hipY, hx + side * 2 + sw * 2, 53, 5, side < 0 ? shade(flesh, 0.75) : flesh)
    g.limb(hx + side * 2 + sw * 2, 53, hx + side * 2 + sw * 4, 60, 4.5, shade(flesh, 0.85))
    g.bevel(hx + side * 2 + sw * 4 - 6, 58, 12, 6, steel)
  }
  // torso masivo
  g.blob(30, hipY - 16, 20, 18, flesh)
  g.bevel(14, hipY - 30, 32, 14, steel, 0.3)
  g.bevel(17, hipY - 15, 26, 12, shade(steel, 0.9), 0.3)
  for (const [x, y] of [
    [16, hipY - 28],
    [43, hipY - 28],
    [16, hipY - 18],
    [43, hipY - 18],
    [19, hipY - 13],
    [40, hipY - 13],
  ])
    g.rect(x, y, 2, 2, 0xb0b4bc)
  g.rect(18, hipY - 24, 24, 2, 0xc09018)
  g.speckle(10, hipY - 34, 40, 36, 0.08, 0.75, 21)
  // cabeza pequeña con visor
  const hy = hipY - 34 + (p.pain ? 2 : 0)
  g.blob(30, hy, 6, 5, flesh)
  g.bevel(25, hy - 3, 11, 5, 0x3a3e46)
  g.em = true
  g.rect(26, hy - 2, 9, 2, p.pain ? 0xffa040 : 0xff2a10)
  g.em = false
  // brazos con puños enormes
  for (const side of [-1, 1]) {
    const sx = 30 + side * 17
    const sy = hipY - 26
    let fx: number
    let fy: number
    if (p.atk === 1) {
      fx = 30 + side * 14
      fy = 6
    } else if (p.atk === 2) {
      fx = 30 + side * 9
      fy = hipY + 6
    } else if (p.pain) {
      fx = 30 + side * 27
      fy = hipY - 30
    } else {
      fx = 30 + side * 24
      fy = hipY + 4 + s * side * 2
    }
    g.blob(sx, sy, 7, 6, steel, 0.4)
    g.limb(sx, sy + 3, fx, fy - 3, 5, side < 0 ? shade(flesh, 0.8) : flesh)
    g.bevel(fx - 7, fy - 6, 14, 12, shade(steel, 0.85), 0.35)
    g.rect(fx - 5, fy - 1, 10, 1, 0x30343a)
  }
  g.outline()
}

function drawSwarm(g: Img, p: Pose) {
  const body = 0x8a4aa4
  const w = p.walk % 2
  const rear = p.atk ? 3 : 0
  for (let i = 0; i < 3; i++) {
    const lx = 6 + i * 4
    const up = (i + w) % 2 ? 1 : 0
    g.line(lx, 8 - rear, lx - 4, 13 - up, 0x3a1a44)
    g.line(lx + 6, 8 - rear, lx + 10, 13 - up, 0x3a1a44)
  }
  g.blob(11, 8 - rear, 8, 4.5, body)
  g.blob(11, 6 - rear, 4, 3, shade(body, 1.2))
  for (let i = 0; i < 3; i++) g.rect(5 + i * 5, 7 - rear, 1, 4, shade(body, 0.6))
  g.em = true
  g.rect(8, 5 - rear, 2, 1, p.pain ? 0xffffff : 0xff3030)
  g.rect(13, 5 - rear, 2, 1, p.pain ? 0xffffff : 0xff3030)
  g.em = false
  g.line(9, 10 - rear, 7, 12 - rear + (p.atk ? -2 : 0), 0xf0e0c0)
  g.line(13, 10 - rear, 15, 12 - rear + (p.atk ? -2 : 0), 0xf0e0c0)
  g.outline()
}

// ---------------------------------------------------------------------------
// Jefes
// ---------------------------------------------------------------------------

function drawColossus(g: Img, p: Pose) {
  const flesh = 0xb07a68
  const dark = 0x5e2a26
  const bone = 0xeadcc0
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const W = g.w
  const cx = W / 2
  const hipY = 84 - Math.abs(s) * 2
  // piernas
  for (const side of [-1, 1]) {
    const sw = s * side
    const hx = cx + side * 18
    g.limb(hx, hipY, hx + side * 6 + sw * 5, 102, 9, side < 0 ? shade(flesh, 0.75) : flesh)
    g.limb(hx + side * 6 + sw * 5, 102, hx + side * 4 + sw * 8, 114, 8, shade(flesh, 0.85))
    g.rect(hx + side * 4 + sw * 8 - 10, 113, 20, 5, shade(flesh, 0.6))
    for (let k = 0; k < 3; k++) g.rect(hx + side * 4 + sw * 8 - 9 + k * 7, 117, 3, 3, bone)
  }
  // cuerpo
  g.blob(cx, hipY - 26, 38, 34, flesh)
  g.speckle(cx - 38, hipY - 60, 76, 68, 0.14, 0.82, 31)
  // grilletes
  g.bevel(cx - 30, hipY - 6, 60, 6, 0x5a5e66)
  for (let i = 0; i < 6; i++) g.rect(cx - 28 + i * 10, hipY - 5, 4, 4, 0x8a8e96)
  // herida abierta con costillas
  g.blob(cx + 4, hipY - 28, 13, 15, dark, 0.15)
  for (let i = 0; i < 5; i++) g.limb(cx - 8, hipY - 38 + i * 5, cx + 16, hipY - 36 + i * 5, 1.2, bone, 0)
  // corazón brillante en fase de furia (alt)
  g.em = true
  g.disc(cx + 4, hipY - 26, p.alt ? 6 : 4, p.alt ? 0xff4020 : 0xc02010)
  g.em = false
  // espinas de la espalda
  for (let i = 0; i < 5; i++) {
    const x = cx - 30 + i * 15
    g.poly([x - 4, hipY - 52 + Math.abs(i - 2) * 4, x + 4, hipY - 52 + Math.abs(i - 2) * 4, x, hipY - 70 + Math.abs(i - 2) * 6], bone)
  }
  // cabeza con muchos ojos
  const hy = hipY - 56 + (p.pain ? 3 : 0)
  g.blob(cx, hy, 14, 12, shade(flesh, 0.95))
  g.rect(cx - 10, hy + 2, 21, 8, 0x2a0606)
  for (let i = 0; i < 7; i++) {
    g.poly([cx - 10 + i * 3, hy + 2, cx - 7 + i * 3, hy + 2, cx - 8.5 + i * 3, hy + 6], bone)
    g.poly([cx - 9 + i * 3, hy + 10, cx - 6 + i * 3, hy + 10, cx - 7.5 + i * 3, hy + 6], bone)
  }
  g.em = true
  const eyeC = p.pain ? 0xffffff : 0xffe030
  for (const [ex, ey] of [
    [-7, -5],
    [6, -5],
    [-1, -8],
    [-11, -1],
    [10, -1],
  ])
    g.rect(cx + ex, hy + ey, 3, 2, eyeC)
  g.em = false
  // brazo izquierdo: puño; derecho: cuchilla de hueso
  const atk = p.atk
  const lx = atk === 1 ? cx - 34 : atk === 2 ? cx - 26 : p.pain ? cx - 52 : cx - 46
  const ly = atk === 1 ? 14 : atk === 2 ? hipY + 18 : p.pain ? hipY - 46 : hipY + 6 + s * 4
  g.limb(cx - 32, hipY - 44, (cx - 32 + lx) / 2 - 8, (hipY - 44 + ly) / 2, 9, shade(flesh, 0.82))
  g.limb((cx - 32 + lx) / 2 - 8, (hipY - 44 + ly) / 2, lx, ly, 8, shade(flesh, 0.88))
  g.blob(lx, ly, 11, 10, shade(flesh, 0.8))
  const rx = atk === 3 ? cx + 30 : atk === 1 ? cx + 36 : p.pain ? cx + 52 : cx + 44
  const ry = atk === 3 ? 10 : atk === 1 ? 16 : p.pain ? hipY - 46 : hipY + 4 - s * 4
  g.limb(cx + 32, hipY - 44, (cx + 32 + rx) / 2 + 8, (hipY - 44 + ry) / 2, 9, flesh)
  g.limb((cx + 32 + rx) / 2 + 8, (hipY - 44 + ry) / 2, rx, ry, 7, flesh)
  g.poly([rx - 4, ry, rx + 4, ry, rx + 2, ry + 30, rx - 1, ry + 34], bone)
  if (atk === 3) {
    // sostiene una roca
    g.blob(rx, ry - 8, 9, 8, 0x6a5a4a)
  }
  g.outline()
}

function drawMecha(g: Img, p: Pose) {
  const steel = 0x8a909c
  const dark = 0x3a3e48
  const s = p.atk || p.pain ? 0 : sin4(p.walk)
  const cx = g.w / 2
  const bodyY = 50 - Math.abs(s) * 2
  // piernas de articulación invertida
  for (const side of [-1, 1]) {
    const sw = s * side
    const hx = cx + side * 20
    const kx = hx + side * 10 + sw * 4
    g.limb(hx, bodyY + 18, kx, 86, 6, side < 0 ? shade(steel, 0.7) : shade(steel, 0.85))
    g.limb(kx, 86, hx + side * 4 + sw * 8, 108, 5, dark)
    g.bevel(hx + side * 4 + sw * 8 - 12, 108, 24, 10, shade(steel, 0.8))
    g.rect(hx + side * 4 + sw * 8 - 10, 116, 20, 2, 0x1a1c20)
    g.disc(kx, 86, 5, 0x5a606a)
  }
  // torso blindado
  g.bevel(cx - 32, bodyY - 8, 64, 30, steel, 0.3)
  g.bevel(cx - 26, bodyY - 26, 52, 22, shade(steel, 1.05), 0.3)
  for (let x = 0; x < 64; x++)
    for (let y = 0; y < 6; y++) if (((x + y) >> 2) & 1) g.px(cx - 32 + x, bodyY + 14 + y, 0xd0a018)
  g.speckle(cx - 32, bodyY - 26, 64, 48, 0.08, 0.8, 41)
  // visor
  g.bevel(cx - 16, bodyY - 20, 32, 9, 0x16181c)
  g.em = true
  const vis = p.pain ? 0xffd0a0 : p.alt ? 0xff60ff : 0xff2010
  g.rect(cx - 14, bodyY - 17, 28, 3, vis)
  g.rect(cx - 8 + (p.walk % 4) * 4, bodyY - 18, 4, 5, 0xffffff)
  g.em = false
  // núcleo frontal
  g.disc(cx, bodyY + 4, 6, 0x22252a)
  g.em = true
  g.disc(cx, bodyY + 4, 4, p.alt ? 0xff40ff : 0x40c0ff)
  g.em = false
  // hombros con lanzamisiles
  for (const side of [-1, 1]) {
    const px = cx + side * 38
    g.bevel(px - 12, bodyY - 32, 24, 20, shade(steel, 0.9), 0.3)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.disc(px - 5 + i * 10, bodyY - 26 + j * 9, 3, 0x101010)
        if (p.atk === 2) {
          g.em = true
          g.disc(px - 5 + i * 10, bodyY - 26 + j * 9, 2, 0xff5020)
          g.em = false
        }
      }
  }
  // brazos ametralladora
  for (const side of [-1, 1]) {
    const ax = cx + side * 44
    const ay = bodyY + (p.pain ? -6 : 0)
    g.limb(cx + side * 30, bodyY - 4, ax, ay + 8, 5, dark)
    g.bevel(ax - 9, ay + 6, 18, 22, shade(steel, 0.8), 0.3)
    for (let i = 0; i < 3; i++) g.rect(ax - 6 + i * 5, ay + 28, 3, 10, 0x2a2c30)
    g.disc(ax, ay + 38, 5, 0x1a1a1a)
    if (p.atk === 1) {
      g.em = true
      g.disc(ax, ay + 40, 8, 0xffa020)
      g.disc(ax, ay + 40, 4, 0xfff6c0)
      g.em = false
    }
  }
  if (p.pain) {
    g.em = true
    for (let i = 0; i < 10; i++) {
      const r = rng(i * 13 + 5)
      g.px(cx - 30 + r() * 60, bodyY - 20 + r() * 40, 0xffe080)
    }
    g.em = false
  }
  g.outline()
}

function drawBrain(g: Img, p: Pose) {
  const pink = 0xd48a9a
  const cx = g.w / 2
  const pulse = p.walk % 2 ? 1 : 0
  const cy = 40
  // tentáculos / cables
  for (let i = 0; i < 7; i++) {
    const bx = cx - 30 + i * 10
    const sway = Math.sin(p.walk * 1.3 + i) * 4
    g.limb(bx, cy + 20, bx + sway, cy + 44, 3.5, i % 2 ? 0x6a3a7a : 0x4a3a5a)
    g.limb(bx + sway, cy + 44, bx - sway, g.h - 4, 2.5, i % 2 ? 0x6a3a7a : 0x4a3a5a)
  }
  // cerebro
  g.blob(cx, cy, 42 + pulse, 30 + pulse, pink)
  // pliegues
  const r = rng(77)
  for (let i = 0; i < 26; i++) {
    let x = cx - 36 + r() * 72
    let y = cy - 24 + r() * 44
    const len = 6 + r() * 10
    for (let k = 0; k < len; k++) {
      if (g.get(Math.round(x), Math.round(y)) >= 0) g.px(x, y, shade(pink, 0.62))
      x += r() * 2 - 1
      y += r() * 2 - 1
    }
  }
  g.line(cx, cy - 30, cx, cy + 10, shade(pink, 0.5))
  // venas brillantes
  g.em = true
  const vein = p.alt ? 0x60e0ff : 0xff40c0
  for (let i = 0; i < 5; i++) {
    let x = cx - 30 + i * 15
    let y = cy - 18
    for (let k = 0; k < 16; k++) {
      if (g.get(Math.round(x), Math.round(y)) >= 0) g.px(x, y, vein)
      x += Math.sin(k + i) * 1.2
      y += 1.4
    }
  }
  // ojo central
  const open = p.pain ? 2 : 9
  g.blob(cx, cy + 6, 14, open, 0xfff0e0, 0.15)
  if (!p.pain) {
    g.disc(cx, cy + 6, 6, p.atk ? 0xff2020 : 0xff8a20)
    g.disc(cx, cy + 6, 3, 0x200000)
    g.px(cx - 2, cy + 3, 0xffffff)
  }
  g.em = false
  if (p.alt) {
    // escudo: anillo hexagonal
    g.em = true
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2
      if (a % 4 === 0) continue
      g.px(cx + Math.cos(ang) * 47, cy + 4 + Math.sin(ang) * 40, 0x60e0ff)
    }
    g.em = false
  }
  g.outline()
}

// ---------------------------------------------------------------------------
// Muertes: desplome del fotograma de dolor + charco
// ---------------------------------------------------------------------------

function crumple(src: Img, angle: number, squash: number, blood: number, seed: number): Img {
  const out = new Img(src.w + 16, src.h)
  const pivX = src.w / 2
  const pivY = src.h - 1
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const off = 8
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      // inversa: desde destino al origen
      const dx = x - off - pivX
      const dy = (y - pivY) / squash
      const sx = dx * ca + dy * sa + pivX
      const sy = -dx * sa + dy * ca + pivY
      const ix = Math.round(sx)
      const iy = Math.round(sy)
      if (ix < 0 || iy < 0 || ix >= src.w || iy >= src.h) continue
      const si = (iy * src.w + ix) * 4
      const a = src.data[si + 3]
      if (!a) continue
      const di = (y * out.w + x) * 4
      out.data[di] = src.data[si]
      out.data[di + 1] = src.data[si + 1]
      out.data[di + 2] = src.data[si + 2]
      // los ojos se apagan al morir
      out.data[di + 3] = a === EMISSIVE_A && blood > 0.5 ? 255 : a
      if (a === EMISSIVE_A && blood > 0.5) {
        out.data[di] = 40
        out.data[di + 1] = 20
        out.data[di + 2] = 20
      }
    }
  }
  if (blood > 0) {
    const r = rng(seed)
    const cx = out.w / 2
    const rx = (src.w / 2) * blood
    for (let y = out.h - 4; y < out.h; y++)
      for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
        if (out.alpha(x, y)) continue
        if (r() < 0.85) out.px(x, y, r() < 0.3 ? 0x500808 : 0x7a0c0c)
      }
  }
  return out
}

// ---------------------------------------------------------------------------
// Objetos y efectos
// ---------------------------------------------------------------------------

function drawBarrel(g: Img, dmg: boolean) {
  const c = 0x4a6a3a
  for (let y = 4; y < 30; y++) {
    for (let x = 1; x < 19; x++) {
      const nx = (x - 10) / 9
      const k = 1.1 - nx * nx * 0.7 + (nx < -0.3 ? 0.15 : 0)
      g.px(x, y, shade(c, k))
    }
  }
  g.rect(1, 9, 18, 2, 0x2e4424)
  g.rect(1, 22, 18, 2, 0x2e4424)
  g.rect(6, 13, 8, 7, 0xd0b020)
  g.poly([10, 14, 13, 19, 7, 19], 0x1a1a10)
  g.em = true
  g.blob(10, 4, 9, 3, 0x6aff40, 0)
  g.px(7, 3, 0xd0ffb0)
  if (dmg) {
    g.rect(3, 6, 2, 10, 0x6aff40)
    g.rect(14, 18, 2, 8, 0x6aff40)
  }
  g.em = false
  if (dmg) {
    g.line(4, 12, 9, 20, 0x1a2a14)
    g.line(15, 8, 12, 16, 0x1a2a14)
  }
  g.outline()
}

function drawExplosion(g: Img, f: number) {
  const cx = g.w / 2
  const cy = g.h / 2
  const r = rng(90 + f)
  const rad = [8, 14, 18, 20, 19][f]
  const cols = [
    [0xffffe0, 0xffe060, 0xff9020],
    [0xfff4a0, 0xffb030, 0xe04010],
    [0xffc040, 0xf06010, 0x902010],
    [0xd05010, 0x802010, 0x402020],
    [0x603020, 0x403030, 0x302828],
  ][f]
  g.em = f < 4
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2
    const d = r() * rad * 0.5
    g.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad * (0.35 + r() * 0.3), cols[2])
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2
    const d = r() * rad * 0.3
    g.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad * (0.25 + r() * 0.2), cols[1])
  }
  if (f < 3) g.disc(cx, cy, rad * 0.3, cols[0])
  g.em = false
  if (f >= 3) {
    for (let i = 0; i < 40; i++) g.clear(Math.floor(r() * g.w), Math.floor(r() * g.h))
  }
}

function drawPuff(g: Img, f: number, c1: number, c2: number) {
  const cx = g.w / 2
  const cy = g.h / 2
  g.em = true
  if (f === 0) {
    g.disc(cx, cy, 2, c1)
    g.px(cx, cy - 4, c1)
    g.px(cx + 4, cy, c1)
    g.px(cx - 4, cy + 1, c1)
  } else if (f === 1) {
    g.disc(cx, cy, 3, c2)
    g.disc(cx, cy, 1.5, c1)
  } else {
    g.em = false
    g.disc(cx - 1, cy - 1, 3, shade(c2, 0.5))
    g.clear(cx, cy)
    g.clear(cx - 2, cy)
  }
  g.em = false
}

function drawWarp(g: Img, f: number) {
  const cx = g.w / 2
  const r = rng(300 + f)
  const wid = [3, 8, 10, 6][f]
  g.em = true
  for (let y = 0; y < g.h; y++) {
    const w = wid * (0.6 + 0.4 * Math.sin(y * 0.4 + f))
    for (let x = -w; x <= w; x++) {
      if (r() < 0.25) continue
      const k = 1 - Math.abs(x) / (w + 1)
      g.px(cx + x, y, k > 0.6 ? 0xffd0c0 : k > 0.3 ? 0xff5030 : 0xa01818)
    }
  }
  g.em = false
}

function drawProjectile(g: Img, kind: string) {
  const cx = g.w / 2
  const cy = g.h / 2
  g.em = true
  switch (kind) {
    case 'bullet':
      g.disc(cx, cy, 2.5, 0xff9020)
      g.disc(cx, cy, 1.2, 0xfff0a0)
      break
    case 'acid':
      g.disc(cx, cy, 4.5, 0x50d020)
      g.disc(cx - 1, cy - 1, 2.5, 0xb0ff60)
      g.px(cx - 2, cy - 2, 0xffffff)
      break
    case 'rocket':
      g.disc(cx, cy, 5.5, 0xff8020)
      g.disc(cx, cy, 3.5, 0xffe080)
      g.em = false
      g.disc(cx, cy, 2.5, 0x5a6050)
      g.px(cx - 1, cy - 1, 0xa0a890)
      break
    case 'plasma':
      g.disc(cx, cy, 4.5, 0x2080ff)
      g.disc(cx, cy, 3, 0x60e0ff)
      g.disc(cx, cy, 1.5, 0xffffff)
      break
    case 'rock':
      g.em = false
      g.blob(cx, cy, 5, 4.5, 0x7a6450)
      g.px(cx + 1, cy + 1, 0x3a2a20)
      g.outline()
      break
    case 'missile':
      g.disc(cx, cy, 5.5, 0xff3010)
      g.disc(cx, cy, 3, 0xffd060)
      g.em = false
      g.disc(cx, cy, 2, 0x303030)
      break
    case 'orb':
      g.disc(cx, cy, 6.5, 0xa020c0)
      g.disc(cx, cy, 4.5, 0xff40e0)
      g.disc(cx, cy, 2, 0xffd0ff)
      break
  }
  g.em = false
}

function drawPickup(g: Img, kind: string) {
  switch (kind) {
    case 'medkit':
      g.bevel(1, 3, 18, 12, 0xe8e8e8, 0.3)
      g.rect(8, 5, 4, 8, 0xd01818)
      g.rect(5, 7, 10, 4, 0xd01818)
      g.rect(7, 1, 6, 2, 0x8a8a8a)
      break
    case 'stim':
      g.bevel(3, 1, 6, 12, 0xd8e8f0, 0.3)
      g.rect(4, 5, 4, 6, 0x2050e0)
      g.rect(5, 0, 2, 2, 0xb0b0b0)
      break
    case 'shard':
      g.blob(7, 8, 6, 6, 0x30c050)
      g.rect(2, 9, 11, 2, 0x206030)
      g.em = true
      g.px(5, 5, 0xb0ffb0)
      g.em = false
      break
    case 'vest':
      g.poly([2, 3, 7, 1, 13, 1, 18, 3, 17, 16, 3, 16], 0x2a8a3a)
      g.rect(8, 1, 4, 5, 0x1a4a22)
      g.rect(4, 8, 12, 2, 0x50c060)
      g.rect(4, 12, 12, 2, 0x50c060)
      break
    case 'bullets':
      g.bevel(2, 4, 14, 10, 0x5a5a30, 0.3)
      for (let i = 0; i < 4; i++) g.rect(4 + i * 3, 1, 2, 5, 0xd0a030)
      g.rect(5, 8, 8, 2, 0x2a2a14)
      break
    case 'shells':
      g.bevel(1, 6, 18, 9, 0x8a1a12, 0.3)
      for (let i = 0; i < 5; i++) {
        g.rect(2 + i * 3.4, 1, 3, 6, 0xc02010)
        g.rect(2 + i * 3.4, 5, 3, 2, 0xd0a040)
      }
      break
    case 'rockets':
      for (let i = 0; i < 2; i++) {
        g.bevel(3 + i * 7, 3, 5, 14, 0x6a7058, 0.3)
        g.poly([3 + i * 7, 3, 8 + i * 7, 3, 5.5 + i * 7, 0], 0xb02010)
      }
      break
    case 'cells':
      g.bevel(2, 3, 16, 12, 0x404858, 0.3)
      g.em = true
      g.rect(4, 6, 12, 5, 0x40c0ff)
      g.rect(5, 7, 4, 2, 0xd0f4ff)
      g.em = false
      break
    case 'upgrade':
      g.em = true
      g.disc(9, 9, 8, 0xffb020)
      g.disc(9, 9, 5, 0xfff0a0)
      g.em = false
      break
  }
  g.outline()
}

// ---------------------------------------------------------------------------
// Construcción del atlas
// ---------------------------------------------------------------------------

export class SpriteAtlas {
  readonly img = new Img(ATLAS_W, ATLAS_H)
  readonly frames: Frame[] = []
  readonly anims: Record<string, Anim> = {}
  readonly named: Record<string, number> = {}
  private sx = 0
  private sy = 0
  private rowH = 0

  add(src: Img, name?: string): number {
    if (this.sx + src.w + 1 > ATLAS_W) {
      this.sx = 0
      this.sy += this.rowH + 1
      this.rowH = 0
    }
    if (this.sy + src.h > ATLAS_H) throw new Error('Atlas de sprites lleno')
    this.img.blit(src, this.sx, this.sy)
    const f: Frame = {
      u0: this.sx / ATLAS_W,
      v0: this.sy / ATLAS_H,
      u1: (this.sx + src.w) / ATLAS_W,
      v1: (this.sy + src.h) / ATLAS_H,
      w: src.w,
      h: src.h,
    }
    this.sx += src.w + 1
    this.rowH = Math.max(this.rowH, src.h)
    this.frames.push(f)
    const id = this.frames.length - 1
    if (name) this.named[name] = id
    return id
  }

  creature(
    name: string,
    w: number,
    h: number,
    draw: (g: Img, p: Pose) => void,
    opts: { walk?: number; attacks?: number; extra?: Pose[]; noBlood?: boolean } = {},
  ) {
    const mk = (p: Pose) => {
      const g = new Img(w, h)
      draw(g, p)
      return g
    }
    const walkN = opts.walk ?? 4
    const walk: number[] = []
    for (let i = 0; i < walkN; i++) walk.push(this.add(mk({ walk: i, atk: 0, pain: false })))
    const attack: number[] = []
    for (let i = 1; i <= (opts.attacks ?? 2); i++) attack.push(this.add(mk({ walk: 0, atk: i, pain: false })))
    const painImg = mk({ walk: 0, atk: 0, pain: true })
    const pain = this.add(painImg)
    const seed = name.length * 31
    const bl = opts.noBlood ? 0.01 : 1
    const death = [
      this.add(crumple(painImg, 0.25, 0.9, 0, seed)),
      this.add(crumple(painImg, 0.8, 0.62, 0.4 * bl, seed)),
      this.add(crumple(painImg, 1.35, 0.42, 0.9 * bl, seed)),
    ]
    const corpse = this.add(crumple(painImg, 1.5, 0.38, 1.2 * bl, seed + 1))
    const extra = (opts.extra ?? []).map((p) => this.add(mk(p)))
    this.anims[name] = { walk, attack, pain, death, corpse, extra }
  }
}

export function buildSpriteAtlas(): SpriteAtlas {
  const A = new SpriteAtlas()
  const solid = new Img(4, 4)
  solid.rect(0, 0, 4, 4, 0xffffff)
  A.add(solid, 'solid')
  const glow = new Img(4, 4)
  glow.em = true
  glow.rect(0, 0, 4, 4, 0xffffff)
  A.add(glow, 'glow')

  A.creature('mutant', 40, 48, drawMutant)
  A.creature('soldier', 36, 54, drawSoldier)
  A.creature('spitter', 44, 46, drawSpitter)
  A.creature('tank', 60, 66, drawTank)
  A.creature('swarm', 22, 16, drawSwarm, { walk: 2, attacks: 1 })
  A.creature('boss1', 120, 122, drawColossus, {
    walk: 2,
    attacks: 3,
    extra: [
      { walk: 0, atk: 0, pain: false, alt: 1 },
      { walk: 1, atk: 0, pain: false, alt: 1 },
    ],
  })
  A.creature('boss2', 120, 120, drawMecha, {
    noBlood: true,
    walk: 4,
    attacks: 2,
    extra: [
      { walk: 0, atk: 0, pain: false, alt: 1 },
      { walk: 1, atk: 1, pain: false, alt: 1 },
    ],
  })
  A.creature('boss3', 110, 110, drawBrain, {
    walk: 4,
    attacks: 1,
    extra: [
      { walk: 0, atk: 0, pain: false, alt: 1 },
      { walk: 1, atk: 0, pain: false, alt: 1 },
    ],
  })

  // barriles
  for (const d of [false, true]) {
    const g = new Img(20, 31)
    drawBarrel(g, d)
    A.add(g, d ? 'barrel_dmg' : 'barrel')
  }
  // explosión
  for (let f = 0; f < 5; f++) {
    const g = new Img(44, 44)
    drawExplosion(g, f)
    A.add(g, 'expl' + f)
  }
  // impactos
  const puffs: [string, number, number][] = [
    ['puff', 0xfff0a0, 0x8a8a8a],
    ['blood', 0xff2020, 0x900808],
    ['zap', 0xd0f8ff, 0x3090ff],
    ['acid', 0xd0ff80, 0x40a010],
  ]
  for (const [n, c1, c2] of puffs)
    for (let f = 0; f < 3; f++) {
      const g = new Img(12, 12)
      drawPuff(g, f, c1, c2)
      A.add(g, n + f)
    }
  for (let f = 0; f < 4; f++) {
    const g = new Img(24, 48)
    drawWarp(g, f)
    A.add(g, 'warp' + f)
  }
  for (const k of ['bullet', 'acid', 'rocket', 'plasma', 'rock', 'missile', 'orb']) {
    const g = new Img(k === 'orb' ? 16 : 14, k === 'orb' ? 16 : 14)
    drawProjectile(g, k)
    A.add(g, 'p_' + k)
  }
  for (const k of ['medkit', 'stim', 'shard', 'vest', 'bullets', 'shells', 'rockets', 'cells', 'upgrade']) {
    const g = new Img(20, 18)
    drawPickup(g, k)
    A.add(g, 'i_' + k)
  }
  // vísceras
  for (let i = 0; i < 4; i++) {
    const g = new Img(8, 8)
    const r = rng(500 + i)
    g.blob(4, 4, 2.5 + r(), 2 + r(), i === 3 ? 0xe8dcc0 : 0x9a2020)
    if (i < 3) g.px(3, 3, 0xd06050)
    g.outline(0x300404)
    A.add(g, 'gib' + i)
  }
  // calcomanías del suelo (con tramado para simular transparencia)
  {
    const g = new Img(24, 24)
    const r = rng(9)
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x - 12, y - 12) / 12 + r() * 0.35
        if (d < 0.75) g.px(x, y, r() < 0.3 ? 0x4a0606 : 0x6a0a0a)
      }
    A.add(g, 'd_blood')
  }
  {
    const g = new Img(32, 32)
    const r = rng(19)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 16, y - 16) / 16 + r() * 0.3
        if (d < 0.8 && (x + y) % 2 === 0) g.px(x, y, 0x0c0a08)
      }
    A.add(g, 'd_scorch')
  }
  {
    const g = new Img(24, 24)
    const r = rng(29)
    g.em = true
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x - 12, y - 12) / 12 + r() * 0.3
        if (d < 0.75) g.px(x, y, r() < 0.3 ? 0x80ff40 : 0x40b020)
      }
    A.add(g, 'd_acid')
  }
  {
    const g = new Img(32, 32)
    g.em = true
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5)
        if (d > 12 && d < 15 && (x + y) % 2 === 0) g.px(x, y, 0xff3030)
        else if (d > 13 && d < 14) g.px(x, y, 0xff8060)
      }
    A.add(g, 'd_aura')
  }
  {
    const g = new Img(16, 16)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5) / 8
        if (d < 1 && (x + y) % 2 === 0) g.px(x, y, 0x000000)
      }
    A.add(g, 'd_shadow')
  }
  {
    const g = new Img(32, 32)
    g.em = true
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5)
        if (d > 13 && d < 15.5) g.px(x, y, 0xffd040)
      }
    A.add(g, 'd_ring')
  }
  return A
}
