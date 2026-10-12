/**
 * Métricas anónimas de juego: por sesión se envía UNA sola petición a /api/plays
 * al salir del juego, con el juego, las partidas jugadas y los segundos en que la
 * pestaña estuvo visible. No se guarda nada personal ni cookies.
 */

interface Session {
  game: string
  start: number
  rounds: number
  /** Momento en que la pestaña se ocultó; null si está visible. */
  hiddenAt: number | null
  /** Milisegundos acumulados con la pestaña oculta. */
  hiddenMs: number
}

let current: Session | null = null
let listening = false

function onVisibilityChange() {
  if (!current) return
  const now = Date.now()
  if (document.visibilityState === 'hidden') {
    current.hiddenAt ??= now
  } else if (current.hiddenAt !== null) {
    current.hiddenMs += now - current.hiddenAt
    current.hiddenAt = null
  }
}

/** Registra los oyentes una sola vez, al primer uso en el navegador. */
function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', endSession)
}

/** Empieza a contar una sesión del juego indicado (cierra la anterior si sigue abierta). */
export function beginSession(game: string) {
  if (typeof window === 'undefined') return
  listen()
  endSession()
  const now = Date.now()
  current = {
    game,
    start: now,
    rounds: 0,
    hiddenAt: document.visibilityState === 'hidden' ? now : null,
    hiddenMs: 0,
  }
}

/** Suma una partida terminada al juego en curso. */
export function countRound(game: string) {
  if (current && current.game === game) current.rounds++
}

/** Cierra la sesión en curso y envía sus totales al servidor. */
export function endSession() {
  if (typeof window === 'undefined' || !current) return
  const now = Date.now()
  const s = current
  current = null
  const hidden = s.hiddenMs + (s.hiddenAt !== null ? now - s.hiddenAt : 0)
  const seconds = Math.max(0, Math.round((now - s.start - hidden) / 1000))
  // En desarrollo no se mandan datos para no ensuciar las estadísticas.
  if (process.env.NODE_ENV !== 'production') return
  const body = JSON.stringify({ game: s.game, rounds: s.rounds, seconds })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/plays', body)
    } else {
      void fetch('/api/plays', { method: 'POST', keepalive: true, body }).catch(() => {})
    }
  } catch {
    // Las métricas nunca deben romper el juego.
  }
}
