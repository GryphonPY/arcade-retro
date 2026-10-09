/**
 * Renderizador pseudo 3D: proyección por segmentos, carretera con niebla,
 * túneles, puentes, sprites escalados, coches, cielo con parallax y efectos.
 */
import type { SpriteKind, Theme, Tod } from './data'
import { CAR_HALF, SPRITE_W, type Car, type Race } from './race'
import { buildScenery, LW, type Scenery } from './scenery'
import { buildSprites, CAR_H, CAR_W, carFrames, glowSprite, paintPickup, PICK_SIZE, type CarFrames, type SpriteDef } from './sprites'
import { findSeg, LANES, RAIL_X, ROAD_W, SEG_LEN, START_SEG, TUNNEL_H, WALL_X, type Seg, type Track } from './track'
import { clamp, FOG_STEPS, fogRamp, hex, lerp, mixHex, tintHex } from './util'

export const VIEW_H = 360
export const HORIZON = 0.5
export const CAM_H = 1000
export const CAM_DEPTH = 1 / Math.tan(((100 / 2) * Math.PI) / 180)
const CAR_WORLD = CAR_HALF * 2 * ROAD_W * (CAR_W / 62)
const NO_FLIP = new Set<SpriteKind>(['billboard', 'billboard2', 'billboard3', 'chevL', 'chevR', 'gantry', 'neon'])

interface Pal {
  road: string[][]
  rumble: string[][]
  lane: string[]
  ground: string[][]
  shoulder: string[][] | null
  water: string[][]
  tRoad: string[][]
  tRumble: string[][]
  tGround: string[]
  tWall: string[][]
  tCeil: string[][]
  rail: string[][]
  facade: string
  facadeDark: string
  facadeLine: string
  light: string
}

interface Smoke {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  col: string
  a: number
}
interface Flake {
  x: number
  y: number
  vx: number
  vy: number
  s: number
}

export interface DrawOpts {
  time: number
  dt: number
  shakeX: number
  shakeY: number
  /** Coche a seguir (índice); 0 = jugador. */
  follow?: number
  hidePlayer?: boolean
}

export class Renderer {
  W = 640
  H = VIEW_H
  P = VIEW_H * (1 - HORIZON)
  dd = 260
  track: Track | null = null
  sprites: Record<SpriteKind, SpriteDef> | null = null
  scenery: Scenery | null = null
  pal: Pal | null = null
  theme: Theme | null = null
  tod: Tod | null = null
  cars: CarFrames[] = []
  pick: Record<string, HTMLCanvasElement> = {}
  glowRed = glowSprite('rgba(255,40,40,0.9)')
  glowWhite = glowSprite('rgba(255,240,200,0.85)')
  glowBlue = glowSprite('rgba(90,170,255,0.95)')
  glowGold = glowSprite('rgba(255,210,80,0.9)')
  glowCyan = glowSprite('rgba(80,240,255,0.9)')
  smoke: Smoke[] = []
  flakes: Flake[] = []
  nitroFx = 0
  tilt = 0
  speedLines: { a: number; r: number; l: number; life: number }[] = []
  /** Coordenadas del coche del jugador en pantalla (para efectos). */
  px = 0
  py = 0
  pw = 0

  constructor(public ctx: CanvasRenderingContext2D) {
    for (const k of ['nitro', 'shield', 'magnet', 'coin'] as const) this.pick[k] = paintPickup(k)
  }

  setTrack(track: Track, race: Race) {
    this.track = track
    this.theme = track.theme
    this.tod = track.tod
    this.sprites = buildSprites(track.tod.light, track.tod.night)
    for (const k of Object.keys(this.sprites) as SpriteKind[]) SPRITE_W[k] = { w: this.sprites[k].w, hit: this.sprites[k].hit }
    this.scenery = buildScenery(track.theme, track.tod, track.meta.seed)
    this.pal = makePal(track.theme, track.tod)
    this.cars = race.cars.map((c) => carFrames(c.body, c.colors, track.tod.night))
    this.smoke = []
    this.flakes = []
    this.speedLines = []
  }

  setCars(race: Race) {
    if (!this.tod) return
    const night = this.tod.night
    this.cars = race.cars.map((c) => carFrames(c.body, c.colors, night))
  }

  // ===================== mundo =====================

