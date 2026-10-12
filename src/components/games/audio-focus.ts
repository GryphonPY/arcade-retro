'use client'

/**
 * Control del audio según la visibilidad de la página.
 * Cuando la página queda oculta (cambio de app, botón de inicio, bloqueo de
 * pantalla, pestaña en segundo plano) se suspenden todos los AudioContext
 * registrados; al volver a primer plano se reanudan. Mientras la página esté
 * oculta, ningún módulo debe reanudar ni programar audio (ver pageHidden()).
 *
 * No se usan blur/focus: en escritorio se disparan al hacer clic en las
 * herramientas de desarrollo u otros elementos y no significan que la página
 * esté en segundo plano.
 */

const contexts = new Set<AudioContext>()
let installed = false
/** true desde pagehide/freeze hasta pageshow/resume o hasta volver a estar visible */
let frozen = false

/** true si la página está oculta o congelada (SSR-safe: false sin document). */
export function pageHidden(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'hidden' || frozen
}

/** Quita los contextos cerrados del registro. */
function prune(): void {
  for (const c of contexts) {
    if (c.state === 'closed') contexts.delete(c)
  }
}

function suspendAll(): void {
  prune()
  for (const c of contexts) {
    if (c.state !== 'running') continue
    try {
      void c.suspend().catch(() => {})
    } catch {
      // contexto no disponible
    }
  }
}

function resumeAll(): void {
  // Nunca reanudar mientras la página siga oculta
  if (pageHidden()) return
  prune()
  for (const c of contexts) {
    if (c.state !== 'suspended') continue
    try {
      void c.resume().catch(() => {})
    } catch {
      // contexto no disponible
    }
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    suspendAll()
    return
  }
  // Volver a estar visible equivale a salir del estado congelado
  frozen = false
  resumeAll()
}

function onHide(): void {
  frozen = true
  suspendAll()
}

function onShow(): void {
  frozen = false
  resumeAll()
}

/**
 * Instala los listeners una sola vez. pagehide/pageshow los dispara el
 * navegador sobre window; freeze/resume (Page Lifecycle) sobre document.
 */
function install(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('freeze', onHide)
  document.addEventListener('resume', onShow)
  window.addEventListener('pagehide', onHide)
  window.addEventListener('pageshow', onShow)
}

/** Registra un AudioContext para que se suspenda en segundo plano y se reanude al volver. */
export function registerAudioContext(ctx: AudioContext): void {
  if (typeof document === 'undefined') return
  contexts.add(ctx)
  install()
  // Si se crea con la página ya oculta, no debe sonar
  if (pageHidden() && ctx.state === 'running') {
    try {
      void ctx.suspend().catch(() => {})
    } catch {
      // contexto no disponible
    }
  }
}
