/**
 * Control por puntero. Cada dedo (o clic) controla la nave más cercana al
 * punto donde empezó el toque, y la mantiene asignada hasta soltar:
 * - Táctil/lápiz: el primer dedo de una nave la mueve en relativo (el dedo
 *   no tapa la nave); un segundo dedo sobre la misma nave activa el modo
 *   concentrado.
 * - Ratón: con clic mantenido la nave asignada sigue al puntero.
 * - Toques cortos se registran como "tap" para los menús.
 * En un solo jugador todos los punteros van a la nave 0.
 */
import { W, H } from './util'

interface Ptr {
  id: number
  type: string
  /** Nave asignada (0 = J1, 1 = J2). */
  ship: number
  lx: number
  ly: number
  t0: number
  moved: number
  sx: number
  sy: number
}

/** Estado de toque de una nave. */
export interface ShipTouch {
  /** Desplazamiento relativo acumulado, px lógicos. */
  dx: number
  dy: number
  /** Ratón con clic mantenido: la nave sigue a (fx, fy). */
  follow: boolean
  fx: number
  fy: number
  /** Dedos táctiles asignados a esta nave. */
  fingers: number
}

const newShipTouch = (): ShipTouch => ({ dx: 0, dy: 0, follow: false, fx: 0, fy: 0, fingers: 0 })

export class PointerControl {
  private ptrs = new Map<number, Ptr>()
  /** Una entrada por nave (J1, J2). */
  ships: [ShipTouch, ShipTouch] = [newShipTouch(), newShipTouch()]
  hoverX = -1
  hoverY = -1
  hoverMoved = false
  taps: { x: number; y: number; mouse: boolean }[] = []
  /** Se usó táctil alguna vez (para textos de ayuda). */
  touched = false
  /** Elige la nave que recibe un toque nuevo (coordenadas lógicas). */
  pick: (x: number, y: number) => number = () => 0

  constructor(
    private root: HTMLElement,
    private canvas: HTMLCanvasElement,
  ) {
    root.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.cancel)
    canvas.addEventListener('contextmenu', this.noMenu)
  }

  destroy() {
    this.root.removeEventListener('pointerdown', this.down)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.up)
    window.removeEventListener('pointercancel', this.cancel)
    this.canvas.removeEventListener('contextmenu', this.noMenu)
  }

  private noMenu = (e: Event) => e.preventDefault()

  /** Escala px de pantalla → px lógicos. */
  private scale(): number {
    const r = this.canvas.getBoundingClientRect()
    return r.width > 0 ? W / r.width : 1
  }

  toLogical(cx: number, cy: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H }
  }

  private down = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('button, a, input, [data-no-drag]')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType !== 'mouse') this.touched = true
    const q = this.toLogical(e.clientX, e.clientY)
    const ship = this.pick(q.x, q.y) === 1 ? 1 : 0
    this.ptrs.set(e.pointerId, { id: e.pointerId, type: e.pointerType, ship, lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: 0, sx: e.clientX, sy: e.clientY })
    const s = this.ships[ship]
    if (e.pointerType === 'mouse') {
      s.follow = true
      s.fx = q.x
      s.fy = q.y
    } else s.fingers++
  }

  private move = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      const p = this.toLogical(e.clientX, e.clientY)
      this.hoverX = p.x
      this.hoverY = p.y
      this.hoverMoved = true
    }
    const p = this.ptrs.get(e.pointerId)
    if (!p) return
    const ddx = e.clientX - p.lx
    const ddy = e.clientY - p.ly
    p.moved += Math.abs(ddx) + Math.abs(ddy)
    p.lx = e.clientX
    p.ly = e.clientY
    if (p.type === 'mouse') {
      const q = this.toLogical(e.clientX, e.clientY)
      const s = this.ships[p.ship]
      s.fx = q.x
      s.fy = q.y
      return
    }
    // solo el primer dedo de cada nave la mueve
    if (this.firstOf(p.ship) === p.id) {
      const k = this.scale()
      const s = this.ships[p.ship]
      s.dx += ddx * k
      s.dy += ddy * k
    }
  }

  /** Id del primer dedo táctil asignado a la nave. */
  private firstOf(ship: number): number {
    for (const p of this.ptrs.values()) if (p.ship === ship && p.type !== 'mouse') return p.id
    return -1
  }

  private up = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId)
    if (!p) return
    this.ptrs.delete(e.pointerId)
    this.release(p)
    if (p.moved < 14 && performance.now() - p.t0 < 400) {
      const q = this.toLogical(e.clientX, e.clientY)
      this.taps.push({ x: q.x, y: q.y, mouse: p.type === 'mouse' })
    }
  }

  private cancel = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId)
    if (!p) return
    this.ptrs.delete(e.pointerId)
    this.release(p)
  }

  private release(p: Ptr) {
    const s = this.ships[p.ship]
    if (p.type === 'mouse') s.follow = false
    else s.fingers = Math.max(0, s.fingers - 1)
  }

  /** Modo concentrado de una nave: dos o más dedos sobre ella. */
  focusOf(ship: number): boolean {
    return this.ships[ship].fingers >= 2
  }

  consume() {
    for (const s of this.ships) {
      s.dx = 0
      s.dy = 0
    }
    this.taps.length = 0
    this.hoverMoved = false
  }

  reset() {
    this.ptrs.clear()
    this.ships = [newShipTouch(), newShipTouch()]
    this.consume()
  }
}