  draw(race: Race, o: DrawOpts) {
    const { ctx, W, H } = this
    const t = race.track
    const pal = this.pal
    const sc = this.scenery
    if (!pal || !sc || !this.sprites) return
    const follow = race.cars[o.follow ?? 0]
    const pl = race.pl
    const P = this.P
    const horizon = H * HORIZON
    this.nitroFx = lerp(this.nitroFx, pl.nitroOn || pl.boostT > 0 ? 1 : 0, Math.min(1, o.dt * 4))
    const depth = CAM_DEPTH * (1 - 0.1 * this.nitroFx)
    const playerZ = CAM_H * depth
    const camZ = ((follow.z - playerZ) % t.length + t.length) % t.length
    const base = findSeg(t, camZ)
    const basePct = (camZ % SEG_LEN) / SEG_LEN
    const pSeg = findSeg(t, follow.z)
    const pPct = (follow.z % SEG_LEN) / SEG_LEN
    const playerY = lerp(pSeg.wy1, pSeg.wy2, pPct)
    // traqueteo de la arena: suave (senoidal) para que no se vea entrecortado
    const offBump = pl.offroad && follow.player ? (Math.sin(o.time * 37) + Math.sin(o.time * 23)) * 15 * Math.min(1, follow.speed / 6000) : 0
    const camY = playerY + CAM_H + offBump
    const camXw = (follow.player ? pl.camX : follow.x) * ROAD_W
    const sp = follow.speed / Math.max(1, race.stats.top)

    // inclinación de cámara
    const tiltTarget = follow.player ? -(pl.steer * 0.014 + pSeg.curve * Math.min(1, sp) * 0.0035) : -pSeg.curve * 0.003
    this.tilt = lerp(this.tilt, tiltTarget, Math.min(1, o.dt * 5))

    ctx.save()
    ctx.translate(o.shakeX, o.shakeY)
    if (Math.abs(this.tilt) > 0.0005) {
      ctx.translate(W / 2, H * 0.72)
      ctx.rotate(this.tilt)
      ctx.scale(1.06, 1.06)
      ctx.translate(-W / 2, -H * 0.72)
    }

    this.drawSky(race.sky, horizon, playerY)

    // ---------- proyección ----------
    const N = t.N
    const dd = Math.min(this.dd, N - 1)
    let maxy = H
    let x = 0
    let dx = -(base.curve * basePct)
    let pN = -1
    for (let n = 0; n < dd; n++) {
      const s = t.segs[(base.i + n) % N]
      const looped = s.i < base.i ? t.length : 0
      const z1 = s.i * SEG_LEN + looped - camZ
      const z2 = z1 + SEG_LEN
      s.cz1 = z1
      s.cz2 = z2
      const k1 = depth / Math.max(z1, 0.001)
      const k2 = depth / z2
      s.sc1 = k1
      s.sc2 = k2
      s.sx1 = W / 2 + (-camXw - x) * k1 * P
      s.sy1 = horizon + (camY - s.wy1) * k1 * P
      s.sw1 = ROAD_W * k1 * P
      s.sx2 = W / 2 + (-camXw - x - dx) * k2 * P
      s.sy2 = horizon + (camY - s.wy2) * k2 * P
      s.sw2 = ROAD_W * k2 * P
      x += dx
      dx += s.curve
      const d = n / dd
      s.fog = Math.min(FOG_STEPS - 1, Math.floor((1 - Math.exp(-d * d * 3.2)) * FOG_STEPS))
      s.clip = maxy
      if (z1 <= depth || s.sy2 >= s.sy1 || s.sy2 >= maxy) s.vis = false
      else {
        s.vis = true
        maxy = s.sy2
      }
      if (s === pSeg) pN = n
    }

    // ---------- dibujo de atrás hacia adelante ----------
    const segs = t.segs
    for (let n = dd - 1; n >= 0; n--) {
      const s = segs[(base.i + n) % N]
      if (s.vis) this.drawSegment(s, pal)
      const valid = s.cz1 > depth
      if (valid) {
        if (s.tunnel) this.drawTunnel(s, pal)
        else if (s.bridge) this.drawRails(s, pal)
        if (s.tStart) this.drawFacade(s, pal)
        if (s.sprites && n > 0) this.drawSprites(s, n / dd)
        if (s.pickups && n > 0) this.drawPickups(s, race, o.time)
      }
      if (s.cars.length && valid) this.drawCars(s, race, o.time, follow)
      if (n === pN && !o.hidePlayer) this.drawPlayer(race, follow, pSeg, pPct, o)
    }
    if (pN < 0 && !o.hidePlayer) this.drawPlayer(race, follow, pSeg, pPct, o)

    this.drawWeather(o.dt, sp)
    ctx.restore()
    if (follow.player) this.drawSpeedFx(race, o.dt)
  }

  /** Fondo estático (cielo + suelo + carretera) para el podio. */
  drawBackdrop(time: number) {
    const { ctx, W, H } = this
    const pal = this.pal
    if (!pal || !this.scenery) return
    const horizon = H * HORIZON
    this.drawSky(time * 0.6, horizon, 0)
    const g = ctx.createLinearGradient(0, horizon, 0, H)
    g.addColorStop(0, pal.ground[0][FOG_STEPS - 6])
    g.addColorStop(1, pal.ground[0][0])
    ctx.fillStyle = g
    ctx.fillRect(0, horizon, W, H - horizon)
    const half = W * 0.7
    this.quad(W / 2 - half, H, W / 2 + half, H, W / 2 + 3, horizon, W / 2 - 3, horizon, pal.road[0][6])
    this.quad(W / 2 - half, H, W / 2 - half * 0.9, H, W / 2 - 2.6, horizon, W / 2 - 3, horizon, pal.rumble[1][4])
    this.quad(W / 2 + half, H, W / 2 + half * 0.9, H, W / 2 + 2.6, horizon, W / 2 + 3, horizon, pal.rumble[1][4])
  }

