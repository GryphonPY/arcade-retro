/**
 * Pintor de pixel art sobre un buffer RGBA. Todo el arte del juego (texturas,
 * enemigos, armas, cara del HUD) se dibuja con estas primitivas a resolución
 * nativa, sin antialiasing. El canal alfa codifica:
 *   0   = transparente
 *   255 = píxel normal (recibe luz)
 *   200 = píxel emisivo (brilla en la oscuridad)
 */
import { clamp, mixColor, rng, shade } from './util'

export const EMISSIVE_A = 200

export class Img {
  readonly data: Uint8ClampedArray
  /** modo emisivo: lo que se pinte mientras está activo brilla. */
  em = false
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }

  px(x: number, y: number, c: number) {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.data[i] = (c >> 16) & 255
    this.data[i + 1] = (c >> 8) & 255
    this.data[i + 2] = c & 255
    this.data[i + 3] = this.em ? EMISSIVE_A : 255
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1
    const i = (y * this.w + x) * 4
    if (this.data[i + 3] === 0) return -1
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2]
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.data[(y * this.w + x) * 4 + 3]
  }

  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[(y * this.w + x) * 4 + 3] = 0
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.max(0, Math.round(x))
    const y0 = Math.max(0, Math.round(y))
    const x1 = Math.min(this.w, Math.round(x + w))
    const y1 = Math.min(this.h, Math.round(y + h))
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c)
  }

  /** Rectángulo con bisel: luz arriba-izquierda, sombra abajo-derecha. */
  bevel(x: number, y: number, w: number, h: number, c: number, k = 0.25) {
    this.rect(x, y, w, h, c)
    this.rect(x, y, w, 1, shade(c, 1 + k))
    this.rect(x, y, 1, h, shade(c, 1 + k * 0.6))
    this.rect(x, y + h - 1, w, 1, shade(c, 1 - k))
    this.rect(x + w - 1, y, 1, h, shade(c, 1 - k * 0.8))
  }

  /** Elipse rellena con sombreado de 3-4 tonos según una luz arriba-izquierda. */
  blob(cx: number, cy: number, rx: number, ry: number, c: number, light = 0.35) {
    const x0 = Math.floor(cx - rx)
    const x1 = Math.ceil(cx + rx)
    const y0 = Math.floor(cy - ry)
    const y1 = Math.ceil(cy + ry)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        const d = nx * nx + ny * ny
        if (d > 1) continue
        if (light <= 0) {
          this.px(x, y, c)
          continue
        }
        // normal aproximada: luz desde arriba-izquierda
        const l = -nx * 0.55 - ny * 0.75 + (1 - d) * 0.5
        const k = l > 0.55 ? 1 + light : l > 0.05 ? 1 : l > -0.45 ? 1 - light * 0.9 : 1 - light * 1.6
        this.px(x, y, shade(c, k))
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: number) {
    this.blob(cx, cy, r, r, c, 0)
  }

  /** Cápsula (segmento grueso) con sombreado lateral: ideal para extremidades. */
  limb(x0: number, y0: number, x1: number, y1: number, r: number, c: number, light = 0.3) {
    const minx = Math.floor(Math.min(x0, x1) - r)
    const maxx = Math.ceil(Math.max(x0, x1) + r)
    const miny = Math.floor(Math.min(y0, y1) - r)
    const maxy = Math.ceil(Math.max(y0, y1) + r)
    const dx = x1 - x0
    const dy = y1 - y0
    const len2 = dx * dx + dy * dy || 1
    const len = Math.sqrt(len2)
    // normal del segmento (para sombrear un lado)
    const nx = -dy / len
    const ny = dx / len
    const flip = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const t = clamp(((px - x0) * dx + (py - y0) * dy) / len2, 0, 1)
        const qx = x0 + dx * t
        const qy = y0 + dy * t
        const ex = px - qx
        const ey = py - qy
        const d = Math.sqrt(ex * ex + ey * ey)
        if (d > r) continue
        const side = ((ex * nx + ey * ny) / Math.max(0.001, r)) * flip
        const k = side > 0.45 ? 1 + light : side < -0.35 ? 1 - light : 1
        this.px(x, y, light > 0 ? shade(c, k) : c)
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (let guard = 0; guard < 4096; guard++) {
      this.px(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  /** Polígono relleno (scanline, regla par-impar). */
  poly(pts: number[], c: number) {
    let miny = Infinity
    let maxy = -Infinity
    for (let i = 1; i < pts.length; i += 2) {
      miny = Math.min(miny, pts[i])
      maxy = Math.max(maxy, pts[i])
    }
    const n = pts.length / 2
    const xs: number[] = []
    for (let y = Math.floor(miny); y <= Math.ceil(maxy); y++) {
      xs.length = 0
      const sy = y + 0.5
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2]
        const ay = pts[i * 2 + 1]
        const bx = pts[((i + 1) % n) * 2]
        const by = pts[((i + 1) % n) * 2 + 1]
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c)
      }
    }
  }

  /** Ruido de motas sobre los píxeles ya pintados (textura de piel/metal). */
  speckle(x: number, y: number, w: number, h: number, amount: number, k: number, seed = 1) {
    const r = rng(seed)
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (r() > amount) continue
        const c = this.get(xx, yy)
        if (c < 0) continue
        const em = this.alpha(xx, yy) === EMISSIVE_A
        if (em) continue
        this.px(xx, yy, shade(c, k + (r() - 0.5) * 0.1))
      }
    }
  }

  /** Contorno oscuro de 1 px alrededor de lo pintado (lectura clara del sprite). */
  outline(c = 0x0a0606) {
    const w = this.w
    const h = this.h
    const mark: number[] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.alpha(x, y) !== 0) continue
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) mark.push(x, y)
      }
    }
    const em = this.em
    this.em = false
    for (let i = 0; i < mark.length; i += 2) this.px(mark[i], mark[i + 1], c)
    this.em = em
  }

  /** Copia otra imagen encima (respeta transparencia y flag emisivo). */
  blit(src: Img, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const si = (y * src.w + (flipX ? src.w - 1 - x : x)) * 4
        const a = src.data[si + 3]
        if (!a) continue
        const tx = dx + x
        const ty = dy + y
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue
        const di = (ty * this.w + tx) * 4
        this.data[di] = src.data[si]
        this.data[di + 1] = src.data[si + 1]
        this.data[di + 2] = src.data[si + 2]
        this.data[di + 3] = a
      }
    }
  }

  /** Recolorea hacia un tinte (para variantes). */
  tint(c: number, t: number) {
    for (let i = 0; i < this.data.length; i += 4) {
      if (!this.data[i + 3]) continue
      const o = (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2]
      const m = mixColor(o, c, t)
      this.data[i] = (m >> 16) & 255
      this.data[i + 1] = (m >> 8) & 255
      this.data[i + 2] = m & 255
    }
  }

  /** Vuelca a un canvas (para el overlay 2D). El alfa emisivo se vuelve opaco. */
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = this.w
    cv.height = this.h
    const ctx = cv.getContext('2d')
    if (ctx) {
      const id = ctx.createImageData(this.w, this.h)
      for (let i = 0; i < this.data.length; i += 4) {
        id.data[i] = this.data[i]
        id.data[i + 1] = this.data[i + 1]
        id.data[i + 2] = this.data[i + 2]
        id.data[i + 3] = this.data[i + 3] ? 255 : 0
      }
      ctx.putImageData(id, 0, 0)
    }
    return cv
  }
}
