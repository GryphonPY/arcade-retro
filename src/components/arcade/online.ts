'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Cliente de la tabla de récords en línea (API del Worker en /api/scores).
 * Si la API no está disponible (por ejemplo en `next dev` o si la base aún no
 * existe) todo falla en silencio y la interfaz simplemente no la muestra.
 */

export interface OnlineEntry {
  name: string
  score: number
}

export interface SubmitResult {
  name: string
  best: number
  rank: number
  improved: boolean
}

export const NICK_MAX = 16
const NICK_KEY = 'arcade-nick'
const NICK_EVENT = 'arcade-nick-change'

/** Juego activo, para que las pantallas de fin de partida sepan qué publicar. */
export const ActiveGameContext = createContext<string | null>(null)
export const useActiveGame = () => useContext(ActiveGameContext)

// ---------- apodo ----------

function readNick() {
  try {
    return window.localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}

function subscribeNick(cb: () => void) {
  window.addEventListener(NICK_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(NICK_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useNickname() {
  return useSyncExternalStore(subscribeNick, readNick, () => '')
}

export function setNickname(name: string) {
  try {
    if (name) window.localStorage.setItem(NICK_KEY, name)
    else window.localStorage.removeItem(NICK_KEY)
  } catch {
    // sin acceso a localStorage
  }
  window.dispatchEvent(new Event(NICK_EVENT))
}

/** Limpieza en el cliente (el servidor vuelve a validar). */
export function tidyNickname(raw: string) {
  return raw
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, NICK_MAX)
}

// ---------- API ----------

const TOP_CACHE_MS = 15_000
let summaryCache: { at: number; data: Record<string, OnlineEntry[]> | null } | null = null
const gameCache = new Map<string, { at: number; data: OnlineEntry[] }>()
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export async function fetchSummary(force = false): Promise<Record<string, OnlineEntry[]> | null> {
  if (!force && summaryCache && Date.now() - summaryCache.at < TOP_CACHE_MS) return summaryCache.data
  try {
    const res = await fetch('/api/scores', { headers: { accept: 'application/json' } })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(String(res.status))
    const body = (await res.json()) as { top: Record<string, OnlineEntry[]> }
    summaryCache = { at: Date.now(), data: body.top }
  } catch {
    summaryCache = { at: Date.now(), data: null }
  }
  notify()
  return summaryCache.data
}

export async function fetchGameTop(game: string, limit = 10): Promise<OnlineEntry[] | null> {
  const cached = gameCache.get(game)
  if (cached && Date.now() - cached.at < TOP_CACHE_MS) return cached.data
  try {
    const res = await fetch(`/api/scores?game=${encodeURIComponent(game)}&limit=${limit}`)
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    const body = (await res.json()) as { scores: OnlineEntry[] }
    gameCache.set(game, { at: Date.now(), data: body.scores })
    return body.scores
  } catch {
    return null
  }
}

export type SubmitError = 'apodo-invalido' | 'demasiados-envios' | 'sin-conexion'

export async function submitScore(game: string, name: string, score: number): Promise<SubmitResult | SubmitError> {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game, name, score }),
    })
    if (!res.headers.get('content-type')?.includes('json')) return 'sin-conexion'
    const body = (await res.json()) as SubmitResult & { error?: string }
    if (!res.ok) {
      if (body.error === 'apodo-invalido') return 'apodo-invalido'
      if (body.error === 'demasiados-envios') return 'demasiados-envios'
      return 'sin-conexion'
    }
    gameCache.delete(game)
    summaryCache = null
    void fetchSummary(true)
    return body
  } catch {
    return 'sin-conexion'
  }
}

/** Top 3 mundial por juego, o null si la tabla en línea no está disponible. */
export function useOnlineSummary() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((n) => n + 1)
    listeners.add(l)
    void fetchSummary()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return summaryCache?.data ?? null
}