  private drawSky(off: number, horizon: number, playerY: number) {
    const { ctx, W, H } = this
    const sc = this.scenery as Scenery
    const g = ctx.createLinearGradient(0, -20, 0, horizon + 4)
    g.addColorStop(0, sc.sky[0])
    g.addColorStop(0.45, sc.sky[1])
    g.addColorStop(0.8, sc.sky[2])
    g.addColorStop(1, sc.sky[3])
    ctx.fillStyle = g
    ctx.fillRect(-40, -40, W + 80, horizon + 44)
    const lift = clamp(-playerY * 0.0016, -30, 30)
    if (sc.stars) this.tile(sc.stars, off * 0.0006, horizon - 196 + lift * 0.2, 1)
    // sol / luna
    const sx = W * 0.5 + ((-off * 0.0012 * LW) % (W * 2) + W * 3) % (W * 2) - W
    const sy = horizon + sc.sunY + lift * 0.3
    const gw = sc.sunGlow.width
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(sc.sunGlow, sx - gw / 2, sy - gw / 2)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(sc.sun, Math.round(sx - sc.sun.width / 2), Math.round(sy - sc.sun.height / 2))
    if (sc.clouds) this.tile(sc.clouds, off * 0.0016, horizon - 150 + lift * 0.4, 1)
    // bajo el horizonte
    this.tile(sc.below, off * 0.004, horizon + lift, 1)
    ctx.fillStyle = sc.sea ? '#0d3a66' : (this.pal as Pal).ground[0][FOG_STEPS - 4]
    ctx.fillRect(-40, horizon + lift + sc.below.height - 1, W + 80, H)
    for (const L of sc.layers) this.tile(L.img, off * L.speed, horizon - L.img.height + 2 + lift * (1 + L.vy * 10), 1)
    // bruma del horizonte
    const hz = ctx.createLinearGradient(0, horizon - 40 + lift, 0, horizon + 6 + lift)
    const [r, gg, b] = hex(sc.fog)
    hz.addColorStop(0, `rgba(${r},${gg},${b},0)`)
    hz.addColorStop(1, `rgba(${r},${gg},${b},0.55)`)
    ctx.fillStyle = hz
    ctx.fillRect(-40, horizon - 40 + lift, W + 80, 46)
  }

  private tile(img: HTMLCanvasElement, offset: number, y: number, k: number) {
    const { ctx, W } = this
    const w = img.width * k
    let x0 = -((offset * LW) % w)
    if (x0 > 0) x0 -= w
    x0 -= 40
    for (let x = x0; x < W + 40; x += w) ctx.drawImage(img, Math.round(x), Math.round(y), w, img.height * k)
  }

  private quad(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, col: string) {
    const c = this.ctx
    c.fillStyle = col
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    c.lineTo(x3, y3)
    c.lineTo(x4, y4)
    c.closePath()
    c.fill()
  }

  private drawSegment(s: Seg, pal: Pal) {
    const c = this.ctx
    const f = s.fog
    const a = s.alt
    const { sx1, sy1, sw1, sx2, sw2 } = s
    const sy2 = s.sy2 - 0.6
    const W = this.W
    const top = Math.floor(sy2)
    const h = Math.ceil(sy1) - top + 1
    // terreno
    c.fillStyle = s.tunnel ? pal.tGround[a] : s.bridge ? pal.water[a][f] : pal.ground[a][f]
    c.fillRect(-60, top, W + 120, h)
    const r1 = sw1 / 6
    const r2 = sw2 / 6
    if (pal.shoulder && !s.tunnel && !s.bridge) {
      const k1 = sw1 * 0.42
      const k2 = sw2 * 0.42
      const col = pal.shoulder[a][f]
      this.quad(sx1 - sw1 - r1 - k1, sy1, sx1 - sw1, sy1, sx2 - sw2, sy2, sx2 - sw2 - r2 - k2, sy2, col)
      this.quad(sx1 + sw1 + r1 + k1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 + sw2 + r2 + k2, sy2, col)
    }
    // bordillos
    const rum = s.tunnel ? pal.tRumble[a][f] : pal.rumble[a][f]
    this.quad(sx1 - sw1 - r1, sy1, sx1 - sw1, sy1, sx2 - sw2, sy2, sx2 - sw2 - r2, sy2, rum)
    this.quad(sx1 + sw1 + r1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 + sw2 + r2, sy2, rum)
    // asfalto
    const isStart = s.i === START_SEG || s.i === START_SEG + 1
    if (isStart) {
      this.quad(sx1 - sw1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 - sw2, sy2, '#f4f4f4')
      const cells = 12
      const half = (sy1 + sy2) / 2
      for (let i = 0; i < cells; i++) {
        const u0 = -1 + (2 * i) / cells
        const u1 = -1 + (2 * (i + 1)) / cells
        const row = (i + (s.i - START_SEG)) % 2
        const yA = row ? sy1 : half
        const yB = row ? half : sy2
        const kA = row ? 1 : 0.5
        const xa0 = lerp(sx2 + sw2 * u0, sx1 + sw1 * u0, kA)
        const xa1 = lerp(sx2 + sw2 * u1, sx1 + sw1 * u1, kA)
        const kB = row ? 0.5 : 0
        const xb0 = lerp(sx2 + sw2 * u0, sx1 + sw1 * u0, kB)
        const xb1 = lerp(sx2 + sw2 * u1, sx1 + sw1 * u1, kB)
        this.quad(xa0, yA, xa1, yA, xb1, yB, xb0, yB, '#16161c')
      }
      return
    }
    this.quad(sx1 - sw1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 - sw2, sy2, s.tunnel ? pal.tRoad[a][f] : pal.road[a][f])
    if (a === 0 && sw2 > 6) {
      const l1 = sw1 / 40
      const l2 = sw2 / 40
      const lw1 = (sw1 * 2) / LANES
      const lw2 = (sw2 * 2) / LANES
      const col = pal.lane[f]
      for (let lane = 1; lane < LANES; lane++) {
        const lx1 = sx1 - sw1 + lw1 * lane
        const lx2 = sx2 - sw2 + lw2 * lane
        this.quad(lx1 - l1 / 2, sy1, lx1 + l1 / 2, sy1, lx2 + l2 / 2, sy2, lx2 - l2 / 2, sy2, col)
      }
    }
  }

