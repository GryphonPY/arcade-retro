'use client'

import { useSyncExternalStore } from 'react'

/**
 * Juegos más jugados (API del Worker en /api/plays, métricas anónimas).
 * Cuenta sesiones: veces que se abrió un juego y se jugó al menos 3 s.
 * Si la API no está disponible (por ejemplo en `next dev`) no hay orden por
 * popularidad y la interfaz conserva el orden de siempre.
 */

const KEY = 'arcade-popular'
const DAY_MS = 86_400_000
const DAYS = 14

type Popularity = Record<string, number>

let state: Popularity | null = null
let started = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Último resultado guardado en este navegador, o null si no hay o no es válido. */
function readStored(): { at: number; data: Popularity } | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { at?: unknown; data?: unknown }
    if (typeof v.at === 'number' && v.data && typeof v.data === 'object') {
      return { at: v.at, data: v.data as Popularity }
    }
  } catch {
    // sin acceso a localStorage o dato dañado
  }
  return null
}

function store(data: Popularity) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // sin acceso a localStorage
  }
}

/** Una sola petición por carga de página; si falla, se queda con lo guardado (o null). */
async function refresh() {
  try {
    const res = await fetch(`/api/plays?days=${DAYS}`, { headers: { accept: 'application/json' } })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return
    const body = (await res.json()) as { games?: { game?: unknown; sessions?: unknown }[] }
    const data: Popularity = {}
    for (const g of body.games ?? []) {
      if (typeof g.game === 'string' && typeof g.sessions === 'number') data[g.game] = g.sessions
    }
    state = data
    store(data)
    emit()
  } catch {
    // sin API (desarrollo local): fallo silencioso
  }
}

/** Arranca una vez: usa lo guardado si es reciente y refresca en segundo plano. */
function start() {
  if (started) return
  started = true
  const stored = readStored()
  if (stored && Date.now() - stored.at < DAY_MS) state = stored.data
  void refresh()
}

function subscribe(cb: () => void) {
  start()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Sesiones por juego de los últimos 14 días, o null si no hay datos.
 * Empieza en null (igual que el servidor) y se aplica tras montar.
 */
export function usePopularity(): Popularity | null {
  return useSyncExternalStore(subscribe, () => state, () => null)
}
