/**
 * Control por puntero:
 * - Táctil/lápiz: arrastrar en cualquier parte mueve la nave en relativo
 *   (el dedo no tapa la nave); un segundo dedo activa el modo concentrado.
 * - Ratón: con clic mantenido la nave sigue al puntero.
 * - Toques cortos se registran como "tap" para los menús.
 */
import { W, H } from './util'

interface Ptr {
  id: number
  type: string
  sx: number
  sy: number
  lx: number
  ly: number
  t0: number
  moved: number
}

export class PointerControl {
  private ptrs = new Map<number, Ptr>()
  dx = 0
  dy = 0
  follow = false
  fx = 0
  fy = 0
  hoverX = -1
  hoverY = -1
  hoverMoved = false
  taps: { x: number; y: number; mouse: boolean }[] = []
  /** Se usó táctil alguna vez (para textos de ayuda). */
  touched = false

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
    this.ptrs.set(e.pointerId, { id: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: 0 })
    if (e.pointerType === 'mouse') {
      const p = this.toLogical(e.clientX, e.clientY)
      this.follow = true
      this.fx = p.x
      this.fy = p.y
    }
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
      this.fx = q.x
      this.fy = q.y
      return
    }
    // solo el primer dedo mueve la nave
    const first = this.ptrs.values().next().value as Ptr | undefined
    if (first && first.id === p.id) {
      const k = this.scale()
      this.dx += ddx * k
      this.dy += ddy * k
    }
  }

  private up = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId)
    if (!p) return
    this.ptrs.delete(e.pointerId)
    if (p.type === 'mouse') this.follow = false
    if (p.moved < 14 && performance.now() - p.t0 < 400) {
      const q = this.toLogical(e.clientX, e.clientY)
      this.taps.push({ x: q.x, y: q.y, mouse: p.type === 'mouse' })
    }
  }

  private cancel = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId)
    this.ptrs.delete(e.pointerId)
    if (p?.type === 'mouse') this.follow = false
  }

  /** Modo concentrado: dos o más dedos en pantalla. */
  get focus(): boolean {
    let n = 0
    for (const p of this.ptrs.values()) if (p.type !== 'mouse') n++
    return n >= 2
  }

  /** Hay algún dedo tocando (para saber si el jugador está "pilotando"). */
  get touching(): boolean {
    for (const p of this.ptrs.values()) if (p.type !== 'mouse') return true
    return false
  }

  consume() {
    this.dx = 0
    this.dy = 0
    this.taps.length = 0
    this.hoverMoved = false
  }

  reset() {
    this.ptrs.clear()
    this.follow = false
    this.consume()
  }
}