  private drawTunnel(s: Seg, pal: Pal) {
    const { sx1, sy1, sw1, sx2, sy2, sw2, sc1, sc2 } = s
    const P = this.P
    const a = s.alt
    const f = s.fog
    const L1 = sx1 - sw1 * WALL_X
    const R1 = sx1 + sw1 * WALL_X
    const L2 = sx2 - sw2 * WALL_X
    const R2 = sx2 + sw2 * WALL_X
    const c1 = sy1 - TUNNEL_H * sc1 * P
    const c2 = sy2 - TUNNEL_H * sc2 * P
    this.quad(L1, sy1 + 1, L2, sy2, L2, c2, L1, c1, pal.tWall[a][f])
    this.quad(R1, sy1 + 1, R2, sy2, R2, c2, R1, c1, pal.tWall[a][f])
    this.quad(L1, c1, R1, c1, R2, c2, L2, c2, pal.tCeil[a][f])
    // franja inferior de la pared
    const b1 = sy1 - 300 * sc1 * P
    const b2 = sy2 - 300 * sc2 * P
    this.quad(L1, sy1 + 1, L2, sy2, L2, b2, L1, b1, pal.tCeil[1 - a][f])
    this.quad(R1, sy1 + 1, R2, sy2, R2, b2, R1, b1, pal.tCeil[1 - a][f])
    if (s.i % 8 === 0) {
      const lw1 = sw1 * 0.12
      const lw2 = sw2 * 0.12
      this.quad(sx1 - lw1, c1, sx1 + lw1, c1, sx2 + lw2, c2, sx2 - lw2, c2, pal.light)
      // lámparas en las paredes
      const wy1 = sy1 - TUNNEL_H * 0.7 * sc1 * P
      const wy2 = sy2 - TUNNEL_H * 0.7 * sc2 * P
      const hh = (sy1 - c1) * 0.04
      this.quad(L1, wy1, L2, wy2, L2, wy2 + hh * 0.5, L1, wy1 + hh, pal.light)
      this.quad(R1, wy1, R2, wy2, R2, wy2 + hh * 0.5, R1, wy1 + hh, pal.light)
    }
  }

  private drawRails(s: Seg, pal: Pal) {
    const { sx1, sy1, sw1, sx2, sy2, sw2, sc1, sc2 } = s
    const P = this.P
    const f = s.fog
    const H1 = 520 * sc1 * P
    const H2 = 520 * sc2 * P
    const L1 = sx1 - sw1 * RAIL_X
    const R1 = sx1 + sw1 * RAIL_X
    const L2 = sx2 - sw2 * RAIL_X
    const R2 = sx2 + sw2 * RAIL_X
    // poste
    if (s.i % 2 === 0) {
      const pw = Math.max(1, sw1 * 0.03)
      this.ctx.fillStyle = pal.rail[1][f]
      this.ctx.fillRect(L1 - pw, sy1 - H1, pw, H1)
      this.ctx.fillRect(R1, sy1 - H1, pw, H1)
    }
    // barandal superior
    this.quad(L1, sy1 - H1, L2, sy2 - H2, L2, sy2 - H2 * 0.8, L1, sy1 - H1 * 0.8, pal.rail[0][f])
    this.quad(R1, sy1 - H1, R2, sy2 - H2, R2, sy2 - H2 * 0.8, R1, sy1 - H1 * 0.8, pal.rail[0][f])
    this.quad(L1, sy1 - H1 * 0.45, L2, sy2 - H2 * 0.45, L2, sy2 - H2 * 0.35, L1, sy1 - H1 * 0.35, pal.rail[s.alt][f])
    this.quad(R1, sy1 - H1 * 0.45, R2, sy2 - H2 * 0.45, R2, sy2 - H2 * 0.35, R1, sy1 - H1 * 0.35, pal.rail[s.alt][f])
  }

