/**
 * Mundo lógico de una arena: rejilla de colisión, línea de visión,
 * campo de flujo para la navegación de los enemigos y luz horneada por celda.
 */
import { ARENAS, isOpaqueChar, isSolidChar, type ArenaDef } from './arenas'

export interface LightSrc {
  x: number
  y: number
  z: number
  r: number
  c: [number, number, number]
  alarm?: boolean
}

export class Level {
  readonly def: ArenaDef
  readonly w: number
  readonly h: number
  readonly chars: string[]
  readonly solid: Uint8Array
  readonly opaque: Uint8Array
  /** distancia (en pasos) al jugador; 65535 = inalcanzable */
  readonly flow: Uint16Array
  readonly light: Float32Array
  readonly alarm: Float32Array
  readonly spawns: { x: number; z: number }[] = []
  readonly barrels: { x: number; z: number }[] = []
  readonly lights: LightSrc[] = []
  start = { x: 1.5, z: 1.5 }
  boss = { x: 1.5, z: 1.5 }
  private flowCell = -1
  private queue: Int32Array

  constructor(index: number) {
    const def = ARENAS[index % ARENAS.length]
    this.def = def
    this.chars = def.map
    this.h = def.map.length
    this.w = def.map[0].length
    const n = this.w * this.h
    this.solid = new Uint8Array(n)
    this.opaque = new Uint8Array(n)
    this.flow = new Uint16Array(n)
    this.light = new Float32Array(n * 3)
    this.alarm = new Float32Array(n)
    this.queue = new Int32Array(n)
    let ox = 0
    let oz = 0
    let on = 0
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const ch = this.chars[z][x] ?? '#'
        const i = z * this.w + x
        this.solid[i] = isSolidChar(ch) ? 1 : 0
        this.opaque[i] = isOpaqueChar(ch) ? 1 : 0
        const cx = x + 0.5
        const cz = z + 0.5
        if (ch === 'S') this.spawns.push({ x: cx, z: cz })
        else if (ch === 'P') this.start = { x: cx, z: cz }
        else if (ch === 'B') this.boss = { x: cx, z: cz }
        else if (ch === 'b') this.barrels.push({ x: cx, z: cz })
        else if (ch === 'L') this.lights.push({ x: cx, y: def.ceil - 0.15, z: cz, r: 9, c: def.lamp })
        else if (ch === 'R')
          this.lights.push({ x: cx, y: def.ceil - 0.2, z: cz, r: 8, c: [1, 0.1, 0.05], alarm: true })
        else if (ch === 'V') this.lights.push({ x: cx, y: 1.2, z: cz, r: 3.6, c: [0.25, 0.9, 0.45] })
        else if (ch === '~') this.lights.push({ x: cx, y: 0.3, z: cz, r: 2.2, c: [0.18, 0.5, 0.12] })
        else if (ch === 'D') this.lights.push({ x: cx, y: 2.2, z: cz, r: 3, c: [0.7, 0.12, 0.08] })
        else if (ch === 'O') {
          ox += cx
          oz += cz
          on++
        }
      }
    }
    if (on > 0) {
      this.boss = { x: ox / on, z: oz / on }
      this.lights.push({ x: ox / on, y: 1.2, z: oz / on, r: 10, c: [1.2, 0.55, 0.2] })
    }
    // luz horneada por celda (para sprites)
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) {
        const l = this.lightAt(x + 0.5, 0.7, z + 0.5, 0, 0, 0)
        const i = z * this.w + x
        this.light[i * 3] = l[0]
        this.light[i * 3 + 1] = l[1]
        this.light[i * 3 + 2] = l[2]
        this.alarm[i] = l[3]
      }
  }

  /** Luz estática en un punto con normal opcional (nx,ny,nz) → [r,g,b,alarma]. */
  lightAt(x: number, y: number, z: number, nx: number, ny: number, nz: number): [number, number, number, number] {
    const a = this.def.ambient
    let r = a[0]
    let g = a[1]
    let b = a[2]
    let al = 0
    const hasN = nx !== 0 || ny !== 0 || nz !== 0
    for (const L of this.lights) {
      const dx = L.x - x
      const dy = L.y - y
      const dz = L.z - z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d >= L.r) continue
      let k = 1 - d / L.r
      k *= k
      if (hasN) {
        const ndl = (dx * nx + dy * ny + dz * nz) / Math.max(0.001, d)
        if (ndl <= 0) continue
        k *= 0.35 + 0.65 * ndl
      }
      if (L.alarm) al += k * 1.4
      else {
        r += L.c[0] * k
        g += L.c[1] * k
        b += L.c[2] * k
      }
    }
    return [r, g, b, al]
  }

  isSolid(x: number, z: number): boolean {
    const ix = Math.floor(x)
    const iz = Math.floor(z)
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return true
    return this.solid[iz * this.w + ix] === 1
  }

  isOpaque(ix: number, iz: number): boolean {
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return true
    return this.opaque[iz * this.w + ix] === 1
  }

  cellLight(x: number, z: number, out: number[]): void {
    const ix = Math.max(0, Math.min(this.w - 1, Math.floor(x)))
    const iz = Math.max(0, Math.min(this.h - 1, Math.floor(z)))
    const i = iz * this.w + ix
    out[0] = this.light[i * 3]
    out[1] = this.light[i * 3 + 1]
    out[2] = this.light[i * 3 + 2]
    out[3] = this.alarm[i]
  }

  /** Mueve un círculo deslizando contra los muros. Devuelve true si chocó. */
  move(e: { x: number; z: number }, dx: number, dz: number, r: number): boolean {
    let hit = false
    const nx = e.x + dx
    if (!this.blocked(nx, e.z, r)) e.x = nx
    else hit = true
    const nz = e.z + dz
    if (!this.blocked(e.x, nz, r)) e.z = nz
    else hit = true
    return hit
  }

  blocked(x: number, z: number, r: number): boolean {
    return (
      this.isSolid(x - r, z - r) || this.isSolid(x + r, z - r) || this.isSolid(x - r, z + r) || this.isSolid(x + r, z + r)
    )
  }

  /**
   * Distancia hasta el primer muro opaco por un rayo (DDA). maxD acota.
   * Devuelve la distancia y deja en hitOut la celda y la cara golpeada.
   */
  rayWall(x: number, z: number, dx: number, dz: number, maxD: number, hitOut?: { nx: number; nz: number }): number {
    let ix = Math.floor(x)
    let iz = Math.floor(z)
    const stepX = dx > 0 ? 1 : -1
    const stepZ = dz > 0 ? 1 : -1
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity
    const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity
    let tmx = dx !== 0 ? (dx > 0 ? ix + 1 - x : x - ix) * tdx : Infinity
    let tmz = dz !== 0 ? (dz > 0 ? iz + 1 - z : z - iz) * tdz : Infinity
    let t = 0
    for (let guard = 0; guard < 128; guard++) {
      let side: number
      if (tmx < tmz) {
        t = tmx
        tmx += tdx
        ix += stepX
        side = 0
      } else {
        t = tmz
        tmz += tdz
        iz += stepZ
        side = 1
      }
      if (t > maxD) return maxD
      if (this.isOpaque(ix, iz)) {
        if (hitOut) {
          hitOut.nx = side === 0 ? -stepX : 0
          hitOut.nz = side === 1 ? -stepZ : 0
        }
        return t
      }
    }
    return maxD
  }

  los(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax
    const dz = bz - az
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < 0.01) return true
    return this.rayWall(ax, az, dx / d, dz / d, d) >= d - 0.01
  }

  /** Recalcula el campo de flujo (BFS 8-direcciones) desde la celda del jugador. */
  updateFlow(px: number, pz: number, force = false) {
    const cx = Math.floor(px)
    const cz = Math.floor(pz)
    const c = cz * this.w + cx
    if (!force && c === this.flowCell) return
    this.flowCell = c
    this.flow.fill(65535)
    const q = this.queue
    let head = 0
    let tail = 0
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return
    this.flow[c] = 0
    q[tail++] = c
    const W = this.w
    while (head < tail) {
      const cur = q[head++]
      const x = cur % W
      const z = (cur - x) / W
      const d = this.flow[cur] + 1
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue
          const nx = x + dx
          const nz = z + dz
          if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue
          const ni = nz * W + nx
          if (this.solid[ni] || this.flow[ni] !== 65535) continue
          // sin cortar esquinas
          if (dx && dz && (this.solid[z * W + nx] || this.solid[nz * W + x])) continue
          this.flow[ni] = d
          q[tail++] = ni
        }
    }
  }

  /** Dirección (unitaria) para acercarse al jugador según el campo de flujo. */
  flowDir(x: number, z: number, out: { x: number; z: number }): boolean {
    const cx = Math.floor(x)
    const cz = Math.floor(z)
    const W = this.w
    let best = cx >= 0 && cz >= 0 && cx < W && cz < this.h ? this.flow[cz * W + cx] : 65535
    let bx = 0
    let bz = 0
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue
        const ni = nz * W + nx
        if (this.solid[ni]) continue
        if (dx && dz && (this.solid[cz * W + nx] || this.solid[nz * W + cx])) continue
        const f = this.flow[ni]
        if (f < best) {
          best = f
          bx = nx + 0.5
          bz = nz + 0.5
        }
      }
    if (!bx && !bz) return false
    const ddx = bx - x
    const ddz = bz - z
    const d = Math.sqrt(ddx * ddx + ddz * ddz) || 1
    out.x = ddx / d
    out.z = ddz / d
    return true
  }

  /** Celda libre aleatoria cerca de (x,z). */
  freeSpotNear(x: number, z: number, radius: number): { x: number; z: number } {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.random() * radius
      const px = x + Math.cos(a) * d
      const pz = z + Math.sin(a) * d
      if (!this.blocked(px, pz, 0.35)) return { x: px, z: pz }
    }
    return { x, z }
  }
}
