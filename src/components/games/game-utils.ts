'use client'

/**
 * Factor de resolución interna del canvas. Se renderiza al menos a 2x para que
 * la pantalla siga nítida cuando se escala para llenar monitores grandes.
 */
export function renderScale(): number {
  return Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)))
}

/** Prepara un canvas con escala de resolución para dibujado nítido. */
export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = renderScale()
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  return ctx
}

/** Mejor puntuación guardada en localStorage por juego. */
export function loadBest(gameId: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(`arcade-best-${gameId}`)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveBest(gameId: string, score: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const prev = loadBest(gameId)
    if (score > prev) {
      window.localStorage.setItem(`arcade-best-${gameId}`, String(score))
      window.dispatchEvent(new Event('arcade-store-change'))
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Dibuja una matriz de píxeles ('X' = pintado) estilo pixel-art. */
export function drawMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: string[],
  x: number,
  y: number,
  cell: number,
  color: string,
) {
  ctx.fillStyle = color
  for (let row = 0; row < matrix.length; row++) {
    const line = matrix[row]
    for (let col = 0; col < line.length; col++) {
      if (line[col] === 'X') {
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell)
      }
    }
  }
}

/** Rectángulo redondeado (compatibilidad sin roundRect nativo). */
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function aabb(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}