  private drawFacade(s: Seg, pal: Pal) {
    const c = this.ctx
    const { sx1, sy1, sw1, sc1 } = s
    const P = this.P
    const L = sx1 - sw1 * WALL_X
    const R = sx1 + sw1 * WALL_X
    const ceil = sy1 - TUNNEL_H * sc1 * P
    const top = sy1 - (TUNNEL_H + 4200) * sc1 * P
    const ext = sw1 * 9
    c.fillStyle = pal.facade
    c.fillRect(sx1 - ext, top, ext * 2, ceil - top)
    c.fillRect(sx1 - ext, ceil - 1, L - (sx1 - ext), sy1 - ceil + 1)
    c.fillRect(R, ceil - 1, sx1 + ext - R, sy1 - ceil + 1)
    // bloques de piedra
    c.fillStyle = pal.facadeLine
    const rows = 7
    for (let i = 1; i < rows; i++) {
      const y = top + ((sy1 - top) * i) / rows
      c.fillRect(sx1 - ext, y, ext * 2, Math.max(1, sw1 * 0.012))
    }
    // marco del portal
    c.fillStyle = pal.facadeDark
    const fw = sw1 * 0.08
    c.fillRect(L - fw, ceil - fw, R - L + fw * 2, fw)
    c.fillRect(L - fw, ceil, fw, sy1 - ceil)
    c.fillRect(R, ceil, fw, sy1 - ceil)
    // cresta irregular
    c.fillStyle = pal.facade
    const step = ext / 6
    for (let i = -6; i < 6; i++) {
      const hh = (Math.sin(i * 1.7 + s.i) * 0.5 + 0.8) * sw1 * 0.5
      c.fillRect(sx1 + i * step, top - hh, step + 1, hh + 1)
    }
  }

  private drawSprites(s: Seg, d: number) {
    const c = this.ctx
    const spr = this.sprites as Record<SpriteKind, SpriteDef>
    const P = this.P
    const alpha = d > 0.72 ? clamp((1 - d) / 0.28, 0, 1) : 1
    if (alpha <= 0.02) return
    if (alpha < 1) c.globalAlpha = alpha
    for (const it of s.sprites as { kind: SpriteKind; x: number }[]) {
      const def = spr[it.kind]
      const img = it.x > 0 && !NO_FLIP.has(it.kind) ? def.flip : def.img
      const dw = def.w * s.sc1 * P
      if (dw < 0.8) continue
      const dh = (dw * img.height) / img.width
      let dx = s.sx1 + s.sc1 * it.x * ROAD_W * P
      if (it.x < 0) dx -= dw
      else if (it.x === 0) dx -= dw / 2
      const dy = s.sy1 - dh
      const clipH = Math.max(0, dy + dh - s.clip)
      if (clipH >= dh) continue
      const srcH = img.height - (img.height * clipH) / dh
      if (dx > this.W + 40 || dx + dw < -40) continue
      c.drawImage(img, 0, 0, img.width, srcH, dx, dy, dw, dh - clipH)
    }
    c.globalAlpha = 1
  }

  private drawPickups(s: Seg, race: Race, time: number) {
    const c = this.ctx
    const P = this.P
    const lapId = Math.floor(race.cars[0].d / race.track.length)
    for (const p of s.pickups ?? []) {
      if (p.takenLap === lapId) continue
      const size = 320 * s.sc1 * P
      if (size < 1.5) continue
      const x = s.sx1 + s.sc1 * (p.x + p.dx) * ROAD_W * P
      const bob = Math.sin(time * 4 + s.i) * size * 0.12
      const y = s.sy1 - size * 1.1 + bob
      if (y > s.clip) continue
      const img = this.pick[p.kind]
      const glow = p.kind === 'coin' ? this.glowGold : p.kind === 'nitro' ? this.glowBlue : p.kind === 'shield' ? this.glowCyan : this.glowRed
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = 0.55
      c.drawImage(glow, x - size, y - size * 0.5, size * 2, size * 2)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
      let w = size
      if (p.kind === 'coin') w = size * Math.max(0.15, Math.abs(Math.cos(time * 5 + s.i * 0.7)))
      c.drawImage(img, 0, 0, PICK_SIZE, PICK_SIZE, x - w / 2, y, w, size)
      // sombra
      c.fillStyle = 'rgba(0,0,0,0.25)'
      c.fillRect(x - size * 0.35, s.sy1 - size * 0.06, size * 0.7, Math.max(1, size * 0.08))
    }
  }

  private carFrame(c: Car, frames: CarFrames, steer: number, brake: boolean, time: number): [HTMLCanvasElement, boolean] {
    let s = steer
    if (c.spin > 0) {
      const seq = [0, 1, 2, 1, 0, -1, -2, -1]
      s = seq[Math.floor(time * 22) % 8] / 2
    }
    const a = Math.abs(s)
    const ti = a > 0.62 ? 2 : a > 0.22 ? 1 : 0
    return [frames.frames[ti][brake ? 1 : 0], s < 0 && ti > 0]
  }

