/**
 * Kit de "game feel" compartido: temblor de cámara, hit-stop, textos
 * flotantes, partículas y destellos. Cada juego crea su propio `Juice` y lo
 * actualiza/dibuja dentro de su bucle de animación.
 *
 * Uso típico dentro del bucle:
 *   const dtGame = juice.update(dt)       // 0 mientras dure un hit-stop
 *   ...actualizar el juego con dtGame...
 *   ctx.save(); juice.applyShake(ctx)      // antes de dibujar el mundo
 *   ...dibujar mundo...
 *   juice.drawParticles(ctx); juice.drawTexts(ctx)
 *   ctx.restore(); juice.drawFlash(ctx, W, H)
 */

export interface JuiceParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
  drag: number
}

export interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
  size: number
}

export interface BurstOpts {
  count?: number
  speed?: number
  /** Variación aleatoria de la velocidad (0..1). */
  spread?: number
  life?: number
  size?: number
  gravity?: number
  drag?: number
  /** Ángulo central en radianes y apertura del cono (por defecto 360°). */
  angle?: number
  arc?: number
}

export class Juice {
  particles: JuiceParticle[] = []
  texts: FloatingText[] = []
  /** Trauma de cámara 0..1; el temblor es proporcional a trauma². */
  trauma = 0
  hitstop = 0
  flashAlpha = 0
  flashColor = '#ffffff'
  private time = 0

  constructor(private maxShake = 10) {}

  reset() {
    this.particles = []
    this.texts = []
    this.trauma = 0
    this.hitstop = 0
    this.flashAlpha = 0
  }

  /** Añade temblor (0..1). Golpes pequeños ~0.2, explosiones ~0.5, muerte ~0.8. */
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Congela la simulación unos milisegundos para dar peso a un impacto. */
  freeze(ms: number) {
    this.hitstop = Math.max(this.hitstop, ms / 1000)
  }

  flash(color = '#ffffff', alpha = 0.35) {
    this.flashColor = color
    this.flashAlpha = Math.max(this.flashAlpha, alpha)
  }

  text(x: number, y: number, text: string, color = '#ffffff', size = 12, life = 0.8) {
    this.texts.push({ x, y, text, color, life, maxLife: life, size })
  }

  burst(x: number, y: number, color: string | string[], o: BurstOpts = {}) {
    const count = o.count ?? 12
    const speed = o.speed ?? 120
    const spread = o.spread ?? 0.6
    const arc = o.arc ?? Math.PI * 2
    const base = o.angle ?? 0
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * arc
      const sp = speed * (1 - spread + Math.random() * spread * 2)
      const life = (o.life ?? 0.5) * (0.6 + Math.random() * 0.8)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color,
        gravity: o.gravity ?? 0,
        drag: o.drag ?? 2,
      })
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600)
  }

  /**
   * Avanza los efectos con el tiempo real y devuelve el dt que debe usar la
   * simulación del juego (0 durante un hit-stop).
   */
  update(dt: number): number {
    this.time += dt
    this.trauma = Math.max(0, this.trauma - dt * 1.6)
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3)
    for (const p of this.particles) {
      p.life -= dt
      p.vy += p.gravity * dt
      const k = Math.max(0, 1 - p.drag * dt)
      p.vx *= k
      p.vy *= k
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const t of this.texts) {
      t.life -= dt
      t.y -= 28 * dt
    }
    this.texts = this.texts.filter((t) => t.life > 0)
    if (this.hitstop > 0) {
      this.hitstop -= dt
      return 0
    }
    return dt
  }

  applyShake(ctx: CanvasRenderingContext2D) {
    if (this.trauma <= 0) return
    const s = this.trauma * this.trauma * this.maxShake
    const t = this.time * 60
    ctx.translate(Math.sin(t * 1.7) * s, Math.cos(t * 2.3) * s)
  }

  drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color
      const s = p.size
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    }
    ctx.globalAlpha = 1
  }

  drawTexts(ctx: CanvasRenderingContext2D, font = '"Press Start 2P", var(--font-pixel), monospace') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const t of this.texts) {
      const k = t.life / t.maxLife
      // pequeño "pop" de escala al aparecer
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1
      ctx.globalAlpha = Math.min(1, k * 2)
      ctx.font = `${Math.round(t.size * pop)}px ${font}`
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(t.text, t.x + 1.5, t.y + 1.5)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.flashAlpha <= 0) return
    ctx.globalAlpha = this.flashAlpha
    ctx.fillStyle = this.flashColor
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
}