  private blitCar(img: HTMLCanvasElement, flip: boolean, x: number, y: number, w: number, h: number, clipY: number) {
    const c = this.ctx
    const clipH = Math.max(0, y + h - clipY)
    if (clipH >= h) return
    const srcH = CAR_H - (CAR_H * clipH) / h
    if (flip) {
      c.save()
      c.translate(x + w, y)
      c.scale(-1, 1)
      c.drawImage(img, 0, 0, CAR_W, srcH, 0, 0, w, h - clipH)
      c.restore()
    } else c.drawImage(img, 0, 0, CAR_W, srcH, x, y, w, h - clipH)
  }

  private drawCars(s: Seg, race: Race, time: number, follow: Car) {
    const c = this.ctx
    const P = this.P
    const night = this.tod?.night ?? false
    for (const idx of s.cars) {
      const car = race.cars[idx]
      if (car === follow) continue
      const pct = (car.z % SEG_LEN) / SEG_LEN
      const k = lerp(s.sc1, s.sc2, pct)
      if (s.cz1 + pct * SEG_LEN <= CAM_DEPTH * 1.2) continue
      const w = CAR_WORLD * k * P
      if (w < 2) continue
      const h = (w * CAR_H) / CAR_W
      const x = lerp(s.sx1, s.sx2, pct) + k * car.x * ROAD_W * P
      const y = lerp(s.sy1, s.sy2, pct)
      car.sx = x
      car.sy = y - h * 0.5
      car.sw = w
      car.onScreen = true
      if (y - h > s.clip) continue
      c.fillStyle = 'rgba(0,0,0,0.32)'
      c.beginPath()
      c.ellipse(x, y - h * 0.04, w * 0.47, Math.max(1, h * 0.09), 0, 0, Math.PI * 2)
      c.fill()
      const frames = this.cars[idx]
      if (!frames) continue
      const brake = car.brakeVis > 0
      const [img, flip] = this.carFrame(car, frames, car.steerVis, brake, time)
      this.blitCar(img, flip, x - w / 2, y - h, w, h, s.clip)
      if ((brake || night) && w > 8) {
        c.globalCompositeOperation = 'lighter'
        c.globalAlpha = brake ? 0.8 : 0.45
        const gs = w * 0.32
        c.drawImage(this.glowRed, x - w * 0.3 - gs / 2, y - h * 0.48 - gs / 2, gs, gs)
        c.drawImage(this.glowRed, x + w * 0.3 - gs / 2, y - h * 0.48 - gs / 2, gs, gs)
        c.globalAlpha = 1
        c.globalCompositeOperation = 'source-over'
      }
      if (car.nitroT > 0 && w > 8) this.flames(x, y - h * 0.18, w, 0.8)
    }
  }

  private flames(x: number, y: number, w: number, k: number) {
    const c = this.ctx
    c.globalCompositeOperation = 'lighter'
    for (const side of [-1, 1]) {
      const fx = x + side * w * 0.2
      const len = w * (0.12 + Math.random() * 0.1) * k
      c.globalAlpha = 0.9
      c.fillStyle = '#60a5fa'
      c.beginPath()
      c.ellipse(fx, y + len * 0.4, w * 0.045, len, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#fef3c7'
      c.beginPath()
      c.ellipse(fx, y + len * 0.25, w * 0.022, len * 0.5, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
  }

  private drawPlayer(race: Race, car: Car, seg: Seg, pct: number, o: DrawOpts) {
    const c = this.ctx
    const pl = race.pl
    const P = this.P
    const k = lerp(seg.sc1, seg.sc2, pct)
    const w = CAR_WORLD * k * P
    const h = (w * CAR_H) / CAR_W
    const roadX = lerp(seg.sx1, seg.sx2, pct)
    const sp = car.speed / Math.max(1, race.stats.top)
    let x = roadX + k * car.x * ROAD_W * P
    let y = lerp(seg.sy1, seg.sy2, pct)
    const bounce = Math.sin(o.time * 31) * Math.min(1, sp) * 0.8 + (pl.offroad && car.player ? Math.sin(o.time * 41) * 1.5 : 0)
    y += bounce
    if (car.player && pl.drift) x += pl.driftDir * -w * 0.03 * Math.sin(o.time * 18)
    this.px = x
    this.py = y - h * 0.55
    this.pw = w
    car.sx = x
    car.sy = this.py
    car.sw = w
    const night = this.tod?.night ?? false
    // faros de noche
    if (night && car.player) {
      c.globalCompositeOperation = 'lighter'
      const g = c.createRadialGradient(x, y - h * 1.3, w * 0.1, x, y - h * 1.6, w * 1.6)
      g.addColorStop(0, 'rgba(255,240,190,0.22)')
      g.addColorStop(1, 'rgba(255,240,190,0)')
      c.fillStyle = g
      c.beginPath()
      c.moveTo(x - w * 0.4, y - h * 0.6)
      c.lineTo(x - w * 1.9, y - h * 2.9)
      c.lineTo(x + w * 1.9, y - h * 2.9)
      c.lineTo(x + w * 0.4, y - h * 0.6)
      c.closePath()
      c.fill()
      c.globalCompositeOperation = 'source-over'
    }
    // sombra
    c.fillStyle = 'rgba(0,0,0,0.38)'
    c.beginPath()
    c.ellipse(x, y - h * 0.04, w * 0.48, h * 0.1, 0, 0, Math.PI * 2)
    c.fill()
    // humo de llantas
    const skid = car.player ? (pl.drift ? 1 : pl.braking && sp > 0.4 ? 0.7 : race.phase === 'countdown' && pl.upHeld > 0 ? 0.6 : 0) : 0
    if (skid > 0 && Math.random() < 0.9) {
      for (const side of [-1, 1]) {
        if (Math.random() > skid) continue
        this.smoke.push({
          x: x + side * w * 0.36 + (Math.random() - 0.5) * 6,
          y: y - h * 0.08,
          vx: (pl.drift ? -pl.driftDir : side) * (20 + Math.random() * 40),
          vy: -10 - Math.random() * 20,
          r: w * 0.06,
          life: 0.7,
          max: 0.7,
          col: '#e8e4ec',
          a: 0.5,
        })
      }
    }
    if (car.player && pl.offroad && sp > 0.15) {
      const g = (this.pal as Pal).ground[0][2]
      for (const side of [-1, 1]) {
        this.smoke.push({
          x: x + side * w * 0.36,
          y: y - h * 0.05,
          vx: side * (30 + Math.random() * 50),
          vy: -20 - Math.random() * 40,
          r: w * 0.05,
          life: 0.5,
          max: 0.5,
          col: g,
          a: 0.7,
        })
      }
    }
    this.updateSmoke(o.dt, sp)
    const frames = this.cars[car.idx]
    if (!frames) return
    let steer = car.player ? pl.steer : car.steerVis
    if (car.player && pl.drift) steer = pl.driftDir
    const brake = car.player ? pl.braking : car.brakeVis > 0
    const [img, flip] = this.carFrame(car, frames, steer, brake, o.time)
    this.blitCar(img, flip, x - w / 2, y - h, w, h, 9999)
    // luces de freno
    if (brake || night) {
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = brake ? 0.85 : 0.4
      const gs = w * 0.36
      c.drawImage(this.glowRed, x - w * 0.3 - gs / 2, y - h * 0.48 - gs / 2, gs, gs)
      c.drawImage(this.glowRed, x + w * 0.3 - gs / 2, y - h * 0.48 - gs / 2, gs, gs)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }
    if (car.player && (pl.nitroOn || pl.boostT > 0)) this.flames(x, y - h * 0.16, w, pl.nitroOn ? 1.2 : 0.7)
    // escudo
    if (car.player && pl.shieldT > 0) {
      const blink = pl.shieldT < 1.5 ? (Math.floor(o.time * 10) % 2 ? 0.3 : 1) : 1
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = 0.3 * blink
      c.fillStyle = '#22d3ee'
      c.beginPath()
      c.ellipse(x, y - h * 0.5, w * 0.62, h * 0.85, 0, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.8 * blink
      c.strokeStyle = '#a5f3fc'
      c.lineWidth = 1.5
      c.beginPath()
      c.ellipse(x, y - h * 0.5, w * 0.62 + Math.sin(o.time * 8) * 1.5, h * 0.85, 0, 0, Math.PI * 2)
      c.stroke()
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }
    // chispas de carga del derrape
    if (car.player && pl.drift && pl.driftT > 0.4) {
      c.globalCompositeOperation = 'lighter'
      const col = pl.driftT > 2 ? '#fb923c' : pl.driftT > 0.9 ? '#60a5fa' : '#e5e7eb'
      c.fillStyle = col
      for (let i = 0; i < 6; i++) {
        const sx = x + (Math.random() < 0.5 ? -1 : 1) * w * 0.38 + (Math.random() - 0.5) * 6
        const sy = y - Math.random() * h * 0.2
        c.fillRect(sx, sy, 2, 2)
      }
      c.globalCompositeOperation = 'source-over'
    }
  }

  private updateSmoke(dt: number, sp: number) {
    const c = this.ctx
    for (const p of this.smoke) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += (p.vy + sp * 40) * dt
      p.r += dt * 18
    }
    this.smoke = this.smoke.filter((p) => p.life > 0)
    if (this.smoke.length > 160) this.smoke.splice(0, this.smoke.length - 160)
    for (const p of this.smoke) {
      c.globalAlpha = (p.life / p.max) * p.a
      c.fillStyle = p.col
      c.beginPath()
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  private drawWeather(dt: number, sp: number) {
    const th = this.theme
    if (!th || th.weather === 'none') return
    const c = this.ctx
    const W = this.W
    const H = this.H
    const want = th.weather === 'snow' ? 90 : th.weather === 'dust' ? 26 : 24
    while (this.flakes.length < want) {
      this.flakes.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 0.5 + Math.random() })
    }
    const steer = this.tilt * 400
    for (const f of this.flakes) {
      if (th.weather === 'snow') {
        f.vy = 30 + f.s * 40 + sp * 80
        f.vx = Math.sin(f.y * 0.05 + f.s * 10) * 12 + steer
      } else if (th.weather === 'dust') {
        f.vx = -40 - sp * 160 + steer
        f.vy = 6 * f.s
      } else {
        f.vy = 18 + f.s * 16
        f.vx = Math.sin(f.y * 0.04 + f.s * 7) * 30 + steer
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      // efecto de avance: se alejan del centro
      const dx = f.x - W / 2
      f.x += dx * sp * dt * 0.9
      if (f.y > H + 4 || f.x < -10 || f.x > W + 10) {
        f.x = Math.random() * W
        f.y = th.weather === 'dust' ? H * 0.4 + Math.random() * H * 0.5 : -4
      }
    }
    c.fillStyle = th.weather === 'snow' ? '#ffffff' : th.weather === 'dust' ? 'rgba(255,220,170,0.6)' : '#3fa04f'
    for (const f of this.flakes) {
      const s = th.weather === 'snow' ? 1 + f.s * 1.4 : th.weather === 'dust' ? 1 : 2 + f.s
      c.fillRect(f.x, f.y, s, th.weather === 'leaves' ? s * 0.6 : s)
    }
  }

  private drawSpeedFx(race: Race, dt: number) {
    const c = this.ctx
    const pl = race.pl
    const W = this.W
    const H = this.H
    const nitro = pl.nitroOn || pl.boostT > 0
    const slip = pl.slip > 0.5
    if ((nitro || (slip && Math.random() < 0.3)) && race.phase === 'racing') {
      const n = nitro ? 3 : 1
      for (let i = 0; i < n; i++) this.speedLines.push({ a: Math.random() * Math.PI * 2, r: 60 + Math.random() * 40, l: 20 + Math.random() * 40, life: 0.35 })
    }
    if (this.speedLines.length) {
      const cx = W / 2
      const cy = H * 0.48
      c.strokeStyle = nitro ? 'rgba(190,225,255,0.55)' : 'rgba(255,255,255,0.35)'
      c.lineWidth = 1.2
      c.beginPath()
      for (const s of this.speedLines) {
        s.life -= dt
        s.r += dt * 900
        const x1 = cx + Math.cos(s.a) * s.r * 1.6
        const y1 = cy + Math.sin(s.a) * s.r
        const x2 = cx + Math.cos(s.a) * (s.r + s.l) * 1.6
        const y2 = cy + Math.sin(s.a) * (s.r + s.l)
        c.moveTo(x1, y1)
        c.lineTo(x2, y2)
      }
      c.stroke()
      this.speedLines = this.speedLines.filter((s) => s.life > 0)
    }
    if (this.nitroFx > 0.02) {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7)
      g.addColorStop(0, 'rgba(60,140,255,0)')
      g.addColorStop(1, `rgba(60,140,255,${(0.28 * this.nitroFx).toFixed(3)})`)
      c.fillStyle = g
      c.fillRect(0, 0, W, H)
    }
  }
}

function ramp2(a: string, b: string, light: [number, number, number], fog: string, k = 1): string[][] {
  const t = (x: string) => (k === 1 ? tintHex(x, light) : tintHex(x, [light[0] * k, light[1] * k, light[2] * k]))
  return [fogRamp(t(a), fog), fogRamp(t(b), fog)]
}

function makePal(th: Theme, tod: Tod): Pal {
  const L = tod.light
  const fog = tod.fog
  const night = tod.night
  const tunnelFog = '#0a0a10'
  const wall = th.tunnelWall
  return {
    road: ramp2(th.road[0], th.road[1], L, fog),
    rumble: ramp2(th.rumble[0], th.rumble[1], L, fog),
    lane: fogRamp(night ? mixHex(th.lane, '#ffffff', 0.1) : tintHex(th.lane, L), fog),
    ground: ramp2(th.ground[0], th.ground[1], L, fog),
    shoulder: th.shoulder ? ramp2(th.shoulder[0], th.shoulder[1], L, fog) : null,
    water: ramp2(th.water[0], th.water[1], L, fog),
    tRoad: [fogRamp(mixHex(th.road[0], '#000000', 0.45), tunnelFog), fogRamp(mixHex(th.road[1], '#000000', 0.48), tunnelFog)],
    tRumble: [fogRamp(mixHex(th.rumble[0], '#000000', 0.4), tunnelFog), fogRamp(mixHex(th.rumble[1], '#000000', 0.4), tunnelFog)],
    tGround: [mixHex(wall[1], '#000000', 0.6), mixHex(wall[1], '#000000', 0.62)],
    tWall: [fogRamp(mixHex(wall[0], '#000000', 0.35), tunnelFog), fogRamp(mixHex(wall[1], '#000000', 0.4), tunnelFog)],
    tCeil: [fogRamp(mixHex(wall[1], '#000000', 0.6), tunnelFog), fogRamp(mixHex(wall[1], '#000000', 0.66), tunnelFog)],
    rail: [fogRamp(tintHex('#f4f4f4', L), fog), fogRamp(tintHex('#c2412d', L), fog)],
    facade: tintHex(mixHex(wall[0], '#8a8a8a', 0.2), L),
    facadeDark: tintHex(mixHex(wall[1], '#000000', 0.35), L),
    facadeLine: tintHex(mixHex(wall[1], '#000000', 0.15), L),
    light: '#ffe9a8',
  }
}
